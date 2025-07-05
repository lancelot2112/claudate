import { 
  KnowledgeQuery, 
  SearchResult, 
  SearchResponse, 
  IVectorStore,
  IRelationalStore,
  QueryFilter,
  VectorSearchOptions
} from '../../types/Knowledge';
import logger from '../../utils/logger';

export interface SearchStrategy {
  name: 'semantic' | 'keyword' | 'hybrid';
  weight: number;
}

export interface SemanticSearchConfig {
  defaultLimit: number;
  defaultThreshold: number;
  strategies: SearchStrategy[];
  enableReranking: boolean;
  contextWindow: number;
  maxResults: number;
}

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  getDimensions(): number;
  getModel(): string;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private dimensions: number;

  constructor(apiKey: string, model = 'text-embedding-ada-002') {
    this.apiKey = apiKey;
    this.model = model;
    this.dimensions = 1536; // Default for text-embedding-ada-002
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          input: text
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json() as { data: Array<{ embedding: number[] }> };
      if (!data.data || data.data.length === 0) {
        throw new Error('No embedding data received from OpenAI API');
      }
      const firstItem = data.data[0];
      if (!firstItem) {
        throw new Error('Invalid embedding response format');
      }
      return firstItem.embedding;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate embedding', { error: errorMessage });
      throw new Error(`Embedding generation failed: ${errorMessage}`);
    }
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModel(): string {
    return this.model;
  }
}

export class SemanticSearchEngine {
  private vectorStore: IVectorStore;
  private relationalStore?: IRelationalStore;
  private embeddingProvider: EmbeddingProvider;
  private config: SemanticSearchConfig;

  constructor(
    vectorStore: IVectorStore,
    embeddingProvider: EmbeddingProvider,
    relationalStore?: IRelationalStore,
    config: Partial<SemanticSearchConfig> = {}
  ) {
    this.vectorStore = vectorStore;
    this.relationalStore = relationalStore;
    this.embeddingProvider = embeddingProvider;
    
    this.config = {
      defaultLimit: 10,
      defaultThreshold: 0.7,
      strategies: [
        { name: 'semantic', weight: 0.7 },
        { name: 'keyword', weight: 0.3 }
      ],
      enableReranking: true,
      contextWindow: 3,
      maxResults: 50,
      ...config
    };

    logger.info('SemanticSearchEngine initialized', { 
      embeddingModel: this.embeddingProvider.getModel(),
      config: this.config 
    });
  }

  public async search(query: KnowledgeQuery): Promise<SearchResponse> {
    try {
      const startTime = Date.now();
      
      logger.debug('Starting semantic search', { 
        query: query.query.substring(0, 100),
        filters: query.filters?.length || 0 
      });

      const results = await this.executeHybridSearch(query);
      const processedResults = await this.postProcessResults(results, query);
      
      const processingTime = Date.now() - startTime;

      const response: SearchResponse = {
        results: processedResults,
        query: query.query,
        totalResults: processedResults.length,
        processingTime,
        metadata: {
          searchType: 'hybrid',
          model: this.embeddingProvider.getModel(),
          threshold: query.threshold || this.config.defaultThreshold,
          filters: query.filters
        }
      };

      logger.info('Semantic search completed', {
        query: query.query.substring(0, 100),
        results: processedResults.length,
        processingTime
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Semantic search failed', { 
        query: query.query.substring(0, 100),
        error: errorMessage 
      });
      throw new Error(`Search failed: ${errorMessage}`);
    }
  }

  public async searchSimilarDocuments(documentId: string, limit = 10): Promise<SearchResult[]> {
    try {
      const document = await this.vectorStore.getDocument(documentId);
      if (!document) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Use document content for similarity search
      const results = await this.vectorStore.searchSimilar(document.content, {
        k: limit + 1, // +1 to exclude the original document
        threshold: this.config.defaultThreshold
      });

      // Filter out the original document
      return results.filter(result => result.document.id !== documentId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Similar documents search failed', { 
        documentId,
        error: errorMessage 
      });
      throw new Error(`Similar documents search failed: ${errorMessage}`);
    }
  }

  public async searchByTags(tags: string[], limit = 20): Promise<SearchResult[]> {
    if (!this.relationalStore) {
      throw new Error('Relational store not configured');
    }

    try {
      const documents = await this.relationalStore.getDocumentsByTags(tags);
      
      return documents.slice(0, limit).map(document => ({
        document,
        score: 1.0, // Perfect match for tag search
        relevanceScore: 1.0
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Tag search failed', { tags, error: errorMessage });
      throw new Error(`Tag search failed: ${errorMessage}`);
    }
  }

  public async searchByType(type: string, query?: string, limit = 20): Promise<SearchResult[]> {
    if (!this.relationalStore) {
      throw new Error('Relational store not configured');
    }

    try {
      const documents = await this.relationalStore.getDocumentsByType(type as any);
      
      let results = documents.map(document => ({
        document,
        score: 1.0,
        relevanceScore: 1.0
      }));

      // If query provided, filter by content relevance
      if (query) {
        results = results.filter(result => 
          result.document.content.toLowerCase().includes(query.toLowerCase()) ||
          result.document.title.toLowerCase().includes(query.toLowerCase())
        );
      }

      return results.slice(0, limit);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Type search failed', { type, error: errorMessage });
      throw new Error(`Type search failed: ${errorMessage}`);
    }
  }

  private async executeHybridSearch(query: KnowledgeQuery): Promise<SearchResult[]> {
    const allResults: SearchResult[] = [];

    // Execute semantic search
    const semanticStrategy = this.config.strategies.find(s => s.name === 'semantic');
    if (semanticStrategy) {
      const semanticResults = await this.executeSemanticSearch(query);
      allResults.push(...this.applyStrategyWeight(semanticResults, semanticStrategy.weight));
    }

    // Execute keyword search
    const keywordStrategy = this.config.strategies.find(s => s.name === 'keyword');
    if (keywordStrategy && this.relationalStore) {
      const keywordResults = await this.executeKeywordSearch(query);
      allResults.push(...this.applyStrategyWeight(keywordResults, keywordStrategy.weight));
    }

    // Merge and deduplicate results
    return this.mergeResults(allResults);
  }

  private async executeSemanticSearch(query: KnowledgeQuery): Promise<SearchResult[]> {
    const embedding = await this.embeddingProvider.generateEmbedding(query.query);
    
    const options: VectorSearchOptions = {
      k: query.limit || this.config.defaultLimit,
      threshold: query.threshold || this.config.defaultThreshold,
      filter: this.convertFiltersToVectorFilter(query.filters)
    };

    return await this.vectorStore.searchByEmbedding(embedding, options);
  }

  private async executeKeywordSearch(query: KnowledgeQuery): Promise<SearchResult[]> {
    if (!this.relationalStore) {
      return [];
    }

    try {
      return await this.relationalStore.searchDocuments(query);
    } catch (error) {
      logger.warn('Keyword search failed, continuing with semantic only', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return [];
    }
  }

  private applyStrategyWeight(results: SearchResult[], weight: number): SearchResult[] {
    return results.map(result => ({
      ...result,
      score: result.score * weight,
      relevanceScore: result.relevanceScore * weight
    }));
  }

  private mergeResults(allResults: SearchResult[]): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();

    for (const result of allResults) {
      const existingResult = resultMap.get(result.document.id);
      
      if (existingResult) {
        // Combine scores from different strategies
        existingResult.score = Math.max(existingResult.score, result.score);
        existingResult.relevanceScore += result.relevanceScore;
      } else {
        resultMap.set(result.document.id, { ...result });
      }
    }

    return Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxResults);
  }

  private async postProcessResults(results: SearchResult[], query: KnowledgeQuery): Promise<SearchResult[]> {
    let processedResults = results;

    // Add context window if requested
    if (query.contextWindow && query.contextWindow > 1) {
      processedResults = await this.addContextWindow(processedResults, query.contextWindow);
    }

    // Apply reranking if enabled
    if (this.config.enableReranking) {
      processedResults = await this.rerankResults(processedResults, query.query);
    }

    // Apply final limit
    const limit = query.limit || this.config.defaultLimit;
    return processedResults.slice(0, limit);
  }

  private async addContextWindow(results: SearchResult[], contextWindow: number): Promise<SearchResult[]> {
    // For each result, try to find surrounding chunks to provide better context
    const enhancedResults: SearchResult[] = [];

    for (const result of results) {
      if (result.chunk) {
        const document = result.document;
        const chunkIndex = result.chunk.metadata.chunkIndex;
        const totalChunks = result.chunk.metadata.totalChunks;

        // Get surrounding chunks
        const startIndex = Math.max(0, chunkIndex - Math.floor(contextWindow / 2));
        const endIndex = Math.min(totalChunks - 1, chunkIndex + Math.floor(contextWindow / 2));

        if (document.chunks) {
          const contextChunks = document.chunks.slice(startIndex, endIndex + 1);
          const contextContent = contextChunks.map(chunk => chunk.content).join('\n\n');

          enhancedResults.push({
            ...result,
            document: {
              ...document,
              content: contextContent
            },
            contextScore: this.calculateContextScore(result.chunk, contextChunks)
          });
        } else {
          enhancedResults.push(result);
        }
      } else {
        enhancedResults.push(result);
      }
    }

    return enhancedResults;
  }

  private calculateContextScore(targetChunk: any, contextChunks: any[]): number {
    // Simple context scoring based on chunk positions
    const targetIndex = contextChunks.findIndex(chunk => chunk.id === targetChunk.id);
    if (targetIndex === -1) return 0;

    // Higher score for chunks in the middle of the context window
    const centerIndex = Math.floor(contextChunks.length / 2);
    const distance = Math.abs(targetIndex - centerIndex);
    return Math.max(0, 1 - (distance / contextChunks.length));
  }

  private async rerankResults(results: SearchResult[], query: string): Promise<SearchResult[]> {
    // Simple reranking based on exact keyword matches
    return results.map(result => {
      const queryTerms = query.toLowerCase().split(/\s+/);
      const content = result.document.content.toLowerCase();
      const title = result.document.title.toLowerCase();

      let rerankScore = result.relevanceScore;

      // Boost for exact query matches
      if (content.includes(query.toLowerCase())) {
        rerankScore *= 1.2;
      }

      // Boost for query terms in title
      const titleMatches = queryTerms.filter(term => title.includes(term)).length;
      rerankScore *= (1 + (titleMatches / queryTerms.length) * 0.3);

      // Boost for multiple query term matches
      const contentMatches = queryTerms.filter(term => content.includes(term)).length;
      rerankScore *= (1 + (contentMatches / queryTerms.length) * 0.2);

      return {
        ...result,
        relevanceScore: rerankScore,
        score: Math.max(result.score, rerankScore)
      };
    }).sort((a, b) => b.score - a.score);
  }

  private convertFiltersToVectorFilter(filters?: QueryFilter[]): Record<string, any> | undefined {
    if (!filters || filters.length === 0) {
      return undefined;
    }

    const vectorFilter: Record<string, any> = {};

    for (const filter of filters) {
      switch (filter.operator) {
        case 'eq':
          vectorFilter[filter.field] = filter.value;
          break;
        case 'in':
          vectorFilter[filter.field] = { $in: filter.value };
          break;
        case 'contains':
          vectorFilter[filter.field] = { $contains: filter.value };
          break;
        // Add more operators as needed
        default:
          logger.warn('Unsupported filter operator for vector search', { 
            operator: filter.operator 
          });
      }
    }

    return Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined;
  }

  public async getSearchStats(): Promise<{
    totalDocuments: number;
    indexHealth: string;
    averageSearchTime: number;
  }> {
    try {
      const stats = await this.vectorStore.getCollectionStats();
      
      return {
        totalDocuments: stats.totalDocuments,
        indexHealth: stats.indexHealth,
        averageSearchTime: 0 // Would need to track this separately
      };
    } catch (error) {
      logger.error('Failed to get search stats', { error: error instanceof Error ? error.message : String(error) });
      return {
        totalDocuments: 0,
        indexHealth: 'unknown',
        averageSearchTime: 0
      };
    }
  }

  public setVectorStore(vectorStore: IVectorStore): void {
    this.vectorStore = vectorStore;
    logger.info('Vector store updated in SemanticSearchEngine');
  }

  public getVectorStore(): IVectorStore {
    return this.vectorStore;
  }

  public setRelationalStore(relationalStore: IRelationalStore): void {
    this.relationalStore = relationalStore;
    logger.info('Relational store updated in SemanticSearchEngine');
  }

  public getRelationalStore(): IRelationalStore | undefined {
    return this.relationalStore;
  }
}

export default SemanticSearchEngine;