'use client';

import { useState, useEffect, useMemo } from 'react';
import { TaskInfo } from '@/types/dashboard';

interface TaskQueueVisualizationProps {
  tasks: TaskInfo[];
}

interface QueueLane {
  id: string;
  name: string;
  priority: 'high' | 'medium' | 'low';
  tasks: TaskInfo[];
  color: string;
}

export default function TaskQueueVisualization({ tasks }: TaskQueueVisualizationProps) {
  const [animatedTasks, setAnimatedTasks] = useState<Array<{
    id: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    priority: string;
  }>>([]);

  // Organize tasks into priority lanes
  const queueLanes: QueueLane[] = useMemo(() => [
    {
      id: 'high',
      name: 'High Priority',
      priority: 'high',
      tasks: tasks.filter(task => task.priority === 'high' && task.status === 'pending'),
      color: '#EF4444',
    },
    {
      id: 'medium',
      name: 'Medium Priority',
      priority: 'medium',
      tasks: tasks.filter(task => task.priority === 'medium' && task.status === 'pending'),
      color: '#F59E0B',
    },
    {
      id: 'low',
      name: 'Low Priority',
      priority: 'low',
      tasks: tasks.filter(task => task.priority === 'low' && task.status === 'pending'),
      color: '#10B981',
    },
  ], [tasks]);

  // Processing area
  const processingTasks = tasks.filter(task => task.status === 'processing');
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const failedTasks = tasks.filter(task => task.status === 'failed');

  // Animate tasks moving through the queue
  useEffect(() => {
    const interval = setInterval(() => {
      if (queueLanes.some(lane => lane.tasks.length > 0)) {
        // Simulate task movement
        const availableLanes = queueLanes.filter(lane => lane.tasks.length > 0);
        if (availableLanes.length > 0) {
          const randomLane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
          const task = randomLane.tasks[0];
          
          if (task) {
            const newAnimatedTask = {
              id: task.id,
              x: 50 + queueLanes.indexOf(randomLane) * 150,
              y: 100,
              targetX: 500, // Processing area
              targetY: 200,
              priority: task.priority,
            };

            setAnimatedTasks(prev => [...prev, newAnimatedTask]);

            // Remove after animation
            setTimeout(() => {
              setAnimatedTasks(prev => prev.filter(t => t.id !== task.id));
            }, 3000);
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [queueLanes]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return '⏸️';
      case 'processing': return '⏳';
      case 'completed': return '✅';
      case 'failed': return '❌';
      default: return '❓';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <div className="space-y-6">
      {/* Queue Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="text-2xl font-bold text-yellow-700">
            {queueLanes.reduce((sum, lane) => sum + lane.tasks.length, 0)}
          </div>
          <div className="text-sm text-yellow-600">Tasks in Queue</div>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="text-2xl font-bold text-blue-700">{processingTasks.length}</div>
          <div className="text-sm text-blue-600">Processing</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-700">{completedTasks.length}</div>
          <div className="text-sm text-green-600">Completed</div>
        </div>
        
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="text-2xl font-bold text-red-700">{failedTasks.length}</div>
          <div className="text-sm text-red-600">Failed</div>
        </div>
      </div>

      {/* Queue Visualization */}
      <div className="relative bg-gray-50 rounded-lg border p-6 overflow-hidden" style={{ height: '500px' }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1000 400"
          className="absolute inset-0"
        >
          {/* Background Lanes */}
          {queueLanes.map((lane, index) => (
            <g key={lane.id}>
              {/* Lane Background */}
              <rect
                x={20 + index * 150}
                y={50}
                width={120}
                height={150}
                fill={lane.color}
                fillOpacity={0.1}
                stroke={lane.color}
                strokeWidth={2}
                strokeDasharray="5,5"
                rx={8}
              />
              
              {/* Lane Label */}
              <text
                x={80 + index * 150}
                y={35}
                textAnchor="middle"
                fontSize="14"
                fontWeight="bold"
                fill={lane.color}
              >
                {lane.name}
              </text>
              
              {/* Task Count */}
              <text
                x={80 + index * 150}
                y={220}
                textAnchor="middle"
                fontSize="12"
                fill="#6B7280"
              >
                {lane.tasks.length} tasks
              </text>
            </g>
          ))}

          {/* Processing Area */}
          <rect
            x={500}
            y={50}
            width={150}
            height={150}
            fill="#3B82F6"
            fillOpacity={0.1}
            stroke="#3B82F6"
            strokeWidth={2}
            rx={8}
          />
          <text
            x={575}
            y={35}
            textAnchor="middle"
            fontSize="14"
            fontWeight="bold"
            fill="#3B82F6"
          >
            Processing
          </text>
          <text
            x={575}
            y={220}
            textAnchor="middle"
            fontSize="12"
            fill="#6B7280"
          >
            {processingTasks.length} active
          </text>

          {/* Completed Area */}
          <rect
            x={700}
            y={50}
            width={120}
            height={150}
            fill="#10B981"
            fillOpacity={0.1}
            stroke="#10B981"
            strokeWidth={2}
            rx={8}
          />
          <text
            x={760}
            y={35}
            textAnchor="middle"
            fontSize="14"
            fontWeight="bold"
            fill="#10B981"
          >
            Completed
          </text>
          <text
            x={760}
            y={220}
            textAnchor="middle"
            fontSize="12"
            fill="#6B7280"
          >
            {completedTasks.length} done
          </text>

          {/* Failed Area */}
          <rect
            x={850}
            y={50}
            width={120}
            height={150}
            fill="#EF4444"
            fillOpacity={0.1}
            stroke="#EF4444"
            strokeWidth={2}
            rx={8}
          />
          <text
            x={910}
            y={35}
            textAnchor="middle"
            fontSize="14"
            fontWeight="bold"
            fill="#EF4444"
          >
            Failed
          </text>
          <text
            x={910}
            y={220}
            textAnchor="middle"
            fontSize="12"
            fill="#6B7280"
          >
            {failedTasks.length} failed
          </text>

          {/* Flow Arrows */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6B7280"
              />
            </marker>
          </defs>
          
          {/* Arrows showing flow */}
          <line
            x1={470}
            y1={125}
            x2={490}
            y2={125}
            stroke="#6B7280"
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
          />
          <line
            x1={660}
            y1={125}
            x2={690}
            y2={125}
            stroke="#6B7280"
            strokeWidth={2}
            markerEnd="url(#arrowhead)"
          />
          <line
            x1={575}
            y1={210}
            x2={910}
            y2={210}
            stroke="#EF4444"
            strokeWidth={1}
            strokeDasharray="3,3"
            markerEnd="url(#arrowhead)"
          />

          {/* Animated Tasks */}
          {animatedTasks.map((task) => (
            <g key={task.id}>
              <circle
                cx={task.x + (task.targetX - task.x) * ((Date.now() % 3000) / 3000)}
                cy={task.y + (task.targetY - task.y) * ((Date.now() % 3000) / 3000)}
                r="8"
                fill={task.priority === 'high' ? '#EF4444' : task.priority === 'medium' ? '#F59E0B' : '#10B981'}
                opacity={0.8}
              />
            </g>
          ))}
        </svg>

        {/* Static Task Representations */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Queue Tasks */}
          {queueLanes.map((lane, laneIndex) => (
            <div key={lane.id} className="absolute" style={{ left: 40 + laneIndex * 150, top: 70 }}>
              <div className="space-y-2">
                {lane.tasks.slice(0, 6).map((task, taskIndex) => (
                  <div
                    key={task.id}
                    className="w-20 h-6 bg-white rounded shadow-sm border flex items-center justify-center text-xs"
                    style={{ 
                      borderLeftColor: lane.color,
                      borderLeftWidth: '3px',
                      marginTop: taskIndex * 20,
                      opacity: Math.max(0.3, 1 - taskIndex * 0.15)
                    }}
                  >
                    <span className="mr-1">{getPriorityIcon(task.priority)}</span>
                    <span className="truncate">{task.type.slice(0, 6)}</span>
                  </div>
                ))}
                {lane.tasks.length > 6 && (
                  <div className="text-xs text-gray-500 text-center">
                    +{lane.tasks.length - 6} more
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Processing Tasks */}
          <div className="absolute" style={{ left: 520, top: 70 }}>
            <div className="space-y-2">
              {processingTasks.slice(0, 6).map((task, index) => (
                <div
                  key={task.id}
                  className="w-24 h-6 bg-blue-100 rounded shadow-sm border border-blue-300 flex items-center justify-center text-xs"
                  style={{ marginTop: index * 20 }}
                >
                  <span className="mr-1">{getStatusIcon(task.status)}</span>
                  <span className="truncate">{task.type.slice(0, 8)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow p-4 text-xs">
          <h4 className="font-semibold text-gray-900 mb-2">Queue Flow</h4>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>High Priority</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>Medium Priority</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Low Priority</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow p-4 text-xs">
          <h4 className="font-semibold text-gray-900 mb-2">Queue Stats</h4>
          <div className="space-y-1">
            <div>
              Avg Wait Time: {Math.floor(Math.random() * 30 + 5)} min
            </div>
            <div>
              Throughput: {Math.floor(Math.random() * 20 + 10)} tasks/hour
            </div>
            <div>
              Queue Depth: {queueLanes.reduce((sum, lane) => sum + lane.tasks.length, 0)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}