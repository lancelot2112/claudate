import { EventEmitter } from 'events';
import { 
  ChannelRouter, 
  CommunicationChannel, 
  ChannelMessage, 
  MessageDeliveryResult, 
  CommunicationPreference,
  DeliveryStatus,
  BulkMessageJob
} from '@/types/Communication';
import { BaseMessage } from '@/types/common';
import { IChannelProvider } from '@/types/Communication';
import { communicationLogger, logCommunication } from '@/utils/logger';

export class CommunicationRouter extends EventEmitter implements ChannelRouter {
  private channels: Map<string, IChannelProvider> = new Map();
  private channelConfigs: Map<string, CommunicationChannel> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.setupHealthChecks();
  }

  public async initialize(): Promise<void> {
    communicationLogger.info('Initializing Communication Router');
    
    // Initialize health checks
    this.startHealthChecks();
    
    communicationLogger.info('Communication Router initialized successfully');
  }

  public async shutdown(): Promise<void> {
    communicationLogger.info('Shutting down Communication Router');
    
    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Shutdown all channels
    for (const [channelId, channel] of this.channels.entries()) {
      try {
        await channel.shutdown();
        communicationLogger.info(`Channel ${channelId} shutdown successfully`);
      } catch (error) {
        communicationLogger.error(`Failed to shutdown channel ${channelId}`, {
          error: (error as Error).message,
        });
      }
    }
    
    this.channels.clear();
    this.channelConfigs.clear();
    
    communicationLogger.info('Communication Router shutdown complete');
  }

  public async registerChannel(channel: IChannelProvider, config: CommunicationChannel): Promise<void> {
    const channelId = config.id;
    
    try {
      // Initialize the channel
      await channel.initialize();
      
      // Store channel and config
      this.channels.set(channelId, channel);
      this.channelConfigs.set(channelId, config);
      
      // Set up event handlers
      this.setupChannelEventHandlers(channelId, channel);
      
      communicationLogger.info(`Channel registered successfully`, {
        channelId,
        channelName: config.name,
        capabilities: config.capabilities,
      });
      
      this.emit('channelRegistered', channelId, config);
    } catch (error) {
      communicationLogger.error(`Failed to register channel ${channelId}`, {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  public async unregisterChannel(channelId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    
    if (channel) {
      try {
        await channel.shutdown();
        this.channels.delete(channelId);
        this.channelConfigs.delete(channelId);
        
        communicationLogger.info(`Channel unregistered successfully`, { channelId });
        this.emit('channelUnregistered', channelId);
      } catch (error) {
        communicationLogger.error(`Failed to unregister channel ${channelId}`, {
          error: (error as Error).message,
        });
        throw error;
      }
    }
  }

  public async selectChannel(
    message: BaseMessage,
    preferences: CommunicationPreference[],
    availableChannels?: CommunicationChannel[]
  ): Promise<CommunicationChannel | null> {
    const channels = availableChannels || Array.from(this.channelConfigs.values());
    
    // Filter channels based on preferences and message requirements
    const suitableChannels = channels.filter(channel => {
      // Check if channel is active
      if (!channel.isActive) {
        return false;
      }
      
      // Check if channel supports the message urgency
      const matchingPreference = preferences.find(pref => pref.channel === channel.id);
      if (matchingPreference && !matchingPreference.urgency.includes(message.urgency)) {
        return false;
      }
      
      // Check if channel has required capabilities
      if (message.type === 'media' && !channel.capabilities.includes('media_messaging')) {
        return false;
      }
      
      // Check time windows
      if (matchingPreference && !this.isWithinTimeWindow(matchingPreference)) {
        return false;
      }
      
      return true;
    });

    if (suitableChannels.length === 0) {
      communicationLogger.warn('No suitable channels found for message', {
        messageId: message.id,
        urgency: message.urgency,
        type: message.type,
      });
      return null;
    }

    // Select the best channel based on priority and urgency
    const selectedChannel = this.selectBestChannel(suitableChannels, message, preferences);
    
    communicationLogger.info('Channel selected for message', {
      messageId: message.id,
      selectedChannel: selectedChannel?.id,
      availableChannels: suitableChannels.map(c => c.id),
    });
    
    return selectedChannel;
  }

  public async routeMessage(
    message: ChannelMessage,
    targetChannel?: CommunicationChannel
  ): Promise<MessageDeliveryResult> {
    try {
      let channel: CommunicationChannel | null = targetChannel || null;
      
      // If no target channel specified, select one
      if (!channel) {
        const preferences = await this.getUserPreferences(message.metadata?.userId);
        channel = await this.selectChannel(message, preferences);
      }
      
      if (!channel) {
        return {
          success: false,
          messageId: message.id,
          deliveryStatus: 'failed',
          error: 'No suitable channel found',
        };
      }

      // Get the channel provider
      const channelProvider = this.channels.get(channel.id);
      if (!channelProvider) {
        return {
          success: false,
          messageId: message.id,
          deliveryStatus: 'failed',
          error: `Channel provider not found: ${channel.id}`,
        };
      }

      // Update message with channel info
      message.channel = channel.id;
      message.channelSpecificData = {
        ...message.channelSpecificData,
        targetChannel: channel.id,
        routedAt: new Date(),
      };

      logCommunication('router', 'routeMessage', {
        messageId: message.id,
        targetChannel: channel.id,
        urgency: message.urgency,
      });

      // Send the message
      const result = await channelProvider.sendMessage(message);
      
      // Log the result
      if (result.success) {
        communicationLogger.info('Message routed successfully', {
          messageId: message.id,
          channelId: channel.id,
          deliveryStatus: result.deliveryStatus,
        });
      } else {
        communicationLogger.error('Message routing failed', {
          messageId: message.id,
          channelId: channel.id,
          error: result.error,
        });
      }

      this.emit('messageRouted', message.id, channel.id, result);
      
      return result;
    } catch (error) {
      const errorResult: MessageDeliveryResult = {
        success: false,
        messageId: message.id,
        deliveryStatus: 'failed',
        error: (error as Error).message,
      };

      communicationLogger.error('Message routing error', {
        messageId: message.id,
        error: (error as Error).message,
      });

      this.emit('routingError', message.id, error);
      
      return errorResult;
    }
  }

  public async handleDeliveryFailure(
    message: ChannelMessage,
    failure: MessageDeliveryResult
  ): Promise<MessageDeliveryResult> {
    communicationLogger.warn('Handling delivery failure', {
      messageId: message.id,
      originalChannel: message.channel,
      error: failure.error,
    });

    // Try to find an alternative channel
    const preferences = await this.getUserPreferences(message.metadata?.userId);
    const availableChannels = Array.from(this.channelConfigs.values())
      .filter(channel => channel.id !== message.channel && channel.isActive);

    const alternativeChannel = await this.selectChannel(message, preferences, availableChannels);
    
    if (alternativeChannel) {
      communicationLogger.info('Attempting delivery via alternative channel', {
        messageId: message.id,
        originalChannel: message.channel,
        alternativeChannel: alternativeChannel.id,
      });

      // Clear previous delivery attempts for new channel
      const retryMessage = { ...message };
      retryMessage.deliveryAttempts = 0;
      retryMessage.lastDeliveryAttempt = undefined;
      
      const result = await this.routeMessage(retryMessage, alternativeChannel);
      
      if (result.success) {
        this.emit('alternativeDeliverySuccess', message.id, alternativeChannel.id);
      }
      
      return result;
    }

    // No alternative channel found
    communicationLogger.error('No alternative channel available for failed message', {
      messageId: message.id,
      originalChannel: message.channel,
    });

    this.emit('deliveryFailed', message.id, failure);
    
    return failure;
  }

  // Bulk message processing
  public async processBulkMessages(job: BulkMessageJob): Promise<void> {
    communicationLogger.info('Processing bulk message job', {
      jobId: job.id,
      messageCount: job.messages.length,
      targetChannels: job.targetChannels,
    });

    job.status = 'processing';
    job.progress = {
      total: job.messages.length,
      sent: 0,
      failed: 0,
    };

    this.emit('bulkJobStarted', job.id);

    for (const message of job.messages) {
      try {
        // Select target channel if not specified
        let targetChannel: CommunicationChannel | null = null;
        
        if (job.targetChannels.length === 1 && job.targetChannels[0]) {
          targetChannel = this.channelConfigs.get(job.targetChannels[0]) || null;
        } else {
          const preferences = await this.getUserPreferences(message.metadata?.userId);
          const availableChannels = Array.from(this.channelConfigs.values())
            .filter(channel => job.targetChannels.includes(channel.id));
          targetChannel = await this.selectChannel(message, preferences, availableChannels);
        }

        if (targetChannel) {
          const result = await this.routeMessage(message, targetChannel);
          
          if (result.success) {
            job.progress!.sent++;
          } else {
            job.progress!.failed++;
          }
        } else {
          job.progress!.failed++;
        }
        
        // Emit progress update
        this.emit('bulkJobProgress', job.id, job.progress);
        
      } catch (error) {
        job.progress!.failed++;
        communicationLogger.error('Bulk message processing error', {
          jobId: job.id,
          messageId: message.id,
          error: (error as Error).message,
        });
      }
    }

    job.status = 'completed';
    
    communicationLogger.info('Bulk message job completed', {
      jobId: job.id,
      sent: job.progress!.sent,
      failed: job.progress!.failed,
    });

    this.emit('bulkJobCompleted', job.id, job.progress);
  }

  // Helper methods
  private selectBestChannel(
    channels: CommunicationChannel[],
    message: BaseMessage,
    preferences: CommunicationPreference[]
  ): CommunicationChannel {
    // Score channels based on various factors
    const scoredChannels = channels.map(channel => {
      let score = 0;
      
      // Priority from preferences
      const preference = preferences.find(pref => pref.channel === channel.id);
      if (preference) {
        score += 10;
      }
      
      // Urgency matching
      if (message.urgency === 'critical') {
        if (channel.capabilities.includes('real_time')) {
          score += 5;
        }
      }
      
      // Media support
      if (message.type === 'media' && channel.capabilities.includes('media_messaging')) {
        score += 3;
      }
      
      // Rate limit availability (simplified)
      if (channel.rateLimits.maxPerMinute > 10) {
        score += 2;
      }
      
      return { channel, score };
    });

    // Sort by score and return the best one
    scoredChannels.sort((a, b) => b.score - a.score);
    return scoredChannels[0]?.channel || channels[0];
  }

  private isWithinTimeWindow(preference: CommunicationPreference): boolean {
    if (!preference.timeWindows || preference.timeWindows.length === 0) {
      return true;
    }

    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    return preference.timeWindows.some(window => {
      // Check day of week if specified
      if (window.days && window.days.length > 0) {
        if (!window.days.includes(currentDay)) {
          return false;
        }
      }

      // Check time range
      return currentTime >= window.start && currentTime <= window.end;
    });
  }

  private async getUserPreferences(userId?: string): Promise<CommunicationPreference[]> {
    // In a real implementation, this would fetch from database
    // For now, return default preferences
    return [
      {
        channel: 'twilio-sms',
        urgency: ['critical', 'high', 'normal'],
        timeWindows: [{
          start: '06:00',
          end: '22:00',
          timezone: 'UTC',
        }],
        formatPreferences: {
          maxBulletPoints: 3,
          includeVisuals: true,
          includeActionItems: true,
        },
      },
    ];
  }

  private setupChannelEventHandlers(channelId: string, channel: IChannelProvider): void {
    // Message received handler
    channel.on('messageReceived', (message: ChannelMessage) => {
      this.emit('messageReceived', channelId, message);
    });

    // Delivery status update handler
    channel.on('deliveryStatusUpdate', (messageId: string, status: DeliveryStatus) => {
      this.emit('deliveryStatusUpdate', channelId, messageId, status);
    });

    // Error handler
    channel.on('error', (error: Error) => {
      communicationLogger.error(`Channel error`, {
        channelId,
        error: error.message,
      });
      this.emit('channelError', channelId, error);
    });
  }

  private setupHealthChecks(): void {
    // Health check logic will be implemented here
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [channelId, channel] of this.channels.entries()) {
        try {
          const isHealthy = await channel.isHealthy();
          const config = this.channelConfigs.get(channelId);
          
          if (config && config.isActive !== isHealthy) {
            config.isActive = isHealthy;
            
            communicationLogger.info(`Channel health status changed`, {
              channelId,
              isHealthy,
            });
            
            this.emit('channelHealthChanged', channelId, isHealthy);
          }
        } catch (error) {
          communicationLogger.error(`Health check failed for channel ${channelId}`, {
            error: (error as Error).message,
          });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Public getters for monitoring
  public getChannelCount(): number {
    return this.channels.size;
  }

  public getActiveChannels(): string[] {
    return Array.from(this.channelConfigs.entries())
      .filter(([_, config]) => config.isActive)
      .map(([id, _]) => id);
  }

  public getChannelStatus(channelId: string): { registered: boolean; active: boolean } {
    const config = this.channelConfigs.get(channelId);
    return {
      registered: this.channels.has(channelId),
      active: config?.isActive || false,
    };
  }
}

// Singleton instance
export const communicationRouter = new CommunicationRouter();