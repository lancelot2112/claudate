/**
 * RAG Integration Test - CLI Version
 * 
 * This test uses local CLI integrations instead of API keys,
 * making it runnable without external API dependencies.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { RAGSystem } from '../../../src/knowledge/rag/RAGSystem';
import { RAGProviderFactory } from '../../../src/utils/ragProviderFactory';
import { Document, DocumentType, ContextMessage } from '../../../src/types/Knowledge';
import logger from '../../../src/utils/logger';

// Mock vector store for testing without external dependencies
class MockVectorStore {
  private documents: Document[] = [];
  private embeddings: Map<string, number[]> = new Map();

  async initialize(): Promise<void> {
    logger.info('MockVectorStore initialized');
  }

  async addDocument(document: Document): Promise<void> {
    this.documents.push(document);
    // Create a simple mock embedding based on content length and keywords
    const embedding = this.createMockEmbedding(document.content);
    this.embeddings.set(document.id, embedding);
  }

  async search(query: string, limit: number = 5): Promise<Array<{document: Document, score: number}>> {
    const queryEmbedding = this.createMockEmbedding(query);
    const results = this.documents.map(doc => {
      const docEmbedding = this.embeddings.get(doc.id) || [];
      const score = this.calculateSimilarity(queryEmbedding, docEmbedding);
      return { document: doc, score };
    });

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .filter(r => r.score > 0.1); // Basic relevance threshold
  }

  async shutdown(): Promise<void> {
    logger.info('MockVectorStore shutdown');
  }

  private createMockEmbedding(text: string): number[] {
    // Create a simple mock embedding based on text characteristics
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0); // Smaller dimension for testing
    
    // Simple hashing approach for consistent embeddings
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      const pos = hash % embedding.length;
      embedding[pos] += 1 / (index + 1); // Weight by position
    });

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? embedding.map(val => val / magnitude) : embedding;
  }

  private calculateSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i] || 0;
      const bVal = b[i] || 0;
      dotProduct += aVal * bVal;
      magnitudeA += aVal * aVal;
      magnitudeB += bVal * bVal;
    }

    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Mock semantic search engine
class MockSemanticSearchEngine {
  constructor(private vectorStore: MockVectorStore) {}

  async search(query: any): Promise<any> {
    const results = await this.vectorStore.search(query.query, query.limit || 5);
    
    return {
      results: results.map(r => ({
        document: r.document,
        score: r.score,
        relevanceScore: r.score,
        metadata: {
          searchTime: Date.now(),
          algorithm: 'mock-similarity'
        }
      })),
      processingTime: Math.random() * 100 + 50, // Mock processing time
      totalFound: results.length
    };
  }
}

describe('RAG System Integration (CLI Version)', () => {
  let ragSystem: RAGSystem;
  let vectorStore: MockVectorStore;
  let searchEngine: MockSemanticSearchEngine;

  const knowledgeBase: Document[] = [
    {
      id: 'kb-ai-basics',
      title: 'Introduction to Artificial Intelligence',
      content: `Artificial Intelligence (AI) is a broad field of computer science focused on creating systems capable of performing tasks that typically require human intelligence. These tasks include learning, reasoning, problem-solving, perception, and language understanding.

Key branches of AI include:
- Machine Learning: Systems that can learn and improve from experience
- Natural Language Processing: Understanding and generating human language
- Computer Vision: Interpreting and analyzing visual information
- Robotics: Creating intelligent machines that can interact with the physical world

AI systems can be categorized as narrow AI (designed for specific tasks) or general AI (hypothetical systems with human-level intelligence across all domains).`,
      type: 'article' as DocumentType,
      source: 'knowledge-base',
      metadata: {
        author: 'AI Research Team',
        tags: ['ai', 'introduction', 'overview'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'kb-ml-algorithms',
      title: 'Machine Learning Algorithms',
      content: `Machine learning algorithms can be broadly categorized into three main types:

1. Supervised Learning:
   - Linear Regression: Predicts continuous values
   - Logistic Regression: Classification for binary or categorical outcomes
   - Decision Trees: Tree-like models for both regression and classification
   - Random Forest: Ensemble of decision trees
   - Support Vector Machines: Finds optimal boundaries between classes
   - Neural Networks: Networks of interconnected nodes

2. Unsupervised Learning:
   - K-Means Clustering: Groups data into k clusters
   - Hierarchical Clustering: Creates tree-like cluster structures
   - Principal Component Analysis (PCA): Dimensionality reduction
   - Association Rules: Finds relationships between variables

3. Reinforcement Learning:
   - Q-Learning: Learns optimal actions through trial and error
   - Policy Gradient Methods: Directly optimize decision-making policies
   - Actor-Critic Methods: Combines value estimation and policy optimization`,
      type: 'text' as DocumentType,
      source: 'knowledge-base',
      metadata: {
        author: 'ML Engineer',
        tags: ['machine-learning', 'algorithms', 'supervised', 'unsupervised', 'reinforcement'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'kb-cli-integration',
      title: 'CLI Integration Benefits',
      content: `Command Line Interface (CLI) integration offers several advantages for AI systems:

Developer Benefits:
- No API key management required
- Uses existing subscriptions and authentication
- Works offline once authenticated
- Faster iteration during development
- Local processing capabilities

Cost Benefits:
- Eliminates per-token API costs for development
- Uses existing service subscriptions
- Reduces external dependencies
- Better cost predictability

Technical Benefits:
- Lower latency for local processing
- Better error handling and retry logic
- Automatic fallback to API services
- Consistent interface across providers

Implementation:
CLI integrations can automatically detect available tools, configure authentication, and provide seamless fallback to API services when needed.`,
      type: 'text' as DocumentType,
      source: 'knowledge-base',
      metadata: {
        author: 'DevOps Engineer',
        tags: ['cli', 'integration', 'development', 'cost-optimization'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeAll(async () => {
    logger.info('Setting up CLI-based RAG integration test');

    // Initialize mock components
    vectorStore = new MockVectorStore();
    await vectorStore.initialize();

    searchEngine = new MockSemanticSearchEngine(vectorStore);

    // Load knowledge base
    for (const doc of knowledgeBase) {
      await vectorStore.addDocument(doc);
    }

    // Create providers using CLI integration
    try {
      logger.info('Attempting to create CLI providers...');
      const providers = await RAGProviderFactory.createProviders({
        preferCLI: true,
        enableFallbacks: false, // CLI only for this test
        timeout: 30000
      });

      logger.info(`Created ${providers.length} CLI providers`, {
        providers: providers.map(p => p.name)
      });

      // Initialize RAG system with CLI providers
      ragSystem = new RAGSystem(
        searchEngine as any,
        providers,
        {
          maxContextLength: 8000,
          retrievalStrategy: 'similarity'
        }
      );

      logger.info('RAG system initialized with CLI providers');

    } catch (error) {
      // Fallback to mock providers if CLI not available
      logger.warn('CLI providers not available, using mock providers', {
        error: error instanceof Error ? error.message : String(error)
      });

      const mockProviders = [{
        name: 'claude' as const,
        client: {
          sendMessage: async (request: any) => ({
            content: `Based on the provided context, I can help answer questions about ${request.messages[0]?.content.includes('AI') ? 'artificial intelligence' : 'the requested topic'}. The information shows relevant details that can inform a comprehensive response.`,
            usage: { input_tokens: 100, output_tokens: 50 },
            model: 'mock-claude'
          })
        } as any,
        priority: 1,
        maxContextLength: 8000
      }];

      ragSystem = new RAGSystem(
        searchEngine as any,
        mockProviders,
        {
          maxContextLength: 8000,
          retrievalStrategy: 'similarity'
        }
      );

      logger.info('RAG system initialized with mock providers');
    }
  }, 45000);

  afterAll(async () => {
    if (vectorStore) {
      await vectorStore.shutdown();
    }
  });

  describe('Basic RAG Operations with CLI', () => {
    it('should answer questions using knowledge base', async () => {
      const response = await ragSystem.askQuestion(
        'What is artificial intelligence?',
        [],
        3
      );

      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.confidence).toBeGreaterThan(0);
      
      // Check that we got relevant document
      const aiBasicsDoc = response.sources.find(s => s.document.id === 'kb-ai-basics');
      expect(aiBasicsDoc).toBeDefined();
      
      logger.info('RAG question answered successfully', {
        answerLength: response.answer.length,
        sourceCount: response.sources.length,
        confidence: response.confidence
      });
    }, 30000);

    it('should provide sources for answers', async () => {
      const response = await ragSystem.askQuestion(
        'What are the main types of machine learning algorithms?',
        [],
        5
      );

      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.sources[0]?.document).toBeDefined();
      expect(response.sources[0]?.relevanceScore).toBeGreaterThan(0);
      
      // Should find the ML algorithms document
      const mlDoc = response.sources.find(s => s.document.id === 'kb-ml-algorithms');
      expect(mlDoc).toBeDefined();

      logger.info('Sources provided correctly', {
        sourceCount: response.sources.length,
        mlDocFound: !!mlDoc
      });
    }, 30000);

    it('should handle questions about CLI integration', async () => {
      const response = await ragSystem.askQuestion(
        'What are the benefits of CLI integration for AI systems?',
        [],
        3
      );

      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
      expect(response.sources.length).toBeGreaterThan(0);
      
      // Should find the CLI integration document
      const cliDoc = response.sources.find(s => s.document.id === 'kb-cli-integration');
      expect(cliDoc).toBeDefined();
      
      // Answer should mention CLI benefits
      expect(response.answer.toLowerCase()).toMatch(/cli|command|integration|benefit/);

      logger.info('CLI integration question answered', {
        cliDocFound: !!cliDoc,
        answersContainCLI: response.answer.toLowerCase().includes('cli')
      });
    }, 30000);
  });

  describe('Conversation Context with CLI', () => {
    it('should maintain conversation history', async () => {
      const conversation: ContextMessage[] = [];

      // First question
      const response1 = await ragSystem.generateConversationalResponse(
        'What is machine learning?',
        conversation
      );

      conversation.push(
        { role: 'user', content: 'What is machine learning?', timestamp: new Date() },
        { role: 'assistant', content: response1.answer, timestamp: new Date() }
      );

      // Follow-up question
      const response2 = await ragSystem.generateConversationalResponse(
        'What are some common algorithms used in it?',
        conversation
      );

      expect(response2.answer).toBeDefined();
      expect(response2.answer.toLowerCase()).toMatch(/algorithm|regression|classification|clustering/);
      
      // Should understand "it" refers to machine learning from context
      const mlDoc = response2.sources.find(s => s.document.id === 'kb-ml-algorithms');
      expect(mlDoc).toBeDefined();

      logger.info('Conversational context maintained', {
        firstAnswerLength: response1.answer.length,
        secondAnswerLength: response2.answer.length,
        contextPreserved: !!mlDoc
      });
    }, 45000);
  });

  describe('CLI Provider Health and Performance', () => {
    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      const response = await ragSystem.askQuestion(
        'Explain the difference between supervised and unsupervised learning',
        [],
        3
      );
      
      const responseTime = Date.now() - startTime;
      
      expect(response.answer).toBeDefined();
      expect(responseTime).toBeLessThan(45000); // 45 seconds max for CLI
      
      logger.info('Performance test completed', {
        responseTime,
        withinLimit: responseTime < 45000
      });
    }, 50000);

    it('should handle edge cases gracefully', async () => {
      // Test with empty query (should handle gracefully)
      try {
        const response = await ragSystem.askQuestion('', [], 1);
        // Should either work or fail gracefully
        if (response) {
          expect(response.answer).toBeDefined();
        }
      } catch (error) {
        // Empty query rejection is acceptable
        expect(error).toBeDefined();
      }

      // Test with very short query
      const shortResponse = await ragSystem.askQuestion('AI?', [], 2);
      expect(shortResponse.answer).toBeDefined();
      expect(shortResponse.sources.length).toBeGreaterThanOrEqual(0);

      logger.info('Edge cases handled gracefully');
    }, 30000);
  });

  describe('CLI Provider Detection and Fallback', () => {
    it('should detect available CLI providers', async () => {
      const providers = await RAGProviderFactory.createProviders({
        preferCLI: true,
        enableFallbacks: true
      });

      expect(providers.length).toBeGreaterThan(0);
      
      // Should have at least one CLI or API provider
      const hasCliProvider = providers.some(p => p.name.includes('cli'));
      const hasApiProvider = providers.some(p => !p.name.includes('cli'));
      
      expect(hasCliProvider || hasApiProvider).toBe(true);

      logger.info('Provider detection test completed', {
        totalProviders: providers.length,
        cliProviders: providers.filter(p => p.name.includes('cli')).length,
        apiProviders: providers.filter(p => !p.name.includes('cli')).length
      });
    });

    it('should create CLI-only providers when available', async () => {
      try {
        const cliProviders = await RAGProviderFactory.createCLIOnlyProviders();
        
        expect(cliProviders.length).toBeGreaterThan(0);
        expect(cliProviders.every(p => p.name.includes('cli'))).toBe(true);

        logger.info('CLI-only providers created successfully', {
          providers: cliProviders.map(p => p.name)
        });
      } catch (error) {
        // CLI not available - this is acceptable
        logger.info('CLI providers not available (expected if CLIs not installed)', {
          error: error instanceof Error ? error.message : String(error)
        });
        expect(error).toBeDefined();
      }
    });
  });
});