import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { RAGSystem } from '../../../src/knowledge/rag/RAGSystem';
import { VectorStore } from '../../../src/knowledge/stores/VectorStore';
import { SemanticSearchEngine } from '../../../src/knowledge/search/SemanticSearch';
import { OllamaRAGAdapter } from '../../../src/integrations/ai/OllamaRAGAdapter';
import { 
  Document, 
  DocumentType
} from '../../../src/types/Knowledge';

describe('RAG System Integration', () => {
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
    // Initialize AI client with faster phi3:mini model
    ollamaAdapter = OllamaRAGAdapter.createPhi3Adapter();

    // Initialize vector store with dimensions matching Ollama embedding model
    vectorStore = new VectorStore({
      provider: 'chroma',
      collectionName: `rag-test-main-${Date.now()}`,
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
    console.log('Ollama embeddings available:', isOllamaAvailable);
    
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

    // Initialize RAG system
    const ragProviders = [
      {
        name: 'ollama-qwen3',
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

    // Load knowledge base
    console.log('Starting document ingestion...');
    for (let i = 0; i < knowledgeBase.length; i++) {
      const doc = knowledgeBase[i]!;
      console.log(`Adding document ${i + 1}/${knowledgeBase.length}: ${doc.title}`);
      await vectorStore.addDocument(doc);
      console.log(`Document ${i + 1} added successfully`);
    }
    console.log('Document ingestion completed');
  }, 60000); // Increase setup timeout for real embeddings

  afterAll(async () => {
    await vectorStore.shutdown();
  }, 10000);

  describe('Basic RAG Operations', () => {
    it('should answer questions using knowledge base', async () => {
      // Test semantic search directly to verify setup
      const searchResults = await semanticSearch.search({
        query: 'What are the key features of Qwen language models?',
        limit: 3,
        threshold: 0.3
      });
      console.log('Direct search results:', searchResults.results.length);
      
      const response = await ragSystem.askQuestion(
        'What are the key features of Qwen language models?',
        [],
        { maxSources: 3, includeSource: true }
      );

      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.confidence).toBeGreaterThan(0);
      
      // Answer should contain relevant information about Qwen models
      expect(response.answer.toLowerCase()).toMatch(/qwen|model|language|multilingual|alibaba/);
    }, 60000); // 1 minute timeout for faster feedback

    it('should provide sources for answers', async () => {
      const response = await ragSystem.askQuestion(
        'What are the benefits of local AI deployment with Ollama?',
        [],
        { maxSources: 5, includeSource: true }
      );

      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.sources[0]?.document).toBeDefined();
      expect(response.sources[0]?.relevanceScore).toBeGreaterThan(0);
    }, 60000);

    it('should handle RAG system questions', async () => {
      const response = await ragSystem.askQuestion(
        'How do RAG systems work for retrieval and generation?',
        [],
        { maxSources: 4, includeSource: true }
      );

      expect(response.sources.length).toBeGreaterThan(0);
      
      // Should pull from relevant documents
      const sourceIds = response.sources.map(s => s.document.id);
      expect(sourceIds.some(id => id.includes('rag'))).toBe(true);
    }, 60000);
  });
});
