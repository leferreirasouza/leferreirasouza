#!/usr/bin/env tsx
/**
 * REFRESH REFERENCE LIBRARY
 *
 * CLI script to manually trigger ingestion of all automated reference sources.
 * MANUAL_ONLY sources (Mauboussin PDFs, NIRI, CFA standards, etc.) are skipped —
 * use `npm run ingest:file` for those.
 *
 * Usage:
 *   npm run refresh:reference
 *   npm run refresh:reference -- --cadence monthly
 *   npm run refresh:reference -- --domain VALUATION
 */

import "dotenv/config";
import { ReferenceIngestor } from "../src/data/ingestion/reference-ingestor";
import {
  REFERENCE_SOURCES,
  getSourcesByCadence,
} from "../src/data/ingestion/reference-sources";
import type { ReferenceSource } from "../src/data/ingestion/reference-sources";
import { ReferenceRepository } from "../src/data/repositories/reference-repository";

const args = process.argv.slice(2);
const cadenceArg = args[args.indexOf("--cadence") + 1] as string | undefined;
const domainArg = args[args.indexOf("--domain") + 1] as string | undefined;

function selectSources(): ReferenceSource[] {
  if (cadenceArg) {
    const cadence = cadenceArg.toUpperCase() as "MONTHLY" | "QUARTERLY" | "ANNUAL";
    if (!["MONTHLY", "QUARTERLY", "ANNUAL"].includes(cadence)) {
      console.error(`Invalid cadence: ${cadenceArg}. Use: monthly, quarterly, annual`);
      process.exit(1);
    }
    return getSourcesByCadence(cadence);
  }

  if (domainArg) {
    return REFERENCE_SOURCES.filter(
      (s) =>
        s.knowledgeDomain === domainArg.toUpperCase() &&
        s.fetchMethod !== "MANUAL_ONLY"
    );
  }

  // Default: all automated sources
  return REFERENCE_SOURCES.filter((s) => s.fetchMethod !== "MANUAL_ONLY");
}

async function main(): Promise<void> {
  const sources = selectSources();

  if (sources.length === 0) {
    console.log("No automated sources match the given filter. Check --cadence or --domain.");
    process.exit(0);
  }

  console.log(`\n[refresh:reference] Refreshing ${sources.length} source(s)...\n`);
  sources.forEach((s) => console.log(`  • ${s.name} (${s.refreshCadence})`));
  console.log();

  const ingestor = new ReferenceIngestor();
  const results = await ingestor.ingestBatch(sources);

  const succeeded = results.filter((r) => r.status === "SUCCESS");
  const failed    = results.filter((r) => r.status === "FAILED");
  const skipped   = results.filter((r) => r.status === "SKIPPED");

  console.log("\n─────────────────────────────────────────");
  console.log(`✓ Succeeded: ${succeeded.length}`);
  console.log(`✗ Failed:    ${failed.length}`);
  console.log(`⤼ Skipped:   ${skipped.length} (MANUAL_ONLY)`);

  if (failed.length > 0) {
    console.log("\nFailed sources:");
    failed.forEach((r) => console.log(`  • ${r.sourceId}: ${r.error}`));
  }

  const repo = new ReferenceRepository();
  const stats = repo.stats();
  console.log(`\nReference library total: ${stats.total} documents`);
  console.log("By domain:", stats.by_domain);

  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[refresh:reference] Fatal error:", err);
  process.exit(1);
});
