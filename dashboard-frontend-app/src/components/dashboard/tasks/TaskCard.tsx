'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '@/lib/api';
import { TaskInfo } from '@/types/dashboard';
import clsx from 'clsx';

interface TaskCardProps {
  task: TaskInfo;
  isSelected: boolean;
  onSelect: () => void;
}

export default function TaskCard({ task, isSelected, onSelect }: TaskCardProps) {
  const [isActioning, setIsActioning] = useState(false);
  const queryClient = useQueryClient();

  // Task cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => taskApi.cancel(task.id),
    onMutate: () => setIsActioning(true),
    onSettled: () => setIsActioning(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel this task?')) {
      cancelMutation.mutate();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'processing': return '⏳';
      case 'pending': return '⏸️';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return 'Not started';
    
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const canCancel = task.status === 'pending' || task.status === 'processing';

  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-sm border-2 p-6 cursor-pointer transition-all duration-200',
        {
          'border-blue-500 shadow-lg': isSelected,
          'border-gray-200 hover:border-gray-300 hover:shadow-md': !isSelected,
        }
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">{getStatusIcon(task.status)}</span>
          <div>
            <h3 className="font-semibold text-gray-900">{task.type}</h3>
            <p className="text-sm text-gray-500">ID: {task.id.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`text-lg`}>{getPriorityIcon(task.priority)}</span>
          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(task.status)}`}>
            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Task Details */}
      <div className="space-y-3 mb-4">
        <p className="text-sm text-gray-700">{task.metadata.description}</p>
        
        {/* Progress Bar */}
        {task.status === 'processing' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Progress</span>
              <span className="text-gray-700">{task.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${task.progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Task Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-gray-500 block">Priority</span>
            <span className={`font-medium px-2 py-1 rounded text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority.toUpperCase()}
            </span>
          </div>
          
          <div>
            <span className="text-gray-500 block">Duration</span>
            <span className="text-gray-900">{formatDuration(task.startedAt, task.completedAt)}</span>
          </div>
          
          <div>
            <span className="text-gray-500 block">Assigned Agent</span>
            <span className="text-gray-900 font-mono">
              {task.assignedAgent ? task.assignedAgent.slice(0, 8) + '...' : 'Unassigned'}
            </span>
          </div>
          
          <div>
            <span className="text-gray-500 block">Requester</span>
            <span className="text-gray-900">{task.metadata.requester}</span>
          </div>
        </div>
      </div>

      {/* Timestamps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-500 mb-4">
        <div>
          <span className="font-medium">Created:</span>
          <br />
          {new Date(task.createdAt).toLocaleString()}
        </div>
        {task.startedAt && (
          <div>
            <span className="font-medium">Started:</span>
            <br />
            {new Date(task.startedAt).toLocaleString()}
          </div>
        )}
        {task.completedAt && (
          <div>
            <span className="font-medium">Completed:</span>
            <br />
            {new Date(task.completedAt).toLocaleString()}
          </div>
        )}
        {task.estimatedCompletion && !task.completedAt && (
          <div>
            <span className="font-medium">Est. Completion:</span>
            <br />
            {new Date(task.estimatedCompletion).toLocaleString()}
          </div>
        )}
      </div>

      {/* Dependencies */}
      {task.metadata.dependencies && task.metadata.dependencies.length > 0 && (
        <div className="mb-4">
          <span className="text-xs text-gray-500 block mb-1">Dependencies:</span>
          <div className="flex flex-wrap gap-1">
            {task.metadata.dependencies.map((dep, index) => (
              <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {dep}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {task.status === 'failed' && task.metadata.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-sm font-medium text-red-800 mb-1">Error:</div>
          <div className="text-sm text-red-700">{task.metadata.error}</div>
        </div>
      )}

      {/* Output */}
      {task.status === 'completed' && task.metadata.output && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm font-medium text-green-800 mb-1">Output:</div>
          <div className="text-sm text-green-700">
            {typeof task.metadata.output === 'string' 
              ? task.metadata.output 
              : 'Task completed successfully'}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-2 pt-4 border-t border-gray-200">
        {canCancel && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCancel();
            }}
            disabled={isActioning}
            className="px-3 py-2 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isActioning ? 'Cancelling...' : 'Cancel'}
          </button>
        )}
        
        {task.status === 'failed' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Implement retry functionality
            }}
            className="px-3 py-2 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
          >
            Retry
          </button>
        )}
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Open task details modal
          }}
          className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
        >
          Details
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Open task logs
          }}
          className="px-3 py-2 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
        >
          Logs
        </button>
        
        {task.assignedAgent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to agent detail page
              window.open(`/dashboard/agents/${task.assignedAgent}`, '_blank');
            }}
            className="px-3 py-2 text-xs font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 rounded transition-colors"
          >
            View Agent
          </button>
        )}
      </div>
    </div>
  );
}