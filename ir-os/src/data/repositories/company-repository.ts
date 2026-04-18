/**
 * COMPANY REPOSITORY
 *
 * Read/write access to the companies table.
 * Used by the companies API router and to hydrate AgentContext per request.
 */

import { randomUUID } from "crypto";
import { getDb } from "./db";

export interface CompanyRow {
  company_id: string;
  name: string;
  ticker: string;
  exchange: string;          // 'B3' | 'NYSE' | 'NASDAQ' | 'DUAL_LISTED'
  currency: string;          // 'BRL' | 'USD'
  fiscal_year_end: string;   // 'MM-DD', e.g. '12-31'
  ir_website?: string;
  cvm_code?: string;
  sec_cik?: string;
  sector?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export type CreateCompanyInput = Omit<CompanyRow, "company_id" | "created_at" | "updated_at"> & {
  company_id?: string;
};

export class CompanyRepository {
  findById(companyId: string): CompanyRow | undefined {
    return getDb()
      .prepare("SELECT * FROM companies WHERE company_id = ?")
      .get(companyId) as CompanyRow | undefined;
  }

  findByTicker(ticker: string): CompanyRow | undefined {
    return getDb()
      .prepare("SELECT * FROM companies WHERE ticker = ? COLLATE NOCASE")
      .get(ticker) as CompanyRow | undefined;
  }

  list(): CompanyRow[] {
    return getDb()
      .prepare("SELECT * FROM companies ORDER BY name ASC")
      .all() as CompanyRow[];
  }

  /** Returns companies a given user has explicit access to (via user_companies join table) */
  listForUser(userId: string): CompanyRow[] {
    return getDb().prepare(`
      SELECT c.*
      FROM companies c
      JOIN user_companies uc ON uc.company_id = c.company_id
      WHERE uc.user_id = ?
      ORDER BY c.name ASC
    `).all(userId) as CompanyRow[];
  }

  create(input: CreateCompanyInput): string {
    const db = getDb();
    const company_id = input.company_id ?? `co-${input.ticker.toLowerCase()}-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO companies (
        company_id, name, ticker, exchange, currency, fiscal_year_end,
        ir_website, cvm_code, sec_cik, sector, description, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      company_id, input.name, input.ticker, input.exchange, input.currency,
      input.fiscal_year_end, input.ir_website ?? null, input.cvm_code ?? null,
      input.sec_cik ?? null, input.sector ?? null, input.description ?? null,
      now, now
    );

    return company_id;
  }

  update(companyId: string, fields: Partial<Omit<CompanyRow, "company_id" | "created_at" | "updated_at">>): boolean {
    const db = getDb();
    const now = new Date().toISOString();
    const keys = Object.keys(fields) as (keyof typeof fields)[];
    if (keys.length === 0) return false;

    const setClauses = keys.map((k) => `${k} = ?`).join(", ");
    const values = keys.map((k) => fields[k] ?? null);

    const result = db.prepare(
      `UPDATE companies SET ${setClauses}, updated_at = ? WHERE company_id = ?`
    ).run(...values, now, companyId);

    return result.changes > 0;
  }

  /** Grant a user access to a company */
  grantAccess(userId: string, companyId: string, role = "MEMBER"): void {
    getDb().prepare(`
      INSERT OR IGNORE INTO user_companies (id, user_id, company_id, role, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(randomUUID(), userId, companyId, role);
  }

  /** Check if a user has access to a company */
  hasAccess(userId: string, companyId: string): boolean {
    const row = getDb().prepare(
      "SELECT 1 FROM user_companies WHERE user_id = ? AND company_id = ?"
    ).get(userId, companyId);
    return !!row;
  }
}
