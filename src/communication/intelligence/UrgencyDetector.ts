import { EventEmitter } from 'events';
import { MessageRequest } from '../../types/Communication';
import logger from '../../utils/logger';

export interface UrgencyLevel {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number; // 0-100
  confidence: number; // 0-1
}

export interface UrgencyIndicator {
  type: 'keyword' | 'temporal' | 'contextual' | 'punctuation' | 'behavioral';
  indicator: string;
  weight: number;
  confidence: number;
  reasoning: string;
}

export interface EscalationRule {
  id: string;
  name: string;
  description: string;
  triggerConditions: {
    urgencyLevel: UrgencyLevel['level'];
    timeThresholds?: {
      noResponse: number; // minutes
      noAcknowledgment: number; // minutes
    };
    keywords?: string[];
    userRoles?: string[];
    businessHours?: boolean;
  };
  escalationSteps: Array<{
    step: number;
    delay: number; // minutes
    channels: string[];
    recipients: string[];
    template?: string;
    notificationSound?: boolean;
  }>;
  maxEscalations: number;
  cooldownPeriod: number; // minutes
  enabled: boolean;
}

export interface UrgencyContext {
  messageId: string;
  userId: string;
  userRole: string;
  timestamp: Date;
  businessHours: boolean;
  timeZone: string;
  previousEscalations: number;
  relatedIncidents: string[];
}

export interface EscalationEvent {
  id: string;
  messageId: string;
  ruleId: string;
  step: number;
  timestamp: Date;
  channels: string[];
  recipients: string[];
  reason: string;
  success: boolean;
  nextEscalation?: Date;
}

export class UrgencyDetector extends EventEmitter {
  private escalationRules: Map<string, EscalationRule> = new Map();
  private activeEscalations: Map<string, EscalationEvent[]> = new Map();
  private urgencyHistory: Map<string, UrgencyLevel[]> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
  }

  async initialize(): Promise<void> {
    logger.info('Urgency detector initialized with escalation patterns');
  }

  /**
   * Detect urgency level and trigger escalations if necessary
   */
  async detectUrgency(
    request: MessageRequest,
    context: UrgencyContext
  ): Promise<{
    urgency: UrgencyLevel;
    indicators: UrgencyIndicator[];
    escalationTriggered: boolean;
    escalationEvents: EscalationEvent[];
  }> {
    const startTime = Date.now();

    try {
      logger.info('Detecting urgency', {
        messageId: context.messageId,
        userId: context.userId,
        userRole: context.userRole,
        businessHours: context.businessHours,
      });

      // Step 1: Analyze urgency indicators
      const indicators = await this.analyzeUrgencyIndicators(request, context);

      // Step 2: Calculate urgency level
      const urgency = this.calculateUrgencyLevel(indicators, context);

      // Step 3: Check for escalation triggers
      const { escalationTriggered, escalationEvents } = await this.checkEscalationTriggers(
        urgency,
        request,
        context
      );

      // Step 4: Record urgency history
      this.recordUrgencyHistory(context.userId, urgency);

      const processingTime = Date.now() - startTime;

      this.emit('urgencyDetected', {
        messageId: context.messageId,
        urgencyLevel: urgency.level,
        score: urgency.score,
        confidence: urgency.confidence,
        indicatorCount: indicators.length,
        escalationTriggered,
        processingTime,
      });

      logger.info('Urgency detection completed', {
        messageId: context.messageId,
        urgencyLevel: urgency.level,
        score: urgency.score,
        escalationTriggered,
        processingTime,
      });

      return {
        urgency,
        indicators,
        escalationTriggered,
        escalationEvents,
      };
    } catch (error) {
      logger.error('Urgency detection failed', {
        messageId: context.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async analyzeUrgencyIndicators(
    request: MessageRequest,
    context: UrgencyContext
  ): Promise<UrgencyIndicator[]> {
    const indicators: UrgencyIndicator[] = [];
    const text = (request.content || '').toLowerCase();

    // Keyword-based indicators
    indicators.push(...this.detectKeywordIndicators(text));

    // Temporal indicators
    indicators.push(...this.detectTemporalIndicators(context));

    // Contextual indicators
    indicators.push(...this.detectContextualIndicators(request, context));

    // Punctuation indicators
    indicators.push(...this.detectPunctuationIndicators(request.content || ''));

    // Behavioral indicators
    indicators.push(...this.detectBehavioralIndicators(context));

    return indicators.sort((a, b) => b.weight - a.weight);
  }

  private detectKeywordIndicators(text: string): UrgencyIndicator[] {
    const indicators: UrgencyIndicator[] = [];

    const urgencyKeywords = {
      critical: {
        keywords: ['emergency', 'critical', 'crisis', 'catastrophic', 'disaster', 'outage', 'down', 'broken'],
        weight: 25,
        confidence: 0.9,
      },
      immediate: {
        keywords: ['urgent', 'immediate', 'asap', 'now', 'right away', 'instantly', 'stat'],
        weight: 20,
        confidence: 0.85,
      },
      deadline: {
        keywords: ['deadline', 'due today', 'expires', 'cutoff', 'final notice', 'last chance'],
        weight: 18,
        confidence: 0.8,
      },
      escalation: {
        keywords: ['escalate', 'escalation', 'supervisor', 'manager', 'boss', 'leadership'],
        weight: 15,
        confidence: 0.75,
      },
      priority: {
        keywords: ['priority', 'important', 'crucial', 'vital', 'essential', 'key'],
        weight: 12,
        confidence: 0.7,
      },
      time_sensitive: {
        keywords: ['time sensitive', 'time critical', 'clock ticking', 'running out of time'],
        weight: 16,
        confidence: 0.8,
      },
    };

    for (const [category, data] of Object.entries(urgencyKeywords)) {
      for (const keyword of data.keywords) {
        if (text.includes(keyword)) {
          indicators.push({
            type: 'keyword',
            indicator: keyword,
            weight: data.weight,
            confidence: data.confidence,
            reasoning: `High-urgency keyword "${keyword}" detected in ${category} category`,
          });
        }
      }
    }

    return indicators;
  }

  private detectTemporalIndicators(context: UrgencyContext): UrgencyIndicator[] {
    const indicators: UrgencyIndicator[] = [];
    const now = context.timestamp;
    const hour = now.getHours();
    const day = now.getDay();

    // After-hours communication
    if (!context.businessHours) {
      if (hour < 6 || hour > 22) {
        indicators.push({
          type: 'temporal',
          indicator: 'very-late-hours',
          weight: 20,
          confidence: 0.8,
          reasoning: 'Communication sent during very late hours suggests urgency',
        });
      } else if (hour < 8 || hour > 19) {
        indicators.push({
          type: 'temporal',
          indicator: 'after-hours',
          weight: 15,
          confidence: 0.7,
          reasoning: 'Communication sent outside business hours suggests urgency',
        });
      }
    }

    // Weekend communication
    if (day === 0 || day === 6) {
      indicators.push({
        type: 'temporal',
        indicator: 'weekend',
        weight: 12,
        confidence: 0.65,
        reasoning: 'Weekend communication suggests urgency',
      });
    }

    // Holiday communication (simplified check)
    if (this.isHolidayPeriod(now)) {
      indicators.push({
        type: 'temporal',
        indicator: 'holiday',
        weight: 18,
        confidence: 0.75,
        reasoning: 'Communication during holiday period suggests urgency',
      });
    }

    return indicators;
  }

  private detectContextualIndicators(
    request: MessageRequest,
    context: UrgencyContext
  ): UrgencyIndicator[] {
    const indicators: UrgencyIndicator[] = [];

    // Executive role context
    if (context.userRole === 'executive' || context.userRole === 'ceo' || context.userRole === 'cto') {
      indicators.push({
        type: 'contextual',
        indicator: 'executive-communication',
        weight: 15,
        confidence: 0.8,
        reasoning: 'Communication from executive role carries higher urgency',
      });
    }

    // Multiple attachments might indicate urgency
    if (request.attachments && request.attachments.length > 3) {
      indicators.push({
        type: 'contextual',
        indicator: 'multiple-attachments',
        weight: 8,
        confidence: 0.6,
        reasoning: 'Multiple attachments suggest comprehensive urgent update',
      });
    }

    // Voice/video attachments suggest urgency
    if (request.attachments?.some(a => a.type === 'audio' || a.type === 'video')) {
      indicators.push({
        type: 'contextual',
        indicator: 'multimedia-content',
        weight: 12,
        confidence: 0.7,
        reasoning: 'Voice/video content suggests personal urgency',
      });
    }

    // Previous escalations
    if (context.previousEscalations > 0) {
      indicators.push({
        type: 'contextual',
        indicator: 'previous-escalations',
        weight: context.previousEscalations * 5,
        confidence: 0.85,
        reasoning: `${context.previousEscalations} previous escalations increase urgency`,
      });
    }

    // Related incidents
    if (context.relatedIncidents.length > 0) {
      indicators.push({
        type: 'contextual',
        indicator: 'related-incidents',
        weight: context.relatedIncidents.length * 3,
        confidence: 0.75,
        reasoning: `${context.relatedIncidents.length} related incidents increase urgency`,
      });
    }

    return indicators;
  }

  private detectPunctuationIndicators(text: string): UrgencyIndicator[] {
    const indicators: UrgencyIndicator[] = [];

    // Multiple exclamation marks
    const exclamationCount = (text.match(/!/g) || []).length;
    if (exclamationCount > 0) {
      const weight = Math.min(15, exclamationCount * 3);
      indicators.push({
        type: 'punctuation',
        indicator: 'exclamation-marks',
        weight,
        confidence: 0.6,
        reasoning: `${exclamationCount} exclamation marks suggest urgency`,
      });
    }

    // ALL CAPS detection
    const words = text.split(/\s+/);
    const capsWords = words.filter(word => 
      word.length > 2 && word === word.toUpperCase() && /[A-Z]/.test(word)
    );
    
    if (capsWords.length > 0) {
      const capsRatio = capsWords.length / words.length;
      if (capsRatio > 0.3) {
        indicators.push({
          type: 'punctuation',
          indicator: 'excessive-caps',
          weight: 12,
          confidence: 0.7,
          reasoning: 'Excessive capitalization suggests urgency',
        });
      } else if (capsWords.length > 2) {
        indicators.push({
          type: 'punctuation',
          indicator: 'caps-words',
          weight: 8,
          confidence: 0.6,
          reasoning: `${capsWords.length} capitalized words suggest emphasis`,
        });
      }
    }

    // Multiple question marks
    const questionCount = (text.match(/\?+/g) || []).length;
    if (questionCount > 2) {
      indicators.push({
        type: 'punctuation',
        indicator: 'multiple-questions',
        weight: 6,
        confidence: 0.5,
        reasoning: 'Multiple questions suggest need for urgent response',
      });
    }

    return indicators;
  }

  private detectBehavioralIndicators(context: UrgencyContext): UrgencyIndicator[] {
    const indicators: UrgencyIndicator[] = [];

    // Rapid succession of messages (would require message history)
    // For now, we'll use previous escalations as a proxy
    if (context.previousEscalations > 1) {
      indicators.push({
        type: 'behavioral',
        indicator: 'message-frequency',
        weight: 10,
        confidence: 0.7,
        reasoning: 'High frequency of escalated messages suggests behavioral urgency',
      });
    }

    // User role escalation patterns
    const userHistory = this.urgencyHistory.get(context.userId) || [];
    const recentHighUrgency = userHistory
      .slice(-5)
      .filter(u => u.level === 'high' || u.level === 'critical').length;

    if (recentHighUrgency >= 3) {
      indicators.push({
        type: 'behavioral',
        indicator: 'urgency-pattern',
        weight: 8,
        confidence: 0.65,
        reasoning: 'User has pattern of high-urgency communications',
      });
    }

    return indicators;
  }

  private calculateUrgencyLevel(
    indicators: UrgencyIndicator[],
    context: UrgencyContext
  ): UrgencyLevel {
    // Calculate weighted score
    let totalScore = 0;
    let totalWeight = 0;
    let confidenceSum = 0;

    for (const indicator of indicators) {
      totalScore += indicator.weight * indicator.confidence;
      totalWeight += indicator.weight;
      confidenceSum += indicator.confidence;
    }

    const weightedScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const avgConfidence = indicators.length > 0 ? confidenceSum / indicators.length : 0.5;

    // Apply contextual multipliers
    let adjustedScore = weightedScore;

    // Business hours adjustment
    if (!context.businessHours) {
      adjustedScore *= 1.2;
    }

    // Executive role adjustment
    if (context.userRole === 'executive' || context.userRole === 'ceo') {
      adjustedScore *= 1.15;
    }

    // Previous escalations adjustment
    if (context.previousEscalations > 0) {
      adjustedScore *= (1 + context.previousEscalations * 0.1);
    }

    // Normalize score to 0-100
    const normalizedScore = Math.min(100, adjustedScore);

    // Determine urgency level
    let level: UrgencyLevel['level'];
    if (normalizedScore >= 75) level = 'critical';
    else if (normalizedScore >= 50) level = 'high';
    else if (normalizedScore >= 25) level = 'medium';
    else level = 'low';

    return {
      level,
      score: normalizedScore,
      confidence: avgConfidence,
    };
  }

  private async checkEscalationTriggers(
    urgency: UrgencyLevel,
    request: MessageRequest,
    context: UrgencyContext
  ): Promise<{ escalationTriggered: boolean; escalationEvents: EscalationEvent[] }> {
    const escalationEvents: EscalationEvent[] = [];
    let escalationTriggered = false;

    // Find matching escalation rules
    const matchingRules = Array.from(this.escalationRules.values())
      .filter(rule => rule.enabled)
      .filter(rule => this.ruleMatches(rule, urgency, request, context));

    for (const rule of matchingRules) {
      const event = await this.triggerEscalation(rule, request, context);
      if (event) {
        escalationEvents.push(event);
        escalationTriggered = true;
      }
    }

    return { escalationTriggered, escalationEvents };
  }

  private ruleMatches(
    rule: EscalationRule,
    urgency: UrgencyLevel,
    request: MessageRequest,
    context: UrgencyContext
  ): boolean {
    const conditions = rule.triggerConditions;

    // Check urgency level
    const urgencyLevels = ['low', 'medium', 'high', 'critical'];
    const requiredIndex = urgencyLevels.indexOf(conditions.urgencyLevel);
    const currentIndex = urgencyLevels.indexOf(urgency.level);
    
    if (currentIndex < requiredIndex) {
      return false;
    }

    // Check keywords if specified
    if (conditions.keywords && conditions.keywords.length > 0) {
      const text = (request.content || '').toLowerCase();
      const hasKeyword = conditions.keywords.some(keyword => 
        text.includes(keyword.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Check user roles if specified
    if (conditions.userRoles && conditions.userRoles.length > 0) {
      if (!conditions.userRoles.includes(context.userRole)) {
        return false;
      }
    }

    // Check business hours if specified
    if (conditions.businessHours !== undefined) {
      if (conditions.businessHours !== context.businessHours) {
        return false;
      }
    }

    // Check cooldown period
    const existingEscalations = this.activeEscalations.get(context.messageId) || [];
    const lastEscalation = existingEscalations
      .filter(e => e.ruleId === rule.id)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (lastEscalation) {
      const timeSinceLastEscalation = Date.now() - lastEscalation.timestamp.getTime();
      if (timeSinceLastEscalation < rule.cooldownPeriod * 60 * 1000) {
        return false;
      }

      // Check max escalations
      const escalationCount = existingEscalations.filter(e => e.ruleId === rule.id).length;
      if (escalationCount >= rule.maxEscalations) {
        return false;
      }
    }

    return true;
  }

  private async triggerEscalation(
    rule: EscalationRule,
    request: MessageRequest,
    context: UrgencyContext
  ): Promise<EscalationEvent | null> {
    try {
      const existingEscalations = this.activeEscalations.get(context.messageId) || [];
      const ruleEscalations = existingEscalations.filter(e => e.ruleId === rule.id);
      const currentStep = ruleEscalations.length + 1;

      if (currentStep > rule.escalationSteps.length) {
        return null; // No more escalation steps
      }

      const stepConfig = rule.escalationSteps[currentStep - 1];
      
      if (!stepConfig) {
        logger.warn('No escalation step configuration found', { ruleId: rule.id, currentStep });
        return null;
      }
      
      const escalationEvent: EscalationEvent = {
        id: `escalation_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        messageId: context.messageId,
        ruleId: rule.id,
        step: currentStep,
        timestamp: new Date(),
        channels: stepConfig.channels,
        recipients: stepConfig.recipients,
        reason: `${rule.name} - Step ${currentStep}`,
        success: false,
      };

      // Schedule the escalation
      const delay = stepConfig.delay * 60 * 1000; // Convert minutes to milliseconds
      
      if (delay > 0) {
        escalationEvent.nextEscalation = new Date(Date.now() + delay);
        
        const timerId = setTimeout(() => {
          this.executeEscalation(escalationEvent, stepConfig, request, context);
        }, delay);
        
        this.escalationTimers.set(escalationEvent.id, timerId);
      } else {
        // Immediate escalation
        await this.executeEscalation(escalationEvent, stepConfig, request, context);
      }

      // Store the escalation event
      const messageEscalations = this.activeEscalations.get(context.messageId) || [];
      messageEscalations.push(escalationEvent);
      this.activeEscalations.set(context.messageId, messageEscalations);

      this.emit('escalationScheduled', {
        escalationId: escalationEvent.id,
        messageId: context.messageId,
        ruleId: rule.id,
        step: currentStep,
        delay: stepConfig.delay,
        channels: stepConfig.channels,
      });

      logger.info('Escalation scheduled', {
        escalationId: escalationEvent.id,
        messageId: context.messageId,
        ruleId: rule.id,
        step: currentStep,
        delay: stepConfig.delay,
      });

      return escalationEvent;
    } catch (error) {
      logger.error('Failed to trigger escalation', {
        ruleId: rule.id,
        messageId: context.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async executeEscalation(
    event: EscalationEvent,
    stepConfig: EscalationRule['escalationSteps'][0],
    request: MessageRequest,
    context: UrgencyContext
  ): Promise<void> {
    try {
      logger.info('Executing escalation', {
        escalationId: event.id,
        messageId: event.messageId,
        step: event.step,
        channels: event.channels,
        recipients: event.recipients,
      });

      // Here you would integrate with actual notification systems
      // For now, we'll simulate the escalation execution
      
      const success = await this.sendEscalationNotifications(
        event,
        stepConfig,
        request,
        context
      );

      event.success = success;

      this.emit('escalationExecuted', {
        escalationId: event.id,
        messageId: event.messageId,
        step: event.step,
        success,
        channels: event.channels,
        recipients: event.recipients,
      });

      logger.info('Escalation executed', {
        escalationId: event.id,
        messageId: event.messageId,
        success,
      });

      // Clean up timer
      const timerId = this.escalationTimers.get(event.id);
      if (timerId) {
        clearTimeout(timerId);
        this.escalationTimers.delete(event.id);
      }
    } catch (error) {
      logger.error('Escalation execution failed', {
        escalationId: event.id,
        messageId: event.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendEscalationNotifications(
    event: EscalationEvent,
    stepConfig: EscalationRule['escalationSteps'][0],
    request: MessageRequest,
    context: UrgencyContext
  ): Promise<boolean> {
    // This would integrate with actual communication channels
    // For now, we'll simulate successful delivery
    
    try {
      const template = stepConfig.template || this.getDefaultEscalationTemplate();
      const _message = this.buildEscalationMessage(template, request, context, event);

      // Simulate sending to each channel and recipient
      for (const channel of stepConfig.channels) {
        for (const recipient of stepConfig.recipients) {
          // In a real implementation, this would call the actual channel APIs
          logger.info('Escalation notification sent', {
            escalationId: event.id,
            channel,
            recipient,
            hasSound: stepConfig.notificationSound,
          });
        }
      }

      return true;
    } catch (error) {
      logger.error('Failed to send escalation notifications', {
        escalationId: event.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private buildEscalationMessage(
    template: string,
    request: MessageRequest,
    context: UrgencyContext,
    event: EscalationEvent
  ): string {
    return template
      .replace('{messageId}', context.messageId)
      .replace('{userId}', context.userId)
      .replace('{userRole}', context.userRole)
      .replace('{timestamp}', context.timestamp.toISOString())
      .replace('{step}', event.step.toString())
      .replace('{content}', (request.content || '').substring(0, 200))
      .replace('{reason}', event.reason);
  }

  private getDefaultEscalationTemplate(): string {
    return `🚨 ESCALATION ALERT - Step {step}

Message ID: {messageId}
From: {userId} ({userRole})
Time: {timestamp}
Reason: {reason}

Content Preview:
{content}

This message requires immediate attention due to detected urgency indicators.`;
  }

  private recordUrgencyHistory(userId: string, urgency: UrgencyLevel): void {
    const history = this.urgencyHistory.get(userId) || [];
    history.push(urgency);
    
    // Keep only last 20 entries
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }
    
    this.urgencyHistory.set(userId, history);
  }

  private isHolidayPeriod(date: Date): boolean {
    // Simplified holiday detection
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    // Major US holidays (simplified)
    const holidays = [
      { month: 1, day: 1 },   // New Year's Day
      { month: 7, day: 4 },   // Independence Day
      { month: 12, day: 25 }, // Christmas
    ];
    
    return holidays.some(holiday => 
      holiday.month === month && holiday.day === day
    );
  }

  private initializeDefaultRules(): void {
    // Critical urgency rule
    this.escalationRules.set('critical-urgency', {
      id: 'critical-urgency',
      name: 'Critical Urgency Escalation',
      description: 'Immediate escalation for critical messages',
      triggerConditions: {
        urgencyLevel: 'critical',
      },
      escalationSteps: [
        {
          step: 1,
          delay: 0, // Immediate
          channels: ['sms'],
          recipients: ['emergency-contact'],
          notificationSound: true,
        },
        {
          step: 2,
          delay: 5, // 5 minutes
          channels: ['sms', 'google_chat'],
          recipients: ['emergency-contact', 'supervisor'],
          notificationSound: true,
        },
        {
          step: 3,
          delay: 15, // 15 minutes
          channels: ['sms', 'google_chat', 'voice_call'],
          recipients: ['emergency-contact', 'supervisor', 'executive-team'],
          notificationSound: true,
        },
      ],
      maxEscalations: 3,
      cooldownPeriod: 30, // 30 minutes
      enabled: true,
    });

    // After-hours high urgency
    this.escalationRules.set('after-hours-high', {
      id: 'after-hours-high',
      name: 'After Hours High Urgency',
      description: 'Escalation for high urgency messages outside business hours',
      triggerConditions: {
        urgencyLevel: 'high',
        businessHours: false,
      },
      escalationSteps: [
        {
          step: 1,
          delay: 10, // 10 minutes
          channels: ['sms'],
          recipients: ['on-call-manager'],
          notificationSound: false,
        },
        {
          step: 2,
          delay: 30, // 30 minutes
          channels: ['sms', 'google_chat'],
          recipients: ['on-call-manager', 'department-head'],
          notificationSound: true,
        },
      ],
      maxEscalations: 2,
      cooldownPeriod: 60, // 1 hour
      enabled: true,
    });

    // Executive communication
    this.escalationRules.set('executive-communication', {
      id: 'executive-communication',
      name: 'Executive Communication Priority',
      description: 'Priority handling for executive communications',
      triggerConditions: {
        urgencyLevel: 'medium',
        userRoles: ['executive', 'ceo', 'cto', 'cfo'],
      },
      escalationSteps: [
        {
          step: 1,
          delay: 15, // 15 minutes
          channels: ['google_chat'],
          recipients: ['executive-assistant'],
          notificationSound: false,
        },
      ],
      maxEscalations: 1,
      cooldownPeriod: 120, // 2 hours
      enabled: true,
    });
  }

  // Rule management methods
  addEscalationRule(rule: EscalationRule): void {
    this.escalationRules.set(rule.id, rule);
    
    this.emit('ruleAdded', { ruleId: rule.id, name: rule.name });
    
    logger.info('Escalation rule added', {
      ruleId: rule.id,
      name: rule.name,
      urgencyLevel: rule.triggerConditions.urgencyLevel,
      steps: rule.escalationSteps.length,
    });
  }

  removeEscalationRule(ruleId: string): boolean {
    const rule = this.escalationRules.get(ruleId);
    if (rule) {
      this.escalationRules.delete(ruleId);
      
      this.emit('ruleRemoved', { ruleId, name: rule.name });
      
      logger.info('Escalation rule removed', { ruleId, name: rule.name });
      return true;
    }
    return false;
  }

  updateEscalationRule(ruleId: string, updates: Partial<EscalationRule>): boolean {
    const rule = this.escalationRules.get(ruleId);
    if (rule) {
      const updatedRule = { ...rule, ...updates };
      this.escalationRules.set(ruleId, updatedRule);
      
      this.emit('ruleUpdated', { ruleId, changes: Object.keys(updates) });
      
      logger.info('Escalation rule updated', {
        ruleId,
        changes: Object.keys(updates),
      });
      return true;
    }
    return false;
  }

  getEscalationRule(ruleId: string): EscalationRule | undefined {
    return this.escalationRules.get(ruleId);
  }

  listEscalationRules(): EscalationRule[] {
    return Array.from(this.escalationRules.values());
  }

  // Escalation management
  cancelEscalation(escalationId: string): boolean {
    const timerId = this.escalationTimers.get(escalationId);
    if (timerId) {
      clearTimeout(timerId);
      this.escalationTimers.delete(escalationId);
      
      this.emit('escalationCancelled', { escalationId });
      
      logger.info('Escalation cancelled', { escalationId });
      return true;
    }
    return false;
  }

  getActiveEscalations(messageId?: string): EscalationEvent[] {
    if (messageId) {
      return this.activeEscalations.get(messageId) || [];
    }
    
    const allEscalations: EscalationEvent[] = [];
    for (const escalations of this.activeEscalations.values()) {
      allEscalations.push(...escalations);
    }
    return allEscalations;
  }

  getUserUrgencyHistory(userId: string): UrgencyLevel[] {
    return this.urgencyHistory.get(userId) || [];
  }

  getSystemStats(): {
    totalEscalationRules: number;
    activeEscalations: number;
    urgencyDistribution: Record<string, number>;
    escalationSuccess: number;
  } {
    const allEscalations = this.getActiveEscalations();
    const urgencyStats: Record<string, number> = {};
    let successfulEscalations = 0;

    // Count urgency distribution from history
    for (const history of this.urgencyHistory.values()) {
      for (const urgency of history) {
        urgencyStats[urgency.level] = (urgencyStats[urgency.level] || 0) + 1;
      }
    }

    // Count successful escalations
    for (const escalation of allEscalations) {
      if (escalation.success) {
        successfulEscalations++;
      }
    }

    const escalationSuccess = allEscalations.length > 0 
      ? successfulEscalations / allEscalations.length 
      : 1.0;

    return {
      totalEscalationRules: this.escalationRules.size,
      activeEscalations: allEscalations.length,
      urgencyDistribution: urgencyStats,
      escalationSuccess,
    };
  }

  async shutdown(): Promise<void> {
    // Cancel all active timers
    for (const timerId of this.escalationTimers.values()) {
      clearTimeout(timerId);
    }
    this.escalationTimers.clear();
    
    logger.info('Urgency detector shut down');
  }
}

export default UrgencyDetector;