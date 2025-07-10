import { EventEmitter } from 'events';
import { agentRegistry } from '../../agents/base/AgentRegistry';
import { RealTimeDashboard, DashboardSnapshot, DashboardFactory } from '../../visual/dashboard/RealTimeDashboard';
import logger from '../../utils/logger';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

// Dashboard-specific types
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
    startedAt: Date;
  };
  lastUpdated: Date;
}

export interface AgentMetrics {
  agentId: string;
  performance: {
    responseTime: {
      current: number;
      average: number;
      min: number;
      max: number;
    };
    throughput: {
      messagesPerHour: number;
      tasksPerHour: number;
    };
    errorRate: {
      current: number;
      average: number;
    };
  };
  resourceUsage: {
    cpu: number;
    memory: number;
    networkIO: number;
  };
  taskMetrics: {
    completed: number;
    failed: number;
    averageDuration: number;
  };
  trends: Array<{
    timestamp: Date;
    value: number;
    metric: string;
  }>;
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
  lastChecked: Date;
}

export interface ChannelMetrics {
  channelId: string;
  messageVolume: {
    sent: number;
    received: number;
    failed: number;
    retried: number;
  };
  performance: {
    averageLatency: number;
    deliveryRate: number;
    errorRate: number;
  };
  usage: {
    hourly: Array<{ timestamp: Date; count: number }>;
    daily: Array<{ timestamp: Date; count: number }>;
    peakUsage: { timestamp: Date; count: number };
  };
}

export interface TaskInfo {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high';
  assignedAgent?: string;
  progress: number;
  estimatedCompletion?: Date;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  metadata: {
    description: string;
    requester: string;
    dependencies?: string[];
    output?: any;
    error?: string;
  };
}

export interface TaskStatistics {
  total: number;
  byStatus: Record<'pending' | 'processing' | 'completed' | 'failed', number>;
  byPriority: Record<'low' | 'medium' | 'high', number>;
  byAgent: Record<string, number>;
  performance: {
    averageDuration: number;
    completionRate: number;
    throughput: number;
  };
  trends: {
    hourly: Array<{ timestamp: Date; completed: number; failed: number }>;
    daily: Array<{ timestamp: Date; completed: number; failed: number }>;
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
    timestamp: Date;
  }>;
}

export interface DashboardUpdate {
  type: 'agent_status' | 'channel_status' | 'task_update' | 'system_metric' | 'alert';
  data: any;
  timestamp: Date;
}

export class DashboardManager extends EventEmitter {
  private static instance: DashboardManager;
  private realTimeDashboard: RealTimeDashboard;
  private updateSubscribers: Map<any, (update: DashboardUpdate) => void> = new Map();
  private metricsCache: Map<string, { data: any; timestamp: Date; ttl: number }> = new Map();
  private isInitialized: boolean = false;

  private constructor() {
    super();
    
    // Initialize with system health dashboard
    const config = DashboardFactory.createSystemHealthDashboard();
    this.realTimeDashboard = new RealTimeDashboard(config);
    
    this.setupEventListeners();
  }

  public static getInstance(): DashboardManager {
    if (!DashboardManager.instance) {
      DashboardManager.instance = new DashboardManager();
    }
    return DashboardManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await this.realTimeDashboard.start();
      this.startPeriodicUpdates();
      this.isInitialized = true;
      
      logger.info('DashboardManager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize DashboardManager', { error });
      throw error;
    }
  }

  private setupEventListeners(): void {
    // Listen to agent events
    agentRegistry.on('agentRegistered', (agent) => {
      this.broadcastUpdate({
        type: 'agent_status',
        data: { agentId: agent.id, status: 'online' },
        timestamp: new Date(),
      });
    });

    agentRegistry.on('agentUnregistered', (agentId) => {
      this.broadcastUpdate({
        type: 'agent_status',
        data: { agentId, status: 'offline' },
        timestamp: new Date(),
      });
    });

    // Listen to system events
    process.on('memoryUsage', () => {
      this.updateSystemMetrics();
    });
  }

  private startPeriodicUpdates(): void {
    // Update system metrics every 30 seconds
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000);

    // Update agent metrics every minute
    setInterval(() => {
      this.updateAgentMetrics();
    }, 60000);

    // Clear old cache entries every 5 minutes
    setInterval(() => {
      this.cleanCache();
    }, 300000);
  }

  private updateSystemMetrics(): void {
    const cpuUsage = process.cpuUsage();
    const systemMem = os.totalmem();
    const freeMem = os.freemem();

    const metrics = {
      cpu: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to percentage
      memory: ((systemMem - freeMem) / systemMem) * 100,
      uptime: process.uptime(),
      loadAverage: os.loadavg()[0],
    };

    this.realTimeDashboard.updateMetric('cpu-percent', metrics.cpu);
    this.realTimeDashboard.updateMetric('memory-percent', metrics.memory);

    this.broadcastUpdate({
      type: 'system_metric',
      data: metrics,
      timestamp: new Date(),
    });
  }

  private async updateAgentMetrics(): Promise<void> {
    const agents = agentRegistry.getAllAgents();
    
    for (const agent of agents) {
      // Simulate metrics collection (in real implementation, agents would report these)
      const metrics = {
        responseTime: Math.random() * 1000 + 200,
        taskCount: Math.floor(Math.random() * 10),
        errorRate: Math.random() * 0.05,
      };

      this.cacheData(`agent-metrics-${agent.id}`, metrics, 120000); // 2 minutes cache
    }
  }

  // Agent Status API methods
  public async getAllAgentStatuses(): Promise<AgentStatus[]> {
    const agents = agentRegistry.getAllAgents();
    
    return agents.map(agent => ({
      id: agent.id,
      name: agent.config.name || `Agent-${agent.id}`,
      type: agent.type || 'unknown',
      status: this.getAgentConnectionStatus(agent.id),
      health: this.getAgentHealth(agent.id),
      capabilities: agent.getCapabilities() || [],
      currentTask: this.getAgentCurrentTask(agent.id),
      lastUpdated: new Date(),
    }));
  }

  public async getAgentStatus(agentId: string): Promise<AgentStatus | null> {
    const agent = agentRegistry.getAgent(agentId);
    if (!agent) return null;

    return {
      id: agent.id,
      name: agent.config.name || `Agent-${agent.id}`,
      type: agent.type || 'unknown',
      status: this.getAgentConnectionStatus(agent.id),
      health: this.getAgentHealth(agent.id),
      capabilities: agent.getCapabilities() || [],
      currentTask: this.getAgentCurrentTask(agent.id),
      lastUpdated: new Date(),
    };
  }

  public async getAgentMetrics(agentId: string): Promise<AgentMetrics | null> {
    const cached = this.getCachedData(`agent-metrics-${agentId}`);
    if (cached) return cached as AgentMetrics;

    // Generate mock metrics (replace with real implementation)
    const metrics: AgentMetrics = {
      agentId,
      performance: {
        responseTime: {
          current: Math.random() * 1000 + 200,
          average: Math.random() * 800 + 300,
          min: Math.random() * 200 + 100,
          max: Math.random() * 1500 + 500,
        },
        throughput: {
          messagesPerHour: Math.floor(Math.random() * 100) + 20,
          tasksPerHour: Math.floor(Math.random() * 50) + 10,
        },
        errorRate: {
          current: Math.random() * 0.05,
          average: Math.random() * 0.03,
        },
      },
      resourceUsage: {
        cpu: Math.random() * 80 + 10,
        memory: Math.random() * 70 + 20,
        networkIO: Math.random() * 100,
      },
      taskMetrics: {
        completed: Math.floor(Math.random() * 1000) + 100,
        failed: Math.floor(Math.random() * 50) + 5,
        averageDuration: Math.random() * 5000 + 1000,
      },
      trends: this.generateTrendData('performance', 24),
    };

    this.cacheData(`agent-metrics-${agentId}`, metrics, 60000);
    return metrics;
  }

  public async getAgentTasks(agentId: string): Promise<TaskInfo[]> {
    // Mock implementation - replace with real task tracking
    return [
      {
        id: uuidv4(),
        type: 'message_processing',
        status: 'processing',
        priority: 'medium',
        assignedAgent: agentId,
        progress: 75,
        estimatedCompletion: new Date(Date.now() + 300000),
        createdAt: new Date(Date.now() - 600000),
        startedAt: new Date(Date.now() - 300000),
        metadata: {
          description: 'Processing user message about project status',
          requester: 'user-123',
        },
      },
    ];
  }

  // Channel Status API methods
  public async getAllChannelStatuses(): Promise<ChannelStatus[]> {
    // Mock channel data (replace with real channel management)
    return [
      {
        id: 'twilio-sms',
        name: 'Twilio SMS',
        type: 'sms',
        status: 'connected',
        health: {
          connectivity: true,
          latency: 150,
          errorRate: 0.02,
        },
        configuration: {
          endpoint: 'api.twilio.com',
          provider: 'Twilio',
          version: 'v1',
        },
        lastChecked: new Date(),
      },
      {
        id: 'google-chat',
        name: 'Google Chat',
        type: 'google-chat',
        status: 'connected',
        health: {
          connectivity: true,
          latency: 200,
          errorRate: 0.01,
        },
        configuration: {
          endpoint: 'chat.googleapis.com',
          provider: 'Google',
          version: 'v1',
        },
        lastChecked: new Date(),
      },
    ];
  }

  public async getChannelStatus(channelId: string): Promise<ChannelStatus | null> {
    const channels = await this.getAllChannelStatuses();
    return channels.find(c => c.id === channelId) || null;
  }

  public async getChannelMetrics(channelId: string): Promise<ChannelMetrics> {
    const cached = this.getCachedData(`channel-metrics-${channelId}`);
    if (cached) return cached as ChannelMetrics;

    const metrics: ChannelMetrics = {
      channelId,
      messageVolume: {
        sent: Math.floor(Math.random() * 1000) + 100,
        received: Math.floor(Math.random() * 800) + 80,
        failed: Math.floor(Math.random() * 50) + 5,
        retried: Math.floor(Math.random() * 20) + 2,
      },
      performance: {
        averageLatency: Math.random() * 500 + 100,
        deliveryRate: 0.95 + Math.random() * 0.04,
        errorRate: Math.random() * 0.05,
      },
      usage: {
        hourly: this.generateUsageData(24),
        daily: this.generateUsageData(7),
        peakUsage: { timestamp: new Date(), count: Math.floor(Math.random() * 100) + 50 },
      },
    };

    this.cacheData(`channel-metrics-${channelId}`, metrics, 300000);
    return metrics;
  }

  public async getChannelMessages(channelId: string): Promise<any[]> {
    // Mock recent messages
    return [
      {
        id: uuidv4(),
        channelId,
        type: 'inbound',
        content: 'What is the status of project Alpha?',
        timestamp: new Date(Date.now() - 60000),
        status: 'processed',
      },
      {
        id: uuidv4(),
        channelId,
        type: 'outbound',
        content: 'Project Alpha is 75% complete and on track for delivery.',
        timestamp: new Date(Date.now() - 30000),
        status: 'delivered',
      },
    ];
  }

  public async testChannelConnectivity(channelId: string): Promise<any> {
    // Mock connectivity test
    const testStartTime = Date.now();
    
    // Simulate test delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      channelId,
      status: 'success',
      latency: Date.now() - testStartTime,
      timestamp: new Date(),
      details: {
        dns: 'resolved',
        connection: 'established',
        authentication: 'valid',
        endpoint: 'reachable',
      },
    };
  }

  // Task Management API methods
  public async getTasks(filters: any = {}): Promise<TaskInfo[]> {
    // Mock task data
    const allTasks: TaskInfo[] = [
      {
        id: uuidv4(),
        type: 'message_processing',
        status: 'completed',
        priority: 'medium',
        assignedAgent: 'agent-1',
        progress: 100,
        createdAt: new Date(Date.now() - 3600000),
        startedAt: new Date(Date.now() - 3500000),
        completedAt: new Date(Date.now() - 3000000),
        metadata: {
          description: 'Process user inquiry about services',
          requester: 'user-456',
          output: 'Response sent successfully',
        },
      },
      {
        id: uuidv4(),
        type: 'data_analysis',
        status: 'processing',
        priority: 'high',
        assignedAgent: 'agent-2',
        progress: 45,
        createdAt: new Date(Date.now() - 1800000),
        startedAt: new Date(Date.now() - 1500000),
        estimatedCompletion: new Date(Date.now() + 600000),
        metadata: {
          description: 'Analyze quarterly performance metrics',
          requester: 'manager-123',
        },
      },
    ];

    // Apply filters
    let filteredTasks = allTasks;
    
    if (filters.status) {
      filteredTasks = filteredTasks.filter(t => t.status === filters.status);
    }
    
    if (filters.agent) {
      filteredTasks = filteredTasks.filter(t => t.assignedAgent === filters.agent);
    }
    
    if (filters.priority) {
      filteredTasks = filteredTasks.filter(t => t.priority === filters.priority);
    }

    // Apply pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    
    return filteredTasks.slice(offset, offset + limit);
  }

  public async getTaskDetails(taskId: string): Promise<TaskInfo | null> {
    const tasks = await this.getTasks();
    return tasks.find(t => t.id === taskId) || null;
  }

  public async getTaskStatistics(): Promise<TaskStatistics> {
    const cached = this.getCachedData('task-statistics');
    if (cached) return cached as TaskStatistics;

    const stats: TaskStatistics = {
      total: 1247,
      byStatus: {
        pending: 23,
        processing: 8,
        completed: 1198,
        failed: 18,
      },
      byPriority: {
        low: 312,
        medium: 687,
        high: 248,
      },
      byAgent: {
        'agent-1': 423,
        'agent-2': 398,
        'agent-3': 426,
      },
      performance: {
        averageDuration: 45000,
        completionRate: 0.961,
        throughput: 28.5,
      },
      trends: {
        hourly: this.generateTaskTrendData(24),
        daily: this.generateTaskTrendData(7),
      },
    };

    this.cacheData('task-statistics', stats, 300000);
    return stats;
  }

  public async getTaskQueueStatus(): Promise<any> {
    return {
      totalInQueue: 31,
      processingCount: 8,
      averageWaitTime: 2400,
      estimatedProcessingTime: 15600,
      queuesByPriority: {
        high: 5,
        medium: 18,
        low: 8,
      },
      agentUtilization: {
        'agent-1': 0.75,
        'agent-2': 0.90,
        'agent-3': 0.65,
      },
    };
  }

  public async cancelTask(taskId: string): Promise<any> {
    // Mock task cancellation
    return {
      taskId,
      status: 'cancelled',
      timestamp: new Date(),
      message: 'Task cancelled successfully',
    };
  }

  // System Health API methods
  public async getSystemHealth(): Promise<SystemHealth> {
    const systemMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      overall: 'healthy',
      components: {
        database: 'healthy',
        cache: 'healthy',
        agents: 'healthy',
        channels: 'healthy',
      },
      metrics: {
        uptime: process.uptime(),
        cpu: Math.random() * 30 + 10,
        memory: ((systemMem - freeMem) / systemMem) * 100,
        disk: Math.random() * 40 + 20,
        network: Math.random() * 50 + 25,
      },
      alerts: [],
    };
  }

  public async getSystemMetrics(): Promise<any> {
    const memUsage = process.memoryUsage();
    
    return {
      process: {
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
        },
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
        pid: process.pid,
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg(),
        uptime: os.uptime(),
      },
      node: {
        version: process.version,
        versions: process.versions,
      },
    };
  }

  public async getSystemLogs(query: any = {}): Promise<any[]> {
    // Mock log entries
    return [
      {
        id: uuidv4(),
        level: 'info',
        message: 'Agent agent-1 processed message successfully',
        timestamp: new Date(Date.now() - 60000),
        component: 'agent-manager',
        metadata: { agentId: 'agent-1', duration: 1250 },
      },
      {
        id: uuidv4(),
        level: 'warn',
        message: 'Channel twilio-sms experiencing high latency',
        timestamp: new Date(Date.now() - 120000),
        component: 'channel-manager',
        metadata: { channelId: 'twilio-sms', latency: 2500 },
      },
    ];
  }

  public async getDashboardSnapshot(): Promise<DashboardSnapshot> {
    return await this.realTimeDashboard.refreshDashboard();
  }

  // Agent action methods
  public async performAgentAction(agentId: string, action: 'start' | 'stop' | 'restart'): Promise<any> {
    // Mock agent action
    return {
      agentId,
      action,
      status: 'success',
      timestamp: new Date(),
      message: `Agent ${action} completed successfully`,
    };
  }

  // Utility methods
  private getAgentConnectionStatus(agentId: string): 'online' | 'offline' | 'busy' | 'error' {
    // Mock status based on agent registry
    return Math.random() > 0.8 ? 'busy' : 'online';
  }

  private getAgentHealth(agentId: string): { cpu: number; memory: number; responseTime: number } {
    return {
      cpu: Math.random() * 80 + 10,
      memory: Math.random() * 70 + 20,
      responseTime: Math.random() * 1000 + 200,
    };
  }

  private getAgentCurrentTask(agentId: string): AgentStatus['currentTask'] | undefined {
    if (Math.random() > 0.7) {
      return {
        id: uuidv4(),
        type: 'message_processing',
        progress: Math.floor(Math.random() * 80) + 10,
        startedAt: new Date(Date.now() - Math.random() * 600000),
      };
    }
    return undefined;
  }

  private generateTrendData(metric: string, hours: number): Array<{ timestamp: Date; value: number; metric: string }> {
    const data = [];
    for (let i = hours; i >= 0; i--) {
      data.push({
        timestamp: new Date(Date.now() - i * 3600000),
        value: Math.random() * 100,
        metric,
      });
    }
    return data;
  }

  private generateUsageData(periods: number): Array<{ timestamp: Date; count: number }> {
    const data = [];
    for (let i = periods; i >= 0; i--) {
      data.push({
        timestamp: new Date(Date.now() - i * 3600000),
        count: Math.floor(Math.random() * 50) + 10,
      });
    }
    return data;
  }

  private generateTaskTrendData(periods: number): Array<{ timestamp: Date; completed: number; failed: number }> {
    const data = [];
    for (let i = periods; i >= 0; i--) {
      data.push({
        timestamp: new Date(Date.now() - i * 3600000),
        completed: Math.floor(Math.random() * 50) + 10,
        failed: Math.floor(Math.random() * 5) + 1,
      });
    }
    return data;
  }

  // Caching utilities
  private cacheData(key: string, data: any, ttl: number): void {
    this.metricsCache.set(key, {
      data,
      timestamp: new Date(),
      ttl,
    });
  }

  private getCachedData(key: string): any | null {
    const cached = this.metricsCache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp.getTime();
    if (age > cached.ttl) {
      this.metricsCache.delete(key);
      return null;
    }

    return cached.data;
  }

  private cleanCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.metricsCache.entries()) {
      const age = now - cached.timestamp.getTime();
      if (age > cached.ttl) {
        this.metricsCache.delete(key);
      }
    }
  }

  // WebSocket subscription management
  public subscribe(callback: (update: DashboardUpdate) => void): () => void {
    const id = Symbol();
    this.updateSubscribers.set(id, callback);
    
    return () => {
      this.updateSubscribers.delete(id);
    };
  }

  public addSubscription(socket: any, filters?: any): void {
    // Implementation for WebSocket-specific subscriptions
    const callback = (update: DashboardUpdate) => {
      if (socket.readyState === 1) { // WebSocket.OPEN
        socket.send(JSON.stringify(update));
      }
    };
    
    this.updateSubscribers.set(socket, callback);
  }

  private broadcastUpdate(update: DashboardUpdate): void {
    for (const callback of this.updateSubscribers.values()) {
      try {
        callback(update);
      } catch (error) {
        logger.error('Error broadcasting update', { error });
      }
    }
  }
}