/**
 * REFERENCE INGESTOR
 *
 * Fetches, parses, quality-scores, and upserts content from curated reference sources.
 * Handles PDF_DOWNLOAD, HTML_SCRAPE, JSON_API, and CSV_DOWNLOAD fetch methods.
 * MANUAL_ONLY sources are skipped (must be uploaded via ingest:file).
 */

import axios from "axios";
import * as cheerio from "cheerio";
import { ReferenceRepository } from "../repositories/reference-repository";
import type { KnowledgeDomain, RefType } from "../repositories/reference-repository";
import type { ReferenceSource } from "./reference-sources";

interface IngestResult {
  sourceId: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  refId?: string;
  wordCount?: number;
  qualityScore?: number;
  error?: string;
}

export class ReferenceIngestor {
  private readonly repo = new ReferenceRepository();

  async ingest(source: ReferenceSource): Promise<IngestResult> {
    if (source.fetchMethod === "MANUAL_ONLY") {
      this.repo.logIngest({
        source_id: source.sourceId,
        source_name: source.name,
        status: "MANUAL_ONLY",
      });
      return { sourceId: source.sourceId, status: "SKIPPED" };
    }

    if (!source.url) {
      const error = "No URL provided for automated fetch";
      this.repo.logIngest({
        source_id: source.sourceId,
        source_name: source.name,
        status: "FAILED",
        error_message: error,
      });
      return { sourceId: source.sourceId, status: "FAILED", error };
    }

    try {
      let rawText = "";
      let metadataJson: string | undefined;

      switch (source.fetchMethod) {
        case "PDF_DOWNLOAD":
          rawText = await this.fetchPdf(source.url);
          break;
        case "HTML_SCRAPE":
          rawText = await this.fetchHtml(source.url);
          break;
        case "JSON_API":
          rawText = await this.fetchJson(source.url);
          break;
        case "CSV_DOWNLOAD":
          ({ rawText, metadataJson } = await this.fetchCsv(source.url));
          break;
      }

      if (!rawText || rawText.length < 50) {
        throw new Error(`Fetched content too short (${rawText.length} chars) — likely blocked or empty`);
      }

      const wordCount = rawText.split(/\s+/).length;
      const qualityScore = this.computeQualityScore(source, rawText, wordCount);

      const refId = this.repo.upsert({
        title: source.name,
        knowledge_domain: source.knowledgeDomain as KnowledgeDomain,
        ref_type: source.refType as RefType,
        source_name: source.name,
        source_url: source.url,
        language: source.language === "BOTH" ? "EN" : source.language,
        quality_score: qualityScore,
        is_curated: 1,
        last_refreshed_at: new Date().toISOString(),
        raw_text: rawText,
        metadata_json: metadataJson,
        word_count: wordCount,
        tags: JSON.stringify(source.tags),
      });

      this.repo.logIngest({
        source_id: source.sourceId,
        source_name: source.name,
        status: "SUCCESS",
        ref_id: refId,
        quality_score: qualityScore,
        word_count: wordCount,
      });

      console.log(`[REFERENCE-INGESTOR] ✓ ${source.name} — ${wordCount} words (score: ${qualityScore.toFixed(2)})`);
      return { sourceId: source.sourceId, status: "SUCCESS", refId, wordCount, qualityScore };

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.repo.logIngest({
        source_id: source.sourceId,
        source_name: source.name,
        status: "FAILED",
        error_message: error,
      });
      console.error(`[REFERENCE-INGESTOR] ✗ ${source.name}: ${error}`);
      return { sourceId: source.sourceId, status: "FAILED", error };
    }
  }

  async ingestBatch(sources: ReferenceSource[]): Promise<IngestResult[]> {
    const results: IngestResult[] = [];
    for (const source of sources) {
      // Sequential to avoid rate limiting
      results.push(await this.ingest(source));
      await new Promise((r) => setTimeout(r, 500));
    }
    return results;
  }

  private async fetchPdf(url: string): Promise<string> {
    // Dynamic import to avoid loading pdf-parse at startup
    const pdfParse = (await import("pdf-parse")).default;
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30_000,
      headers: { "User-Agent": "IR-OS/1.0 reference-library-ingestor" },
    });
    const data = await pdfParse(Buffer.from(response.data));
    return data.text;
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await axios.get(url, {
      timeout: 20_000,
      headers: { "User-Agent": "IR-OS/1.0 reference-library-ingestor" },
    });
    const $ = cheerio.load(response.data as string);
    // Remove nav, footer, scripts, ads
    $("nav, footer, script, style, aside, .ad, .cookie-banner, .menu").remove();
    // Prefer main content areas
    const content =
      $("main").text() ||
      $("article").text() ||
      $(".content").text() ||
      $("body").text();
    return content.replace(/\s+/g, " ").trim();
  }

  private async fetchJson(url: string): Promise<string> {
    const response = await axios.get(url, {
      timeout: 20_000,
      headers: { "User-Agent": "IR-OS/1.0 reference-library-ingestor" },
    });
    return JSON.stringify(response.data, null, 2);
  }

  private async fetchCsv(
    url: string
  ): Promise<{ rawText: string; metadataJson: string }> {
    const response = await axios.get(url, {
      timeout: 20_000,
      responseType: "text",
      headers: { "User-Agent": "IR-OS/1.0 reference-library-ingestor" },
    });
    const raw = response.data as string;
    // Parse CSV into key-value pairs for metadata_json (better for FTS)
    const lines = raw.split("\n").filter(Boolean);
    const headers = lines[0]?.split(",").map((h) => h.trim().replace(/"/g, "")) ?? [];
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(",").map((v) => v.trim().replace(/"/g, ""));
      return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
    });
    return {
      rawText: raw,
      metadataJson: JSON.stringify(rows),
    };
  }

  private computeQualityScore(
    source: ReferenceSource,
    text: string,
    wordCount: number
  ): number {
    // Start from the source's declared quality score as the ceiling
    let score = source.qualityScore;
    // Penalise very short content
    if (wordCount < 500) score *= 0.7;
    else if (wordCount < 1000) score *= 0.85;
    // Penalise if content looks like an error page
    if (text.toLowerCase().includes("access denied") ||
        text.toLowerCase().includes("403 forbidden") ||
        text.toLowerCase().includes("404 not found")) {
      score *= 0.1;
    }
    return Math.min(1.0, Math.max(0.0, score));
  }
}
