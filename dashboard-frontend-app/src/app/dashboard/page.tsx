'use client';

import { useQuery } from '@tanstack/react-query';
import { agentApi, channelApi, taskApi, systemApi } from '@/lib/api';
import MetricCard from '@/components/dashboard/MetricCard';
import AgentStatusGrid from '@/components/dashboard/AgentStatusGrid';
import ChannelStatusGrid from '@/components/dashboard/ChannelStatusGrid';
import TaskQueueChart from '@/components/dashboard/TaskQueueChart';
import SystemMetricsChart from '@/components/dashboard/SystemMetricsChart';

export default function DashboardPage() {
  // Fetch data for all components
  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentApi.getAll(),
    refetchInterval: 30000,
  });

  const { data: channels } = useQuery({
    queryKey: ['channels'],
    queryFn: () => channelApi.getAll(),
    refetchInterval: 30000,
  });

  const { data: taskStats } = useQuery({
    queryKey: ['task-statistics'],
    queryFn: () => taskApi.getStatistics(),
    refetchInterval: 30000,
  });

  const { data: systemHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => systemApi.getHealth(),
    refetchInterval: 30000,
  });

  const agentData = agents?.data.data || [];
  const channelData = channels?.data.data || [];
  const taskStatsData = taskStats?.data.data;
  const healthData = systemHealth?.data.data;

  // Calculate metrics
  const totalAgents = agentData.length;
  const onlineAgents = agentData.filter(a => a.status === 'online').length;
  const busyAgents = agentData.filter(a => a.status === 'busy').length;

  const totalChannels = channelData.length;
  const connectedChannels = channelData.filter(c => c.status === 'connected').length;

  const processingTasks = taskStatsData?.byStatus.processing || 0;
  const completedTasks = taskStatsData?.byStatus.completed || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-600">Monitor your Claudate system in real-time</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Agents"
          value={totalAgents}
          subtitle={`${onlineAgents} online, ${busyAgents} busy`}
          trend={onlineAgents > 0 ? 'up' : 'stable'}
          color="blue"
        />

        <MetricCard
          title="Channels"
          value={totalChannels}
          subtitle={`${connectedChannels} connected`}
          trend={connectedChannels === totalChannels ? 'up' : 'down'}
          color="green"
        />

        <MetricCard
          title="Active Tasks"
          value={processingTasks}
          subtitle={`${completedTasks} completed today`}
          trend="up"
          color="yellow"
        />

        <MetricCard
          title="System Health"
          value={healthData?.overall || 'Unknown'}
          subtitle={`${Math.round(healthData?.metrics.cpu || 0)}% CPU, ${Math.round(healthData?.metrics.memory || 0)}% Memory`}
          trend={healthData?.overall === 'healthy' ? 'up' : 'down'}
          color={healthData?.overall === 'healthy' ? 'green' : 'red'}
          isText
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agent Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Status</h2>
          <AgentStatusGrid agents={agentData.slice(0, 6)} />
          {agentData.length > 6 && (
            <div className="mt-4 text-center">
              <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                View All Agents ({agentData.length})
              </button>
            </div>
          )}
        </div>

        {/* Channel Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Communication Channels</h2>
          <ChannelStatusGrid channels={channelData} />
        </div>

        {/* Task Queue Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Queue Status</h2>
          <TaskQueueChart data={taskStatsData} />
        </div>

        {/* System Metrics Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">System Performance</h2>
          <SystemMetricsChart data={healthData?.metrics} />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {taskStatsData?.trends.hourly.slice(-5).map((item, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                <span className="text-sm text-gray-700">
                  {item.completed} tasks completed, {item.failed} failed
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {new Date(item.timestamp).toLocaleTimeString()}
              </span>
            </div>
          )) || (
            <div className="text-center text-gray-500 py-8">
              No recent activity data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}