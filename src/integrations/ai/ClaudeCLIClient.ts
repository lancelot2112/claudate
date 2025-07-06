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
    // For Claude CLI, we just need the user message content
    // The CLI handles the conversation format internally
    
    if (request.messages.length === 0) {
      return '';
    }

    // Get the last user message
    const lastUserMessage = request.messages
      .filter(msg => msg.role === 'user')
      .pop();

    if (!lastUserMessage) {
      return '';
    }

    // For simple prompts, just return the content
    return lastUserMessage.content;
  }

  private async executeCLICommand(prompt: string, request: ClaudeCLIRequest): Promise<{ content: string }> {
    return new Promise((resolve, reject) => {
      // Use --print for non-interactive output and JSON format
      const args = ['--print', '--output-format', 'json', prompt];
      
      // Note: Claude CLI doesn't support max_tokens or temperature via command line
      // These parameters are ignored for CLI execution
      
      logger.error('Executing Claude CLI command', { 
        args, 
        prompt: prompt.substring(0, 100),
        fullCommand: `claude ${args.join(' ')}`
      });

      // Spawn Claude CLI process
      const cliProcess = spawn('claude', args, {
        stdio: ['ignore', 'pipe', 'pipe'], // ignore stdin, pipe stdout/stderr
        timeout: this.config.timeout,
        env: process.env // Pass environment variables
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
        logger.error('Claude CLI process closed', { code, stdout: stdout.substring(0, 500), stderr: stderr.substring(0, 500) });
        
        if (code === 0) {
          const content = this.cleanCLIResponse(stdout);
          resolve({ content });
        } else {
          const error = stderr || `Claude CLI exited with code ${code}`;
          logger.error('Claude CLI process failed', { code, stderr, stdout: stdout.substring(0, 200) });
          reject(new Error(error));
        }
      });

      // Handle process errors
      cliProcess.on('error', (error: Error) => {
        logger.error('Claude CLI process error', { error: error.message });
        reject(new Error(`Failed to start Claude CLI: ${error.message}`));
      });

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
    try {
      // Parse JSON response from Claude CLI
      const jsonResponse = JSON.parse(rawResponse.trim());
      
      // Extract the actual content from the JSON response
      if (jsonResponse.result) {
        return jsonResponse.result;
      } else if (jsonResponse.content) {
        return jsonResponse.content;
      } else {
        return rawResponse.trim();
      }
    } catch (error) {
      // Fallback to original text cleaning if JSON parsing fails
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
  }

  private updateCostTracker(inputTokens: number, outputTokens: number): void {
    const today = new Date().toISOString().split('T')[0]!;
    const currentCost = this.costTracker.get(today) || 0;
    
    // Estimate cost (these are rough estimates, actual Claude CLI usage may vary)
    const estimatedCost = (inputTokens * 0.000008) + (outputTokens * 0.000024); // Rough Claude pricing
    
    this.costTracker.set(today, currentCost + estimatedCost);
  }

  public async sendCodingRequest(request: ClaudeCLIRequest): Promise<ClaudeCLIResponse> {
    // For coding requests, we can add specific system prompts or handling
    const codingRequest = {
      ...request,
      system: request.system || 'You are a helpful coding assistant. Provide clear, well-commented code examples.'
    };
    
    return this.sendMessage(codingRequest);
  }

  public async healthCheck(): Promise<boolean> {
    try {
      logger.debug('Performing Claude CLI health check');
      
      // Simplified health check with a very basic prompt
      const result = await this.executeCLICommand('Say OK', {
        messages: [{ role: 'user', content: 'Say OK' }]
      });

      logger.debug('Health check raw result', { content: result.content });
      const isHealthy = result.content.toLowerCase().includes('ok');
      
      logger.info('Claude CLI health check completed', { healthy: isHealthy, content: result.content });
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