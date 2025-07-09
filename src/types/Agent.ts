import { AgentType, BaseMessage, UrgencyLevel } from './common';

// Agent-specific types
export interface AgentCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  requiredServices?: string[];
}

export interface AgentConfig {
  name: string;
  type: AgentType;
  capabilities: string[];
  enabled: boolean;
  priority: number;
  maxConcurrentTasks: number;
}

export interface AgentStatus {
  id: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  activeTasks: number;
  lastActivity: Date;
  uptime: number;
  errors: number;
  tasksCompleted: number;
  averageResponseTime: number;
}

export interface Task {
  id: string;
  type: string;
  priority: UrgencyLevel;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  assignedAgent?: string;
  input: any;
  output?: any;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
  processingTime: number;
  confidence?: number;
}

export interface AgentMemory {
  shortTerm: Map<string, any>;
  mediumTerm: Map<string, any>;
  contextWindow: BaseMessage[];
  userPreferences: Record<string, any>;
  decisionHistory: AgentDecision[];
}

export interface AgentDecision {
  id: string;
  timestamp: Date;
  context: string;
  decision: string;
  reasoning: string;
  confidence: number;
  outcome?: 'successful' | 'failed' | 'pending';
  metadata?: Record<string, any>;
}

export interface AgentContext {
  sessionId: string;
  userId: string;
  task: any;
  currentTask?: any;
  previousMessages?: BaseMessage[];
  conversationHistory: BaseMessage[];
  contextWindow: number;
  recentDecisions: AgentDecision[];
  activeProjects: any[];
  userPreferences: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface AgentHandoff {
  fromAgent: string;
  toAgent: string;
  task: Task;
  context: AgentContext;
  reason: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Agent interfaces
export interface IAgent extends NodeJS.EventEmitter {
  readonly id: string;
  readonly type: AgentType;
  readonly config: AgentConfig;
  readonly status: AgentStatus;
  readonly memory: AgentMemory;

  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  processMessage(message: BaseMessage, context: AgentContext): Promise<AgentResponse>;
  assignTask(task: Task): Promise<void>;
  handoffTask(task: Task, targetAgent: string, reason: string): Promise<AgentHandoff>;
  updateContext(context: Partial<AgentContext>): void;
  getCapabilities(): string[];
  getStatus(): AgentStatus;
  canHandle(task: Task): boolean;
}

export interface IAgentRegistry {
  register(agent: IAgent): Promise<void>;
  unregister(agentId: string): Promise<void>;
  getAgent(agentId: string): IAgent | null;
  getAgentsByType(type: AgentType): IAgent[];
  getAllAgents(): IAgent[];
  getAvailableAgents(): IAgent[];
  findBestAgent(task: Task): IAgent | null;
  getAgentStatus(agentId: string): AgentStatus | null;
}

export interface IAgentMemoryManager {
  storeShortTerm(agentId: string, key: string, value: any, ttl?: number): Promise<void>;
  getShortTerm(agentId: string, key: string): Promise<any>;
  storeMediumTerm(agentId: string, key: string, value: any): Promise<void>;
  getMediumTerm(agentId: string, key: string): Promise<any>;
  storeContext(agentId: string, context: AgentContext): Promise<void>;
  getContext(agentId: string): Promise<AgentContext | null>;
  addToContextWindow(agentId: string, message: BaseMessage): Promise<void>;
  getContextWindow(agentId: string, limit?: number): Promise<BaseMessage[]>;
  clearMemory(agentId: string, type: 'short' | 'medium' | 'all'): Promise<void>;
}

// Personal Assistant specific types
export interface ExecutiveBrief {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  urgency: UrgencyLevel;
  actionItems?: string[];
  deadline?: Date;
  attachments?: string[];
  metadata?: Record<string, any>;
  
  // Missing properties for GoogleChatChannel
  threadId?: string;
  sections: BriefingSection[];
  actions: ActionItem[];
  priority: UrgencyLevel;
  timestamp: Date;
}

export interface BriefingSection {
  id: string;
  title: string;
  content: string;
  type: 'summary' | 'metrics' | 'insights' | 'recommendations' | 'risks';
  priority: number;
  metrics?: BriefingMetric[];
  chart?: BriefingChart;
  metadata?: Record<string, any>;
}

export interface BriefingMetric {
  name: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
  previousValue?: number | string;
}

export interface BriefingChart {
  type: 'line' | 'bar' | 'pie' | 'gauge';
  data: any[];
  config?: Record<string, any>;
  url?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: UrgencyLevel;
  dueDate?: Date;
  assignee?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  label?: string;
  actionId?: string;
  parameters?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CommunicationPreference {
  channel: string;
  urgency: UrgencyLevel[];
  timeWindows: {
    start: string;
    end: string;
    timezone: string;
  }[];
  formatPreferences: {
    maxBulletPoints: number;
    includeVisuals: boolean;
    includeActionItems: boolean;
  };
}

export interface RoutingDecision {
  targetAgent: string;
  reasoning: string;
  confidence: number;
  urgency: UrgencyLevel;
  estimatedProcessingTime: number;
  requiredCapabilities: string[];
}

export interface AgentResult {
  success: boolean;
  agentId: string;
  timestamp: number;
  error?: string;
  metadata?: Record<string, any>;
}