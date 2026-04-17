#!/usr/bin/env tsx
/**
 * SEED REFERENCE LIBRARY
 *
 * One-time seed of the most critical automated reference sources.
 * Run this after `npm run db:migrate` to populate foundational knowledge.
 *
 * MANUAL_ONLY sources (Mauboussin PDFs, NIRI, CFA standards, IAS 34, etc.)
 * are listed here for awareness but must be uploaded separately via:
 *   npm run ingest:file -- --file <path> --domain VALUATION --source-name "..."
 *
 * Usage:
 *   npm run seed:reference
 */

import "dotenv/config";
import { ReferenceIngestor } from "../src/data/ingestion/reference-ingestor";
import { REFERENCE_SOURCES } from "../src/data/ingestion/reference-sources";
import { ReferenceRepository } from "../src/data/repositories/reference-repository";

const SEED_SOURCE_IDS = [
  // Automated — will be fetched now
  "damodaran-country-risk",
  "damodaran-industry-betas",
  "damodaran-ebitda-multiples",
  "cvm-instrucao-358",
  "cvm-instrucao-480",
  "ipeadata-brazil-macro",
];

const MANUAL_ONLY_SOURCES = REFERENCE_SOURCES.filter(
  (s) => s.fetchMethod === "MANUAL_ONLY"
);

async function main(): Promise<void> {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║     IR-OS — Reference Library Seed              ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── Automated sources ───────────────────────────────────────────
  const autoSources = REFERENCE_SOURCES.filter((s) =>
    SEED_SOURCE_IDS.includes(s.sourceId)
  );

  console.log(`Fetching ${autoSources.length} automated reference source(s)...\n`);

  const ingestor = new ReferenceIngestor();
  const results = await ingestor.ingestBatch(autoSources);

  const succeeded = results.filter((r) => r.status === "SUCCESS");
  const failed    = results.filter((r) => r.status === "FAILED");

  console.log(`\n✓ Automated seed: ${succeeded.length} succeeded, ${failed.length} failed`);

  if (failed.length > 0) {
    console.warn("\nWarning — some sources failed to fetch:");
    failed.forEach((r) => console.warn(`  • ${r.sourceId}: ${r.error}`));
    console.warn("\nThese can be retried with: npm run refresh:reference");
  }

  // ── Manual-only sources — print instructions ────────────────────
  console.log("\n─────────────────────────────────────────────────────");
  console.log("MANUAL UPLOAD REQUIRED for the following sources:");
  console.log("Use: npm run ingest:file -- --file <path> --domain <domain>\n");

  MANUAL_ONLY_SOURCES.forEach((s) => {
    console.log(`  • [${s.knowledgeDomain}] ${s.name}`);
    if (s.notes) {
      console.log(`    Note: ${s.notes.slice(0, 120)}...`);
    }
  });

  console.log("\nMauboussin PDFs (download from SSRN or Morgan Stanley research):");
  console.log("  • Measuring the Moat");
  console.log("  • Capital Allocation (Evidence, Analytical Methods, Assessment Guidance)");
  console.log("  • Calculating Return on Invested Capital");
  console.log("  • Total Shareholder Return: Measurement, Drivers, and Uses");
  console.log("  • The Base Rate Book");

  // ── Final stats ────────────────────────────────────────────────
  const repo = new ReferenceRepository();
  const stats = repo.stats();
  console.log("\n─────────────────────────────────────────────────────");
  console.log(`Reference library now contains: ${stats.total} document(s)`);
  if (stats.total > 0) {
    console.log("By domain:", stats.by_domain);
  }
  console.log("\nSeed complete. Run `npm run refresh:reference` to update automated sources.\n");

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[seed:reference] Fatal error:", err);
  process.exit(1);
});
