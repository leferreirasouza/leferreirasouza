import { Link } from "react-router-dom";
import type { WorkflowSummary } from "../api/types";
import { StatusBadge } from "./StatusBadge";

const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "text-red-600",
  HIGH: "text-orange-500",
  NORMAL: "text-slate-400",
  LOW: "text-slate-300",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function WorkflowCard({ workflow }: { workflow: WorkflowSummary }) {
  return (
    <Link
      to={`/workflows/${workflow.workflowId}`}
      className="card p-4 flex items-center gap-4 hover:border-blue-200 hover:shadow-md transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-sm text-slate-900 truncate">
            {workflow.type.replace(/_/g, " ")}
          </p>
          <StatusBadge status={workflow.status} />
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Step: {workflow.currentStep?.replace(/_/g, " ") ?? "—"}</span>
          <span>·</span>
          <span>{timeAgo(workflow.initiatedAt)}</span>
          <span>·</span>
          <span className={`font-medium ${PRIORITY_COLORS[workflow.priority]}`}>
            {workflow.priority}
          </span>
        </div>
      </div>
      <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
