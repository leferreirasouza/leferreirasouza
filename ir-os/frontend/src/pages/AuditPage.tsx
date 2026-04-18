import { useState, useCallback } from "react";
import { auditApi, type AuditQuery } from "../api/audit";
import type { AuditEntry } from "../api/types";

const EVENT_TYPES = [
  "AGENT_INVOKED", "WORKFLOW_CREATED", "WORKFLOW_STEP_COMPLETED",
  "ARTIFACT_CREATED", "APPROVAL_REQUESTED", "APPROVAL_DECIDED",
  "DOCUMENT_INGESTED", "COMPLIANCE_CHECK", "DATA_ACCESSED",
];

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filters, setFilters] = useState<AuditQuery>({ limit: 50 });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await auditApi.query(filters);
      setEntries(r.entries);
      setCount(r.count);
      setLoaded(true);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  function setFilter(key: keyof AuditQuery, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Audit Log</h1>
          {loaded && <p className="text-sm text-slate-500 mt-0.5">{count} entries</p>}
        </div>
        <button onClick={load} disabled={loading} className="btn-primary">
          {loading ? "Loading…" : loaded ? "Refresh" : "Load Audit Log"}
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="label">Event Type</label>
          <select className="input text-sm" value={filters.eventType ?? ""} onChange={(e) => setFilter("eventType", e.target.value)}>
            <option value="">All</option>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input text-sm" value={filters.from ?? ""} onChange={(e) => setFilter("from", e.target.value)} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input text-sm" value={filters.to ?? ""} onChange={(e) => setFilter("to", e.target.value)} />
        </div>
        <div>
          <label className="label">Workflow ID</label>
          <input className="input text-sm" placeholder="wf-…" value={filters.workflowId ?? ""} onChange={(e) => setFilter("workflowId", e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="card p-4 text-sm text-red-600">{error}</div>
      )}

      {!loaded && !loading && (
        <div className="card p-12 text-center">
          <span className="text-3xl">🔍</span>
          <p className="mt-3 text-slate-500 text-sm">Click "Load Audit Log" to fetch entries.</p>
          <p className="text-xs text-slate-400 mt-1">Requires CFO, CEO, Legal, Compliance, or Board role.</p>
        </div>
      )}

      {loaded && entries.length === 0 && (
        <div className="card p-8 text-center text-slate-400 text-sm">No entries found for these filters.</div>
      )}

      {entries.length > 0 && (
        <div className="card divide-y divide-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wide bg-slate-50">
            <div className="col-span-3">Timestamp</div>
            <div className="col-span-3">Event</div>
            <div className="col-span-3">Agent / User</div>
            <div className="col-span-3">Summary</div>
          </div>
          {entries.map((e) => (
            <div key={e.entryId} className="grid grid-cols-12 px-4 py-2.5 text-xs hover:bg-slate-50 transition-colors">
              <div className="col-span-3 text-slate-500 font-mono">
                {new Date(e.timestamp).toLocaleString()}
              </div>
              <div className="col-span-3 font-medium text-slate-700">
                {e.eventType?.replace(/_/g, " ")}
              </div>
              <div className="col-span-3 text-slate-500">
                {e.agentId ?? e.userId ?? "—"}
              </div>
              <div className="col-span-3 text-slate-600 truncate" title={e.summary}>
                {e.summary}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
