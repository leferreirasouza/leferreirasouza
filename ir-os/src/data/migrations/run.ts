/**
 * DATABASE MIGRATIONS
 *
 * Creates all SQLite tables with FTS5 full-text search on the knowledge base.
 * Safe to re-run (CREATE TABLE IF NOT EXISTS + CREATE VIRTUAL TABLE IF NOT EXISTS).
 *
 * Run:  npm run db:migrate
 */

import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
import "dotenv/config";

const DB_PATH = resolve(process.env.DATABASE_URL ?? "./data/ir-os.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

console.log(`Migrating database at: ${DB_PATH}`);

db.exec(`
  -- ── COMPANY ──────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS companies (
    company_id    TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    ticker        TEXT NOT NULL UNIQUE,
    exchange      TEXT NOT NULL DEFAULT 'B3',
    currency      TEXT NOT NULL DEFAULT 'BRL',
    fiscal_year_end TEXT NOT NULL DEFAULT '12-31',
    ir_website    TEXT,
    cvm_code      TEXT,
    sec_cik       TEXT,
    sector        TEXT,
    description   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── DOCUMENTS (filing library + uploaded files) ───────────────────────
  CREATE TABLE IF NOT EXISTS documents (
    doc_id        TEXT PRIMARY KEY,
    company_id    TEXT NOT NULL REFERENCES companies(company_id),
    title         TEXT NOT NULL,
    doc_type      TEXT NOT NULL,           -- PRESS_RELEASE, ANNUAL_REPORT, PRESENTATION, etc.
    source        TEXT NOT NULL,           -- 'UPLOAD' or 'WEB_CRAWL'
    source_url    TEXT,
    local_path    TEXT,
    language      TEXT NOT NULL DEFAULT 'PT',
    period_label  TEXT,                    -- e.g. '4Q25', 'FY2025'
    period_year   INTEGER,
    period_quarter INTEGER,
    filed_at      TEXT,
    classification TEXT NOT NULL DEFAULT 'PUBLIC',
    word_count    INTEGER,
    page_count    INTEGER,
    raw_text      TEXT,                    -- extracted plain text
    ingested_at   TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Full-text search index on document content
  CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
    doc_id UNINDEXED,
    title,
    raw_text,
    doc_type UNINDEXED,
    period_label UNINDEXED,
    content='documents',
    content_rowid='rowid'
  );

  -- Keep FTS in sync via triggers
  CREATE TRIGGER IF NOT EXISTS documents_ai AFTER INSERT ON documents BEGIN
    INSERT INTO documents_fts(rowid, doc_id, title, raw_text, doc_type, period_label)
    VALUES (new.rowid, new.doc_id, new.title, new.raw_text, new.doc_type, new.period_label);
  END;

  CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, doc_id, title, raw_text, doc_type, period_label)
    VALUES ('delete', old.rowid, old.doc_id, old.title, old.raw_text, old.doc_type, old.period_label);
    INSERT INTO documents_fts(rowid, doc_id, title, raw_text, doc_type, period_label)
    VALUES (new.rowid, new.doc_id, new.title, new.raw_text, new.doc_type, new.period_label);
  END;

  CREATE TRIGGER IF NOT EXISTS documents_ad AFTER DELETE ON documents BEGIN
    INSERT INTO documents_fts(documents_fts, rowid, doc_id, title, raw_text, doc_type, period_label)
    VALUES ('delete', old.rowid, old.doc_id, old.title, old.raw_text, old.doc_type, old.period_label);
  END;

  -- ── DOCUMENT CHUNKS (for semantic search / retrieval) ─────────────────
  CREATE TABLE IF NOT EXISTS document_chunks (
    chunk_id      TEXT PRIMARY KEY,
    doc_id        TEXT NOT NULL REFERENCES documents(doc_id),
    chunk_index   INTEGER NOT NULL,
    content       TEXT NOT NULL,
    token_count   INTEGER,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
    chunk_id UNINDEXED,
    doc_id UNINDEXED,
    content,
    content='document_chunks',
    content_rowid='rowid'
  );

  CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON document_chunks BEGIN
    INSERT INTO chunks_fts(rowid, chunk_id, doc_id, content)
    VALUES (new.rowid, new.chunk_id, new.doc_id, new.content);
  END;

  -- ── INGESTION LOG ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS ingestion_log (
    log_id        TEXT PRIMARY KEY,
    company_id    TEXT NOT NULL,
    source_type   TEXT NOT NULL,   -- 'WEB_CRAWL' | 'FILE_UPLOAD'
    source_url    TEXT,
    file_name     TEXT,
    status        TEXT NOT NULL,   -- 'SUCCESS' | 'FAILED' | 'SKIPPED'
    doc_id        TEXT,
    error_message TEXT,
    docs_found    INTEGER DEFAULT 0,
    docs_ingested INTEGER DEFAULT 0,
    started_at    TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at  TEXT
  );

  -- ── APPROVED MESSAGING ────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS approved_messages (
    message_id    TEXT PRIMARY KEY,
    company_id    TEXT NOT NULL REFERENCES companies(company_id),
    topic         TEXT NOT NULL,
    category      TEXT NOT NULL,
    headline      TEXT NOT NULL,
    body_text     TEXT NOT NULL,
    language      TEXT NOT NULL DEFAULT 'PT',
    approved_by   TEXT NOT NULL,
    approved_at   TEXT NOT NULL,
    valid_until   TEXT,
    use_contexts  TEXT,            -- JSON array
    version       INTEGER NOT NULL DEFAULT 1,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── Q&A LIBRARY ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS qa_library (
    qa_id         TEXT PRIMARY KEY,
    company_id    TEXT NOT NULL REFERENCES companies(company_id),
    question      TEXT NOT NULL,
    answer        TEXT NOT NULL,
    context       TEXT,
    category      TEXT,
    sensitivity   TEXT NOT NULL DEFAULT 'MEDIUM',
    approved_by   TEXT NOT NULL,
    approved_at   TEXT NOT NULL,
    valid_until   TEXT,
    language      TEXT NOT NULL DEFAULT 'PT',
    version       INTEGER NOT NULL DEFAULT 1,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── INVESTOR CRM ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS investors (
    investor_id   TEXT PRIMARY KEY,
    company_id    TEXT NOT NULL REFERENCES companies(company_id),
    name          TEXT NOT NULL,
    firm_name     TEXT NOT NULL,
    firm_type     TEXT NOT NULL,
    geography     TEXT,
    aum_usd_bn    REAL,
    last_meeting  TEXT,
    engagement_score INTEGER DEFAULT 50,
    tags          TEXT,            -- JSON array
    notes         TEXT,            -- JSON array of CRMNote
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── DISCLOSURE CALENDAR ───────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS disclosure_calendar (
    entry_id      TEXT PRIMARY KEY,
    company_id    TEXT NOT NULL REFERENCES companies(company_id),
    title         TEXT NOT NULL,
    disclosure_type TEXT NOT NULL,
    due_date      TEXT NOT NULL,
    regulatory_body TEXT NOT NULL DEFAULT 'CVM',
    filing_form   TEXT,
    status        TEXT NOT NULL DEFAULT 'UPCOMING',
    owner_user_id TEXT,
    notes         TEXT,
    is_recurring  INTEGER NOT NULL DEFAULT 0,
    alert_days    TEXT NOT NULL DEFAULT '[30,15,7,1]',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── USERS (local auth for dev / single-company MVP) ────────────────────
  CREATE TABLE IF NOT EXISTS users (
    user_id       TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'IR_MANAGER',
    company_id    TEXT REFERENCES companies(company_id),
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- ── WORKFLOWS + ARTIFACTS (persisted state) ───────────────────────────
  CREATE TABLE IF NOT EXISTS workflows (
    workflow_id   TEXT PRIMARY KEY,
    company_id    TEXT NOT NULL,
    workflow_type TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'INITIATED',
    initiated_by  TEXT NOT NULL,
    initiated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at  TEXT,
    current_step  TEXT,
    context_json  TEXT,
    priority      TEXT NOT NULL DEFAULT 'NORMAL',
    deadline      TEXT
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    artifact_id   TEXT PRIMARY KEY,
    workflow_id   TEXT NOT NULL REFERENCES workflows(workflow_id),
    step_id       TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    title         TEXT NOT NULL,
    content       TEXT NOT NULL,
    draft_status  TEXT NOT NULL DEFAULT 'DRAFT',
    version       INTEGER NOT NULL DEFAULT 1,
    created_by    TEXT NOT NULL,
    approved_by   TEXT,
    approved_at   TEXT,
    red_flags_json TEXT,
    sources_json  TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── REFERENCE LIBRARY (foundational knowledge, cross-company) ─────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS reference_library (
    ref_id            TEXT PRIMARY KEY,
    title             TEXT NOT NULL,
    knowledge_domain  TEXT NOT NULL,   -- VALUATION | IR_PRACTICE | REGULATORY | ACCOUNTING | STRATEGY | MACRO | ESG_STANDARDS | WRITING
    ref_type          TEXT NOT NULL,   -- STANDARD | FRAMEWORK | ACADEMIC | REGULATORY_TEXT | DATA | GUIDE
    source_name       TEXT NOT NULL,   -- e.g. "Mauboussin / Morgan Stanley Consilient Observer"
    source_url        TEXT,
    local_path        TEXT,
    language          TEXT NOT NULL DEFAULT 'EN',
    quality_score     REAL,            -- 0.0–1.0 assigned by ingestor
    is_curated        INTEGER NOT NULL DEFAULT 1,  -- 1 = manually vetted
    last_refreshed_at TEXT,
    raw_text          TEXT,
    metadata_json     TEXT,            -- structured key-value data (e.g. Damodaran spreadsheet cells)
    word_count        INTEGER,
    page_count        INTEGER,
    tags              TEXT,            -- JSON array of topical tags
    ingested_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS reference_fts USING fts5(
    ref_id UNINDEXED,
    title,
    raw_text,
    knowledge_domain UNINDEXED,
    ref_type UNINDEXED,
    source_name,
    content='reference_library',
    content_rowid='rowid'
  );

  CREATE TRIGGER IF NOT EXISTS reference_ai AFTER INSERT ON reference_library BEGIN
    INSERT INTO reference_fts(rowid, ref_id, title, raw_text, knowledge_domain, ref_type, source_name)
    VALUES (new.rowid, new.ref_id, new.title, new.raw_text, new.knowledge_domain, new.ref_type, new.source_name);
  END;

  CREATE TRIGGER IF NOT EXISTS reference_au AFTER UPDATE ON reference_library BEGIN
    INSERT INTO reference_fts(reference_fts, rowid, ref_id, title, raw_text, knowledge_domain, ref_type, source_name)
    VALUES ('delete', old.rowid, old.ref_id, old.title, old.raw_text, old.knowledge_domain, old.ref_type, old.source_name);
    INSERT INTO reference_fts(rowid, ref_id, title, raw_text, knowledge_domain, ref_type, source_name)
    VALUES (new.rowid, new.ref_id, new.title, new.raw_text, new.knowledge_domain, new.ref_type, new.source_name);
  END;

  CREATE TRIGGER IF NOT EXISTS reference_ad AFTER DELETE ON reference_library BEGIN
    INSERT INTO reference_fts(reference_fts, rowid, ref_id, title, raw_text, knowledge_domain, ref_type, source_name)
    VALUES ('delete', old.rowid, old.ref_id, old.title, old.raw_text, old.knowledge_domain, old.ref_type, old.source_name);
  END;

  -- ── REFERENCE CHUNKS ──────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS reference_chunks (
    chunk_id      TEXT PRIMARY KEY,
    ref_id        TEXT NOT NULL REFERENCES reference_library(ref_id),
    chunk_index   INTEGER NOT NULL,
    content       TEXT NOT NULL,
    token_count   INTEGER,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS reference_chunks_fts USING fts5(
    chunk_id UNINDEXED,
    ref_id UNINDEXED,
    content,
    content='reference_chunks',
    content_rowid='rowid'
  );

  CREATE TRIGGER IF NOT EXISTS ref_chunks_ai AFTER INSERT ON reference_chunks BEGIN
    INSERT INTO reference_chunks_fts(rowid, chunk_id, ref_id, content)
    VALUES (new.rowid, new.chunk_id, new.ref_id, new.content);
  END;

  -- ── REFERENCE INGEST LOG ─────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS reference_ingest_log (
    log_id        TEXT PRIMARY KEY,
    source_id     TEXT NOT NULL,    -- from reference-sources.ts registry
    source_name   TEXT NOT NULL,
    status        TEXT NOT NULL,    -- 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'MANUAL_ONLY'
    ref_id        TEXT,             -- populated on SUCCESS
    quality_score REAL,
    error_message TEXT,
    word_count    INTEGER,
    started_at    TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at  TEXT
  );

  -- ── NEWS ITEMS ────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS news_items (
    news_id            TEXT PRIMARY KEY,
    company_id         TEXT REFERENCES companies(company_id),   -- null = market-wide news
    source_id          TEXT NOT NULL,
    source_name        TEXT NOT NULL,
    title              TEXT NOT NULL,
    summary            TEXT,
    url                TEXT NOT NULL,
    published_at       TEXT NOT NULL,
    fetched_at         TEXT NOT NULL DEFAULT (datetime('now')),
    language           TEXT NOT NULL DEFAULT 'PT',
    category           TEXT,        -- EARNINGS | REGULATION | M&A | MACRO | SECTOR | ESG
    sectors_json       TEXT,        -- JSON array of relevant sectors
    relevance_score    REAL,        -- 0.0–1.0
    relevance_tags_json TEXT,       -- JSON array: ["B3:PETR4", "OIL_SECTOR", "EARNINGS_SEASON"]
    sentiment          TEXT,        -- POSITIVE | NEGATIVE | NEUTRAL
    is_read            INTEGER NOT NULL DEFAULT 0,
    is_flagged         INTEGER NOT NULL DEFAULT 0,
    analysis_note      TEXT         -- IR team annotation
  );
`);

// Verify
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all() as { name: string }[];

console.log("\n✓ Tables created:");
tables.forEach((t) => console.log(`  ${t.name}`));

const ftsTables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts'")
  .all() as { name: string }[];
console.log("\n✓ FTS5 virtual tables:");
ftsTables.forEach((t) => console.log(`  ${t.name}`));

console.log("\n✓ Migration complete.\n");
db.close();
