/**
 * Test Helper Functions for AgentContext and related types
 * 
 * Provides factory functions to create properly structured test objects
 * that match the AgentContext interface requirements.
 */

import { AgentContext, AgentDecision } from '../../src/types/Agent';
import { BaseMessage } from '../../src/types/common';

export interface MockAgentContextOptions {
  userId?: string;
  sessionId?: string;
  task?: any;
  currentTask?: any;
  previousMessages?: BaseMessage[];
  conversationHistory?: BaseMessage[];
  contextWindow?: number;
  recentDecisions?: AgentDecision[];
  activeProjects?: any[];
  userPreferences?: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp?: Date;
}

/**
 * Creates a properly structured AgentContext for testing
 */
export function createMockAgentContext(options: MockAgentContextOptions = {}): AgentContext {
  return {
    userId: options.userId || 'test-user',
    sessionId: options.sessionId || 'test-session',
    task: options.task || 'test task',
    currentTask: options.currentTask,
    previousMessages: options.previousMessages,
    conversationHistory: options.conversationHistory || [],
    contextWindow: options.contextWindow || 4000,
    recentDecisions: options.recentDecisions || [],
    activeProjects: options.activeProjects || [],
    userPreferences: options.userPreferences || {
      communicationStyle: 'executive',
      responseFormat: 'brief',
      preferredChannels: ['sms', 'email']
    },
    metadata: options.metadata || {},
    timestamp: options.timestamp || new Date()
  };
}

/**
 * Creates a mock BaseMessage for testing
 */
export function createMockMessage(options: {
  type?: 'text' | 'image' | 'audio' | 'video' | 'file' | 'chart' | 'media';
  urgency?: 'critical' | 'high' | 'normal' | 'low';
  content?: string;
  sender?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
} = {}): BaseMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: options.timestamp || new Date(),
    type: options.type || 'text',
    urgency: options.urgency || 'normal',
    content: options.content || 'Test message content',
    sender: options.sender || 'test-user',
    metadata: options.metadata || {}
  };
}

/**
 * Creates a mock AgentDecision for testing
 */
export function createMockDecision(options: {
  context?: string;
  decision?: string;
  reasoning?: string;
  confidence?: number;
  outcome?: 'successful' | 'failed' | 'pending';
  metadata?: Record<string, any>;
} = {}): AgentDecision {
  return {
    id: `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    context: options.context || 'Test decision context',
    decision: options.decision || 'Test decision',
    reasoning: options.reasoning || 'Test reasoning for decision',
    confidence: options.confidence || 0.8,
    outcome: options.outcome,
    metadata: options.metadata
  };
}

/**
 * Creates a batch of AgentContext objects for testing coordination scenarios
 */
export function createMockContextBatch(count: number, baseOptions: MockAgentContextOptions = {}): AgentContext[] {
  return Array.from({ length: count }, (_, index) => 
    createMockAgentContext({
      ...baseOptions,
      userId: baseOptions.userId || `user-${index + 1}`,
      sessionId: baseOptions.sessionId || `session-${index + 1}`,
      task: baseOptions.task || `Task ${index + 1}`
    })
  );
}

/**
 * Creates a comprehensive AgentContext with rich conversation history for integration testing
 */
export function createRichMockAgentContext(options: MockAgentContextOptions = {}): AgentContext {
  const conversationHistory = options.conversationHistory || [
    createMockMessage({ sender: 'user', content: 'Hello, I need help with a technical issue' }),
    createMockMessage({ sender: 'assistant', content: 'I can help you with that. What specific issue are you facing?' }),
    createMockMessage({ sender: 'user', content: options.task?.toString() || 'The login system is not working properly' })
  ];

  const recentDecisions = options.recentDecisions || [
    createMockDecision({
      context: 'User reported login issue',
      decision: 'Route to technical support agent',
      reasoning: 'Technical issue requires specialized debugging expertise',
      confidence: 0.9,
      outcome: 'pending'
    })
  ];

  const activeProjects = options.activeProjects || [
    {
      id: 'project-auth-fix',
      name: 'Authentication System Fix',
      status: 'in_progress',
      priority: 'high',
      assignedAgents: ['claude-execution']
    }
  ];

  return createMockAgentContext({
    ...options,
    conversationHistory,
    recentDecisions,
    activeProjects,
    userPreferences: {
      communicationStyle: 'executive',
      responseFormat: 'brief',
      preferredChannels: ['sms', 'email'],
      urgencyThreshold: 'high',
      workingHours: '9am-6pm EST',
      ...options.userPreferences
    }
  });
}

/**
 * Helper to create context for specific test scenarios
 */
export const TestScenarios = {
  /**
   * Context for testing urgent message handling
   */
  urgentIssue: (): AgentContext => createRichMockAgentContext({
    task: 'URGENT: Production system is down, customers cannot access the platform',
    userPreferences: {
      communicationStyle: 'executive',
      responseFormat: 'brief',
      urgencyThreshold: 'high'
    },
    recentDecisions: [
      createMockDecision({
        context: 'Critical system outage detected',
        decision: 'Escalate to technical lead immediately',
        reasoning: 'System outage affects all customers, requires immediate attention',
        confidence: 0.95,
        outcome: 'pending'
      })
    ]
  }),

  /**
   * Context for testing routine task handling
   */
  routineTask: (): AgentContext => createMockAgentContext({
    task: 'Please review the quarterly reports and provide a summary',
    userPreferences: {
      communicationStyle: 'detailed',
      responseFormat: 'comprehensive',
      urgencyThreshold: 'medium'
    }
  }),

  /**
   * Context for testing code-related requests
   */
  codingTask: (): AgentContext => createRichMockAgentContext({
    task: 'Implement a new authentication feature using OAuth 2.0',
    activeProjects: [
      {
        id: 'oauth-implementation',
        name: 'OAuth 2.0 Integration',
        status: 'planning',
        priority: 'medium',
        technologies: ['Node.js', 'OAuth 2.0', 'JWT']
      }
    ]
  }),

  /**
   * Context for testing strategic planning requests
   */
  strategicTask: (): AgentContext => createRichMockAgentContext({
    task: 'Develop a roadmap for the next quarter including new features and technical debt reduction',
    activeProjects: [
      {
        id: 'q4-planning',
        name: 'Q4 Strategic Planning',
        status: 'drafting',
        priority: 'high',
        stakeholders: ['engineering', 'product', 'executive']
      }
    ],
    userPreferences: {
      communicationStyle: 'strategic',
      responseFormat: 'executive_summary',
      preferredChannels: ['email', 'google_chat']
    }
  })
};