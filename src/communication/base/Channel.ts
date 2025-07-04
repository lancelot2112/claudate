import { EventEmitter } from 'events';
import { 
  IChannelProvider, 
  ChannelMessage, 
  MessageDeliveryResult, 
  ChannelCapability, 
  DeliveryStatus,
  ChannelConfig,
  RetryPolicy
} from '@/types/Communication';
import { communicationLogger, logCommunicationEvent } from '@/utils/logger';

export abstract class BaseChannel extends EventEmitter implements IChannelProvider {
  protected config: ChannelConfig;
  protected isInitialized = false;
  protected retryQueue: Map<string, { message: ChannelMessage; attempt: number }> = new Map();
  protected rateLimitTracker: Map<string, number[]> = new Map();

  constructor(
    public readonly id: string,
    public readonly name: string,
    config: ChannelConfig
  ) {
    super();
    this.config = config;
    this.setupRetryScheduler();
  }

  abstract getCapabilities(): ChannelCapability[];
  protected abstract doSendMessage(message: ChannelMessage): Promise<MessageDeliveryResult>;
  protected abstract doReceiveMessage(): Promise<ChannelMessage | null>;
  protected abstract doInitialize(): Promise<void>;
  protected abstract doShutdown(): Promise<void>;

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logCommunicationEvent(this.id, 'initialize', { channel: this.name });
      await this.doInitialize();
      this.isInitialized = true;
      
      communicationLogger.info(`Channel ${this.name} initialized successfully`, {
        channelId: this.id,
        capabilities: this.getCapabilities(),
      });
    } catch (error) {
      communicationLogger.error(`Failed to initialize channel ${this.name}`, {
        channelId: this.id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      logCommunicationEvent(this.id, 'shutdown', { channel: this.name });
      await this.doShutdown();
      this.isInitialized = false;
      
      communicationLogger.info(`Channel ${this.name} shutdown successfully`, {
        channelId: this.id,
      });
    } catch (error) {
      communicationLogger.error(`Failed to shutdown channel ${this.name}`, {
        channelId: this.id,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  public async sendMessage(message: ChannelMessage): Promise<MessageDeliveryResult> {
    if (!this.isInitialized) {
      throw new Error(`Channel ${this.name} is not initialized`);
    }

    if (!this.config.enabled) {
      return {
        success: false,
        messageId: message.id,
        deliveryStatus: 'failed',
        error: 'Channel is disabled',
      };
    }

    // Check rate limits
    const rateLimitResult = this.checkRateLimit();
    if (!rateLimitResult.allowed) {
      return {
        success: false,
        messageId: message.id,
        deliveryStatus: 'failed',
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
      };
    }

    try {
      logCommunicationEvent(this.id, 'sendMessage', {
        messageId: message.id,
        channel: message.channel,
        urgency: message.urgency,
        type: message.type,
      });

      const result = await this.doSendMessage(message);
      
      // Update rate limit tracker
      this.updateRateLimitTracker();
      
      // Handle delivery result
      if (result.success) {
        this.emit('messageDelivered', message.id, result);
        communicationLogger.info(`Message delivered successfully`, {
          channelId: this.id,
          messageId: message.id,
          deliveryStatus: result.deliveryStatus,
        });
      } else {
        this.emit('messageDeliveryFailed', message.id, result);
        
        // Check if we should retry
        if (this.shouldRetry(result, message)) {
          await this.scheduleRetry(message);
        }
      }

      return result;
    } catch (error) {
      const errorResult: MessageDeliveryResult = {
        success: false,
        messageId: message.id,
        deliveryStatus: 'failed',
        error: (error as Error).message,
      };

      this.emit('messageDeliveryFailed', message.id, errorResult);
      
      communicationLogger.error(`Message delivery failed`, {
        channelId: this.id,
        messageId: message.id,
        error: (error as Error).message,
      });

      return errorResult;
    }
  }

  public async receiveMessage(): Promise<ChannelMessage | null> {
    if (!this.isInitialized) {
      throw new Error(`Channel ${this.name} is not initialized`);
    }

    try {
      const message = await this.doReceiveMessage();
      
      if (message) {
        logCommunicationEvent(this.id, 'receiveMessage', {
          messageId: message.id,
          channel: message.channel,
          type: message.type,
        });

        this.emit('messageReceived', message);
        
        if (this.onMessageReceived) {
          await this.onMessageReceived(message);
        }
      }

      return message;
    } catch (error) {
      communicationLogger.error(`Failed to receive message`, {
        channelId: this.id,
        error: (error as Error).message,
      });
      
      if (this.onError) {
        await this.onError(error as Error);
      }
      
      throw error;
    }
  }

  public async isHealthy(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Basic health check - can be overridden by subclasses
      return this.config.enabled && this.isInitialized;
    } catch (error) {
      communicationLogger.error(`Health check failed for channel ${this.name}`, {
        channelId: this.id,
        error: (error as Error).message,
      });
      return false;
    }
  }

  // Event handlers (can be overridden)
  public onMessageReceived?: (message: ChannelMessage) => Promise<void>;
  public onDeliveryStatusUpdate?: (messageId: string, status: DeliveryStatus) => Promise<void>;
  public onError?: (error: Error) => Promise<void>;

  // Rate limiting
  private checkRateLimit(): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    const timestamps = this.rateLimitTracker.get(this.id) || [];
    
    // Clean old timestamps
    const recentTimestamps = timestamps.filter(ts => now - ts < day);
    
    const recentMinute = recentTimestamps.filter(ts => now - ts < minute).length;
    const recentHour = recentTimestamps.filter(ts => now - ts < hour).length;
    const recentDay = recentTimestamps.length;

    const limits = this.config.retryPolicy;
    
    if (recentMinute >= limits.maxAttempts) {
      return { allowed: false, retryAfter: minute };
    }
    if (recentHour >= (limits.maxAttempts * 60)) {
      return { allowed: false, retryAfter: hour };
    }
    if (recentDay >= (limits.maxAttempts * 60 * 24)) {
      return { allowed: false, retryAfter: day };
    }

    return { allowed: true };
  }

  private updateRateLimitTracker(): void {
    const now = Date.now();
    const timestamps = this.rateLimitTracker.get(this.id) || [];
    timestamps.push(now);
    
    // Keep only last 24 hours
    const dayAgo = now - (24 * 60 * 60 * 1000);
    const filteredTimestamps = timestamps.filter(ts => ts > dayAgo);
    
    this.rateLimitTracker.set(this.id, filteredTimestamps);
  }

  // Retry logic
  private shouldRetry(result: MessageDeliveryResult, message: ChannelMessage): boolean {
    if (!result.error) {
      return false;
    }

    const currentAttempts = message.deliveryAttempts || 0;
    const maxAttempts = this.config.retryPolicy.maxAttempts;
    
    return currentAttempts < maxAttempts &&
           this.config.retryPolicy.retryOnStatuses.includes(result.deliveryStatus);
  }

  private async scheduleRetry(message: ChannelMessage): Promise<void> {
    const attempts = (message.deliveryAttempts || 0) + 1;
    const delay = this.calculateRetryDelay(attempts);
    
    message.deliveryAttempts = attempts;
    message.lastDeliveryAttempt = new Date();
    
    this.retryQueue.set(message.id, { message, attempt: attempts });
    
    setTimeout(async () => {
      const queuedMessage = this.retryQueue.get(message.id);
      if (queuedMessage) {
        this.retryQueue.delete(message.id);
        await this.sendMessage(queuedMessage.message);
      }
    }, delay);

    communicationLogger.info(`Scheduled retry for message`, {
      channelId: this.id,
      messageId: message.id,
      attempt: attempts,
      delay,
    });
  }

  private calculateRetryDelay(attempt: number): number {
    const { initialDelay, maxDelay, backoffMultiplier } = this.config.retryPolicy;
    const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);
    return Math.min(delay, maxDelay);
  }

  private setupRetryScheduler(): void {
    // Clean up old retry queue entries every minute
    setInterval(() => {
      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      for (const [messageId, queueEntry] of this.retryQueue.entries()) {
        const age = now - (queueEntry.message.lastDeliveryAttempt?.getTime() || 0);
        if (age > maxAge) {
          this.retryQueue.delete(messageId);
          communicationLogger.warn(`Removed expired retry queue entry`, {
            channelId: this.id,
            messageId,
            age,
          });
        }
      }
    }, 60000); // 1 minute
  }

  // Utility methods
  protected formatMessage(message: ChannelMessage): string {
    const preferences = this.config.formatPreferences;
    let content = message.content;

    // Apply mobile optimization if enabled
    if (preferences.mobileOptimized) {
      content = this.applyMobileOptimization(content);
    }

    // Apply length limits
    if (content.length > preferences.maxLength) {
      content = content.substring(0, preferences.maxLength - 3) + '...';
    }

    return content;
  }

  private applyMobileOptimization(content: string): string {
    // Simple mobile optimization - can be enhanced
    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  protected buildMetadata(message: ChannelMessage): Record<string, any> {
    return {
      channelId: this.id,
      channelName: this.name,
      messageId: message.id,
      timestamp: new Date().toISOString(),
      urgency: message.urgency,
      type: message.type,
    };
  }
}