import { BaseMessage, UrgencyLevel } from '@/types/common';
import { ChannelMessage, ExecutiveBrief, MediaAttachment } from '@/types/Communication';
import { communicationLogger } from '@/utils/logger';

export interface MobileFormattingOptions {
  maxLineLength: number;
  maxTotalLength: number;
  maxBulletPoints: number;
  includeEmojis: boolean;
  includeTimestamp: boolean;
  compactMode: boolean;
  urgencyIndicators: boolean;
}

export class MobileFormatter {
  private static readonly DEFAULT_OPTIONS: MobileFormattingOptions = {
    maxLineLength: 40,
    maxTotalLength: 1600,
    maxBulletPoints: 3,
    includeEmojis: true,
    includeTimestamp: false,
    compactMode: true,
    urgencyIndicators: true,
  };

  private static readonly EMOJI_MAP = {
    urgent: '🚨',
    important: '⚠️',
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    time: '⏰',
    action: '📋',
    status: '📊',
    chart: '📈',
    message: '💬',
    agent: '🤖',
    user: '👤',
  };

  private static readonly URGENCY_FORMATS = {
    critical: { emoji: '🚨', label: 'URGENT', color: 'red' },
    high: { emoji: '⚠️', label: 'IMPORTANT', color: 'orange' },
    normal: { emoji: 'ℹ️', label: '', color: 'blue' },
    low: { emoji: '💡', label: 'FYI', color: 'gray' },
  };

  public static formatMessage(
    message: BaseMessage | ChannelMessage,
    options: Partial<MobileFormattingOptions> = {}
  ): string {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    
    try {
      let formatted = '';
      
      // Add urgency indicator
      if (config.urgencyIndicators && message.urgency !== 'normal') {
        formatted += this.formatUrgencyHeader(message.urgency, config);
      }
      
      // Process main content
      const content = this.processContent(message.content, config);
      formatted += content;
      
      // Add timestamp if requested
      if (config.includeTimestamp) {
        formatted += this.formatTimestamp(message.timestamp, config);
      }
      
      // Add attachments summary
      if ('attachments' in message && message.attachments && message.attachments.length > 0) {
        formatted += this.formatAttachmentSummary(message.attachments, config);
      }
      
      // Final length check and truncation
      if (formatted.length > config.maxTotalLength) {
        formatted = formatted.substring(0, config.maxTotalLength - 3) + '...';
      }
      
      return formatted.trim();
    } catch (error) {
      communicationLogger.error('Mobile formatting failed', {
        messageId: message.id,
        error: (error as Error).message,
      });
      
      // Fallback to basic formatting
      return this.basicFormat(message.content, config.maxTotalLength);
    }
  }

  public static formatExecutiveBrief(
    brief: ExecutiveBrief,
    options: Partial<MobileFormattingOptions> = {}
  ): string {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    
    let formatted = '';
    
    // Title with urgency
    if (config.urgencyIndicators) {
      formatted += this.formatUrgencyHeader(brief.urgency, config);
    }
    
    formatted += `${brief.title}\n\n`;
    
    // Summary
    const summary = this.processContent(brief.summary, config);
    formatted += summary;
    
    // Key points
    if (brief.keyPoints.length > 0) {
      formatted += '\n\n';
      if (config.includeEmojis) {
        formatted += `${this.EMOJI_MAP.status} Key Points:\n`;
      } else {
        formatted += 'Key Points:\n';
      }
      
      const points = brief.keyPoints.slice(0, config.maxBulletPoints);
      formatted += points.map(point => `• ${this.wrapText(point, config.maxLineLength)}`).join('\n');
    }
    
    // Action items
    if (brief.actionItems.length > 0) {
      formatted += '\n\n';
      if (config.includeEmojis) {
        formatted += `${this.EMOJI_MAP.action} Actions:\n`;
      } else {
        formatted += 'Actions:\n';
      }
      
      const actions = brief.actionItems.slice(0, config.maxBulletPoints);
      formatted += actions.map(action => `• ${this.wrapText(action, config.maxLineLength)}`).join('\n');
    }
    
    // Truncate if needed
    if (formatted.length > config.maxTotalLength) {
      formatted = formatted.substring(0, config.maxTotalLength - 3) + '...';
    }
    
    return formatted.trim();
  }

  public static formatQuickStatus(
    status: string,
    details: string[],
    options: Partial<MobileFormattingOptions> = {}
  ): string {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    
    let formatted = '';
    
    // Status header
    if (config.includeEmojis) {
      formatted += `${this.EMOJI_MAP.status} ${status}\n\n`;
    } else {
      formatted += `${status}\n\n`;
    }
    
    // Details (limited)
    const limitedDetails = details.slice(0, config.maxBulletPoints);
    formatted += limitedDetails.map(detail => `• ${this.wrapText(detail, config.maxLineLength)}`).join('\n');
    
    return this.truncateToLength(formatted, config.maxTotalLength);
  }

  public static formatAgentUpdate(
    agentName: string,
    action: string,
    details: string,
    options: Partial<MobileFormattingOptions> = {}
  ): string {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    
    let formatted = '';
    
    // Agent header
    if (config.includeEmojis) {
      formatted += `${this.EMOJI_MAP.agent} ${agentName}\n`;
    } else {
      formatted += `${agentName}\n`;
    }
    
    // Action
    formatted += `${action}\n\n`;
    
    // Details
    const processedDetails = this.processContent(details, config);
    formatted += processedDetails;
    
    return this.truncateToLength(formatted, config.maxTotalLength);
  }

  // Text processing utilities
  private static processContent(
    content: string,
    config: MobileFormattingOptions
  ): string {
    let processed = content;
    
    // Normalize whitespace
    processed = processed.replace(/\s+/g, ' ').trim();
    
    // Remove markdown formatting for SMS
    processed = this.stripMarkdown(processed);
    
    // Wrap long lines
    if (config.compactMode) {
      processed = this.wrapText(processed, config.maxLineLength);
    }
    
    return processed;
  }

  private static stripMarkdown(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, '[CODE]') // Code blocks FIRST
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '"$1"') // Inline code AFTER code blocks
      .replace(/#{1,6}\s+(.*)/g, '$1') // Headers
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
      .replace(/>\s+(.*)/g, '$1'); // Blockquotes
  }

  private static wrapText(text: string, maxLength: number): string {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxLength) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.join('\n');
  }

  private static formatUrgencyHeader(
    urgency: UrgencyLevel,
    config: MobileFormattingOptions
  ): string {
    const urgencyInfo = this.URGENCY_FORMATS[urgency];
    
    if (!urgencyInfo.label) {
      return '';
    }
    
    let header = '';
    
    if (config.includeEmojis) {
      header += `${urgencyInfo.emoji} ${urgencyInfo.label}: `;
    } else {
      header += `${urgencyInfo.label}: `;
    }
    
    return header;
  }

  private static formatTimestamp(
    timestamp: Date,
    config: MobileFormattingOptions
  ): string {
    const time = timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const prefix = config.includeEmojis ? this.EMOJI_MAP.time : '';
    return `\n\n${prefix} ${time}`;
  }

  private static formatAttachmentSummary(
    attachments: MediaAttachment[],
    config: MobileFormattingOptions
  ): string {
    if (attachments.length === 0) {
      return '';
    }
    
    const count = attachments.length;
    const types = [...new Set(attachments.map(a => a.type))];
    
    let summary = '\n\n';
    
    if (config.includeEmojis) {
      const typeEmojis = types.map(type => this.getTypeEmoji(type)).join('');
      summary += `${typeEmojis} ${count} attachment${count > 1 ? 's' : ''}`;
    } else {
      summary += `${count} attachment${count > 1 ? 's' : ''} (${types.join(', ')})`;
    }
    
    return summary;
  }

  private static getTypeEmoji(type: string): string {
    const typeEmojis = {
      image: '📸',
      video: '🎥',
      audio: '🎵',
      document: '📄',
      chart: '📊',
    };
    
    return typeEmojis[type as keyof typeof typeEmojis] || '📎';
  }

  private static truncateToLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - 3) + '...';
  }

  private static basicFormat(content: string, maxLength: number): string {
    const processed = content
      .replace(/\s+/g, ' ')
      .trim();
    
    return processed.length > maxLength
      ? processed.substring(0, maxLength - 3) + '...'
      : processed;
  }

  // Executive-specific formatting
  public static formatExecutiveSummary(
    title: string,
    keyMetrics: Record<string, number | string>,
    actionItems: string[],
    options: Partial<MobileFormattingOptions> = {}
  ): string {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    
    let formatted = '';
    
    // Title
    formatted += `${title}\n\n`;
    
    // Key metrics
    if (Object.keys(keyMetrics).length > 0) {
      if (config.includeEmojis) {
        formatted += `${this.EMOJI_MAP.status} Metrics:\n`;
      } else {
        formatted += 'Metrics:\n';
      }
      
      const metrics = Object.entries(keyMetrics)
        .slice(0, config.maxBulletPoints)
        .map(([key, value]) => `• ${key}: ${value}`)
        .join('\n');
      
      formatted += metrics;
    }
    
    // Action items
    if (actionItems.length > 0) {
      formatted += '\n\n';
      if (config.includeEmojis) {
        formatted += `${this.EMOJI_MAP.action} Actions:\n`;
      } else {
        formatted += 'Actions:\n';
      }
      
      const actions = actionItems
        .slice(0, config.maxBulletPoints)
        .map(action => `• ${this.wrapText(action, config.maxLineLength)}`)
        .join('\n');
      
      formatted += actions;
    }
    
    return this.truncateToLength(formatted, config.maxTotalLength);
  }

  // Chart attachment formatting
  public static formatChartMessage(
    title: string,
    description: string,
    chartAttachment: MediaAttachment,
    options: Partial<MobileFormattingOptions> = {}
  ): string {
    const config = { ...this.DEFAULT_OPTIONS, ...options };
    
    let formatted = '';
    
    // Title
    if (config.includeEmojis) {
      formatted += `${this.EMOJI_MAP.chart} ${title}\n\n`;
    } else {
      formatted += `${title}\n\n`;
    }
    
    // Description
    const processedDescription = this.processContent(description, config);
    formatted += processedDescription;
    
    // Chart info
    formatted += `\n\n${config.includeEmojis ? '📊' : 'Chart:'} ${chartAttachment.filename}`;
    
    return this.truncateToLength(formatted, config.maxTotalLength);
  }

  // Conversation formatting for context
  public static formatConversationSummary(
    messages: BaseMessage[],
    options: Partial<MobileFormattingOptions> = {}
  ): string {
    const config = { ...this.DEFAULT_OPTIONS, maxBulletPoints: 5, ...options };
    
    let formatted = '';
    
    // Header
    if (config.includeEmojis) {
      formatted += `${this.EMOJI_MAP.message} Conversation Summary\n\n`;
    } else {
      formatted += 'Conversation Summary\n\n';
    }
    
    // Recent messages
    const recentMessages = messages.slice(-config.maxBulletPoints);
    
    for (const message of recentMessages) {
      const time = message.timestamp.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      const snippet = this.processContent(message.content, {
        ...config,
        maxLineLength: 30,
      });
      
      formatted += `• ${time}: ${snippet}\n`;
    }
    
    return this.truncateToLength(formatted, config.maxTotalLength);
  }
}

// Specialized formatters for different executive communication scenarios
export class ExecutiveMobileFormatters {
  // Daily briefing format
  public static formatDailyBriefing(
    metrics: {
      messagesProcessed: number;
      agentsActive: number;
      successRate: number;
      urgentIssues: number;
    },
    topIssues: string[],
    options: Partial<MobileFormattingOptions> = {}
  ): string {
    const title = `Daily Operations Brief - ${new Date().toLocaleDateString()}`;
    
    const keyMetrics = {
      'Messages': metrics.messagesProcessed,
      'Active Agents': metrics.agentsActive,
      'Success Rate': `${Math.round(metrics.successRate * 100)}%`,
      'Urgent Issues': metrics.urgentIssues,
    };
    
    const actionItems = topIssues.slice(0, 2).map(issue => `Review: ${issue}`);
    
    return MobileFormatter.formatExecutiveSummary(title, keyMetrics, actionItems, options);
  }

  // Alert format
  public static formatCriticalAlert(
    alertType: string,
    description: string,
    immediateActions: string[],
    options: Partial<MobileFormattingOptions> = {}
  ): string {
    const config = { 
      ...MobileFormatter['DEFAULT_OPTIONS'], 
      urgencyIndicators: true,
      includeTimestamp: true,
      ...options 
    };
    
    let formatted = '';
    
    // Critical alert header
    if (config.includeEmojis) {
      formatted += `🚨 CRITICAL ALERT\n${alertType}\n\n`;
    } else {
      formatted += `CRITICAL ALERT\n${alertType}\n\n`;
    }
    
    // Description
    const processedDescription = MobileFormatter['processContent'](description, config);
    formatted += processedDescription;
    
    // Immediate actions
    if (immediateActions.length > 0) {
      formatted += '\n\n⚡ IMMEDIATE ACTIONS:\n';
      const actions = immediateActions
        .slice(0, config.maxBulletPoints)
        .map(action => `• ${action}`)
        .join('\n');
      formatted += actions;
    }
    
    // Timestamp
    if (config.includeTimestamp) {
      const time = new Date().toLocaleTimeString();
      formatted += `\n\n⏰ ${time}`;
    }
    
    return MobileFormatter['truncateToLength'](formatted, config.maxTotalLength);
  }

  // Status update format
  public static formatStatusUpdate(
    systemName: string,
    status: 'operational' | 'degraded' | 'outage',
    details: string,
    eta?: string,
    options: Partial<MobileFormattingOptions> = {}
  ): string {
    const config = { ...MobileFormatter['DEFAULT_OPTIONS'], ...options };
    
    const statusEmojis = {
      operational: '✅',
      degraded: '⚠️',
      outage: '🔴',
    };
    
    const statusLabels = {
      operational: 'OPERATIONAL',
      degraded: 'DEGRADED',
      outage: 'OUTAGE',
    };
    
    let formatted = '';
    
    // Status header
    if (config.includeEmojis) {
      formatted += `${statusEmojis[status]} ${systemName}\n${statusLabels[status]}\n\n`;
    } else {
      formatted += `${systemName}\n${statusLabels[status]}\n\n`;
    }
    
    // Details
    const processedDetails = MobileFormatter['processContent'](details, config);
    formatted += processedDetails;
    
    // ETA if provided
    if (eta) {
      formatted += `\n\n⏱️ ETA: ${eta}`;
    }
    
    return MobileFormatter['truncateToLength'](formatted, config.maxTotalLength);
  }
}