import { useState } from "react";
import { useAgents } from "../hooks/useAgents";
import type { AgentDefinition } from "../api/types";
import { AgentCard } from "../components/AgentCard";
import { AgentInvokePanel } from "../components/AgentInvokePanel";

export default function AgentsPage() {
  const { agents, loading, error } = useAgents();
  const [selected, setSelected] = useState<AgentDefinition | null>(null);
  const [search, setSearch] = useState("");

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase()) ||
      a.agentId.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Agents</h1>
          <p className="text-sm text-slate-500 mt-0.5">{agents.length} AI agents available</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents…"
          className="input w-56"
        />
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-400">Loading agents…</div>
      )}

      {error && (
        <div className="card p-5 text-center text-red-600 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} onInvoke={setSelected} />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-12 text-slate-400">
              No agents match "{search}"
            </div>
          )}
        </div>
      )}

      {selected && (
        <AgentInvokePanel agent={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
