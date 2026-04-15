import type { AgentId, AgentRequest, AgentContext, AgentPermissions } from "../../types";
import { BaseAgent } from "../base/agent-interface";

export interface PerceptionInput {
  action: "ANALYZE_FEEDBACK" | "PERCEPTION_REPORT" | "THESIS_MAP" | "SENTIMENT_TREND";
  meetingIds?: string[];
  periodFrom?: string;
  periodTo?: string;
  investorSegment?: string;
}

export interface PerceptionOutput {
  dominantThemes: PerceptionTheme[];
  concernMap: { category: string; frequency: number; examples: string[] }[];
  positiveSignals: string[];
  governanceSentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE" | "MIXED";
  valuationApproaches: string[];
  catalystWatchlist: string[];
  exitRisks: string[];
  irRecommendations: string[];
  executiveSummary: string;
  internalUseOnly: true;
}

export interface PerceptionTheme {
  theme: string;
  category: string;
  frequency: number;
  sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
  representativeQuotes: string[];
}

export class PerceptionAgent extends BaseAgent<PerceptionInput, PerceptionOutput> {
  readonly agentId: AgentId = "perception";
  readonly displayName = "Perception Agent";
  readonly mission = "Synthesize investor feedback from CRM meeting notes and perception tags to build a real-time view of how the market understands the investment thesis, key concerns, and governance sentiment.";

  readonly permissions: AgentPermissions = {
    allowedTools: ["read_crm", "search_knowledge_base", "create_draft"],
    restrictedActions: ["PUBLISH_EXTERNAL", "APPROVE_OWN_OUTPUT", "BYPASS_COMPLIANCE_GATE", "MODIFY_AUDIT_LOG"],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: false,
    requiresApprovalBefore: ["PUBLISH_EXTERNAL"],
  };

  getSystemPrompt(_ctx: AgentContext): string {
    return `You are the Perception Agent. Synthesize investor feedback from meeting notes and CRM perception tags.
Output a structured perception report. All data is INTERNAL_APPROVED. Output JSON matching PerceptionOutput schema.
internalUseOnly is always true. Never produce investor-facing content.`;
  }

  protected async execute(request: AgentRequest<PerceptionInput>): Promise<PerceptionOutput> {
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
      return { ...parsed, internalUseOnly: true };
    } catch {
      return {
        dominantThemes: [], concernMap: [], positiveSignals: [],
        governanceSentiment: "NEUTRAL", valuationApproaches: [],
        catalystWatchlist: [], exitRisks: [],
        irRecommendations: ["Parse failed — manual review required."],
        executiveSummary: rawText.slice(0, 300),
        internalUseOnly: true,
      };
    }
  }
}
