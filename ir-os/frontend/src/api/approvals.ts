import { api } from "./client";
import type { ApprovalRecord } from "./types";

export const approvalsApi = {
  decide: (approvalId: string, decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION", comments?: string) =>
    api.post<{ updatedRecord: ApprovalRecord }>(`/approvals/${approvalId}/decide`, {
      decision,
      comments,
    }),
};
