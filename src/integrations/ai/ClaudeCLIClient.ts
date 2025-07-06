import { spawn } from 'child_process';
// import logger from '../../utils/logger'; // Temporarily disabled to debug

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
      model: 'sonnet', // Default model (Claude CLI alias for latest)
      ...customConfig
    };

    console.log('ClaudeCLI client initialized', { 
      timeout: this.config.timeout,
      model: this.config.model 
    });
  }

  public async sendMessage(request: ClaudeCLIRequest): Promise<ClaudeCLIResponse> {
    const startTime = Date.now();
    
    try {
      // logger.debug('Sending message to Claude CLI', {
      //   messageCount: request.messages.length,
      //   hasSystem: !!request.system
      // });

      // Prepare the prompt for Claude CLI
      const prompt = this.formatPromptForCLI(request);
      
      // Execute Claude CLI command
      const response = await this.executeCLICommand(prompt, request);
      
      const processingTime = Date.now() - startTime;
      
      // Track usage (estimate tokens based on content length)
      const estimatedInputTokens = Math.ceil(prompt.length / 4);
      const estimatedOutputTokens = Math.ceil(response.content.length / 4);
      
      this.updateCostTracker(estimatedInputTokens, estimatedOutputTokens);

      console.log('Claude CLI response received', {
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
      console.error('Claude CLI request failed', { 
        error: errorMessage,
        processingTime: Date.now() - startTime
      });
      throw new Error(`Claude CLI request failed: ${errorMessage}`);
    }
  }

  private formatPromptForCLI(request: ClaudeCLIRequest): string {
    // For Claude CLI, we only need the user's message content
    // The CLI handles system instructions and conversation formatting internally
    
    // Find the user message (should be the main content)
    const userMessage = request.messages.find(msg => msg.role === 'user');
    if (userMessage) {
      return userMessage.content;
    }
    
    // Fallback: combine all messages as simple text
    return request.messages.map(msg => msg.content).join('\n\n');
  }

  private async executeCLICommand(prompt: string, request: ClaudeCLIRequest): Promise<{ content: string }> {
    // Use the exact working implementation from our test
    return new Promise((resolve, reject) => {
      const args = ['--print', '--output-format', 'json'];
      if (this.config.model) {
        args.push('--model', this.config.model);
      }
      
      const cliProcess = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: process.cwd(),
        env: process.env
      });

      let stdout = '';
      let stderr = '';

      const timeoutId = setTimeout(() => {
        if (!cliProcess.killed) {
          cliProcess.kill('SIGTERM');
          reject(new Error('Claude CLI request timed out'));
        }
      }, this.config.timeout);

      cliProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      cliProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      cliProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        if (code === 0) {
          const content = this.cleanCLIResponse(stdout);
          resolve({ content });
        } else {
          const error = stderr || `Claude CLI exited with code ${code}`;
          reject(new Error(error));
        }
      });

      cliProcess.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(new Error(`Failed to start Claude CLI: ${error.message}`));
      });

      cliProcess.on('spawn', () => {
        cliProcess.stdin?.write(prompt);
        cliProcess.stdin?.end();
      });
    });
  }

  private cleanCLIResponse(rawResponse: string): string {
    try {
      // Parse JSON response from Claude CLI
      const jsonResponse = JSON.parse(rawResponse.trim());
      
      // Extract the result from the JSON response
      if (jsonResponse.result) {
        return jsonResponse.result;
      } else if (jsonResponse.content) {
        return jsonResponse.content;
      } else {
        // Fallback to raw response if JSON structure is unexpected
        return rawResponse.trim();
      }
    } catch (error) {
      console.warn('Failed to parse Claude CLI JSON response, using raw text', { 
        error: error instanceof Error ? error.message : String(error),
        rawResponse: rawResponse.substring(0, 200) 
      });
      
      // Fallback to text processing if JSON parsing fails
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

  public async healthCheck(): Promise<boolean> {
    try {
      console.log('Performing Claude CLI health check');
      
      // Try a simple command to verify CLI availability
      const result = await this.executeCLICommand('Hello, this is a test. Please respond with "OK".', {
        messages: [{ role: 'user', content: 'Hello, this is a test. Please respond with "OK".' }]
      });

      const isHealthy = result.content.toLowerCase().includes('ok');
      
      console.log('Claude CLI health check completed', { healthy: isHealthy });
      return isHealthy;
    } catch (error) {
      console.error('Claude CLI health check failed', { 
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
    console.log('Claude CLI configuration updated', { newConfig });
  }
}

export default ClaudeCLIClient;