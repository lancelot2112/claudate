import { EventEmitter } from 'events';
import { BaseAgent } from '../base/Agent.js';
import { AgentContext, AgentResult, AgentCapability } from '../../types/Agent.js';
import logger from '../../utils/logger.js';

export interface AgentRegistration {
  agent: BaseAgent;
  capabilities: AgentCapability[];
  availability: 'available' | 'busy' | 'offline';
  lastActivity: Date;
  performance: {
    successRate: number;
    averageResponseTime: number;
    tasksCompleted: number;
  };
}

export interface TaskRouting {
  taskId: string;
  requiredCapabilities: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  context: AgentContext;
  assignedAgent?: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  result?: AgentResult;
  handoffHistory: Array<{
    fromAgent: string;
    toAgent: string;
    reason: string;
    timestamp: Date;
  }>;
}

export interface HandoffRequest {
  taskId: string;
  fromAgent: string;
  reason: string;
  requiredCapabilities: string[];
  context: AgentContext;
  urgency: 'low' | 'medium' | 'high';
}

export class AgentCoordinator extends EventEmitter {
  private agents: Map<string, AgentRegistration> = new Map();
  private activeTasks: Map<string, TaskRouting> = new Map();
  private taskQueue: TaskRouting[] = [];
  private handoffRequests: Map<string, HandoffRequest> = new Map();
  private coordinatorId: string;

  constructor() {
    super();
    this.coordinatorId = `coordinator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Start background processes
    this.startTaskProcessor();
    this.startHealthMonitor();
    
    logger.info('AgentCoordinator initialized', { coordinatorId: this.coordinatorId });
  }

  public registerAgent(agent: BaseAgent): void {
    const registration: AgentRegistration = {
      agent,
      capabilities: [], // Will be populated from getCapabilities()
      availability: 'available',
      lastActivity: new Date(),
      performance: {
        successRate: 1.0,
        averageResponseTime: 0,
        tasksCompleted: 0
      }
    };

    this.agents.set(agent.id, registration);
    
    // Set up event listeners for agent status updates
    agent.on('status-changed', (status) => {
      this.updateAgentAvailability(agent.id, status === 'idle' ? 'available' : 'busy');
    });

    agent.on('task-completed', (result: AgentResult) => {
      this.handleTaskCompletion(agent.id, result);
    });

    agent.on('handoff-request', (request: HandoffRequest) => {
      this.handleHandoffRequest(request);
    });

    logger.info('Agent registered', { 
      agentId: agent.id, 
      agentName: agent.name,
      coordinatorId: this.coordinatorId 
    });

    this.emit('agent-registered', { agentId: agent.id, agentName: agent.name });
  }

  public unregisterAgent(agentId: string): void {
    const registration = this.agents.get(agentId);
    if (registration) {
      registration.availability = 'offline';
      
      // Handle any active tasks for this agent
      for (const [taskId, task] of this.activeTasks) {
        if (task.assignedAgent === agentId && task.status === 'in_progress') {
          this.handleAgentFailure(agentId, taskId, 'Agent went offline');
        }
      }
      
      this.agents.delete(agentId);
      logger.info('Agent unregistered', { agentId, coordinatorId: this.coordinatorId });
      this.emit('agent-unregistered', { agentId });
    }
  }

  public async submitTask(
    requiredCapabilities: string[],
    context: AgentContext,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    deadline?: Date
  ): Promise<string> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const task: TaskRouting = {
      taskId,
      requiredCapabilities,
      priority,
      deadline,
      context,
      status: 'pending',
      handoffHistory: []
    };

    this.activeTasks.set(taskId, task);
    this.taskQueue.push(task);
    
    // Sort queue by priority and deadline
    this.taskQueue.sort((a, b) => {
      const priorityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityWeight[a.priority];
      const bPriority = priorityWeight[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // If same priority, sort by deadline
      if (a.deadline && b.deadline) {
        return a.deadline.getTime() - b.deadline.getTime();
      }
      
      return 0;
    });

    logger.info('Task submitted', { 
      taskId, 
      requiredCapabilities, 
      priority,
      coordinatorId: this.coordinatorId 
    });

    this.emit('task-submitted', { taskId, requiredCapabilities, priority });
    return taskId;
  }

  private async selectAgent(requiredCapabilities: string[]): Promise<string | null> {
    const availableAgents = Array.from(this.agents.entries())
      .filter(([_, registration]) => registration.availability === 'available')
      .map(([agentId, registration]) => ({ agentId, registration }));

    if (availableAgents.length === 0) {
      return null;
    }

    // Score agents based on capability match and performance
    const scoredAgents = await Promise.all(
      availableAgents.map(async ({ agentId, registration }) => {
        const agentCapabilities = await registration.agent.getCapabilities();
        
        // Calculate capability match score
        const matchedCapabilities = requiredCapabilities.filter(req =>
          agentCapabilities.some(cap => cap.toLowerCase().includes(req.toLowerCase()))
        );
        const capabilityScore = matchedCapabilities.length / requiredCapabilities.length;
        
        // Calculate performance score
        const performanceScore = (
          registration.performance.successRate * 0.6 +
          (1 / Math.max(registration.performance.averageResponseTime / 1000, 1)) * 0.4
        );
        
        const totalScore = capabilityScore * 0.7 + performanceScore * 0.3;
        
        return {
          agentId,
          score: totalScore,
          capabilityMatch: capabilityScore,
          performance: performanceScore
        };
      })
    );

    // Sort by score and return best match
    scoredAgents.sort((a, b) => b.score - a.score);
    
    const bestAgent = scoredAgents[0];
    if (scoredAgents.length > 0 && bestAgent && bestAgent.score > 0) {
      return bestAgent.agentId;
    }

    return null;
  }

  private async assignTask(task: TaskRouting): Promise<boolean> {
    const selectedAgentId = await this.selectAgent(task.requiredCapabilities);
    
    if (!selectedAgentId) {
      logger.warn('No suitable agent found for task', { 
        taskId: task.taskId, 
        requiredCapabilities: task.requiredCapabilities 
      });
      return false;
    }

    const registration = this.agents.get(selectedAgentId);
    if (!registration || registration.availability !== 'available') {
      logger.warn('Selected agent not available', { 
        taskId: task.taskId, 
        selectedAgentId 
      });
      return false;
    }

    // Assign task to agent
    task.assignedAgent = selectedAgentId;
    task.status = 'assigned';
    
    // Update agent availability
    this.updateAgentAvailability(selectedAgentId, 'busy');
    
    // Execute task
    try {
      task.status = 'in_progress';
      logger.info('Task assigned and started', { 
        taskId: task.taskId, 
        agentId: selectedAgentId 
      });
      
      this.emit('task-assigned', { taskId: task.taskId, agentId: selectedAgentId });
      
      // Execute task asynchronously
      registration.agent.executeTask(task.context)
        .then(result => this.handleTaskCompletion(selectedAgentId, result))
        .catch(error => this.handleTaskError(selectedAgentId, task.taskId, error));
      
      return true;
    } catch (error) {
      logger.error('Failed to start task execution', { 
        taskId: task.taskId, 
        agentId: selectedAgentId, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      task.status = 'failed';
      this.updateAgentAvailability(selectedAgentId, 'available');
      return false;
    }
  }

  private handleTaskCompletion(agentId: string, result: AgentResult): void {
    const task = Array.from(this.activeTasks.values())
      .find(t => t.assignedAgent === agentId && t.status === 'in_progress');
    
    if (!task) {
      logger.warn('No active task found for agent completion', { agentId });
      return;
    }

    task.result = result;
    task.status = result.success ? 'completed' : 'failed';
    
    // Update agent performance metrics
    this.updateAgentPerformance(agentId, result);
    
    // Make agent available again
    this.updateAgentAvailability(agentId, 'available');
    
    logger.info('Task completed', { 
      taskId: task.taskId, 
      agentId, 
      success: result.success 
    });

    this.emit('task-completed', { 
      taskId: task.taskId, 
      agentId, 
      result 
    });

    // If task failed and retries are available, consider reassignment
    if (!result.success && this.shouldRetryTask(task)) {
      this.retryTask(task);
    }
  }

  private handleTaskError(agentId: string, taskId: string, error: Error): void {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.result = {
      success: false,
      error: error.message,
      agentId,
      timestamp: Date.now()
    };

    this.updateAgentAvailability(agentId, 'available');
    
    logger.error('Task execution error', { 
      taskId, 
      agentId, 
      error: error.message 
    });

    this.emit('task-failed', { taskId, agentId, error: error.message });

    if (this.shouldRetryTask(task)) {
      this.retryTask(task);
    }
  }

  private handleHandoffRequest(request: HandoffRequest): void {
    const task = this.activeTasks.get(request.taskId);
    if (!task) {
      logger.warn('Handoff request for unknown task', { taskId: request.taskId });
      return;
    }

    this.handoffRequests.set(request.taskId, request);
    
    logger.info('Handoff request received', { 
      taskId: request.taskId, 
      fromAgent: request.fromAgent, 
      reason: request.reason 
    });

    this.processHandoff(request);
  }

  private async processHandoff(request: HandoffRequest): Promise<void> {
    const task = this.activeTasks.get(request.taskId);
    if (!task) return;

    // Find a suitable agent for handoff
    const newAgentId = await this.selectAgent(request.requiredCapabilities);
    
    if (!newAgentId) {
      logger.warn('No suitable agent found for handoff', { 
        taskId: request.taskId, 
        requiredCapabilities: request.requiredCapabilities 
      });
      return;
    }

    // Record handoff
    task.handoffHistory.push({
      fromAgent: request.fromAgent,
      toAgent: newAgentId,
      reason: request.reason,
      timestamp: new Date()
    });

    // Update task assignment
    const oldAgentId = task.assignedAgent;
    task.assignedAgent = newAgentId;
    
    // Update agent availabilities
    if (oldAgentId) {
      this.updateAgentAvailability(oldAgentId, 'available');
    }
    this.updateAgentAvailability(newAgentId, 'busy');

    // Start task on new agent
    const newAgent = this.agents.get(newAgentId)?.agent;
    if (newAgent) {
      try {
        newAgent.executeTask(request.context)
          .then(result => this.handleTaskCompletion(newAgentId, result))
          .catch(error => this.handleTaskError(newAgentId, request.taskId, error));
        
        logger.info('Task handed off successfully', { 
          taskId: request.taskId, 
          fromAgent: request.fromAgent, 
          toAgent: newAgentId 
        });

        this.emit('task-handoff', { 
          taskId: request.taskId, 
          fromAgent: request.fromAgent, 
          toAgent: newAgentId, 
          reason: request.reason 
        });
      } catch (error) {
        logger.error('Handoff execution failed', { 
          taskId: request.taskId, 
          newAgentId, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    this.handoffRequests.delete(request.taskId);
  }

  private shouldRetryTask(task: TaskRouting): boolean {
    // Basic retry logic - can be enhanced
    return task.handoffHistory.length < 3 && task.priority !== 'low';
  }

  private retryTask(task: TaskRouting): void {
    task.status = 'pending';
    task.assignedAgent = undefined;
    this.taskQueue.unshift(task); // Add to front of queue for immediate retry
    
    logger.info('Task queued for retry', { taskId: task.taskId });
  }

  private handleAgentFailure(agentId: string, taskId: string, reason: string): void {
    const task = this.activeTasks.get(taskId);
    if (!task) return;

    logger.warn('Agent failure detected', { agentId, taskId, reason });

    // Mark task for reassignment
    task.status = 'pending';
    task.assignedAgent = undefined;
    this.taskQueue.unshift(task);

    this.emit('agent-failure', { agentId, taskId, reason });
  }

  private updateAgentAvailability(agentId: string, availability: 'available' | 'busy' | 'offline'): void {
    const registration = this.agents.get(agentId);
    if (registration) {
      registration.availability = availability;
      registration.lastActivity = new Date();
      
      this.emit('agent-availability-changed', { agentId, availability });
    }
  }

  private updateAgentPerformance(agentId: string, result: AgentResult): void {
    const registration = this.agents.get(agentId);
    if (!registration) return;

    const performance = registration.performance;
    const newTaskCount = performance.tasksCompleted + 1;
    
    // Update success rate
    const currentSuccesses = performance.successRate * performance.tasksCompleted;
    const newSuccesses = currentSuccesses + (result.success ? 1 : 0);
    performance.successRate = newSuccesses / newTaskCount;
    
    // Update average response time
    const responseTime = Date.now() - result.timestamp;
    performance.averageResponseTime = 
      (performance.averageResponseTime * performance.tasksCompleted + responseTime) / newTaskCount;
    
    performance.tasksCompleted = newTaskCount;
  }

  private startTaskProcessor(): void {
    setInterval(async () => {
      if (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift();
        if (task) {
          const assigned = await this.assignTask(task);
          if (!assigned) {
            // Put back in queue if couldn't assign
            this.taskQueue.unshift(task);
          }
        }
      }
    }, 1000); // Process every second
  }

  private startHealthMonitor(): void {
    setInterval(() => {
      const now = new Date();
      for (const [agentId, registration] of this.agents) {
        const timeSinceLastActivity = now.getTime() - registration.lastActivity.getTime();
        
        // Mark agent as offline if no activity for 5 minutes
        if (timeSinceLastActivity > 300000 && registration.availability !== 'offline') {
          logger.warn('Agent marked as offline due to inactivity', { agentId });
          this.updateAgentAvailability(agentId, 'offline');
        }
      }
    }, 60000); // Check every minute
  }

  public getAgentStatus(): Array<{ agentId: string; status: AgentRegistration }> {
    return Array.from(this.agents.entries()).map(([agentId, registration]) => ({
      agentId,
      status: registration
    }));
  }

  public getTaskStatus(taskId: string): TaskRouting | undefined {
    return this.activeTasks.get(taskId);
  }

  public getAllActiveTasks(): TaskRouting[] {
    return Array.from(this.activeTasks.values());
  }

  public getQueueStatus(): { pending: number; inProgress: number; completed: number; failed: number } {
    const tasks = Array.from(this.activeTasks.values());
    return {
      pending: tasks.filter(t => t.status === 'pending').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length
    };
  }
}

export default AgentCoordinator;