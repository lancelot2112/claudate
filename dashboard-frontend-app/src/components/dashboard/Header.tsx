'use client';

import { useQuery } from '@tanstack/react-query';
import { systemApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: systemHealth } = useQuery({
    queryKey: ['system-health'],
    queryFn: () => systemApi.getHealth(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const health = systemHealth?.data.data;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left side */}
        <div className="flex items-center">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100 mr-4"
          >
            ☰
          </button>
          
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Dashboard
            </h2>
            <p className="text-sm text-gray-500">
              Real-time system monitoring
            </p>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-6">
          {/* System Status */}
          {health && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-2 ${
                  health.overall === 'healthy' ? 'bg-green-400' :
                  health.overall === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
                <span className="text-sm font-medium text-gray-700">
                  {health.overall}
                </span>
              </div>

              <div className="text-sm text-gray-500">
                CPU: {Math.round(health.metrics.cpu)}%
              </div>

              <div className="text-sm text-gray-500">
                Memory: {Math.round(health.metrics.memory)}%
              </div>

              <div className="text-sm text-gray-500">
                Uptime: {formatDistanceToNow(new Date(Date.now() - health.metrics.uptime * 1000))}
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-sm text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>

          {/* Alerts indicator */}
          {health?.alerts && health.alerts.length > 0 && (
            <div className="relative">
              <button className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                🚨
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {health.alerts.length}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}