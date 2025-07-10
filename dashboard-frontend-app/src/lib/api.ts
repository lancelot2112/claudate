import axios from 'axios';
import { AgentStatus, ChannelStatus, TaskInfo, SystemHealth, DashboardSnapshot, TaskStatistics, AgentMetrics, ChannelMetrics, ApiResponse } from '@/types/dashboard';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Agent API
export const agentApi = {
  getAll: () => 
    apiClient.get<ApiResponse<AgentStatus[]>>('/api/agents'),
  
  getById: (id: string) => 
    apiClient.get<ApiResponse<AgentStatus>>(`/api/agents/${id}`),
  
  getMetrics: (id: string) => 
    apiClient.get<ApiResponse<AgentMetrics>>(`/api/agents/${id}/metrics`),
  
  getTasks: (id: string) => 
    apiClient.get<ApiResponse<TaskInfo[]>>(`/api/agents/${id}/tasks`),
  
  performAction: (id: string, action: 'start' | 'stop' | 'restart') => 
    apiClient.post<ApiResponse<{ success: boolean }>>(`/api/agents/${id}/action`, { action }),
};

// Channel API
export const channelApi = {
  getAll: () => 
    apiClient.get<ApiResponse<ChannelStatus[]>>('/api/channels'),
  
  getStatus: (id: string) => 
    apiClient.get<ApiResponse<ChannelStatus>>(`/api/channels/${id}/status`),
  
  getMetrics: (id: string) => 
    apiClient.get<ApiResponse<ChannelMetrics>>(`/api/channels/${id}/metrics`),
  
  getMessages: (id: string) => 
    apiClient.get<ApiResponse<Record<string, unknown>[]>>(`/api/channels/${id}/messages`),
  
  testConnectivity: (id: string) => 
    apiClient.post<ApiResponse<{ connectivity: boolean; latency: number }>>(`/api/channels/${id}/test`),
};

// Task API
export const taskApi = {
  getAll: (filters?: { 
    status?: string; 
    agent?: string; 
    priority?: string; 
    limit?: number; 
    offset?: number;
  }) => 
    apiClient.get<ApiResponse<TaskInfo[]>>('/api/tasks', { params: filters }),
  
  getById: (id: string) => 
    apiClient.get<ApiResponse<TaskInfo>>(`/api/tasks/${id}`),
  
  getStatistics: () => 
    apiClient.get<ApiResponse<TaskStatistics>>('/api/tasks/statistics'),
  
  getQueueStatus: () => 
    apiClient.get<ApiResponse<Record<string, unknown>>>('/api/tasks/queue'),
  
  cancel: (id: string) => 
    apiClient.post<ApiResponse<{ success: boolean }>>(`/api/tasks/${id}/cancel`),
};

// System API
export const systemApi = {
  getHealth: () => 
    apiClient.get<ApiResponse<SystemHealth>>('/api/system/health'),
  
  getMetrics: () => 
    apiClient.get<ApiResponse<Record<string, unknown>>>('/api/system/metrics'),
  
  getLogs: (query?: { 
    level?: string; 
    limit?: number; 
    offset?: number;
    startDate?: string;
    endDate?: string;
  }) => 
    apiClient.get<ApiResponse<Record<string, unknown>[]>>('/api/system/logs', { params: query }),
};

// Dashboard API
export const dashboardApi = {
  getSnapshot: () => 
    apiClient.get<ApiResponse<DashboardSnapshot>>('/api/dashboard/snapshot'),
};

export default apiClient;