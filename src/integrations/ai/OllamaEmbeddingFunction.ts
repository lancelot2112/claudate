import { OllamaClient } from './OllamaClient';
import logger from '../../utils/logger';

export interface EmbeddingFunction {
  generate(texts: string[]): Promise<number[][]>;
}

export class OllamaEmbeddingFunction implements EmbeddingFunction {
  private ollamaClient: OllamaClient;
  private model: string;

  constructor(model: string = 'mxbai-embed-large:latest', ollamaConfig?: any) {
    this.model = model;
    this.ollamaClient = new OllamaClient(ollamaConfig);
    
    logger.info('OllamaEmbeddingFunction initialized', {
      model: this.model
    });
  }

  public async generate(texts: string[]): Promise<number[][]> {
    try {
      logger.debug('Generating embeddings', {
        model: this.model,
        textCount: texts.length,
        totalLength: texts.reduce((sum, text) => sum + text.length, 0)
      });

      const embeddings = await this.ollamaClient.generateEmbeddings(texts, this.model);
      
      // Convert to Float32Array format that ChromaDB expects
      const float32Embeddings = embeddings.map(embedding => 
        Array.from(new Float32Array(embedding))
      );

      logger.debug('Embeddings generated successfully', {
        model: this.model,
        textCount: texts.length,
        dimensions: float32Embeddings[0]?.length || 0
      });

      return float32Embeddings;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to generate embeddings', {
        error: errorMessage,
        model: this.model,
        textCount: texts.length
      });
      throw new Error(`Embedding generation failed: ${errorMessage}`);
    }
  }

  public getModel(): string {
    return this.model;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Test with a simple text
      const testEmbedding = await this.generate(['test']);
      return testEmbedding.length > 0 && (testEmbedding[0]?.length || 0) > 0;
    } catch (error) {
      logger.error('Ollama embedding health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}