import type { AgentContext, ClassifiedContent, DataClassification, ApprovalLevel } from "../types";

/**
 * Classify a piece of content based on its characteristics.
 *
 * Classification hierarchy (most to least restrictive):
 * PROHIBITED > DRAFT_INTERNAL > INTERNAL_APPROVED > PUBLIC
 *
 * Conservative default: DRAFT_INTERNAL
 */
export function classifyContent(
  content: string,
  _ctx: AgentContext
): ClassifiedContent {
  const lower = content.toLowerCase();

  // 1. PROHIBITED: MNPI, undisclosed transactions, explicit prohibition markers
  if (
    lower.includes("prohibited") ||
    lower.includes("mnpi") ||
    lower.includes('"classification":"prohibited"') ||
    lower.includes("under nda") ||
    lower.includes("confidential transaction")
  ) {
    return buildClassification("PROHIBITED", "LEGAL_PLUS_CFO", true);
  }

  // 2. DRAFT_INTERNAL: any draft, unreviewed, or internal-only content
  if (
    lower.includes('"draftstatus":"draft"') ||
    lower.includes('"internaluseonly":true') ||
    lower.includes("draft_internal") ||
    lower.includes('"status":"draft"')
  ) {
    return buildClassification("DRAFT_INTERNAL", "HEAD_OF_IR", true);
  }

  // 3. INTERNAL_APPROVED: approved for internal use, not yet external
  if (
    lower.includes("internal_approved") ||
    lower.includes('"classification":"internal_approved"')
  ) {
    return buildClassification("INTERNAL_APPROVED", "IR_MANAGER", true);
  }

  // 4. PUBLIC: explicitly marked as approved + published
  if (
    lower.includes('"classification":"public"') &&
    lower.includes('"draftstatus":"published"')
  ) {
    return buildClassification("PUBLIC", "NONE", false);
  }

  // Default: DRAFT_INTERNAL (conservative)
  return buildClassification("DRAFT_INTERNAL", "HEAD_OF_IR", true);
}

function buildClassification(
  classification: DataClassification,
  approvalLevel: ApprovalLevel,
  requiresHumanApproval: boolean
): ClassifiedContent {
  return {
    classification,
    confidence: "MEDIUM",
    draftStatus: classification === "PUBLIC" ? "APPROVED" : "DRAFT",
    sources: [],
    redFlags: [],
    requiresHumanApproval,
    approvalLevel,
  };
}

/**
 * Returns true if the given classification allows external publishing.
 * Only PUBLIC + PUBLISHED content can leave the system.
 */
export function canPublishExternally(
  classification: DataClassification,
  draftStatus: string
): boolean {
  return classification === "PUBLIC" && draftStatus === "PUBLISHED";
}

/**
 * Returns the minimum approval level required for a given classification.
 */
export function minimumApprovalFor(classification: DataClassification): ApprovalLevel {
  const map: Record<DataClassification, ApprovalLevel> = {
    PUBLIC: "CFO",
    INTERNAL_APPROVED: "IR_MANAGER",
    DRAFT_INTERNAL: "HEAD_OF_IR",
    PROHIBITED: "BOARD",
  };
  return map[classification];
}
