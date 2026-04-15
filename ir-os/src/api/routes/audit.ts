import { Router } from "express";
import type { Request, Response } from "express";
import { AuditLogger } from "../../audit/logger";
import { requireRole } from "../middleware/auth";

const audit = AuditLogger.getInstance();
export const auditRouter = Router();

// Audit log is only accessible to Compliance, Legal, and Executive roles
const auditRoles = ["CFO", "CEO", "LEGAL_COUNSEL", "COMPLIANCE_OFFICER", "BOARD_MEMBER"] as const;

auditRouter.get(
  "/",
  requireRole([...auditRoles]),
  (req: Request, res: Response) => {
    const { workflowId, artifactId, agentId, userId, eventType, from, to } = req.query as Record<string, string>;
    const entries = audit.query({
      workflowId,
      artifactId,
      agentId: agentId as any,
      userId,
      eventType: eventType as any,
      from,
      to,
    });
    res.json({ entries, count: entries.length });
  }
);

auditRouter.get(
  "/verify/:workflowId",
  requireRole([...auditRoles]),
  (req: Request, res: Response) => {
    const entries = audit.query({ workflowId: req.params["workflowId"] });
    const valid = audit.verifyIntegrity(entries);
    res.json({ workflowId: req.params["workflowId"], integrityVerified: valid, entryCount: entries.length });
  }
);
