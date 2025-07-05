import { BaseAgent } from '../base/Agent.js';
import { AgentContext, AgentResult, AgentConfig } from '../../types/Agent.js';
import { AnthropicClient, AnthropicResponse } from '../../integrations/ai/AnthropicClient.js';
import logger from '../../utils/logger.js';

export interface CodingTask {
  type: 'implement' | 'debug' | 'refactor' | 'review' | 'optimize';
  description: string;
  language?: string;
  framework?: string;
  existingCode?: string;
  requirements?: string[];
  constraints?: string[];
  testRequirements?: boolean;
}

export interface CodingResult extends AgentResult {
  code?: string;
  explanation?: string;
  testCode?: string;
  documentation?: string;
  recommendations?: string[];
}

export class CodingAgent extends BaseAgent {
  private anthropicClient: AnthropicClient;

  constructor(config: AgentConfig) {
    super({
      ...config,
      name: 'CodingAgent',
      type: 'execution',
      capabilities: [
        'code_implementation',
        'code_debugging',
        'code_refactoring',
        'code_review',
        'code_optimization',
        'documentation_generation'
      ]
    });

    this.anthropicClient = new AnthropicClient({
      defaultModel: 'claude-3-sonnet-20240229',
      temperature: 0.3, // Lower temperature for coding tasks
      maxTokens: 8192
    });

    logger.info('CodingAgent initialized', { 
      agentId: this.id, 
      model: 'claude-3-sonnet-20240229' 
    });
  }

  public async executeTask(context: AgentContext): Promise<CodingResult> {
    try {
      this.updateStatus('processing');
      
      const task = this.parseTask(context);
      logger.info('CodingAgent executing task', { 
        agentId: this.id, 
        taskType: task.type,
        language: task.language 
      });

      let result: CodingResult;

      switch (task.type) {
        case 'implement':
          result = await this.implementCode(task, context);
          break;
        case 'debug':
          result = await this.debugCode(task, context);
          break;
        case 'refactor':
          result = await this.refactorCode(task, context);
          break;
        case 'review':
          result = await this.reviewCode(task, context);
          break;
        case 'optimize':
          result = await this.optimizeCode(task, context);
          break;
        default:
          throw new Error(`Unknown coding task type: ${task.type}`);
      }

      this.updateStatus('completed');
      this.updateMetrics({
        taskType: task.type,
        language: task.language,
        duration: Date.now() - context.timestamp.getTime()
      });

      return result;
    } catch (error) {
      this.updateStatus('failed');
      logger.error('CodingAgent task failed', { 
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

  private parseTask(context: AgentContext): CodingTask {
    const { task } = context;
    
    if (typeof task === 'string') {
      return {
        type: 'implement',
        description: task
      };
    }

    if (typeof task === 'object' && task !== null) {
      return task as CodingTask;
    }

    throw new Error('Invalid coding task format');
  }

  private async implementCode(task: CodingTask, context: AgentContext): Promise<CodingResult> {
    const prompt = this.buildImplementationPrompt(task);
    const response = await this.anthropicClient.sendCodingRequest(
      prompt,
      this.buildContext(context),
      task.language
    );

    const parsedResult = this.parseCodeResponse(response);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      code: parsedResult.code,
      explanation: parsedResult.explanation,
      testCode: task.testRequirements ? parsedResult.testCode : undefined,
      documentation: parsedResult.documentation,
      recommendations: parsedResult.recommendations
    };
  }

  private async debugCode(task: CodingTask, context: AgentContext): Promise<CodingResult> {
    const prompt = `Debug the following code and fix any issues:

${task.existingCode}

Problem description: ${task.description}

${task.language ? `Language: ${task.language}` : ''}

Please:
1. Identify the issues
2. Provide the corrected code
3. Explain what was wrong and how you fixed it
4. Suggest improvements to prevent similar issues`;

    const response = await this.anthropicClient.sendCodingRequest(
      prompt,
      this.buildContext(context),
      task.language
    );

    const parsedResult = this.parseCodeResponse(response);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      code: parsedResult.code,
      explanation: parsedResult.explanation,
      recommendations: parsedResult.recommendations
    };
  }

  private async refactorCode(task: CodingTask, context: AgentContext): Promise<CodingResult> {
    const prompt = `Refactor the following code to improve its quality:

${task.existingCode}

Goals: ${task.description}

${task.constraints ? `Constraints: ${task.constraints.join(', ')}` : ''}

Please:
1. Improve code structure and readability
2. Optimize performance where possible
3. Follow best practices and conventions
4. Maintain existing functionality
5. Add appropriate comments and documentation`;

    const response = await this.anthropicClient.sendCodingRequest(
      prompt,
      this.buildContext(context),
      task.language
    );

    const parsedResult = this.parseCodeResponse(response);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      code: parsedResult.code,
      explanation: parsedResult.explanation,
      documentation: parsedResult.documentation,
      recommendations: parsedResult.recommendations
    };
  }

  private async reviewCode(task: CodingTask, context: AgentContext): Promise<CodingResult> {
    const prompt = `Review the following code for quality, security, and best practices:

${task.existingCode}

${task.language ? `Language: ${task.language}` : ''}
${task.framework ? `Framework: ${task.framework}` : ''}

Please provide:
1. Overall code quality assessment
2. Security vulnerabilities if any
3. Performance considerations
4. Best practice violations
5. Suggestions for improvement
6. Code maintainability assessment`;

    const response = await this.anthropicClient.sendCodingRequest(
      prompt,
      this.buildContext(context),
      task.language
    );

    const parsedResult = this.parseCodeResponse(response);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      explanation: parsedResult.explanation,
      recommendations: parsedResult.recommendations,
      code: parsedResult.suggestedCode // Optional improved version
    };
  }

  private async optimizeCode(task: CodingTask, context: AgentContext): Promise<CodingResult> {
    const prompt = `Optimize the following code for performance and efficiency:

${task.existingCode}

Optimization goals: ${task.description}

${task.constraints ? `Constraints: ${task.constraints.join(', ')}` : ''}

Please:
1. Identify performance bottlenecks
2. Provide optimized version
3. Explain the optimizations made
4. Include performance impact estimates
5. Suggest monitoring approaches`;

    const response = await this.anthropicClient.sendCodingRequest(
      prompt,
      this.buildContext(context),
      task.language
    );

    const parsedResult = this.parseCodeResponse(response);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      code: parsedResult.code,
      explanation: parsedResult.explanation,
      recommendations: parsedResult.recommendations
    };
  }

  private buildImplementationPrompt(task: CodingTask): string {
    let prompt = `Implement the following functionality:

${task.description}

${task.language ? `Language: ${task.language}` : ''}
${task.framework ? `Framework: ${task.framework}` : ''}

${task.requirements ? `Requirements:
${task.requirements.map(r => `- ${r}`).join('\n')}` : ''}

${task.constraints ? `Constraints:
${task.constraints.map(c => `- ${c}`).join('\n')}` : ''}

Please provide:
1. Complete, functional implementation
2. Clear documentation and comments
3. Error handling where appropriate
4. Best practices and conventions`;

    if (task.testRequirements) {
      prompt += '\n5. Comprehensive test cases';
    }

    return prompt;
  }

  private buildContext(context: AgentContext): string {
    let contextStr = '';
    
    if (context.previousMessages && context.previousMessages.length > 0) {
      contextStr += 'Previous conversation context:\n';
      contextStr += context.previousMessages
        .slice(-5) // Last 5 messages
        .map(msg => `${msg.sender}: ${msg.content}`)
        .join('\n');
    }

    if (context.metadata) {
      contextStr += `\nAdditional context: ${JSON.stringify(context.metadata, null, 2)}`;
    }

    return contextStr;
  }

  private parseCodeResponse(response: AnthropicResponse): {
    code?: string;
    explanation?: string;
    testCode?: string;
    documentation?: string;
    recommendations?: string[];
    suggestedCode?: string;
  } {
    const content = response.content;
    
    // Extract code blocks
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    const mainCode = codeBlocks[0]?.replace(/```\w*\n?|\n?```/g, '').trim();
    const testCode = codeBlocks[1]?.replace(/```\w*\n?|\n?```/g, '').trim();

    // Extract sections
    const explanationMatch = content.match(/(?:explanation|description):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const explanation = explanationMatch?.[1]?.trim();

    const recommendationsMatch = content.match(/(?:recommendations|suggestions):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const recommendations = recommendationsMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.trim().replace(/^[-•]\s*/, ''));

    return {
      code: mainCode,
      explanation,
      testCode,
      recommendations
    };
  }

  public async getCapabilities(): Promise<string[]> {
    return [
      'Implement new functionality in multiple programming languages',
      'Debug and fix code issues',
      'Refactor code for better quality and maintainability',
      'Review code for security and best practices',
      'Optimize code for performance',
      'Generate comprehensive documentation',
      'Create unit and integration tests'
    ];
  }
}

export default CodingAgent;