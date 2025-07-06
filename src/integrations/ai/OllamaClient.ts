import { Ollama } from 'ollama';
import { config } from '../../utils/config';
import logger from '../../utils/logger';

export interface OllamaMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface OllamaRequest {
  model: string;
  messages?: OllamaMessage[];
  prompt?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
  };
}

export interface OllamaResponse {
  content: string;
  model: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export interface OllamaEmbeddingResponse {
  embedding: number[];
  model: string;
}

export interface OllamaConfig {
  host: string;
  port: number;
  defaultModel: string;
  embeddingModel: string;
  timeout: number;
  maxRetries: number;
}

export class OllamaClient {
  private client: Ollama;
  private config: OllamaConfig;
  private costTracker: Map<string, number> = new Map();

  constructor(customConfig?: Partial<OllamaConfig>) {
    this.config = {
      host: config.ai?.ollama?.host || 'localhost',
      port: config.ai?.ollama?.port || 11434,
      defaultModel: config.ai?.ollama?.defaultModel || 'llama3.2',
      embeddingModel: config.ai?.ollama?.embeddingModel || 'qwen2.5',
      timeout: config.ai?.ollama?.timeout || 30000,
      maxRetries: config.ai?.ollama?.maxRetries || 3,
      ...customConfig
    };

    this.client = new Ollama({
      host: `http://${this.config.host}:${this.config.port}`
    });

    logger.info('OllamaClient initialized', {
      host: this.config.host,
      port: this.config.port,
      defaultModel: this.config.defaultModel,
      embeddingModel: this.config.embeddingModel
    });
  }

  public async sendMessage(request: OllamaRequest): Promise<OllamaResponse> {
    try {
      const startTime = Date.now();
      const model = request.model || this.config.defaultModel;

      logger.debug('Sending message to Ollama', {
        model,
        messageCount: request.messages?.length || 0,
        hasPrompt: !!request.prompt
      });

      let response;
      if (request.messages) {
        // Chat completion format
        response = await this.client.chat({
          model,
          messages: request.messages,
          stream: false,
          options: request.options
        });
      } else if (request.prompt) {
        // Direct prompt format
        response = await this.client.generate({
          model,
          prompt: request.prompt,
          stream: false,
          options: request.options
        });
      } else {
        throw new Error('Either messages or prompt must be provided');
      }

      const duration = Date.now() - startTime;
      
      // Track costs (Ollama is free but track usage)
      this.updateCosts('local', 0);

      logger.debug('Ollama response received', {
        model,
        duration,
        responseLength: ('message' in response ? response.message?.content?.length : response.response?.length) || 0
      });

      return {
        content: ('message' in response ? response.message?.content : response.response) || '',
        model: response.model,
        done: response.done || true,
        total_duration: response.total_duration,
        load_duration: response.load_duration,
        prompt_eval_count: response.prompt_eval_count,
        eval_count: response.eval_count
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Ollama message failed', {
        error: errorMessage,
        model: request.model || this.config.defaultModel
      });
      throw new Error(`Ollama request failed: ${errorMessage}`);
    }
  }

  public async generateEmbedding(text: string, model?: string): Promise<OllamaEmbeddingResponse> {
    try {
      const startTime = Date.now();
      const embeddingModel = model || this.config.embeddingModel;

      logger.debug('Generating embedding with Ollama', {
        model: embeddingModel,
        textLength: text.length
      });

      const response = await this.client.embeddings({
        model: embeddingModel,
        prompt: text
      });

      const duration = Date.now() - startTime;
      
      // Track costs (free for local)
      this.updateCosts('embedding', 0);

      logger.debug('Ollama embedding generated', {
        model: embeddingModel,
        duration,
        dimensions: response.embedding?.length || 0
      });

      if (!response.embedding || response.embedding.length === 0) {
        throw new Error('No embedding returned from Ollama');
      }

      return {
        embedding: response.embedding,
        model: embeddingModel
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Ollama embedding failed', {
        error: errorMessage,
        model: model || this.config.embeddingModel
      });
      throw new Error(`Ollama embedding failed: ${errorMessage}`);
    }
  }

  public async generateEmbeddings(texts: string[], model?: string): Promise<number[][]> {
    try {
      const embeddings: number[][] = [];
      
      for (const text of texts) {
        const response = await this.generateEmbedding(text, model);
        embeddings.push(response.embedding);
      }

      return embeddings;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Ollama batch embeddings failed', { error: errorMessage });
      throw new Error(`Ollama batch embeddings failed: ${errorMessage}`);
    }
  }

  public async listModels(): Promise<string[]> {
    try {
      const response = await this.client.list();
      return response.models?.map(model => model.name) || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to list Ollama models', { error: errorMessage });
      throw new Error(`Failed to list models: ${errorMessage}`);
    }
  }

  public async pullModel(model: string): Promise<void> {
    try {
      logger.info('Pulling Ollama model', { model });
      await this.client.pull({ model });
      logger.info('Model pulled successfully', { model });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to pull Ollama model', { error: errorMessage, model });
      throw new Error(`Failed to pull model ${model}: ${errorMessage}`);
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const models = await this.listModels();
      return models.length >= 0; // Even empty list means service is running
    } catch (error) {
      logger.error('Ollama health check failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public getCosts(): Map<string, number> {
    return new Map(this.costTracker);
  }

  private updateCosts(type: string, cost: number): void {
    const today = new Date().toISOString().split('T')[0]!;
    const key = `${today}-${type}`;
    const current = this.costTracker.get(key) || 0;
    this.costTracker.set(key, current + cost);
  }
}