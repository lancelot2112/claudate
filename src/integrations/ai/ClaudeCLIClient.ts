import { spawn } from 'child_process';
import logger from '../../utils/logger';

export interface ClaudeCLIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ClaudeCLIRequest {
  messages: ClaudeCLIMessage[];
  system?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ClaudeCLIResponse {
  content: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  model: string;
}

export interface ClaudeCLIConfig {
  timeout: number;
  maxRetries: number;
  model?: string;
}

export class ClaudeCLIClient {
  private config: ClaudeCLIConfig;
  private costTracker: Map<string, number> = new Map();

  constructor(customConfig?: Partial<ClaudeCLIConfig>) {
    this.config = {
      timeout: 60000, // 60 seconds for CLI operations
      maxRetries: 2,
      model: 'claude-3-sonnet-20240229', // Default model
      ...customConfig
    };

    logger.info('ClaudeCLI client initialized', { 
      timeout: this.config.timeout,
      model: this.config.model 
    });
  }

  public async sendMessage(request: ClaudeCLIRequest): Promise<ClaudeCLIResponse> {
    const startTime = Date.now();
    
    try {
      logger.debug('Sending message to Claude CLI', {
        messageCount: request.messages.length,
        hasSystem: !!request.system
      });

      // Prepare the prompt for Claude CLI
      const prompt = this.formatPromptForCLI(request);
      
      // Execute Claude CLI command
      const response = await this.executeCLICommand(prompt, request);
      
      const processingTime = Date.now() - startTime;
      
      // Track usage (estimate tokens based on content length)
      const estimatedInputTokens = Math.ceil(prompt.length / 4);
      const estimatedOutputTokens = Math.ceil(response.content.length / 4);
      
      this.updateCostTracker(estimatedInputTokens, estimatedOutputTokens);

      logger.info('Claude CLI response received', {
        responseLength: response.content.length,
        processingTime,
        estimatedTokens: estimatedInputTokens + estimatedOutputTokens
      });

      return {
        content: response.content,
        usage: {
          input_tokens: estimatedInputTokens,
          output_tokens: estimatedOutputTokens
        },
        model: this.config.model || 'claude-cli'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Claude CLI request failed', { 
        error: errorMessage,
        processingTime: Date.now() - startTime
      });
      throw new Error(`Claude CLI request failed: ${errorMessage}`);
    }
  }

  private formatPromptForCLI(request: ClaudeCLIRequest): string {
    let prompt = '';

    // Add system message if provided
    if (request.system) {
      prompt += `System: ${request.system}\n\n`;
    }

    // Add conversation history
    for (const message of request.messages) {
      if (message.role === 'system') {
        prompt += `System: ${message.content}\n\n`;
      } else if (message.role === 'user') {
        prompt += `Human: ${message.content}\n\n`;
      } else if (message.role === 'assistant') {
        prompt += `Assistant: ${message.content}\n\n`;
      }
    }

    // Ensure we end with a user message for CLI
    if (!prompt.trim().endsWith('Human:')) {
      prompt += 'Please provide a comprehensive response based on the above context.\n\n';
    }

    return prompt.trim();
  }

  private async executeCLICommand(prompt: string, request: ClaudeCLIRequest): Promise<{ content: string }> {
    return new Promise((resolve, reject) => {
      // Prepare CLI arguments
      const args = ['--no-input-wrap'];
      
      // Add model if specified
      if (request.max_tokens) {
        args.push('--max-tokens', request.max_tokens.toString());
      }

      if (request.temperature) {
        args.push('--temperature', request.temperature.toString());
      }

      logger.debug('Executing Claude CLI command', { args });

      // Spawn Claude CLI process
      const cliProcess = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.config.timeout
      });

      let stdout = '';
      let stderr = '';

      // Collect stdout
      cliProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      // Collect stderr
      cliProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Handle process completion
      cliProcess.on('close', (code: number | null) => {
        if (code === 0) {
          const content = this.cleanCLIResponse(stdout);
          resolve({ content });
        } else {
          const error = stderr || `Claude CLI exited with code ${code}`;
          reject(new Error(error));
        }
      });

      // Handle process errors
      cliProcess.on('error', (error: Error) => {
        logger.error('Claude CLI process error', { error: error.message });
        reject(new Error(`Failed to start Claude CLI: ${error.message}`));
      });

      // Send the prompt to stdin
      cliProcess.stdin?.write(prompt);
      cliProcess.stdin?.end();

      // Set timeout
      setTimeout(() => {
        if (!cliProcess.killed) {
          cliProcess.kill('SIGTERM');
          reject(new Error('Claude CLI request timed out'));
        }
      }, this.config.timeout);
    });
  }

  private cleanCLIResponse(rawResponse: string): string {
    // Remove any CLI-specific formatting or metadata
    let cleaned = rawResponse.trim();
    
    // Remove common CLI prefixes if present
    const prefixesToRemove = [
      /^Assistant:\s*/,
      /^Claude:\s*/,
      /^Response:\s*/
    ];

    for (const prefix of prefixesToRemove) {
      cleaned = cleaned.replace(prefix, '');
    }

    return cleaned.trim();
  }

  private updateCostTracker(inputTokens: number, outputTokens: number): void {
    const today = new Date().toISOString().split('T')[0]!;
    const currentCost = this.costTracker.get(today) || 0;
    
    // Estimate cost (these are rough estimates, actual Claude CLI usage may vary)
    const estimatedCost = (inputTokens * 0.000008) + (outputTokens * 0.000024); // Rough Claude pricing
    
    this.costTracker.set(today, currentCost + estimatedCost);
  }

  public async healthCheck(): Promise<boolean> {
    try {
      logger.debug('Performing Claude CLI health check');
      
      // Try a simple command to verify CLI availability
      const result = await this.executeCLICommand('Hello, this is a test. Please respond with "OK".', {
        messages: [{ role: 'user', content: 'Hello, this is a test. Please respond with "OK".' }]
      });

      const isHealthy = result.content.toLowerCase().includes('ok');
      
      logger.info('Claude CLI health check completed', { healthy: isHealthy });
      return isHealthy;
    } catch (error) {
      logger.error('Claude CLI health check failed', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  public getCostSummary(): Record<string, number> {
    return Object.fromEntries(this.costTracker);
  }

  public getConfig(): ClaudeCLIConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<ClaudeCLIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Claude CLI configuration updated', { newConfig });
  }
}

export default ClaudeCLIClient;