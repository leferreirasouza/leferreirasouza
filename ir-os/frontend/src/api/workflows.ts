import { api } from "./client";
import type { WorkflowInstance, WorkflowSummary } from "./types";

export const workflowsApi = {
  list: () => api.get<{ workflows: WorkflowSummary[] }>("/workflows"),

  get: (workflowId: string) =>
    api.get<{ workflow: WorkflowInstance }>(`/workflows/${workflowId}`),

  createEarnings: (body: Record<string, unknown>) =>
    api.post<{ workflowId: string }>("/workflows/earnings", body),

  createMaterialFact: (body: Record<string, unknown>) =>
    api.post<{ workflowId: string }>("/workflows/material-fact", body),

  createMeetingPrep: (body: Record<string, unknown>) =>
    api.post<{ workflowId: string }>("/workflows/meeting-prep", body),

  completeStep: (workflowId: string, stepId: string, body: Record<string, unknown>) =>
    api.post<{ success: boolean; message: string }>(
      `/workflows/${workflowId}/steps/${stepId}/complete`,
      body
    ),
};
