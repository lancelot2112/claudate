'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { agentApi } from '@/lib/api';
import { AgentStatus } from '@/types/dashboard';
import clsx from 'clsx';

interface AgentCardProps {
  agent: AgentStatus;
  isSelected: boolean;
  onSelect: () => void;
}

export default function AgentCard({ agent, isSelected, onSelect }: AgentCardProps) {
  const [isActioning, setIsActioning] = useState(false);
  const queryClient = useQueryClient();

  // Agent action mutation
  const actionMutation = useMutation({
    mutationFn: ({ action }: { action: 'start' | 'stop' | 'restart' }) =>
      agentApi.performAction(agent.id, action),
    onMutate: () => setIsActioning(true),
    onSettled: () => setIsActioning(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });

  const handleAction = (action: 'start' | 'stop' | 'restart') => {
    actionMutation.mutate({ action });
  };

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

  const getHealthScore = (health: AgentStatus['health']) => {
    const cpuScore = Math.max(0, 100 - health.cpu);
    const memoryScore = Math.max(0, 100 - health.memory);
    const responseScore = Math.max(0, 100 - (health.responseTime / 10));
    return Math.round((cpuScore + memoryScore + responseScore) / 3);
  };

  const healthScore = getHealthScore(agent.health);

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
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-3 ${getStatusColor(agent.status)}`}></div>
          <div>
            <h3 className="font-semibold text-gray-900">{agent.name}</h3>
            <p className="text-sm text-gray-500">{agent.type}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`text-sm font-medium ${getStatusTextColor(agent.status)}`}>
            {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
          </span>
        </div>
      </div>

      {/* Health Metrics */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Health Score</span>
          <span className={`text-sm font-medium ${
            healthScore > 80 ? 'text-green-600' : 
            healthScore > 60 ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {healthScore}%
          </span>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">CPU</span>
            <span className="text-gray-700">{agent.health.cpu.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${
                agent.health.cpu > 80 ? 'bg-red-500' : 
                agent.health.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(agent.health.cpu, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Memory</span>
            <span className="text-gray-700">{agent.health.memory.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${
                agent.health.memory > 80 ? 'bg-red-500' : 
                agent.health.memory > 60 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(agent.health.memory, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Response Time</span>
          <span className="text-gray-700">{agent.health.responseTime}ms</span>
        </div>
      </div>

      {/* Current Task */}
      {agent.currentTask && (
        <div className="bg-blue-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">Current Task</span>
            <span className="text-xs text-blue-600">{agent.currentTask.progress}%</span>
          </div>
          <p className="text-sm text-blue-800 mb-2">{agent.currentTask.type}</p>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="h-2 bg-blue-600 rounded-full"
              style={{ width: `${agent.currentTask.progress}%` }}
            ></div>
          </div>
          <p className="text-xs text-blue-600 mt-2">
            Started: {new Date(agent.currentTask.startedAt).toLocaleTimeString()}
          </p>
        </div>
      )}

      {/* Capabilities */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Capabilities</p>
        <div className="flex flex-wrap gap-1">
          {agent.capabilities.slice(0, 3).map((capability, index) => (
            <span
              key={index}
              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
            >
              {capability}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="text-xs text-gray-500">
              +{agent.capabilities.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAction(agent.status === 'online' || agent.status === 'busy' ? 'stop' : 'start');
          }}
          disabled={isActioning}
          className={clsx(
            'flex-1 px-3 py-2 text-xs font-medium rounded transition-colors',
            {
              'bg-red-100 text-red-700 hover:bg-red-200': agent.status === 'online' || agent.status === 'busy',
              'bg-green-100 text-green-700 hover:bg-green-200': agent.status === 'offline' || agent.status === 'error',
              'opacity-50 cursor-not-allowed': isActioning,
            }
          )}
        >
          {isActioning ? '...' : (agent.status === 'online' || agent.status === 'busy' ? 'Stop' : 'Start')}
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAction('restart');
          }}
          disabled={isActioning}
          className="flex-1 px-3 py-2 text-xs font-medium bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isActioning ? '...' : 'Restart'}
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Open logs modal
          }}
          className="px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
        >
          Logs
        </button>
      </div>

      {/* Last Updated */}
      <p className="text-xs text-gray-400 mt-3">
        Updated: {new Date(agent.lastUpdated).toLocaleString()}
      </p>
    </div>
  );
}