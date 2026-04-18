#!/usr/bin/env tsx
/**
 * ADD COMPANY
 *
 * Register a new company profile in IR-OS without re-running the full setup.
 * Optionally grant an existing user access to the new company.
 *
 * Usage:
 *   npm run company:add
 */

import "dotenv/config";
import prompts from "prompts";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { resolve } from "path";

const DB_PATH = resolve(process.env.DATABASE_URL ?? "./data/ir-os.db");

async function main() {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   IR-OS  —  Add Company                  ║");
  console.log("╚══════════════════════════════════════════╝\n");

  const db = new Database(DB_PATH);

  // ── Company details ────────────────────────────────────────────────────────
  const company = await prompts([
    { type: "text", name: "name",    message: "Company full name:",                  initial: "Empresa S.A." },
    { type: "text", name: "ticker",  message: "Ticker symbol (e.g. ABEV3, VALE3):", initial: "" },
    {
      type: "select", name: "exchange", message: "Primary exchange:",
      choices: [
        { title: "B3 (Brazil)",             value: "B3" },
        { title: "NYSE (US)",               value: "NYSE" },
        { title: "NASDAQ (US)",             value: "NASDAQ" },
        { title: "Dual-listed B3 + NYSE",   value: "DUAL_LISTED" },
      ],
    },
    {
      type: "select", name: "currency", message: "Reporting currency:",
      choices: [
        { title: "BRL (Brazilian Real)", value: "BRL" },
        { title: "USD (US Dollar)",      value: "USD" },
      ],
    },
    { type: "text", name: "fiscal_year_end", message: "Fiscal year end (MM-DD):", initial: "12-31" },
    { type: "text", name: "sector",          message: "Sector (e.g. Beverages, Mining, Banking):", initial: "" },
    { type: "text", name: "ir_website",      message: "IR website URL (optional):", initial: "" },
    { type: "text", name: "cvm_code",        message: "CVM code (optional):",      initial: "" },
    { type: "text", name: "description",     message: "One-line description (optional):", initial: "" },
  ]);

  if (!company.ticker) {
    console.log("\nAborted — ticker is required.");
    process.exit(1);
  }

  const ticker = (company.ticker as string).toUpperCase();

  // Check for duplicate ticker
  const existing = db.prepare("SELECT company_id, name FROM companies WHERE ticker = ?").get(ticker) as
    | { company_id: string; name: string }
    | undefined;

  if (existing) {
    console.log(`\n⚠  A company with ticker ${ticker} already exists: ${existing.name}`);
    console.log(`   company_id: ${existing.company_id}`);
    console.log("\nUse PUT /api/v1/companies/:companyId to update it.");
    db.close();
    process.exit(0);
  }

  const company_id = `co-${ticker.toLowerCase()}-${randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO companies (
      company_id, name, ticker, exchange, currency, fiscal_year_end,
      ir_website, cvm_code, sector, description, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    company_id,
    company.name,
    ticker,
    company.exchange,
    company.currency,
    company.fiscal_year_end || "12-31",
    company.ir_website  || null,
    company.cvm_code    || null,
    company.sector      || null,
    company.description || null,
    now,
    now
  );

  console.log(`\n✓ Company created: ${company.name} (${ticker})`);
  console.log(`  company_id: ${company_id}`);

  // ── Grant an existing user access (optional) ───────────────────────────────
  const users = db.prepare("SELECT user_id, name, email, role FROM users WHERE is_active = 1").all() as
    { user_id: string; name: string; email: string; role: string }[];

  if (users.length > 0) {
    const { grantUser } = await prompts({
      type: "confirm",
      name: "grantUser",
      message: "Grant an existing user access to this company?",
      initial: true,
    });

    if (grantUser) {
      const { userId } = await prompts({
        type: "select",
        name: "userId",
        message: "Select user:",
        choices: users.map((u) => ({
          title: `${u.name} (${u.email}) — ${u.role}`,
          value: u.user_id,
        })),
      });

      if (userId) {
        db.prepare(`
          INSERT OR IGNORE INTO user_companies (id, user_id, company_id, role, created_at)
          VALUES (?, ?, ?, 'OWNER', datetime('now'))
        `).run(randomUUID(), userId, company_id);
        console.log(`\n✓ Access granted.`);
      }
    }
  }

  console.log(`
╔════════════════════════════════════════════════════╗
║               Company Added! ✓                     ║
╠════════════════════════════════════════════════════╣
║  ${(company.name + " (" + ticker + ")").padEnd(50)} ║
║  ID:   ${company_id.padEnd(44)} ║
╠════════════════════════════════════════════════════╣
║  Next steps:                                       ║
║                                                    ║
║  1. Ingest documents for this company:             ║
║     npm run ingest:file -- --folder ./docs \\       ║
║       --company ${company_id.slice(0, 30).padEnd(30)}   ║
║                                                    ║
║  2. Invoke an agent for this company:              ║
║     POST /api/v1/agents/<agentId>/invoke           ║
║     { "context": { "companyId": "<id>" } }         ║
║                                                    ║
║  3. Switch active company (get a new token):       ║
║     POST /api/v1/auth/switch-company               ║
║     { "companyId": "<id>" }                        ║
╚════════════════════════════════════════════════════╝
`);

  db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
