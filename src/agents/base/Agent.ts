import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  IAgent,
  AgentConfig,
  AgentStatus,
  AgentMemory,
  AgentContext,
  AgentResponse,
  AgentHandoff,
  AgentCapability,
  Task,
} from '@/types/Agent';
import { BaseMessage, AgentType, AgentError } from '@/types/common';
import { agentLogger, logAgentAction, logError } from '@/utils/logger';

export abstract class BaseAgent extends EventEmitter implements IAgent {
  public readonly id: string;
  public readonly type: AgentType;
  public readonly config: AgentConfig;
  
  protected _status: AgentStatus;
  protected _memory: AgentMemory;
  protected _isInitialized = false;
  protected _activeTasks = new Map<string, Task>();
  protected _startTime = Date.now();

  constructor(config: AgentConfig) {
    super();
    this.id = config.id;
    this.type = config.type;
    this.config = config;

    // Initialize status
    this._status = {
      id: this.id,
      status: 'offline',
      activeTasks: 0,
      lastActivity: new Date(),
      uptime: 0,
      errors: 0,
      tasksCompleted: 0,
      averageResponseTime: 0,
    };

    // Initialize memory
    this._memory = {
      shortTerm: new Map(),
      mediumTerm: new Map(),
      contextWindow: [],
      userPreferences: {},
      decisionHistory: [],
    };

    agentLogger.info(`Agent ${this.id} created`, {
      agentId: this.id,
      type: this.type,
      name: config.name,
    });
  }

  public get status(): AgentStatus {
    return {
      ...this._status,
      uptime: this._isInitialized ? Date.now() - this._startTime : 0,
      activeTasks: this._activeTasks.size,
    };
  }

  public get memory(): AgentMemory {
    return this._memory;
  }

  public async initialize(): Promise<void> {
    try {
      logAgentAction(this.id, 'initialize', { type: this.type });
      
      await this.onInitialize();
      
      this._status.status = 'idle';
      this._status.lastActivity = new Date();
      this._isInitialized = true;
      
      this.emit('initialized', this.id);
      agentLogger.info(`Agent ${this.id} initialized successfully`);
    } catch (error) {
      this._status.status = 'error';
      this._status.errors++;
      logError(error as Error, `Agent ${this.id} initialization`);
      throw new AgentError(`Failed to initialize agent ${this.id}`, this.id);
    }
  }

  public async shutdown(): Promise<void> {
    try {
      logAgentAction(this.id, 'shutdown');
      
      // Cancel all active tasks
      for (const [taskId, task] of this._activeTasks) {
        task.status = 'cancelled';
        this.emit('taskCancelled', taskId, this.id);
      }
      this._activeTasks.clear();

      await this.onShutdown();
      
      this._status.status = 'offline';
      this._isInitialized = false;
      
      this.emit('shutdown', this.id);
      agentLogger.info(`Agent ${this.id} shutdown successfully`);
    } catch (error) {
      logError(error as Error, `Agent ${this.id} shutdown`);
      throw new AgentError(`Failed to shutdown agent ${this.id}`, this.id);
    }
  }

  public async processMessage(
    message: BaseMessage,
    context: AgentContext
  ): Promise<AgentResponse> {
    if (!this._isInitialized) {
      throw new AgentError(`Agent ${this.id} is not initialized`, this.id);
    }

    if (this._status.status !== 'idle' && this._activeTasks.size >= this.config.maxConcurrentTasks) {
      throw new AgentError(`Agent ${this.id} is at maximum capacity`, this.id);
    }

    const startTime = Date.now();
    this._status.status = 'busy';
    this._status.lastActivity = new Date();

    try {
      logAgentAction(this.id, 'processMessage', {
        messageId: message.id,
        messageType: message.type,
        urgency: message.urgency,
      });

      // Add message to context window
      this._memory.contextWindow.push(message);
      if (this._memory.contextWindow.length > context.contextWindow) {
        this._memory.contextWindow = this._memory.contextWindow.slice(-context.contextWindow);
      }

      // Process the message using the specific agent implementation
      const response = await this.onProcessMessage(message, context);

      // Update statistics
      const processingTime = Date.now() - startTime;
      this._status.tasksCompleted++;
      this._status.averageResponseTime = this.calculateAverageResponseTime(processingTime);
      this._status.status = this._activeTasks.size > 0 ? 'busy' : 'idle';

      this.emit('messageProcessed', message.id, this.id, response);
      
      return {
        ...response,
        processingTime,
      };
    } catch (error) {
      this._status.errors++;
      this._status.status = 'error';
      
      logError(error as Error, `Agent ${this.id} message processing`, {
        messageId: message.id,
        agentId: this.id,
      });

      this.emit('messageError', message.id, this.id, error);
      
      return {
        success: false,
        error: (error as Error).message,
        processingTime: Date.now() - startTime,
      };
    }
  }

  public async assignTask(task: Task): Promise<void> {
    if (!this.canHandle(task)) {
      throw new AgentError(`Agent ${this.id} cannot handle task ${task.id}`, this.id);
    }

    if (this._activeTasks.size >= this.config.maxConcurrentTasks) {
      throw new AgentError(`Agent ${this.id} is at maximum capacity`, this.id);
    }

    logAgentAction(this.id, 'assignTask', { taskId: task.id, taskType: task.type });

    task.status = 'in_progress';
    task.assignedAgent = this.id;
    task.startedAt = new Date();

    this._activeTasks.set(task.id, task);
    this._status.status = 'busy';
    this._status.lastActivity = new Date();

    this.emit('taskAssigned', task.id, this.id);

    try {
      await this.onTaskAssigned(task);
    } catch (error) {
      task.status = 'failed';
      task.error = (error as Error).message;
      this._activeTasks.delete(task.id);
      this._status.errors++;
      
      logError(error as Error, `Agent ${this.id} task execution`, { taskId: task.id });
      this.emit('taskFailed', task.id, this.id, error);
    }
  }

  public async handoffTask(
    task: Task,
    targetAgent: string,
    reason: string
  ): Promise<AgentHandoff> {
    logAgentAction(this.id, 'handoffTask', {
      taskId: task.id,
      targetAgent,
      reason,
    });

    const handoff: AgentHandoff = {
      fromAgent: this.id,
      toAgent: targetAgent,
      task,
      context: this.getCurrentContext(),
      reason,
      timestamp: new Date(),
    };

    // Remove task from active tasks
    this._activeTasks.delete(task.id);
    
    // Update status if no more active tasks
    if (this._activeTasks.size === 0) {
      this._status.status = 'idle';
    }

    this.emit('taskHandoff', handoff);
    
    return handoff;
  }

  public updateContext(context: Partial<AgentContext>): void {
    if (context.userPreferences) {
      this._memory.userPreferences = {
        ...this._memory.userPreferences,
        ...context.userPreferences,
      };
    }

    if (context.conversationHistory) {
      this._memory.contextWindow = context.conversationHistory.slice(-this.config.timeout);
    }

    logAgentAction(this.id, 'updateContext', { contextKeys: Object.keys(context) });
  }

  public getCapabilities(): AgentCapability[] {
    return this.config.capabilities;
  }

  public getStatus(): AgentStatus {
    return this.status;
  }

  public canHandle(task: Task): boolean {
    if (!this.config.enabled) return false;
    
    // Check if agent has required capabilities
    const requiredCapabilities = task.metadata?.requiredCapabilities || [];
    const agentCapabilities = this.config.capabilities.map(c => c.name);
    
    return requiredCapabilities.every((cap: string) => agentCapabilities.includes(cap));
  }

  // Protected methods for subclasses to implement
  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
  protected abstract onProcessMessage(
    message: BaseMessage,
    context: AgentContext
  ): Promise<AgentResponse>;
  protected abstract onTaskAssigned(task: Task): Promise<void>;

  // Protected helper methods
  protected getCurrentContext(): AgentContext {
    return {
      sessionId: uuidv4(),
      userId: 'system',
      conversationHistory: this._memory.contextWindow,
      userPreferences: this._memory.userPreferences,
      activeProjects: [],
      recentDecisions: this._memory.decisionHistory.slice(-10),
      contextWindow: this.config.timeout,
      timestamp: new Date(),
    };
  }

  protected completeTask(taskId: string, output?: any): void {
    const task = this._activeTasks.get(taskId);
    if (task) {
      task.status = 'completed';
      task.completedAt = new Date();
      task.output = output;
      
      this._activeTasks.delete(taskId);
      this._status.tasksCompleted++;
      
      if (this._activeTasks.size === 0) {
        this._status.status = 'idle';
      }

      this.emit('taskCompleted', taskId, this.id, output);
      logAgentAction(this.id, 'completeTask', { taskId });
    }
  }

  protected failTask(taskId: string, error: string): void {
    const task = this._activeTasks.get(taskId);
    if (task) {
      task.status = 'failed';
      task.error = error;
      task.completedAt = new Date();
      
      this._activeTasks.delete(taskId);
      this._status.errors++;
      
      if (this._activeTasks.size === 0) {
        this._status.status = 'idle';
      }

      this.emit('taskFailed', taskId, this.id, error);
      logAgentAction(this.id, 'failTask', { taskId, error });
    }
  }

  private calculateAverageResponseTime(newTime: number): number {
    const totalTasks = this._status.tasksCompleted;
    const currentAverage = this._status.averageResponseTime;
    
    if (totalTasks === 1) {
      return newTime;
    }
    
    return Math.round(((currentAverage * (totalTasks - 1)) + newTime) / totalTasks);
  }
}