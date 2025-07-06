import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { RAGSystem } from '../../../src/knowledge/rag/RAGSystem';
import { VectorStore } from '../../../src/knowledge/stores/VectorStore';
import { SemanticSearchEngine } from '../../../src/knowledge/search/SemanticSearch';
import { ClaudeCLIClient } from '../../../src/integrations/ai/ClaudeCLIClient';
import { GeminiCLIClient } from '../../../src/integrations/ai/GeminiCLIClient';
import { Qwen3RAGAdapter } from '../../../src/integrations/ai/Qwen3RAGAdapter';
import { 
  Document, 
  DocumentType,
  RAGContext,
  ContextMessage 
} from '../../../src/types/Knowledge';

describe('RAG System Integration', () => {
  let ragSystem: RAGSystem;
  let vectorStore: VectorStore;
  let semanticSearch: SemanticSearchEngine;
  let claudeCLIClient: ClaudeCLIClient;
  let geminiCLIClient: GeminiCLIClient;
  let qwen3Adapter: Qwen3RAGAdapter;

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
      id: 'kb-neural-networks',
      title: 'Neural Networks and Deep Learning',
      content: `Neural networks are computing systems inspired by biological neural networks. They consist of interconnected nodes (neurons) organized in layers.

      Architecture Types:
      - Feedforward Networks: Information flows in one direction
      - Convolutional Neural Networks (CNNs): Excellent for image processing
      - Recurrent Neural Networks (RNNs): Handle sequential data
      - Long Short-Term Memory (LSTM): Improved RNNs for long sequences
      - Transformers: Attention-based models for language tasks

      Training Process:
      1. Forward Propagation: Input data flows through the network
      2. Loss Calculation: Compare output with expected results
      3. Backpropagation: Adjust weights to minimize loss
      4. Optimization: Use algorithms like Adam or SGD

      Deep learning refers to neural networks with many hidden layers, enabling the learning of complex patterns and representations.`,
      type: 'text' as DocumentType,
      source: 'knowledge-base',
      metadata: {
        author: 'Deep Learning Specialist',
        tags: ['neural-networks', 'deep-learning', 'cnn', 'rnn', 'transformers'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'kb-data-science',
      title: 'Data Science Workflow',
      content: `Data science is an interdisciplinary field that uses scientific methods, processes, algorithms, and systems to extract knowledge and insights from structured and unstructured data.

      Typical Data Science Workflow:
      1. Problem Definition: Clearly define the business problem or research question
      2. Data Collection: Gather relevant data from various sources
      3. Data Cleaning: Handle missing values, outliers, and inconsistencies
      4. Exploratory Data Analysis (EDA): Understand data patterns and relationships
      5. Feature Engineering: Create meaningful variables for modeling
      6. Model Selection: Choose appropriate algorithms for the problem
      7. Model Training: Train models on prepared data
      8. Model Evaluation: Assess model performance using metrics
      9. Model Deployment: Implement models in production systems
      10. Monitoring: Continuously track model performance

      Essential Tools:
      - Python: Programming language with rich data science ecosystem
      - R: Statistical computing and graphics
      - SQL: Database querying and management
      - Jupyter Notebooks: Interactive development environment
      - Pandas: Data manipulation and analysis
      - Scikit-learn: Machine learning library
      - TensorFlow/PyTorch: Deep learning frameworks`,
      type: 'text' as DocumentType,
      source: 'knowledge-base',
      metadata: {
        author: 'Data Scientist',
        tags: ['data-science', 'workflow', 'python', 'statistics'],
        language: 'en',
        extractedAt: new Date(),
        processingVersion: '1.0'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  beforeAll(async () => {
    // Initialize CLI clients (no API keys required)
    claudeCLIClient = new ClaudeCLIClient({
      model: 'claude-3-haiku-20240307',
      timeout: 30000,
      maxRetries: 3
    });

    geminiCLIClient = new GeminiCLIClient({
      model: 'gemini-1.5-flash',
      timeout: 30000,
      maxRetries: 3
    });

    qwen3Adapter = new Qwen3RAGAdapter('qwen3:8b');

    // Initialize vector store
    vectorStore = new VectorStore({
      provider: 'chroma',
      collectionName: `rag-ollama-test-${Date.now()}`, // Unique collection for each test run
      dimensions: 384 // Ollama all-minilm dimensions
    });

    // Initialize semantic search
    const { OpenAIEmbeddingProvider } = await import('../../../src/knowledge/search/SemanticSearch');
    const embeddingProvider = new OpenAIEmbeddingProvider(
      process.env.OPENAI_API_KEY || 'test-key'
    );
    semanticSearch = new SemanticSearchEngine(
      vectorStore,
      embeddingProvider,
      undefined,
      {}
    );

    // Initialize RAG system with multiple providers (CLI clients + Qwen3)
    const ragProviders = [
      {
        name: 'qwen3' as const,
        client: qwen3Adapter,
        priority: 1, // Qwen3 as primary (local, no API costs)
        maxContextLength: 8000
      },
      {
        name: 'claude-cli' as const,
        client: claudeCLIClient,
        priority: 2,
        maxContextLength: 8000
      },
      {
        name: 'gemini-cli' as const,
        client: geminiCLIClient,
        priority: 3,
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

    // Load knowledge base
    for (const doc of knowledgeBase) {
      await vectorStore.addDocument(doc);
    }
  }, 30000);

  afterAll(async () => {
    if (qwen3Adapter) {
      await qwen3Adapter.shutdown();
    }
    await vectorStore.shutdown();
  }, 10000);

  describe('Basic RAG Operations', () => {
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
      expect(response.sources[0]?.document.id).toBe('kb-ai-basics');
      
      // Answer should contain relevant information about AI
      expect(response.answer.toLowerCase()).toMatch(/artificial intelligence|ai/);
    });

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
    });

    it('should handle questions requiring multiple sources', async () => {
      const response = await ragSystem.askQuestion(
        'How do neural networks relate to machine learning and data science?',
        [],
        4
      );

      expect(response.sources.length).toBeGreaterThan(1);
      
      // Should pull from multiple relevant documents
      const sourceIds = response.sources.map(s => s.document.id);
      expect(sourceIds).toContain('kb-neural-networks');
      expect(sourceIds.some(id => ['kb-ml-algorithms', 'kb-data-science'].includes(id))).toBe(true);
    });
  });

  describe('Conversation Context', () => {
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
      expect(response2.sources.some(s => s.document.id === 'kb-ml-algorithms')).toBe(true);
    });

    it('should handle multi-turn conversations', async () => {
      const conversation: ContextMessage[] = [];

      // Question 1: About neural networks
      const q1 = 'Tell me about neural networks';
      const r1 = await ragSystem.generateConversationalResponse(q1, conversation);
      conversation.push(
        { role: 'user', content: q1, timestamp: new Date() },
        { role: 'assistant', content: r1.answer, timestamp: new Date() }
      );

      // Question 2: About specific architectures
      const q2 = 'What about CNNs and RNNs?';
      const r2 = await ragSystem.generateConversationalResponse(q2, conversation);
      conversation.push(
        { role: 'user', content: q2, timestamp: new Date() },
        { role: 'assistant', content: r2.answer, timestamp: new Date() }
      );

      // Question 3: About training
      const q3 = 'How are they trained?';
      const r3 = await ragSystem.generateConversationalResponse(q3, conversation);

      expect(r3.answer).toBeDefined();
      expect(r3.answer.toLowerCase()).toMatch(/training|backpropagation|gradient|optimization/);
    });
  });

  describe('Context-Aware Responses', () => {
    it('should generate responses with proper context', async () => {
      const context: RAGContext = {
        query: 'Explain the data science workflow',
        retrievedDocuments: [],
        sessionMetadata: {
          maxDocuments: 3
        }
      };

      const response = await ragSystem.generateResponse(context);

      expect(response.answer).toBeDefined();
      expect(response.sources).toBeDefined();
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.sources.length).toBeLessThanOrEqual(3);
      
      // Should specifically address data science workflow
      expect(response.answer.toLowerCase()).toMatch(/workflow|process|steps|data science/);
    });

    it('should respect temperature settings', async () => {
      const lowTempContext: RAGContext = {
        query: 'What is deep learning?',
        retrievedDocuments: [],
        sessionMetadata: {
          maxDocuments: 2,
          temperature: 0.1 // Very low for deterministic output
        }
      };

      const highTempContext: RAGContext = {
        query: 'What is deep learning?',
        retrievedDocuments: [],
        sessionMetadata: {
          maxDocuments: 2,
          temperature: 0.9 // High for creative output
        }
      };

      const lowTempResponse = await ragSystem.generateResponse(lowTempContext);
      const highTempResponse = await ragSystem.generateResponse(highTempContext);

      expect(lowTempResponse.answer).toBeDefined();
      expect(highTempResponse.answer).toBeDefined();
      
      // Both should cover deep learning but may differ in style
      expect(lowTempResponse.answer.toLowerCase()).toMatch(/deep learning|neural network/);
      expect(highTempResponse.answer.toLowerCase()).toMatch(/deep learning|neural network/);
    });
  });

  describe('Document Retrieval and Ranking', () => {
    it('should retrieve most relevant documents', async () => {
      const response = await ragSystem.askQuestion(
        'How do you train a neural network?',
        [],
        3
      );

      expect(response.sources.length).toBeGreaterThan(0);
      
      // Should prioritize neural networks document
      expect(response.sources[0]?.document.id).toBe('kb-neural-networks');
      expect(response.sources[0]?.relevanceScore).toBeGreaterThan(0.5);
      
      // Sources should be ranked by relevance
      for (let i = 0; i < response.sources.length - 1; i++) {
        expect(response.sources[i]?.relevanceScore).toBeGreaterThanOrEqual(
          response.sources[i + 1]?.relevanceScore || 0
        );
      }
    });

    it('should filter by similarity threshold', async () => {
      // Ask about something not well covered in knowledge base
      const response = await ragSystem.askQuestion(
        'What is quantum computing?',
        [],
        5
      );

      // Should still return some documents but with lower confidence
      expect(response.confidence).toBeLessThan(0.8);
      
      if (response.sources.length > 0) {
        // Any returned sources should still meet minimum threshold
        expect(response.sources.every(s => s.relevanceScore >= 0.1)).toBe(true);
      }
    });
  });

  describe('RAG with Different AI Providers', () => {
    it('should work with Anthropic Claude', async () => {
      const anthropicProviders = [
        {
          name: 'claude' as const,
          client: claudeCLIClient,
          priority: 1,
          maxContextLength: 6000
        }
      ];
      
      const anthropicRAG = new RAGSystem(
        semanticSearch,
        anthropicProviders,
        {
          maxContextLength: 6000,
          retrievalStrategy: 'similarity'
        }
      );

      const response = await anthropicRAG.askQuestion(
        'Compare supervised and unsupervised learning',
        [],
        3
      );

      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.answer.toLowerCase()).toMatch(/supervised|unsupervised|learning/);
    });

    it('should work with Qwen3 local model', async () => {
      // Test Qwen3 specifically to ensure local AI integration works
      const qwen3Providers = [
        {
          name: 'qwen3' as const,
          client: qwen3Adapter,
          priority: 1,
          maxContextLength: 8000
        }
      ];

      const qwen3RAG = new RAGSystem(
        semanticSearch,
        qwen3Providers,
        {
          maxContextLength: 8000,
          retrievalStrategy: 'similarity'
        }
      );

      const response = await qwen3RAG.askQuestion(
        'What are the main types of machine learning?',
        [],
        3
      );

      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.answer.toLowerCase()).toMatch(/supervised|unsupervised|machine.*learning/);
      expect(response.confidence).toBeGreaterThan(0.5);
    }, 120000);

    it('should work with Gemini', async () => {
      if (!process.env.GEMINI_API_KEY) {
        console.log('Skipping Gemini test - no API key provided');
        return;
      }

      const geminiProviders = [
        {
          name: 'gemini' as const,
          client: geminiCLIClient,
          priority: 1,
          maxContextLength: 6000
        }
      ];
      
      const geminiRAG = new RAGSystem(
        semanticSearch,
        geminiProviders,
        {
          maxContextLength: 6000,
          retrievalStrategy: 'similarity'
        }
      );

      const response = await geminiRAG.askQuestion(
        'What tools are commonly used in data science?',
        [],
        3
      );

      expect(response.answer).toBeDefined();
      expect(response.answer.toLowerCase()).toMatch(/python|pandas|jupyter|tools/);
    });
  });

  describe('Citation and Source Attribution', () => {
    it.skip('should provide proper citations - NOT YET IMPLEMENTED', async () => {
      // TODO: Implement generateCitations method in RAGSystem
      // const response = await ragSystem.generateCitations([
      //   { document: knowledgeBase[0], relevanceScore: 0.9 },
      //   { document: knowledgeBase[1], relevanceScore: 0.8 }
      // ]);

      // expect(response.length).toBe(2);
      // expect(response[0]).toContain('Introduction to Artificial Intelligence');
      // expect(response[0]).toContain('AI Research Team');
      // expect(response[1]).toContain('Machine Learning Algorithms');
    });

    it('should include source information in responses', async () => {
      const response = await ragSystem.askQuestion(
        'What are the key branches of AI?',
        [],
        2
      );

      expect(response.sources.length).toBeGreaterThan(0);
      
      for (const source of response.sources) {
        expect(source.document.title).toBeDefined();
        expect(source.document.metadata.author).toBeDefined();
        expect(source.relevanceScore).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty knowledge base gracefully', async () => {
      const emptyVectorStore = new VectorStore({
        provider: 'chroma',
        collectionName: 'empty-test-collection',
        dimensions: 1536
      });
      
      await emptyVectorStore.initialize();
      
      const { OpenAIEmbeddingProvider } = await import('../../../src/knowledge/search/SemanticSearch');
      const embeddingProvider = new OpenAIEmbeddingProvider(
        process.env.OPENAI_API_KEY || 'test-key'
      );
      const emptySearch = new SemanticSearchEngine(
        emptyVectorStore,
        embeddingProvider,
        undefined,
        {}
      );
      
      const emptyProviders = [
        {
          name: 'claude' as const,
          client: claudeCLIClient,
          priority: 1,
          maxContextLength: 4000
        }
      ];
      
      const emptyRAG = new RAGSystem(
        emptySearch,
        emptyProviders,
        {
          maxContextLength: 4000,
          retrievalStrategy: 'similarity'
        }
      );

      const response = await emptyRAG.askQuestion('What is AI?', [], 3);

      expect(response.answer).toBeDefined();
      expect(response.sources.length).toBe(0);
      expect(response.confidence).toBeLessThan(0.5);

      await emptyVectorStore.shutdown();
    });

    it('should handle very long questions', async () => {
      const longQuestion = 'What is machine learning? '.repeat(100) + 
        'Please provide a comprehensive answer covering all aspects of the field.';

      const response = await ragSystem.askQuestion(longQuestion, [], 3);

      expect(response.answer).toBeDefined();
      expect(response.sources.length).toBeGreaterThan(0);
    });

    it('should handle questions with no relevant documents', async () => {
      const response = await ragSystem.askQuestion(
        'How do you bake a chocolate cake?',
        [],
        3
      );

      // Should still provide a response, even if not well-informed
      expect(response.answer).toBeDefined();
      expect(response.confidence).toBeLessThan(0.5);
    });

    it('should handle malformed conversation history', async () => {
      const malformedHistory: ContextMessage[] = [
        { role: 'user', content: '', timestamp: new Date() }, // Empty content
        { role: 'assistant', content: 'I can help with that.', timestamp: new Date() },
        { role: 'invalid' as any, content: 'Invalid role', timestamp: new Date() }
      ];

      const response = await ragSystem.generateConversationalResponse(
        'What is AI?',
        malformedHistory
      );

      expect(response.answer).toBeDefined();
      expect(response.sources.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Optimization', () => {
    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      const response = await ragSystem.askQuestion(
        'Explain the difference between supervised and unsupervised learning',
        [],
        3
      );
      
      const responseTime = Date.now() - startTime;
      
      expect(response.answer).toBeDefined();
      expect(responseTime).toBeLessThan(30000); // 30 seconds max
    });

    it('should handle concurrent requests', async () => {
      const questions = [
        'What is machine learning?',
        'How do neural networks work?',
        'What is the data science workflow?',
        'Compare different ML algorithms'
      ];

      const promises = questions.map(q => 
        ragSystem.askQuestion(q, [], 2)
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(questions.length);
      expect(responses.every(r => r.answer.length > 0)).toBe(true);
      expect(responses.every(r => r.sources.length > 0)).toBe(true);
    });

    it('should optimize context length usage', async () => {
      const smallContextProviders = [
        {
          name: 'claude' as const,
          client: claudeCLIClient,
          priority: 1,
          maxContextLength: 2000
        }
      ];
      
      const ragWithSmallContext = new RAGSystem(
        semanticSearch,
        smallContextProviders,
        {
          maxContextLength: 2000, // Small context window
          retrievalStrategy: 'similarity'
        }
      );

      const response = await ragWithSmallContext.askQuestion(
        'Provide a comprehensive overview of all machine learning techniques',
        [],
        5
      );

      expect(response.answer).toBeDefined();
      expect(response.sources.length).toBeGreaterThan(0);
      
      // Should still provide good answer despite context limitations
      expect(response.answer.toLowerCase()).toMatch(/machine learning|algorithm/);
    });
  });

  describe('Analytics and Metrics', () => {
    it('should track response quality metrics', async () => {
      const response = await ragSystem.askQuestion(
        'What are the main components of a neural network?',
        [],
        3
      );

      expect(response.metadata).toBeDefined();
      expect(response.metadata?.retrievalTime || 0).toBeGreaterThanOrEqual(0);
      expect(response.metadata?.generationTime || 0).toBeGreaterThanOrEqual(0);
      expect(response.metadata?.totalTokens || 0).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeGreaterThan(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
    });

    it('should provide retrieval statistics', async () => {
      const response = await ragSystem.askQuestion(
        'How is model evaluation performed in machine learning?',
        [],
        4
      );

      expect(response.sources.length).toBeGreaterThan(0);
      
      // Check that relevance scores are reasonable
      expect(response.sources.every(s => s.relevanceScore >= 0 && s.relevanceScore <= 1)).toBe(true);
      
      // Most relevant source should have high score
      expect(response.sources[0]?.relevanceScore).toBeGreaterThan(0.3);
    });
  });
});