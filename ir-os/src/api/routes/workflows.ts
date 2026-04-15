import { Router } from "express";
import type { Request, Response } from "express";
import { WorkflowEngine } from "../../workflows/engine";
import { createEarningsWorkflow } from "../../workflows/quarterly-earnings";
import { createMaterialFactWorkflow } from "../../workflows/material-fact";
import { createMeetingPrepWorkflow } from "../../workflows/investor-meeting-prep";
import { AuditLogger } from "../../audit/logger";
import { requireRole } from "../middleware/auth";

const audit = AuditLogger.getInstance();
const engine = new WorkflowEngine(audit);

export const workflowRouter = Router();

// ---- LIST WORKFLOWS ----
workflowRouter.get("/", (_req: Request, res: Response) => {
  const workflows = engine.list();
  res.json({ workflows: workflows.map((w) => ({
    workflowId: w.workflowId,
    type: w.workflowType,
    status: w.status,
    currentStep: w.currentStep,
    initiatedBy: w.initiatedBy,
    initiatedAt: w.initiatedAt,
    priority: w.priority,
  })) });
});

// ---- GET WORKFLOW DETAIL ----
workflowRouter.get("/:workflowId", (req: Request, res: Response) => {
  const wf = engine.get(req.params["workflowId"] ?? "");
  if (!wf) {
    res.status(404).json({ error: "Workflow not found." });
    return;
  }
  res.json({ workflow: wf });
});

// ---- CREATE EARNINGS WORKFLOW ----
workflowRouter.post(
  "/earnings",
  requireRole(["HEAD_OF_IR", "CFO"]),
  async (req: Request, res: Response) => {
    const { period, earningsDate } = req.body as {
      period: { year: number; quarter: 1|2|3|4; label: string };
      earningsDate: string;
    };
    if (!period || !earningsDate) {
      res.status(400).json({ error: "period and earningsDate are required." });
      return;
    }
    const workflowId = await createEarningsWorkflow(
      engine,
      period,
      req.user!.userId,
      earningsDate
    );
    res.status(201).json({ workflowId });
  }
);

// ---- CREATE MATERIAL FACT WORKFLOW ----
workflowRouter.post(
  "/material-fact",
  requireRole(["HEAD_OF_IR", "CFO", "CEO", "LEGAL_COUNSEL"]),
  async (req: Request, res: Response) => {
    const { eventDescription, eventType, deadline } = req.body as {
      eventDescription: string;
      eventType: string;
      deadline: string;
    };
    if (!eventDescription || !eventType) {
      res.status(400).json({ error: "eventDescription and eventType are required." });
      return;
    }
    const workflowId = await createMaterialFactWorkflow(
      engine,
      eventDescription,
      eventType,
      req.user!.userId,
      deadline ?? new Date(Date.now() + 4 * 3600 * 1000).toISOString()
    );
    res.status(201).json({ workflowId });
  }
);

// ---- CREATE MEETING PREP WORKFLOW ----
workflowRouter.post(
  "/meeting-prep",
  requireRole(["IR_MANAGER", "HEAD_OF_IR", "CFO"]),
  async (req: Request, res: Response) => {
    const { meetingId, investorIds, meetingDate } = req.body as {
      meetingId: string;
      investorIds: string[];
      meetingDate: string;
    };
    if (!meetingId || !meetingDate) {
      res.status(400).json({ error: "meetingId and meetingDate are required." });
      return;
    }
    const workflowId = await createMeetingPrepWorkflow(
      engine,
      meetingId,
      investorIds ?? [],
      meetingDate,
      req.user!.userId
    );
    res.status(201).json({ workflowId });
  }
);

// ---- PROVIDE HUMAN INPUT TO A STEP ----
workflowRouter.post(
  "/:workflowId/steps/:stepId/complete",
  async (req: Request, res: Response) => {
    const { workflowId, stepId } = req.params as { workflowId: string; stepId: string };
    const { input } = req.body as { input: unknown };

    try {
      await engine.provideHumanInput(workflowId, stepId, input, req.user!.userId);
      res.json({ success: true, message: `Step ${stepId} completed.` });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  }
);
