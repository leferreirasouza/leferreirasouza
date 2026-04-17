/**
 * NEWS REPOSITORY
 *
 * Persists news items in SQLite with URL-based deduplication.
 * Provides retrieval helpers for briefing generation, relevance
 * queries, and management flagging.
 */

import { randomUUID } from "crypto";
import { getDb } from "./db";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface NewsItem {
  newsId: string;
  companyId: string;
  sourceId: string;
  sourceName: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;          // ISO 8601
  fetchedAt: string;            // ISO 8601
  language: "PT" | "EN" | "ES";
  category: string;
  sectors: string[];
  relevanceScore: number;       // 0–100 (0 = not scored yet)
  relevanceTags: string[];      // e.g. "COMPETITOR_MOVE", "LEGISLATION", "COMMODITY_PRICE"
  sentiment: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "UNKNOWN";
  isRead: boolean;
  isFlagged: boolean;           // manually or auto-flagged for management attention
  analysisNote?: string;        // brief AI note on why this item matters to the company
}

export interface NewsSearchOptions {
  companyId: string;
  query?: string;
  category?: string;
  sectors?: string[];           // any overlap
  minRelevance?: number;
  fromDate?: string;            // ISO date string
  toDate?: string;
  flaggedOnly?: boolean;
  unreadOnly?: boolean;
  limit?: number;
}

export interface NewsBriefingItem {
  newsId: string;
  title: string;
  summary: string;
  url: string;
  publishedAt: string;
  sourceName: string;
  relevanceScore: number;
  relevanceTags: string[];
  sentiment: NewsItem["sentiment"];
  analysisNote?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Serialisation helpers
// ────────────────────────────────────────────────────────────────────────────

type DbRow = Record<string, unknown>;

function rowToItem(row: DbRow): NewsItem {
  return {
    newsId:         row.news_id as string,
    companyId:      row.company_id as string,
    sourceId:       row.source_id as string,
    sourceName:     row.source_name as string,
    title:          row.title as string,
    summary:        row.summary as string,
    url:            row.url as string,
    publishedAt:    row.published_at as string,
    fetchedAt:      row.fetched_at as string,
    language:       row.language as "PT" | "EN" | "ES",
    category:       row.category as string,
    sectors:        JSON.parse((row.sectors_json as string) || "[]") as string[],
    relevanceScore: (row.relevance_score as number) ?? 0,
    relevanceTags:  JSON.parse((row.relevance_tags_json as string) || "[]") as string[],
    sentiment:      (row.sentiment as NewsItem["sentiment"]) ?? "UNKNOWN",
    isRead:         Boolean(row.is_read),
    isFlagged:      Boolean(row.is_flagged),
    analysisNote:   (row.analysis_note as string) || undefined,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Write operations
// ────────────────────────────────────────────────────────────────────────────

/**
 * Insert a news item.  Silently skips if the URL already exists for this company.
 * Returns the newsId (new or existing).
 */
export function upsertNewsItem(
  item: Omit<NewsItem, "newsId" | "fetchedAt">
): string {
  const db = getDb();

  const existing = db
    .prepare("SELECT news_id FROM news_items WHERE url = ? AND company_id = ?")
    .get(item.url, item.companyId) as { news_id: string } | undefined;

  if (existing) return existing.news_id;

  const newsId = `news-${randomUUID()}`;

  db.prepare(`
    INSERT INTO news_items (
      news_id, company_id, source_id, source_name,
      title, summary, url, published_at, fetched_at,
      language, category, sectors_json,
      relevance_score, relevance_tags_json,
      sentiment, is_read, is_flagged, analysis_note
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?, datetime('now'),
      ?, ?, ?,
      ?, ?,
      ?, 0, 0, ?
    )
  `).run(
    newsId, item.companyId, item.sourceId, item.sourceName,
    item.title, item.summary, item.url, item.publishedAt,
    item.language, item.category, JSON.stringify(item.sectors),
    item.relevanceScore, JSON.stringify(item.relevanceTags),
    item.sentiment, item.analysisNote ?? null
  );

  return newsId;
}

/** Update the relevance fields after Claude scores the item. */
export function updateRelevance(
  newsId: string,
  score: number,
  tags: string[],
  sentiment: NewsItem["sentiment"],
  analysisNote: string,
  flag: boolean
): void {
  getDb()
    .prepare(`
      UPDATE news_items
      SET relevance_score      = ?,
          relevance_tags_json  = ?,
          sentiment            = ?,
          analysis_note        = ?,
          is_flagged           = ?
      WHERE news_id = ?
    `)
    .run(score, JSON.stringify(tags), sentiment, analysisNote, flag ? 1 : 0, newsId);
}

export function flagNewsItem(newsId: string, flagged: boolean): void {
  getDb()
    .prepare("UPDATE news_items SET is_flagged = ? WHERE news_id = ?")
    .run(flagged ? 1 : 0, newsId);
}

export function markRead(newsId: string): void {
  getDb()
    .prepare("UPDATE news_items SET is_read = 1 WHERE news_id = ?")
    .run(newsId);
}

// ────────────────────────────────────────────────────────────────────────────
// Read operations
// ────────────────────────────────────────────────────────────────────────────

export function getNewsById(newsId: string): NewsItem | undefined {
  const row = getDb()
    .prepare("SELECT * FROM news_items WHERE news_id = ?")
    .get(newsId) as DbRow | undefined;
  return row ? rowToItem(row) : undefined;
}

export function searchNews(opts: NewsSearchOptions): NewsItem[] {
  const clauses: string[] = ["company_id = ?"];
  const params: unknown[] = [opts.companyId];

  if (opts.category) {
    clauses.push("category = ?");
    params.push(opts.category);
  }
  if (opts.minRelevance !== undefined) {
    clauses.push("relevance_score >= ?");
    params.push(opts.minRelevance);
  }
  if (opts.fromDate) {
    clauses.push("published_at >= ?");
    params.push(opts.fromDate);
  }
  if (opts.toDate) {
    clauses.push("published_at <= ?");
    params.push(opts.toDate);
  }
  if (opts.flaggedOnly) clauses.push("is_flagged = 1");
  if (opts.unreadOnly)  clauses.push("is_read = 0");

  const limit = opts.limit ?? 50;
  const sql   = `
    SELECT * FROM news_items
    WHERE ${clauses.join(" AND ")}
    ORDER BY published_at DESC
    LIMIT ${limit}
  `;

  let rows = getDb().prepare(sql).all(...params) as DbRow[];

  // In-memory text filter
  if (opts.query) {
    const q = opts.query.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.title as string).toLowerCase().includes(q) ||
        (r.summary as string).toLowerCase().includes(q) ||
        ((r.analysis_note as string) ?? "").toLowerCase().includes(q)
    );
  }

  // In-memory sector filter
  if (opts.sectors?.length) {
    rows = rows.filter((r) => {
      const itemSectors: string[] = JSON.parse((r.sectors_json as string) || "[]");
      return opts.sectors!.some((s) =>
        itemSectors.some((is) => is.toLowerCase().includes(s.toLowerCase()))
      );
    });
  }

  return rows.map(rowToItem);
}

/** Get high-relevance news from the last N hours for daily briefings. */
export function getLatestBriefingItems(
  companyId: string,
  hours = 24,
  minRelevance = 50
): NewsBriefingItem[] {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();

  const rows = getDb()
    .prepare(`
      SELECT news_id, title, summary, url, published_at, source_name,
             relevance_score, relevance_tags_json, sentiment, analysis_note
      FROM   news_items
      WHERE  company_id    = ?
        AND  published_at  >= ?
        AND  relevance_score >= ?
      ORDER  BY relevance_score DESC, published_at DESC
      LIMIT  60
    `)
    .all(companyId, since, minRelevance) as DbRow[];

  return rows.map((r) => ({
    newsId:         r.news_id as string,
    title:          r.title as string,
    summary:        r.summary as string,
    url:            r.url as string,
    publishedAt:    r.published_at as string,
    sourceName:     r.source_name as string,
    relevanceScore: r.relevance_score as number,
    relevanceTags:  JSON.parse((r.relevance_tags_json as string) || "[]") as string[],
    sentiment:      (r.sentiment as NewsItem["sentiment"]) ?? "UNKNOWN",
    analysisNote:   (r.analysis_note as string) || undefined,
  }));
}

/** Fetch items that have NOT been scored yet (relevance_score = 0). */
export function getUnscoredItems(companyId: string, limit = 100): NewsItem[] {
  const rows = getDb()
    .prepare(`
      SELECT * FROM news_items
      WHERE company_id = ? AND relevance_score = 0
      ORDER BY published_at DESC
      LIMIT ?
    `)
    .all(companyId, limit) as DbRow[];
  return rows.map(rowToItem);
}

export function getFlaggedNews(companyId: string, limit = 50): NewsItem[] {
  const rows = getDb()
    .prepare(`
      SELECT * FROM news_items
      WHERE company_id = ? AND is_flagged = 1
      ORDER BY published_at DESC
      LIMIT ?
    `)
    .all(companyId, limit) as DbRow[];
  return rows.map(rowToItem);
}

export function getNewsStats(companyId: string): {
  total: number;
  flagged: number;
  unread: number;
  scored: number;
  last24h: number;
} {
  const db = getDb();
  const c = <T>(q: string, ...p: unknown[]) =>
    (db.prepare(q).get(...p) as { c: number }).c;

  const since24h = new Date(Date.now() - 86_400_000).toISOString();

  return {
    total:   c("SELECT COUNT(*) c FROM news_items WHERE company_id = ?", companyId),
    flagged: c("SELECT COUNT(*) c FROM news_items WHERE company_id = ? AND is_flagged = 1", companyId),
    unread:  c("SELECT COUNT(*) c FROM news_items WHERE company_id = ? AND is_read = 0", companyId),
    scored:  c("SELECT COUNT(*) c FROM news_items WHERE company_id = ? AND relevance_score > 0", companyId),
    last24h: c("SELECT COUNT(*) c FROM news_items WHERE company_id = ? AND fetched_at >= ?", companyId, since24h),
  };
}
