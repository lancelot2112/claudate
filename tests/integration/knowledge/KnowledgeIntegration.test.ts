import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { VectorStore } from '../../../src/knowledge/stores/VectorStore';
import { RelationalStore } from '../../../src/knowledge/stores/RelationalStore';
import { GraphStore } from '../../../src/knowledge/stores/GraphStore';
import { IngestionPipeline } from '../../../src/knowledge/ingestion/IngestionPipeline';
import { SemanticSearchEngine } from '../../../src/knowledge/search/SemanticSearch';
import { RAGSystem } from '../../../src/knowledge/rag/RAGSystem';
import { ContextManager } from '../../../src/knowledge/context/ContextManager';
import { ContextCompressor } from '../../../src/knowledge/context/ContextCompressor';
import { KnowledgeCoordinator, CrossStoreQuery } from '../../../src/knowledge/coordination/KnowledgeCoordinator';
import { 
  Document, 
  DocumentType,
  KnowledgeQuery
} from '../../../src/types/Knowledge';
import { AnthropicClient } from '../../../src/integrations/ai/AnthropicClient';

describe('Knowledge Management Integration', () => {
  let vectorStore: VectorStore;
  let relationalStore: RelationalStore;
  let graphStore: GraphStore;
  let ingestionPipeline: IngestionPipeline;
  let semanticSearch: SemanticSearchEngine;
  let ragSystem: RAGSystem;
  let contextManager: ContextManager;
  let contextCompressor: ContextCompressor;
  let knowledgeCoordinator: KnowledgeCoordinator;
  let anthropicClient: AnthropicClient;

  const testDocuments: Document[] = [
    {
      id: 'doc-1',
      title: 'AI and Machine Learning Overview',
      content: 'Artificial Intelligence and Machine Learning are transforming how we process information. Neural networks enable pattern recognition, while deep learning architectures like transformers have revolutionized natural language processing.',
      type: 'text' as DocumentType,
      source: 'test-source-1',
      metadata: {
        author: 'AI Researcher',
        tags: ['ai', 'ml', 'neural-networks'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'doc-2',
      title: 'Database Design Principles',
      content: 'Good database design follows normalization principles to reduce redundancy. ACID properties ensure data consistency, while indexes improve query performance. Vector databases are emerging for semantic search.',
      type: 'text' as DocumentType,
      source: 'test-source-2',
      metadata: {
        author: 'Database Expert',
        tags: ['database', 'design', 'sql', 'vectors'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'doc-3',
      title: 'Software Architecture Patterns',
      content: 'Microservices architecture promotes modularity and scalability. Event-driven systems enable loose coupling. The Model-View-Controller pattern separates concerns in application design.',
      type: 'text' as DocumentType,
      source: 'test-source-3',
      metadata: {
        author: 'Software Architect',
        tags: ['architecture', 'microservices', 'patterns'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeAll(async () => {
    // Initialize AI client (mock for tests)
    anthropicClient = new AnthropicClient({
      apiKey: 'test-key',
      model: 'claude-3-haiku-20240307'
    });

    // Initialize stores
    vectorStore = new VectorStore({
      collectionName: 'test-collection',
      embeddingProvider: 'openai',
      openaiApiKey: process.env.OPENAI_API_KEY || 'test-key'
    });

    relationalStore = new RelationalStore({
      host: 'localhost',
      port: 5432,
      database: 'claudate_test',
      username: 'test',
      password: 'test'
    });

    graphStore = new GraphStore({
      persistToDisk: false,
      maxNodes: 1000,
      maxRelationships: 5000
    });

    // Initialize knowledge components
    ingestionPipeline = new IngestionPipeline();
    
    semanticSearch = new SemanticSearchEngine({
      embeddingProvider: 'openai',
      openaiApiKey: process.env.OPENAI_API_KEY || 'test-key'
    });

    ragSystem = new RAGSystem({
      maxContextLength: 4000,
      maxDocuments: 5,
      temperature: 0.7
    }, anthropicClient);

    contextManager = new ContextManager({
      hot: { storage: 'redis', ttl: 3600, maxSize: 1024000, compressionThreshold: 10240 },
      warm: { storage: 'postgresql', ttl: 604800, maxSize: 10485760, compressionEnabled: true },
      cold: { storage: 'postgresql', compressionEnabled: true }
    });

    contextCompressor = new ContextCompressor({
      maxInputLength: 10000,
      targetCompressionRatio: 0.4,
      useSemanticCompression: false, // Use statistical for tests
      enableSummarization: true
    }, anthropicClient);

    knowledgeCoordinator = new KnowledgeCoordinator({
      defaultStoreWeights: { vector: 0.5, relational: 0.3, graph: 0.2 },
      enableCaching: true,
      maxConcurrentQueries: 3
    });

    // Initialize all components
    await Promise.all([
      vectorStore.initialize(),
      relationalStore.initialize(),
      graphStore.initialize(),
      contextManager.initialize()
    ]);

    // Set stores in coordinator
    knowledgeCoordinator.setStores({
      vectorStore,
      relationalStore,
      graphStore,
      semanticSearch,
      ragSystem,
      contextManager
    });

    // Set stores in other components
    ingestionPipeline.setStores(vectorStore, relationalStore, graphStore);
    semanticSearch.setVectorStore(vectorStore);
  }, 30000);

  afterAll(async () => {
    await Promise.all([
      vectorStore.shutdown(),
      relationalStore.shutdown(),
      graphStore.shutdown(),
      contextManager.shutdown()
    ]);
  }, 15000);

  beforeEach(async () => {
    // Clean up test data
    try {
      for (const doc of testDocuments) {
        await vectorStore.deleteDocument(doc.id);
        await relationalStore.deleteDocument(doc.id);
        await graphStore.deleteNode(doc.id);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Document Ingestion Pipeline', () => {
    it('should ingest documents into all stores', async () => {
      const doc = testDocuments[0];
      const docBuffer = Buffer.from(doc.content, 'utf-8');
      
      const jobId = await ingestionPipeline.ingestDocument(
        doc.source,
        docBuffer,
        'text/plain',
        {
          title: doc.title,
          author: doc.metadata.author,
          tags: doc.metadata.tags
        }
      );

      expect(jobId).toBeDefined();
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const job = ingestionPipeline.getJob(jobId);
      expect(['processing', 'completed']).toContain(job?.status);
    });

    it('should handle batch ingestion', async () => {
      const jobs: Promise<string>[] = [];
      
      for (const doc of testDocuments) {
        const docBuffer = Buffer.from(doc.content, 'utf-8');
        const jobPromise = ingestionPipeline.ingestDocument(
          doc.source,
          docBuffer,
          'text/plain',
          {
            title: doc.title,
            author: doc.metadata.author,
            tags: doc.metadata.tags
          }
        );
        jobs.push(jobPromise);
      }

      const jobIds = await Promise.all(jobs);
      expect(jobIds).toHaveLength(testDocuments.length);
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      for (const jobId of jobIds) {
        const job = ingestionPipeline.getJob(jobId);
        expect(['processing', 'completed']).toContain(job?.status);
      }
    });
  });

  describe('Vector Store Operations', () => {
    beforeEach(async () => {
      // Store test documents
      for (const doc of testDocuments) {
        await vectorStore.addDocument(doc);
      }
    });

    it('should perform semantic search', async () => {
      const query: KnowledgeQuery = {
        query: 'machine learning and AI',
        limit: 5
      };

      const response = await semanticSearch.search(query);
      
      expect(response.results).toBeDefined();
      expect(response.results.length).toBeGreaterThan(0);
      expect(response.results[0]?.score).toBeGreaterThan(0);
    });

    it('should find similar documents', async () => {
      const similarDocs = await semanticSearch.searchSimilarDocuments('doc-1', 3);
      
      expect(similarDocs).toBeDefined();
      expect(similarDocs.length).toBeLessThanOrEqual(3);
      
      if (similarDocs.length > 0) {
        expect(similarDocs[0]?.document.id).not.toBe('doc-1');
      }
    });
  });

  describe('Relational Store Operations', () => {
    beforeEach(async () => {
      for (const doc of testDocuments) {
        await relationalStore.storeDocument(doc);
      }
    });

    it('should perform full-text search', async () => {
      const query: KnowledgeQuery = {
        query: 'database design',
        limit: 5
      };

      const results = await relationalStore.searchDocuments(query);
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.document.content).toContain('database');
    });

    it('should filter by document type', async () => {
      const textDocs = await relationalStore.getDocumentsByType('text');
      expect(textDocs.length).toBeGreaterThan(0);
      expect(textDocs.every(doc => doc.type === 'text')).toBe(true);
    });

    it('should filter by tags', async () => {
      const aiDocs = await relationalStore.getDocumentsByTags(['ai']);
      expect(aiDocs.length).toBeGreaterThan(0);
      expect(aiDocs.some(doc => doc.metadata.tags?.includes('ai'))).toBe(true);
    });
  });

  describe('Graph Store Operations', () => {
    beforeEach(async () => {
      // Add nodes for documents
      for (const doc of testDocuments) {
        await graphStore.addNode(doc.id, 'document', {
          title: doc.title,
          type: doc.type,
          documentId: doc.id
        });
      }

      // Add relationships
      await graphStore.addEdge('doc-1', 'doc-2', 'related', { strength: 0.7 });
      await graphStore.addEdge('doc-2', 'doc-3', 'references', { strength: 0.8 });
    });

    it('should find related nodes', async () => {
      const related = await graphStore.getRelated('doc-1', 'related', 2);
      
      expect(related).toBeDefined();
      expect(related.length).toBeGreaterThan(0);
    });

    it('should find paths between nodes', async () => {
      const path = await graphStore.findPath('doc-1', 'doc-3', 3);
      
      expect(path).toBeDefined();
      if (path) {
        expect(path.nodes.length).toBeGreaterThanOrEqual(2);
        expect(path.nodes[0]?.id).toBe('doc-1');
        expect(path.nodes[path.nodes.length - 1]?.id).toBe('doc-3');
      }
    });

    it('should query graph by content', async () => {
      const results = await graphStore.queryGraph('document');
      
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('RAG System', () => {
    beforeEach(async () => {
      for (const doc of testDocuments) {
        await vectorStore.addDocument(doc);
      }
    });

    it('should generate context-aware responses', async () => {
      const response = await ragSystem.askQuestion(
        'What are the key principles of database design?',
        [],
        3
      );

      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.confidence).toBeGreaterThan(0);
    });

    it('should handle follow-up questions', async () => {
      const firstResponse = await ragSystem.askQuestion(
        'What is machine learning?',
        [],
        3
      );

      const followUpResponse = await ragSystem.askQuestion(
        'How does it relate to neural networks?',
        [{ role: 'assistant', content: firstResponse.answer }],
        3
      );

      expect(followUpResponse.answer).toBeDefined();
      expect(followUpResponse.confidence).toBeGreaterThan(0);
    });
  });

  describe('Context Management', () => {
    const sessionId = 'test-session-1';
    const userId = 'test-user-1';

    it('should store and retrieve context', async () => {
      const testContent = {
        query: 'What is AI?',
        response: 'AI is artificial intelligence...',
        timestamp: new Date()
      };

      const contextId = await contextManager.storeContext(
        sessionId,
        userId,
        testContent,
        'hot'
      );

      expect(contextId).toBeDefined();

      const retrieved = await contextManager.getContext(contextId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.content.query).toBe(testContent.query);
    });

    it('should get session context', async () => {
      const contextIds: string[] = [];
      
      for (let i = 0; i < 3; i++) {
        const id = await contextManager.storeContext(
          sessionId,
          userId,
          { message: `Test message ${i}`, timestamp: new Date() },
          'hot'
        );
        contextIds.push(id);
      }

      const sessionContext = await contextManager.getSessionContext(sessionId, 5);
      expect(sessionContext.length).toBeGreaterThan(0);
      expect(sessionContext.length).toBeLessThanOrEqual(3);
    });

    it('should compress context', async () => {
      const longContent = 'This is a very long piece of content that should be compressed. '.repeat(100);
      
      const result = await contextCompressor.compressContext(longContent);
      
      expect(result.compressedContent).toBeDefined();
      expect(result.compressedLength).toBeLessThan(result.originalLength);
      expect(result.compressionRatio).toBeLessThan(1);
      expect(result.metadata.method).toBeDefined();
    });
  });

  describe('Cross-Store Query Coordination', () => {
    beforeEach(async () => {
      // Store documents in all stores
      for (const doc of testDocuments) {
        await vectorStore.addDocument(doc);
        await relationalStore.storeDocument(doc);
        await graphStore.addNode(doc.id, 'document', {
          title: doc.title,
          documentId: doc.id
        });
      }
      
      // Add some relationships
      await graphStore.addEdge('doc-1', 'doc-2', 'related');
    });

    it('should perform cross-store queries', async () => {
      const crossQuery: CrossStoreQuery = {
        query: 'machine learning',
        targetStores: ['vector', 'relational', 'graph'],
        mergeStrategy: 'weighted',
        limit: 5
      };

      const result = await knowledgeCoordinator.crossStoreQuery(crossQuery);
      
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metadata.storesQueried.length).toBeGreaterThan(0);
      expect(result.metadata.confidence).toBeGreaterThan(0);
    });

    it('should perform intelligent search', async () => {
      const result = await knowledgeCoordinator.intelligentSearch(
        'database design principles',
        {
          useRAG: false, // Skip RAG for faster tests
          maxResults: 3
        }
      );

      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metadata.storesQueried.length).toBeGreaterThan(0);
    });

    it('should find related documents', async () => {
      const result = await knowledgeCoordinator.findRelatedDocuments(
        'doc-1',
        ['related'],
        3
      );

      expect(result.results).toBeDefined();
      if (result.relatedNodes) {
        expect(result.relatedNodes.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('should provide knowledge overview', async () => {
      const overview = await knowledgeCoordinator.getKnowledgeOverview();
      
      expect(overview.totalDocuments).toBeGreaterThan(0);
      expect(overview.documentsByType).toBeDefined();
      expect(overview.graphNodes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('End-to-End Knowledge Workflow', () => {
    it('should complete full knowledge management workflow', async () => {
      // 1. Ingest a new document
      const newDoc: Document = {
        id: 'workflow-test',
        title: 'Knowledge Management Systems',
        content: 'Knowledge management systems help organizations capture, store, and retrieve information effectively. They combine search, categorization, and intelligent retrieval.',
        type: 'text',
        source: 'workflow-test',
        metadata: {
          author: 'KM Expert',
          tags: ['knowledge', 'management', 'systems'],
          language: 'en',
          extractedAt: new Date(),
          processingVersion: '1.0'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // 2. Store in all systems
      await vectorStore.addDocument(newDoc);
      await relationalStore.storeDocument(newDoc);
      await graphStore.addNode(newDoc.id, 'document', {
        title: newDoc.title,
        documentId: newDoc.id
      });

      // 3. Perform cross-store search
      const searchResult = await knowledgeCoordinator.intelligentSearch(
        'knowledge management',
        { maxResults: 5 }
      );

      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.results.some(r => r.document.id === newDoc.id)).toBe(true);

      // 4. Store context about the search
      const contextId = await contextManager.storeContext(
        'workflow-session',
        'workflow-user',
        {
          query: 'knowledge management',
          results: searchResult.results.length,
          timestamp: new Date()
        }
      );

      expect(contextId).toBeDefined();

      // 5. Verify we can retrieve everything
      const retrievedDoc = await relationalStore.getDocument(newDoc.id);
      expect(retrievedDoc?.title).toBe(newDoc.title);

      const retrievedContext = await contextManager.getContext(contextId);
      expect(retrievedContext?.content.query).toBe('knowledge management');

      // Cleanup
      await vectorStore.deleteDocument(newDoc.id);
      await relationalStore.deleteDocument(newDoc.id);
      await graphStore.deleteNode(newDoc.id);
      await contextManager.deleteContext(contextId);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle missing documents gracefully', async () => {
      const result = await knowledgeCoordinator.findRelatedDocuments(
        'non-existent-doc',
        [],
        5
      );

      // Should not throw, but return appropriate result
      expect(result).toBeDefined();
    });

    it('should handle invalid queries gracefully', async () => {
      const crossQuery: CrossStoreQuery = {
        query: '',
        targetStores: ['vector'],
        mergeStrategy: 'union',
        limit: 5
      };

      try {
        const result = await knowledgeCoordinator.crossStoreQuery(crossQuery);
        expect(result.results).toBeDefined();
      } catch (error) {
        // Empty query might be rejected, which is acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle store unavailability', async () => {
      // Create coordinator with limited stores
      const limitedCoordinator = new KnowledgeCoordinator();
      limitedCoordinator.setStores({
        vectorStore: undefined,
        relationalStore,
        graphStore: undefined
      });

      const result = await limitedCoordinator.intelligentSearch(
        'test query',
        { maxResults: 3 }
      );

      expect(result.results).toBeDefined();
      expect(result.metadata.storesQueried.length).toBeGreaterThan(0);
    });
  });
});