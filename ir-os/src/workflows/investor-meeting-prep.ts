import type { WorkflowStep, UserId } from "../types";
import { WorkflowEngine } from "./engine";

/**
 * INVESTOR MEETING PREP WORKFLOW
 *
 * Prepares tailored briefs for investor/analyst one-on-ones, NDRs, and conferences.
 * Captures post-meeting feedback and routes CRM updates.
 *
 * Total steps: 8
 * Human checkpoints: 2 (steps 4, 8)
 * All output is INTERNAL_ADVISORY
 */

export function buildMeetingPrepWorkflowSteps(
  meetingId: string,
  investorIds: string[],
  meetingDate: string
): Omit<WorkflowStep, "status" | "retryCount">[] {
  return [
    // ---- STEP 1: CRM LOOKUP ----
    {
      stepId: "MP-01-CRM",
      stepName: "CRM & Investor Research",
      agentId: "investor-targeting",
      input: {
        action: "ENGAGEMENT_SCORE",
        investorIds,
      },
      notes: "Pull CRM history, engagement score, prior interaction notes, current position estimate.",
    },

    // ---- STEP 2: PERCEPTION HISTORY ----
    {
      stepId: "MP-02-PERCEPTION",
      stepName: "Perception History",
      agentId: "perception",
      input: {
        action: "THESIS_MAP",
        investorIds,
      },
      notes: "Retrieve perception tags and thesis history for each investor.",
    },

    // ---- STEP 3: MARKET CONTEXT ----
    {
      stepId: "MP-03-MARKET",
      stepName: "Market & Peer Context",
      agentId: "market-intelligence",
      input: {
        action: "SECTOR_SNAPSHOT",
      },
      notes: "Retrieve current sector context and peer developments relevant to meeting.",
    },

    // ---- STEP 4: BRIEF ASSEMBLY ----
    {
      stepId: "MP-04-BRIEF",
      stepName: "Assemble Meeting Brief",
      agentId: "meeting-prep",
      input: {
        action: "PREPARE_BRIEF",
        meetingId,
        meetingDate,
        investorIds,
      },
      notes: "Meeting Prep Agent assembles full brief: investor summaries, key messages, anticipated Q&A, do-not-discuss list.",
    },

    // ---- STEP 5: COMPLIANCE CHECK ----
    {
      stepId: "MP-05-COMPLIANCE",
      stepName: "Compliance Pre-Meeting Check",
      agentId: "disclosure-gatekeeper",
      input: {
        contentType: "INVESTOR_BRIEF",
        proposedClassification: "INTERNAL_APPROVED",
        context: "Pre-meeting brief — internal advisory only.",
      },
      notes: "Gatekeeper confirms no selective disclosure risk in the proposed messaging.",
    },

    // ---- STEP 6: HUMAN REVIEW ----
    {
      stepId: "MP-06-REVIEW",
      stepName: "Human: IR Manager Review",
      agentId: "HUMAN",
      input: {
        instruction: `IR Manager: review the meeting brief.
VERIFY:
- No unapproved talking points
- No sensitive topics listed as discussable
- Q&A responses are from approved library or flagged for review
- Do-not-discuss list is complete
- Trading window status confirmed open`,
      },
      notes: "HUMAN CHECKPOINT (IR Manager required): brief approved for use in meeting.",
    },

    // ---- STEP 7: POST-MEETING (deferred until after meeting) ----
    {
      stepId: "MP-07-POST-MEETING",
      stepName: "Post-Meeting Feedback Capture",
      agentId: "meeting-prep",
      input: {
        action: "CAPTURE_FEEDBACK",
        meetingId,
      },
      notes: "IR team provides meeting notes → Meeting Prep Agent structures feedback, tags themes, identifies CRM updates.",
    },

    // ---- STEP 8: CRM UPDATE ----
    {
      stepId: "MP-08-CRM-UPDATE",
      stepName: "Human: Approve CRM Updates",
      agentId: "HUMAN",
      input: {
        instruction: `IR Manager: review and confirm proposed CRM updates from meeting feedback.
This includes: new perception tags, updated position notes, follow-up commitments.
Flag any commitment that requires compliance or legal review.`,
      },
      notes: "HUMAN CHECKPOINT: IR Manager confirms CRM updates before they are written.",
    },
  ];
}

export async function createMeetingPrepWorkflow(
  engine: WorkflowEngine,
  meetingId: string,
  investorIds: string[],
  meetingDate: string,
  initiatedBy: UserId
): Promise<string> {
  const steps = buildMeetingPrepWorkflowSteps(meetingId, investorIds, meetingDate);
  const instance = await engine.create(
    "INVESTOR_MEETING_PREP",
    initiatedBy,
    { meetingId, investorIds, meetingDate },
    steps,
    "NORMAL",
    meetingDate
  );
  return instance.workflowId;
}
