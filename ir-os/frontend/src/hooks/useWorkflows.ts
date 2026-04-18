import { useState, useCallback } from "react";
import { workflowsApi } from "../api/workflows";
import type { WorkflowSummary } from "../api/types";
import { useInterval } from "./useInterval";

export function useWorkflows(pollMs = 5000) {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const d = await workflowsApi.list();
      setWorkflows(d.workflows);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useInterval(fetch, pollMs);

  return { workflows, loading, error, refresh: fetch };
}
