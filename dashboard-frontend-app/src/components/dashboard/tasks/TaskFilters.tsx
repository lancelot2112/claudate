'use client';

interface TaskFiltersProps {
  filters: {
    status: string;
    priority: string;
    agent: string;
    search: string;
  };
  onFiltersChange: (filters: { status: string; priority: string; agent: string; search: string }) => void;
  totalCount: number;
  filteredCount: number;
}

export default function TaskFilters({
  filters,
  onFiltersChange,
  totalCount,
  filteredCount,
}: TaskFiltersProps) {
  const updateFilter = (key: string, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: 'all',
      priority: 'all',
      agent: 'all',
      search: '',
    });
  };

  const hasActiveFilters = filters.status !== 'all' || filters.priority !== 'all' || 
                          filters.agent !== 'all' || filters.search !== '';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search tasks..."
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
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>

          {/* Priority Filter */}
          <select
            value={filters.priority}
            onChange={(e) => updateFilter('priority', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>

          {/* Agent Filter */}
          <select
            value={filters.agent}
            onChange={(e) => updateFilter('agent', e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Agents</option>
            <option value="unassigned">Unassigned</option>
            <option value="agent-001">Agent 001</option>
            <option value="agent-002">Agent 002</option>
            <option value="agent-003">Agent 003</option>
            {/* In a real implementation, this would be populated from actual agent data */}
          </select>
        </div>

        {/* Results and Actions */}
        <div className="flex items-center space-x-4">
          {/* Results Count */}
          <div className="text-sm text-gray-600">
            Showing {filteredCount} of {totalCount} tasks
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
              onClick={() => updateFilter('status', 'failed')}
              className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 rounded-full transition-colors"
            >
              Failed Only
            </button>
            <button
              onClick={() => updateFilter('priority', 'high')}
              className="px-3 py-1 text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-full transition-colors"
            >
              High Priority
            </button>
            <button
              onClick={() => updateFilter('status', 'processing')}
              className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-full transition-colors"
            >
              In Progress
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
            {filters.priority !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                Priority: {filters.priority}
                <button
                  onClick={() => updateFilter('priority', 'all')}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            )}
            {filters.agent !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                Agent: {filters.agent}
                <button
                  onClick={() => updateFilter('agent', 'all')}
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

      {/* Bulk Actions */}
      {hasActiveFilters && filteredCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Bulk actions for {filteredCount} filtered tasks:</span>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  // TODO: Implement bulk cancel
                  console.log('Bulk cancel filtered tasks');
                }}
                className="px-3 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
              >
                Cancel All
              </button>
              <button
                onClick={() => {
                  // TODO: Implement bulk retry
                  console.log('Bulk retry filtered failed tasks');
                }}
                className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
              >
                Retry Failed
              </button>
              <button
                onClick={() => {
                  // TODO: Implement bulk export
                  console.log('Export filtered tasks');
                }}
                className="px-3 py-1 text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}