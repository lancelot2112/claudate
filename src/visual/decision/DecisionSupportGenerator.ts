import { createCanvas, Canvas } from 'canvas';
import { promises as fs } from 'fs';
import path from 'path';
import { MediaAttachment } from '../../types/Communication';
import logger from '../../utils/logger';

export interface RiskItem {
  id: string;
  title: string;
  description: string;
  probability: number; // 0-1 (0-100%)
  impact: number; // 0-1 (0-100%)
  category?: string;
  mitigation?: string;
  owner?: string;
  status: 'identified' | 'mitigating' | 'resolved' | 'accepted';
  lastUpdated: Date;
}

export interface DecisionOption {
  id: string;
  title: string;
  description: string;
  pros: string[];
  cons: string[];
  cost?: number;
  timeframe?: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number; // 0-1
  recommendation?: boolean;
  impact: {
    financial?: number;
    operational?: number;
    strategic?: number;
    timeline?: number;
  };
}

export interface DecisionContext {
  id: string;
  title: string;
  description: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  stakeholders: string[];
  deadline?: Date;
  constraints: string[];
  successCriteria: string[];
}

export interface VisualizationOptions {
  width: number;
  height: number;
  title: string;
  theme: 'light' | 'dark' | 'executive';
  mobileOptimized: boolean;
  includeLabels: boolean;
  showGrid: boolean;
  colorScheme: 'professional' | 'traffic-light' | 'heat-map';
}

export class DecisionSupportGenerator {
  private static readonly DEFAULT_OPTIONS: VisualizationOptions = {
    width: 800,
    height: 600,
    title: '',
    theme: 'executive',
    mobileOptimized: true,
    includeLabels: true,
    showGrid: true,
    colorScheme: 'professional',
  };

  private static readonly EXECUTIVE_COLORS = {
    risk: {
      low: '#22c55e',    // Green
      medium: '#f59e0b', // Orange
      high: '#ef4444',   // Red
      critical: '#7c2d12', // Dark red
    },
    decision: {
      recommended: '#2563eb',   // Blue
      alternative: '#6b7280',   // Gray
      discouraged: '#dc2626',   // Red
    },
    background: {
      light: '#ffffff',
      dark: '#1f2937',
      executive: '#f8fafc',
    },
    grid: {
      light: '#e5e7eb',
      dark: '#374151',
      executive: '#e2e8f0',
    },
    text: {
      light: '#111827',
      dark: '#f9fafb',
      executive: '#1e293b',
    },
  };

  /**
   * Generate a risk matrix visualization
   */
  public static async generateRiskMatrix(
    risks: RiskItem[],
    options: Partial<VisualizationOptions> = {}
  ): Promise<MediaAttachment> {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    
    try {
      logger.info('Generating risk matrix', {
        riskCount: risks.length,
        width: config.width,
        height: config.height,
      });

      const canvas = createCanvas(config.width, config.height);
      const ctx = canvas.getContext('2d');

      // Set up canvas
      this.setupCanvas(ctx, config);

      // Draw matrix background and grid
      this.drawMatrixGrid(ctx, config);

      // Draw risk items
      this.drawRiskItems(ctx, risks, config);

      // Draw legend
      this.drawRiskLegend(ctx, config);

      // Draw title
      if (config.title) {
        this.drawTitle(ctx, config.title, config);
      }

      // Save to file
      const attachment = await this.saveVisualization(
        canvas,
        'risk-matrix',
        config.title || 'Risk Matrix'
      );

      logger.info('Risk matrix generated successfully', {
        riskCount: risks.length,
        filename: attachment.filename,
        size: attachment.size,
      });

      return attachment;
    } catch (error) {
      logger.error('Risk matrix generation failed', {
        error: error instanceof Error ? error.message : String(error),
        riskCount: risks.length,
      });
      throw error;
    }
  }

  /**
   * Generate decision comparison chart
   */
  public static async generateDecisionComparison(
    options: DecisionOption[],
    context: DecisionContext,
    visualOptions: Partial<VisualizationOptions> = {}
  ): Promise<MediaAttachment> {
    const config = { ...this.DEFAULT_OPTIONS, ...visualOptions };
    
    try {
      logger.info('Generating decision comparison', {
        optionCount: options.length,
        contextTitle: context.title,
      });

      const canvas = createCanvas(config.width, config.height);
      const ctx = canvas.getContext('2d');

      // Set up canvas
      this.setupCanvas(ctx, config);

      // Draw decision comparison
      this.drawDecisionComparison(ctx, options, context, config);

      // Draw decision legend
      this.drawDecisionLegend(ctx, config);

      // Draw title
      if (config.title || context.title) {
        this.drawTitle(ctx, config.title || context.title, config);
      }

      // Save to file
      const attachment = await this.saveVisualization(
        canvas,
        'decision-comparison',
        config.title || context.title
      );

      logger.info('Decision comparison generated successfully', {
        optionCount: options.length,
        filename: attachment.filename,
        size: attachment.size,
      });

      return attachment;
    } catch (error) {
      logger.error('Decision comparison generation failed', {
        error: error instanceof Error ? error.message : String(error),
        optionCount: options.length,
      });
      throw error;
    }
  }

  /**
   * Generate impact vs effort matrix
   */
  public static async generateImpactEffortMatrix(
    options: DecisionOption[],
    visualOptions: Partial<VisualizationOptions> = {}
  ): Promise<MediaAttachment> {
    const config = { ...this.DEFAULT_OPTIONS, ...visualOptions };
    
    try {
      logger.info('Generating impact vs effort matrix', {
        optionCount: options.length,
      });

      const canvas = createCanvas(config.width, config.height);
      const ctx = canvas.getContext('2d');

      // Set up canvas
      this.setupCanvas(ctx, config);

      // Draw matrix background and grid
      this.drawEffortImpactGrid(ctx, config);

      // Draw decision options
      this.drawEffortImpactItems(ctx, options, config);

      // Draw quadrant labels
      this.drawQuadrantLabels(ctx, config);

      // Draw legend
      this.drawEffortImpactLegend(ctx, config);

      // Draw title
      if (config.title) {
        this.drawTitle(ctx, config.title, config);
      }

      // Save to file
      const attachment = await this.saveVisualization(
        canvas,
        'impact-effort-matrix',
        config.title || 'Impact vs Effort Matrix'
      );

      logger.info('Impact vs effort matrix generated successfully', {
        optionCount: options.length,
        filename: attachment.filename,
        size: attachment.size,
      });

      return attachment;
    } catch (error) {
      logger.error('Impact vs effort matrix generation failed', {
        error: error instanceof Error ? error.message : String(error),
        optionCount: options.length,
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive decision dashboard
   */
  public static async generateDecisionDashboard(
    context: DecisionContext,
    options: DecisionOption[],
    risks: RiskItem[],
    visualOptions: Partial<VisualizationOptions> = {}
  ): Promise<MediaAttachment> {
    const config = { ...this.DEFAULT_OPTIONS, width: 1200, height: 800, ...visualOptions };
    
    try {
      logger.info('Generating decision dashboard', {
        contextTitle: context.title,
        optionCount: options.length,
        riskCount: risks.length,
      });

      const canvas = createCanvas(config.width, config.height);
      const ctx = canvas.getContext('2d');

      // Set up canvas
      this.setupCanvas(ctx, config);

      // Draw dashboard sections
      this.drawDashboardLayout(ctx, context, options, risks, config);

      // Save to file
      const attachment = await this.saveVisualization(
        canvas,
        'decision-dashboard',
        `${context.title} - Decision Dashboard`
      );

      logger.info('Decision dashboard generated successfully', {
        contextTitle: context.title,
        filename: attachment.filename,
        size: attachment.size,
      });

      return attachment;
    } catch (error) {
      logger.error('Decision dashboard generation failed', {
        error: error instanceof Error ? error.message : String(error),
        contextTitle: context.title,
      });
      throw error;
    }
  }

  private static setupCanvas(ctx: any, config: VisualizationOptions): void {
    // Set background
    const bgColor = this.EXECUTIVE_COLORS.background[config.theme];
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, config.width, config.height);

    // Set default font
    ctx.font = config.mobileOptimized ? '12px Arial' : '14px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
  }

  private static drawMatrixGrid(ctx: any, config: VisualizationOptions): void {
    const margin = 80;
    const matrixWidth = config.width - 2 * margin;
    const matrixHeight = config.height - 2 * margin - 60; // Space for title

    const gridColor = this.EXECUTIVE_COLORS.grid[config.theme];
    const textColor = this.EXECUTIVE_COLORS.text[config.theme];

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Draw grid lines
    if (config.showGrid) {
      for (let i = 0; i <= 5; i++) {
        const x = margin + (i * matrixWidth / 5);
        const y = margin + 60 + (i * matrixHeight / 5);

        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(x, margin + 60);
        ctx.lineTo(x, margin + 60 + matrixHeight);
        ctx.stroke();

        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(margin, y);
        ctx.lineTo(margin + matrixWidth, y);
        ctx.stroke();
      }
    }

    // Draw border
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(margin, margin + 60, matrixWidth, matrixHeight);

    // Draw axis labels
    ctx.fillStyle = textColor;
    ctx.font = config.mobileOptimized ? 'bold 14px Arial' : 'bold 16px Arial';
    ctx.textAlign = 'center';

    // X-axis label (Probability)
    ctx.fillText('Probability →', margin + matrixWidth / 2, config.height - 20);

    // Y-axis label (Impact)
    ctx.save();
    ctx.translate(20, margin + 60 + matrixHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('← Impact', 0, 0);
    ctx.restore();

    // Scale labels
    ctx.font = config.mobileOptimized ? '10px Arial' : '12px Arial';
    
    // Probability scale
    for (let i = 0; i <= 5; i++) {
      const x = margin + (i * matrixWidth / 5);
      const label = `${i * 20}%`;
      ctx.fillText(label, x, margin + 60 + matrixHeight + 20);
    }

    // Impact scale
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = margin + 60 + matrixHeight - (i * matrixHeight / 5);
      const label = `${i * 20}%`;
      ctx.fillText(label, margin - 10, y);
    }
  }

  private static drawRiskItems(ctx: any, risks: RiskItem[], config: VisualizationOptions): void {
    const margin = 80;
    const matrixWidth = config.width - 2 * margin;
    const matrixHeight = config.height - 2 * margin - 60;

    for (const risk of risks) {
      const x = margin + (risk.probability * matrixWidth);
      const y = margin + 60 + matrixHeight - (risk.impact * matrixHeight);

      // Determine color based on risk level
      const riskLevel = this.calculateRiskLevel(risk.probability, risk.impact);
      const color = this.EXECUTIVE_COLORS.risk[riskLevel];

      // Draw risk point
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, config.mobileOptimized ? 6 : 8, 0, 2 * Math.PI);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = this.EXECUTIVE_COLORS.text[config.theme];
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw label if enabled
      if (config.includeLabels) {
        ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
        ctx.font = config.mobileOptimized ? '9px Arial' : '10px Arial';
        ctx.textAlign = 'center';
        
        const labelY = y + (config.mobileOptimized ? 15 : 18);
        const maxLabelWidth = 60;
        const truncatedTitle = risk.title.length > 8 
          ? risk.title.substring(0, 8) + '...' 
          : risk.title;
        
        ctx.fillText(truncatedTitle, x, labelY);
      }
    }
  }

  private static drawRiskLegend(ctx: any, config: VisualizationOptions): void {
    const legendX = config.width - 150;
    const legendY = 100;
    const legendSpacing = 25;

    ctx.font = config.mobileOptimized ? 'bold 12px Arial' : 'bold 14px Arial';
    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.textAlign = 'left';
    ctx.fillText('Risk Levels', legendX, legendY);

    const riskLevels = [
      { level: 'low', label: 'Low Risk' },
      { level: 'medium', label: 'Medium Risk' },
      { level: 'high', label: 'High Risk' },
      { level: 'critical', label: 'Critical Risk' },
    ];

    riskLevels.forEach((item, index) => {
      const y = legendY + 20 + (index * legendSpacing);
      
      // Draw color indicator
      ctx.fillStyle = this.EXECUTIVE_COLORS.risk[item.level as keyof typeof this.EXECUTIVE_COLORS.risk];
      ctx.beginPath();
      ctx.arc(legendX + 8, y, 6, 0, 2 * Math.PI);
      ctx.fill();

      // Draw label
      ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
      ctx.font = config.mobileOptimized ? '10px Arial' : '12px Arial';
      ctx.fillText(item.label, legendX + 20, y);
    });
  }

  private static drawDecisionComparison(
    ctx: any,
    options: DecisionOption[],
    context: DecisionContext,
    config: VisualizationOptions
  ): void {
    const margin = 60;
    const chartWidth = config.width - 2 * margin;
    const chartHeight = config.height - 2 * margin - 80; // Space for title and context
    const barHeight = Math.min(40, chartHeight / (options.length + 1));
    const startY = margin + 120;

    // Draw context info
    this.drawDecisionContext(ctx, context, config);

    // Draw comparison bars
    options.forEach((option, index) => {
      const y = startY + (index * (barHeight + 10));
      const barWidth = (option.confidence * chartWidth * 0.7); // Max 70% of width

      // Determine color
      const color = option.recommendation 
        ? this.EXECUTIVE_COLORS.decision.recommended 
        : this.EXECUTIVE_COLORS.decision.alternative;

      // Draw bar
      ctx.fillStyle = color;
      ctx.fillRect(margin, y, barWidth, barHeight);

      // Draw border
      ctx.strokeStyle = this.EXECUTIVE_COLORS.text[config.theme];
      ctx.lineWidth = 1;
      ctx.strokeRect(margin, y, barWidth, barHeight);

      // Draw option title
      ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
      ctx.font = config.mobileOptimized ? 'bold 11px Arial' : 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(option.title, margin + 5, y + barHeight / 2);

      // Draw confidence percentage
      ctx.font = config.mobileOptimized ? '10px Arial' : '11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${Math.round(option.confidence * 100)}%`,
        margin + barWidth - 5,
        y + barHeight / 2
      );

      // Draw risk indicator
      const riskColor = this.getRiskColor(option.riskLevel);
      ctx.fillStyle = riskColor;
      ctx.beginPath();
      ctx.arc(margin + chartWidth - 30, y + barHeight / 2, 5, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  private static drawDecisionContext(
    ctx: any,
    context: DecisionContext,
    config: VisualizationOptions
  ): void {
    const margin = 60;
    const textColor = this.EXECUTIVE_COLORS.text[config.theme];

    ctx.fillStyle = textColor;
    ctx.font = config.mobileOptimized ? '11px Arial' : '12px Arial';
    ctx.textAlign = 'left';

    // Urgency indicator
    const urgencyColor = this.getUrgencyColor(context.urgency);
    ctx.fillStyle = urgencyColor;
    ctx.fillRect(margin, margin + 40, 20, 15);
    
    ctx.fillStyle = textColor;
    ctx.fillText(`Urgency: ${context.urgency.toUpperCase()}`, margin + 30, margin + 47);

    // Deadline if present
    if (context.deadline) {
      const deadline = context.deadline.toLocaleDateString();
      ctx.fillText(`Deadline: ${deadline}`, margin + 200, margin + 47);
    }

    // Stakeholders
    const stakeholders = context.stakeholders.slice(0, 3).join(', ');
    const stakeholderText = context.stakeholders.length > 3 
      ? `${stakeholders} +${context.stakeholders.length - 3} more`
      : stakeholders;
    ctx.fillText(`Stakeholders: ${stakeholderText}`, margin, margin + 70);
  }

  private static drawDecisionLegend(ctx: any, config: VisualizationOptions): void {
    const legendX = config.width - 150;
    const legendY = config.height - 120;

    ctx.font = config.mobileOptimized ? 'bold 11px Arial' : 'bold 12px Arial';
    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.textAlign = 'left';
    ctx.fillText('Legend', legendX, legendY);

    // Recommendation indicator
    ctx.fillStyle = this.EXECUTIVE_COLORS.decision.recommended;
    ctx.fillRect(legendX, legendY + 15, 15, 10);
    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.font = config.mobileOptimized ? '9px Arial' : '10px Arial';
    ctx.fillText('Recommended', legendX + 20, legendY + 20);

    // Risk levels
    const riskY = legendY + 35;
    ctx.fillText('Risk:', legendX, riskY);
    
    const risks = [
      { level: 'low', color: this.EXECUTIVE_COLORS.risk.low, x: 0 },
      { level: 'med', color: this.EXECUTIVE_COLORS.risk.medium, x: 15 },
      { level: 'high', color: this.EXECUTIVE_COLORS.risk.high, x: 30 },
    ];

    risks.forEach(risk => {
      ctx.fillStyle = risk.color;
      ctx.beginPath();
      ctx.arc(legendX + 35 + risk.x, riskY + 5, 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  private static drawEffortImpactGrid(ctx: any, config: VisualizationOptions): void {
    const margin = 80;
    const matrixWidth = config.width - 2 * margin;
    const matrixHeight = config.height - 2 * margin - 60;

    const gridColor = this.EXECUTIVE_COLORS.grid[config.theme];
    const textColor = this.EXECUTIVE_COLORS.text[config.theme];

    // Draw grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    // Center lines
    const centerX = margin + matrixWidth / 2;
    const centerY = margin + 60 + matrixHeight / 2;

    ctx.beginPath();
    ctx.moveTo(centerX, margin + 60);
    ctx.lineTo(centerX, margin + 60 + matrixHeight);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(margin, centerY);
    ctx.lineTo(margin + matrixWidth, centerY);
    ctx.stroke();

    // Border
    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(margin, margin + 60, matrixWidth, matrixHeight);

    // Axis labels
    ctx.fillStyle = textColor;
    ctx.font = config.mobileOptimized ? 'bold 14px Arial' : 'bold 16px Arial';
    ctx.textAlign = 'center';

    ctx.fillText('Effort →', margin + matrixWidth / 2, config.height - 20);

    ctx.save();
    ctx.translate(20, margin + 60 + matrixHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('← Impact', 0, 0);
    ctx.restore();
  }

  private static drawEffortImpactItems(ctx: any, options: DecisionOption[], config: VisualizationOptions): void {
    const margin = 80;
    const matrixWidth = config.width - 2 * margin;
    const matrixHeight = config.height - 2 * margin - 60;

    options.forEach((option, index) => {
      // Calculate position (using cost as effort proxy and strategic impact)
      const effort = option.cost ? Math.min(1, option.cost / 1000000) : 0.5; // Normalize cost
      const impact = option.impact.strategic || 0.5;

      const x = margin + (effort * matrixWidth);
      const y = margin + 60 + matrixHeight - (impact * matrixHeight);

      // Color based on recommendation
      const color = option.recommendation 
        ? this.EXECUTIVE_COLORS.decision.recommended 
        : this.EXECUTIVE_COLORS.decision.alternative;

      // Draw option point
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, config.mobileOptimized ? 8 : 10, 0, 2 * Math.PI);
      ctx.fill();

      // Draw border
      ctx.strokeStyle = this.EXECUTIVE_COLORS.text[config.theme];
      ctx.lineWidth = 1;
      ctx.stroke();

      // Draw label
      if (config.includeLabels) {
        ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
        ctx.font = config.mobileOptimized ? '9px Arial' : '10px Arial';
        ctx.textAlign = 'center';
        
        const labelY = y - 15;
        const truncatedTitle = option.title.length > 10 
          ? option.title.substring(0, 10) + '...' 
          : option.title;
        
        ctx.fillText(truncatedTitle, x, labelY);
      }
    });
  }

  private static drawQuadrantLabels(ctx: any, config: VisualizationOptions): void {
    const margin = 80;
    const matrixWidth = config.width - 2 * margin;
    const matrixHeight = config.height - 2 * margin - 60;

    const quarterWidth = matrixWidth / 4;
    const quarterHeight = matrixHeight / 4;

    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.font = config.mobileOptimized ? 'bold 11px Arial' : 'bold 12px Arial';
    ctx.textAlign = 'center';

    const labels = [
      { text: 'Quick Wins', x: margin + quarterWidth, y: margin + 60 + quarterHeight },
      { text: 'Major Projects', x: margin + 3 * quarterWidth, y: margin + 60 + quarterHeight },
      { text: 'Fill-ins', x: margin + quarterWidth, y: margin + 60 + 3 * quarterHeight },
      { text: 'Thankless Tasks', x: margin + 3 * quarterWidth, y: margin + 60 + 3 * quarterHeight },
    ];

    labels.forEach(label => {
      ctx.fillText(label.text, label.x, label.y);
    });
  }

  private static drawEffortImpactLegend(ctx: any, config: VisualizationOptions): void {
    const legendX = config.width - 180;
    const legendY = 100;

    ctx.font = config.mobileOptimized ? 'bold 12px Arial' : 'bold 14px Arial';
    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.textAlign = 'left';
    ctx.fillText('Quadrants', legendX, legendY);

    const quadrants = [
      { label: 'Quick Wins (High Impact, Low Effort)', color: this.EXECUTIVE_COLORS.risk.low },
      { label: 'Major Projects (High Impact, High Effort)', color: this.EXECUTIVE_COLORS.risk.medium },
      { label: 'Fill-ins (Low Impact, Low Effort)', color: this.EXECUTIVE_COLORS.risk.medium },
      { label: 'Thankless (Low Impact, High Effort)', color: this.EXECUTIVE_COLORS.risk.high },
    ];

    quadrants.forEach((quad, index) => {
      const y = legendY + 20 + (index * 20);
      
      ctx.fillStyle = quad.color;
      ctx.fillRect(legendX, y - 5, 10, 10);
      
      ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
      ctx.font = config.mobileOptimized ? '9px Arial' : '10px Arial';
      ctx.fillText(quad.label, legendX + 15, y);
    });
  }

  private static drawDashboardLayout(
    ctx: any,
    context: DecisionContext,
    options: DecisionOption[],
    risks: RiskItem[],
    config: VisualizationOptions
  ): void {
    // Title
    this.drawTitle(ctx, `${context.title} - Decision Dashboard`, config);

    // Split into sections
    const sectionWidth = (config.width - 60) / 2;
    const sectionHeight = (config.height - 120) / 2;

    // Top left: Decision context and summary
    this.drawDashboardSection(ctx, 30, 80, sectionWidth, sectionHeight, 'Context', context, config);

    // Top right: Options comparison
    this.drawDashboardSection(ctx, 30 + sectionWidth, 80, sectionWidth, sectionHeight, 'Options', options, config);

    // Bottom left: Risk matrix
    this.drawDashboardSection(ctx, 30, 80 + sectionHeight, sectionWidth, sectionHeight, 'Risks', risks, config);

    // Bottom right: Recommendations
    const recommendations = this.generateRecommendations(options, risks);
    this.drawDashboardSection(ctx, 30 + sectionWidth, 80 + sectionHeight, sectionWidth, sectionHeight, 'Recommendations', recommendations, config);
  }

  private static drawDashboardSection(
    ctx: any,
    x: number,
    y: number,
    width: number,
    height: number,
    title: string,
    data: any,
    config: VisualizationOptions
  ): void {
    // Draw section border
    ctx.strokeStyle = this.EXECUTIVE_COLORS.grid[config.theme];
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Draw section title
    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.font = config.mobileOptimized ? 'bold 14px Arial' : 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 10, y + 25);

    // Draw section content based on type
    ctx.font = config.mobileOptimized ? '11px Arial' : '12px Arial';
    
    if (title === 'Context') {
      this.drawContextSummary(ctx, x + 10, y + 40, width - 20, height - 50, data, config);
    } else if (title === 'Options') {
      this.drawOptionsSummary(ctx, x + 10, y + 40, width - 20, height - 50, data, config);
    } else if (title === 'Risks') {
      this.drawRisksSummary(ctx, x + 10, y + 40, width - 20, height - 50, data, config);
    } else if (title === 'Recommendations') {
      this.drawRecommendationsSummary(ctx, x + 10, y + 40, width - 20, height - 50, data, config);
    }
  }

  private static drawContextSummary(ctx: any, x: number, y: number, width: number, height: number, context: DecisionContext, config: VisualizationOptions): void {
    const lineHeight = 20;
    let currentY = y;

    // Urgency
    const urgencyColor = this.getUrgencyColor(context.urgency);
    ctx.fillStyle = urgencyColor;
    ctx.fillRect(x, currentY, 15, 15);
    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.fillText(`Urgency: ${context.urgency}`, x + 20, currentY + 10);
    currentY += lineHeight;

    // Deadline
    if (context.deadline) {
      ctx.fillText(`Deadline: ${context.deadline.toLocaleDateString()}`, x, currentY);
      currentY += lineHeight;
    }

    // Stakeholders
    ctx.fillText(`Stakeholders: ${context.stakeholders.length}`, x, currentY);
    currentY += lineHeight;

    // Constraints
    if (context.constraints.length > 0) {
      ctx.fillText(`Constraints: ${context.constraints.length}`, x, currentY);
    }
  }

  private static drawOptionsSummary(ctx: any, x: number, y: number, width: number, height: number, options: DecisionOption[], config: VisualizationOptions): void {
    const lineHeight = 18;
    let currentY = y;

    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.fillText(`Total Options: ${options.length}`, x, currentY);
    currentY += lineHeight;

    const recommended = options.filter(o => o.recommendation).length;
    ctx.fillText(`Recommended: ${recommended}`, x, currentY);
    currentY += lineHeight;

    const highRisk = options.filter(o => o.riskLevel === 'high').length;
    if (highRisk > 0) {
      ctx.fillStyle = this.EXECUTIVE_COLORS.risk.high;
      ctx.fillText(`High Risk Options: ${highRisk}`, x, currentY);
      currentY += lineHeight;
    }

    // Show top option
    const topOption = options.find(o => o.recommendation) || options[0];
    if (topOption) {
      ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
      ctx.font = config.mobileOptimized ? 'bold 10px Arial' : 'bold 11px Arial';
      ctx.fillText(`Top Choice:`, x, currentY);
      currentY += lineHeight;
      ctx.font = config.mobileOptimized ? '10px Arial' : '11px Arial';
      
      const truncatedTitle = topOption.title.length > 25 
        ? topOption.title.substring(0, 25) + '...' 
        : topOption.title;
      ctx.fillText(truncatedTitle, x, currentY);
    }
  }

  private static drawRisksSummary(ctx: any, x: number, y: number, width: number, height: number, risks: RiskItem[], config: VisualizationOptions): void {
    const lineHeight = 18;
    let currentY = y;

    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.fillText(`Total Risks: ${risks.length}`, x, currentY);
    currentY += lineHeight;

    // Risk level breakdown
    const riskLevels = {
      critical: risks.filter(r => this.calculateRiskLevel(r.probability, r.impact) === 'critical').length,
      high: risks.filter(r => this.calculateRiskLevel(r.probability, r.impact) === 'high').length,
      medium: risks.filter(r => this.calculateRiskLevel(r.probability, r.impact) === 'medium').length,
    };

    Object.entries(riskLevels).forEach(([level, count]) => {
      if (count > 0) {
        ctx.fillStyle = this.EXECUTIVE_COLORS.risk[level as keyof typeof this.EXECUTIVE_COLORS.risk];
        ctx.fillRect(x, currentY - 8, 12, 12);
        ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
        ctx.fillText(`${level}: ${count}`, x + 15, currentY);
        currentY += lineHeight;
      }
    });
  }

  private static drawRecommendationsSummary(ctx: any, x: number, y: number, width: number, height: number, recommendations: string[], config: VisualizationOptions): void {
    const lineHeight = 16;
    let currentY = y;

    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.font = config.mobileOptimized ? 'bold 11px Arial' : 'bold 12px Arial';
    ctx.fillText('Key Recommendations:', x, currentY);
    currentY += lineHeight + 5;

    ctx.font = config.mobileOptimized ? '10px Arial' : '11px Arial';
    
    recommendations.slice(0, 6).forEach((rec, index) => {
      ctx.fillText(`• ${rec}`, x, currentY);
      currentY += lineHeight;
    });
  }

  private static generateRecommendations(options: DecisionOption[], risks: RiskItem[]): string[] {
    const recommendations: string[] = [];

    // Find recommended option
    const recommended = options.find(o => o.recommendation);
    if (recommended) {
      recommendations.push(`Proceed with ${recommended.title}`);
    }

    // Risk recommendations
    const highRisks = risks.filter(r => this.calculateRiskLevel(r.probability, r.impact) === 'high' || this.calculateRiskLevel(r.probability, r.impact) === 'critical');
    if (highRisks.length > 0) {
      recommendations.push(`Address ${highRisks.length} high-risk items first`);
    }

    // Timeline recommendations
    const hasDeadline = options.some(o => o.timeframe);
    if (hasDeadline) {
      recommendations.push('Consider timeline constraints');
    }

    // Cost recommendations
    const highCostOptions = options.filter(o => o.cost && o.cost > 500000);
    if (highCostOptions.length > 0) {
      recommendations.push('Review budget impact for major investments');
    }

    // Default recommendations
    if (recommendations.length === 0) {
      recommendations.push('Gather additional stakeholder input');
      recommendations.push('Consider phased implementation');
    }

    return recommendations;
  }

  private static drawTitle(ctx: any, title: string, config: VisualizationOptions): void {
    ctx.fillStyle = this.EXECUTIVE_COLORS.text[config.theme];
    ctx.font = config.mobileOptimized ? 'bold 16px Arial' : 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, config.width / 2, 30);
  }

  private static async saveVisualization(
    canvas: Canvas,
    type: string,
    title: string
  ): Promise<MediaAttachment> {
    const filename = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
    const outputDir = path.join(process.cwd(), 'temp', 'decision-support');
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    const filePath = path.join(outputDir, filename);
    
    // Save chart as PNG
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(filePath, buffer);

    const attachment: MediaAttachment = {
      id: `decision_${Date.now()}`,
      type: 'chart',
      url: filePath,
      filename,
      size: buffer.length,
      mimeType: 'image/png',
      metadata: {
        chartType: type,
        title,
        generatedAt: new Date().toISOString(),
      },
    };

    return attachment;
  }

  private static calculateRiskLevel(probability: number, impact: number): 'low' | 'medium' | 'high' | 'critical' {
    const riskScore = probability * impact;
    
    if (riskScore >= 0.8) return 'critical';
    if (riskScore >= 0.6) return 'high';
    if (riskScore >= 0.3) return 'medium';
    return 'low';
  }

  private static getRiskColor(riskLevel: string): string {
    return this.EXECUTIVE_COLORS.risk[riskLevel as keyof typeof this.EXECUTIVE_COLORS.risk] || this.EXECUTIVE_COLORS.risk.medium;
  }

  private static getUrgencyColor(urgency: string): string {
    const urgencyColors = {
      low: this.EXECUTIVE_COLORS.risk.low,
      medium: this.EXECUTIVE_COLORS.risk.medium,
      high: this.EXECUTIVE_COLORS.risk.high,
      critical: this.EXECUTIVE_COLORS.risk.critical,
    };
    
    return urgencyColors[urgency as keyof typeof urgencyColors] || urgencyColors.medium;
  }

  // Cleanup utility
  public static async cleanupTempFiles(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    const tempDir = path.join(process.cwd(), 'temp', 'decision-support');
    
    try {
      const files = await fs.readdir(tempDir);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stats = await fs.stat(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          logger.info('Cleaned up old decision support file', { file });
        }
      }
    } catch (error) {
      logger.error('Decision support file cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export default DecisionSupportGenerator;