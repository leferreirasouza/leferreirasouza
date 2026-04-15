import { Router } from "express";
import type { Request, Response } from "express";
import { ApprovalGate } from "../../compliance/approval-gate";
import { ComplianceEngine } from "../../compliance/engine";
import { AuditLogger } from "../../audit/logger";
import { requireRole } from "../middleware/auth";
import type { WorkflowArtifact, ApprovalRecord, User } from "../../types";

const audit = AuditLogger.getInstance();
const compliance = ComplianceEngine.getInstance();
const approvalGate = new ApprovalGate(compliance, audit);

export const approvalsRouter = Router();

/**
 * POST /api/v1/approvals/request
 * IR team submits an artifact for human approval.
 */
approvalsRouter.post(
  "/request",
  requireRole(["IR_MANAGER", "HEAD_OF_IR", "CFO"]),
  async (req: Request, res: Response) => {
    const { artifact, requiredLevel } = req.body as {
      artifact: WorkflowArtifact;
      requiredLevel: string;
    };

    if (!artifact || !requiredLevel) {
      res.status(400).json({ error: "artifact and requiredLevel are required." });
      return;
    }

    const user: User = {
      userId: req.user!.userId,
      name: "",
      email: req.user!.email,
      role: req.user!.role,
      canApprove: [],
      isActive: true,
    };

    const record = await approvalGate.requestApproval(
      artifact,
      user,
      requiredLevel as any
    );

    res.status(201).json({ approvalRecord: record });
  }
);

/**
 * POST /api/v1/approvals/:approvalId/decide
 * Human approver grants or denies approval.
 *
 * IMPORTANT: This endpoint enforces role-based access.
 * Only users with the required role can approve.
 * This is the ONLY legitimate path to APPROVED status.
 */
approvalsRouter.post(
  "/:approvalId/decide",
  requireRole(["IR_MANAGER", "HEAD_OF_IR", "CFO", "CEO", "LEGAL_COUNSEL", "COMPLIANCE_OFFICER"]),
  async (req: Request, res: Response) => {
    const { decision, comments, artifact, approvalRecord } = req.body as {
      decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION";
      comments?: string;
      artifact: WorkflowArtifact;
      approvalRecord: ApprovalRecord;
    };

    if (!decision || !artifact || !approvalRecord) {
      res.status(400).json({ error: "decision, artifact, and approvalRecord are required." });
      return;
    }

    const approver: User = {
      userId: req.user!.userId,
      name: "",
      email: req.user!.email,
      role: req.user!.role,
      canApprove: [],
      isActive: true,
    };

    try {
      const result = await approvalGate.decide(
        approvalRecord,
        artifact,
        approver,
        decision,
        comments
      );
      res.json({
        updatedRecord: result.updatedRecord,
        updatedArtifact: result.updatedArtifact,
      });
    } catch (err) {
      res.status(403).json({ error: (err as Error).message });
    }
  }
);

/**
 * POST /api/v1/approvals/publish-check
 * Final gate before external publishing.
 * Returns allowed=true ONLY if artifact is APPROVED and all requirements are met.
 *
 * NOTE: This endpoint validates but does NOT publish.
 * The human must execute publishing through the external CMS/filing system.
 */
approvalsRouter.post(
  "/publish-check",
  requireRole(["HEAD_OF_IR", "CFO", "CEO"]),
  async (req: Request, res: Response) => {
    const { artifact, approvalRecords } = req.body as {
      artifact: WorkflowArtifact;
      approvalRecords: ApprovalRecord[];
    };

    if (!artifact || !approvalRecords) {
      res.status(400).json({ error: "artifact and approvalRecords are required." });
      return;
    }

    const result = await approvalGate.canPublish(artifact, approvalRecords);
    res.json(result);
  }
);
