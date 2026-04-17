/**
 * REFERENCE LIBRARY SCHEDULER
 *
 * node-cron jobs that keep the reference library up to date.
 * Imported and initialized once at API startup (src/api/index.ts).
 *
 * Cadences:
 *   MONTHLY    → '0 3 1 * *'        (1st of every month at 03:00)
 *   QUARTERLY  → '0 2 1 1,4,7,10 *' (1st of Jan/Apr/Jul/Oct at 02:00)
 *   ANNUAL     → '0 1 2 1 *'        (2nd of January at 01:00)
 */

import cron from "node-cron";
import { ReferenceIngestor } from "./reference-ingestor";
import { getSourcesByCadence } from "./reference-sources";

export function startReferenceScheduler(): void {
  const ingestor = new ReferenceIngestor();

  // ── MONTHLY ────────────────────────────────────────────────────
  cron.schedule("0 3 1 * *", async () => {
    const sources = getSourcesByCadence("MONTHLY");
    console.log(`[REFERENCE-SCHEDULER] Monthly refresh — ${sources.length} sources`);
    await ingestor.ingestBatch(sources);
    console.log("[REFERENCE-SCHEDULER] Monthly refresh complete");
  });

  // ── QUARTERLY ──────────────────────────────────────────────────
  cron.schedule("0 2 1 1,4,7,10 *", async () => {
    const sources = getSourcesByCadence("QUARTERLY");
    console.log(`[REFERENCE-SCHEDULER] Quarterly refresh — ${sources.length} sources`);
    await ingestor.ingestBatch(sources);
    console.log("[REFERENCE-SCHEDULER] Quarterly refresh complete");
  });

  // ── ANNUAL ─────────────────────────────────────────────────────
  cron.schedule("0 1 2 1 *", async () => {
    const sources = getSourcesByCadence("ANNUAL");
    console.log(`[REFERENCE-SCHEDULER] Annual refresh — ${sources.length} sources`);
    await ingestor.ingestBatch(sources);
    console.log("[REFERENCE-SCHEDULER] Annual refresh complete");
  });

  console.log("[REFERENCE-SCHEDULER] Cron jobs registered (monthly / quarterly / annual)");
}
