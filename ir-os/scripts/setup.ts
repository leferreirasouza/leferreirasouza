#!/usr/bin/env tsx
/**
 * INTERACTIVE SETUP SCRIPT
 *
 * Creates the database, creates a trial company, and creates a first user.
 * Run once before first use:  npm run setup
 */

import "dotenv/config";
import prompts from "prompts";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { mkdirSync, existsSync } from "fs";
import { resolve } from "path";

// ── Run migration inline ───────────────────────────────────────────────────
async function runMigrations() {
  const { default: run } = await import("../src/data/migrations/run");
}

const DB_PATH = resolve(process.env.DATABASE_URL ?? "./data/ir-os.db");

function hashPassword(pw: string): string {
  return createHash("sha256").update(pw + "ir-os-salt").digest("hex");
}

async function main() {
  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║   IR-OS  —  First-Time Setup Wizard   ║");
  console.log("╚═══════════════════════════════════════╝\n");

  // ── 1. Database ────────────────────────────────────────────────────────
  mkdirSync("./data/audit", { recursive: true });
  mkdirSync("./uploads", { recursive: true });

  if (existsSync(DB_PATH)) {
    const { confirm } = await prompts({
      type: "confirm",
      name: "confirm",
      message: `Database already exists at ${DB_PATH}. Re-run migrations and continue? (data is preserved)`,
      initial: true,
    });
    if (!confirm) { console.log("Aborted."); process.exit(0); }
  }

  // Run migrations by spawning the migration script
  const { execSync } = await import("child_process");
  console.log("\n⚙  Running database migrations…");
  execSync("npx tsx src/data/migrations/run.ts", { stdio: "inherit", cwd: resolve(__dirname, "..") });

  const db = new Database(DB_PATH);

  // ── 2. Company setup ───────────────────────────────────────────────────
  console.log("\n── Company Profile ──────────────────────────────────────\n");

  const company = await prompts([
    { type: "text", name: "name", message: "Company full name:", initial: "Empresa S.A." },
    { type: "text", name: "ticker", message: "Ticker symbol (e.g. VALE3, PETR4, MGLU3):", initial: "TICK3" },
    {
      type: "select", name: "exchange", message: "Primary exchange:",
      choices: [
        { title: "B3 (Brazil)", value: "B3" },
        { title: "NYSE (US)", value: "NYSE" },
        { title: "NASDAQ (US)", value: "NASDAQ" },
        { title: "Dual-listed B3 + NYSE", value: "DUAL_LISTED" },
      ],
    },
    {
      type: "select", name: "currency", message: "Reporting currency:",
      choices: [{ title: "BRL (Brazilian Real)", value: "BRL" }, { title: "USD (US Dollar)", value: "USD" }],
    },
    { type: "text", name: "ir_website", message: "IR website URL (leave blank to skip crawl for now):", initial: "" },
    { type: "text", name: "cvm_code", message: "CVM code (if known, e.g. 12345):", initial: "" },
    { type: "text", name: "sector", message: "Sector (e.g. Mining, Retail, Banking):", initial: "" },
  ]);

  const companyId = `co-${company.ticker.toLowerCase()}-${randomUUID().slice(0, 8)}`;

  const existingCompany = db.prepare("SELECT company_id FROM companies WHERE ticker = ?").get(company.ticker);
  if (existingCompany) {
    console.log(`\n⚠  Company with ticker ${company.ticker} already exists. Using existing record.`);
  } else {
    db.prepare(`
      INSERT INTO companies (company_id, name, ticker, exchange, currency, ir_website, cvm_code, sector)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(companyId, company.name, company.ticker, company.exchange, company.currency,
      company.ir_website || null, company.cvm_code || null, company.sector || null);
    console.log(`\n✓ Company created: ${company.name} (${company.ticker}) — ID: ${companyId}`);
  }

  const coId = (existingCompany as any)?.company_id ?? companyId;

  // ── 3. First user ──────────────────────────────────────────────────────
  console.log("\n── Admin User ───────────────────────────────────────────\n");

  const user = await prompts([
    { type: "text", name: "name", message: "Your full name:", initial: "IR Admin" },
    { type: "text", name: "email", message: "Your email address:", initial: "ir@company.com" },
    { type: "password", name: "password", message: "Set a password:" },
    {
      type: "select", name: "role", message: "Your role:",
      choices: [
        { title: "Head of IR", value: "HEAD_OF_IR" },
        { title: "CFO", value: "CFO" },
        { title: "IR Manager", value: "IR_MANAGER" },
      ],
    },
  ]);

  const existingUser = db.prepare("SELECT user_id FROM users WHERE email = ?").get(user.email);
  if (existingUser) {
    console.log(`\n⚠  User with email ${user.email} already exists.`);
  } else {
    db.prepare(`
      INSERT INTO users (user_id, name, email, password_hash, role, company_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), user.name, user.email, hashPassword(user.password), user.role, coId);
    console.log(`\n✓ User created: ${user.name} (${user.role})`);
  }

  // ── 4. Summary ─────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════╗
║                   Setup Complete! ✓                  ║
╠══════════════════════════════════════════════════════╣
║  Company:     ${(company.name + " (" + company.ticker + ")").padEnd(38)} ║
║  Company ID:  ${coId.padEnd(38)} ║
║  Database:    ${DB_PATH.slice(-38).padEnd(38)} ║
╠══════════════════════════════════════════════════════╣
║  Next steps:                                         ║
║                                                      ║
║  1. Ingest documents:                                ║
║     npm run ingest:file -- --folder ./my-docs        ║
║                                                      ║
║  2. Crawl IR website (if URL provided):              ║
║     npm run ingest:web -- --company ${coId.slice(0, 10).padEnd(12)}        ║
║                                                      ║
║  3. Start the API server:                            ║
║     npm run dev                                      ║
║                                                      ║
║  4. Check ingestion status:                          ║
║     npm run ingest:status -- --company ${coId.slice(0, 10).padEnd(8)}      ║
╚══════════════════════════════════════════════════════╝
`);

  // Write company ID to .env for convenience
  const { appendFileSync } = await import("fs");
  appendFileSync(".env", `\n# Auto-generated by setup\nCOMPANY_ID=${coId}\nCOMPANY_TICKER=${company.ticker}\n`);

  db.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
