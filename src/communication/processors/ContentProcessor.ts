import { BaseMessage, UrgencyLevel } from '@/types/common';
import { ChannelMessage, MediaAttachment, ExecutiveBrief } from '@/types/Communication';
import { communicationLogger } from '@/utils/logger';

export interface ContentProcessorOptions {
  maxLength?: number;
  maxBulletPoints?: number;
  includeEmojis?: boolean;
  mobileOptimized?: boolean;
  supportMarkdown?: boolean;
  urgencyPrefix?: boolean;
}

export abstract class BaseContentProcessor {
  protected options: ContentProcessorOptions;

  constructor(options: ContentProcessorOptions = {}) {
    this.options = {
      maxLength: 1600,
      maxBulletPoints: 3,
      includeEmojis: true,
      mobileOptimized: true,
      supportMarkdown: false,
      urgencyPrefix: true,
      ...options,
    };
  }

  public abstract process(message: BaseMessage | ChannelMessage): Promise<string>;
  
  protected formatUrgency(urgency: UrgencyLevel): string {
    if (!this.options.urgencyPrefix) {
      return '';
    }

    const urgencyEmojis = {
      critical: '🚨',
      high: '⚠️',
      normal: '',
      low: '💡',
    };

    const urgencyLabels = {
      critical: 'URGENT',
      high: 'IMPORTANT',
      normal: '',
      low: 'FYI',
    };

    const emoji = this.options.includeEmojis ? urgencyEmojis[urgency] : '';
    const label = urgencyLabels[urgency];

    return emoji && label ? `${emoji} ${label}: ` : emoji ? `${emoji} ` : label ? `${label}: ` : '';
  }

  protected truncateContent(content: string, maxLength?: number): string {
    const limit = maxLength || this.options.maxLength || 1600;
    if (content.length <= limit) {
      return content;
    }

    return content.substring(0, limit - 3) + '...';
  }

  protected formatBulletPoints(points: string[]): string {
    const maxPoints = this.options.maxBulletPoints || 3;
    const limitedPoints = points.slice(0, maxPoints);
    
    return limitedPoints.map(point => `• ${point}`).join('\n');
  }

  protected optimizeForMobile(content: string): string {
    if (!this.options.mobileOptimized) {
      return content;
    }

    return content
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
  }
}

export class ExecutiveBriefProcessor extends BaseContentProcessor {
  constructor(options: ContentProcessorOptions = {}) {
    super({
      maxLength: 1200,
      maxBulletPoints: 3,
      includeEmojis: true,
      mobileOptimized: true,
      urgencyPrefix: true,
      ...options,
    });
  }

  public async process(message: BaseMessage | ChannelMessage): Promise<string> {
    const executiveBrief = this.extractExecutiveBrief(message);
    
    if (!executiveBrief) {
      // Generate brief from message content
      return this.generateBriefFromMessage(message);
    }

    return this.formatExecutiveBrief(executiveBrief);
  }

  private extractExecutiveBrief(message: BaseMessage | ChannelMessage): ExecutiveBrief | null {
    if ('metadata' in message && message.metadata?.executiveBrief) {
      return message.metadata.executiveBrief;
    }
    return null;
  }

  private generateBriefFromMessage(message: BaseMessage | ChannelMessage): string {
    const urgencyPrefix = this.formatUrgency(message.urgency);
    const content = message.content;
    
    // Extract key information
    const summary = this.extractSummary(content);
    const actionItems = this.extractActionItems(content);
    
    let brief = `${urgencyPrefix}${summary}`;
    
    if (actionItems.length > 0) {
      brief += '\n\n📋 Actions:\n';
      brief += this.formatBulletPoints(actionItems);
    }
    
    return this.truncateContent(this.optimizeForMobile(brief));
  }

  private formatExecutiveBrief(brief: ExecutiveBrief): string {
    const urgencyPrefix = this.formatUrgency(brief.urgency);
    
    let content = `${urgencyPrefix}${brief.title}\n\n`;
    content += `${brief.summary}\n\n`;
    
    if (brief.keyPoints.length > 0) {
      content += '📊 Key Points:\n';
      content += this.formatBulletPoints(brief.keyPoints);
    }
    
    if (brief.actionItems.length > 0) {
      content += '\n\n📋 Actions:\n';
      content += this.formatBulletPoints(brief.actionItems);
    }
    
    return this.truncateContent(this.optimizeForMobile(content));
  }

  private extractSummary(content: string): string {
    // Simple summary extraction - first sentence or first 100 characters
    const firstSentence = content.split('.')[0];
    if (firstSentence && firstSentence.length < 100) {
      return firstSentence + '.';
    }
    
    return content.substring(0, 100) + '...';
  }

  private extractActionItems(content: string): string[] {
    const actionKeywords = ['todo', 'action', 'task', 'need to', 'should', 'must'];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    
    return sentences
      .filter(sentence => 
        actionKeywords.some(keyword => 
          sentence.toLowerCase().includes(keyword)
        )
      )
      .map(sentence => sentence.trim())
      .slice(0, 2); // Limit to 2 action items
  }
}

export class TechnicalMessageProcessor extends BaseContentProcessor {
  constructor(options: ContentProcessorOptions = {}) {
    super({
      maxLength: 800,
      maxBulletPoints: 3,
      includeEmojis: false,
      mobileOptimized: true,
      supportMarkdown: true,
      urgencyPrefix: false,
      ...options,
    });
  }

  public async process(message: BaseMessage | ChannelMessage): Promise<string> {
    let content = message.content;
    
    // Format code blocks for SMS
    content = this.formatCodeBlocks(content);
    
    // Extract key technical points
    const keyPoints = this.extractTechnicalPoints(content);
    
    if (keyPoints.length > 0) {
      content = `Technical Update:\n\n${keyPoints.join('\n')}`;
    }
    
    return this.truncateContent(this.optimizeForMobile(content));
  }

  private formatCodeBlocks(content: string): string {
    // Convert markdown code blocks to simple format
    content = content.replace(/```[\s\S]*?```/g, (match) => {
      const code = match.replace(/```/g, '').trim();
      return `[Code: ${code.substring(0, 50)}${code.length > 50 ? '...' : ''}]`;
    });
    
    // Convert inline code
    content = content.replace(/`([^`]+)`/g, '"$1"');
    
    return content;
  }

  private extractTechnicalPoints(content: string): string[] {
    const technicalKeywords = ['error', 'bug', 'fix', 'deploy', 'test', 'build', 'commit'];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim());
    
    return sentences
      .filter(sentence => 
        technicalKeywords.some(keyword => 
          sentence.toLowerCase().includes(keyword)
        )
      )
      .map(sentence => `• ${sentence.trim()}`)
      .slice(0, this.options.maxBulletPoints || 3);
  }
}

export class GeneralMessageProcessor extends BaseContentProcessor {
  constructor(options: ContentProcessorOptions = {}) {
    super({
      maxLength: 1000,
      maxBulletPoints: 3,
      includeEmojis: true,
      mobileOptimized: true,
      supportMarkdown: false,
      urgencyPrefix: true,
      ...options,
    });
  }

  public async process(message: BaseMessage | ChannelMessage): Promise<string> {
    const urgencyPrefix = this.formatUrgency(message.urgency);
    let content = `${urgencyPrefix}${message.content}`;
    
    // Add timestamp if urgent
    if (message.urgency === 'critical' || message.urgency === 'high') {
      const timestamp = new Date().toLocaleTimeString();
      content += `\n\n⏰ ${timestamp}`;
    }
    
    return this.truncateContent(this.optimizeForMobile(content));
  }
}

export class ContentProcessorFactory {
  private static processors: Map<string, BaseContentProcessor> = new Map();

  public static getProcessor(type: string, options?: ContentProcessorOptions): BaseContentProcessor {
    const key = `${type}_${JSON.stringify(options || {})}`;
    
    if (!this.processors.has(key)) {
      let processor: BaseContentProcessor;
      
      switch (type) {
        case 'executive':
          processor = new ExecutiveBriefProcessor(options);
          break;
        case 'technical':
          processor = new TechnicalMessageProcessor(options);
          break;
        case 'general':
        default:
          processor = new GeneralMessageProcessor(options);
          break;
      }
      
      this.processors.set(key, processor);
    }
    
    return this.processors.get(key)!;
  }

  public static async processMessage(
    message: BaseMessage | ChannelMessage,
    processorType: string,
    options?: ContentProcessorOptions
  ): Promise<string> {
    try {
      const processor = this.getProcessor(processorType, options);
      const processedContent = await processor.process(message);
      
      communicationLogger.debug('Message processed successfully', {
        messageId: message.id,
        processorType,
        originalLength: message.content.length,
        processedLength: processedContent.length,
      });
      
      return processedContent;
    } catch (error) {
      communicationLogger.error('Message processing failed', {
        messageId: message.id,
        processorType,
        error: (error as Error).message,
      });
      
      // Fallback to original content with truncation
      return message.content.length > 1000 
        ? message.content.substring(0, 997) + '...'
        : message.content;
    }
  }
}

// Media processing utilities
export class MediaProcessor {
  public static async processAttachment(attachment: MediaAttachment): Promise<MediaAttachment> {
    // Basic media processing - in production this would include:
    // - Image compression
    // - Video transcoding
    // - Audio format conversion
    // - Security scanning
    
    communicationLogger.info('Processing media attachment', {
      attachmentId: attachment.id,
      type: attachment.type,
      size: attachment.size,
      mimeType: attachment.mimeType,
    });
    
    return attachment;
  }

  public static async generateThumbnail(attachment: MediaAttachment): Promise<string | null> {
    // Generate thumbnail for images and videos
    if (attachment.type === 'image' || attachment.type === 'video') {
      // In production, use Sharp for images or FFmpeg for videos
      // For now, return a placeholder
      return `${attachment.url}?thumbnail=true`;
    }
    
    return null;
  }

  public static getMediaDescription(attachment: MediaAttachment): string {
    const typeEmojis = {
      image: '📸',
      video: '🎥',
      audio: '🎵',
      document: '📄',
      chart: '📊',
    };
    
    const emoji = typeEmojis[attachment.type] || '📎';
    const sizeStr = this.formatFileSize(attachment.size);
    
    return `${emoji} ${attachment.filename} (${sizeStr})`;
  }

  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}