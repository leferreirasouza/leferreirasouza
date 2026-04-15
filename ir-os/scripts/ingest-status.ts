#!/usr/bin/env tsx
/**
 * INGESTION STATUS SCRIPT
 *
 * Shows what's in the knowledge base and lets you search it.
 *
 * Usage:
 *   npm run ingest:status -- --company co-tick3-abc123
 *   npm run ingest:status -- --company co-tick3-abc123 --search "EBITDA 2025"
 */

import "dotenv/config";
import { DocumentRepository } from "../src/data/repositories/document-repository";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };
  return {
    company: get("--company") ?? process.env.COMPANY_ID,
    search: get("--search"),
    docType: get("--type"),
    year: get("--year") ? parseInt(get("--year")!) : undefined,
  };
}

async function main() {
  const args = parseArgs();
  if (!args.company) {
    console.error("Usage: npm run ingest:status -- --company <company-id>\n  Or set COMPANY_ID in .env");
    process.exit(1);
  }

  const repo = new DocumentRepository();

  // ── Stats ──────────────────────────────────────────────────────────────
  const stats = repo.stats(args.company);
  console.log(`\n📚 Knowledge Base — Company: ${args.company}`);
  console.log(`\n  Total documents: ${stats.total}`);

  if (stats.total === 0) {
    console.log(`\n  ⚠  No documents ingested yet.`);
    console.log(`\n  To get started:`);
    console.log(`    npm run ingest:web -- --url <ir-website> --company ${args.company}`);
    console.log(`    npm run ingest:file -- --folder <your-docs> --company ${args.company}`);
    return;
  }

  console.log(`\n  By source:`);
  Object.entries(stats.by_source).forEach(([src, n]) => console.log(`    ${src.padEnd(20)} ${n}`));

  console.log(`\n  By document type:`);
  Object.entries(stats.by_type)
    .sort(([, a], [, b]) => b - a)
    .forEach(([type, n]) => console.log(`    ${type.padEnd(30)} ${n}`));

  // ── Recent documents ───────────────────────────────────────────────────
  const recent = repo.listByCompany(args.company, { doc_type: args.docType, period_year: args.year, limit: 15 });
  console.log(`\n  Recent documents (${args.docType ?? "all types"}${args.year ? `, ${args.year}` : ""}):`);
  recent.forEach((d) => {
    const period = d.period_label ? `[${d.period_label}]` : "       ";
    const src = d.source === "WEB_CRAWL" ? "🌐" : "📤";
    console.log(`    ${src} ${period} ${d.doc_type.padEnd(22)} ${d.title.slice(0, 55)}`);
  });

  // ── Search ─────────────────────────────────────────────────────────────
  if (args.search) {
    console.log(`\n  🔍 Search: "${args.search}"`);
    const results = repo.search(args.company, args.search, 5);
    if (results.length === 0) {
      console.log("    No results found.");
    } else {
      results.forEach((r, i) => {
        console.log(`\n  Result ${i + 1}: ${r.title} [${r.doc_type}] ${r.period_label ?? ""}`);
        console.log(`    ${r.snippet}`);
      });
    }
  }

  console.log(`\n  Tip: search with --search "your query" to test retrieval.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
