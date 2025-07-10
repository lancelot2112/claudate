import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DashboardManager } from '../services/DashboardManager';
import { apiLogger } from '../../utils/logger';

// Request/Response types
interface AgentStatusRequest {
  Params: {
    id: string;
  };
}

interface TaskFilterQuery {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  agent?: string;
  priority?: 'low' | 'medium' | 'high';
  limit?: number;
  offset?: number;
}

interface TasksRequest {
  Querystring: TaskFilterQuery;
}

interface TaskActionRequest {
  Params: {
    id: string;
  };
  Body: {
    action: 'cancel' | 'retry' | 'priority_change';
    data?: any;
  };
}

interface ChannelTestRequest {
  Params: {
    id: string;
  };
}

export async function dashboardRoutes(fastify: FastifyInstance) {
  const dashboardManager = DashboardManager.getInstance();

  // Agent Status API
  fastify.get('/api/agents', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const agents = await dashboardManager.getAllAgentStatuses();
      return {
        success: true,
        data: agents,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get agents', { error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve agent statuses',
      });
    }
  });

  fastify.get<AgentStatusRequest>('/api/agents/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const agent = await dashboardManager.getAgentStatus(id);
      
      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: 'Agent not found',
        });
      }

      return {
        success: true,
        data: agent,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get agent details', { agentId: request.params.id, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve agent details',
      });
    }
  });

  fastify.get<AgentStatusRequest>('/api/agents/:id/metrics', async (request, reply) => {
    try {
      const { id } = request.params;
      const metrics = await dashboardManager.getAgentMetrics(id);
      
      if (!metrics) {
        return reply.status(404).send({
          success: false,
          error: 'Agent metrics not found',
        });
      }

      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get agent metrics', { agentId: request.params.id, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve agent metrics',
      });
    }
  });

  fastify.get<AgentStatusRequest>('/api/agents/:id/tasks', async (request, reply) => {
    try {
      const { id } = request.params;
      const tasks = await dashboardManager.getAgentTasks(id);
      
      return {
        success: true,
        data: tasks,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get agent tasks', { agentId: request.params.id, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve agent tasks',
      });
    }
  });

  fastify.post<AgentStatusRequest>('/api/agents/:id/action', async (request, reply) => {
    try {
      const { id } = request.params;
      const { action } = request.body as { action: 'start' | 'stop' | 'restart' };
      
      const result = await dashboardManager.performAgentAction(id, action);
      
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to perform agent action', { 
        agentId: request.params.id, 
        action: (request.body as any)?.action,
        error 
      });
      return reply.status(500).send({
        success: false,
        error: 'Failed to perform agent action',
      });
    }
  });

  // Communication Channel API
  fastify.get('/api/channels', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const channels = await dashboardManager.getAllChannelStatuses();
      return {
        success: true,
        data: channels,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get channels', { error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve channel statuses',
      });
    }
  });

  fastify.get<ChannelTestRequest>('/api/channels/:id/status', async (request, reply) => {
    try {
      const { id } = request.params;
      const status = await dashboardManager.getChannelStatus(id);
      
      if (!status) {
        return reply.status(404).send({
          success: false,
          error: 'Channel not found',
        });
      }

      return {
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get channel status', { channelId: request.params.id, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve channel status',
      });
    }
  });

  fastify.get<ChannelTestRequest>('/api/channels/:id/metrics', async (request, reply) => {
    try {
      const { id } = request.params;
      const metrics = await dashboardManager.getChannelMetrics(id);
      
      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get channel metrics', { channelId: request.params.id, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve channel metrics',
      });
    }
  });

  fastify.get<ChannelTestRequest>('/api/channels/:id/messages', async (request, reply) => {
    try {
      const { id } = request.params;
      const messages = await dashboardManager.getChannelMessages(id);
      
      return {
        success: true,
        data: messages,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get channel messages', { channelId: request.params.id, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve channel messages',
      });
    }
  });

  fastify.post<ChannelTestRequest>('/api/channels/:id/test', async (request, reply) => {
    try {
      const { id } = request.params;
      const testResult = await dashboardManager.testChannelConnectivity(id);
      
      return {
        success: true,
        data: testResult,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to test channel', { channelId: request.params.id, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to test channel connectivity',
      });
    }
  });

  // Task Monitoring API
  fastify.get<TasksRequest>('/api/tasks', async (request, reply) => {
    try {
      const filters = request.query;
      const tasks = await dashboardManager.getTasks(filters);
      
      return {
        success: true,
        data: tasks,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get tasks', { filters: request.query, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve tasks',
      });
    }
  });

  fastify.get<TaskActionRequest>('/api/tasks/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const task = await dashboardManager.getTaskDetails(id);
      
      if (!task) {
        return reply.status(404).send({
          success: false,
          error: 'Task not found',
        });
      }

      return {
        success: true,
        data: task,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get task details', { taskId: request.params.id, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve task details',
      });
    }
  });

  fastify.get('/api/tasks/statistics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await dashboardManager.getTaskStatistics();
      
      return {
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get task statistics', { error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve task statistics',
      });
    }
  });

  fastify.get('/api/tasks/queue', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const queueStatus = await dashboardManager.getTaskQueueStatus();
      
      return {
        success: true,
        data: queueStatus,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get task queue status', { error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve task queue status',
      });
    }
  });

  fastify.post<TaskActionRequest>('/api/tasks/:id/cancel', async (request, reply) => {
    try {
      const { id } = request.params;
      const result = await dashboardManager.cancelTask(id);
      
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to cancel task', { taskId: request.params.id, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to cancel task',
      });
    }
  });

  // System Metrics API
  fastify.get('/api/system/health', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const health = await dashboardManager.getSystemHealth();
      
      return {
        success: true,
        data: health,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get system health', { error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve system health',
      });
    }
  });

  fastify.get('/api/system/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const metrics = await dashboardManager.getSystemMetrics();
      
      return {
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get system metrics', { error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve system metrics',
      });
    }
  });

  fastify.get('/api/system/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { 
        level?: string; 
        limit?: number; 
        offset?: number;
        startDate?: string;
        endDate?: string;
      };
      const logs = await dashboardManager.getSystemLogs(query);
      
      return {
        success: true,
        data: logs,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get system logs', { query: request.query, error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve system logs',
      });
    }
  });

  fastify.get('/api/dashboard/snapshot', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const snapshot = await dashboardManager.getDashboardSnapshot();
      
      return {
        success: true,
        data: snapshot,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      apiLogger.error('Failed to get dashboard snapshot', { error });
      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve dashboard snapshot',
      });
    }
  });

  // WebSocket endpoint for real-time updates
  fastify.register(async function (fastify) {
    fastify.get('/api/dashboard/ws', { websocket: true }, (connection, req) => {
      apiLogger.info('Dashboard WebSocket connection established');
      
      // Subscribe to real-time updates
      const unsubscribe = dashboardManager.subscribe((update) => {
        connection.socket.send(JSON.stringify({
          type: update.type,
          data: update.data,
          timestamp: new Date().toISOString(),
        }));
      });

      connection.socket.on('message', (message: any) => {
        try {
          const data = JSON.parse(message.toString());
          apiLogger.debug('WebSocket message received', { data });
          
          // Handle client requests for specific data
          if (data.type === 'subscribe') {
            // Client can subscribe to specific update types
            dashboardManager.addSubscription(connection.socket, data.filters);
          }
        } catch (error) {
          apiLogger.error('WebSocket message error', { error });
        }
      });

      connection.socket.on('close', () => {
        apiLogger.info('Dashboard WebSocket connection closed');
        unsubscribe();
      });
    });
  });
}