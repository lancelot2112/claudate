import { ChromaClient, Collection } from 'chromadb';
import { 
  IVectorStore, 
  Document, 
  SearchResult, 
  VectorStoreConfig, 
  VectorSearchOptions, 
  VectorStoreStats,
  VectorStoreError 
} from '../../types/Knowledge';
import { config } from '../../utils/config';
import logger from '../../utils/logger';

export class VectorStore implements IVectorStore {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private config: VectorStoreConfig;
  private embeddingFunction: any;
  private isInitialized = false;

  constructor(customConfig?: Partial<VectorStoreConfig>) {
    this.config = {
      provider: 'chroma',
      collectionName: 'claudate_documents',
      dimensions: 1536, // OpenAI text-embedding-ada-002 dimensions
      distanceMetric: 'cosine',
      connectionString: config.knowledge?.vectorStore?.url || 'http://localhost:8000',
      ...customConfig
    };

    // Initialize ChromaDB client
    this.client = new ChromaClient({
      path: this.config.connectionString
    });

    // Initialize embedding function - create a simple dummy function for testing
    this.embeddingFunction = {
      generate: async (texts: string[]) => {
        // Return dummy embeddings (1536 dimensions filled with random values)
        return texts.map(() => Array(1536).fill(0).map(() => Math.random()));
      }
    };

    logger.info('VectorStore initialized', { 
      provider: this.config.provider,
      collection: this.config.collectionName 
    });
  }

  public async initialize(): Promise<void> {
    try {
      // Get or create collection
      this.collection = await this.client.getOrCreateCollection({
        name: this.config.collectionName,
        embeddingFunction: this.embeddingFunction,
        metadata: {
          'hnsw:space': this.config.distanceMetric || 'cosine',
          description: 'Claudate knowledge base collection'
        }
      });

      this.isInitialized = true;
      logger.info('VectorStore collection initialized', { 
        collection: this.config.collectionName 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize VectorStore', { error: errorMessage });
      throw new VectorStoreError(`Failed to initialize vector store: ${errorMessage}`);
    }
  }

  public async shutdown(): Promise<void> {
    try {
      this.isInitialized = false;
      this.collection = null;
      logger.info('VectorStore shutdown completed');
    } catch (error) {
      logger.error('Error during VectorStore shutdown', { error: error instanceof Error ? error.message : String(error) });
      throw new VectorStoreError(`Shutdown failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      if (!this.collection) return false;
      
      const count = await this.collection.count();
      logger.debug('VectorStore health check passed', { documentCount: count });
      return true;
    } catch (error) {
      logger.error('VectorStore health check failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async addDocuments(documents: Document[]): Promise<void> {
    if (!this.isInitialized || !this.collection) {
      throw new VectorStoreError('VectorStore not initialized');
    }

    try {
      const startTime = Date.now();
      
      for (const document of documents) {
        await this.addDocument(document);
      }

      const duration = Date.now() - startTime;
      logger.info('Documents added to vector store', { 
        count: documents.length, 
        duration 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add documents to vector store', { 
        error: errorMessage,
        documentCount: documents.length 
      });
      throw new VectorStoreError(`Failed to add documents: ${errorMessage}`);
    }
  }

  public async addDocument(document: Document): Promise<void> {
    if (!this.isInitialized || !this.collection) {
      throw new VectorStoreError('VectorStore not initialized');
    }

    try {
      const chunks = document.chunks || [];
      
      if (chunks.length === 0) {
        // Add document as single chunk
        await this.collection.add({
          ids: [document.id],
          documents: [document.content],
          metadatas: [{
            title: document.title,
            type: document.type,
            source: document.source,
            author: document.metadata.author || '',
            tags: document.metadata.tags.join(','),
            language: document.metadata.language,
            createdAt: document.createdAt.toISOString(),
            updatedAt: document.updatedAt.toISOString(),
            chunkIndex: 0,
            totalChunks: 1,
            isFullDocument: true
          }]
        });
      } else {
        // Add document chunks
        const chunkIds = chunks.map(chunk => chunk.id);
        const chunkTexts = chunks.map(chunk => chunk.content);
        const chunkMetadatas = chunks.map(chunk => ({
          documentId: document.id,
          title: document.title,
          type: document.type,
          source: document.source,
          author: document.metadata.author || '',
          tags: document.metadata.tags.join(','),
          language: document.metadata.language,
          createdAt: document.createdAt.toISOString(),
          updatedAt: document.updatedAt.toISOString(),
          chunkIndex: chunk.metadata.chunkIndex,
          totalChunks: chunk.metadata.totalChunks,
          wordCount: chunk.metadata.wordCount,
          hasCodeBlocks: chunk.metadata.hasCodeBlocks || false,
          hasImages: chunk.metadata.hasImages || false,
          isFullDocument: false
        }));

        await this.collection.add({
          ids: chunkIds,
          documents: chunkTexts,
          metadatas: chunkMetadatas
        });
      }

      logger.debug('Document added to vector store', { 
        documentId: document.id,
        chunks: chunks.length || 1 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add document to vector store', { 
        documentId: document.id,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to add document ${document.id}: ${errorMessage}`);
    }
  }

  public async updateDocument(id: string, document: Partial<Document>): Promise<void> {
    if (!this.isInitialized || !this.collection) {
      throw new VectorStoreError('VectorStore not initialized');
    }

    try {
      // For ChromaDB, we need to delete and re-add
      await this.deleteDocument(id);
      
      if (document.content && document.title && document.type && document.source && document.metadata) {
        const fullDocument: Document = {
          id,
          title: document.title,
          content: document.content,
          type: document.type,
          source: document.source,
          metadata: document.metadata,
          embeddings: document.embeddings,
          chunks: document.chunks,
          createdAt: document.createdAt || new Date(),
          updatedAt: new Date()
        };
        
        await this.addDocument(fullDocument);
      }

      logger.debug('Document updated in vector store', { documentId: id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update document in vector store', { 
        documentId: id,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to update document ${id}: ${errorMessage}`);
    }
  }

  public async deleteDocument(id: string): Promise<void> {
    if (!this.isInitialized || !this.collection) {
      throw new VectorStoreError('VectorStore not initialized');
    }

    try {
      // Delete document by ID (this will delete the main document)
      await this.collection.delete({
        ids: [id]
      });

      // Also delete any chunks that belong to this document
      await this.collection.delete({
        where: { documentId: id }
      });

      logger.debug('Document deleted from vector store', { documentId: id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete document from vector store', { 
        documentId: id,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to delete document ${id}: ${errorMessage}`);
    }
  }

  public async searchSimilar(query: string, options: VectorSearchOptions = {}): Promise<SearchResult[]> {
    if (!this.isInitialized || !this.collection) {
      throw new VectorStoreError('VectorStore not initialized');
    }

    try {
      const startTime = Date.now();
      const {
        k = 10,
        threshold = 0.7,
        filter
        // includeMetadata = true,
        // includeScores = true
      } = options;

      const results = await this.collection.query({
        queryTexts: [query],
        nResults: k,
        where: filter,
        include: ['documents', 'metadatas', 'distances']
      });

      const searchResults: SearchResult[] = [];
      
      if (results.documents && results.documents[0] && results.metadatas && results.metadatas[0]) {
        const documents = results.documents[0];
        const metadatas = results.metadatas[0];
        const distances = results.distances?.[0] || [];

        for (let i = 0; i < documents.length; i++) {
          const distance = distances[i] || 0;
          const similarity = 1 - distance; // Convert distance to similarity score
          
          if (similarity >= threshold) {
            const metadata = metadatas[i] as any;
            
            const document: Document = {
              id: metadata.documentId || results.ids?.[0]?.[i] || '',
              title: metadata.title || 'Untitled',
              content: documents[i] || '',
              type: metadata.type || 'text',
              source: metadata.source || 'unknown',
              metadata: {
                author: metadata.author,
                tags: metadata.tags ? metadata.tags.split(',') : [],
                language: metadata.language || 'en',
                extractedAt: new Date(),
                processingVersion: '1.0'
              },
              createdAt: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
              updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : new Date()
            };

            searchResults.push({
              document,
              score: similarity,
              relevanceScore: similarity
            });
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.debug('Vector search completed', { 
        query: query.substring(0, 100),
        results: searchResults.length,
        duration 
      });

      return searchResults.sort((a, b) => b.score - a.score);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Vector search failed', { 
        query: query.substring(0, 100),
        error: errorMessage 
      });
      throw new VectorStoreError(`Search failed: ${errorMessage}`);
    }
  }

  public async searchByEmbedding(embedding: number[], options: VectorSearchOptions = {}): Promise<SearchResult[]> {
    if (!this.isInitialized || !this.collection) {
      throw new VectorStoreError('VectorStore not initialized');
    }

    try {
      const startTime = Date.now();
      const {
        k = 10,
        threshold = 0.7,
        filter
        // includeMetadata = true,
        // includeScores = true
      } = options;

      const results = await this.collection.query({
        queryEmbeddings: [embedding],
        nResults: k,
        where: filter,
        include: ['documents', 'metadatas', 'distances']
      });

      const searchResults: SearchResult[] = [];
      
      if (results.documents && results.documents[0] && results.metadatas && results.metadatas[0]) {
        const documents = results.documents[0];
        const metadatas = results.metadatas[0];
        const distances = results.distances?.[0] || [];

        for (let i = 0; i < documents.length; i++) {
          const distance = distances[i] || 0;
          const similarity = 1 - distance;
          
          if (similarity >= threshold) {
            const metadata = metadatas[i] as any;
            
            const document: Document = {
              id: metadata.documentId || results.ids?.[0]?.[i] || '',
              title: metadata.title || 'Untitled',
              content: documents[i] || '',
              type: metadata.type || 'text',
              source: metadata.source || 'unknown',
              metadata: {
                author: metadata.author,
                tags: metadata.tags ? metadata.tags.split(',') : [],
                language: metadata.language || 'en',
                extractedAt: new Date(),
                processingVersion: '1.0'
              },
              createdAt: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
              updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : new Date()
            };

            searchResults.push({
              document,
              score: similarity,
              relevanceScore: similarity
            });
          }
        }
      }

      const duration = Date.now() - startTime;
      logger.debug('Embedding search completed', { 
        embeddingDimensions: embedding.length,
        results: searchResults.length,
        duration 
      });

      return searchResults.sort((a, b) => b.score - a.score);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Embedding search failed', { error: errorMessage });
      throw new VectorStoreError(`Embedding search failed: ${errorMessage}`);
    }
  }

  public async getDocument(id: string): Promise<Document | null> {
    if (!this.isInitialized || !this.collection) {
      throw new VectorStoreError('VectorStore not initialized');
    }

    try {
      const results = await this.collection.get({
        ids: [id],
        include: ['documents', 'metadatas']
      });

      if (!results.documents || !results.documents[0] || !results.metadatas || !results.metadatas[0]) {
        return null;
      }

      const document = results.documents[0];
      const metadata = results.metadatas[0] as any;

      return {
        id,
        title: metadata.title || 'Untitled',
        content: document,
        type: metadata.type || 'text',
        source: metadata.source || 'unknown',
        metadata: {
          author: metadata.author,
          tags: metadata.tags ? metadata.tags.split(',') : [],
          language: metadata.language || 'en',
          extractedAt: new Date(),
          processingVersion: '1.0'
        },
        createdAt: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
        updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get document from vector store', { 
        documentId: id,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to get document ${id}: ${errorMessage}`);
    }
  }

  public async listDocuments(limit = 100, offset = 0): Promise<Document[]> {
    if (!this.isInitialized || !this.collection) {
      throw new VectorStoreError('VectorStore not initialized');
    }

    try {
      // ChromaDB doesn't have built-in pagination, so we'll get all and slice
      const results = await this.collection.get({
        include: ['documents', 'metadatas'],
        limit: limit + offset
      });

      const documents: Document[] = [];
      
      if (results.documents && results.metadatas && results.ids) {
        for (let i = offset; i < Math.min(results.documents.length, offset + limit); i++) {
          const document = results.documents[i];
          const metadata = results.metadatas[i] as any;
          const id = results.ids[i];

          if (!id || !document) {
            continue; // Skip invalid entries
          }

          documents.push({
            id,
            title: metadata.title || 'Untitled',
            content: document,
            type: metadata.type || 'text',
            source: metadata.source || 'unknown',
            metadata: {
              author: metadata.author,
              tags: metadata.tags ? metadata.tags.split(',') : [],
              language: metadata.language || 'en',
              extractedAt: new Date(),
              processingVersion: '1.0'
            },
            createdAt: metadata.createdAt ? new Date(metadata.createdAt) : new Date(),
            updatedAt: metadata.updatedAt ? new Date(metadata.updatedAt) : new Date()
          });
        }
      }

      logger.debug('Documents listed from vector store', { 
        count: documents.length,
        limit,
        offset 
      });

      return documents;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to list documents from vector store', { error: errorMessage });
      throw new VectorStoreError(`Failed to list documents: ${errorMessage}`);
    }
  }

  public async getCollectionStats(): Promise<VectorStoreStats> {
    if (!this.isInitialized || !this.collection) {
      throw new VectorStoreError('VectorStore not initialized');
    }

    try {
      const count = await this.collection.count();
      
      return {
        totalDocuments: count,
        totalChunks: count, // In ChromaDB, each entry can be a document or chunk
        averageEmbeddingTime: 0, // Would need to track this separately
        storageSize: 0, // Would need to query ChromaDB for this
        lastUpdated: new Date(),
        indexHealth: 'healthy'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get collection stats', { error: errorMessage });
      throw new VectorStoreError(`Failed to get stats: ${errorMessage}`);
    }
  }
}

export default VectorStore;