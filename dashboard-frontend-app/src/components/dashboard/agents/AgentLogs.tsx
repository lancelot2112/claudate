'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { systemApi } from '@/lib/api';
import clsx from 'clsx';

interface AgentLogsProps {
  agentId: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  agentId?: string;
  component?: string;
  metadata?: Record<string, unknown>;
}

export default function AgentLogs({ agentId }: AgentLogsProps) {
  const [filters, setFilters] = useState({
    level: 'all',
    search: '',
    autoRefresh: true,
  });

  // Fetch logs
  const { refetch } = useQuery({
    queryKey: ['agent-logs', agentId, filters.level],
    queryFn: () => systemApi.getLogs({
      level: filters.level !== 'all' ? filters.level : undefined,
      limit: 100,
    }),
    refetchInterval: filters.autoRefresh ? 10000 : false,
  });

  // Filter logs for this specific agent and search term  
  // Note: In a real implementation, the backend would filter logs by agent
  const filteredLogs: LogEntry[] = []; // For now, use mock data only

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
      case 'warn': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'debug': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      case 'debug': return '🔍';
      default: return '📝';
    }
  };

  // Generate mock logs for demonstration (in real implementation, this would come from the API)
  const generateMockLogs = (): LogEntry[] => {
    const levels: ('info' | 'warn' | 'error' | 'debug')[] = ['info', 'warn', 'error', 'debug'];
    const messages = [
      `Agent ${agentId} started successfully`,
      `Agent ${agentId} received new task assignment`,
      `Agent ${agentId} completed task processing`,
      `Agent ${agentId} health check passed`,
      `Warning: Agent ${agentId} CPU usage high (85%)`,
      `Error: Agent ${agentId} failed to connect to service`,
      `Debug: Agent ${agentId} memory usage: 512MB`,
      `Agent ${agentId} idle, awaiting instructions`,
      `Agent ${agentId} performance metrics updated`,
      `Connection established for agent ${agentId}`,
    ];

    return Array.from({ length: 50 }, (_, i) => ({
      id: `log-${i}`,
      timestamp: new Date(Date.now() - i * 300000).toISOString(), // 5 minutes apart
      level: levels[Math.floor(Math.random() * levels.length)],
      message: messages[Math.floor(Math.random() * messages.length)],
      agentId: agentId,
      component: 'agent-manager',
      metadata: {
        pid: Math.floor(Math.random() * 10000),
        memory: Math.floor(Math.random() * 1000) + 'MB',
      },
    }));
  };

  const mockLogs = generateMockLogs();
  const allLogs = [...filteredLogs, ...mockLogs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

  // Auto-scroll to bottom for new logs
  useEffect(() => {
    if (filters.autoRefresh) {
      const logsContainer = document.getElementById('logs-container');
      if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
      }
    }
  }, [allLogs, filters.autoRefresh]);

  return (
    <div className="space-y-6">
      {/* Log Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search logs..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
          </div>

          {/* Level Filter */}
          <select
            value={filters.level}
            onChange={(e) => setFilters({ ...filters, level: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Levels</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>

        <div className="flex items-center space-x-4">
          {/* Auto Refresh Toggle */}
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.autoRefresh}
              onChange={(e) => setFilters({ ...filters, autoRefresh: e.target.checked })}
              className="mr-2"
            />
            <span className="text-sm text-gray-700">Auto-refresh</span>
          </label>

          {/* Manual Refresh */}
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>

          {/* Clear Logs */}
          <button
            onClick={() => {
              // In a real implementation, this would call an API to clear logs
              console.log('Clear logs for agent:', agentId);
            }}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">
            {allLogs.filter(log => log.level === 'error').length}
          </div>
          <div className="text-sm text-red-700">Errors</div>
        </div>
        
        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {allLogs.filter(log => log.level === 'warn').length}
          </div>
          <div className="text-sm text-yellow-700">Warnings</div>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">
            {allLogs.filter(log => log.level === 'info').length}
          </div>
          <div className="text-sm text-blue-700">Info</div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-600">
            {allLogs.filter(log => log.level === 'debug').length}
          </div>
          <div className="text-sm text-gray-700">Debug</div>
        </div>
      </div>

      {/* Logs Display */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Agent Logs</h3>
          <p className="text-sm text-gray-600">
            Showing {allLogs.length} log entries for agent {agentId}
          </p>
        </div>
        
        <div
          id="logs-container"
          className="h-96 overflow-y-auto p-4 font-mono text-sm space-y-2"
        >
          {allLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No logs found for the current filters
            </div>
          ) : (
            allLogs.map((log) => (
              <div
                key={log.id}
                className={clsx(
                  'p-3 border rounded-lg',
                  getLevelColor(log.level)
                )}
              >
                <div className="flex items-start space-x-3">
                  <span className="text-lg">{getLevelIcon(log.level)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium uppercase">
                        {log.level}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm break-words">
                      {log.message}
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <details className="cursor-pointer">
                          <summary>Metadata</summary>
                          <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}