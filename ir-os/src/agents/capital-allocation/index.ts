import type { AgentId, AgentRequest, AgentContext, AgentPermissions } from "../../types";
import { BaseAgent } from "../base/agent-interface";

export interface CapitalAllocationInput {
  action:
    | "VALUATION_SUMMARY"
    | "PEER_MULTIPLES"
    | "CAPITAL_STRUCTURE_BRIEF"
    | "DIVIDEND_POLICY_BRIEF"
    | "BUYBACK_ANALYSIS"
    | "LEVERAGE_MONITOR";
  financialSnapshot?: Record<string, number>;
  peerMultiples?: Record<string, Record<string, number>>;
  capitalEvent?: string;   // description of a capital allocation event
}

export interface CapitalAllocationOutput {
  action: string;
  valuationTable?: ValuationRow[];
  peerMultiplesTable?: PeerMultiplesRow[];
  capitalStructureSummary?: string;
  keyRatios?: Record<string, number | string>;
  analystTargetImpliedReturn?: string;
  irNarrative: string;
  internalUseOnly: true;
  classification: "INTERNAL_APPROVED";
  sources: string[];
  caveats: string[];
}

export interface ValuationRow {
  metric: string;
  currentValue: number | string;
  peerMedian?: number | string;
  premiumDiscount?: string;
  unit?: string;
}

export interface PeerMultiplesRow {
  ticker: string;
  ev_ebitda?: number;
  pe?: number;
  pb?: number;
  ev_revenue?: number;
  dividend_yield?: number;
  source: string;
  asOf: string;
}

export class CapitalAllocationAgent extends BaseAgent<CapitalAllocationInput, CapitalAllocationOutput> {
  readonly agentId: AgentId = "capital-allocation";
  readonly displayName = "Capital Allocation / Valuation Agent";
  readonly mission = "Provide internal advisory on valuation benchmarking, capital structure, dividend policy, buyback programs, and leverage metrics relative to peers. All outputs are strictly INTERNAL_APPROVED.";

  readonly permissions: AgentPermissions = {
    allowedTools: ["read_financial_data", "read_peer_data", "read_consensus_data", "search_filing_library", "create_draft", "search_knowledge_base"],
    restrictedActions: ["PUBLISH_EXTERNAL", "APPROVE_OWN_OUTPUT", "BYPASS_COMPLIANCE_GATE", "MODIFY_AUDIT_LOG", "RELEASE_GUIDANCE"],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: false,
    requiresApprovalBefore: ["PUBLISH_EXTERNAL"],
  };

  getSystemPrompt(_ctx: AgentContext): string {
    return `You are the Capital Allocation / Valuation Agent.
Provide internal valuation benchmarking and capital structure analysis using public and internal approved data.
All output is INTERNAL_APPROVED. Never produce investor-facing content.
internalUseOnly is always true. Output JSON matching CapitalAllocationOutput schema.`;
  }

  protected async execute(request: AgentRequest<CapitalAllocationInput>): Promise<CapitalAllocationOutput> {
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
      return { ...parsed, internalUseOnly: true, classification: "INTERNAL_APPROVED" };
    } catch {
      return {
        action: input.action, irNarrative: rawText.slice(0, 400),
        internalUseOnly: true, classification: "INTERNAL_APPROVED", sources: [], caveats: ["Parse failed"],
      };
    }
  }
}
