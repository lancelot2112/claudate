'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { channelApi } from '@/lib/api';
import { ChannelStatus } from '@/types/dashboard';
import ChannelCard from '@/components/dashboard/channels/ChannelCard';
import ChannelFilters from '@/components/dashboard/channels/ChannelFilters';
import MessageFlowDiagram from '@/components/dashboard/channels/MessageFlowDiagram';
import ChannelPerformanceChart from '@/components/dashboard/channels/ChannelPerformanceChart';
import { useWebSocket } from '@/lib/websocket';

export default function ChannelsPage() {
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'flow'>('grid');
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: '',
  });

  // Fetch channels data
  const { data: channels, refetch } = useQuery({
    queryKey: ['channels'],
    queryFn: () => channelApi.getAll(),
    refetchInterval: 30000,
  });

  // Real-time updates
  useWebSocket('channel_status', (message) => {
    console.log('Channel status update:', message);
    refetch();
  });

  const channelData = channels?.data.data || [];

  // Filter channels based on current filters
  const filteredChannels = channelData.filter((channel: ChannelStatus) => {
    if (filters.status !== 'all' && channel.status !== filters.status) {
      return false;
    }
    if (filters.type !== 'all' && channel.type !== filters.type) {
      return false;
    }
    if (filters.search && !channel.name.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Get unique channel types for filter dropdown
  const channelTypes = [...new Set(channelData.map((channel: ChannelStatus) => channel.type))];

  // Status counts for overview
  const statusCounts = {
    connected: channelData.filter((c: ChannelStatus) => c.status === 'connected').length,
    disconnected: channelData.filter((c: ChannelStatus) => c.status === 'disconnected').length,
    degraded: channelData.filter((c: ChannelStatus) => c.status === 'degraded').length,
    error: channelData.filter((c: ChannelStatus) => c.status === 'error').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communication Channels</h1>
          <p className="text-gray-600">Monitor and manage all communication channels</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'grid' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Grid View
            </button>
            <button
              onClick={() => setViewMode('flow')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                viewMode === 'flow' 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Flow View
            </button>
          </div>
          
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
            Add Channel
          </button>
          <button className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium">
            Test All
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-400 rounded-full mr-3"></div>
            <div>
              <p className="text-2xl font-bold text-green-600">{statusCounts.connected}</p>
              <p className="text-sm text-gray-600">Connected</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-400 rounded-full mr-3"></div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{statusCounts.degraded}</p>
              <p className="text-sm text-gray-600">Degraded</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-400 rounded-full mr-3"></div>
            <div>
              <p className="text-2xl font-bold text-gray-600">{statusCounts.disconnected}</p>
              <p className="text-sm text-gray-600">Disconnected</p>
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
      <ChannelFilters
        filters={filters}
        onFiltersChange={setFilters}
        channelTypes={channelTypes}
        totalCount={channelData.length}
        filteredCount={filteredChannels.length}
      />

      {/* Performance Overview Chart */}
      {selectedChannel && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Channel Performance Overview</h2>
          <ChannelPerformanceChart channelId={selectedChannel} />
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'grid' ? (
        /* Channels Grid */
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredChannels.map((channel: ChannelStatus) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              isSelected={selectedChannel === channel.id}
              onSelect={() => setSelectedChannel(selectedChannel === channel.id ? null : channel.id)}
            />
          ))}
        </div>
      ) : (
        /* Message Flow Diagram */
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Flow Visualization</h2>
          <MessageFlowDiagram channels={filteredChannels} />
        </div>
      )}

      {/* Empty State */}
      {filteredChannels.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">📡</span>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No channels found</h3>
          <p className="text-gray-600 mb-6">
            {channelData.length === 0 
              ? "No communication channels are currently configured."
              : "No channels match your current filters."}
          </p>
          {channelData.length === 0 && (
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium">
              Configure Your First Channel
            </button>
          )}
        </div>
      )}
    </div>
  );
}