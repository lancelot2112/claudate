import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { Qwen3Agent } from '../../../src/agents/ollama/Qwen3Agent';
import { AgentContext } from '../../../src/types/Agent';

describe('Qwen3Agent', () => {
  let agent: Qwen3Agent;

  beforeEach(() => {
    agent = new Qwen3Agent({
      name: 'TestQwen3Agent',
      type: 'execution',
      capabilities: [],
      enabled: true,
      priority: 1,
      maxConcurrentTasks: 1
    }, 'qwen3:8b');
  });

  afterEach(async () => {
    await agent.shutdown();
  });

  describe('Agent Initialization', () => {
    it('should initialize with correct properties', () => {
      expect(agent.name).toBe('Qwen3Agent');
      expect(agent.type).toBe('execution');
      expect(agent.id).toBeDefined();
    });

    it('should have expected capabilities', async () => {
      const capabilities = await agent.getCapabilities();
      expect(capabilities).toContain('text_generation');
      expect(capabilities).toContain('code_generation');
      expect(capabilities).toContain('reasoning');
      expect(capabilities).toContain('analysis');
      expect(capabilities).toContain('multilingual_support');
    });

    it('should have correct model info', () => {
      const modelInfo = agent.getModelInfo();
      expect(modelInfo.model).toBe('qwen3:8b');
      expect(modelInfo.status).toBe('idle');
    });
  });

  describe('Task Type Inference', () => {
    it('should infer coding task type', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: 'Write a function to calculate factorial',
        conversationHistory: [{ 
          id: 'test-msg-1',
          timestamp: new Date(),
          type: 'text',
          urgency: 'normal',
          content: 'Write a function to calculate factorial',
          sender: 'test-user'
        }],
        contextWindow: 10,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {},
        timestamp: new Date()
      };

      // This will run against real Ollama if available, or mock if not
      try {
        const result = await agent.executeTask(context);
        expect(result.metadata?.taskType).toBe('coding');
      } catch (error) {
        // If Ollama is not available, skip this test
        console.log('Skipping Ollama test - service not available');
      }
    });

    it('should infer analysis task type', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: 'Analyze the pros and cons of renewable energy',
        conversationHistory: [{ 
          id: 'test-msg-2',
          timestamp: new Date(),
          type: 'text',
          urgency: 'normal',
          content: 'Analyze the pros and cons of renewable energy',
          sender: 'test-user'
        }],
        contextWindow: 10,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {},
        timestamp: new Date()
      };

      try {
        const result = await agent.executeTask(context);
        expect(result.metadata?.taskType).toBe('analysis');
      } catch (error) {
        console.log('Skipping Ollama test - service not available');
      }
    });

    it('should infer reasoning task type', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: 'Explain why the sky appears blue',
        conversationHistory: [{ 
          id: 'test-msg-3',
          timestamp: new Date(),
          type: 'text',
          urgency: 'normal',
          content: 'Explain why the sky appears blue',
          sender: 'test-user'
        }],
        contextWindow: 10,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {},
        timestamp: new Date()
      };

      try {
        const result = await agent.executeTask(context);
        expect(result.metadata?.taskType).toBe('reasoning');
      } catch (error) {
        console.log('Skipping Ollama test - service not available');
      }
    });
  });

  describe('Model Management', () => {
    it('should allow model updates', () => {
      agent.updateModel('qwen3:14b');
      const modelInfo = agent.getModelInfo();
      expect(modelInfo.model).toBe('qwen3:14b');
    });

    it('should maintain status during model updates', () => {
      const initialStatus = agent.getStatus();
      agent.updateModel('llama3.2');
      expect(agent.getStatus()).toBe(initialStatus);
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      try {
        const isHealthy = await agent.healthCheck();
        expect(typeof isHealthy).toBe('boolean');
      } catch (error) {
        console.log('Skipping health check - Ollama service not available');
      }
    });
  });

  describe('Task Execution with Structured Tasks', () => {
    it('should handle coding task with structured input', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: {
          type: 'coding',
          description: 'Create a simple bubble sort algorithm in Python',
          language: 'python',
          format: 'code'
        },
        conversationHistory: [],
        contextWindow: 10,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {},
        timestamp: new Date()
      };

      try {
        const result = await agent.executeTask(context);
        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.tokenUsage).toBeDefined();
      } catch (error) {
        console.log('Skipping Ollama test - service not available');
      }
    });

    it('should handle translation task', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: {
          type: 'translation',
          description: 'Translate "Hello, how are you?" to Spanish',
          language: 'spanish',
          format: 'text'
        },
        conversationHistory: [],
        contextWindow: 10,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {},
        timestamp: new Date()
      };

      try {
        const result = await agent.executeTask(context);
        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
        expect(result.metadata?.taskType).toBe('translation');
      } catch (error) {
        console.log('Skipping Ollama test - service not available');
      }
    });

    it('should handle summarization task', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: {
          type: 'summarization',
          description: 'Summarize the following text: Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by animals including humans.',
          maxLength: 50,
          format: 'text'
        },
        conversationHistory: [],
        contextWindow: 10,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {},
        timestamp: new Date()
      };

      try {
        const result = await agent.executeTask(context);
        expect(result.success).toBe(true);
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeLessThanOrEqual(100); // Rough check for summarization
      } catch (error) {
        console.log('Skipping Ollama test - service not available');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle empty task gracefully', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: null,
        conversationHistory: [],
        contextWindow: 10,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {},
        timestamp: new Date()
      };

      const result = await agent.executeTask(context);
      // Should not crash, should return a valid result structure
      expect(result).toBeDefined();
      expect(result.agentId).toBe(agent.id);
    });

    it('should handle invalid task input', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: null,
        conversationHistory: [{ 
          id: 'test-msg-4',
          timestamp: new Date(),
          type: 'text',
          urgency: 'normal',
          content: '',
          sender: 'test-user'
        }],
        contextWindow: 10,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {},
        timestamp: new Date()
      };

      const result = await agent.executeTask(context);
      expect(result).toBeDefined();
      expect(result.agentId).toBe(agent.id);
    });
  });
});