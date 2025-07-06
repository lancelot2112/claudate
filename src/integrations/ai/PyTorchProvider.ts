/**
 * PyTorch Provider Implementation
 * 
 * Implements the unified AIProvider interface for PyTorch/Hugging Face models
 * via a Python microservice. This enables direct access to any HF model while
 * maintaining the same interface as other providers.
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
import logger from '../../utils/logger';
import axios, { AxiosInstance } from 'axios';

export interface PyTorchProviderConfig extends AIProviderConfig {
  serviceUrl: string;
  servicePort: number;
  defaultEmbeddingModel: string;
  healthCheckInterval: number;
  requestTimeout: number;
}

interface PyTorchMessage {
  role: string;
  content: string;
}

interface PyTorchGenerateRequest {
  model: string;
  messages: PyTorchMessage[];
  max_tokens: number;
  temperature: number;
  top_p: number;
}

interface PyTorchGenerateResponse {
  content: string;
  model: string;
  finish_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
}

interface PyTorchEmbeddingRequest {
  model: string;
  texts: string[];
  normalize: boolean;
}

interface PyTorchEmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: {
    input_tokens: number;
    total_tokens: number;
  };
}

interface PyTorchHealthResponse {
  status: string;
  timestamp: string;
  pytorch_version: string;
  cuda_available: boolean;
  loaded_models: string[];
}

interface PyTorchModelInfo {
  model_id: string;
  model_type: string;
  loaded: boolean;
  memory_usage?: number;
  last_used?: string;
}

export class PyTorchProvider extends BaseAIProvider {
  private client: AxiosInstance;
  private pytorchConfig: PyTorchProviderConfig;
  private lastHealthCheck?: Date;
  private isServiceHealthy: boolean = false;

  constructor(config: PyTorchProviderConfig) {
    super(config);
    this.pytorchConfig = config;
    
    this.client = axios.create({
      baseURL: `${config.serviceUrl}:${config.servicePort}`,
      timeout: config.requestTimeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    logger.info('PyTorchProvider initialized', {
      name: this.name,
      serviceUrl: config.serviceUrl,
      servicePort: config.servicePort,
      defaultModel: config.defaultModel
    });
  }

  get name(): string {
    return 'pytorch';
  }

  get capabilities(): AICapabilities {
    return {
      textGeneration: true,
      embedding: true,
      multiModal: false, // Can be extended for vision models
      streaming: false, // Can be implemented with SSE
      functionCalling: false, // Can be added for specific models
      localExecution: true,
      supportedModels: this.config.models.text
    };
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    const startTime = Date.now();
    
    try {
      logger.debug('Generating text with PyTorch service', {
        model: request.model || this.config.defaultModel,
        messageCount: request.messages.length
      });

      // Convert unified format to PyTorch service format
      const pytorchMessages: PyTorchMessage[] = request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Add system prompt as first message if provided
      if (request.systemPrompt) {
        pytorchMessages.unshift({
          role: 'system',
          content: request.systemPrompt
        });
      }

      const pytorchRequest: PyTorchGenerateRequest = {
        model: request.model || this.config.defaultModel,
        messages: pytorchMessages,
        max_tokens: request.maxTokens || 500,
        temperature: request.temperature || 0.7,
        top_p: 0.9
      };

      const response = await this.client.post<PyTorchGenerateResponse>(
        '/generate',
        pytorchRequest
      );

      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime, response.data.usage.total_tokens);

      return {
        content: response.data.content,
        model: response.data.model,
        usage: {
          inputTokens: response.data.usage.input_tokens,
          outputTokens: response.data.usage.output_tokens,
          totalTokens: response.data.usage.total_tokens
        },
        finishReason: response.data.finish_reason as any,
        metadata: {
          processingTime,
          serviceProvider: 'pytorch'
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime);
      
      logger.error('PyTorch text generation failed', {
        error: error instanceof Error ? error.message : String(error),
        model: request.model || this.config.defaultModel,
        processingTime
      });
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.detail || error.message;
        throw new Error(`PyTorch service error (${status}): ${message}`);
      }
      
      throw new Error(`PyTorch text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const startTime = Date.now();
    
    try {
      logger.debug('Generating embeddings with PyTorch service', {
        model: request.model || this.pytorchConfig.defaultEmbeddingModel,
        textCount: request.texts.length
      });

      const pytorchRequest: PyTorchEmbeddingRequest = {
        model: request.model || this.pytorchConfig.defaultEmbeddingModel,
        texts: request.texts,
        normalize: true
      };

      const response = await this.client.post<PyTorchEmbeddingResponse>(
        '/embeddings',
        pytorchRequest
      );

      const processingTime = Date.now() - startTime;
      this.updateMetrics(true, processingTime, response.data.usage.total_tokens);

      return {
        embeddings: response.data.embeddings,
        model: response.data.model,
        usage: {
          inputTokens: response.data.usage.input_tokens,
          outputTokens: 0,
          totalTokens: response.data.usage.total_tokens
        },
        metadata: {
          processingTime,
          serviceProvider: 'pytorch'
        }
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(false, processingTime);
      
      logger.error('PyTorch embedding generation failed', {
        error: error instanceof Error ? error.message : String(error),
        model: request.model || this.pytorchConfig.defaultEmbeddingModel,
        processingTime
      });
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.detail || error.message;
        throw new Error(`PyTorch service error (${status}): ${message}`);
      }
      
      throw new Error(`PyTorch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  override async healthCheck(): Promise<HealthStatus> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.get<PyTorchHealthResponse>('/health');
      
      this.isServiceHealthy = response.data.status === 'healthy';
      this.lastHealthCheck = new Date();
      
      return {
        healthy: this.isServiceHealthy,
        latencyMs: Date.now() - startTime,
        timestamp: new Date(),
        metadata: {
          pytorchVersion: response.data.pytorch_version,
          cudaAvailable: response.data.cuda_available,
          loadedModels: response.data.loaded_models
        }
      };
    } catch (error) {
      this.isServiceHealthy = false;
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'PyTorch service unreachable',
        timestamp: new Date()
      };
    }
  }

  override async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.info('Initializing PyTorch provider', { name: this.name });
      
      // Test connection to PyTorch service
      const health = await this.healthCheck();
      if (!health.healthy) {
        throw new Error(`PyTorch service health check failed: ${health.error}`);
      }

      // Optionally preload default models
      if (this.config.defaultModel) {
        await this.preloadModel(this.config.defaultModel, 'text-generation');
      }
      
      if (this.pytorchConfig.defaultEmbeddingModel) {
        await this.preloadModel(this.pytorchConfig.defaultEmbeddingModel, 'embedding');
      }

      this.initialized = true;
      logger.info('PyTorch provider initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize PyTorch provider', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  override async shutdown(): Promise<void> {
    logger.info('Shutting down PyTorch provider');
    this.initialized = false;
  }

  // PyTorch-specific methods

  async preloadModel(modelId: string, modelType: string = 'text-generation'): Promise<void> {
    try {
      logger.info('Preloading PyTorch model', { model: modelId, type: modelType });
      
      await this.client.post('/models/load', null, {
        params: {
          model_id: modelId,
          model_type: modelType
        }
      });
      
      logger.info('Model preloaded successfully', { model: modelId });
    } catch (error) {
      logger.warn('Failed to preload model', {
        model: modelId,
        error: error instanceof Error ? error.message : String(error)
      });
      // Don't throw - preloading is optional
    }
  }

  async unloadModel(modelId: string): Promise<void> {
    try {
      await this.client.post('/models/unload', null, {
        params: { model_id: modelId }
      });
      
      logger.info('Model unloaded', { model: modelId });
    } catch (error) {
      logger.error('Failed to unload model', {
        model: modelId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async listLoadedModels(): Promise<PyTorchModelInfo[]> {
    try {
      const response = await this.client.get<PyTorchModelInfo[]>('/models');
      return response.data;
    } catch (error) {
      logger.error('Failed to list models', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async deleteModelCache(modelId: string): Promise<void> {
    try {
      await this.client.delete(`/models/${modelId}`);
      logger.info('Model cache deleted', { model: modelId });
    } catch (error) {
      logger.error('Failed to delete model cache', {
        model: modelId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Service management
  isServiceAvailable(): boolean {
    return this.isServiceHealthy;
  }

  getLastHealthCheck(): Date | undefined {
    return this.lastHealthCheck;
  }

  getServiceUrl(): string {
    return `${this.pytorchConfig.serviceUrl}:${this.pytorchConfig.servicePort}`;
  }
}

export default PyTorchProvider;