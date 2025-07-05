import { spawn } from 'child_process';
import logger from '../../utils/logger';

export interface GeminiCLIMessage {
  role: 'user' | 'model' | 'system';
  parts: { text: string }[];
}

export interface GeminiCLIRequest {
  messages: GeminiCLIMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiCLIResponse {
  content: string;
  usage?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  model: string;
}

export interface GeminiCLIConfig {
  timeout: number;
  maxRetries: number;
  model?: string;
  cliCommand?: string; // Allow custom CLI command (e.g., 'gemini', 'gcloud ai', etc.)
}

export class GeminiCLIClient {
  private config: GeminiCLIConfig;
  private costTracker: Map<string, number> = new Map();

  constructor(customConfig?: Partial<GeminiCLIConfig>) {
    this.config = {
      timeout: 60000, // 60 seconds for CLI operations
      maxRetries: 2,
      model: 'gemini-1.5-pro', // Default model
      cliCommand: 'gemini', // Default CLI command
      ...customConfig
    };

    logger.info('GeminiCLI client initialized', { 
      timeout: this.config.timeout,
      model: this.config.model,
      cliCommand: this.config.cliCommand
    });
  }

  public async sendMessage(request: GeminiCLIRequest): Promise<GeminiCLIResponse> {
    const startTime = Date.now();
    
    try {
      logger.debug('Sending message to Gemini CLI', {
        messageCount: request.messages.length,
        hasSystemInstruction: !!request.systemInstruction
      });

      // Prepare the prompt for Gemini CLI
      const prompt = this.formatPromptForCLI(request);
      
      // Execute Gemini CLI command
      const response = await this.executeCLICommand(prompt, request);
      
      const processingTime = Date.now() - startTime;
      
      // Track usage (estimate tokens based on content length)
      const estimatedInputTokens = Math.ceil(prompt.length / 4);
      const estimatedOutputTokens = Math.ceil(response.content.length / 4);
      
      this.updateCostTracker(estimatedInputTokens, estimatedOutputTokens);

      logger.info('Gemini CLI response received', {
        responseLength: response.content.length,
        processingTime,
        estimatedTokens: estimatedInputTokens + estimatedOutputTokens
      });

      return {
        content: response.content,
        usage: {
          promptTokenCount: estimatedInputTokens,
          candidatesTokenCount: estimatedOutputTokens,
          totalTokenCount: estimatedInputTokens + estimatedOutputTokens
        },
        model: this.config.model || 'gemini-cli'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Gemini CLI request failed', { 
        error: errorMessage,
        processingTime: Date.now() - startTime
      });
      throw new Error(`Gemini CLI request failed: ${errorMessage}`);
    }
  }

  private formatPromptForCLI(request: GeminiCLIRequest): string {
    let prompt = '';

    // Add system instruction if provided
    if (request.systemInstruction) {
      prompt += `System: ${request.systemInstruction}\n\n`;
    }

    // Add conversation history
    for (const message of request.messages) {
      if (message.role === 'system') {
        const text = message.parts.map(part => part.text).join(' ');
        prompt += `System: ${text}\n\n`;
      } else if (message.role === 'user') {
        const text = message.parts.map(part => part.text).join(' ');
        prompt += `Human: ${text}\n\n`;
      } else if (message.role === 'model') {
        const text = message.parts.map(part => part.text).join(' ');
        prompt += `Assistant: ${text}\n\n`;
      }
    }

    // Ensure we end with a user message for CLI
    if (!prompt.trim().includes('Human:')) {
      prompt += 'Human: Please provide a comprehensive response based on the above context.\n\n';
    }

    return prompt.trim();
  }

  private async executeCLICommand(prompt: string, request: GeminiCLIRequest): Promise<{ content: string }> {
    return new Promise((resolve, reject) => {
      // Prepare CLI arguments based on the CLI tool being used
      const args = this.prepareCLIArgs(request);
      
      logger.debug('Executing Gemini CLI command', { 
        command: this.config.cliCommand,
        args 
      });

      // Spawn Gemini CLI process
      const cliProcess = spawn(this.config.cliCommand!, args, {
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
          const error = stderr || `Gemini CLI exited with code ${code}`;
          reject(new Error(error));
        }
      });

      // Handle process errors
      cliProcess.on('error', (error: Error) => {
        logger.error('Gemini CLI process error', { error: error.message });
        reject(new Error(`Failed to start Gemini CLI: ${error.message}`));
      });

      // Send the prompt to stdin
      cliProcess.stdin?.write(prompt);
      cliProcess.stdin?.end();

      // Set timeout
      setTimeout(() => {
        if (!cliProcess.killed) {
          cliProcess.kill('SIGTERM');
          reject(new Error('Gemini CLI request timed out'));
        }
      }, this.config.timeout);
    });
  }

  private prepareCLIArgs(request: GeminiCLIRequest): string[] {
    const args: string[] = [];

    // Handle different CLI tools
    if (this.config.cliCommand === 'gemini') {
      // Standalone Gemini CLI
      if (request.temperature !== undefined) {
        args.push('--temperature', request.temperature.toString());
      }
      if (request.maxOutputTokens) {
        args.push('--max-tokens', request.maxOutputTokens.toString());
      }
      if (this.config.model) {
        args.push('--model', this.config.model);
      }
    } else if (this.config.cliCommand?.includes('gcloud')) {
      // Google Cloud AI CLI
      args.push('ai', 'models', 'generate-text');
      if (this.config.model) {
        args.push('--model', this.config.model);
      }
      if (request.temperature !== undefined) {
        args.push('--temperature', request.temperature.toString());
      }
      if (request.maxOutputTokens) {
        args.push('--max-output-tokens', request.maxOutputTokens.toString());
      }
    } else {
      // Generic CLI - try common parameters
      if (request.temperature !== undefined) {
        args.push('--temperature', request.temperature.toString());
      }
      if (request.maxOutputTokens) {
        args.push('--max-tokens', request.maxOutputTokens.toString());
      }
    }

    return args;
  }

  private cleanCLIResponse(rawResponse: string): string {
    // Remove any CLI-specific formatting or metadata
    let cleaned = rawResponse.trim();
    
    // Remove common CLI prefixes if present
    const prefixesToRemove = [
      /^Assistant:\s*/,
      /^Gemini:\s*/,
      /^Model:\s*/,
      /^Response:\s*/,
      /^Output:\s*/,
      // Remove gcloud CLI metadata
      /^Generated text:\s*/,
      /^Text:\s*/
    ];

    for (const prefix of prefixesToRemove) {
      cleaned = cleaned.replace(prefix, '');
    }

    // Remove trailing metadata (common in gcloud responses)
    const metadataPatterns = [
      /\n---\n.*$/s,
      /\nMetadata:.*$/s,
      /\nFinish reason:.*$/s
    ];

    for (const pattern of metadataPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
  }

  private updateCostTracker(inputTokens: number, outputTokens: number): void {
    const today = new Date().toISOString().split('T')[0]!;
    const currentCost = this.costTracker.get(today) || 0;
    
    // Estimate cost (rough Gemini pricing estimates)
    const estimatedCost = (inputTokens * 0.000001) + (outputTokens * 0.000002); // Very rough estimates
    
    this.costTracker.set(today, currentCost + estimatedCost);
  }

  public async healthCheck(): Promise<boolean> {
    try {
      logger.debug('Performing Gemini CLI health check');
      
      // Try a simple command to verify CLI availability
      const result = await this.executeCLICommand('Hello, this is a test. Please respond with "OK".', {
        messages: [{ role: 'user', parts: [{ text: 'Hello, this is a test. Please respond with "OK".' }] }]
      });

      const isHealthy = result.content.toLowerCase().includes('ok');
      
      logger.info('Gemini CLI health check completed', { healthy: isHealthy });
      return isHealthy;
    } catch (error) {
      logger.error('Gemini CLI health check failed', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  public getCostSummary(): Record<string, number> {
    return Object.fromEntries(this.costTracker);
  }

  public getConfig(): GeminiCLIConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<GeminiCLIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Gemini CLI configuration updated', { newConfig });
  }

  /**
   * Check which Gemini CLI tools are available
   */
  public static async detectAvailableCLI(): Promise<string[]> {
    const cliCandidates = [
      'gemini',           // Standalone Gemini CLI
      'gcloud',           // Google Cloud CLI
      'google-cloud-cli', // Alternative gcloud name
      'ai'                // AI-specific CLI
    ];

    const availableCLIs: string[] = [];

    for (const cli of cliCandidates) {
      try {
        const testProcess = spawn(cli, ['--help'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 3000
        });

        await new Promise((resolve, reject) => {
          testProcess.on('close', (code) => {
            if (code === 0 || code === 1) { // Many CLIs return 1 for help
              availableCLIs.push(cli);
            }
            resolve(code);
          });

          testProcess.on('error', () => {
            // CLI not available
            resolve(-1);
          });

          setTimeout(() => {
            if (!testProcess.killed) {
              testProcess.kill('SIGTERM');
              resolve(-1);
            }
          }, 3000);
        });
      } catch (error) {
        // CLI not available, continue checking others
        continue;
      }
    }

    logger.info('Detected Gemini CLI tools', { available: availableCLIs });
    return availableCLIs;
  }

  /**
   * Create a Gemini CLI client with auto-detected CLI tool
   */
  public static async createWithAutoDetection(config?: Partial<GeminiCLIConfig>): Promise<GeminiCLIClient | null> {
    const availableCLIs = await this.detectAvailableCLI();
    
    if (availableCLIs.length === 0) {
      logger.warn('No Gemini CLI tools detected');
      return null;
    }

    // Prefer standalone gemini CLI, then gcloud
    const preferredOrder = ['gemini', 'gcloud', 'google-cloud-cli', 'ai'];
    const selectedCLI = preferredOrder.find(cli => availableCLIs.includes(cli)) || availableCLIs[0];

    logger.info('Auto-selected Gemini CLI', { selected: selectedCLI, available: availableCLIs });

    return new GeminiCLIClient({
      cliCommand: selectedCLI,
      ...config
    });
  }
}

export default GeminiCLIClient;