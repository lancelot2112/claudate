import { Qwen3Agent } from '../../agents/ollama/Qwen3Agent.js';
import { AgentContext } from '../../types/Agent.js';
import logger from '../../utils/logger.js';

/**
 * RAG Message Interface for compatibility
 */
export interface RAGMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * RAG Request Interface for compatibility
 */
export interface RAGRequest {
  messages: RAGMessage[];
  system?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * RAG Response Interface for compatibility
 */
export interface RAGResponse {
  content: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  model?: string;
}

/**
 * Adapter to make Qwen3Agent compatible with RAG system expectations
 * This bridges the gap between the agent interface and the client interface
 */
export class Qwen3RAGAdapter {
  private agent: Qwen3Agent;

  constructor(modelName: string = 'qwen3:8b') {
    this.agent = new Qwen3Agent({
      name: 'Qwen3RAGAdapter',
      type: 'execution',
      capabilities: [],
      enabled: true,
      priority: 1,
      maxConcurrentTasks: 1
    }, modelName);

    logger.info('Qwen3RAGAdapter initialized', { model: modelName });
  }

  /**
   * Send message interface compatible with RAG system
   */
  public async sendMessage(request: RAGRequest): Promise<RAGResponse> {
    try {
      // Extract the user message content
      const userMessage = request.messages.find(msg => msg.role === 'user');
      if (!userMessage) {
        throw new Error('No user message found in request');
      }

      // Build context for agent
      let prompt = userMessage.content;
      
      // Add system context if provided
      if (request.system) {
        prompt = `${request.system}\n\n${prompt}`;
      }

      // Create agent context
      const agentContext: AgentContext = {
        sessionId: `rag-${Date.now()}`,
        userId: 'rag-system',
        task: {
          type: 'reasoning',
          description: prompt,
          temperature: request.temperature || 0.3,
          format: 'text'
        },
        conversationHistory: [],
        contextWindow: 10,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {},
        timestamp: new Date()
      };

      // Execute the task
      const result = await this.agent.executeTask(agentContext);

      if (!result.success) {
        throw new Error(result.metadata?.error || 'Agent task failed');
      }

      // Convert to expected format
      return {
        content: result.content,
        usage: {
          input_tokens: result.tokenUsage?.prompt || 0,
          output_tokens: result.tokenUsage?.completion || 0
        },
        model: this.agent.getModelInfo().model
      };

    } catch (error) {
      logger.error('Qwen3RAGAdapter sendMessage failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Health check for the underlying agent
   */
  public async healthCheck(): Promise<boolean> {
    try {
      return await this.agent.healthCheck();
    } catch (error) {
      logger.error('Qwen3RAGAdapter health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Get model information
   */
  public getModelInfo(): { model: string; status: string } {
    return this.agent.getModelInfo();
  }

  /**
   * Update the underlying model
   */
  public updateModel(modelName: string): void {
    this.agent.updateModel(modelName);
    logger.info('Qwen3RAGAdapter model updated', { newModel: modelName });
  }

  /**
   * Shutdown the adapter and underlying agent
   */
  public async shutdown(): Promise<void> {
    await this.agent.shutdown();
    logger.info('Qwen3RAGAdapter shutdown completed');
  }

  /**
   * Get agent capabilities
   */
  public async getCapabilities(): Promise<string[]> {
    return await this.agent.getCapabilities();
  }
}

export default Qwen3RAGAdapter;