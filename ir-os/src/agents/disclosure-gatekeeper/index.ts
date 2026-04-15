import type {
  AgentId,
  AgentRequest,
  AgentContext,
  AgentPermissions,
  RedFlag,
  DataClassification,
  ApprovalLevel,
} from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { DISCLOSURE_GATEKEEPER_SYSTEM_PROMPT } from "./prompts";

// ----------------------------------------------------------------
// INPUT / OUTPUT TYPES
// ----------------------------------------------------------------

export interface GatekeeperInput {
  contentToReview: string;
  contentType:
    | "PRESS_RELEASE"
    | "EARNINGS_SCRIPT"
    | "INVESTOR_BRIEF"
    | "ANALYST_RESPONSE"
    | "WEBSITE_CONTENT"
    | "SOCIAL_MEDIA"
    | "REGULATORY_FILING"
    | "INTERNAL_MEMO"
    | "BOARD_PACK"
    | "OTHER";
  proposedClassification: DataClassification;
  submittedBy: string;
  context?: string;             // additional context for review
  filingReferences?: string[];  // filingIds to cross-check against
}

export interface GatekeeperOutput {
  verdict: "APPROVED_FOR_NEXT_STAGE" | "REJECTED" | "REQUIRES_REVISION" | "ESCALATE_IMMEDIATELY";
  assignedClassification: DataClassification;
  requiredApprovalLevel: ApprovalLevel;
  redFlags: RedFlag[];
  revisionsRequired: string[];
  complianceNotes: string[];
  selectiveDisclosureRisk: boolean;
  mnpiRisk: boolean;
  missingDisclosures: string[];
  suggestedSafeHarborLanguage?: string;
  reviewedAt: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  humanReviewMandatory: true;   // ALWAYS TRUE — gatekeeper never approves externally
}

// ----------------------------------------------------------------
// AGENT
// ----------------------------------------------------------------

export class DisclosureGatekeeperAgent extends BaseAgent<
  GatekeeperInput,
  GatekeeperOutput
> {
  readonly agentId: AgentId = "disclosure-gatekeeper";
  readonly displayName = "Disclosure & Compliance Gatekeeper";
  readonly mission =
    "Act as the compliance firewall for all IR outputs. Every piece of content intended for external audiences — or that contains material, market-sensitive, or regulated information — must pass through this agent before human approval can be requested. Block, flag, or escalate non-compliant content.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "search_filing_library",
      "search_approved_messaging",
      "read_financial_data",
      "read_audit_log",
      "run_compliance_check",
      "trigger_escalation",
      "read_qa_library",
      "search_knowledge_base",
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
    canGenerateExternal: false,   // gatekeeper reviews, never publishes
    requiresApprovalBefore: [
      "PUBLISH_EXTERNAL",
      "FILE_WITH_REGULATOR",
      "RELEASE_GUIDANCE",
    ],
  };

  getSystemPrompt(context: AgentContext): string {
    return DISCLOSURE_GATEKEEPER_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<GatekeeperInput>
  ): Promise<GatekeeperOutput> {
    const { input, context } = request;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 4096,
      system: this.getSystemPrompt(context),
      messages: [
        {
          role: "user",
          content: `Please perform a full compliance review of the following content.\n\nContent Type: ${input.contentType}\nProposed Classification: ${input.proposedClassification}\n\nCONTENT:\n${input.contentToReview}\n\nCONTEXT: ${input.context ?? "None provided."}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    return this.parseOutput(rawText);
  }

  private parseOutput(raw: string): GatekeeperOutput {
    try {
      const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      const parsed = JSON.parse(jsonStr);
      // Enforce: humanReviewMandatory is ALWAYS true
      return { ...parsed, humanReviewMandatory: true };
    } catch {
      // Conservative fallback: reject and escalate
      return {
        verdict: "ESCALATE_IMMEDIATELY",
        assignedClassification: "DRAFT_INTERNAL",
        requiredApprovalLevel: "HEAD_OF_IR",
        redFlags: [
          {
            code: "UNSUPPORTED_CLAIM",
            severity: "CRITICAL",
            description: "Compliance review could not be parsed — manual review required.",
            triggeredBy: "parser",
          },
        ],
        revisionsRequired: ["Full manual compliance review required."],
        complianceNotes: ["Automated parse failed. Escalate to legal and compliance."],
        selectiveDisclosureRisk: true,
        mnpiRisk: true,
        missingDisclosures: [],
        reviewedAt: new Date().toISOString(),
        confidence: "LOW",
        humanReviewMandatory: true,
      };
    }
  }
}
