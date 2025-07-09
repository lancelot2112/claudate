import { EventEmitter } from 'events';
import { MessageRequest, MessageResponse } from '../../types/Communication';
import logger from '../../utils/logger';

export interface UserInteraction {
  id: string;
  userId: string;
  timestamp: Date;
  messageId: string;
  interactionType: 'read' | 'reply' | 'ignore' | 'forward' | 'escalate' | 'archive';
  channel: string;
  contentType: 'text' | 'voice' | 'video' | 'image' | 'chart' | 'interactive';
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  complexity: 'simple' | 'moderate' | 'complex' | 'highly_complex';
  responseTime?: number; // milliseconds
  satisfaction?: number; // 1-5 rating if provided
  context: {
    timeOfDay: number; // 0-23 hour
    dayOfWeek: number; // 0-6
    businessHours: boolean;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    location?: string;
  };
}

export interface UserPreferenceProfile {
  userId: string;
  lastUpdated: Date;
  channelPreferences: {
    [channel: string]: {
      score: number; // 0-1
      confidence: number; // 0-1
      usage: {
        total: number;
        successful: number;
        responseRate: number;
        avgResponseTime: number;
      };
      contextualPreferences: {
        urgencyLevels: Record<string, number>;
        contentTypes: Record<string, number>;
        timeSlots: Record<string, number>;
        businessHours: { business: number; afterHours: number };
      };
    };
  };
  contentPreferences: {
    briefingStyle: 'concise' | 'detailed' | 'visual';
    maxBulletPoints: number;
    preferredChartTypes: string[];
    interactiveElements: boolean;
    voiceMessages: boolean;
    richFormatting: boolean;
  };
  communicationPatterns: {
    peakHours: number[]; // Hours of day when most active
    responseTimeExpectation: number; // Expected response time in minutes
    escalationThreshold: number; // Minutes before escalation expected
    quietHours: { start: number; end: number };
    weekendCommunication: boolean;
  };
  decisionMakingStyle: {
    prefersData: boolean;
    needsMultipleOptions: boolean;
    riskTolerance: 'low' | 'medium' | 'high';
    deliberationTime: 'quick' | 'moderate' | 'thorough';
    stakeholderInvolvement: 'minimal' | 'moderate' | 'extensive';
  };
  adaptationMetrics: {
    learningRate: number; // How quickly to adapt (0-1)
    confidence: number; // Overall confidence in preferences (0-1)
    dataPoints: number; // Number of interactions analyzed
    lastMajorUpdate: Date;
    stabilityScore: number; // How stable preferences are (0-1)
  };
}

export interface AdaptiveRoutingDecision {
  userId: string;
  messageId: string;
  timestamp: Date;
  originalRecommendation: {
    channel: string;
    confidence: number;
    reasoning: string;
  };
  adaptedRecommendation: {
    channel: string;
    confidence: number;
    reasoning: string;
    adaptationFactors: string[];
  };
  adaptation: {
    applied: boolean;
    type: 'channel' | 'timing' | 'format' | 'urgency';
    strength: number; // 0-1, how much adaptation was applied
    basedOn: string[]; // What data the adaptation was based on
  };
}

export interface LearningMetrics {
  totalUsers: number;
  totalInteractions: number;
  adaptationAccuracy: number; // How often adaptations improve outcomes
  learningVelocity: number; // How quickly the system learns
  preferenceStability: number; // How stable user preferences are
  channelOptimization: Record<string, number>; // Performance by channel
  contentOptimization: Record<string, number>; // Performance by content type
}

export class PreferenceLearningEngine extends EventEmitter {
  private userProfiles: Map<string, UserPreferenceProfile> = new Map();
  private interactionHistory: Map<string, UserInteraction[]> = new Map();
  private adaptationDecisions: Map<string, AdaptiveRoutingDecision[]> = new Map();
  private learningEnabled: boolean = true;
  private adaptationThreshold: number = 0.7; // Confidence threshold for applying adaptations

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    logger.info('Preference learning engine initialized');
  }

  /**
   * Record a user interaction for learning
   */
  async recordInteraction(interaction: UserInteraction): Promise<void> {
    try {
      // Store interaction
      const userHistory = this.interactionHistory.get(interaction.userId) || [];
      userHistory.push(interaction);
      
      // Keep only recent interactions (last 1000)
      if (userHistory.length > 1000) {
        userHistory.splice(0, userHistory.length - 1000);
      }
      
      this.interactionHistory.set(interaction.userId, userHistory);

      // Update user profile
      await this.updateUserProfile(interaction);

      this.emit('interactionRecorded', {
        userId: interaction.userId,
        interactionType: interaction.interactionType,
        channel: interaction.channel,
        responseTime: interaction.responseTime,
      });

      logger.debug('User interaction recorded', {
        userId: interaction.userId,
        interactionType: interaction.interactionType,
        channel: interaction.channel,
        messageId: interaction.messageId,
      });
    } catch (error) {
      logger.error('Failed to record user interaction', {
        userId: interaction.userId,
        messageId: interaction.messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Get adaptive routing recommendation based on learned preferences
   */
  async getAdaptiveRouting(
    userId: string,
    originalRecommendation: {
      channel: string;
      confidence: number;
      reasoning: string;
    },
    context: {
      urgencyLevel: string;
      contentType: string;
      timeOfDay: number;
      businessHours: boolean;
      messageId: string;
    }
  ): Promise<AdaptiveRoutingDecision> {
    try {
      const profile = this.userProfiles.get(userId);
      
      if (!profile || !this.learningEnabled) {
        // No adaptation available
        return {
          userId,
          messageId: context.messageId,
          timestamp: new Date(),
          originalRecommendation,
          adaptedRecommendation: {
            ...originalRecommendation,
            adaptationFactors: [],
          },
          adaptation: {
            applied: false,
            type: 'channel',
            strength: 0,
            basedOn: [],
          },
        };
      }

      const adaptedRecommendation = await this.calculateAdaptiveRecommendation(
        profile,
        originalRecommendation,
        context
      );

      const decision: AdaptiveRoutingDecision = {
        userId,
        messageId: context.messageId,
        timestamp: new Date(),
        originalRecommendation,
        adaptedRecommendation,
        adaptation: {
          applied: adaptedRecommendation.channel !== originalRecommendation.channel,
          type: this.determineAdaptationType(originalRecommendation, adaptedRecommendation),
          strength: this.calculateAdaptationStrength(originalRecommendation, adaptedRecommendation),
          basedOn: adaptedRecommendation.adaptationFactors,
        },
      };

      // Store adaptation decision
      const userDecisions = this.adaptationDecisions.get(userId) || [];
      userDecisions.push(decision);
      this.adaptationDecisions.set(userId, userDecisions);

      this.emit('adaptiveRoutingApplied', {
        userId,
        messageId: context.messageId,
        originalChannel: originalRecommendation.channel,
        adaptedChannel: adaptedRecommendation.channel,
        adaptationApplied: decision.adaptation.applied,
        confidence: adaptedRecommendation.confidence,
      });

      logger.info('Adaptive routing calculated', {
        userId,
        messageId: context.messageId,
        originalChannel: originalRecommendation.channel,
        adaptedChannel: adaptedRecommendation.channel,
        adaptationApplied: decision.adaptation.applied,
        confidence: adaptedRecommendation.confidence,
      });

      return decision;
    } catch (error) {
      logger.error('Adaptive routing calculation failed', {
        userId,
        messageId: context.messageId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return original recommendation on error
      return {
        userId,
        messageId: context.messageId,
        timestamp: new Date(),
        originalRecommendation,
        adaptedRecommendation: {
          ...originalRecommendation,
          adaptationFactors: ['error-fallback'],
        },
        adaptation: {
          applied: false,
          type: 'channel',
          strength: 0,
          basedOn: ['error-fallback'],
        },
      };
    }
  }

  private async updateUserProfile(interaction: UserInteraction): Promise<void> {
    let profile = this.userProfiles.get(interaction.userId);
    
    if (!profile) {
      profile = this.createDefaultProfile(interaction.userId);
    }

    // Update channel preferences
    this.updateChannelPreferences(profile, interaction);

    // Update content preferences
    this.updateContentPreferences(profile, interaction);

    // Update communication patterns
    this.updateCommunicationPatterns(profile, interaction);

    // Update adaptation metrics
    this.updateAdaptationMetrics(profile, interaction);

    profile.lastUpdated = new Date();
    this.userProfiles.set(interaction.userId, profile);

    this.emit('profileUpdated', {
      userId: interaction.userId,
      dataPoints: profile.adaptationMetrics.dataPoints,
      confidence: profile.adaptationMetrics.confidence,
    });
  }

  private createDefaultProfile(userId: string): UserPreferenceProfile {
    return {
      userId,
      lastUpdated: new Date(),
      channelPreferences: {
        sms: {
          score: 0.6,
          confidence: 0.3,
          usage: { total: 0, successful: 0, responseRate: 0, avgResponseTime: 0 },
          contextualPreferences: {
            urgencyLevels: {},
            contentTypes: {},
            timeSlots: {},
            businessHours: { business: 0.5, afterHours: 0.5 },
          },
        },
        mms: {
          score: 0.5,
          confidence: 0.3,
          usage: { total: 0, successful: 0, responseRate: 0, avgResponseTime: 0 },
          contextualPreferences: {
            urgencyLevels: {},
            contentTypes: {},
            timeSlots: {},
            businessHours: { business: 0.5, afterHours: 0.5 },
          },
        },
        google_chat: {
          score: 0.4,
          confidence: 0.3,
          usage: { total: 0, successful: 0, responseRate: 0, avgResponseTime: 0 },
          contextualPreferences: {
            urgencyLevels: {},
            contentTypes: {},
            timeSlots: {},
            businessHours: { business: 0.5, afterHours: 0.5 },
          },
        },
        email: {
          score: 0.3,
          confidence: 0.3,
          usage: { total: 0, successful: 0, responseRate: 0, avgResponseTime: 0 },
          contextualPreferences: {
            urgencyLevels: {},
            contentTypes: {},
            timeSlots: {},
            businessHours: { business: 0.5, afterHours: 0.5 },
          },
        },
      },
      contentPreferences: {
        briefingStyle: 'concise',
        maxBulletPoints: 3,
        preferredChartTypes: ['bar', 'pie'],
        interactiveElements: false,
        voiceMessages: false,
        richFormatting: true,
      },
      communicationPatterns: {
        peakHours: [9, 10, 11, 14, 15, 16],
        responseTimeExpectation: 30,
        escalationThreshold: 60,
        quietHours: { start: 22, end: 6 },
        weekendCommunication: false,
      },
      decisionMakingStyle: {
        prefersData: true,
        needsMultipleOptions: true,
        riskTolerance: 'medium',
        deliberationTime: 'moderate',
        stakeholderInvolvement: 'moderate',
      },
      adaptationMetrics: {
        learningRate: 0.1,
        confidence: 0.3,
        dataPoints: 0,
        lastMajorUpdate: new Date(),
        stabilityScore: 0.5,
      },
    };
  }

  private updateChannelPreferences(profile: UserPreferenceProfile, interaction: UserInteraction): void {
    const channel = profile.channelPreferences[interaction.channel];
    if (!channel) return;

    // Update usage statistics
    channel.usage.total++;
    
    if (interaction.interactionType === 'reply' || interaction.interactionType === 'read') {
      channel.usage.successful++;
    }

    channel.usage.responseRate = channel.usage.successful / channel.usage.total;

    if (interaction.responseTime) {
      const currentAvg = channel.usage.avgResponseTime;
      const total = channel.usage.total;
      channel.usage.avgResponseTime = ((currentAvg * (total - 1)) + interaction.responseTime) / total;
    }

    // Update contextual preferences
    this.updateContextualPreference(
      channel.contextualPreferences.urgencyLevels,
      interaction.urgencyLevel,
      this.getInteractionScore(interaction)
    );

    this.updateContextualPreference(
      channel.contextualPreferences.contentTypes,
      interaction.contentType,
      this.getInteractionScore(interaction)
    );

    const timeSlot = this.getTimeSlot(interaction.context.timeOfDay);
    this.updateContextualPreference(
      channel.contextualPreferences.timeSlots,
      timeSlot,
      this.getInteractionScore(interaction)
    );

    // Update business hours preference
    const businessHours = interaction.context.businessHours ? 'business' : 'afterHours';
    const score = this.getInteractionScore(interaction);
    const currentScore = channel.contextualPreferences.businessHours[businessHours as keyof typeof channel.contextualPreferences.businessHours];
    channel.contextualPreferences.businessHours[businessHours as keyof typeof channel.contextualPreferences.businessHours] = 
      this.updateScore(currentScore, score, profile.adaptationMetrics.learningRate);

    // Update overall channel score
    const interactionScore = this.getInteractionScore(interaction);
    channel.score = this.updateScore(channel.score, interactionScore, profile.adaptationMetrics.learningRate);

    // Update confidence based on data points
    const dataPoints = channel.usage.total;
    channel.confidence = Math.min(1.0, dataPoints / 50); // Full confidence after 50 interactions
  }

  private updateContextualPreference(
    preferences: Record<string, number>,
    key: string,
    score: number
  ): void {
    const currentScore = preferences[key] || 0.5;
    const learningRate = 0.1;
    preferences[key] = this.updateScore(currentScore, score, learningRate);
  }

  private updateScore(currentScore: number, newScore: number, learningRate: number): number {
    return currentScore + learningRate * (newScore - currentScore);
  }

  private getInteractionScore(interaction: UserInteraction): number {
    // Calculate score based on interaction type and satisfaction
    let score = 0.5; // Neutral baseline

    switch (interaction.interactionType) {
      case 'reply':
        score = 0.8; // Positive engagement
        break;
      case 'read':
        score = 0.6; // Mild positive
        break;
      case 'forward':
        score = 0.7; // Positive action
        break;
      case 'escalate':
        score = 0.3; // Negative - suggests channel wasn't appropriate
        break;
      case 'ignore':
        score = 0.2; // Negative - poor channel choice
        break;
      case 'archive':
        score = 0.5; // Neutral
        break;
    }

    // Adjust based on response time
    if (interaction.responseTime) {
      const expectedTime = 30 * 60 * 1000; // 30 minutes in milliseconds
      if (interaction.responseTime < expectedTime) {
        score += 0.1; // Bonus for quick response
      } else if (interaction.responseTime > expectedTime * 3) {
        score -= 0.1; // Penalty for very slow response
      }
    }

    // Adjust based on satisfaction rating if available
    if (interaction.satisfaction) {
      const satisfactionScore = (interaction.satisfaction - 3) / 2; // Convert 1-5 to -1 to 1
      score += satisfactionScore * 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }

  private getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  private updateContentPreferences(profile: UserPreferenceProfile, interaction: UserInteraction): void {
    const score = this.getInteractionScore(interaction);
    const learningRate = profile.adaptationMetrics.learningRate;

    // Update preferences based on interaction success
    if (interaction.contentType === 'interactive' && score > 0.6) {
      profile.contentPreferences.interactiveElements = true;
    }

    if (interaction.contentType === 'voice' && score > 0.6) {
      profile.contentPreferences.voiceMessages = true;
    }

    if (interaction.contentType === 'chart' && score > 0.6) {
      if (!profile.contentPreferences.preferredChartTypes.includes('chart')) {
        profile.contentPreferences.preferredChartTypes.push('chart');
      }
    }

    // Adjust briefing style based on response patterns
    if (interaction.interactionType === 'reply' && interaction.responseTime && interaction.responseTime < 10 * 60 * 1000) {
      // Quick responses suggest preference for concise content
      if (profile.contentPreferences.briefingStyle !== 'concise') {
        profile.contentPreferences.briefingStyle = 'concise';
      }
    }
  }

  private updateCommunicationPatterns(profile: UserPreferenceProfile, interaction: UserInteraction): void {
    const hour = interaction.context.timeOfDay;
    
    // Update peak hours
    if (interaction.interactionType === 'reply' || interaction.interactionType === 'read') {
      if (!profile.communicationPatterns.peakHours.includes(hour)) {
        profile.communicationPatterns.peakHours.push(hour);
        profile.communicationPatterns.peakHours.sort((a, b) => a - b);
        
        // Keep only top 8 peak hours
        if (profile.communicationPatterns.peakHours.length > 8) {
          profile.communicationPatterns.peakHours = profile.communicationPatterns.peakHours.slice(0, 8);
        }
      }
    }

    // Update response time expectations
    if (interaction.responseTime) {
      const currentExpectation = profile.communicationPatterns.responseTimeExpectation;
      const responseMinutes = interaction.responseTime / (60 * 1000);
      const learningRate = profile.adaptationMetrics.learningRate;
      
      profile.communicationPatterns.responseTimeExpectation = 
        currentExpectation + learningRate * (responseMinutes - currentExpectation);
    }

    // Update weekend communication preference
    if (interaction.context.dayOfWeek === 0 || interaction.context.dayOfWeek === 6) {
      const score = this.getInteractionScore(interaction);
      if (score > 0.6) {
        profile.communicationPatterns.weekendCommunication = true;
      }
    }
  }

  private updateAdaptationMetrics(profile: UserPreferenceProfile, interaction: UserInteraction): void {
    profile.adaptationMetrics.dataPoints++;
    
    // Update confidence based on consistency
    const interactions = this.interactionHistory.get(interaction.userId) || [];
    if (interactions.length >= 10) {
      const recentInteractions = interactions.slice(-10);
      const consistency = this.calculateConsistency(recentInteractions);
      profile.adaptationMetrics.stabilityScore = consistency;
      
      // Higher stability increases confidence
      profile.adaptationMetrics.confidence = Math.min(
        1.0,
        profile.adaptationMetrics.confidence + (consistency * 0.01)
      );
    }

    // Adjust learning rate based on stability
    if (profile.adaptationMetrics.stabilityScore > 0.8) {
      profile.adaptationMetrics.learningRate = Math.max(0.05, profile.adaptationMetrics.learningRate * 0.9);
    } else if (profile.adaptationMetrics.stabilityScore < 0.4) {
      profile.adaptationMetrics.learningRate = Math.min(0.2, profile.adaptationMetrics.learningRate * 1.1);
    }
  }

  private calculateConsistency(interactions: UserInteraction[]): number {
    if (interactions.length < 2) return 0.5;

    // Calculate consistency in channel preferences
    const channelCounts: Record<string, number> = {};
    for (const interaction of interactions) {
      channelCounts[interaction.channel] = (channelCounts[interaction.channel] || 0) + 1;
    }

    const totalInteractions = interactions.length;
    const channelVariance = Object.values(channelCounts)
      .map(count => Math.pow(count / totalInteractions - 1 / Object.keys(channelCounts).length, 2))
      .reduce((sum, variance) => sum + variance, 0);

    return Math.max(0, 1 - channelVariance);
  }

  private async calculateAdaptiveRecommendation(
    profile: UserPreferenceProfile,
    originalRecommendation: { channel: string; confidence: number; reasoning: string },
    context: {
      urgencyLevel: string;
      contentType: string;
      timeOfDay: number;
      businessHours: boolean;
    }
  ): Promise<{
    channel: string;
    confidence: number;
    reasoning: string;
    adaptationFactors: string[];
  }> {
    const adaptationFactors: string[] = [];
    let adaptedChannel = originalRecommendation.channel;
    let adaptedConfidence = originalRecommendation.confidence;
    let adaptedReasoning = originalRecommendation.reasoning;

    // Only apply adaptation if we have sufficient confidence
    if (profile.adaptationMetrics.confidence < this.adaptationThreshold) {
      return {
        channel: adaptedChannel,
        confidence: adaptedConfidence,
        reasoning: `${adaptedReasoning} (insufficient learning data for adaptation)`,
        adaptationFactors: ['insufficient-data'],
      };
    }

    // Score each channel based on learned preferences
    const channelScores: Record<string, number> = {};
    
    for (const [channel, prefs] of Object.entries(profile.channelPreferences)) {
      let score = prefs.score;

      // Apply contextual adjustments
      const urgencyScore = prefs.contextualPreferences.urgencyLevels[context.urgencyLevel] || 0.5;
      const contentScore = prefs.contextualPreferences.contentTypes[context.contentType] || 0.5;
      const timeSlot = this.getTimeSlot(context.timeOfDay);
      const timeScore = prefs.contextualPreferences.timeSlots[timeSlot] || 0.5;
      const businessHoursScore = context.businessHours 
        ? prefs.contextualPreferences.businessHours.business
        : prefs.contextualPreferences.businessHours.afterHours;

      // Weight the adjustments
      score = (score * 0.4) + (urgencyScore * 0.2) + (contentScore * 0.2) + 
              (timeScore * 0.1) + (businessHoursScore * 0.1);

      // Apply confidence weighting
      score = score * prefs.confidence + (originalRecommendation.channel === channel ? 0.3 : 0) * (1 - prefs.confidence);

      channelScores[channel] = score;
    }

    // Find the best adapted channel
    const bestChannel = Object.entries(channelScores)
      .sort(([, a], [, b]) => b - a)[0];

    if (bestChannel && bestChannel[1] > channelScores[originalRecommendation.channel] + 0.1) {
      // Significant improvement found
      adaptedChannel = bestChannel[0];
      adaptedConfidence = Math.min(1.0, originalRecommendation.confidence + 0.1);
      
      const originalScore = channelScores[originalRecommendation.channel];
      const adaptedScore = bestChannel[1];
      const improvement = ((adaptedScore - originalScore) / originalScore * 100).toFixed(1);
      
      adaptedReasoning = `Adapted based on learned preferences (${improvement}% improvement)`;
      
      // Record adaptation factors
      if (profile.channelPreferences[adaptedChannel].contextualPreferences.urgencyLevels[context.urgencyLevel] > 0.6) {
        adaptationFactors.push(`urgency-preference-${context.urgencyLevel}`);
      }
      
      if (profile.channelPreferences[adaptedChannel].contextualPreferences.contentTypes[context.contentType] > 0.6) {
        adaptationFactors.push(`content-preference-${context.contentType}`);
      }
      
      const timeSlot = this.getTimeSlot(context.timeOfDay);
      if (profile.channelPreferences[adaptedChannel].contextualPreferences.timeSlots[timeSlot] > 0.6) {
        adaptationFactors.push(`time-preference-${timeSlot}`);
      }
      
      if (!context.businessHours && profile.channelPreferences[adaptedChannel].contextualPreferences.businessHours.afterHours > 0.6) {
        adaptationFactors.push('after-hours-preference');
      }
    }

    return {
      channel: adaptedChannel,
      confidence: adaptedConfidence,
      reasoning: adaptedReasoning,
      adaptationFactors,
    };
  }

  private determineAdaptationType(
    original: { channel: string },
    adapted: { channel: string }
  ): 'channel' | 'timing' | 'format' | 'urgency' {
    if (original.channel !== adapted.channel) {
      return 'channel';
    }
    return 'format'; // Default for other types of adaptations
  }

  private calculateAdaptationStrength(
    original: { confidence: number },
    adapted: { confidence: number }
  ): number {
    const confidenceDiff = adapted.confidence - original.confidence;
    return Math.max(0, Math.min(1, confidenceDiff * 2)); // Scale to 0-1
  }

  /**
   * Provide feedback on routing decision to improve learning
   */
  async provideFeedback(
    userId: string,
    messageId: string,
    feedback: {
      channelSatisfaction: number; // 1-5
      responseTime: number; // milliseconds
      interactionType: UserInteraction['interactionType'];
      suggestions?: string[];
    }
  ): Promise<void> {
    try {
      // Find the routing decision
      const userDecisions = this.adaptationDecisions.get(userId) || [];
      const decision = userDecisions.find(d => d.messageId === messageId);
      
      if (!decision) {
        logger.warn('No routing decision found for feedback', { userId, messageId });
        return;
      }

      // Create interaction record
      const interaction: UserInteraction = {
        id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userId,
        timestamp: new Date(),
        messageId,
        interactionType: feedback.interactionType,
        channel: decision.adaptedRecommendation.channel,
        contentType: 'text', // Default, could be enhanced
        urgencyLevel: 'medium', // Default, could be extracted from decision
        complexity: 'moderate', // Default, could be extracted from decision
        responseTime: feedback.responseTime,
        satisfaction: feedback.channelSatisfaction,
        context: {
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
          businessHours: this.isBusinessHours(new Date()),
        },
      };

      await this.recordInteraction(interaction);

      this.emit('feedbackReceived', {
        userId,
        messageId,
        satisfaction: feedback.channelSatisfaction,
        responseTime: feedback.responseTime,
        adaptationWasSuccessful: feedback.channelSatisfaction >= 4,
      });

      logger.info('Feedback processed for adaptive routing', {
        userId,
        messageId,
        satisfaction: feedback.channelSatisfaction,
        adaptationWasSuccessful: feedback.channelSatisfaction >= 4,
      });
    } catch (error) {
      logger.error('Failed to process routing feedback', {
        userId,
        messageId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private isBusinessHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay();
    
    // Monday-Friday, 9 AM - 5 PM
    return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
  }

  /**
   * Get user preference profile
   */
  getUserProfile(userId: string): UserPreferenceProfile | undefined {
    return this.userProfiles.get(userId);
  }

  /**
   * Get user interaction history
   */
  getUserInteractionHistory(userId: string, limit: number = 100): UserInteraction[] {
    const history = this.interactionHistory.get(userId) || [];
    return history.slice(-limit);
  }

  /**
   * Get adaptation decisions for a user
   */
  getUserAdaptationHistory(userId: string, limit: number = 50): AdaptiveRoutingDecision[] {
    const decisions = this.adaptationDecisions.get(userId) || [];
    return decisions.slice(-limit);
  }

  /**
   * Get learning metrics
   */
  getLearningMetrics(): LearningMetrics {
    let totalInteractions = 0;
    let adaptationAccuracy = 0;
    let adaptationCount = 0;
    let totalStability = 0;
    const channelPerformance: Record<string, { total: number; successful: number }> = {};
    const contentPerformance: Record<string, { total: number; successful: number }> = {};

    // Calculate metrics from user profiles
    for (const profile of this.userProfiles.values()) {
      totalInteractions += profile.adaptationMetrics.dataPoints;
      totalStability += profile.adaptationMetrics.stabilityScore;

      // Channel performance
      for (const [channel, prefs] of Object.entries(profile.channelPreferences)) {
        if (!channelPerformance[channel]) {
          channelPerformance[channel] = { total: 0, successful: 0 };
        }
        channelPerformance[channel].total += prefs.usage.total;
        channelPerformance[channel].successful += prefs.usage.successful;
      }
    }

    // Calculate adaptation accuracy from decisions
    for (const decisions of this.adaptationDecisions.values()) {
      for (const decision of decisions) {
        if (decision.adaptation.applied) {
          adaptationCount++;
          // This would need feedback data to calculate actual accuracy
          // For now, use confidence as a proxy
          adaptationAccuracy += decision.adaptedRecommendation.confidence;
        }
      }
    }

    const channelOptimization: Record<string, number> = {};
    for (const [channel, perf] of Object.entries(channelPerformance)) {
      channelOptimization[channel] = perf.total > 0 ? perf.successful / perf.total : 0;
    }

    const contentOptimization: Record<string, number> = {};
    for (const [content, perf] of Object.entries(contentPerformance)) {
      contentOptimization[content] = perf.total > 0 ? perf.successful / perf.total : 0;
    }

    return {
      totalUsers: this.userProfiles.size,
      totalInteractions,
      adaptationAccuracy: adaptationCount > 0 ? adaptationAccuracy / adaptationCount : 0,
      learningVelocity: this.calculateLearningVelocity(),
      preferenceStability: this.userProfiles.size > 0 ? totalStability / this.userProfiles.size : 0,
      channelOptimization,
      contentOptimization,
    };
  }

  private calculateLearningVelocity(): number {
    // Calculate how quickly the system learns from new data
    let totalVelocity = 0;
    let profileCount = 0;

    for (const profile of this.userProfiles.values()) {
      const recentInteractions = this.interactionHistory.get(profile.userId) || [];
      if (recentInteractions.length >= 10) {
        const first5 = recentInteractions.slice(0, 5);
        const last5 = recentInteractions.slice(-5);
        
        const first5Consistency = this.calculateConsistency(first5);
        const last5Consistency = this.calculateConsistency(last5);
        
        const improvement = last5Consistency - first5Consistency;
        totalVelocity += Math.max(0, improvement);
        profileCount++;
      }
    }

    return profileCount > 0 ? totalVelocity / profileCount : 0;
  }

  /**
   * Enable or disable learning
   */
  setLearningEnabled(enabled: boolean): void {
    this.learningEnabled = enabled;
    logger.info('Preference learning', { enabled });
  }

  /**
   * Set adaptation threshold
   */
  setAdaptationThreshold(threshold: number): void {
    this.adaptationThreshold = Math.max(0, Math.min(1, threshold));
    logger.info('Adaptation threshold updated', { threshold: this.adaptationThreshold });
  }

  /**
   * Export user profile for backup/analysis
   */
  exportUserProfile(userId: string): {
    profile: UserPreferenceProfile | undefined;
    interactions: UserInteraction[];
    adaptations: AdaptiveRoutingDecision[];
  } {
    return {
      profile: this.userProfiles.get(userId),
      interactions: this.interactionHistory.get(userId) || [],
      adaptations: this.adaptationDecisions.get(userId) || [],
    };
  }

  /**
   * Import user profile from backup
   */
  importUserProfile(data: {
    profile: UserPreferenceProfile;
    interactions: UserInteraction[];
    adaptations: AdaptiveRoutingDecision[];
  }): void {
    this.userProfiles.set(data.profile.userId, data.profile);
    this.interactionHistory.set(data.profile.userId, data.interactions);
    this.adaptationDecisions.set(data.profile.userId, data.adaptations);
    
    logger.info('User profile imported', {
      userId: data.profile.userId,
      interactions: data.interactions.length,
      adaptations: data.adaptations.length,
    });
  }

  /**
   * Clear user data (for privacy compliance)
   */
  clearUserData(userId: string): boolean {
    const profile = this.userProfiles.delete(userId);
    const interactions = this.interactionHistory.delete(userId);
    const adaptations = this.adaptationDecisions.delete(userId);
    
    if (profile || interactions || adaptations) {
      this.emit('userDataCleared', { userId });
      logger.info('User data cleared', { userId });
      return true;
    }
    
    return false;
  }

  async shutdown(): Promise<void> {
    // Optionally persist data before shutdown
    logger.info('Preference learning engine shutting down', {
      totalUsers: this.userProfiles.size,
      totalInteractions: Array.from(this.interactionHistory.values())
        .reduce((sum, interactions) => sum + interactions.length, 0),
    });
  }
}

export default PreferenceLearningEngine;