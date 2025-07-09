import { EventEmitter } from 'events';
import { 
  MessageRequest, 
  MessageResponse, 
  MediaAttachment,
  IChannelProvider 
} from '../../types/Communication';
import { VoiceProcessor, TranscriptionResult } from '../processors/VoiceProcessor';
import { InteractiveActionHandler } from '../interactive/InteractiveElementBuilder';
import logger from '../../utils/logger';

export interface ContentType {
  primary: 'text' | 'voice' | 'video' | 'image' | 'document' | 'interactive';
  secondary?: string;
  mimeType: string;
  confidence: number;
}

export interface ProcessedContent {
  id: string;
  originalType: ContentType;
  processedType: ContentType;
  content: string;
  metadata: Record<string, any>;
  attachments: MediaAttachment[];
  processingSteps: Array<{
    step: string;
    timestamp: Date;
    duration: number;
    success: boolean;
    metadata?: Record<string, any>;
  }>;
  timestamp: Date;
}

export interface RoutingRule {
  id: string;
  name: string;
  contentTypes: ContentType[];
  channels: string[];
  priority: number;
  conditions?: {
    userRoles?: string[];
    timeRanges?: Array<{ start: string; end: string }>;
    keywords?: string[];
    urgency?: 'low' | 'medium' | 'high' | 'critical';
  };
  processing: {
    steps: string[];
    maxProcessingTime: number;
    fallbackBehavior: 'queue' | 'forward' | 'reject';
  };
  enabled: boolean;
}

export interface ContentAnalysisResult {
  contentType: ContentType;
  extractedText: string;
  language?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  keywords: string[];
  entities?: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  routing: {
    suggestedChannel: string;
    suggestedAgent: string;
    confidence: number;
    reasoning: string;
  };
}

export class ContentRouter extends EventEmitter {
  private channels: Map<string, IChannelProvider> = new Map();
  private processors: Map<string, any> = new Map();
  private routingRules: Map<string, RoutingRule> = new Map();
  private voiceProcessor: VoiceProcessor;
  private actionHandler: InteractiveActionHandler;

  constructor() {
    super();
    this.voiceProcessor = new VoiceProcessor();
    this.actionHandler = new InteractiveActionHandler();
    this.initializeDefaultRules();
  }

  async initialize(): Promise<void> {
    try {
      await this.voiceProcessor.initialize();
      this.setupDefaultActionHandlers();
      
      logger.info('Content router initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize content router', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Register a communication channel
   */
  registerChannel(channel: CommunicationChannel): void {
    this.channels.set(channel.type, channel);
    logger.info('Communication channel registered', {
      type: channel.type,
      capabilities: channel.capabilities,
    });
  }

  /**
   * Register a content processor
   */
  registerProcessor(type: string, processor: any): void {
    this.processors.set(type, processor);
    logger.info('Content processor registered', { type });
  }

  /**
   * Add a routing rule
   */
  addRoutingRule(rule: RoutingRule): void {
    this.routingRules.set(rule.id, rule);
    logger.info('Routing rule added', {
      ruleId: rule.id,
      name: rule.name,
      contentTypes: rule.contentTypes.map(ct => ct.primary),
      channels: rule.channels,
    });
  }

  /**
   * Process incoming content and route appropriately
   */
  async processAndRoute(request: MessageRequest): Promise<MessageResponse> {
    const startTime = Date.now();
    const processedContent: ProcessedContent = {
      id: `content_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      originalType: await this.detectContentType(request),
      processedType: { primary: 'text', mimeType: 'text/plain', confidence: 1.0 },
      content: '',
      metadata: {},
      attachments: request.attachments || [],
      processingSteps: [],
      timestamp: new Date(),
    };

    try {
      logger.info('Processing content for routing', {
        contentId: processedContent.id,
        originalType: processedContent.originalType.primary,
        hasAttachments: (request.attachments?.length || 0) > 0,
      });

      // Step 1: Content Analysis
      await this.addProcessingStep(processedContent, 'content-analysis', async () => {
        const analysis = await this.analyzeContent(request);
        processedContent.metadata.analysis = analysis;
        processedContent.content = analysis.extractedText;
        return analysis;
      });

      // Step 2: Multi-modal Processing
      await this.addProcessingStep(processedContent, 'multimodal-processing', async () => {
        return await this.processMultiModalContent(request, processedContent);
      });

      // Step 3: Content Enhancement
      await this.addProcessingStep(processedContent, 'content-enhancement', async () => {
        return await this.enhanceContent(processedContent);
      });

      // Step 4: Route Selection
      const routingDecision = await this.addProcessingStep(processedContent, 'route-selection', async () => {
        return await this.selectRoute(processedContent, request);
      });

      // Step 5: Content Delivery
      const deliveryResult = await this.addProcessingStep(processedContent, 'content-delivery', async () => {
        return await this.deliverContent(processedContent, routingDecision, request);
      });

      const processingTime = Date.now() - startTime;
      
      this.emit('contentProcessed', {
        contentId: processedContent.id,
        processingTime,
        success: true,
        route: routingDecision,
      });

      logger.info('Content processed and routed successfully', {
        contentId: processedContent.id,
        processingTime,
        steps: processedContent.processingSteps.length,
        finalChannel: routingDecision.channel,
      });

      return deliveryResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.emit('contentProcessingFailed', {
        contentId: processedContent.id,
        processingTime,
        error: error instanceof Error ? error.message : String(error),
      });

      logger.error('Content processing failed', {
        contentId: processedContent.id,
        processingTime,
        error: error instanceof Error ? error.message : String(error),
        steps: processedContent.processingSteps.length,
      });

      return {
        messageId: request.messageId || `error_${Date.now()}`,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        deliveryStatus: 'failed',
      };
    }
  }

  private async addProcessingStep<T>(
    content: ProcessedContent,
    stepName: string,
    processor: () => Promise<T>
  ): Promise<T> {
    const stepStart = Date.now();
    
    try {
      const result = await processor();
      
      content.processingSteps.push({
        step: stepName,
        timestamp: new Date(),
        duration: Date.now() - stepStart,
        success: true,
        metadata: { result: typeof result === 'object' ? JSON.stringify(result) : String(result) },
      });

      return result;
    } catch (error) {
      content.processingSteps.push({
        step: stepName,
        timestamp: new Date(),
        duration: Date.now() - stepStart,
        success: false,
        metadata: { error: error instanceof Error ? error.message : String(error) },
      });

      throw error;
    }
  }

  private async detectContentType(request: MessageRequest): Promise<ContentType> {
    // Analyze content type based on attachments and content
    if (request.attachments && request.attachments.length > 0) {
      const attachment = request.attachments[0];
      
      if (attachment.type === 'audio' || attachment.mimeType.startsWith('audio/')) {
        return {
          primary: 'voice',
          mimeType: attachment.mimeType,
          confidence: 0.95,
        };
      } else if (attachment.type === 'video' || attachment.mimeType.startsWith('video/')) {
        return {
          primary: 'video',
          mimeType: attachment.mimeType,
          confidence: 0.95,
        };
      } else if (attachment.type === 'image' || attachment.mimeType.startsWith('image/')) {
        return {
          primary: 'image',
          mimeType: attachment.mimeType,
          confidence: 0.95,
        };
      } else if (attachment.type === 'chart') {
        return {
          primary: 'image',
          secondary: 'chart',
          mimeType: attachment.mimeType,
          confidence: 0.9,
        };
      }
    }

    // Check for interactive elements
    if (request.interactiveElements && request.interactiveElements.length > 0) {
      return {
        primary: 'interactive',
        mimeType: 'application/json',
        confidence: 0.9,
      };
    }

    // Default to text
    return {
      primary: 'text',
      mimeType: 'text/plain',
      confidence: 0.8,
    };
  }

  private async analyzeContent(request: MessageRequest): Promise<ContentAnalysisResult> {
    let extractedText = request.content || '';
    const contentType = await this.detectContentType(request);

    // Extract text from various content types
    if (contentType.primary === 'voice' && request.attachments?.[0]) {
      const transcription = await this.voiceProcessor.processVoiceMessage(request.attachments[0]);
      extractedText = transcription.text;
    }

    // Analyze urgency based on keywords and patterns
    const urgency = this.analyzeUrgency(extractedText);
    
    // Extract keywords
    const keywords = this.extractKeywords(extractedText);

    // Simple sentiment analysis
    const sentiment = this.analyzeSentiment(extractedText);

    // Suggest routing
    const routing = this.suggestRouting(extractedText, contentType, urgency);

    return {
      contentType,
      extractedText,
      language: 'en', // Simple detection
      sentiment,
      urgency,
      keywords,
      routing,
    };
  }

  private async processMultiModalContent(
    request: MessageRequest,
    processedContent: ProcessedContent
  ): Promise<void> {
    if (!request.attachments || request.attachments.length === 0) {
      return;
    }

    for (const attachment of request.attachments) {
      switch (attachment.type) {
        case 'audio':
          try {
            const transcription = await this.voiceProcessor.processVoiceMessage(attachment);
            processedContent.content += `\n\n[Audio Transcription: ${transcription.text}]`;
            processedContent.metadata.transcription = transcription;
          } catch (error) {
            logger.warn('Audio transcription failed', {
              filename: attachment.filename,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          break;

        case 'video':
          try {
            const transcription = await this.voiceProcessor.processVideoAudio(attachment);
            processedContent.content += `\n\n[Video Audio Transcription: ${transcription.text}]`;
            processedContent.metadata.videoTranscription = transcription;
          } catch (error) {
            logger.warn('Video audio transcription failed', {
              filename: attachment.filename,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          break;

        case 'image':
        case 'chart':
          // Image analysis would go here
          processedContent.content += `\n\n[Image/Chart: ${attachment.filename}]`;
          break;

        default:
          processedContent.content += `\n\n[Attachment: ${attachment.filename}]`;
          break;
      }
    }
  }

  private async enhanceContent(processedContent: ProcessedContent): Promise<void> {
    // Content enhancement could include:
    // - Language translation
    // - Text cleaning and normalization
    // - Entity recognition
    // - Context enrichment

    // For now, just clean up the text
    processedContent.content = processedContent.content.trim();
    
    // Add metadata about content characteristics
    processedContent.metadata.wordCount = processedContent.content.split(/\s+/).length;
    processedContent.metadata.characterCount = processedContent.content.length;
    processedContent.metadata.hasUrls = /https?:\/\//.test(processedContent.content);
    processedContent.metadata.hasEmails = /@[\w.-]+\.\w+/.test(processedContent.content);
  }

  private async selectRoute(
    processedContent: ProcessedContent,
    request: MessageRequest
  ): Promise<{ channel: string; agent: string; priority: number; reasoning: string }> {
    const analysis = processedContent.metadata.analysis as ContentAnalysisResult;
    
    // Find matching routing rules
    const matchingRules = Array.from(this.routingRules.values())
      .filter(rule => rule.enabled)
      .filter(rule => this.ruleMatches(rule, processedContent, analysis))
      .sort((a, b) => b.priority - a.priority);

    if (matchingRules.length > 0) {
      const rule = matchingRules[0];
      return {
        channel: rule.channels[0] || 'sms',
        agent: 'personal-assistant', // Default agent
        priority: rule.priority,
        reasoning: `Matched routing rule: ${rule.name}`,
      };
    }

    // Default routing based on content analysis
    return {
      channel: analysis.routing.suggestedChannel,
      agent: analysis.routing.suggestedAgent,
      priority: 1,
      reasoning: analysis.routing.reasoning,
    };
  }

  private ruleMatches(
    rule: RoutingRule,
    processedContent: ProcessedContent,
    analysis: ContentAnalysisResult
  ): boolean {
    // Check content type match
    const contentTypeMatch = rule.contentTypes.some(ct => 
      ct.primary === processedContent.originalType.primary
    );
    
    if (!contentTypeMatch) return false;

    // Check conditions if specified
    if (rule.conditions) {
      // Check urgency
      if (rule.conditions.urgency && rule.conditions.urgency !== analysis.urgency) {
        return false;
      }

      // Check keywords
      if (rule.conditions.keywords) {
        const hasKeyword = rule.conditions.keywords.some(keyword =>
          analysis.keywords.includes(keyword.toLowerCase())
        );
        if (!hasKeyword) return false;
      }

      // Time range and user role checks would go here
    }

    return true;
  }

  private async deliverContent(
    processedContent: ProcessedContent,
    routing: { channel: string; agent: string },
    originalRequest: MessageRequest
  ): Promise<MessageResponse> {
    const channel = this.channels.get(routing.channel);
    
    if (!channel) {
      throw new Error(`Channel not found: ${routing.channel}`);
    }

    // Prepare delivery request
    const channelMessage = {
      id: originalRequest.messageId,
      content: processedContent.content,
      timestamp: new Date(),
      channel: routing.channel as any,  // TODO: Fix type conversion
      recipient: originalRequest.recipient,
      attachments: processedContent.attachments,
      metadata: {
        ...originalRequest.metadata,
        processedContentId: processedContent.id,
        routingAgent: routing.agent,
        processingSteps: processedContent.processingSteps.length,
      },
    };

    const deliveryResult = await channel.sendMessage(channelMessage);
    
    return {
      messageId: originalRequest.messageId,
      success: deliveryResult.success,
      deliveryStatus: deliveryResult.deliveryStatus,
      channelMessageId: deliveryResult.messageId,
      error: deliveryResult.error,
      timestamp: new Date(),
      metadata: deliveryResult.metadata,
    };
  }

  private analyzeUrgency(text: string): 'low' | 'medium' | 'high' | 'critical' {
    const urgentKeywords = {
      critical: ['emergency', 'urgent', 'asap', 'immediately', 'critical', 'crisis'],
      high: ['important', 'priority', 'soon', 'today', 'deadline'],
      medium: ['when possible', 'this week', 'follow up'],
    };

    const lowerText = text.toLowerCase();
    
    if (urgentKeywords.critical.some(keyword => lowerText.includes(keyword))) {
      return 'critical';
    } else if (urgentKeywords.high.some(keyword => lowerText.includes(keyword))) {
      return 'high';
    } else if (urgentKeywords.medium.some(keyword => lowerText.includes(keyword))) {
      return 'medium';
    }
    
    return 'low';
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been'].includes(word));

    // Return top keywords by frequency
    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    // Simple sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic'];
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'disappointing', 'frustrated'];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private suggestRouting(
    text: string,
    contentType: ContentType,
    urgency: string
  ): { suggestedChannel: string; suggestedAgent: string; confidence: number; reasoning: string } {
    let suggestedChannel = 'sms';
    let suggestedAgent = 'personal-assistant';
    let confidence = 0.7;
    let reasoning = 'Default routing';

    // Route based on urgency
    if (urgency === 'critical') {
      suggestedChannel = 'sms';
      confidence = 0.9;
      reasoning = 'Critical urgency requires immediate SMS delivery';
    } else if (urgency === 'high') {
      suggestedChannel = 'google_chat';
      confidence = 0.8;
      reasoning = 'High priority best handled via Google Chat';
    }

    // Route based on content type
    if (contentType.primary === 'voice' || contentType.primary === 'video') {
      suggestedAgent = 'personal-assistant';
      confidence = Math.max(confidence, 0.85);
      reasoning += ' - Voice/video content requires personal assistant processing';
    }

    // Route based on content analysis
    const lowerText = text.toLowerCase();
    if (lowerText.includes('chart') || lowerText.includes('dashboard') || lowerText.includes('report')) {
      suggestedChannel = 'google_chat';
      confidence = Math.max(confidence, 0.85);
      reasoning += ' - Visual content best delivered via Google Chat';
    }

    return {
      suggestedChannel,
      suggestedAgent,
      confidence,
      reasoning,
    };
  }

  private initializeDefaultRules(): void {
    // Voice message routing
    this.addRoutingRule({
      id: 'voice-messages',
      name: 'Voice Message Processing',
      contentTypes: [{ primary: 'voice', mimeType: 'audio/*', confidence: 0.9 }],
      channels: ['sms', 'google_chat'],
      priority: 10,
      processing: {
        steps: ['transcription', 'analysis', 'routing'],
        maxProcessingTime: 30000,
        fallbackBehavior: 'forward',
      },
      enabled: true,
    });

    // Critical urgency routing
    this.addRoutingRule({
      id: 'critical-urgency',
      name: 'Critical Urgency Messages',
      contentTypes: [{ primary: 'text', mimeType: 'text/plain', confidence: 1.0 }],
      channels: ['sms'],
      priority: 20,
      conditions: {
        urgency: 'critical',
      },
      processing: {
        steps: ['analysis', 'immediate-routing'],
        maxProcessingTime: 5000,
        fallbackBehavior: 'forward',
      },
      enabled: true,
    });

    // Interactive content routing
    this.addRoutingRule({
      id: 'interactive-content',
      name: 'Interactive Elements',
      contentTypes: [{ primary: 'interactive', mimeType: 'application/json', confidence: 0.9 }],
      channels: ['google_chat'],
      priority: 15,
      processing: {
        steps: ['validation', 'enhancement', 'routing'],
        maxProcessingTime: 10000,
        fallbackBehavior: 'queue',
      },
      enabled: true,
    });
  }

  private setupDefaultActionHandlers(): void {
    // Register common interactive action handlers
    this.actionHandler.registerHandler('quick_approve', async (action) => {
      logger.info('Quick approval action', { actionType: action.type, parameters: action.parameters });
      return { approved: true, timestamp: new Date() };
    });

    this.actionHandler.registerHandler('quick_reject', async (action) => {
      logger.info('Quick rejection action', { actionType: action.type, parameters: action.parameters });
      return { approved: false, timestamp: new Date() };
    });

    this.actionHandler.registerHandler('executive_proceed', async (action) => {
      logger.info('Executive proceed action', { actionType: action.type, parameters: action.parameters });
      return { decision: 'proceed', timestamp: new Date() };
    });
  }

  getChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  getRoutingRules(): RoutingRule[] {
    return Array.from(this.routingRules.values());
  }

  getProcessingStats(): {
    totalProcessed: number;
    averageProcessingTime: number;
    successRate: number;
    byContentType: Record<string, number>;
  } {
    // Implementation would track actual statistics
    return {
      totalProcessed: 0,
      averageProcessingTime: 0,
      successRate: 1.0,
      byContentType: {},
    };
  }

  async shutdown(): Promise<void> {
    await this.voiceProcessor.shutdown();
    logger.info('Content router shut down');
  }
}

export default ContentRouter;