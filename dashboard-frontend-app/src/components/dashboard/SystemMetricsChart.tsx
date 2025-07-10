'use client';

import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface SystemMetricsChartProps {
  data?: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
}

export default function SystemMetricsChart({ data }: SystemMetricsChartProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading system metrics...
      </div>
    );
  }

  const chartData = {
    labels: ['CPU', 'Memory', 'Disk', 'Network'],
    datasets: [
      {
        label: 'Usage %',
        data: [
          Math.round(data.cpu),
          Math.round(data.memory),
          Math.round(data.disk),
          Math.round(data.network),
        ],
        backgroundColor: [
          data.cpu > 80 ? '#EF4444' : data.cpu > 60 ? '#F59E0B' : '#10B981',
          data.memory > 80 ? '#EF4444' : data.memory > 60 ? '#F59E0B' : '#10B981',
          data.disk > 80 ? '#EF4444' : data.disk > 60 ? '#F59E0B' : '#10B981',
          data.network > 80 ? '#EF4444' : data.network > 60 ? '#F59E0B' : '#10B981',
        ],
        borderRadius: 4,
      },
    ],
  };

  const options = {
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
        max: 100,
        ticks: {
          callback: function(value: unknown) {
            return value + '%';
          },
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="h-48">
        <Bar data={chartData} options={options} />
      </div>
      
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className={`p-2 rounded ${data.cpu > 80 ? 'bg-red-50 text-red-700' : data.cpu > 60 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
          CPU: {Math.round(data.cpu)}%
        </div>
        <div className={`p-2 rounded ${data.memory > 80 ? 'bg-red-50 text-red-700' : data.memory > 60 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
          Memory: {Math.round(data.memory)}%
        </div>
        <div className={`p-2 rounded ${data.disk > 80 ? 'bg-red-50 text-red-700' : data.disk > 60 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
          Disk: {Math.round(data.disk)}%
        </div>
        <div className={`p-2 rounded ${data.network > 80 ? 'bg-red-50 text-red-700' : data.network > 60 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
          Network: {Math.round(data.network)}%
        </div>
      </div>
    </div>
  );
}