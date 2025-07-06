/**
 * RAG Provider Factory
 * 
 * Utility to create RAG providers using the unified AI provider interface.
 * Currently focuses on Ollama local models but designed for future extensibility.
 */

import { AIProvider, AIProviderFactory } from '../integrations/ai/AIProvider';
import { OllamaProvider, OllamaProviderConfig } from '../integrations/ai/OllamaProvider';
import logger from './logger';

export interface RAGProvider {
  name: string;
  client: AIProvider;
  priority: number;
  maxContextLength: number;
}

export interface ProviderOptions {
  ollamaHost?: string;
  ollamaPort?: number;
  defaultModel?: string;
  embeddingModel?: string;
  maxContextLength?: number;
  timeout?: number;
}

export class RAGProviderFactory {
  private static aiProviderFactory = AIProviderFactory.getInstance();
  
  static {
    // Register available provider types
    RAGProviderFactory.aiProviderFactory.register('ollama', OllamaProvider);
  }
  
  /**
   * Create RAG providers using the unified AI provider system
   */
  public static async createProviders(options: ProviderOptions = {}): Promise<RAGProvider[]> {
    const {
      ollamaHost = 'localhost',
      ollamaPort = 11434,
      defaultModel = 'qwen3:8b',
      embeddingModel = 'all-minilm',
      maxContextLength = 100000,
      timeout = 120000
    } = options;

    const providers: RAGProvider[] = [];

    logger.info('Creating unified RAG providers', {
      ollamaHost,
      ollamaPort,
      defaultModel,
      embeddingModel
    });

    try {
      // Create Ollama provider using unified interface
      const ollamaConfig: OllamaProviderConfig = {
        name: 'ollama',
        host: ollamaHost,
        port: ollamaPort,
        timeout,
        maxRetries: 3,
        defaultModel,
        embeddingModel,
        models: {
          text: ['qwen3:8b', 'llama3.2', 'mistral', 'deepseek-coder', 'codellama'],
          embedding: ['all-minilm', 'nomic-embed-text']
        }
      };

      const ollamaProvider = await this.aiProviderFactory.create('ollama', ollamaConfig);
      
      providers.push({
        name: 'ollama',
        client: ollamaProvider,
        priority: 1,
        maxContextLength
      });
      
      logger.info('Ollama provider added successfully');

    } catch (error) {
      logger.error('Failed to initialize Ollama provider', {
        error: error instanceof Error ? error.message : String(error),
        ollamaHost,
        ollamaPort
      });
      throw new Error(`Ollama provider initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (providers.length === 0) {
      throw new Error('No AI providers available. Please ensure Ollama is running and accessible.');
    }

    logger.info('RAG providers created', {
      count: providers.length,
      providers: providers.map(p => ({ name: p.name, priority: p.priority }))
    });

    return providers;
  }

  /**
   * Create Ollama provider with specific model
   */
  public static async createOllamaProvider(options: {
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