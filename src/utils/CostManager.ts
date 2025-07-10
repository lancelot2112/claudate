import { EventEmitter } from 'events';
import logger from './logger';
import { config } from './config';

export interface CostEntry {
  id: string;
  service: 'anthropic' | 'google' | 'openai';
  model: string;
  requestType: 'completion' | 'embedding' | 'function_call';
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
  userId?: string;
  agentId?: string;
  taskId?: string;
  metadata?: Record<string, any>;
}

export interface CostLimits {
  dailyLimit: number;
  monthlyLimit: number;
  userDailyLimit: number;
  agentDailyLimit: number;
  alertThreshold: number;
}

export interface CostBudget {
  id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly' | 'project';
  limit: number;
  spent: number;
  remaining: number;
  period: {
    start: Date;
    end: Date;
  };
  filters: {
    userId?: string;
    agentId?: string;
    service?: string[];
    model?: string[];
  };
  alerts: {
    thresholds: number[]; // Percentage thresholds (e.g., [50, 75, 90])
    notificationsSent: number[];
  };
}

export interface CostPrediction {
  period: 'daily' | 'weekly' | 'monthly';
  predictedCost: number;
  confidence: number;
  factors: {
    historicalTrend: number;
    seasonality: number;
    growthRate: number;
  };
  recommendations: string[];
}

export interface UsagePattern {
  service: string;
  model: string;
  averageDailyCost: number;
  peakUsageHours: number[];
  efficiency: {
    tokensPerRequest: number;
    costPerTask: number;
    errorRate: number;
  };
  trends: {
    weeklyGrowth: number;
    monthlyGrowth: number;
  };
}

export class CostManager extends EventEmitter {
  private costEntries: Map<string, CostEntry> = new Map();
  private budgets: Map<string, CostBudget> = new Map();
  private costLimits: CostLimits;
  private dailySpend: Map<string, number> = new Map(); // date -> total cost
  private userSpend: Map<string, Map<string, number>> = new Map(); // userId -> date -> cost
  private agentSpend: Map<string, Map<string, number>> = new Map(); // agentId -> date -> cost

  constructor() {
    super();
    
    this.costLimits = {
      dailyLimit: config.costs.dailyLimit,
      monthlyLimit: config.costs.dailyLimit * 30,
      userDailyLimit: config.costs.dailyLimit * 0.1, // 10% of daily limit per user
      agentDailyLimit: config.costs.dailyLimit * 0.2, // 20% of daily limit per agent
      alertThreshold: config.costs.alertThreshold
    };

    this.initializeDefaultBudgets();
    this.startCostMonitoring();
    
    logger.info('CostManager initialized', { 
      dailyLimit: this.costLimits.dailyLimit,
      alertThreshold: this.costLimits.alertThreshold 
    });
  }

  private initializeDefaultBudgets(): void {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    // Daily budget
    this.createBudget({
      id: 'daily-global',
      name: 'Global Daily Budget',
      type: 'daily',
      limit: this.costLimits.dailyLimit,
      period: { start: startOfDay, end: endOfDay },
      filters: {},
      alerts: {
        thresholds: [50, 75, 90, 100],
        notificationsSent: []
      }
    });

    // Monthly budget
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    this.createBudget({
      id: 'monthly-global',
      name: 'Global Monthly Budget',
      type: 'monthly',
      limit: this.costLimits.monthlyLimit,
      period: { start: startOfMonth, end: endOfMonth },
      filters: {},
      alerts: {
        thresholds: [50, 75, 90, 100],
        notificationsSent: []
      }
    });
  }

  public async recordCost(entry: Omit<CostEntry, 'id' | 'timestamp'>): Promise<string> {
    const costEntry: CostEntry = {
      ...entry,
      id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    // Check if this would exceed limits
    const limitCheck = await this.checkCostLimits(costEntry);
    if (!limitCheck.allowed) {
      logger.warn('Cost limit would be exceeded', { 
        entry: costEntry, 
        reason: limitCheck.reason,
        currentSpend: limitCheck.currentSpend,
        limit: limitCheck.limit
      });
      
      this.emit('cost-limit-exceeded', {
        entry: costEntry,
        reason: limitCheck.reason,
        currentSpend: limitCheck.currentSpend,
        limit: limitCheck.limit
      });
      
      throw new Error(`Cost limit exceeded: ${limitCheck.reason}`);
    }

    // Record the cost
    this.costEntries.set(costEntry.id, costEntry);
    
    // Update spending tracking
    this.updateSpendingTracking(costEntry);
    
    // Update budgets
    this.updateBudgets(costEntry);
    
    // Check for alerts
    await this.checkAlerts(costEntry);

    logger.debug('Cost recorded', { 
      costId: costEntry.id,
      service: costEntry.service,
      model: costEntry.model,
      cost: costEntry.cost,
      userId: costEntry.userId,
      agentId: costEntry.agentId
    });

    this.emit('cost-recorded', costEntry);
    return costEntry.id;
  }

  private async checkCostLimits(entry: CostEntry): Promise<{
    allowed: boolean;
    reason?: string;
    currentSpend?: number;
    limit?: number;
  }> {
    const today = this.getDateKey(new Date());
    
    // Check daily global limit
    const dailySpend = this.dailySpend.get(today) || 0;
    if (dailySpend + entry.cost > this.costLimits.dailyLimit) {
      return {
        allowed: false,
        reason: 'Daily global limit exceeded',
        currentSpend: dailySpend,
        limit: this.costLimits.dailyLimit
      };
    }

    // Check user daily limit
    if (entry.userId) {
      const userDailySpend = this.userSpend.get(entry.userId)?.get(today) || 0;
      if (userDailySpend + entry.cost > this.costLimits.userDailyLimit) {
        return {
          allowed: false,
          reason: `User daily limit exceeded for user ${entry.userId}`,
          currentSpend: userDailySpend,
          limit: this.costLimits.userDailyLimit
        };
      }
    }

    // Check agent daily limit
    if (entry.agentId) {
      const agentDailySpend = this.agentSpend.get(entry.agentId)?.get(today) || 0;
      if (agentDailySpend + entry.cost > this.costLimits.agentDailyLimit) {
        return {
          allowed: false,
          reason: `Agent daily limit exceeded for agent ${entry.agentId}`,
          currentSpend: agentDailySpend,
          limit: this.costLimits.agentDailyLimit
        };
      }
    }

    return { allowed: true };
  }

  private updateSpendingTracking(entry: CostEntry): void {
    const today = this.getDateKey(entry.timestamp);
    
    // Update daily spend
    const currentDailySpend = this.dailySpend.get(today) || 0;
    this.dailySpend.set(today, currentDailySpend + entry.cost);

    // Update user spend
    if (entry.userId) {
      if (!this.userSpend.has(entry.userId)) {
        this.userSpend.set(entry.userId, new Map());
      }
      const userDailySpend = this.userSpend.get(entry.userId)!;
      const currentUserSpend = userDailySpend.get(today) || 0;
      userDailySpend.set(today, currentUserSpend + entry.cost);
    }

    // Update agent spend
    if (entry.agentId) {
      if (!this.agentSpend.has(entry.agentId)) {
        this.agentSpend.set(entry.agentId, new Map());
      }
      const agentDailySpend = this.agentSpend.get(entry.agentId)!;
      const currentAgentSpend = agentDailySpend.get(today) || 0;
      agentDailySpend.set(today, currentAgentSpend + entry.cost);
    }
  }

  private updateBudgets(entry: CostEntry): void {
    for (const budget of this.budgets.values()) {
      if (this.entryMatchesBudgetFilters(entry, budget)) {
        budget.spent += entry.cost;
        budget.remaining = budget.limit - budget.spent;
      }
    }
  }

  private entryMatchesBudgetFilters(entry: CostEntry, budget: CostBudget): boolean {
    // Check if entry falls within budget period
    if (entry.timestamp < budget.period.start || entry.timestamp > budget.period.end) {
      return false;
    }

    // Check filters
    if (budget.filters.userId && budget.filters.userId !== entry.userId) {
      return false;
    }
    
    if (budget.filters.agentId && budget.filters.agentId !== entry.agentId) {
      return false;
    }
    
    if (budget.filters.service && !budget.filters.service.includes(entry.service)) {
      return false;
    }
    
    if (budget.filters.model && !budget.filters.model.includes(entry.model)) {
      return false;
    }

    return true;
  }

  private async checkAlerts(entry: CostEntry): Promise<void> {
    for (const budget of this.budgets.values()) {
      if (!this.entryMatchesBudgetFilters(entry, budget)) continue;

      const spentPercentage = (budget.spent / budget.limit) * 100;
      
      for (const threshold of budget.alerts.thresholds) {
        if (spentPercentage >= threshold && !budget.alerts.notificationsSent.includes(threshold)) {
          budget.alerts.notificationsSent.push(threshold);
          
          await this.sendCostAlert(budget, threshold, spentPercentage);
        }
      }
    }
  }

  private async sendCostAlert(budget: CostBudget, threshold: number, currentPercentage: number): Promise<void> {
    const alertData = {
      budgetId: budget.id,
      budgetName: budget.name,
      threshold,
      currentPercentage: Math.round(currentPercentage * 100) / 100,
      spent: budget.spent,
      limit: budget.limit,
      remaining: budget.remaining
    };

    logger.warn('Cost alert triggered', alertData);
    this.emit('cost-alert', alertData);

    // Send notifications (integrate with communication layer)
    if (currentPercentage >= 90) {
      this.emit('critical-cost-alert', alertData);
    }
  }

  public createBudget(budgetData: Omit<CostBudget, 'spent' | 'remaining'>): string {
    const budget: CostBudget = {
      ...budgetData,
      spent: 0,
      remaining: budgetData.limit
    };

    this.budgets.set(budget.id, budget);
    
    logger.info('Budget created', { 
      budgetId: budget.id, 
      name: budget.name, 
      limit: budget.limit 
    });

    return budget.id;
  }

  public updateBudget(budgetId: string, updates: Partial<CostBudget>): void {
    const budget = this.budgets.get(budgetId);
    if (budget) {
      Object.assign(budget, updates);
      if (updates.limit !== undefined) {
        budget.remaining = budget.limit - budget.spent;
      }
      
      logger.info('Budget updated', { budgetId, updates });
    }
  }

  public getBudget(budgetId: string): CostBudget | undefined {
    return this.budgets.get(budgetId);
  }

  public getAllBudgets(): CostBudget[] {
    return Array.from(this.budgets.values());
  }

  public getCostSummary(period: 'today' | 'week' | 'month' = 'today'): {
    totalCost: number;
    byService: Record<string, number>;
    byModel: Record<string, number>;
    byUser: Record<string, number>;
    byAgent: Record<string, number>;
    requestCount: number;
    averageCostPerRequest: number;
  } {
    const entries = this.getEntriesForPeriod(period);
    
    const summary = {
      totalCost: 0,
      byService: {} as Record<string, number>,
      byModel: {} as Record<string, number>,
      byUser: {} as Record<string, number>,
      byAgent: {} as Record<string, number>,
      requestCount: entries.length,
      averageCostPerRequest: 0
    };

    for (const entry of entries) {
      summary.totalCost += entry.cost;
      
      summary.byService[entry.service] = (summary.byService[entry.service] || 0) + entry.cost;
      summary.byModel[entry.model] = (summary.byModel[entry.model] || 0) + entry.cost;
      
      if (entry.userId) {
        summary.byUser[entry.userId] = (summary.byUser[entry.userId] || 0) + entry.cost;
      }
      
      if (entry.agentId) {
        summary.byAgent[entry.agentId] = (summary.byAgent[entry.agentId] || 0) + entry.cost;
      }
    }

    summary.averageCostPerRequest = summary.requestCount > 0 ? summary.totalCost / summary.requestCount : 0;
    
    return summary;
  }

  public async predictCosts(period: 'daily' | 'weekly' | 'monthly'): Promise<CostPrediction> {
    const historicalData = this.getHistoricalCostData(period);
    
    // Simple linear regression for prediction
    const costs = historicalData.map(d => d.cost);
    const trend = this.calculateTrend(costs);
    
    let predictedCost = 0;
    let confidence = 0.5;
    
    if (costs.length > 0) {
      const averageCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
      predictedCost = averageCost * (1 + trend);
      confidence = Math.max(0.1, Math.min(0.9, 1 - Math.abs(trend)));
    }

    return {
      period,
      predictedCost,
      confidence,
      factors: {
        historicalTrend: trend,
        seasonality: 0, // Simplified
        growthRate: trend
      },
      recommendations: this.generateCostRecommendations(historicalData)
    };
  }

  public getUsagePatterns(): UsagePattern[] {
    const patterns: UsagePattern[] = [];
    const serviceModels = new Map<string, CostEntry[]>();

    // Group entries by service and model
    for (const entry of this.costEntries.values()) {
      const key = `${entry.service}-${entry.model}`;
      if (!serviceModels.has(key)) {
        serviceModels.set(key, []);
      }
      serviceModels.get(key)!.push(entry);
    }

    // Calculate patterns for each service-model combination
    for (const [key, entries] of serviceModels) {
      const [service, model] = key.split('-');
      
      // Ensure service and model are defined
      if (!service || !model || entries.length === 0) {
        continue;
      }
      
      const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);
      const averageDailyCost = totalCost / this.getUniqueDays(entries).length;
      
      patterns.push({
        service,
        model,
        averageDailyCost,
        peakUsageHours: this.calculatePeakHours(entries),
        efficiency: {
          tokensPerRequest: this.calculateAverageTokens(entries),
          costPerTask: this.calculateCostPerTask(entries),
          errorRate: 0 // Would need error tracking
        },
        trends: {
          weeklyGrowth: this.calculateGrowthRate(entries, 'week'),
          monthlyGrowth: this.calculateGrowthRate(entries, 'month')
        }
      });
    }

    return patterns;
  }

  public optimizeCosts(): {
    recommendations: string[];
    potentialSavings: number;
    optimizations: Array<{
      type: string;
      description: string;
      estimatedSavings: number;
      implementation: string;
    }>;
  } {
    const patterns = this.getUsagePatterns();
    const recommendations: string[] = [];
    const optimizations: any[] = [];
    let potentialSavings = 0;

    // Analyze patterns for optimization opportunities
    for (const pattern of patterns) {
      // Check for inefficient model usage
      if (pattern.efficiency.tokensPerRequest > 1000 && pattern.service === 'anthropic') {
        const savings = pattern.averageDailyCost * 0.2; // Estimated 20% savings
        optimizations.push({
          type: 'model_optimization',
          description: `Consider using a smaller model for ${pattern.service}-${pattern.model} tasks`,
          estimatedSavings: savings,
          implementation: 'Switch to claude-3-haiku for simple tasks'
        });
        potentialSavings += savings;
      }

      // Check for peak usage optimization
      if (pattern.peakUsageHours.length > 12) {
        recommendations.push(`Distribute ${pattern.service} usage more evenly throughout the day`);
      }
    }

    // General recommendations
    recommendations.push(
      'Implement request batching to reduce API calls',
      'Use caching for repeated queries',
      'Monitor and alert on unusual cost spikes',
      'Regularly review and optimize prompts for efficiency'
    );

    return {
      recommendations,
      potentialSavings,
      optimizations
    };
  }

  private getEntriesForPeriod(period: 'today' | 'week' | 'month'): CostEntry[] {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return Array.from(this.costEntries.values())
      .filter(entry => entry.timestamp >= startDate);
  }

  private getHistoricalCostData(period: 'daily' | 'weekly' | 'monthly'): Array<{ date: string; cost: number }> {
    // Implementation would aggregate costs by the specified period
    // For now, return simplified data
    return [];
  }

  private calculateTrend(costs: number[]): number {
    if (costs.length < 2) return 0;
    
    // Simple linear trend calculation
    const n = costs.length;
    const sumX = costs.reduce((sum, _, i) => sum + i, 0);
    const sumY = costs.reduce((sum, cost) => sum + cost, 0);
    const sumXY = costs.reduce((sum, cost, i) => sum + i * cost, 0);
    const sumXX = costs.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgCost = sumY / n;
    
    return avgCost > 0 ? slope / avgCost : 0;
  }

  private generateCostRecommendations(historicalData: any[]): string[] {
    return [
      'Monitor usage patterns to identify optimization opportunities',
      'Consider implementing cost alerts at 75% of budget',
      'Review model selection for cost efficiency'
    ];
  }

  private getUniqueDays(entries: CostEntry[]): string[] {
    const days = new Set<string>();
    for (const entry of entries) {
      days.add(this.getDateKey(entry.timestamp));
    }
    return Array.from(days);
  }

  private calculatePeakHours(entries: CostEntry[]): number[] {
    const hourCounts = new Map<number, number>();
    
    for (const entry of entries) {
      const hour = entry.timestamp.getHours();
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
    }

    // Return hours with above-average usage
    const averageUsage = entries.length / 24;
    return Array.from(hourCounts.entries())
      .filter(([_, count]) => count > averageUsage)
      .map(([hour, _]) => hour);
  }

  private calculateAverageTokens(entries: CostEntry[]): number {
    const totalTokens = entries.reduce((sum, e) => sum + e.inputTokens + e.outputTokens, 0);
    return entries.length > 0 ? totalTokens / entries.length : 0;
  }

  private calculateCostPerTask(entries: CostEntry[]): number {
    const tasksWithTaskId = entries.filter(e => e.taskId);
    const uniqueTasks = new Set(tasksWithTaskId.map(e => e.taskId));
    const totalCost = entries.reduce((sum, e) => sum + e.cost, 0);
    
    return uniqueTasks.size > 0 ? totalCost / uniqueTasks.size : totalCost / entries.length;
  }

  private calculateGrowthRate(entries: CostEntry[], period: 'week' | 'month'): number {
    // Simplified growth rate calculation
    return 0;
  }

  private getDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private startCostMonitoring(): void {
    // Reset daily budgets at midnight
    setInterval(() => {
      const now = new Date();
      if (now.getHours() === 0 && now.getMinutes() === 0) {
        this.resetDailyBudgets();
      }
    }, 60000); // Check every minute

    // Clean up old cost entries (keep last 90 days)
    setInterval(() => {
      this.cleanupOldEntries();
    }, 24 * 60 * 60 * 1000); // Daily cleanup
  }

  private resetDailyBudgets(): void {
    for (const budget of this.budgets.values()) {
      if (budget.type === 'daily') {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        
        budget.period.start = startOfDay;
        budget.period.end = endOfDay;
        budget.spent = 0;
        budget.remaining = budget.limit;
        budget.alerts.notificationsSent = [];
      }
    }
    
    logger.info('Daily budgets reset');
  }

  private cleanupOldEntries(): void {
    const cutoffDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago
    
    for (const [id, entry] of this.costEntries) {
      if (entry.timestamp < cutoffDate) {
        this.costEntries.delete(id);
      }
    }
    
    logger.info('Old cost entries cleaned up', { cutoffDate });
  }

  public getDailyCost(date?: Date): number {
    const targetDate = date || new Date();
    const dateKey = this.getDateKey(targetDate);
    return this.dailySpend.get(dateKey) || 0;
  }

  public getUserDailyCost(userId: string, date?: Date): number {
    const targetDate = date || new Date();
    const dateKey = this.getDateKey(targetDate);
    return this.userSpend.get(userId)?.get(dateKey) || 0;
  }

  public getAgentDailyCost(agentId: string, date?: Date): number {
    const targetDate = date || new Date();
    const dateKey = this.getDateKey(targetDate);
    return this.agentSpend.get(agentId)?.get(dateKey) || 0;
  }
}

export default CostManager;