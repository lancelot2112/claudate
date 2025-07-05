import { BaseAgent } from '../base/Agent.js';
import { AgentContext, AgentResult, AgentConfig } from '../../types/Agent.js';
import { GeminiClient, GeminiResponse } from '../../integrations/ai/GeminiClient.js';
import logger from '../../utils/logger.js';

export interface StrategicTask {
  type: 'architecture_review' | 'technology_selection' | 'risk_assessment' | 'scalability_analysis' | 'strategic_planning';
  domain?: string;
  scope: 'project' | 'system' | 'organization' | 'product';
  requirements: string[];
  constraints: string[];
  currentState?: string;
  targetState?: string;
  timeline?: string;
  stakeholders?: string[];
  budget?: {
    min: number;
    max: number;
    currency: string;
  };
}

export interface StrategicResult extends AgentResult {
  recommendation?: string;
  alternatives?: Array<{
    option: string;
    pros: string[];
    cons: string[];
    riskLevel: 'low' | 'medium' | 'high';
    cost: 'low' | 'medium' | 'high';
    timeline: string;
  }>;
  riskAssessment?: {
    risks: Array<{
      type: string;
      probability: 'low' | 'medium' | 'high';
      impact: 'low' | 'medium' | 'high';
      mitigation: string;
    }>;
    overallRisk: 'low' | 'medium' | 'high';
  };
  implementation?: {
    phases: Array<{
      name: string;
      duration: string;
      dependencies: string[];
      deliverables: string[];
      resources: string[];
    }>;
    criticalPath: string[];
    successMetrics: string[];
  };
  technologyStack?: {
    recommended: Record<string, string>;
    rationale: Record<string, string>;
    alternatives: Record<string, string[]>;
  };
}

export class StrategicAgent extends BaseAgent {
  private geminiClient: GeminiClient;

  constructor(config: AgentConfig) {
    super({
      ...config,
      name: 'StrategicAgent',
      type: 'strategic',
      capabilities: [
        'architecture_design',
        'technology_selection',
        'risk_assessment',
        'scalability_planning',
        'strategic_analysis',
        'cost_optimization',
        'stakeholder_analysis',
        'competitive_analysis'
      ]
    });

    this.geminiClient = new GeminiClient({
      defaultModel: 'gemini-1.5-pro',
      temperature: 0.8, // Higher temperature for creative strategic thinking
      maxOutputTokens: 8192
    });

    logger.info('StrategicAgent initialized', { 
      agentId: this.id, 
      model: 'gemini-1.5-pro' 
    });
  }

  public async executeTask(context: AgentContext): Promise<StrategicResult> {
    try {
      this.updateStatus('processing');
      
      const task = this.parseTask(context);
      logger.info('StrategicAgent executing task', { 
        agentId: this.id, 
        taskType: task.type,
        scope: task.scope,
        domain: task.domain 
      });

      let result: StrategicResult;

      switch (task.type) {
        case 'architecture_review':
          result = await this.performArchitectureReview(task, context);
          break;
        case 'technology_selection':
          result = await this.performTechnologySelection(task, context);
          break;
        case 'risk_assessment':
          result = await this.performRiskAssessment(task, context);
          break;
        case 'scalability_analysis':
          result = await this.performScalabilityAnalysis(task, context);
          break;
        case 'strategic_planning':
          result = await this.performStrategicPlanning(task, context);
          break;
        default:
          throw new Error(`Unknown strategic task type: ${task.type}`);
      }

      this.updateStatus('completed');
      this.updateMetrics({
        taskType: task.type,
        scope: task.scope,
        domain: task.domain,
        duration: Date.now() - context.timestamp.getTime()
      });

      return result;
    } catch (error) {
      this.updateStatus('failed');
      logger.error('StrategicAgent task failed', { 
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

  private parseTask(context: AgentContext): StrategicTask {
    const { task } = context;
    
    if (typeof task === 'object' && task !== null) {
      return task as StrategicTask;
    }

    throw new Error('Invalid strategic task format');
  }

  private async performArchitectureReview(task: StrategicTask, context: AgentContext): Promise<StrategicResult> {
    const prompt = `Perform a comprehensive architecture review for a ${task.scope} level solution.

Requirements:
${task.requirements.map(r => `- ${r}`).join('\n')}

Constraints:
${task.constraints.map(c => `- ${c}`).join('\n')}

${task.currentState ? `Current State: ${task.currentState}` : ''}
${task.targetState ? `Target State: ${task.targetState}` : ''}
${task.domain ? `Domain: ${task.domain}` : ''}

Please provide:
1. Architecture assessment and recommendations
2. Alternative architectural approaches
3. Risk analysis for each approach
4. Implementation roadmap
5. Technology stack recommendations
6. Scalability considerations
7. Security implications
8. Cost implications`;

    const response = await this.geminiClient.sendMessage({
      messages: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      systemInstruction: 'You are an expert software architect and technology strategist. Provide comprehensive architecture reviews with detailed analysis, alternatives, and implementation guidance.'
    });

    const parsedResult = this.parseStrategicResponse(response, task.type);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      recommendation: parsedResult.recommendation,
      alternatives: parsedResult.alternatives,
      riskAssessment: parsedResult.riskAssessment,
      implementation: parsedResult.implementation,
      technologyStack: parsedResult.technologyStack
    };
  }

  private async performTechnologySelection(task: StrategicTask, context: AgentContext): Promise<StrategicResult> {
    const prompt = `Provide technology selection recommendations for a ${task.scope} level solution.

Requirements:
${task.requirements.map(r => `- ${r}`).join('\n')}

Constraints:
${task.constraints.map(c => `- ${c}`).join('\n')}

${task.domain ? `Domain: ${task.domain}` : ''}
${task.timeline ? `Timeline: ${task.timeline}` : ''}
${task.budget ? `Budget: ${task.budget.min}-${task.budget.max} ${task.budget.currency}` : ''}

Consider:
1. Technology maturity and stability
2. Community support and ecosystem
3. Performance characteristics
4. Scalability requirements
5. Team expertise and learning curve
6. Long-term maintenance
7. Integration capabilities
8. Cost implications

Provide detailed recommendations with rationale.`;

    const response = await this.geminiClient.sendStrategicRequest(
      prompt,
      this.buildContext(context),
      task.domain
    );

    const parsedResult = this.parseStrategicResponse(response, task.type);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      recommendation: parsedResult.recommendation,
      alternatives: parsedResult.alternatives,
      technologyStack: parsedResult.technologyStack,
      riskAssessment: parsedResult.riskAssessment
    };
  }

  private async performRiskAssessment(task: StrategicTask, context: AgentContext): Promise<StrategicResult> {
    const prompt = `Perform a comprehensive risk assessment for the following initiative:

Scope: ${task.scope}
${task.domain ? `Domain: ${task.domain}` : ''}

Requirements:
${task.requirements.map(r => `- ${r}`).join('\n')}

Constraints:
${task.constraints.map(c => `- ${c}`).join('\n')}

${task.timeline ? `Timeline: ${task.timeline}` : ''}
${task.stakeholders ? `Stakeholders: ${task.stakeholders.join(', ')}` : ''}

Analyze risks in these categories:
1. Technical risks
2. Business risks
3. Operational risks
4. Security risks
5. Compliance risks
6. Market risks
7. Team/resource risks

For each risk, provide:
- Risk description
- Probability (low/medium/high)
- Impact (low/medium/high)
- Mitigation strategies
- Contingency plans`;

    const response = await this.geminiClient.sendStrategicRequest(
      prompt,
      this.buildContext(context),
      'Risk Assessment'
    );

    const parsedResult = this.parseStrategicResponse(response, task.type);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      recommendation: parsedResult.recommendation,
      riskAssessment: parsedResult.riskAssessment,
      alternatives: parsedResult.alternatives
    };
  }

  private async performScalabilityAnalysis(task: StrategicTask, context: AgentContext): Promise<StrategicResult> {
    const prompt = `Analyze scalability requirements and provide recommendations:

Current State: ${task.currentState || 'New system'}
Target State: ${task.targetState || 'Highly scalable system'}

Requirements:
${task.requirements.map(r => `- ${r}`).join('\n')}

Constraints:
${task.constraints.map(c => `- ${c}`).join('\n')}

Analyze:
1. Current bottlenecks and limitations
2. Scalability patterns and approaches
3. Horizontal vs vertical scaling strategies
4. Database scalability options
5. Caching strategies
6. Load balancing approaches
7. Microservices vs monolithic considerations
8. Cloud native patterns
9. Performance monitoring and optimization
10. Cost scalability models

Provide specific recommendations with implementation priorities.`;

    const response = await this.geminiClient.sendStrategicRequest(
      prompt,
      this.buildContext(context),
      'Scalability Analysis'
    );

    const parsedResult = this.parseStrategicResponse(response, task.type);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      recommendation: parsedResult.recommendation,
      alternatives: parsedResult.alternatives,
      implementation: parsedResult.implementation,
      technologyStack: parsedResult.technologyStack
    };
  }

  private async performStrategicPlanning(task: StrategicTask, context: AgentContext): Promise<StrategicResult> {
    const prompt = `Create a comprehensive strategic plan:

Objective: Transform from "${task.currentState || 'current state'}" to "${task.targetState || 'target state'}"
Scope: ${task.scope}
${task.domain ? `Domain: ${task.domain}` : ''}
${task.timeline ? `Timeline: ${task.timeline}` : ''}

Requirements:
${task.requirements.map(r => `- ${r}`).join('\n')}

Constraints:
${task.constraints.map(c => `- ${c}`).join('\n')}

${task.stakeholders ? `Stakeholders: ${task.stakeholders.join(', ')}` : ''}
${task.budget ? `Budget: ${task.budget.min}-${task.budget.max} ${task.budget.currency}` : ''}

Provide:
1. Executive summary
2. Strategic objectives and key results
3. Implementation phases with timelines
4. Resource requirements
5. Technology roadmap
6. Risk mitigation strategies
7. Success metrics and KPIs
8. Stakeholder communication plan
9. Change management approach
10. Investment priorities`;

    const response = await this.geminiClient.sendMessage({
      messages: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      systemInstruction: 'You are an expert strategic consultant and transformation leader. Create comprehensive strategic plans with clear phases, metrics, and implementation guidance.'
    });

    const parsedResult = this.parseStrategicResponse(response, task.type);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      recommendation: parsedResult.recommendation,
      implementation: parsedResult.implementation,
      riskAssessment: parsedResult.riskAssessment,
      alternatives: parsedResult.alternatives
    };
  }

  private buildContext(context: AgentContext): string {
    let contextStr = '';
    
    if (context.previousMessages && context.previousMessages.length > 0) {
      contextStr += 'Previous strategic discussions:\n';
      contextStr += context.previousMessages
        .slice(-3) // Last 3 messages for strategic context
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n');
    }

    if (context.metadata) {
      contextStr += `\nAdditional context: ${JSON.stringify(context.metadata, null, 2)}`;
    }

    return contextStr;
  }

  private parseStrategicResponse(response: GeminiResponse, taskType: string): {
    recommendation?: string;
    alternatives?: any[];
    riskAssessment?: any;
    implementation?: any;
    technologyStack?: any;
  } {
    const content = response.content;
    
    // Extract main recommendation
    const recommendationMatch = content.match(/(?:recommendation|summary):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const recommendation = recommendationMatch?.[1]?.trim();

    // Extract alternatives
    const alternativesMatch = content.match(/(?:alternatives|options):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const alternatives = this.parseAlternatives(alternativesMatch?.[1] || '');

    // Extract risk assessment
    const riskMatch = content.match(/(?:risk|risks):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const riskAssessment = this.parseRiskAssessment(riskMatch?.[1] || '');

    // Extract implementation phases
    const implementationMatch = content.match(/(?:implementation|phases):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const implementation = this.parseImplementation(implementationMatch?.[1] || '');

    // Extract technology stack
    const technologyMatch = content.match(/(?:technology|stack):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const technologyStack = this.parseTechnologyStack(technologyMatch?.[1] || '');

    return {
      recommendation,
      alternatives,
      riskAssessment,
      implementation,
      technologyStack
    };
  }

  private parseAlternatives(text: string): Array<{
    option: string;
    pros: string[];
    cons: string[];
    riskLevel: 'low' | 'medium' | 'high';
    cost: 'low' | 'medium' | 'high';
    timeline: string;
  }> {
    // Implementation would parse structured alternatives from text
    // For now, return basic structure
    return [];
  }

  private parseRiskAssessment(text: string): {
    risks: Array<{
      type: string;
      probability: 'low' | 'medium' | 'high';
      impact: 'low' | 'medium' | 'high';
      mitigation: string;
    }>;
    overallRisk: 'low' | 'medium' | 'high';
  } {
    // Implementation would parse risk information from text
    return {
      risks: [],
      overallRisk: 'medium'
    };
  }

  private parseImplementation(text: string): {
    phases: Array<{
      name: string;
      duration: string;
      dependencies: string[];
      deliverables: string[];
      resources: string[];
    }>;
    criticalPath: string[];
    successMetrics: string[];
  } {
    // Implementation would parse implementation details from text
    return {
      phases: [],
      criticalPath: [],
      successMetrics: []
    };
  }

  private parseTechnologyStack(text: string): {
    recommended: Record<string, string>;
    rationale: Record<string, string>;
    alternatives: Record<string, string[]>;
  } {
    // Implementation would parse technology recommendations from text
    return {
      recommended: {},
      rationale: {},
      alternatives: {}
    };
  }

  public async getCapabilities(): Promise<string[]> {
    return [
      'Architectural design and review',
      'Technology stack selection and evaluation',
      'Risk assessment and mitigation planning',
      'Scalability analysis and planning',
      'Strategic roadmap development',
      'Cost-benefit analysis',
      'Stakeholder analysis and communication',
      'Competitive analysis and positioning',
      'Change management strategy',
      'Investment prioritization'
    ];
  }
}

export default StrategicAgent;