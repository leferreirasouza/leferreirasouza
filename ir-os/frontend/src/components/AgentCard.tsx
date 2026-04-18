import type { AgentDefinition } from "../api/types";

const AGENT_ICONS: Record<string, string> = {
  "chief-of-staff": "🧭",
  "disclosure-gatekeeper": "🛡",
  "disclosure-drafting": "✍️",
  "earnings-cycle": "📈",
  "knowledge-librarian": "📚",
  "valuation-strategy": "💹",
  "consensus-sellside": "📊",
  "market-intelligence": "🌐",
  "meeting-prep": "🤝",
  "investor-targeting": "🎯",
  "perception": "👁",
  "capital-allocation": "🏦",
  "ir-website": "🌍",
  "shareholder-agm": "🏛",
  "special-situations": "⚡",
  "news-intelligence": "📰",
  "self-development": "🔬",
};

interface Props {
  agent: AgentDefinition;
  onInvoke: (agent: AgentDefinition) => void;
}

export function AgentCard({ agent, onInvoke }: Props) {
  return (
    <div className="card p-4 flex flex-col gap-3 hover:border-blue-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{AGENT_ICONS[agent.agentId] ?? "🤖"}</span>
          <div>
            <p className="font-semibold text-sm text-slate-900">{agent.name}</p>
            <p className="text-xs text-slate-500 font-mono">{agent.agentId}</p>
          </div>
        </div>
        {!agent.canGenerateExternal && (
          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-orange-50 text-orange-700 border border-orange-200">
            Internal only
          </span>
        )}
      </div>

      <p className="text-xs text-slate-600 leading-relaxed flex-1">{agent.description}</p>

      {agent.capabilities?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.capabilities.slice(0, 3).map((c) => (
            <span key={c} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
              {c}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-xs rounded">
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>
      )}

      <button onClick={() => onInvoke(agent)} className="btn-primary justify-center">
        Invoke Agent
      </button>
    </div>
  );
}
