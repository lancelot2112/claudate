import { EventEmitter } from 'events';
import { ChartGenerator, ChartData } from '../charts/ChartGenerator';
import { MediaAttachment } from '../../types/Communication';
import logger from '../../utils/logger';

export interface DashboardMetric {
  id: string;
  name: string;
  value: number;
  previousValue?: number;
  unit?: string;
  target?: number;
  threshold?: {
    warning: number;
    critical: number;
  };
  trend?: 'up' | 'down' | 'stable';
  lastUpdated: Date;
}

export interface DashboardPanel {
  id: string;
  title: string;
  type: 'metric' | 'chart' | 'status' | 'table' | 'custom';
  metrics: DashboardMetric[];
  chartConfig?: {
    type: 'bar' | 'line' | 'pie' | 'doughnut';
    timeRange?: string;
    refreshInterval?: number;
  };
  position: {
    row: number;
    col: number;
    width: number;
    height: number;
  };
  visible: boolean;
  lastRefreshed: Date;
}

export interface DashboardConfig {
  id: string;
  name: string;
  description?: string;
  panels: DashboardPanel[];
  refreshInterval: number; // milliseconds
  autoRefresh: boolean;
  layout: {
    columns: number;
    rows: number;
  };
  theme: 'light' | 'dark' | 'executive';
  mobileOptimized: boolean;
  alertThresholds: {
    warning: number;
    critical: number;
  };
}

export interface DashboardSnapshot {
  id: string;
  dashboardId: string;
  timestamp: Date;
  metrics: DashboardMetric[];
  charts: MediaAttachment[];
  metadata: {
    generatedBy: string;
    version: string;
    performance: {
      generationTime: number;
      totalSize: number;
    };
  };
}

export class RealTimeDashboard extends EventEmitter {
  private metrics: Map<string, DashboardMetric> = new Map();
  private panels: Map<string, DashboardPanel> = new Map();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor(private config: DashboardConfig) {
    super();
    this.initializePanels();
  }

  private initializePanels(): void {
    for (const panel of this.config.panels) {
      this.panels.set(panel.id, panel);
      
      // Initialize metrics for this panel
      for (const metric of panel.metrics) {
        this.metrics.set(metric.id, metric);
      }
    }
    
    logger.info('Real-time dashboard initialized', {
      dashboardId: this.config.id,
      panelCount: this.panels.size,
      metricCount: this.metrics.size,
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Dashboard already running', { dashboardId: this.config.id });
      return;
    }

    try {
      this.isRunning = true;
      
      // Start auto-refresh if enabled
      if (this.config.autoRefresh) {
        this.startAutoRefresh();
      }

      // Generate initial dashboard
      await this.refreshDashboard();

      this.emit('started', { dashboardId: this.config.id });
      logger.info('Real-time dashboard started', { dashboardId: this.config.id });
    } catch (error) {
      this.isRunning = false;
      logger.error('Failed to start dashboard', {
        dashboardId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.stopAutoRefresh();

    this.emit('stopped', { dashboardId: this.config.id });
    logger.info('Real-time dashboard stopped', { dashboardId: this.config.id });
  }

  private startAutoRefresh(): void {
    const refreshTimer = setInterval(() => {
      this.refreshDashboard().catch(error => {
        logger.error('Auto-refresh failed', {
          dashboardId: this.config.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }, this.config.refreshInterval);

    this.refreshTimers.set('main', refreshTimer);

    // Start individual panel refresh timers if specified
    for (const panel of this.panels.values()) {
      if (panel.chartConfig?.refreshInterval && panel.chartConfig.refreshInterval !== this.config.refreshInterval) {
        const panelTimer = setInterval(() => {
          this.refreshPanel(panel.id).catch(error => {
            logger.error('Panel auto-refresh failed', {
              dashboardId: this.config.id,
              panelId: panel.id,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }, panel.chartConfig.refreshInterval);

        this.refreshTimers.set(panel.id, panelTimer);
      }
    }
  }

  private stopAutoRefresh(): void {
    for (const [timerId, timer] of this.refreshTimers) {
      clearInterval(timer);
      this.refreshTimers.delete(timerId);
    }
  }

  async updateMetric(metricId: string, value: number, metadata?: Partial<DashboardMetric>): Promise<void> {
    const metric = this.metrics.get(metricId);
    if (!metric) {
      logger.warn('Metric not found for update', { metricId, dashboardId: this.config.id });
      return;
    }

    const previousValue = metric.value;
    const updatedMetric: DashboardMetric = {
      ...metric,
      previousValue,
      value,
      lastUpdated: new Date(),
      trend: this.calculateTrend(value, previousValue),
      ...metadata,
    };

    this.metrics.set(metricId, updatedMetric);

    // Check for threshold violations
    await this.checkThresholds(updatedMetric);

    // Emit metric update event
    this.emit('metricUpdated', {
      dashboardId: this.config.id,
      metric: updatedMetric,
      previousValue,
    });

    logger.debug('Metric updated', {
      dashboardId: this.config.id,
      metricId,
      value,
      previousValue,
      trend: updatedMetric.trend,
    });
  }

  private calculateTrend(currentValue: number, previousValue?: number): 'up' | 'down' | 'stable' {
    if (!previousValue) return 'stable';
    
    const changePercent = ((currentValue - previousValue) / previousValue) * 100;
    
    if (Math.abs(changePercent) < 1) return 'stable';
    return changePercent > 0 ? 'up' : 'down';
  }

  private async checkThresholds(metric: DashboardMetric): Promise<void> {
    if (!metric.threshold) return;

    const { warning, critical } = metric.threshold;
    
    if (metric.value >= critical) {
      this.emit('alert', {
        level: 'critical',
        dashboardId: this.config.id,
        metric,
        message: `Critical threshold exceeded: ${metric.name} = ${metric.value}`,
      });
    } else if (metric.value >= warning) {
      this.emit('alert', {
        level: 'warning',
        dashboardId: this.config.id,
        metric,
        message: `Warning threshold exceeded: ${metric.name} = ${metric.value}`,
      });
    }
  }

  async refreshDashboard(): Promise<DashboardSnapshot> {
    const startTime = Date.now();
    
    try {
      const charts: MediaAttachment[] = [];
      const currentMetrics = Array.from(this.metrics.values());

      // Generate charts for each panel
      for (const panel of this.panels.values()) {
        if (panel.visible && panel.type === 'chart' && panel.chartConfig) {
          const chart = await this.generatePanelChart(panel);
          if (chart) {
            charts.push(chart);
          }
        }
      }

      const snapshot: DashboardSnapshot = {
        id: `snapshot_${Date.now()}`,
        dashboardId: this.config.id,
        timestamp: new Date(),
        metrics: currentMetrics,
        charts,
        metadata: {
          generatedBy: 'real-time-dashboard',
          version: '1.0',
          performance: {
            generationTime: Date.now() - startTime,
            totalSize: charts.reduce((sum, chart) => sum + chart.size, 0),
          },
        },
      };

      this.emit('refreshed', {
        dashboardId: this.config.id,
        snapshot,
      });

      logger.info('Dashboard refreshed', {
        dashboardId: this.config.id,
        metricCount: currentMetrics.length,
        chartCount: charts.length,
        generationTime: snapshot.metadata.performance.generationTime,
      });

      return snapshot;
    } catch (error) {
      logger.error('Dashboard refresh failed', {
        dashboardId: this.config.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async refreshPanel(panelId: string): Promise<MediaAttachment | null> {
    const panel = this.panels.get(panelId);
    if (!panel || !panel.visible) {
      return null;
    }

    try {
      const chart = await this.generatePanelChart(panel);
      
      if (chart) {
        panel.lastRefreshed = new Date();
        this.emit('panelRefreshed', {
          dashboardId: this.config.id,
          panelId,
          chart,
        });
      }

      return chart;
    } catch (error) {
      logger.error('Panel refresh failed', {
        dashboardId: this.config.id,
        panelId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async generatePanelChart(panel: DashboardPanel): Promise<MediaAttachment | null> {
    if (!panel.chartConfig || panel.metrics.length === 0) {
      return null;
    }

    try {
      const chartData: ChartData = {
        labels: panel.metrics.map(m => m.name),
        datasets: [{
          label: panel.title,
          data: panel.metrics.map(m => m.value),
          backgroundColor: this.getChartColors(panel.metrics),
          borderColor: this.getChartBorderColors(panel.metrics),
          borderWidth: 1,
        }],
      };

      const chart = await ChartGenerator.generateChart(chartData, {
        type: panel.chartConfig.type,
        title: panel.title,
        width: panel.position.width * 200, // Scale based on panel width
        height: panel.position.height * 150, // Scale based on panel height
        theme: this.config.theme === 'dark' ? 'dark' : 'light',
        mobileOptimized: this.config.mobileOptimized,
      });

      return chart;
    } catch (error) {
      logger.error('Panel chart generation failed', {
        dashboardId: this.config.id,
        panelId: panel.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private getChartColors(metrics: DashboardMetric[]): string[] {
    return metrics.map(metric => {
      if (metric.threshold) {
        if (metric.value >= metric.threshold.critical) {
          return '#ef4444'; // Red for critical
        } else if (metric.value >= metric.threshold.warning) {
          return '#f59e0b'; // Orange for warning
        }
      }
      return '#10b981'; // Green for normal
    });
  }

  private getChartBorderColors(metrics: DashboardMetric[]): string[] {
    return this.getChartColors(metrics).map(color => color);
  }

  async generateExecutiveSummary(): Promise<MediaAttachment> {
    const summaryMetrics: Record<string, number> = {};
    
    // Aggregate key metrics
    for (const metric of this.metrics.values()) {
      summaryMetrics[metric.name] = metric.value;
    }

    return await ChartGenerator.generateExecutiveDashboard(summaryMetrics, {
      title: `${this.config.name} - Executive Summary`,
      mobileOptimized: this.config.mobileOptimized,
      theme: this.config.theme === 'dark' ? 'dark' : 'light',
    });
  }

  async exportSnapshot(format: 'json' | 'csv' = 'json'): Promise<string> {
    const snapshot = await this.refreshDashboard();
    
    if (format === 'json') {
      return JSON.stringify(snapshot, null, 2);
    } else if (format === 'csv') {
      // Convert metrics to CSV
      const headers = ['Metric', 'Value', 'Previous Value', 'Trend', 'Last Updated'];
      const rows = snapshot.metrics.map(m => [
        m.name,
        m.value.toString(),
        m.previousValue?.toString() || '',
        m.trend || '',
        m.lastUpdated.toISOString(),
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    throw new Error(`Unsupported export format: ${format}`);
  }

  getMetric(metricId: string): DashboardMetric | undefined {
    return this.metrics.get(metricId);
  }

  getPanel(panelId: string): DashboardPanel | undefined {
    return this.panels.get(panelId);
  }

  getAllMetrics(): DashboardMetric[] {
    return Array.from(this.metrics.values());
  }

  getAllPanels(): DashboardPanel[] {
    return Array.from(this.panels.values());
  }

  updateConfig(newConfig: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isRunning && newConfig.refreshInterval) {
      this.stopAutoRefresh();
      this.startAutoRefresh();
    }
    
    logger.info('Dashboard config updated', {
      dashboardId: this.config.id,
      changes: Object.keys(newConfig),
    });
  }

  getStatus(): {
    running: boolean;
    metricCount: number;
    panelCount: number;
    lastRefresh?: Date;
    nextRefresh?: Date;
  } {
    return {
      running: this.isRunning,
      metricCount: this.metrics.size,
      panelCount: this.panels.size,
      lastRefresh: this.config.panels[0]?.lastRefreshed,
      nextRefresh: this.isRunning ? new Date(Date.now() + this.config.refreshInterval) : undefined,
    };
  }
}

/**
 * Dashboard factory for common dashboard types
 */
export class DashboardFactory {
  static createSystemHealthDashboard(): DashboardConfig {
    return {
      id: 'system-health',
      name: 'System Health Dashboard',
      description: 'Real-time system health monitoring',
      refreshInterval: 30000, // 30 seconds
      autoRefresh: true,
      layout: { columns: 4, rows: 3 },
      theme: 'executive',
      mobileOptimized: true,
      alertThresholds: { warning: 80, critical: 95 },
      panels: [
        {
          id: 'cpu-usage',
          title: 'CPU Usage',
          type: 'metric',
          metrics: [{
            id: 'cpu-percent',
            name: 'CPU %',
            value: 0,
            unit: '%',
            threshold: { warning: 80, critical: 95 },
            lastUpdated: new Date(),
          }],
          position: { row: 0, col: 0, width: 1, height: 1 },
          visible: true,
          lastRefreshed: new Date(),
        },
        {
          id: 'memory-usage',
          title: 'Memory Usage',
          type: 'metric',
          metrics: [{
            id: 'memory-percent',
            name: 'Memory %',
            value: 0,
            unit: '%',
            threshold: { warning: 85, critical: 95 },
            lastUpdated: new Date(),
          }],
          position: { row: 0, col: 1, width: 1, height: 1 },
          visible: true,
          lastRefreshed: new Date(),
        },
        {
          id: 'response-times',
          title: 'Response Times',
          type: 'chart',
          metrics: [{
            id: 'avg-response-time',
            name: 'Avg Response Time',
            value: 0,
            unit: 'ms',
            threshold: { warning: 1000, critical: 2000 },
            lastUpdated: new Date(),
          }],
          chartConfig: {
            type: 'line',
            timeRange: '1h',
            refreshInterval: 15000,
          },
          position: { row: 1, col: 0, width: 2, height: 1 },
          visible: true,
          lastRefreshed: new Date(),
        },
      ],
    };
  }

  static createAgentDashboard(): DashboardConfig {
    return {
      id: 'agent-dashboard',
      name: 'Agent Performance Dashboard',
      description: 'Real-time agent performance and utilization',
      refreshInterval: 60000, // 1 minute
      autoRefresh: true,
      layout: { columns: 3, rows: 2 },
      theme: 'executive',
      mobileOptimized: true,
      alertThresholds: { warning: 75, critical: 90 },
      panels: [
        {
          id: 'active-agents',
          title: 'Active Agents',
          type: 'metric',
          metrics: [{
            id: 'agents-active',
            name: 'Active Agents',
            value: 0,
            unit: 'agents',
            lastUpdated: new Date(),
          }],
          position: { row: 0, col: 0, width: 1, height: 1 },
          visible: true,
          lastRefreshed: new Date(),
        },
        {
          id: 'messages-processed',
          title: 'Messages Processed',
          type: 'chart',
          metrics: [{
            id: 'messages-per-hour',
            name: 'Messages/Hour',
            value: 0,
            unit: 'messages',
            lastUpdated: new Date(),
          }],
          chartConfig: {
            type: 'bar',
            timeRange: '24h',
          },
          position: { row: 0, col: 1, width: 2, height: 1 },
          visible: true,
          lastRefreshed: new Date(),
        },
      ],
    };
  }
}

export default RealTimeDashboard;