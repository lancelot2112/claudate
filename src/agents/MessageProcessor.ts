import { v4 as uuidv4 } from 'uuid';
import { BaseMessage, MessageType, UrgencyLevel, CommunicationChannel } from '@/types/common';
import { AgentContext, Task } from '@/types/Agent';
import { agentRegistry } from '@/agents/base/AgentRegistry';
import { contextManager } from '@/agents/base/Context';
import { agentLogger, logError, communicationLogger } from '@/utils/logger';

export interface ProcessingResult {
  success: boolean;
  messageId: string;
  assignedAgent?: string;
  response?: any;
  error?: string;
  processingTime: number;
}

export interface MessageInput {
  content: string;
  channel: CommunicationChannel;
  type: MessageType;
  urgency?: UrgencyLevel;
  userId: string;
  metadata?: Record<string, any>;
}

export class MessageProcessor {
  private processingQueue = new Map<string, BaseMessage>();

  public async processIncomingMessage(input: MessageInput): Promise<ProcessingResult> {
    const startTime = Date.now();
    const messageId = uuidv4();

    try {
      // Create message object
      const message: BaseMessage = {
        id: messageId,
        timestamp: new Date(),
        channel: input.channel,
        direction: 'incoming',
        type: input.type,
        urgency: input.urgency || this.determineUrgency(input.content),
        content: input.content,
        metadata: input.metadata,
      };

      communicationLogger.info('Processing incoming message', {
        messageId,
        channel: input.channel,
        type: input.type,
        urgency: message.urgency,
        userId: input.userId,
      });

      // Add to processing queue
      this.processingQueue.set(messageId, message);

      // Get or create context for user
      let context = await this.getOrCreateUserContext(input.userId);
      
      // Add message to context
      contextManager.addMessage(context.sessionId, message);

      // Find appropriate agent to handle the message
      const agent = await this.findAgentForMessage(message, context);
      
      if (!agent) {
        throw new Error('No available agent found to handle message');
      }

      // Process message with selected agent
      const response = await agent.processMessage(message, context);

      // Remove from processing queue
      this.processingQueue.delete(messageId);

      const processingTime = Date.now() - startTime;

      agentLogger.info('Message processed successfully', {
        messageId,
        agentId: agent.id,
        processingTime,
        success: response.success,
      });

      return {
        success: response.success,
        messageId,
        assignedAgent: agent.id,
        response: response.data,
        error: response.error,
        processingTime,
      };

    } catch (error) {
      // Remove from processing queue on error
      this.processingQueue.delete(messageId);
      
      const processingTime = Date.now() - startTime;
      
      logError(error as Error, 'Message processing failed', {
        messageId,
        userId: input.userId,
        channel: input.channel,
      });

      return {
        success: false,
        messageId,
        error: (error as Error).message,
        processingTime,
      };
    }
  }

  public async createTask(
    type: string,
    input: any,
    priority: UrgencyLevel = 'normal',
    userId: string
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const taskId = uuidv4();

    try {
      const task: Task = {
        id: taskId,
        type,
        priority,
        status: 'pending',
        input,
        createdAt: new Date(),
        metadata: { userId },
      };

      agentLogger.info('Creating task', {
        taskId,
        type,
        priority,
        userId,
      });

      // Find appropriate agent for task
      const agent = agentRegistry.findBestAgent(task);
      
      if (!agent) {
        throw new Error(`No available agent found to handle task type: ${type}`);
      }

      // Assign task to agent
      await agent.assignTask(task);

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        messageId: taskId,
        assignedAgent: agent.id,
        processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      logError(error as Error, 'Task creation failed', {
        taskId,
        type,
        userId,
      });

      return {
        success: false,
        messageId: taskId,
        error: (error as Error).message,
        processingTime,
      };
    }
  }

  public getProcessingStats(): {
    queueSize: number;
    totalProcessed: number;
    averageProcessingTime: number;
    activeMessages: string[];
  } {
    return {
      queueSize: this.processingQueue.size,
      totalProcessed: 0, // TODO: Track this in memory/database
      averageProcessingTime: 0, // TODO: Calculate from historical data
      activeMessages: Array.from(this.processingQueue.keys()),
    };
  }

  public isProcessing(messageId: string): boolean {
    return this.processingQueue.has(messageId);
  }

  public getQueuedMessages(): BaseMessage[] {
    return Array.from(this.processingQueue.values());
  }

  private async getOrCreateUserContext(userId: string): Promise<AgentContext> {
    // Try to find existing active context for user
    // For MVP, we'll create a new context each time
    // In production, this would check for active sessions
    
    const context = contextManager.createContext(userId, {}, 50);
    
    agentLogger.debug('Created new context for user', {
      userId,
      sessionId: context.sessionId,
    });

    return context;
  }

  private async findAgentForMessage(
    message: BaseMessage,
    context: AgentContext
  ): Promise<any> {
    // For MVP, we'll primarily route to Personal Assistant
    // The Personal Assistant will then route to specialist agents as needed
    
    const personalAssistants = agentRegistry.getAgentsByType('personal-assistant');
    
    if (personalAssistants.length === 0) {
      throw new Error('No Personal Assistant agents available');
    }

    // Find the best available Personal Assistant
    const availableAssistants = personalAssistants.filter(agent => {
      const status = agent.getStatus();
      return status.status === 'idle' && agent.config.enabled;
    });

    if (availableAssistants.length === 0) {
      throw new Error('No available Personal Assistant agents');
    }

    // For MVP, just return the first available assistant
    // In production, this could be more sophisticated (load balancing, etc.)
    return availableAssistants[0];
  }

  private determineUrgency(content: string): UrgencyLevel {
    const lowercaseContent = content.toLowerCase();
    
    // Critical urgency keywords
    const criticalKeywords = ['emergency', 'critical', 'urgent', 'asap', 'immediately'];
    if (criticalKeywords.some(keyword => lowercaseContent.includes(keyword))) {
      return 'critical';
    }

    // High urgency keywords
    const highKeywords = ['important', 'priority', 'soon', 'quick'];
    if (highKeywords.some(keyword => lowercaseContent.includes(keyword))) {
      return 'high';
    }

    // Low urgency keywords
    const lowKeywords = ['when possible', 'no rush', 'eventually', 'later'];
    if (lowKeywords.some(keyword => lowercaseContent.includes(keyword))) {
      return 'low';
    }

    // Default to normal urgency
    return 'normal';
  }
}

// Singleton instance
export const messageProcessor = new MessageProcessor();