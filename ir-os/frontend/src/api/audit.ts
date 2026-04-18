import { api } from "./client";
import type { AuditEntry } from "./types";

export interface AuditQuery {
  workflowId?: string;
  agentId?: string;
  userId?: string;
  eventType?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export const auditApi = {
  query: (params: AuditQuery = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && qs.set(k, String(v)));
    return api.get<{ entries: AuditEntry[]; count: number }>(`/audit?${qs}`);
  },

  verify: (workflowId: string) =>
    api.get<{ workflowId: string; integrityVerified: boolean; entryCount: number }>(
      `/audit/verify/${workflowId}`
    ),
};
