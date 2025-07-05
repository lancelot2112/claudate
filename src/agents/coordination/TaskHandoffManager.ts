import { EventEmitter } from 'events';
import { AgentContext, AgentResult } from '../../types/Agent.js';
import logger from '../../utils/logger.js';

export interface HandoffContext {
  taskId: string;
  fromAgentId: string;
  toAgentId: string;
  reason: HandoffReason;
  originalContext: AgentContext;
  partialResult?: Partial<AgentResult>;
  metadata: Record<string, any>;
  timestamp: Date;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface HandoffReason {
  type: 'capability_mismatch' | 'overload' | 'expertise_required' | 'failure' | 'optimization' | 'planned_transition';
  description: string;
  severity: 'minor' | 'moderate' | 'major' | 'critical';
}

export interface HandoffRule {
  id: string;
  name: string;
  fromAgentPattern: string; // regex pattern for agent types
  toAgentPattern: string;
  triggers: Array<{
    condition: string;
    threshold?: number;
    operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  }>;
  priority: number;
  enabled: boolean;
}

export interface HandoffHistory {
  taskId: string;
  handoffs: Array<{
    fromAgent: string;
    toAgent: string;
    reason: HandoffReason;
    timestamp: Date;
    success: boolean;
    duration: number;
    contextSize: number;
  }>;
  totalHandoffs: number;
  successRate: number;
  averageDuration: number;
}

export class TaskHandoffManager extends EventEmitter {
  private handoffRules: Map<string, HandoffRule> = new Map();
  private activeHandoffs: Map<string, HandoffContext> = new Map();
  private handoffHistory: Map<string, HandoffHistory> = new Map();
  private contextSerializers: Map<string, (context: any) => string> = new Map();
  private contextDeserializers: Map<string, (data: string) => any> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
    logger.info('TaskHandoffManager initialized');
  }

  private initializeDefaultRules(): void {
    // Rule: Hand off coding tasks to Claude agents when strategic input is needed
    this.addHandoffRule({
      id: 'strategic-to-coding',
      name: 'Strategic to Coding Handoff',
      fromAgentPattern: '.*Strategic.*',
      toAgentPattern: '.*Coding.*',
      triggers: [
        { condition: 'task_type', operator: 'eq', threshold: 0 }, // Custom logic needed
        { condition: 'capability_required', operator: 'eq', threshold: 0 }
      ],
      priority: 1,
      enabled: true
    });

    // Rule: Hand off complex coding to testing when implementation is complete
    this.addHandoffRule({
      id: 'coding-to-testing',
      name: 'Coding to Testing Handoff',
      fromAgentPattern: '.*Coding.*',
      toAgentPattern: '.*Testing.*',
      triggers: [
        { condition: 'implementation_complete', operator: 'eq', threshold: 1 },
        { condition: 'test_required', operator: 'eq', threshold: 1 }
      ],
      priority: 2,
      enabled: true
    });

    // Rule: Hand off tool execution when specialized tools are needed
    this.addHandoffRule({
      id: 'any-to-tool-execution',
      name: 'Any to Tool Execution Handoff',
      fromAgentPattern: '.*',
      toAgentPattern: '.*ToolExecution.*',
      triggers: [
        { condition: 'tool_required', operator: 'eq', threshold: 1 },
        { condition: 'command_execution', operator: 'eq', threshold: 1 }
      ],
      priority: 3,
      enabled: true
    });

    // Rule: Hand off to planning when strategic planning is needed
    this.addHandoffRule({
      id: 'any-to-planning',
      name: 'Any to Planning Handoff',
      fromAgentPattern: '.*',
      toAgentPattern: '.*Planning.*',
      triggers: [
        { condition: 'planning_required', operator: 'eq', threshold: 1 },
        { condition: 'project_plan', operator: 'eq', threshold: 1 }
      ],
      priority: 4,
      enabled: true
    });
  }

  public addHandoffRule(rule: HandoffRule): void {
    this.handoffRules.set(rule.id, rule);
    logger.info('Handoff rule added', { ruleId: rule.id, ruleName: rule.name });
  }

  public removeHandoffRule(ruleId: string): void {
    if (this.handoffRules.delete(ruleId)) {
      logger.info('Handoff rule removed', { ruleId });
    }
  }

  public async evaluateHandoff(
    taskId: string,
    currentAgentId: string,
    agentType: string,
    context: AgentContext,
    partialResult?: Partial<AgentResult>
  ): Promise<{ shouldHandoff: boolean; targetAgent?: string; reason?: HandoffReason }> {
    
    logger.debug('Evaluating handoff', { taskId, currentAgentId, agentType });

    // Check for explicit handoff requests in context
    const explicitHandoff = this.checkExplicitHandoffRequest(context);
    if (explicitHandoff.shouldHandoff) {
      return explicitHandoff;
    }

    // Evaluate rules
    for (const rule of Array.from(this.handoffRules.values()).sort((a, b) => a.priority - b.priority)) {
      if (!rule.enabled) continue;

      const matchesFromPattern = new RegExp(rule.fromAgentPattern).test(agentType);
      if (!matchesFromPattern) continue;

      const triggerResult = await this.evaluateTriggers(rule.triggers, context, partialResult);
      if (triggerResult.triggered) {
        // Find target agent based on pattern
        const targetAgent = this.findTargetAgent(rule.toAgentPattern, context);
        if (targetAgent) {
          return {
            shouldHandoff: true,
            targetAgent,
            reason: {
              type: triggerResult.reasonType || 'capability_mismatch',
              description: `Rule '${rule.name}' triggered: ${triggerResult.description}`,
              severity: triggerResult.severity || 'moderate'
            }
          };
        }
      }
    }

    // Check for performance-based handoffs
    const performanceHandoff = await this.evaluatePerformanceHandoff(currentAgentId, context);
    if (performanceHandoff.shouldHandoff) {
      return performanceHandoff;
    }

    return { shouldHandoff: false };
  }

  private checkExplicitHandoffRequest(context: AgentContext): {
    shouldHandoff: boolean;
    targetAgent?: string;
    reason?: HandoffReason;
  } {
    // Check if context contains explicit handoff instructions
    if (context.metadata?.handoff) {
      const handoffData = context.metadata.handoff;
      return {
        shouldHandoff: true,
        targetAgent: handoffData.targetAgent,
        reason: {
          type: handoffData.reason?.type || 'planned_transition',
          description: handoffData.reason?.description || 'Explicit handoff requested',
          severity: handoffData.reason?.severity || 'moderate'
        }
      };
    }

    // Check task content for handoff keywords
    const taskContent = typeof context.task === 'string' ? context.task : JSON.stringify(context.task);
    const handoffKeywords = [
      { keyword: 'hand off to coding', targetType: 'coding', reason: 'Implementation required' },
      { keyword: 'need testing', targetType: 'testing', reason: 'Testing required' },
      { keyword: 'run command', targetType: 'tool-execution', reason: 'Tool execution required' },
      { keyword: 'create plan', targetType: 'planning', reason: 'Planning required' },
      { keyword: 'strategic analysis', targetType: 'strategic', reason: 'Strategic analysis required' }
    ];

    for (const { keyword, targetType, reason } of handoffKeywords) {
      if (taskContent.toLowerCase().includes(keyword)) {
        return {
          shouldHandoff: true,
          targetAgent: targetType,
          reason: {
            type: 'capability_mismatch',
            description: reason,
            severity: 'moderate'
          }
        };
      }
    }

    return { shouldHandoff: false };
  }

  private async evaluateTriggers(
    triggers: HandoffRule['triggers'],
    context: AgentContext,
    partialResult?: Partial<AgentResult>
  ): Promise<{
    triggered: boolean;
    description?: string;
    reasonType?: HandoffReason['type'];
    severity?: HandoffReason['severity'];
  }> {
    
    for (const trigger of triggers) {
      const value = this.extractTriggerValue(trigger.condition, context, partialResult);
      const threshold = trigger.threshold || 0;
      const operator = trigger.operator || 'eq';

      let conditionMet = false;
      switch (operator) {
        case 'gt':
          conditionMet = value > threshold;
          break;
        case 'lt':
          conditionMet = value < threshold;
          break;
        case 'gte':
          conditionMet = value >= threshold;
          break;
        case 'lte':
          conditionMet = value <= threshold;
          break;
        case 'eq':
          conditionMet = value === threshold;
          break;
      }

      if (conditionMet) {
        return {
          triggered: true,
          description: `Condition '${trigger.condition}' met (${value} ${operator} ${threshold})`,
          reasonType: this.mapConditionToReasonType(trigger.condition),
          severity: this.mapConditionToSeverity(trigger.condition)
        };
      }
    }

    return { triggered: false };
  }

  private extractTriggerValue(
    condition: string,
    context: AgentContext,
    partialResult?: Partial<AgentResult>
  ): number {
    switch (condition) {
      case 'implementation_complete':
        return partialResult?.success === true ? 1 : 0;
      case 'test_required':
        return this.checkTestRequired(context) ? 1 : 0;
      case 'tool_required':
        return this.checkToolRequired(context) ? 1 : 0;
      case 'command_execution':
        return this.checkCommandExecution(context) ? 1 : 0;
      case 'planning_required':
        return this.checkPlanningRequired(context) ? 1 : 0;
      case 'project_plan':
        return this.checkProjectPlan(context) ? 1 : 0;
      default:
        return 0;
    }
  }

  private checkTestRequired(context: AgentContext): boolean {
    const taskContent = typeof context.task === 'string' ? context.task : JSON.stringify(context.task);
    return /test|testing|spec|coverage/i.test(taskContent);
  }

  private checkToolRequired(context: AgentContext): boolean {
    const taskContent = typeof context.task === 'string' ? context.task : JSON.stringify(context.task);
    return /run|execute|command|build|deploy|npm|git/i.test(taskContent);
  }

  private checkCommandExecution(context: AgentContext): boolean {
    return context.metadata?.requiresExecution === true;
  }

  private checkPlanningRequired(context: AgentContext): boolean {
    const taskContent = typeof context.task === 'string' ? context.task : JSON.stringify(context.task);
    return /plan|planning|roadmap|milestone|schedule/i.test(taskContent);
  }

  private checkProjectPlan(context: AgentContext): boolean {
    const taskContent = typeof context.task === 'string' ? context.task : JSON.stringify(context.task);
    return /project plan|sprint plan|release plan/i.test(taskContent);
  }

  private mapConditionToReasonType(condition: string): HandoffReason['type'] {
    const mapping: Record<string, HandoffReason['type']> = {
      'implementation_complete': 'planned_transition',
      'test_required': 'capability_mismatch',
      'tool_required': 'capability_mismatch',
      'command_execution': 'capability_mismatch',
      'planning_required': 'capability_mismatch',
      'project_plan': 'capability_mismatch'
    };
    return mapping[condition] || 'capability_mismatch';
  }

  private mapConditionToSeverity(condition: string): HandoffReason['severity'] {
    const mapping: Record<string, HandoffReason['severity']> = {
      'implementation_complete': 'minor',
      'test_required': 'moderate',
      'tool_required': 'moderate',
      'command_execution': 'major',
      'planning_required': 'moderate',
      'project_plan': 'moderate'
    };
    return mapping[condition] || 'moderate';
  }

  private findTargetAgent(pattern: string, context: AgentContext): string | undefined {
    // In a real implementation, this would query available agents
    // For now, return based on pattern matching
    const agentTypeMap: Record<string, string> = {
      'coding': 'coding-agent',
      'testing': 'testing-agent',
      'tool-execution': 'tool-execution-agent',
      'planning': 'planning-agent',
      'strategic': 'strategic-agent'
    };

    // Extract agent type from pattern
    for (const [type, agentId] of Object.entries(agentTypeMap)) {
      if (pattern.toLowerCase().includes(type)) {
        return agentId;
      }
    }

    return undefined;
  }

  private async evaluatePerformanceHandoff(
    currentAgentId: string,
    context: AgentContext
  ): Promise<{ shouldHandoff: boolean; targetAgent?: string; reason?: HandoffReason }> {
    
    // Check if agent is overloaded or underperforming
    // This would integrate with agent performance metrics
    // For now, return no handoff
    return { shouldHandoff: false };
  }

  public async executeHandoff(handoffContext: HandoffContext): Promise<{
    success: boolean;
    newContext?: AgentContext;
    error?: string;
  }> {
    const startTime = Date.now();
    
    try {
      logger.info('Executing handoff', {
        taskId: handoffContext.taskId,
        fromAgent: handoffContext.fromAgentId,
        toAgent: handoffContext.toAgentId,
        reason: handoffContext.reason.type
      });

      // Store active handoff
      this.activeHandoffs.set(handoffContext.taskId, handoffContext);

      // Serialize context for transfer
      const serializedContext = await this.serializeContext(handoffContext.originalContext);
      
      // Create new context for target agent
      const newContext: AgentContext = {
        ...handoffContext.originalContext,
        metadata: {
          ...handoffContext.originalContext.metadata,
          handoff: {
            fromAgent: handoffContext.fromAgentId,
            reason: handoffContext.reason,
            partialResult: handoffContext.partialResult,
            transferTimestamp: handoffContext.timestamp
          }
        }
      };

      // Deserialize any agent-specific context
      const deserializedContext = await this.deserializeContext(newContext, handoffContext.toAgentId);

      // Record handoff in history
      this.recordHandoff(handoffContext, true, Date.now() - startTime, JSON.stringify(serializedContext).length);

      // Clean up active handoff
      this.activeHandoffs.delete(handoffContext.taskId);

      this.emit('handoff-completed', {
        taskId: handoffContext.taskId,
        fromAgent: handoffContext.fromAgentId,
        toAgent: handoffContext.toAgentId,
        duration: Date.now() - startTime
      });

      return {
        success: true,
        newContext: deserializedContext
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Handoff execution failed', {
        taskId: handoffContext.taskId,
        error: error instanceof Error ? error.message : String(error),
        duration
      });

      this.recordHandoff(handoffContext, false, duration, 0);
      this.activeHandoffs.delete(handoffContext.taskId);

      this.emit('handoff-failed', {
        taskId: handoffContext.taskId,
        fromAgent: handoffContext.fromAgentId,
        toAgent: handoffContext.toAgentId,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async serializeContext(context: AgentContext): Promise<any> {
    // Create a serializable version of the context
    return {
      userId: context.userId,
      sessionId: context.sessionId,
      task: context.task,
      timestamp: context.timestamp,
      metadata: context.metadata,
      previousMessages: context.previousMessages?.slice(-10) || [] // Limit history
    };
  }

  private async deserializeContext(context: AgentContext, targetAgentId: string): Promise<AgentContext> {
    // Apply any agent-specific context transformations
    const deserializer = this.contextDeserializers.get(targetAgentId);
    if (deserializer) {
      const serializedData = JSON.stringify(context);
      const customContext = deserializer(serializedData);
      return { ...context, ...customContext };
    }
    return context;
  }

  private recordHandoff(
    handoffContext: HandoffContext,
    success: boolean,
    duration: number,
    contextSize: number
  ): void {
    const taskId = handoffContext.taskId;
    let history = this.handoffHistory.get(taskId);
    
    if (!history) {
      history = {
        taskId,
        handoffs: [],
        totalHandoffs: 0,
        successRate: 0,
        averageDuration: 0
      };
      this.handoffHistory.set(taskId, history);
    }

    // Add handoff record
    history.handoffs.push({
      fromAgent: handoffContext.fromAgentId,
      toAgent: handoffContext.toAgentId,
      reason: handoffContext.reason,
      timestamp: handoffContext.timestamp,
      success,
      duration,
      contextSize
    });

    // Update statistics
    history.totalHandoffs++;
    const successfulHandoffs = history.handoffs.filter(h => h.success).length;
    history.successRate = successfulHandoffs / history.totalHandoffs;
    history.averageDuration = history.handoffs.reduce((sum, h) => sum + h.duration, 0) / history.handoffs.length;
  }

  public registerContextSerializer(agentId: string, serializer: (context: any) => string): void {
    this.contextSerializers.set(agentId, serializer);
  }

  public registerContextDeserializer(agentId: string, deserializer: (data: string) => any): void {
    this.contextDeserializers.set(agentId, deserializer);
  }

  public getHandoffHistory(taskId: string): HandoffHistory | undefined {
    return this.handoffHistory.get(taskId);
  }

  public getActiveHandoffs(): HandoffContext[] {
    return Array.from(this.activeHandoffs.values());
  }

  public getHandoffRules(): HandoffRule[] {
    return Array.from(this.handoffRules.values());
  }

  public getHandoffStats(): {
    totalHandoffs: number;
    successRate: number;
    averageDuration: number;
    handoffsByReason: Record<string, number>;
  } {
    const allHandoffs = Array.from(this.handoffHistory.values())
      .flatMap(history => history.handoffs);
    
    const totalHandoffs = allHandoffs.length;
    const successfulHandoffs = allHandoffs.filter(h => h.success).length;
    const successRate = totalHandoffs > 0 ? successfulHandoffs / totalHandoffs : 0;
    const averageDuration = totalHandoffs > 0 
      ? allHandoffs.reduce((sum, h) => sum + h.duration, 0) / totalHandoffs 
      : 0;

    const handoffsByReason: Record<string, number> = {};
    allHandoffs.forEach(handoff => {
      const reason = handoff.reason.type;
      handoffsByReason[reason] = (handoffsByReason[reason] || 0) + 1;
    });

    return {
      totalHandoffs,
      successRate,
      averageDuration,
      handoffsByReason
    };
  }
}

export default TaskHandoffManager;