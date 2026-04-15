/**
 * KNOWLEDGE BASE
 *
 * Unified search interface used by the Knowledge Librarian Agent.
 * Searches both the FTS document index and chunk-level passages.
 * Returns results attributed with sourceId, classification, and excerpt.
 *
 * In MVP: SQLite FTS5 full-text search.
 * In Phase 3: swap inner search() for pgvector cosine similarity.
 */

import { DocumentRepository } from "./document-repository";

export interface KBResult {
  sourceId: string;             // doc_id
  title: string;
  docType: string;
  periodLabel?: string;
  sourceUrl?: string;
  excerpt: string;
  classification: string;
  relevanceRank: number;
  retrievedAt: string;
}

export class KnowledgeBase {
  private readonly repo = new DocumentRepository();

  /**
   * High-level search: tries document-level FTS first, then chunk-level.
   * Returns deduplicated, ranked results.
   */
  search(companyId: string, query: string, limit = 8): KBResult[] {
    const now = new Date().toISOString();

    // 1. Document-level search
    const docResults = this.repo.search(companyId, query, limit);

    // 2. Chunk-level search for more precise passages
    const chunkResults = this.repo.searchChunks(companyId, query, limit);

    // Merge: prioritise docs, then chunks from docs not already represented
    const seen = new Set<string>();
    const merged: KBResult[] = [];

    for (const r of docResults) {
      if (seen.has(r.doc_id)) continue;
      seen.add(r.doc_id);
      const doc = this.repo.findById(r.doc_id);
      merged.push({
        sourceId: r.doc_id,
        title: r.title,
        docType: r.doc_type,
        periodLabel: r.period_label,
        sourceUrl: r.source_url,
        excerpt: r.snippet,
        classification: doc?.classification ?? "PUBLIC",
        relevanceRank: r.rank,
        retrievedAt: now,
      });
    }

    for (const c of chunkResults) {
      if (seen.has(c.doc_id)) continue;
      seen.add(c.doc_id);
      const doc = this.repo.findById(c.doc_id);
      if (!doc) continue;
      merged.push({
        sourceId: doc.doc_id,
        title: doc.title,
        docType: doc.doc_type,
        periodLabel: doc.period_label,
        sourceUrl: doc.source_url,
        excerpt: c.snippet,
        classification: doc.classification,
        relevanceRank: c.rank + 100,   // slightly lower priority than doc-level
        retrievedAt: now,
      });
    }

    return merged.slice(0, limit);
  }

  /**
   * Find documents by type and period — used by agents requesting specific filings.
   */
  findByTypeAndPeriod(companyId: string, docType: string, year?: number): KBResult[] {
    const docs = this.repo.listByCompany(companyId, { doc_type: docType, period_year: year, limit: 20 });
    return docs.map((d) => ({
      sourceId: d.doc_id,
      title: d.title,
      docType: d.doc_type,
      periodLabel: d.period_label,
      sourceUrl: d.source_url,
      excerpt: d.raw_text?.slice(0, 300) ?? "",
      classification: d.classification,
      relevanceRank: 0,
      retrievedAt: new Date().toISOString(),
    }));
  }

  /**
   * Get the full text of a specific document — for deep reading by agents.
   */
  getFullText(docId: string): string | undefined {
    return this.repo.findById(docId)?.raw_text;
  }
}
