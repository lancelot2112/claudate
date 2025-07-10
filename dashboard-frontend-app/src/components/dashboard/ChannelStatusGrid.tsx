'use client';

import { ChannelStatus } from '@/types/dashboard';
import clsx from 'clsx';
import { formatDistanceToNow } from 'date-fns';

interface ChannelStatusGridProps {
  channels: ChannelStatus[];
}

const statusColors = {
  connected: 'bg-green-400',
  disconnected: 'bg-gray-400',
  error: 'bg-red-400',
  degraded: 'bg-yellow-400',
};

const statusLabels = {
  connected: 'Connected',
  disconnected: 'Disconnected',
  error: 'Error',
  degraded: 'Degraded',
};

const channelIcons = {
  sms: '📱',
  mms: '📨',
  'google-chat': '💬',
  email: '📧',
  webhook: '🔗',
};

export default function ChannelStatusGrid({ channels }: ChannelStatusGridProps) {
  if (channels.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No channels configured
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {channels.map((channel) => (
        <div
          key={channel.id}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <div className="flex items-center flex-1">
            <div className={clsx('w-3 h-3 rounded-full mr-3', statusColors[channel.status])}></div>
            
            <div className="flex items-center mr-3">
              <span className="text-lg mr-2">{channelIcons[channel.type]}</span>
              <div>
                <h4 className="font-medium text-gray-900">{channel.name}</h4>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                    {statusLabels[channel.status]}
                  </span>
                  <span className="text-xs text-gray-600">{channel.configuration.provider}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>Latency: {Math.round(channel.health.latency)}ms</span>
              <span>Error Rate: {(channel.health.errorRate * 100).toFixed(1)}%</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Checked {formatDistanceToNow(new Date(channel.lastChecked), { addSuffix: true })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}