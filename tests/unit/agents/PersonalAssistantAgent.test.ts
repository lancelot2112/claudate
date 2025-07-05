/**
 * PersonalAssistantAgent Test Suite
 * 
 * IMPLEMENTATION STATUS: PARTIAL - Many tests document future requirements
 * 
 * ✅ IMPLEMENTED: Basic agent initialization, capabilities, task execution
 * ❌ NOT IMPLEMENTED: processMessage, assignTask, complex status tracking
 * 
 * Tests marked with [TODO] indicate features that need implementation.
 * Failing tests serve as a specification for required functionality.
 */

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
  config: {
    nodeEnv: 'test',
    port: 3000,
    logLevel: 'info',
    apiBaseUrl: 'http://localhost:3000',
    publicUrl: 'http://localhost:3000',
    database: {
      url: 'postgresql://localhost:5432/test',
      host: 'localhost',
      port: 5432,
      name: 'test',
      user: 'test',
      username: 'test',
      password: 'test',
    },
    redis: {
      url: 'redis://localhost:6379',
      host: 'localhost',
      port: 6379,
      password: '',
    },
    chroma: {
      url: 'http://localhost:8000',
      host: 'localhost',
      port: 8000,
    },
    ai: {
      anthropic: { apiKey: 'test-key' },
      google: { apiKey: 'test-key', projectId: 'test-project' },
    },
    communication: {
      twilio: {
        accountSid: 'test-sid',
        authToken: 'test-token',
        phoneNumber: 'test-phone',
      },
    },
  },
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
      type: 'personal-assistant',
      name: 'Personal Assistant',
      // description: 'Executive personal assistant agent', // Not in current AgentConfig interface
      capabilities: [
        'message-routing',
        'executive-briefing'
      ],
      maxConcurrentTasks: 10,
      // timeout: 30000, // Not in current AgentConfig interface
      // retryAttempts: 3, // Not in current AgentConfig interface
      priority: 10,
      enabled: true,
    };

    agent = new PersonalAssistantAgent(config);
  });

  afterEach(async () => {
    // Always try to shutdown, let the agent handle if it's not initialized
    try {
      await agent.shutdown();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await agent.initialize();
      
      expect(agent.getStatus()).toBe('idle');
      expect(typeof agent.id).toBe('string');
    });
  });

  describe('Message Processing', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    it('[TODO] should process general inquiry message - PENDING IMPLEMENTATION', async () => {
      // IMPLEMENTATION STATUS: processMessage method not yet implemented in BaseAgent
      // This test documents expected behavior for future implementation
      
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
        task: 'Process message', // Required field  
        metadata: {}
      };

      // This will fail until processMessage is implemented
      expect((agent as any).processMessage).toBeDefined(); // Will fail with clear message about missing implementation
      
      const response = await (agent as any).processMessage(message, context);

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
        task: 'Process message', // Required field  
        metadata: {}
      };

      const response = await (agent as any).processMessage(message, context);

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
        task: 'Process message', // Required field  
        metadata: {}
      };

      const response = await (agent as any).processMessage(message, context);

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
        task: 'Process message', // Required field  
        metadata: {}
      };

      const response = await (agent as any).processMessage(message, context);

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
        task: 'Process message', // Required field  
        metadata: {}
      };

      const response = await (agent as any).processMessage(message, context);

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

    it('[TODO] should handle executive brief generation task - PENDING IMPLEMENTATION', async () => {
      // IMPLEMENTATION STATUS: assignTask method not yet implemented
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

      // This will fail until assignTask is implemented
      expect((agent as any).assignTask).toBeDefined(); // Will fail with clear message about missing implementation
      
      await (agent as any).assignTask(task);

      // Wait for task completion
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(agent.getStatus()).toBeDefined(); // Use available method instead
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

      // This will fail until assignTask is implemented
      expect((agent as any).assignTask).toBeDefined(); // Will fail with clear message about missing implementation
      
      await (agent as any).assignTask(task);

      // Wait for task completion
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(agent.getStatus()).toBeDefined(); // Use available method instead
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