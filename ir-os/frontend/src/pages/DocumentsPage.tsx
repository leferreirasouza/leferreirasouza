import { useState, useEffect, useCallback } from "react";
import { useCompany } from "../contexts/CompanyContext";
import { ingestApi } from "../api/ingest";
import type { Document, KBStats } from "../api/types";

export default function DocumentsPage() {
  const { activeCompany } = useCompany();
  const [stats, setStats] = useState<KBStats | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<{ doc_id: string; title: string; excerpt: string }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!activeCompany) return;
    try {
      const [s, d] = await Promise.all([
        ingestApi.status(activeCompany.company_id),
        ingestApi.documents(activeCompany.company_id, { limit: 50 }),
      ]);
      setStats(s);
      setDocs(d.documents);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [activeCompany]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCompany || !searchQ.trim()) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const r = await ingestApi.search(activeCompany.company_id, searchQ);
      setSearchResults(r.results);
    } finally {
      setSearching(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || !activeCompany) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const r = await ingestApi.upload(activeCompany.company_id, files);
      setUploadMsg(`Ingested ${r.ingested} of ${r.total} file(s).`);
      await loadData();
    } catch (err: unknown) {
      setUploadMsg(`Error: ${(err as Error).message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">Knowledge base for {activeCompany?.ticker ?? "—"}</p>
        </div>

        <label className={`btn-primary cursor-pointer ${uploading ? "opacity-50" : ""}`}>
          {uploading ? "Uploading…" : "Upload Files"}
          <input type="file" multiple accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.md" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {uploadMsg && (
        <div className={`card p-3 text-sm ${uploadMsg.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>
          {uploadMsg}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.totalDocs}</p>
            <p className="text-xs text-slate-500 mt-1">Total Documents</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-2xl font-bold text-slate-900">{(stats.totalWords / 1000).toFixed(0)}k</p>
            <p className="text-xs text-slate-500 mt-1">Total Words</p>
          </div>
        </div>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Search document content…"
          className="input flex-1"
        />
        <button type="submit" disabled={searching} className="btn-primary shrink-0">
          {searching ? "Searching…" : "Search"}
        </button>
        {searchResults !== null && (
          <button type="button" onClick={() => { setSearchResults(null); setSearchQ(""); }} className="btn-secondary">
            Clear
          </button>
        )}
      </form>

      {/* Search results */}
      {searchResults !== null && (
        <div className="card divide-y divide-slate-200">
          {searchResults.length === 0 ? (
            <p className="p-6 text-center text-slate-400 text-sm">No results for "{searchQ}"</p>
          ) : (
            searchResults.map((r) => (
              <div key={r.doc_id} className="p-4">
                <p className="font-medium text-sm text-slate-900">{r.title}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{r.excerpt}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Document list */}
      {searchResults === null && (
        <div className="card divide-y divide-slate-200">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading…</div>
          ) : docs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-400 text-sm">No documents ingested yet.</p>
              <p className="text-xs text-slate-400 mt-1">Upload files above or run <code>npm run ingest:web</code></p>
            </div>
          ) : (
            docs.map((doc) => (
              <div key={doc.doc_id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                    <span>{doc.doc_type}</span>
                    {doc.period_label && <><span>·</span><span>{doc.period_label}</span></>}
                    {doc.word_count && <><span>·</span><span>{doc.word_count.toLocaleString()} words</span></>}
                    <span>·</span>
                    <span>{doc.language}</span>
                  </div>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {new Date(doc.ingested_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
