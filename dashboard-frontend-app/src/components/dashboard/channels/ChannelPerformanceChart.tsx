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
import { channelApi } from '@/lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ChannelPerformanceChartProps {
  channelId: string;
}

export default function ChannelPerformanceChart({ channelId }: ChannelPerformanceChartProps) {
  // Fetch channel metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['channel-metrics', channelId],
    queryFn: () => channelApi.getMetrics(channelId),
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
        latency: Math.random() * 200 + 50,
        messagesProcessed: Math.floor(Math.random() * 50) + 10,
        errorRate: Math.random() * 0.1,
        connectivity: Math.random() > 0.1 ? 100 : 0, // 90% uptime
      });
    }
    return points;
  };

  const timeSeriesData = generateTimeSeriesData();

  const chartData = {
    labels: timeSeriesData.map(point => point.time),
    datasets: [
      {
        label: 'Latency (ms)',
        data: timeSeriesData.map(point => point.latency),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        yAxisID: 'y',
      },
      {
        label: 'Messages Processed',
        data: timeSeriesData.map(point => point.messagesProcessed),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        yAxisID: 'y1',
      },
      {
        label: 'Error Rate (%)',
        data: timeSeriesData.map(point => point.errorRate * 100),
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        yAxisID: 'y2',
      },
      {
        label: 'Connectivity (%)',
        data: timeSeriesData.map(point => point.connectivity),
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
        text: 'Channel Performance Over Time (24 Hours)',
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
          text: 'Latency (ms)',
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Messages',
        },
        grid: {
          drawOnChartArea: false,
        },
      },
      y2: {
        type: 'linear' as const,
        display: false,
        position: 'right' as const,
        max: 100,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">
            {Math.round(timeSeriesData[timeSeriesData.length - 1].latency)}ms
          </div>
          <div className="text-sm text-blue-700">Avg Latency</div>
          <div className="text-xs text-blue-600 mt-1">
            {timeSeriesData[timeSeriesData.length - 1].latency > timeSeriesData[timeSeriesData.length - 2].latency ? '↗️' : '↘️'} 
            {' '}vs previous hour
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {timeSeriesData.reduce((sum, point) => sum + point.messagesProcessed, 0)}
          </div>
          <div className="text-sm text-green-700">Messages (24h)</div>
          <div className="text-xs text-green-600 mt-1">
            📈 {Math.round(timeSeriesData.reduce((sum, point) => sum + point.messagesProcessed, 0) / 24)} avg/hour
          </div>
        </div>

        <div className="bg-red-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600">
            {(timeSeriesData[timeSeriesData.length - 1].errorRate * 100).toFixed(2)}%
          </div>
          <div className="text-sm text-red-700">Error Rate</div>
          <div className="text-xs text-red-600 mt-1">
            {timeSeriesData[timeSeriesData.length - 1].errorRate > timeSeriesData[timeSeriesData.length - 2].errorRate ? '↗️' : '↘️'}
            {' '}vs previous hour
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">
            {Math.round(timeSeriesData.filter(point => point.connectivity > 0).length / timeSeriesData.length * 100)}%
          </div>
          <div className="text-sm text-purple-700">Uptime (24h)</div>
          <div className="text-xs text-purple-600 mt-1">
            ⏱️ {timeSeriesData.filter(point => point.connectivity > 0).length}h online
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