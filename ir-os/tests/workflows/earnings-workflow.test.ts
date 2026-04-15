import { describe, it, expect, beforeEach } from "vitest";
import { WorkflowEngine } from "../../src/workflows/engine";
import { createEarningsWorkflow, buildEarningsWorkflowSteps } from "../../src/workflows/quarterly-earnings";
import { AuditLogger } from "../../src/audit/logger";

// Use a temp path for test audit logs
process.env.AUDIT_LOG_PATH = "/tmp/ir-os-test-audit.jsonl";

describe("Quarterly Earnings Workflow", () => {
  let engine: WorkflowEngine;
  let audit: AuditLogger;

  beforeEach(() => {
    audit = AuditLogger.getInstance("/tmp/ir-os-test-audit.jsonl");
    engine = new WorkflowEngine(audit);
  });

  it("builds the correct number of steps", () => {
    const steps = buildEarningsWorkflowSteps({ year: 2025, quarter: 4, label: "4Q25" });
    expect(steps).toHaveLength(18);
  });

  it("includes exactly 5 HUMAN steps", () => {
    const steps = buildEarningsWorkflowSteps({ year: 2025, quarter: 4, label: "4Q25" });
    const humanSteps = steps.filter((s) => s.agentId === "HUMAN");
    expect(humanSteps).toHaveLength(5);
  });

  it("human steps include CFO approval as the final approval gate", () => {
    const steps = buildEarningsWorkflowSteps({ year: 2025, quarter: 4, label: "4Q25" });
    const cfoStep = steps.find((s) => s.stepId === "EW-14-CFO-APPROVAL");
    expect(cfoStep).toBeDefined();
    expect(cfoStep!.agentId).toBe("HUMAN");
    expect(JSON.stringify(cfoStep!.input)).toContain("CFO");
  });

  it("creates a workflow instance with INITIATED status", async () => {
    const workflowId = await createEarningsWorkflow(
      engine,
      { year: 2025, quarter: 4, label: "4Q25" },
      "user-test-001",
      "2026-02-18T22:00:00Z"
    );
    const wf = engine.get(workflowId);
    expect(wf).toBeDefined();
    expect(wf!.status).toBe("INITIATED");
    expect(wf!.workflowType).toBe("QUARTERLY_EARNINGS");
    expect(wf!.priority).toBe("HIGH");
  });

  it("first step is an agent step (not human)", async () => {
    const workflowId = await createEarningsWorkflow(
      engine,
      { year: 2025, quarter: 4, label: "4Q25" },
      "user-test-001",
      "2026-02-18T22:00:00Z"
    );
    const wf = engine.get(workflowId);
    expect(wf!.steps[0].agentId).not.toBe("HUMAN");
  });

  it("cannot start step 2 before step 1 is completed", async () => {
    const workflowId = await createEarningsWorkflow(
      engine,
      { year: 2025, quarter: 4, label: "4Q25" },
      "user-test-001",
      "2026-02-18T22:00:00Z"
    );

    // Start step 1
    await engine.startStep(workflowId, "EW-01-KICKOFF");

    // Attempt step 2 before completing step 1 — should throw
    await expect(engine.startStep(workflowId, "EW-02-CALENDAR-UPDATE")).rejects.toThrow(
      /prior step.*is RUNNING/
    );
  });

  it("completes a step and advances to the next", async () => {
    const workflowId = await createEarningsWorkflow(
      engine,
      { year: 2025, quarter: 4, label: "4Q25" },
      "user-test-001",
      "2026-02-18T22:00:00Z"
    );

    await engine.startStep(workflowId, "EW-01-KICKOFF");
    const { nextStepId } = await engine.completeStep(
      workflowId,
      "EW-01-KICKOFF",
      { phase: "KICKOFF", readinessScore: 15 }
    );

    const wf = engine.get(workflowId);
    const step1 = wf!.steps.find((s) => s.stepId === "EW-01-KICKOFF")!;
    expect(step1.status).toBe("COMPLETED");
    expect(nextStepId).toBe("EW-02-CALENDAR-UPDATE");
  });
});

describe("Material Fact Workflow", () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    const audit = AuditLogger.getInstance("/tmp/ir-os-test-audit.jsonl");
    engine = new WorkflowEngine(audit);
  });

  it("has URGENT priority", async () => {
    const { createMaterialFactWorkflow } = await import("../../src/workflows/material-fact");
    const workflowId = await createMaterialFactWorkflow(
      engine,
      "CEO resigned effective March 31",
      "MANAGEMENT_CHANGE",
      "user-cfo-001",
      new Date(Date.now() + 4 * 3600 * 1000).toISOString()
    );
    const wf = engine.get(workflowId);
    expect(wf!.priority).toBe("URGENT");
  });

  it("has a materiality human checkpoint as step 2", async () => {
    const { buildMaterialFactWorkflowSteps } = await import("../../src/workflows/material-fact");
    const steps = buildMaterialFactWorkflowSteps("CEO resignation", "MANAGEMENT_CHANGE");
    expect(steps[1].agentId).toBe("HUMAN");
    expect(steps[1].stepId).toBe("MF-02-MATERIALITY");
  });
});
