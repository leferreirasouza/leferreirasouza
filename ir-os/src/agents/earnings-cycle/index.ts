import type {
  AgentId,
  AgentRequest,
  AgentContext,
  AgentPermissions,
  EarningsPackage,
  FiscalPeriod,
} from "../../types";
import { BaseAgent } from "../base/agent-interface";
import { EARNINGS_CYCLE_SYSTEM_PROMPT } from "./prompts";

// ----------------------------------------------------------------
// INPUT / OUTPUT
// ----------------------------------------------------------------

export interface EarningsCycleInput {
  phase:
    | "KICKOFF"
    | "DATA_COLLECTION"
    | "NARRATIVE_DEVELOPMENT"
    | "COMPLIANCE_REVIEW"
    | "REHEARSAL_PREP"
    | "PUBLICATION_READINESS"
    | "POST_EARNINGS_WRAP";
  period: FiscalPeriod;
  financialData?: Record<string, number>;  // raw KPIs
  managementNarrative?: string;
  guidanceUpdate?: string;
  priorPeriodPackageId?: string;
  consensusSnapshot?: Record<string, number>;
  specialTopics?: string[];   // topics management wants to address
}

export interface EarningsCycleOutput {
  phase: string;
  statusSummary: string;
  completedTasks: EarningsTask[];
  pendingTasks: EarningsTask[];
  blockers: string[];
  draftArtifacts: DraftArtifactRef[];
  complianceCheckpoints: ComplianceCheckpoint[];
  suggestedTimeline: TimelineItem[];
  readinessScore: number;   // 0-100
  readinessNarrative: string;
}

export interface EarningsTask {
  taskId: string;
  title: string;
  ownerAgentId: string;
  ownerRole?: string;
  status: "DONE" | "IN_PROGRESS" | "PENDING" | "BLOCKED";
  dueBy?: string;
  notes?: string;
}

export interface DraftArtifactRef {
  type: string;
  title: string;
  status: string;
  artifactId?: string;
}

export interface ComplianceCheckpoint {
  checkpointId: string;
  description: string;
  passed: boolean;
  blocksRelease: boolean;
  notes?: string;
}

export interface TimelineItem {
  date: string;
  milestone: string;
  owner: string;
  isCritical: boolean;
}

// ----------------------------------------------------------------
// AGENT
// ----------------------------------------------------------------

export class EarningsCycleAgent extends BaseAgent<
  EarningsCycleInput,
  EarningsCycleOutput
> {
  readonly agentId: AgentId = "earnings-cycle";
  readonly displayName = "Earnings Cycle Agent";
  readonly mission =
    "Manage the end-to-end quarterly earnings cycle from kickoff to post-earnings wrap. Coordinate all content creation, compliance reviews, and publication readiness checks. Track phase completion and surface blockers.";

  readonly permissions: AgentPermissions = {
    allowedTools: [
      "read_financial_data",
      "read_consensus_data",
      "search_filing_library",
      "search_approved_messaging",
      "read_qa_library",
      "create_draft",
      "update_draft",
      "submit_for_approval",
      "read_disclosure_calendar",
      "update_disclosure_calendar",
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
      "RELEASE_GUIDANCE",
    ],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: true,    // can produce drafts — cannot publish
    requiresApprovalBefore: [
      "PUBLISH_EXTERNAL",
      "FILE_WITH_REGULATOR",
      "RELEASE_GUIDANCE",
    ],
  };

  getSystemPrompt(context: AgentContext): string {
    return EARNINGS_CYCLE_SYSTEM_PROMPT(context);
  }

  protected async execute(
    request: AgentRequest<EarningsCycleInput>
  ): Promise<EarningsCycleOutput> {
    const { input, context } = request;

    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 6000,
      system: this.getSystemPrompt(context),
      messages: [
        {
          role: "user",
          content: `Earnings cycle phase: ${input.phase}\nPeriod: ${JSON.stringify(input.period)}\n\nFull input:\n${JSON.stringify(input, null, 2)}`,
        },
      ],
    });

    const rawText =
      response.content[0].type === "text" ? response.content[0].text : "";

    return this.parseOutput(rawText, input);
  }

  private parseOutput(raw: string, input: EarningsCycleInput): EarningsCycleOutput {
    try {
      const jsonMatch = raw.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : raw;
      return JSON.parse(jsonStr) as EarningsCycleOutput;
    } catch {
      return {
        phase: input.phase,
        statusSummary: raw.slice(0, 300),
        completedTasks: [],
        pendingTasks: [],
        blockers: ["Output parsing failed — manual review required"],
        draftArtifacts: [],
        complianceCheckpoints: [],
        suggestedTimeline: [],
        readinessScore: 0,
        readinessNarrative: "Unable to assess — see raw output.",
      };
    }
  }
}
