import type { AgentId } from "../../types";
import type { BaseAgent } from "./agent-interface";

/**
 * Central registry of all live agent instances.
 * Agents are singletons, initialized once at startup.
 * The orchestrator uses this to route tasks.
 */
export class AgentRegistry {
  private static instance: AgentRegistry;
  private agents = new Map<AgentId, BaseAgent>();

  private constructor() {}

  static getInstance(): AgentRegistry {
    if (!AgentRegistry.instance) {
      AgentRegistry.instance = new AgentRegistry();
    }
    return AgentRegistry.instance;
  }

  register(agent: BaseAgent): void {
    if (this.agents.has(agent.agentId)) {
      throw new Error(`Agent ${agent.agentId} is already registered.`);
    }
    this.agents.set(agent.agentId, agent);
  }

  get<T extends BaseAgent>(agentId: AgentId): T {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} is not registered.`);
    }
    return agent as T;
  }

  list(): AgentId[] {
    return Array.from(this.agents.keys());
  }

  has(agentId: AgentId): boolean {
    return this.agents.has(agentId);
  }
}
