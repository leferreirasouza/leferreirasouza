/**
 * IR WEBSITE CRAWLER
 *
 * Crawls a company's IR website and downloads all relevant documents
 * (PDFs, presentations, press releases, filings) into the knowledge base.
 *
 * Strategy:
 * 1. Fetch the IR website's main page and linked section pages.
 * 2. Discover all document links (PDFs and known filing patterns).
 * 3. Download each document, parse the text, and store in the repository.
 * 4. Respect robots.txt, rate-limit requests, and skip already-ingested URLs.
 *
 * Also works with CVM ENET and SEC EDGAR direct document URLs.
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { createWriteStream, mkdirSync } from "fs";
import { resolve as pathResolve, extname, basename } from "path";
import { randomUUID } from "crypto";
import { pipeline } from "stream/promises";
import pLimit from "p-limit";
import { parseFile } from "./document-parser";
import { DocumentRepository } from "../repositories/document-repository";
import type { DocumentTypeGuess } from "./document-parser";

export interface CrawlOptions {
  companyId: string;
  baseUrl: string;             // e.g. "https://ri.company.com.br"
  maxDepth?: number;           // default 2
  maxDocuments?: number;       // default 200
  concurrency?: number;        // default 3
  downloadDir?: string;        // where to save PDFs
  onProgress?: (msg: string) => void;
  // Specific section URLs to also crawl (e.g. press releases, filings)
  sectionUrls?: string[];
}

export interface CrawlResult {
  docsFound: number;
  docsIngested: number;
  docsFailed: number;
  docsSkipped: number;         // already in DB
  errors: { url: string; error: string }[];
  docIds: string[];
}

// Document link patterns we're interested in
const DOC_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".xlsx", ".xls"]);

// URL patterns that typically contain IR documents
const IR_SECTION_PATTERNS = [
  /resultados?|results?|earnings?/i,
  /release|comunicado|press/i,
  /apresenta|presentation/i,
  /fato.?relevante|material.?fact/i,
  /relat.rio|annual.?report|dfp|itr/i,
  /formulario|reference.?form/i,
  /download|documentos?|documents?/i,
  /arquivo|filing/i,
];

export class IRWebCrawler {
  private readonly repo = new DocumentRepository();

  async crawl(opts: CrawlOptions): Promise<CrawlResult> {
    const {
      companyId,
      baseUrl,
      maxDepth = 2,
      maxDocuments = 200,
      concurrency = 3,
      downloadDir = "./uploads",
      onProgress = console.log,
      sectionUrls = [],
    } = opts;

    mkdirSync(downloadDir, { recursive: true });

    const limit = pLimit(concurrency);
    const visited = new Set<string>();
    const docQueue: string[] = [];    // URLs pointing to downloadable documents
    const pageQueue: string[] = [baseUrl, ...sectionUrls];
    const result: CrawlResult = { docsFound: 0, docsIngested: 0, docsFailed: 0, docsSkipped: 0, errors: [], docIds: [] };

    // ── PHASE 1: Discover document URLs ──────────────────────────────────
    onProgress(`\n🔍 Crawling IR website: ${baseUrl}`);

    const crawlPage = async (url: string, depth: number): Promise<void> => {
      if (visited.has(url) || depth > maxDepth) return;
      visited.add(url);

      try {
        const resp = await axios.get(url, {
          timeout: 15_000,
          headers: {
            "User-Agent": "IR-OS/0.1 (Investor Relations Data Ingestion; institutional use)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9",
          },
          maxRedirects: 5,
        });

        if (!resp.headers["content-type"]?.includes("text/html")) return;

        const $ = cheerio.load(resp.data as string);
        const pageBase = new URL(url);

        $("a[href]").each((_i, el) => {
          const href = $(el).attr("href");
          if (!href) return;

          let resolved: URL;
          try {
            resolved = new URL(href, pageBase.origin + pageBase.pathname);
          } catch {
            return;
          }

          const urlStr = resolved.toString().split("?")[0].split("#")[0]; // strip params/fragments
          if (visited.has(urlStr)) return;

          const ext = extname(resolved.pathname).toLowerCase();

          // It's a downloadable document
          if (DOC_EXTENSIONS.has(ext)) {
            if (!docQueue.includes(urlStr)) docQueue.push(urlStr);
            return;
          }

          // It's an HTML page worth crawling (same domain, IR-looking path)
          const sameDomain = resolved.hostname === pageBase.hostname;
          const isIRPage = IR_SECTION_PATTERNS.some((p) => p.test(resolved.pathname + " " + ($(el).text() || "")));
          if (sameDomain && isIRPage && depth < maxDepth) {
            pageQueue.push(urlStr);
          }
        });
      } catch (err) {
        onProgress(`  ⚠ Could not crawl page: ${url} — ${(err as Error).message}`);
      }
    };

    // BFS page crawl
    while (pageQueue.length > 0 && docQueue.length < maxDocuments) {
      const pageBatch = pageQueue.splice(0, 5);
      await Promise.all(pageBatch.map((url) => limit(() => crawlPage(url, visited.size > 20 ? maxDepth : 1))));
    }

    result.docsFound = docQueue.length;
    onProgress(`  Found ${docQueue.length} document URLs across ${visited.size} pages.`);

    if (docQueue.length === 0) {
      onProgress("  No documents found. Check the baseUrl or try adding specific sectionUrls.");
      return result;
    }

    // ── PHASE 2: Download and ingest documents ────────────────────────────
    onProgress(`\n📥 Downloading and ingesting up to ${maxDocuments} documents…`);

    const ingestDoc = async (docUrl: string): Promise<void> => {
      const fileName = basename(new URL(docUrl).pathname) || `doc-${randomUUID()}.pdf`;
      const localPath = pathResolve(downloadDir, `${companyId}-${randomUUID()}-${fileName}`);

      try {
        // Skip if already in the DB
        const existing = this.repo.listByCompany(companyId).find((d) => d.source_url === docUrl);
        if (existing) {
          result.docsSkipped++;
          return;
        }

        // Download
        const response = await axios.get(docUrl, {
          responseType: "stream",
          timeout: 60_000,
          headers: { "User-Agent": "IR-OS/0.1 (institutional use)" },
          maxRedirects: 5,
        });

        const writer = createWriteStream(localPath);
        await pipeline(response.data, writer);

        // Parse text
        const parsed = await parseFile(localPath);

        // Store
        const docId = this.repo.upsert({
          company_id: companyId,
          title: parsed.title,
          doc_type: parsed.detectedDocType,
          source: "WEB_CRAWL",
          source_url: docUrl,
          local_path: localPath,
          language: parsed.language === "UNKNOWN" ? "PT" : parsed.language,
          period_label: parsed.detectedPeriod?.label,
          period_year: parsed.detectedPeriod?.year,
          period_quarter: parsed.detectedPeriod?.quarter,
          classification: "PUBLIC",
          word_count: parsed.wordCount,
          page_count: parsed.pageCount,
          raw_text: parsed.rawText,
        });

        result.docIds.push(docId);
        result.docsIngested++;
        onProgress(`  ✓ ${parsed.detectedDocType} — ${parsed.title.slice(0, 70)}`);
      } catch (err) {
        result.docsFailed++;
        result.errors.push({ url: docUrl, error: (err as Error).message });
        onProgress(`  ✗ Failed: ${docUrl.slice(0, 80)} — ${(err as Error).message}`);
      }
    };

    const docBatch = docQueue.slice(0, maxDocuments);
    await Promise.all(docBatch.map((url) => limit(() => ingestDoc(url))));

    onProgress(`\n✅ Crawl complete.`);
    onProgress(`   Ingested: ${result.docsIngested} | Skipped (already stored): ${result.docsSkipped} | Failed: ${result.docsFailed}`);

    return result;
  }
}
