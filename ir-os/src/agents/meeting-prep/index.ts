import type {
  AgentId,
  AgentRequest,
  AgentContext,
  AgentPermissions,
  InvestorRecord,
  MeetingRecord,
} from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { MEETING_PREP_SYSTEM_PROMPT } from "./prompts";

export interface MeetingPrepInput {
  action: "PREPARE_BRIEF" | "CAPTURE_FEEDBACK" | "GENERATE_FOLLOW_UP";
  meeting: Partial<MeetingRecord>;
  investorProfiles?: Partial<InvestorRecord>[];
  recentFilings?: string[];          // filingIds
  approvedMessagingIds?: string[];
  anticipatedQuestions?: string[];
  postMeetingNotes?: string;         // for CAPTURE_FEEDBACK
}

export interface MeetingPrepOutput {
  action: string;
  meetingBrief?: MeetingBrief;
  feedbackCapture?: FeedbackCapture;
  followUpActions?: FollowUpAction[];
  draftStatus: "DRAFT";
  internalUseOnly: true;
}

export interface MeetingBrief {
  meetingId: string;
  investorSummaries: InvestorSummary[];
  keyMessagingPoints: string[];      // from approved messaging only
  anticipatedQuestions: QAPrep[];
  doNotDiscuss: string[];            // compliance-flagged topics
  backgroundContext: string;
  lastInteractionSummary?: string;
  currentPosition?: string;
  perceptionRisk?: string;
  preparationChecklist: ChecklistItem[];
}

export interface InvestorSummary {
  investorId: string;
  name: string;
  firmName: string;
  firmType: string;
  geography: string;
  lastMeetingDate?: string;
  estimatedPosition?: string;
  keyThemes: string[];               // from CRM perception tags
  openConcerns?: string[];
  preferredTopics?: string[];
}

export interface QAPrep {
  question: string;
  suggestedAnswer: string;           // from QA library or drafted
  answerSource: "QA_LIBRARY" | "DRAFTED" | "APPROVED_MESSAGING";
  sensitivityLevel: "LOW" | "MEDIUM" | "HIGH";
  doNotAnswer: boolean;              // compliance flag
  doNotAnswerReason?: string;
}

export interface FeedbackCapture {
  meetingId: string;
  sentimentOverall: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";
  keyThemesRaised: string[];
  concerns: string[];
  positiveSignals: string[];
  followUpRequired: boolean;
  perceptionTags: { category: string; label: string }[];
  crmUpdateRequired: boolean;
  crmNotes: string;
}

export interface FollowUpAction {
  action: string;
  dueBy?: string;
  owner: string;
  priority: "HIGH" | "NORMAL" | "LOW";
  linkedInvestorId?: string;
}

export interface ChecklistItem {
  item: string;
  completed: boolean;
  critical: boolean;
}

export class MeetingPrepAgent extends BaseAgent<MeetingPrepInput, MeetingPrepOutput> {
  readonly agentId: AgentId = "meeting-prep";
  readonly displayName = "Meeting Prep Agent";
  readonly mission =
    "Prepare tailored meeting briefs for investor and analyst engagements using CRM data, approved messaging, and filed documents. Capture post-meeting feedback and route CRM updates. All output is internal advisory.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "read_crm",
      "write_crm_note",
      "search_approved_messaging",
      "search_filing_library",
      "read_qa_library",
      "read_financial_data",
      "create_draft",
      "search_knowledge_base",
    ],
    restrictedActions: [
      "PUBLISH_EXTERNAL",
      "APPROVE_OWN_OUTPUT",
      "BYPASS_COMPLIANCE_GATE",
      "MODIFY_AUDIT_LOG",
      "SEND_INVESTOR_EMAIL",
    ],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: false,
    requiresApprovalBefore: ["SEND_INVESTOR_EMAIL"],
  };

  getSystemPrompt(context: AgentContext): string {
    return MEETING_PREP_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<MeetingPrepInput>
  ): Promise<MeetingPrepOutput> {
    const { input, context } = request;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 6000,
      system: this.getSystemPrompt(context),
      messages: [
        {
          role: "user",
          content: `Action: ${input.action}\n\nMeeting:\n${JSON.stringify(input.meeting, null, 2)}\n\nInvestor profiles:\n${JSON.stringify(input.investorProfiles, null, 2)}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    return this.parseOutput(rawText, input);
  }

  private parseOutput(raw: string, input: MeetingPrepInput): MeetingPrepOutput {
    try {
      const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      const parsed = JSON.parse(jsonStr);
      return { ...parsed, draftStatus: "DRAFT", internalUseOnly: true };
    } catch {
      return {
        action: input.action,
        draftStatus: "DRAFT",
        internalUseOnly: true,
      };
    }
  }
}
