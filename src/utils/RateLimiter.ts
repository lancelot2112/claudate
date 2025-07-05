import { EventEmitter } from 'events';
import logger from './logger.js';

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (identifier: string) => string; // Custom key generation
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  message?: string; // Custom error message
  standardHeaders?: boolean; // Return rate limit info in headers
  legacyHeaders?: boolean; // Return X-RateLimit-* headers
}

export interface RateLimitEntry {
  count: number;
  resetTime: Date;
  firstRequest: Date;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  resetTime: Date;
  totalRequests: number;
  retryAfter?: number; // Seconds until reset
}

export interface RateLimitRule {
  id: string;
  name: string;
  pattern: string; // Regex pattern for matching identifiers
  config: RateLimitConfig;
  priority: number;
  enabled: boolean;
}

export class RateLimiter extends EventEmitter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private rules: Map<string, RateLimitRule> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    super();
    
    // Initialize default rules
    this.initializeDefaultRules();
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute

    logger.info('RateLimiter initialized');
  }

  private initializeDefaultRules(): void {
    // Global rate limit
    this.addRule({
      id: 'global',
      name: 'Global Rate Limit',
      pattern: '.*',
      config: {
        windowMs: 60000, // 1 minute
        maxRequests: 100,
        message: 'Too many requests, please try again later'
      },
      priority: 100, // Lowest priority
      enabled: true
    });

    // User-specific rate limit
    this.addRule({
      id: 'user',
      name: 'User Rate Limit',
      pattern: 'user:.*',
      config: {
        windowMs: 60000, // 1 minute
        maxRequests: 60,
        message: 'User rate limit exceeded'
      },
      priority: 50,
      enabled: true
    });

    // Agent-specific rate limit
    this.addRule({
      id: 'agent',
      name: 'Agent Rate Limit',
      pattern: 'agent:.*',
      config: {
        windowMs: 60000, // 1 minute
        maxRequests: 30,
        message: 'Agent rate limit exceeded'
      },
      priority: 40,
      enabled: true
    });

    // AI service rate limits
    this.addRule({
      id: 'anthropic',
      name: 'Anthropic API Rate Limit',
      pattern: 'service:anthropic:.*',
      config: {
        windowMs: 60000, // 1 minute
        maxRequests: 50, // Conservative limit
        message: 'Anthropic API rate limit exceeded'
      },
      priority: 10,
      enabled: true
    });

    this.addRule({
      id: 'google',
      name: 'Google AI Rate Limit',
      pattern: 'service:google:.*',
      config: {
        windowMs: 60000, // 1 minute
        maxRequests: 60,
        message: 'Google AI rate limit exceeded'
      },
      priority: 10,
      enabled: true
    });

    // Communication service rate limits
    this.addRule({
      id: 'twilio',
      name: 'Twilio Rate Limit',
      pattern: 'service:twilio:.*',
      config: {
        windowMs: 60000, // 1 minute
        maxRequests: 10, // Conservative for SMS
        message: 'SMS rate limit exceeded'
      },
      priority: 5,
      enabled: true
    });

    this.addRule({
      id: 'sendgrid',
      name: 'SendGrid Rate Limit',
      pattern: 'service:sendgrid:.*',
      config: {
        windowMs: 60000, // 1 minute
        maxRequests: 20,
        message: 'Email rate limit exceeded'
      },
      priority: 5,
      enabled: true
    });
  }

  public addRule(rule: RateLimitRule): void {
    this.rules.set(rule.id, rule);
    logger.info('Rate limit rule added', { ruleId: rule.id, ruleName: rule.name });
  }

  public removeRule(ruleId: string): void {
    if (this.rules.delete(ruleId)) {
      logger.info('Rate limit rule removed', { ruleId });
    }
  }

  public updateRule(ruleId: string, updates: Partial<RateLimitRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      Object.assign(rule, updates);
      logger.info('Rate limit rule updated', { ruleId, updates });
    }
  }

  public async checkLimit(identifier: string): Promise<RateLimitResult> {
    // Find the most specific rule that matches
    const matchingRule = this.findMatchingRule(identifier);
    
    if (!matchingRule || !matchingRule.enabled) {
      return {
        allowed: true,
        remainingRequests: Infinity,
        resetTime: new Date(Date.now() + 60000),
        totalRequests: 0
      };
    }

    const key = matchingRule.config.keyGenerator 
      ? matchingRule.config.keyGenerator(identifier)
      : `${matchingRule.id}:${identifier}`;

    const now = new Date();
    let entry = this.limits.get(key);

    // Create new entry if it doesn't exist or has expired
    if (!entry || now.getTime() >= entry.resetTime.getTime()) {
      entry = {
        count: 0,
        resetTime: new Date(now.getTime() + matchingRule.config.windowMs),
        firstRequest: now
      };
      this.limits.set(key, entry);
    }

    // Check if limit would be exceeded
    const wouldExceed = entry.count >= matchingRule.config.maxRequests;
    
    if (wouldExceed) {
      const retryAfter = Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000);
      
      logger.warn('Rate limit exceeded', {
        identifier,
        rule: matchingRule.name,
        count: entry.count,
        limit: matchingRule.config.maxRequests,
        retryAfter
      });

      this.emit('rate-limit-exceeded', {
        identifier,
        rule: matchingRule,
        count: entry.count,
        limit: matchingRule.config.maxRequests,
        retryAfter
      });

      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: entry.resetTime,
        totalRequests: entry.count,
        retryAfter
      };
    }

    // Increment counter
    entry.count++;

    const result: RateLimitResult = {
      allowed: true,
      remainingRequests: matchingRule.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
      totalRequests: entry.count
    };

    // Emit warning when approaching limit
    if (result.remainingRequests <= 5 && result.remainingRequests > 0) {
      this.emit('rate-limit-warning', {
        identifier,
        rule: matchingRule,
        remainingRequests: result.remainingRequests
      });
    }

    return result;
  }

  public async recordRequest(
    identifier: string, 
    success: boolean = true, 
    metadata?: Record<string, any>
  ): Promise<RateLimitResult> {
    const matchingRule = this.findMatchingRule(identifier);
    
    if (!matchingRule || !matchingRule.enabled) {
      return {
        allowed: true,
        remainingRequests: Infinity,
        resetTime: new Date(Date.now() + 60000),
        totalRequests: 0
      };
    }

    // Skip recording based on rule configuration
    if ((success && matchingRule.config.skipSuccessfulRequests) ||
        (!success && matchingRule.config.skipFailedRequests)) {
      return await this.checkLimit(identifier);
    }

    // Record the request
    const result = await this.checkLimit(identifier);
    
    logger.debug('Request recorded', {
      identifier,
      success,
      remainingRequests: result.remainingRequests,
      totalRequests: result.totalRequests,
      metadata
    });

    return result;
  }

  private findMatchingRule(identifier: string): RateLimitRule | null {
    const matchingRules = Array.from(this.rules.values())
      .filter(rule => new RegExp(rule.pattern).test(identifier))
      .sort((a, b) => a.priority - b.priority); // Lower priority number = higher priority

    return matchingRules[0] || null;
  }

  public async createThrottledFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    identifier: string,
    options: {
      onRateLimit?: (retryAfter: number) => void;
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ): Promise<T> {
    const { onRateLimit, maxRetries = 3, retryDelay = 1000 } = options;

    return (async (...args: any[]) => {
      let retries = 0;

      while (retries <= maxRetries) {
        const limitResult = await this.checkLimit(identifier);

        if (limitResult.allowed) {
          try {
            const result = await fn(...args);
            await this.recordRequest(identifier, true);
            return result;
          } catch (error) {
            await this.recordRequest(identifier, false);
            throw error;
          }
        } else {
          if (retries === maxRetries) {
            const error = new Error(`Rate limit exceeded for ${identifier}. Retry after ${limitResult.retryAfter} seconds.`);
            error.name = 'RateLimitError';
            throw error;
          }

          const waitTime = limitResult.retryAfter ? limitResult.retryAfter * 1000 : retryDelay;
          
          if (onRateLimit) {
            onRateLimit(limitResult.retryAfter || 0);
          }

          logger.info('Rate limited, retrying', {
            identifier,
            retries,
            waitTime,
            retryAfter: limitResult.retryAfter
          });

          await this.delay(waitTime);
          retries++;
        }
      }
    }) as T;
  }

  public createBurstLimiter(
    identifier: string,
    burstLimit: number,
    refillRate: number, // tokens per second
    capacity: number = burstLimit
  ): {
    tryConsume: (tokens?: number) => Promise<boolean>;
    getTokens: () => number;
    getCapacity: () => number;
  } {
    let tokens = capacity;
    let lastRefill = Date.now();

    return {
      tryConsume: async (consumeTokens: number = 1): Promise<boolean> => {
        const now = Date.now();
        const timePassed = (now - lastRefill) / 1000;
        
        // Refill tokens
        tokens = Math.min(capacity, tokens + (timePassed * refillRate));
        lastRefill = now;

        if (tokens >= consumeTokens) {
          tokens -= consumeTokens;
          return true;
        }

        return false;
      },

      getTokens: (): number => {
        const now = Date.now();
        const timePassed = (now - lastRefill) / 1000;
        return Math.min(capacity, tokens + (timePassed * refillRate));
      },

      getCapacity: (): number => capacity
    };
  }

  public async createBatch<T>(
    items: T[],
    processor: (item: T) => Promise<any>,
    identifier: string,
    batchSize: number = 10
  ): Promise<any[]> {
    const results: any[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      // Check rate limit before processing batch
      const limitResult = await this.checkLimit(identifier);
      if (!limitResult.allowed) {
        const waitTime = limitResult.retryAfter ? limitResult.retryAfter * 1000 : 5000;
        logger.info('Batch processing rate limited, waiting', {
          identifier,
          waitTime,
          batchIndex: i / batchSize
        });
        await this.delay(waitTime);
        i -= batchSize; // Retry same batch
        continue;
      }

      // Process batch
      const batchPromises = batch.map(item => processor(item));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Record successful and failed requests
      for (const result of batchResults) {
        await this.recordRequest(identifier, result.status === 'fulfilled');
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({ error: result.reason });
        }
      }

      // Small delay between batches to avoid overwhelming
      if (i + batchSize < items.length) {
        await this.delay(100);
      }
    }

    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanup(): void {
    const now = new Date();
    let cleanedUp = 0;

    for (const [key, entry] of this.limits) {
      if (now.getTime() >= entry.resetTime.getTime()) {
        this.limits.delete(key);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      logger.debug('Rate limit entries cleaned up', { count: cleanedUp });
    }
  }

  public getCurrentLimits(): Array<{
    identifier: string;
    count: number;
    limit: number;
    resetTime: Date;
    rule: string;
  }> {
    const results: any[] = [];
    
    for (const [key, entry] of this.limits) {
      // Extract rule and identifier from key
      const [ruleId, ...identifierParts] = key.split(':');
      if (!ruleId) continue; // Skip entries without valid rule ID
      
      const identifier = identifierParts.join(':');
      const rule = this.rules.get(ruleId);
      
      if (rule) {
        results.push({
          identifier,
          count: entry.count,
          limit: rule.config.maxRequests,
          resetTime: entry.resetTime,
          rule: rule.name
        });
      }
    }

    return results;
  }

  public getRules(): RateLimitRule[] {
    return Array.from(this.rules.values());
  }

  public getStats(): {
    activeEntries: number;
    totalRules: number;
    recentViolations: number;
  } {
    return {
      activeEntries: this.limits.size,
      totalRules: this.rules.size,
      recentViolations: 0 // Would need to track violations
    };
  }

  public reset(identifier?: string): void {
    if (identifier) {
      // Reset specific identifier
      for (const [key] of this.limits) {
        if (key.includes(identifier)) {
          this.limits.delete(key);
        }
      }
      logger.info('Rate limits reset for identifier', { identifier });
    } else {
      // Reset all
      this.limits.clear();
      logger.info('All rate limits reset');
    }
  }

  public destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.limits.clear();
    this.removeAllListeners();
    logger.info('RateLimiter destroyed');
  }
}

export default RateLimiter;