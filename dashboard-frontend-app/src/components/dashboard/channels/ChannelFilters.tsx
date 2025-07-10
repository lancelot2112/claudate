'use client';

interface ChannelFiltersProps {
  filters: {
    status: string;
    type: string;
    search: string;
  };
  onFiltersChange: (filters: { status: string; type: string; search: string }) => void;
  channelTypes: string[];
  totalCount: number;
  filteredCount: number;
}

export default function ChannelFilters({
  filters,
  onFiltersChange,
  channelTypes,
  totalCount,
  filteredCount,
}: ChannelFiltersProps) {
  const updateFilter = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: 'all',
      type: 'all',
      search: '',
    });
  };

  const hasActiveFilters = filters.status !== 'all' || filters.type !== 'all' || filters.search !== '';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search channels..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full sm:w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">🔍</span>
            </div>
          </div>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="connected">Connected</option>
            <option value="degraded">Degraded</option>
            <option value="disconnected">Disconnected</option>
            <option value="error">Error</option>
          </select>

          {/* Type Filter */}
          <select
            value={filters.type}
            onChange={(e) => updateFilter('type', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="sms">SMS</option>
            <option value="mms">MMS</option>
            <option value="google-chat">Google Chat</option>
            <option value="email">Email</option>
            <option value="webhook">Webhook</option>
            {channelTypes.filter(type => !['sms', 'mms', 'google-chat', 'email', 'webhook'].includes(type)).map((type) => (
              <option key={type} value={type}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Results and Actions */}
        <div className="flex items-center space-x-4">
          {/* Results Count */}
          <div className="text-sm text-gray-600">
            Showing {filteredCount} of {totalCount} channels
            {hasActiveFilters && (
              <span className="ml-2">
                <button
                  onClick={clearFilters}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Clear filters
                </button>
              </span>
            )}
          </div>

          {/* Quick Filter Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => updateFilter('status', 'error')}
              className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 rounded-full transition-colors"
            >
              Errors Only
            </button>
            <button
              onClick={() => updateFilter('status', 'connected')}
              className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded-full transition-colors"
            >
              Connected Only
            </button>
          </div>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Active filters:</span>
            {filters.status !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                Status: {filters.status}
                <button
                  onClick={() => updateFilter('status', 'all')}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            )}
            {filters.type !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                Type: {filters.type}
                <button
                  onClick={() => updateFilter('type', 'all')}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            )}
            {filters.search && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                Search: &ldquo;{filters.search}&rdquo;
                <button
                  onClick={() => updateFilter('search', '')}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}