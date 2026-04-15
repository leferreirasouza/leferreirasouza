#!/usr/bin/env tsx
/**
 * WEB CRAWL SCRIPT
 *
 * Crawls an IR website and ingests all documents into the knowledge base.
 *
 * Usage:
 *   npm run ingest:web -- --url https://ri.company.com.br --company co-tick3-abc123
 *   npm run ingest:web -- --url https://ri.vale.com --company co-vale3-xxx --max 300
 *
 * You can also pass specific section URLs to ensure complete coverage:
 *   npm run ingest:web -- \
 *     --url https://ri.company.com.br \
 *     --sections "https://ri.company.com.br/resultados,https://ri.company.com.br/comunicados" \
 *     --company co-tick3-abc123
 *
 * The script will:
 *  1. Crawl the IR website starting from --url
 *  2. Follow links to document-rich sections (press releases, filings, presentations)
 *  3. Download all PDFs and Word/Excel documents found
 *  4. Extract text, detect document type and period
 *  5. Store everything in the SQLite knowledge base
 *  6. Skip documents already ingested (idempotent)
 */

import "dotenv/config";
import { IRWebCrawler } from "../src/data/ingestion/ir-web-crawler";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : undefined;
  };
  return {
    url: get("--url") ?? process.env.IR_WEBSITE_URL,
    company: get("--company") ?? process.env.COMPANY_ID,
    sections: get("--sections")?.split(",").map((s) => s.trim()) ?? [],
    max: parseInt(get("--max") ?? "200"),
    depth: parseInt(get("--depth") ?? "2"),
    concurrency: parseInt(get("--concurrency") ?? "3"),
  };
}

async function main() {
  const args = parseArgs();

  if (!args.url || !args.company) {
    console.error(`
Usage: npm run ingest:web -- --url <ir-website-url> --company <company-id>

Options:
  --url         IR website base URL (required)
  --company     Company ID from setup (required, or set COMPANY_ID in .env)
  --sections    Comma-separated list of specific section URLs to also crawl
  --max         Maximum documents to download (default: 200)
  --depth       Crawl depth (default: 2)
  --concurrency Parallel downloads (default: 3)

Examples:
  npm run ingest:web -- --url https://ri.vale.com --company co-vale3-abc123
  npm run ingest:web -- --url https://ri.petrobras.com.br --company co-petr4-xyz --max 500
`);
    process.exit(1);
  }

  console.log(`\n🌐 IR Website Crawler`);
  console.log(`   URL:     ${args.url}`);
  console.log(`   Company: ${args.company}`);
  console.log(`   Max docs: ${args.max}`);
  if (args.sections.length) console.log(`   Sections: ${args.sections.join(", ")}`);

  const crawler = new IRWebCrawler();

  const startTime = Date.now();

  const result = await crawler.crawl({
    companyId: args.company,
    baseUrl: args.url,
    sectionUrls: args.sections,
    maxDocuments: args.max,
    maxDepth: args.depth,
    concurrency: args.concurrency,
    onProgress: (msg) => console.log(msg),
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n──────────────────────────────────────────`);
  console.log(`  ✅ Crawl finished in ${elapsed}s`);
  console.log(`  📄 Documents found:    ${result.docsFound}`);
  console.log(`  ✓  Documents ingested: ${result.docsIngested}`);
  console.log(`  ↷  Already in DB:      ${result.docsSkipped}`);
  console.log(`  ✗  Failed:             ${result.docsFailed}`);
  if (result.errors.length) {
    console.log(`\n  Errors:`);
    result.errors.slice(0, 5).forEach((e) => console.log(`    ${e.url.slice(0, 60)}: ${e.error}`));
  }
  console.log(`\n  Run 'npm run ingest:status -- --company ${args.company}' to see your knowledge base.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
