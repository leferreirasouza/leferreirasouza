import { api } from "./client";
import type { AgentDefinition, AgentResponse } from "./types";

export interface InvokePayload {
  input: Record<string, unknown>;
  context?: {
    companyId?: string;
    currentPeriod?: { year: number; quarter: number; label: string };
    [key: string]: unknown;
  };
}

export const agentsApi = {
  list: () => api.get<{ agents: AgentDefinition[] }>("/agents"),

  invoke: (agentId: string, payload: InvokePayload) =>
    api.post<{ response: AgentResponse }>(`/agents/${agentId}/invoke`, payload),
};
