import { Chart, ChartConfiguration, ChartOptions } from 'chart.js/auto';
import { createCanvas } from 'canvas';
import { promises as fs } from 'fs';
import path from 'path';
import { MediaAttachment } from '@/types/Communication';
import { visualLogger } from '@/utils/logger';

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }>;
}

export interface ChartGenerationOptions {
  width: number;
  height: number;
  type: 'bar' | 'line' | 'pie' | 'doughnut';
  title?: string;
  theme: 'light' | 'dark';
  mobileOptimized: boolean;
  outputPath?: string;
}

export class ChartGenerator {
  private static readonly DEFAULT_OPTIONS: ChartGenerationOptions = {
    width: 800,
    height: 600,
    type: 'bar',
    theme: 'light',
    mobileOptimized: true,
  };

  private static readonly MOBILE_OPTIONS: ChartGenerationOptions = {
    width: 600,
    height: 400,
    type: 'bar',
    theme: 'light',
    mobileOptimized: true,
  };

  private static readonly EXECUTIVE_COLORS = {
    primary: '#2563eb',
    secondary: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    success: '#22c55e',
    muted: '#6b7280',
  };

  public static async generateChart(
    data: ChartData,
    options: Partial<ChartGenerationOptions> = {}
  ): Promise<MediaAttachment> {
    const config: ChartGenerationOptions = {
      ...this.DEFAULT_OPTIONS,
      ...(options.mobileOptimized ? this.MOBILE_OPTIONS : {}),
      ...options,
    };

    try {
      visualLogger.info('Generating chart', {
        type: config.type,
        width: config.width,
        height: config.height,
        mobileOptimized: config.mobileOptimized,
      });

      const chartConfig = this.buildChartConfig(data, config);
      const canvas = createCanvas(config.width, config.height);
      const ctx = canvas.getContext('2d');

      const chart = new Chart(ctx, chartConfig);

      // Generate unique filename
      const filename = `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
      const outputDir = config.outputPath || path.join(process.cwd(), 'temp', 'charts');
      
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });
      
      const filePath = path.join(outputDir, filename);
      
      // Save chart as PNG
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(filePath, buffer);

      // Clean up chart
      chart.destroy();

      const attachment: MediaAttachment = {
        id: `chart_${Date.now()}`,
        type: 'chart',
        url: filePath,
        filename,
        size: buffer.length,
        mimeType: 'image/png',
        metadata: {
          chartType: config.type,
          width: config.width,
          height: config.height,
          theme: config.theme,
          generatedAt: new Date().toISOString(),
        },
      };

      visualLogger.info('Chart generated successfully', {
        chartId: attachment.id,
        filename,
        size: buffer.length,
        path: filePath,
      });

      return attachment;
    } catch (error) {
      visualLogger.error('Chart generation failed', {
        error: (error as Error).message,
        options: config,
      });
      throw error;
    }
  }

  public static async generateExecutiveDashboard(
    metrics: Record<string, number>,
    options: Partial<ChartGenerationOptions> = {}
  ): Promise<MediaAttachment> {
    const data: ChartData = {
      labels: Object.keys(metrics),
      datasets: [{
        label: 'Metrics',
        data: Object.values(metrics),
        backgroundColor: this.getExecutiveColors(Object.keys(metrics)),
        borderColor: this.EXECUTIVE_COLORS.primary,
        borderWidth: 1,
      }],
    };

    return await this.generateChart(data, {
      type: 'bar',
      title: 'Executive Dashboard',
      mobileOptimized: true,
      ...options,
    });
  }

  public static async generateTrendChart(
    timeSeriesData: Array<{ label: string; value: number }>,
    options: Partial<ChartGenerationOptions> = {}
  ): Promise<MediaAttachment> {
    const data: ChartData = {
      labels: timeSeriesData.map(d => d.label),
      datasets: [{
        label: 'Trend',
        data: timeSeriesData.map(d => d.value),
        backgroundColor: this.EXECUTIVE_COLORS.primary,
        borderColor: this.EXECUTIVE_COLORS.primary,
        borderWidth: 2,
      }],
    };

    return await this.generateChart(data, {
      type: 'line',
      title: 'Trend Analysis',
      mobileOptimized: true,
      ...options,
    });
  }

  public static async generateStatusChart(
    statusData: Record<string, number>,
    options: Partial<ChartGenerationOptions> = {}
  ): Promise<MediaAttachment> {
    const data: ChartData = {
      labels: Object.keys(statusData),
      datasets: [{
        label: 'Status Distribution',
        data: Object.values(statusData),
        backgroundColor: this.getStatusColors(Object.keys(statusData)),
        borderWidth: 1,
      }],
    };

    return await this.generateChart(data, {
      type: 'doughnut',
      title: 'Status Overview',
      mobileOptimized: true,
      ...options,
    });
  }

  private static buildChartConfig(
    data: ChartData,
    options: ChartGenerationOptions
  ): ChartConfiguration {
    const baseOptions: ChartOptions = {
      responsive: false,
      plugins: {
        title: {
          display: !!options.title,
          text: options.title,
          font: {
            size: options.mobileOptimized ? 14 : 16,
            weight: 'bold',
          },
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            font: {
              size: options.mobileOptimized ? 10 : 12,
            },
          },
        },
      },
      scales: this.getScaleConfig(options),
    };

    // Apply theme
    if (options.theme === 'dark') {
      this.applyDarkTheme(baseOptions);
    }

    return {
      type: options.type,
      data,
      options: baseOptions,
    };
  }

  private static getScaleConfig(options: ChartGenerationOptions): any {
    if (options.type === 'pie' || options.type === 'doughnut') {
      return {}; // No scales for pie/doughnut charts
    }

    return {
      x: {
        ticks: {
          font: {
            size: options.mobileOptimized ? 10 : 12,
          },
        },
      },
      y: {
        ticks: {
          font: {
            size: options.mobileOptimized ? 10 : 12,
          },
        },
      },
    };
  }

  private static applyDarkTheme(options: ChartOptions): void {
    // Apply dark theme colors
    if (options.plugins?.title) {
      options.plugins.title.color = '#ffffff';
    }
    if (options.plugins?.legend?.labels) {
      options.plugins.legend.labels.color = '#ffffff';
    }
    if (options.scales?.x?.ticks) {
      options.scales.x.ticks.color = '#ffffff';
    }
    if (options.scales?.y?.ticks) {
      options.scales.y.ticks.color = '#ffffff';
    }
  }

  private static getExecutiveColors(labels: (string | undefined)[]): string[] {
    const colors: string[] = Object.values(this.EXECUTIVE_COLORS);
    const validLabels = labels.filter((label): label is string => label !== undefined);
    return validLabels.map((_, index) => colors[index % colors.length]!);
  }

  private static getStatusColors(statuses: string[]): string[] {
    const statusColorMap: Record<string, string> = {
      success: this.EXECUTIVE_COLORS.success,
      completed: this.EXECUTIVE_COLORS.success,
      active: this.EXECUTIVE_COLORS.primary,
      pending: this.EXECUTIVE_COLORS.warning,
      warning: this.EXECUTIVE_COLORS.warning,
      failed: this.EXECUTIVE_COLORS.danger,
      error: this.EXECUTIVE_COLORS.danger,
      inactive: this.EXECUTIVE_COLORS.muted,
    };

    return statuses.map(status => 
      statusColorMap[status.toLowerCase()] || this.EXECUTIVE_COLORS.info
    );
  }

  // Executive briefing specific charts
  public static async generateCommunicationMetrics(
    metrics: {
      totalMessages: number;
      successfulDeliveries: number;
      failedDeliveries: number;
      averageResponseTime: number;
    },
    options: Partial<ChartGenerationOptions> = {}
  ): Promise<MediaAttachment> {
    const deliveryData: ChartData = {
      labels: ['Successful', 'Failed'],
      datasets: [{
        label: 'Message Delivery',
        data: [metrics.successfulDeliveries, metrics.failedDeliveries],
        backgroundColor: [
          this.EXECUTIVE_COLORS.success,
          this.EXECUTIVE_COLORS.danger,
        ],
        borderWidth: 1,
      }],
    };

    return await this.generateChart(deliveryData, {
      type: 'doughnut',
      title: 'Communication Metrics',
      mobileOptimized: true,
      ...options,
    });
  }

  public static async generateAgentUtilization(
    agentMetrics: Record<string, { active: number; total: number }>,
    options: Partial<ChartGenerationOptions> = {}
  ): Promise<MediaAttachment> {
    const data: ChartData = {
      labels: Object.keys(agentMetrics),
      datasets: [{
        label: 'Active Agents',
        data: Object.values(agentMetrics).map(m => m.active),
        backgroundColor: this.EXECUTIVE_COLORS.primary,
        borderColor: this.EXECUTIVE_COLORS.primary,
        borderWidth: 1,
      }, {
        label: 'Total Agents',
        data: Object.values(agentMetrics).map(m => m.total),
        backgroundColor: this.EXECUTIVE_COLORS.muted,
        borderColor: this.EXECUTIVE_COLORS.muted,
        borderWidth: 1,
      }],
    };

    return await this.generateChart(data, {
      type: 'bar',
      title: 'Agent Utilization',
      mobileOptimized: true,
      ...options,
    });
  }

  // Cleanup utility
  public static async cleanupTempCharts(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp', 'charts');
    
    try {
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          visualLogger.info('Cleaned up old chart file', { file });
        }
      }
    } catch (error) {
      visualLogger.error('Chart cleanup failed', {
        error: (error as Error).message,
      });
    }
  }
}

// Executive briefing chart presets
export class ExecutiveBriefingCharts {
  public static async generateDaily(
    metrics: {
      messagesProcessed: number;
      agentsActive: number;
      successRate: number;
      averageResponseTime: number;
    }
  ): Promise<MediaAttachment> {
    const data = {
      'Messages': metrics.messagesProcessed,
      'Active Agents': metrics.agentsActive,
      'Success Rate %': Math.round(metrics.successRate * 100),
      'Avg Response (min)': Math.round(metrics.averageResponseTime / 60000),
    };

    return await ChartGenerator.generateExecutiveDashboard(data, {
      title: 'Daily Operations Summary',
      mobileOptimized: true,
      theme: 'light',
    });
  }

  public static async generateWeekly(
    dailyData: Array<{
      date: string;
      messages: number;
      agents: number;
      successRate: number;
    }>
  ): Promise<MediaAttachment> {
    const timeSeriesData = dailyData.map(d => ({
      label: d.date,
      value: d.messages,
    }));

    return await ChartGenerator.generateTrendChart(timeSeriesData, {
      title: 'Weekly Message Volume',
      mobileOptimized: true,
      theme: 'light',
    });
  }

  public static async generateSystemHealth(
    healthData: {
      healthy: number;
      degraded: number;
      failed: number;
    }
  ): Promise<MediaAttachment> {
    return await ChartGenerator.generateStatusChart(healthData, {
      title: 'System Health Status',
      mobileOptimized: true,
      theme: 'light',
    });
  }
}