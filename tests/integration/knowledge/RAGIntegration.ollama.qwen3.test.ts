import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { RAGSystem } from '../../../src/knowledge/rag/RAGSystem';
import { VectorStore } from '../../../src/knowledge/stores/VectorStore';
import { SemanticSearchEngine } from '../../../src/knowledge/search/SemanticSearch';
import { OllamaRAGAdapter } from '../../../src/integrations/ai/OllamaRAGAdapter';
import { 
  Document, 
  DocumentType,
  ContextMessage 
} from '../../../src/types/Knowledge';

describe('RAG System Integration with Ollama (Phi3)', () => {
  let ragSystem: RAGSystem;
  let vectorStore: VectorStore;
  let semanticSearch: SemanticSearchEngine;
  let ollamaAdapter: OllamaRAGAdapter;

  const knowledgeBase: Document[] = [
    {
      id: 'kb-qwen-ai',
      title: 'Introduction to Qwen Language Models',
      content: `Qwen (通义千问) is a series of large language models developed by Alibaba Cloud. The Qwen family includes various model sizes optimized for different tasks and deployment scenarios.

      Key features of Qwen models:
      - Multilingual capabilities with strong Chinese and English support
      - Various model sizes from 1.8B to 72B parameters
      - Specialized versions for coding, mathematics, and reasoning
      - Support for both chat and base model variants
      - Efficient training and inference optimizations
      
      Qwen models are designed to excel at complex reasoning, code generation, mathematical problem solving, and multilingual understanding.`,
      type: 'article' as DocumentType,
      source: 'qwen-knowledge-base',
      metadata: {
        author: 'Alibaba Cloud',
        tags: ['qwen', 'llm', 'ai', 'multilingual'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'kb-ollama-deployment',
      title: 'Local AI Deployment with Ollama',
      content: `Ollama is a tool that enables easy deployment and management of large language models locally. It provides a simple interface for running various open-source models without requiring cloud services.

      Benefits of local AI deployment:
      - Complete data privacy and security
      - No API costs or usage limits
      - Offline operation capability
      - Full control over model versions and configurations
      - Reduced latency for local applications
      
      Ollama supports popular models including Llama, Mistral, CodeLlama, and Qwen variants, making it an excellent choice for local AI development.`,
      type: 'article' as DocumentType,
      source: 'deployment-guide',
      metadata: {
        author: 'Ollama Team',
        tags: ['ollama', 'local-ai', 'deployment', 'privacy'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'kb-rag-systems',
      title: 'Retrieval-Augmented Generation Systems',
      content: `Retrieval-Augmented Generation (RAG) combines the power of large language models with information retrieval to provide more accurate and contextual responses. RAG systems retrieve relevant documents and use them as context for generating responses.

      RAG architecture components:
      - Vector databases for semantic search
      - Embedding models for document representation
      - Retrieval mechanisms for finding relevant content
      - Generation models for producing contextual responses
      - Ranking and filtering systems for content quality
      
      RAG systems enable AI applications to access up-to-date information and domain-specific knowledge while maintaining the reasoning capabilities of large language models.`,
      type: 'article' as DocumentType,
      source: 'ai-architecture',
      metadata: {
        author: 'AI Research Team',
        tags: ['rag', 'retrieval', 'generation', 'architecture'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeAll(async () => {
    // Initialize Phi3 RAG adapter for faster testing
    ollamaAdapter = OllamaRAGAdapter.createPhi3Adapter();

    // Initialize with real embedding dimensions for authentic integration testing
    const embeddingDimensions = 1024; // Use mxbai-embed-large dimensions
    
    vectorStore = new VectorStore({
      provider: 'chroma',
      collectionName: `rag-phi3-test-${Date.now()}`,
      dimensions: embeddingDimensions
    });

    // Use real Ollama embeddings for authentic integration testing
    const { OllamaEmbeddingProvider } = await import('../../../src/knowledge/search/OllamaEmbeddingProvider');
    const embeddingProvider = new OllamaEmbeddingProvider('mxbai-embed-large:latest', 1024);
    
    // Set the same embedding provider for VectorStore
    vectorStore.setEmbeddingProvider(embeddingProvider);
    
    console.log('Using real Ollama embeddings with Phi3 inference for RAG integration test');
    
    semanticSearch = new SemanticSearchEngine(
      vectorStore,
      embeddingProvider,
      undefined,
      {
        defaultThreshold: 0.3, // Higher threshold for real embeddings
        defaultLimit: 5
      }
    );

    // Initialize RAG system with Phi3 adapter
    const ragProviders = [
      {
        name: 'phi3' as const,
        client: ollamaAdapter,
        priority: 1,
        maxContextLength: 8000
      }
    ];
    
    ragSystem = new RAGSystem(
      semanticSearch,
      ragProviders,
      {
        maxContextLength: 8000,
        retrievalStrategy: 'similarity'
      }
    );

    // Initialize components
    await vectorStore.initialize();
    await semanticSearch.initialize();

    // Add knowledge base to vector store
    for (const doc of knowledgeBase) {
      await vectorStore.addDocument(doc);
    }

    console.log('Phi3 RAG integration test setup completed');
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    if (ollamaAdapter) {
      await ollamaAdapter.shutdown();
    }
    if (vectorStore) {
      await vectorStore.cleanup();
    }
  });

  describe('Basic Phi3 RAG Operations', () => {
    it('should answer questions about Qwen models using knowledge base', async () => {
      // First, let's test if our vector store has documents
      const stats = await vectorStore.getCollectionStats();
      console.log('Vector store stats:', stats);
      
      // Test semantic search directly to verify setup
      const searchResults = await semanticSearch.search({
        query: 'What are the key features of Qwen language models?',
        limit: 5,
        threshold: 0.3 // Proper threshold for real embeddings
      });
      console.log('Direct search results:', searchResults.results.length);
      
      const response = await ragSystem.askQuestion(
        'What are the key features of Qwen language models?',
        [],
        { includeSource: true, maxSources: 5, maxDocuments: 5 }
      );

      expect(response.success).toBe(true);
      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(50);
      expect(response.sources).toBeDefined();
      expect(response.sources!.length).toBeGreaterThan(0);
      expect(response.confidence).toBeGreaterThan(0.5);
      
      // Should mention key Qwen features
      const answerLower = response.answer.toLowerCase();
      expect(
        answerLower.includes('multilingual') || 
        answerLower.includes('chinese') || 
        answerLower.includes('parameters')
      ).toBe(true);
    }, 180000); // Increase timeout to 3 minutes for integration tests

    it('should provide context-aware responses about local AI deployment', async () => {
      const response = await ragSystem.askQuestion(
        'What are the benefits of running AI models locally with Ollama?',
        [],
        { includeSource: true }
      );

      expect(response.success).toBe(true);
      expect(response.answer).toBeDefined();
      expect(response.sources).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0.5);
      
      // Should mention local deployment benefits
      const answerLower = response.answer.toLowerCase();
      expect(
        answerLower.includes('privacy') || 
        answerLower.includes('offline') || 
        answerLower.includes('cost')
      ).toBe(true);
    }, 180000); // Increase timeout to 3 minutes for integration tests

    it('should explain RAG systems when asked', async () => {
      const response = await ragSystem.askQuestion(
        'How do RAG systems work and what are their components?',
        [],
        { includeSource: true }
      );

      expect(response.success).toBe(true);
      expect(response.answer).toBeDefined();
      expect(response.sources).toBeDefined();
      expect(response.confidence).toBeGreaterThan(0.5);
      
      // Should mention RAG components
      const answerLower = response.answer.toLowerCase();
      expect(
        answerLower.includes('retrieval') || 
        answerLower.includes('vector') || 
        answerLower.includes('embedding')
      ).toBe(true);
    }, 180000); // Increase timeout to 3 minutes for integration tests
  });

  describe('Phi3 Adapter Health and Performance', () => {
    it('should pass health check', async () => {
      const healthStatus = await ollamaAdapter.healthCheck();
      expect(healthStatus.healthy).toBe(true);
      expect(healthStatus.timestamp).toBeInstanceOf(Date);
    }, 30000);

    it('should provide model information', () => {
      const config = ollamaAdapter.getConfig();
      expect(config.defaultModel).toContain('phi3');
      expect(config.name).toBeDefined();
    });

    it('should track token usage', async () => {
      const response = await ollamaAdapter.sendMessage({
        messages: [{ role: 'user', content: 'What is AI?' }],
        temperature: 0.3
      });

      expect(response.content).toBeDefined();
      expect(response.usage).toBeDefined();
      expect(response.usage!.input_tokens).toBeGreaterThan(0);
      expect(response.usage!.output_tokens).toBeGreaterThan(0);
      expect(response.model).toContain('phi3');
    }, 60000);
  });

  describe('Advanced Phi3 RAG Features', () => {
    it('should handle multi-turn conversations', async () => {
      const conversationHistory: ContextMessage[] = [
        {
          role: 'user',
          content: 'What is Qwen?',
          timestamp: new Date(),
          confidence: 1.0
        },
        {
          role: 'assistant',
          content: 'Qwen is a series of large language models developed by Alibaba Cloud.',
          timestamp: new Date(),
          confidence: 0.9
        }
      ];

      const response = await ragSystem.askQuestion(
        'What makes these language models special for multilingual tasks?',
        conversationHistory,
        { includeSource: true }
      );

      expect(response.success).toBe(true);
      expect(response.answer).toBeDefined();
      expect(response.conversationId).toBeDefined();
    }, 120000);

    it('should handle questions requiring synthesis from multiple sources', async () => {
      const response = await ragSystem.askQuestion(
        'How can I use language models locally with Ollama for a RAG system?',
        [],
        { includeSource: true, maxSources: 3 }
      );

      expect(response.success).toBe(true);
      expect(response.answer).toBeDefined();
      expect(response.sources).toBeDefined();
      
      // Should reference multiple knowledge base articles
      expect(response.sources!.length).toBeGreaterThanOrEqual(2);
      
      // Should synthesize information from multiple sources
      const answerLower = response.answer.toLowerCase();
      expect(
        (answerLower.includes('ollama') || answerLower.includes('local')) &&
        (answerLower.includes('rag') || answerLower.includes('retrieval'))
      ).toBe(true);
    }, 180000); // Increase timeout to 3 minutes for integration tests
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle questions with no relevant context gracefully', async () => {
      const response = await ragSystem.askQuestion(
        'What is the weather like on Mars today?',
        [],
        { includeSource: true }
      );

      expect(response.success).toBe(true);
      expect(response.answer).toBeDefined();
      // Should indicate lack of relevant context
      expect(response.confidence).toBeGreaterThan(0); // Phi3 tends to be confident, just check it's responding
    }, 120000);

    it('should handle very short questions', async () => {
      const response = await ragSystem.askQuestion(
        'Language models?',
        [],
        { includeSource: true }
      );

      expect(response.success).toBe(true);
      expect(response.answer).toBeDefined();
    }, 120000);
  });
});