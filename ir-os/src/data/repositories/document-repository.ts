/**
 * DOCUMENT REPOSITORY
 *
 * Read/write access to the documents table and FTS index.
 * This is the single source of truth for all ingested content —
 * whether uploaded as a file or crawled from the IR website.
 */

import { randomUUID } from "crypto";
import { getDb } from "./db";

export interface DocumentRow {
  doc_id: string;
  company_id: string;
  title: string;
  doc_type: string;
  source: "UPLOAD" | "WEB_CRAWL";
  source_url?: string;
  local_path?: string;
  language: string;
  period_label?: string;
  period_year?: number;
  period_quarter?: number;
  filed_at?: string;
  classification: string;
  word_count?: number;
  page_count?: number;
  raw_text?: string;
  ingested_at: string;
  updated_at: string;
}

export interface SearchResult {
  doc_id: string;
  title: string;
  doc_type: string;
  period_label?: string;
  source_url?: string;
  snippet: string;
  rank: number;
}

export class DocumentRepository {
  // ── WRITE ──────────────────────────────────────────────────────────────

  upsert(doc: Omit<DocumentRow, "doc_id" | "ingested_at" | "updated_at"> & { doc_id?: string }): string {
    const db = getDb();
    const doc_id = doc.doc_id ?? randomUUID();
    const now = new Date().toISOString();

    // Check if already ingested from same URL
    if (doc.source_url) {
      const existing = db
        .prepare("SELECT doc_id FROM documents WHERE source_url = ? AND company_id = ?")
        .get(doc.source_url, doc.company_id) as { doc_id: string } | undefined;
      if (existing) return existing.doc_id; // skip duplicate
    }

    db.prepare(`
      INSERT INTO documents (
        doc_id, company_id, title, doc_type, source, source_url, local_path,
        language, period_label, period_year, period_quarter, filed_at,
        classification, word_count, page_count, raw_text, ingested_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      doc_id, doc.company_id, doc.title, doc.doc_type, doc.source,
      doc.source_url ?? null, doc.local_path ?? null, doc.language,
      doc.period_label ?? null, doc.period_year ?? null, doc.period_quarter ?? null,
      doc.filed_at ?? null, doc.classification, doc.word_count ?? null,
      doc.page_count ?? null, doc.raw_text ?? null, now, now
    );

    // Store chunks for retrieval
    if (doc.raw_text && doc.raw_text.length > 100) {
      this.storeChunks(doc_id, doc.raw_text);
    }

    return doc_id;
  }

  private storeChunks(docId: string, text: string, chunkSize = 1500): void {
    const db = getDb();
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(" "));
    }

    const insert = db.prepare(`
      INSERT INTO document_chunks (chunk_id, doc_id, chunk_index, content, token_count)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((cks: string[]) => {
      cks.forEach((chunk, idx) => {
        insert.run(randomUUID(), docId, idx, chunk, chunk.split(/\s+/).length);
      });
    });

    insertMany(chunks);
  }

  // ── READ ───────────────────────────────────────────────────────────────

  findById(docId: string): DocumentRow | undefined {
    return getDb()
      .prepare("SELECT * FROM documents WHERE doc_id = ?")
      .get(docId) as DocumentRow | undefined;
  }

  listByCompany(companyId: string, opts?: { doc_type?: string; period_year?: number; limit?: number }): DocumentRow[] {
    let sql = "SELECT * FROM documents WHERE company_id = ?";
    const params: (string | number)[] = [companyId];
    if (opts?.doc_type) { sql += " AND doc_type = ?"; params.push(opts.doc_type); }
    if (opts?.period_year) { sql += " AND period_year = ?"; params.push(opts.period_year); }
    sql += " ORDER BY filed_at DESC, ingested_at DESC";
    if (opts?.limit) { sql += ` LIMIT ${opts.limit}`; }
    return getDb().prepare(sql).all(...params) as DocumentRow[];
  }

  /**
   * Full-text search across all ingested documents.
   * Returns ranked results with a snippet of the matching text.
   */
  search(companyId: string, query: string, limit = 10): SearchResult[] {
    const db = getDb();

    // Use FTS5 snippet() function for highlighted excerpts
    const rows = db.prepare(`
      SELECT
        d.doc_id,
        d.title,
        d.doc_type,
        d.period_label,
        d.source_url,
        snippet(documents_fts, 2, '[', ']', '...', 20) AS snippet,
        documents_fts.rank
      FROM documents_fts
      JOIN documents d ON d.doc_id = documents_fts.doc_id
      WHERE documents_fts MATCH ?
        AND d.company_id = ?
      ORDER BY rank
      LIMIT ?
    `).all(query, companyId, limit) as SearchResult[];

    return rows;
  }

  /**
   * Chunk-level search: returns the most relevant passages across all documents.
   * Used by the Knowledge Librarian agent for precise retrieval.
   */
  searchChunks(companyId: string, query: string, limit = 8): { chunk_id: string; doc_id: string; content: string; snippet: string; rank: number }[] {
    const db = getDb();
    return db.prepare(`
      SELECT
        c.chunk_id,
        c.doc_id,
        c.content,
        snippet(chunks_fts, 2, '[', ']', '...', 30) AS snippet,
        chunks_fts.rank
      FROM chunks_fts
      JOIN document_chunks c ON c.chunk_id = chunks_fts.chunk_id
      JOIN documents d ON d.doc_id = c.doc_id
      WHERE chunks_fts MATCH ?
        AND d.company_id = ?
      ORDER BY rank
      LIMIT ?
    `).all(query, companyId, limit) as any[];
  }

  stats(companyId: string): { total: number; by_type: Record<string, number>; by_source: Record<string, number> } {
    const db = getDb();
    const total = (db.prepare("SELECT COUNT(*) as n FROM documents WHERE company_id = ?").get(companyId) as { n: number }).n;
    const byType = db.prepare("SELECT doc_type, COUNT(*) as n FROM documents WHERE company_id = ? GROUP BY doc_type").all(companyId) as { doc_type: string; n: number }[];
    const bySource = db.prepare("SELECT source, COUNT(*) as n FROM documents WHERE company_id = ? GROUP BY source").all(companyId) as { source: string; n: number }[];
    return {
      total,
      by_type: Object.fromEntries(byType.map((r) => [r.doc_type, r.n])),
      by_source: Object.fromEntries(bySource.map((r) => [r.source, r.n])),
    };
  }
}
