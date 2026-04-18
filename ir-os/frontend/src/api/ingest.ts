import { api } from "./client";
import type { Document, KBStats } from "./types";

export const ingestApi = {
  status: (companyId: string) =>
    api.get<KBStats>(`/ingest/status?companyId=${encodeURIComponent(companyId)}`),

  documents: (companyId: string, params?: { doc_type?: string; limit?: number }) => {
    const qs = new URLSearchParams({ companyId });
    if (params?.doc_type) qs.set("doc_type", params.doc_type);
    if (params?.limit) qs.set("limit", String(params.limit));
    return api.get<{ companyId: string; count: number; documents: Document[] }>(
      `/ingest/documents?${qs}`
    );
  },

  search: (companyId: string, q: string, limit = 10) =>
    api.get<{ query: string; results: { doc_id: string; title: string; excerpt: string }[] }>(
      `/ingest/search?companyId=${encodeURIComponent(companyId)}&q=${encodeURIComponent(q)}&limit=${limit}`
    ),

  upload: (companyId: string, files: FileList) => {
    const fd = new FormData();
    fd.append("companyId", companyId);
    for (let i = 0; i < files.length; i++) fd.append("files", files[i]);
    return api.upload<{ ingested: number; total: number; results: unknown[] }>("/ingest/upload", fd);
  },
};
