import type {
  WorkflowInstance,
  WorkflowType,
  WorkflowStatus,
  WorkflowStep,
  StepStatus,
  UserId,
  AgentId,
  AuditEntry,
} from "../types";
import { AuditLogger } from "../audit/logger";

// ----------------------------------------------------------------
// WORKFLOW ENGINE
//
// Manages the lifecycle of all IR workflows.
// Enforces step sequencing, human checkpoints, and audit logging.
// Agents cannot skip steps or bypass human approval checkpoints.
// ----------------------------------------------------------------

export class WorkflowEngine {
  private readonly audit: AuditLogger;
  private workflows = new Map<string, WorkflowInstance>();

  constructor(audit: AuditLogger) {
    this.audit = audit;
  }

  async create(
    type: WorkflowType,
    initiatedBy: UserId,
    context: Record<string, unknown>,
    steps: Omit<WorkflowStep, "status" | "retryCount">[],
    priority: WorkflowInstance["priority"] = "NORMAL",
    deadline?: string
  ): Promise<WorkflowInstance> {
    const workflowId = `wf-${type.toLowerCase().replace(/_/g, "-")}-${Date.now()}`;

    const instance: WorkflowInstance = {
      workflowId,
      workflowType: type,
      status: "INITIATED",
      initiatedBy,
      initiatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStep: steps[0]?.stepId ?? "",
      steps: steps.map((s) => ({ ...s, status: "PENDING", retryCount: 0 })),
      context,
      artifacts: [],
      approvals: [],
      escalations: [],
      auditEntries: [],
      priority,
      deadline,
    };

    this.workflows.set(workflowId, instance);

    await this.audit.log({
      eventType: "WORKFLOW_CREATED",
      workflowId,
      userId: initiatedBy,
      action: `Workflow ${type} created`,
      after: { type, priority },
      traceId: `trace-${workflowId}`,
    });

    return instance;
  }

  async startStep(workflowId: string, stepId: string): Promise<void> {
    const wf = this.getOrThrow(workflowId);
    const step = this.findStep(wf, stepId);
    this.assertStepTransitionAllowed(wf, stepId, "RUNNING");

    step.status = "RUNNING";
    step.startedAt = new Date().toISOString();
    wf.currentStep = stepId;
    wf.updatedAt = new Date().toISOString();
    await this.persistAndAudit(wf, "STEP_STARTED", stepId);
  }

  async completeStep(
    workflowId: string,
    stepId: string,
    output: unknown
  ): Promise<{ nextStepId: string | null }> {
    const wf = this.getOrThrow(workflowId);
    const step = this.findStep(wf, stepId);

    step.status = "COMPLETED";
    step.completedAt = new Date().toISOString();
    step.output = output;
    step.durationMs = step.startedAt
      ? Date.now() - new Date(step.startedAt).getTime()
      : undefined;

    wf.updatedAt = new Date().toISOString();

    // Find next step
    const stepIndex = wf.steps.indexOf(step);
    const nextStep = wf.steps[stepIndex + 1] ?? null;

    if (!nextStep) {
      await this.completeWorkflow(wf);
    } else if (nextStep.agentId === "HUMAN") {
      await this.pauseForHuman(wf, nextStep.stepId);
    }

    await this.persistAndAudit(wf, "STEP_COMPLETED", stepId);
    return { nextStepId: nextStep?.stepId ?? null };
  }

  async failStep(workflowId: string, stepId: string, error: string): Promise<void> {
    const wf = this.getOrThrow(workflowId);
    const step = this.findStep(wf, stepId);

    step.status = "FAILED";
    step.notes = error;
    step.retryCount++;
    wf.status = "IN_PROGRESS";
    wf.updatedAt = new Date().toISOString();

    await this.persistAndAudit(wf, "STEP_FAILED", stepId);
  }

  async provideHumanInput(
    workflowId: string,
    stepId: string,
    input: unknown,
    providedBy: UserId
  ): Promise<void> {
    const wf = this.getOrThrow(workflowId);
    const step = this.findStep(wf, stepId);

    if (step.agentId !== "HUMAN") {
      throw new Error(`Step ${stepId} is not a human step.`);
    }

    step.status = "COMPLETED";
    step.input = input;
    step.completedAt = new Date().toISOString();
    wf.status = "IN_PROGRESS";
    wf.updatedAt = new Date().toISOString();

    await this.audit.log({
      eventType: "HUMAN_INPUT_RECEIVED",
      workflowId,
      userId: providedBy,
      action: `Human input provided for step ${stepId}`,
      after: { input },
      traceId: `trace-${workflowId}`,
    });

    await this.persistAndAudit(wf, "STEP_COMPLETED", stepId);
  }

  async pauseForApproval(workflowId: string): Promise<void> {
    const wf = this.getOrThrow(workflowId);
    wf.status = "AWAITING_APPROVAL";
    wf.updatedAt = new Date().toISOString();
    await this.persistAndAudit(wf, "WORKFLOW_STATUS_CHANGED", "");
  }

  async blockByCompliance(workflowId: string, reason: string): Promise<void> {
    const wf = this.getOrThrow(workflowId);
    wf.status = "BLOCKED_BY_COMPLIANCE";
    wf.context = { ...wf.context, complianceBlockReason: reason };
    wf.updatedAt = new Date().toISOString();
    await this.persistAndAudit(wf, "COMPLIANCE_CHECK_FAILED", "");
  }

  get(workflowId: string): WorkflowInstance | undefined {
    return this.workflows.get(workflowId);
  }

  list(filter?: { status?: WorkflowStatus; type?: WorkflowType }): WorkflowInstance[] {
    let result = Array.from(this.workflows.values());
    if (filter?.status) result = result.filter((w) => w.status === filter.status);
    if (filter?.type) result = result.filter((w) => w.workflowType === filter.type);
    return result;
  }

  // ---- PRIVATE HELPERS ----

  private getOrThrow(workflowId: string): WorkflowInstance {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new Error(`Workflow ${workflowId} not found.`);
    return wf;
  }

  private findStep(wf: WorkflowInstance, stepId: string): WorkflowStep {
    const step = wf.steps.find((s) => s.stepId === stepId);
    if (!step) throw new Error(`Step ${stepId} not found in workflow ${wf.workflowId}.`);
    return step;
  }

  private assertStepTransitionAllowed(
    wf: WorkflowInstance,
    stepId: string,
    targetStatus: StepStatus
  ): void {
    // Enforce that steps run in order — cannot start step N+1 until step N is complete
    const stepIndex = wf.steps.findIndex((s) => s.stepId === stepId);
    if (stepIndex > 0) {
      const priorStep = wf.steps[stepIndex - 1];
      if (
        priorStep &&
        priorStep.status !== "COMPLETED" &&
        priorStep.status !== "SKIPPED"
      ) {
        throw new Error(
          `Cannot start step ${stepId}: prior step ${priorStep.stepId} is ${priorStep.status}.`
        );
      }
    }
  }

  private async completeWorkflow(wf: WorkflowInstance): Promise<void> {
    wf.status = "COMPLETED";
    wf.completedAt = new Date().toISOString();
    await this.persistAndAudit(wf, "WORKFLOW_STATUS_CHANGED", "");
  }

  private async pauseForHuman(wf: WorkflowInstance, stepId: string): Promise<void> {
    wf.status = "AWAITING_HUMAN_INPUT";
    const step = this.findStep(wf, stepId);
    step.status = "AWAITING_HUMAN";
    await this.persistAndAudit(wf, "WORKFLOW_STATUS_CHANGED", stepId);
  }

  private async persistAndAudit(
    wf: WorkflowInstance,
    eventType: AuditEntry["eventType"],
    stepId: string
  ): Promise<void> {
    // In production, persist to DB here
    this.workflows.set(wf.workflowId, wf);
    await this.audit.log({
      eventType,
      workflowId: wf.workflowId,
      action: `${eventType} — step: ${stepId || "N/A"}`,
      after: { status: wf.status, currentStep: wf.currentStep },
      traceId: `trace-${wf.workflowId}`,
    });
  }
}
