import { createClient, RedisClientType } from 'redis';
import { IAgentMemoryManager, AgentContext } from '@/types/Agent';
import { BaseMessage } from '@/types/common';
import { config } from '@/utils/config';
import { agentLogger, logError } from '@/utils/logger';

export class AgentMemoryManager implements IAgentMemoryManager {
  private client: RedisClientType;
  private isConnected = false;

  constructor() {
    this.client = createClient({
      url: config.redis.url,
      password: config.redis.password,
    });

    this.client.on('error', (error) => {
      logError(error, 'Redis client error');
    });

    this.client.on('connect', () => {
      agentLogger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      agentLogger.warn('Redis client disconnected');
      this.isConnected = false;
    });
  }

  public async connect(): Promise<void> {
    try {
      await this.client.connect();
      agentLogger.info('Agent memory manager connected to Redis');
    } catch (error) {
      logError(error as Error, 'Failed to connect to Redis');
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      agentLogger.info('Agent memory manager disconnected from Redis');
    } catch (error) {
      logError(error as Error, 'Failed to disconnect from Redis');
      throw error;
    }
  }

  public async storeShortTerm(
    agentId: string,
    key: string,
    value: any,
    ttl = 3600 // 1 hour default
  ): Promise<void> {
    try {
      const redisKey = this.getShortTermKey(agentId, key);
      const serializedValue = JSON.stringify(value);
      
      await this.client.setEx(redisKey, ttl, serializedValue);
      
      agentLogger.debug('Short-term memory stored', {
        agentId,
        key,
        ttl,
      });
    } catch (error) {
      logError(error as Error, 'Failed to store short-term memory', {
        agentId,
        key,
      });
      throw error;
    }
  }

  public async getShortTerm(agentId: string, key: string): Promise<any> {
    try {
      const redisKey = this.getShortTermKey(agentId, key);
      const value = await this.client.get(redisKey);
      
      if (value === null) {
        return null;
      }

      return JSON.parse(value);
    } catch (error) {
      logError(error as Error, 'Failed to get short-term memory', {
        agentId,
        key,
      });
      return null;
    }
  }

  public async storeMediumTerm(
    agentId: string,
    key: string,
    value: any
  ): Promise<void> {
    try {
      const redisKey = this.getMediumTermKey(agentId, key);
      const serializedValue = JSON.stringify({
        value,
        timestamp: Date.now(),
      });
      
      await this.client.set(redisKey, serializedValue);
      
      agentLogger.debug('Medium-term memory stored', {
        agentId,
        key,
      });
    } catch (error) {
      logError(error as Error, 'Failed to store medium-term memory', {
        agentId,
        key,
      });
      throw error;
    }
  }

  public async getMediumTerm(agentId: string, key: string): Promise<any> {
    try {
      const redisKey = this.getMediumTermKey(agentId, key);
      const value = await this.client.get(redisKey);
      
      if (value === null) {
        return null;
      }

      const parsed = JSON.parse(value);
      return parsed.value;
    } catch (error) {
      logError(error as Error, 'Failed to get medium-term memory', {
        agentId,
        key,
      });
      return null;
    }
  }

  public async storeContext(agentId: string, context: AgentContext): Promise<void> {
    try {
      const redisKey = this.getContextKey(agentId);
      const serializedContext = JSON.stringify({
        ...context,
        timestamp: Date.now(),
      });
      
      // Context has 24 hour TTL
      await this.client.setEx(redisKey, 86400, serializedContext);
      
      agentLogger.debug('Context stored', {
        agentId,
        sessionId: context.sessionId,
      });
    } catch (error) {
      logError(error as Error, 'Failed to store context', {
        agentId,
        sessionId: context.sessionId,
      });
      throw error;
    }
  }

  public async getContext(agentId: string): Promise<AgentContext | null> {
    try {
      const redisKey = this.getContextKey(agentId);
      const value = await this.client.get(redisKey);
      
      if (value === null) {
        return null;
      }

      const parsed = JSON.parse(value);
      // Remove the timestamp we added during storage
      delete parsed.timestamp;
      
      return parsed as AgentContext;
    } catch (error) {
      logError(error as Error, 'Failed to get context', { agentId });
      return null;
    }
  }

  public async addToContextWindow(agentId: string, message: BaseMessage): Promise<void> {
    try {
      const redisKey = this.getContextWindowKey(agentId);
      const serializedMessage = JSON.stringify(message);
      
      // Add to list (right push)
      await this.client.rPush(redisKey, serializedMessage);
      
      // Maintain window size (keep last 100 messages max)
      await this.client.lTrim(redisKey, -100, -1);
      
      // Set TTL on the list
      await this.client.expire(redisKey, 86400); // 24 hours
      
      agentLogger.debug('Message added to context window', {
        agentId,
        messageId: message.id,
      });
    } catch (error) {
      logError(error as Error, 'Failed to add message to context window', {
        agentId,
        messageId: message.id,
      });
      throw error;
    }
  }

  public async getContextWindow(agentId: string, limit = 50): Promise<BaseMessage[]> {
    try {
      const redisKey = this.getContextWindowKey(agentId);
      
      // Get last 'limit' messages
      const messages = await this.client.lRange(redisKey, -limit, -1);
      
      return messages.map(msg => JSON.parse(msg) as BaseMessage);
    } catch (error) {
      logError(error as Error, 'Failed to get context window', { agentId });
      return [];
    }
  }

  public async clearMemory(
    agentId: string,
    type: 'short' | 'medium' | 'all' = 'all'
  ): Promise<void> {
    try {
      const patterns: string[] = [];
      
      if (type === 'short' || type === 'all') {
        patterns.push(this.getShortTermKey(agentId, '*'));
      }
      
      if (type === 'medium' || type === 'all') {
        patterns.push(this.getMediumTermKey(agentId, '*'));
      }
      
      if (type === 'all') {
        patterns.push(this.getContextKey(agentId));
        patterns.push(this.getContextWindowKey(agentId));
      }

      // Delete keys matching patterns
      for (const pattern of patterns) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
          await this.client.del(keys);
        }
      }
      
      agentLogger.info('Agent memory cleared', {
        agentId,
        type,
        patterns,
      });
    } catch (error) {
      logError(error as Error, 'Failed to clear memory', { agentId, type });
      throw error;
    }
  }

  public async getMemoryStats(agentId: string): Promise<{
    shortTermKeys: number;
    mediumTermKeys: number;
    contextWindowSize: number;
    hasContext: boolean;
  }> {
    try {
      const shortTermKeys = await this.client.keys(this.getShortTermKey(agentId, '*'));
      const mediumTermKeys = await this.client.keys(this.getMediumTermKey(agentId, '*'));
      const contextWindowSize = await this.client.lLen(this.getContextWindowKey(agentId));
      const hasContext = await this.client.exists(this.getContextKey(agentId)) === 1;

      return {
        shortTermKeys: shortTermKeys.length,
        mediumTermKeys: mediumTermKeys.length,
        contextWindowSize,
        hasContext,
      };
    } catch (error) {
      logError(error as Error, 'Failed to get memory stats', { agentId });
      return {
        shortTermKeys: 0,
        mediumTermKeys: 0,
        contextWindowSize: 0,
        hasContext: false,
      };
    }
  }

  // Helper methods for Redis key generation
  private getShortTermKey(agentId: string, key: string): string {
    return `claudate:agent:${agentId}:short:${key}`;
  }

  private getMediumTermKey(agentId: string, key: string): string {
    return `claudate:agent:${agentId}:medium:${key}`;
  }

  private getContextKey(agentId: string): string {
    return `claudate:agent:${agentId}:context`;
  }

  private getContextWindowKey(agentId: string): string {
    return `claudate:agent:${agentId}:window`;
  }

  public isReady(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const agentMemoryManager = new AgentMemoryManager();