// Shared types mirroring the backend TypeScript interfaces

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
  | "knowledge-librarian"
  | "valuation-strategy"
  | "news-intelligence"
  | "self-development";

export type DataClassification = "PUBLIC" | "INTERNAL_APPROVED" | "DRAFT_INTERNAL" | "PROHIBITED";
export type DraftStatus =
  | "DRAFT"
  | "PENDING_IR_REVIEW"
  | "PENDING_CFO_APPROVAL"
  | "PENDING_CEO_APPROVAL"
  | "PENDING_LEGAL_REVIEW"
  | "PENDING_BOARD_APPROVAL"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED";

export type WorkflowStatus =
  | "INITIATED"
  | "IN_PROGRESS"
  | "AWAITING_HUMAN_INPUT"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "COMPLETED"
  | "CANCELLED"
  | "FAILED";

export type Priority = "URGENT" | "HIGH" | "NORMAL" | "LOW";

export interface RedFlag {
  code: string;
  severity: "INFO" | "WARNING" | "CRITICAL" | "BLOCK";
  description: string;
  triggeredBy: string;
  suggestion?: string;
}

export interface ClassifiedContent {
  classification: DataClassification;
  draftStatus: DraftStatus;
  redFlags: RedFlag[];
  requiresHumanApproval: boolean;
  approvalLevel: string;
}

export interface AgentHandoff {
  toAgentId: AgentId;
  reason: string;
  priority: Priority;
}

export interface AgentResponse {
  requestId: string;
  agentId: AgentId;
  output: Record<string, unknown>;
  classification: ClassifiedContent;
  processingMs: number;
  completedAt: string;
  handoffs: AgentHandoff[];
  escalations: unknown[];
}

export interface AgentDefinition {
  agentId: AgentId;
  name: string;
  description: string;
  capabilities: string[];
  canGenerateExternal: boolean;
}

export interface WorkflowArtifact {
  artifactId: string;
  workflowId: string;
  stepId: string;
  artifactType: string;
  title: string;
  content: string;
  draftStatus: DraftStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdByAgentId: AgentId;
  approvedBy?: string;
  approvedAt?: string;
  redFlags: RedFlag[];
}

export interface ApprovalRecord {
  approvalId: string;
  workflowId: string;
  artifactId: string;
  requestedAt: string;
  requestedBy: string;
  requiredApproverRole: string;
  approvedBy?: string;
  approvedAt?: string;
  decision: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED_FOR_REVISION";
  comments?: string;
  version: number;
}

export interface WorkflowStep {
  stepId: string;
  name: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SKIPPED";
  startedAt?: string;
  completedAt?: string;
  agentId?: AgentId;
  notes?: string;
}

export interface WorkflowInstance {
  workflowId: string;
  workflowType: string;
  status: WorkflowStatus;
  initiatedBy: string;
  initiatedAt: string;
  updatedAt: string;
  completedAt?: string;
  currentStep: string;
  steps: WorkflowStep[];
  artifacts: WorkflowArtifact[];
  approvals: ApprovalRecord[];
  deadline?: string;
  priority: Priority;
}

export interface WorkflowSummary {
  workflowId: string;
  type: string;
  status: WorkflowStatus;
  currentStep: string;
  initiatedBy: string;
  initiatedAt: string;
  priority: Priority;
}

export interface Company {
  company_id: string;
  name: string;
  ticker: string;
  exchange: string;
  currency: string;
  fiscal_year_end: string;
  sector?: string;
  ir_website?: string;
  cvm_code?: string;
  description?: string;
}

export interface User {
  userId: string;
  name: string;
  email: string;
  role: string;
  defaultCompanyId: string;
  companies: { company_id: string; name: string; ticker: string }[];
}

export interface AuditEntry {
  entryId: string;
  timestamp: string;
  eventType: string;
  agentId?: AgentId;
  userId?: string;
  workflowId?: string;
  artifactId?: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface Document {
  doc_id: string;
  title: string;
  doc_type: string;
  source: string;
  period_label?: string;
  filed_at?: string;
  word_count?: number;
  language: string;
  source_url?: string;
  ingested_at: string;
}

export interface KBStats {
  companyId: string;
  totalDocs: number;
  totalWords: number;
}
