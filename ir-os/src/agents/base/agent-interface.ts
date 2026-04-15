import Anthropic from "@anthropic-ai/sdk";
import type {
  AgentId,
  AgentRequest,
  AgentResponse,
  AgentPermissions,
  AgentContext,
  ToolName,
} from "../../types";
import { ComplianceEngine } from "../../compliance/engine";
import { AuditLogger } from "../../audit/logger";

// ----------------------------------------------------------------
// BASE AGENT CLASS
// All specialist agents extend this.
// ----------------------------------------------------------------

export abstract class BaseAgent<TInput = unknown, TOutput = unknown> {
  abstract readonly agentId: AgentId;
  abstract readonly displayName: string;
  abstract readonly mission: string;
  abstract readonly permissions: AgentPermissions;

  protected readonly anthropic: Anthropic;
  protected readonly compliance: ComplianceEngine;
  protected readonly audit: AuditLogger;

  constructor(
    anthropic: Anthropic,
    compliance: ComplianceEngine,
    audit: AuditLogger
  ) {
    this.anthropic = anthropic;
    this.compliance = compliance;
    this.audit = audit;
  }

  /**
   * Entry point for all agent calls.
   * Enforces: audit logging, compliance pre-check, tool permission check,
   * compliance post-check, and escalation routing.
   */
  async run(request: AgentRequest<TInput>): Promise<AgentResponse<TOutput>> {
    const startMs = Date.now();

    // 1. Audit: agent called
    await this.audit.log({
      eventType: "AGENT_CALLED",
      agentId: this.agentId,
      userId: request.requestedBy,
      workflowId: request.context.sessionId,
      action: `${this.agentId} called with requestId=${request.requestId}`,
      after: { input: request.input },
      traceId: request.context.traceId,
    });

    // 2. Pre-flight compliance check on input
    const inputCheck = await this.compliance.checkInput(
      request.input,
      request.context,
      this.permissions
    );
    if (inputCheck.blocked) {
      const resp = this.buildBlockedResponse(request, inputCheck.reason, startMs);
      await this.audit.log({
        eventType: "COMPLIANCE_CHECK_FAILED",
        agentId: this.agentId,
        action: `Input blocked: ${inputCheck.reason}`,
        traceId: request.context.traceId,
      });
      return resp as AgentResponse<TOutput>;
    }

    // 3. Execute core agent logic
    const output = await this.execute(request);

    // 4. Post-flight compliance check on output
    const outputCheck = await this.compliance.checkOutput(
      output,
      request.context,
      this.permissions
    );

    // 5. Apply compliance enrichment (red flags, classification, etc.)
    const classified = outputCheck.classification;

    // 6. Audit: agent responded
    await this.audit.log({
      eventType: "AGENT_RESPONDED",
      agentId: this.agentId,
      userId: request.requestedBy,
      action: `${this.agentId} completed requestId=${request.requestId}`,
      after: { outputClassification: classified },
      traceId: request.context.traceId,
    });

    const response: AgentResponse<TOutput> = {
      requestId: request.requestId,
      agentId: this.agentId,
      output: output as TOutput,
      classification: classified,
      processingMs: Date.now() - startMs,
      completedAt: new Date().toISOString(),
      handoffs: outputCheck.handoffs ?? [],
      escalations: outputCheck.escalations ?? [],
    };

    return response;
  }

  /**
   * Core logic implemented by each specialist agent.
   */
  protected abstract execute(request: AgentRequest<TInput>): Promise<TOutput>;

  /**
   * System prompt injected for this agent.
   */
  abstract getSystemPrompt(context: AgentContext): string;

  /**
   * Checks whether the agent has permission to use a given tool.
   */
  protected assertToolAllowed(tool: ToolName): void {
    if (!this.permissions.allowedTools.includes(tool)) {
      throw new Error(
        `Agent ${this.agentId} does not have permission to use tool: ${tool}`
      );
    }
  }

  /**
   * Builds a compliance-blocked response with appropriate messaging.
   * Output is marked DRAFT_INTERNAL and requires escalation.
   */
  private buildBlockedResponse(
    request: AgentRequest<TInput>,
    reason: string,
    startMs: number
  ): AgentResponse<unknown> {
    return {
      requestId: request.requestId,
      agentId: this.agentId,
      output: {
        blocked: true,
        reason,
        message:
          "This request was blocked by the compliance engine. A human review is required.",
      },
      classification: {
        classification: "DRAFT_INTERNAL",
        confidence: "HIGH",
        draftStatus: "PENDING_COMPLIANCE_REVIEW",
        sources: [],
        redFlags: [
          {
            code: "MNPI_INDICATOR",
            severity: "BLOCK",
            description: reason,
            triggeredBy: "compliance-engine",
          },
        ],
        requiresHumanApproval: true,
        approvalLevel: "HEAD_OF_IR",
      },
      processingMs: Date.now() - startMs,
      completedAt: new Date().toISOString(),
      handoffs: [],
      escalations: [],
    };
  }
}
