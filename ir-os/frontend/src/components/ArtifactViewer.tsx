import { useState } from "react";
import type { WorkflowArtifact } from "../api/types";
import { StatusBadge } from "./StatusBadge";
import { RedFlagList } from "./RedFlagBadge";

interface Props {
  artifact: WorkflowArtifact;
  onRequestApproval?: (artifactId: string) => void;
}

export function ArtifactViewer({ artifact, onRequestApproval }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm text-slate-900 truncate">{artifact.title}</p>
            <StatusBadge status={artifact.draftStatus} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {artifact.artifactType.replace(/_/g, " ")} · v{artifact.version} · {artifact.createdByAgentId}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {artifact.redFlags?.length > 0 && (
            <span className="text-xs text-red-600 font-medium">
              {artifact.redFlags.length} flag{artifact.redFlags.length > 1 ? "s" : ""}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 p-4 space-y-4">
          {artifact.redFlags?.length > 0 && <RedFlagList flags={artifact.redFlags} />}

          <div className="bg-slate-50 rounded-lg p-4 max-h-80 overflow-y-auto">
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
              {artifact.content}
            </pre>
          </div>

          {onRequestApproval && artifact.draftStatus === "DRAFT" && (
            <button
              onClick={() => onRequestApproval(artifact.artifactId)}
              className="btn-secondary text-xs"
            >
              Request Approval
            </button>
          )}
        </div>
      )}
    </div>
  );
}
