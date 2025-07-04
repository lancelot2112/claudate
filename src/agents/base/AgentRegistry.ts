import { EventEmitter } from 'events';
import { IAgent, IAgentRegistry, AgentStatus, Task } from '@/types/Agent';
import { AgentType, AgentError } from '@/types/common';
import { agentLogger, logError, logAgentAction } from '@/utils/logger';

export class AgentRegistry extends EventEmitter implements IAgentRegistry {
  private agents = new Map<string, IAgent>();
  private agentsByType = new Map<AgentType, Set<string>>();
  private healthCheckInterval?: NodeJS.Timeout;

  constructor() {
    super();
    this.startHealthChecks();
  }

  public async register(agent: IAgent): Promise<void> {
    try {
      if (this.agents.has(agent.id)) {
        throw new AgentError(`Agent with ID ${agent.id} is already registered`);
      }

      // Initialize the agent
      await agent.initialize();

      // Register the agent
      this.agents.set(agent.id, agent);

      // Group by type
      if (!this.agentsByType.has(agent.type)) {
        this.agentsByType.set(agent.type, new Set());
      }
      this.agentsByType.get(agent.type)!.add(agent.id);

      // Set up event listeners
      this.setupAgentEventListeners(agent);

      agentLogger.info(`Agent ${agent.id} registered successfully`, {
        agentId: agent.id,
        type: agent.type,
        name: agent.config.name,
      });

      this.emit('agentRegistered', agent.id, agent.type);
    } catch (error) {
      logError(error as Error, `Failed to register agent ${agent.id}`);
      throw error;
    }
  }

  public async unregister(agentId: string): Promise<void> {
    try {
      const agent = this.agents.get(agentId);
      if (!agent) {
        throw new AgentError(`Agent ${agentId} not found`);
      }

      // Shutdown the agent
      await agent.shutdown();

      // Remove from type grouping
      const typeSet = this.agentsByType.get(agent.type);
      if (typeSet) {
        typeSet.delete(agentId);
        if (typeSet.size === 0) {
          this.agentsByType.delete(agent.type);
        }
      }

      // Remove from main registry
      this.agents.delete(agentId);

      agentLogger.info(`Agent ${agentId} unregistered successfully`, {
        agentId,
        type: agent.type,
      });

      this.emit('agentUnregistered', agentId, agent.type);
    } catch (error) {
      logError(error as Error, `Failed to unregister agent ${agentId}`);
      throw error;
    }
  }

  public getAgent(agentId: string): IAgent | null {
    return this.agents.get(agentId) || null;
  }

  public getAgentsByType(type: AgentType): IAgent[] {
    const agentIds = this.agentsByType.get(type);
    if (!agentIds) {
      return [];
    }

    const agents: IAgent[] = [];
    for (const agentId of agentIds) {
      const agent = this.agents.get(agentId);
      if (agent) {
        agents.push(agent);
      }
    }

    return agents;
  }

  public getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  public getAvailableAgents(): IAgent[] {
    return this.getAllAgents().filter(agent => {
      const status = agent.getStatus();
      return status.status === 'idle' && agent.config.enabled;
    });
  }

  public findBestAgent(task: Task): IAgent | null {
    const availableAgents = this.getAvailableAgents().filter(agent => 
      agent.canHandle(task)
    );

    if (availableAgents.length === 0) {
      return null;
    }

    // Sort by priority (higher is better) and then by load (lower is better)
    availableAgents.sort((a, b) => {
      // First by priority
      const priorityDiff = b.config.priority - a.config.priority;
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // Then by current load
      const loadA = a.getStatus().activeTasks / a.config.maxConcurrentTasks;
      const loadB = b.getStatus().activeTasks / b.config.maxConcurrentTasks;
      return loadA - loadB;
    });

    const selectedAgent = availableAgents[0];
    
    if (selectedAgent) {
      logAgentAction(selectedAgent.id, 'selectedForTask', {
        taskId: task.id,
        taskType: task.type,
        agentType: selectedAgent.type,
      });
    }

    return selectedAgent || null;
  }

  public getAgentStatus(agentId: string): AgentStatus | null {
    const agent = this.agents.get(agentId);
    return agent ? agent.getStatus() : null;
  }

  public getAllAgentStatuses(): Map<string, AgentStatus> {
    const statuses = new Map<string, AgentStatus>();
    
    for (const [agentId, agent] of this.agents) {
      statuses.set(agentId, agent.getStatus());
    }

    return statuses;
  }

  public getRegistryStats(): {
    totalAgents: number;
    agentsByType: Record<string, number>;
    agentsByStatus: Record<string, number>;
    healthyAgents: number;
    busyAgents: number;
  } {
    const totalAgents = this.agents.size;
    const agentsByType: Record<string, number> = {};
    const agentsByStatus: Record<string, number> = {};
    let healthyAgents = 0;
    let busyAgents = 0;

    for (const agent of this.agents.values()) {
      const status = agent.getStatus();
      
      // Count by type
      agentsByType[agent.type] = (agentsByType[agent.type] || 0) + 1;
      
      // Count by status
      agentsByStatus[status.status] = (agentsByStatus[status.status] || 0) + 1;
      
      // Count healthy and busy
      if (status.status === 'idle' || status.status === 'busy') {
        healthyAgents++;
      }
      if (status.status === 'busy') {
        busyAgents++;
      }
    }

    return {
      totalAgents,
      agentsByType,
      agentsByStatus,
      healthyAgents,
      busyAgents,
    };
  }

  public async shutdownAll(): Promise<void> {
    agentLogger.info('Shutting down all agents');

    const shutdownPromises: Promise<void>[] = [];
    
    for (const agent of this.agents.values()) {
      shutdownPromises.push(agent.shutdown().catch(error => {
        logError(error, `Failed to shutdown agent ${agent.id}`);
      }));
    }

    await Promise.all(shutdownPromises);
    
    this.agents.clear();
    this.agentsByType.clear();

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    agentLogger.info('All agents shut down');
    this.emit('allAgentsShutdown');
  }

  private setupAgentEventListeners(agent: IAgent): void {
    agent.on('taskCompleted', (taskId: string, agentId: string, output: any) => {
      this.emit('taskCompleted', { taskId, agentId, output });
    });

    agent.on('taskFailed', (taskId: string, agentId: string, error: any) => {
      this.emit('taskFailed', { taskId, agentId, error });
    });

    agent.on('taskHandoff', (handoff: any) => {
      this.emit('taskHandoff', handoff);
    });

    agent.on('messageProcessed', (messageId: string, agentId: string, response: any) => {
      this.emit('messageProcessed', { messageId, agentId, response });
    });

    agent.on('messageError', (messageId: string, agentId: string, error: any) => {
      this.emit('messageError', { messageId, agentId, error });
    });
  }

  private startHealthChecks(): void {
    // Check agent health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, 30000);
  }

  private performHealthChecks(): void {
    for (const agent of this.agents.values()) {
      try {
        const status = agent.getStatus();
        const now = Date.now();
        const lastActivity = status.lastActivity.getTime();
        const timeSinceActivity = now - lastActivity;

        // If agent hasn't been active for 5 minutes and shows as busy, mark as error
        if (status.status === 'busy' && timeSinceActivity > 300000) {
          agentLogger.warn(`Agent ${agent.id} appears stuck`, {
            agentId: agent.id,
            status: status.status,
            timeSinceActivity,
            activeTasks: status.activeTasks,
          });
          
          this.emit('agentStuck', agent.id, status);
        }

        // If error count is high, emit warning
        if (status.errors > 10) {
          agentLogger.warn(`Agent ${agent.id} has high error count`, {
            agentId: agent.id,
            errors: status.errors,
          });
          
          this.emit('agentHighErrors', agent.id, status);
        }
      } catch (error) {
        logError(error as Error, `Health check failed for agent ${agent.id}`);
      }
    }
  }
}

// Singleton instance
export const agentRegistry = new AgentRegistry();