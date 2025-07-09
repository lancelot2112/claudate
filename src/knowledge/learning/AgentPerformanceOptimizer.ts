import { EventEmitter } from 'events';
import logger from '../../utils/logger';

export interface PerformanceMetrics {
  agentId: string;
  agentType: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  taskMetrics: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskTime: number;
    averageResponseTime: number;
    successRate: number;
  };
  qualityMetrics: {
    averageQuality: number;
    userSatisfaction: number;
    accuracyScore: number;
    completenessScore: number;
    consistencyScore: number;
  };
  resourceMetrics: {
    cpuUsage: number;
    memoryUsage: number;
    networkCalls: number;
    apiCalls: number;
    tokensUsed: number;
    costEfficiency: number;
  };
  collaborationMetrics: {
    messagesExchanged: number;
    successfulHandoffs: number;
    conflictResolutions: number;
    teamworkScore: number;
    communicationEffectiveness: number;
  };
  adaptabilityMetrics: {
    learningRate: number;
    adaptationSpeed: number;
    contextRetention: number;
    patternRecognition: number;
    errorRecovery: number;
  };
  overallScore: number;
  trends: {
    performance: 'improving' | 'stable' | 'declining';
    efficiency: 'improving' | 'stable' | 'declining';
    quality: 'improving' | 'stable' | 'declining';
  };
}

export interface AgentFeedback {
  agentId: string;
  feedbackType: 'positive' | 'negative' | 'neutral';
  category: 'performance' | 'quality' | 'collaboration' | 'adaptability' | 'resource_usage';
  source: 'user' | 'system' | 'peer_agent' | 'supervisor';
  details: string;
  context: {
    taskId?: string;
    interactionId?: string;
    timestamp: Date;
    metadata: Record<string, any>;
  };
  impact: 'low' | 'medium' | 'high';
  suggestions: string[];
  rating?: number; // 1-5 scale
}

export interface OptimizationPlan {
  agentId: string;
  planId: string;
  createdAt: Date;
  targetMetrics: string[];
  optimizations: AgentOptimization[];
  expectedImpact: {
    performanceImprovement: number;
    efficiencyGain: number;
    qualityImprovement: number;
    costReduction: number;
  };
  timeline: {
    shortTerm: string[]; // 1-7 days
    mediumTerm: string[]; // 1-4 weeks
    longTerm: string[]; // 1-3 months
  };
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'planned' | 'implementing' | 'completed' | 'cancelled';
  progress: number; // 0-100%
}

export interface AgentOptimization {
  id: string;
  type: 'parameter_tuning' | 'behavior_adjustment' | 'resource_allocation' | 'training_update' | 'workflow_optimization';
  description: string;
  parameters: Record<string, any>;
  expectedImpact: number; // 0-1 scale
  implementation: {
    complexity: 'low' | 'medium' | 'high';
    riskLevel: 'low' | 'medium' | 'high';
    rollbackCapable: boolean;
    testingRequired: boolean;
  };
  metrics: {
    baseline: Record<string, number>;
    target: Record<string, number>;
    measured?: Record<string, number>;
  };
  schedule: {
    plannedStart: Date;
    plannedEnd: Date;
    actualStart?: Date;
    actualEnd?: Date;
  };
  dependencies: string[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
}

export interface WorkloadBalance {
  agentId: string;
  currentLoad: number; // 0-1 scale
  optimalLoad: number; // 0-1 scale
  taskQueue: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  capabilities: string[];
  availability: number; // 0-1 scale
  lastAssignment: Date;
  performanceWeight: number; // For load balancing
}

export interface PerformanceBaseline {
  agentId: string;
  baselineDate: Date;
  metrics: PerformanceMetrics;
  version: string;
  context: {
    systemLoad: number;
    teamSize: number;
    complexityLevel: number;
    environmentFactors: string[];
  };
  isReference: boolean;
}

export class AgentPerformanceOptimizer extends EventEmitter {
  private performanceHistory: Map<string, PerformanceMetrics[]> = new Map();
  private feedbackHistory: Map<string, AgentFeedback[]> = new Map();
  private optimizationPlans: Map<string, OptimizationPlan[]> = new Map();
  private baselines: Map<string, PerformanceBaseline> = new Map();
  private workloadBalancer: Map<string, WorkloadBalance> = new Map();
  
  private readonly _PERFORMANCE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
  private readonly _OPTIMIZATION_THRESHOLD = 0.8; // Trigger optimization below 80%
  private readonly MAX_HISTORY_SIZE = 100;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    logger.info('Agent performance optimizer initialized');
  }

  /**
   * Analyze agent performance and generate insights
   */
  async analyzeAgentPerformance(agentId: string): Promise<PerformanceMetrics> {
    try {
      logger.info('Analyzing agent performance', { agentId });

      // Get recent performance data
      const recentMetrics = await this.collectRecentMetrics(agentId);
      
      // Calculate comprehensive metrics
      const metrics = await this.calculatePerformanceMetrics(agentId, recentMetrics);
      
      // Store metrics in history
      this.storeMetricsInHistory(agentId, metrics);
      
      // Check if optimization is needed
      if (metrics.overallScore < this.OPTIMIZATION_THRESHOLD) {
        await this.triggerOptimization(agentId, metrics);
      }
      
      this.emit('performanceAnalyzed', {
        agentId,
        overallScore: metrics.overallScore,
        successRate: metrics.taskMetrics.successRate,
        trends: metrics.trends,
        requiresOptimization: metrics.overallScore < this.OPTIMIZATION_THRESHOLD,
      });

      logger.info('Agent performance analysis completed', {
        agentId,
        overallScore: metrics.overallScore,
        successRate: metrics.taskMetrics.successRate,
        trends: metrics.trends,
      });

      return metrics;
    } catch (error) {
      logger.error('Agent performance analysis failed', {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Optimize agent behavior based on feedback and performance data
   */
  async optimizeAgentBehavior(agentId: string, feedback: AgentFeedback): Promise<void> {
    try {
      logger.info('Optimizing agent behavior', {
        agentId,
        feedbackType: feedback.feedbackType,
        category: feedback.category,
        impact: feedback.impact,
      });

      // Store feedback
      this.storeFeedback(agentId, feedback);

      // Analyze feedback patterns
      const feedbackPatterns = await this.analyzeFeedbackPatterns(agentId);

      // Generate optimization plan
      const optimizationPlan = await this.generateOptimizationPlan(agentId, feedback, feedbackPatterns);

      // Store optimization plan
      this.storeOptimizationPlan(agentId, optimizationPlan);

      // Apply immediate optimizations
      await this.applyImmediateOptimizations(agentId, optimizationPlan);

      this.emit('behaviorOptimized', {
        agentId,
        planId: optimizationPlan.planId,
        optimizationCount: optimizationPlan.optimizations.length,
        expectedImpact: optimizationPlan.expectedImpact,
        priority: optimizationPlan.priority,
      });

      logger.info('Agent behavior optimization completed', {
        agentId,
        planId: optimizationPlan.planId,
        optimizationCount: optimizationPlan.optimizations.length,
        priority: optimizationPlan.priority,
      });
    } catch (error) {
      logger.error('Agent behavior optimization failed', {
        agentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Balance workload across agents
   */
  async balanceAgentWorkload(): Promise<void> {
    try {
      logger.info('Balancing agent workload');

      // Get current workload state
      const workloadState = await this.assessCurrentWorkload();

      // Identify imbalances
      const imbalances = this.identifyWorkloadImbalances(workloadState);

      // Generate rebalancing plan
      const rebalancingPlan = await this.generateRebalancingPlan(imbalances);

      // Execute rebalancing
      await this.executeRebalancing(rebalancingPlan);

      this.emit('workloadBalanced', {
        agentCount: workloadState.length,
        imbalanceCount: imbalances.length,
        rebalancedTasks: rebalancingPlan.taskMoves,
        efficiency: rebalancingPlan.expectedEfficiency,
      });

      logger.info('Agent workload balancing completed', {
        agentCount: workloadState.length,
        imbalanceCount: imbalances.length,
        rebalancedTasks: rebalancingPlan.taskMoves,
      });
    } catch (error) {
      logger.error('Agent workload balancing failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async collectRecentMetrics(agentId: string): Promise<any[]> {
    // This would integrate with actual agent monitoring system
    // For now, we'll simulate recent metrics
    return [
      {
        timestamp: new Date(),
        taskId: 'task_1',
        taskType: 'analysis',
        duration: 5000,
        success: true,
        quality: 0.85,
        userRating: 4,
        resourceUsage: { cpu: 0.3, memory: 0.4, tokens: 150 },
      },
      {
        timestamp: new Date(Date.now() - 3600000),
        taskId: 'task_2',
        taskType: 'generation',
        duration: 8000,
        success: true,
        quality: 0.92,
        userRating: 5,
        resourceUsage: { cpu: 0.5, memory: 0.6, tokens: 300 },
      },
      {
        timestamp: new Date(Date.now() - 7200000),
        taskId: 'task_3',
        taskType: 'analysis',
        duration: 12000,
        success: false,
        quality: 0.4,
        userRating: 2,
        resourceUsage: { cpu: 0.8, memory: 0.9, tokens: 450 },
      },
    ];
  }

  private async calculatePerformanceMetrics(agentId: string, recentMetrics: any[]): Promise<PerformanceMetrics> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - this.PERFORMANCE_WINDOW);

    const totalTasks = recentMetrics.length;
    const completedTasks = recentMetrics.filter(m => m.success).length;
    const failedTasks = totalTasks - completedTasks;
    
    const averageTaskTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalTasks;
    const averageResponseTime = averageTaskTime * 0.8; // Assume 80% of task time is response time
    const successRate = completedTasks / totalTasks;

    const qualityScores = recentMetrics.filter(m => m.quality).map(m => m.quality);
    const averageQuality = qualityScores.length > 0 ? qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length : 0;
    
    const userRatings = recentMetrics.filter(m => m.userRating).map(m => m.userRating);
    const userSatisfaction = userRatings.length > 0 ? userRatings.reduce((sum, r) => sum + r, 0) / userRatings.length / 5 : 0;

    const resourceUsage = recentMetrics.reduce((sum, m) => ({
      cpu: sum.cpu + (m.resourceUsage?.cpu || 0),
      memory: sum.memory + (m.resourceUsage?.memory || 0),
      tokens: sum.tokens + (m.resourceUsage?.tokens || 0),
    }), { cpu: 0, memory: 0, tokens: 0 });

    const avgCpuUsage = resourceUsage.cpu / totalTasks;
    const avgMemoryUsage = resourceUsage.memory / totalTasks;
    const totalTokens = resourceUsage.tokens;

    // Calculate trends
    const historical = this.performanceHistory.get(agentId) || [];
    const trends = this.calculateTrends(historical);

    // Calculate overall score
    const overallScore = this.calculateOverallScore({
      successRate,
      averageQuality,
      userSatisfaction,
      avgCpuUsage,
      avgMemoryUsage,
      averageTaskTime,
    });

    return {
      agentId,
      agentType: 'generic', // Would be determined from agent registry
      timeRange: {
        start: windowStart,
        end: now,
      },
      taskMetrics: {
        totalTasks,
        completedTasks,
        failedTasks,
        averageTaskTime,
        averageResponseTime,
        successRate,
      },
      qualityMetrics: {
        averageQuality,
        userSatisfaction,
        accuracyScore: averageQuality * 0.9, // Simplified calculation
        completenessScore: successRate * 0.8,
        consistencyScore: this.calculateConsistencyScore(recentMetrics),
      },
      resourceMetrics: {
        cpuUsage: avgCpuUsage,
        memoryUsage: avgMemoryUsage,
        networkCalls: totalTasks * 2, // Simplified
        apiCalls: totalTasks,
        tokensUsed: totalTokens,
        costEfficiency: this.calculateCostEfficiency(totalTokens, successRate),
      },
      collaborationMetrics: {
        messagesExchanged: totalTasks * 3, // Simplified
        successfulHandoffs: Math.floor(totalTasks * 0.2),
        conflictResolutions: Math.floor(totalTasks * 0.1),
        teamworkScore: 0.8, // Would be calculated from actual collaboration data
        communicationEffectiveness: 0.85,
      },
      adaptabilityMetrics: {
        learningRate: 0.7,
        adaptationSpeed: 0.75,
        contextRetention: 0.8,
        patternRecognition: 0.85,
        errorRecovery: failedTasks > 0 ? 0.6 : 0.9,
      },
      overallScore,
      trends,
    };
  }

  private calculateConsistencyScore(metrics: any[]): number {
    if (metrics.length < 2) return 1.0;
    
    const qualityScores = metrics.map(m => m.quality).filter(q => q !== undefined);
    if (qualityScores.length < 2) return 1.0;
    
    const mean = qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length;
    const variance = qualityScores.reduce((sum, q) => sum + Math.pow(q - mean, 2), 0) / qualityScores.length;
    const standardDeviation = Math.sqrt(variance);
    
    // Lower standard deviation = higher consistency
    return Math.max(0, 1 - standardDeviation);
  }

  private calculateCostEfficiency(tokensUsed: number, successRate: number): number {
    // Simple cost efficiency calculation
    const tokensPerSuccess = successRate > 0 ? tokensUsed / successRate : tokensUsed;
    const efficiency = Math.max(0, 1 - (tokensPerSuccess / 1000)); // Assume 1000 tokens per success is baseline
    return Math.min(1, efficiency);
  }

  private calculateTrends(historical: PerformanceMetrics[]): PerformanceMetrics['trends'] {
    if (historical.length < 2) {
      return { performance: 'stable', efficiency: 'stable', quality: 'stable' };
    }

    const recent = historical.slice(-3);
    const older = historical.slice(-6, -3);

    const recentPerformance = recent.reduce((sum, m) => sum + m.overallScore, 0) / recent.length;
    const olderPerformance = older.length > 0 ? older.reduce((sum, m) => sum + m.overallScore, 0) / older.length : recentPerformance;

    const recentEfficiency = recent.reduce((sum, m) => sum + m.resourceMetrics.costEfficiency, 0) / recent.length;
    const olderEfficiency = older.length > 0 ? older.reduce((sum, m) => sum + m.resourceMetrics.costEfficiency, 0) / older.length : recentEfficiency;

    const recentQuality = recent.reduce((sum, m) => sum + m.qualityMetrics.averageQuality, 0) / recent.length;
    const olderQuality = older.length > 0 ? older.reduce((sum, m) => sum + m.qualityMetrics.averageQuality, 0) / older.length : recentQuality;

    return {
      performance: this.determineTrend(recentPerformance, olderPerformance),
      efficiency: this.determineTrend(recentEfficiency, olderEfficiency),
      quality: this.determineTrend(recentQuality, olderQuality),
    };
  }

  private determineTrend(recent: number, older: number): 'improving' | 'stable' | 'declining' {
    const threshold = 0.05; // 5% threshold
    const change = (recent - older) / older;
    
    if (change > threshold) return 'improving';
    if (change < -threshold) return 'declining';
    return 'stable';
  }

  private calculateOverallScore(metrics: {
    successRate: number;
    averageQuality: number;
    userSatisfaction: number;
    avgCpuUsage: number;
    avgMemoryUsage: number;
    averageTaskTime: number;
  }): number {
    // Weighted overall score calculation
    const weights = {
      successRate: 0.3,
      quality: 0.25,
      satisfaction: 0.2,
      efficiency: 0.15,
      speed: 0.1,
    };

    const efficiencyScore = Math.max(0, 1 - (metrics.avgCpuUsage + metrics.avgMemoryUsage) / 2);
    const speedScore = Math.max(0, 1 - (metrics.averageTaskTime / 10000)); // Assume 10s is baseline

    return (
      metrics.successRate * weights.successRate +
      metrics.averageQuality * weights.quality +
      metrics.userSatisfaction * weights.satisfaction +
      efficiencyScore * weights.efficiency +
      speedScore * weights.speed
    );
  }

  private storeMetricsInHistory(agentId: string, metrics: PerformanceMetrics): void {
    const history = this.performanceHistory.get(agentId) || [];
    history.push(metrics);
    
    // Keep only recent history
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(0, history.length - this.MAX_HISTORY_SIZE);
    }
    
    this.performanceHistory.set(agentId, history);
  }

  private async triggerOptimization(agentId: string, metrics: PerformanceMetrics): Promise<void> {
    const syntheticFeedback: AgentFeedback = {
      agentId,
      feedbackType: 'negative',
      category: 'performance',
      source: 'system',
      details: `Performance below threshold: ${metrics.overallScore.toFixed(2)}`,
      context: {
        timestamp: new Date(),
        metadata: { trigger: 'automatic', threshold: this.OPTIMIZATION_THRESHOLD },
      },
      impact: 'high',
      suggestions: [
        'Review resource allocation',
        'Optimize task handling',
        'Improve response time',
      ],
    };

    await this.optimizeAgentBehavior(agentId, syntheticFeedback);
  }

  private storeFeedback(agentId: string, feedback: AgentFeedback): void {
    const history = this.feedbackHistory.get(agentId) || [];
    history.push(feedback);
    
    // Keep only recent feedback
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.splice(0, history.length - this.MAX_HISTORY_SIZE);
    }
    
    this.feedbackHistory.set(agentId, history);
  }

  private async analyzeFeedbackPatterns(agentId: string): Promise<any> {
    const feedback = this.feedbackHistory.get(agentId) || [];
    
    if (feedback.length < 3) {
      return { patterns: [], confidence: 0 };
    }

    const patterns = {
      recurring_issues: this.findRecurringIssues(feedback),
      category_distribution: this.analyzeCategoryDistribution(feedback),
      source_patterns: this.analyzeSourcePatterns(feedback),
      trend_analysis: this.analyzeFeedbackTrends(feedback),
    };

    return {
      patterns,
      confidence: Math.min(1, feedback.length / 20), // Higher confidence with more feedback
    };
  }

  private findRecurringIssues(feedback: AgentFeedback[]): any[] {
    const issues = new Map<string, number>();
    
    feedback.filter(f => f.feedbackType === 'negative').forEach(f => {
      // Extract keywords from feedback details
      const keywords = f.details.toLowerCase().split(/\s+/)
        .filter(word => word.length > 3)
        .slice(0, 5);
        
      keywords.forEach(keyword => {
        issues.set(keyword, (issues.get(keyword) || 0) + 1);
      });
    });

    return Array.from(issues.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count, severity: count > 3 ? 'high' : 'medium' }));
  }

  private analyzeCategoryDistribution(feedback: AgentFeedback[]): any {
    const distribution = new Map<string, number>();
    
    feedback.forEach(f => {
      distribution.set(f.category, (distribution.get(f.category) || 0) + 1);
    });

    return Array.from(distribution.entries())
      .map(([category, count]) => ({ category, count, percentage: count / feedback.length }));
  }

  private analyzeSourcePatterns(feedback: AgentFeedback[]): any {
    const sources = new Map<string, { positive: number; negative: number }>();
    
    feedback.forEach(f => {
      const source = sources.get(f.source) || { positive: 0, negative: 0 };
      
      if (f.feedbackType === 'positive') source.positive++;
      else if (f.feedbackType === 'negative') source.negative++;
      
      sources.set(f.source, source);
    });

    return Array.from(sources.entries())
      .map(([source, counts]) => ({
        source,
        ...counts,
        ratio: counts.positive / (counts.positive + counts.negative),
      }));
  }

  private analyzeFeedbackTrends(feedback: AgentFeedback[]): any {
    const recent = feedback.slice(-10);
    const older = feedback.slice(-20, -10);

    const recentPositive = recent.filter(f => f.feedbackType === 'positive').length;
    const olderPositive = older.filter(f => f.feedbackType === 'positive').length;

    const recentRatio = recentPositive / recent.length;
    const olderRatio = older.length > 0 ? olderPositive / older.length : recentRatio;

    return {
      trend: this.determineTrend(recentRatio, olderRatio),
      recent_positive_ratio: recentRatio,
      older_positive_ratio: olderRatio,
    };
  }

  private async generateOptimizationPlan(
    agentId: string,
    feedback: AgentFeedback,
    patterns: any
  ): Promise<OptimizationPlan> {
    const optimizations: AgentOptimization[] = [];

    // Generate optimizations based on feedback
    if (feedback.category === 'performance') {
      optimizations.push(this.createPerformanceOptimization(agentId, feedback));
    }
    
    if (feedback.category === 'quality') {
      optimizations.push(this.createQualityOptimization(agentId, feedback));
    }
    
    if (feedback.category === 'resource_usage') {
      optimizations.push(this.createResourceOptimization(agentId, feedback));
    }

    // Generate optimizations based on patterns
    if (patterns.patterns.recurring_issues?.length > 0) {
      optimizations.push(...this.createPatternBasedOptimizations(agentId, patterns.patterns.recurring_issues));
    }

    const plan: OptimizationPlan = {
      agentId,
      planId: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      createdAt: new Date(),
      targetMetrics: this.identifyTargetMetrics(feedback, patterns),
      optimizations,
      expectedImpact: this.calculateExpectedImpact(optimizations),
      timeline: this.generateTimeline(optimizations),
      priority: this.calculatePriority(feedback, patterns),
      status: 'planned',
      progress: 0,
    };

    return plan;
  }

  private createPerformanceOptimization(agentId: string, feedback: AgentFeedback): AgentOptimization {
    return {
      id: `perf_opt_${Date.now()}`,
      type: 'parameter_tuning',
      description: 'Optimize performance parameters based on feedback',
      parameters: {
        responseTimeTarget: 0.8,
        throughputIncrease: 0.2,
        cacheOptimization: true,
      },
      expectedImpact: 0.3,
      implementation: {
        complexity: 'medium',
        riskLevel: 'low',
        rollbackCapable: true,
        testingRequired: true,
      },
      metrics: {
        baseline: { responseTime: 5000, throughput: 10 },
        target: { responseTime: 4000, throughput: 12 },
      },
      schedule: {
        plannedStart: new Date(),
        plannedEnd: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
      dependencies: [],
      status: 'pending',
    };
  }

  private createQualityOptimization(agentId: string, feedback: AgentFeedback): AgentOptimization {
    return {
      id: `qual_opt_${Date.now()}`,
      type: 'behavior_adjustment',
      description: 'Adjust behavior to improve output quality',
      parameters: {
        qualityThreshold: 0.9,
        reviewProcess: true,
        validationSteps: 3,
      },
      expectedImpact: 0.4,
      implementation: {
        complexity: 'medium',
        riskLevel: 'low',
        rollbackCapable: true,
        testingRequired: true,
      },
      metrics: {
        baseline: { quality: 0.7, userSatisfaction: 0.6 },
        target: { quality: 0.85, userSatisfaction: 0.8 },
      },
      schedule: {
        plannedStart: new Date(),
        plannedEnd: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
      dependencies: [],
      status: 'pending',
    };
  }

  private createResourceOptimization(agentId: string, feedback: AgentFeedback): AgentOptimization {
    return {
      id: `res_opt_${Date.now()}`,
      type: 'resource_allocation',
      description: 'Optimize resource usage for better efficiency',
      parameters: {
        memoryLimit: 0.8,
        cpuLimit: 0.7,
        batchSize: 10,
      },
      expectedImpact: 0.25,
      implementation: {
        complexity: 'low',
        riskLevel: 'low',
        rollbackCapable: true,
        testingRequired: false,
      },
      metrics: {
        baseline: { memoryUsage: 0.9, cpuUsage: 0.8 },
        target: { memoryUsage: 0.7, cpuUsage: 0.6 },
      },
      schedule: {
        plannedStart: new Date(),
        plannedEnd: new Date(Date.now() + 12 * 60 * 60 * 1000),
      },
      dependencies: [],
      status: 'pending',
    };
  }

  private createPatternBasedOptimizations(agentId: string, recurringIssues: any[]): AgentOptimization[] {
    return recurringIssues.map((issue, index) => ({
      id: `pattern_opt_${Date.now()}_${index}`,
      type: 'behavior_adjustment',
      description: `Address recurring issue: ${issue.issue}`,
      parameters: {
        issueType: issue.issue,
        severity: issue.severity,
        preventionMeasures: true,
      },
      expectedImpact: issue.severity === 'high' ? 0.5 : 0.3,
      implementation: {
        complexity: 'medium',
        riskLevel: 'low',
        rollbackCapable: true,
        testingRequired: true,
      },
      metrics: {
        baseline: { issueFrequency: issue.count },
        target: { issueFrequency: Math.max(1, Math.floor(issue.count * 0.3)) },
      },
      schedule: {
        plannedStart: new Date(Date.now() + index * 24 * 60 * 60 * 1000),
        plannedEnd: new Date(Date.now() + (index + 2) * 24 * 60 * 60 * 1000),
      },
      dependencies: [],
      status: 'pending',
    }));
  }

  private identifyTargetMetrics(feedback: AgentFeedback, patterns: any): string[] {
    const metrics = [];
    
    if (feedback.category === 'performance') {
      metrics.push('responseTime', 'throughput', 'successRate');
    }
    
    if (feedback.category === 'quality') {
      metrics.push('quality', 'userSatisfaction', 'accuracy');
    }
    
    if (feedback.category === 'resource_usage') {
      metrics.push('memoryUsage', 'cpuUsage', 'costEfficiency');
    }

    if (patterns.patterns.recurring_issues?.length > 0) {
      metrics.push('errorRate', 'consistencyScore');
    }

    return metrics;
  }

  private calculateExpectedImpact(optimizations: AgentOptimization[]): OptimizationPlan['expectedImpact'] {
    const totalImpact = optimizations.reduce((sum, opt) => sum + opt.expectedImpact, 0);
    
    return {
      performanceImprovement: totalImpact * 0.4,
      efficiencyGain: totalImpact * 0.3,
      qualityImprovement: totalImpact * 0.2,
      costReduction: totalImpact * 0.1,
    };
  }

  private generateTimeline(optimizations: AgentOptimization[]): OptimizationPlan['timeline'] {
    const shortTerm = optimizations
      .filter(opt => opt.implementation.complexity === 'low')
      .map(opt => opt.description);
    
    const mediumTerm = optimizations
      .filter(opt => opt.implementation.complexity === 'medium')
      .map(opt => opt.description);
    
    const longTerm = optimizations
      .filter(opt => opt.implementation.complexity === 'high')
      .map(opt => opt.description);

    return { shortTerm, mediumTerm, longTerm };
  }

  private calculatePriority(feedback: AgentFeedback, patterns: any): OptimizationPlan['priority'] {
    if (feedback.impact === 'high' || patterns.patterns.recurring_issues?.some((i: any) => i.severity === 'high')) {
      return 'critical';
    }
    
    if (feedback.impact === 'medium' || patterns.confidence > 0.7) {
      return 'high';
    }
    
    return 'medium';
  }

  private storeOptimizationPlan(agentId: string, plan: OptimizationPlan): void {
    const plans = this.optimizationPlans.get(agentId) || [];
    plans.push(plan);
    
    // Keep only recent plans
    if (plans.length > 20) {
      plans.splice(0, plans.length - 20);
    }
    
    this.optimizationPlans.set(agentId, plans);
  }

  private async applyImmediateOptimizations(agentId: string, plan: OptimizationPlan): Promise<void> {
    // Apply optimizations that can be implemented immediately
    const immediateOptimizations = plan.optimizations.filter(opt => 
      opt.implementation.complexity === 'low' && 
      opt.implementation.riskLevel === 'low' &&
      opt.dependencies.length === 0
    );

    for (const optimization of immediateOptimizations) {
      try {
        await this.applyOptimization(agentId, optimization);
        optimization.status = 'completed';
        optimization.schedule.actualStart = new Date();
        optimization.schedule.actualEnd = new Date();
        
        plan.progress += (1 / plan.optimizations.length) * 100;
      } catch (error) {
        optimization.status = 'failed';
        logger.error('Failed to apply immediate optimization', {
          agentId,
          optimizationId: optimization.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async applyOptimization(agentId: string, optimization: AgentOptimization): Promise<void> {
    // This would integrate with the actual agent system to apply optimizations
    // For now, we'll simulate the application
    
    switch (optimization.type) {
      case 'parameter_tuning':
        await this.applyParameterTuning(agentId, optimization.parameters);
        break;
      case 'behavior_adjustment':
        await this.applyBehaviorAdjustment(agentId, optimization.parameters);
        break;
      case 'resource_allocation':
        await this.applyResourceAllocation(agentId, optimization.parameters);
        break;
      default:
        throw new Error(`Unknown optimization type: ${optimization.type}`);
    }
  }

  private async applyParameterTuning(agentId: string, parameters: Record<string, any>): Promise<void> {
    // Simulate parameter tuning
    logger.info('Applying parameter tuning', { agentId, parameters });
  }

  private async applyBehaviorAdjustment(agentId: string, parameters: Record<string, any>): Promise<void> {
    // Simulate behavior adjustment
    logger.info('Applying behavior adjustment', { agentId, parameters });
  }

  private async applyResourceAllocation(agentId: string, parameters: Record<string, any>): Promise<void> {
    // Simulate resource allocation
    logger.info('Applying resource allocation', { agentId, parameters });
  }

  private async assessCurrentWorkload(): Promise<WorkloadBalance[]> {
    // This would integrate with actual agent registry
    // For now, simulate workload state
    return [
      {
        agentId: 'agent_1',
        currentLoad: 0.8,
        optimalLoad: 0.7,
        taskQueue: 5,
        priority: 'high',
        capabilities: ['analysis', 'generation'],
        availability: 0.9,
        lastAssignment: new Date(),
        performanceWeight: 0.85,
      },
      {
        agentId: 'agent_2',
        currentLoad: 0.4,
        optimalLoad: 0.7,
        taskQueue: 1,
        priority: 'medium',
        capabilities: ['analysis', 'coordination'],
        availability: 0.95,
        lastAssignment: new Date(Date.now() - 3600000),
        performanceWeight: 0.75,
      },
    ];
  }

  private identifyWorkloadImbalances(workloadState: WorkloadBalance[]): any[] {
    const imbalances = [];
    
    for (const agent of workloadState) {
      const loadDifference = agent.currentLoad - agent.optimalLoad;
      
      if (Math.abs(loadDifference) > 0.2) {
        imbalances.push({
          agentId: agent.agentId,
          type: loadDifference > 0 ? 'overloaded' : 'underutilized',
          severity: Math.abs(loadDifference),
          currentLoad: agent.currentLoad,
          optimalLoad: agent.optimalLoad,
          taskQueue: agent.taskQueue,
        });
      }
    }
    
    return imbalances;
  }

  private async generateRebalancingPlan(imbalances: any[]): Promise<any> {
    // Simple rebalancing plan
    return {
      taskMoves: imbalances.length * 2,
      expectedEfficiency: 0.85,
      actions: imbalances.map(imbalance => ({
        agentId: imbalance.agentId,
        action: imbalance.type === 'overloaded' ? 'reduce_load' : 'increase_load',
        targetLoad: imbalance.optimalLoad,
      })),
    };
  }

  private async executeRebalancing(plan: any): Promise<void> {
    // Simulate rebalancing execution
    for (const action of plan.actions) {
      logger.info('Executing rebalancing action', action);
    }
  }

  // Public interface methods

  getPerformanceHistory(agentId: string, limit: number = 10): PerformanceMetrics[] {
    const history = this.performanceHistory.get(agentId) || [];
    return history.slice(-limit);
  }

  getFeedbackHistory(agentId: string, limit: number = 20): AgentFeedback[] {
    const history = this.feedbackHistory.get(agentId) || [];
    return history.slice(-limit);
  }

  getOptimizationPlans(agentId: string): OptimizationPlan[] {
    return this.optimizationPlans.get(agentId) || [];
  }

  getActiveOptimizations(agentId: string): AgentOptimization[] {
    const plans = this.optimizationPlans.get(agentId) || [];
    return plans
      .filter(plan => plan.status === 'implementing')
      .flatMap(plan => plan.optimizations)
      .filter(opt => opt.status === 'in_progress');
  }

  async setPerformanceBaseline(agentId: string): Promise<void> {
    const currentMetrics = await this.analyzeAgentPerformance(agentId);
    
    const baseline: PerformanceBaseline = {
      agentId,
      baselineDate: new Date(),
      metrics: currentMetrics,
      version: '1.0',
      context: {
        systemLoad: 0.6,
        teamSize: 5,
        complexityLevel: 0.7,
        environmentFactors: ['production', 'peak_hours'],
      },
      isReference: true,
    };
    
    this.baselines.set(agentId, baseline);
    
    logger.info('Performance baseline set', { agentId, overallScore: currentMetrics.overallScore });
  }

  getPerformanceBaseline(agentId: string): PerformanceBaseline | undefined {
    return this.baselines.get(agentId);
  }

  getAllAgentMetrics(): Map<string, PerformanceMetrics> {
    const currentMetrics = new Map<string, PerformanceMetrics>();
    
    for (const [agentId, history] of this.performanceHistory.entries()) {
      if (history.length > 0) {
        currentMetrics.set(agentId, history[history.length - 1]);
      }
    }
    
    return currentMetrics;
  }

  getSystemStats(): {
    totalAgents: number;
    totalOptimizations: number;
    averagePerformance: number;
    optimizationSuccessRate: number;
  } {
    const allMetrics = this.getAllAgentMetrics();
    const totalAgents = allMetrics.size;
    
    const totalOptimizations = Array.from(this.optimizationPlans.values())
      .reduce((sum, plans) => sum + plans.length, 0);
    
    const averagePerformance = totalAgents > 0 
      ? Array.from(allMetrics.values())
          .reduce((sum, metrics) => sum + metrics.overallScore, 0) / totalAgents
      : 0;
    
    const completedOptimizations = Array.from(this.optimizationPlans.values())
      .flatMap(plans => plans)
      .flatMap(plan => plan.optimizations)
      .filter(opt => opt.status === 'completed');
    
    const optimizationSuccessRate = totalOptimizations > 0 
      ? completedOptimizations.length / totalOptimizations 
      : 0;
    
    return {
      totalAgents,
      totalOptimizations,
      averagePerformance,
      optimizationSuccessRate,
    };
  }

  async clearHistory(agentId?: string): Promise<void> {
    if (agentId) {
      this.performanceHistory.delete(agentId);
      this.feedbackHistory.delete(agentId);
      this.optimizationPlans.delete(agentId);
      this.baselines.delete(agentId);
    } else {
      this.performanceHistory.clear();
      this.feedbackHistory.clear();
      this.optimizationPlans.clear();
      this.baselines.clear();
    }
    
    this.emit('historyCleared', { agentId });
    logger.info('Agent performance history cleared', { agentId });
  }
}

export default AgentPerformanceOptimizer;