import { BaseAgent } from '../../../src/agents/base/Agent';
import { AgentConfig, AgentContext, AgentResult } from '../../../src/types/Agent';
import { AgentType } from '../../../src/types/common';

// Mock agent for testing
class MockAgent extends BaseAgent {
  public initializeCalled = false;
  public shutdownCalled = false;

  // Implement abstract methods
  public async executeTask(context: AgentContext): Promise<AgentResult> {
    this.updateStatus('processing');
    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: { result: 'Task executed successfully' }
    };
  }

  public async getCapabilities(): Promise<string[]> {
    return ['text-processing', 'task-execution'];
  }

  // Override initialize to track calls
  public override async initialize(): Promise<void> {
    this.initializeCalled = true;
    await super.initialize();
  }

  // Override shutdown to track calls
  public override async shutdown(): Promise<void> {
    this.shutdownCalled = true;
    await super.shutdown();
  }

  // Add public getter for protected status
  public getInternalStatus(): string {
    return this.status;
  }
}

describe('BaseAgent', () => {
  let agent: MockAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      name: 'Test Agent',
      type: 'personal-assistant' as AgentType,
      capabilities: ['text-processing', 'task-execution'],
      enabled: true,
      priority: 1,
      maxConcurrentTasks: 5,
    };

    agent = new MockAgent(config);
  });

  afterEach(async () => {
    await agent.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await agent.initialize();
      
      expect(agent.initializeCalled).toBe(true);
      expect(agent.getInternalStatus()).toBe('idle');
    });

    it('should have correct basic properties', () => {
      expect(agent.name).toBe('Test Agent');
      expect(agent.type).toBe('personal-assistant');
      expect(agent.id).toBeDefined();
      expect(typeof agent.id).toBe('string');
    });
  });

  describe('Task Execution', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should execute task successfully', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: 'test task',
        conversationHistory: [],
        userPreferences: {},
        activeProjects: [],
        recentDecisions: [],
        contextWindow: 1000,
        timestamp: new Date(),
        metadata: {}
      };

      const result = await agent.executeTask(context);
      
      expect(result.success).toBe(true);
      expect(result.agentId).toBe(agent.id);
      expect(result.timestamp).toBeDefined();
      expect(result.metadata).toBeDefined();
    });
  });

  describe('Capabilities', () => {
    it('should return capabilities', async () => {
      const capabilities = await agent.getCapabilities();
      
      expect(capabilities).toContain('text-processing');
      expect(capabilities).toContain('task-execution');
    });
  });

  describe('Status Management', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should have correct initial status', () => {
      expect(agent.getStatus()).toBe('idle');
    });

    it('should update status during task execution', async () => {
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: 'test task',
        conversationHistory: [],
        userPreferences: {},
        activeProjects: [],
        recentDecisions: [],
        contextWindow: 1000,
        timestamp: new Date(),
        metadata: {}
      };

      const executePromise = agent.executeTask(context);
      
      // Status should change during execution
      expect(agent.getInternalStatus()).toBe('processing');
      
      await executePromise;
    });
  });

  describe('Shutdown', () => {
    it('should shutdown successfully', async () => {
      await agent.initialize();
      await agent.shutdown();
      
      expect(agent.shutdownCalled).toBe(true);
    });
  });
});