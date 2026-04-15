import type { WorkflowStep, UserId } from "../types";
import { WorkflowEngine } from "./engine";

/**
 * BOARD BRIEFING PACK WORKFLOW
 *
 * Monthly/quarterly generation of a structured IR briefing pack for the Board.
 *
 * Total steps: 5
 * Human checkpoints: 2 (steps 4, 5)
 */
export function buildBoardBriefingSteps(
  periodLabel: string
): Omit<WorkflowStep, "status" | "retryCount">[] {
  return [
    {
      stepId: "BB-01-MARKET",
      stepName: "Market & Peer Context",
      agentId: "market-intelligence",
      input: { action: "SECTOR_SNAPSHOT" },
      notes: "Gather sector-level market context and peer performance summary.",
    },
    {
      stepId: "BB-02-CONSENSUS",
      stepName: "Consensus & Analyst Activity",
      agentId: "consensus-sellside",
      input: { action: "ANALYST_CHANGE_ALERT", period: { label: periodLabel } },
      notes: "Summarize recent analyst activity: upgrades, downgrades, estimate changes.",
    },
    {
      stepId: "BB-03-PERCEPTION",
      stepName: "Investor Perception Summary",
      agentId: "perception",
      input: { action: "PERCEPTION_REPORT", periodFrom: "T-90d" },
      notes: "Synthesize investor feedback themes from the last quarter.",
    },
    {
      stepId: "BB-04-ASSEMBLY",
      stepName: "Assemble Board Pack",
      agentId: "knowledge-librarian",
      input: {
        action: "BOARD_PACK_ASSEMBLY",
        query: `board briefing ${periodLabel}`,
      },
      notes: "Knowledge Librarian assembles structured board pack from all sections. Status = DRAFT.",
    },
    {
      stepId: "BB-05-HEAD-OF-IR-REVIEW",
      stepName: "Human: Head of IR Review",
      agentId: "HUMAN",
      input: { instruction: "Head of IR: review board pack draft for accuracy, completeness, and tone before distributing to the Board." },
      notes: "HUMAN CHECKPOINT: Head of IR approves before board distribution.",
    },
  ];
}

export async function createBoardBriefingWorkflow(
  engine: WorkflowEngine,
  periodLabel: string,
  initiatedBy: UserId
): Promise<string> {
  const steps = buildBoardBriefingSteps(periodLabel);
  const instance = await engine.create(
    "BOARD_BRIEFING",
    initiatedBy,
    { periodLabel },
    steps,
    "NORMAL"
  );
  return instance.workflowId;
}
