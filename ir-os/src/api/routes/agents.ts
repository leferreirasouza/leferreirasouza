import { Router } from "express";
import type { Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { AgentRegistry } from "../../agents/base/agent-registry";
import { ComplianceEngine } from "../../compliance/engine";
import { AuditLogger } from "../../audit/logger";
import type { AgentRequest, AgentContext, AgentId, FiscalPeriod } from "../../types";
import { CompanyRepository } from "../../data/repositories/company-repository";

const companyRepo = new CompanyRepository();

/** Derive the current fiscal quarter from today's date. */
function inferCurrentPeriod(): FiscalPeriod {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12
  const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4;
  return { year, quarter, label: `${quarter}Q${String(year).slice(2)}` };
}

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
import { ValuationStrategyAgent } from "../../agents/valuation-strategy";
import { NewsIntelligenceAgent } from "../../agents/news-intelligence";
import { SelfDevelopmentAgent } from "../../agents/self-development";

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
  new ValuationStrategyAgent(anthropic, compliance, audit),
  new NewsIntelligenceAgent(anthropic, compliance, audit),
  new SelfDevelopmentAgent(anthropic, compliance, audit),
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

  // Resolve company: request body > JWT default > reject
  const companyId = context.companyId ?? req.user!.companyId;
  if (!companyId) {
    res.status(400).json({
      error: "companyId is required. Pass it in context.companyId or authenticate with a company-scoped token.",
    });
    return;
  }

  // Hydrate AgentContext from the companies table
  const company = companyRepo.findById(companyId);
  if (!company) {
    res.status(404).json({ error: `Company '${companyId}' not found. Register it with POST /api/v1/companies.` });
    return;
  }

  const fullContext: AgentContext = {
    companyId: company.company_id,
    ticker: company.ticker,
    exchange: company.exchange as AgentContext["exchange"],
    reportingCurrency: company.currency as AgentContext["reportingCurrency"],
    fiscalYearEnd: company.fiscal_year_end,
    currentPeriod: context.currentPeriod ?? inferCurrentPeriod(),
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
