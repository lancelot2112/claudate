import { BaseAgent } from '../base/Agent.js';
import { AgentContext, AgentResult, AgentConfig } from '../../types/Agent.js';
import { AnthropicClient } from '../../integrations/ai/AnthropicClient.js';
import logger from '../../utils/logger.js';
import { spawn, ChildProcess } from 'child_process';

export interface ToolExecutionTask {
  tool: string;
  parameters: Record<string, any>;
  workingDirectory?: string;
  environment?: Record<string, string>;
  timeout?: number;
  requireConfirmation?: boolean;
  safetyLevel?: 'low' | 'medium' | 'high';
}

export interface ToolExecutionResult extends AgentResult {
  output?: string;
  exitCode?: number;
  stderr?: string;
  duration?: number;
  filesCreated?: string[];
  filesModified?: string[];
  safetyAnalysis?: {
    riskLevel: 'low' | 'medium' | 'high';
    concerns: string[];
    recommendations: string[];
  };
}

export interface ToolConfig {
  name: string;
  command: string;
  allowedParameters: string[];
  safetyLevel: 'low' | 'medium' | 'high';
  requiresConfirmation: boolean;
  workingDirRestriction?: string;
  timeoutMs: number;
}

export class ToolExecutionAgent extends BaseAgent {
  private anthropicClient: AnthropicClient;
  private allowedTools: Map<string, ToolConfig> = new Map();
  private runningProcesses: Map<string, ChildProcess> = new Map();

  constructor(config: AgentConfig) {
    super({
      ...config,
      name: 'ToolExecutionAgent',
      type: 'execution',
      capabilities: [
        'command_execution',
        'file_operations',
        'build_tools',
        'test_execution',
        'deployment_tools',
        'security_scanning',
        'code_analysis'
      ]
    });

    this.anthropicClient = new AnthropicClient({
      defaultModel: 'claude-3-sonnet-20240229',
      temperature: 0.1, // Very low temperature for tool execution precision
      maxTokens: 4096
    });

    this.initializeAllowedTools();

    logger.info('ToolExecutionAgent initialized', { 
      agentId: this.id, 
      allowedTools: Array.from(this.allowedTools.keys()) 
    });
  }

  private initializeAllowedTools(): void {
    // Development Tools
    this.allowedTools.set('npm', {
      name: 'npm',
      command: 'npm',
      allowedParameters: ['install', 'run', 'test', 'build', 'start', 'dev', 'audit', 'update'],
      safetyLevel: 'medium',
      requiresConfirmation: false,
      timeoutMs: 300000 // 5 minutes
    });

    this.allowedTools.set('yarn', {
      name: 'yarn',
      command: 'yarn',
      allowedParameters: ['install', 'run', 'test', 'build', 'start', 'dev', 'audit', 'upgrade'],
      safetyLevel: 'medium',
      requiresConfirmation: false,
      timeoutMs: 300000
    });

    this.allowedTools.set('git', {
      name: 'git',
      command: 'git',
      allowedParameters: ['status', 'diff', 'log', 'branch', 'checkout', 'commit', 'push', 'pull', 'add'],
      safetyLevel: 'medium',
      requiresConfirmation: true,
      timeoutMs: 60000
    });

    // Testing Tools
    this.allowedTools.set('jest', {
      name: 'jest',
      command: 'npx jest',
      allowedParameters: ['--coverage', '--watch', '--updateSnapshot', '--verbose'],
      safetyLevel: 'low',
      requiresConfirmation: false,
      timeoutMs: 180000
    });

    this.allowedTools.set('cypress', {
      name: 'cypress',
      command: 'npx cypress',
      allowedParameters: ['run', 'open', '--headless', '--browser'],
      safetyLevel: 'low',
      requiresConfirmation: false,
      timeoutMs: 600000
    });

    // Build Tools
    this.allowedTools.set('webpack', {
      name: 'webpack',
      command: 'npx webpack',
      allowedParameters: ['--mode', '--config', '--watch', '--analyze'],
      safetyLevel: 'low',
      requiresConfirmation: false,
      timeoutMs: 300000
    });

    this.allowedTools.set('typescript', {
      name: 'typescript',
      command: 'npx tsc',
      allowedParameters: ['--noEmit', '--watch', '--build', '--listFiles'],
      safetyLevel: 'low',
      requiresConfirmation: false,
      timeoutMs: 120000
    });

    // Code Quality Tools
    this.allowedTools.set('eslint', {
      name: 'eslint',
      command: 'npx eslint',
      allowedParameters: ['--fix', '--cache', '--format', '--ext'],
      safetyLevel: 'low',
      requiresConfirmation: false,
      timeoutMs: 60000
    });

    this.allowedTools.set('prettier', {
      name: 'prettier',
      command: 'npx prettier',
      allowedParameters: ['--write', '--check', '--config'],
      safetyLevel: 'low',
      requiresConfirmation: false,
      timeoutMs: 30000
    });

    // Security Tools
    this.allowedTools.set('audit', {
      name: 'audit',
      command: 'npm audit',
      allowedParameters: ['fix', '--force', '--audit-level'],
      safetyLevel: 'high',
      requiresConfirmation: true,
      timeoutMs: 120000
    });
  }

  public async executeTask(context: AgentContext): Promise<ToolExecutionResult> {
    try {
      this.updateStatus('processing');
      
      const task = this.parseTask(context);
      logger.info('ToolExecutionAgent executing task', { 
        agentId: this.id, 
        tool: task.tool,
        safetyLevel: task.safetyLevel 
      });

      // Safety analysis first
      const safetyAnalysis = await this.analyzeSafety(task);
      
      if (safetyAnalysis.riskLevel === 'high' && !task.requireConfirmation) {
        return {
          success: false,
          error: 'High-risk operation requires explicit confirmation',
          agentId: this.id,
          timestamp: Date.now(),
          safetyAnalysis
        };
      }

      // Validate tool and parameters
      const validationResult = this.validateTool(task);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
          agentId: this.id,
          timestamp: Date.now(),
          safetyAnalysis
        };
      }

      // Execute the tool
      const result = await this.executeTool(task);

      this.updateStatus('completed');
      this.updateMetrics({
        tool: task.tool,
        duration: result.duration,
        exitCode: result.exitCode
      });

      return {
        ...result,
        success: result.exitCode === 0,
        agentId: this.id,
        timestamp: Date.now(),
        safetyAnalysis
      };
    } catch (error) {
      this.updateStatus('failed');
      logger.error('ToolExecutionAgent task failed', { 
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

  private parseTask(context: AgentContext): ToolExecutionTask {
    const { task } = context;
    
    if (typeof task === 'object' && task !== null) {
      return task as ToolExecutionTask;
    }

    throw new Error('Invalid tool execution task format');
  }

  private async analyzeSafety(task: ToolExecutionTask): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    concerns: string[];
    recommendations: string[];
  }> {
    // Send analysis prompt for safety assessment
    const response = await this.anthropicClient.sendToolExecutionRequest(
      task.tool,
      task.parameters,
      'Safety analysis for tool execution'
    );

    const content = response.content.toLowerCase();
    
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (content.includes('risk level: low') || content.includes('low risk')) {
      riskLevel = 'low';
    } else if (content.includes('risk level: high') || content.includes('high risk')) {
      riskLevel = 'high';
    }

    const concernsMatch = response.content.match(/(?:concerns|risks):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const concerns = concernsMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.trim().replace(/^[-•]\s*/, '')) || [];

    const recommendationsMatch = response.content.match(/(?:recommendations|suggestions):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const recommendations = recommendationsMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.trim().replace(/^[-•]\s*/, '')) || [];

    return {
      riskLevel,
      concerns,
      recommendations
    };
  }

  private validateTool(task: ToolExecutionTask): { valid: boolean; error?: string } {
    const toolConfig = this.allowedTools.get(task.tool);
    
    if (!toolConfig) {
      return {
        valid: false,
        error: `Tool '${task.tool}' is not allowed or not configured`
      };
    }

    // Check parameters
    const requestedParams = Object.keys(task.parameters);
    const invalidParams = requestedParams.filter(param => 
      !toolConfig.allowedParameters.includes(param)
    );

    if (invalidParams.length > 0) {
      return {
        valid: false,
        error: `Invalid parameters for ${task.tool}: ${invalidParams.join(', ')}`
      };
    }

    // Check working directory restrictions
    if (toolConfig.workingDirRestriction && task.workingDirectory) {
      if (!task.workingDirectory.startsWith(toolConfig.workingDirRestriction)) {
        return {
          valid: false,
          error: `Working directory must be within ${toolConfig.workingDirRestriction}`
        };
      }
    }

    return { valid: true };
  }

  private async executeTool(task: ToolExecutionTask): Promise<ToolExecutionResult> {
    const toolConfig = this.allowedTools.get(task.tool)!;
    const startTime = Date.now();
    
    // Build command
    const args = this.buildCommandArgs(task);
    const processId = `${this.id}-${Date.now()}`;

    return new Promise((resolve, reject) => {
      const commandParts = toolConfig.command.split(' ');
      const command = commandParts[0];
      if (!command) {
        reject(new Error('Invalid command configuration'));
        return;
      }

      const childProcess = spawn(command, [
        ...commandParts.slice(1),
        ...args
      ], {
        cwd: task.workingDirectory || process.cwd(),
        env: { ...process.env, ...task.environment },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.runningProcesses.set(processId, childProcess);

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      // Set timeout
      const timeout = setTimeout(() => {
        childProcess.kill('SIGTERM');
        reject(new Error(`Tool execution timed out after ${toolConfig.timeoutMs}ms`));
      }, task.timeout || toolConfig.timeoutMs);

      childProcess.on('close', (code: number | null) => {
        clearTimeout(timeout);
        this.runningProcesses.delete(processId);
        
        const duration = Date.now() - startTime;
        
        resolve({
          output: stdout,
          stderr,
          exitCode: code || 0,
          duration,
          success: code === 0,
          agentId: this.id,
          timestamp: Date.now()
        });
      });

      childProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        this.runningProcesses.delete(processId);
        reject(error);
      });
    });
  }

  private buildCommandArgs(task: ToolExecutionTask): string[] {
    const args: string[] = [];
    
    for (const [key, value] of Object.entries(task.parameters)) {
      if (typeof value === 'boolean' && value) {
        args.push(`--${key}`);
      } else if (typeof value === 'string' || typeof value === 'number') {
        args.push(`--${key}`, value.toString());
      } else if (Array.isArray(value)) {
        value.forEach(v => {
          args.push(`--${key}`, v.toString());
        });
      }
    }

    return args;
  }

  public async executeCommand(
    command: string,
    args: string[] = [],
    options: {
      workingDirectory?: string;
      timeout?: number;
      environment?: Record<string, string>;
    } = {}
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const processId = `${this.id}-${Date.now()}`;

    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        cwd: options.workingDirectory || process.cwd(),
        env: { ...process.env, ...options.environment },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.runningProcesses.set(processId, childProcess);

      let stdout = '';
      let stderr = '';

      childProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      childProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        childProcess.kill('SIGTERM');
        reject(new Error(`Command execution timed out after ${options.timeout || 30000}ms`));
      }, options.timeout || 30000);

      childProcess.on('close', (code) => {
        clearTimeout(timeout);
        this.runningProcesses.delete(processId);
        
        const duration = Date.now() - startTime;
        
        resolve({
          output: stdout,
          stderr,
          exitCode: code || 0,
          duration,
          success: code === 0,
          agentId: this.id,
          timestamp: Date.now()
        });
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        this.runningProcesses.delete(processId);
        reject(error);
      });
    });
  }

  public async stopAllProcesses(): Promise<void> {
    for (const [processId, childProcess] of this.runningProcesses) {
      try {
        childProcess.kill('SIGTERM');
        logger.info('Stopped running process', { processId, agentId: this.id });
      } catch (error) {
        logger.error('Failed to stop process', { 
          processId, 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }
    this.runningProcesses.clear();
  }

  public getRunningProcesses(): string[] {
    return Array.from(this.runningProcesses.keys());
  }

  public async getCapabilities(): Promise<string[]> {
    return [
      'Execute npm/yarn commands',
      'Run git operations',
      'Execute testing frameworks (Jest, Cypress)',
      'Run build tools (Webpack, TypeScript)',
      'Execute code quality tools (ESLint, Prettier)',
      'Run security audits',
      'Execute deployment scripts',
      'Run database migrations',
      'Execute custom development scripts',
      'Monitor process execution'
    ];
  }

  public override async shutdown(): Promise<void> {
    await this.stopAllProcesses();
    await super.shutdown();
  }
}

export default ToolExecutionAgent;