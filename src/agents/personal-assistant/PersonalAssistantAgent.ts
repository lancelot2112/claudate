import { BaseAgent } from '../base/Agent';
import { 
  AgentConfig, 
  AgentContext, 
  AgentResponse,
  AgentResult,
  Task,
  ExecutiveBrief,
  RoutingDecision,
  CommunicationPreference
} from '../../types/Agent';
import { BaseMessage, UrgencyLevel } from '../../types/common';
import { agentMemoryManager } from '../base/Memory';
import { agentLogger, logAgentAction } from '../../utils/logger';
import { loadPrivateConfig } from '../../utils/config';

export class PersonalAssistantAgent extends BaseAgent {
  private userConfig: any;
  private communicationPreferences: CommunicationPreference[] = [];

  constructor(config: AgentConfig) {
    super(config);
    this.loadUserConfiguration();
  }

  protected async onInitialize(): Promise<void> {
    logAgentAction(this.id, 'onInitialize', { type: 'personal-assistant' });
    
    // Connect to memory manager if not already connected
    if (!agentMemoryManager.isReady()) {
      await agentMemoryManager.connect();
    }

    // Load user preferences and communication settings
    await this.loadCommunicationPreferences();
    
    agentLogger.info(`Personal Assistant Agent ${this.id} initialized`);
  }

  protected async onShutdown(): Promise<void> {
    logAgentAction(this.id, 'onShutdown');
    agentLogger.info(`Personal Assistant Agent ${this.id} shutdown`);
  }

  protected async onProcessMessage(
    message: BaseMessage,
    context: AgentContext
  ): Promise<AgentResponse> {
    try {
      logAgentAction(this.id, 'processMessage', {
        messageId: message.id,
        channel: message.channel,
        type: message.type,
        urgency: message.urgency,
      });

      // Store message in memory
      await agentMemoryManager.addToContextWindow(this.id, message);

      // Analyze the message and determine action
      const analysis = await this.analyzeMessage(message, context);
      
      // Generate response based on analysis
      const response = await this.generateResponse(message, context, analysis);

      // Store the interaction in memory
      await this.storeInteraction(message, response, context);

      return {
        success: true,
        data: response,
        confidence: analysis.confidence,
        metadata: {
          analysis,
          routing: analysis.routing,
          executiveBrief: analysis.executiveBrief,
        },
        processingTime: 0, // Will be set by base class
      };
    } catch (error) {
      agentLogger.error(`Error processing message in PersonalAssistantAgent`, {
        agentId: this.id,
        messageId: message.id,
        error: (error as Error).message,
      });

      return {
        success: false,
        error: (error as Error).message,
        processingTime: 0,
      };
    }
  }

  // Implementation of abstract method from BaseAgent
  public async executeTask(context: AgentContext): Promise<AgentResult> {
    this.updateStatus('processing');
    
    const { task } = context;
    logAgentAction(this.id, 'taskAssigned', {
      taskId: task.id,
      taskType: task.type,
      priority: task.priority,
    });

    try {
      let result: any;
      
      switch (task.type) {
        case 'generate_executive_brief':
          result = await this.generateExecutiveBrief(task);
          break;
        case 'route_message':
          result = await this.routeMessage(task);
          break;
        case 'analyze_communication':
          result = await this.analyzeCommunication(task);
          break;
        case 'message_analysis':
          result = await this.analyzeMessage(task.input, context);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      this.updateStatus('completed');
      this.completeTask(task.id, result);
      
      return {
        success: true,
        agentId: this.id,
        timestamp: Date.now(),
        metadata: { result }
      };
    } catch (error) {
      this.updateStatus('failed');
      this.failTask(task.id, (error as Error).message);
      
      return {
        success: false,
        agentId: this.id,
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Core Personal Assistant Methods
  private async analyzeMessage(
    message: BaseMessage,
    context: AgentContext
  ): Promise<{
    intent: string;
    urgency: UrgencyLevel;
    confidence: number;
    requiresRouting: boolean;
    routing?: RoutingDecision;
    executiveBrief?: ExecutiveBrief;
    actionItems: string[];
  }> {
    // Simple intent analysis for MVP - can be enhanced with AI later
    const content = message.content.toLowerCase();
    
    let intent = 'general_inquiry';
    let urgency = message.urgency;
    let confidence = 0.7;
    let requiresRouting = false;
    let routing: RoutingDecision | undefined;
    let actionItems: string[] = [];

    // Detect urgent keywords
    const urgentKeywords = ['urgent', 'critical', 'emergency', 'asap', 'immediately'];
    if (urgentKeywords.some(keyword => content.includes(keyword))) {
      urgency = 'critical';
      confidence = 0.9;
    }

    // Detect coding/technical requests
    const codingKeywords = ['code', 'bug', 'implement', 'debug', 'test', 'deploy'];
    if (codingKeywords.some(keyword => content.includes(keyword))) {
      intent = 'technical_request';
      requiresRouting = true;
      routing = {
        targetAgent: 'claude-execution',
        reasoning: 'Message contains technical/coding keywords',
        confidence: 0.8,
        urgency,
        estimatedProcessingTime: 300000, // 5 minutes
        requiredCapabilities: ['coding', 'debugging'],
      };
    }

    // Detect strategic/planning requests
    const strategicKeywords = ['plan', 'strategy', 'architecture', 'design', 'roadmap'];
    if (strategicKeywords.some(keyword => content.includes(keyword))) {
      intent = 'strategic_request';
      requiresRouting = true;
      routing = {
        targetAgent: 'gemini-strategic',
        reasoning: 'Message contains strategic/planning keywords',
        confidence: 0.8,
        urgency,
        estimatedProcessingTime: 600000, // 10 minutes
        requiredCapabilities: ['planning', 'strategy'],
      };
    }

    // Extract action items
    if (content.includes('todo') || content.includes('action') || content.includes('task')) {
      actionItems.push('Review and prioritize mentioned tasks');
    }

    // Generate executive brief for important messages
    let executiveBrief: ExecutiveBrief | undefined;
    if (urgency === 'critical' || urgency === 'high') {
      executiveBrief = await this.createExecutiveBrief(message, intent, urgency);
    }

    return {
      intent,
      urgency,
      confidence,
      requiresRouting,
      routing,
      executiveBrief,
      actionItems,
    };
  }

  private async generateResponse(
    message: BaseMessage,
    context: AgentContext,
    analysis: any
  ): Promise<{
    text: string;
    actions: string[];
    routingRequired: boolean;
    executiveBrief?: ExecutiveBrief;
  }> {
    let text = '';
    const actions: string[] = [];

    // Generate contextual response
    if (analysis.intent === 'technical_request') {
      text = `I understand you have a technical request. I'm routing this to our development team for immediate attention.`;
      actions.push('route_to_claude_agent');
    } else if (analysis.intent === 'strategic_request') {
      text = `I've received your strategic planning request. I'm forwarding this to our planning team for comprehensive analysis.`;
      actions.push('route_to_gemini_agent');
    } else {
      text = `I've received your message and I'm processing it now. I'll provide an update shortly.`;
    }

    // Add urgency acknowledgment
    if (analysis.urgency === 'critical') {
      text = `🚨 URGENT: ${text} Given the critical nature, this will be prioritized immediately.`;
      actions.push('escalate_urgency');
    }

    // Apply executive communication preferences
    const bulletPoints = this.formatAsExecutiveBrief(text, analysis);
    
    return {
      text: bulletPoints,
      actions,
      routingRequired: analysis.requiresRouting,
      executiveBrief: analysis.executiveBrief,
    };
  }

  private formatAsExecutiveBrief(text: string, analysis: any): string {
    const userPrefs = this.userConfig?.communication?.preferences;
    const maxBullets = userPrefs?.briefingStyle === 'bullet-points-max-3' ? 3 : 5;

    // Convert to bullet points (simplified for MVP)
    const points = [
      `Status: Message received and analyzed`,
      text,
    ];

    if (analysis.actionItems.length > 0) {
      points.push(`Actions: ${analysis.actionItems.join(', ')}`);
    }

    // Limit to max bullets
    const limitedPoints = points.slice(0, maxBullets);
    
    return limitedPoints.map(point => `• ${point}`).join('\n');
  }

  private async createExecutiveBrief(
    message: BaseMessage,
    intent: string,
    urgency: UrgencyLevel
  ): Promise<ExecutiveBrief> {
    return {
      id: `brief_${Date.now()}`,
      title: `${urgency.toUpperCase()}: ${intent.replace('_', ' ')}`,
      summary: message.content.substring(0, 200) + (message.content.length > 200 ? '...' : ''),
      keyPoints: [
        `Received via ${message.channel}`,
        `Urgency level: ${urgency}`,
        `Requires immediate attention`,
      ],
      urgency,
      actionItems: [`Review ${intent} request`, 'Provide response within SLA'],
      metadata: {
        messageId: message.id,
        channel: message.channel,
        timestamp: new Date(),
      },
    };
  }

  // Task handlers
  private async generateExecutiveBrief(task: Task): Promise<void> {
    const { messages, timeframe } = task.input;
    
    // Analyze messages and create brief
    const brief: ExecutiveBrief = {
      id: `brief_${task.id}`,
      title: `Executive Summary - ${timeframe}`,
      summary: `Summary of ${messages.length} messages over ${timeframe}`,
      keyPoints: [
        `Total communications: ${messages.length}`,
        `Urgent items: ${messages.filter((m: BaseMessage) => m.urgency === 'critical').length}`,
        `Channels used: ${[...new Set(messages.map((m: BaseMessage) => m.channel))].join(', ')}`,
      ],
      urgency: 'normal' as UrgencyLevel,
      actionItems: ['Review summary', 'Address urgent items'],
    };

    task.output = brief;
  }

  private async routeMessage(task: Task): Promise<void> {
    const { message, targetAgent } = task.input;
    
    // Store routing decision
    await agentMemoryManager.storeShortTerm(
      this.id,
      `routing_${message.id}`,
      {
        messageId: message.id,
        targetAgent,
        timestamp: Date.now(),
        reason: 'Intelligent routing based on content analysis',
      },
      3600 // 1 hour TTL
    );

    task.output = {
      routed: true,
      targetAgent,
      messageId: message.id,
    };
  }

  private async analyzeCommunication(task: Task): Promise<void> {
    const { communicationHistory } = task.input;
    
    // Analyze communication patterns
    const analysis = {
      totalMessages: communicationHistory.length,
      channelBreakdown: this.getChannelBreakdown(communicationHistory),
      urgencyDistribution: this.getUrgencyDistribution(communicationHistory),
      responseTimeAnalysis: this.analyzeResponseTimes(communicationHistory),
      trends: this.identifyTrends(communicationHistory),
    };

    task.output = analysis;
  }

  // Implementation of abstract method from BaseAgent
  public async getCapabilities(): Promise<string[]> {
    return [
      'message_analysis',
      'routing_decision',
      'executive_brief_generation',
      'communication_analysis',
      'priority_management',
      'context_awareness',
      'multi_channel_support'
    ];
  }

  // Task management methods
  private completeTask(taskId: string, output: any): void {
    // Emit task completion event
    this.emit('task-completed', { taskId, output, timestamp: Date.now() });
  }

  private failTask(taskId: string, error: string): void {
    // Emit task failure event
    this.emit('task-failed', { taskId, error, timestamp: Date.now() });
  }

  // Helper methods
  private loadUserConfiguration(): void {
    this.userConfig = loadPrivateConfig();
    if (this.userConfig) {
      agentLogger.info(`User configuration loaded for Personal Assistant ${this.id}`);
    }
  }

  private async loadCommunicationPreferences(): Promise<void> {
    if (this.userConfig?.communication?.channels) {
      // Convert user config to communication preferences
      for (const [channel, config] of Object.entries(this.userConfig.communication.channels)) {
        if (config && typeof config === 'object' && 'enabled' in config && config.enabled) {
          this.communicationPreferences.push({
            channel,
            urgency: ['critical', 'high', 'normal', 'low'] as UrgencyLevel[],
            timeWindows: [{
              start: this.userConfig.communication.preferences.communicationHours.start,
              end: this.userConfig.communication.preferences.communicationHours.end,
              timezone: this.userConfig.communication.preferences.communicationHours.timezone,
            }],
            formatPreferences: {
              maxBulletPoints: 3,
              includeVisuals: true,
              includeActionItems: true,
            },
          });
        }
      }
    }
  }

  private async storeInteraction(
    message: BaseMessage,
    response: any,
    context: AgentContext
  ): Promise<void> {
    await agentMemoryManager.storeShortTerm(
      this.id,
      `interaction_${message.id}`,
      {
        message,
        response,
        context: {
          sessionId: context.sessionId,
          userId: context.userId,
          timestamp: Date.now(),
        },
      },
      86400 // 24 hours TTL
    );
  }

  private getChannelBreakdown(messages: BaseMessage[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    for (const message of messages) {
      const channel = message.channel || 'unknown';
      breakdown[channel] = (breakdown[channel] || 0) + 1;
    }
    return breakdown;
  }

  private getUrgencyDistribution(messages: BaseMessage[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const message of messages) {
      distribution[message.urgency] = (distribution[message.urgency] || 0) + 1;
    }
    return distribution;
  }

  private analyzeResponseTimes(messages: BaseMessage[]): any {
    // Simplified analysis for MVP
    return {
      averageResponseTime: '15 minutes',
      fastestResponse: '2 minutes',
      slowestResponse: '2 hours',
    };
  }

  private identifyTrends(messages: BaseMessage[]): string[] {
    // Simplified trend analysis for MVP
    const trends: string[] = [];
    
    if (messages.length > 10) {
      trends.push('Increased communication volume');
    }
    
    const urgentCount = messages.filter(m => m.urgency === 'critical').length;
    if (urgentCount > messages.length * 0.3) {
      trends.push('High urgency message rate');
    }

    return trends;
  }
}