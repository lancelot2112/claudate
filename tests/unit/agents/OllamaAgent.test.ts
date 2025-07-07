import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OllamaAgent, OllamaAgentConfig } from '../../../src/agents/ollama/OllamaAgent';
import { AgentContext } from '../../../src/types/Agent';

// Mock the OllamaClient to avoid real API calls
jest.mock('../../../src/integrations/ai/OllamaClient', () => {
  return {
    OllamaClient: jest.fn().mockImplementation(() => ({
      sendMessage: jest.fn().mockImplementation((request: any) => {
        // Check if this is a health check request
        const isHealthCheck = request.messages?.some((msg: any) => 
          msg.content?.includes('Test message for health check')
        );
        
        return Promise.resolve({
          content: isHealthCheck ? 'OK' : 'Mocked response from Ollama',
          model: request.model || 'qwen3:8b',
          done: true,
          total_duration: 1000,
          eval_count: 20
        });
      }),
      generateEmbeddings: jest.fn(() => Promise.resolve([[0.1, 0.2, 0.3]])),
      healthCheck: jest.fn(() => Promise.resolve({
        healthy: true,
        latencyMs: 100,
        timestamp: new Date()
      }))
    }))
  };
});

// Mock the logger to avoid console output during tests
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

describe('OllamaAgent', () => {
  describe('Static Methods', () => {
    describe('inferCapabilities', () => {
      it('should infer code capabilities for qwen models', () => {
        const capabilities = OllamaAgent.inferCapabilities('qwen3:8b');
        expect(capabilities).toContain('code_generation');
        expect(capabilities).toContain('programming');
        expect(capabilities).toContain('analysis');
        expect(capabilities).toContain('multilingual_support');
      });

      it('should infer creative capabilities for llama models', () => {
        const capabilities = OllamaAgent.inferCapabilities('llama3.2:3b');
        expect(capabilities).toContain('creative_writing');
        expect(capabilities).toContain('storytelling');
        expect(capabilities).toContain('analysis');
      });

      it('should infer code capabilities for coder models', () => {
        const capabilities = OllamaAgent.inferCapabilities('qwen2.5-coder:7b');
        expect(capabilities).toContain('code_generation');
        expect(capabilities).toContain('debugging');
      });

      it('should provide basic capabilities for unknown models', () => {
        const capabilities = OllamaAgent.inferCapabilities('unknown-model:1b');
        expect(capabilities).toContain('text_generation');
        expect(capabilities).toContain('reasoning');
        expect(capabilities).toContain('question_answering');
      });
    });

    describe('Factory Methods', () => {
      const baseConfig = {
        name: 'test-agent',
        type: 'execution' as const,
        capabilities: ['text_generation'],
        enabled: true,
        priority: 1,
        maxConcurrentTasks: 2
      };

      it('should create Qwen3 agent with correct configuration', () => {
        const agent = OllamaAgent.createQwen3Agent(baseConfig);
        const modelInfo = agent.getModelInfo();
        
        expect(modelInfo.model).toBe('qwen3:8b');
        expect(modelInfo.embeddingModel).toBe('mxbai-embed-large');
        expect(agent.getCapabilities()).resolves.toContain('code_generation');
      });

      it('should create Llama3 agent with correct configuration', () => {
        const agent = OllamaAgent.createLlama3Agent(baseConfig);
        const modelInfo = agent.getModelInfo();
        
        expect(modelInfo.model).toBe('llama3.2:3b');
        expect(modelInfo.embeddingModel).toBe('all-minilm');
        expect(agent.getCapabilities()).resolves.toContain('creative_writing');
      });

      it('should create Code agent with correct configuration', () => {
        const agent = OllamaAgent.createCodeAgent(baseConfig);
        const modelInfo = agent.getModelInfo();
        
        expect(modelInfo.model).toBe('qwen2.5-coder:7b');
        expect(modelInfo.capabilities).toContain('code_generation');
        expect(modelInfo.capabilities).toContain('debugging');
      });
    });
  });

  describe('Agent Initialization', () => {
    let config: OllamaAgentConfig;

    beforeEach(() => {
      config = {
        name: 'test-ollama-agent',
        type: 'execution',
        capabilities: ['text_generation'],
        modelName: 'qwen3:8b',
        enabled: true,
        priority: 1,
        maxConcurrentTasks: 2
      };
    });

    it('should initialize with correct properties', () => {
      const agent = new OllamaAgent(config);
      
      expect(agent.name).toBe('OllamaAgent-qwen3:8b');
      expect(agent.type).toBe('execution');
      // Note: BaseAgent doesn't expose config, test other properties
      expect(agent.name).toContain('qwen3:8b');
    });

    it('should infer capabilities from model name', () => {
      const agent = new OllamaAgent(config);
      
      return agent.getCapabilities().then(capabilities => {
        expect(capabilities).toContain('text_generation');
        expect(capabilities).toContain('code_generation');
        expect(capabilities).toContain('reasoning');
      });
    });

    it('should automatically infer capabilities from model name', () => {
      const agent = new OllamaAgent(config);
      
      return agent.getCapabilities().then(capabilities => {
        // Qwen3 should have code generation capabilities
        expect(capabilities).toContain('code_generation');
        expect(capabilities).toContain('text_generation');
        expect(capabilities).toContain('reasoning');
      });
    });

    it('should initialize with custom Ollama connection settings', () => {
      const customConfig = {
        ...config,
        host: 'custom-host',
        port: 9999,
        timeout: 60000,
        maxRetries: 5
      };
      
      const agent = new OllamaAgent(customConfig);
      const modelInfo = agent.getModelInfo();
      
      expect(modelInfo.model).toBe('qwen3:8b');
      expect(modelInfo.status).toBe('idle');
    });
  });

  describe('Task Type Inference', () => {
    let agent: OllamaAgent;

    beforeEach(() => {
      agent = new OllamaAgent({
        name: 'test-agent',
        type: 'execution',
        capabilities: ['text_generation'],
        modelName: 'qwen3:8b',
        enabled: true,
        priority: 1,
        maxConcurrentTasks: 2
      });
    });

    afterEach(async () => {
      await agent.shutdown();
    });

    const createMockContext = (task: string): AgentContext => ({
      sessionId: 'test-session',
      userId: 'test-user',
      task,
      timestamp: new Date(),
      metadata: {},
      conversationHistory: [{
        id: 'test-msg',
        timestamp: new Date(),
        type: 'text',
        urgency: 'normal',
        content: task,
        sender: 'test-user'
      }],
      contextWindow: 4000,
      recentDecisions: [],
      activeProjects: [],
      userPreferences: {}
    });

    it('should infer coding task type', async () => {
      const context = createMockContext('Write a JavaScript function to sort an array');
      const result = await agent.executeTask(context);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.taskType).toBe('coding');
    });

    it('should infer analysis task type', async () => {
      const context = createMockContext('Analyze the pros and cons of renewable energy');
      const result = await agent.executeTask(context);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.taskType).toBe('analysis');
    });

    it('should infer reasoning task type', async () => {
      const context = createMockContext('Explain why the sky is blue');
      const result = await agent.executeTask(context);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.taskType).toBe('reasoning');
    });

    it('should infer translation task type', async () => {
      const context = createMockContext('Translate this to Spanish: Hello world');
      const result = await agent.executeTask(context);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.taskType).toBe('translation');
    });

    it('should infer summarization task type', async () => {
      const context = createMockContext('Summarize the following article: ...');
      const result = await agent.executeTask(context);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.taskType).toBe('summarization');
    });

    it('should infer creative writing task type', async () => {
      const context = createMockContext('Write a short story about space exploration');
      const result = await agent.executeTask(context);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.taskType).toBe('creative_writing');
    });

    it('should infer question answering for questions', async () => {
      const context = createMockContext('What is the capital of France?');
      const result = await agent.executeTask(context);
      
      expect(result.success).toBe(true);
      expect(result.metadata?.taskType).toBe('question_answering');
    });
  });

  describe('Model Management', () => {
    let agent: OllamaAgent;

    beforeEach(() => {
      agent = new OllamaAgent({
        name: 'test-agent',
        type: 'execution',
        capabilities: ['text_generation'],
        modelName: 'qwen3:8b',
        enabled: true,
        priority: 1,
        maxConcurrentTasks: 2
      });
    });

    afterEach(async () => {
      await agent.shutdown();
    });

    it('should allow model updates', () => {
      const initialInfo = agent.getModelInfo();
      expect(initialInfo.model).toBe('qwen3:8b');

      agent.updateModel('llama3.2:3b', 'all-minilm');
      
      const updatedInfo = agent.getModelInfo();
      expect(updatedInfo.model).toBe('llama3.2:3b');
      expect(updatedInfo.embeddingModel).toBe('all-minilm');
    });

    it('should update capabilities when model changes', async () => {
      const initialCapabilities = await agent.getCapabilities();
      expect(initialCapabilities).toContain('code_generation');

      // Switch to a creative model
      agent.updateModel('llama3.2:3b');
      
      const updatedCapabilities = await agent.getCapabilities();
      expect(updatedCapabilities).toContain('creative_writing');
    });

    it('should maintain status during model updates', () => {
      const initialStatus = agent.getModelInfo().status;
      expect(initialStatus).toBe('idle');

      agent.updateModel('llama3.2:3b');
      
      const updatedStatus = agent.getModelInfo().status;
      expect(updatedStatus).toBe('idle');
    });
  });

  describe('Health Check', () => {
    let agent: OllamaAgent;

    beforeEach(() => {
      agent = new OllamaAgent({
        name: 'test-agent',
        type: 'execution',
        capabilities: ['text_generation'],
        modelName: 'qwen3:8b',
        enabled: true,
        priority: 1,
        maxConcurrentTasks: 2
      });
    });

    afterEach(async () => {
      await agent.shutdown();
    });

    it('should perform health check', async () => {
      const isHealthy = await agent.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
      expect(isHealthy).toBe(true); // Mocked to return true
    });
  });

  describe('Task Execution with Structured Tasks', () => {
    let agent: OllamaAgent;

    beforeEach(() => {
      agent = new OllamaAgent({
        name: 'test-agent',
        type: 'execution',
        capabilities: ['text_generation'],
        modelName: 'qwen3:8b',
        enabled: true,
        priority: 1,
        maxConcurrentTasks: 2
      });
    });

    afterEach(async () => {
      await agent.shutdown();
    });

    it('should handle structured task objects', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: {
          type: 'coding',
          description: 'Write a hello world function',
          format: 'code',
          temperature: 0.3
        },
        timestamp: new Date(),
        metadata: {},
        conversationHistory: [],
        contextWindow: 4000,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {}
      };

      const result = await agent.executeTask(context);
      expect(result.success).toBe(true);
      expect(result.metadata?.taskType).toBe('coding');
    });
  });

  describe('Error Handling', () => {
    let agent: OllamaAgent;

    beforeEach(() => {
      agent = new OllamaAgent({
        name: 'test-agent',
        type: 'execution',
        capabilities: ['text_generation'],
        modelName: 'non-existent-model:1b',
        enabled: true,
        priority: 1,
        maxConcurrentTasks: 2
      });
    });

    afterEach(async () => {
      await agent.shutdown();
    });

    it('should handle empty task gracefully', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: '',
        timestamp: new Date(),
        metadata: {},
        conversationHistory: [],
        contextWindow: 4000,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {}
      };

      const result = await agent.executeTask(context);
      
      // Should handle gracefully, either succeed with empty response or fail gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle invalid task input', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: null as any,
        timestamp: new Date(),
        metadata: {},
        conversationHistory: [],
        contextWindow: 4000,
        recentDecisions: [],
        activeProjects: [],
        userPreferences: {}
      };

      const result = await agent.executeTask(context);
      
      // Should handle gracefully
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });
});