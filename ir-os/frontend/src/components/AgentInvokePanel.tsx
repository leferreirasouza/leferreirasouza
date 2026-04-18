import { useState } from "react";
import { agentsApi } from "../api/agents";
import type { AgentDefinition, AgentResponse } from "../api/types";
import { useCompany } from "../contexts/CompanyContext";
import { AgentResponseViewer } from "./AgentResponseViewer";

const AGENT_ACTIONS: Record<string, string[]> = {
  "chief-of-staff": ["ROUTE_REQUEST", "ORCHESTRATE", "PRIORITIZE", "BRIEF_SUMMARY"],
  "disclosure-gatekeeper": ["COMPLIANCE_CHECK", "CLASSIFICATION_REVIEW", "PUBLISH_CLEARANCE"],
  "disclosure-drafting": ["PRESS_RELEASE", "EARNINGS_SCRIPT", "FATO_RELEVANTE", "INVESTOR_BRIEF", "BOARD_BRIEF"],
  "earnings-cycle": ["DATA_COLLECTION", "NARRATIVE_DEVELOPMENT", "SCRIPT_DRAFTING", "Q_AND_A_PREP", "REHEARSAL"],
  "valuation-strategy": ["DCF_ANALYSIS", "COMPARABLE_COMPANIES", "ROIC_EVA_ANALYSIS", "CAPITAL_ALLOCATION_AUDIT", "STRATEGIC_POSITIONING", "SCENARIO_ANALYSIS", "SUM_OF_PARTS", "CREDIT_ANALYSIS"],
  "knowledge-librarian": ["SEARCH", "SYNTHESIS", "GAP_ANALYSIS", "BRIEF"],
  "news-intelligence": ["SCAN_MARKET_NEWS", "PEER_MONITORING", "SECTOR_WATCH", "REGULATORY_WATCH", "MACRO_WATCH"],
  "self-development": ["ANALYZE_QUALITY_SIGNALS", "IDENTIFY_KNOWLEDGE_GAPS", "PROPOSE_IMPROVEMENTS", "GENERATE_LEARNING_REPORT"],
  "consensus-sellside": ["CONSENSUS_PULL", "ESTIMATE_ANALYSIS", "REVISION_TRACKER"],
  "market-intelligence": ["MARKET_SCAN", "PEER_ANALYSIS", "SECTOR_TRENDS"],
  "meeting-prep": ["INVESTOR_BRIEF", "QUESTION_PREP", "TALKING_POINTS"],
  "investor-targeting": ["TARGETING_ANALYSIS", "OUTREACH_PLAN"],
  "perception": ["PERCEPTION_AUDIT", "SENTIMENT_ANALYSIS", "GAP_ANALYSIS"],
  "capital-allocation": ["ALLOCATION_REVIEW", "DIVIDEND_ANALYSIS", "BUYBACK_ANALYSIS"],
  "ir-website": ["CONTENT_AUDIT", "UPDATE_DRAFT", "SEO_ANALYSIS"],
  "shareholder-agm": ["AGM_PREP", "RESOLUTION_REVIEW", "PROXY_ANALYSIS"],
  "special-situations": ["SITUATION_ASSESSMENT", "COMMUNICATION_PLAN", "STAKEHOLDER_MAP"],
};

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_QUARTER = Math.ceil((new Date().getMonth() + 1) / 3) as 1 | 2 | 3 | 4;

interface Props {
  agent: AgentDefinition;
  onClose: () => void;
}

export function AgentInvokePanel({ agent, onClose }: Props) {
  const { activeCompany } = useCompany();
  const actions = AGENT_ACTIONS[agent.agentId] ?? [];
  const [action, setAction] = useState(actions[0] ?? "");
  const [year, setYear] = useState(CURRENT_YEAR);
  const [quarter, setQuarter] = useState(CURRENT_QUARTER);
  const [inputJson, setInputJson] = useState("{}");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AgentResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResponse(null);
    setLoading(true);
    try {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(inputJson);
      } catch {
        throw new Error("Invalid JSON in input field");
      }

      const label = `${quarter}Q${String(year).slice(2)}`;
      const result = await agentsApi.invoke(agent.agentId, {
        input: { ...parsed, ...(action ? { action } : {}) },
        context: {
          companyId: activeCompany?.company_id,
          currentPeriod: { year, quarter, label },
        },
      });
      setResponse(result.response);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <div>
            <p className="font-semibold text-slate-900">{agent.name}</p>
            <p className="text-xs text-slate-500 font-mono">{agent.agentId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-4 border-b border-slate-200">
            <div className="grid grid-cols-2 gap-4">
              {actions.length > 0 ? (
                <div>
                  <label className="label">Action</label>
                  <select
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    className="input"
                  >
                    {actions.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="label">Action (optional)</label>
                  <input
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                    placeholder="e.g. ANALYZE"
                    className="input"
                  />
                </div>
              )}

              <div>
                <label className="label">Fiscal Period</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    className="input w-24"
                    min={2020} max={2030}
                  />
                  <select
                    value={quarter}
                    onChange={(e) => setQuarter(Number(e.target.value) as 1 | 2 | 3 | 4)}
                    className="input flex-1"
                  >
                    <option value={1}>Q1</option>
                    <option value={2}>Q2</option>
                    <option value={3}>Q3</option>
                    <option value={4}>Q4</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="label">Input Payload (JSON)</label>
              <textarea
                value={inputJson}
                onChange={(e) => setInputJson(e.target.value)}
                rows={6}
                spellCheck={false}
                className="input font-mono text-xs resize-y"
                placeholder='{"instructions": "...", "financialData": {}}'
              />
            </div>

            <div className="flex items-center gap-3">
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Invoking…
                  </span>
                ) : "Invoke Agent"}
              </button>
              {activeCompany && (
                <span className="text-xs text-slate-500">
                  Company: <strong>{activeCompany.ticker}</strong>
                </span>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
          </form>

          {/* Response */}
          {response && (
            <div className="p-5">
              <AgentResponseViewer response={response} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
