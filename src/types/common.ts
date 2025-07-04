// Common types used throughout the Claudate framework

export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug';

export type AgentType = 'personal_assistant' | 'strategic' | 'execution';

export type CommunicationChannel = 'sms' | 'mms' | 'google-chat' | 'email' | 'voice' | 'video';

export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'file' | 'chart' | 'media';

export type UrgencyLevel = 'critical' | 'high' | 'normal' | 'low';

export type MessageDirection = 'incoming' | 'outgoing';

export interface BaseMessage {
  id: string;
  timestamp: Date;
  type: MessageType;
  urgency: UrgencyLevel;
  content: string;
  source?: string;
  recipient?: string;
  sender?: string;
  metadata?: Record<string, any>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  timezone: string;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  briefingStyle: 'bullet-points-max-3' | 'detailed' | 'summary';
  urgencyThreshold: UrgencyLevel;
  communicationHours: {
    start: string;
    end: string;
    timezone: string;
  };
  responseTime: {
    critical: string;
    high: string;
    normal: string;
    low: string;
  };
  channels: {
    [key in CommunicationChannel]?: {
      enabled: boolean;
      useFor: string[];
    };
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  environment: string;
  uptime: number;
  checks?: {
    database?: boolean;
    redis?: boolean;
    ai_services?: boolean;
    communication?: boolean;
  };
}

// Error types
export class ClaudateError extends Error {
  public statusCode: number;
  public code: string;
  public metadata?: Record<string, any>;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = 'ClaudateError';
    this.statusCode = statusCode;
    this.code = code;
    this.metadata = metadata;
  }
}

export class AgentError extends ClaudateError {
  constructor(message: string, agentId?: string, metadata?: Record<string, any>) {
    super(message, 500, 'AGENT_ERROR', { agentId, ...metadata });
    this.name = 'AgentError';
  }
}

export class CommunicationError extends ClaudateError {
  constructor(message: string, channel?: string, metadata?: Record<string, any>) {
    super(message, 500, 'COMMUNICATION_ERROR', { channel, ...metadata });
    this.name = 'CommunicationError';
  }
}

export class KnowledgeError extends ClaudateError {
  constructor(message: string, store?: string, metadata?: Record<string, any>) {
    super(message, 500, 'KNOWLEDGE_ERROR', { store, ...metadata });
    this.name = 'KnowledgeError';
  }
}

export class ContextError extends ClaudateError {
  constructor(message: string, sessionId?: string, metadata?: Record<string, any>) {
    super(message, 500, 'CONTEXT_ERROR', { sessionId, ...metadata });
    this.name = 'ContextError';
  }
}