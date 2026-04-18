import { useState } from "react";
import type { WorkflowArtifact } from "../api/types";
import type { PendingApproval } from "../hooks/useApprovals";
import { approvalsApi } from "../api/approvals";
import { StatusBadge } from "./StatusBadge";

interface Props {
  approval: PendingApproval;
  artifact?: WorkflowArtifact;
  onDecided: () => void;
}

export function ApprovalCard({ approval, artifact, onDecided }: Props) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION") {
    setLoading(true);
    setError(null);
    try {
      await approvalsApi.decide(approval.approvalId, decision, comment || undefined);
      onDecided();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium text-sm text-slate-900">
            {artifact?.title ?? approval.artifactId}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={approval.decision} />
            <span className="text-xs text-slate-500">
              Requires: <strong>{approval.requiredApproverRole?.replace(/_/g, " ")}</strong>
            </span>
          </div>
        </div>
        <span className="text-xs text-slate-400 shrink-0">
          {new Date(approval.requestedAt).toLocaleDateString()}
        </span>
      </div>

      {artifact && (
        <div className="bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto">
          <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
            {artifact.content.slice(0, 500)}{artifact.content.length > 500 ? "\n…" : ""}
          </pre>
        </div>
      )}

      <div>
        <label className="label">Comments (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
          className="input text-sm"
          placeholder="Add a note for the requester…"
        />
      </div>

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-2">
        <button onClick={() => decide("APPROVED")} disabled={loading} className="btn-primary">
          Approve
        </button>
        <button onClick={() => decide("RETURNED_FOR_REVISION")} disabled={loading} className="btn-secondary">
          Return
        </button>
        <button onClick={() => decide("REJECTED")} disabled={loading} className="btn-danger">
          Reject
        </button>
      </div>
    </div>
  );
}
