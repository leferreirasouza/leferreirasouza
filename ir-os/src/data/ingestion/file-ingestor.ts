/**
 * FILE INGESTOR
 *
 * Batch-ingests local documents (PDFs, Word, Excel) from a folder
 * or from an explicit file list into the knowledge base.
 *
 * Use cases:
 *  - You have a folder of historical press releases and annual reports
 *  - You want to upload a specific analyst model or presentation
 *  - You want to bulk-import all your IRO files at once
 */

import { readdirSync, statSync } from "fs";
import { resolve as pathResolve, extname, join } from "path";
import { parseFile } from "./document-parser";
import { DocumentRepository } from "../repositories/document-repository";

export interface IngestOptions {
  companyId: string;
  source: "UPLOAD";
  onProgress?: (msg: string) => void;
  // Override auto-detection
  defaultDocType?: string;
  defaultLanguage?: "PT" | "EN";
  defaultClassification?: "PUBLIC" | "INTERNAL_APPROVED" | "DRAFT_INTERNAL";
}

export interface IngestResult {
  total: number;
  ingested: number;
  failed: number;
  skipped: number;
  docIds: string[];
  errors: { file: string; error: string }[];
}

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".xlsx", ".xls", ".txt", ".md"]);

export class FileIngestor {
  private readonly repo = new DocumentRepository();

  /**
   * Ingest all supported documents from a folder (non-recursive by default).
   */
  async ingestFolder(folderPath: string, opts: IngestOptions, recursive = false): Promise<IngestResult> {
    const files = this.collectFiles(resolve(folderPath), recursive);
    opts.onProgress?.(`\n📂 Found ${files.length} files in: ${folderPath}`);
    return this.ingestFiles(files, opts);
  }

  /**
   * Ingest a specific list of file paths.
   */
  async ingestFiles(filePaths: string[], opts: IngestOptions): Promise<IngestResult> {
    const { companyId, onProgress = console.log } = opts;
    const result: IngestResult = { total: filePaths.length, ingested: 0, failed: 0, skipped: 0, docIds: [], errors: [] };

    for (const filePath of filePaths) {
      try {
        // Skip if same local_path already ingested
        const existing = this.repo.listByCompany(companyId).find((d) => d.local_path === filePath);
        if (existing) {
          result.skipped++;
          onProgress(`  ↷ Already ingested: ${baseName(filePath)}`);
          continue;
        }

        const parsed = await parseFile(filePath);

        const docId = this.repo.upsert({
          company_id: companyId,
          title: parsed.title,
          doc_type: opts.defaultDocType ?? parsed.detectedDocType,
          source: "UPLOAD",
          local_path: filePath,
          language: opts.defaultLanguage ?? (parsed.language === "UNKNOWN" ? "PT" : parsed.language),
          period_label: parsed.detectedPeriod?.label,
          period_year: parsed.detectedPeriod?.year,
          period_quarter: parsed.detectedPeriod?.quarter,
          classification: opts.defaultClassification ?? "PUBLIC",
          word_count: parsed.wordCount,
          page_count: parsed.pageCount,
          raw_text: parsed.rawText,
        });

        result.docIds.push(docId);
        result.ingested++;
        onProgress(`  ✓ [${parsed.detectedDocType}] ${parsed.title.slice(0, 70)} (${parsed.wordCount.toLocaleString()} words)`);
      } catch (err) {
        result.failed++;
        result.errors.push({ file: filePath, error: (err as Error).message });
        onProgress(`  ✗ Failed: ${baseName(filePath)} — ${(err as Error).message}`);
      }
    }

    onProgress(`\n✅ Ingestion complete: ${result.ingested} ingested, ${result.skipped} skipped, ${result.failed} failed.`);
    return result;
  }

  /**
   * Ingest a single file — useful for the API upload endpoint.
   */
  async ingestSingleFile(
    filePath: string,
    opts: IngestOptions & {
      titleOverride?: string;
      docTypeOverride?: string;
      periodLabel?: string;
      filedAt?: string;
    }
  ): Promise<{ docId: string; parsed: Awaited<ReturnType<typeof parseFile>> }> {
    const parsed = await parseFile(filePath);

    const docId = this.repo.upsert({
      company_id: opts.companyId,
      title: opts.titleOverride ?? parsed.title,
      doc_type: opts.docTypeOverride ?? parsed.detectedDocType,
      source: "UPLOAD",
      local_path: filePath,
      language: opts.defaultLanguage ?? (parsed.language === "UNKNOWN" ? "PT" : parsed.language),
      period_label: opts.periodLabel ?? parsed.detectedPeriod?.label,
      period_year: parsed.detectedPeriod?.year,
      period_quarter: parsed.detectedPeriod?.quarter,
      filed_at: opts.filedAt,
      classification: opts.defaultClassification ?? "PUBLIC",
      word_count: parsed.wordCount,
      page_count: parsed.pageCount,
      raw_text: parsed.rawText,
    });

    return { docId, parsed };
  }

  private collectFiles(folderPath: string, recursive: boolean): string[] {
    const files: string[] = [];
    for (const entry of readdirSync(folderPath)) {
      const full = join(folderPath, entry);
      const stat = statSync(full);
      if (stat.isDirectory() && recursive) {
        files.push(...this.collectFiles(full, recursive));
      } else if (stat.isFile() && SUPPORTED_EXTENSIONS.has(extname(entry).toLowerCase())) {
        files.push(full);
      }
    }
    return files;
  }
}

function resolve(p: string): string {
  return pathResolve(process.cwd(), p);
}

function baseName(p: string): string {
  return p.split(/[/\\]/).pop() ?? p;
}
