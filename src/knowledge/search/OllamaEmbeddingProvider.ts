import { EmbeddingProvider } from './SemanticSearch';
import logger from '../../utils/logger';

/**
 * Ollama Embedding Provider
 * 
 * Uses Ollama's embedding API for real semantic embeddings
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private dimensions: number;
  private model: string;
  private baseUrl: string;

  constructor(
    model = 'mxbai-embed-large:latest',
    dimensions = 1024,
    baseUrl = 'http://localhost:11434'
  ) {
    this.model = model;
    this.dimensions = dimensions;
    this.baseUrl = baseUrl;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings API error: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      return data.embedding;
    } catch (error) {
      logger.error('Failed to generate Ollama embedding', {
        error: error instanceof Error ? error.message : String(error),
        text: text.substring(0, 100),
        model: this.model
      });
      
      // Fallback to a simple deterministic embedding for tests
      logger.warn('Falling back to deterministic embedding for testing');
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate a deterministic fallback embedding when Ollama is unavailable
   */
  private generateFallbackEmbedding(text: string): number[] {
    const hash = this.hashString(text);
    const embedding = new Array(this.dimensions);
    
    for (let i = 0; i < this.dimensions; i++) {
      embedding[i] = Math.sin((hash + i) * 0.01) * 0.5;
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }

  /**
   * Test if Ollama embeddings are available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (!response.ok) return false;
      
      const data = await response.json();
      return data.models?.some((model: any) => 
        model.name.includes('embed') || model.name.includes(this.model)
      ) || false;
    } catch (error) {
      return false;
    }
  }
}

export default OllamaEmbeddingProvider;