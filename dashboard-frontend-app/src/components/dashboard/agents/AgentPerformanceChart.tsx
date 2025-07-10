'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { useQuery } from '@tanstack/react-query';
import { agentApi } from '@/lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface AgentPerformanceChartProps {
  agentId: string;
}

export default function AgentPerformanceChart({ agentId }: AgentPerformanceChartProps) {
  // Fetch agent metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['agent-metrics', agentId],
    queryFn: () => agentApi.getMetrics(agentId),
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading performance data...
      </div>
    );
  }

  if (!metrics?.data.data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No performance data available
      </div>
    );
  }

  // Generate mock time series data (in real implementation, this would come from the API)
  const generateTimeSeriesData = () => {
    const now = new Date();
    const points = [];
    for (let i = 23; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 60 * 60 * 1000);
      points.push({
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        responseTime: Math.random() * 500 + 100,
        cpu: Math.random() * 50 + 25,
        memory: Math.random() * 40 + 30,
        tasksCompleted: Math.floor(Math.random() * 10) + 1,
      });
    }
    return points;
  };

  const timeSeriesData = generateTimeSeriesData();

  const chartData = {
    labels: timeSeriesData.map(point => point.time),
    datasets: [
      {
        label: 'Response Time (ms)',
        data: timeSeriesData.map(point => point.responseTime),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        yAxisID: 'y',
      },
      {
        label: 'CPU Usage (%)',
        data: timeSeriesData.map(point => point.cpu),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        yAxisID: 'y1',
      },
      {
        label: 'Memory Usage (%)',
        data: timeSeriesData.map(point => point.memory),
        borderColor: 'rgb(251, 191, 36)',
        backgroundColor: 'rgba(251, 191, 36, 0.1)',
        yAxisID: 'y1',
      },
      {
        label: 'Tasks Completed',
        data: timeSeriesData.map(point => point.tasksCompleted),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        yAxisID: 'y2',
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Agent Performance Over Time (24 Hours)',
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time',
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Response Time (ms)',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Usage (%)',
        },
        grid: {
          drawOnChartArea: false,
        },
        max: 100,
      },
      y2: {
        type: 'linear' as const,
        display: false,
        position: 'right' as const,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">
            {Math.round(timeSeriesData[timeSeriesData.length - 1].responseTime)}ms
          </div>
          <div className="text-sm text-blue-700">Avg Response Time</div>
          <div className="text-xs text-blue-600 mt-1">
            {timeSeriesData[timeSeriesData.length - 1].responseTime > timeSeriesData[timeSeriesData.length - 2].responseTime ? '↗️' : '↘️'} 
            {' '}vs previous hour
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {Math.round(timeSeriesData[timeSeriesData.length - 1].cpu)}%
          </div>
          <div className="text-sm text-green-700">CPU Usage</div>
          <div className="text-xs text-green-600 mt-1">
            {timeSeriesData[timeSeriesData.length - 1].cpu > timeSeriesData[timeSeriesData.length - 2].cpu ? '↗️' : '↘️'}
            {' '}vs previous hour
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-600">
            {Math.round(timeSeriesData[timeSeriesData.length - 1].memory)}%
          </div>
          <div className="text-sm text-yellow-700">Memory Usage</div>
          <div className="text-xs text-yellow-600 mt-1">
            {timeSeriesData[timeSeriesData.length - 1].memory > timeSeriesData[timeSeriesData.length - 2].memory ? '↗️' : '↘️'}
            {' '}vs previous hour
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">
            {timeSeriesData.reduce((sum, point) => sum + point.tasksCompleted, 0)}
          </div>
          <div className="text-sm text-purple-700">Tasks Completed (24h)</div>
          <div className="text-xs text-purple-600 mt-1">
            ✅ {Math.round(timeSeriesData.reduce((sum, point) => sum + point.tasksCompleted, 0) / 24)} avg/hour
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      <div className="h-96">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}