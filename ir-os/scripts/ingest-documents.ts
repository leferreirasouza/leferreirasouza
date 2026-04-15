#!/usr/bin/env tsx
/**
 * FILE INGESTION SCRIPT
 *
 * Batch-ingest local documents (PDFs, Word, Excel) into the knowledge base.
 *
 * Usage:
 *   npm run ingest:file -- --folder ./my-ir-documents --company co-tick3-abc123
 *   npm run ingest:file -- --file ./reports/4Q25-results.pdf --company co-tick3-abc123
 *   npm run ingest:file -- --folder ./my-docs --company co-tick3-abc123 --recursive
 *
 * Supports: .pdf  .docx  .doc  .xlsx  .xls  .txt  .md
 *
 * The script will:
 *  1. Scan the folder (or use the specific file)
 *  2. Parse text from each document
 *  3. Auto-detect document type (press release, annual report, presentation, etc.)
 *  4. Auto-detect the fiscal period from filename and content
 *  5. Index into the SQLite knowledge base with full-text search
 *  6. Skip files already ingested (idempotent)
 */

import "dotenv/config";
import { FileIngestor } from "../src/data/ingestion/file-ingestor";
import { resolve } from "path";
import { existsSync } from "fs";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  return {
    folder: get("--folder"),
    file: get("--file"),
    company: get("--company") ?? process.env.COMPANY_ID,
    recursive: args.includes("--recursive"),
    classification: (get("--classification") as any) ?? "PUBLIC",
    language: (get("--language") as any) ?? undefined,
  };
}

async function main() {
  const args = parseArgs();

  if ((!args.folder && !args.file) || !args.company) {
    console.error(`
Usage: npm run ingest:file -- --folder <path> --company <company-id>
       npm run ingest:file -- --file <path> --company <company-id>

Options:
  --folder        Path to a folder of documents to ingest
  --file          Path to a single document to ingest
  --company       Company ID from setup (or set COMPANY_ID in .env)
  --recursive     Also scan subfolders (default: false)
  --classification  PUBLIC | INTERNAL_APPROVED | DRAFT_INTERNAL (default: PUBLIC)
  --language      PT | EN (default: auto-detect)

Examples:
  # Ingest a folder of press releases
  npm run ingest:file -- --folder ./press-releases --company co-vale3-abc123

  # Ingest your annual reports
  npm run ingest:file -- --folder ./annual-reports --company co-vale3-abc123

  # Ingest a single file
  npm run ingest:file -- --file ./4Q25-earnings.pdf --company co-vale3-abc123

  # Ingest internal-only documents (not public)
  npm run ingest:file -- --folder ./internal-models \\
    --company co-vale3-abc123 --classification INTERNAL_APPROVED
`);
    process.exit(1);
  }

  const ingestor = new FileIngestor();
  const startTime = Date.now();

  if (args.file) {
    const filePath = resolve(args.file);
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    console.log(`\n📄 Ingesting single file: ${args.file}`);
    const { docId, parsed } = await ingestor.ingestSingleFile(filePath, {
      companyId: args.company!,
      source: "UPLOAD",
      defaultClassification: args.classification,
      defaultLanguage: args.language,
    });

    console.log(`\n✅ Done in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`   Doc ID:   ${docId}`);
    console.log(`   Title:    ${parsed.title.slice(0, 70)}`);
    console.log(`   Type:     ${parsed.detectedDocType}`);
    console.log(`   Period:   ${parsed.detectedPeriod?.label ?? "not detected"}`);
    console.log(`   Words:    ${parsed.wordCount.toLocaleString()}`);
    console.log(`   Language: ${parsed.language}`);
    return;
  }

  // Folder mode
  const folderPath = resolve(args.folder!);
  if (!existsSync(folderPath)) {
    console.error(`Folder not found: ${folderPath}`);
    process.exit(1);
  }

  console.log(`\n📂 Ingesting folder: ${folderPath}`);
  console.log(`   Company:    ${args.company}`);
  console.log(`   Recursive:  ${args.recursive}`);
  console.log(`   Class:      ${args.classification}\n`);

  const result = await ingestor.ingestFolder(
    folderPath,
    {
      companyId: args.company!,
      source: "UPLOAD",
      defaultClassification: args.classification,
      defaultLanguage: args.language,
      onProgress: (msg) => console.log(msg),
    },
    args.recursive
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n──────────────────────────────────────────`);
  console.log(`  ✅ Done in ${elapsed}s`);
  console.log(`  ✓  Ingested:  ${result.ingested}`);
  console.log(`  ↷  Skipped:   ${result.skipped} (already in DB)`);
  console.log(`  ✗  Failed:    ${result.failed}`);
  if (result.errors.length) {
    console.log(`\n  Errors:`);
    result.errors.forEach((e) => console.log(`    ${e.file}: ${e.error}`));
  }
  console.log(`\n  Run 'npm run ingest:status -- --company ${args.company}' to see your knowledge base.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
