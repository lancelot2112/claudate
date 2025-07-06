import { BaseAgent } from '../base/Agent.js';
import { AgentContext, AgentResult, AgentConfig } from '../../types/Agent.js';
import { OllamaClient } from '../../integrations/ai/OllamaClient.js';
import logger from '../../utils/logger.js';

export interface Qwen3Task {
  type: 'reasoning' | 'analysis' | 'generation' | 'coding' | 'translation' | 'summarization';
  description: string;
  context?: string;
  language?: string;
  format?: 'text' | 'json' | 'markdown' | 'code';
  maxLength?: number;
  temperature?: number;
}

export interface Qwen3Result extends AgentResult {
  content: string;
  reasoning?: string;
  confidence?: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export class Qwen3Agent extends BaseAgent {
  private ollamaClient: OllamaClient;
  private modelName: string;

  constructor(config: AgentConfig, modelName: string = 'qwen3:8b') {
    super({
      ...config,
      name: 'Qwen3Agent',
      type: 'execution',
      capabilities: [
        'text_generation',
        'code_generation',
        'reasoning',
        'analysis',
        'translation',
        'summarization',
        'question_answering',
        'creative_writing',
        'problem_solving',
        'multilingual_support'
      ]
    });

    this.modelName = modelName;
    this.ollamaClient = new OllamaClient({
      host: 'localhost',
      port: 11434,
      defaultModel: this.modelName,
      timeout: 120000, // 2 minutes for complex tasks
      maxRetries: 3
    });

    logger.info('Qwen3Agent initialized', { 
      agentId: this.id, 
      model: this.modelName,
      capabilities: this.capabilities.length
    });
  }

  public async executeTask(context: AgentContext): Promise<Qwen3Result> {
    try {
      this.updateStatus('processing');
      
      const task = this.parseTask(context);
      logger.info('Qwen3Agent executing task', { 
        agentId: this.id,
        taskType: task.type,
        hasContext: !!task.context
      });

      const startTime = Date.now();
      
      // Build prompt based on task type
      const prompt = this.buildPrompt(task);
      
      // Execute with Ollama
      const response = await this.ollamaClient.sendMessage({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        options: {
          temperature: task.temperature || 0.7
        }
      });

      const processingTime = Date.now() - startTime;

      // Parse and validate response
      const result = this.processResponse(response, task, processingTime);

      this.updateStatus('completed');
      this.updateMetrics({
        processingTime,
        taskType: task.type,
        responseLength: result.content.length,
        success: true
      });

      logger.info('Qwen3Agent task completed', {
        agentId: this.id,
        taskType: task.type,
        processingTime,
        responseLength: result.content.length
      });

      return result;

    } catch (error) {
      this.updateStatus('failed');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Qwen3Agent task failed', {
        agentId: this.id,
        error: errorMessage
      });

      return {
        success: false,
        agentId: this.id,
        timestamp: Date.now(),
        metadata: { error: errorMessage },
        content: '',
        confidence: 0
      };
    }
  }

  public async getCapabilities(): Promise<string[]> {
    return this.capabilities;
  }

  private parseTask(context: AgentContext): Qwen3Task {
    // Try to parse task from context
    if (context.task && typeof context.task === 'object') {
      return context.task as Qwen3Task;
    }

    // Fallback: create task from conversation history or task
    const message = context.conversationHistory?.[0]?.content || context.task?.toString() || '';
    
    // Infer task type from content
    const taskType = this.inferTaskType(message);

    return {
      type: taskType,
      description: message,
      format: 'text',
      temperature: 0.7
    };
  }

  private inferTaskType(message: string): Qwen3Task['type'] {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('code') || lowerMessage.includes('function') || lowerMessage.includes('algorithm')) {
      return 'coding';
    }
    if (lowerMessage.includes('analyze') || lowerMessage.includes('analysis')) {
      return 'analysis';
    }
    if (lowerMessage.includes('translate') || lowerMessage.includes('translation')) {
      return 'translation';
    }
    if (lowerMessage.includes('summarize') || lowerMessage.includes('summary')) {
      return 'summarization';
    }
    if (lowerMessage.includes('reason') || lowerMessage.includes('explain') || lowerMessage.includes('why')) {
      return 'reasoning';
    }
    
    return 'generation'; // Default
  }

  private buildPrompt(task: Qwen3Task): string {
    let prompt = '';

    // Add system context based on task type
    switch (task.type) {
      case 'coding':
        prompt += 'You are an expert programmer. Write clean, efficient, and well-documented code.\n\n';
        break;
      case 'analysis':
        prompt += 'You are an expert analyst. Provide thorough, structured analysis with clear insights.\n\n';
        break;
      case 'reasoning':
        prompt += 'You are a logical reasoning expert. Think step-by-step and explain your reasoning clearly.\n\n';
        break;
      case 'translation':
        prompt += 'You are an expert translator. Provide accurate, natural translations while preserving meaning and context.\n\n';
        break;
      case 'summarization':
        prompt += 'You are an expert at summarization. Create concise, accurate summaries that capture key points.\n\n';
        break;
      default:
        prompt += 'You are a helpful AI assistant. Provide clear, accurate, and useful responses.\n\n';
    }

    // Add context if provided
    if (task.context) {
      prompt += `Context:\n${task.context}\n\n`;
    }

    // Add the main task
    prompt += `Task: ${task.description}\n\n`;

    // Add format instructions
    if (task.format && task.format !== 'text') {
      prompt += `Please format your response as ${task.format}.\n\n`;
    }

    // Add length constraints
    if (task.maxLength) {
      prompt += `Please keep your response under ${task.maxLength} characters.\n\n`;
    }

    return prompt.trim();
  }

  private processResponse(response: any, task: Qwen3Task, processingTime: number): Qwen3Result {
    const content = response.content || response.message || '';
    
    // Calculate confidence based on response characteristics
    let confidence = 0.8; // Base confidence
    
    if (content.length > 100) confidence += 0.1;
    if (content.includes('step') || content.includes('because') || content.includes('therefore')) {
      confidence += 0.1; // Higher confidence for reasoned responses
    }
    
    confidence = Math.min(confidence, 1.0);

    // Estimate token usage (rough approximation)
    const promptTokens = Math.ceil(this.buildPrompt(task).length / 4);
    const completionTokens = Math.ceil(content.length / 4);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: {
        taskType: task.type,
        processingTime,
        model: this.modelName
      },
      content,
      confidence,
      tokenUsage: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens
      }
    };
  }

  // Health check for Ollama connection
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await this.ollamaClient.sendMessage({
        model: this.modelName,
        messages: [{ role: 'user', content: 'Test message for health check. Please respond with OK.' }],
        options: {
          temperature: 0.1
        }
      });
      
      return response.content.toLowerCase().includes('ok');
    } catch (error) {
      logger.error('Qwen3Agent health check failed', {
        agentId: this.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // Update model (allows switching between Qwen models)
  public updateModel(modelName: string): void {
    this.modelName = modelName;
    
    // Create new client with updated model
    this.ollamaClient = new OllamaClient({
      host: 'localhost',
      port: 11434,
      defaultModel: modelName,
      embeddingModel: 'all-minilm',
      timeout: 120000,
      maxRetries: 3
    });
    
    logger.info('Qwen3Agent model updated', {
      agentId: this.id,
      newModel: modelName
    });
  }

  // Get current model info
  public getModelInfo(): { model: string; status: string } {
    return {
      model: this.modelName,
      status: this.status
    };
  }
}

export default Qwen3Agent;