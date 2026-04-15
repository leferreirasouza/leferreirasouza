import type { AgentId, AgentRequest, AgentContext, AgentPermissions } from "../../types";
import { BaseAgent } from "../base/agent-interface";

export interface InvestorTargetingInput {
  action: "TARGETING_LIST" | "CRM_UPDATE" | "ENGAGEMENT_SCORE" | "OWNERSHIP_ANALYSIS" | "NDR_PLANNING";
  investorSegment?: string;
  geographyFocus?: string[];
  targetAUM?: { min?: number; max?: number };
  engagementHistory?: boolean;
  ndrDates?: { from: string; to: string };
}

export interface InvestorTargetingOutput {
  action: string;
  targetList?: TargetInvestor[];
  crmUpdateSuggestions?: string[];
  engagementScoreCard?: { investorId: string; score: number; reason: string }[];
  ownershipSummary?: string;
  ndrPlan?: NDRPlan;
  internalUseOnly: true;
  classification: "INTERNAL_APPROVED";
  notes: string;
}

export interface TargetInvestor {
  investorId?: string;
  firmName: string;
  firmType: string;
  geography: string;
  aum_bn_usd?: number;
  priorityScore: number;
  rationale: string;
  suggestedEngagementFormat: string;
}

export interface NDRPlan {
  cities: string[];
  suggestedDates: string[];
  targetMeetingCount: number;
  priorityInvestors: string[];
  logisticalNotes: string;
}

export class InvestorTargetingAgent extends BaseAgent<InvestorTargetingInput, InvestorTargetingOutput> {
  readonly agentId: AgentId = "investor-targeting";
  readonly displayName = "Investor Targeting / CRM Agent";
  readonly mission = "Maintain investor CRM, generate targeting lists for NDRs and roadshows, track engagement scores, and support ownership analysis. All outputs are INTERNAL_APPROVED.";

  readonly permissions: AgentPermissions = {
    allowedTools: ["read_crm", "write_crm_note", "read_financial_data", "search_knowledge_base", "create_draft"],
    restrictedActions: ["PUBLISH_EXTERNAL", "APPROVE_OWN_OUTPUT", "BYPASS_COMPLIANCE_GATE", "MODIFY_AUDIT_LOG", "SEND_INVESTOR_EMAIL"],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: false,
    requiresApprovalBefore: ["SEND_INVESTOR_EMAIL"],
  };

  getSystemPrompt(_ctx: AgentContext): string {
    return `You are the Investor Targeting / CRM Agent.
Generate targeting lists, CRM updates, and engagement plans.
All output is INTERNAL_APPROVED. internalUseOnly = true.
Output JSON matching InvestorTargetingOutput schema.`;
  }

  protected async execute(request: AgentRequest<InvestorTargetingInput>): Promise<InvestorTargetingOutput> {
    const { input, context } = request;
    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 3000,
      system: this.getSystemPrompt(context),
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      const m = rawText.match(/```json\n([\s\S]*?)\n```/);
      const parsed = JSON.parse(m ? m[1] : rawText);
      return { ...parsed, internalUseOnly: true, classification: "INTERNAL_APPROVED" };
    } catch {
      return { action: input.action, internalUseOnly: true, classification: "INTERNAL_APPROVED", notes: rawText.slice(0, 300) };
    }
  }
}
