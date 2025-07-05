import { PersonalAssistantAgent } from '../../../src/agents/personal-assistant/PersonalAssistantAgent';
import { AgentConfig, AgentContext } from '../../../src/types/Agent';

// Mock the dependencies
jest.mock('../../../src/agents/base/Memory', () => ({
  agentMemoryManager: {
    isReady: jest.fn(() => true),
    connect: jest.fn(),
    addToContextWindow: jest.fn(),
  },
}));

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
  loadPrivateConfig: jest.fn(() => ({})),
}));

describe('PersonalAssistantAgent', () => {
  let agent: PersonalAssistantAgent;
  let config: AgentConfig;

  beforeEach(() => {
    config = {
      type: 'personal-assistant',
      name: 'Personal Assistant',
      capabilities: ['message-routing', 'executive-briefing'],
      maxConcurrentTasks: 10,
      priority: 10,
      enabled: true,
    };

    agent = new PersonalAssistantAgent(config);
  });

  afterEach(async () => {
    await agent.shutdown();
  });

  describe('Basic Functionality', () => {
    it('should initialize successfully', async () => {
      await agent.initialize();
      expect(agent.getStatus()).toBe('idle');
    });

    it('should have correct basic properties', () => {
      expect(agent.name).toBe('Personal Assistant');
      expect(agent.type).toBe('personal-assistant');
      expect(agent.id).toBeDefined();
    });

    it('should return capabilities', async () => {
      const capabilities = await agent.getCapabilities();
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.length).toBeGreaterThan(0);
    });

    it('should execute task', async () => {
      await agent.initialize();
      
      const context: AgentContext = {
        sessionId: 'test-session',
        userId: 'test-user',
        task: { 
          type: 'message-routing',
          input: 'test message'
        },
        conversationHistory: [],
        userPreferences: {},
        activeProjects: [],
        recentDecisions: [],
        contextWindow: 1000,
        timestamp: new Date(),
        metadata: {}
      };

      const result = await agent.executeTask(context);
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });
  });
});
