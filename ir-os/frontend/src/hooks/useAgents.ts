import { useState, useEffect } from "react";
import { agentsApi } from "../api/agents";
import type { AgentDefinition } from "../api/types";

export function useAgents() {
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    agentsApi
      .list()
      .then((d) => setAgents(d.agents))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { agents, loading, error };
}
