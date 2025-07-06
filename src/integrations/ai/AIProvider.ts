/**
 * Unified AI Provider Interface
 * 
 * This interface defines a standard contract for all AI providers in the system.
 * It abstracts away provider-specific implementation details and provides a
 * consistent API for text generation, embeddings, and other AI operations.
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, any>;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TextGenerationRequest {
  messages: Message[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  context?: Record<string, any>;
  stream?: boolean;
}

export interface TextGenerationResponse {
  content: string;
  model: string;
  usage: TokenUsage;
  finishReason?: 'stop' | 'length' | 'tool_calls';
  metadata?: Record<string, any>;
}

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
  dimensions?: number;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: TokenUsage;
  metadata?: Record<string, any>;
}

export interface AICapabilities {
  textGeneration: boolean;
  embedding: boolean;
  multiModal: boolean;
  streaming: boolean;
  functionCalling: boolean;
  localExecution: boolean;
  supportedModels: string[];
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  timestamp: Date;
}

export interface ProviderMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatencyMs: number;
  totalTokensUsed: number;
  uptime: number;
  lastRequestTime?: Date;
}

export interface AIProviderConfig {
  name: string;
  endpoint?: string;
  apiKey?: string;
  timeout: number;
  maxRetries: number;
  defaultModel: string;
  models: {
    text: string[];
    embedding: string[];
  };
  rateLimits?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

/**
 * Base AI Provider Interface
 * 
 * All AI providers must implement this interface to ensure consistent
 * behavior across the system.
 */
export interface AIProvider {
  readonly name: string;
  readonly capabilities: AICapabilities;
  
  // Core AI operations
  generateText(request: TextGenerationRequest): Promise<TextGenerationResponse>;
  generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  
  // Health monitoring
  healthCheck(): Promise<HealthStatus>;
  getMetrics(): Promise<ProviderMetrics>;
  
  // Configuration management
  updateConfig(config: Partial<AIProviderConfig>): void;
  getConfig(): AIProviderConfig;
  
  // Lifecycle management
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

/**
 * Abstract base class for AI providers
 * 
 * Provides common functionality and enforces the interface contract.
 */
export abstract class BaseAIProvider implements AIProvider {
  protected config: AIProviderConfig;
  protected metrics: ProviderMetrics;
  protected initialized: boolean = false;
  
  constructor(config: AIProviderConfig) {
    this.config = config;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatencyMs: 0,
      totalTokensUsed: 0,
      uptime: 0
    };
  }
  
  abstract get name(): string;
  abstract get capabilities(): AICapabilities;
  
  abstract generateText(request: TextGenerationRequest): Promise<TextGenerationResponse>;
  abstract generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  
  async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    try {
      // Simple health check with minimal request
      await this.generateText({
        messages: [{ role: 'user', content: 'Hello' }],
        maxTokens: 10
      });
      
      return {
        healthy: true,
        latencyMs: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }
  
  async getMetrics(): Promise<ProviderMetrics> {
    return { ...this.metrics };
  }
  
  updateConfig(config: Partial<AIProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  getConfig(): AIProviderConfig {
    return { ...this.config };
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Base initialization logic
    this.initialized = true;
  }
  
  async shutdown(): Promise<void> {
    // Base shutdown logic
    this.initialized = false;
  }
  
  protected updateMetrics(success: boolean, latency: number, tokens: number = 0): void {
    this.metrics.totalRequests++;
    this.metrics.totalTokensUsed += tokens;
    this.metrics.lastRequestTime = new Date();
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Update average latency
    const totalLatency = this.metrics.averageLatencyMs * (this.metrics.totalRequests - 1) + latency;
    this.metrics.averageLatencyMs = totalLatency / this.metrics.totalRequests;
  }
}

/**
 * Provider Factory for creating and managing AI providers
 */
export class AIProviderFactory {
  private static instance: AIProviderFactory;
  private providers: Map<string, new (config: any) => AIProvider> = new Map();
  private instances: Map<string, AIProvider> = new Map();
  
  static getInstance(): AIProviderFactory {
    if (!AIProviderFactory.instance) {
      AIProviderFactory.instance = new AIProviderFactory();
    }
    return AIProviderFactory.instance;
  }
  
  /**
   * Register a new AI provider class
   */
  register(name: string, providerClass: new (config: any) => AIProvider): void {
    this.providers.set(name, providerClass);
  }
  
  /**
   * Create or get an AI provider instance
   */
  async create(name: string, config: any): Promise<AIProvider> {
    const cacheKey = `${name}-${JSON.stringify(config)}`;
    
    if (this.instances.has(cacheKey)) {
      return this.instances.get(cacheKey)!;
    }
    
    const ProviderClass = this.providers.get(name);
    if (!ProviderClass) {
      throw new Error(`Unknown AI provider: ${name}`);
    }
    
    const provider = new ProviderClass(config);
    await provider.initialize();
    
    this.instances.set(cacheKey, provider);
    return provider;
  }
  
  /**
   * List all registered providers
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Get all active provider instances
   */
  getActiveProviders(): AIProvider[] {
    return Array.from(this.instances.values());
  }
  
  /**
   * Shutdown all providers
   */
  async shutdown(): Promise<void> {
    await Promise.all(
      Array.from(this.instances.values()).map(provider => provider.shutdown())
    );
    this.instances.clear();
  }
}

export default AIProviderFactory;