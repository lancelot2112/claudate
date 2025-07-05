/**
 * RAG Provider Factory
 * 
 * Utility to easily create RAG providers with different client types.
 * Supports API clients and CLI clients based on available credentials.
 */

import { AnthropicClient } from '../integrations/ai/AnthropicClient';
import { GeminiClient } from '../integrations/ai/GeminiClient';
import { ClaudeCLIClient } from '../integrations/ai/ClaudeCLIClient';
import logger from './logger';

export interface RAGProvider {
  name: 'claude' | 'gemini' | 'claude-cli';
  client: AnthropicClient | GeminiClient | ClaudeCLIClient;
  priority: number;
  maxContextLength: number;
}

export interface ProviderOptions {
  preferCLI?: boolean;
  anthropicApiKey?: string;
  geminiApiKey?: string;
  enableFallbacks?: boolean;
  maxContextLength?: number;
  timeout?: number;
}

export class RAGProviderFactory {
  
  /**
   * Create RAG providers based on available options and preferences
   */
  public static async createProviders(options: ProviderOptions = {}): Promise<RAGProvider[]> {
    const {
      preferCLI = true,
      anthropicApiKey = process.env.ANTHROPIC_API_KEY,
      geminiApiKey = process.env.GEMINI_API_KEY,
      enableFallbacks = true,
      maxContextLength = 100000,
      timeout = 30000
    } = options;

    const providers: RAGProvider[] = [];
    let priority = 1;

    logger.info('Creating RAG providers', {
      preferCLI,
      hasAnthropicKey: !!anthropicApiKey,
      hasGeminiKey: !!geminiApiKey,
      enableFallbacks
    });

    // 1. Claude CLI (preferred if available and preferCLI is true)
    if (preferCLI) {
      try {
        const cliClient = new ClaudeCLIClient({ timeout });
        const isAvailable = await cliClient.healthCheck();
        
        if (isAvailable) {
          providers.push({
            name: 'claude-cli',
            client: cliClient,
            priority: priority++,
            maxContextLength: maxContextLength * 2 // CLI can handle larger contexts
          });
          logger.info('Claude CLI provider added', { priority: priority - 1 });
        } else {
          logger.warn('Claude CLI not available, skipping');
        }
      } catch (error) {
        logger.warn('Failed to initialize Claude CLI', { 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 2. Anthropic API Client
    if (anthropicApiKey) {
      try {
        const anthropicClient = new AnthropicClient({
          apiKey: anthropicApiKey,
          defaultModel: 'claude-3-sonnet-20240229',
          timeout
        });

        providers.push({
          name: 'claude',
          client: anthropicClient,
          priority: priority++,
          maxContextLength
        });
        logger.info('Anthropic API provider added', { priority: priority - 1 });
      } catch (error) {
        logger.error('Failed to initialize Anthropic client', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // 3. Gemini API Client
    if (geminiApiKey) {
      try {
        const geminiClient = new GeminiClient({
          apiKey: geminiApiKey,
          defaultModel: 'gemini-1.5-pro',
          timeout
        });

        providers.push({
          name: 'gemini',
          client: geminiClient,
          priority: priority++,
          maxContextLength: maxContextLength * 0.8 // Gemini typically has smaller context windows
        });
        logger.info('Gemini API provider added', { priority: priority - 1 });
      } catch (error) {
        logger.error('Failed to initialize Gemini client', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Add CLI as fallback if we prefer API but CLI is available
    if (!preferCLI && enableFallbacks && !providers.some(p => p.name === 'claude-cli')) {
      try {
        const cliClient = new ClaudeCLIClient({ timeout });
        const isAvailable = await cliClient.healthCheck();
        
        if (isAvailable) {
          providers.push({
            name: 'claude-cli',
            client: cliClient,
            priority: priority++,
            maxContextLength: maxContextLength * 2
          });
          logger.info('Claude CLI added as fallback', { priority: priority - 1 });
        }
      } catch (error) {
        logger.debug('Claude CLI fallback not available', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    if (providers.length === 0) {
      throw new Error('No AI providers available. Please provide API keys or ensure Claude CLI is installed.');
    }

    logger.info('RAG providers created', {
      count: providers.length,
      providers: providers.map(p => ({ name: p.name, priority: p.priority }))
    });

    return providers;
  }

  /**
   * Create a simple CLI-only provider setup
   */
  public static async createCLIOnlyProvider(options: { timeout?: number } = {}): Promise<RAGProvider[]> {
    const { timeout = 30000 } = options;
    
    const cliClient = new ClaudeCLIClient({ timeout });
    const isAvailable = await cliClient.healthCheck();
    
    if (!isAvailable) {
      throw new Error('Claude CLI is not available. Please ensure it is installed and accessible.');
    }

    return [{
      name: 'claude-cli',
      client: cliClient,
      priority: 1,
      maxContextLength: 200000 // CLI can handle very large contexts
    }];
  }

  /**
   * Create an API-only provider setup
   */
  public static createAPIOnlyProviders(options: {
    anthropicApiKey?: string;
    geminiApiKey?: string;
    timeout?: number;
  } = {}): RAGProvider[] {
    const {
      anthropicApiKey = process.env.ANTHROPIC_API_KEY,
      geminiApiKey = process.env.GEMINI_API_KEY,
      timeout = 30000
    } = options;

    const providers: RAGProvider[] = [];

    if (anthropicApiKey) {
      const anthropicClient = new AnthropicClient({
        apiKey: anthropicApiKey,
        timeout
      });

      providers.push({
        name: 'claude',
        client: anthropicClient,
        priority: 1,
        maxContextLength: 200000
      });
    }

    if (geminiApiKey) {
      const geminiClient = new GeminiClient({
        apiKey: geminiApiKey,
        timeout
      });

      providers.push({
        name: 'gemini',
        client: geminiClient,
        priority: 2,
        maxContextLength: 128000
      });
    }

    if (providers.length === 0) {
      throw new Error('No API keys provided for RAG providers.');
    }

    return providers;
  }

  /**
   * Get provider recommendations based on use case
   */
  public static getProviderRecommendations(useCase: 'development' | 'production' | 'cost-sensitive' | 'high-throughput'): ProviderOptions {
    switch (useCase) {
      case 'development':
        return {
          preferCLI: true,
          enableFallbacks: true,
          timeout: 60000 // Longer timeout for development
        };
      
      case 'production':
        return {
          preferCLI: false, // More reliable API calls
          enableFallbacks: true,
          timeout: 30000
        };
      
      case 'cost-sensitive':
        return {
          preferCLI: true,
          enableFallbacks: false, // Avoid API costs
          timeout: 60000
        };
      
      case 'high-throughput':
        return {
          preferCLI: false, // APIs are faster for concurrent requests
          enableFallbacks: false,
          timeout: 15000 // Shorter timeout
        };
      
      default:
        return {
          preferCLI: true,
          enableFallbacks: true,
          timeout: 30000
        };
    }
  }
}

export default RAGProviderFactory;