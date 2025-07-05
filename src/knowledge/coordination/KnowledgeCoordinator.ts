import {
  IVectorStore,
  IRelationalStore,
  IGraphStore,
  KnowledgeQuery,
  SearchResult,
  SearchResponse,
  Document,
  DocumentType,
  GraphNode,
  GraphResult
} from '../../types/Knowledge.js';
import { SemanticSearchEngine } from '../search/SemanticSearch.js';
import { RAGSystem } from '../rag/RAGSystem.js';
import { ContextManager } from '../context/ContextManager.js';
import logger from '../../utils/logger.js';

export interface CrossStoreQuery {
  query: string;
  targetStores: ('vector' | 'relational' | 'graph')[];
  mergeStrategy: 'union' | 'intersection' | 'weighted' | 'ranked';
  filters?: any[];
  limit?: number;
  includeRelatedNodes?: boolean;
  contextSessionId?: string;
}

export interface CrossStoreResult {
  results: SearchResult[];
  graphResults?: GraphResult[];
  relatedNodes?: GraphNode[];
  metadata: {
    storesQueried: string[];
    totalResultsFound: number;
    mergeStrategy: string;
    processingTime: number;
    confidence: number;
  };
}

export interface StoreWeights {
  vector: number;
  relational: number;
  graph: number;
}

export interface KnowledgeCoordinatorConfig {
  defaultStoreWeights: StoreWeights;
  enableCaching: boolean;
  cacheTimeout: number; // seconds
  maxConcurrentQueries: number;
  enableQueryOptimization: boolean;
  graphTraversalDepth: number;
}

export class KnowledgeCoordinator {
  private vectorStore?: IVectorStore;
  private relationalStore?: IRelationalStore;
  private graphStore?: IGraphStore;
  private semanticSearch?: SemanticSearchEngine;
  private ragSystem?: RAGSystem;
  private contextManager?: ContextManager;
  private config: KnowledgeCoordinatorConfig;
  private queryCache: Map<string, { result: CrossStoreResult; timestamp: number }> = new Map();

  constructor(
    config: Partial<KnowledgeCoordinatorConfig> = {},
    stores: {
      vectorStore?: IVectorStore;
      relationalStore?: IRelationalStore;
      graphStore?: IGraphStore;
      semanticSearch?: SemanticSearchEngine;
      ragSystem?: RAGSystem;
      contextManager?: ContextManager;
    } = {}
  ) {
    this.config = {
      defaultStoreWeights: {
        vector: 0.5,
        relational: 0.3,
        graph: 0.2
      },
      enableCaching: true,
      cacheTimeout: 300, // 5 minutes
      maxConcurrentQueries: 5,
      enableQueryOptimization: true,
      graphTraversalDepth: 3,
      ...config
    };

    this.vectorStore = stores.vectorStore;
    this.relationalStore = stores.relationalStore;
    this.graphStore = stores.graphStore;
    this.semanticSearch = stores.semanticSearch;
    this.ragSystem = stores.ragSystem;
    this.contextManager = stores.contextManager;

    logger.info('KnowledgeCoordinator initialized', { 
      availableStores: this.getAvailableStores(),
      config: this.config 
    });
  }

  public setStores(stores: {
    vectorStore?: IVectorStore;
    relationalStore?: IRelationalStore;
    graphStore?: IGraphStore;
    semanticSearch?: SemanticSearchEngine;
    ragSystem?: RAGSystem;
    contextManager?: ContextManager;
  }): void {
    this.vectorStore = stores.vectorStore || this.vectorStore;
    this.relationalStore = stores.relationalStore || this.relationalStore;
    this.graphStore = stores.graphStore || this.graphStore;
    this.semanticSearch = stores.semanticSearch || this.semanticSearch;
    this.ragSystem = stores.ragSystem || this.ragSystem;
    this.contextManager = stores.contextManager || this.contextManager;

    logger.info('Knowledge stores updated', { 
      availableStores: this.getAvailableStores() 
    });
  }

  public async crossStoreQuery(query: CrossStoreQuery): Promise<CrossStoreResult> {
    const startTime = Date.now();
    
    try {
      logger.debug('Starting cross-store query', {
        query: query.query.substring(0, 100),
        targetStores: query.targetStores,
        mergeStrategy: query.mergeStrategy
      });

      // Check cache first
      if (this.config.enableCaching) {
        const cached = this.getCachedResult(query);
        if (cached) {
          logger.debug('Returning cached result');
          return cached;
        }
      }

      // Optimize query if enabled
      const optimizedQuery = this.config.enableQueryOptimization 
        ? await this.optimizeQuery(query)
        : query;

      // Execute queries in parallel across stores
      const storeResults = await this.executeParallelQueries(optimizedQuery);

      // Merge results based on strategy
      const mergedResults = await this.mergeResults(
        storeResults, 
        optimizedQuery.mergeStrategy
      );

      // Get related graph nodes if requested
      let relatedNodes: GraphNode[] = [];
      if (optimizedQuery.includeRelatedNodes && this.graphStore) {
        relatedNodes = await this.getRelatedGraphNodes(mergedResults.results);
      }

      const processingTime = Date.now() - startTime;
      const result: CrossStoreResult = {
        results: mergedResults.results,
        graphResults: storeResults.graph,
        relatedNodes,
        metadata: {
          storesQueried: optimizedQuery.targetStores,
          totalResultsFound: mergedResults.totalResults,
          mergeStrategy: optimizedQuery.mergeStrategy,
          processingTime,
          confidence: this.calculateOverallConfidence(mergedResults.results)
        }
      };

      // Cache the result
      if (this.config.enableCaching) {
        this.cacheResult(query, result);
      }

      logger.info('Cross-store query completed', {
        query: query.query.substring(0, 100),
        totalResults: result.results.length,
        storesQueried: result.metadata.storesQueried.length,
        processingTime
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Cross-store query failed', {
        query: query.query.substring(0, 100),
        error: errorMessage
      });
      throw new Error(`Cross-store query failed: ${errorMessage}`);
    }
  }

  public async intelligentSearch(
    query: string,
    options: {
      useRAG?: boolean;
      includeContext?: boolean;
      sessionId?: string;
      maxResults?: number;
    } = {}
  ): Promise<CrossStoreResult> {
    try {
      // Analyze query to determine best store combination
      const storeSelection = await this.analyzeQueryForStores(query);
      
      const crossQuery: CrossStoreQuery = {
        query,
        targetStores: storeSelection.stores,
        mergeStrategy: storeSelection.strategy,
        limit: options.maxResults || 10,
        includeRelatedNodes: true,
        contextSessionId: options.sessionId
      };

      let result = await this.crossStoreQuery(crossQuery);

      // Enhance with RAG if requested
      if (options.useRAG && this.ragSystem) {
        const ragResponse = await this.ragSystem.askQuestion(query, [], options.maxResults || 5);
        result = await this.enhanceWithRAG(result, ragResponse);
      }

      // Include context if requested
      if (options.includeContext && options.sessionId && this.contextManager) {
        const contextEntries = await this.contextManager.getSessionContext(options.sessionId, 5);
        result = await this.enhanceWithContext(result, contextEntries);
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Intelligent search failed', { query, error: errorMessage });
      throw new Error(`Intelligent search failed: ${errorMessage}`);
    }
  }

  public async findRelatedDocuments(
    documentId: string,
    relationshipTypes: string[] = [],
    maxResults = 10
  ): Promise<CrossStoreResult> {
    try {
      const results: SearchResult[] = [];
      let graphResults: GraphResult[] = [];
      let relatedNodes: GraphNode[] = [];

      // Get the source document
      const sourceDoc = this.vectorStore 
        ? await this.vectorStore.getDocument(documentId)
        : await this.relationalStore?.getDocument(documentId);

      if (!sourceDoc) {
        throw new Error(`Document not found: ${documentId}`);
      }

      // Find similar documents using vector search
      if (this.semanticSearch) {
        const similar = await this.semanticSearch.searchSimilarDocuments(documentId, maxResults);
        results.push(...similar);
      }

      // Find related nodes in graph
      if (this.graphStore) {
        for (const relType of relationshipTypes.length > 0 ? relationshipTypes : ['related']) {
          const related = await this.graphStore.getRelated(
            documentId, 
            relType, 
            this.config.graphTraversalDepth
          );
          relatedNodes.push(...related);
        }

        // Convert related nodes to search results
        for (const node of relatedNodes) {
          if (node.properties.documentId && node.properties.documentId !== documentId) {
            const doc = await this.getDocumentFromAnyStore(node.properties.documentId);
            if (doc) {
              results.push({
                document: doc,
                score: 0.8,
                relevanceScore: 0.8
              });
            }
          }
        }
      }

      // Deduplicate and sort
      const uniqueResults = this.deduplicateResults(results);
      const sortedResults = uniqueResults
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);

      return {
        results: sortedResults,
        graphResults,
        relatedNodes,
        metadata: {
          storesQueried: this.getAvailableStores(),
          totalResultsFound: sortedResults.length,
          mergeStrategy: 'ranked',
          processingTime: 0,
          confidence: 0.8
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Find related documents failed', { documentId, error: errorMessage });
      throw new Error(`Find related documents failed: ${errorMessage}`);
    }
  }

  public async getKnowledgeOverview(): Promise<{
    totalDocuments: number;
    documentsByType: Record<DocumentType, number>;
    graphNodes: number;
    relationships: number;
    recentActivity: any[];
  }> {
    try {
      const overview = {
        totalDocuments: 0,
        documentsByType: {} as Record<DocumentType, number>,
        graphNodes: 0,
        relationships: 0,
        recentActivity: []
      };

      // Get relational store stats
      if (this.relationalStore) {
        const stats = await this.relationalStore.getDocumentStats();
        overview.totalDocuments += stats.totalDocuments;
        overview.documentsByType = { ...overview.documentsByType, ...stats.documentsByType };
      }

      // Get vector store stats
      if (this.vectorStore) {
        const stats = await this.vectorStore.getCollectionStats();
        overview.totalDocuments += stats.totalDocuments;
      }

      // Get graph store stats
      if (this.graphStore) {
        const stats = this.graphStore.getStats();
        overview.graphNodes = stats.nodeCount;
        overview.relationships = stats.relationshipCount;
      }

      return overview;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get knowledge overview', { error: errorMessage });
      throw new Error(`Failed to get knowledge overview: ${errorMessage}`);
    }
  }

  private async executeParallelQueries(query: CrossStoreQuery): Promise<{
    vector?: SearchResult[];
    relational?: SearchResult[];
    graph?: GraphResult[];
  }> {
    const queries: Promise<any>[] = [];
    const storeResults: any = {};

    // Vector store query
    if (query.targetStores.includes('vector') && this.semanticSearch) {
      queries.push(
        this.semanticSearch.search({
          query: query.query,
          limit: query.limit,
          filters: query.filters
        }).then(response => {
          storeResults.vector = response.results;
        }).catch(error => {
          logger.warn('Vector store query failed', { error: error.message });
          storeResults.vector = [];
        })
      );
    }

    // Relational store query
    if (query.targetStores.includes('relational') && this.relationalStore) {
      queries.push(
        this.relationalStore.searchDocuments({
          query: query.query,
          limit: query.limit,
          filters: query.filters
        }).then(results => {
          storeResults.relational = results;
        }).catch(error => {
          logger.warn('Relational store query failed', { error: error.message });
          storeResults.relational = [];
        })
      );
    }

    // Graph store query
    if (query.targetStores.includes('graph') && this.graphStore) {
      queries.push(
        this.graphStore.queryGraph(query.query).then(results => {
          storeResults.graph = results;
        }).catch(error => {
          logger.warn('Graph store query failed', { error: error.message });
          storeResults.graph = [];
        })
      );
    }

    await Promise.all(queries);
    return storeResults;
  }

  private async mergeResults(
    storeResults: any,
    strategy: CrossStoreQuery['mergeStrategy']
  ): Promise<{ results: SearchResult[]; totalResults: number }> {
    const allResults: SearchResult[] = [];
    let totalResults = 0;

    // Collect all results
    if (storeResults.vector) {
      allResults.push(...storeResults.vector);
      totalResults += storeResults.vector.length;
    }
    if (storeResults.relational) {
      allResults.push(...storeResults.relational);
      totalResults += storeResults.relational.length;
    }

    // Convert graph results to search results
    if (storeResults.graph) {
      for (const graphResult of storeResults.graph) {
        for (const node of graphResult.nodes) {
          if (node.properties.documentId) {
            const doc = await this.getDocumentFromAnyStore(node.properties.documentId);
            if (doc) {
              allResults.push({
                document: doc,
                score: graphResult.metadata?.score || 0.5,
                relevanceScore: graphResult.metadata?.score || 0.5
              });
            }
          }
        }
      }
      totalResults += storeResults.graph.length;
    }

    // Apply merge strategy
    let mergedResults: SearchResult[];

    switch (strategy) {
      case 'union':
        mergedResults = this.deduplicateResults(allResults);
        break;
      case 'intersection':
        mergedResults = this.intersectionMerge(storeResults);
        break;
      case 'weighted':
        mergedResults = this.weightedMerge(storeResults);
        break;
      case 'ranked':
      default:
        mergedResults = this.rankedMerge(allResults);
        break;
    }

    return { results: mergedResults, totalResults };
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const unique: SearchResult[] = [];

    for (const result of results) {
      if (!seen.has(result.document.id)) {
        seen.add(result.document.id);
        unique.push(result);
      }
    }

    return unique;
  }

  private intersectionMerge(storeResults: any): SearchResult[] {
    // Find documents that appear in multiple stores
    const documentIds = new Map<string, SearchResult[]>();

    // Collect all results by document ID
    for (const storeKey of Object.keys(storeResults)) {
      const results = storeResults[storeKey];
      if (Array.isArray(results)) {
        for (const result of results) {
          if (result.document) {
            const id = result.document.id;
            if (!documentIds.has(id)) {
              documentIds.set(id, []);
            }
            documentIds.get(id)!.push(result);
          }
        }
      }
    }

    // Keep only documents that appear in multiple stores
    const intersectionResults: SearchResult[] = [];
    for (const [docId, results] of documentIds) {
      if (results.length > 1) {
        // Use the result with the highest score
        const bestResult = results.reduce((best, current) => 
          current.score > best.score ? current : best
        );
        intersectionResults.push(bestResult);
      }
    }

    return intersectionResults.sort((a, b) => b.score - a.score);
  }

  private weightedMerge(storeResults: any): SearchResult[] {
    const weightedResults: SearchResult[] = [];

    // Apply weights to results from each store
    if (storeResults.vector) {
      for (const result of storeResults.vector) {
        weightedResults.push({
          ...result,
          score: result.score * this.config.defaultStoreWeights.vector,
          relevanceScore: result.relevanceScore * this.config.defaultStoreWeights.vector
        });
      }
    }

    if (storeResults.relational) {
      for (const result of storeResults.relational) {
        weightedResults.push({
          ...result,
          score: result.score * this.config.defaultStoreWeights.relational,
          relevanceScore: result.relevanceScore * this.config.defaultStoreWeights.relational
        });
      }
    }

    // Note: Graph results are handled in the main merge function

    return this.deduplicateResults(weightedResults)
      .sort((a, b) => b.score - a.score);
  }

  private rankedMerge(allResults: SearchResult[]): SearchResult[] {
    return this.deduplicateResults(allResults)
      .sort((a, b) => b.score - a.score);
  }

  private async getRelatedGraphNodes(results: SearchResult[]): Promise<GraphNode[]> {
    if (!this.graphStore) return [];

    const relatedNodes: GraphNode[] = [];
    const seenNodes = new Set<string>();

    for (const result of results) {
      try {
        const related = await this.graphStore.getRelated(
          result.document.id, 
          undefined, 
          2
        );
        
        for (const node of related) {
          if (!seenNodes.has(node.id)) {
            seenNodes.add(node.id);
            relatedNodes.push(node);
          }
        }
      } catch (error) {
        logger.warn('Failed to get related nodes', { 
          documentId: result.document.id,
          error: error.message 
        });
      }
    }

    return relatedNodes;
  }

  private async getDocumentFromAnyStore(documentId: string): Promise<Document | null> {
    // Try vector store first
    if (this.vectorStore) {
      try {
        const doc = await this.vectorStore.getDocument(documentId);
        if (doc) return doc;
      } catch (error) {
        // Continue to next store
      }
    }

    // Try relational store
    if (this.relationalStore) {
      try {
        const doc = await this.relationalStore.getDocument(documentId);
        if (doc) return doc;
      } catch (error) {
        // Document not found
      }
    }

    return null;
  }

  private async analyzeQueryForStores(query: string): Promise<{
    stores: ('vector' | 'relational' | 'graph')[];
    strategy: CrossStoreQuery['mergeStrategy'];
  }> {
    // Simple heuristics for store selection
    const queryLower = query.toLowerCase();
    const stores: ('vector' | 'relational' | 'graph')[] = [];

    // Always include vector store for semantic search
    if (this.vectorStore) {
      stores.push('vector');
    }

    // Include relational for structured queries
    if (this.relationalStore && (
      queryLower.includes('type:') ||
      queryLower.includes('author:') ||
      queryLower.includes('tag:') ||
      queryLower.includes('filter')
    )) {
      stores.push('relational');
    }

    // Include graph for relationship queries
    if (this.graphStore && (
      queryLower.includes('related') ||
      queryLower.includes('connected') ||
      queryLower.includes('similar') ||
      queryLower.includes('link')
    )) {
      stores.push('graph');
    }

    // Default to all available stores if none specifically indicated
    if (stores.length === 0) {
      stores.push(...this.getAvailableStores() as any);
    }

    const strategy: CrossStoreQuery['mergeStrategy'] = 
      stores.length > 1 ? 'weighted' : 'ranked';

    return { stores, strategy };
  }

  private async optimizeQuery(query: CrossStoreQuery): Promise<CrossStoreQuery> {
    // For now, just return the original query
    // In the future, this could include query expansion, term extraction, etc.
    return query;
  }

  private getCachedResult(query: CrossStoreQuery): CrossStoreResult | null {
    const cacheKey = this.generateCacheKey(query);
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < (this.config.cacheTimeout * 1000)) {
      return cached.result;
    }

    return null;
  }

  private cacheResult(query: CrossStoreQuery, result: CrossStoreResult): void {
    const cacheKey = this.generateCacheKey(query);
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    if (this.queryCache.size > 100) {
      const oldestKey = Array.from(this.queryCache.keys())[0];
      this.queryCache.delete(oldestKey);
    }
  }

  private generateCacheKey(query: CrossStoreQuery): string {
    return `${query.query}-${query.targetStores.join(',')}-${query.mergeStrategy}-${query.limit || 10}`;
  }

  private calculateOverallConfidence(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    
    const avgScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
    return Math.min(1.0, avgScore);
  }

  private async enhanceWithRAG(result: CrossStoreResult, ragResponse: any): Promise<CrossStoreResult> {
    // Add RAG-specific metadata
    result.metadata = {
      ...result.metadata,
      ragEnhanced: true,
      ragConfidence: ragResponse.confidence
    };

    return result;
  }

  private async enhanceWithContext(result: CrossStoreResult, contextEntries: any[]): Promise<CrossStoreResult> {
    // Add context-specific metadata
    result.metadata = {
      ...result.metadata,
      contextEnhanced: true,
      contextEntries: contextEntries.length
    };

    return result;
  }

  private getAvailableStores(): string[] {
    const stores: string[] = [];
    if (this.vectorStore) stores.push('vector');
    if (this.relationalStore) stores.push('relational');
    if (this.graphStore) stores.push('graph');
    return stores;
  }

  public getConfig(): KnowledgeCoordinatorConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<KnowledgeCoordinatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('KnowledgeCoordinator configuration updated', { newConfig });
  }
}

export default KnowledgeCoordinator;