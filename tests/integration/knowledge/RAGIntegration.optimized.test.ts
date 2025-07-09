import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { RAGSystem } from '../../../src/knowledge/rag/RAGSystem';
import { VectorStore } from '../../../src/knowledge/stores/VectorStore';
import { SemanticSearchEngine } from '../../../src/knowledge/search/SemanticSearch';
import { OllamaRAGAdapterOptimized } from '../../../src/integrations/ai/OllamaRAGAdapterOptimized';
import { MockRAGAdapter } from '../../../src/integrations/ai/MockRAGAdapter';
import { 
  Document, 
  DocumentType
} from '../../../src/types/Knowledge';
import {
  setupTestEnvironment,
  getTestConfig,
  getOptimizedRagOptions,
  getOptimizedRagProviderConfig,
  getOptimizedRagSystemConfig,
  withTimeout
} from './test-config';

describe('RAG System Integration - Optimized', () => {
  let ragSystem: RAGSystem;
  let vectorStore: VectorStore;
  let semanticSearch: SemanticSearchEngine;
  let aiAdapter: OllamaRAGAdapterOptimized | MockRAGAdapter;
  let testEnv: any;

  const testConfig = getTestConfig();

  // Minimal knowledge base for faster tests
  const knowledgeBase: Document[] = [
    {
      id: 'kb-ai-basics',
      title: 'AI Basics',
      content: 'Artificial Intelligence (AI) enables machines to learn and make decisions. Key areas include machine learning, natural language processing, and computer vision.',
      type: 'article' as DocumentType,
      source: 'test-kb',
      metadata: {
        author: 'Test Author',
        tags: ['ai', 'basics'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'kb-local-ai',
      title: 'Local AI Deployment',
      content: 'Local AI deployment provides privacy, cost savings, and offline operation. Tools like Ollama make it easy to run models locally.',
      type: 'article' as DocumentType,
      source: 'test-kb',
      metadata: {
        author: 'Test Author',
        tags: ['local-ai', 'deployment'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeAll(async () => {
    // Enable fast mode for these tests
    process.env.FAST_MODE = 'true';
    
    // Check if tests should be skipped
    testEnv = await setupTestEnvironment();
    if (testEnv.skip) {
      console.log(`Skipping optimized RAG tests: ${testEnv.reason}`);
      return;
    }

    try {
      // Initialize adapter based on configuration
      if (testConfig.useMockAdapter) {
        console.log('Using MockRAGAdapter for fastest testing');
        aiAdapter = new MockRAGAdapter();
      } else {
        console.log('Using OllamaRAGAdapterOptimized with Phi3 for faster testing');
        aiAdapter = OllamaRAGAdapterOptimized.createPhi3AdapterOptimized();
      }

      // Initialize vector store with real embedding dimensions
      vectorStore = new VectorStore({
        provider: 'chroma',
        collectionName: `rag-optimized-test-${Date.now()}`,
        dimensions: 1024 // mxbai-embed-large dimensions
      });

      // Initialize semantic search with real Ollama embeddings
      const { OllamaEmbeddingProvider } = await import('../../../src/knowledge/search/OllamaEmbeddingProvider');
      const embeddingProvider = new OllamaEmbeddingProvider(
        'mxbai-embed-large:latest', 
        1024, // mxbai-embed-large dimensions
        'http://localhost:11434'
      );
      
      // Test if Ollama embeddings are available
      const isOllamaAvailable = await embeddingProvider.isAvailable();
      console.log('Ollama embeddings available for optimized test:', isOllamaAvailable);
      
      // Set the same embedding provider for VectorStore
      vectorStore.setEmbeddingProvider(embeddingProvider);
      
      semanticSearch = new SemanticSearchEngine(
        vectorStore,
        embeddingProvider,
        undefined,
        {
          defaultThreshold: 0.3, // Higher threshold for real embeddings
          defaultLimit: 5
        }
      );

      // Initialize RAG system with optimized configuration
      ragSystem = new RAGSystem(
        semanticSearch,
        getOptimizedRagProviderConfig(aiAdapter, testConfig),
        getOptimizedRagSystemConfig(testConfig)
      );

      // Initialize components
      await vectorStore.initialize();

      // Add minimal knowledge base
      for (const doc of knowledgeBase) {
        await vectorStore.addDocument(doc);
      }

      console.log('Optimized RAG test setup completed');
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  }, 30000); // 30 second setup timeout

  afterAll(async () => {
    if (testEnv?.skip) return;

    try {
      if (aiAdapter) {
        await Promise.race([
          aiAdapter.shutdown(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Adapter shutdown timeout')), 5000))
        ]);
      }
      if (vectorStore) {
        await Promise.race([
          vectorStore.cleanup(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('VectorStore cleanup timeout')), 5000))
        ]);
      }
    } catch (error) {
      console.warn('Cleanup warning:', error);
    }
  }, 10000); // 10 second cleanup timeout

  describe('Fast RAG Operations', () => {
    it('should answer basic AI questions quickly', async () => {
      if (testEnv?.skip) {
        console.log('Skipping - test environment not available');
        return;
      }

      const response = await withTimeout(
        () => ragSystem.askQuestion(
          'What is artificial intelligence and how does it work?',
          [],
          getOptimizedRagOptions(testConfig)
        ),
        testConfig.timeout,
        'Basic AI question'
      );

      expect(response.success).toBe(true);
      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(10);
      expect(response.sources).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0.3);
      
      console.log(`Response generated in test: ${response.answer.substring(0, 100)}...`);
    }, testConfig.timeout);

    it('should handle follow-up questions with context', async () => {
      if (testEnv?.skip) {
        console.log('Skipping - test environment not available');
        return;
      }

      // First question
      const firstResponse = await withTimeout(
        () => ragSystem.askQuestion(
          'What are the benefits of local AI deployment?',
          [],
          getOptimizedRagOptions(testConfig)
        ),
        testConfig.timeout,
        'First question'
      );

      expect(firstResponse.success).toBe(true);

      // Follow-up with context
      const followUpResponse = await withTimeout(
        () => ragSystem.askQuestion(
          'What about privacy benefits of local deployment?',
          [{ 
            role: 'assistant', 
            content: firstResponse.answer, 
            timestamp: new Date() 
          }],
          getOptimizedRagOptions(testConfig)
        ),
        testConfig.timeout,
        'Follow-up question'
      );

      expect(followUpResponse.success).toBe(true);
      expect(followUpResponse.answer).toBeDefined();
      
      console.log(`Follow-up response: ${followUpResponse.answer.substring(0, 100)}...`);
    }, testConfig.timeout);

    it('should provide source attribution', async () => {
      if (testEnv?.skip) {
        console.log('Skipping - test environment not available');
        return;
      }

      const response = await withTimeout(
        () => ragSystem.askQuestion(
          'How can I deploy AI models locally?',
          [],
          getOptimizedRagOptions(testConfig)
        ),
        testConfig.timeout,
        'Source attribution test'
      );

      expect(response.success).toBe(true);
      expect(response.sources).toBeDefined();
      
      // In mock mode, sources might be empty since we're bypassing actual retrieval
      if (testConfig.useMockAdapter) {
        console.log('Mock mode: sources may be empty, testing response structure');
        expect(response.answer).toBeDefined();
        expect(response.confidence).toBeGreaterThan(0);
      } else {
        expect(response.sources!.length).toBeGreaterThan(0);
        
        // Verify source structure
        const source = response.sources![0];
        expect(source?.document).toBeDefined();
        expect(source?.document.title).toBeDefined();
        expect(source?.document.content).toBeDefined();
        expect(source?.relevanceScore).toBeGreaterThan(0);
      }
      
      console.log(`Sources found: ${response.sources?.length || 0}`);
    }, testConfig.timeout);

    it('should handle edge cases gracefully', async () => {
      if (testEnv?.skip) {
        console.log('Skipping - test environment not available');
        return;
      }

      // Empty question
      try {
        const response = await withTimeout(
          () => ragSystem.askQuestion(
            '',
            [],
            getOptimizedRagOptions(testConfig)
          ),
          testConfig.timeout,
          'Empty question test'
        );
        
        // Should either handle gracefully or throw predictable error
        expect(response.success).toBeDefined();
      } catch (error) {
        // Expected for empty questions
        expect(error).toBeDefined();
      }

      // Very short question
      const shortResponse = await withTimeout(
        () => ragSystem.askQuestion(
          'AI?',
          [],
          getOptimizedRagOptions(testConfig)
        ),
        testConfig.timeout,
        'Short question test'
      );

      expect(shortResponse.success).toBeDefined();
    }, testConfig.timeout);
  });

  describe('Performance Characteristics', () => {
    it('should respond within reasonable time limits', async () => {
      if (testEnv?.skip) {
        console.log('Skipping - test environment not available');
        return;
      }

      const startTime = Date.now();
      
      const response = await ragSystem.askQuestion(
        'Can you explain AI briefly?',
        [],
        getOptimizedRagOptions(testConfig)
      );
      
      const responseTime = Date.now() - startTime;
      
      expect(response.success).toBe(true);
      expect(responseTime).toBeLessThan(60000); // Should respond within 1 minute
      
      console.log(`Response time: ${responseTime}ms`);
    }, testConfig.timeout);

    it('should handle concurrent requests efficiently', async () => {
      if (testEnv?.skip) {
        console.log('Skipping - test environment not available');
        return;
      }

      const questions = [
        'What is artificial intelligence?',
        'What is local AI deployment?'
      ];

      const startTime = Date.now();
      
      const promises = questions.map(q => 
        ragSystem.askQuestion(q, [], getOptimizedRagOptions(testConfig))
      );

      const responses = await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      
      expect(responses).toHaveLength(questions.length);
      expect(responses.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(120000); // Both requests within 2 minutes
      
      console.log(`Concurrent requests completed in: ${totalTime}ms`);
    }, testConfig.timeout * 2);
  });

  describe('Streaming Support (Future)', () => {
    it.skip('should support streaming responses for faster feedback', async () => {
      if (testEnv?.skip) {
        console.log('Skipping - test environment not available');
        return;
      }

      // This test is skipped as streaming is not yet fully implemented
      // but demonstrates how it would work
      
      const chunks: string[] = [];
      let firstChunkTime: number | null = null;
      
      const startTime = Date.now();
      
      await (aiAdapter as any).generateTextStream(
        {
          messages: [{ role: 'user', content: 'What is AI?' }],
          stream: true
        },
        (chunk: string) => {
          if (firstChunkTime === null) {
            firstChunkTime = Date.now();
          }
          chunks.push(chunk);
          console.log('Received chunk:', chunk);
        }
      );
      
      const totalTime = Date.now() - startTime;
      const timeToFirstChunk = firstChunkTime ? firstChunkTime - startTime : totalTime;
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(timeToFirstChunk).toBeLessThan(totalTime);
      
      console.log(`Streaming: ${chunks.length} chunks, first chunk in ${timeToFirstChunk}ms, total ${totalTime}ms`);
    });
  });
});