'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { channelApi } from '@/lib/api';
import { ChannelStatus } from '@/types/dashboard';
import clsx from 'clsx';

interface ChannelCardProps {
  channel: ChannelStatus;
  isSelected: boolean;
  onSelect: () => void;
}

export default function ChannelCard({ channel, isSelected, onSelect }: ChannelCardProps) {
  const [isTesting, setIsTesting] = useState(false);
  const queryClient = useQueryClient();

  // Channel test mutation
  const testMutation = useMutation({
    mutationFn: () => channelApi.testConnectivity(channel.id),
    onMutate: () => setIsTesting(true),
    onSettled: () => setIsTesting(false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const handleTest = () => {
    testMutation.mutate();
  };

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

  const getHealthScore = (health: ChannelStatus['health']) => {
    const connectivityScore = health.connectivity ? 100 : 0;
    const latencyScore = Math.max(0, 100 - (health.latency / 10));
    const errorScore = Math.max(0, 100 - (health.errorRate * 100));
    return Math.round((connectivityScore + latencyScore + errorScore) / 3);
  };

  const healthScore = getHealthScore(channel.health);

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
          <div className="text-2xl mr-3">{getTypeIcon(channel.type)}</div>
          <div>
            <h3 className="font-semibold text-gray-900">{channel.name}</h3>
            <p className="text-sm text-gray-500 capitalize">{channel.type}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor(channel.status)}`}></div>
          <span className={`text-sm font-medium ${getStatusTextColor(channel.status)}`}>
            {channel.status.charAt(0).toUpperCase() + channel.status.slice(1)}
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
            <span className="text-gray-500">Connectivity</span>
            <span className={`font-medium ${channel.health.connectivity ? 'text-green-600' : 'text-red-600'}`}>
              {channel.health.connectivity ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Latency</span>
            <span className="text-gray-700">{channel.health.latency}ms</span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">Error Rate</span>
            <span className={`font-medium ${
              channel.health.errorRate > 0.1 ? 'text-red-600' : 
              channel.health.errorRate > 0.05 ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {(channel.health.errorRate * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Configuration Info */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">Configuration</p>
        <div className="bg-gray-50 rounded-lg p-3 space-y-1">
          {channel.configuration.provider && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Provider</span>
              <span className="text-gray-700 font-mono">{channel.configuration.provider}</span>
            </div>
          )}
          {channel.configuration.endpoint && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Endpoint</span>
              <span className="text-gray-700 font-mono text-right max-w-32 truncate">
                {channel.configuration.endpoint}
              </span>
            </div>
          )}
          {channel.configuration.version && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Version</span>
              <span className="text-gray-700 font-mono">{channel.configuration.version}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTest();
          }}
          disabled={isTesting}
          className="flex-1 px-3 py-2 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isTesting ? 'Testing...' : 'Test'}
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Open channel configuration
          }}
          className="flex-1 px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded transition-colors"
        >
          Configure
        </button>
        
        <button
          onClick={(e) => {
            e.stopPropagation();
            // TODO: Open channel metrics
          }}
          className="px-3 py-2 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
        >
          Metrics
        </button>
      </div>

      {/* Last Checked */}
      <p className="text-xs text-gray-400 mt-3">
        Last checked: {new Date(channel.lastChecked).toLocaleString()}
      </p>
    </div>
  );
}