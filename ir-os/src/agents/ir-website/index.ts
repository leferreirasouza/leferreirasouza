import type { AgentId, AgentRequest, AgentContext, AgentPermissions } from "../../types";
import { BaseAgent } from "../base/agent-interface";

export interface IRWebsiteInput {
  action: "CONTENT_AUDIT" | "PUBLICATION_READINESS_CHECK" | "DRAFT_PAGE_UPDATE" | "ARCHIVE_OLD_CONTENT";
  contentType?: string;
  artifactId?: string;     // approved artifact to publish
  pageIdentifier?: string;
  currentContent?: string;
}

export interface IRWebsiteOutput {
  action: string;
  readinessChecks?: ReadinessCheck[];
  draftContent?: string;
  archiveRecommendations?: string[];
  complianceIssues: string[];
  blockedFromPublishing: boolean;
  humanApprovalRequired: true;
  draftStatus: "DRAFT";
  notes: string;
}

export interface ReadinessCheck {
  checkName: string;
  passed: boolean;
  critical: boolean;
  notes?: string;
}

export class IRWebsiteAgent extends BaseAgent<IRWebsiteInput, IRWebsiteOutput> {
  readonly agentId: AgentId = "ir-website";
  readonly displayName = "IR Website & Content Agent";
  readonly mission = "Manage IR website content lifecycle: readiness checks, draft page updates, archive management, and publication-readiness validation. Never publishes autonomously — all publishing requires human approval.";

  readonly permissions: AgentPermissions = {
    allowedTools: ["read_website_content", "search_approved_messaging", "search_filing_library", "create_draft", "update_draft", "submit_for_approval"],
    restrictedActions: ["PUBLISH_EXTERNAL", "POST_TO_WEBSITE", "APPROVE_OWN_OUTPUT", "BYPASS_COMPLIANCE_GATE", "MODIFY_AUDIT_LOG"],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: true,     // can draft — cannot publish
    requiresApprovalBefore: ["POST_TO_WEBSITE", "PUBLISH_EXTERNAL"],
  };

  getSystemPrompt(_ctx: AgentContext): string {
    return `You are the IR Website & Content Agent.
Perform content readiness checks and draft website updates based on APPROVED artifacts only.
You NEVER publish autonomously. humanApprovalRequired is always true.
blockedFromPublishing = true unless the artifact has APPROVED draftStatus.
Output JSON matching IRWebsiteOutput schema.`;
  }

  protected async execute(request: AgentRequest<IRWebsiteInput>): Promise<IRWebsiteOutput> {
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
      return { ...parsed, humanApprovalRequired: true, draftStatus: "DRAFT" };
    } catch {
      return {
        action: input.action, complianceIssues: [],
        blockedFromPublishing: true, humanApprovalRequired: true,
        draftStatus: "DRAFT", notes: rawText.slice(0, 300),
      };
    }
  }
}
