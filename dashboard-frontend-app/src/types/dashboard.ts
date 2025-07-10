// Dashboard API types
export interface AgentStatus {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'busy' | 'error';
  health: {
    cpu: number;
    memory: number;
    responseTime: number;
  };
  capabilities: string[];
  currentTask?: {
    id: string;
    type: string;
    progress: number;
    startedAt: string;
  };
  lastUpdated: string;
}

export interface ChannelStatus {
  id: string;
  name: string;
  type: 'sms' | 'mms' | 'google-chat' | 'email' | 'webhook';
  status: 'connected' | 'disconnected' | 'error' | 'degraded';
  health: {
    connectivity: boolean;
    latency: number;
    errorRate: number;
  };
  configuration: {
    endpoint?: string;
    provider?: string;
    version?: string;
  };
  lastChecked: string;
}

export interface TaskInfo {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  assignedAgent?: string;
  progress: number;
  estimatedCompletion?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  metadata: {
    description: string;
    requester: string;
    dependencies?: string[];
    output?: Record<string, unknown>;
    error?: string;
  };
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical';
  components: {
    database: 'healthy' | 'degraded' | 'critical';
    cache: 'healthy' | 'degraded' | 'critical';
    agents: 'healthy' | 'degraded' | 'critical';
    channels: 'healthy' | 'degraded' | 'critical';
  };
  metrics: {
    uptime: number;
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  alerts: Array<{
    id: string;
    level: 'warning' | 'critical';
    component: string;
    message: string;
    timestamp: string;
  }>;
}

export interface DashboardSnapshot {
  id: string;
  dashboardId: string;
  timestamp: string;
  metrics: Record<string, unknown>[];
  charts: Record<string, unknown>[];
  metadata: {
    generatedBy: string;
    version: string;
    performance: {
      generationTime: number;
      totalSize: number;
    };
  };
}

export interface TaskStatistics {
  byStatus: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };
  performance: {
    completionRate: number;
    throughput: number;
    averageProcessingTime: number;
  };
  trends: {
    hourly: Array<{
      timestamp: string;
      completed: number;
      failed: number;
    }>;
    daily: Array<{
      timestamp: string;
      completed: number;
      failed: number;
    }>;
  };
}

export interface AgentMetrics {
  performance: {
    tasksCompleted: number;
    averageResponseTime: number;
    successRate: number;
  };
  health: {
    cpu: number;
    memory: number;
    uptime: number;
  };
}

export interface ChannelMetrics {
  performance: {
    messagesProcessed: number;
    averageLatency: number;
    errorRate: number;
  };
  connectivity: {
    status: boolean;
    lastChecked: string;
    uptime: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'agent_status' | 'channel_status' | 'task_update' | 'system_metric' | 'alert';
  data: Record<string, unknown>;
  timestamp: string;
}