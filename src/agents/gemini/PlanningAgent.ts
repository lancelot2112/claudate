import { BaseAgent } from '../base/Agent.js';
import { AgentContext, AgentResult, AgentConfig } from '../../types/Agent.js';
import { GeminiClient, GeminiResponse } from '../../integrations/ai/GeminiClient.js';
import logger from '../../utils/logger.js';

export interface PlanningTask {
  type: 'project_plan' | 'sprint_plan' | 'release_plan' | 'roadmap' | 'milestone_plan';
  objective: string;
  scope: 'feature' | 'project' | 'product' | 'portfolio';
  timeline: {
    start?: Date;
    end?: Date;
    duration?: string;
  };
  resources: {
    team?: Array<{
      role: string;
      availability: number; // percentage
      skills: string[];
    }>;
    budget?: number;
    constraints?: string[];
  };
  dependencies?: Array<{
    name: string;
    type: 'internal' | 'external';
    criticality: 'low' | 'medium' | 'high';
    owner?: string;
  }>;
  requirements?: string[];
  risks?: string[];
  success_criteria?: string[];
}

export interface PlanningResult extends AgentResult {
  plan?: {
    overview: string;
    phases: Array<{
      name: string;
      description: string;
      duration: string;
      startDate?: string;
      endDate?: string;
      deliverables: string[];
      milestones: Array<{
        name: string;
        date: string;
        criteria: string[];
      }>;
      resources: string[];
      dependencies: string[];
      risks: string[];
    }>;
    criticalPath: string[];
    timeline: {
      totalDuration: string;
      keyMilestones: Array<{
        name: string;
        date: string;
        significance: string;
      }>;
    };
    resourcePlan: {
      allocation: Record<string, number>;
      peakUsage: string;
      constraints: string[];
    };
    riskMitigation: Array<{
      risk: string;
      impact: 'low' | 'medium' | 'high';
      probability: 'low' | 'medium' | 'high';
      mitigation: string;
      contingency: string;
    }>;
  };
  alternatives?: Array<{
    name: string;
    description: string;
    pros: string[];
    cons: string[];
    timeline: string;
    cost: string;
  }>;
  recommendations?: string[];
}

export class PlanningAgent extends BaseAgent {
  private geminiClient: GeminiClient;

  constructor(config: AgentConfig) {
    super({
      ...config,
      name: 'PlanningAgent',
      type: 'strategic',
      capabilities: [
        'project_planning',
        'sprint_planning',
        'release_planning',
        'roadmap_creation',
        'milestone_planning',
        'resource_allocation',
        'timeline_optimization',
        'dependency_management',
        'risk_planning'
      ]
    });

    this.geminiClient = new GeminiClient({
      defaultModel: 'gemini-1.5-pro',
      temperature: 0.6, // Moderate temperature for structured planning
      maxOutputTokens: 8192
    });

    logger.info('PlanningAgent initialized', { 
      agentId: this.id, 
      model: 'gemini-1.5-pro' 
    });
  }

  public async executeTask(context: AgentContext): Promise<PlanningResult> {
    try {
      this.updateStatus('processing');
      
      const task = this.parseTask(context);
      logger.info('PlanningAgent executing task', { 
        agentId: this.id, 
        taskType: task.type,
        scope: task.scope,
        objective: task.objective 
      });

      let result: PlanningResult;

      switch (task.type) {
        case 'project_plan':
          result = await this.createProjectPlan(task, context);
          break;
        case 'sprint_plan':
          result = await this.createSprintPlan(task, context);
          break;
        case 'release_plan':
          result = await this.createReleasePlan(task, context);
          break;
        case 'roadmap':
          result = await this.createRoadmap(task, context);
          break;
        case 'milestone_plan':
          result = await this.createMilestonePlan(task, context);
          break;
        default:
          throw new Error(`Unknown planning task type: ${task.type}`);
      }

      this.updateStatus('completed');
      this.updateMetrics({
        taskType: task.type,
        scope: task.scope,
        duration: Date.now() - context.timestamp.getTime()
      });

      return result;
    } catch (error) {
      this.updateStatus('failed');
      logger.error('PlanningAgent task failed', { 
        agentId: this.id, 
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        agentId: this.id,
        timestamp: Date.now()
      };
    }
  }

  private parseTask(context: AgentContext): PlanningTask {
    const { task } = context;
    
    if (typeof task === 'object' && task !== null) {
      return task as PlanningTask;
    }

    throw new Error('Invalid planning task format');
  }

  private async createProjectPlan(task: PlanningTask, context: AgentContext): Promise<PlanningResult> {
    const prompt = `Create a comprehensive project plan for the following:

Objective: ${task.objective}
Scope: ${task.scope}

Timeline: ${this.formatTimeline(task.timeline)}

${task.requirements ? `Requirements:
${task.requirements.map(r => `- ${r}`).join('\n')}` : ''}

${task.resources.team ? `Team Resources:
${task.resources.team.map(t => `- ${t.role}: ${t.availability}% available, Skills: ${t.skills.join(', ')}`).join('\n')}` : ''}

${task.resources.budget ? `Budget: ${task.resources.budget}` : ''}

${task.resources.constraints ? `Constraints:
${task.resources.constraints.map(c => `- ${c}`).join('\n')}` : ''}

${task.dependencies ? `Dependencies:
${task.dependencies.map(d => `- ${d.name} (${d.type}, ${d.criticality} criticality)`).join('\n')}` : ''}

${task.risks ? `Known Risks:
${task.risks.map(r => `- ${r}`).join('\n')}` : ''}

${task.success_criteria ? `Success Criteria:
${task.success_criteria.map(s => `- ${s}`).join('\n')}` : ''}

Please provide:
1. Detailed project phases with timelines
2. Key milestones and deliverables
3. Resource allocation plan
4. Critical path analysis
5. Risk assessment and mitigation
6. Success metrics and KPIs
7. Communication plan
8. Quality assurance approach
9. Alternative approaches if applicable`;

    const response = await this.geminiClient.sendMessage({
      messages: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      systemInstruction: 'You are an expert project planner and architect. Create comprehensive, executable plans with clear phases, milestones, resource requirements, risk assessment, and success criteria.'
    });

    const parsedResult = this.parsePlanningResponse(response, task.type);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      plan: parsedResult.plan,
      alternatives: parsedResult.alternatives,
      recommendations: parsedResult.recommendations
    };
  }

  private async createSprintPlan(task: PlanningTask, context: AgentContext): Promise<PlanningResult> {
    const prompt = `Create a detailed sprint plan for the following:

Sprint Objective: ${task.objective}
Duration: ${task.timeline.duration || '2 weeks'}

${task.requirements ? `User Stories/Requirements:
${task.requirements.map(r => `- ${r}`).join('\n')}` : ''}

${task.resources.team ? `Team Capacity:
${task.resources.team.map(t => `- ${t.role}: ${t.availability}% capacity`).join('\n')}` : ''}

${task.dependencies ? `Dependencies:
${task.dependencies.map(d => `- ${d.name} (${d.criticality} priority)`).join('\n')}` : ''}

${task.success_criteria ? `Definition of Done:
${task.success_criteria.map(s => `- ${s}`).join('\n')}` : ''}

Please provide:
1. Sprint goal and focus
2. Story breakdown and estimation
3. Daily task distribution
4. Sprint ceremonies schedule
5. Risk identification and mitigation
6. Capacity planning
7. Sprint success metrics
8. Potential blockers and solutions`;

    const response = await this.geminiClient.sendMessage({
      messages: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      systemInstruction: 'You are an expert agile coach and sprint planner. Create detailed sprint plans with story breakdown, capacity planning, and risk mitigation.'
    });

    const parsedResult = this.parsePlanningResponse(response, task.type);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      plan: parsedResult.plan,
      recommendations: parsedResult.recommendations
    };
  }

  private async createReleasePlan(task: PlanningTask, context: AgentContext): Promise<PlanningResult> {
    const prompt = `Create a comprehensive release plan for:

Release Objective: ${task.objective}
Timeline: ${this.formatTimeline(task.timeline)}

${task.requirements ? `Features to Include:
${task.requirements.map(r => `- ${r}`).join('\n')}` : ''}

${task.dependencies ? `Release Dependencies:
${task.dependencies.map(d => `- ${d.name} (${d.type}, must complete by ${d.criticality} priority)`).join('\n')}` : ''}

${task.success_criteria ? `Release Criteria:
${task.success_criteria.map(s => `- ${s}`).join('\n')}` : ''}

Please provide:
1. Release scope and feature breakdown
2. Development phases and milestones
3. Testing strategy and timeline
4. Deployment plan and rollback procedures
5. Risk assessment and contingencies
6. Communication and marketing timeline
7. Post-release monitoring plan
8. Success metrics and KPIs`;

    const response = await this.geminiClient.sendMessage({
      messages: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      systemInstruction: 'You are an expert release manager and product manager. Create comprehensive release plans with phased rollouts, testing strategies, and risk mitigation.'
    });

    const parsedResult = this.parsePlanningResponse(response, task.type);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      plan: parsedResult.plan,
      alternatives: parsedResult.alternatives,
      recommendations: parsedResult.recommendations
    };
  }

  private async createRoadmap(task: PlanningTask, context: AgentContext): Promise<PlanningResult> {
    const prompt = `Create a strategic roadmap for:

Vision: ${task.objective}
Scope: ${task.scope}
Timeline: ${this.formatTimeline(task.timeline)}

${task.requirements ? `Strategic Objectives:
${task.requirements.map(r => `- ${r}`).join('\n')}` : ''}

${task.resources.constraints ? `Constraints:
${task.resources.constraints.map(c => `- ${c}`).join('\n')}` : ''}

${task.dependencies ? `External Dependencies:
${task.dependencies.map(d => `- ${d.name} (${d.type})`).join('\n')}` : ''}

Please provide:
1. High-level strategic themes
2. Quarterly/milestone breakdown
3. Initiative prioritization
4. Resource requirements over time
5. Key decision points
6. Market/competitive considerations
7. Success metrics and outcomes
8. Risk assessment and alternatives
9. Investment priorities`;

    const response = await this.geminiClient.sendMessage({
      messages: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      systemInstruction: 'You are an expert strategic planner and product strategist. Create comprehensive roadmaps with strategic themes, milestone breakdowns, and investment priorities.'
    });

    const parsedResult = this.parsePlanningResponse(response, task.type);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      plan: parsedResult.plan,
      alternatives: parsedResult.alternatives,
      recommendations: parsedResult.recommendations
    };
  }

  private async createMilestonePlan(task: PlanningTask, context: AgentContext): Promise<PlanningResult> {
    const prompt = `Create a milestone-based plan for:

Objective: ${task.objective}
Timeline: ${this.formatTimeline(task.timeline)}

${task.requirements ? `Key Deliverables:
${task.requirements.map(r => `- ${r}`).join('\n')}` : ''}

${task.success_criteria ? `Milestone Criteria:
${task.success_criteria.map(s => `- ${s}`).join('\n')}` : ''}

${task.dependencies ? `Critical Dependencies:
${task.dependencies.map(d => `- ${d.name} (${d.criticality} impact)`).join('\n')}` : ''}

Please provide:
1. Major milestone definition and sequencing
2. Milestone success criteria and deliverables
3. Dependencies between milestones
4. Resource allocation per milestone
5. Risk assessment for each milestone
6. Progress tracking mechanisms
7. Escalation procedures
8. Milestone review and approval process`;

    const response = await this.geminiClient.sendMessage({
      messages: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      systemInstruction: 'You are an expert project manager and milestone planner. Create detailed milestone-based plans with clear criteria, dependencies, and tracking mechanisms.'
    });

    const parsedResult = this.parsePlanningResponse(response, task.type);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      plan: parsedResult.plan,
      recommendations: parsedResult.recommendations
    };
  }

  private formatTimeline(timeline: PlanningTask['timeline']): string {
    let result = '';
    
    if (timeline.start && timeline.end) {
      result = `${timeline.start.toISOString().split('T')[0]} to ${timeline.end.toISOString().split('T')[0]}`;
    } else if (timeline.duration) {
      result = timeline.duration;
    } else if (timeline.start) {
      result = `Starting ${timeline.start.toISOString().split('T')[0]}`;
    } else if (timeline.end) {
      result = `Due by ${timeline.end.toISOString().split('T')[0]}`;
    }
    
    return result || 'Timeline to be determined';
  }

  private parsePlanningResponse(response: GeminiResponse, taskType: string): {
    plan?: any;
    alternatives?: any[];
    recommendations?: string[];
  } {
    const content = response.content;
    
    // This is a simplified parser - in a real implementation,
    // you would have more sophisticated parsing logic
    
    // Extract main plan structure
    const planMatch = content.match(/(?:plan|phases):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const plan = this.extractPlanStructure(planMatch?.[1] || content);

    // Extract alternatives
    const alternativesMatch = content.match(/(?:alternatives|options):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const alternatives = this.extractAlternatives(alternativesMatch?.[1] || '');

    // Extract recommendations
    const recommendationsMatch = content.match(/(?:recommendations|suggestions):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const recommendations = recommendationsMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.trim().replace(/^[-•]\s*/, '')) || [];

    return {
      plan,
      alternatives,
      recommendations
    };
  }

  private extractPlanStructure(text: string): any {
    // Simplified plan extraction - would be more sophisticated in real implementation
    return {
      overview: 'Plan overview extracted from response',
      phases: [],
      criticalPath: [],
      timeline: {
        totalDuration: 'TBD',
        keyMilestones: []
      },
      resourcePlan: {
        allocation: {},
        peakUsage: 'TBD',
        constraints: []
      },
      riskMitigation: []
    };
  }

  private extractAlternatives(text: string): any[] {
    // Simplified alternatives extraction
    return [];
  }

  public async optimizePlan(
    currentPlan: any,
    constraints: string[],
    objectives: string[]
  ): Promise<{
    optimizedPlan: any;
    improvements: string[];
    tradeoffs: string[];
  }> {
    const prompt = `Optimize the following plan based on new constraints and objectives:

Current Plan: ${JSON.stringify(currentPlan, null, 2)}

New Constraints:
${constraints.map(c => `- ${c}`).join('\n')}

Optimization Objectives:
${objectives.map(o => `- ${o}`).join('\n')}

Please provide:
1. Optimized plan with improvements
2. Key changes and rationale
3. Trade-offs and impacts
4. Risk assessment of changes
5. Implementation approach for optimization`;

    // Send optimization request to Gemini
    await this.geminiClient.sendMessage({
      messages: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      systemInstruction: 'You are an expert plan optimizer and efficiency consultant. Analyze plans and provide optimizations with clear rationale and trade-off analysis.'
    });

    // TODO: Parse optimization response and extract improvements
    // For now, return the current plan with placeholder improvements
    // const parsedResponse = this.parseOptimizationResponse(response);
    return {
      optimizedPlan: currentPlan, // Would be parsed from response
      improvements: [],
      tradeoffs: []
    };
  }

  public async getCapabilities(): Promise<string[]> {
    return [
      'Comprehensive project planning',
      'Agile sprint planning',
      'Release planning and coordination',
      'Strategic roadmap development',
      'Milestone-based planning',
      'Resource allocation optimization',
      'Critical path analysis',
      'Risk-based planning',
      'Timeline optimization',
      'Dependency management'
    ];
  }
}

export default PlanningAgent;