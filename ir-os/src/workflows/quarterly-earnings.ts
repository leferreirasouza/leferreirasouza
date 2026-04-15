import type { WorkflowStep, FiscalPeriod, UserId } from "../types";
import { WorkflowEngine } from "./engine";

/**
 * QUARTERLY EARNINGS WORKFLOW
 *
 * End-to-end state machine for the quarterly results cycle.
 * Steps alternate between agent tasks and mandatory human checkpoints.
 * No external publishing can occur until step 14 (Human: CFO Final Approval).
 *
 * Total steps: 18
 * Human checkpoints: 5 (steps 6, 10, 13, 14, 17)
 * Compliance gates: embedded in every agent step
 */

export function buildEarningsWorkflowSteps(
  period: FiscalPeriod
): Omit<WorkflowStep, "status" | "retryCount">[] {
  return [
    // ---- PHASE 1: KICKOFF ----
    {
      stepId: "EW-01-KICKOFF",
      stepName: "Earnings Cycle Kickoff",
      agentId: "earnings-cycle",
      input: { phase: "KICKOFF", period },
      notes: "Earnings Cycle Agent initializes timeline, tasks, and checklist.",
    },
    {
      stepId: "EW-02-CALENDAR-UPDATE",
      stepName: "Update Disclosure Calendar",
      agentId: "earnings-cycle",
      input: { phase: "KICKOFF", action: "UPDATE_CALENDAR" },
      notes: "Confirm earnings date, announce date, filing deadlines.",
    },
    {
      stepId: "EW-03-CONSENSUS-PULL",
      stepName: "Pull Pre-Earnings Consensus",
      agentId: "consensus-sellside",
      input: { action: "PRE_EARNINGS_SUMMARY", period },
      notes: "Snapshot Street estimates. Identify key metrics to monitor.",
    },

    // ---- PHASE 2: DATA COLLECTION ----
    {
      stepId: "EW-04-FINANCIALS",
      stepName: "Collect Preliminary Financials",
      agentId: "HUMAN",
      input: { instruction: "Upload preliminary closing financials from Finance/Accounting." },
      notes: "HUMAN CHECKPOINT: Finance team uploads preliminary P&L, BS, CF data.",
    },
    {
      stepId: "EW-05-VARIANCE",
      stepName: "Variance Analysis vs Consensus",
      agentId: "consensus-sellside",
      input: { action: "VARIANCE_ANALYSIS", period },
      notes: "Compare actuals vs. consensus. Flag beats/misses for narrative focus.",
    },

    // ---- PHASE 3: NARRATIVE DEVELOPMENT ----
    {
      stepId: "EW-06-NARRATIVE-BRIEF",
      stepName: "Management Narrative Brief",
      agentId: "HUMAN",
      input: { instruction: "Head of IR + CFO: provide management narrative and approved talking points." },
      notes: "HUMAN CHECKPOINT: Management provides strategic narrative, key messages, and approved guidance stance.",
    },
    {
      stepId: "EW-07-DRAFT-PRESS-RELEASE",
      stepName: "Draft Earnings Press Release",
      agentId: "disclosure-drafting",
      input: { artifactType: "PRESS_RELEASE", language: "BOTH" },
      notes: "Draft press release (PT + EN) using approved messaging + financials. Status = DRAFT.",
    },
    {
      stepId: "EW-08-DRAFT-SCRIPT",
      stepName: "Draft Earnings Call Script",
      agentId: "disclosure-drafting",
      input: { artifactType: "EARNINGS_SCRIPT", language: "BOTH" },
      notes: "Draft CEO + CFO prepared remarks. Status = DRAFT.",
    },
    {
      stepId: "EW-09-QA-PREP",
      stepName: "Q&A Preparation",
      agentId: "knowledge-librarian",
      input: { action: "QA_LOOKUP", context: "earnings_call" },
      notes: "Assemble anticipated Q&A from library + draft new responses for novel questions.",
    },

    // ---- PHASE 4: COMPLIANCE REVIEW ----
    {
      stepId: "EW-10-GATEKEEPER",
      stepName: "Compliance Gatekeeper Review",
      agentId: "disclosure-gatekeeper",
      input: { contentType: "PRESS_RELEASE", proposedClassification: "PUBLIC" },
      notes: "Gatekeeper reviews all drafts. Red flags must be resolved before proceeding.",
    },
    {
      stepId: "EW-11-LEGAL-REVIEW",
      stepName: "Legal Review",
      agentId: "HUMAN",
      input: { instruction: "Legal counsel: review drafts for compliance with CVM 358, Reg FD, and safe-harbor requirements." },
      notes: "HUMAN CHECKPOINT: Legal sign-off required. Resolve any CRITICAL red flags.",
    },
    {
      stepId: "EW-12-PEER-CONTEXT",
      stepName: "Peer Earnings Context",
      agentId: "market-intelligence",
      input: { action: "PEER_EARNINGS_MONITOR" },
      notes: "Review peer results for context and anticipated investor comparisons.",
    },

    // ---- PHASE 5: REHEARSAL ----
    {
      stepId: "EW-13-REHEARSAL",
      stepName: "Earnings Call Rehearsal",
      agentId: "HUMAN",
      input: { instruction: "IR + Management: complete earnings call rehearsal. Validate Q&A responses with legal-approved messaging." },
      notes: "HUMAN CHECKPOINT: Final Q&A validation. Confirm no unapproved guidance will be disclosed.",
    },

    // ---- PHASE 6: FINAL APPROVAL ----
    {
      stepId: "EW-14-CFO-APPROVAL",
      stepName: "CFO Final Approval",
      agentId: "HUMAN",
      input: { instruction: "CFO: approve final press release, filing, and earnings script for publication. This is the final human approval gate." },
      notes: "HUMAN CHECKPOINT (MANDATORY — CFO REQUIRED): No publishing until this step is COMPLETED with APPROVED decision.",
    },

    // ---- PHASE 7: PUBLICATION ----
    {
      stepId: "EW-15-PREPARE-FILING",
      stepName: "Prepare Regulatory Filing",
      agentId: "disclosure-drafting",
      input: { artifactType: "FATO_RELEVANTE" },
      notes: "Prepare Comunicado ao Mercado or Fato Relevante for CVM/B3 simultaneous with press release.",
    },
    {
      stepId: "EW-16-PUBLISH-GATE",
      stepName: "Publishing Gate Check",
      agentId: "disclosure-gatekeeper",
      input: { action: "PUBLISHING_READINESS_CHECK" },
      notes: "Final compliance check: approval records present, no blocking flags, all disclosures simultaneous.",
    },
    {
      stepId: "EW-17-PUBLISH",
      stepName: "Human: Execute Publication",
      agentId: "HUMAN",
      input: { instruction: "IR/Communications: execute simultaneous publication (press release + CVM filing + IR website + earnings call). No agent publishes autonomously." },
      notes: "HUMAN CHECKPOINT: Human executes publication across all channels simultaneously.",
    },

    // ---- PHASE 8: POST-EARNINGS ----
    {
      stepId: "EW-18-POST-EARNINGS",
      stepName: "Post-Earnings Wrap",
      agentId: "earnings-cycle",
      input: { phase: "POST_EARNINGS_WRAP", period },
      notes: "Capture analyst reactions, update consensus, schedule post-results NDR, update messaging library.",
    },
  ];
}

/**
 * Factory: create and register a quarterly earnings workflow instance.
 */
export async function createEarningsWorkflow(
  engine: WorkflowEngine,
  period: FiscalPeriod,
  initiatedBy: UserId,
  earningsDate: string
): Promise<string> {
  const steps = buildEarningsWorkflowSteps(period);
  const instance = await engine.create(
    "QUARTERLY_EARNINGS",
    initiatedBy,
    { period, earningsDate },
    steps,
    "HIGH",
    earningsDate
  );
  return instance.workflowId;
}
