/**
 * Example: Using RAG System with Claude CLI
 * 
 * This example demonstrates how to set up the RAG system using the Claude CLI
 * instead of API keys. This is useful when you:
 * - Don't want to manage API keys
 * - Want to use your existing Claude subscription
 * - Need better cost control
 * - Prefer the familiar CLI interface
 */

import { RAGSystem } from '../src/knowledge/rag/RAGSystem';
import { SemanticSearchEngine, OpenAIEmbeddingProvider } from '../src/knowledge/search/SemanticSearch';
import { VectorStore } from '../src/knowledge/stores/VectorStore';
import { ClaudeCLIClient } from '../src/integrations/ai/ClaudeCLIClient';
import { AnthropicClient } from '../src/integrations/ai/AnthropicClient';

async function setupRAGWithCLI() {
  console.log('🚀 Setting up RAG system with Claude CLI...\n');

  // 1. Initialize Vector Store
  const vectorStore = new VectorStore({
    provider: 'chroma',
    collectionName: 'cli-rag-demo',
    dimensions: 1536
  });

  // 2. Initialize Embedding Provider (still needs OpenAI for embeddings)
  const embeddingProvider = new OpenAIEmbeddingProvider(
    process.env.OPENAI_API_KEY || 'your-openai-key'
  );

  // 3. Initialize Semantic Search Engine
  const semanticSearch = new SemanticSearchEngine(
    vectorStore,
    embeddingProvider,
    undefined, // No relational store for this example
    {
      defaultLimit: 5,
      defaultThreshold: 0.7
    }
  );

  // 4. Initialize Claude CLI Client (no API key needed!)
  const claudeCLI = new ClaudeCLIClient({
    timeout: 30000, // 30 seconds timeout
    maxRetries: 2,
    model: 'claude-3-sonnet-20240229'
  });

  // 5. Optional: Initialize backup API client
  const claudeAPI = new AnthropicClient({
    apiKey: process.env.ANTHROPIC_API_KEY || 'backup-key',
    defaultModel: 'claude-3-haiku-20240307'
  });

  // 6. Set up RAG providers with CLI as primary
  const ragProviders = [
    {
      name: 'claude-cli' as const,
      client: claudeCLI,
      priority: 1, // Highest priority - try CLI first
      maxContextLength: 100000 // CLI can handle larger contexts
    },
    {
      name: 'claude' as const,
      client: claudeAPI,
      priority: 2, // Fallback to API if CLI fails
      maxContextLength: 200000
    }
  ];

  // 7. Initialize RAG System
  const ragSystem = new RAGSystem(
    semanticSearch,
    ragProviders,
    {
      maxContextLength: 100000,
      retrievalStrategy: 'similarity'
    }
  );

  return { ragSystem, vectorStore, claudeCLI };
}

async function demonstrateRAGWithCLI() {
  try {
    const { ragSystem, vectorStore, claudeCLI } = await setupRAGWithCLI();

    // Health check for CLI
    console.log('🔍 Checking Claude CLI availability...');
    const isHealthy = await claudeCLI.healthCheck();
    console.log(`CLI Status: ${isHealthy ? '✅ Available' : '❌ Not available'}\n`);

    // Initialize vector store
    console.log('📊 Initializing vector store...');
    await vectorStore.initialize();
    console.log('✅ Vector store ready\n');

    // Add some sample documents
    console.log('📚 Adding sample documents...');
    const sampleDocs = [
      {
        id: 'doc-1',
        title: 'Claude CLI Usage Guide',
        content: 'The Claude CLI is a powerful command-line tool that allows you to interact with Claude directly from your terminal. It supports various options like temperature control, token limits, and model selection.',
        type: 'text' as const,
        source: 'documentation',
        metadata: {
          author: 'Anthropic',
          tags: ['cli', 'claude', 'tools'],
          language: 'en',
          extractedAt: new Date(),
          processingVersion: '1.0'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'doc-2',
        title: 'RAG System Architecture',
        content: 'Retrieval-Augmented Generation (RAG) combines the power of large language models with external knowledge bases. This approach allows for more accurate and contextual responses by retrieving relevant information before generation.',
        type: 'text' as const,
        source: 'documentation',
        metadata: {
          author: 'AI Research Team',
          tags: ['rag', 'ai', 'architecture'],
          language: 'en',
          extractedAt: new Date(),
          processingVersion: '1.0'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    for (const doc of sampleDocs) {
      await vectorStore.addDocument(doc);
    }
    console.log('✅ Sample documents added\n');

    // Ask a question using the RAG system
    console.log('🤔 Asking a question using RAG with Claude CLI...');
    const question = 'How does the Claude CLI work and what are its benefits?';
    console.log(`Question: ${question}\n`);

    const response = await ragSystem.askQuestion(question, [], 3);

    console.log('📝 RAG Response:');
    console.log(`Answer: ${response.answer}\n`);
    console.log(`Confidence: ${response.confidence}`);
    console.log(`Sources used: ${response.sources.length}`);
    console.log(`Model: ${response.metadata?.model || 'unknown'}\n`);

    // Show cost summary
    const costSummary = claudeCLI.getCostSummary();
    console.log('💰 Cost Summary:', costSummary);

    // Cleanup
    await vectorStore.shutdown();
    console.log('✅ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Demo failed:', error instanceof Error ? error.message : error);
  }
}

// Usage examples
export {
  setupRAGWithCLI,
  demonstrateRAGWithCLI
};

// Run demo if this file is executed directly
if (require.main === module) {
  demonstrateRAGWithCLI();
}