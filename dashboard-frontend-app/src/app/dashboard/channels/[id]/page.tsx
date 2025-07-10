'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { channelApi } from '@/lib/api';
import { useWebSocket } from '@/lib/websocket';
import ChannelPerformanceChart from '@/components/dashboard/channels/ChannelPerformanceChart';
import ChannelMessages from '@/components/dashboard/channels/ChannelMessages';
import ChannelConfiguration from '@/components/dashboard/channels/ChannelConfiguration';
import clsx from 'clsx';

export default function ChannelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const channelId = params.id as string;
  const [activeTab, setActiveTab] = useState('overview');
  const [isTesting, setIsTesting] = useState(false);
  const queryClient = useQueryClient();

  // Fetch channel data
  const { data: channel, isLoading } = useQuery({
    queryKey: ['channel', channelId],
    queryFn: () => channelApi.getStatus(channelId),
    refetchInterval: 30000,
  });

  // Fetch channel messages
  const { data: messages } = useQuery({
    queryKey: ['channel-messages', channelId],
    queryFn: () => channelApi.getMessages(channelId),
    refetchInterval: 30000,
  });

  // Real-time updates
  useWebSocket('channel_status', (message) => {
    if (message.data.channelId === channelId) {
      queryClient.invalidateQueries({ queryKey: ['channel', channelId] });
    }
  });

  // Channel test mutation
  const testMutation = useMutation({
    mutationFn: () => channelApi.testConnectivity(channelId),
    onMutate: () => setIsTesting(true),
    onSettled: () => setIsTesting(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel', channelId] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const handleTest = () => {
    testMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!channel?.data.data) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Channel Not Found</h2>
        <p className="text-gray-600 mb-6">The requested channel could not be found.</p>
        <button
          onClick={() => router.push('/dashboard/channels')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium"
        >
          Back to Channels
        </button>
      </div>
    );
  }

  const channelData = channel.data.data;
  const messageData = messages?.data.data || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-400';
      case 'degraded': return 'bg-yellow-400';
      case 'disconnected': return 'bg-gray-400';
      case 'error': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'disconnected': return 'text-gray-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sms': return '💬';
      case 'mms': return '📱';
      case 'google-chat': return '💼';
      case 'email': return '📧';
      case 'webhook': return '🔗';
      default: return '📡';
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'performance', name: 'Performance', icon: '📈' },
    { id: 'messages', name: 'Messages', icon: '💬' },
    { id: 'configuration', name: 'Configuration', icon: '⚙️' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/dashboard/channels')}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to Channels
          </button>
          <div className="flex items-center">
            <div className="text-3xl mr-3">{getTypeIcon(channelData.type)}</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{channelData.name}</h1>
              <p className="text-gray-600 capitalize">{channelData.type} Channel</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-4 h-4 rounded-full ${getStatusColor(channelData.status)}`}></div>
            <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusTextColor(channelData.status)}`}>
              {channelData.status.charAt(0).toUpperCase() + channelData.status.slice(1)}
            </span>
          </div>
          <button
            onClick={handleTest}
            disabled={isTesting}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Connectivity</p>
              <p className={`text-2xl font-bold ${channelData.health.connectivity ? 'text-green-600' : 'text-red-600'}`}>
                {channelData.health.connectivity ? 'Online' : 'Offline'}
              </p>
            </div>
            <div className="text-2xl">🔗</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Latency</p>
              <p className="text-2xl font-bold text-gray-900">{channelData.health.latency}ms</p>
            </div>
            <div className="text-2xl">⚡</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Error Rate</p>
              <p className={`text-2xl font-bold ${
                channelData.health.errorRate > 0.1 ? 'text-red-600' :
                channelData.health.errorRate > 0.05 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {(channelData.health.errorRate * 100).toFixed(2)}%
              </p>
            </div>
            <div className="text-2xl">❌</div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Messages</p>
              <p className="text-2xl font-bold text-gray-900">{messageData.length || 0}</p>
            </div>
            <div className="text-2xl">📨</div>
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
              {/* Channel Health Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Connection Status</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status</span>
                      <span className={`font-medium ${getStatusTextColor(channelData.status)}`}>
                        {channelData.status.charAt(0).toUpperCase() + channelData.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Last Checked</span>
                      <span className="text-gray-900">
                        {new Date(channelData.lastChecked).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Latency</span>
                      <span className="text-gray-900">{channelData.health.latency}ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Error Rate</span>
                      <span className="text-gray-900">{(channelData.health.errorRate * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuration</h3>
                  <div className="space-y-3">
                    {channelData.configuration.provider && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Provider</span>
                        <span className="text-gray-900 font-mono text-sm">
                          {channelData.configuration.provider}
                        </span>
                      </div>
                    )}
                    {channelData.configuration.version && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Version</span>
                        <span className="text-gray-900 font-mono text-sm">
                          {channelData.configuration.version}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Channel Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Channel Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Channel ID:</span>
                    <span className="font-mono text-sm text-gray-900">{channelData.id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="text-gray-900 capitalize">{channelData.type}</span>
                  </div>
                  {channelData.configuration.endpoint && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Endpoint:</span>
                      <span className="text-gray-900 font-mono text-sm break-all">
                        {channelData.configuration.endpoint}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <ChannelPerformanceChart channelId={channelId} />
          )}

          {activeTab === 'messages' && (
            <ChannelMessages channelId={channelId} messages={messageData} />
          )}

          {activeTab === 'configuration' && (
            <ChannelConfiguration channelId={channelId} configuration={channelData.configuration} />
          )}
        </div>
      </div>
    </div>
  );
}