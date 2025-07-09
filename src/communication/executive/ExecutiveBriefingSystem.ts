import { EventEmitter } from 'events';
import { ChartGenerator } from '../../visual/charts/ChartGenerator';
// import { RealTimeDashboard } from '../../visual/dashboard/RealTimeDashboard'; // Unused for now
import { MediaAttachment } from '../../types/Communication';
import logger from '../../utils/logger';

export interface ExecutiveBrief {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  summary: {
    bulletPoints: string[]; // Maximum 3 bullets
    keyMetrics: Record<string, number | string>;
    trend: 'positive' | 'negative' | 'stable' | 'mixed';
    confidence: number;
  };
  visualElements: {
    charts: MediaAttachment[];
    statusIndicators: Array<{
      label: string;
      status: 'green' | 'yellow' | 'red';
      value?: string;
    }>;
    progressBars: Array<{
      label: string;
      percentage: number;
      target?: number;
    }>;
  };
  actionItems: Array<{
    id: string;
    description: string;
    urgency: 'immediate' | 'today' | 'this_week' | 'future';
    assignee?: string;
    dueDate?: Date;
  }>;
  decisionPoints: Array<{
    id: string;
    question: string;
    context: string;
    options: Array<{
      label: string;
      impact: 'low' | 'medium' | 'high';
      recommendation?: boolean;
    }>;
    deadline?: Date;
  }>;
  metadata: {
    generatedAt: Date;
    dataPoints: number;
    sources: string[];
    timeRange: string;
    nextUpdate?: Date;
  };
}

export interface BriefingTemplate {
  id: string;
  name: string;
  description: string;
  maxBulletPoints: number;
  requiredSections: Array<'summary' | 'metrics' | 'actions' | 'decisions' | 'charts'>;
  visualStyle: 'minimal' | 'standard' | 'detailed';
  mobileOptimized: boolean;
  updateFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';
}

export interface ExecutiveCommunicationPreferences {
  userId: string;
  briefingFrequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  preferredChannels: {
    critical: string[];
    high: string[];
    medium: string[];
    low: string[];
  };
  visualPreferences: {
    chartTypes: Array<'bar' | 'line' | 'pie' | 'doughnut'>;
    colorScheme: 'professional' | 'colorful' | 'monochrome';
    mobileFirst: boolean;
  };
  contentPreferences: {
    maxBulletPoints: number;
    includeMetrics: boolean;
    includeCharts: boolean;
    includeActionItems: boolean;
    timeZone: string;
  };
  quietHours: {
    start: string; // HH:MM format
    end: string;
    timezone: string;
  };
}

export class ExecutiveBriefingSystem extends EventEmitter {
  private templates: Map<string, BriefingTemplate> = new Map();
  private userPreferences: Map<string, ExecutiveCommunicationPreferences> = new Map();
  private activeBriefings: Map<string, ExecutiveBrief> = new Map();

  constructor() {
    super();
    this.initializeDefaultTemplates();
  }

  async initialize(): Promise<void> {
    logger.info('Executive briefing system initialized');
  }

  /**
   * Generate an executive brief from raw data
   */
  async generateBrief(
    data: {
      title: string;
      rawContent: string[];
      metrics: Record<string, number>;
      projects?: Array<{ name: string; status: string; progress: number }>;
      issues?: Array<{ description: string; severity: string; timestamp: Date }>;
    },
    templateId: string = 'standard-executive',
    userId?: string
  ): Promise<ExecutiveBrief> {
    const startTime = Date.now();
    
    try {
      const template = this.templates.get(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const preferences = userId ? this.userPreferences.get(userId) : undefined;
      
      logger.info('Generating executive brief', {
        title: data.title,
        templateId,
        userId,
        dataPointsCount: data.rawContent.length,
      });

      // Step 1: Process and condense content into bullet points
      const bulletPoints = await this.createBulletPoints(
        data.rawContent,
        preferences?.contentPreferences.maxBulletPoints || template.maxBulletPoints
      );

      // Step 2: Analyze trends and confidence
      const analysis = await this.analyzeContent(data.rawContent, data.metrics);

      // Step 3: Generate visual elements
      const visualElements = await this.generateVisualElements(data, template, preferences);

      // Step 4: Extract action items
      const actionItems = await this.extractActionItems(data.rawContent);

      // Step 5: Identify decision points
      const decisionPoints = await this.identifyDecisionPoints(data.rawContent);

      // Step 6: Determine priority
      const priority = this.calculatePriority(analysis, actionItems, decisionPoints);

      const brief: ExecutiveBrief = {
        id: `brief_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        title: data.title,
        priority,
        summary: {
          bulletPoints,
          keyMetrics: this.formatMetrics(data.metrics),
          trend: analysis.trend,
          confidence: analysis.confidence,
        },
        visualElements,
        actionItems,
        decisionPoints,
        metadata: {
          generatedAt: new Date(),
          dataPoints: data.rawContent.length,
          sources: this.extractSources(data.rawContent),
          timeRange: this.determineTimeRange(data.rawContent),
          nextUpdate: this.calculateNextUpdate(template.updateFrequency),
        },
      };

      this.activeBriefings.set(brief.id, brief);

      const generationTime = Date.now() - startTime;
      
      this.emit('briefGenerated', {
        briefId: brief.id,
        priority: brief.priority,
        generationTime,
        bulletPointCount: brief.summary.bulletPoints.length,
        chartCount: brief.visualElements.charts.length,
      });

      logger.info('Executive brief generated successfully', {
        briefId: brief.id,
        title: brief.title,
        priority: brief.priority,
        generationTime,
        bulletPoints: brief.summary.bulletPoints.length,
        actionItems: brief.actionItems.length,
      });

      return brief;
    } catch (error) {
      logger.error('Executive brief generation failed', {
        title: data.title,
        templateId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create optimized bullet points (max 3 for executives)
   */
  private async createBulletPoints(
    rawContent: string[],
    maxBullets: number = 3
  ): Promise<string[]> {
    // Combine all content
    const combinedContent = rawContent.join(' ');
    
    // Extract key themes using simple keyword analysis
    const themes = this.extractKeyThemes(combinedContent);
    
    // Prioritize themes by importance and urgency
    const prioritizedThemes = this.prioritizeThemes(themes, combinedContent);
    
    // Create bullet points from top themes
    const bulletPoints: string[] = [];
    
    for (let i = 0; i < Math.min(maxBullets, prioritizedThemes.length); i++) {
      const theme = prioritizedThemes[i];
      const bullet = theme ? this.createBulletFromTheme(theme, combinedContent) : '';
      
      if (bullet && bullet.length > 0) {
        bulletPoints.push(bullet);
      }
    }
    
    // Ensure we have at least one bullet point
    if (bulletPoints.length === 0) {
      bulletPoints.push(this.createFallbackBullet(combinedContent));
    }
    
    return bulletPoints;
  }

  private extractKeyThemes(content: string): Array<{ theme: string; keywords: string[]; frequency: number }> {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const themes: Record<string, { keywords: Set<string>; frequency: number }> = {};
    
    // Common business themes
    const themePatterns = {
      'Project Status': ['project', 'milestone', 'deadline', 'progress', 'completion'],
      'Financial Performance': ['revenue', 'profit', 'budget', 'cost', 'financial', 'earnings'],
      'Team Management': ['team', 'staff', 'employee', 'hire', 'performance', 'management'],
      'Operations': ['operation', 'process', 'efficiency', 'workflow', 'system'],
      'Risk Management': ['risk', 'issue', 'problem', 'challenge', 'concern', 'threat'],
      'Strategic Initiatives': ['strategy', 'initiative', 'goal', 'objective', 'vision', 'plan'],
      'Customer Relations': ['customer', 'client', 'satisfaction', 'feedback', 'service'],
      'Technology': ['technology', 'system', 'software', 'infrastructure', 'digital'],
    };
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      
      for (const [themeName, keywords] of Object.entries(themePatterns)) {
        const matchCount = keywords.filter(keyword => lowerSentence.includes(keyword)).length;
        
        if (matchCount > 0) {
          if (!themes[themeName]) {
            themes[themeName] = { keywords: new Set(), frequency: 0 };
          }
          themes[themeName].frequency += matchCount;
          keywords.forEach(keyword => {
            if (lowerSentence.includes(keyword)) {
              themes[themeName]?.keywords.add(keyword);
            }
          });
        }
      }
    }
    
    return Object.entries(themes).map(([theme, data]) => ({
      theme,
      keywords: Array.from(data.keywords),
      frequency: data.frequency,
    }));
  }

  private prioritizeThemes(
    themes: Array<{ theme: string; keywords: string[]; frequency: number }>,
    content: string
  ): Array<{ theme: string; keywords: string[]; frequency: number; priority: number }> {
    const urgencyKeywords = ['urgent', 'immediate', 'critical', 'asap', 'emergency', 'deadline'];
    const positiveKeywords = ['success', 'achievement', 'growth', 'improvement', 'milestone'];
    const negativeKeywords = ['problem', 'issue', 'failure', 'delay', 'concern', 'risk'];
    
    return themes.map(theme => {
      let priority = theme.frequency;
      
      // Boost priority for urgency indicators
      const urgencyScore = urgencyKeywords.filter(keyword => 
        content.toLowerCase().includes(keyword)
      ).length;
      priority += urgencyScore * 3;
      
      // Boost priority for significant positive/negative outcomes
      const sentimentScore = positiveKeywords.filter(keyword => 
        content.toLowerCase().includes(keyword)
      ).length + negativeKeywords.filter(keyword => 
        content.toLowerCase().includes(keyword)
      ).length;
      priority += sentimentScore * 2;
      
      return { ...theme, priority };
    }).sort((a, b) => b.priority - a.priority);
  }

  private createBulletFromTheme(
    theme: { theme: string; keywords: string[]; frequency: number },
    content: string
  ): string {
    // Find the most relevant sentence for this theme
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    let bestSentence = '';
    let bestScore = 0;
    
    for (const sentence of sentences) {
      const lowerSentence = sentence.toLowerCase();
      const score = theme.keywords.filter(keyword => lowerSentence.includes(keyword)).length;
      
      if (score > bestScore) {
        bestScore = score;
        bestSentence = sentence.trim();
      }
    }
    
    if (bestSentence) {
      // Condense the sentence to be more executive-friendly
      return this.condenseSentence(bestSentence);
    }
    
    return `${theme.theme}: ${theme.frequency} related items identified`;
  }

  private condenseSentence(sentence: string): string {
    // Remove filler words and condense to key points
    const fillerWords = ['that', 'which', 'however', 'therefore', 'furthermore', 'additionally'];
    let condensed = sentence;
    
    fillerWords.forEach(word => {
      condensed = condensed.replace(new RegExp(`\\b${word}\\b`, 'gi'), '');
    });
    
    // Limit length for executive consumption
    if (condensed.length > 120) {
      condensed = condensed.substring(0, 117) + '...';
    }
    
    return condensed.trim();
  }

  private createFallbackBullet(content: string): string {
    const words = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).length;
    return `Summary: ${sentences} items reviewed covering ${words} data points`;
  }

  private async analyzeContent(
    rawContent: string[],
    metrics: Record<string, number>
  ): Promise<{ trend: 'positive' | 'negative' | 'stable' | 'mixed'; confidence: number }> {
    const combinedContent = rawContent.join(' ').toLowerCase();
    
    // Simple sentiment analysis
    const positiveWords = ['success', 'growth', 'improvement', 'achievement', 'exceeded', 'strong', 'positive'];
    const negativeWords = ['problem', 'issue', 'decline', 'failure', 'concern', 'risk', 'below'];
    
    const positiveCount = positiveWords.filter(word => combinedContent.includes(word)).length;
    const negativeCount = negativeWords.filter(word => combinedContent.includes(word)).length;
    
    // Analyze metric trends if available
    // const metricValues = Object.values(metrics).filter(v => typeof v === 'number'); // Unused for now
    // const avgMetric = metricValues.length > 0 ? metricValues.reduce((a, b) => a + b, 0) / metricValues.length : 0; // Unused for now
    
    let trend: 'positive' | 'negative' | 'stable' | 'mixed';
    let confidence = 0.7;
    
    if (positiveCount > negativeCount + 1) {
      trend = 'positive';
      confidence = Math.min(0.9, 0.7 + (positiveCount - negativeCount) * 0.1);
    } else if (negativeCount > positiveCount + 1) {
      trend = 'negative';
      confidence = Math.min(0.9, 0.7 + (negativeCount - positiveCount) * 0.1);
    } else if (positiveCount > 0 && negativeCount > 0) {
      trend = 'mixed';
      confidence = 0.6;
    } else {
      trend = 'stable';
      confidence = 0.5;
    }
    
    return { trend, confidence };
  }

  private async generateVisualElements(
    data: any,
    template: BriefingTemplate,
    preferences?: ExecutiveCommunicationPreferences
  ): Promise<ExecutiveBrief['visualElements']> {
    const charts: MediaAttachment[] = [];
    const statusIndicators: Array<{ label: string; status: 'green' | 'yellow' | 'red'; value?: string }> = [];
    const progressBars: Array<{ label: string; percentage: number; target?: number }> = [];
    
    // Generate charts based on metrics
    if (Object.keys(data.metrics).length > 0) {
      try {
        const chart = await ChartGenerator.generateExecutiveDashboard(data.metrics, {
          title: `${data.title} - Key Metrics`,
          mobileOptimized: preferences?.visualPreferences.mobileFirst ?? template.mobileOptimized,
          theme: preferences?.visualPreferences.colorScheme === 'monochrome' ? 'dark' : 'light',
        });
        charts.push(chart);
      } catch (error) {
        logger.warn('Failed to generate metrics chart', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    
    // Generate project status indicators
    if (data.projects) {
      for (const project of data.projects) {
        statusIndicators.push({
          label: project.name,
          status: this.getProjectStatus(project.status),
          value: `${project.progress}%`,
        });
        
        progressBars.push({
          label: project.name,
          percentage: project.progress,
          target: 100,
        });
      }
    }
    
    // Generate issue status indicators
    if (data.issues) {
      const criticalIssues = data.issues.filter((i: any) => i.severity === 'critical').length;
      const highIssues = data.issues.filter((i: any) => i.severity === 'high').length;
      
      if (criticalIssues > 0) {
        statusIndicators.push({
          label: 'Critical Issues',
          status: 'red',
          value: criticalIssues.toString(),
        });
      }
      
      if (highIssues > 0) {
        statusIndicators.push({
          label: 'High Priority Issues',
          status: 'yellow',
          value: highIssues.toString(),
        });
      }
    }
    
    return { charts, statusIndicators, progressBars };
  }

  private getProjectStatus(status: string): 'green' | 'yellow' | 'red' {
    const lowerStatus = status.toLowerCase();
    
    if (lowerStatus.includes('complete') || lowerStatus.includes('success')) {
      return 'green';
    } else if (lowerStatus.includes('risk') || lowerStatus.includes('delay')) {
      return 'yellow';
    } else if (lowerStatus.includes('blocked') || lowerStatus.includes('failed')) {
      return 'red';
    }
    
    return 'green'; // Default to green for on-track projects
  }

  private async extractActionItems(rawContent: string[]): Promise<ExecutiveBrief['actionItems']> {
    const actionItems: ExecutiveBrief['actionItems'] = [];
    const combinedContent = rawContent.join(' ');
    
    // Look for action-oriented sentences
    const actionPatterns = [
      /need to\s+([^.!?]*)/gi,
      /should\s+([^.!?]*)/gi,
      /must\s+([^.!?]*)/gi,
      /action:\s*([^.!?]*)/gi,
      /todo:\s*([^.!?]*)/gi,
      /follow.?up:\s*([^.!?]*)/gi,
    ];
    
    let actionId = 1;
    
    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(combinedContent)) !== null) {
        const description = match[1]?.trim() || '';
        
        if (description.length > 5 && description.length < 200) {
          const urgency = this.determineUrgency(description);
          
          actionItems.push({
            id: `action_${actionId++}`,
            description,
            urgency,
          });
        }
      }
    }
    
    // Limit to most important action items
    return actionItems.slice(0, 5);
  }

  private determineUrgency(description: string): 'immediate' | 'today' | 'this_week' | 'future' {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('urgent') || lowerDesc.includes('immediate') || lowerDesc.includes('asap')) {
      return 'immediate';
    } else if (lowerDesc.includes('today') || lowerDesc.includes('deadline')) {
      return 'today';
    } else if (lowerDesc.includes('week') || lowerDesc.includes('soon')) {
      return 'this_week';
    }
    
    return 'future';
  }

  private async identifyDecisionPoints(rawContent: string[]): Promise<ExecutiveBrief['decisionPoints']> {
    const decisionPoints: ExecutiveBrief['decisionPoints'] = [];
    const combinedContent = rawContent.join(' ');
    
    // Look for decision-oriented content
    const decisionPatterns = [
      /decision\s+(?:needed|required)?\s*:?\s*([^.!?]*)/gi,
      /should\s+we\s+([^.!?]*)/gi,
      /need\s+to\s+decide\s+([^.!?]*)/gi,
      /choice\s+between\s+([^.!?]*)/gi,
    ];
    
    let decisionId = 1;
    
    for (const pattern of decisionPatterns) {
      let match;
      while ((match = pattern.exec(combinedContent)) !== null) {
        const question = match[1]?.trim() || '';
        
        if (question.length > 10 && question.length < 200) {
          decisionPoints.push({
            id: `decision_${decisionId++}`,
            question,
            context: this.extractDecisionContext(question, combinedContent),
            options: this.generateDecisionOptions(question),
          });
        }
      }
    }
    
    return decisionPoints.slice(0, 3); // Limit to 3 key decisions
  }

  private extractDecisionContext(question: string, content: string): string {
    // Find sentences around the decision point for context
    const sentences = content.split(/[.!?]+/);
    const targetSentence = sentences.find(s => s.includes(question));
    
    if (targetSentence) {
      const index = sentences.indexOf(targetSentence);
      const contextSentences = sentences.slice(Math.max(0, index - 1), Math.min(sentences.length, index + 2));
      return contextSentences.join('. ').trim();
    }
    
    return question;
  }

  private generateDecisionOptions(question: string): Array<{ label: string; impact: 'low' | 'medium' | 'high' }> {
    // Generate basic decision options
    const options = [
      { label: 'Proceed as planned', impact: 'medium' as const },
      { label: 'Delay for more analysis', impact: 'low' as const },
      { label: 'Escalate to leadership', impact: 'high' as const },
    ];
    
    // Customize based on question content
    const lowerQuestion = question.toLowerCase();
    
    if (lowerQuestion.includes('budget') || lowerQuestion.includes('cost')) {
      options.unshift({ label: 'Approve budget increase', impact: 'high' });
    } else if (lowerQuestion.includes('hire') || lowerQuestion.includes('staff')) {
      options.unshift({ label: 'Approve hiring', impact: 'medium' });
    } else if (lowerQuestion.includes('project')) {
      options.unshift({ label: 'Continue project', impact: 'medium' });
    }
    
    return options.slice(0, 3);
  }

  private calculatePriority(
    analysis: { trend: string },
    actionItems: ExecutiveBrief['actionItems'],
    decisionPoints: ExecutiveBrief['decisionPoints']
  ): 'low' | 'medium' | 'high' | 'critical' {
    let score = 0;
    
    // Factor in trend
    if (analysis.trend === 'negative') score += 3;
    else if (analysis.trend === 'mixed') score += 2;
    else if (analysis.trend === 'positive') score += 1;
    
    // Factor in urgent action items
    const immediateActions = actionItems.filter(a => a.urgency === 'immediate').length;
    const todayActions = actionItems.filter(a => a.urgency === 'today').length;
    
    score += immediateActions * 3;
    score += todayActions * 2;
    
    // Factor in decision points
    score += decisionPoints.length * 1;
    
    if (score >= 8) return 'critical';
    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  private formatMetrics(metrics: Record<string, number>): Record<string, number | string> {
    const formatted: Record<string, number | string> = {};
    
    for (const [key, value] of Object.entries(metrics)) {
      if (typeof value === 'number') {
        // Format large numbers with commas
        if (value >= 1000000) {
          formatted[key] = `${(value / 1000000).toFixed(1)}M`;
        } else if (value >= 1000) {
          formatted[key] = `${(value / 1000).toFixed(1)}K`;
        } else if (value % 1 === 0) {
          formatted[key] = value.toLocaleString();
        } else {
          formatted[key] = value.toFixed(2);
        }
      } else {
        formatted[key] = value;
      }
    }
    
    return formatted;
  }

  private extractSources(rawContent: string[]): string[] {
    // Extract potential sources from content
    const sources = new Set<string>();
    
    rawContent.forEach(content => {
      // Look for system references
      if (content.includes('dashboard')) sources.add('Dashboard');
      if (content.includes('report')) sources.add('Reports');
      if (content.includes('agent')) sources.add('AI Agents');
      if (content.includes('project')) sources.add('Project Management');
      if (content.includes('team')) sources.add('Team Updates');
    });
    
    return Array.from(sources).slice(0, 5);
  }

  private determineTimeRange(rawContent: string[]): string {
    const combinedContent = rawContent.join(' ').toLowerCase();
    
    if (combinedContent.includes('today') || combinedContent.includes('this morning')) {
      return 'Today';
    } else if (combinedContent.includes('week')) {
      return 'This Week';
    } else if (combinedContent.includes('month')) {
      return 'This Month';
    }
    
    return 'Current Period';
  }

  private calculateNextUpdate(frequency: string): Date {
    const now = new Date();
    
    switch (frequency) {
      case 'realtime':
        return new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes
      case 'hourly':
        return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week
      default:
        return new Date(now.getTime() + 60 * 60 * 1000);
    }
  }

  private initializeDefaultTemplates(): void {
    // Standard executive template
    this.templates.set('standard-executive', {
      id: 'standard-executive',
      name: 'Standard Executive Brief',
      description: 'Concise 3-bullet executive summary with key metrics',
      maxBulletPoints: 3,
      requiredSections: ['summary', 'metrics', 'actions'],
      visualStyle: 'standard',
      mobileOptimized: true,
      updateFrequency: 'daily',
    });

    // Critical update template
    this.templates.set('critical-update', {
      id: 'critical-update',
      name: 'Critical Update Brief',
      description: 'Immediate executive attention format',
      maxBulletPoints: 2,
      requiredSections: ['summary', 'actions', 'decisions'],
      visualStyle: 'minimal',
      mobileOptimized: true,
      updateFrequency: 'realtime',
    });

    // Weekly summary template
    this.templates.set('weekly-summary', {
      id: 'weekly-summary',
      name: 'Weekly Executive Summary',
      description: 'Comprehensive weekly overview with charts',
      maxBulletPoints: 3,
      requiredSections: ['summary', 'metrics', 'charts', 'actions'],
      visualStyle: 'detailed',
      mobileOptimized: true,
      updateFrequency: 'weekly',
    });
  }

  // User preference management
  async setUserPreferences(userId: string, preferences: ExecutiveCommunicationPreferences): Promise<void> {
    this.userPreferences.set(userId, preferences);
    
    this.emit('preferencesUpdated', { userId, preferences });
    
    logger.info('User preferences updated', {
      userId,
      briefingFrequency: preferences.briefingFrequency,
      maxBulletPoints: preferences.contentPreferences.maxBulletPoints,
    });
  }

  getUserPreferences(userId: string): ExecutiveCommunicationPreferences | undefined {
    return this.userPreferences.get(userId);
  }

  // Template management
  addTemplate(template: BriefingTemplate): void {
    this.templates.set(template.id, template);
    logger.info('Briefing template added', { templateId: template.id, name: template.name });
  }

  getTemplate(templateId: string): BriefingTemplate | undefined {
    return this.templates.get(templateId);
  }

  listTemplates(): BriefingTemplate[] {
    return Array.from(this.templates.values());
  }

  // Brief management
  getBrief(briefId: string): ExecutiveBrief | undefined {
    return this.activeBriefings.get(briefId);
  }

  listActiveBriefings(): ExecutiveBrief[] {
    return Array.from(this.activeBriefings.values());
  }

  async archiveBrief(briefId: string): Promise<void> {
    const brief = this.activeBriefings.get(briefId);
    if (brief) {
      this.activeBriefings.delete(briefId);
      this.emit('briefArchived', { briefId, title: brief.title });
      logger.info('Brief archived', { briefId, title: brief.title });
    }
  }

  getSystemStatus(): {
    activeBriefings: number;
    templates: number;
    userPreferences: number;
    recentActivity: string;
  } {
    return {
      activeBriefings: this.activeBriefings.size,
      templates: this.templates.size,
      userPreferences: this.userPreferences.size,
      recentActivity: `${this.activeBriefings.size} active briefings`,
    };
  }
}

export default ExecutiveBriefingSystem;