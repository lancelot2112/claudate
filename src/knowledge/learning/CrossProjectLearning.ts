import { EventEmitter } from 'events';
import logger from '../../utils/logger';

export interface ProjectInsight {
  id: string;
  projectId: string;
  projectName: string;
  category: 'technical' | 'process' | 'team' | 'risk' | 'success_factor' | 'lesson_learned';
  title: string;
  description: string;
  context: {
    domain: string;
    technology: string[];
    teamSize: number;
    duration: number;
    complexity: 'low' | 'medium' | 'high';
    businessValue: 'low' | 'medium' | 'high';
  };
  insight: {
    pattern: string;
    cause: string;
    effect: string;
    recommendation: string;
    confidence: number; // 0-1
    applicability: string[]; // Which types of projects this applies to
  };
  evidence: {
    dataPoints: number;
    sources: string[];
    metrics: Record<string, number>;
    examples: string[];
  };
  impact: {
    timeImpact: number; // Days saved/lost
    costImpact: number; // Cost impact
    qualityImpact: number; // Quality improvement 0-1
    riskImpact: number; // Risk reduction 0-1
  };
  extractedAt: Date;
  validatedBy: string[];
  tags: string[];
  status: 'draft' | 'validated' | 'applied' | 'deprecated';
}

export interface ProjectLearning {
  id: string;
  sourceProjectId: string;
  targetProjectId: string;
  insightId: string;
  adaptationRequired: boolean;
  adaptations: {
    contextual: string[];
    technical: string[];
    process: string[];
  };
  applicationPlan: {
    phase: string;
    actions: string[];
    timeline: number; // Days
    resources: string[];
    risks: string[];
    successCriteria: string[];
  };
  outcome: {
    applied: boolean;
    effectiveness: number; // 0-1
    actualImpact: ProjectInsight['impact'];
    lessonsLearned: string[];
    feedback: string;
  };
  appliedAt: Date;
  reviewedAt?: Date;
  status: 'planned' | 'applying' | 'completed' | 'failed';
}

export interface OrganizationalMemory {
  domain: string;
  knowledgeBase: {
    insights: ProjectInsight[];
    patterns: ProjectPattern[];
    bestPractices: BestPractice[];
    antiPatterns: AntiPattern[];
  };
  performance: {
    successFactors: SuccessFactor[];
    riskFactors: RiskFactor[];
    performanceMetrics: PerformanceMetric[];
  };
  adaptation: {
    adaptationRules: AdaptationRule[];
    contextMapping: ContextMapping[];
    transferRules: TransferRule[];
  };
  metadata: {
    lastUpdated: Date;
    version: string;
    projectCount: number;
    insightCount: number;
    confidence: number;
  };
}

export interface ProjectPattern {
  id: string;
  name: string;
  description: string;
  type: 'success' | 'failure' | 'neutral';
  frequency: number;
  contexts: string[];
  indicators: string[];
  outcomes: string[];
  recommendations: string[];
  confidence: number;
  examples: string[];
  lastObserved: Date;
}

export interface BestPractice {
  id: string;
  title: string;
  description: string;
  domain: string;
  category: string;
  effectiveness: number;
  applicability: string[];
  implementation: {
    steps: string[];
    resources: string[];
    timeline: number;
    difficulty: 'easy' | 'medium' | 'hard';
  };
  evidence: {
    projects: string[];
    metrics: Record<string, number>;
    testimonials: string[];
  };
  updatedAt: Date;
}

export interface AntiPattern {
  id: string;
  title: string;
  description: string;
  domain: string;
  category: string;
  harmfulness: number;
  indicators: string[];
  consequences: string[];
  prevention: {
    steps: string[];
    earlyWarnings: string[];
    monitoring: string[];
  };
  recovery: {
    steps: string[];
    resources: string[];
    timeline: number;
  };
  evidence: {
    projects: string[];
    impact: Record<string, number>;
    frequency: number;
  };
  updatedAt: Date;
}

export interface SuccessFactor {
  id: string;
  factor: string;
  description: string;
  impact: number;
  frequency: number;
  contexts: string[];
  metrics: Record<string, number>;
  examples: string[];
  confidence: number;
}

export interface RiskFactor {
  id: string;
  factor: string;
  description: string;
  severity: number;
  probability: number;
  contexts: string[];
  mitigation: string[];
  earlyWarnings: string[];
  examples: string[];
  confidence: number;
}

export interface PerformanceMetric {
  id: string;
  metric: string;
  description: string;
  unit: string;
  benchmarks: {
    poor: number;
    average: number;
    good: number;
    excellent: number;
  };
  contexts: string[];
  correlations: string[];
  updatedAt: Date;
}

export interface AdaptationRule {
  id: string;
  name: string;
  description: string;
  sourceContext: string;
  targetContext: string;
  adaptations: {
    technical: string[];
    process: string[];
    team: string[];
  };
  confidence: number;
  examples: string[];
  updatedAt: Date;
}

export interface ContextMapping {
  id: string;
  sourceContext: Record<string, any>;
  targetContext: Record<string, any>;
  similarity: number;
  mappingRules: string[];
  exceptions: string[];
  confidence: number;
  lastUsed: Date;
}

export interface TransferRule {
  id: string;
  name: string;
  description: string;
  conditions: string[];
  actions: string[];
  effectiveness: number;
  usageCount: number;
  lastUsed: Date;
}

export interface ProjectContext {
  projectId: string;
  domain: string;
  technology: string[];
  teamSize: number;
  duration: number;
  complexity: 'low' | 'medium' | 'high';
  businessValue: 'low' | 'medium' | 'high';
  stakeholders: string[];
  constraints: string[];
  objectives: string[];
  timeline: {
    start: Date;
    end: Date;
    milestones: Array<{ name: string; date: Date }>;
  };
  resources: {
    budget: number;
    team: string[];
    tools: string[];
    infrastructure: string[];
  };
}

export class CrossProjectLearning extends EventEmitter {
  private projectInsights: Map<string, ProjectInsight[]> = new Map();
  private projectLearnings: Map<string, ProjectLearning[]> = new Map();
  private organizationalMemory: Map<string, OrganizationalMemory> = new Map();
  private projectContexts: Map<string, ProjectContext> = new Map();
  
  private readonly SIMILARITY_THRESHOLD = 0.7;
  private readonly _CONFIDENCE_THRESHOLD = 0.6;
  private readonly _MAX_INSIGHTS_PER_PROJECT = 50;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    logger.info('Cross-project learning system initialized');
  }

  /**
   * Extract insights from completed project
   */
  async extractProjectInsights(projectId: string): Promise<ProjectInsight[]> {
    try {
      logger.info('Extracting project insights', { projectId });

      const projectContext = this.projectContexts.get(projectId);
      if (!projectContext) {
        throw new Error(`Project context not found: ${projectId}`);
      }

      // Extract different types of insights
      const technicalInsights = await this.extractTechnicalInsights(projectId, projectContext);
      const processInsights = await this.extractProcessInsights(projectId, projectContext);
      const teamInsights = await this.extractTeamInsights(projectId, projectContext);
      const riskInsights = await this.extractRiskInsights(projectId, projectContext);
      const successFactorInsights = await this.extractSuccessFactorInsights(projectId, projectContext);
      const lessonsLearned = await this.extractLessonsLearned(projectId, projectContext);

      const allInsights = [
        ...technicalInsights,
        ...processInsights,
        ...teamInsights,
        ...riskInsights,
        ...successFactorInsights,
        ...lessonsLearned,
      ];

      // Store insights
      this.projectInsights.set(projectId, allInsights);

      // Update organizational memory
      await this.updateOrganizationalMemory(projectContext.domain, allInsights);

      this.emit('insightsExtracted', {
        projectId,
        insightCount: allInsights.length,
        categories: this.categorizeInsights(allInsights),
        highConfidenceInsights: allInsights.filter(i => i.insight.confidence > 0.8).length,
      });

      logger.info('Project insights extracted successfully', {
        projectId,
        insightCount: allInsights.length,
        categories: this.categorizeInsights(allInsights),
      });

      return allInsights;
    } catch (error) {
      logger.error('Failed to extract project insights', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Apply learnings to a new project
   */
  async applyLearningsToNewProject(
    insights: ProjectInsight[],
    targetProjectId: string
  ): Promise<ProjectLearning[]> {
    try {
      logger.info('Applying learnings to new project', {
        targetProjectId,
        insightCount: insights.length,
      });

      const targetContext = this.projectContexts.get(targetProjectId);
      if (!targetContext) {
        throw new Error(`Target project context not found: ${targetProjectId}`);
      }

      const learnings: ProjectLearning[] = [];

      for (const insight of insights) {
        // Check if insight is applicable
        const applicability = await this.assessApplicability(insight, targetContext);
        
        if (applicability.score >= this.SIMILARITY_THRESHOLD) {
          const learning = await this.createProjectLearning(insight, targetProjectId, applicability);
          learnings.push(learning);
        }
      }

      // Prioritize learnings
      const prioritizedLearnings = this.prioritizeLearnings(learnings);

      // Store learnings
      this.projectLearnings.set(targetProjectId, prioritizedLearnings);

      this.emit('learningsApplied', {
        targetProjectId,
        totalInsights: insights.length,
        applicableLearnings: prioritizedLearnings.length,
        highImpactLearnings: prioritizedLearnings.filter(l => 
          l.insightId && this.getInsightById(l.insightId)?.impact.timeImpact > 5
        ).length,
      });

      logger.info('Learnings applied to new project', {
        targetProjectId,
        totalInsights: insights.length,
        applicableLearnings: prioritizedLearnings.length,
      });

      return prioritizedLearnings;
    } catch (error) {
      logger.error('Failed to apply learnings to new project', {
        targetProjectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Build organizational memory from project learnings
   */
  async buildOrganizationalMemory(learnings: ProjectLearning[]): Promise<void> {
    try {
      logger.info('Building organizational memory', {
        learningCount: learnings.length,
      });

      // Group learnings by domain
      const domainLearnings = this.groupLearningsByDomain(learnings);

      for (const [domain, domainSpecificLearnings] of domainLearnings.entries()) {
        const memory = await this.buildDomainMemory(domain, domainSpecificLearnings);
        this.organizationalMemory.set(domain, memory);
      }

      // Extract cross-domain patterns
      await this.extractCrossDomainPatterns(learnings);

      this.emit('organizationalMemoryBuilt', {
        domainCount: domainLearnings.size,
        totalLearnings: learnings.length,
        memorySize: this.calculateMemorySize(),
      });

      logger.info('Organizational memory built successfully', {
        domainCount: domainLearnings.size,
        totalLearnings: learnings.length,
      });
    } catch (error) {
      logger.error('Failed to build organizational memory', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async extractTechnicalInsights(
    projectId: string,
    context: ProjectContext
  ): Promise<ProjectInsight[]> {
    // This would analyze technical artifacts, code quality, architecture decisions
    // For now, simulate technical insights
    return [
      {
        id: `tech_${projectId}_1`,
        projectId,
        projectName: `Project ${projectId}`,
        category: 'technical',
        title: 'Microservices Architecture Effectiveness',
        description: 'Analysis of microservices architecture impact on development velocity',
        context: {
          domain: context.domain,
          technology: context.technology,
          teamSize: context.teamSize,
          duration: context.duration,
          complexity: context.complexity,
          businessValue: context.businessValue,
        },
        insight: {
          pattern: 'Microservices increase initial complexity but improve long-term maintainability',
          cause: 'Distributed architecture requires more upfront planning',
          effect: 'Faster feature delivery after initial setup phase',
          recommendation: 'Use microservices for complex domains with multiple teams',
          confidence: 0.85,
          applicability: ['large-scale', 'multi-team', 'complex-domain'],
        },
        evidence: {
          dataPoints: 25,
          sources: ['code_metrics', 'deployment_data', 'team_feedback'],
          metrics: {
            deployment_frequency: 2.5,
            lead_time: 3.2,
            mttr: 1.8,
            change_failure_rate: 0.05,
          },
          examples: ['Service A deployment independence', 'Team B autonomous development'],
        },
        impact: {
          timeImpact: 10,
          costImpact: -5000,
          qualityImpact: 0.15,
          riskImpact: 0.2,
        },
        extractedAt: new Date(),
        validatedBy: ['tech_lead', 'architect'],
        tags: ['microservices', 'architecture', 'scalability'],
        status: 'validated',
      },
    ];
  }

  private async extractProcessInsights(
    projectId: string,
    context: ProjectContext
  ): Promise<ProjectInsight[]> {
    // This would analyze process effectiveness, agile practices, etc.
    return [
      {
        id: `proc_${projectId}_1`,
        projectId,
        projectName: `Project ${projectId}`,
        category: 'process',
        title: 'Sprint Duration Optimization',
        description: 'Impact of sprint duration on team productivity and delivery quality',
        context: {
          domain: context.domain,
          technology: context.technology,
          teamSize: context.teamSize,
          duration: context.duration,
          complexity: context.complexity,
          businessValue: context.businessValue,
        },
        insight: {
          pattern: 'Two-week sprints optimal for teams under 8 people',
          cause: 'Shorter sprints provide better feedback loops',
          effect: 'Improved velocity and quality metrics',
          recommendation: 'Use 2-week sprints for small to medium teams',
          confidence: 0.75,
          applicability: ['agile', 'small-team', 'iterative'],
        },
        evidence: {
          dataPoints: 20,
          sources: ['velocity_data', 'quality_metrics', 'team_surveys'],
          metrics: {
            velocity: 35,
            quality_score: 0.88,
            team_satisfaction: 0.82,
          },
          examples: ['Sprint 5-8 velocity increase', 'Quality improvement in sprint 6'],
        },
        impact: {
          timeImpact: 5,
          costImpact: 2000,
          qualityImpact: 0.12,
          riskImpact: 0.1,
        },
        extractedAt: new Date(),
        validatedBy: ['scrum_master', 'team_lead'],
        tags: ['agile', 'sprint', 'productivity'],
        status: 'validated',
      },
    ];
  }

  private async extractTeamInsights(
    projectId: string,
    context: ProjectContext
  ): Promise<ProjectInsight[]> {
    // This would analyze team dynamics, communication patterns, etc.
    return [
      {
        id: `team_${projectId}_1`,
        projectId,
        projectName: `Project ${projectId}`,
        category: 'team',
        title: 'Cross-functional Team Effectiveness',
        description: 'Impact of cross-functional teams on project success',
        context: {
          domain: context.domain,
          technology: context.technology,
          teamSize: context.teamSize,
          duration: context.duration,
          complexity: context.complexity,
          businessValue: context.businessValue,
        },
        insight: {
          pattern: 'Cross-functional teams deliver faster with fewer handoffs',
          cause: 'Reduced dependencies and communication overhead',
          effect: 'Faster delivery and better quality',
          recommendation: 'Form cross-functional teams for complex projects',
          confidence: 0.8,
          applicability: ['complex-projects', 'multi-discipline', 'autonomous-teams'],
        },
        evidence: {
          dataPoints: 15,
          sources: ['delivery_metrics', 'communication_analysis', 'team_feedback'],
          metrics: {
            delivery_speed: 1.3,
            handoff_time: 0.5,
            team_satisfaction: 0.85,
          },
          examples: ['Reduced waiting time for approvals', 'Faster problem resolution'],
        },
        impact: {
          timeImpact: 8,
          costImpact: 3000,
          qualityImpact: 0.1,
          riskImpact: 0.15,
        },
        extractedAt: new Date(),
        validatedBy: ['team_lead', 'project_manager'],
        tags: ['team-structure', 'cross-functional', 'collaboration'],
        status: 'validated',
      },
    ];
  }

  private async extractRiskInsights(
    projectId: string,
    context: ProjectContext
  ): Promise<ProjectInsight[]> {
    // This would analyze risk patterns, mitigation effectiveness, etc.
    return [
      {
        id: `risk_${projectId}_1`,
        projectId,
        projectName: `Project ${projectId}`,
        category: 'risk',
        title: 'Technical Debt Accumulation Risk',
        description: 'Pattern of technical debt accumulation and its impact on delivery',
        context: {
          domain: context.domain,
          technology: context.technology,
          teamSize: context.teamSize,
          duration: context.duration,
          complexity: context.complexity,
          businessValue: context.businessValue,
        },
        insight: {
          pattern: 'Technical debt increases exponentially without regular refactoring',
          cause: 'Pressure to deliver features quickly',
          effect: 'Slower delivery and higher maintenance costs',
          recommendation: 'Allocate 20% of capacity to technical debt reduction',
          confidence: 0.9,
          applicability: ['fast-paced', 'feature-heavy', 'long-term'],
        },
        evidence: {
          dataPoints: 30,
          sources: ['code_analysis', 'velocity_tracking', 'maintenance_costs'],
          metrics: {
            debt_ratio: 0.25,
            velocity_decline: 0.15,
            maintenance_cost: 15000,
          },
          examples: ['Velocity drop in months 4-6', 'Increased bug reports'],
        },
        impact: {
          timeImpact: -15,
          costImpact: -8000,
          qualityImpact: -0.2,
          riskImpact: -0.3,
        },
        extractedAt: new Date(),
        validatedBy: ['tech_lead', 'architect'],
        tags: ['technical-debt', 'risk', 'maintenance'],
        status: 'validated',
      },
    ];
  }

  private async extractSuccessFactorInsights(
    projectId: string,
    context: ProjectContext
  ): Promise<ProjectInsight[]> {
    // This would analyze what contributed to project success
    return [
      {
        id: `success_${projectId}_1`,
        projectId,
        projectName: `Project ${projectId}`,
        category: 'success_factor',
        title: 'Stakeholder Engagement Impact',
        description: 'Impact of regular stakeholder engagement on project success',
        context: {
          domain: context.domain,
          technology: context.technology,
          teamSize: context.teamSize,
          duration: context.duration,
          complexity: context.complexity,
          businessValue: context.businessValue,
        },
        insight: {
          pattern: 'Regular stakeholder demos increase project success rate',
          cause: 'Early feedback and course correction',
          effect: 'Higher stakeholder satisfaction and fewer late changes',
          recommendation: 'Conduct bi-weekly stakeholder demos',
          confidence: 0.85,
          applicability: ['stakeholder-heavy', 'user-facing', 'business-critical'],
        },
        evidence: {
          dataPoints: 18,
          sources: ['stakeholder_feedback', 'change_requests', 'success_metrics'],
          metrics: {
            stakeholder_satisfaction: 0.9,
            change_requests: 0.3,
            success_rate: 0.95,
          },
          examples: ['Early requirement clarification', 'Reduced scope creep'],
        },
        impact: {
          timeImpact: 12,
          costImpact: 5000,
          qualityImpact: 0.18,
          riskImpact: 0.25,
        },
        extractedAt: new Date(),
        validatedBy: ['project_manager', 'stakeholder'],
        tags: ['stakeholder-engagement', 'success-factor', 'communication'],
        status: 'validated',
      },
    ];
  }

  private async extractLessonsLearned(
    projectId: string,
    context: ProjectContext
  ): Promise<ProjectInsight[]> {
    // This would capture explicit lessons learned from retrospectives
    return [
      {
        id: `lesson_${projectId}_1`,
        projectId,
        projectName: `Project ${projectId}`,
        category: 'lesson_learned',
        title: 'Early Testing Investment',
        description: 'Lesson learned about the importance of early testing investment',
        context: {
          domain: context.domain,
          technology: context.technology,
          teamSize: context.teamSize,
          duration: context.duration,
          complexity: context.complexity,
          businessValue: context.businessValue,
        },
        insight: {
          pattern: 'Early testing investment prevents costly late-stage bugs',
          cause: 'Test automation and early QA involvement',
          effect: 'Reduced bug fixing costs and faster delivery',
          recommendation: 'Invest in test automation from project start',
          confidence: 0.9,
          applicability: ['quality-critical', 'complex-logic', 'long-term'],
        },
        evidence: {
          dataPoints: 25,
          sources: ['bug_reports', 'testing_metrics', 'cost_analysis'],
          metrics: {
            bug_reduction: 0.4,
            testing_cost: 8000,
            fixing_cost_saved: 20000,
          },
          examples: ['50% fewer production bugs', 'Faster release cycles'],
        },
        impact: {
          timeImpact: 10,
          costImpact: 12000,
          qualityImpact: 0.3,
          riskImpact: 0.4,
        },
        extractedAt: new Date(),
        validatedBy: ['qa_lead', 'developer'],
        tags: ['testing', 'quality', 'lesson-learned'],
        status: 'validated',
      },
    ];
  }

  private categorizeInsights(insights: ProjectInsight[]): Record<string, number> {
    return insights.reduce((acc, insight) => {
      acc[insight.category] = (acc[insight.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private async updateOrganizationalMemory(
    domain: string,
    insights: ProjectInsight[]
  ): Promise<void> {
    const existingMemory = this.organizationalMemory.get(domain);
    
    if (existingMemory) {
      // Update existing memory
      existingMemory.knowledgeBase.insights.push(...insights);
      existingMemory.metadata.lastUpdated = new Date();
      existingMemory.metadata.insightCount = existingMemory.knowledgeBase.insights.length;
    } else {
      // Create new memory
      const newMemory: OrganizationalMemory = {
        domain,
        knowledgeBase: {
          insights,
          patterns: [],
          bestPractices: [],
          antiPatterns: [],
        },
        performance: {
          successFactors: [],
          riskFactors: [],
          performanceMetrics: [],
        },
        adaptation: {
          adaptationRules: [],
          contextMapping: [],
          transferRules: [],
        },
        metadata: {
          lastUpdated: new Date(),
          version: '1.0',
          projectCount: 1,
          insightCount: insights.length,
          confidence: 0.7,
        },
      };
      
      this.organizationalMemory.set(domain, newMemory);
    }
  }

  private async assessApplicability(
    insight: ProjectInsight,
    targetContext: ProjectContext
  ): Promise<{ score: number; reasoning: string[]; adaptations: string[] }> {
    const reasoning: string[] = [];
    const adaptations: string[] = [];
    let score = 0;

    // Domain similarity
    if (insight.context.domain === targetContext.domain) {
      score += 0.3;
      reasoning.push('Same domain');
    } else {
      score += 0.1;
      reasoning.push('Different domain');
      adaptations.push('Adapt domain-specific terminology');
    }

    // Technology similarity
    const techOverlap = insight.context.technology.filter(tech => 
      targetContext.technology.includes(tech)
    ).length;
    const techSimilarity = techOverlap / Math.max(insight.context.technology.length, targetContext.technology.length);
    score += techSimilarity * 0.25;
    reasoning.push(`Technology overlap: ${(techSimilarity * 100).toFixed(1)}%`);

    // Team size similarity
    const teamSizeDiff = Math.abs(insight.context.teamSize - targetContext.teamSize);
    const teamSimilarity = Math.max(0, 1 - teamSizeDiff / 10);
    score += teamSimilarity * 0.15;
    reasoning.push(`Team size similarity: ${(teamSimilarity * 100).toFixed(1)}%`);

    // Complexity similarity
    const complexityMap = { low: 1, medium: 2, high: 3 };
    const complexityDiff = Math.abs(
      complexityMap[insight.context.complexity] - complexityMap[targetContext.complexity]
    );
    const complexitySimilarity = Math.max(0, 1 - complexityDiff / 2);
    score += complexitySimilarity * 0.2;
    reasoning.push(`Complexity similarity: ${(complexitySimilarity * 100).toFixed(1)}%`);

    // Business value similarity
    const valueMap = { low: 1, medium: 2, high: 3 };
    const valueDiff = Math.abs(
      valueMap[insight.context.businessValue] - valueMap[targetContext.businessValue]
    );
    const valueSimilarity = Math.max(0, 1 - valueDiff / 2);
    score += valueSimilarity * 0.1;
    reasoning.push(`Business value similarity: ${(valueSimilarity * 100).toFixed(1)}%`);

    // Check applicability tags
    const applicabilityScore = this.checkApplicabilityTags(insight, targetContext);
    score = Math.min(1, score + applicabilityScore);

    return { score, reasoning, adaptations };
  }

  private checkApplicabilityTags(insight: ProjectInsight, targetContext: ProjectContext): number {
    // This would check if the insight's applicability tags match the target context
    // For now, simplified implementation
    return 0.1; // Small bonus for having applicability tags
  }

  private async createProjectLearning(
    insight: ProjectInsight,
    targetProjectId: string,
    applicability: { score: number; reasoning: string[]; adaptations: string[] }
  ): Promise<ProjectLearning> {
    return {
      id: `learning_${targetProjectId}_${Date.now()}`,
      sourceProjectId: insight.projectId,
      targetProjectId,
      insightId: insight.id,
      adaptationRequired: applicability.adaptations.length > 0,
      adaptations: {
        contextual: applicability.adaptations.filter(a => a.includes('domain')),
        technical: applicability.adaptations.filter(a => a.includes('technology')),
        process: applicability.adaptations.filter(a => a.includes('process')),
      },
      applicationPlan: {
        phase: this.determineApplicationPhase(insight),
        actions: this.generateApplicationActions(insight),
        timeline: this.estimateTimeline(insight),
        resources: this.identifyRequiredResources(insight),
        risks: this.identifyApplicationRisks(insight),
        successCriteria: this.defineSuccessCriteria(insight),
      },
      outcome: {
        applied: false,
        effectiveness: 0,
        actualImpact: {
          timeImpact: 0,
          costImpact: 0,
          qualityImpact: 0,
          riskImpact: 0,
        },
        lessonsLearned: [],
        feedback: '',
      },
      appliedAt: new Date(),
      status: 'planned',
    };
  }

  private determineApplicationPhase(insight: ProjectInsight): string {
    switch (insight.category) {
      case 'technical':
        return 'development';
      case 'process':
        return 'planning';
      case 'team':
        return 'team-formation';
      case 'risk':
        return 'risk-assessment';
      case 'success_factor':
        return 'ongoing';
      default:
        return 'planning';
    }
  }

  private generateApplicationActions(insight: ProjectInsight): string[] {
    const actions = [];
    
    // Add generic actions based on insight type
    actions.push(`Review and adapt: ${insight.title}`);
    actions.push(`Implement: ${insight.insight.recommendation}`);
    actions.push(`Monitor: ${insight.insight.pattern}`);
    
    // Add specific actions based on category
    switch (insight.category) {
      case 'technical':
        actions.push('Conduct technical review');
        actions.push('Update architecture documentation');
        break;
      case 'process':
        actions.push('Update process documentation');
        actions.push('Train team on new process');
        break;
      case 'team':
        actions.push('Discuss with team leads');
        actions.push('Plan team structure changes');
        break;
    }
    
    return actions;
  }

  private estimateTimeline(insight: ProjectInsight): number {
    // Estimate timeline based on insight complexity and impact
    const baseTimeline = 5; // days
    const complexityMultiplier = insight.context.complexity === 'high' ? 2 : 1;
    const impactMultiplier = Math.abs(insight.impact.timeImpact) > 10 ? 1.5 : 1;
    
    return Math.ceil(baseTimeline * complexityMultiplier * impactMultiplier);
  }

  private identifyRequiredResources(insight: ProjectInsight): string[] {
    const resources = [];
    
    switch (insight.category) {
      case 'technical':
        resources.push('Technical lead time', 'Development resources');
        break;
      case 'process':
        resources.push('Process documentation', 'Training materials');
        break;
      case 'team':
        resources.push('Team lead time', 'HR support');
        break;
      case 'risk':
        resources.push('Risk assessment tools', 'Mitigation resources');
        break;
    }
    
    return resources;
  }

  private identifyApplicationRisks(insight: ProjectInsight): string[] {
    return [
      'Context mismatch',
      'Team resistance',
      'Implementation complexity',
      'Resource constraints',
    ];
  }

  private defineSuccessCriteria(insight: ProjectInsight): string[] {
    const criteria = [];
    
    if (insight.impact.timeImpact > 0) {
      criteria.push(`Achieve ${insight.impact.timeImpact} days time savings`);
    }
    
    if (insight.impact.qualityImpact > 0) {
      criteria.push(`Improve quality by ${(insight.impact.qualityImpact * 100).toFixed(1)}%`);
    }
    
    if (insight.impact.riskImpact > 0) {
      criteria.push(`Reduce risk by ${(insight.impact.riskImpact * 100).toFixed(1)}%`);
    }
    
    criteria.push('Team acceptance and adoption');
    criteria.push('Measurable improvement in target metrics');
    
    return criteria;
  }

  private prioritizeLearnings(learnings: ProjectLearning[]): ProjectLearning[] {
    return learnings.sort((a, b) => {
      const aInsight = this.getInsightById(a.insightId);
      const bInsight = this.getInsightById(b.insightId);
      
      if (!aInsight || !bInsight) return 0;
      
      // Priority factors
      const aScore = this.calculateLearningPriority(aInsight, a);
      const bScore = this.calculateLearningPriority(bInsight, b);
      
      return bScore - aScore;
    });
  }

  private calculateLearningPriority(insight: ProjectInsight, learning: ProjectLearning): number {
    let score = 0;
    
    // Impact weighting
    score += Math.abs(insight.impact.timeImpact) * 0.3;
    score += Math.abs(insight.impact.costImpact) / 1000 * 0.2;
    score += insight.impact.qualityImpact * 100 * 0.2;
    score += insight.impact.riskImpact * 100 * 0.3;
    
    // Confidence weighting
    score *= insight.insight.confidence;
    
    // Adaptation penalty
    if (learning.adaptationRequired) {
      score *= 0.8;
    }
    
    return score;
  }

  private getInsightById(insightId: string): ProjectInsight | undefined {
    for (const insights of this.projectInsights.values()) {
      const insight = insights.find(i => i.id === insightId);
      if (insight) return insight;
    }
    return undefined;
  }

  private groupLearningsByDomain(learnings: ProjectLearning[]): Map<string, ProjectLearning[]> {
    const domainMap = new Map<string, ProjectLearning[]>();
    
    for (const learning of learnings) {
      const insight = this.getInsightById(learning.insightId);
      if (insight) {
        const domain = insight.context.domain;
        const domainLearnings = domainMap.get(domain) || [];
        domainLearnings.push(learning);
        domainMap.set(domain, domainLearnings);
      }
    }
    
    return domainMap;
  }

  private async buildDomainMemory(
    domain: string,
    learnings: ProjectLearning[]
  ): Promise<OrganizationalMemory> {
    const insights = learnings
      .map(l => this.getInsightById(l.insightId))
      .filter(i => i !== undefined) as ProjectInsight[];
    
    const patterns = await this.extractPatterns(insights);
    const bestPractices = await this.extractBestPractices(insights);
    const antiPatterns = await this.extractAntiPatterns(insights);
    
    return {
      domain,
      knowledgeBase: {
        insights,
        patterns,
        bestPractices,
        antiPatterns,
      },
      performance: {
        successFactors: await this.extractSuccessFactors(insights),
        riskFactors: await this.extractRiskFactors(insights),
        performanceMetrics: await this.extractPerformanceMetrics(insights),
      },
      adaptation: {
        adaptationRules: await this.extractAdaptationRules(learnings),
        contextMapping: await this.extractContextMappings(learnings),
        transferRules: await this.extractTransferRules(learnings),
      },
      metadata: {
        lastUpdated: new Date(),
        version: '1.0',
        projectCount: new Set(insights.map(i => i.projectId)).size,
        insightCount: insights.length,
        confidence: this.calculateDomainConfidence(insights),
      },
    };
  }

  private async extractPatterns(insights: ProjectInsight[]): Promise<ProjectPattern[]> {
    // Extract common patterns from insights
    const patternMap = new Map<string, ProjectPattern>();
    
    for (const insight of insights) {
      const patternKey = insight.insight.pattern;
      
      if (patternMap.has(patternKey)) {
        const pattern = patternMap.get(patternKey)!;
        pattern.frequency++;
        pattern.examples.push(insight.title);
        pattern.lastObserved = new Date();
      } else {
        patternMap.set(patternKey, {
          id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name: patternKey,
          description: insight.description,
          type: insight.impact.timeImpact > 0 ? 'success' : 'failure',
          frequency: 1,
          contexts: [insight.context.domain],
          indicators: [insight.insight.cause],
          outcomes: [insight.insight.effect],
          recommendations: [insight.insight.recommendation],
          confidence: insight.insight.confidence,
          examples: [insight.title],
          lastObserved: new Date(),
        });
      }
    }
    
    return Array.from(patternMap.values());
  }

  private async extractBestPractices(insights: ProjectInsight[]): Promise<BestPractice[]> {
    // Extract best practices from successful insights
    return insights
      .filter(i => i.impact.timeImpact > 0 && i.insight.confidence > 0.7)
      .map(insight => ({
        id: `bp_${insight.id}`,
        title: insight.title,
        description: insight.description,
        domain: insight.context.domain,
        category: insight.category,
        effectiveness: insight.insight.confidence,
        applicability: insight.insight.applicability,
        implementation: {
          steps: [insight.insight.recommendation],
          resources: ['Project team', 'Management support'],
          timeline: Math.abs(insight.impact.timeImpact),
          difficulty: 'medium',
        },
        evidence: {
          projects: [insight.projectId],
          metrics: insight.evidence.metrics,
          testimonials: insight.evidence.examples,
        },
        updatedAt: new Date(),
      }));
  }

  private async extractAntiPatterns(insights: ProjectInsight[]): Promise<AntiPattern[]> {
    // Extract anti-patterns from negative insights
    return insights
      .filter(i => i.impact.timeImpact < 0 && i.insight.confidence > 0.7)
      .map(insight => ({
        id: `ap_${insight.id}`,
        title: insight.title,
        description: insight.description,
        domain: insight.context.domain,
        category: insight.category,
        harmfulness: Math.abs(insight.impact.timeImpact) / 30, // Normalize
        indicators: [insight.insight.cause],
        consequences: [insight.insight.effect],
        prevention: {
          steps: [insight.insight.recommendation],
          earlyWarnings: [insight.insight.cause],
          monitoring: ['Regular reviews', 'Metric tracking'],
        },
        recovery: {
          steps: [insight.insight.recommendation],
          resources: ['Additional resources', 'Expert consultation'],
          timeline: Math.abs(insight.impact.timeImpact),
        },
        evidence: {
          projects: [insight.projectId],
          impact: {
            timeImpact: insight.impact.timeImpact,
            costImpact: insight.impact.costImpact,
          },
          frequency: 1,
        },
        updatedAt: new Date(),
      }));
  }

  private async extractSuccessFactors(insights: ProjectInsight[]): Promise<SuccessFactor[]> {
    // Extract success factors from insights
    return insights
      .filter(i => i.category === 'success_factor')
      .map(insight => ({
        id: `sf_${insight.id}`,
        factor: insight.title,
        description: insight.description,
        impact: insight.impact.timeImpact,
        frequency: 1,
        contexts: [insight.context.domain],
        metrics: insight.evidence.metrics,
        examples: insight.evidence.examples,
        confidence: insight.insight.confidence,
      }));
  }

  private async extractRiskFactors(insights: ProjectInsight[]): Promise<RiskFactor[]> {
    // Extract risk factors from insights
    return insights
      .filter(i => i.category === 'risk')
      .map(insight => ({
        id: `rf_${insight.id}`,
        factor: insight.title,
        description: insight.description,
        severity: Math.abs(insight.impact.timeImpact) / 30,
        probability: insight.insight.confidence,
        contexts: [insight.context.domain],
        mitigation: [insight.insight.recommendation],
        earlyWarnings: [insight.insight.cause],
        examples: insight.evidence.examples,
        confidence: insight.insight.confidence,
      }));
  }

  private async extractPerformanceMetrics(insights: ProjectInsight[]): Promise<PerformanceMetric[]> {
    // Extract performance metrics from insights
    const metrics = new Set<string>();
    
    insights.forEach(insight => {
      Object.keys(insight.evidence.metrics).forEach(metric => {
        metrics.add(metric);
      });
    });
    
    return Array.from(metrics).map(metric => ({
      id: `pm_${metric}`,
      metric,
      description: `Performance metric: ${metric}`,
      unit: 'units',
      benchmarks: {
        poor: 0.25,
        average: 0.5,
        good: 0.75,
        excellent: 1.0,
      },
      contexts: Array.from(new Set(insights.map(i => i.context.domain))),
      correlations: [],
      updatedAt: new Date(),
    }));
  }

  private async extractAdaptationRules(learnings: ProjectLearning[]): Promise<AdaptationRule[]> {
    // Extract adaptation rules from learnings
    return learnings
      .filter(l => l.adaptationRequired)
      .map(learning => ({
        id: `ar_${learning.id}`,
        name: `Adaptation for ${learning.insightId}`,
        description: 'Adaptation rule for cross-project learning',
        sourceContext: learning.sourceProjectId,
        targetContext: learning.targetProjectId,
        adaptations: {
          ...learning.adaptations,
          team: learning.adaptations.team || [],
        },
        confidence: 0.7,
        examples: [learning.id],
        updatedAt: new Date(),
      }));
  }

  private async extractContextMappings(learnings: ProjectLearning[]): Promise<ContextMapping[]> {
    // Extract context mappings from learnings
    return learnings.map(learning => ({
      id: `cm_${learning.id}`,
      sourceContext: { projectId: learning.sourceProjectId },
      targetContext: { projectId: learning.targetProjectId },
      similarity: 0.8, // Would be calculated based on actual context
      mappingRules: ['Direct mapping', 'Adaptation required'],
      exceptions: learning.adaptations.contextual,
      confidence: 0.7,
      lastUsed: new Date(),
    }));
  }

  private async extractTransferRules(learnings: ProjectLearning[]): Promise<TransferRule[]> {
    // Extract transfer rules from learnings
    return learnings.map(learning => ({
      id: `tr_${learning.id}`,
      name: `Transfer rule for ${learning.insightId}`,
      description: 'Rule for transferring insights across projects',
      conditions: learning.applicationPlan.actions,
      actions: learning.applicationPlan.successCriteria,
      effectiveness: 0.8,
      usageCount: 1,
      lastUsed: new Date(),
    }));
  }

  private calculateDomainConfidence(insights: ProjectInsight[]): number {
    if (insights.length === 0) return 0;
    
    const totalConfidence = insights.reduce((sum, insight) => sum + insight.insight.confidence, 0);
    return totalConfidence / insights.length;
  }

  private async extractCrossDomainPatterns(learnings: ProjectLearning[]): Promise<void> {
    // Extract patterns that apply across domains
    // This would identify universal patterns
    logger.info('Extracting cross-domain patterns', { learningCount: learnings.length });
  }

  private calculateMemorySize(): number {
    let totalSize = 0;
    for (const memory of this.organizationalMemory.values()) {
      totalSize += memory.knowledgeBase.insights.length;
      totalSize += memory.knowledgeBase.patterns.length;
      totalSize += memory.knowledgeBase.bestPractices.length;
      totalSize += memory.knowledgeBase.antiPatterns.length;
    }
    return totalSize;
  }

  // Public interface methods

  setProjectContext(projectId: string, context: ProjectContext): void {
    this.projectContexts.set(projectId, context);
  }

  getProjectContext(projectId: string): ProjectContext | undefined {
    return this.projectContexts.get(projectId);
  }

  getProjectInsights(projectId: string): ProjectInsight[] {
    return this.projectInsights.get(projectId) || [];
  }

  getProjectLearnings(projectId: string): ProjectLearning[] {
    return this.projectLearnings.get(projectId) || [];
  }

  getOrganizationalMemory(domain: string): OrganizationalMemory | undefined {
    return this.organizationalMemory.get(domain);
  }

  getAllDomains(): string[] {
    return Array.from(this.organizationalMemory.keys());
  }

  searchInsights(query: string): ProjectInsight[] {
    const allInsights: ProjectInsight[] = [];
    
    for (const insights of this.projectInsights.values()) {
      allInsights.push(...insights);
    }
    
    return allInsights.filter(insight => 
      insight.title.toLowerCase().includes(query.toLowerCase()) ||
      insight.description.toLowerCase().includes(query.toLowerCase()) ||
      insight.insight.pattern.toLowerCase().includes(query.toLowerCase())
    );
  }

  getSystemStats(): {
    totalProjects: number;
    totalInsights: number;
    totalLearnings: number;
    totalDomains: number;
    averageConfidence: number;
  } {
    const totalProjects = this.projectContexts.size;
    
    let totalInsights = 0;
    let totalConfidence = 0;
    for (const insights of this.projectInsights.values()) {
      totalInsights += insights.length;
      totalConfidence += insights.reduce((sum, i) => sum + i.insight.confidence, 0);
    }
    
    let totalLearnings = 0;
    for (const learnings of this.projectLearnings.values()) {
      totalLearnings += learnings.length;
    }
    
    const totalDomains = this.organizationalMemory.size;
    const averageConfidence = totalInsights > 0 ? totalConfidence / totalInsights : 0;
    
    return {
      totalProjects,
      totalInsights,
      totalLearnings,
      totalDomains,
      averageConfidence,
    };
  }

  async clearData(domain?: string): Promise<void> {
    if (domain) {
      this.organizationalMemory.delete(domain);
    } else {
      this.projectInsights.clear();
      this.projectLearnings.clear();
      this.organizationalMemory.clear();
      this.projectContexts.clear();
    }
    
    this.emit('dataCleared', { domain });
    logger.info('Cross-project learning data cleared', { domain });
  }
}

export default CrossProjectLearning;