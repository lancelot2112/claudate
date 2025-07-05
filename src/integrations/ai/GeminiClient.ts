import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../../utils/config.js';
import logger from '../../utils/logger.js';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

export interface GeminiRequest {
  messages: GeminiMessage[];
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  systemInstruction?: string;
}

export interface GeminiResponse {
  content: string;
  usage?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
  model: string;
}

export interface GeminiConfig {
  apiKey: string;
  defaultModel: string;
  temperature: number;
  maxOutputTokens: number;
  timeout: number;
  maxRetries: number;
}

export class GeminiClient {
  private client: GoogleGenerativeAI;
  private config: GeminiConfig;
  private costTracker: Map<string, number> = new Map();

  constructor(customConfig?: Partial<GeminiConfig>) {
    this.config = {
      apiKey: config.ai.google.apiKey,
      defaultModel: 'gemini-1.5-pro',
      temperature: 0.7,
      maxOutputTokens: 4096,
      timeout: 30000,
      maxRetries: 3,
      ...customConfig
    };

    this.client = new GoogleGenerativeAI(this.config.apiKey);

    logger.info('GeminiClient initialized', { 
      model: this.config.defaultModel,
      maxOutputTokens: this.config.maxOutputTokens 
    });
  }

  public async sendMessage(request: GeminiRequest): Promise<GeminiResponse> {
    try {
      const startTime = Date.now();
      
      const model = this.client.getGenerativeModel({
        model: request.model || this.config.defaultModel,
        generationConfig: {
          temperature: request.temperature || this.config.temperature,
          maxOutputTokens: request.maxOutputTokens || this.config.maxOutputTokens,
        },
        systemInstruction: request.systemInstruction
      });

      // Convert messages to Gemini chat format
      const history = request.messages.slice(0, -1);
      const lastMessage = request.messages[request.messages.length - 1];
      
      if (!lastMessage?.parts?.[0]?.text) {
        throw new Error('Invalid message format: missing text content');
      }

      const chat = model.startChat({
        history: history.map(msg => ({
          role: msg.role,
          parts: msg.parts
        }))
      });

      const result = await chat.sendMessage(lastMessage.parts[0].text);
      const response = result.response;
      
      const duration = Date.now() - startTime;
      const content = response.text();
      
      // Track usage and costs if available
      const usage = response.usageMetadata;
      if (usage) {
        const cost = this.calculateCost(usage.promptTokenCount, usage.candidatesTokenCount);
        this.trackCost(cost);

        logger.info('Gemini API request completed', {
          model: request.model || this.config.defaultModel,
          duration,
          promptTokens: usage.promptTokenCount,
          candidatesTokens: usage.candidatesTokenCount,
          totalTokens: usage.totalTokenCount,
          cost: cost.toFixed(4)
        });
      } else {
        logger.info('Gemini API request completed', {
          model: request.model || this.config.defaultModel,
          duration
        });
      }

      return {
        content,
        usage: usage ? {
          promptTokenCount: usage.promptTokenCount,
          candidatesTokenCount: usage.candidatesTokenCount,
          totalTokenCount: usage.totalTokenCount
        } : undefined,
        model: request.model || this.config.defaultModel
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Gemini API request failed', { error: errorMessage });
      throw new Error(`Gemini API error: ${errorMessage}`);
    }
  }

  public async sendStrategicRequest(
    prompt: string,
    context?: string,
    domain?: string
  ): Promise<GeminiResponse> {
    const systemInstruction = `You are a strategic planning expert and business advisor. You provide high-level strategic guidance and architectural decisions.

${domain ? `You specialize in ${domain} domain.` : ''}
${context ? `Context: ${context}` : ''}

Provide strategic recommendations that are:
- High-level and architectural in nature
- Considering long-term implications
- Balancing technical and business concerns
- Scalable and maintainable
- Risk-aware and pragmatic`;

    return this.sendMessage({
      messages: [{ 
        role: 'user', 
        parts: [{ text: prompt }] 
      }],
      systemInstruction,
      temperature: 0.8 // Higher temperature for creative strategic thinking
    });
  }

  public async sendPlanningRequest(
    objective: string,
    constraints?: string[],
    timeline?: string
  ): Promise<GeminiResponse> {
    const systemInstruction = `You are an expert project planner and architect. You create comprehensive, executable plans.

Create detailed plans that include:
- Clear phases and milestones
- Resource requirements
- Risk assessment and mitigation
- Dependencies and critical paths
- Success criteria and metrics
- Realistic timelines and estimates`;

    const prompt = `Create a comprehensive plan for the following objective:

Objective: ${objective}

${constraints && constraints.length > 0 ? `Constraints:
${constraints.map(c => `- ${c}`).join('\n')}` : ''}

${timeline ? `Timeline: ${timeline}` : ''}

Provide:
1. Executive summary
2. Detailed phase breakdown
3. Resource requirements
4. Risk assessment
5. Success metrics
6. Implementation timeline`;

    return this.sendMessage({
      messages: [{ 
        role: 'user', 
        parts: [{ text: prompt }] 
      }],
      systemInstruction,
      temperature: 0.6 // Moderate temperature for structured planning
    });
  }

  public async sendArchitecturalReview(
    systemDescription: string,
    requirements: string[],
    constraints: string[]
  ): Promise<GeminiResponse> {
    const systemInstruction = `You are a senior software architect. You review system designs and provide architectural guidance.

Focus on:
- System architecture and design patterns
- Scalability and performance considerations
- Security and reliability aspects
- Technology stack recommendations
- Integration and API design
- Maintainability and extensibility`;

    const prompt = `Review the following system architecture:

System Description:
${systemDescription}

Requirements:
${requirements.map(r => `- ${r}`).join('\n')}

Constraints:
${constraints.map(c => `- ${c}`).join('\n')}

Provide:
1. Architecture assessment
2. Recommended improvements
3. Potential risks and issues
4. Technology recommendations
5. Scalability considerations
6. Security recommendations`;

    return this.sendMessage({
      messages: [{ 
        role: 'user', 
        parts: [{ text: prompt }] 
      }],
      systemInstruction,
      temperature: 0.5 // Lower temperature for technical analysis
    });
  }

  private calculateCost(promptTokens: number, candidatesTokens: number): number {
    // Gemini 1.5 Pro pricing (as of 2024)
    const inputCost = (promptTokens / 1000) * 0.0035; // $0.0035 per 1K input tokens
    const outputCost = (candidatesTokens / 1000) * 0.0105; // $0.0105 per 1K output tokens
    return inputCost + outputCost;
  }

  private trackCost(cost: number): void {
    const today = new Date().toISOString().split('T')[0]!; // This is guaranteed to exist
    const currentCost = this.costTracker.get(today) || 0;
    this.costTracker.set(today, currentCost + cost);

    // Check against daily limit
    if (currentCost + cost > config.costs.dailyLimit) {
      logger.warn('Daily cost limit exceeded for Gemini', { 
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
        messages: [{ 
          role: 'user', 
          parts: [{ text: 'Hello, can you respond with "OK"?' }] 
        }],
        maxOutputTokens: 10
      });
      return response.content.includes('OK');
    } catch (error) {
      logger.error('Gemini health check failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
}

export default GeminiClient;