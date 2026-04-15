import { Router } from "express";
import type { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { AgentRegistry } from "../../agents/base/agent-registry";
import { ComplianceEngine } from "../../compliance/engine";
import { AuditLogger } from "../../audit/logger";
import type { AgentRequest, AgentContext, AgentId } from "../../types";

// Import all agents
import { ChiefOfStaffAgent } from "../../agents/chief-of-staff";
import { DisclosureGatekeeperAgent } from "../../agents/disclosure-gatekeeper";
import { EarningsCycleAgent } from "../../agents/earnings-cycle";
import { DisclosureDraftingAgent } from "../../agents/disclosure-drafting";
import { ConsensusSellsideAgent } from "../../agents/consensus-sellside";
import { MarketIntelligenceAgent } from "../../agents/market-intelligence";
import { MeetingPrepAgent } from "../../agents/meeting-prep";
import { InvestorTargetingAgent } from "../../agents/investor-targeting";
import { PerceptionAgent } from "../../agents/perception";
import { CapitalAllocationAgent } from "../../agents/capital-allocation";
import { IRWebsiteAgent } from "../../agents/ir-website";
import { ShareholderAGMAgent } from "../../agents/shareholder-agm";
import { SpecialSituationsAgent } from "../../agents/special-situations";
import { KnowledgeLibrarianAgent } from "../../agents/knowledge-librarian";

// ---- Singletons ----
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const compliance = ComplianceEngine.getInstance();
const audit = AuditLogger.getInstance();

// ---- Register all agents ----
const registry = AgentRegistry.getInstance();
[
  new ChiefOfStaffAgent(anthropic, compliance, audit),
  new DisclosureGatekeeperAgent(anthropic, compliance, audit),
  new EarningsCycleAgent(anthropic, compliance, audit),
  new DisclosureDraftingAgent(anthropic, compliance, audit),
  new ConsensusSellsideAgent(anthropic, compliance, audit),
  new MarketIntelligenceAgent(anthropic, compliance, audit),
  new MeetingPrepAgent(anthropic, compliance, audit),
  new InvestorTargetingAgent(anthropic, compliance, audit),
  new PerceptionAgent(anthropic, compliance, audit),
  new CapitalAllocationAgent(anthropic, compliance, audit),
  new IRWebsiteAgent(anthropic, compliance, audit),
  new ShareholderAGMAgent(anthropic, compliance, audit),
  new SpecialSituationsAgent(anthropic, compliance, audit),
  new KnowledgeLibrarianAgent(anthropic, compliance, audit),
].forEach((a) => {
  if (!registry.has(a.agentId)) registry.register(a);
});

export const agentsRouter = Router();

// ---- LIST AGENTS ----
agentsRouter.get("/", (_req: Request, res: Response) => {
  res.json({ agents: registry.list() });
});

// ---- INVOKE AGENT ----
agentsRouter.post("/:agentId/invoke", async (req: Request, res: Response) => {
  const { agentId } = req.params as { agentId: string };

  if (!registry.has(agentId as AgentId)) {
    res.status(404).json({ error: `Agent '${agentId}' not found.` });
    return;
  }

  const { input, context } = req.body as {
    input: unknown;
    context: Partial<AgentContext>;
  };

  const fullContext: AgentContext = {
    companyId: context.companyId ?? "default",
    ticker: context.ticker ?? "UNKNOWN",
    exchange: context.exchange ?? "B3",
    reportingCurrency: context.reportingCurrency ?? "BRL",
    fiscalYearEnd: context.fiscalYearEnd ?? "12-31",
    currentPeriod: context.currentPeriod ?? { year: 2025, quarter: 1, label: "1Q25" },
    sessionId: `session-${Date.now()}`,
    traceId: `trace-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    authorizedDataSources: context.authorizedDataSources ?? ["PUBLIC", "INTERNAL_APPROVED"],
    operatingMode: context.operatingMode ?? "INTERNAL_ADVISORY",
  };

  const request: AgentRequest = {
    requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    agentId: agentId as AgentId,
    requestedBy: req.user!.userId,
    mode: fullContext.operatingMode,
    input,
    context: fullContext,
    calledAt: new Date().toISOString(),
  };

  try {
    const agent = registry.get(agentId as AgentId);
    const response = await agent.run(request);
    res.json({ response });
  } catch (err) {
    console.error(`[AGENT ERROR] ${agentId}:`, err);
    res.status(500).json({ error: "Agent execution failed. See audit log." });
  }
});
