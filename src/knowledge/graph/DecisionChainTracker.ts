import { EventEmitter } from 'events';
import logger from '../../utils/logger';

export interface Decision {
  id: string;
  title: string;
  description: string;
  decisionMaker: string;
  stakeholders: string[];
  options: DecisionOption[];
  selectedOption?: string;
  reasoning: string;
  context: DecisionContext;
  timestamp: Date;
  deadline?: Date;
  status: 'pending' | 'made' | 'implemented' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  metadata: {
    source: string;
    confidence: number;
    impactLevel: 'low' | 'medium' | 'high';
    reversibility: 'reversible' | 'difficult' | 'irreversible';
  };
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  estimatedImpact: {
    financial?: number;
    time?: number;
    resources?: number;
    risk?: number;
  };
  feasibility: number; // 0-1
  alignment: number; // 0-1 (alignment with goals)
  confidence: number; // 0-1
}

export interface DecisionContext {
  projectId?: string;
  departmentId?: string;
  organizationId?: string;
  relatedDecisions: string[];
  dependencies: string[];
  constraints: string[];
  successCriteria: string[];
  businessContext: string;
  technicalContext: string;
  environmentalFactors: string[];
}

export interface DecisionOutcome {
  decisionId: string;
  actualResults: {
    financial?: number;
    timeline?: number;
    quality?: number;
    satisfaction?: number;
    riskMitigation?: number;
  };
  unintendedConsequences: string[];
  lessonsLearned: string[];
  wouldDecideDifferently: boolean;
  alternativeConsidered?: string;
  measuredAt: Date;
  measuredBy: string;
  followUpActions: string[];
}

export interface DecisionChain {
  id: string;
  title: string;
  description: string;
  decisions: Decision[];
  outcomes: DecisionOutcome[];
  patterns: DecisionPattern[];
  startDate: Date;
  endDate?: Date;
  totalImpact: {
    financial: number;
    time: number;
    quality: number;
    satisfaction: number;
  };
  metadata: {
    decisionCount: number;
    averageDecisionTime: number;
    successRate: number;
    riskLevel: number;
    complexity: number;
  };
}

export interface DecisionPattern {
  id: string;
  type: 'sequential' | 'parallel' | 'conditional' | 'cyclical' | 'escalation';
  pattern: string;
  frequency: number;
  context: string;
  effectiveness: number; // 0-1
  confidence: number; // 0-1
  examples: string[];
  recommendations: string[];
  lastObserved: Date;
}

export interface PredictionResult {
  decisionId: string;
  predictedOutcome: {
    successProbability: number;
    estimatedImpact: DecisionOutcome['actualResults'];
    riskFactors: string[];
    confidenceLevel: number;
  };
  recommendedAdjustments: string[];
  basedOnPatterns: string[];
  predictionModel: string;
  generatedAt: Date;
}

export interface DecisionAnalytics {
  totalDecisions: number;
  decisionsByStatus: Record<string, number>;
  decisionsByPriority: Record<string, number>;
  averageDecisionTime: number;
  successRate: number;
  mostCommonPatterns: DecisionPattern[];
  topDecisionMakers: Array<{ name: string; count: number; successRate: number }>;
  impactAnalysis: {
    highImpactDecisions: number;
    totalFinancialImpact: number;
    timeImpactHours: number;
    qualityImprovements: number;
  };
}

export class DecisionChainTracker extends EventEmitter {
  private decisions: Map<string, Decision> = new Map();
  private outcomes: Map<string, DecisionOutcome> = new Map();
  private chains: Map<string, DecisionChain> = new Map();
  private patterns: Map<string, DecisionPattern> = new Map();
  private predictions: Map<string, PredictionResult> = new Map();

  constructor() {
    super();
    this.initializeDefaultPatterns();
  }

  async initialize(): Promise<void> {
    logger.info('Decision chain tracker initialized');
  }

  /**
   * Track a decision within its chain context
   */
  async trackDecisionChain(decision: Decision, context: DecisionContext): Promise<void> {
    try {
      // Store the decision
      this.decisions.set(decision.id, decision);

      // Find or create decision chain
      const chain = await this.findOrCreateChain(decision, context);

      // Add decision to chain
      chain.decisions.push(decision);
      chain.metadata.decisionCount = chain.decisions.length;

      // Update chain metadata
      await this.updateChainMetadata(chain);

      // Detect patterns
      await this.detectPatternsInChain(chain);

      // Store updated chain
      this.chains.set(chain.id, chain);

      this.emit('decisionTracked', {
        decisionId: decision.id,
        chainId: chain.id,
        priority: decision.priority,
        status: decision.status,
        stakeholderCount: decision.stakeholders.length,
      });

      logger.info('Decision tracked in chain', {
        decisionId: decision.id,
        chainId: chain.id,
        title: decision.title,
        priority: decision.priority,
        stakeholderCount: decision.stakeholders.length,
      });
    } catch (error) {
      logger.error('Failed to track decision chain', {
        decisionId: decision.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Analyze decision patterns for a user
   */
  async analyzeDecisionPatterns(userId: string): Promise<DecisionPattern[]> {
    try {
      const userDecisions = Array.from(this.decisions.values()).filter(d => 
        d.decisionMaker === userId
      );

      if (userDecisions.length < 2) {
        return [];
      }

      const patterns: DecisionPattern[] = [];

      // Analyze temporal patterns
      const temporalPatterns = this.analyzeTemporalPatterns(userDecisions);
      patterns.push(...temporalPatterns);

      // Analyze option selection patterns
      const selectionPatterns = this.analyzeSelectionPatterns(userDecisions);
      patterns.push(...selectionPatterns);

      // Analyze stakeholder involvement patterns
      const stakeholderPatterns = this.analyzeStakeholderPatterns(userDecisions);
      patterns.push(...stakeholderPatterns);

      // Analyze outcome patterns
      const outcomePatterns = this.analyzeOutcomePatterns(userDecisions);
      patterns.push(...outcomePatterns);

      // Store patterns
      patterns.forEach(pattern => {
        this.patterns.set(pattern.id, pattern);
      });

      this.emit('patternsAnalyzed', {
        userId,
        decisionCount: userDecisions.length,
        patternCount: patterns.length,
        highConfidencePatterns: patterns.filter(p => p.confidence > 0.7).length,
      });

      logger.info('Decision patterns analyzed', {
        userId,
        decisionCount: userDecisions.length,
        patternCount: patterns.length,
        highConfidencePatterns: patterns.filter(p => p.confidence > 0.7).length,
      });

      return patterns;
    } catch (error) {
      logger.error('Failed to analyze decision patterns', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Predict decision outcome based on patterns
   */
  async predictDecisionOutcome(decision: Decision): Promise<PredictionResult> {
    try {
      const relatedPatterns = this.findRelatedPatterns(decision);
      const historicalDecisions = this.findSimilarDecisions(decision);

      // Calculate success probability
      const successProbability = this.calculateSuccessProbability(decision, historicalDecisions);

      // Estimate impact
      const estimatedImpact = this.estimateImpact(decision, historicalDecisions);

      // Identify risk factors
      const riskFactors = this.identifyRiskFactors(decision, relatedPatterns);

      // Generate recommendations
      const recommendedAdjustments = this.generateRecommendations(decision, relatedPatterns);

      const prediction: PredictionResult = {
        decisionId: decision.id,
        predictedOutcome: {
          successProbability,
          estimatedImpact,
          riskFactors,
          confidenceLevel: this.calculatePredictionConfidence(relatedPatterns, historicalDecisions),
        },
        recommendedAdjustments,
        basedOnPatterns: relatedPatterns.map(p => p.id),
        predictionModel: 'pattern-based-v1',
        generatedAt: new Date(),
      };

      this.predictions.set(decision.id, prediction);

      this.emit('predictionGenerated', {
        decisionId: decision.id,
        successProbability,
        riskFactorCount: riskFactors.length,
        confidenceLevel: prediction.predictedOutcome.confidenceLevel,
        recommendationCount: recommendedAdjustments.length,
      });

      logger.info('Decision outcome predicted', {
        decisionId: decision.id,
        successProbability,
        riskFactorCount: riskFactors.length,
        confidenceLevel: prediction.predictedOutcome.confidenceLevel,
      });

      return prediction;
    } catch (error) {
      logger.error('Failed to predict decision outcome', {
        decisionId: decision.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Record decision outcome for learning
   */
  async recordDecisionOutcome(outcome: DecisionOutcome): Promise<void> {
    try {
      const decision = this.decisions.get(outcome.decisionId);
      if (!decision) {
        throw new Error(`Decision not found: ${outcome.decisionId}`);
      }

      // Store outcome
      this.outcomes.set(outcome.decisionId, outcome);

      // Update decision status
      decision.status = 'implemented';
      this.decisions.set(decision.id, decision);

      // Update chain with outcome
      const chain = Array.from(this.chains.values()).find(c => 
        c.decisions.some(d => d.id === outcome.decisionId)
      );

      if (chain) {
        chain.outcomes.push(outcome);
        await this.updateChainMetadata(chain);
        this.chains.set(chain.id, chain);
      }

      // Update patterns based on outcome
      await this.updatePatternsWithOutcome(decision, outcome);

      // Validate predictions
      const prediction = this.predictions.get(outcome.decisionId);
      if (prediction) {
        await this.validatePrediction(prediction, outcome);
      }

      this.emit('outcomeRecorded', {
        decisionId: outcome.decisionId,
        success: this.determineOutcomeSuccess(outcome),
        financialImpact: outcome.actualResults.financial,
        timeImpact: outcome.actualResults.timeline,
        lessonsCount: outcome.lessonsLearned.length,
      });

      logger.info('Decision outcome recorded', {
        decisionId: outcome.decisionId,
        success: this.determineOutcomeSuccess(outcome),
        financialImpact: outcome.actualResults.financial,
        measuredBy: outcome.measuredBy,
      });
    } catch (error) {
      logger.error('Failed to record decision outcome', {
        decisionId: outcome.decisionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async findOrCreateChain(decision: Decision, context: DecisionContext): Promise<DecisionChain> {
    // Try to find existing chain
    for (const chain of this.chains.values()) {
      if (this.isDecisionPartOfChain(decision, chain, context)) {
        return chain;
      }
    }

    // Create new chain
    const chainId = `chain_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const chain: DecisionChain = {
      id: chainId,
      title: this.generateChainTitle(decision, context),
      description: this.generateChainDescription(decision, context),
      decisions: [],
      outcomes: [],
      patterns: [],
      startDate: new Date(),
      totalImpact: {
        financial: 0,
        time: 0,
        quality: 0,
        satisfaction: 0,
      },
      metadata: {
        decisionCount: 0,
        averageDecisionTime: 0,
        successRate: 0,
        riskLevel: 0,
        complexity: 0,
      },
    };

    return chain;
  }

  private isDecisionPartOfChain(decision: Decision, chain: DecisionChain, context: DecisionContext): boolean {
    // Check if decision is related to existing chain decisions
    for (const chainDecision of chain.decisions) {
      // Same project
      if (context.projectId && chainDecision.context.projectId === context.projectId) {
        return true;
      }

      // Related decisions
      if (context.relatedDecisions.includes(chainDecision.id)) {
        return true;
      }

      // Dependencies
      if (context.dependencies.some(dep => chainDecision.context.dependencies.includes(dep))) {
        return true;
      }

      // Same decision maker and similar context
      if (decision.decisionMaker === chainDecision.decisionMaker &&
          this.calculateContextSimilarity(context, chainDecision.context) > 0.6) {
        return true;
      }
    }

    return false;
  }

  private calculateContextSimilarity(context1: DecisionContext, context2: DecisionContext): number {
    let similarity = 0;
    let factors = 0;

    // Project similarity
    if (context1.projectId && context2.projectId) {
      similarity += context1.projectId === context2.projectId ? 1 : 0;
      factors++;
    }

    // Department similarity
    if (context1.departmentId && context2.departmentId) {
      similarity += context1.departmentId === context2.departmentId ? 1 : 0;
      factors++;
    }

    // Business context similarity
    const businessSimilarity = this.calculateTextSimilarity(context1.businessContext, context2.businessContext);
    similarity += businessSimilarity;
    factors++;

    // Technical context similarity
    const technicalSimilarity = this.calculateTextSimilarity(context1.technicalContext, context2.technicalContext);
    similarity += technicalSimilarity;
    factors++;

    return factors > 0 ? similarity / factors : 0;
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private generateChainTitle(decision: Decision, context: DecisionContext): string {
    if (context.projectId) {
      return `${context.projectId} Decision Chain`;
    }
    if (context.departmentId) {
      return `${context.departmentId} Decision Chain`;
    }
    return `Decision Chain - ${decision.title}`;
  }

  private generateChainDescription(decision: Decision, context: DecisionContext): string {
    return `Decision chain starting with "${decision.title}" involving ${decision.stakeholders.length} stakeholders`;
  }

  private async updateChainMetadata(chain: DecisionChain): Promise<void> {
    const decisions = chain.decisions;
    const outcomes = chain.outcomes;

    // Calculate average decision time
    const completedDecisions = decisions.filter(d => d.status === 'implemented' || d.status === 'made');
    if (completedDecisions.length > 0) {
      const totalTime = completedDecisions.reduce((sum, d) => {
        const start = d.timestamp;
        const end = d.deadline || new Date();
        return sum + (end.getTime() - start.getTime());
      }, 0);
      chain.metadata.averageDecisionTime = totalTime / completedDecisions.length;
    }

    // Calculate success rate
    if (outcomes.length > 0) {
      const successfulOutcomes = outcomes.filter(o => this.determineOutcomeSuccess(o));
      chain.metadata.successRate = successfulOutcomes.length / outcomes.length;
    }

    // Calculate risk level
    const highRiskDecisions = decisions.filter(d => d.priority === 'critical' || d.priority === 'high');
    chain.metadata.riskLevel = highRiskDecisions.length / decisions.length;

    // Calculate complexity
    const complexityScore = decisions.reduce((sum, d) => {
      let score = 0;
      score += d.stakeholders.length * 0.1;
      score += d.options.length * 0.2;
      score += d.context.dependencies.length * 0.1;
      score += d.context.constraints.length * 0.1;
      return sum + score;
    }, 0);
    chain.metadata.complexity = complexityScore / decisions.length;

    // Update total impact
    chain.totalImpact = outcomes.reduce((total, outcome) => ({
      financial: total.financial + (outcome.actualResults.financial || 0),
      time: total.time + (outcome.actualResults.timeline || 0),
      quality: total.quality + (outcome.actualResults.quality || 0),
      satisfaction: total.satisfaction + (outcome.actualResults.satisfaction || 0),
    }), { financial: 0, time: 0, quality: 0, satisfaction: 0 });
  }

  private async detectPatternsInChain(chain: DecisionChain): Promise<void> {
    const decisions = chain.decisions;
    
    if (decisions.length < 2) return;

    // Detect sequential patterns
    const sequentialPattern = this.detectSequentialPattern(decisions);
    if (sequentialPattern) {
      chain.patterns.push(sequentialPattern);
    }

    // Detect escalation patterns
    const escalationPattern = this.detectEscalationPattern(decisions);
    if (escalationPattern) {
      chain.patterns.push(escalationPattern);
    }

    // Detect conditional patterns
    const conditionalPattern = this.detectConditionalPattern(decisions);
    if (conditionalPattern) {
      chain.patterns.push(conditionalPattern);
    }
  }

  private detectSequentialPattern(decisions: Decision[]): DecisionPattern | null {
    // Check if decisions follow a sequential pattern
    const sortedDecisions = decisions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    let isSequential = true;
    for (let i = 1; i < sortedDecisions.length; i++) {
      const prev = sortedDecisions[i - 1];
      const curr = sortedDecisions[i];
      
      // Check if current decision depends on previous
      if (!curr.context.relatedDecisions.includes(prev.id) && 
          !curr.context.dependencies.some(dep => prev.context.dependencies.includes(dep))) {
        isSequential = false;
        break;
      }
    }

    if (isSequential) {
      return {
        id: `seq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'sequential',
        pattern: 'decisions made in sequence with dependencies',
        frequency: 1,
        context: 'Sequential decision making',
        effectiveness: 0.8,
        confidence: 0.9,
        examples: sortedDecisions.map(d => d.title),
        recommendations: ['Ensure clear dependency tracking', 'Plan decision sequences in advance'],
        lastObserved: new Date(),
      };
    }

    return null;
  }

  private detectEscalationPattern(decisions: Decision[]): DecisionPattern | null {
    // Check if decisions show escalation pattern (increasing priority/stakeholders)
    const sortedDecisions = decisions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    let isEscalating = true;
    const priorityOrder = ['low', 'medium', 'high', 'critical'];
    
    for (let i = 1; i < sortedDecisions.length; i++) {
      const prevPriority = priorityOrder.indexOf(sortedDecisions[i - 1].priority);
      const currPriority = priorityOrder.indexOf(sortedDecisions[i].priority);
      
      if (currPriority <= prevPriority) {
        isEscalating = false;
        break;
      }
    }

    if (isEscalating) {
      return {
        id: `esc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'escalation',
        pattern: 'decisions escalate in priority over time',
        frequency: 1,
        context: 'Escalation pattern',
        effectiveness: 0.6,
        confidence: 0.8,
        examples: sortedDecisions.map(d => `${d.title} (${d.priority})`),
        recommendations: ['Consider early intervention', 'Identify escalation triggers'],
        lastObserved: new Date(),
      };
    }

    return null;
  }

  private detectConditionalPattern(decisions: Decision[]): DecisionPattern | null {
    // Check if decisions are conditional on outcomes
    const conditionalDecisions = decisions.filter(d => 
      d.context.relatedDecisions.length > 0 || d.context.dependencies.length > 0
    );

    if (conditionalDecisions.length >= 2) {
      return {
        id: `cond_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'conditional',
        pattern: 'decisions conditional on other decisions or outcomes',
        frequency: conditionalDecisions.length,
        context: 'Conditional decision making',
        effectiveness: 0.7,
        confidence: 0.8,
        examples: conditionalDecisions.map(d => d.title),
        recommendations: ['Plan contingency decisions', 'Monitor trigger conditions'],
        lastObserved: new Date(),
      };
    }

    return null;
  }

  private analyzeTemporalPatterns(decisions: Decision[]): DecisionPattern[] {
    const patterns: DecisionPattern[] = [];
    
    // Analyze decision timing
    const sortedDecisions = decisions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const timeIntervals = [];
    
    for (let i = 1; i < sortedDecisions.length; i++) {
      const interval = sortedDecisions[i].timestamp.getTime() - sortedDecisions[i - 1].timestamp.getTime();
      timeIntervals.push(interval);
    }
    
    if (timeIntervals.length > 2) {
      const avgInterval = timeIntervals.reduce((sum, interval) => sum + interval, 0) / timeIntervals.length;
      const dayInterval = avgInterval / (1000 * 60 * 60 * 24);
      
      if (dayInterval < 7) {
        patterns.push({
          id: `temp_rapid_${Date.now()}`,
          type: 'sequential',
          pattern: 'rapid decision making (< 1 week intervals)',
          frequency: timeIntervals.length,
          context: 'Temporal analysis',
          effectiveness: 0.6,
          confidence: 0.7,
          examples: [`Average ${dayInterval.toFixed(1)} days between decisions`],
          recommendations: ['Ensure adequate consideration time', 'Consider decision fatigue'],
          lastObserved: new Date(),
        });
      }
    }
    
    return patterns;
  }

  private analyzeSelectionPatterns(decisions: Decision[]): DecisionPattern[] {
    const patterns: DecisionPattern[] = [];
    
    // Analyze option selection preferences
    const completedDecisions = decisions.filter(d => d.selectedOption);
    if (completedDecisions.length >= 3) {
      const optionPreferences = new Map<string, number>();
      
      completedDecisions.forEach(decision => {
        const selectedOption = decision.options.find(o => o.id === decision.selectedOption);
        if (selectedOption) {
          // Analyze option characteristics
          if (selectedOption.feasibility > 0.8) {
            optionPreferences.set('high-feasibility', (optionPreferences.get('high-feasibility') || 0) + 1);
          }
          if (selectedOption.alignment > 0.8) {
            optionPreferences.set('high-alignment', (optionPreferences.get('high-alignment') || 0) + 1);
          }
          if (selectedOption.estimatedImpact.risk && selectedOption.estimatedImpact.risk < 0.3) {
            optionPreferences.set('low-risk', (optionPreferences.get('low-risk') || 0) + 1);
          }
        }
      });
      
      // Find dominant preferences
      for (const [preference, count] of optionPreferences.entries()) {
        if (count / completedDecisions.length > 0.6) {
          patterns.push({
            id: `sel_${preference}_${Date.now()}`,
            type: 'sequential',
            pattern: `tendency to select ${preference} options`,
            frequency: count,
            context: 'Selection analysis',
            effectiveness: 0.8,
            confidence: count / completedDecisions.length,
            examples: [`${count}/${completedDecisions.length} decisions favor ${preference}`],
            recommendations: [`Continue emphasizing ${preference} in options`],
            lastObserved: new Date(),
          });
        }
      }
    }
    
    return patterns;
  }

  private analyzeStakeholderPatterns(decisions: Decision[]): DecisionPattern[] {
    const patterns: DecisionPattern[] = [];
    
    // Analyze stakeholder involvement
    const stakeholderCounts = decisions.map(d => d.stakeholders.length);
    const avgStakeholders = stakeholderCounts.reduce((sum, count) => sum + count, 0) / stakeholderCounts.length;
    
    if (avgStakeholders > 5) {
      patterns.push({
        id: `stake_large_${Date.now()}`,
        type: 'sequential',
        pattern: 'tendency to involve large stakeholder groups',
        frequency: decisions.length,
        context: 'Stakeholder analysis',
        effectiveness: 0.7,
        confidence: 0.8,
        examples: [`Average ${avgStakeholders.toFixed(1)} stakeholders per decision`],
        recommendations: ['Consider stakeholder fatigue', 'Identify key decision makers'],
        lastObserved: new Date(),
      });
    }
    
    return patterns;
  }

  private analyzeOutcomePatterns(decisions: Decision[]): DecisionPattern[] {
    const patterns: DecisionPattern[] = [];
    
    // This would analyze outcomes if available
    // For now, return empty array since outcomes are tracked separately
    
    return patterns;
  }

  private findRelatedPatterns(decision: Decision): DecisionPattern[] {
    return Array.from(this.patterns.values()).filter(pattern => {
      // Check if pattern is relevant to this decision
      return pattern.context.toLowerCase().includes(decision.context.businessContext.toLowerCase()) ||
             pattern.examples.some(example => decision.title.toLowerCase().includes(example.toLowerCase()));
    });
  }

  private findSimilarDecisions(decision: Decision): Decision[] {
    return Array.from(this.decisions.values()).filter(d => {
      if (d.id === decision.id) return false;
      
      // Similar decision maker
      if (d.decisionMaker === decision.decisionMaker) return true;
      
      // Similar context
      if (this.calculateContextSimilarity(d.context, decision.context) > 0.7) return true;
      
      // Similar priority and type
      if (d.priority === decision.priority && d.metadata.impactLevel === decision.metadata.impactLevel) return true;
      
      return false;
    });
  }

  private calculateSuccessProbability(decision: Decision, similarDecisions: Decision[]): number {
    if (similarDecisions.length === 0) return 0.5;
    
    const successfulDecisions = similarDecisions.filter(d => {
      const outcome = this.outcomes.get(d.id);
      return outcome && this.determineOutcomeSuccess(outcome);
    });
    
    return successfulDecisions.length / similarDecisions.length;
  }

  private estimateImpact(decision: Decision, similarDecisions: Decision[]): DecisionOutcome['actualResults'] {
    const outcomes = similarDecisions
      .map(d => this.outcomes.get(d.id))
      .filter(o => o !== undefined) as DecisionOutcome[];
    
    if (outcomes.length === 0) {
      return {
        financial: 0,
        timeline: 0,
        quality: 0,
        satisfaction: 0,
        riskMitigation: 0,
      };
    }
    
    const avgOutcome = outcomes.reduce((sum, outcome) => ({
      financial: sum.financial + (outcome.actualResults.financial || 0),
      timeline: sum.timeline + (outcome.actualResults.timeline || 0),
      quality: sum.quality + (outcome.actualResults.quality || 0),
      satisfaction: sum.satisfaction + (outcome.actualResults.satisfaction || 0),
      riskMitigation: sum.riskMitigation + (outcome.actualResults.riskMitigation || 0),
    }), { financial: 0, timeline: 0, quality: 0, satisfaction: 0, riskMitigation: 0 });
    
    const count = outcomes.length;
    return {
      financial: avgOutcome.financial / count,
      timeline: avgOutcome.timeline / count,
      quality: avgOutcome.quality / count,
      satisfaction: avgOutcome.satisfaction / count,
      riskMitigation: avgOutcome.riskMitigation / count,
    };
  }

  private identifyRiskFactors(decision: Decision, patterns: DecisionPattern[]): string[] {
    const riskFactors: string[] = [];
    
    // High stakeholder count
    if (decision.stakeholders.length > 10) {
      riskFactors.push('High stakeholder count may slow decision process');
    }
    
    // Tight deadline
    if (decision.deadline && decision.deadline.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
      riskFactors.push('Tight deadline may limit consideration time');
    }
    
    // High priority with low feasibility options
    if (decision.priority === 'critical' && decision.options.every(o => o.feasibility < 0.6)) {
      riskFactors.push('Critical priority with low feasibility options');
    }
    
    // Pattern-based risks
    const escalationPatterns = patterns.filter(p => p.type === 'escalation');
    if (escalationPatterns.length > 0) {
      riskFactors.push('History of decision escalation');
    }
    
    return riskFactors;
  }

  private generateRecommendations(decision: Decision, patterns: DecisionPattern[]): string[] {
    const recommendations: string[] = [];
    
    // Pattern-based recommendations
    patterns.forEach(pattern => {
      recommendations.push(...pattern.recommendations);
    });
    
    // Decision-specific recommendations
    if (decision.options.length > 5) {
      recommendations.push('Consider reducing options to top 3-5 for easier decision making');
    }
    
    if (decision.stakeholders.length > 8) {
      recommendations.push('Consider involving only key stakeholders in final decision');
    }
    
    if (decision.context.constraints.length > 5) {
      recommendations.push('Review constraints to identify which are flexible');
    }
    
    return Array.from(new Set(recommendations)); // Remove duplicates
  }

  private calculatePredictionConfidence(patterns: DecisionPattern[], historicalDecisions: Decision[]): number {
    let confidence = 0.5;
    
    // Higher confidence with more patterns
    confidence += Math.min(0.3, patterns.length * 0.1);
    
    // Higher confidence with more historical data
    confidence += Math.min(0.2, historicalDecisions.length * 0.02);
    
    // Higher confidence with high-quality patterns
    const highQualityPatterns = patterns.filter(p => p.confidence > 0.8);
    confidence += Math.min(0.2, highQualityPatterns.length * 0.05);
    
    return Math.min(1.0, confidence);
  }

  private determineOutcomeSuccess(outcome: DecisionOutcome): boolean {
    // Simple success determination based on multiple factors
    const factors = [];
    
    if (outcome.actualResults.financial !== undefined) {
      factors.push(outcome.actualResults.financial > 0);
    }
    
    if (outcome.actualResults.timeline !== undefined) {
      factors.push(outcome.actualResults.timeline <= 1.2); // Within 20% of timeline
    }
    
    if (outcome.actualResults.quality !== undefined) {
      factors.push(outcome.actualResults.quality >= 0.7);
    }
    
    if (outcome.actualResults.satisfaction !== undefined) {
      factors.push(outcome.actualResults.satisfaction >= 0.7);
    }
    
    if (factors.length === 0) return false;
    
    const successRate = factors.filter(f => f).length / factors.length;
    return successRate >= 0.6 && !outcome.wouldDecideDifferently;
  }

  private async updatePatternsWithOutcome(decision: Decision, outcome: DecisionOutcome): Promise<void> {
    const success = this.determineOutcomeSuccess(outcome);
    
    // Update pattern effectiveness based on outcome
    const relatedPatterns = this.findRelatedPatterns(decision);
    
    for (const pattern of relatedPatterns) {
      // Adjust effectiveness based on outcome
      const adjustment = success ? 0.1 : -0.1;
      pattern.effectiveness = Math.max(0, Math.min(1, pattern.effectiveness + adjustment));
      pattern.lastObserved = new Date();
      
      this.patterns.set(pattern.id, pattern);
    }
  }

  private async validatePrediction(prediction: PredictionResult, outcome: DecisionOutcome): Promise<void> {
    const actualSuccess = this.determineOutcomeSuccess(outcome);
    const predictedSuccess = prediction.predictedOutcome.successProbability > 0.5;
    
    const predictionAccuracy = actualSuccess === predictedSuccess ? 1 : 0;
    
    this.emit('predictionValidated', {
      predictionId: prediction.decisionId,
      accuracy: predictionAccuracy,
      predictedSuccess,
      actualSuccess,
      confidenceLevel: prediction.predictedOutcome.confidenceLevel,
    });
    
    logger.info('Prediction validated', {
      predictionId: prediction.decisionId,
      accuracy: predictionAccuracy,
      predictedSuccess,
      actualSuccess,
    });
  }

  private initializeDefaultPatterns(): void {
    // Initialize some common decision patterns
    const defaultPatterns: DecisionPattern[] = [
      {
        id: 'rapid-decisions',
        type: 'sequential',
        pattern: 'rapid successive decisions',
        frequency: 0,
        context: 'Crisis management',
        effectiveness: 0.6,
        confidence: 0.8,
        examples: ['Emergency responses', 'Crisis decisions'],
        recommendations: ['Ensure decision quality', 'Document reasoning'],
        lastObserved: new Date(),
      },
      {
        id: 'consensus-building',
        type: 'parallel',
        pattern: 'large stakeholder involvement',
        frequency: 0,
        context: 'Organizational change',
        effectiveness: 0.7,
        confidence: 0.8,
        examples: ['Change management', 'Strategic decisions'],
        recommendations: ['Manage stakeholder expectations', 'Clear communication'],
        lastObserved: new Date(),
      },
    ];
    
    defaultPatterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern);
    });
  }

  // Public interface methods

  getDecision(decisionId: string): Decision | undefined {
    return this.decisions.get(decisionId);
  }

  getDecisionChain(chainId: string): DecisionChain | undefined {
    return this.chains.get(chainId);
  }

  getDecisionOutcome(decisionId: string): DecisionOutcome | undefined {
    return this.outcomes.get(decisionId);
  }

  getPrediction(decisionId: string): PredictionResult | undefined {
    return this.predictions.get(decisionId);
  }

  getDecisionsByMaker(decisionMaker: string): Decision[] {
    return Array.from(this.decisions.values()).filter(d => d.decisionMaker === decisionMaker);
  }

  getDecisionsByStatus(status: Decision['status']): Decision[] {
    return Array.from(this.decisions.values()).filter(d => d.status === status);
  }

  getDecisionsByPriority(priority: Decision['priority']): Decision[] {
    return Array.from(this.decisions.values()).filter(d => d.priority === priority);
  }

  getAllPatterns(): DecisionPattern[] {
    return Array.from(this.patterns.values());
  }

  getAnalytics(): DecisionAnalytics {
    const allDecisions = Array.from(this.decisions.values());
    const allOutcomes = Array.from(this.outcomes.values());
    
    const decisionsByStatus = allDecisions.reduce((acc, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const decisionsByPriority = allDecisions.reduce((acc, d) => {
      acc[d.priority] = (acc[d.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const completedDecisions = allDecisions.filter(d => d.status === 'implemented');
    const averageDecisionTime = completedDecisions.length > 0 
      ? completedDecisions.reduce((sum, d) => {
          const time = d.deadline ? d.deadline.getTime() - d.timestamp.getTime() : 0;
          return sum + time;
        }, 0) / completedDecisions.length
      : 0;
    
    const successfulOutcomes = allOutcomes.filter(o => this.determineOutcomeSuccess(o));
    const successRate = allOutcomes.length > 0 ? successfulOutcomes.length / allOutcomes.length : 0;
    
    const decisionMakers = new Map<string, { count: number; successes: number }>();
    allDecisions.forEach(d => {
      const maker = decisionMakers.get(d.decisionMaker) || { count: 0, successes: 0 };
      maker.count++;
      
      const outcome = this.outcomes.get(d.id);
      if (outcome && this.determineOutcomeSuccess(outcome)) {
        maker.successes++;
      }
      
      decisionMakers.set(d.decisionMaker, maker);
    });
    
    const topDecisionMakers = Array.from(decisionMakers.entries())
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        successRate: stats.count > 0 ? stats.successes / stats.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const mostCommonPatterns = Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);
    
    const highImpactDecisions = allDecisions.filter(d => d.metadata.impactLevel === 'high').length;
    const totalFinancialImpact = allOutcomes.reduce((sum, o) => sum + (o.actualResults.financial || 0), 0);
    const timeImpactHours = allOutcomes.reduce((sum, o) => sum + (o.actualResults.timeline || 0), 0);
    const qualityImprovements = allOutcomes.filter(o => (o.actualResults.quality || 0) > 0.7).length;
    
    return {
      totalDecisions: allDecisions.length,
      decisionsByStatus,
      decisionsByPriority,
      averageDecisionTime,
      successRate,
      mostCommonPatterns,
      topDecisionMakers,
      impactAnalysis: {
        highImpactDecisions,
        totalFinancialImpact,
        timeImpactHours,
        qualityImprovements,
      },
    };
  }

  async clearData(): Promise<void> {
    this.decisions.clear();
    this.outcomes.clear();
    this.chains.clear();
    this.predictions.clear();
    // Keep patterns for future use
    
    this.emit('dataCleared');
    logger.info('Decision chain tracker data cleared');
  }
}

export default DecisionChainTracker;