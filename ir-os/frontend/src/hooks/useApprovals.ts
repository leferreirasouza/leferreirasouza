import { useState, useCallback } from "react";
import { workflowsApi } from "../api/workflows";
import type { ApprovalRecord, WorkflowSummary } from "../api/types";
import { useInterval } from "./useInterval";

export interface PendingApproval extends ApprovalRecord {
  workflowType: string;
}

export function useApprovals(pollMs = 10000) {
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const { workflows } = await workflowsApi.list();
      const awaitingIds = workflows
        .filter((w: WorkflowSummary) => w.status === "AWAITING_APPROVAL")
        .map((w: WorkflowSummary) => w.workflowId);

      const details = await Promise.all(awaitingIds.map((id: string) => workflowsApi.get(id)));
      const all: PendingApproval[] = [];
      for (const { workflow } of details) {
        for (const apr of workflow.approvals) {
          if (apr.decision === "PENDING") {
            all.push({ ...apr, workflowType: workflow.workflowType });
          }
        }
      }
      setPending(all);
    } catch {
      // silently fail on poll
    } finally {
      setLoading(false);
    }
  }, []);

  useInterval(fetch, pollMs);

  return { pending, loading, refresh: fetch };
}
