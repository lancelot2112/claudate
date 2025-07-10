'use client';

import { useState } from 'react';

interface ChannelMessagesProps {
  channelId: string;
  messages: unknown[];
}

interface Message {
  id: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'media' | 'system';
  content: string;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  sender?: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
}

export default function ChannelMessages({ channelId, messages }: ChannelMessagesProps) {
  const [filters, setFilters] = useState({
    direction: 'all',
    status: 'all',
    type: 'all',
    search: '',
  });

  // Generate mock messages for demonstration
  const generateMockMessages = (): Message[] => {
    const directions: ('inbound' | 'outbound')[] = ['inbound', 'outbound'];
    const types: ('text' | 'media' | 'system')[] = ['text', 'media', 'system'];
    const statuses: ('sent' | 'delivered' | 'failed' | 'pending')[] = ['sent', 'delivered', 'failed', 'pending'];
    
    const mockContent = [
      'Hello, how can I help you today?',
      'Thank you for contacting us. Your request has been received.',
      'System notification: Connection established',
      'Please find the attached document for your review.',
      'Your order #12345 has been processed successfully.',
      'Error: Message delivery failed, retrying...',
      'Welcome to our service! How may we assist you?',
      'Your appointment has been confirmed for tomorrow at 2 PM.',
      'System maintenance scheduled for tonight at midnight.',
      'Thank you for your feedback. We appreciate your input.',
    ];

    return Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      timestamp: new Date(Date.now() - i * 300000).toISOString(), // 5 minutes apart
      direction: directions[Math.floor(Math.random() * directions.length)],
      type: types[Math.floor(Math.random() * types.length)],
      content: mockContent[Math.floor(Math.random() * mockContent.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      sender: Math.random() > 0.5 ? 'agent@example.com' : '+1234567890',
      recipient: Math.random() > 0.5 ? 'user@example.com' : '+0987654321',
      metadata: {
        messageId: `msg-${Math.random().toString(36).substr(2, 9)}`,
        provider: 'twilio',
      },
    }));
  };

  const mockMessages = generateMockMessages();
  const allMessages = [...(messages as Message[]), ...mockMessages]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter messages
  const filteredMessages = allMessages.filter((message) => {
    if (filters.direction !== 'all' && message.direction !== filters.direction) {
      return false;
    }
    if (filters.status !== 'all' && message.status !== filters.status) {
      return false;
    }
    if (filters.type !== 'all' && message.type !== filters.type) {
      return false;
    }
    if (filters.search && !message.content.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const updateFilter = (key: string, value: string) => {
    setFilters({
      ...filters,
      [key]: value,
    });
  };

  const getDirectionIcon = (direction: string) => {
    return direction === 'inbound' ? '📥' : '📤';
  };

  const getDirectionColor = (direction: string) => {
    return direction === 'inbound' ? 'text-blue-600' : 'text-green-600';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text': return '💬';
      case 'media': return '📎';
      case 'system': return '⚙️';
      default: return '📝';
    }
  };

  return (
    <div className="space-y-6">
      {/* Message Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search messages..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
          </div>

          {/* Direction Filter */}
          <select
            value={filters.direction}
            onChange={(e) => updateFilter('direction', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="delivered">Delivered</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>

          {/* Type Filter */}
          <select
            value={filters.type}
            onChange={(e) => updateFilter('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="text">Text</option>
            <option value="media">Media</option>
            <option value="system">System</option>
          </select>
        </div>

        {/* Message Stats */}
        <div className="text-sm text-gray-600">
          Showing {filteredMessages.length} of {allMessages.length} messages
        </div>
      </div>

      {/* Message Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">
            {allMessages.filter(msg => msg.direction === 'inbound').length}
          </div>
          <div className="text-sm text-blue-700">Inbound</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {allMessages.filter(msg => msg.direction === 'outbound').length}
          </div>
          <div className="text-sm text-green-700">Outbound</div>
        </div>
        
        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">
            {allMessages.filter(msg => msg.status === 'failed').length}
          </div>
          <div className="text-sm text-red-700">Failed</div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">
            {Math.round((allMessages.filter(msg => msg.status === 'delivered').length / allMessages.length) * 100)}%
          </div>
          <div className="text-sm text-purple-700">Success Rate</div>
        </div>
      </div>

      {/* Messages List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Message History</h3>
          <p className="text-sm text-gray-600">
            Recent messages for channel {channelId}
          </p>
        </div>
        
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No messages found for the current filters
          </div>
        ) : (
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {filteredMessages.map((message) => (
              <div key={message.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className={`text-lg ${getDirectionColor(message.direction)}`}>
                      {getDirectionIcon(message.direction)}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {message.direction === 'inbound' ? message.sender : message.recipient}
                        </span>
                        <span className="text-lg">{getTypeIcon(message.type)}</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(message.status)}`}>
                          {message.status.charAt(0).toUpperCase() + message.status.slice(1)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(message.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="ml-8">
                  <p className="text-sm text-gray-900 mb-2">{message.content}</p>
                  
                  {message.metadata && Object.keys(message.metadata).length > 0 && (
                    <div className="text-xs text-gray-500">
                      <details className="cursor-pointer">
                        <summary>Message Metadata</summary>
                        <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-x-auto font-mono">
                          {JSON.stringify(message.metadata, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}