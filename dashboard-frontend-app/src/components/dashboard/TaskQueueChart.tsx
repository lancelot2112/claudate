'use client';

import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface TaskQueueChartProps {
  data?: {
    byStatus: {
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
    performance: {
      completionRate: number;
      throughput: number;
    };
  };
}

export default function TaskQueueChart({ data }: TaskQueueChartProps) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Loading task data...
      </div>
    );
  }

  const chartData = {
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

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 20,
          usePointStyle: true,
        },
      },
    },
  };

  return (
    <div className="space-y-4">
      <div className="h-48">
        <Doughnut data={chartData} options={options} />
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">
            {(data.performance.completionRate * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Completion Rate</div>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-600">
            {data.performance.throughput.toFixed(1)}
          </div>
          <div className="text-sm text-gray-600">Tasks/Hour</div>
        </div>
      </div>
    </div>
  );
}