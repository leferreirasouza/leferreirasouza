/**
 * DATA CLASSIFICATION
 *
 * Every piece of information in IR-OS carries a DataClassification label.
 * The compliance engine enforces routing rules based on this label.
 *
 *  PUBLIC               — already disclosed; safe for external use
 *  INTERNAL_APPROVED    — approved internally; may become public after sign-off
 *  DRAFT_INTERNAL       — working draft; never external; human review required
 *  PROHIBITED           — MNPI, selective disclosure risk, or legally restricted
 */

export type DataClassification =
  | "PUBLIC"
  | "INTERNAL_APPROVED"
  | "DRAFT_INTERNAL"
  | "PROHIBITED";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";

export type DraftStatus =
  | "DRAFT"
  | "PENDING_COMPLIANCE_REVIEW"
  | "PENDING_LEGAL_REVIEW"
  | "PENDING_CFO_APPROVAL"
  | "PENDING_CEO_APPROVAL"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED";

/**
 * Every agent output must carry this provenance block.
 */
export interface SourceAttribution {
  sourceId: string;
  sourceType:
    | "FILING"
    | "PRESS_RELEASE"
    | "MANAGEMENT_COMMENT"
    | "ANALYST_REPORT"
    | "MARKET_DATA"
    | "INTERNAL_MODEL"
    | "APPROVED_MESSAGING"
    | "EXTERNAL_NEWS"
    | "TRANSCRIPT"
    | "MANUAL_INPUT"
    | "REFERENCE_LIBRARY";
  title: string;
  url?: string;
  pageOrSection?: string;
  filingDate?: string;          // ISO 8601
  retrievedAt: string;          // ISO 8601
  classification: DataClassification;
  confidence: ConfidenceLevel;
}

export interface ClassifiedContent {
  classification: DataClassification;
  confidence: ConfidenceLevel;
  draftStatus: DraftStatus;
  sources: SourceAttribution[];
  redFlags: RedFlag[];
  requiresHumanApproval: boolean;
  approvalLevel: ApprovalLevel;
}

export type ApprovalLevel =
  | "NONE"           // no approval needed (internal advisory, low sensitivity)
  | "IR_MANAGER"     // IR manager can approve
  | "HEAD_OF_IR"     // Head of IR required
  | "CFO"            // CFO required
  | "CEO_AND_CFO"    // Both CEO and CFO required
  | "LEGAL_PLUS_CFO" // Legal and CFO required
  | "BOARD";         // Board-level approval required

export interface RedFlag {
  code: RedFlagCode;
  severity: "INFO" | "WARNING" | "CRITICAL" | "BLOCK";
  description: string;
  triggeredBy: string;   // which field or phrase triggered it
  suggestion?: string;
}

export type RedFlagCode =
  | "SELECTIVE_DISCLOSURE_RISK"     // info not yet publicly available
  | "GUIDANCE_WITHOUT_APPROVAL"     // forward-looking statement not pre-approved
  | "UNSUPPORTED_CLAIM"             // factual claim without source
  | "INCONSISTENCY_WITH_FILING"     // contradicts a filed document
  | "MNPI_INDICATOR"                // likely material non-public information
  | "PREMATURE_DISCLOSURE"          // material event not yet cleared for disclosure
  | "MARKET_MANIPULATION_RISK"      // language that could be construed as market manipulation
  | "PROHIBITED_WORD"               // legally restricted term in context
  | "MISSING_SAFE_HARBOR"           // forward-looking statement missing safe-harbor language
  | "UNVERIFIED_METRIC"             // KPI without audited or restated basis
  | "REGULATORY_DEADLINE_BREACH"    // approaching or past mandatory filing deadline
  | "LOW_QUALITY_DRAFT"             // self-assessment rubric score < 3.5 — requires revision before gatekeeper review
  | "VALUATION_IN_PUBLIC_OUTPUT";   // modeled valuation figures (DCF, implied ranges) in non-internal output
