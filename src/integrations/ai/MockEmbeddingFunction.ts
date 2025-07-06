import logger from '../../utils/logger';

export interface EmbeddingFunction {
  generate(texts: string[]): Promise<number[][]>;
}

export class MockEmbeddingFunction implements EmbeddingFunction {
  private dimensions: number;

  constructor(dimensions: number = 1536) {
    this.dimensions = dimensions;
    logger.info('MockEmbeddingFunction initialized', { dimensions });
  }

  public async generate(texts: string[]): Promise<number[][]> {
    logger.debug('Generating mock embeddings', {
      textCount: texts.length,
      dimensions: this.dimensions
    });

    // Generate deterministic embeddings based on text content
    const embeddings = texts.map(text => {
      const embedding = new Float32Array(this.dimensions);
      
      // Create semi-realistic embeddings based on text characteristics
      const hash = this.hashString(text);
      const seed = hash % 1000;
      
      for (let i = 0; i < this.dimensions; i++) {
        // Use a simple pseudo-random number generator with the text hash as seed
        const pseudoRandom = Math.sin(seed + i) * 10000;
        embedding[i] = (pseudoRandom - Math.floor(pseudoRandom)) * 2 - 1; // Range [-1, 1]
      }

      // Normalize the vector
      const magnitude = Math.sqrt(Array.from(embedding).reduce((sum, val) => sum + val * val, 0));
      if (magnitude > 0) {
        for (let i = 0; i < this.dimensions; i++) {
          embedding[i] = embedding[i]! / magnitude;
        }
      }

      return Array.from(embedding);
    });

    logger.debug('Mock embeddings generated', {
      textCount: texts.length,
      dimensions: embeddings[0]?.length || 0
    });

    return embeddings;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  public getDimensions(): number {
    return this.dimensions;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const testEmbedding = await this.generate(['test']);
      return testEmbedding.length > 0 && (testEmbedding[0]?.length || 0) === this.dimensions;
    } catch (error) {
      logger.error('Mock embedding health check failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}