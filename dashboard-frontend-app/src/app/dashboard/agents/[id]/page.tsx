'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { agentApi } from '@/lib/api';
import { useWebSocket } from '@/lib/websocket';
import AgentPerformanceChart from '@/components/dashboard/agents/AgentPerformanceChart';
import AgentTaskHistory from '@/components/dashboard/agents/AgentTaskHistory';
import AgentLogs from '@/components/dashboard/agents/AgentLogs';
import clsx from 'clsx';

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  const [activeTab, setActiveTab] = useState('overview');
  const [isActioning, setIsActioning] = useState(false);
  const queryClient = useQueryClient();

  // Fetch agent data
  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => agentApi.getById(agentId),
    refetchInterval: 30000,
  });

  // Fetch agent tasks
  const { data: tasks } = useQuery({
    queryKey: ['agent-tasks', agentId],
    queryFn: () => agentApi.getTasks(agentId),
    refetchInterval: 30000,
  });

  // Real-time updates
  useWebSocket('agent_status', (message) => {
    if (message.data.agentId === agentId) {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    }
  });

  // Agent action mutation
  const actionMutation = useMutation({
    mutationFn: ({ action }: { action: 'start' | 'stop' | 'restart' }) =>
      agentApi.performAction(agentId, action),
    onMutate: () => setIsActioning(true),
    onSettled: () => setIsActioning(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const handleAction = (action: 'start' | 'stop' | 'restart') => {
    actionMutation.mutate({ action });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!agent?.data.data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Agent Not Found</h2>
        <p className="text-gray-600 mb-6">The requested agent could not be found.</p>
        <button
          onClick={() => router.push('/dashboard/agents')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
        >
          Back to Agents
        </button>
      </div>
    );
  }

  const agentData = agent.data.data;
  const taskData = tasks?.data.data || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-400';
      case 'busy': return 'bg-yellow-400';
      case 'offline': return 'bg-gray-400';
      case 'error': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600';
      case 'busy': return 'text-yellow-600';
      case 'offline': return 'text-gray-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'performance', name: 'Performance', icon: '📈' },
    { id: 'tasks', name: 'Tasks', icon: '✅' },
    { id: 'logs', name: 'Logs', icon: '📋' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/dashboard/agents')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to Agents
          </button>
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded-full mr-3 ${getStatusColor(agentData.status)}`}></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{agentData.name}</h1>
              <p className="text-gray-600">{agentData.type} Agent</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusTextColor(agentData.status)}`}>
            {agentData.status.charAt(0).toUpperCase() + agentData.status.slice(1)}
          </span>
          <button
            onClick={() => handleAction(agentData.status === 'online' || agentData.status === 'busy' ? 'stop' : 'start')}
            disabled={isActioning}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              {
                'bg-red-600 hover:bg-red-700 text-white': agentData.status === 'online' || agentData.status === 'busy',
                'bg-green-600 hover:bg-green-700 text-white': agentData.status === 'offline' || agentData.status === 'error',
                'opacity-50 cursor-not-allowed': isActioning,
              }
            )}
          >
            {isActioning ? 'Processing...' : (agentData.status === 'online' || agentData.status === 'busy' ? 'Stop Agent' : 'Start Agent')}
          </button>
          <button
            onClick={() => handleAction('restart')}
            disabled={isActioning}
            className="px-4 py-2 text-sm font-medium bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isActioning ? 'Processing...' : 'Restart'}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">CPU Usage</p>
              <p className="text-2xl font-bold text-gray-900">{agentData.health.cpu.toFixed(1)}%</p>
            </div>
            <div className="text-2xl">🖥️</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Memory Usage</p>
              <p className="text-2xl font-bold text-gray-900">{agentData.health.memory.toFixed(1)}%</p>
            </div>
            <div className="text-2xl">💾</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Response Time</p>
              <p className="text-2xl font-bold text-gray-900">{agentData.health.responseTime}ms</p>
            </div>
            <div className="text-2xl">⚡</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Tasks</p>
              <p className="text-2xl font-bold text-gray-900">{agentData.currentTask ? '1' : '0'}</p>
            </div>
            <div className="text-2xl">⚙️</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2',
                  {
                    'border-blue-500 text-blue-600': activeTab === tab.id,
                    'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300': activeTab !== tab.id,
                  }
                )}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Current Task */}
              {agentData.currentTask && (
                <div className="bg-blue-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-4">Current Task</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-blue-800 font-medium">{agentData.currentTask.type}</span>
                      <span className="text-blue-600">{agentData.currentTask.progress}% Complete</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-3">
                      <div
                        className="h-3 bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${agentData.currentTask.progress}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-blue-700">
                      Started: {new Date(agentData.currentTask.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Capabilities */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Capabilities</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {agentData.capabilities.map((capability, index) => (
                    <div key={index} className="bg-gray-100 rounded-lg p-3 text-center">
                      <span className="text-sm font-medium text-gray-700">{capability}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent Info */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Agent Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Agent ID:</span>
                    <span className="font-mono text-sm text-gray-900">{agentData.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="text-gray-900">{agentData.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Updated:</span>
                    <span className="text-gray-900">{new Date(agentData.lastUpdated).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <AgentPerformanceChart agentId={agentId} />
          )}

          {activeTab === 'tasks' && (
            <AgentTaskHistory tasks={taskData} />
          )}

          {activeTab === 'logs' && (
            <AgentLogs agentId={agentId} />
          )}
        </div>
      </div>
    </div>
  );
}