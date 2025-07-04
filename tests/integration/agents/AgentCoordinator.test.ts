import { AgentCoordinator } from '../../../src/agents/coordination/AgentCoordinator.js';
import { BaseAgent } from '../../../src/agents/base/Agent.js';
import { AgentContext, AgentResult, AgentConfig } from '../../../src/types/Agent.js';
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock agent for testing
class MockAgent extends BaseAgent {
  public mockExecuteTask: jest.Mock;

  constructor(config: AgentConfig) {
    super(config);
    this.mockExecuteTask = jest.fn();
  }

  public async executeTask(context: AgentContext): Promise<AgentResult> {
    return this.mockExecuteTask(context);
  }

  public async getCapabilities(): Promise<string[]> {
    return this.capabilities || ['mock_capability'];
  }
}

describe('AgentCoordinator Integration Tests', () => {
  let coordinator: AgentCoordinator;
  let mockAgent1: MockAgent;
  let mockAgent2: MockAgent;
  let mockAgent3: MockAgent;

  beforeEach(() => {
    coordinator = new AgentCoordinator();

    // Create mock agents with different capabilities
    mockAgent1 = new MockAgent({
      name: 'MockAgent1',
      type: 'execution',
      capabilities: ['coding', 'javascript', 'testing']
    });

    mockAgent2 = new MockAgent({
      name: 'MockAgent2',
      type: 'strategic',
      capabilities: ['planning', 'architecture', 'strategic_analysis']
    });

    mockAgent3 = new MockAgent({
      name: 'MockAgent3',
      type: 'execution',
      capabilities: ['tool_execution', 'deployment', 'npm']
    });

    // Setup default successful responses
    mockAgent1.mockExecuteTask.mockResolvedValue({
      success: true,
      agentId: mockAgent1.id,
      timestamp: Date.now()
    });

    mockAgent2.mockExecuteTask.mockResolvedValue({
      success: true,
      agentId: mockAgent2.id,
      timestamp: Date.now()
    });

    mockAgent3.mockExecuteTask.mockResolvedValue({
      success: true,
      agentId: mockAgent3.id,
      timestamp: Date.now()
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('agent registration', () => {
    test('should register agents successfully', () => {
      coordinator.registerAgent(mockAgent1);
      coordinator.registerAgent(mockAgent2);

      const agentStatus = coordinator.getAgentStatus();
      expect(agentStatus).toHaveLength(2);
      
      const agent1Status = agentStatus.find(s => s.agentId === mockAgent1.id);
      const agent2Status = agentStatus.find(s => s.agentId === mockAgent2.id);
      
      expect(agent1Status).toBeDefined();
      expect(agent1Status?.status.availability).toBe('available');
      expect(agent2Status).toBeDefined();
      expect(agent2Status?.status.availability).toBe('available');
    });

    test('should emit agent-registered event', (done) => {
      coordinator.on('agent-registered', (event) => {
        expect(event.agentId).toBe(mockAgent1.id);
        expect(event.agentName).toBe('MockAgent1');
        done();
      });

      coordinator.registerAgent(mockAgent1);
    });

    test('should unregister agents', () => {
      coordinator.registerAgent(mockAgent1);
      coordinator.registerAgent(mockAgent2);
      
      coordinator.unregisterAgent(mockAgent1.id);
      
      const agentStatus = coordinator.getAgentStatus();
      expect(agentStatus).toHaveLength(1);
      expect(agentStatus[0].agentId).toBe(mockAgent2.id);
    });
  });

  describe('task submission and assignment', () => {
    beforeEach(() => {
      coordinator.registerAgent(mockAgent1);
      coordinator.registerAgent(mockAgent2);
      coordinator.registerAgent(mockAgent3);
    });

    test('should submit and assign task to appropriate agent', async () => {
      const taskId = await coordinator.submitTask(
        ['coding', 'javascript'],
        {
          userId: 'user1',
          sessionId: 'session1',
          task: 'Write a JavaScript function',
          timestamp: Date.now(),
          metadata: {}
        },
        'medium'
      );

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe('string');

      // Wait for task assignment and execution
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for task processor

      const taskStatus = coordinator.getTaskStatus(taskId);
      expect(taskStatus).toBeDefined();
      expect(taskStatus?.assignedAgent).toBe(mockAgent1.id); // Should match coding capability
      expect(taskStatus?.status).toBe('completed');
    });

    test('should prioritize tasks correctly', async () => {
      const taskIds = await Promise.all([
        coordinator.submitTask(['coding'], { userId: 'user1', sessionId: 'session1', task: 'Low priority task', timestamp: Date.now(), metadata: {} }, 'low'),
        coordinator.submitTask(['coding'], { userId: 'user1', sessionId: 'session1', task: 'Critical task', timestamp: Date.now(), metadata: {} }, 'critical'),
        coordinator.submitTask(['coding'], { userId: 'user1', sessionId: 'session1', task: 'Medium priority task', timestamp: Date.now(), metadata: {} }, 'medium')
      ]);

      // Wait for task processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Critical task should be processed first
      const criticalTask = coordinator.getTaskStatus(taskIds[1]);
      expect(criticalTask?.status).toBe('completed');
    });

    test('should handle no suitable agent scenario', async () => {
      const taskId = await coordinator.submitTask(
        ['unknown_capability'],
        {
          userId: 'user1',
          sessionId: 'session1',
          task: 'Task requiring unknown capability',
          timestamp: Date.now(),
          metadata: {}
        }
      );

      // Wait for task processing attempt
      await new Promise(resolve => setTimeout(resolve, 1100));

      const taskStatus = coordinator.getTaskStatus(taskId);
      expect(taskStatus?.status).toBe('pending'); // Should remain pending
      expect(taskStatus?.assignedAgent).toBeUndefined();
    });

    test('should emit task events', (done) => {
      let eventsReceived = 0;
      const expectedEvents = ['task-submitted', 'task-assigned', 'task-completed'];
      
      expectedEvents.forEach(eventName => {
        coordinator.on(eventName, () => {
          eventsReceived++;
          if (eventsReceived === expectedEvents.length) {
            done();
          }
        });
      });

      coordinator.submitTask(
        ['coding'],
        {
          userId: 'user1',
          sessionId: 'session1',
          task: 'Test task',
          timestamp: Date.now(),
          metadata: {}
        }
      );
    });
  });

  describe('agent selection algorithm', () => {
    beforeEach(() => {
      coordinator.registerAgent(mockAgent1);
      coordinator.registerAgent(mockAgent2);
      coordinator.registerAgent(mockAgent3);
    });

    test('should select agent based on capability match', async () => {
      const taskId = await coordinator.submitTask(
        ['planning', 'strategic_analysis'],
        {
          userId: 'user1',
          sessionId: 'session1',
          task: 'Create strategic plan',
          timestamp: Date.now(),
          metadata: {}
        }
      );

      await new Promise(resolve => setTimeout(resolve, 1100));

      const taskStatus = coordinator.getTaskStatus(taskId);
      expect(taskStatus?.assignedAgent).toBe(mockAgent2.id); // Strategic agent
    });

    test('should handle agent busy scenario', async () => {
      // Make first agent busy
      mockAgent1.updateStatus('processing');
      
      const taskId = await coordinator.submitTask(
        ['coding'],
        {
          userId: 'user1',
          sessionId: 'session1',
          task: 'Write code',
          timestamp: Date.now(),
          metadata: {}
        }
      );

      await new Promise(resolve => setTimeout(resolve, 1100));

      const taskStatus = coordinator.getTaskStatus(taskId);
      // Should remain pending since the only coding agent is busy
      expect(taskStatus?.status).toBe('pending');
    });
  });

  describe('task handoff', () => {
    beforeEach(() => {
      coordinator.registerAgent(mockAgent1);
      coordinator.registerAgent(mockAgent2);
      coordinator.registerAgent(mockAgent3);
    });

    test('should handle agent handoff request', (done) => {
      coordinator.on('task-handoff', (event) => {
        expect(event.fromAgent).toBe(mockAgent1.id);
        expect(event.toAgent).toBeDefined();
        expect(event.reason).toBeDefined();
        done();
      });

      // Simulate handoff request
      mockAgent1.emit('handoff-request', {
        taskId: 'test-task',
        fromAgent: mockAgent1.id,
        reason: 'Need specialized capability',
        requiredCapabilities: ['planning'],
        context: {
          userId: 'user1',
          sessionId: 'session1',
          task: 'Create plan',
          timestamp: Date.now(),
          metadata: {}
        },
        urgency: 'medium'
      });
    });
  });

  describe('error handling and resilience', () => {
    beforeEach(() => {
      coordinator.registerAgent(mockAgent1);
      coordinator.registerAgent(mockAgent2);
    });

    test('should handle agent execution failure', async () => {
      // Make agent fail
      mockAgent1.mockExecuteTask.mockRejectedValue(new Error('Agent execution failed'));

      const taskId = await coordinator.submitTask(
        ['coding'],
        {
          userId: 'user1',
          sessionId: 'session1',
          task: 'Task that will fail',
          timestamp: Date.now(),
          metadata: {}
        }
      );

      await new Promise(resolve => setTimeout(resolve, 1100));

      const taskStatus = coordinator.getTaskStatus(taskId);
      expect(taskStatus?.status).toBe('failed');
      expect(taskStatus?.result?.success).toBe(false);
    });

    test('should retry failed tasks when appropriate', async () => {
      // First call fails, second succeeds
      mockAgent1.mockExecuteTask
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          success: true,
          agentId: mockAgent1.id,
          timestamp: Date.now()
        });

      const taskId = await coordinator.submitTask(
        ['coding'],
        {
          userId: 'user1',
          sessionId: 'session1',
          task: 'Task with retry',
          timestamp: Date.now(),
          metadata: {}
        },
        'high' // High priority for retry
      );

      // Wait longer for retry mechanism
      await new Promise(resolve => setTimeout(resolve, 2500));

      const taskStatus = coordinator.getTaskStatus(taskId);
      expect(taskStatus?.status).toBe('completed');
    });

    test('should handle agent going offline', () => {
      coordinator.registerAgent(mockAgent1);
      
      // Simulate agent going offline
      coordinator.unregisterAgent(mockAgent1.id);
      
      const agentStatus = coordinator.getAgentStatus();
      const offlineAgent = agentStatus.find(s => s.agentId === mockAgent1.id);
      expect(offlineAgent).toBeUndefined();
    });
  });

  describe('performance monitoring', () => {
    beforeEach(() => {
      coordinator.registerAgent(mockAgent1);
      coordinator.registerAgent(mockAgent2);
    });

    test('should track agent performance metrics', async () => {
      // Execute successful task
      const taskId = await coordinator.submitTask(
        ['coding'],
        {
          userId: 'user1',
          sessionId: 'session1',
          task: 'Performance test task',
          timestamp: Date.now(),
          metadata: {}
        }
      );

      await new Promise(resolve => setTimeout(resolve, 1100));

      const agentStatus = coordinator.getAgentStatus();
      const agent1Status = agentStatus.find(s => s.agentId === mockAgent1.id);
      
      expect(agent1Status?.status.performance.tasksCompleted).toBeGreaterThan(0);
      expect(agent1Status?.status.performance.successRate).toBeGreaterThan(0);
    });

    test('should update success rate on failures', async () => {
      // First task succeeds
      await coordinator.submitTask(['coding'], {
        userId: 'user1',
        sessionId: 'session1',
        task: 'Success task',
        timestamp: Date.now(),
        metadata: {}
      });

      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second task fails
      mockAgent1.mockExecuteTask.mockResolvedValueOnce({
        success: false,
        agentId: mockAgent1.id,
        timestamp: Date.now(),
        error: 'Task failed'
      });

      await coordinator.submitTask(['coding'], {
        userId: 'user1',
        sessionId: 'session1',
        task: 'Failure task',
        timestamp: Date.now(),
        metadata: {}
      });

      await new Promise(resolve => setTimeout(resolve, 1100));

      const agentStatus = coordinator.getAgentStatus();
      const agent1Status = agentStatus.find(s => s.agentId === mockAgent1.id);
      
      expect(agent1Status?.status.performance.tasksCompleted).toBe(2);
      expect(agent1Status?.status.performance.successRate).toBe(0.5); // 1 success out of 2 tasks
    });
  });

  describe('queue management', () => {
    beforeEach(() => {
      coordinator.registerAgent(mockAgent1);
    });

    test('should provide queue status', async () => {
      // Submit multiple tasks
      await Promise.all([
        coordinator.submitTask(['coding'], { userId: 'user1', sessionId: 'session1', task: 'Task 1', timestamp: Date.now(), metadata: {} }),
        coordinator.submitTask(['coding'], { userId: 'user1', sessionId: 'session1', task: 'Task 2', timestamp: Date.now(), metadata: {} }),
        coordinator.submitTask(['coding'], { userId: 'user1', sessionId: 'session1', task: 'Task 3', timestamp: Date.now(), metadata: {} })
      ]);

      const queueStatus = coordinator.getQueueStatus();
      expect(queueStatus.pending + queueStatus.inProgress + queueStatus.completed).toBeGreaterThan(0);
    });

    test('should provide all active tasks', async () => {
      const taskIds = await Promise.all([
        coordinator.submitTask(['coding'], { userId: 'user1', sessionId: 'session1', task: 'Task 1', timestamp: Date.now(), metadata: {} }),
        coordinator.submitTask(['coding'], { userId: 'user1', sessionId: 'session1', task: 'Task 2', timestamp: Date.now(), metadata: {} })
      ]);

      const activeTasks = coordinator.getAllActiveTasks();
      expect(activeTasks.length).toBeGreaterThanOrEqual(2);
      
      const taskId1Found = activeTasks.some(task => task.taskId === taskIds[0]);
      const taskId2Found = activeTasks.some(task => task.taskId === taskIds[1]);
      
      expect(taskId1Found).toBe(true);
      expect(taskId2Found).toBe(true);
    });
  });

  describe('edge cases', () => {
    test('should handle empty capability requirements', async () => {
      coordinator.registerAgent(mockAgent1);
      
      const taskId = await coordinator.submitTask(
        [],
        {
          userId: 'user1',
          sessionId: 'session1',
          task: 'Task with no specific requirements',
          timestamp: Date.now(),
          metadata: {}
        }
      );

      await new Promise(resolve => setTimeout(resolve, 1100));

      const taskStatus = coordinator.getTaskStatus(taskId);
      expect(taskStatus).toBeDefined();
      expect(taskStatus?.status).toBe('completed'); // Should still assign to some agent
    });

    test('should handle duplicate agent registration', () => {
      coordinator.registerAgent(mockAgent1);
      coordinator.registerAgent(mockAgent1); // Register same agent again
      
      const agentStatus = coordinator.getAgentStatus();
      // Should only have one entry for the agent
      const agent1Entries = agentStatus.filter(s => s.agentId === mockAgent1.id);
      expect(agent1Entries.length).toBe(1);
    });

    test('should handle task status query for non-existent task', () => {
      const taskStatus = coordinator.getTaskStatus('non-existent-task');
      expect(taskStatus).toBeUndefined();
    });
  });
});