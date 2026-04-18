import { useState } from "react";
import { useWorkflows } from "../hooks/useWorkflows";
import { useCompany } from "../contexts/CompanyContext";
import { workflowsApi } from "../api/workflows";
import { WorkflowCard } from "../components/WorkflowCard";
import type { WorkflowStatus } from "../api/types";

const STATUSES: WorkflowStatus[] = [
  "INITIATED", "IN_PROGRESS", "AWAITING_HUMAN_INPUT", "AWAITING_APPROVAL",
  "APPROVED", "COMPLETED", "CANCELLED", "FAILED",
];

export default function WorkflowsPage() {
  const { workflows, loading, refresh } = useWorkflows(5000);
  const { activeCompany } = useCompany();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [creating, setCreating] = useState(false);
  const [createType, setCreateType] = useState<"earnings" | "material-fact" | "meeting-prep">("earnings");
  const [createError, setCreateError] = useState<string | null>(null);

  const filtered = workflows.filter(
    (w) => statusFilter === "ALL" || w.status === statusFilter
  );

  const active = workflows.filter((w) =>
    ["IN_PROGRESS", "AWAITING_HUMAN_INPUT", "AWAITING_APPROVAL"].includes(w.status)
  ).length;

  async function createWorkflow() {
    if (!activeCompany) return;
    setCreating(true);
    setCreateError(null);
    try {
      const body = { companyId: activeCompany.company_id };
      let result: { workflowId: string };
      if (createType === "earnings") result = await workflowsApi.createEarnings(body);
      else if (createType === "material-fact") result = await workflowsApi.createMaterialFact(body);
      else result = await workflowsApi.createMeetingPrep(body);
      await refresh();
      alert(`Workflow created: ${result.workflowId}`);
    } catch (e: unknown) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Workflows</h1>
          <p className="text-sm text-slate-500 mt-0.5">{active} active · {workflows.length} total</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={createType}
            onChange={(e) => setCreateType(e.target.value as typeof createType)}
            className="input text-sm w-44"
          >
            <option value="earnings">Earnings Cycle</option>
            <option value="material-fact">Material Fact</option>
            <option value="meeting-prep">Meeting Prep</option>
          </select>
          <button onClick={createWorkflow} disabled={creating || !activeCompany} className="btn-primary">
            {creating ? "Creating…" : "+ New"}
          </button>
        </div>
      </div>

      {createError && (
        <div className="card p-3 text-sm text-red-600">{createError}</div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setStatusFilter("ALL")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            statusFilter === "ALL" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All ({workflows.length})
        </button>
        {STATUSES.map((s) => {
          const count = workflows.filter((w) => w.status === s).length;
          if (count === 0) return null;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? "ALL" : s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                statusFilter === s ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {s.replace(/_/g, " ")} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Loading workflows…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-400 text-sm">
            {statusFilter === "ALL" ? "No workflows yet. Create one above." : `No workflows with status "${statusFilter}".`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((w) => <WorkflowCard key={w.workflowId} workflow={w} />)}
        </div>
      )}
    </div>
  );
}
