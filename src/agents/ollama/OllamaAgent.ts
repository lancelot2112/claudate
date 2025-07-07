import { BaseAgent } from '../base/Agent';
import { AgentContext, AgentResult, AgentConfig } from '../../types/Agent';
import { OllamaClient } from '../../integrations/ai/OllamaClient';
import logger from '../../utils/logger';

export interface OllamaAgentConfig extends AgentConfig {
  modelName: string;
  embeddingModel?: string;
  host?: string;
  port?: number;
  timeout?: number;
  maxRetries?: number;
}

export interface OllamaTask {
  type: 'reasoning' | 'analysis' | 'generation' | 'coding' | 'translation' | 'summarization' | 'creative_writing' | 'question_answering';
  description: string;
  context?: string;
  language?: string;
  format?: 'text' | 'json' | 'markdown' | 'code';
  maxLength?: number;
  temperature?: number;
}

export interface OllamaResult extends AgentResult {
  content: string;
  reasoning?: string;
  confidence?: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Generic Ollama Agent
 * 
 * A flexible agent that can work with any Ollama model. The agent
 * automatically infers capabilities based on the model name and
 * provides consistent task execution across different models.
 */
export class OllamaAgent extends BaseAgent {
  private ollamaClient: OllamaClient;
  private modelName: string;
  private embeddingModel?: string;

  constructor(config: OllamaAgentConfig) {
    // Infer capabilities from model name
    const capabilities = OllamaAgent.inferCapabilities(config.modelName);
    
    super({
      ...config,
      name: `OllamaAgent-${config.modelName}`,
      type: 'execution',
      capabilities
    });

    this.modelName = config.modelName;
    this.embeddingModel = config.embeddingModel;
    
    this.ollamaClient = new OllamaClient({
      host: config.host || 'localhost',
      port: config.port || 11434,
      defaultModel: this.modelName,
      embeddingModel: this.embeddingModel || 'mxbai-embed-large',
      timeout: config.timeout || 120000,
      maxRetries: config.maxRetries || 3
    });

    logger.info('OllamaAgent initialized', { 
      agentId: this.id, 
      model: this.modelName,
      capabilities: this.capabilities.length,
      embeddingModel: this.embeddingModel
    });
  }

  /**
   * Infer capabilities based on model name
   */
  public static inferCapabilities(modelName: string): string[] {
    const capabilities = ['text_generation', 'reasoning', 'question_answering'];
    const lowerName = modelName.toLowerCase();
    
    // Code-focused models
    if (lowerName.includes('code') || lowerName.includes('qwen') || lowerName.includes('starcoder')) {
      capabilities.push('code_generation', 'programming', 'debugging');
    }
    
    // Creative models
    if (lowerName.includes('llama') || lowerName.includes('mistral')) {
      capabilities.push('creative_writing', 'storytelling');
    }
    
    // Analysis models
    if (lowerName.includes('qwen') || lowerName.includes('claude') || lowerName.includes('llama')) {
      capabilities.push('analysis', 'summarization');
    }
    
    // Multilingual models
    if (lowerName.includes('qwen') || lowerName.includes('llama3')) {
      capabilities.push('translation', 'multilingual_support');
    }
    
    // Math/reasoning models
    if (lowerName.includes('math') || lowerName.includes('reasoning')) {
      capabilities.push('mathematical_reasoning', 'problem_solving');
    }
    
    return capabilities;
  }

  public async executeTask(context: AgentContext): Promise<OllamaResult> {
    try {
      this.updateStatus('processing');
      
      const task = this.parseTask(context);
      logger.info('OllamaAgent executing task', { 
        agentId: this.id,
        model: this.modelName,
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
          temperature: task.temperature || this.getDefaultTemperature(task.type)
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

      logger.info('OllamaAgent task completed', {
        agentId: this.id,
        model: this.modelName,
        taskType: task.type,
        processingTime,
        responseLength: result.content.length
      });

      return result;

    } catch (error) {
      this.updateStatus('failed');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('OllamaAgent task failed', {
        agentId: this.id,
        model: this.modelName,
        error: errorMessage
      });

      return {
        success: false,
        agentId: this.id,
        timestamp: Date.now(),
        metadata: { error: errorMessage, model: this.modelName },
        content: '',
        confidence: 0
      };
    }
  }

  public async getCapabilities(): Promise<string[]> {
    return this.capabilities;
  }

  private parseTask(context: AgentContext): OllamaTask {
    // Try to parse task from context
    if (context.task && typeof context.task === 'object') {
      return context.task as OllamaTask;
    }

    // Fallback: create task from conversation history or task string
    const message = context.conversationHistory?.[0]?.content || 
                   (typeof context.task === 'string' ? context.task : '') ||
                   context.task?.toString() || '';
    
    // Infer task type from content
    const taskType = this.inferTaskType(message);

    return {
      type: taskType,
      description: message,
      format: 'text',
      temperature: this.getDefaultTemperature(taskType)
    };
  }

  private inferTaskType(message: string): OllamaTask['type'] {
    const lowerMessage = message.toLowerCase();
    
    // Code-related tasks
    if (lowerMessage.includes('code') || lowerMessage.includes('function') || 
        lowerMessage.includes('algorithm') || lowerMessage.includes('debug') ||
        lowerMessage.includes('program') || lowerMessage.includes('script')) {
      return 'coding';
    }
    
    // Analysis tasks
    if (lowerMessage.includes('analyze') || lowerMessage.includes('analysis') ||
        lowerMessage.includes('compare') || lowerMessage.includes('evaluate')) {
      return 'analysis';
    }
    
    // Translation tasks
    if (lowerMessage.includes('translate') || lowerMessage.includes('translation') ||
        lowerMessage.includes('中文') || lowerMessage.includes('español')) {
      return 'translation';
    }
    
    // Summarization tasks
    if (lowerMessage.includes('summarize') || lowerMessage.includes('summary') ||
        lowerMessage.includes('brief') || lowerMessage.includes('overview')) {
      return 'summarization';
    }
    
    // Reasoning tasks
    if (lowerMessage.includes('reason') || lowerMessage.includes('explain') || 
        lowerMessage.includes('why') || lowerMessage.includes('how') ||
        lowerMessage.includes('logic') || lowerMessage.includes('because')) {
      return 'reasoning';
    }
    
    // Creative writing tasks
    if (lowerMessage.includes('write') || lowerMessage.includes('story') ||
        lowerMessage.includes('poem') || lowerMessage.includes('creative') ||
        lowerMessage.includes('novel') || lowerMessage.includes('fiction')) {
      return 'creative_writing';
    }
    
    // Question answering (default for questions)
    if (lowerMessage.includes('?') || lowerMessage.includes('what') || 
        lowerMessage.includes('who') || lowerMessage.includes('when') ||
        lowerMessage.includes('where')) {
      return 'question_answering';
    }
    
    return 'generation'; // Default fallback
  }

  private getDefaultTemperature(taskType: OllamaTask['type']): number {
    switch (taskType) {
      case 'coding':
      case 'analysis':
      case 'reasoning':
        return 0.3; // Lower temperature for precise tasks
      case 'creative_writing':
        return 0.8; // Higher temperature for creativity
      case 'translation':
      case 'summarization':
        return 0.5; // Medium temperature for balanced tasks
      case 'question_answering':
      case 'generation':
      default:
        return 0.7; // Default temperature
    }
  }

  private buildPrompt(task: OllamaTask): string {
    let prompt = '';

    // Add system context based on task type and model capabilities
    const systemPrompt = this.getSystemPrompt(task.type);
    if (systemPrompt) {
      prompt += systemPrompt + '\n\n';
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

  private getSystemPrompt(taskType: OllamaTask['type']): string {
    // Customize system prompts based on model capabilities
    const hasCodeCapability = this.capabilities.includes('code_generation');
    const hasAnalysisCapability = this.capabilities.includes('analysis');
    const hasCreativeCapability = this.capabilities.includes('creative_writing');
    
    switch (taskType) {
      case 'coding':
        if (hasCodeCapability) {
          return 'You are an expert programmer. Write clean, efficient, and well-documented code. Follow best practices and include helpful comments.';
        }
        return 'You are a helpful assistant with programming knowledge. Provide clear code solutions with explanations.';
        
      case 'analysis':
        if (hasAnalysisCapability) {
          return 'You are an expert analyst. Provide thorough, structured analysis with clear insights, supporting evidence, and actionable conclusions.';
        }
        return 'You are a thoughtful assistant. Analyze the given information carefully and provide clear insights.';
        
      case 'reasoning':
        return 'You are a logical reasoning expert. Think step-by-step and explain your reasoning clearly. Show your work and justify each conclusion.';
        
      case 'translation':
        return 'You are an expert translator. Provide accurate, natural translations while preserving meaning, context, and cultural nuances.';
        
      case 'summarization':
        return 'You are an expert at summarization. Create concise, accurate summaries that capture key points while maintaining clarity and completeness.';
        
      case 'creative_writing':
        if (hasCreativeCapability) {
          return 'You are a creative writer. Craft engaging, original content with vivid descriptions, compelling narratives, and authentic voice.';
        }
        return 'You are a helpful assistant with creative abilities. Write engaging and original content.';
        
      case 'question_answering':
        return 'You are a knowledgeable assistant. Provide accurate, comprehensive answers with supporting details and clear explanations.';
        
      case 'generation':
      default:
        return 'You are a helpful AI assistant. Provide clear, accurate, and useful responses tailored to the user\'s needs.';
    }
  }

  private processResponse(response: any, task: OllamaTask, processingTime: number): OllamaResult {
    const content = response.content || response.message || '';
    
    // Calculate confidence based on response characteristics and model type
    let confidence = this.calculateConfidence(content, task);
    
    // Estimate token usage (rough approximation: ~4 chars per token)
    const promptTokens = Math.ceil(this.buildPrompt(task).length / 4);
    const completionTokens = Math.ceil(content.length / 4);

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      metadata: {
        taskType: task.type,
        processingTime,
        model: this.modelName,
        embeddingModel: this.embeddingModel
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

  private calculateConfidence(content: string, task: OllamaTask): number {
    let confidence = 0.7; // Base confidence
    
    // Content length indicators
    if (content.length > 100) confidence += 0.1;
    if (content.length > 500) confidence += 0.1;
    
    // Reasoning indicators
    if (content.includes('step') || content.includes('because') || 
        content.includes('therefore') || content.includes('however')) {
      confidence += 0.1;
    }
    
    // Structure indicators
    if (content.includes('\n') && (content.includes('1.') || content.includes('-'))) {
      confidence += 0.05; // Well-structured response
    }
    
    // Task-specific confidence adjustments
    switch (task.type) {
      case 'coding':
        if (content.includes('```') || content.includes('function') || content.includes('def ')) {
          confidence += 0.1;
        }
        break;
      case 'analysis':
        if (content.includes('conclusion') || content.includes('analysis') || content.includes('finding')) {
          confidence += 0.1;
        }
        break;
    }
    
    return Math.min(confidence, 1.0);
  }

  // Health check for Ollama connection
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await this.ollamaClient.sendMessage({
        model: this.modelName,
        messages: [{ role: 'user', content: 'Test message for health check. Please respond with OK.' }],
        think: false,
        options: {
          temperature: 0.1
        }
      });
      
      return response.content.toLowerCase().includes('ok');
    } catch (error) {
      logger.error('OllamaAgent health check failed', {
        agentId: this.id,
        model: this.modelName,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  // Update model (allows runtime model switching)
  public updateModel(modelName: string, embeddingModel?: string): void {
    this.modelName = modelName;
    if (embeddingModel) {
      this.embeddingModel = embeddingModel;
    }
    
    // Update capabilities based on new model
    this.capabilities = OllamaAgent.inferCapabilities(modelName);
    
    // Create new client with updated model
    this.ollamaClient = new OllamaClient({
      host: 'localhost',
      port: 11434,
      defaultModel: modelName,
      embeddingModel: this.embeddingModel,
      timeout: 120000,
      maxRetries: 3
    });
    
    logger.info('OllamaAgent model updated', {
      agentId: this.id,
      newModel: modelName,
      newEmbeddingModel: embeddingModel,
      newCapabilities: this.capabilities
    });
  }

  // Get current model info
  public getModelInfo(): { model: string; embeddingModel?: string; status: string; capabilities: string[] } {
    return {
      model: this.modelName,
      embeddingModel: this.embeddingModel,
      status: this.status,
      capabilities: this.capabilities
    };
  }

  // Get maximum context window size for the current model
  public getMaxContextWindow(): number {
    // Model-specific context windows (in tokens)
    const contextWindows: Record<string, number> = {
      'qwen3:8b': 8192,
      'qwen2.5-coder:7b': 8192,
      'llama3.2:3b': 8192,
      'llama3.2:1b': 4096,
      'mistral:7b': 8192,
      'codellama:7b': 16384,
      'codellama:13b': 16384,
      'codellama:34b': 16384
    };

    return contextWindows[this.modelName] || 8000; // Default fallback
  }

  // Estimate token count for the current model
  public estimateTokenCount(text: string): number {
    // Model-specific token estimation (characters per token vary by model)
    const tokensPerChar: Record<string, number> = {
      'qwen3:8b': 0.27, // ~3.7 chars per token
      'qwen2.5-coder:7b': 0.3, // ~3.3 chars per token (more tokens for code)
      'llama3.2:3b': 0.25, // ~4 chars per token
      'llama3.2:1b': 0.25,
      'mistral:7b': 0.25,
      'codellama:7b': 0.3, // Code models have different tokenization
      'codellama:13b': 0.3,
      'codellama:34b': 0.3
    };

    const baseRate = tokensPerChar[this.modelName] || 0.25; // Default: ~4 chars per token
    const baseTokens = Math.ceil(text.length * baseRate);

    // Adjust for code vs natural language
    const codePatterns = /[{}();,.\[\]]/g;
    const codeMatches = text.match(codePatterns);
    const codeAdjustment = codeMatches ? codeMatches.length * 0.1 : 0;

    return Math.ceil(baseTokens + codeAdjustment);
  }

  // Check if text fits within context window
  public fitsInContextWindow(text: string, reserveTokens: number = 1000): boolean {
    const estimatedTokens = this.estimateTokenCount(text);
    const maxTokens = this.getMaxContextWindow();
    return estimatedTokens <= (maxTokens - reserveTokens);
  }

  // Create factory method for common model configurations
  public static createQwen3Agent(config: Omit<OllamaAgentConfig, 'modelName'>): OllamaAgent {
    return new OllamaAgent({
      ...config,
      modelName: 'qwen3:8b',
      embeddingModel: 'mxbai-embed-large'
    });
  }

  public static createLlama3Agent(config: Omit<OllamaAgentConfig, 'modelName'>): OllamaAgent {
    return new OllamaAgent({
      ...config,
      modelName: 'llama3.2:3b',
      embeddingModel: 'all-minilm'
    });
  }

  public static createCodeAgent(config: Omit<OllamaAgentConfig, 'modelName'>): OllamaAgent {
    return new OllamaAgent({
      ...config,
      modelName: 'qwen2.5-coder:7b',
      embeddingModel: 'mxbai-embed-large',
      capabilities: ['code_generation', 'debugging', 'programming', 'reasoning', 'analysis']
    });
  }
}

export default OllamaAgent;