'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentApi } from '@/lib/api';
import { AgentStatus } from '@/types/dashboard';
import AgentCard from '@/components/dashboard/agents/AgentCard';
import AgentFilters from '@/components/dashboard/agents/AgentFilters';
import AgentPerformanceChart from '@/components/dashboard/agents/AgentPerformanceChart';
import { useWebSocket } from '@/lib/websocket';

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: '',
  });

  // Fetch agents data
  const { data: agents, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: () => agentApi.getAll(),
    refetchInterval: 30000,
  });

  // Real-time updates
  useWebSocket('agent_status', (message) => {
    console.log('Agent status update:', message);
    refetch();
  });

  const agentData = agents?.data.data || [];

  // Filter agents based on current filters
  const filteredAgents = agentData.filter((agent: AgentStatus) => {
    if (filters.status !== 'all' && agent.status !== filters.status) {
      return false;
    }
    if (filters.type !== 'all' && agent.type !== filters.type) {
      return false;
    }
    if (filters.search && !agent.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Get unique agent types for filter dropdown
  const agentTypes = [...new Set(agentData.map((agent: AgentStatus) => agent.type))];

  // Status counts for overview
  const statusCounts = {
    online: agentData.filter((a: AgentStatus) => a.status === 'online').length,
    offline: agentData.filter((a: AgentStatus) => a.status === 'offline').length,
    busy: agentData.filter((a: AgentStatus) => a.status === 'busy').length,
    error: agentData.filter((a: AgentStatus) => a.status === 'error').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Monitoring</h1>
          <p className="text-gray-600">Monitor and manage all AI agents in real-time</p>
        </div>
        <div className="flex items-center space-x-4">
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
            Add Agent
          </button>
          <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium">
            Bulk Actions
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
            <div>
              <p className="text-2xl font-bold text-green-600">{statusCounts.online}</p>
              <p className="text-sm text-gray-600">Online</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-400 rounded-full mr-3"></div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{statusCounts.busy}</p>
              <p className="text-sm text-gray-600">Busy</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-400 rounded-full mr-3"></div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{statusCounts.offline}</p>
              <p className="text-sm text-gray-600">Offline</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-400 rounded-full mr-3"></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{statusCounts.error}</p>
              <p className="text-sm text-gray-600">Error</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <AgentFilters
        filters={filters}
        onFiltersChange={setFilters}
        agentTypes={agentTypes}
        totalCount={agentData.length}
        filteredCount={filteredAgents.length}
      />

      {/* Performance Overview Chart */}
      {selectedAgent && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Agent Performance Overview</h2>
          <AgentPerformanceChart agentId={selectedAgent} />
        </div>
      )}

      {/* Agents Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAgents.map((agent: AgentStatus) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            isSelected={selectedAgent === agent.id}
            onSelect={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {filteredAgents.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">🤖</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
          <p className="text-gray-600 mb-6">
            {agentData.length === 0 
              ? "No agents are currently registered in the system."
              : "No agents match your current filters."}
          </p>
          {agentData.length === 0 && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">
              Set Up Your First Agent
            </button>
          )}
        </div>
      )}
    </div>
  );
}