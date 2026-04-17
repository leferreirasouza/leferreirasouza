import type {
  AgentId,
  AgentRequest,
  AgentContext,
  AgentPermissions,
  ArtifactType,
} from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { DISCLOSURE_DRAFTING_SYSTEM_PROMPT } from "./prompts";

export interface DisclosureDraftingInput {
  artifactType: ArtifactType;
  language: "PT" | "EN" | "BOTH";
  instructions: string;
  financialData?: Record<string, unknown>;
  approvedMessaging?: string[];   // messageIds to draw from
  priorVersionContent?: string;
  filingReferences?: string[];
  managementNarrative?: string;
  guidanceApproved?: boolean;     // explicit flag — drafts cannot assume guidance is approved
  tone?: "FORMAL" | "ACCESSIBLE" | "CONSERVATIVE";
}

export interface DraftQualityAssessment {
  scores: {
    clarity: 1 | 2 | 3 | 4 | 5;
    precision: 1 | 2 | 3 | 4 | 5;
    compliance: 1 | 2 | 3 | 4 | 5;
    investorFocus: 1 | 2 | 3 | 4 | 5;
    structure: 1 | 2 | 3 | 4 | 5;
  };
  overallScore: number;          // mean of the 5 dimensions
  flaggedDimensions: string[];   // dimensions scoring ≤2
  narrativeThemes: string[];     // the 3 strategic themes identified
}

export interface DisclosureDraftingOutput {
  draftContent: string;
  language: string;
  artifactType: ArtifactType;
  wordCount: number;
  keyMessages: string[];
  narrativeThemes: string[];
  sourcesCited: string[];
  forwardLookingStatements: string[];    // isolated for safe-harbor check
  financialFiguresUsed: string[];         // for source attribution
  draftStatus: "DRAFT";                   // always DRAFT — never APPROVED
  submittedForGatekeeperReview: boolean;
  writingMethodologyApplied: string[];   // e.g. ["PYRAMID_PRINCIPLE", "SCQA"]
  qualityAssessment?: DraftQualityAssessment;
  reviewNotes: string;
  structuralOutline: string[];
}

export class DisclosureDraftingAgent extends BaseAgent<
  DisclosureDraftingInput,
  DisclosureDraftingOutput
> {
  readonly agentId: AgentId = "disclosure-drafting";
  readonly displayName = "Disclosure Drafting Agent";
  readonly mission =
    "Draft all IR communications — press releases, Fatos Relevantes, earnings scripts, investor presentations, and other external-facing content — grounded in approved messaging, filed documents, and audited financials. All output is DRAFT status. The Disclosure Gatekeeper and human approvers must sign off before anything leaves the building.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "search_filing_library",
      "search_approved_messaging",
      "read_financial_data",
      "read_qa_library",
      "create_draft",
      "update_draft",
      "submit_for_approval",
      "search_knowledge_base",
    ],
    restrictedActions: [
      "PUBLISH_EXTERNAL",
      "FILE_WITH_REGULATOR",
      "APPROVE_OWN_OUTPUT",
      "BYPASS_COMPLIANCE_GATE",
      "MODIFY_AUDIT_LOG",
      "RELEASE_GUIDANCE",
    ],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: true,     // drafts external content — never publishes
    requiresApprovalBefore: ["PUBLISH_EXTERNAL", "FILE_WITH_REGULATOR"],
  };

  getSystemPrompt(context: AgentContext): string {
    return DISCLOSURE_DRAFTING_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<DisclosureDraftingInput>
  ): Promise<DisclosureDraftingOutput> {
    const { input, context } = request;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 8192,
      system: this.getSystemPrompt(context),
      messages: [
        {
          role: "user",
          content: `Please draft the following document:\n\nType: ${input.artifactType}\nLanguage: ${input.language}\nInstructions: ${input.instructions}\n\nContext:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    return this.parseOutput(rawText, input);
  }

  private parseOutput(
    raw: string,
    input: DisclosureDraftingInput
  ): DisclosureDraftingOutput {
    try {
      const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      const parsed = JSON.parse(jsonStr);
      return { ...parsed, draftStatus: "DRAFT" }; // enforce DRAFT
    } catch {
      // Return raw text as draft content
      return {
        draftContent: raw,
        language: input.language,
        artifactType: input.artifactType,
        wordCount: raw.split(/\s+/).length,
        keyMessages: [],
        sourcesCited: [],
        forwardLookingStatements: [],
        financialFiguresUsed: [],
        draftStatus: "DRAFT",
        submittedForGatekeeperReview: false,
        narrativeThemes: [],
        writingMethodologyApplied: [],
        reviewNotes: "Structured parse failed. Review raw content.",
        structuralOutline: [],
      };
    }
  }
}
