import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentConfig, AgentContext, AgentResult } from '../../types/Agent';
import { AgentType } from '../../types/common';

export abstract class BaseAgent extends EventEmitter {
  public readonly id: string;
  public readonly name: string;
  public readonly type: AgentType;
  protected capabilities: string[];
  protected status: 'idle' | 'processing' | 'failed' | 'completed' = 'idle';

  constructor(config: AgentConfig) {
    super();
    this.id = uuidv4();
    this.name = config.name;
    this.type = config.type;
    this.capabilities = config.capabilities || [];
  }

  // Abstract method that must be implemented by subclasses
  public abstract executeTask(context: AgentContext): Promise<AgentResult>;

  // Abstract method for getting agent capabilities
  public abstract getCapabilities(): Promise<string[]>;

  // Update agent status
  protected updateStatus(status: 'idle' | 'processing' | 'failed' | 'completed'): void {
    this.status = status;
    this.emit('status-changed', status);
  }

  // Update metrics (simplified)
  protected updateMetrics(metrics: Record<string, any>): void {
    this.emit('metrics-updated', metrics);
  }

  // Initialize agent (can be overridden)
  public async initialize(): Promise<void> {
    this.updateStatus('idle');
  }

  // Shutdown agent (can be overridden)
  public async shutdown(): Promise<void> {
    this.updateStatus('idle');
    this.removeAllListeners();
  }

  // Get current status
  public getStatus(): string {
    return this.status;
  }
}

export default BaseAgent;