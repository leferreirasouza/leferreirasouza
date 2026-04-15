import type {
  ClassifiedContent,
  DataClassification,
  ApprovalLevel,
} from "./data-classification";

// ----------------------------------------------------------------
// AGENT IDENTITY
// ----------------------------------------------------------------

export type AgentId =
  | "chief-of-staff"
  | "disclosure-gatekeeper"
  | "earnings-cycle"
  | "disclosure-drafting"
  | "consensus-sellside"
  | "market-intelligence"
  | "meeting-prep"
  | "investor-targeting"
  | "perception"
  | "capital-allocation"
  | "ir-website"
  | "shareholder-agm"
  | "special-situations"
  | "knowledge-librarian";

export type AgentMode = "INTERNAL_ADVISORY" | "EXTERNAL_COMMUNICATION";

// ----------------------------------------------------------------
// BASE AGENT INTERFACES
// ----------------------------------------------------------------

export interface AgentRequest<TInput = unknown> {
  requestId: string;              // UUID
  agentId: AgentId;
  requestedBy: UserId;
  mode: AgentMode;
  input: TInput;
  context: AgentContext;
  calledAt: string;               // ISO 8601
}

export interface AgentResponse<TOutput = unknown> {
  requestId: string;
  agentId: AgentId;
  output: TOutput;
  classification: ClassifiedContent;
  processingMs: number;
  completedAt: string;            // ISO 8601
  handoffs: AgentHandoff[];       // downstream agents to invoke
  escalations: EscalationRequest[];
}

export interface AgentContext {
  companyId: string;
  ticker: string;
  exchange: "B3" | "NYSE" | "NASDAQ" | "DUAL_LISTED";
  reportingCurrency: "BRL" | "USD";
  fiscalYearEnd: string;          // e.g. "12-31"
  currentPeriod: FiscalPeriod;
  sessionId: string;
  traceId: string;
  authorizedDataSources: DataClassification[];
  operatingMode: AgentMode;
}

export interface FiscalPeriod {
  year: number;
  quarter: 1 | 2 | 3 | 4 | null; // null = annual
  label: string;                  // e.g. "4Q25", "FY25"
}

// ----------------------------------------------------------------
// HANDOFFS & ESCALATIONS
// ----------------------------------------------------------------

export interface AgentHandoff {
  targetAgentId: AgentId;
  reason: string;
  payload: unknown;
  priority: "HIGH" | "NORMAL" | "LOW";
  triggerCondition?: string;
}

export interface EscalationRequest {
  escalationId: string;
  requestId: string;
  agentId: AgentId;
  escalatedAt: string;
  reason: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  requiredApproverRole: ApprovalLevel;
  payload: unknown;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  resolvedAt?: string;
  resolvedBy?: UserId;
  resolution?: string;
}

// ----------------------------------------------------------------
// USERS / ROLES
// ----------------------------------------------------------------

export type UserId = string; // UUID

export type UserRole =
  | "IR_MANAGER"
  | "HEAD_OF_IR"
  | "CFO"
  | "CEO"
  | "LEGAL_COUNSEL"
  | "COMMUNICATIONS"
  | "FINANCE_ANALYST"
  | "BOARD_MEMBER"
  | "COMPLIANCE_OFFICER"
  | "SYSTEM";              // for automated, non-human actions

export interface User {
  userId: UserId;
  name: string;
  email: string;
  role: UserRole;
  canApprove: ApprovalLevel[];
  isActive: boolean;
}

// ----------------------------------------------------------------
// TOOL PERMISSIONS PER AGENT
// ----------------------------------------------------------------

export type ToolName =
  | "search_filing_library"
  | "search_approved_messaging"
  | "read_financial_data"
  | "read_consensus_data"
  | "read_peer_data"
  | "read_crm"
  | "write_crm_note"
  | "read_market_data"
  | "read_audit_log"
  | "create_draft"
  | "update_draft"
  | "submit_for_approval"
  | "read_website_content"
  | "read_qa_library"
  | "read_disclosure_calendar"
  | "update_disclosure_calendar"
  | "run_compliance_check"
  | "trigger_escalation"
  | "send_internal_notification"
  | "read_board_package"
  | "search_knowledge_base";

export type RestrictedAction =
  | "PUBLISH_EXTERNAL"
  | "FILE_WITH_REGULATOR"
  | "APPROVE_OWN_OUTPUT"
  | "BYPASS_COMPLIANCE_GATE"
  | "ACCESS_PROHIBITED_DATA"
  | "MODIFY_AUDIT_LOG"
  | "SEND_INVESTOR_EMAIL"
  | "POST_TO_WEBSITE"
  | "RELEASE_GUIDANCE";

export interface AgentPermissions {
  allowedTools: ToolName[];
  restrictedActions: RestrictedAction[];
  maxClassificationAccess: DataClassification;
  canGenerateExternal: boolean;   // can produce external-facing content (still needs approval)
  requiresApprovalBefore: RestrictedAction[];
}
