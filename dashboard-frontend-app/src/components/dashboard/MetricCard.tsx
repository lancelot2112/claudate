'use client';

import clsx from 'clsx';

interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  isText?: boolean;
}

const colorClasses = {
  blue: 'text-blue-600 bg-blue-50',
  green: 'text-green-600 bg-green-50', 
  yellow: 'text-yellow-600 bg-yellow-50',
  red: 'text-red-600 bg-red-50',
  gray: 'text-gray-600 bg-gray-50',
};

const trendIcons = {
  up: '↗️',
  down: '↘️',
  stable: '→',
};

export default function MetricCard({
  title,
  value,
  subtitle,
  trend,
  color = 'gray',
  isText = false,
}: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="mt-2 flex items-baseline">
            <p className={clsx(
              'text-2xl font-semibold',
              isText ? 'text-gray-900' : colorClasses[color].split(' ')[0]
            )}>
              {value}
            </p>
            {trend && (
              <span className="ml-2 text-lg">{trendIcons[trend]}</span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
          )}
        </div>
        
        <div className={clsx(
          'p-3 rounded-full',
          colorClasses[color]
        )}>
          <div className="w-6 h-6 flex items-center justify-center">
            {color === 'blue' && '🤖'}
            {color === 'green' && '📡'}
            {color === 'yellow' && '⏳'}
            {color === 'red' && '⚠️'}
            {color === 'gray' && '📊'}
          </div>
        </div>
      </div>
    </div>
  );
}