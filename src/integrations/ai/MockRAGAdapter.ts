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
 * Mock RAG Adapter for Fast Testing
 * 
 * This adapter provides instant responses for testing RAG functionality
 * without requiring actual AI inference. Perfect for unit tests and CI/CD.
 */
export class MockRAGAdapter implements AIProvider {
  readonly name: string = 'mock-rag-adapter';
  readonly capabilities: AICapabilities;

  constructor() {
    this.capabilities = {
      textGeneration: true,
      embedding: true,
      multiModal: false,
      streaming: true,
      functionCalling: false,
      localExecution: true,
      supportedModels: ['mock-model'],
      maxContextWindow: 2000
    };
  }

  /**
   * Generate mock text responses instantly
   */
  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    try {
      const userMessage = request.messages.find(m => m.role === 'user')?.content || '';
      const mockResponse = this.generateMockResponse(userMessage);
      
      // Small delay to simulate processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        content: mockResponse,
        model: 'mock-model',
        usage: {
          inputTokens: userMessage.length / 4, // Rough token estimate
          outputTokens: mockResponse.length / 4,
          totalTokens: (userMessage.length + mockResponse.length) / 4
        },
        finishReason: 'stop',
        metadata: {
          mock: true,
          testMode: true,
          responseTime: 100
        }
      };
      
    } catch (error) {
      logger.error('MockRAGAdapter text generation failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Generate contextually appropriate mock responses
   */
  private generateMockResponse(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    // AI-related questions
    if (lowerQuery.includes('ai') || lowerQuery.includes('artificial intelligence')) {
      return 'Artificial Intelligence (AI) is a branch of computer science that focuses on creating systems capable of performing tasks that typically require human intelligence. Key areas include machine learning, natural language processing, and computer vision.';
    }
    
    // Local AI deployment questions
    if (lowerQuery.includes('local') || lowerQuery.includes('ollama') || lowerQuery.includes('deployment')) {
      return 'Local AI deployment provides several benefits including complete data privacy, no API costs, offline operation capability, and full control over model versions. Tools like Ollama make it easy to run models locally.';
    }
    
    // Qwen model questions
    if (lowerQuery.includes('qwen')) {
      return 'Qwen is a series of large language models developed by Alibaba Cloud. Key features include multilingual capabilities, various model sizes from 1.8B to 72B parameters, and specialized versions for coding and mathematics.';
    }
    
    // RAG system questions
    if (lowerQuery.includes('rag') || lowerQuery.includes('retrieval')) {
      return 'Retrieval-Augmented Generation (RAG) combines information retrieval with text generation to provide more accurate and contextual responses. It uses vector databases for semantic search and ranking systems for content quality.';
    }
    
    // Generic technical questions
    if (lowerQuery.includes('how') || lowerQuery.includes('what') || lowerQuery.includes('why')) {
      return 'Based on the provided context, this is a comprehensive answer that addresses the key aspects of your question. The information is derived from relevant knowledge sources and provides factual, helpful details.';
    }
    
    // Default response
    return 'This is a mock response generated for testing purposes. The actual RAG system would retrieve relevant documents and generate a contextual response based on the knowledge base.';
  }

  /**
   * Mock embedding generation (not used in RAG adapter)
   */
  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    throw new Error('Embedding generation not supported in RAG adapter - use dedicated embedding provider');
  }

  /**
   * Mock health check - always healthy
   */
  async healthCheck(): Promise<HealthStatus> {
    return {
      healthy: true,
      latencyMs: 1,
      timestamp: new Date(),
      metadata: { mock: true }
    };
  }

  /**
   * Mock metrics
   */
  async getMetrics(): Promise<ProviderMetrics> {
    return {
      totalRequests: 100,
      successfulRequests: 100,
      failedRequests: 0,
      averageLatencyMs: 1,
      totalTokensUsed: 1000,
      uptime: Date.now(),
      lastRequestTime: new Date()
    };
  }

  getMaxContextWindow(): number {
    return 2000;
  }

  estimateTokenCount(text: string): number {
    return Math.ceil(text.length / 4); // Rough estimation
  }

  updateConfig(config: Partial<AIProviderConfig>): void {
    logger.info('MockRAGAdapter config update requested', { config });
  }

  getConfig(): AIProviderConfig {
    return {
      name: this.name,
      timeout: 1000,
      maxRetries: 1,
      defaultModel: 'mock-model',
      models: {
        text: ['mock-model'],
        embedding: []
      }
    };
  }

  async initialize(): Promise<void> {
    logger.info('MockRAGAdapter initialized');
  }

  async shutdown(): Promise<void> {
    logger.info('MockRAGAdapter shutdown');
  }

  /**
   * Mock streaming for testing
   */
  async generateTextStream(
    request: TextGenerationRequest,
    onChunk: (chunk: string) => void
  ): Promise<TextGenerationResponse> {
    const response = await this.generateText(request);
    
    // Simulate streaming by chunking the response
    const words = response.content.split(' ');
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(' ');
      onChunk(i === 0 ? chunk : ' ' + chunk);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return response;
  }
}

export default MockRAGAdapter;