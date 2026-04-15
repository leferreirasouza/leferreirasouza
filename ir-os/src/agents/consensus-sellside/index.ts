import type {
  AgentId,
  AgentRequest,
  AgentContext,
  AgentPermissions,
  ConsensusRecord,
  FiscalPeriod,
} from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { CONSENSUS_SELLSIDE_SYSTEM_PROMPT } from "./prompts";

export interface ConsensusSellsideInput {
  action:
    | "REFRESH_CONSENSUS"
    | "VARIANCE_ANALYSIS"
    | "ANALYST_CHANGE_ALERT"
    | "PRE_EARNINGS_SUMMARY"
    | "POST_EARNINGS_SUMMARY"
    | "ANALYST_COVERAGE_MAP";
  period: FiscalPeriod;
  actualResults?: Record<string, number>;   // populated for variance analysis
  analystChanges?: AnalystChange[];
  filterMetrics?: string[];
}

export interface AnalystChange {
  analystId: string;
  firmName: string;
  changeType: "UPGRADE" | "DOWNGRADE" | "PRICE_TARGET_UP" | "PRICE_TARGET_DOWN" | "ESTIMATE_REVISION";
  priorValue?: string | number;
  newValue?: string | number;
  commentary?: string;
  date: string;
}

export interface ConsensusSellsideOutput {
  action: string;
  period: string;
  consensusTable: ConsensusTableRow[];
  varianceTable?: VarianceTableRow[];
  analystChangeSummary?: string;
  keyInsights: string[];
  riskToConsensus: "UPSIDE_RISK" | "DOWNSIDE_RISK" | "BROADLY_IN_LINE" | "INSUFFICIENT_DATA";
  recommendationBreakdown?: RecommendationBreakdown;
  priceTargetRange?: { low: number; mean: number; high: number; currency: string };
  narrativeSummary: string;
  internalUseOnly: true;
  dataSources: string[];
  asOf: string;
}

export interface ConsensusTableRow {
  metric: string;
  unit: string;
  consensus: number;
  high: number;
  low: number;
  contributors: number;
  source: string;
}

export interface VarianceTableRow {
  metric: string;
  consensus: number;
  actual: number;
  varianceAbs: number;
  variancePct: number;
  beat: "BEAT" | "MISS" | "IN_LINE";
  notes: string;
}

export interface RecommendationBreakdown {
  buy: number;
  outperform: number;
  hold: number;
  underperform: number;
  sell: number;
  notRated: number;
  total: number;
}

export class ConsensusSellsideAgent extends BaseAgent<
  ConsensusSellsideInput,
  ConsensusSellsideOutput
> {
  readonly agentId: AgentId = "consensus-sellside";
  readonly displayName = "Consensus & Sell-Side Agent";
  readonly mission =
    "Monitor sell-side consensus, track analyst estimate revisions and recommendation changes, produce pre-earnings and post-earnings variance analyses, and maintain a live map of analyst coverage. All outputs are internal advisory.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "read_consensus_data",
      "read_financial_data",
      "search_filing_library",
      "create_draft",
      "search_knowledge_base",
    ],
    restrictedActions: [
      "PUBLISH_EXTERNAL",
      "FILE_WITH_REGULATOR",
      "APPROVE_OWN_OUTPUT",
      "BYPASS_COMPLIANCE_GATE",
      "MODIFY_AUDIT_LOG",
      "SEND_INVESTOR_EMAIL",
    ],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: false,
    requiresApprovalBefore: ["PUBLISH_EXTERNAL"],
  };

  getSystemPrompt(context: AgentContext): string {
    return CONSENSUS_SELLSIDE_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<ConsensusSellsideInput>
  ): Promise<ConsensusSellsideOutput> {
    const { input, context } = request;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 4096,
      system: this.getSystemPrompt(context),
      messages: [
        {
          role: "user",
          content: `Action: ${input.action}\nPeriod: ${JSON.stringify(input.period)}\n\nData:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    return this.parseOutput(rawText, input);
  }

  private parseOutput(
    raw: string,
    input: ConsensusSellsideInput
  ): ConsensusSellsideOutput {
    try {
      const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      const parsed = JSON.parse(jsonStr);
      return { ...parsed, internalUseOnly: true };
    } catch {
      return {
        action: input.action,
        period: input.period.label,
        consensusTable: [],
        keyInsights: ["Output parse failed — review raw data."],
        riskToConsensus: "INSUFFICIENT_DATA",
        narrativeSummary: raw.slice(0, 400),
        internalUseOnly: true,
        dataSources: [],
        asOf: new Date().toISOString(),
      };
    }
  }
}
