import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../utils/config.js';
import logger from '../../utils/logger.js';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnthropicRequest {
  messages: AnthropicMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
  system?: string;
}

export interface AnthropicResponse {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
}

export interface AnthropicConfig {
  apiKey: string;
  defaultModel: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  maxRetries: number;
}

export class AnthropicClient {
  private client: Anthropic;
  private config: AnthropicConfig;
  private costTracker: Map<string, number> = new Map();

  constructor(customConfig?: Partial<AnthropicConfig>) {
    this.config = {
      apiKey: config.ai.anthropic.apiKey,
      defaultModel: 'claude-3-sonnet-20240229',
      maxTokens: 4096,
      temperature: 0.7,
      timeout: 30000,
      maxRetries: 3,
      ...customConfig
    };

    this.client = new Anthropic({
      apiKey: this.config.apiKey,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries
    });

    logger.info('AnthropicClient initialized', { 
      model: this.config.defaultModel,
      maxTokens: this.config.maxTokens 
    });
  }

  public async sendMessage(request: AnthropicRequest): Promise<AnthropicResponse> {
    try {
      const startTime = Date.now();
      
      const response = await this.client.messages.create({
        model: request.model || this.config.defaultModel,
        max_tokens: request.max_tokens || this.config.maxTokens,
        temperature: request.temperature || this.config.temperature,
        system: request.system,
        messages: request.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      });

      const duration = Date.now() - startTime;
      
      // Track usage and costs
      const usage = response.usage;
      const cost = this.calculateCost(usage.input_tokens, usage.output_tokens);
      this.trackCost(cost);

      logger.info('Anthropic API request completed', {
        model: response.model,
        duration,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cost: cost.toFixed(4)
      });

      const firstContent = response.content[0];
      const content = firstContent && 'text' in firstContent ? firstContent.text : '';
      
      return {
        content,
        usage: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens
        },
        model: response.model
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Anthropic API request failed', { error: errorMessage });
      throw new Error(`Anthropic API error: ${errorMessage}`);
    }
  }

  public async sendCodingRequest(
    prompt: string,
    context?: string,
    language?: string
  ): Promise<AnthropicResponse> {
    const systemMessage = `You are an expert software engineer. You write clean, efficient, and well-documented code.
${language ? `Focus on ${language} programming language.` : ''}
${context ? `Context: ${context}` : ''}

Provide code solutions that are:
- Syntactically correct and functional
- Well-commented and documented
- Following best practices and conventions
- Optimized for readability and maintainability`;

    return this.sendMessage({
      messages: [{ role: 'user', content: prompt }],
      system: systemMessage,
      temperature: 0.3 // Lower temperature for coding tasks
    });
  }

  public async sendTestingRequest(
    code: string,
    testType: 'unit' | 'integration' | 'e2e' = 'unit'
  ): Promise<AnthropicResponse> {
    const systemMessage = `You are an expert test engineer. You write comprehensive, reliable tests.

Create ${testType} tests that are:
- Complete and thorough
- Following testing best practices
- Using appropriate testing frameworks
- Including edge cases and error scenarios
- Well-documented with clear assertions`;

    const prompt = `Write ${testType} tests for the following code:

\`\`\`
${code}
\`\`\`

Include:
1. Happy path tests
2. Edge case tests
3. Error handling tests
4. Mock setup if needed`;

    return this.sendMessage({
      messages: [{ role: 'user', content: prompt }],
      system: systemMessage,
      temperature: 0.2 // Very low temperature for testing
    });
  }

  public async sendToolExecutionRequest(
    tool: string,
    parameters: Record<string, any>,
    context?: string
  ): Promise<AnthropicResponse> {
    const systemMessage = `You are an expert tool execution agent. You execute development tools and commands safely and effectively.

You have access to various development tools and should:
- Execute commands safely
- Validate parameters before execution
- Handle errors gracefully
- Provide clear output and results
- Follow security best practices`;

    const prompt = `Execute the following tool with given parameters:

Tool: ${tool}
Parameters: ${JSON.stringify(parameters, null, 2)}
${context ? `Context: ${context}` : ''}

Provide:
1. Validation of parameters
2. Safe execution approach
3. Expected results
4. Error handling strategy`;

    return this.sendMessage({
      messages: [{ role: 'user', content: prompt }],
      system: systemMessage,
      temperature: 0.1 // Very low temperature for tool execution
    });
  }

  private calculateCost(inputTokens: number, outputTokens: number): number {
    // Claude 3 Sonnet pricing (as of 2024)
    const inputCost = (inputTokens / 1000) * 0.003; // $0.003 per 1K input tokens
    const outputCost = (outputTokens / 1000) * 0.015; // $0.015 per 1K output tokens
    return inputCost + outputCost;
  }

  private trackCost(cost: number): void {
    const today = new Date().toISOString().split('T')[0]!; // This is guaranteed to exist
    const currentCost = this.costTracker.get(today) || 0;
    this.costTracker.set(today, currentCost + cost);

    // Check against daily limit
    if (currentCost + cost > config.costs.dailyLimit) {
      logger.warn('Daily cost limit exceeded', { 
        currentCost: currentCost + cost, 
        limit: config.costs.dailyLimit 
      });
    }
  }

  public getDailyCost(date?: string): number {
    const targetDate = date || new Date().toISOString().split('T')[0]!; // This is guaranteed to exist
    return this.costTracker.get(targetDate) || 0;
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const response = await this.sendMessage({
        messages: [{ role: 'user', content: 'Hello, can you respond with "OK"?' }],
        max_tokens: 10
      });
      return response.content.includes('OK');
    } catch (error) {
      logger.error('Anthropic health check failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
}

export default AnthropicClient;