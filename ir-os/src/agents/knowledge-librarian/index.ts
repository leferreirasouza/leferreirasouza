import type { AgentId, AgentRequest, AgentContext, AgentPermissions } from "../../types";
import { BaseAgent } from "../base/agent-interface";

export interface KnowledgeLibrarianInput {
  action:
    | "SEARCH_PRECEDENTS"
    | "QA_LOOKUP"
    | "FILING_RETRIEVAL"
    | "MESSAGING_SEARCH"
    | "BOARD_PACK_ASSEMBLY"
    | "INGEST_DOCUMENT";
  query?: string;
  documentType?: string;
  period?: string;
  artifactType?: string;
  documentToIngest?: { title: string; content: string; type: string; classification: string };
}

export interface KnowledgeLibrarianOutput {
  action: string;
  results: KnowledgeResult[];
  boardPack?: BoardPackSection[];
  totalResultsFound: number;
  queryTime_ms: number;
  suggestedNextSteps: string[];
  internalUseOnly: true;
  classification: "INTERNAL_APPROVED" | "PUBLIC";
}

export interface KnowledgeResult {
  resultId: string;
  title: string;
  type: string;
  relevanceScore: number;
  excerpt: string;
  sourceId: string;
  classification: string;
  period?: string;
  retrievedAt: string;
}

export interface BoardPackSection {
  sectionTitle: string;
  content: string;
  sources: string[];
  draftStatus: "DRAFT";
}

export class KnowledgeLibrarianAgent extends BaseAgent<KnowledgeLibrarianInput, KnowledgeLibrarianOutput> {
  readonly agentId: AgentId = "knowledge-librarian";
  readonly displayName = "Knowledge Librarian Agent";
  readonly mission = "Maintain and retrieve from the IR knowledge base: filings, approved messaging, Q&A library, precedents, and historical communications. Assemble board briefing packs from approved sources. Act as the institutional memory of the IR department.";

  readonly permissions: AgentPermissions = {
    allowedTools: ["search_filing_library", "search_approved_messaging", "read_qa_library", "search_knowledge_base", "read_audit_log", "create_draft"],
    restrictedActions: ["PUBLISH_EXTERNAL", "APPROVE_OWN_OUTPUT", "BYPASS_COMPLIANCE_GATE", "MODIFY_AUDIT_LOG"],
    maxClassificationAccess: "INTERNAL_APPROVED",
    canGenerateExternal: false,
    requiresApprovalBefore: ["PUBLISH_EXTERNAL"],
  };

  getSystemPrompt(_ctx: AgentContext): string {
    return `You are the Knowledge Librarian Agent.
Retrieve relevant documents, precedents, and approved messaging from the IR knowledge base.
Cite every result with sourceId and classification. Never return PROHIBITED content.
Output JSON matching KnowledgeLibrarianOutput schema. internalUseOnly = true.`;
  }

  protected async execute(request: AgentRequest<KnowledgeLibrarianInput>): Promise<KnowledgeLibrarianOutput> {
    const start = Date.now();
    const { input, context } = request;
    const response = await this.anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
      max_tokens: 4096,
      system: this.getSystemPrompt(context),
      messages: [{ role: "user", content: JSON.stringify(input) }],
    });
    const rawText = response.content[0].type === "text" ? response.content[0].text : "";
    try {
      const m = rawText.match(/```json\n([\s\S]*?)\n```/);
      const parsed = JSON.parse(m ? m[1] : rawText);
      return { ...parsed, internalUseOnly: true, queryTime_ms: Date.now() - start };
    } catch {
      return {
        action: input.action, results: [], totalResultsFound: 0,
        queryTime_ms: Date.now() - start, suggestedNextSteps: [],
        internalUseOnly: true, classification: "INTERNAL_APPROVED",
      };
    }
  }
}
