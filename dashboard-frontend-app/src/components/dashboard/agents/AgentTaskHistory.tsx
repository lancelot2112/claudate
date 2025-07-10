'use client';

import { TaskInfo } from '@/types/dashboard';

interface AgentTaskHistoryProps {
  tasks: TaskInfo[];
}

export default function AgentTaskHistory({ tasks }: AgentTaskHistoryProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const formatDuration = (startedAt?: string, completedAt?: string) => {
    if (!startedAt) return 'Not started';
    
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diffMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  // Sort tasks by creation date, most recent first
  const sortedTasks = [...tasks].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Calculate statistics
  const completedTasks = tasks.filter(t => t.status === 'completed').length;
  const failedTasks = tasks.filter(t => t.status === 'failed').length;
  const totalTasks = tasks.length;
  const successRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Task Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">{totalTasks}</div>
          <div className="text-sm text-blue-700">Total Tasks</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">{completedTasks}</div>
          <div className="text-sm text-green-700">Completed</div>
        </div>
        
        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">{failedTasks}</div>
          <div className="text-sm text-red-700">Failed</div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">{successRate.toFixed(1)}%</div>
          <div className="text-sm text-purple-700">Success Rate</div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Task History</h3>
          <p className="text-sm text-gray-600">All tasks assigned to this agent</p>
        </div>
        
        {sortedTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <span className="text-4xl">📋</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
            <p className="text-gray-600">This agent hasn&apos;t been assigned any tasks yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {sortedTasks.map((task) => (
              <div key={task.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.status)}`}>
                      {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                    <span className={`text-sm font-medium ${getPriorityColor(task.priority)}`}>
                      {task.priority.toUpperCase()} PRIORITY
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(task.createdAt).toLocaleString()}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-900">{task.type}</h4>
                  <p className="text-sm text-gray-600">{task.metadata.description}</p>
                  
                  {/* Progress Bar */}
                  {task.status === 'processing' && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Progress</span>
                        <span className="text-gray-700">{task.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 bg-blue-600 rounded-full transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  {/* Task Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-500 pt-2">
                    <div>
                      <span className="font-medium">Duration:</span>
                      <br />
                      {formatDuration(task.startedAt, task.completedAt)}
                    </div>
                    <div>
                      <span className="font-medium">Requester:</span>
                      <br />
                      {task.metadata.requester}
                    </div>
                    {task.estimatedCompletion && (
                      <div>
                        <span className="font-medium">Est. Completion:</span>
                        <br />
                        {new Date(task.estimatedCompletion).toLocaleTimeString()}
                      </div>
                    )}
                    <div>
                      <span className="font-medium">Task ID:</span>
                      <br />
                      <span className="font-mono">{task.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                  
                  {/* Error Message */}
                  {task.status === 'failed' && task.metadata.error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="text-sm font-medium text-red-800 mb-1">Error Details:</div>
                      <div className="text-sm text-red-700">{task.metadata.error}</div>
                    </div>
                  )}
                  
                  {/* Output */}
                  {task.status === 'completed' && task.metadata.output && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm font-medium text-green-800 mb-1">Output:</div>
                      <div className="text-sm text-green-700">
                        {typeof task.metadata.output === 'string' 
                          ? task.metadata.output 
                          : 'Task completed successfully'}
                      </div>
                    </div>
                  )}
                  
                  {/* Dependencies */}
                  {task.metadata.dependencies && task.metadata.dependencies.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-gray-700 mb-1">Dependencies:</div>
                      <div className="flex flex-wrap gap-1">
                        {task.metadata.dependencies.map((dep, index) => (
                          <span key={index} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            {dep}
                          </span>
                        ))}
                      </div>
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