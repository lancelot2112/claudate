import { EventEmitter } from 'events';
import { MessageRequest, MediaAttachment } from '../../types/Communication';
import logger from '../../utils/logger';

export interface ContentComplexity {
  level: 'simple' | 'moderate' | 'complex' | 'highly_complex';
  score: number; // 0-100
  factors: {
    textComplexity: number;
    technicalTerms: number;
    dataVisualization: number;
    interactiveElements: number;
    attachmentComplexity: number;
    multiModal: number;
  };
  reasoning: string[];
}

export interface ChannelRecommendation {
  channel: string;
  confidence: number; // 0-1
  reasoning: string;
  fallbackChannels: string[];
  urgencyAdjustment?: {
    originalChannel: string;
    adjustedChannel: string;
    reason: string;
  };
}

export interface ContentAnalysisResult {
  id: string;
  timestamp: Date;
  content: {
    type: 'text' | 'voice' | 'video' | 'mixed';
    wordCount: number;
    sentiment: 'positive' | 'negative' | 'neutral';
    language: string;
    topics: string[];
  };
  complexity: ContentComplexity;
  urgency: {
    level: 'low' | 'medium' | 'high' | 'critical';
    indicators: string[];
    timeConstraints?: {
      deadline?: Date;
      responseRequired: boolean;
    };
  };
  channelRecommendation: ChannelRecommendation;
  executiveLevel: {
    isExecutiveContent: boolean;
    decisionRequired: boolean;
    actionItems: number;
    briefingWorthy: boolean;
  };
  metadata: {
    processingTime: number;
    confidence: number;
    version: string;
  };
}

export interface ChannelCapabilities {
  channel: string;
  capabilities: {
    maxTextLength: number;
    supportsRichFormatting: boolean;
    supportsAttachments: boolean;
    supportsInteractive: boolean;
    supportsVoice: boolean;
    supportsVideo: boolean;
    supportsCharts: boolean;
    supportsThreading: boolean;
  };
  executiveSuitability: {
    mobileFriendly: boolean;
    discreet: boolean;
    professionalAppearance: boolean;
    quickAccess: boolean;
  };
  deliveryCharacteristics: {
    immediacy: 'instant' | 'near-instant' | 'delayed';
    reliability: number; // 0-1
    readReceipts: boolean;
    quietHoursRespect: boolean;
  };
}

export class ContentAnalyzer extends EventEmitter {
  private channelCapabilities: Map<string, ChannelCapabilities> = new Map();
  private analysisHistory: Map<string, ContentAnalysisResult> = new Map();
  private learningData: {
    channelPreferences: Map<string, Record<string, number>>;
    contentPatterns: Map<string, number>;
    urgencyIndicators: Map<string, number>;
  };

  constructor() {
    super();
    this.learningData = {
      channelPreferences: new Map(),
      contentPatterns: new Map(),
      urgencyIndicators: new Map(),
    };
    this.initializeChannelCapabilities();
  }

  async initialize(): Promise<void> {
    logger.info('Content analyzer initialized with intelligent channel selection');
  }

  /**
   * Analyze content and recommend optimal communication channel
   */
  async analyzeContent(request: MessageRequest, userContext?: {
    userId: string;
    role: string;
    preferences?: Record<string, any>;
    currentTime: Date;
    timezone: string;
  }): Promise<ContentAnalysisResult> {
    const startTime = Date.now();
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    try {
      logger.info('Starting content analysis', {
        analysisId,
        hasAttachments: (request.attachments?.length || 0) > 0,
        hasInteractive: (request.interactiveElements?.length || 0) > 0,
        userRole: userContext?.role,
      });

      // Step 1: Basic content analysis
      const contentInfo = await this.analyzeBasicContent(request);

      // Step 2: Complexity analysis
      const complexity = await this.analyzeComplexity(request, contentInfo);

      // Step 3: Urgency detection
      const urgency = await this.detectUrgency(request, userContext);

      // Step 4: Executive level assessment
      const executiveLevel = await this.assessExecutiveLevel(request, contentInfo, urgency);

      // Step 5: Channel recommendation
      const channelRecommendation = await this.recommendChannel(
        complexity,
        urgency,
        executiveLevel,
        userContext
      );

      const processingTime = Date.now() - startTime;

      const result: ContentAnalysisResult = {
        id: analysisId,
        timestamp: new Date(),
        content: contentInfo,
        complexity,
        urgency,
        channelRecommendation,
        executiveLevel,
        metadata: {
          processingTime,
          confidence: this.calculateOverallConfidence(complexity, urgency, channelRecommendation),
          version: '1.0',
        },
      };

      this.analysisHistory.set(analysisId, result);
      this.updateLearningData(result, userContext);

      this.emit('contentAnalyzed', {
        analysisId,
        complexity: complexity.level,
        urgency: urgency.level,
        recommendedChannel: channelRecommendation.channel,
        processingTime,
      });

      logger.info('Content analysis completed', {
        analysisId,
        complexity: complexity.level,
        urgency: urgency.level,
        recommendedChannel: channelRecommendation.channel,
        processingTime,
        confidence: result.metadata.confidence,
      });

      return result;
    } catch (error) {
      logger.error('Content analysis failed', {
        analysisId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async analyzeBasicContent(request: MessageRequest): Promise<ContentAnalysisResult['content']> {
    const text = request.content || '';
    // const hasAttachments = (request.attachments?.length || 0) > 0; // Unused for now
    const hasVoice = request.attachments?.some(a => a.type === 'audio') || false;
    const hasVideo = request.attachments?.some(a => a.type === 'video') || false;

    // Determine content type
    let type: 'text' | 'voice' | 'video' | 'mixed';
    if (hasVoice && hasVideo) type = 'mixed';
    else if (hasVideo) type = 'video';
    else if (hasVoice) type = 'voice';
    else type = 'text';

    // Basic text analysis
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    // Simple sentiment analysis
    const sentiment = this.analyzeSentiment(text);

    // Topic extraction
    const topics = this.extractTopics(text);

    // Language detection (simplified)
    const language = 'en'; // Could be enhanced with actual language detection

    return {
      type,
      wordCount,
      sentiment,
      language,
      topics,
    };
  }

  private async analyzeComplexity(
    request: MessageRequest,
    contentInfo: ContentAnalysisResult['content']
  ): Promise<ContentComplexity> {
    const factors = {
      textComplexity: 0,
      technicalTerms: 0,
      dataVisualization: 0,
      interactiveElements: 0,
      attachmentComplexity: 0,
      multiModal: 0,
    };

    const reasoning: string[] = [];

    // Text complexity analysis
    const text = request.content || '';
    factors.textComplexity = this.calculateTextComplexity(text);
    if (factors.textComplexity > 60) {
      reasoning.push('High text complexity with advanced vocabulary');
    }

    // Technical terms detection
    factors.technicalTerms = this.detectTechnicalTerms(text);
    if (factors.technicalTerms > 50) {
      reasoning.push('Contains significant technical terminology');
    }

    // Data visualization analysis
    const hasCharts = request.attachments?.some(a => a.type === 'chart') || false;
    factors.dataVisualization = hasCharts ? 80 : 0;
    if (hasCharts) {
      reasoning.push('Includes data visualizations or charts');
    }

    // Interactive elements
    const interactiveCount = request.interactiveElements?.length || 0;
    factors.interactiveElements = Math.min(100, interactiveCount * 25);
    if (interactiveCount > 0) {
      reasoning.push(`Contains ${interactiveCount} interactive elements`);
    }

    // Attachment complexity
    factors.attachmentComplexity = this.calculateAttachmentComplexity(request.attachments || []);
    if (factors.attachmentComplexity > 50) {
      reasoning.push('Complex multimedia attachments present');
    }

    // Multi-modal content
    const contentTypes = new Set();
    if (text.length > 0) contentTypes.add('text');
    if (request.attachments?.some(a => a.type === 'audio')) contentTypes.add('audio');
    if (request.attachments?.some(a => a.type === 'video')) contentTypes.add('video');
    if (request.attachments?.some(a => a.type === 'image')) contentTypes.add('image');

    factors.multiModal = contentTypes.size > 1 ? (contentTypes.size - 1) * 30 : 0;
    if (factors.multiModal > 0) {
      reasoning.push(`Multi-modal content with ${contentTypes.size} different media types`);
    }

    // Calculate overall complexity score
    const score = Object.values(factors).reduce((sum, factor) => sum + factor, 0) / 6;

    let level: ContentComplexity['level'];
    if (score < 25) level = 'simple';
    else if (score < 50) level = 'moderate';
    else if (score < 75) level = 'complex';
    else level = 'highly_complex';

    return {
      level,
      score,
      factors,
      reasoning,
    };
  }

  private calculateTextComplexity(text: string): number {
    if (!text || text.length === 0) return 0;

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    // Average sentence length
    const avgSentenceLength = words.length / sentences.length;
    
    // Long word ratio
    const longWords = words.filter(w => w.length > 6).length;
    const longWordRatio = longWords / words.length;
    
    // Complex punctuation
    const complexPunctuation = (text.match(/[;:()[\]{}]/g) || []).length;
    const punctuationScore = Math.min(50, (complexPunctuation / words.length) * 100);
    
    // Calculate complexity score
    let score = 0;
    
    // Sentence length contribution (0-40 points)
    if (avgSentenceLength > 20) score += 40;
    else if (avgSentenceLength > 15) score += 30;
    else if (avgSentenceLength > 10) score += 20;
    else score += 10;
    
    // Long word contribution (0-40 points)
    score += longWordRatio * 40;
    
    // Punctuation contribution (0-20 points)
    score += punctuationScore * 0.4;
    
    return Math.min(100, score);
  }

  private detectTechnicalTerms(text: string): number {
    const technicalTerms = [
      // Technology
      'api', 'algorithm', 'database', 'infrastructure', 'framework', 'deployment',
      'authentication', 'encryption', 'bandwidth', 'latency', 'scalability',
      // Business
      'roi', 'kpi', 'metrics', 'analytics', 'optimization', 'conversion',
      'acquisition', 'retention', 'churn', 'revenue', 'margin', 'ebitda',
      // AI/ML
      'machine learning', 'artificial intelligence', 'neural network', 'model',
      'training', 'inference', 'embedding', 'vectorization', 'classification',
      // Project Management
      'milestone', 'deliverable', 'stakeholder', 'timeline', 'resource allocation',
      'sprint', 'backlog', 'agile', 'scrum', 'kanban',
    ];

    const lowerText = text.toLowerCase();
    const foundTerms = technicalTerms.filter(term => lowerText.includes(term));
    
    return Math.min(100, (foundTerms.length / technicalTerms.length) * 100 * 5);
  }

  private calculateAttachmentComplexity(attachments: MediaAttachment[]): number {
    if (attachments.length === 0) return 0;

    let complexity = 0;
    
    for (const attachment of attachments) {
      switch (attachment.type) {
        case 'image':
          complexity += 20;
          break;
        case 'audio':
          complexity += 40;
          break;
        case 'video':
          complexity += 60;
          break;
        case 'chart':
          complexity += 50;
          break;
        case 'document':
          complexity += 30;
          break;
        default:
          complexity += 10;
      }
    }

    return Math.min(100, complexity / attachments.length);
  }

  private async detectUrgency(
    request: MessageRequest,
    userContext?: { currentTime: Date; timezone: string }
  ): Promise<ContentAnalysisResult['urgency']> {
    const text = (request.content || '').toLowerCase();
    const indicators: string[] = [];
    let score = 0;

    // Urgency keywords
    const urgencyKeywords = {
      critical: ['emergency', 'critical', 'urgent', 'asap', 'immediately', 'crisis'],
      high: ['important', 'priority', 'deadline', 'today', 'now', 'soon'],
      medium: ['follow up', 'this week', 'when possible', 'reminder'],
    };

    // Check for urgency indicators
    for (const [level, keywords] of Object.entries(urgencyKeywords)) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          indicators.push(`Found "${keyword}" (${level} urgency)`);
          
          switch (level) {
            case 'critical':
              score += 30;
              break;
            case 'high':
              score += 20;
              break;
            case 'medium':
              score += 10;
              break;
          }
        }
      }
    }

    // Time-based urgency
    if (userContext?.currentTime) {
      const hour = userContext.currentTime.getHours();
      
      // After hours communication suggests urgency
      if (hour < 7 || hour > 19) {
        score += 15;
        indicators.push('Sent outside business hours');
      }
      
      // Weekend communication
      const day = userContext.currentTime.getDay();
      if (day === 0 || day === 6) {
        score += 10;
        indicators.push('Sent on weekend');
      }
    }

    // Punctuation urgency indicators
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 2) {
      score += exclamationCount * 5;
      indicators.push(`Multiple exclamation marks (${exclamationCount})`);
    }

    // ALL CAPS detection
    const capsWords = text.split(/\s+/).filter(word => 
      word.length > 2 && word === word.toUpperCase() && /[A-Z]/.test(word)
    );
    if (capsWords.length > 0) {
      score += capsWords.length * 5;
      indicators.push(`ALL CAPS words detected (${capsWords.length})`);
    }

    // Question urgency
    const questionCount = (text.match(/\?/g) || []).length;
    if (questionCount > 2) {
      score += 5;
      indicators.push('Multiple questions suggest need for response');
    }

    // Determine urgency level
    let level: 'low' | 'medium' | 'high' | 'critical';
    if (score >= 50) level = 'critical';
    else if (score >= 30) level = 'high';
    else if (score >= 15) level = 'medium';
    else level = 'low';

    return {
      level,
      indicators,
      timeConstraints: this.extractTimeConstraints(text),
    };
  }

  private extractTimeConstraints(text: string): { deadline?: Date; responseRequired: boolean } | undefined {
    const lowerText = text.toLowerCase();
    
    // Look for response requirements
    const responseRequired = 
      lowerText.includes('respond') ||
      lowerText.includes('reply') ||
      lowerText.includes('answer') ||
      lowerText.includes('feedback') ||
      lowerText.includes('decision');

    // Simple deadline detection
    let deadline: Date | undefined;
    
    if (lowerText.includes('today')) {
      deadline = new Date();
      deadline.setHours(23, 59, 59, 999);
    } else if (lowerText.includes('tomorrow')) {
      deadline = new Date();
      deadline.setDate(deadline.getDate() + 1);
      deadline.setHours(23, 59, 59, 999);
    } else if (lowerText.includes('this week')) {
      deadline = new Date();
      const daysUntilFriday = 5 - deadline.getDay();
      deadline.setDate(deadline.getDate() + daysUntilFriday);
      deadline.setHours(23, 59, 59, 999);
    }

    if (deadline || responseRequired) {
      return { deadline, responseRequired };
    }

    return undefined;
  }

  private async assessExecutiveLevel(
    request: MessageRequest,
    contentInfo: ContentAnalysisResult['content'],
    urgency: ContentAnalysisResult['urgency']
  ): Promise<ContentAnalysisResult['executiveLevel']> {
    const text = (request.content || '').toLowerCase();
    
    // Executive indicators
    const executiveKeywords = [
      'decision', 'strategy', 'budget', 'revenue', 'executive', 'board',
      'ceo', 'cto', 'cfo', 'leadership', 'vision', 'investment', 'acquisition',
      'merger', 'partnership', 'stakeholder', 'shareholder', 'quarterly',
      'annual', 'forecast', 'planning', 'roadmap'
    ];

    const executiveIndicators = executiveKeywords.filter(keyword => text.includes(keyword));
    const isExecutiveContent = executiveIndicators.length >= 2 || urgency.level === 'critical';

    // Decision requirement detection
    const decisionKeywords = ['decide', 'decision', 'choose', 'approve', 'authorize', 'sign off'];
    const decisionRequired = decisionKeywords.some(keyword => text.includes(keyword));

    // Action item extraction
    const actionItems = this.countActionItems(text);

    // Briefing worthiness
    const briefingWorthy = 
      isExecutiveContent || 
      urgency.level === 'high' || 
      urgency.level === 'critical' ||
      decisionRequired ||
      actionItems > 2 ||
      contentInfo.wordCount > 100;

    return {
      isExecutiveContent,
      decisionRequired,
      actionItems,
      briefingWorthy,
    };
  }

  private countActionItems(text: string): number {
    const actionPatterns = [
      /need to\s+\w+/gi,
      /should\s+\w+/gi,
      /must\s+\w+/gi,
      /action:\s*\w+/gi,
      /todo:\s*\w+/gi,
      /follow.?up:\s*\w+/gi,
    ];

    let count = 0;
    for (const pattern of actionPatterns) {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    }

    return count;
  }

  private async recommendChannel(
    complexity: ContentComplexity,
    urgency: ContentAnalysisResult['urgency'],
    executiveLevel: ContentAnalysisResult['executiveLevel'],
    userContext?: { userId: string; role: string; preferences?: Record<string, any> }
  ): Promise<ChannelRecommendation> {
    const channelScores: Record<string, { score: number; reasons: string[] }> = {};

    // Initialize all channels
    for (const channel of this.channelCapabilities.keys()) {
      channelScores[channel] = { score: 0, reasons: [] };
    }

    // Urgency-based scoring
    this.applyUrgencyScoring(channelScores, urgency);

    // Complexity-based scoring
    this.applyComplexityScoring(channelScores, complexity);

    // Executive-level scoring
    this.applyExecutiveScoring(channelScores, executiveLevel);

    // User preference scoring
    if (userContext) {
      this.applyUserPreferenceScoring(channelScores, userContext);
    }

    // Find the best channel
    const sortedChannels = Object.entries(channelScores)
      .sort(([, a], [, b]) => b.score - a.score);

    const [bestChannel, bestScore] = sortedChannels[0] || ['email', { score: 0, reasons: [] }];
    const confidence = Math.min(1.0, (bestScore?.score || 0) / 100);

    // Create fallback list
    const fallbackChannels = sortedChannels
      .slice(1, 4)
      .map(([channel]) => channel);

    // Check for urgency adjustments
    const urgencyAdjustment = this.checkUrgencyAdjustment(bestChannel, urgency);

    const finalChannel = urgencyAdjustment?.adjustedChannel || bestChannel;
    const reasoning = bestScore.reasons.join('; ');

    return {
      channel: finalChannel,
      confidence,
      reasoning,
      fallbackChannels,
      urgencyAdjustment,
    };
  }

  private applyUrgencyScoring(
    channelScores: Record<string, { score: number; reasons: string[] }>,
    urgency: ContentAnalysisResult['urgency']
  ): void {
    switch (urgency.level) {
      case 'critical':
        channelScores['sms']?.score && (channelScores['sms'].score += 40);
        channelScores['sms']?.reasons?.push('Critical urgency requires immediate SMS delivery');
        break;
      case 'high':
        channelScores['sms'] && (channelScores['sms'].score += 30);
        channelScores['google_chat'] && (channelScores['google_chat'].score += 25);
        channelScores['sms']?.reasons?.push('High urgency favors SMS');
        channelScores['google_chat']?.reasons?.push('High urgency suitable for Google Chat');
        break;
      case 'medium':
        channelScores['google_chat'] && (channelScores['google_chat'].score += 30);
        channelScores['email'] && (channelScores['email'].score += 20);
        channelScores['google_chat']?.reasons?.push('Medium urgency well-suited for Google Chat');
        break;
      case 'low':
        channelScores['email'] && (channelScores['email'].score += 30);
        channelScores['google_chat'] && (channelScores['google_chat'].score += 20);
        channelScores['email']?.reasons?.push('Low urgency appropriate for email');
        break;
    }
  }

  private applyComplexityScoring(
    channelScores: Record<string, { score: number; reasons: string[] }>,
    complexity: ContentComplexity
  ): void {
    switch (complexity.level) {
      case 'highly_complex':
        channelScores['google_chat'] && (channelScores['google_chat'].score += 40);
        channelScores['email'] && (channelScores['email'].score += 35);
        channelScores['google_chat']?.reasons?.push('High complexity requires rich formatting');
        break;
      case 'complex':
        channelScores['google_chat'] && (channelScores['google_chat'].score += 30);
        channelScores['email'] && (channelScores['email'].score += 25);
        channelScores['google_chat']?.reasons?.push('Complex content benefits from Google Chat features');
        break;
      case 'moderate':
        channelScores['google_chat'] && (channelScores['google_chat'].score += 20);
        channelScores['mms'] && (channelScores['mms'].score += 15);
        channelScores['sms'] && (channelScores['sms'].score += 10);
        break;
      case 'simple':
        channelScores['sms'] && (channelScores['sms'].score += 30);
        channelScores['mms'] && (channelScores['mms'].score += 20);
        channelScores['sms']?.reasons?.push('Simple content perfect for SMS');
        break;
    }

    // Factor-specific adjustments
    if (complexity.factors.dataVisualization > 50) {
      channelScores['google_chat'] && (channelScores['google_chat'].score += 25);
      channelScores['email'] && (channelScores['email'].score += 20);
      channelScores['google_chat']?.reasons?.push('Data visualization requires rich media support');
    }

    if (complexity.factors.interactiveElements > 50) {
      channelScores['google_chat'] && (channelScores['google_chat'].score += 30);
      channelScores['google_chat']?.reasons?.push('Interactive elements require Google Chat');
    }

    if (complexity.factors.multiModal > 50) {
      channelScores['google_chat'] && (channelScores['google_chat'].score += 25);
      channelScores['email'] && (channelScores['email'].score += 15);
      channelScores['google_chat']?.reasons?.push('Multi-modal content needs comprehensive platform');
    }
  }

  private applyExecutiveScoring(
    channelScores: Record<string, { score: number; reasons: string[] }>,
    executiveLevel: ContentAnalysisResult['executiveLevel']
  ): void {
    if (executiveLevel.isExecutiveContent) {
      channelScores['google_chat'] && (channelScores['google_chat'].score += 25);
      channelScores['email'] && (channelScores['email'].score += 20);
      channelScores['google_chat']?.reasons?.push('Executive content benefits from professional presentation');
    }

    if (executiveLevel.decisionRequired) {
      channelScores['google_chat'] && (channelScores['google_chat'].score += 20);
      channelScores['sms'] && (channelScores['sms'].score += 15);
      channelScores['google_chat']?.reasons?.push('Decision requirements need interactive capabilities');
    }

    if (executiveLevel.briefingWorthy) {
      channelScores['google_chat'] && (channelScores['google_chat'].score += 15);
      channelScores['email'] && (channelScores['email'].score += 10);
      channelScores['google_chat']?.reasons?.push('Briefing-worthy content suits Google Chat format');
    }
  }

  private applyUserPreferenceScoring(
    channelScores: Record<string, { score: number; reasons: string[] }>,
    userContext: { userId: string; role: string; preferences?: Record<string, any> }
  ): void {
    // Learn from user's historical preferences
    const userPrefs = this.learningData.channelPreferences.get(userContext.userId);
    
    if (userPrefs) {
      for (const [channel, preference] of Object.entries(userPrefs)) {
        if (channelScores[channel]) {
          channelScores[channel].score += preference * 10;
          channelScores[channel].reasons.push(`User preference based on history`);
        }
      }
    }

    // Role-based preferences
    if (userContext.role === 'executive' || userContext.role === 'ceo') {
      channelScores['sms'] && (channelScores['sms'].score += 15);
      channelScores['google_chat'] && (channelScores['google_chat'].score += 10);
      channelScores['sms']?.reasons?.push('Executive role prefers immediate channels');
    }
  }

  private checkUrgencyAdjustment(
    recommendedChannel: string,
    urgency: ContentAnalysisResult['urgency']
  ): ChannelRecommendation['urgencyAdjustment'] {
    // Override channel for critical urgency
    if (urgency.level === 'critical' && recommendedChannel !== 'sms') {
      return {
        originalChannel: recommendedChannel,
        adjustedChannel: 'sms',
        reason: 'Critical urgency requires immediate SMS delivery',
      };
    }

    return undefined;
  }

  private analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['success', 'great', 'excellent', 'good', 'positive', 'amazing', 'wonderful'];
    const negativeWords = ['problem', 'issue', 'bad', 'terrible', 'negative', 'failed', 'error'];

    const lowerText = text.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private extractTopics(text: string): string[] {
    const topicKeywords = {
      'project-management': ['project', 'milestone', 'deadline', 'task', 'deliverable'],
      'financial': ['budget', 'revenue', 'cost', 'profit', 'financial', 'money'],
      'technical': ['system', 'software', 'technical', 'development', 'infrastructure'],
      'team': ['team', 'staff', 'employee', 'hire', 'management', 'people'],
      'customer': ['customer', 'client', 'user', 'satisfaction', 'feedback'],
      'strategy': ['strategy', 'plan', 'goal', 'objective', 'vision', 'roadmap'],
    };

    const lowerText = text.toLowerCase();
    const topics: string[] = [];

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      const matchCount = keywords.filter(keyword => lowerText.includes(keyword)).length;
      if (matchCount >= 2) {
        topics.push(topic);
      }
    }

    return topics;
  }

  private calculateOverallConfidence(
    complexity: ContentComplexity,
    urgency: ContentAnalysisResult['urgency'],
    recommendation: ChannelRecommendation
  ): number {
    // Base confidence from recommendation
    let confidence = recommendation.confidence;

    // Adjust based on clear urgency indicators
    if (urgency.indicators.length > 2) {
      confidence += 0.1;
    }

    // Adjust based on complexity clarity
    if (complexity.reasoning.length > 2) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  private updateLearningData(
    result: ContentAnalysisResult,
    userContext?: { userId: string; role: string }
  ): void {
    // Update urgency indicators
    for (const indicator of result.urgency.indicators) {
      const current = this.learningData.urgencyIndicators.get(indicator) || 0;
      this.learningData.urgencyIndicators.set(indicator, current + 1);
    }

    // Update content patterns
    for (const topic of result.content.topics) {
      const current = this.learningData.contentPatterns.get(topic) || 0;
      this.learningData.contentPatterns.set(topic, current + 1);
    }

    // Update user channel preferences (would be enhanced with actual usage feedback)
    if (userContext) {
      const userPrefs = this.learningData.channelPreferences.get(userContext.userId) || {};
      const channel = result.channelRecommendation.channel;
      userPrefs[channel] = (userPrefs[channel] || 0) + 0.1;
      this.learningData.channelPreferences.set(userContext.userId, userPrefs);
    }
  }

  private initializeChannelCapabilities(): void {
    // SMS capabilities
    this.channelCapabilities.set('sms', {
      channel: 'sms',
      capabilities: {
        maxTextLength: 160,
        supportsRichFormatting: false,
        supportsAttachments: false,
        supportsInteractive: false,
        supportsVoice: false,
        supportsVideo: false,
        supportsCharts: false,
        supportsThreading: false,
      },
      executiveSuitability: {
        mobileFriendly: true,
        discreet: true,
        professionalAppearance: true,
        quickAccess: true,
      },
      deliveryCharacteristics: {
        immediacy: 'instant',
        reliability: 0.98,
        readReceipts: true,
        quietHoursRespect: false,
      },
    });

    // MMS capabilities
    this.channelCapabilities.set('mms', {
      channel: 'mms',
      capabilities: {
        maxTextLength: 1600,
        supportsRichFormatting: false,
        supportsAttachments: true,
        supportsInteractive: false,
        supportsVoice: false,
        supportsVideo: false,
        supportsCharts: true,
        supportsThreading: false,
      },
      executiveSuitability: {
        mobileFriendly: true,
        discreet: true,
        professionalAppearance: true,
        quickAccess: true,
      },
      deliveryCharacteristics: {
        immediacy: 'near-instant',
        reliability: 0.95,
        readReceipts: true,
        quietHoursRespect: false,
      },
    });

    // Google Chat capabilities
    this.channelCapabilities.set('google_chat', {
      channel: 'google_chat',
      capabilities: {
        maxTextLength: 8000,
        supportsRichFormatting: true,
        supportsAttachments: true,
        supportsInteractive: true,
        supportsVoice: true,
        supportsVideo: true,
        supportsCharts: true,
        supportsThreading: true,
      },
      executiveSuitability: {
        mobileFriendly: true,
        discreet: false,
        professionalAppearance: true,
        quickAccess: true,
      },
      deliveryCharacteristics: {
        immediacy: 'near-instant',
        reliability: 0.92,
        readReceipts: true,
        quietHoursRespect: true,
      },
    });

    // Email capabilities
    this.channelCapabilities.set('email', {
      channel: 'email',
      capabilities: {
        maxTextLength: 100000,
        supportsRichFormatting: true,
        supportsAttachments: true,
        supportsInteractive: false,
        supportsVoice: false,
        supportsVideo: false,
        supportsCharts: true,
        supportsThreading: true,
      },
      executiveSuitability: {
        mobileFriendly: false,
        discreet: false,
        professionalAppearance: true,
        quickAccess: false,
      },
      deliveryCharacteristics: {
        immediacy: 'delayed',
        reliability: 0.99,
        readReceipts: false,
        quietHoursRespect: true,
      },
    });
  }

  // Public methods for accessing analysis results
  getAnalysisResult(analysisId: string): ContentAnalysisResult | undefined {
    return this.analysisHistory.get(analysisId);
  }

  getChannelCapabilities(): ChannelCapabilities[] {
    return Array.from(this.channelCapabilities.values());
  }

  getLearningData(): typeof this.learningData {
    return this.learningData;
  }

  getAnalysisHistory(limit: number = 100): ContentAnalysisResult[] {
    return Array.from(this.analysisHistory.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  clearAnalysisHistory(): void {
    this.analysisHistory.clear();
    logger.info('Analysis history cleared');
  }

  getSystemStats(): {
    totalAnalyses: number;
    channelRecommendations: Record<string, number>;
    urgencyDistribution: Record<string, number>;
    complexityDistribution: Record<string, number>;
  } {
    const analyses = Array.from(this.analysisHistory.values());
    
    const channelRecommendations: Record<string, number> = {};
    const urgencyDistribution: Record<string, number> = {};
    const complexityDistribution: Record<string, number> = {};

    for (const analysis of analyses) {
      // Channel recommendations
      const channel = analysis.channelRecommendation.channel;
      channelRecommendations[channel] = (channelRecommendations[channel] || 0) + 1;

      // Urgency distribution
      const urgency = analysis.urgency.level;
      urgencyDistribution[urgency] = (urgencyDistribution[urgency] || 0) + 1;

      // Complexity distribution
      const complexity = analysis.complexity.level;
      complexityDistribution[complexity] = (complexityDistribution[complexity] || 0) + 1;
    }

    return {
      totalAnalyses: analyses.length,
      channelRecommendations,
      urgencyDistribution,
      complexityDistribution,
    };
  }
}

export default ContentAnalyzer;