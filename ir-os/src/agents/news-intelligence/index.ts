import type {
  AgentId,
  AgentRequest,
  AgentContext,
  AgentPermissions,
} from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { NEWS_INTELLIGENCE_SYSTEM_PROMPT } from "./prompts";

// ----------------------------------------------------------------
// INPUT / OUTPUT
// ----------------------------------------------------------------

export type NewsAction =
  | "SCAN_MARKET_NEWS"
  | "PEER_MONITORING"
  | "SECTOR_WATCH"
  | "REGULATORY_WATCH"
  | "MACRO_WATCH";

export interface RawNewsItem {
  newsId: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  summary?: string;
  fullText?: string;
}

export interface NewsIntelligenceInput {
  action: NewsAction;
  items?: RawNewsItem[];           // for SCAN_MARKET_NEWS
  peers?: string[];                // for PEER_MONITORING
  sector?: string;                 // for SECTOR_WATCH
  lookbackDays?: number;           // how many days of news to consider
  specificInstructions?: string;
}

export interface TriagedNewsItem {
  newsId: string;
  title: string;
  source: string;
  publishedAt: string;
  relevanceScore: number;
  urgency: "IMMEDIATE" | "SAME_DAY" | "THIS_WEEK" | "MONITORING";
  irImplication:
    | "REACTIVE_DISCLOSURE"
    | "PROACTIVE_MESSAGING"
    | "Q&A_UPDATE"
    | "INVESTOR_ALERT"
    | "MONITOR_ONLY"
    | "ESCALATE_TO_LEGAL";
  summary: string;
  suggestedAction: string;
  escalate: boolean;
}

export interface NewsIntelligenceOutput {
  action: NewsAction;
  processedAt: string;
  totalItemsReceived: number;
  totalItemsReturned: number;
  items: TriagedNewsItem[];
  escalations: TriagedNewsItem[];
  briefingSummary: string;
  watchlistAdditions: string[];
}

// ----------------------------------------------------------------
// AGENT
// ----------------------------------------------------------------

export class NewsIntelligenceAgent extends BaseAgent<
  NewsIntelligenceInput,
  NewsIntelligenceOutput
> {
  readonly agentId: AgentId = "news-intelligence";
  readonly displayName = "News Intelligence Agent";
  readonly mission =
    "Monitor, triage, and interpret market news through an IR lens. Scan news feeds, track competitor announcements, watch regulatory developments, and surface actionable intelligence to the IR team — so they act proactively, not reactively.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "read_market_data",
      "read_peer_data",
      "search_knowledge_base",
      "search_filing_library",
      "trigger_escalation",
      "send_internal_notification",
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
    canGenerateExternal: false,
    requiresApprovalBefore: ["PUBLISH_EXTERNAL", "FILE_WITH_REGULATOR"],
  };

  getSystemPrompt(context: AgentContext): string {
    return NEWS_INTELLIGENCE_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<NewsIntelligenceInput>
  ): Promise<NewsIntelligenceOutput> {
    const { input, context } = request;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 6000,
      system: this.getSystemPrompt(context),
      messages: [
        {
          role: "user",
          content: `Action: ${input.action}\n\nInput:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    return this.parseOutput(rawText, input);
  }

  private parseOutput(
    raw: string,
    input: NewsIntelligenceInput
  ): NewsIntelligenceOutput {
    try {
      const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      return JSON.parse(jsonStr) as NewsIntelligenceOutput;
    } catch {
      return {
        action: input.action,
        processedAt: new Date().toISOString(),
        totalItemsReceived: input.items?.length ?? 0,
        totalItemsReturned: 0,
        items: [],
        escalations: [],
        briefingSummary: raw.slice(0, 300),
        watchlistAdditions: [],
      };
    }
  }
}
