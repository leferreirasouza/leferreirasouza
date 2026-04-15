import type { AgentId, AgentRequest, AgentContext, AgentPermissions, EventType } from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { SPECIAL_SITUATIONS_SYSTEM_PROMPT } from "./prompts";

export interface SpecialSituationsInput {
  situation: string;                 // free-text description of the event/trigger
  eventType: EventType;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  detectedAt: string;
  sourceOfAlert: string;
  knownFacts?: string[];
  managementContext?: string;
  precedentCaseIds?: string[];       // similar historical events from knowledge base
}

export interface SpecialSituationsOutput {
  triageAssessment: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  requiresImmediateDisclosure: boolean;
  disclosureRationale?: string;
  requiresBoardNotification: boolean;
  suggestedResponseOptions: ResponseOption[];
  draftStatementOutline?: string;    // structural outline ONLY — not final draft
  doNotSay: string[];                // specific language to avoid
  regulatoryObligations: string[];
  internalStakeholdersToAlert: string[];
  mediaPressureRisk: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  timeToMandatoryDisclosure?: string;  // e.g. "within 30 minutes per CVM rules"
  precedentCaseNotes?: string;
  escalatedTo: string[];
  draftStatus: "DRAFT";
  classification: "DRAFT_INTERNAL";
}

export interface ResponseOption {
  optionId: string;
  approach: "NO_COMMENT" | "CONFIRM_AWARE" | "FULL_DISCLOSURE" | "DENY" | "PARTIAL_COMMENT";
  description: string;
  pros: string[];
  cons: string[];
  regulatoryRisk: "HIGH" | "MEDIUM" | "LOW";
  legalSignOffRequired: boolean;
}

export class SpecialSituationsAgent extends BaseAgent<
  SpecialSituationsInput,
  SpecialSituationsOutput
> {
  readonly agentId: AgentId = "special-situations";
  readonly displayName = "Special Situations Agent";
  readonly mission =
    "Triage and manage crisis, rumor, activist, and material-event situations. Provide rapid response options, regulatory obligation assessment, and escalation routing. Never draft final public statements — produce outlines and options for human decision-making. Always escalate to legal and the CFO.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "search_filing_library",
      "search_approved_messaging",
      "read_audit_log",
      "trigger_escalation",
      "send_internal_notification",
      "read_disclosure_calendar",
      "search_knowledge_base",
      "run_compliance_check",
    ],
    restrictedActions: [
      "PUBLISH_EXTERNAL",
      "FILE_WITH_REGULATOR",
      "APPROVE_OWN_OUTPUT",
      "BYPASS_COMPLIANCE_GATE",
      "MODIFY_AUDIT_LOG",
      "SEND_INVESTOR_EMAIL",
      "POST_TO_WEBSITE",
    ],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: false,
    requiresApprovalBefore: [
      "PUBLISH_EXTERNAL",
      "FILE_WITH_REGULATOR",
      "SEND_INVESTOR_EMAIL",
    ],
  };

  getSystemPrompt(context: AgentContext): string {
    return SPECIAL_SITUATIONS_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<SpecialSituationsInput>
  ): Promise<SpecialSituationsOutput> {
    const { input, context } = request;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 6000,
      system: this.getSystemPrompt(context),
      messages: [
        {
          role: "user",
          content: `SPECIAL SITUATION ALERT\n\nType: ${input.eventType}\nSeverity: ${input.severity}\nDetected: ${input.detectedAt}\nDescription: ${input.situation}\n\nKnown facts:\n${JSON.stringify(input.knownFacts)}\n\nManagement context: ${input.managementContext ?? "None provided"}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const jsonMatch = rawText.match(/```json\n([\s\S]*?)\n```/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[1] : rawText);
      return { ...parsed, draftStatus: "DRAFT", classification: "DRAFT_INTERNAL" };
    } catch {
      return {
        triageAssessment: rawText.slice(0, 500),
        severity: input.severity,
        requiresImmediateDisclosure: true,  // conservative default
        requiresBoardNotification: true,
        suggestedResponseOptions: [],
        doNotSay: [],
        regulatoryObligations: ["Consult legal immediately."],
        internalStakeholdersToAlert: ["CFO", "Legal", "CEO", "Head of IR"],
        mediaPressureRisk: "HIGH",
        escalatedTo: ["legal", "cfo", "head-of-ir"],
        draftStatus: "DRAFT",
        classification: "DRAFT_INTERNAL",
      };
    }
  }
}
