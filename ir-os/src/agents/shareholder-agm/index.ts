import type { AgentId, AgentRequest, AgentContext, AgentPermissions } from "../../types";
import { BaseAgent } from "../base/agent-interface";

export interface ShareholderAGMInput {
  action:
    | "AGM_TIMELINE"
    | "DRAFT_EDITAL"
    | "DRAFT_PROXY"
    | "GOVERNANCE_FAQ"
    | "SHAREHOLDER_COMMUNICATION"
    | "VOTING_ANALYSIS";
  agmDate?: string;
  agendaItems?: string[];
  jurisdiction?: "BRAZIL" | "USA" | "BOTH";
  managementProposals?: string[];
  shareholderProposals?: string[];
}

export interface ShareholderAGMOutput {
  action: string;
  draftContent?: string;
  agmTimeline?: AGMTimelineItem[];
  governanceFAQ?: { question: string; answer: string }[];
  votingAnalysis?: VotingAnalysisItem[];
  regulatoryObligations: string[];
  draftStatus: "DRAFT";
  humanApprovalRequired: true;
  legalReviewRequired: boolean;
  notes: string;
}

export interface AGMTimelineItem {
  date: string;
  milestone: string;
  owner: string;
  regulatoryBasis?: string;
  isCritical: boolean;
}

export interface VotingAnalysisItem {
  resolution: string;
  type: "ORDINARY" | "EXTRAORDINARY";
  passThreshold: string;
  proxyAdvisorRecommendation?: string;
  estimatedOutcome?: string;
}

export class ShareholderAGMAgent extends BaseAgent<ShareholderAGMInput, ShareholderAGMOutput> {
  readonly agentId: AgentId = "shareholder-agm";
  readonly displayName = "Shareholder / AGM Support Agent";
  readonly mission = "Support the full AGM/governance communication cycle including edital drafting, proxy preparation, shareholder engagement support, and governance FAQ. All drafts require legal and board approval.";

  readonly permissions: AgentPermissions = {
    allowedTools: ["search_filing_library", "search_approved_messaging", "read_disclosure_calendar", "create_draft", "submit_for_approval", "search_knowledge_base"],
    restrictedActions: ["PUBLISH_EXTERNAL", "FILE_WITH_REGULATOR", "APPROVE_OWN_OUTPUT", "BYPASS_COMPLIANCE_GATE", "MODIFY_AUDIT_LOG"],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: true,
    requiresApprovalBefore: ["PUBLISH_EXTERNAL", "FILE_WITH_REGULATOR"],
  };

  getSystemPrompt(_ctx: AgentContext): string {
    return `You are the Shareholder / AGM Support Agent.
Draft AGM documentation, governance communications, and proxy materials.
All drafts = DRAFT status, require legal + board approval before filing or publication.
humanApprovalRequired is always true. Output JSON matching ShareholderAGMOutput schema.`;
  }

  protected async execute(request: AgentRequest<ShareholderAGMInput>): Promise<ShareholderAGMOutput> {
    const { input, context } = request;
    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 4096,
      system: this.getSystemPrompt(context),
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      const m = rawText.match(/```json\n([\s\S]*?)\n```/);
      const parsed = JSON.parse(m ? m[1] : rawText);
      return { ...parsed, draftStatus: "DRAFT", humanApprovalRequired: true };
    } catch {
      return {
        action: input.action, regulatoryObligations: [],
        draftStatus: "DRAFT", humanApprovalRequired: true, legalReviewRequired: true,
        notes: rawText.slice(0, 300),
      };
    }
  }
}
