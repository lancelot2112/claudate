import { CommunicationRouter } from '@/communication/router/Router';
import { TwilioChannel } from '@/communication/channels/TwilioChannel';
import { 
  CommunicationChannel, 
  ChannelMessage, 
  ChannelConfig,
  CommunicationPreference 
} from '@/types/Communication';
import { BaseMessage } from '@/types/common';

// Mock Twilio
jest.mock('twilio', () => ({
  Twilio: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'test-message-sid',
        status: 'sent',
        to: '+1234567890',
        from: '+0987654321',
        numSegments: 1,
        price: '0.0075',
        priceUnit: 'USD',
      }),
    },
    incomingPhoneNumbers: {
      list: jest.fn().mockResolvedValue([{
        phoneNumber: '+0987654321',
        sid: 'test-phone-sid',
      }]),
    },
  })),
}));

describe('CommunicationRouter', () => {
  let router: CommunicationRouter;
  let mockChannel: TwilioChannel;
  let mockChannelConfig: CommunicationChannel;
  let mockChannelProviderConfig: ChannelConfig;

  beforeEach(async () => {
    router = new CommunicationRouter();
    
    mockChannelProviderConfig = {
      enabled: true,
      priority: 1,
      supportedUrgencies: ['critical', 'high', 'normal', 'low'],
      formatPreferences: {
        maxLength: 1600,
        supportsBulletPoints: true,
        supportsMarkdown: false,
        supportsMedia: true,
        supportsInteractiveElements: false,
        mobileOptimized: true,
      },
      authentication: {
        accountSid: 'test-account-sid',
        authToken: 'test-auth-token',
        phoneNumber: '+0987654321',
      },
      retryPolicy: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryOnStatuses: ['failed'],
      },
    };

    mockChannelConfig = {
      id: 'test-twilio',
      name: 'Test Twilio Channel',
      type: 'sms',
      isActive: true,
      capabilities: ['text_messaging', 'media_messaging'],
      rateLimits: {
        maxPerMinute: 60,
        maxPerHour: 3600,
        maxPerDay: 86400,
        burstLimit: 10,
      },
      configuration: mockChannelProviderConfig,
    };

    mockChannel = new TwilioChannel(mockChannelProviderConfig);
    
    await router.initialize();
  });

  afterEach(async () => {
    await router.shutdown();
  });

  describe('Channel Registration', () => {
    it('should register a channel successfully', async () => {
      await router.registerChannel(mockChannel, mockChannelConfig);
      
      const status = router.getChannelStatus('test-twilio');
      expect(status.registered).toBe(true);
      expect(status.active).toBe(true);
    });

    it('should unregister a channel successfully', async () => {
      await router.registerChannel(mockChannel, mockChannelConfig);
      await router.unregisterChannel('test-twilio');
      
      const status = router.getChannelStatus('test-twilio');
      expect(status.registered).toBe(false);
      expect(status.active).toBe(false);
    });

    it('should emit events on channel registration', async () => {
      const registeredSpy = jest.fn();
      router.on('channelRegistered', registeredSpy);
      
      await router.registerChannel(mockChannel, mockChannelConfig);
      
      expect(registeredSpy).toHaveBeenCalledWith('test-twilio', mockChannelConfig);
    });
  });

  describe('Channel Selection', () => {
    beforeEach(async () => {
      await router.registerChannel(mockChannel, mockChannelConfig);
    });

    it('should select an appropriate channel for a message', async () => {
      const message: BaseMessage = {
        id: 'test-message-1',
        content: 'Test message content',
        type: 'text',
        urgency: 'normal',
        timestamp: new Date(),
        source: 'test',
      };

      const preferences: CommunicationPreference[] = [
        {
          channel: 'test-twilio',
          urgency: ['critical', 'high', 'normal'],
          timeWindows: [{
            start: '00:00',
            end: '23:59',
            timezone: 'UTC',
          }],
          formatPreferences: {
            maxBulletPoints: 3,
            includeVisuals: true,
            includeActionItems: true,
          },
        },
      ];

      const selectedChannel = await router.selectChannel(message, preferences);
      
      expect(selectedChannel).not.toBeNull();
      expect(selectedChannel?.id).toBe('test-twilio');
    });

    it('should return null when no suitable channel is found', async () => {
      const message: BaseMessage = {
        id: 'test-message-2',
        content: 'Test message content',
        type: 'text',
        urgency: 'critical',
        timestamp: new Date(),
        source: 'test',
      };

      const preferences: CommunicationPreference[] = [
        {
          channel: 'non-existent-channel',
          urgency: ['critical'],
          timeWindows: [{
            start: '00:00',
            end: '23:59',
            timezone: 'UTC',
          }],
          formatPreferences: {
            maxBulletPoints: 3,
            includeVisuals: true,
            includeActionItems: true,
          },
        },
      ];

      const selectedChannel = await router.selectChannel(message, preferences);
      
      expect(selectedChannel).toBeNull();
    });

    it('should filter channels based on urgency preferences', async () => {
      const message: BaseMessage = {
        id: 'test-message-3',
        content: 'Test message content',
        type: 'text',
        urgency: 'critical',
        timestamp: new Date(),
        source: 'test',
      };

      const preferences: CommunicationPreference[] = [
        {
          channel: 'test-twilio',
          urgency: ['normal', 'low'], // Does not include critical
          timeWindows: [{
            start: '00:00',
            end: '23:59',
            timezone: 'UTC',
          }],
          formatPreferences: {
            maxBulletPoints: 3,
            includeVisuals: true,
            includeActionItems: true,
          },
        },
      ];

      const selectedChannel = await router.selectChannel(message, preferences);
      
      expect(selectedChannel).toBeNull();
    });
  });

  describe('Message Routing', () => {
    beforeEach(async () => {
      await router.registerChannel(mockChannel, mockChannelConfig);
    });

    it('should route a message successfully', async () => {
      const message: ChannelMessage = {
        id: 'test-message-4',
        content: 'Test message for routing',
        type: 'text',
        urgency: 'normal',
        timestamp: new Date(),
        source: 'test',
        channel: 'test-twilio',
        recipient: '+1234567890',
      };

      const result = await router.routeMessage(message, mockChannelConfig);
      
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-4');
      expect(result.deliveryStatus).toBe('sent');
    });

    it('should handle routing failures', async () => {
      const message: ChannelMessage = {
        id: 'test-message-5',
        content: 'Test message for failure',
        type: 'text',
        urgency: 'normal',
        timestamp: new Date(),
        source: 'test',
        channel: 'non-existent-channel',
        recipient: '+1234567890',
      };

      const result = await router.routeMessage(message);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No suitable channel found');
    });

    it('should emit events on successful routing', async () => {
      const routedSpy = jest.fn();
      router.on('messageRouted', routedSpy);

      const message: ChannelMessage = {
        id: 'test-message-6',
        content: 'Test message for event',
        type: 'text',
        urgency: 'normal',
        timestamp: new Date(),
        source: 'test',
        channel: 'test-twilio',
        recipient: '+1234567890',
      };

      await router.routeMessage(message, mockChannelConfig);
      
      expect(routedSpy).toHaveBeenCalledWith(
        'test-message-6',
        'test-twilio',
        expect.objectContaining({ success: true })
      );
    });
  });

  describe('Delivery Failure Handling', () => {
    beforeEach(async () => {
      await router.registerChannel(mockChannel, mockChannelConfig);
    });

    it('should attempt alternative delivery on failure', async () => {
      const message: ChannelMessage = {
        id: 'test-message-7',
        content: 'Test message for alternative delivery',
        type: 'text',
        urgency: 'normal',
        timestamp: new Date(),
        source: 'test',
        channel: 'failed-channel',
        recipient: '+1234567890',
      };

      const failureResult = {
        success: false,
        messageId: 'test-message-7',
        deliveryStatus: 'failed' as const,
        error: 'Channel failure',
      };

      const result = await router.handleDeliveryFailure(message, failureResult);
      
      // Should attempt delivery via alternative channel
      expect(result).toBeDefined();
    });

    it('should emit delivery failed event when no alternatives exist', async () => {
      const deliveryFailedSpy = jest.fn();
      router.on('deliveryFailed', deliveryFailedSpy);

      // Unregister the only available channel
      await router.unregisterChannel('test-twilio');

      const message: ChannelMessage = {
        id: 'test-message-8',
        content: 'Test message with no alternatives',
        type: 'text',
        urgency: 'normal',
        timestamp: new Date(),
        source: 'test',
        channel: 'failed-channel',
        recipient: '+1234567890',
      };

      const failureResult = {
        success: false,
        messageId: 'test-message-8',
        deliveryStatus: 'failed' as const,
        error: 'Channel failure',
      };

      await router.handleDeliveryFailure(message, failureResult);
      
      expect(deliveryFailedSpy).toHaveBeenCalledWith('test-message-8', failureResult);
    });
  });

  describe('Bulk Message Processing', () => {
    beforeEach(async () => {
      await router.registerChannel(mockChannel, mockChannelConfig);
    });

    it('should process bulk messages successfully', async () => {
      const messages: ChannelMessage[] = [
        {
          id: 'bulk-message-1',
          content: 'Bulk message 1',
          type: 'text',
          urgency: 'normal',
          timestamp: new Date(),
          source: 'test',
          channel: 'test-twilio',
          recipient: '+1234567890',
        },
        {
          id: 'bulk-message-2',
          content: 'Bulk message 2',
          type: 'text',
          urgency: 'normal',
          timestamp: new Date(),
          source: 'test',
          channel: 'test-twilio',
          recipient: '+1234567891',
        },
      ];

      const job: import('@/types/Communication').BulkMessageJob = {
        id: 'bulk-job-1',
        messages,
        targetChannels: ['test-twilio'],
        priority: 1,
        status: 'pending' as const,
      };

      const completedSpy = jest.fn();
      router.on('bulkJobCompleted', completedSpy);

      await router.processBulkMessages(job);

      expect(job.status).toBe('completed');
      expect(job.progress?.total).toBe(2);
      expect(completedSpy).toHaveBeenCalledWith('bulk-job-1', job.progress);
    });
  });

  describe('Monitoring', () => {
    beforeEach(async () => {
      await router.registerChannel(mockChannel, mockChannelConfig);
    });

    it('should return correct channel count', () => {
      expect(router.getChannelCount()).toBe(1);
    });

    it('should return list of active channels', () => {
      const activeChannels = router.getActiveChannels();
      expect(activeChannels).toContain('test-twilio');
      expect(activeChannels.length).toBe(1);
    });

    it('should return channel status', () => {
      const status = router.getChannelStatus('test-twilio');
      expect(status.registered).toBe(true);
      expect(status.active).toBe(true);
    });
  });
});