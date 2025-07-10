'use client';

import { useState, useEffect } from 'react';
import { ChannelStatus } from '@/types/dashboard';

interface MessageFlowDiagramProps {
  channels: ChannelStatus[];
}

interface FlowNode {
  id: string;
  name: string;
  type: string;
  status: string;
  x: number;
  y: number;
  messages: number;
}

interface FlowConnection {
  from: string;
  to: string;
  messages: number;
  active: boolean;
}

export default function MessageFlowDiagram({ channels }: MessageFlowDiagramProps) {
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [connections, setConnections] = useState<FlowConnection[]>([]);
  const [animatedMessages, setAnimatedMessages] = useState<Array<{
    id: string;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    progress: number;
  }>>([]);

  // Initialize nodes and connections
  useEffect(() => {
    // Create nodes from channels
    const flowNodes: FlowNode[] = channels.map((channel, index) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      status: channel.status,
      x: 100 + (index % 4) * 180,
      y: 100 + Math.floor(index / 4) * 150,
      messages: Math.floor(Math.random() * 100) + 10, // Mock message count
    }));

    // Add central router node
    flowNodes.push({
      id: 'router',
      name: 'Message Router',
      type: 'router',
      status: 'connected',
      x: 350,
      y: 250,
      messages: flowNodes.reduce((sum, node) => sum + node.messages, 0),
    });

    // Create connections (simplified flow)
    const flowConnections: FlowConnection[] = channels.map(channel => ({
      from: channel.id,
      to: 'router',
      messages: Math.floor(Math.random() * 50) + 5,
      active: channel.status === 'connected',
    }));

    setNodes(flowNodes);
    setConnections(flowConnections);
  }, [channels]);

  // Animate message flow
  useEffect(() => {
    const interval = setInterval(() => {
      if (connections.length === 0) return;

      const activeConnections = connections.filter(conn => conn.active);
      if (activeConnections.length === 0) return;

      const randomConnection = activeConnections[Math.floor(Math.random() * activeConnections.length)];
      const fromNode = nodes.find(n => n.id === randomConnection.from);
      const toNode = nodes.find(n => n.id === randomConnection.to);

      if (fromNode && toNode) {
        const newMessage = {
          id: `msg-${Date.now()}`,
          fromX: fromNode.x + 60,
          fromY: fromNode.y + 30,
          toX: toNode.x + 60,
          toY: toNode.y + 30,
          progress: 0,
        };

        setAnimatedMessages(prev => [...prev, newMessage]);

        // Animate the message
        const animationInterval = setInterval(() => {
          setAnimatedMessages(prev => 
            prev.map(msg => 
              msg.id === newMessage.id 
                ? { ...msg, progress: Math.min(msg.progress + 0.05, 1) }
                : msg
            )
          );
        }, 50);

        // Remove message after animation
        setTimeout(() => {
          clearInterval(animationInterval);
          setAnimatedMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
        }, 2000);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [nodes, connections]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return '#10B981';
      case 'degraded': return '#F59E0B';
      case 'disconnected': return '#6B7280';
      case 'error': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'sms': return '💬';
      case 'mms': return '📱';
      case 'google-chat': return '💼';
      case 'email': return '📧';
      case 'webhook': return '🔗';
      case 'router': return '🔄';
      default: return '📡';
    }
  };

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4">📡</div>
          <p>No channels available for flow visualization</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-96 bg-gray-50 rounded-lg border overflow-hidden">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 800 400"
        className="absolute inset-0"
      >
        {/* Connection Lines */}
        {connections.map((connection, index) => {
          const fromNode = nodes.find(n => n.id === connection.from);
          const toNode = nodes.find(n => n.id === connection.to);
          
          if (!fromNode || !toNode) return null;

          return (
            <g key={index}>
              <line
                x1={fromNode.x + 60}
                y1={fromNode.y + 30}
                x2={toNode.x + 60}
                y2={toNode.y + 30}
                stroke={connection.active ? '#3B82F6' : '#D1D5DB'}
                strokeWidth={connection.active ? 2 : 1}
                strokeDasharray={connection.active ? 'none' : '5,5'}
                opacity={0.6}
              />
              {/* Message count indicator */}
              {connection.active && (
                <text
                  x={(fromNode.x + toNode.x) / 2 + 60}
                  y={(fromNode.y + toNode.y) / 2 + 25}
                  fill="#3B82F6"
                  fontSize="10"
                  textAnchor="middle"
                  className="font-mono"
                >
                  {connection.messages}/min
                </text>
              )}
            </g>
          );
        })}

        {/* Animated Messages */}
        {animatedMessages.map((message) => {
          const currentX = message.fromX + (message.toX - message.fromX) * message.progress;
          const currentY = message.fromY + (message.toY - message.fromY) * message.progress;
          
          return (
            <circle
              key={message.id}
              cx={currentX}
              cy={currentY}
              r="4"
              fill="#3B82F6"
              opacity={1 - message.progress * 0.5}
            />
          );
        })}
      </svg>

      {/* Channel Nodes */}
      {nodes.map((node) => (
        <div
          key={node.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{ left: node.x + 60, top: node.y + 30 }}
        >
          <div
            className="bg-white rounded-lg shadow-md border-2 p-3 min-w-24 text-center"
            style={{ borderColor: getStatusColor(node.status) }}
          >
            <div className="text-2xl mb-1">{getTypeIcon(node.type)}</div>
            <div className="text-xs font-medium text-gray-900 mb-1 truncate max-w-20">
              {node.name}
            </div>
            <div className="text-xs text-gray-500">
              {node.messages} msg/h
            </div>
            <div
              className="w-2 h-2 rounded-full mx-auto mt-1"
              style={{ backgroundColor: getStatusColor(node.status) }}
            ></div>
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow p-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-900">Status</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Connected</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
            <span>Degraded</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-gray-500"></div>
            <span>Disconnected</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span>Error</span>
          </div>
        </div>
        
        <hr className="my-2" />
        
        <div className="space-y-1 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-blue-500"></div>
            <span>Active Flow</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-gray-300 border-dashed border-t"></div>
            <span>Inactive</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span>Message</span>
          </div>
        </div>
      </div>

      {/* Flow Statistics */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow p-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2">Flow Statistics</h4>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-lg font-bold text-blue-600">
              {connections.filter(c => c.active).length}
            </div>
            <div className="text-gray-600">Active Flows</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-600">
              {nodes.reduce((sum, node) => sum + node.messages, 0)}
            </div>
            <div className="text-gray-600">Msg/Hour</div>
          </div>
        </div>
      </div>
    </div>
  );
}