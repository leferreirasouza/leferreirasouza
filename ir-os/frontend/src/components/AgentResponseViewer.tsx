import type { AgentResponse } from "../api/types";
import { RedFlagList } from "./RedFlagBadge";
import { StatusBadge } from "./StatusBadge";

const CLASSIFICATION_COLORS: Record<string, string> = {
  PUBLIC: "bg-green-100 text-green-800",
  INTERNAL_APPROVED: "bg-blue-100 text-blue-800",
  DRAFT_INTERNAL: "bg-yellow-100 text-yellow-800",
  PROHIBITED: "bg-red-100 text-red-800",
};

interface Props {
  response: AgentResponse;
}

export function AgentResponseViewer({ response }: Props) {
  const cls = response.classification;

  return (
    <div className="space-y-4">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className={`px-2 py-0.5 rounded-full font-medium ${CLASSIFICATION_COLORS[cls.classification] ?? ""}`}>
          {cls.classification}
        </span>
        <StatusBadge status={cls.draftStatus} />
        <span className="ml-auto">{response.processingMs}ms</span>
      </div>

      {/* Red flags */}
      {cls.redFlags?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
            {cls.redFlags.length} Red Flag{cls.redFlags.length > 1 ? "s" : ""}
          </p>
          <RedFlagList flags={cls.redFlags} />
        </div>
      )}

      {/* Approval notice */}
      {cls.requiresHumanApproval && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <span>⚠</span>
          <span>Requires <strong>{cls.approvalLevel}</strong> approval before use</span>
        </div>
      )}

      {/* Handoffs */}
      {response.handoffs?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">Handoffs</p>
          <div className="flex flex-wrap gap-1.5">
            {response.handoffs.map((h, i) => (
              <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                → {h.toAgentId}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Output */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Output</p>
        <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed max-h-96">
          {JSON.stringify(response.output, null, 2)}
        </pre>
      </div>
    </div>
  );
}
