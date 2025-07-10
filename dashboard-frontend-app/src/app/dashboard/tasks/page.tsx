'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { taskApi } from '@/lib/api';
import { TaskInfo } from '@/types/dashboard';
import TaskCard from '@/components/dashboard/tasks/TaskCard';
import TaskFilters from '@/components/dashboard/tasks/TaskFilters';
import TaskQueueVisualization from '@/components/dashboard/tasks/TaskQueueVisualization';
import TaskAnalyticsChart from '@/components/dashboard/tasks/TaskAnalyticsChart';
import { useWebSocket } from '@/lib/websocket';

export default function TasksPage() {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'queue' | 'analytics'>('list');
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    agent: 'all',
    search: '',
  });

  // Fetch tasks data
  const { data: tasks, refetch } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => taskApi.getAll({
      status: filters.status !== 'all' ? filters.status : undefined,
      priority: filters.priority !== 'all' ? filters.priority : undefined,
      agent: filters.agent !== 'all' ? filters.agent : undefined,
      limit: 100,
    }),
    refetchInterval: 30000,
  });

  // Fetch task statistics
  const { data: taskStats } = useQuery({
    queryKey: ['task-statistics'],
    queryFn: () => taskApi.getStatistics(),
    refetchInterval: 30000,
  });

  // Real-time updates
  useWebSocket('task_update', (message) => {
    console.log('Task update:', message);
    refetch();
  });

  const taskData = tasks?.data.data || [];
  const statsData = taskStats?.data.data;

  // Filter tasks based on current filters
  const filteredTasks = taskData.filter((task: TaskInfo) => {
    if (filters.search && !task.metadata.description.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Status counts for overview
  const statusCounts = {
    pending: taskData.filter((t: TaskInfo) => t.status === 'pending').length,
    processing: taskData.filter((t: TaskInfo) => t.status === 'processing').length,
    completed: taskData.filter((t: TaskInfo) => t.status === 'completed').length,
    failed: taskData.filter((t: TaskInfo) => t.status === 'failed').length,
  };

  // Priority counts
  const priorityCounts = {
    high: taskData.filter((t: TaskInfo) => t.priority === 'high').length,
    medium: taskData.filter((t: TaskInfo) => t.priority === 'medium').length,
    low: taskData.filter((t: TaskInfo) => t.priority === 'low').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Task Management</h1>
          <p className="text-gray-600">Monitor and manage all tasks across the system</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('queue')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'queue' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Queue
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'analytics' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Analytics
            </button>
          </div>
          
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
            Create Task
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {/* Status Cards */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></div>
            <div>
              <p className="text-xl font-bold text-yellow-600">{statusCounts.pending}</p>
              <p className="text-xs text-gray-600">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-400 rounded-full mr-2"></div>
            <div>
              <p className="text-xl font-bold text-blue-600">{statusCounts.processing}</p>
              <p className="text-xs text-gray-600">Processing</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-2"></div>
            <div>
              <p className="text-xl font-bold text-green-600">{statusCounts.completed}</p>
              <p className="text-xs text-gray-600">Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-400 rounded-full mr-2"></div>
            <div>
              <p className="text-xl font-bold text-red-600">{statusCounts.failed}</p>
              <p className="text-xs text-gray-600">Failed</p>
            </div>
          </div>
        </div>

        {/* Priority Cards */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <div>
              <p className="text-xl font-bold text-red-600">{priorityCounts.high}</p>
              <p className="text-xs text-gray-600">High Priority</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
            <div>
              <p className="text-xl font-bold text-yellow-600">{priorityCounts.medium}</p>
              <p className="text-xs text-gray-600">Medium Priority</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <div>
              <p className="text-xl font-bold text-green-600">{priorityCounts.low}</p>
              <p className="text-xs text-gray-600">Low Priority</p>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="bg-white rounded-lg shadow p-4">
          <div>
            <p className="text-xl font-bold text-purple-600">
              {statsData ? (statsData.performance.completionRate * 100).toFixed(1) : '0'}%
            </p>
            <p className="text-xs text-gray-600">Success Rate</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      {viewMode === 'list' && (
        <TaskFilters
          filters={filters}
          onFiltersChange={setFilters}
          totalCount={taskData.length}
          filteredCount={filteredTasks.length}
        />
      )}

      {/* Content based on view mode */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-4xl">✅</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
              <p className="text-gray-600 mb-6">
                {taskData.length === 0 
                  ? "No tasks are currently in the system."
                  : "No tasks match your current filters."}
              </p>
              {taskData.length === 0 && (
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">
                  Create Your First Task
                </button>
              )}
            </div>
          ) : (
            filteredTasks.map((task: TaskInfo) => (
              <TaskCard
                key={task.id}
                task={task}
                isSelected={selectedTask === task.id}
                onSelect={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
              />
            ))
          )}
        </div>
      )}

      {viewMode === 'queue' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Queue Visualization</h2>
          <TaskQueueVisualization tasks={taskData} />
        </div>
      )}

      {viewMode === 'analytics' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Task Analytics</h2>
            <TaskAnalyticsChart data={statsData} />
          </div>
        </div>
      )}
    </div>
  );
}