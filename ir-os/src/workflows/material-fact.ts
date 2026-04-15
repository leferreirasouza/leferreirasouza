import type { WorkflowStep, UserId } from "../types";
import { WorkflowEngine } from "./engine";

/**
 * MATERIAL FACT (FATO RELEVANTE) WORKFLOW
 *
 * Emergency disclosure workflow for material events.
 * Time-critical: CVM requires disclosure on the same day or before market open.
 *
 * Total steps: 10
 * Human checkpoints: 4 (steps 2, 6, 8, 9)
 * Maximum elapsed time target: 2-3 hours from event detection to filing
 *
 * Regulatory basis: CVM Instrução 358/2002 Art. 3-4
 */

export function buildMaterialFactWorkflowSteps(
  eventDescription: string,
  eventType: string
): Omit<WorkflowStep, "status" | "retryCount">[] {
  return [
    // ---- STEP 1: TRIAGE ----
    {
      stepId: "MF-01-TRIAGE",
      stepName: "Special Situations Triage",
      agentId: "special-situations",
      input: {
        situation: eventDescription,
        eventType,
        severity: "CRITICAL",
        detectedAt: new Date().toISOString(),
        sourceOfAlert: "IR_TEAM",
      },
      notes: "Immediate triage: determine if event is material, estimate disclosure obligation timeline.",
    },

    // ---- STEP 2: HUMAN MATERIALITY DECISION ----
    {
      stepId: "MF-02-MATERIALITY",
      stepName: "Human: Materiality Assessment",
      agentId: "HUMAN",
      input: {
        instruction: `CFO / Legal Counsel: review the triage output.
DECIDE: Is this event material under CVM Instrução 358 Art. 2?
YES → proceed to drafting. NO → document rationale and close.
DO NOT communicate this event to any individual investor before filing.`,
      },
      notes: "HUMAN CHECKPOINT (CFO + Legal required): materiality decision. This decision is logged and immutable.",
    },

    // ---- STEP 3: KNOWLEDGE RETRIEVAL ----
    {
      stepId: "MF-03-PRECEDENTS",
      stepName: "Retrieve Precedents",
      agentId: "knowledge-librarian",
      input: {
        action: "SEARCH_PRECEDENTS",
        query: `material fact ${eventType}`,
        documentType: "FATO_RELEVANTE",
      },
      notes: "Knowledge Librarian retrieves comparable prior Fatos Relevantes for drafting reference.",
    },

    // ---- STEP 4: DRAFT ----
    {
      stepId: "MF-04-DRAFT",
      stepName: "Draft Fato Relevante",
      agentId: "disclosure-drafting",
      input: {
        artifactType: "FATO_RELEVANTE",
        language: "PT",
        instructions: `Draft a Fato Relevante for: ${eventDescription}.
Follow CVM Instrução 358 format exactly.
State only confirmed facts. No speculation. No guidance.
Include: company name, ticker, date, event description, who decided to disclose, signature block.`,
      },
      notes: "Disclosure Drafting Agent produces draft Fato Relevante. Status = DRAFT.",
    },

    // ---- STEP 5: GATEKEEPER ----
    {
      stepId: "MF-05-GATEKEEPER",
      stepName: "Compliance Gatekeeper Review",
      agentId: "disclosure-gatekeeper",
      input: {
        contentType: "FATO_RELEVANTE",
        proposedClassification: "PUBLIC",
        context: `Urgency: CRITICAL. Event: ${eventType}`,
      },
      notes: "Gatekeeper performs FULL compliance review. Any BLOCK-level flags halt the workflow immediately.",
    },

    // ---- STEP 6: LEGAL REVIEW ----
    {
      stepId: "MF-06-LEGAL",
      stepName: "Human: Legal Review",
      agentId: "HUMAN",
      input: {
        instruction: `Legal Counsel: review the draft Fato Relevante and gatekeeper output.
CHECK:
- Factual accuracy
- No MNPI beyond the disclosed event
- CVM 358 format compliance
- Signature and date correct
- Adequate but not excessive disclosure
DECISION: approve for CFO sign-off OR return for revision.`,
      },
      notes: "HUMAN CHECKPOINT (Legal required): legal review. Document all requested revisions.",
    },

    // ---- STEP 7: ENGLISH VERSION (for dual-listed) ----
    {
      stepId: "MF-07-ENGLISH",
      stepName: "Draft English Version (6-K / 8-K)",
      agentId: "disclosure-drafting",
      input: {
        artifactType: "FATO_RELEVANTE",
        language: "EN",
        instructions: "Translate and adapt for SEC Form 6-K / 8-K if company is dual-listed.",
      },
      notes: "Conditionally executed for dual-listed companies. SEC Form 6-K or 8-K as applicable.",
    },

    // ---- STEP 8: CFO APPROVAL ----
    {
      stepId: "MF-08-CFO",
      stepName: "Human: CFO Approval",
      agentId: "HUMAN",
      input: {
        instruction: `CFO: review and approve the final Fato Relevante text.
This is the PENULTIMATE human approval gate.
Your approval certifies: content is accurate, complete, and compliant with CVM 358.
After approval, filing will be initiated immediately.`,
      },
      notes: "HUMAN CHECKPOINT (CFO required): final approval before filing.",
    },

    // ---- STEP 9: FILING EXECUTION ----
    {
      stepId: "MF-09-FILE",
      stepName: "Human: Execute Filing",
      agentId: "HUMAN",
      input: {
        instruction: `IR / Compliance Officer: FILE the approved Fato Relevante via:
1. CVM electronic system (ENET)
2. B3 electronic filing
3. IR website (simultaneous upload)
4. Major newspapers (if applicable)
NO agent files autonomously. You must execute this step manually.
Record the CVM protocol number in this step's output.`,
      },
      notes: "HUMAN CHECKPOINT: physical filing execution. Record CVM protocol number.",
    },

    // ---- STEP 10: POST-FILING ----
    {
      stepId: "MF-10-POST",
      stepName: "Post-Filing: Update Records",
      agentId: "chief-of-staff",
      input: {
        requestType: "STATUS_INQUIRY",
        taskDescription: "Update disclosure calendar, filing library, and event tracker with completed Fato Relevante.",
      },
      notes: "Update all records. Trigger investor meeting prep for post-announcement investor dialogue.",
    },
  ];
}

export async function createMaterialFactWorkflow(
  engine: WorkflowEngine,
  eventDescription: string,
  eventType: string,
  initiatedBy: UserId,
  deadline: string
): Promise<string> {
  const steps = buildMaterialFactWorkflowSteps(eventDescription, eventType);
  const instance = await engine.create(
    "MATERIAL_FACT",
    initiatedBy,
    { eventDescription, eventType },
    steps,
    "URGENT",
    deadline
  );
  return instance.workflowId;
}
