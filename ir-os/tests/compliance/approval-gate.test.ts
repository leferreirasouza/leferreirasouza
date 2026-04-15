import { describe, it, expect, beforeEach } from "vitest";
import { ApprovalGate } from "../../src/compliance/approval-gate";
import { ComplianceEngine } from "../../src/compliance/engine";
import { AuditLogger } from "../../src/audit/logger";
import type { WorkflowArtifact, ApprovalRecord, User } from "../../src/types";

process.env.AUDIT_LOG_PATH = "/tmp/ir-os-test-approval-audit.jsonl";

const mockArtifact = (overrides: Partial<WorkflowArtifact> = {}): WorkflowArtifact => ({
  artifactId: "art-001",
  workflowId: "wf-001",
  stepId: "step-001",
  artifactType: "PRESS_RELEASE",
  title: "Q4 2025 Earnings Press Release",
  content: "Revenue grew 15% YoY. EBITDA margin expanded 200bps.",
  draftStatus: "DRAFT",
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdByAgentId: "disclosure-drafting",
  redFlags: [],
  sources: [],
  ...overrides,
});

const mockUser = (role: string): User => ({
  userId: `user-${role.toLowerCase()}`,
  name: `Test ${role}`,
  email: `${role.toLowerCase()}@test.com`,
  role: role as any,
  canApprove: [],
  isActive: true,
});

describe("ApprovalGate", () => {
  let gate: ApprovalGate;

  beforeEach(() => {
    const audit = AuditLogger.getInstance("/tmp/ir-os-test-approval-audit.jsonl");
    const compliance = ComplianceEngine.getInstance();
    gate = new ApprovalGate(compliance, audit);
  });

  describe("requestApproval", () => {
    it("creates a PENDING approval record", async () => {
      const artifact = mockArtifact();
      const user = mockUser("HEAD_OF_IR");
      const record = await gate.requestApproval(artifact, user, "CFO");
      expect(record.decision).toBe("PENDING");
      expect(record.requiredApproverRole).toBe("CFO");
      expect(record.artifactId).toBe("art-001");
    });
  });

  describe("canPublish — publishing gate", () => {
    it("blocks publishing when draftStatus is DRAFT", async () => {
      const artifact = mockArtifact({ draftStatus: "DRAFT" });
      const result = await gate.canPublish(artifact, []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/DRAFT/);
    });

    it("blocks publishing when there are no approval records", async () => {
      const artifact = mockArtifact({ draftStatus: "APPROVED" });
      const result = await gate.canPublish(artifact, []);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/no approval records/i);
    });

    it("allows publishing when APPROVED status and valid approval record exist", async () => {
      const artifact = mockArtifact({ draftStatus: "APPROVED" });
      const approvalRecord: ApprovalRecord = {
        approvalId: "apr-001",
        workflowId: "wf-001",
        artifactId: "art-001",
        requestedAt: new Date().toISOString(),
        requestedBy: "user-head-of-ir",
        requiredApproverRole: "CFO",
        decision: "APPROVED",
        approvedBy: "user-cfo",
        approvedAt: new Date().toISOString(),
        version: 1,
      };
      const result = await gate.canPublish(artifact, [approvalRecord]);
      expect(result.allowed).toBe(true);
    });

    it("blocks publishing when approval record is REJECTED", async () => {
      const artifact = mockArtifact({ draftStatus: "APPROVED" });
      const rejectedRecord: ApprovalRecord = {
        approvalId: "apr-002",
        workflowId: "wf-001",
        artifactId: "art-001",
        requestedAt: new Date().toISOString(),
        requestedBy: "user-ir-manager",
        requiredApproverRole: "CFO",
        decision: "REJECTED",
        version: 1,
      };
      const result = await gate.canPublish(artifact, [rejectedRecord]);
      expect(result.allowed).toBe(false);
    });
  });
});
