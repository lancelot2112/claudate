/**
 * Ollama Provider Implementation
 * 
 * Implements the unified AIProvider interface for Ollama local models.
 * This provides a standardized way to interact with Ollama while maintaining
 * the flexibility to add other providers in the future.
 */

import {
  BaseAIProvider,
  AICapabilities,
  TextGenerationRequest,
  TextGenerationResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  AIProviderConfig,
  HealthStatus
} from './AIProvider';
import { OllamaClient } from './OllamaClient';
import logger from '../../utils/logger';

export interface OllamaProviderConfig extends AIProviderConfig {
  host: string;
  port: number;
  embeddingModel: string;
}

export class OllamaProvider extends BaseAIProvider {
  private ollamaClient: OllamaClient;
  private ollamaConfig: OllamaProviderConfig;

  constructor(config: OllamaProviderConfig) {
    super(config);
    this.ollamaConfig = config;
    
    this.ollamaClient = new OllamaClient({
      host: config.host,
      port: config.port,
      defaultModel: config.defaultModel,
      embeddingModel: config.embeddingModel,
      timeout: config.timeout,
      maxRetries: config.maxRetries
    });
    
    logger.info('OllamaProvider initialized', {
      name: this.name,
      host: config.host,
      port: config.port,
      defaultModel: config.defaultModel
    });
  }

  get name(): string {
    return 'ollama';
  }

  get capabilities(): AICapabilities {
    return {
      textGeneration: true,
      embedding: true,
      multiModal: false,
      streaming: false,
      functionCalling: false,
      localExecution: true,
      supportedModels: this.config.models.text
    };
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const startTime = Date.now();
    
    try {
      logger.debug('Generating text with Ollama', {
        model: request.model || this.config.defaultModel,
        messageCount: request.messages.length
      });

      // Convert unified format to Ollama format
      const ollamaMessages = request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add system prompt if provided
      if (request.systemPrompt) {
        ollamaMessages.unshift({
          role: 'system' as const,
          content: request.systemPrompt
        });
      }

      const response = await this.ollamaClient.sendMessage({
        model: request.model || this.config.defaultModel,
        messages: ollamaMessages,
        options: {
          temperature: request.temperature,
          max_tokens: request.maxTokens
        }
      });

      const processingTime = Date.now() - startTime;
      const estimatedTokens = Math.ceil((request.messages.join(' ').length + response.content.length) / 4);

      this.updateMetrics(true, processingTime, estimatedTokens);

      return {
        content: response.content,
        model: response.model,
        usage: {
          inputTokens: Math.ceil(request.messages.join(' ').length / 4),
          outputTokens: Math.ceil(response.content.length / 4),
          totalTokens: estimatedTokens
        },
        finishReason: response.done ? 'stop' : undefined,
        metadata: {
          totalDuration: response.total_duration,
          loadDuration: response.load_duration,
          promptEvalCount: response.prompt_eval_count,
          evalCount: response.eval_count
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime);
      
      logger.error('Ollama text generation failed', {
        error: error instanceof Error ? error.message : String(error),
        model: request.model || this.config.defaultModel,
        processingTime
      });
      
      throw new Error(`Ollama text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    
    try {
      logger.debug('Generating embeddings with Ollama', {
        model: request.model || this.ollamaConfig.embeddingModel,
        textCount: request.texts.length
      });

      const embeddings = await this.ollamaClient.generateEmbeddings(
        request.texts,
        request.model || this.ollamaConfig.embeddingModel
      );

      const processingTime = Date.now() - startTime;
      const estimatedTokens = Math.ceil(request.texts.join(' ').length / 4);

      this.updateMetrics(true, processingTime, estimatedTokens);

      return {
        embeddings,
        model: request.model || this.ollamaConfig.embeddingModel,
        usage: {
          inputTokens: estimatedTokens,
          outputTokens: 0,
          totalTokens: estimatedTokens
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime);
      
      logger.error('Ollama embedding generation failed', {
        error: error instanceof Error ? error.message : String(error),
        model: request.model || this.ollamaConfig.embeddingModel,
        processingTime
      });
      
      throw new Error(`Ollama embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  override async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await this.ollamaClient.healthCheck();
      
      return {
        healthy: isHealthy,
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

  override async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.info('Initializing Ollama provider', { name: this.name });
      
      // Test connection
      const health = await this.healthCheck();
      if (!health.healthy) {
        throw new Error(`Ollama health check failed: ${health.error}`);
      }

      // Get available models
      const availableModels = await this.ollamaClient.listModels();
      logger.info('Ollama models available', { models: availableModels });

      // Verify default model is available
      if (!availableModels.includes(this.config.defaultModel)) {
        logger.warn('Default model not found, pulling...', { model: this.config.defaultModel });
        await this.ollamaClient.pullModel(this.config.defaultModel);
      }

      // Verify embedding model is available
      if (!availableModels.includes(this.ollamaConfig.embeddingModel)) {
        logger.warn('Embedding model not found, pulling...', { model: this.ollamaConfig.embeddingModel });
        await this.ollamaClient.pullModel(this.ollamaConfig.embeddingModel);
      }

      this.initialized = true;
      logger.info('Ollama provider initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Ollama provider', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  override async shutdown(): Promise<void> {
    logger.info('Shutting down Ollama provider');
    this.initialized = false;
  }

  // Ollama-specific methods
  async listAvailableModels(): Promise<string[]> {
    return await this.ollamaClient.listModels();
  }

  async pullModel(model: string): Promise<void> {
    logger.info('Pulling Ollama model', { model });
    await this.ollamaClient.pullModel(model);
  }

  getOllamaClient(): OllamaClient {
    return this.ollamaClient;
  }
}

export default OllamaProvider;