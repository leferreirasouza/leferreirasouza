import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCompany } from "../contexts/CompanyContext";
import { useWorkflows } from "../hooks/useWorkflows";
import { useApprovals } from "../hooks/useApprovals";
import { ingestApi } from "../api/ingest";
import { StatusBadge } from "../components/StatusBadge";

function KPICard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color ?? "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { activeCompany } = useCompany();
  const { workflows, loading: wLoading } = useWorkflows(10000);
  const { pending } = useApprovals(15000);
  const [docCount, setDocCount] = useState<number | null>(null);

  useEffect(() => {
    if (!activeCompany) return;
    ingestApi.status(activeCompany.company_id).then((s) => setDocCount(s.totalDocs)).catch(() => {});
  }, [activeCompany]);

  const active = workflows.filter((w) => ["IN_PROGRESS", "AWAITING_HUMAN_INPUT", "AWAITING_APPROVAL"].includes(w.status)).length;
  const recent = [...workflows].sort((a, b) => new Date(b.initiatedAt).getTime() - new Date(a.initiatedAt).getTime()).slice(0, 5);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Company banner */}
      {activeCompany && (
        <div className="card p-5 flex items-center gap-4 bg-gradient-to-r from-blue-600 to-blue-700 border-blue-600">
          <div>
            <p className="text-3xl font-black text-white">{activeCompany.ticker}</p>
            <p className="text-blue-200 text-sm">{activeCompany.name}</p>
          </div>
          <div className="h-10 w-px bg-blue-500 mx-2" />
          <div className="text-blue-200 text-sm space-y-0.5">
            <p>{activeCompany.exchange} · {activeCompany.currency}</p>
            {activeCompany.sector && <p>{activeCompany.sector}</p>}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Active Workflows" value={wLoading ? "…" : active} sub="in progress" color="text-blue-600" />
        <KPICard label="Pending Approvals" value={pending.length} sub="awaiting decision" color={pending.length > 0 ? "text-amber-600" : "text-slate-900"} />
        <KPICard label="Total Workflows" value={wLoading ? "…" : workflows.length} sub="all time" />
        <KPICard label="Documents" value={docCount ?? "…"} sub="in knowledge base" />
      </div>

      {/* Recent workflows */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-900">Recent Workflows</h2>
          <Link to="/workflows" className="text-xs text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>
        {wLoading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-slate-400 text-sm">No workflows yet.</p>
            <Link to="/workflows" className="mt-2 text-xs text-blue-600 hover:underline inline-block">Create one →</Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {recent.map((w) => (
              <Link key={w.workflowId} to={`/workflows/${w.workflowId}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{w.type.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-500">{w.currentStep?.replace(/_/g, " ") ?? "—"}</p>
                </div>
                <StatusBadge status={w.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link to="/agents" className="btn-primary">🤖 Invoke Agent</Link>
          <Link to="/approvals" className="btn-secondary">✅ Review Approvals</Link>
          <Link to="/documents" className="btn-secondary">📄 Upload Documents</Link>
          <Link to="/audit" className="btn-secondary">🔍 Audit Log</Link>
        </div>
      </div>
    </div>
  );
}
