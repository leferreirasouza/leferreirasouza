import type {
  AgentId,
  AgentRequest,
  AgentContext,
  AgentPermissions,
  AgentHandoff,
  WorkflowType,
} from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { CHIEF_OF_STAFF_SYSTEM_PROMPT } from "./prompts";

// ----------------------------------------------------------------
// INPUT / OUTPUT TYPES
// ----------------------------------------------------------------

export interface ChiefOfStaffInput {
  taskDescription: string;
  urgency: "URGENT" | "HIGH" | "NORMAL" | "LOW";
  requestType:
    | "ROUTE_TASK"
    | "STATUS_INQUIRY"
    | "ORCHESTRATE_WORKFLOW"
    | "ADVISORY"
    | "BRIEFING_REQUEST";
  attachments?: { name: string; content: string; type: string }[];
  preferredWorkflow?: WorkflowType;
}

export interface ChiefOfStaffOutput {
  interpretation: string;
  recommendedWorkflow?: WorkflowType;
  handoffPlan: AgentHandoff[];
  immediateActions: string[];
  riskFlags: string[];
  estimatedComplexity: "LOW" | "MEDIUM" | "HIGH";
  requiresManagementBriefing: boolean;
  executiveSummary: string;
}

// ----------------------------------------------------------------
// AGENT
// ----------------------------------------------------------------

export class ChiefOfStaffAgent extends BaseAgent<
  ChiefOfStaffInput,
  ChiefOfStaffOutput
> {
  readonly agentId: AgentId = "chief-of-staff";
  readonly displayName = "IR Chief of Staff Agent";
  readonly mission =
    "Orchestrate all IR workstreams, triage incoming requests, route tasks to specialist agents, monitor workflow health, and provide executive-level situational awareness to the Head of IR and CFO.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "read_disclosure_calendar",
      "read_filing_library",    // using available tool names
      "read_audit_log",
      "trigger_escalation",
      "send_internal_notification",
      "search_knowledge_base",
    ],
    restrictedActions: [
      "PUBLISH_EXTERNAL",
      "FILE_WITH_REGULATOR",
      "APPROVE_OWN_OUTPUT",
      "BYPASS_COMPLIANCE_GATE",
      "MODIFY_AUDIT_LOG",
    ],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: false,
    requiresApprovalBefore: ["PUBLISH_EXTERNAL", "FILE_WITH_REGULATOR"],
  };

  getSystemPrompt(context: AgentContext): string {
    return CHIEF_OF_STAFF_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<ChiefOfStaffInput>
  ): Promise<ChiefOfStaffOutput> {
    const { input, context } = request;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 4096,
      system: this.getSystemPrompt(context),
      messages: [
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse structured output from model
    return this.parseOutput(rawText, input);
  }

  private parseOutput(
    raw: string,
    input: ChiefOfStaffInput
  ): ChiefOfStaffOutput {
    try {
      // Extract JSON block if wrapped in markdown
      const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      return JSON.parse(jsonStr) as ChiefOfStaffOutput;
    } catch {
      // Fallback: build a minimal structured response
      return {
        interpretation: raw.slice(0, 500),
        handoffPlan: [],
        immediateActions: [],
        riskFlags: [],
        estimatedComplexity: "MEDIUM",
        requiresManagementBriefing: input.urgency === "URGENT",
        executiveSummary: raw.slice(0, 200),
      };
    }
  }
}
