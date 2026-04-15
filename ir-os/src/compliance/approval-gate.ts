import type { ApprovalRecord, WorkflowArtifact, User, ApprovalLevel } from "../types";
import { ComplianceEngine } from "./engine";
import { AuditLogger } from "../audit/logger";

/**
 * APPROVAL GATE
 *
 * The single choke-point through which any artifact must pass
 * before being considered publishable. This is enforced at the
 * API layer — no agent can bypass it.
 *
 * Publishing pipeline:
 *   Artifact [DRAFT]
 *     → Gatekeeper Review → [PENDING_COMPLIANCE_REVIEW]
 *     → Compliance Pass  → [PENDING_LEGAL_REVIEW] (if required)
 *     → Legal Sign-Off   → [PENDING_CFO_APPROVAL]
 *     → CFO Approval     → [APPROVED]
 *     → (optional CEO)   → [APPROVED]
 *     → Human Publish    → [PUBLISHED]
 *
 * No agent can transition an artifact to APPROVED or PUBLISHED.
 * Only authenticated human users with the correct role can do so.
 */

export class ApprovalGate {
  private readonly compliance: ComplianceEngine;
  private readonly audit: AuditLogger;

  constructor(compliance: ComplianceEngine, audit: AuditLogger) {
    this.compliance = compliance;
    this.audit = audit;
  }

  /**
   * Submit an artifact for human approval.
   * Returns a new ApprovalRecord with status PENDING.
   */
  async requestApproval(
    artifact: WorkflowArtifact,
    requestedBy: User,
    requiredLevel: ApprovalLevel
  ): Promise<ApprovalRecord> {
    const record: ApprovalRecord = {
      approvalId: `apr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      workflowId: artifact.workflowId,
      artifactId: artifact.artifactId,
      requestedAt: new Date().toISOString(),
      requestedBy: requestedBy.userId,
      requiredApproverRole: requiredLevel,
      decision: "PENDING",
      version: artifact.version,
    };

    await this.audit.log({
      eventType: "APPROVAL_REQUESTED",
      artifactId: artifact.artifactId,
      workflowId: artifact.workflowId,
      userId: requestedBy.userId,
      action: `Approval requested for artifact ${artifact.artifactId} (version ${artifact.version})`,
      after: record,
      traceId: `trace-${record.approvalId}`,
    });

    return record;
  }

  /**
   * Grant or deny approval.
   * The approver must have a role that meets the required level.
   * This is the ONLY legitimate path to APPROVED status.
   */
  async decide(
    record: ApprovalRecord,
    artifact: WorkflowArtifact,
    approver: User,
    decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION",
    comments?: string
  ): Promise<{ updatedRecord: ApprovalRecord; updatedArtifact: WorkflowArtifact }> {
    // Compliance check: validate approver role
    const approvalCheck = await this.compliance.approveForPublishing(
      artifact.artifactId,
      approver.userId,
      approver.role,
      record.requiredApproverRole,
      artifact.redFlags.length > 0
        ? {
            classification: "DRAFT_INTERNAL",
            confidence: "MEDIUM",
            draftStatus: "DRAFT",
            sources: [],
            redFlags: artifact.redFlags,
            requiresHumanApproval: true,
            approvalLevel: record.requiredApproverRole as ApprovalLevel,
          }
        : {
            classification: "INTERNAL_APPROVED",
            confidence: "HIGH",
            draftStatus: "DRAFT",
            sources: [],
            redFlags: [],
            requiresHumanApproval: true,
            approvalLevel: record.requiredApproverRole as ApprovalLevel,
          }
    );

    if (!approvalCheck.approved && decision === "APPROVED") {
      throw new Error(`Approval denied by compliance engine: ${approvalCheck.reason}`);
    }

    const updatedRecord: ApprovalRecord = {
      ...record,
      approvedBy: approver.userId,
      approvedAt: new Date().toISOString(),
      decision,
      comments,
    };

    // Update artifact status based on decision
    let newDraftStatus = artifact.draftStatus;
    if (decision === "APPROVED") {
      newDraftStatus = "APPROVED";
    } else if (decision === "REJECTED") {
      newDraftStatus = "REJECTED";
    } else {
      newDraftStatus = "DRAFT"; // returned for revision
    }

    const updatedArtifact: WorkflowArtifact = {
      ...artifact,
      draftStatus: newDraftStatus,
      approvedBy: decision === "APPROVED" ? approver.userId : undefined,
      approvedAt: decision === "APPROVED" ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString(),
    };

    await this.audit.log({
      eventType: decision === "APPROVED" ? "APPROVAL_GRANTED" : "APPROVAL_DENIED",
      artifactId: artifact.artifactId,
      workflowId: artifact.workflowId,
      userId: approver.userId,
      action: `Approval ${decision} for artifact ${artifact.artifactId} by ${approver.role} ${approver.userId}`,
      before: record,
      after: updatedRecord,
      traceId: `trace-${record.approvalId}`,
    });

    return { updatedRecord, updatedArtifact };
  }

  /**
   * Publishing gate: the final check before any external action.
   * NEVER called by agents — only by the publishing service after
   * a human explicitly triggers publication.
   */
  async canPublish(
    artifact: WorkflowArtifact,
    approvalRecords: ApprovalRecord[]
  ): Promise<{ allowed: boolean; reason: string }> {
    const gate = this.compliance.isPublishingBlocked(
      artifact.draftStatus,
      approvalRecords
    );

    if (gate.blocked) {
      await this.audit.log({
        eventType: "PUBLISHING_BLOCKED",
        artifactId: artifact.artifactId,
        action: gate.reason,
        traceId: `trace-pub-${artifact.artifactId}`,
      });
      return { allowed: false, reason: gate.reason };
    }

    await this.audit.log({
      eventType: "PUBLISHING_APPROVED",
      artifactId: artifact.artifactId,
      action: `Publishing allowed for artifact ${artifact.artifactId}`,
      traceId: `trace-pub-${artifact.artifactId}`,
    });

    return { allowed: true, reason: "" };
  }
}
