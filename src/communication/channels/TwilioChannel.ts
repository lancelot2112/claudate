import { Twilio } from 'twilio';
import { BaseChannel } from '@/communication/base/Channel';
import { 
  ChannelMessage, 
  MessageDeliveryResult, 
  ChannelCapability, 
  ChannelConfig,
  MediaAttachment
} from '@/types/Communication';
import { communicationLogger } from '@/utils/logger';
import { config } from '@/utils/config';

export class TwilioChannel extends BaseChannel {
  private twilioClient: Twilio | null = null;
  private phoneNumber: string;
  private webhookUrl: string;

  constructor(channelConfig: ChannelConfig) {
    super('twilio-sms', 'Twilio SMS/MMS', channelConfig);
    
    this.phoneNumber = channelConfig.authentication.phoneNumber;
    this.webhookUrl = channelConfig.webhookEndpoint || `${config.apiBaseUrl}/webhooks/twilio/sms`;
  }

  public getCapabilities(): ChannelCapability[] {
    return [
      'text_messaging',
      'media_messaging',
    ];
  }

  protected async doInitialize(): Promise<void> {
    const { accountSid, authToken } = this.config.authentication;
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not provided');
    }

    if (!this.phoneNumber) {
      throw new Error('Twilio phone number not provided');
    }

    this.twilioClient = new Twilio(accountSid, authToken);
    
    // Verify the phone number exists and is active
    try {
      const phoneNumberInstance = await this.twilioClient.incomingPhoneNumbers.list({
        phoneNumber: this.phoneNumber,
        limit: 1
      });

      if (phoneNumberInstance.length === 0) {
        throw new Error(`Phone number ${this.phoneNumber} not found in Twilio account`);
      }

      communicationLogger.info('Twilio channel initialized successfully', {
        phoneNumber: this.phoneNumber,
        webhookUrl: this.webhookUrl,
      });
    } catch (error) {
      throw new Error(`Failed to verify Twilio phone number: ${(error as Error).message}`);
    }
  }

  protected async doShutdown(): Promise<void> {
    this.twilioClient = null;
    communicationLogger.info('Twilio channel shutdown');
  }

  protected async doSendMessage(message: ChannelMessage): Promise<MessageDeliveryResult> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const messageOptions: any = {
        body: this.formatMessage(message),
        from: this.phoneNumber,
        to: this.extractPhoneNumber(message),
      };

      // Add media attachments if present
      if (message.attachments && message.attachments.length > 0) {
        const mediaUrls = this.prepareMediaUrls(message.attachments);
        if (mediaUrls.length > 0) {
          messageOptions.mediaUrl = mediaUrls;
        }
      }

      // Add status callback for delivery tracking
      if (this.webhookUrl) {
        messageOptions.statusCallback = `${this.webhookUrl}/status`;
      }

      const twilioMessage = await this.twilioClient.messages.create(messageOptions);

      return {
        success: true,
        messageId: message.id,
        channelMessageId: twilioMessage.sid,
        deliveryStatus: this.mapTwilioStatus(twilioMessage.status),
        deliveredAt: new Date(),
        metadata: {
          twilioSid: twilioMessage.sid,
          twilioStatus: twilioMessage.status,
          to: twilioMessage.to,
          from: twilioMessage.from,
          numSegments: twilioMessage.numSegments,
          price: twilioMessage.price,
          priceUnit: twilioMessage.priceUnit,
        },
      };
    } catch (error: any) {
      const errorMessage = error.message || 'Unknown Twilio error';
      const errorCode = error.code || 'UNKNOWN';
      
      communicationLogger.error('Twilio message send failed', {
        messageId: message.id,
        error: errorMessage,
        errorCode,
        to: this.extractPhoneNumber(message),
      });

      return {
        success: false,
        messageId: message.id,
        deliveryStatus: 'failed',
        error: `${errorCode}: ${errorMessage}`,
        metadata: {
          twilioErrorCode: errorCode,
          twilioErrorMessage: errorMessage,
        },
      };
    }
  }

  protected async doReceiveMessage(): Promise<ChannelMessage | null> {
    // For Twilio, messages are received via webhook
    // This method would typically be called by the webhook handler
    return null;
  }

  // Webhook handler for incoming messages
  public async handleIncomingMessage(webhookData: any): Promise<ChannelMessage> {
    const message: ChannelMessage = {
      id: `twilio_${webhookData.MessageSid}`,
      content: webhookData.Body || '',
      type: 'text',
      urgency: 'normal',
      timestamp: new Date(),
      channel: 'sms',
      source: 'twilio',
      metadata: {
        from: webhookData.From,
        to: webhookData.To,
        messageSid: webhookData.MessageSid,
        accountSid: webhookData.AccountSid,
        messagingServiceSid: webhookData.MessagingServiceSid,
        numSegments: webhookData.NumSegments,
        numMedia: webhookData.NumMedia,
      },
      channelSpecificData: {
        twilioSid: webhookData.MessageSid,
        from: webhookData.From,
        to: webhookData.To,
      },
    };

    // Handle media attachments
    if (webhookData.NumMedia && parseInt(webhookData.NumMedia) > 0) {
      message.attachments = await this.processIncomingMedia(webhookData);
      message.type = 'media';
    }

    communicationLogger.info('Received incoming Twilio message', {
      messageId: message.id,
      from: webhookData.From,
      to: webhookData.To,
      hasMedia: message.attachments && message.attachments.length > 0,
    });

    return message;
  }

  // Status webhook handler
  public async handleStatusUpdate(webhookData: any): Promise<void> {
    const messageId = webhookData.MessageSid;
    const status = this.mapTwilioStatus(webhookData.MessageStatus);

    communicationLogger.info('Received Twilio status update', {
      messageId,
      status: webhookData.MessageStatus,
      mappedStatus: status,
    });

    if (this.onDeliveryStatusUpdate) {
      await this.onDeliveryStatusUpdate(messageId, status);
    }

    this.emit('deliveryStatusUpdate', messageId, status, webhookData);
  }

  // Helper methods
  private extractPhoneNumber(message: ChannelMessage): string {
    // Try to extract phone number from various possible locations
    if (message.recipient) {
      return message.recipient;
    }

    if (message.metadata?.phoneNumber) {
      return message.metadata.phoneNumber;
    }

    if (message.channelSpecificData?.phoneNumber) {
      return message.channelSpecificData.phoneNumber;
    }

    throw new Error('No phone number found in message');
  }

  private prepareMediaUrls(attachments: MediaAttachment[]): string[] {
    return attachments
      .filter(attachment => this.isSupportedMediaType(attachment.mimeType))
      .map(attachment => attachment.url)
      .slice(0, 10); // Twilio supports up to 10 media attachments
  }

  private isSupportedMediaType(mimeType: string): boolean {
    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/3gp',
      'video/webm',
      'audio/mp3',
      'audio/mp4',
      'audio/wav',
      'audio/ogg',
      'application/pdf',
      'text/plain',
      'application/json',
    ];

    return supportedTypes.includes(mimeType);
  }

  private async processIncomingMedia(webhookData: any): Promise<MediaAttachment[]> {
    const attachments: MediaAttachment[] = [];
    const numMedia = parseInt(webhookData.NumMedia) || 0;

    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = webhookData[`MediaUrl${i}`];
      const mediaContentType = webhookData[`MediaContentType${i}`];

      if (mediaUrl && mediaContentType) {
        const attachment: MediaAttachment = {
          id: `twilio_media_${webhookData.MessageSid}_${i}`,
          type: this.getMediaType(mediaContentType),
          url: mediaUrl,
          filename: `media_${i}.${this.getFileExtension(mediaContentType)}`,
          size: 0, // Twilio doesn't provide size in webhook
          mimeType: mediaContentType,
          metadata: {
            twilioIndex: i,
            twilioUrl: mediaUrl,
          },
        };

        attachments.push(attachment);
      }
    }

    return attachments;
  }

  private getMediaType(contentType: string): MediaAttachment['type'] {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType.startsWith('video/')) return 'video';
    if (contentType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  private getFileExtension(contentType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/3gp': '3gp',
      'video/webm': 'webm',
      'audio/mp3': 'mp3',
      'audio/mp4': 'mp4',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'application/pdf': 'pdf',
      'text/plain': 'txt',
      'application/json': 'json',
    };

    return extensions[contentType] || 'dat';
  }

  private mapTwilioStatus(twilioStatus: string): MessageDeliveryResult['deliveryStatus'] {
    switch (twilioStatus) {
      case 'queued':
      case 'accepted':
        return 'pending';
      case 'sending':
        return 'sent';
      case 'sent':
      case 'delivered':
        return 'delivered';
      case 'failed':
      case 'undelivered':
        return 'failed';
      default:
        return 'pending';
    }
  }

  // Executive briefing support - format messages for mobile delivery
  public formatExecutiveBrief(
    title: string,
    keyPoints: string[],
    actionItems: string[],
    maxLength: number = 1600
  ): string {
    const maxPoints = 3; // SMS-friendly executive brief
    const limitedPoints = keyPoints.slice(0, maxPoints);
    const limitedActions = actionItems.slice(0, 2);

    let brief = `📊 ${title}\n\n`;
    
    // Add key points
    limitedPoints.forEach((point, index) => {
      brief += `${index + 1}. ${point}\n`;
    });

    // Add action items if any
    if (limitedActions.length > 0) {
      brief += `\n📋 Actions:\n`;
      limitedActions.forEach(action => {
        brief += `• ${action}\n`;
      });
    }

    // Trim to length if needed
    if (brief.length > maxLength) {
      brief = brief.substring(0, maxLength - 3) + '...';
    }

    return brief;
  }

  // Send executive brief with optional chart
  public async sendExecutiveBrief(
    phoneNumber: string,
    title: string,
    keyPoints: string[],
    actionItems: string[],
    chartUrl?: string
  ): Promise<MessageDeliveryResult> {
    const briefText = this.formatExecutiveBrief(title, keyPoints, actionItems);
    
    const message: ChannelMessage = {
      id: `exec_brief_${Date.now()}`,
      content: briefText,
      type: chartUrl ? 'media' : 'text',
      urgency: 'high',
      timestamp: new Date(),
      channel: 'sms',
      source: 'executive_brief',
      recipient: phoneNumber,
      attachments: chartUrl ? [{
        id: `chart_${Date.now()}`,
        type: 'chart',
        url: chartUrl,
        filename: 'executive_brief_chart.png',
        size: 0,
        mimeType: 'image/png',
      }] : undefined,
    };

    return await this.sendMessage(message);
  }
}