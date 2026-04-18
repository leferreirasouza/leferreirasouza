import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { workflowsApi } from "../api/workflows";
import type { WorkflowInstance, WorkflowStep } from "../api/types";
import { StatusBadge } from "../components/StatusBadge";
import { ArtifactViewer } from "../components/ArtifactViewer";
import { useInterval } from "../hooks/useInterval";

type Tab = "steps" | "artifacts" | "approvals";

const STEP_ICONS: Record<string, string> = {
  COMPLETED: "✓",
  IN_PROGRESS: "⟳",
  FAILED: "✗",
  SKIPPED: "—",
  PENDING: "○",
};

const STEP_COLORS: Record<string, string> = {
  COMPLETED: "text-green-600 bg-green-50 border-green-200",
  IN_PROGRESS: "text-blue-600 bg-blue-50 border-blue-200 animate-pulse",
  FAILED: "text-red-600 bg-red-50 border-red-200",
  SKIPPED: "text-slate-400 bg-slate-50 border-slate-200",
  PENDING: "text-slate-400 bg-white border-slate-200",
};

function StepRow({ step }: { step: WorkflowStep }) {
  const cls = STEP_COLORS[step.status] ?? STEP_COLORS.PENDING;
  const icon = STEP_ICONS[step.status] ?? "○";
  return (
    <div className={`flex items-center gap-3 px-4 py-3 border rounded-lg ${cls}`}>
      <span className="text-sm font-bold w-5 text-center">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{step.name?.replace(/_/g, " ") ?? step.stepId}</p>
        {step.agentId && <p className="text-xs opacity-70">Agent: {step.agentId}</p>}
      </div>
      <div className="text-xs opacity-70 text-right shrink-0">
        {step.completedAt ? new Date(step.completedAt).toLocaleTimeString() : ""}
      </div>
    </div>
  );
}

export default function WorkflowDetailPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const [workflow, setWorkflow] = useState<WorkflowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("steps");

  const load = useCallback(async () => {
    if (!workflowId) return;
    try {
      const d = await workflowsApi.get(workflowId);
      setWorkflow(d.workflow);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => { load(); }, [load]);
  useInterval(load, workflow?.status === "COMPLETED" || workflow?.status === "FAILED" ? null : 5000);

  if (loading) return <div className="text-center py-20 text-slate-400">Loading workflow…</div>;
  if (error) return <div className="card p-6 text-red-600 text-sm">{error}</div>;
  if (!workflow) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/workflows" className="hover:text-slate-700">Workflows</Link>
        <span>›</span>
        <span className="text-slate-900 font-medium">{workflow.workflowType.replace(/_/g, " ")}</span>
      </div>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-lg font-bold text-slate-900">{workflow.workflowType.replace(/_/g, " ")}</h1>
              <StatusBadge status={workflow.status} />
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span>Started: {new Date(workflow.initiatedAt).toLocaleString()}</span>
              {workflow.completedAt && <span>Completed: {new Date(workflow.completedAt).toLocaleString()}</span>}
              <span>Priority: <strong>{workflow.priority}</strong></span>
            </div>
          </div>
        </div>
        {workflow.currentStep && (
          <p className="mt-3 text-sm text-slate-600">
            Current step: <strong>{workflow.currentStep.replace(/_/g, " ")}</strong>
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(["steps", "artifacts", "approvals"] as Tab[]).map((t) => {
          const counts: Record<Tab, number> = {
            steps: workflow.steps?.length ?? 0,
            artifacts: workflow.artifacts?.length ?? 0,
            approvals: workflow.approvals?.length ?? 0,
          };
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t} {counts[t] > 0 && <span className="ml-1 text-xs opacity-70">({counts[t]})</span>}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tab === "steps" && (
        <div className="space-y-2">
          {(workflow.steps ?? []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No steps recorded yet.</p>
          ) : (
            workflow.steps.map((s) => <StepRow key={s.stepId} step={s} />)
          )}
        </div>
      )}

      {tab === "artifacts" && (
        <div className="space-y-3">
          {(workflow.artifacts ?? []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No artifacts generated yet.</p>
          ) : (
            workflow.artifacts.map((a) => <ArtifactViewer key={a.artifactId} artifact={a} />)
          )}
        </div>
      )}

      {tab === "approvals" && (
        <div className="space-y-2">
          {(workflow.approvals ?? []).length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No approval records yet.</p>
          ) : (
            workflow.approvals.map((apr) => (
              <div key={apr.approvalId} className="card p-4 text-sm">
                <div className="flex items-center justify-between">
                  <StatusBadge status={apr.decision} />
                  <span className="text-xs text-slate-400">{new Date(apr.requestedAt).toLocaleString()}</span>
                </div>
                <p className="mt-2 text-slate-600">
                  Requires: <strong>{apr.requiredApproverRole?.replace(/_/g, " ")}</strong>
                </p>
                {apr.comments && (
                  <p className="mt-1 text-slate-500 text-xs">"{apr.comments}"</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
