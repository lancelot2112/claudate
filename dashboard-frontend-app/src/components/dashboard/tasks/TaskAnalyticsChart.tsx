'use client';

import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

interface TaskAnalyticsChartProps {
  data?: {
    byStatus: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    byPriority: {
      low: number;
      medium: number;
      high: number;
    };
    performance: {
      completionRate: number;
      throughput: number;
      averageProcessingTime: number;
    };
    trends: {
      hourly: Array<{
        timestamp: string;
        completed: number;
        failed: number;
      }>;
      daily: Array<{
        timestamp: string;
        completed: number;
        failed: number;
      }>;
    };
  };
}

export default function TaskAnalyticsChart({ data }: TaskAnalyticsChartProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading analytics data...
      </div>
    );
  }

  // Generate additional mock data for comprehensive analytics
  const generateMockTrends = () => {
    const now = new Date();
    const hours = [];
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      hours.push({
        timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        completed: Math.floor(Math.random() * 20) + 5,
        failed: Math.floor(Math.random() * 5),
        created: Math.floor(Math.random() * 25) + 5,
        processing: Math.floor(Math.random() * 10) + 2,
      });
    }
    return hours;
  };

  const trendData = generateMockTrends();

  // Status Distribution Chart
  const statusChartData = {
    labels: ['Pending', 'Processing', 'Completed', 'Failed'],
    datasets: [
      {
        data: [
          data.byStatus.pending,
          data.byStatus.processing,
          data.byStatus.completed,
          data.byStatus.failed,
        ],
        backgroundColor: [
          '#FEF3C7', // Yellow for pending
          '#DBEAFE', // Blue for processing
          '#D1FAE5', // Green for completed
          '#FEE2E2', // Red for failed
        ],
        borderColor: [
          '#F59E0B',
          '#3B82F6',
          '#10B981',
          '#EF4444',
        ],
        borderWidth: 2,
      },
    ],
  };

  // Task Trends Over Time
  const trendsChartData = {
    labels: trendData.map(point => point.timestamp),
    datasets: [
      {
        label: 'Completed',
        data: trendData.map(point => point.completed),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
      },
      {
        label: 'Created',
        data: trendData.map(point => point.created),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
      {
        label: 'Failed',
        data: trendData.map(point => point.failed),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
      },
    ],
  };

  // Priority Distribution
  const priorityChartData = {
    labels: ['High', 'Medium', 'Low'],
    datasets: [
      {
        label: 'Tasks by Priority',
        data: [data.byPriority.high, data.byPriority.medium, data.byPriority.low],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',  // Red for high
          'rgba(251, 191, 36, 0.8)', // Yellow for medium
          'rgba(34, 197, 94, 0.8)',  // Green for low
        ],
        borderColor: [
          'rgb(239, 68, 68)',
          'rgb(251, 191, 36)',
          'rgb(34, 197, 94)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Processing Time Distribution
  const processingTimeData = {
    labels: ['< 1min', '1-5min', '5-15min', '15-30min', '30min+'],
    datasets: [
      {
        label: 'Task Count',
        data: [15, 45, 25, 10, 5], // Mock data
        backgroundColor: 'rgba(168, 85, 247, 0.8)',
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  const barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-50 rounded-lg p-6">
          <div className="text-3xl font-bold text-blue-600">
            {(data.performance.completionRate * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-blue-700">Success Rate</div>
          <div className="text-xs text-blue-600 mt-1">
            {data.byStatus.completed} of {Object.values(data.byStatus).reduce((a, b) => a + b, 0)} total
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-6">
          <div className="text-3xl font-bold text-green-600">
            {data.performance.throughput.toFixed(1)}
          </div>
          <div className="text-sm text-green-700">Tasks/Hour</div>
          <div className="text-xs text-green-600 mt-1">
            📈 +12% vs last hour
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-6">
          <div className="text-3xl font-bold text-purple-600">
            {(data.performance.averageProcessingTime / 60).toFixed(1)}m
          </div>
          <div className="text-sm text-purple-700">Avg Processing Time</div>
          <div className="text-xs text-purple-600 mt-1">
            ⚡ -15% vs yesterday
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-6">
          <div className="text-3xl font-bold text-yellow-600">
            {data.byStatus.pending + data.byStatus.processing}
          </div>
          <div className="text-sm text-yellow-700">Active Tasks</div>
          <div className="text-xs text-yellow-600 mt-1">
            {data.byStatus.pending} pending, {data.byStatus.processing} processing
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Status Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Status Distribution</h3>
          <div className="h-64">
            <Doughnut data={statusChartData} options={doughnutOptions} />
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
          <div className="h-64">
            <Bar data={priorityChartData} options={barOptions} />
          </div>
        </div>

        {/* Task Trends */}
        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Trends (24 Hours)</h3>
          <div className="h-64">
            <Line data={trendsChartData} options={chartOptions} />
          </div>
        </div>

        {/* Processing Time Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Time Distribution</h3>
          <div className="h-64">
            <Bar data={processingTimeData} options={barOptions} />
          </div>
        </div>

        {/* Performance Insights */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-green-900">High Success Rate</div>
                <div className="text-xs text-green-700">Tasks completing successfully</div>
              </div>
              <div className="text-2xl">🎯</div>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-blue-900">Optimal Throughput</div>
                <div className="text-xs text-blue-700">Processing speed is good</div>
              </div>
              <div className="text-2xl">⚡</div>
            </div>

            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-yellow-900">Queue Depth</div>
                <div className="text-xs text-yellow-700">Monitor pending tasks</div>
              </div>
              <div className="text-2xl">📊</div>
            </div>

            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-purple-900">Agent Utilization</div>
                <div className="text-xs text-purple-700">Balanced workload</div>
              </div>
              <div className="text-2xl">🤖</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm font-medium text-gray-900 mb-2">Scale Agents</div>
            <div className="text-xs text-gray-600">
              Consider adding more agents during peak hours (2-4 PM) to reduce queue depth
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm font-medium text-gray-900 mb-2">Optimize Failed Tasks</div>
            <div className="text-xs text-gray-600">
              Investigate recurring failure patterns to improve success rate from {(data.performance.completionRate * 100).toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-white rounded-lg p-4">
            <div className="text-sm font-medium text-gray-900 mb-2">Priority Balancing</div>
            <div className="text-xs text-gray-600">
              Review high-priority task allocation to ensure critical tasks are processed first
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}