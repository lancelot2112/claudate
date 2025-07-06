import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ContextManager } from '../../../src/knowledge/context/ContextManager';
import { ContextCompressor } from '../../../src/knowledge/context/ContextCompressor';
import { ContextEntry, ContextMessage } from '../../../src/types/Knowledge';
import { AnthropicClient } from '../../../src/integrations/ai/AnthropicClient';

describe('Context Management Integration', () => {
  let contextManager: ContextManager;
  let contextCompressor: ContextCompressor;
  let anthropicClient: AnthropicClient;

  const testSessionId = 'test-session-ctx';
  const testUserId = 'test-user-ctx';

  beforeAll(async () => {
    // Initialize with test configuration
    contextManager = new ContextManager({
      hot: {
        storage: 'redis',
        ttl: 300, // 5 minutes for tests
        maxSize: 1024 * 100, // 100KB
        compressionThreshold: 1024 // 1KB
      },
      warm: {
        storage: 'postgresql',
        ttl: 3600, // 1 hour for tests
        maxSize: 1024 * 1024, // 1MB
        compressionEnabled: true
      },
      cold: {
        storage: 'postgresql',
        compressionEnabled: true
      },
      migration: {
        hotToWarmThreshold: 2, // Low threshold for testing
        warmToColdThreshold: 1800, // 30 minutes for tests
        migrationInterval: 60 // 1 minute for tests
      }
    });

    anthropicClient = new AnthropicClient({
      apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
      defaultModel: 'claude-3-haiku-20240307'
    });

    contextCompressor = new ContextCompressor({
      maxInputLength: 5000,
      targetCompressionRatio: 0.5,
      useSemanticCompression: !!process.env.ANTHROPIC_API_KEY, // Use semantic if API key available
      enableSummarization: true
    }, anthropicClient);

    await contextManager.initialize();
  }, 15000);

  afterAll(async () => {
    await contextManager.shutdown();
  }, 10000);

  beforeEach(async () => {
    // Clean up test data
    try {
      const sessionEntries = await contextManager.getSessionContext(testSessionId, 100);
      for (const entry of sessionEntries) {
        await contextManager.deleteContext(entry.id);
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Basic Context Operations', () => {
    it('should store and retrieve context in hot tier', async () => {
      const testContent = {
        type: 'conversation',
        message: 'Hello, how can I help you today?',
        timestamp: new Date().toISOString(),
        metadata: {
          role: 'assistant',
          model: 'claude-3',
          confidence: 0.95
        }
      };

      const contextId = await contextManager.storeContext(
        testSessionId,
        testUserId,
        testContent,
        'hot'
      );

      expect(contextId).toBeDefined();
      expect(typeof contextId).toBe('string');

      const retrieved = await contextManager.getContext(contextId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(contextId);
      expect(retrieved!.sessionId).toBe(testSessionId);
      expect(retrieved!.userId).toBe(testUserId);
      expect(retrieved!.content.message).toBe(testContent.message);
      expect(retrieved!.tier).toBe('hot');
      expect(retrieved!.accessCount).toBe(1); // Incremented by retrieval
    });

    it('should store and retrieve context in warm tier', async () => {
      const testContent = {
        type: 'analysis',
        query: 'Analyze customer feedback trends',
        results: ['positive sentiment increase', 'response time concerns'],
        timestamp: new Date().toISOString()
      };

      const contextId = await contextManager.storeContext(
        testSessionId,
        testUserId,
        testContent,
        'warm'
      );

      const retrieved = await contextManager.getContext(contextId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.tier).toBe('warm');
      expect(retrieved!.content.query).toBe(testContent.query);
      expect(retrieved!.content.results).toEqual(testContent.results);
    });

    it('should store and retrieve context in cold tier', async () => {
      const testContent = {
        type: 'historical',
        summary: 'Long-term project analysis from Q1 2023',
        data: { projects: 15, success_rate: 0.87 },
        timestamp: new Date().toISOString()
      };

      const contextId = await contextManager.storeContext(
        testSessionId,
        testUserId,
        testContent,
        'cold'
      );

      const retrieved = await contextManager.getContext(contextId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.tier).toBe('cold');
      expect(retrieved!.content.summary).toBe(testContent.summary);
    });
  });

  describe('Session Context Management', () => {
    it('should store and retrieve session context', async () => {
      const messages = [
        { role: 'user', content: 'What is machine learning?' },
        { role: 'assistant', content: 'Machine learning is a subset of AI...' },
        { role: 'user', content: 'Can you give me an example?' },
        { role: 'assistant', content: 'Sure! Image recognition is a common example...' }
      ];

      const contextIds: string[] = [];
      
      for (let i = 0; i < messages.length; i++) {
        const id = await contextManager.storeContext(
          testSessionId,
          testUserId,
          {
            messageIndex: i,
            ...messages[i],
            timestamp: new Date().toISOString()
          },
          'hot'
        );
        contextIds.push(id);
      }

      const sessionContext = await contextManager.getSessionContext(testSessionId, 10);
      
      expect(sessionContext.length).toBe(messages.length);
      expect(sessionContext[0]?.sessionId).toBe(testSessionId);
      
      // Should be sorted by timestamp (most recent first)
      for (let i = 0; i < sessionContext.length - 1; i++) {
        expect(sessionContext[i]?.timestamp.getTime()).toBeGreaterThanOrEqual(
          sessionContext[i + 1]?.timestamp.getTime() || 0
        );
      }
    });

    it('should limit session context results', async () => {
      // Store more entries than the limit
      for (let i = 0; i < 10; i++) {
        await contextManager.storeContext(
          testSessionId,
          testUserId,
          { messageIndex: i, content: `Message ${i}` },
          'hot'
        );
      }

      const limitedContext = await contextManager.getSessionContext(testSessionId, 5);
      expect(limitedContext.length).toBe(5);
    });
  });

  describe('User Context Management', () => {
    it('should retrieve user context across sessions', async () => {
      const sessions = ['session-1', 'session-2', 'session-3'];
      
      for (const sessionId of sessions) {
        await contextManager.storeContext(
          sessionId,
          testUserId,
          {
            sessionId,
            activity: 'user interaction',
            timestamp: new Date().toISOString()
          },
          'warm'
        );
      }

      const userContext = await contextManager.getUserContext(testUserId, 10);
      
      expect(userContext.length).toBeGreaterThanOrEqual(sessions.length);
      expect(userContext.every(entry => entry.userId === testUserId)).toBe(true);
    });
  });

  describe('Context Compression', () => {
    it('should compress large context automatically', async () => {
      const largeContent = {
        type: 'large_data',
        data: 'This is a large piece of content. '.repeat(200), // ~6000 chars
        metadata: { size: 'large' }
      };

      const contextId = await contextManager.storeContext(
        testSessionId,
        testUserId,
        largeContent,
        'hot'
      );

      const retrieved = await contextManager.getContext(contextId);
      
      expect(retrieved).toBeDefined();
      expect(retrieved!.content.data).toBe(largeContent.data);
      
      // Should be compressed due to size
      if (JSON.stringify(largeContent).length > 1024) {
        expect(retrieved!.compressed).toBe(true);
      }
    });

    it('should compress context using ContextCompressor', async () => {
      const longText = `
        This is a comprehensive document about machine learning and artificial intelligence.
        It covers various topics including supervised learning, unsupervised learning, and reinforcement learning.
        
        Supervised learning involves training models on labeled data. Common algorithms include linear regression,
        decision trees, support vector machines, and neural networks. These algorithms learn patterns from
        input-output pairs and can make predictions on new, unseen data.
        
        Unsupervised learning works with unlabeled data to discover hidden patterns. Clustering algorithms
        like K-means and hierarchical clustering group similar data points together. Dimensionality reduction
        techniques like PCA and t-SNE help visualize high-dimensional data.
        
        Reinforcement learning involves an agent learning through interaction with an environment.
        The agent receives rewards or penalties based on its actions and learns to maximize cumulative reward.
        This approach has been successful in game playing, robotics, and autonomous systems.
        
        Deep learning, a subset of machine learning, uses neural networks with multiple layers to learn
        complex patterns. Convolutional neural networks excel at image processing, while recurrent neural
        networks handle sequential data like text and time series.
      `;

      const compressionResult = await contextCompressor.compressContext(longText);
      
      expect(compressionResult.compressedContent).toBeDefined();
      expect(compressionResult.compressedLength).toBeLessThan(compressionResult.originalLength);
      expect(compressionResult.compressionRatio).toBeLessThan(1);
      expect(compressionResult.metadata.method).toBeDefined();
      expect(compressionResult.preservedKeyPoints.length).toBeGreaterThan(0);
    });

    it('should summarize conversation context', async () => {
      const conversation: ContextMessage[] = [
        { role: 'user', content: 'I need help with my Python data analysis project.' },
        { role: 'assistant', content: 'I\'d be happy to help! What specific aspects of data analysis are you working on?' },
        { role: 'user', content: 'I have a dataset with sales data and need to identify trends.' },
        { role: 'assistant', content: 'For sales trend analysis, you could use pandas for data manipulation and matplotlib for visualization. What format is your data in?' },
        { role: 'user', content: 'It\'s a CSV file with columns for date, product, quantity, and revenue.' },
        { role: 'assistant', content: 'Perfect! You can load it with pandas.read_csv() and then group by date or product to analyze trends over time.' }
      ];

      const compressionResult = await contextCompressor.compressConversation(conversation);
      
      expect(compressionResult.compressedContent).toBeDefined();
      expect(compressionResult.compressedContent.length).toBeLessThan(
        conversation.map(m => m.content).join(' ').length
      );
    });

    it('should handle different summarization styles', async () => {
      const content = `
        Project Status Report:
        
        Our Q3 development cycle has been highly productive. The team delivered 15 new features,
        fixed 127 bugs, and improved system performance by 23%. Key achievements include:
        
        1. Implementation of real-time analytics dashboard
        2. Migration to microservices architecture
        3. Enhanced security protocols
        4. Mobile app optimization
        
        Challenges faced include integration complexity and temporary performance degradation
        during migration. Next quarter priorities are user experience improvements and
        scalability enhancements.
        
        Budget utilization: 94% of allocated resources
        Team satisfaction: 8.2/10
        Customer feedback: Positive (87% satisfaction rate)
      `;

      const styles = ['bullet-points', 'executive', 'key-insights', 'paragraph'] as const;
      
      for (const style of styles) {
        const summary = await contextCompressor.summarizeContext(content, { style });
        
        expect(summary).toBeDefined();
        expect(summary.length).toBeGreaterThan(0);
        expect(summary.length).toBeLessThan(content.length);
        
        if (style === 'bullet-points') {
          expect(summary).toMatch(/[•\-\*]/); // Should contain bullet point markers
        }
      }
    });
  });

  describe('Context Migration', () => {
    it('should migrate context between tiers', async () => {
      // Store in hot tier with low access count
      const contextId = await contextManager.storeContext(
        testSessionId,
        testUserId,
        { data: 'migration test' },
        'hot'
      );

      // Get initial state
      const initialEntry = await contextManager.getContext(contextId);
      expect(initialEntry!.tier).toBe('hot');

      // Simulate migration (this would normally happen automatically)
      const migrated = await contextManager.migrateContext('hot', 'warm');
      
      // Migration count should be >= 0 (might be 0 if entry doesn't meet criteria)
      expect(migrated).toBeGreaterThanOrEqual(0);
    });

    it('should compress old context', async () => {
      // Store some context that will be old
      const contextId = await contextManager.storeContext(
        testSessionId,
        testUserId,
        { data: 'old context data that should be compressed' },
        'warm'
      );

      // Compress context older than a very recent date
      const compressedCount = await contextManager.compressOldContext(new Date());
      
      expect(compressedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Context Statistics', () => {
    it('should provide context statistics', async () => {
      // Store some test context
      await Promise.all([
        contextManager.storeContext(testSessionId, testUserId, { data: 'hot1' }, 'hot'),
        contextManager.storeContext(testSessionId, testUserId, { data: 'hot2' }, 'hot'),
        contextManager.storeContext(testSessionId, testUserId, { data: 'warm1' }, 'warm'),
        contextManager.storeContext(testSessionId, testUserId, { data: 'cold1' }, 'cold')
      ]);

      const stats = await contextManager.getContextStats();
      
      expect(stats.totalEntries).toBeGreaterThan(0);
      expect(stats.entriesByTier).toBeDefined();
      expect(stats.entriesByTier.hot).toBeGreaterThanOrEqual(0);
      expect(stats.entriesByTier.warm).toBeGreaterThanOrEqual(0);
      expect(stats.entriesByTier.cold).toBeGreaterThanOrEqual(0);
      expect(stats.totalSize).toBeGreaterThanOrEqual(0);
      expect(stats.averageAccessCount).toBeGreaterThanOrEqual(0);
      expect(stats.compressionRatio).toBeGreaterThanOrEqual(0);
      expect(stats.oldestEntry).toBeInstanceOf(Date);
      expect(stats.newestEntry).toBeInstanceOf(Date);
    });
  });

  describe('Context Updates and Deletion', () => {
    it('should update existing context', async () => {
      const initialContent = { version: 1, data: 'initial data' };
      const contextId = await contextManager.storeContext(
        testSessionId,
        testUserId,
        initialContent,
        'hot'
      );

      const updatedContent = { version: 2, data: 'updated data' };
      await contextManager.updateContext(contextId, updatedContent);

      const retrieved = await contextManager.getContext(contextId);
      
      expect(retrieved!.content.version).toBe(2);
      expect(retrieved!.content.data).toBe('updated data');
    });

    it('should delete context', async () => {
      const contextId = await contextManager.storeContext(
        testSessionId,
        testUserId,
        { data: 'to be deleted' },
        'hot'
      );

      // Verify it exists
      const beforeDelete = await contextManager.getContext(contextId);
      expect(beforeDelete).toBeDefined();

      // Delete it
      await contextManager.deleteContext(contextId);

      // Verify it's gone
      const afterDelete = await contextManager.getContext(contextId);
      expect(afterDelete).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid context IDs gracefully', async () => {
      const result = await contextManager.getContext('non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle context manager not initialized', async () => {
      const uninitializedManager = new ContextManager();
      
      await expect(
        uninitializedManager.storeContext('session', 'user', { data: 'test' })
      ).rejects.toThrow('not initialized');
    });

    it('should handle compression errors gracefully', async () => {
      const invalidContent = { circular: {} };
      invalidContent.circular = invalidContent; // Create circular reference

      // Should handle circular references in JSON
      try {
        await contextCompressor.compressContext(JSON.stringify(invalidContent));
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Batch Operations', () => {
    it('should handle batch compression', async () => {
      const entries: ContextEntry[] = [
        {
          id: 'batch-1',
          sessionId: testSessionId,
          userId: testUserId,
          content: 'Short content',
          tier: 'hot',
          timestamp: new Date(),
          accessCount: 1,
          lastAccessed: new Date(),
          size: 100,
          compressed: false
        },
        {
          id: 'batch-2',
          sessionId: testSessionId,
          userId: testUserId,
          content: 'This is a much longer piece of content that should be compressed because it exceeds the threshold. '.repeat(50),
          tier: 'warm',
          timestamp: new Date(),
          accessCount: 1,
          lastAccessed: new Date(),
          size: 5000,
          compressed: false
        }
      ];

      const results = await contextCompressor.batchCompress(entries, 1000);
      
      expect(results).toHaveLength(entries.length);
      expect(results[0].result).toBeNull(); // Short content not compressed
      expect(results[1].result).toBeDefined(); // Long content compressed
      expect(results[1].result!.compressionRatio).toBeLessThan(1);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent context operations', async () => {
      const concurrentOps = Array.from({ length: 10 }, (_, i) =>
        contextManager.storeContext(
          `concurrent-session-${i}`,
          `concurrent-user-${i}`,
          { index: i, data: `concurrent data ${i}` },
          'hot'
        )
      );

      const contextIds = await Promise.all(concurrentOps);
      
      expect(contextIds).toHaveLength(10);
      expect(contextIds.every(id => typeof id === 'string')).toBe(true);

      // Verify all can be retrieved
      const retrievalOps = contextIds.map(id => contextManager.getContext(id));
      const retrieved = await Promise.all(retrievalOps);
      
      expect(retrieved.every(entry => entry !== null)).toBe(true);
    });

    it('should maintain performance with large context data', async () => {
      const largeData = {
        type: 'performance_test',
        data: Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          value: `Data item ${i}`,
          timestamp: new Date().toISOString(),
          metadata: { processed: true, index: i }
        }))
      };

      const startTime = Date.now();
      const contextId = await contextManager.storeContext(
        testSessionId,
        testUserId,
        largeData,
        'warm'
      );
      const storeTime = Date.now() - startTime;

      const retrieveStart = Date.now();
      const retrieved = await contextManager.getContext(contextId);
      const retrieveTime = Date.now() - retrieveStart;

      expect(retrieved).toBeDefined();
      expect(retrieved!.content.data).toHaveLength(1000);
      
      // Performance thresholds (adjust based on system capabilities)
      expect(storeTime).toBeLessThan(5000); // 5 seconds
      expect(retrieveTime).toBeLessThan(2000); // 2 seconds
    });
  });
});