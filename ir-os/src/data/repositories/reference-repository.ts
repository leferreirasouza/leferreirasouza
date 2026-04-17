/**
 * REFERENCE REPOSITORY
 *
 * Read/write access to the reference_library table and its FTS index.
 * This is the foundational knowledge store — cross-company, curated,
 * containing standards, frameworks, regulatory texts, and methodology papers.
 *
 * Mirrors the shape of DocumentRepository but scoped to reference content.
 * Never mix company-specific documents with reference library content.
 */

import { randomUUID } from "crypto";
import { getDb } from "./db";

export type KnowledgeDomain =
  | "VALUATION"
  | "IR_PRACTICE"
  | "REGULATORY"
  | "ACCOUNTING"
  | "STRATEGY"
  | "MACRO"
  | "ESG_STANDARDS"
  | "WRITING";

export type RefType =
  | "STANDARD"
  | "FRAMEWORK"
  | "ACADEMIC"
  | "REGULATORY_TEXT"
  | "DATA"
  | "GUIDE";

export interface ReferenceRow {
  ref_id: string;
  title: string;
  knowledge_domain: KnowledgeDomain;
  ref_type: RefType;
  source_name: string;
  source_url?: string;
  local_path?: string;
  language: string;
  quality_score?: number;   // 0.0–1.0
  is_curated: number;       // 1 = manually vetted
  last_refreshed_at?: string;
  raw_text?: string;
  metadata_json?: string;   // structured data (e.g. Damodaran spreadsheet cells)
  word_count?: number;
  page_count?: number;
  tags?: string;            // JSON array
  ingested_at: string;
}

export interface RefSearchResult {
  ref_id: string;
  title: string;
  knowledge_domain: string;
  ref_type: string;
  source_name: string;
  source_url?: string;
  snippet: string;
  quality_score?: number;
  rank: number;
}

export class ReferenceRepository {
  // ── WRITE ──────────────────────────────────────────────────────────────

  upsert(
    ref: Omit<ReferenceRow, "ref_id" | "ingested_at"> & { ref_id?: string }
  ): string {
    const db = getDb();
    const ref_id = ref.ref_id ?? randomUUID();
    const now = new Date().toISOString();

    // Skip duplicate by URL if already ingested
    if (ref.source_url) {
      const existing = db
        .prepare("SELECT ref_id FROM reference_library WHERE source_url = ?")
        .get(ref.source_url) as { ref_id: string } | undefined;
      if (existing) {
        // Update last_refreshed_at and quality_score on refresh
        db.prepare(
          "UPDATE reference_library SET last_refreshed_at = ?, quality_score = ? WHERE ref_id = ?"
        ).run(now, ref.quality_score ?? null, existing.ref_id);
        return existing.ref_id;
      }
    }

    db.prepare(`
      INSERT INTO reference_library (
        ref_id, title, knowledge_domain, ref_type, source_name, source_url,
        local_path, language, quality_score, is_curated, last_refreshed_at,
        raw_text, metadata_json, word_count, page_count, tags, ingested_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      ref_id,
      ref.title,
      ref.knowledge_domain,
      ref.ref_type,
      ref.source_name,
      ref.source_url ?? null,
      ref.local_path ?? null,
      ref.language,
      ref.quality_score ?? null,
      ref.is_curated,
      ref.last_refreshed_at ?? now,
      ref.raw_text ?? null,
      ref.metadata_json ?? null,
      ref.word_count ?? null,
      ref.page_count ?? null,
      ref.tags ?? null,
      now
    );

    if (ref.raw_text && ref.raw_text.length > 100) {
      this.storeChunks(ref_id, ref.raw_text);
    }

    return ref_id;
  }

  private storeChunks(refId: string, text: string, chunkSize = 1500): void {
    const db = getDb();
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(" "));
    }

    const insert = db.prepare(`
      INSERT INTO reference_chunks (chunk_id, ref_id, chunk_index, content, token_count)
      VALUES (?, ?, ?, ?, ?)
    `);

    db.transaction((cks: string[]) => {
      cks.forEach((chunk, idx) => {
        insert.run(
          randomUUID(),
          refId,
          idx,
          chunk,
          chunk.split(/\s+/).length
        );
      });
    })(chunks);
  }

  logIngest(entry: {
    source_id: string;
    source_name: string;
    status: "SUCCESS" | "FAILED" | "SKIPPED" | "MANUAL_ONLY";
    ref_id?: string;
    quality_score?: number;
    error_message?: string;
    word_count?: number;
  }): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO reference_ingest_log (
        log_id, source_id, source_name, status, ref_id, quality_score,
        error_message, word_count, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      randomUUID(),
      entry.source_id,
      entry.source_name,
      entry.status,
      entry.ref_id ?? null,
      entry.quality_score ?? null,
      entry.error_message ?? null,
      entry.word_count ?? null
    );
  }

  // ── READ ───────────────────────────────────────────────────────────────

  findById(refId: string): ReferenceRow | undefined {
    return getDb()
      .prepare("SELECT * FROM reference_library WHERE ref_id = ?")
      .get(refId) as ReferenceRow | undefined;
  }

  listByDomain(domain: KnowledgeDomain, limit = 20): ReferenceRow[] {
    return getDb()
      .prepare(
        "SELECT * FROM reference_library WHERE knowledge_domain = ? ORDER BY quality_score DESC, ingested_at DESC LIMIT ?"
      )
      .all(domain, limit) as ReferenceRow[];
  }

  /**
   * Full-text search across the reference library.
   * Optionally filter by knowledge_domain.
   */
  search(query: string, domain?: KnowledgeDomain, limit = 6): RefSearchResult[] {
    const db = getDb();

    if (domain) {
      return db.prepare(`
        SELECT
          r.ref_id,
          r.title,
          r.knowledge_domain,
          r.ref_type,
          r.source_name,
          r.source_url,
          r.quality_score,
          snippet(reference_fts, 2, '[', ']', '...', 20) AS snippet,
          reference_fts.rank
        FROM reference_fts
        JOIN reference_library r ON r.ref_id = reference_fts.ref_id
        WHERE reference_fts MATCH ?
          AND r.knowledge_domain = ?
        ORDER BY rank
        LIMIT ?
      `).all(query, domain, limit) as RefSearchResult[];
    }

    return db.prepare(`
      SELECT
        r.ref_id,
        r.title,
        r.knowledge_domain,
        r.ref_type,
        r.source_name,
        r.source_url,
        r.quality_score,
        snippet(reference_fts, 2, '[', ']', '...', 20) AS snippet,
        reference_fts.rank
      FROM reference_fts
      JOIN reference_library r ON r.ref_id = reference_fts.ref_id
      WHERE reference_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as RefSearchResult[];
  }

  /**
   * Chunk-level search: returns precise passages from the reference library.
   */
  searchChunks(
    query: string,
    domain?: KnowledgeDomain,
    limit = 6
  ): { chunk_id: string; ref_id: string; content: string; snippet: string; rank: number }[] {
    const db = getDb();

    if (domain) {
      return db.prepare(`
        SELECT
          c.chunk_id,
          c.ref_id,
          c.content,
          snippet(reference_chunks_fts, 2, '[', ']', '...', 30) AS snippet,
          reference_chunks_fts.rank
        FROM reference_chunks_fts
        JOIN reference_chunks c ON c.chunk_id = reference_chunks_fts.chunk_id
        JOIN reference_library r ON r.ref_id = c.ref_id
        WHERE reference_chunks_fts MATCH ?
          AND r.knowledge_domain = ?
        ORDER BY rank
        LIMIT ?
      `).all(query, domain, limit) as any[];
    }

    return db.prepare(`
      SELECT
        c.chunk_id,
        c.ref_id,
        c.content,
        snippet(reference_chunks_fts, 2, '[', ']', '...', 30) AS snippet,
        reference_chunks_fts.rank
      FROM reference_chunks_fts
      JOIN reference_chunks c ON c.chunk_id = reference_chunks_fts.chunk_id
      WHERE reference_chunks_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(query, limit) as any[];
  }

  stats(): { total: number; by_domain: Record<string, number>; by_type: Record<string, number> } {
    const db = getDb();
    const total = (
      db.prepare("SELECT COUNT(*) as n FROM reference_library").get() as { n: number }
    ).n;
    const byDomain = db
      .prepare("SELECT knowledge_domain, COUNT(*) as n FROM reference_library GROUP BY knowledge_domain")
      .all() as { knowledge_domain: string; n: number }[];
    const byType = db
      .prepare("SELECT ref_type, COUNT(*) as n FROM reference_library GROUP BY ref_type")
      .all() as { ref_type: string; n: number }[];
    return {
      total,
      by_domain: Object.fromEntries(byDomain.map((r) => [r.knowledge_domain, r.n])),
      by_type: Object.fromEntries(byType.map((r) => [r.ref_type, r.n])),
    };
  }
}
