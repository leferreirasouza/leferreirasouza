import type { AgentId, UserId, EscalationRequest } from "./agents";
import type { DraftStatus, RedFlag } from "./data-classification";

// ----------------------------------------------------------------
// WORKFLOW STATE MACHINE
// ----------------------------------------------------------------

export type WorkflowId = string; // UUID

export type WorkflowType =
  | "QUARTERLY_EARNINGS"
  | "MATERIAL_FACT"
  | "INVESTOR_MEETING_PREP"
  | "POST_MEETING_FEEDBACK"
  | "PEER_MONITORING"
  | "CONSENSUS_TRACKING"
  | "WEBSITE_PUBLISHING"
  | "SPECIAL_SITUATION_TRIAGE"
  | "AGM_SUPPORT"
  | "BOARD_BRIEFING";

export type WorkflowStatus =
  | "INITIATED"
  | "IN_PROGRESS"
  | "AWAITING_HUMAN_INPUT"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "CANCELLED"
  | "ESCALATED"
  | "BLOCKED_BY_COMPLIANCE";

export interface WorkflowInstance {
  workflowId: WorkflowId;
  workflowType: WorkflowType;
  status: WorkflowStatus;
  initiatedBy: UserId;
  initiatedAt: string;           // ISO 8601
  updatedAt: string;
  completedAt?: string;
  currentStep: string;
  steps: WorkflowStep[];
  context: Record<string, unknown>;
  artifacts: WorkflowArtifact[];
  approvals: ApprovalRecord[];
  escalations: EscalationRequest[];
  auditEntries: AuditEntry[];
  deadline?: string;             // ISO 8601
  priority: "URGENT" | "HIGH" | "NORMAL" | "LOW";
}

export interface WorkflowStep {
  stepId: string;
  stepName: string;
  agentId: AgentId | "HUMAN";
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
  input?: unknown;
  output?: unknown;
  durationMs?: number;
  retryCount: number;
  notes?: string;
}

export type StepStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "SKIPPED"
  | "AWAITING_HUMAN";

export interface WorkflowArtifact {
  artifactId: string;
  workflowId: WorkflowId;
  stepId: string;
  artifactType: ArtifactType;
  title: string;
  content: string;              // raw text or JSON stringified
  draftStatus: DraftStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdByAgentId: AgentId;
  approvedBy?: UserId;
  approvedAt?: string;
  redFlags: RedFlag[];
  sources: string[];            // sourceId references
}

export type ArtifactType =
  | "PRESS_RELEASE"
  | "FATO_RELEVANTE"              // Material fact (CVM)
  | "FORMULARIO_DE_REFERENCIA"    // Reference Form (CVM)
  | "EARNINGS_SCRIPT"
  | "EARNINGS_PRESENTATION"
  | "INVESTOR_BRIEF"
  | "MEETING_NOTES"
  | "BOARD_BRIEFING_PACK"
  | "CONSENSUS_SUMMARY"
  | "PEER_ANALYSIS"
  | "PERCEPTION_REPORT"
  | "VALUATION_SUMMARY"
  | "WEBSITE_CONTENT"
  | "AGM_CIRCULAR"
  | "PROXY_STATEMENT"
  | "SPECIAL_SITUATION_BRIEF"
  | "QA_RESPONSE"
  | "INTERNAL_MEMO"
  | "AUDIT_EXPORT";

// ----------------------------------------------------------------
// APPROVAL RECORDS
// ----------------------------------------------------------------

export interface ApprovalRecord {
  approvalId: string;
  workflowId: WorkflowId;
  artifactId: string;
  requestedAt: string;
  requestedBy: UserId;
  requiredApproverRole: string;
  approvedBy?: UserId;
  approvedAt?: string;
  decision: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION";
  comments?: string;
  version: number;              // which version was reviewed
}

// ----------------------------------------------------------------
// AUDIT LOG ENTRY (IMMUTABLE)
// ----------------------------------------------------------------

export interface AuditEntry {
  auditId: string;              // UUID, never reused
  timestamp: string;            // ISO 8601 with milliseconds
  eventType: AuditEventType;
  workflowId?: WorkflowId;
  artifactId?: string;
  agentId?: AgentId;
  userId?: UserId;
  action: string;               // human-readable description
  before?: unknown;             // state before change (null for creates)
  after?: unknown;              // state after change (null for deletes)
  ipAddress?: string;
  sessionId?: string;
  traceId: string;
  immutableHash?: string;       // SHA-256 of entry for tamper detection
}

export type AuditEventType =
  | "WORKFLOW_CREATED"
  | "WORKFLOW_STATUS_CHANGED"
  | "STEP_STARTED"
  | "STEP_COMPLETED"
  | "STEP_FAILED"
  | "ARTIFACT_CREATED"
  | "ARTIFACT_UPDATED"
  | "ARTIFACT_APPROVED"
  | "ARTIFACT_REJECTED"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_GRANTED"
  | "APPROVAL_DENIED"
  | "ESCALATION_TRIGGERED"
  | "ESCALATION_RESOLVED"
  | "COMPLIANCE_CHECK_PASSED"
  | "COMPLIANCE_CHECK_FAILED"
  | "RED_FLAG_RAISED"
  | "RED_FLAG_CLEARED"
  | "HUMAN_INPUT_RECEIVED"
  | "AGENT_CALLED"
  | "AGENT_RESPONDED"
  | "PUBLISHING_BLOCKED"
  | "PUBLISHING_APPROVED"
  | "EXTERNAL_SYSTEM_CALLED"
  | "DATA_CLASSIFIED"
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "PERMISSION_CHANGED";
