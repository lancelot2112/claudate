import { PersonalAssistantAgent } from '../../../src/agents/personal-assistant/PersonalAssistantAgent';
import { AgentConfig, AgentContext } from '../../../src/types/Agent';
import { BaseMessage } from '../../../src/types/common';

// Mock the memory manager
jest.mock('../../../src/agents/base/Memory', () => ({
  agentMemoryManager: {
    isReady: jest.fn(() => true),
    connect: jest.fn(),
    addToContextWindow: jest.fn(),
    storeShortTerm: jest.fn(),
  },
}));

// Mock the config loader
jest.mock('../../../src/utils/config', () => ({
  loadPrivateConfig: jest.fn(() => ({
    communication: {
      preferences: {
        briefingStyle: 'bullet-points-max-3',
        communicationHours: {
          start: '09:00',
          end: '17:00',
          timezone: 'America/New_York',
        },
      },
      channels: {
        sms: {
          enabled: true,
          useFor: ['critical', 'urgent'],
        },
        email: {
          enabled: true,
          useFor: ['normal', 'low'],
        },
      },
    },
  })),
}));

describe('PersonalAssistantAgent', () => {
  let agent: PersonalAssistantAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      id: 'pa-agent-001',
      type: 'personal-assistant',
      name: 'Personal Assistant',
      description: 'Executive personal assistant agent',
      capabilities: [
        {
          name: 'message-routing',
          description: 'Route messages to appropriate agents',
          inputTypes: ['text', 'image'],
          outputTypes: ['text'],
        },
        {
          name: 'executive-briefing',
          description: 'Generate executive summaries',
          inputTypes: ['text'],
          outputTypes: ['text'],
        },
      ],
      maxConcurrentTasks: 10,
      timeout: 30000,
      retryAttempts: 3,
      priority: 10,
      enabled: true,
    };

    agent = new PersonalAssistantAgent(config);
  });

  afterEach(async () => {
    if (agent['_isInitialized']) {
      await agent.shutdown();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await agent.initialize();
      
      expect(agent.status.status).toBe('idle');
      expect(agent['_isInitialized']).toBe(true);
    });
  });

  describe('Message Processing', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should process general inquiry message', async () => {
      const message: BaseMessage = {
        id: 'msg-001',
        timestamp: new Date(),
        channel: 'sms',
        direction: 'incoming',
        type: 'text',
        urgency: 'normal',
        content: 'How is the project going?',
      };

      const context: AgentContext = {
        sessionId: 'session-001',
        userId: 'user-001',
        conversationHistory: [],
        userPreferences: {},
        activeProjects: ['project-alpha'],
        recentDecisions: [],
        contextWindow: 50,
        timestamp: new Date(),
      };

      const response = await agent.processMessage(message, context);

      expect(response.success).toBe(true);
      expect(response.data.text).toContain('•');
      expect(response.data.routingRequired).toBe(false);
    });

    it('should detect and route technical requests', async () => {
      const message: BaseMessage = {
        id: 'msg-002',
        timestamp: new Date(),
        channel: 'sms',
        direction: 'incoming',
        type: 'text',
        urgency: 'normal',
        content: 'Can you debug the authentication code?',
      };

      const context: AgentContext = {
        sessionId: 'session-002',
        userId: 'user-001',
        conversationHistory: [],
        userPreferences: {},
        activeProjects: [],
        recentDecisions: [],
        contextWindow: 50,
        timestamp: new Date(),
      };

      const response = await agent.processMessage(message, context);

      expect(response.success).toBe(true);
      expect(response.data.routingRequired).toBe(true);
      expect(response.metadata.routing.targetAgent).toBe('claude-execution');
      expect(response.metadata.routing.requiredCapabilities).toContain('coding');
    });

    it('should detect and route strategic requests', async () => {
      const message: BaseMessage = {
        id: 'msg-003',
        timestamp: new Date(),
        channel: 'sms',
        direction: 'incoming',
        type: 'text',
        urgency: 'normal',
        content: 'We need to plan the architecture for the new feature',
      };

      const context: AgentContext = {
        sessionId: 'session-003',
        userId: 'user-001',
        conversationHistory: [],
        userPreferences: {},
        activeProjects: [],
        recentDecisions: [],
        contextWindow: 50,
        timestamp: new Date(),
      };

      const response = await agent.processMessage(message, context);

      expect(response.success).toBe(true);
      expect(response.data.routingRequired).toBe(true);
      expect(response.metadata.routing.targetAgent).toBe('gemini-strategic');
      expect(response.metadata.routing.requiredCapabilities).toContain('planning');
    });

    it('should handle urgent messages appropriately', async () => {
      const message: BaseMessage = {
        id: 'msg-004',
        timestamp: new Date(),
        channel: 'sms',
        direction: 'incoming',
        type: 'text',
        urgency: 'critical',
        content: 'URGENT: Production system is down!',
      };

      const context: AgentContext = {
        sessionId: 'session-004',
        userId: 'user-001',
        conversationHistory: [],
        userPreferences: {},
        activeProjects: [],
        recentDecisions: [],
        contextWindow: 50,
        timestamp: new Date(),
      };

      const response = await agent.processMessage(message, context);

      expect(response.success).toBe(true);
      expect(response.data.text).toContain('🚨 URGENT');
      expect(response.data.actions).toContain('escalate_urgency');
      expect(response.metadata.executiveBrief).toBeDefined();
      expect(response.metadata.executiveBrief.urgency).toBe('critical');
    });

    it('should format responses as executive briefs', async () => {
      const message: BaseMessage = {
        id: 'msg-005',
        timestamp: new Date(),
        channel: 'sms',
        direction: 'incoming',
        type: 'text',
        urgency: 'normal',
        content: 'Status update on all projects please',
      };

      const context: AgentContext = {
        sessionId: 'session-005',
        userId: 'user-001',
        conversationHistory: [],
        userPreferences: {},
        activeProjects: ['project-alpha', 'project-beta'],
        recentDecisions: [],
        contextWindow: 50,
        timestamp: new Date(),
      };

      const response = await agent.processMessage(message, context);

      expect(response.success).toBe(true);
      
      // Should be formatted as bullet points
      const bullets = response.data.text.split('\n').filter((line: string) => line.startsWith('•'));
      expect(bullets.length).toBeGreaterThan(0);
      expect(bullets.length).toBeLessThanOrEqual(3); // Max 3 bullet points
    });
  });

  describe('Task Handling', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('should handle executive brief generation task', async () => {
      const task = {
        id: 'task-001',
        type: 'generate_executive_brief',
        priority: 'normal' as const,
        status: 'pending' as const,
        input: {
          messages: [
            {
              id: 'msg-1',
              content: 'Project update',
              channel: 'email',
              urgency: 'normal',
            },
            {
              id: 'msg-2',
              content: 'Urgent issue',
              channel: 'sms',
              urgency: 'critical',
            },
          ],
          timeframe: 'last 24 hours',
        },
        createdAt: new Date(),
      };

      await agent.assignTask(task);

      // Wait for task completion
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(agent.status.tasksCompleted).toBe(1);
    });

    it('should handle message routing task', async () => {
      const task = {
        id: 'task-002',
        type: 'route_message',
        priority: 'normal' as const,
        status: 'pending' as const,
        input: {
          message: {
            id: 'msg-001',
            content: 'Debug the API',
            channel: 'sms',
          },
          targetAgent: 'claude-execution',
        },
        createdAt: new Date(),
      };

      await agent.assignTask(task);

      // Wait for task completion
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(agent.status.tasksCompleted).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should load user configuration correctly', async () => {
      await agent.initialize();
      
      // Configuration should be loaded from mock
      expect(agent['userConfig']).toBeDefined();
      expect(agent['userConfig'].communication.preferences.briefingStyle).toBe('bullet-points-max-3');
    });

    it('should respect communication preferences', async () => {
      await agent.initialize();
      
      // Communication preferences should be loaded
      expect(agent['communicationPreferences']).toBeDefined();
      expect(agent['communicationPreferences'].length).toBeGreaterThan(0);
    });
  });
});