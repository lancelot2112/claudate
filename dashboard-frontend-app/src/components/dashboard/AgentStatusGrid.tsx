'use client';

import { AgentStatus } from '@/types/dashboard';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

interface AgentStatusGridProps {
  agents: AgentStatus[];
}

const statusColors = {
  online: 'bg-green-400',
  busy: 'bg-yellow-400',
  offline: 'bg-gray-400',
  error: 'bg-red-400',
};

const statusLabels = {
  online: 'Online',
  busy: 'Busy',
  offline: 'Offline',
  error: 'Error',
};

export default function AgentStatusGrid({ agents }: AgentStatusGridProps) {
  if (agents.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No agents found
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {agents.map((agent) => (
        <div
          key={agent.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center flex-1">
            <div className={clsx('w-3 h-3 rounded-full mr-3', statusColors[agent.status])}></div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">{agent.name}</h4>
                <span className="text-xs text-gray-500 uppercase tracking-wide">
                  {statusLabels[agent.status]}
                </span>
              </div>
              
              <div className="flex items-center space-x-4 mt-1">
                <span className="text-sm text-gray-600">{agent.type}</span>
                {agent.currentTask && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {agent.currentTask.progress}% complete
                  </span>
                )}
              </div>
              
              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                <span>CPU: {Math.round(agent.health.cpu)}%</span>
                <span>Memory: {Math.round(agent.health.memory)}%</span>
                <span>Response: {Math.round(agent.health.responseTime)}ms</span>
              </div>
            </div>
          </div>

          <div className="ml-4 text-right">
            <div className="text-xs text-gray-500">
              Updated {formatDistanceToNow(new Date(agent.lastUpdated), { addSuffix: true })}
            </div>
            <div className="mt-1">
              <span className="text-xs text-gray-600">
                {agent.capabilities.length} capabilities
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}