import type {
  AgentId,
  AgentRequest,
  AgentContext,
  AgentPermissions,
} from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { SELF_DEVELOPMENT_SYSTEM_PROMPT } from "./prompts";

// ----------------------------------------------------------------
// INPUT / OUTPUT
// ----------------------------------------------------------------

export type SelfDevelopmentAction =
  | "QUALITY_REVIEW"
  | "KNOWLEDGE_GAP_ANALYSIS"
  | "UNANSWERED_QA_REVIEW"
  | "PERFORMANCE_SUMMARY";

export interface QualitySignal {
  agentId: string;
  requestId: string;
  overallScore?: number;
  flaggedDimensions?: string[];
  reviewNotes?: string;
  timestamp: string;
}

export interface KnowledgeGapSignal {
  topic: string;
  description: string;
  flaggedBy: string;    // agent that raised the gap
  flaggedAt: string;
  frequency?: number;   // how many times this gap has been flagged
}

export interface UnansweredQuestion {
  question: string;
  askedBy?: string;     // investor or meeting context
  context?: string;
  flaggedAt: string;
}

export interface SelfDevelopmentInput {
  action: SelfDevelopmentAction;
  qualitySignals?: QualitySignal[];
  knowledgeGaps?: KnowledgeGapSignal[];
  unansweredQuestions?: UnansweredQuestion[];
  lookbackDays?: number;
  specificInstructions?: string;
}

export interface ImprovementRecommendation {
  recommendationId: string;
  category:
    | "PROMPT_IMPROVEMENT"
    | "INPUT_VALIDATION"
    | "KNOWLEDGE_INGESTION"
    | "QA_ADDITION"
    | "REFERENCE_SOURCE";
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  effort: "LOW" | "MEDIUM" | "HIGH";
  what: string;
  why: string;
  how: string;
  targetFile?: string;
  requiresApproval: "HEAD_OF_IR" | "CFO" | "NONE";
}

export interface SuggestedQAEntry {
  question: string;
  answer: string;
  sensitivityLevel: "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
  requiresApprovalFrom: "HEAD_OF_IR" | "CFO" | "LEGAL" | "IR_MANAGER";
  context?: string;
}

export interface PerformanceSummary {
  period: string;
  avgDraftQualityScore?: number;
  knowledgeGapClosureRate?: string;
  qaCoverageRate?: string;
  referenceLibraryFreshness?: string;
  top3Recommendations: string[];
}

export interface SelfDevelopmentOutput {
  action: SelfDevelopmentAction;
  analysedAt: string;
  evidenceItemsAnalysed: number;
  recommendations: ImprovementRecommendation[];
  suggestedQAEntries: SuggestedQAEntry[];
  performanceSummary?: PerformanceSummary;
  nextReviewDate: string;
}

// ----------------------------------------------------------------
// AGENT
// ----------------------------------------------------------------

export class SelfDevelopmentAgent extends BaseAgent<
  SelfDevelopmentInput,
  SelfDevelopmentOutput
> {
  readonly agentId: AgentId = "self-development";
  readonly displayName = "Self-Development Agent";
  readonly mission =
    "Close the IR-OS quality loop. Analyse draft quality signals, knowledge gaps, and unanswered investor questions to generate actionable, file-specific recommendations that improve the platform's outputs over time. The Head of IR reviews and approves all recommendations before implementation.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "read_audit_log",
      "search_knowledge_base",
      "read_qa_library",
      "search_filing_library",
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
    return SELF_DEVELOPMENT_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<SelfDevelopmentInput>
  ): Promise<SelfDevelopmentOutput> {
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
    input: SelfDevelopmentInput
  ): SelfDevelopmentOutput {
    try {
      const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      return JSON.parse(jsonStr) as SelfDevelopmentOutput;
    } catch {
      return {
        action: input.action,
        analysedAt: new Date().toISOString(),
        evidenceItemsAnalysed: 0,
        recommendations: [],
        suggestedQAEntries: [],
        nextReviewDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };
    }
  }
}
