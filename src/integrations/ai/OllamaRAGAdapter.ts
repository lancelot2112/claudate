import { OllamaAgent } from '../../agents/ollama/OllamaAgent';
import { AgentContext } from '../../types/Agent';
import { 
  AIProvider, 
  AICapabilities, 
  TextGenerationRequest, 
  TextGenerationResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  HealthStatus,
  ProviderMetrics,
  AIProviderConfig
} from './AIProvider';
import logger from '../../utils/logger';

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
 * Ollama RAG Adapter
 * 
 * Adapts the generic OllamaAgent to work as an AIProvider for RAG systems.
 * This allows seamless integration with knowledge management systems while
 * maintaining the flexibility to use any Ollama model.
 */
export class OllamaRAGAdapter implements AIProvider {
  readonly name: string = 'ollama-rag-adapter';
  readonly capabilities: AICapabilities;

  constructor(private agent: OllamaAgent) {
    this.capabilities = {
      textGeneration: true,
      embedding: true,
      multiModal: false,
      streaming: false,
      functionCalling: false,
      localExecution: true,
      supportedModels: ['qwen3:8b', 'llama3.2:3b', 'qwen2.5-coder:7b'],
      maxContextWindow: agent.getMaxContextWindow()
    };
  }

  /**
   * Create a Qwen3-compatible RAG adapter (factory method)
   */
  public static createQwen3Adapter(): OllamaRAGAdapter {
    const agent = OllamaAgent.createQwen3Agent({
      name: 'qwen3-rag-agent',
      type: 'execution',
      capabilities: ['text_generation', 'reasoning', 'analysis'],
      enabled: true,
      priority: 1,
      maxConcurrentTasks: 2
    });
    
    return new OllamaRAGAdapter(agent);
  }

  /**
   * Create a code-focused RAG adapter
   */
  public static createCodeAdapter(): OllamaRAGAdapter {
    const agent = OllamaAgent.createCodeAgent({
      name: 'code-rag-agent',
      type: 'execution',
      capabilities: ['code_generation', 'debugging', 'programming'],
      enabled: true,
      priority: 1,
      maxConcurrentTasks: 2
    });
    
    return new OllamaRAGAdapter(agent);
  }

  /**
   * Generate text using the underlying Ollama agent
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    try {
      const agentContext: AgentContext = {
        sessionId: `rag-${Date.now()}`,
        userId: 'rag-system',
        task: {
          type: 'reasoning',
          description: request.messages[0]?.content || '',
          temperature: request.temperature || 0.3,
          format: 'text'
        },
        timestamp: new Date(),
        metadata: {},
        conversationHistory: request.messages.map(msg => ({
          id: `msg-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          type: 'text' as const,
          urgency: 'normal' as const,
          content: msg.content,
          sender: msg.role === 'user' ? 'user' : 'assistant'
        })),
        contextWindow: 8000,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {}
      };

      const result = await this.agent.executeTask(agentContext);
      
      if (!result.success) {
        throw new Error(`Agent execution failed: ${result.metadata?.error || 'Unknown error'}`);
      }
      
      return {
        content: result.content,
        model: this.agent.getModelInfo().model,
        usage: {
          inputTokens: result.tokenUsage?.prompt || 0,
          outputTokens: result.tokenUsage?.completion || 0,
          totalTokens: result.tokenUsage?.total || 0
        },
        finishReason: 'stop',
        metadata: result.metadata
      };
      
    } catch (error) {
      logger.error('OllamaRAGAdapter text generation failed', {
        error: error instanceof Error ? error.message : String(error),
        model: this.agent.getModelInfo().model
      });
      throw error;
    }
  }

  /**
   * Generate embeddings (delegates to agent if supported)
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // For now, throw an error as embedding generation should go through
    // the dedicated embedding provider, not the RAG adapter
    throw new Error('Embedding generation not supported in RAG adapter - use dedicated embedding provider');
  }

  /**
   * Get maximum context window size
   */
  getMaxContextWindow(): number {
    return this.agent.getMaxContextWindow();
  }

  /**
   * Estimate token count for text
   */
  estimateTokenCount(text: string): number {
    return this.agent.estimateTokenCount(text);
  }

  /**
   * Health check using the underlying agent
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const isHealthy = await this.agent.healthCheck();
      return {
        healthy: isHealthy,
        latencyMs: 0, // Could be measured if needed
        timestamp: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get metrics from the underlying agent
   */
  async getMetrics(): Promise<ProviderMetrics> {
    return {
      totalRequests: 0, // Could be tracked if needed
      successfulRequests: 0,
      failedRequests: 0,
      averageLatencyMs: 0,
      totalTokensUsed: 0,
      uptime: Date.now(), // Time since adapter creation
      lastRequestTime: new Date()
    };
  }

  /**
   * Update configuration (delegates to agent)
   */
  updateConfig(config: Partial<AIProviderConfig>): void {
    // For now, no-op as agent configuration is handled differently
    logger.info('OllamaRAGAdapter config update requested', { config });
  }

  /**
   * Get current configuration
   */
  getConfig(): AIProviderConfig {
    const modelInfo = this.agent.getModelInfo();
    return {
      name: this.name,
      timeout: 30000,
      maxRetries: 3,
      defaultModel: modelInfo.model,
      models: {
        text: [modelInfo.model],
        embedding: modelInfo.embeddingModel ? [modelInfo.embeddingModel] : []
      }
    };
  }

  /**
   * Initialize the adapter (delegates to agent)
   */
  async initialize(): Promise<void> {
    await this.agent.initialize();
  }

  /**
   * Shutdown the adapter (delegates to agent)
   */
  async shutdown(): Promise<void> {
    await this.agent.shutdown();
  }

  /**
   * RAG-specific method for compatibility with existing tests
   */
  public async sendMessage(request: RAGRequest): Promise<RAGResponse> {
    const textRequest: TextGenerationRequest = {
      messages: request.messages,
      temperature: request.temperature,
      maxTokens: request.max_tokens,
      systemPrompt: request.system
    };

    const response = await this.generateText(textRequest);
    
    return {
      content: response.content,
      usage: {
        input_tokens: response.usage.inputTokens,
        output_tokens: response.usage.outputTokens
      },
      model: response.model
    };
  }

  /**
   * Get the underlying agent (for testing and advanced use cases)
   */
  public getAgent(): OllamaAgent {
    return this.agent;
  }
}

export default OllamaRAGAdapter;