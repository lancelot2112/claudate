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
 * Optimized Ollama RAG Adapter for Testing
 * 
 * This version includes streaming support and test-specific optimizations
 * for faster response times and better test reliability.
 */
export class OllamaRAGAdapterOptimized implements AIProvider {
  readonly name: string = 'ollama-rag-adapter-optimized';
  readonly capabilities: AICapabilities;

  constructor(private agent: OllamaAgent) {
    this.capabilities = {
      textGeneration: true,
      embedding: true,
      multiModal: false,
      streaming: true, // Enable streaming for faster feedback
      functionCalling: false,
      localExecution: true,
      supportedModels: ['qwen3:8b', 'llama3.2:3b', 'qwen2.5-coder:7b'],
      maxContextWindow: agent.getMaxContextWindow()
    };
  }

  /**
   * Create a test-optimized Qwen3 adapter
   */
  public static createQwen3AdapterOptimized(): OllamaRAGAdapterOptimized {
    const agent = OllamaAgent.createQwen3Agent({
      name: 'qwen3-rag-agent-optimized',
      type: 'execution',
      capabilities: ['text_generation', 'reasoning', 'analysis'],
      enabled: true,
      priority: 1,
      maxConcurrentTasks: 2
    });
    
    return new OllamaRAGAdapterOptimized(agent);
  }

  /**
   * Generate text with streaming support for tests
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    try {
      // For tests, use optimized settings
      const optimizedRequest = {
        ...request,
        temperature: request.temperature || 0.1, // Lower temperature for deterministic responses
        maxTokens: Math.min(request.maxTokens || 512, 512), // Limit tokens for faster generation
      };

      const agentContext: AgentContext = {
        sessionId: `rag-optimized-${Date.now()}`,
        userId: 'test-system',
        task: {
          type: 'reasoning',
          description: optimizedRequest.messages[0]?.content || '',
          temperature: optimizedRequest.temperature,
          format: 'text',
          maxTokens: optimizedRequest.maxTokens
        },
        timestamp: new Date(),
        metadata: {
          testMode: true,
          streamingEnabled: request.stream || false
        },
        conversationHistory: optimizedRequest.messages.map(msg => ({
          id: `msg-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          type: 'text' as const,
          urgency: 'normal' as const,
          content: msg.content,
          sender: msg.role === 'user' ? 'user' : 'assistant'
        })),
        contextWindow: 2000, // Reduced for faster processing
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {
          responseStyle: 'concise', // Prefer shorter responses in tests
          maxResponseLength: 512
        }
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
        metadata: {
          ...result.metadata,
          optimized: true,
          testMode: true
        }
      };
      
    } catch (error) {
      logger.error('OllamaRAGAdapterOptimized text generation failed', {
        error: error instanceof Error ? error.message : String(error),
        model: this.agent.getModelInfo().model
      });
      throw error;
    }
  }

  /**
   * Generate streaming text response
   */
  async generateTextStream(
    request: TextGenerationRequest,
    onChunk: (chunk: string) => void
  ): Promise<TextGenerationResponse> {
    // For now, simulate streaming by calling regular generation
    // and chunking the response for tests
    const response = await this.generateText({ ...request, stream: true });
    
    // Simulate streaming by sending chunks
    const chunks = this.chunkResponse(response.content);
    for (const chunk of chunks) {
      onChunk(chunk);
      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return response;
  }

  /**
   * Chunk response for streaming simulation
   */
  private chunkResponse(content: string): string[] {
    const words = content.split(' ');
    const chunks: string[] = [];
    const chunkSize = 5; // 5 words per chunk
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      chunks.push(i === 0 ? chunk : ' ' + chunk);
    }
    
    return chunks;
  }

  /**
   * Fast health check for tests
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const startTime = Date.now();
      const isHealthy = await this.agent.healthCheck();
      const latency = Date.now() - startTime;
      
      return {
        healthy: isHealthy,
        latencyMs: latency,
        timestamp: new Date(),
        metadata: { testOptimized: true }
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

  // Delegate other methods to base implementation
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    throw new Error('Embedding generation not supported in RAG adapter - use dedicated embedding provider');
  }

  getMaxContextWindow(): number {
    return Math.min(this.agent.getMaxContextWindow(), 2000); // Limit for tests
  }

  estimateTokenCount(text: string): number {
    return this.agent.estimateTokenCount(text);
  }

  async getMetrics(): Promise<ProviderMetrics> {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatencyMs: 0,
      totalTokensUsed: 0,
      uptime: Date.now(),
      lastRequestTime: new Date()
    };
  }

  updateConfig(config: Partial<AIProviderConfig>): void {
    logger.info('OllamaRAGAdapterOptimized config update requested', { config });
  }

  getConfig(): AIProviderConfig {
    const modelInfo = this.agent.getModelInfo();
    return {
      name: this.name,
      timeout: 15000, // Shorter timeout for tests
      maxRetries: 2, // Fewer retries for tests
      defaultModel: modelInfo.model,
      models: {
        text: [modelInfo.model],
        embedding: modelInfo.embeddingModel ? [modelInfo.embeddingModel] : []
      }
    };
  }

  async initialize(): Promise<void> {
    await this.agent.initialize();
  }

  async shutdown(): Promise<void> {
    await this.agent.shutdown();
  }

  /**
   * Get the underlying agent
   */
  public getAgent(): OllamaAgent {
    return this.agent;
  }
}

export default OllamaRAGAdapterOptimized;