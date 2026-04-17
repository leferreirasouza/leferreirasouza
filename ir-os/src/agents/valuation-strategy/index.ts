import type {
  AgentId,
  AgentRequest,
  AgentContext,
  AgentPermissions,
} from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { VALUATION_STRATEGY_SYSTEM_PROMPT } from "./prompts";

// ----------------------------------------------------------------
// INPUT / OUTPUT
// ----------------------------------------------------------------

export type ValuationAction =
  | "DCF_ANALYSIS"
  | "COMPARABLE_COMPANIES"
  | "PRECEDENT_TRANSACTIONS"
  | "SUM_OF_PARTS"
  | "CREDIT_ANALYSIS"
  | "ROIC_EVA_ANALYSIS"
  | "CAPITAL_ALLOCATION_AUDIT"
  | "STRATEGIC_POSITIONING"
  | "SCENARIO_ANALYSIS";

export interface ValuationStrategyInput {
  action: ValuationAction;
  financialData?: Record<string, unknown>;   // NOPAT, EBITDA, revenue, capex, etc.
  marketData?: {
    sharePrice?: number;
    marketCap?: number;
    netDebt?: number;
    sharesOutstanding?: number;
  };
  comparablePeers?: string[];                // tickers or company names
  scenarioAssumptions?: Record<string, unknown>;
  specificInstructions?: string;
}

export interface KeyAssumption {
  label: string;
  value: string;
  sensitivityLevel: "HIGH" | "MEDIUM" | "LOW";
  source: string;
}

export interface DataQualityFlag {
  type: "HIGH_UNCERTAINTY" | "STALE_DATA" | "MISSING_INPUT" | "MODEL_LIMITATION";
  description: string;
  impact: string;
}

export interface TSRDecomposition {
  revenueGrowthContribution?: number;
  marginChangeContribution?: number;
  multipleChange?: number;
  dividendYield?: number;
  buybackYield?: number;
  totalTSR?: number;
}

export interface ValuationStrategyOutput {
  action: ValuationAction;
  frameworkUsed: string;
  classification: "INTERNAL_APPROVED";
  internalUseOnly: true;
  keyAssumptions: KeyAssumption[];
  valuationRange?: {
    low: number;
    mid: number;
    high: number;
    currency: string;
    perShareOrEV: "PER_SHARE" | "EV";
    methodology: "DCF" | "COMPS" | "SOTP" | "BLENDED";
  };
  sensitivityTable?: {
    rowVariable: string;
    colVariable: string;
    rows: unknown[];
  };
  roicAnalysis?: {
    roic?: number;
    nopat?: number;
    investedCapital?: number;
    wacc?: number;
    roicSpread?: number;
    eva?: number;
    mva?: number;
    fadeRateAssumption?: string;
    moatRating?: "WIDE" | "NARROW" | "NONE";
  };
  capitalAllocationSummary?: {
    primaryUseOfCapital: string;
    roicVsWacc: string;
    tsrDecomposition: TSRDecomposition;
    verdict: "ALLOCATING_WELL" | "MIXED" | "DESTROYING_VALUE";
  };
  methodologyNotes: string;
  dataQualityFlags: DataQualityFlag[];
  irImplications: string;
}

// ----------------------------------------------------------------
// AGENT
// ----------------------------------------------------------------

export class ValuationStrategyAgent extends BaseAgent<
  ValuationStrategyInput,
  ValuationStrategyOutput
> {
  readonly agentId: AgentId = "valuation-strategy";
  readonly displayName = "Valuation & Strategy Agent";
  readonly mission =
    "Provide rigorous valuation and strategic analysis to support IR conversations, board presentations, and capital event preparation. Applies DCF, comparable companies, SOTP, ROIC/EVA, capital allocation audit (Mauboussin framework), and competitive moat assessment. All output is INTERNAL_APPROVED and must never appear in external communications.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "read_financial_data",
      "read_peer_data",
      "read_market_data",
      "search_filing_library",
      "search_knowledge_base",
      "read_consensus_data",
    ],
    restrictedActions: [
      "PUBLISH_EXTERNAL",
      "FILE_WITH_REGULATOR",
      "APPROVE_OWN_OUTPUT",
      "BYPASS_COMPLIANCE_GATE",
      "MODIFY_AUDIT_LOG",
      "SEND_INVESTOR_EMAIL",
      "POST_TO_WEBSITE",
      "RELEASE_GUIDANCE",
    ],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: false,   // valuation outputs are strictly internal
    requiresApprovalBefore: [
      "PUBLISH_EXTERNAL",
      "FILE_WITH_REGULATOR",
    ],
  };

  getSystemPrompt(context: AgentContext): string {
    return VALUATION_STRATEGY_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<ValuationStrategyInput>
  ): Promise<ValuationStrategyOutput> {
    const { input, context } = request;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 8192,
      system: this.getSystemPrompt(context),
      messages: [
        {
          role: "user",
          content: `Action: ${input.action}\n\nInstructions: ${input.specificInstructions ?? "(none)"}\n\nInput data:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    return this.parseOutput(rawText, input);
  }

  private parseOutput(
    raw: string,
    input: ValuationStrategyInput
  ): ValuationStrategyOutput {
    try {
      const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      const parsed = JSON.parse(jsonStr);
      // Enforce invariants regardless of model output
      return {
        ...parsed,
        classification: "INTERNAL_APPROVED" as const,
        internalUseOnly: true as const,
      };
    } catch {
      return {
        action: input.action,
        frameworkUsed: input.action,
        classification: "INTERNAL_APPROVED",
        internalUseOnly: true,
        keyAssumptions: [],
        methodologyNotes: raw.slice(0, 2000),
        dataQualityFlags: [
          {
            type: "MODEL_LIMITATION",
            description: "Structured JSON parse failed — raw text returned.",
            impact: "Manual review required before using this output.",
          },
        ],
        irImplications: "Review raw output above before sharing with IR team.",
      };
    }
  }
}
