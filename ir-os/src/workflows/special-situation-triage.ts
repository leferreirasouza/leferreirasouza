import type { WorkflowStep, UserId, EventType } from "../types";
import { WorkflowEngine } from "./engine";

/**
 * SPECIAL SITUATION TRIAGE WORKFLOW
 *
 * Rapid response for material events, rumors, activist approaches,
 * litigation, credit events, and crises.
 *
 * Total steps: 8
 * Human checkpoints: 3 (steps 2, 5, 7)
 * Target elapsed time: < 2 hours from detection to internal decision
 */
export function buildSpecialSituationSteps(
  situation: string,
  eventType: EventType
): Omit<WorkflowStep, "status" | "retryCount">[] {
  return [
    {
      stepId: "SS-01-TRIAGE",
      stepName: "Special Situations Triage",
      agentId: "special-situations",
      input: { situation, eventType, severity: "CRITICAL", detectedAt: new Date().toISOString(), sourceOfAlert: "IR_TEAM" },
      notes: "Immediate assessment: materiality, disclosure obligation, time to file.",
    },
    {
      stepId: "SS-02-HUMAN-MATERIALITY",
      stepName: "Human: Materiality Decision",
      agentId: "HUMAN",
      input: { instruction: "CFO + Legal: is this event material under CVM 358? YES → continue. NO → document rationale and close workflow." },
      notes: "HUMAN CHECKPOINT (CFO + Legal): materiality decision is immutably logged.",
    },
    {
      stepId: "SS-03-PRECEDENTS",
      stepName: "Retrieve Precedents",
      agentId: "knowledge-librarian",
      input: { action: "SEARCH_PRECEDENTS", query: `special situation ${eventType}` },
      notes: "Find comparable prior disclosures and response patterns.",
    },
    {
      stepId: "SS-04-DRAFT-RESPONSE",
      stepName: "Draft Response Options",
      agentId: "special-situations",
      input: { situation, eventType, severity: "CRITICAL", detectedAt: new Date().toISOString(), sourceOfAlert: "WORKFLOW" },
      notes: "Produce structural outline and response options. NOT final text.",
    },
    {
      stepId: "SS-05-LEGAL-REVIEW",
      stepName: "Human: Legal Review",
      agentId: "HUMAN",
      input: { instruction: "Legal Counsel: review triage, response options, and draft outline. Confirm regulatory obligations and approve approach." },
      notes: "HUMAN CHECKPOINT (Legal required): select response approach.",
    },
    {
      stepId: "SS-06-DRAFT-STATEMENT",
      stepName: "Draft Disclosure Statement",
      agentId: "disclosure-drafting",
      input: { artifactType: "FATO_RELEVANTE", language: "PT", instructions: `Draft Fato Relevante for: ${situation}` },
      notes: "Disclosure Drafting Agent produces draft statement. Status = DRAFT.",
    },
    {
      stepId: "SS-07-CFO-CEO-APPROVAL",
      stepName: "Human: CFO/CEO Final Approval",
      agentId: "HUMAN",
      input: { instruction: "CFO and/or CEO: review and approve final Fato Relevante text before filing." },
      notes: "HUMAN CHECKPOINT (CFO required, CEO if critical): final approval gate.",
    },
    {
      stepId: "SS-08-FILE",
      stepName: "Human: Execute Filing",
      agentId: "HUMAN",
      input: { instruction: "IR / Compliance: file Fato Relevante via CVM ENET + B3 + IR website simultaneously. Record CVM protocol number." },
      notes: "HUMAN CHECKPOINT: manual filing execution.",
    },
  ];
}

export async function createSpecialSituationWorkflow(
  engine: WorkflowEngine,
  situation: string,
  eventType: EventType,
  initiatedBy: UserId
): Promise<string> {
  const steps = buildSpecialSituationSteps(situation, eventType);
  const instance = await engine.create(
    "SPECIAL_SITUATION_TRIAGE",
    initiatedBy,
    { situation, eventType },
    steps,
    "URGENT",
    new Date(Date.now() + 2 * 3600 * 1000).toISOString()
  );
  return instance.workflowId;
}
