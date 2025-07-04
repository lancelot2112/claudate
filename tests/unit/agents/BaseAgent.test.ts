import { BaseAgent } from '../../../src/agents/base/Agent';
import { AgentConfig, AgentContext, AgentResponse, Task } from '../../../src/types/Agent';
import { BaseMessage, AgentType } from '../../../src/types/common';

// Mock agent for testing
class MockAgent extends BaseAgent {
  public initializeCalled = false;
  public shutdownCalled = false;
  public processMessageCalled = false;
  public taskAssignedCalled = false;

  protected async onInitialize(): Promise<void> {
    this.initializeCalled = true;
  }

  protected async onShutdown(): Promise<void> {
    this.shutdownCalled = true;
  }

  protected async onProcessMessage(
    message: BaseMessage,
    context: AgentContext
  ): Promise<AgentResponse> {
    this.processMessageCalled = true;
    return {
      success: true,
      data: { response: `Processed message: ${message.content}` },
      processingTime: 0,
    };
  }

  protected async onTaskAssigned(task: Task): Promise<void> {
    this.taskAssignedCalled = true;
    // Simulate task completion
    setTimeout(() => {
      this.completeTask(task.id, { result: 'Task completed successfully' });
    }, 100);
  }
}

describe('BaseAgent', () => {
  let agent: MockAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      id: 'test-agent-001',
      type: 'personal-assistant' as AgentType,
      name: 'Test Agent',
      description: 'Agent for testing purposes',
      capabilities: [
        {
          name: 'text-processing',
          description: 'Process text messages',
          inputTypes: ['text'],
          outputTypes: ['text'],
        },
      ],
      maxConcurrentTasks: 5,
      timeout: 30000,
      retryAttempts: 3,
      priority: 1,
      enabled: true,
    };

    agent = new MockAgent(config);
  });

  afterEach(async () => {
    if (agent['_isInitialized']) {
      await agent.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await agent.initialize();
      
      expect(agent.initializeCalled).toBe(true);
      expect(agent.status.status).toBe('idle');
      expect(agent['_isInitialized']).toBe(true);
    });

    it('should have correct initial status', () => {
      const status = agent.status;
      
      expect(status.id).toBe('test-agent-001');
      expect(status.status).toBe('offline');
      expect(status.activeTasks).toBe(0);
      expect(status.errors).toBe(0);
      expect(status.tasksCompleted).toBe(0);
    });
  });

  describe('Message Processing', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should process message successfully', async () => {
      const message: BaseMessage = {
        id: 'msg-001',
        timestamp: new Date(),
        channel: 'sms',
        direction: 'incoming',
        type: 'text',
        urgency: 'normal',
        content: 'Hello, test message',
      };

      const context: AgentContext = {
        sessionId: 'session-001',
        userId: 'user-001',
        conversationHistory: [],
        userPreferences: {},
        activeProjects: [],
        recentDecisions: [],
        contextWindow: 50,
        timestamp: new Date(),
      };

      const response = await agent.processMessage(message, context);

      expect(agent.processMessageCalled).toBe(true);
      expect(response.success).toBe(true);
      expect(response.data.response).toBe('Processed message: Hello, test message');
      expect(agent.memory.contextWindow).toContain(message);
    });

    it('should handle processing errors gracefully', async () => {
      // Override the onProcessMessage to throw an error
      agent['onProcessMessage'] = async () => {
        throw new Error('Processing failed');
      };

      const message: BaseMessage = {
        id: 'msg-002',
        timestamp: new Date(),
        channel: 'sms',
        direction: 'incoming',
        type: 'text',
        urgency: 'normal',
        content: 'Error message',
      };

      const context: AgentContext = {
        sessionId: 'session-001',
        userId: 'user-001',
        conversationHistory: [],
        userPreferences: {},
        activeProjects: [],
        recentDecisions: [],
        contextWindow: 50,
        timestamp: new Date(),
      };

      const response = await agent.processMessage(message, context);

      expect(response.success).toBe(false);
      expect(response.error).toBe('Processing failed');
      expect(agent.status.errors).toBe(1);
    });

    it('should not process message when not initialized', async () => {
      const message: BaseMessage = {
        id: 'msg-003',
        timestamp: new Date(),
        channel: 'sms',
        direction: 'incoming',
        type: 'text',
        urgency: 'normal',
        content: 'Test message',
      };

      const context: AgentContext = {
        sessionId: 'session-001',
        userId: 'user-001',
        conversationHistory: [],
        userPreferences: {},
        activeProjects: [],
        recentDecisions: [],
        contextWindow: 50,
        timestamp: new Date(),
      };

      await expect(agent.processMessage(message, context)).rejects.toThrow(
        'Agent test-agent-001 is not initialized'
      );
    });
  });

  describe('Task Management', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should assign and complete task successfully', async () => {
      const task: Task = {
        id: 'task-001',
        type: 'test-task',
        priority: 'normal',
        status: 'pending',
        input: { data: 'test input' },
        createdAt: new Date(),
      };

      await agent.assignTask(task);

      expect(agent.taskAssignedCalled).toBe(true);
      expect(task.status).toBe('in_progress');
      expect(task.assignedAgent).toBe('test-agent-001');
      expect(agent.status.activeTasks).toBe(1);

      // Wait for task completion
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(agent.status.activeTasks).toBe(0);
      expect(agent.status.tasksCompleted).toBe(1);
    });

    it('should not assign task if agent cannot handle it', async () => {
      const task: Task = {
        id: 'task-002',
        type: 'unsupported-task',
        priority: 'normal',
        status: 'pending',
        input: { data: 'test input' },
        createdAt: new Date(),
        metadata: {
          requiredCapabilities: ['unsupported-capability'],
        },
      };

      await expect(agent.assignTask(task)).rejects.toThrow(
        'Agent test-agent-001 cannot handle task task-002'
      );
    });

    it('should not assign task if at max capacity', async () => {
      // Set max concurrent tasks to 1
      agent.config.maxConcurrentTasks = 1;

      const task1: Task = {
        id: 'task-003',
        type: 'test-task',
        priority: 'normal',
        status: 'pending',
        input: { data: 'test input 1' },
        createdAt: new Date(),
      };

      const task2: Task = {
        id: 'task-004',
        type: 'test-task',
        priority: 'normal',
        status: 'pending',
        input: { data: 'test input 2' },
        createdAt: new Date(),
      };

      await agent.assignTask(task1);
      
      await expect(agent.assignTask(task2)).rejects.toThrow(
        'Agent test-agent-001 is at maximum capacity'
      );
    });
  });

  describe('Capabilities', () => {
    it('should return correct capabilities', () => {
      const capabilities = agent.getCapabilities();
      
      expect(capabilities).toHaveLength(1);
      expect(capabilities[0].name).toBe('text-processing');
      expect(capabilities[0].inputTypes).toContain('text');
      expect(capabilities[0].outputTypes).toContain('text');
    });

    it('should correctly determine if it can handle a task', () => {
      const supportedTask: Task = {
        id: 'task-005',
        type: 'supported-task',
        priority: 'normal',
        status: 'pending',
        input: {},
        createdAt: new Date(),
        metadata: {
          requiredCapabilities: ['text-processing'],
        },
      };

      const unsupportedTask: Task = {
        id: 'task-006',
        type: 'unsupported-task',
        priority: 'normal',
        status: 'pending',
        input: {},
        createdAt: new Date(),
        metadata: {
          requiredCapabilities: ['image-processing'],
        },
      };

      expect(agent.canHandle(supportedTask)).toBe(true);
      expect(agent.canHandle(unsupportedTask)).toBe(false);
    });
  });

  describe('Shutdown', () => {
    it('should shutdown successfully', async () => {
      await agent.initialize();
      await agent.shutdown();
      
      expect(agent.shutdownCalled).toBe(true);
      expect(agent.status.status).toBe('offline');
      expect(agent['_isInitialized']).toBe(false);
    });
  });
});