/**
 * SHARED DATA MODEL
 *
 * All domain entities used across agents and workflows.
 * Each record includes classification, provenance, and version metadata.
 */

import type { DataClassification, DraftStatus } from "./data-classification";
import type { UserId, FiscalPeriod } from "./agents";

// ================================================================
// 1. DISCLOSURE CALENDAR
// ================================================================

export interface DisclosureCalendarEntry {
  entryId: string;
  title: string;
  disclosureType: DisclosureType;
  dueDate: string;              // ISO 8601
  regulatoryBody: "CVM" | "SEC" | "B3" | "NYSE" | "INTERNAL";
  filingForm?: string;          // e.g. "ITR", "DFP", "6-K", "20-F", "8-K"
  status: "UPCOMING" | "IN_PREPARATION" | "FILED" | "OVERDUE" | "WAIVED";
  ownerUserId: UserId;
  linkedWorkflowId?: string;
  notes?: string;
  isRecurring: boolean;
  recurrenceRule?: string;      // cron-like rule
  alertDaysBefore: number[];    // e.g. [30, 15, 7, 1]
  createdAt: string;
  updatedAt: string;
}

export type DisclosureType =
  | "EARNINGS_RELEASE"
  | "MATERIAL_FACT"             // Fato Relevante (CVM Instrução 358)
  | "ANNUAL_REPORT"             // DFP / 20-F
  | "QUARTERLY_REPORT"          // ITR / 6-K
  | "REFERENCE_FORM"            // Formulário de Referência
  | "PROXY_CIRCULAR"            // Edital de Convocação AGO/AGE
  | "SHAREHOLDER_NOTICE"
  | "INSIDER_TRADING_WINDOW"
  | "LOCK_UP_EXPIRY"
  | "DIVIDEND_ANNOUNCEMENT"
  | "CAPITAL_INCREASE"
  | "SHARE_BUYBACK_PROGRAM"
  | "MATERIAL_AGREEMENT"
  | "MANAGEMENT_CHANGE"
  | "OTHER";

// ================================================================
// 2. FILING LIBRARY
// ================================================================

export interface FilingRecord {
  filingId: string;
  ticker: string;
  filingType: string;           // e.g. "DFP", "ITR", "20-F", "6-K"
  period: FiscalPeriod;
  filedAt: string;              // ISO 8601
  regulatoryBody: string;
  filingUrl: string;
  localPath?: string;           // path to downloaded PDF/XML
  textContent?: string;         // extracted plain text
  classification: DataClassification;
  language: "PT" | "EN" | "BOTH";
  tags: string[];
  linkedArtifacts: string[];    // artifactId references
  createdAt: string;
}

// ================================================================
// 3. EARNINGS PACKAGE
// ================================================================

export interface EarningsPackage {
  packageId: string;
  period: FiscalPeriod;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: UserId;

  // Core financials (structured)
  financials: EarningsFinancials;

  // Narrative artifacts
  pressRelease?: string;        // artifactId
  earningsScript?: string;      // artifactId
  presentation?: string;        // artifactId
  qaLibrarySnapshot?: string;   // artifactId

  // Guidance (highly restricted)
  guidance?: EarningsGuidance;

  // Red flags raised during preparation
  complianceChecksPassed: boolean;
  redFlagIds: string[];
}

export interface EarningsFinancials {
  revenue: FinancialLine;
  ebitda: FinancialLine;
  ebit: FinancialLine;
  netIncome: FinancialLine;
  netDebt: FinancialLine;
  capex: FinancialLine;
  fcf: FinancialLine;           // Free Cash Flow
  eps: FinancialLine;
  currency: "BRL" | "USD";
  reportingStandard: "IFRS" | "BR-GAAP" | "US-GAAP";
  auditStatus: "UNAUDITED" | "REVIEWED" | "AUDITED";
  customLines: FinancialLine[];
}

export interface FinancialLine {
  label: string;
  value: number;
  unit: string;                 // e.g. "BRL_MM", "USD_MM"
  yoyChangePercent?: number;
  qoqChangePercent?: number;
  vsConsensus?: number;         // % variance
  vsGuidance?: number;          // % variance
  notes?: string;
}

export interface EarningsGuidance {
  guidanceId: string;
  metric: string;
  lowEnd?: number;
  midPoint?: number;
  highEnd?: number;
  unit: string;
  year: number;
  isNewGuidance: boolean;
  priorGuidance?: Omit<EarningsGuidance, "guidanceId" | "isNewGuidance" | "priorGuidance">;
  approvalRequired: true;       // always true
  approvedBy?: UserId;
  approvedAt?: string;
  classifiedAs: "PROHIBITED";   // guidance is always PROHIBITED until approved
}

// ================================================================
// 4. INVESTOR CRM
// ================================================================

export interface InvestorRecord {
  investorId: string;
  name: string;
  firmName: string;
  firmType: InvestorType;
  contactEmail?: string;        // PII — handle carefully
  contactPhone?: string;        // PII
  geography: string;            // e.g. "Brazil", "US", "Europe"
  aum_usd_bn?: number;          // approximate AUM
  estimatedPosition?: PositionRecord;
  coverageAnalyst?: string;     // linked AnalystRecord
  lastMeetingDate?: string;
  nextScheduledMeeting?: string;
  engagementScore: number;      // 0-100, internal metric
  tags: string[];
  notes: CRMNote[];
  perceptionTags: PerceptionTag[];
  classification: "INTERNAL_APPROVED";  // CRM data never public
  createdAt: string;
  updatedAt: string;
}

export type InvestorType =
  | "LONG_ONLY"
  | "HEDGE_FUND"
  | "INDEX_FUND"
  | "SOVEREIGN_WEALTH"
  | "PENSION_FUND"
  | "RETAIL"
  | "FAMILY_OFFICE"
  | "PRIVATE_BANK"
  | "ACTIVIST"
  | "EVENT_DRIVEN"
  | "QUANTITATIVE"
  | "ESG_FOCUSED";

export interface PositionRecord {
  shares: number;
  percentFloat?: number;
  estimatedValue_usd?: number;
  changeQoQ?: "INCREASED" | "DECREASED" | "FLAT" | "NEW" | "EXITED";
  source: "CUSTODY_DATA" | "13F" | "ESTIMATED";
  asOf: string;
}

export interface CRMNote {
  noteId: string;
  content: string;
  createdBy: UserId;
  createdAt: string;
  classification: "INTERNAL_APPROVED";
  meetingId?: string;
  sentiment?: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";
}

export interface PerceptionTag {
  tagId: string;
  category: PerceptionCategory;
  label: string;
  value?: string;
  recordedAt: string;
}

export type PerceptionCategory =
  | "THESIS"             // how investor frames the investment thesis
  | "CONCERN"            // key concern raised
  | "POSITIVE_VIEW"
  | "GOVERNANCE"
  | "VALUATION_APPROACH"
  | "ESG_FOCUS"
  | "CATALYST_WATCH"
  | "EXIT_RISK"
  | "QUESTION_THEME";

// ================================================================
// 5. ANALYST MODELS / CONSENSUS
// ================================================================

export interface AnalystRecord {
  analystId: string;
  name: string;
  firmName: string;
  email?: string;
  coverage: string[];           // tickers covered
  lastReportDate?: string;
  recommendation: "BUY" | "OUTPERFORM" | "NEUTRAL" | "UNDERPERFORM" | "SELL" | "N/R";
  priceTarget?: number;
  currency?: string;
  targetPeriod?: string;        // e.g. "12M"
  lastUpdated: string;
}

export interface ConsensusRecord {
  consensusId: string;
  ticker: string;
  period: FiscalPeriod;
  metric: string;
  mean: number;
  median?: number;
  high?: number;
  low?: number;
  stdDev?: number;
  contributorCount: number;
  currency: string;
  unit: string;
  source: string;               // e.g. "Bloomberg", "Refinitiv", "LSEG"
  asOf: string;
  varianceVsActual?: number;    // populated after results
}

// ================================================================
// 6. PEER MONITORING
// ================================================================

export interface PeerRecord {
  peerId: string;
  ticker: string;
  companyName: string;
  sector: string;
  exchange: string;
  lastEarningsDate?: string;
  nextEarningsDate?: string;
  latestFilings: FilingRecord[];
  keyMetrics: Record<string, number>;
  tags: string[];
  monitoringActive: boolean;
  updatedAt: string;
}

// ================================================================
// 7. APPROVED MESSAGING LIBRARY
// ================================================================

export interface MessageRecord {
  messageId: string;
  topic: string;
  category: MessageCategory;
  headline: string;
  bodyText: string;
  language: "PT" | "EN" | "BOTH";
  approvedBy: UserId;
  approvedAt: string;
  validUntil?: string;
  useInContext: string[];        // e.g. ["earnings_call", "one_on_one", "roadshow"]
  sources: string[];             // sourceId references
  version: number;
  supersededBy?: string;         // messageId
  classification: "INTERNAL_APPROVED";
}

export type MessageCategory =
  | "STRATEGIC_NARRATIVE"
  | "FINANCIAL_PERFORMANCE"
  | "GUIDANCE_DISCLOSURE"
  | "CAPITAL_ALLOCATION"
  | "ESG"
  | "GOVERNANCE"
  | "M_AND_A"
  | "MARKET_CONTEXT"
  | "RISK_FACTOR"
  | "DISCLAIMER";

// ================================================================
// 8. Q&A LIBRARY
// ================================================================

export interface QARecord {
  qaId: string;
  question: string;
  answer: string;
  context: string;              // when/where answer is appropriate
  category: string;
  approvedBy: UserId;
  approvedAt: string;
  validUntil?: string;
  language: "PT" | "EN" | "BOTH";
  sensitivityLevel: "LOW" | "MEDIUM" | "HIGH";
  doNotUseBeyond?: string;      // date
  linkedToTopic?: string;
  version: number;
  classification: "INTERNAL_APPROVED";
}

// ================================================================
// 9. MEETING RECORDS
// ================================================================

export interface MeetingRecord {
  meetingId: string;
  date: string;
  duration_min?: number;
  format: "PHONE" | "VIDEO" | "IN_PERSON" | "CONFERENCE" | "NDR";
  investorIds: string[];
  analystIds: string[];
  irAttendeesIds: UserId[];
  managementAttendeesIds: UserId[];
  subject: string;
  prepBriefId?: string;         // artifactId
  notesId?: string;             // artifactId
  feedbackTags: PerceptionTag[];
  topicsDiscussed: string[];
  questionsAsked: string[];
  commitmentsMade: string[];
  followUpRequired: boolean;
  followUpNotes?: string;
  classification: "INTERNAL_APPROVED";
  createdAt: string;
  updatedAt: string;
}

// ================================================================
// 10. APPROVAL LOG (APPEND-ONLY)
// ================================================================

export interface ApprovalLogEntry {
  logId: string;
  timestamp: string;
  artifactId: string;
  artifactVersion: number;
  workflowId: string;
  requestedBy: UserId;
  decidedBy?: UserId;
  requiredRole: string;
  decision: "APPROVED" | "REJECTED" | "RETURNED";
  comments?: string;
  immutableHash: string;        // SHA-256 of this entry
}

// ================================================================
// 11. EVENT / ISSUE TRACKER
// ================================================================

export interface EventRecord {
  eventId: string;
  title: string;
  eventType: EventType;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "MONITORING" | "CLOSED";
  detectedAt: string;
  resolvedAt?: string;
  description: string;
  linkedWorkflowIds: string[];
  linkedArtifactIds: string[];
  assignedTo: UserId[];
  escalatedTo?: string[];
  publicStatement?: string;     // if response was issued
  timeline: EventTimelineEntry[];
  classification: DataClassification;
}

export type EventType =
  | "REGULATORY_INQUIRY"
  | "MARKET_RUMOR"
  | "MATERIAL_EVENT_EMERGING"
  | "ACTIVIST_APPROACH"
  | "CREDIT_RATING_CHANGE"
  | "MARKET_DISLOCATION"
  | "MEDIA_INQUIRY"
  | "ANALYST_DOWNGRADE"
  | "LITIGATION"
  | "GOVERNANCE_INCIDENT"
  | "EARNINGS_SURPRISE"
  | "GUIDANCE_REVISION";

export interface EventTimelineEntry {
  entryId: string;
  timestamp: string;
  action: string;
  actorId: UserId | "SYSTEM";
  notes?: string;
}
