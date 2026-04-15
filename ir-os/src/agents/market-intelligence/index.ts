import type { AgentId, AgentRequest, AgentContext, AgentPermissions } from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { MARKET_INTELLIGENCE_SYSTEM_PROMPT } from "./prompts";

export interface MarketIntelligenceInput {
  action:
    | "PEER_EARNINGS_MONITOR"
    | "SECTOR_SNAPSHOT"
    | "NEWS_SCAN"
    | "TRADING_PATTERN_ALERT"
    | "PEER_FILING_ALERT"
    | "VALUATION_BENCHMARK";
  peerTickers?: string[];
  dateRange?: { from: string; to: string };
  metrics?: string[];
  alertThresholds?: Record<string, number>;
}

export interface MarketIntelligenceOutput {
  action: string;
  peerSnapshots: PeerSnapshot[];
  sectorTrends: string[];
  newsHighlights: NewsItem[];
  tradingAlerts: TradingAlert[];
  keyInsights: string[];
  implicationsForIR: string[];
  internalUseOnly: true;
  asOf: string;
}

export interface PeerSnapshot {
  ticker: string;
  companyName: string;
  lastResultsDate?: string;
  keyMetrics: Record<string, number | string>;
  recentNewsHeadlines: string[];
  analystConsensus?: string;
  stockPerformance?: { period: string; return: number };
}

export interface NewsItem {
  headline: string;
  source: string;
  date: string;
  relevanceScore: number;
  classification: "PUBLIC";
  sentiment?: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
}

export interface TradingAlert {
  ticker: string;
  alertType: "UNUSUAL_VOLUME" | "PRICE_MOVE" | "INSIDER_FILING" | "SHORT_INTEREST";
  description: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  date: string;
}

export class MarketIntelligenceAgent extends BaseAgent<
  MarketIntelligenceInput,
  MarketIntelligenceOutput
> {
  readonly agentId: AgentId = "market-intelligence";
  readonly displayName = "Market Intelligence Agent";
  readonly mission =
    "Monitor peer companies, sector dynamics, market trading patterns, and news flow. Provide the IR team with actionable context to anticipate investor questions, benchmark against peers, and detect market-moving events. All outputs are PUBLIC data derived — internal advisory.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "read_peer_data",
      "read_market_data",
      "search_filing_library",
      "read_consensus_data",
      "create_draft",
      "search_knowledge_base",
    ],
    restrictedActions: [
      "PUBLISH_EXTERNAL",
      "APPROVE_OWN_OUTPUT",
      "BYPASS_COMPLIANCE_GATE",
      "MODIFY_AUDIT_LOG",
    ],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: false,
    requiresApprovalBefore: ["PUBLISH_EXTERNAL"],
  };

  getSystemPrompt(context: AgentContext): string {
    return MARKET_INTELLIGENCE_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<MarketIntelligenceInput>
  ): Promise<MarketIntelligenceOutput> {
    const { input, context } = request;
    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 4096,
      system: this.getSystemPrompt(context),
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";
    try {
      const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : rawText);
      return { ...parsed, internalUseOnly: true };
    } catch {
      return {
        action: input.action,
        peerSnapshots: [],
        sectorTrends: [],
        newsHighlights: [],
        tradingAlerts: [],
        keyInsights: [rawText.slice(0, 300)],
        implicationsForIR: [],
        internalUseOnly: true,
        asOf: new Date().toISOString(),
      };
    }
  }
}
