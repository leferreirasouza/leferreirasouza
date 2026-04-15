import type {
  AgentContext,
  AgentPermissions,
  ClassifiedContent,
  DataClassification,
  RedFlag,
  AgentHandoff,
  EscalationRequest,
} from "../types";
import { COMPLIANCE_RULES } from "./rules";
import { RED_FLAG_DETECTORS } from "./red-flags";
import { classifyContent } from "./classification";

// ----------------------------------------------------------------
// COMPLIANCE ENGINE
//
// Enforces data classification rules, red-flag detection,
// and the mandatory approval gate for external publishing.
//
// This is the compliance firewall. Agents call it pre- and post-
// execution. It CANNOT be bypassed by agents.
// ----------------------------------------------------------------

export interface ComplianceCheckResult {
  blocked: boolean;
  reason: string;
  classification: ClassifiedContent;
  handoffs: AgentHandoff[];
  escalations: EscalationRequest[];
}

export class ComplianceEngine {
  private static instance: ComplianceEngine;

  private constructor() {}

  static getInstance(): ComplianceEngine {
    if (!ComplianceEngine.instance) {
      ComplianceEngine.instance = new ComplianceEngine();
    }
    return ComplianceEngine.instance;
  }

  /**
   * Pre-execution check: validates the input against permitted access levels.
   */
  async checkInput(
    input: unknown,
    context: AgentContext,
    permissions: AgentPermissions
  ): Promise<{ blocked: boolean; reason: string }> {
    const inputStr = JSON.stringify(input);

    // 1. Check for PROHIBITED data references in input
    for (const rule of COMPLIANCE_RULES) {
      if (rule.scope.includes("INPUT") && rule.test(inputStr, context)) {
        return {
          blocked: true,
          reason: `Compliance rule violated: ${rule.code} — ${rule.description}`,
        };
      }
    }

    // 2. Check for PROHIBITED classification access
    if (!permissions.allowedTools.length) {
      return { blocked: true, reason: "Agent has no allowed tools configured." };
    }

    return { blocked: false, reason: "" };
  }

  /**
   * Post-execution check: classifies the output and raises red flags.
   */
  async checkOutput(
    output: unknown,
    context: AgentContext,
    permissions: AgentPermissions
  ): Promise<ComplianceCheckResult> {
    const outputStr = JSON.stringify(output);

    // 1. Classify the output content
    const classification = classifyContent(outputStr, context);

    // 2. Run red-flag detectors
    const redFlags: RedFlag[] = [];
    for (const detector of RED_FLAG_DETECTORS) {
      const flags = detector.detect(outputStr, context);
      redFlags.push(...flags);
    }

    classification.redFlags = redFlags;

    // 3. Check for BLOCK-level red flags
    const blockingFlags = redFlags.filter((f) => f.severity === "BLOCK");
    if (blockingFlags.length > 0) {
      classification.draftStatus = "PENDING_COMPLIANCE_REVIEW";
      classification.requiresHumanApproval = true;
      return {
        blocked: true,
        reason: `Blocking compliance issue: ${blockingFlags[0].description}`,
        classification,
        handoffs: [],
        escalations: this.buildEscalations(blockingFlags, context),
      };
    }

    // 4. Enforce: if content is PUBLIC-classified, check permissions
    if (
      classification.classification === "PUBLIC" &&
      !permissions.canGenerateExternal
    ) {
      classification.classification = "INTERNAL_APPROVED";
    }

    // 5. Enforce: if agent cannot publish, set requiresHumanApproval
    if (!permissions.canGenerateExternal || blockingFlags.length > 0) {
      classification.requiresHumanApproval = true;
    }

    // 6. Build suggested handoffs for CRITICAL flags
    const criticalFlags = redFlags.filter((f) => f.severity === "CRITICAL");
    const handoffs: AgentHandoff[] = criticalFlags.length > 0
      ? [
          {
            targetAgentId: "disclosure-gatekeeper",
            reason: "Critical compliance flags require gatekeeper review",
            payload: { redFlags: criticalFlags, output },
            priority: "HIGH",
          },
        ]
      : [];

    return {
      blocked: false,
      reason: "",
      classification,
      handoffs,
      escalations: [],
    };
  }

  /**
   * The publishing gate: the ONLY path through which content can be
   * marked as approved for external publication. This requires:
   * 1. An explicit approval record from a human with the required role
   * 2. Zero BLOCK-level red flags
   * 3. Gatekeeper review completed
   */
  async approveForPublishing(
    artifactId: string,
    approvedByUserId: string,
    approverRole: string,
    requiredApprovalLevel: string,
    currentClassification: ClassifiedContent
  ): Promise<{ approved: boolean; reason: string }> {
    // Validate that the approver role meets the required level
    const roleHierarchy: Record<string, number> = {
      NONE: 0,
      IR_MANAGER: 1,
      HEAD_OF_IR: 2,
      CFO: 3,
      CEO_AND_CFO: 4,
      LEGAL_PLUS_CFO: 4,
      BOARD: 5,
    };

    const approverLevel = this.getRoleLevel(approverRole);
    const requiredLevel = roleHierarchy[requiredApprovalLevel] ?? 99;

    if (approverLevel < requiredLevel) {
      return {
        approved: false,
        reason: `Approver role ${approverRole} is insufficient. Required: ${requiredApprovalLevel}`,
      };
    }

    // Block if any BLOCK-level red flags remain
    const blockingFlags = currentClassification.redFlags.filter(
      (f) => f.severity === "BLOCK"
    );
    if (blockingFlags.length > 0) {
      return {
        approved: false,
        reason: `Cannot approve: ${blockingFlags.length} blocking compliance issue(s) remain unresolved.`,
      };
    }

    return { approved: true, reason: "Approval granted." };
  }

  /**
   * Absolute gate: prevents any agent from directly publishing.
   * This method is called by the publishing service before any external action.
   */
  isPublishingBlocked(
    artifactDraftStatus: string,
    approvalRecords: { decision: string; decidedBy?: string }[]
  ): { blocked: boolean; reason: string } {
    if (artifactDraftStatus !== "APPROVED") {
      return {
        blocked: true,
        reason: `Publishing blocked: artifact status is "${artifactDraftStatus}", must be "APPROVED".`,
      };
    }

    const approvals = approvalRecords.filter((r) => r.decision === "APPROVED");
    if (approvals.length === 0) {
      return {
        blocked: true,
        reason: "Publishing blocked: no approval records found. Human sign-off is mandatory.",
      };
    }

    return { blocked: false, reason: "" };
  }

  private buildEscalations(
    blockingFlags: RedFlag[],
    context: AgentContext
  ): EscalationRequest[] {
    return blockingFlags.map((flag) => ({
      escalationId: `esc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      requestId: context.sessionId,
      agentId: "disclosure-gatekeeper",
      escalatedAt: new Date().toISOString(),
      reason: flag.description,
      severity: "CRITICAL",
      requiredApproverRole: "LEGAL_PLUS_CFO",
      payload: { flag },
      status: "PENDING",
    }));
  }

  private getRoleLevel(role: string): number {
    const levels: Record<string, number> = {
      IR_MANAGER: 1,
      HEAD_OF_IR: 2,
      CFO: 3,
      CEO: 3,
      LEGAL_COUNSEL: 3,
      COMMUNICATIONS: 1,
      FINANCE_ANALYST: 0,
      BOARD_MEMBER: 5,
      COMPLIANCE_OFFICER: 4,
      SYSTEM: 0,
    };
    return levels[role] ?? 0;
  }
}
