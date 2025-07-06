/**
 * RAG Provider Factory
 * 
 * Utility to create RAG providers using the unified AI provider interface.
 * Currently focuses on Ollama local models but designed for future extensibility.
 */

import { AIProvider, AIProviderFactory } from '../integrations/ai/AIProvider';
import { OllamaProvider, OllamaProviderConfig } from '../integrations/ai/OllamaProvider';
import { PyTorchProvider, PyTorchProviderConfig } from '../integrations/ai/PyTorchProvider';
import { config } from './config';
import logger from './logger';

export interface RAGProvider {
  name: string;
  client: AIProvider;
  priority: number;
  maxContextLength: number;
}

export interface ProviderOptions {
  // Ollama options
  ollamaHost?: string;
  ollamaPort?: number;
  defaultModel?: string;
  embeddingModel?: string;
  maxContextLength?: number;
  timeout?: number;
  
  // PyTorch options
  pytorchServiceUrl?: string;
  pytorchServicePort?: number;
  pytorchDefaultModel?: string;
  pytorchEmbeddingModel?: string;
  
  // Provider selection
  preferredProvider?: 'ollama' | 'pytorch' | 'auto';
  enableFallback?: boolean;
}

export class RAGProviderFactory {
  private static aiProviderFactory = AIProviderFactory.getInstance();
  
  static {
    // Register available provider types
    RAGProviderFactory.aiProviderFactory.register('ollama', OllamaProvider);
    RAGProviderFactory.aiProviderFactory.register('pytorch', PyTorchProvider);
  }
  
  /**
   * Create RAG providers using the unified AI provider system
   */
  public static async createProviders(options: ProviderOptions = {}): Promise<RAGProvider[]> {
    const {
      // Ollama options
      ollamaHost = config.ai.ollama.host,
      ollamaPort = config.ai.ollama.port,
      defaultModel = config.ai.ollama.defaultModel,
      embeddingModel = config.ai.ollama.embeddingModel,
      maxContextLength = 100000,
      timeout = config.ai.ollama.timeout,
      
      // PyTorch options
      pytorchServiceUrl = config.ai.pytorch.serviceUrl,
      pytorchServicePort = config.ai.pytorch.servicePort,
      pytorchDefaultModel = config.ai.pytorch.defaultModel,
      pytorchEmbeddingModel = config.ai.pytorch.defaultEmbeddingModel,
      
      // Provider selection
      preferredProvider = 'auto',
      enableFallback = true
    } = options;

    const providers: RAGProvider[] = [];
    let priority = 1;

    logger.info('Creating unified RAG providers', {
      preferredProvider,
      enableFallback,
      ollamaHost,
      ollamaPort,
      pytorchServiceUrl,
      pytorchServicePort
    });

    // Determine which providers to try and in what order
    const providersToTry = this.determineProviderOrder(preferredProvider);

    for (const providerType of providersToTry) {
      try {
        if (providerType === 'ollama') {
          const ollamaProvider = await this.createOllamaProvider({
            host: ollamaHost,
            port: ollamaPort,
            defaultModel,
            embeddingModel,
            timeout
          });

          providers.push({
            name: 'ollama',
            client: ollamaProvider,
            priority: priority++,
            maxContextLength
          });

          logger.info('Ollama provider added successfully', { priority: priority - 1 });

        } else if (providerType === 'pytorch') {
          const pytorchProvider = await this.createPyTorchProvider({
            serviceUrl: pytorchServiceUrl,
            servicePort: pytorchServicePort,
            defaultModel: pytorchDefaultModel,
            defaultEmbeddingModel: pytorchEmbeddingModel
          });

          providers.push({
            name: 'pytorch',
            client: pytorchProvider,
            priority: priority++,
            maxContextLength
          });

          logger.info('PyTorch provider added successfully', { priority: priority - 1 });
        }

        // If we don't want fallback and we got our preferred provider, stop
        if (!enableFallback && providers.length > 0) {
          break;
        }

      } catch (error) {
        logger.warn(`Failed to initialize ${providerType} provider`, {
          error: error instanceof Error ? error.message : String(error),
          providerType
        });

        // If this was the preferred provider and no fallback, throw
        if (!enableFallback && providerType === preferredProvider) {
          throw error;
        }
      }
    }

    if (providers.length === 0) {
      throw new Error('No AI providers available. Please ensure at least one provider (Ollama or PyTorch service) is running and accessible.');
    }

    logger.info('RAG providers created', {
      count: providers.length,
      providers: providers.map(p => ({ name: p.name, priority: p.priority }))
    });

    return providers;
  }

  private static determineProviderOrder(preferred: string): string[] {
    switch (preferred) {
      case 'ollama':
        return ['ollama', 'pytorch'];
      case 'pytorch':
        return ['pytorch', 'ollama'];
      case 'auto':
      default:
        return ['ollama', 'pytorch']; // Ollama first by default (faster startup)
    }
  }

  private static async createOllamaProvider(options: {
    host: string;
    port: number;
    defaultModel: string;
    embeddingModel: string;
    timeout: number;
  }): Promise<AIProvider> {
    const ollamaConfig: OllamaProviderConfig = {
      name: 'ollama',
      host: options.host,
      port: options.port,
      timeout: options.timeout,
      maxRetries: 3,
      defaultModel: options.defaultModel,
      embeddingModel: options.embeddingModel,
      models: {
        text: config.ai.ollama.availableModels.reasoning.concat(config.ai.ollama.availableModels.coding),
        embedding: config.ai.ollama.availableModels.embedding
      }
    };

    return await this.aiProviderFactory.create('ollama', ollamaConfig);
  }

  private static async createPyTorchProvider(options: {
    serviceUrl: string;
    servicePort: number;
    defaultModel: string;
    defaultEmbeddingModel: string;
  }): Promise<AIProvider> {
    const pytorchConfig: PyTorchProviderConfig = {
      name: 'pytorch',
      serviceUrl: options.serviceUrl,
      servicePort: options.servicePort,
      defaultModel: options.defaultModel,
      defaultEmbeddingModel: options.defaultEmbeddingModel,
      healthCheckInterval: config.ai.pytorch.healthCheckInterval,
      requestTimeout: config.ai.pytorch.requestTimeout,
      timeout: config.ai.pytorch.requestTimeout,
      maxRetries: 3,
      models: {
        text: config.ai.pytorch.availableModels.reasoning.concat(config.ai.pytorch.availableModels.coding),
        embedding: config.ai.pytorch.availableModels.embedding
      }
    };

    return await this.aiProviderFactory.create('pytorch', pytorchConfig);
  }

  /**
   * Create Ollama provider with specific model (legacy method)
   */
  public static async createSpecificOllamaProvider(options: {
    model: string;
    embeddingModel?: string;
    timeout?: number;
    host?: string;
    port?: number;
  }): Promise<RAGProvider[]> {
    const {
      model,
      embeddingModel = 'all-minilm',
      timeout = 120000,
      host = 'localhost',
      port = 11434
    } = options;

    const ollamaConfig: OllamaProviderConfig = {
      name: 'ollama',
      host,
      port,
      timeout,
      maxRetries: 3,
      defaultModel: model,
      embeddingModel,
      models: {
        text: [model],
        embedding: [embeddingModel]
      }
    };

    const ollamaProvider = await this.aiProviderFactory.create('ollama', ollamaConfig);

    return [{
      name: 'ollama',
      client: ollamaProvider,
      priority: 1,
      maxContextLength: 100000
    }];
  }

  /**
   * Get provider recommendations based on use case for Ollama
   */
  public static getProviderRecommendations(useCase: 'development' | 'production' | 'cost-sensitive' | 'high-throughput'): ProviderOptions {
    const baseOptions = {
      ollamaHost: 'localhost',
      ollamaPort: 11434,
      maxContextLength: 100000
    };

    switch (useCase) {
      case 'development':
        return {
          ...baseOptions,
          defaultModel: 'qwen3:8b', // Good balance of capability and speed
          timeout: 180000 // Longer timeout for development
        };
      
      case 'production':
        return {
          ...baseOptions,
          defaultModel: 'qwen3:8b', // Reliable model for production
          timeout: 120000
        };
      
      case 'cost-sensitive':
        return {
          ...baseOptions,
          defaultModel: 'llama3.2', // Smaller, faster model
          timeout: 90000
        };
      
      case 'high-throughput':
        return {
          ...baseOptions,
          defaultModel: 'llama3.2', // Faster model for high throughput
          timeout: 60000 // Shorter timeout
        };
      
      default:
        return {
          ...baseOptions,
          defaultModel: 'qwen3:8b',
          timeout: 120000
        };
    }
  }

  /**
   * List available models on the Ollama instance
   */
  public static async getAvailableModels(options: {
    host?: string;
    port?: number;
  } = {}): Promise<string[]> {
    const {
      host = 'localhost',
      port = 11434
    } = options;

    try {
      const tempConfig: OllamaProviderConfig = {
        name: 'temp-ollama',
        host,
        port,
        timeout: 30000,
        maxRetries: 1,
        defaultModel: 'qwen3:8b',
        embeddingModel: 'all-minilm',
        models: {
          text: [],
          embedding: []
        }
      };

      const tempProvider = new OllamaProvider(tempConfig);
      return await tempProvider.listAvailableModels();
    } catch (error) {
      logger.error('Failed to list available models', {
        error: error instanceof Error ? error.message : String(error),
        host,
        port
      });
      return [];
    }
  }

  /**
   * Add a new AI provider type to the factory
   */
  public static registerProvider(name: string, providerClass: new (config: any) => AIProvider): void {
    this.aiProviderFactory.register(name, providerClass);
  }

  /**
   * List all registered provider types
   */
  public static getRegisteredProviders(): string[] {
    return this.aiProviderFactory.listProviders();
  }
}

export default RAGProviderFactory;