import {
  IContextManager,
  ContextTier,
  ContextEntry,
  ContextStats
} from '../../types/Knowledge';
import { Pool } from 'pg';
import { createClient, RedisClientType } from 'redis';
import { config } from '../../utils/config';
import logger from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export interface ContextManagerConfig {
  hot: {
    storage: 'redis';
    ttl: number; // seconds
    maxSize: number; // bytes
    compressionThreshold: number; // bytes
  };
  warm: {
    storage: 'postgresql';
    ttl: number; // seconds
    maxSize: number; // bytes
    compressionEnabled: boolean;
  };
  cold: {
    storage: 'postgresql';
    ttl?: number; // undefined = permanent
    compressionEnabled: boolean;
  };
  migration: {
    hotToWarmThreshold: number; // access count threshold
    warmToColdThreshold: number; // age in seconds
    migrationInterval: number; // seconds
  };
}

export class ContextManager implements IContextManager {
  private redisClient: RedisClientType;
  private pgPool: Pool;
  private config: ContextManagerConfig;
  private migrationTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(customConfig?: Partial<ContextManagerConfig>) {
    this.config = {
      hot: {
        storage: 'redis',
        ttl: 3600, // 1 hour
        maxSize: 1024 * 1024, // 1MB
        compressionThreshold: 10240 // 10KB
      },
      warm: {
        storage: 'postgresql',
        ttl: 86400 * 7, // 7 days
        maxSize: 10 * 1024 * 1024, // 10MB
        compressionEnabled: true
      },
      cold: {
        storage: 'postgresql',
        compressionEnabled: true
      },
      migration: {
        hotToWarmThreshold: 5, // accessed less than 5 times
        warmToColdThreshold: 86400 * 3, // older than 3 days
        migrationInterval: 3600 // run every hour
      },
      ...customConfig
    };

    // Initialize Redis client
    this.redisClient = createClient({
      url: config.redis?.url || 'redis://localhost:6379'
    });

    // Initialize PostgreSQL pool
    this.pgPool = new Pool({
      host: config.database?.host || 'localhost',
      port: config.database?.port || 5432,
      database: config.database?.name || 'claudate',
      user: config.database?.username || 'claudate',
      password: config.database?.password || 'password',
      ssl: config.database?.ssl || false,
      max: 10
    });

    logger.info('ContextManager initialized', { config: this.config });
  }

  public async initialize(): Promise<void> {
    try {
      // Connect to Redis
      await this.redisClient.connect();
      
      // Create PostgreSQL tables
      await this.createTables();
      
      // Start migration timer
      this.startMigrationTimer();
      
      this.isInitialized = true;
      logger.info('ContextManager initialization completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize ContextManager', { error: errorMessage });
      throw new Error(`Failed to initialize context manager: ${errorMessage}`);
    }
  }

  public async shutdown(): Promise<void> {
    try {
      if (this.migrationTimer) {
        clearInterval(this.migrationTimer);
      }
      
      await this.redisClient.quit();
      await this.pgPool.end();
      
      this.isInitialized = false;
      logger.info('ContextManager shutdown completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during ContextManager shutdown', { error: errorMessage });
      throw new Error(`Shutdown failed: ${errorMessage}`);
    }
  }

  public async storeContext(
    sessionId: string,
    userId: string,
    content: any,
    tier: 'hot' | 'warm' | 'cold' = 'hot'
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('ContextManager not initialized');
    }

    try {
      const id = uuidv4();
      const now = new Date();
      const contentString = JSON.stringify(content);
      const size = Buffer.byteLength(contentString, 'utf8');

      const entry: ContextEntry = {
        id,
        sessionId,
        userId,
        content,
        tier,
        timestamp: now,
        accessCount: 0,
        lastAccessed: now,
        size,
        compressed: false
      };

      switch (tier) {
        case 'hot':
          await this.storeInHotTier(entry, contentString);
          break;
        case 'warm':
          await this.storeInWarmTier(entry, contentString);
          break;
        case 'cold':
          await this.storeInColdTier(entry, contentString);
          break;
      }

      logger.debug('Context stored', { 
        id, 
        tier, 
        sessionId, 
        size,
        compressed: entry.compressed 
      });

      return id;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to store context', { 
        sessionId, 
        userId, 
        tier,
        error: errorMessage 
      });
      throw new Error(`Failed to store context: ${errorMessage}`);
    }
  }

  public async getContext(id: string): Promise<ContextEntry | null> {
    if (!this.isInitialized) {
      throw new Error('ContextManager not initialized');
    }

    try {
      // Try hot tier first
      let entry = await this.getFromHotTier(id);
      
      if (!entry) {
        // Try warm/cold tiers
        entry = await this.getFromPersistentTier(id);
        
        if (entry && entry.tier === 'warm') {
          // Promote frequently accessed warm content back to hot
          if (entry.accessCount > 10) {
            await this.promoteToHot(entry);
          }
        }
      }

      if (entry) {
        // Update access statistics
        await this.updateAccessStats(entry);
      }

      return entry;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get context', { id, error: errorMessage });
      throw new Error(`Failed to get context: ${errorMessage}`);
    }
  }

  public async getSessionContext(sessionId: string, limit = 50): Promise<ContextEntry[]> {
    if (!this.isInitialized) {
      throw new Error('ContextManager not initialized');
    }

    try {
      const entries: ContextEntry[] = [];

      // Get from hot tier (Redis)
      const hotKeys = await this.redisClient.keys(`context:${sessionId}:*`);
      for (const key of hotKeys.slice(0, limit)) {
        const keyParts = key.split(':');
        if (keyParts.length >= 3 && keyParts[2]) {
          const entry = await this.getFromHotTier(keyParts[2]);
          if (entry) {
            entries.push(entry);
          }
        }
      }

      // Get remaining from persistent tiers if needed
      if (entries.length < limit) {
        const persistentEntries = await this.getSessionFromPersistentTier(
          sessionId, 
          limit - entries.length
        );
        entries.push(...persistentEntries);
      }

      // Sort by timestamp (most recent first)
      entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return entries.slice(0, limit);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get session context', { sessionId, error: errorMessage });
      throw new Error(`Failed to get session context: ${errorMessage}`);
    }
  }

  public async getUserContext(userId: string, limit = 100): Promise<ContextEntry[]> {
    if (!this.isInitialized) {
      throw new Error('ContextManager not initialized');
    }

    try {
      // For user context, we primarily look in persistent storage
      const client = await this.pgPool.connect();
      try {
        const result = await client.query(`
          SELECT * FROM context_entries 
          WHERE user_id = $1 
          ORDER BY last_accessed DESC 
          LIMIT $2
        `, [userId, limit]);

        const entries: ContextEntry[] = [];
        for (const row of result.rows) {
          const entry = await this.rowToContextEntry(row);
          entries.push(entry);
        }

        return entries;
      } finally {
        client.release();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get user context', { userId, error: errorMessage });
      throw new Error(`Failed to get user context: ${errorMessage}`);
    }
  }

  public async updateContext(id: string, content: any): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ContextManager not initialized');
    }

    try {
      const entry = await this.getContext(id);
      if (!entry) {
        throw new Error(`Context entry not found: ${id}`);
      }

      const contentString = JSON.stringify(content);
      const size = Buffer.byteLength(contentString, 'utf8');

      entry.content = content;
      entry.size = size;
      entry.lastAccessed = new Date();

      switch (entry.tier) {
        case 'hot':
          await this.storeInHotTier(entry, contentString);
          break;
        case 'warm':
        case 'cold':
          await this.updateInPersistentTier(entry, contentString);
          break;
      }

      logger.debug('Context updated', { id, size });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update context', { id, error: errorMessage });
      throw new Error(`Failed to update context: ${errorMessage}`);
    }
  }

  public async deleteContext(id: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ContextManager not initialized');
    }

    try {
      // Delete from Redis (hot tier)
      await this.redisClient.del(`context:entry:${id}`);
      await this.redisClient.del(`context:meta:${id}`);

      // Delete from PostgreSQL (warm/cold tiers)
      const client = await this.pgPool.connect();
      try {
        await client.query('DELETE FROM context_entries WHERE id = $1', [id]);
      } finally {
        client.release();
      }

      logger.debug('Context deleted', { id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete context', { id, error: errorMessage });
      throw new Error(`Failed to delete context: ${errorMessage}`);
    }
  }

  public async compressOldContext(olderThan: Date): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('ContextManager not initialized');
    }

    try {
      const client = await this.pgPool.connect();
      try {
        // Find uncompressed entries older than the threshold
        const result = await client.query(`
          SELECT * FROM context_entries 
          WHERE created_at < $1 AND compressed = false AND content IS NOT NULL
        `, [olderThan]);

        let compressedCount = 0;

        for (const row of result.rows) {
          try {
            const contentBuffer = Buffer.from(row.content, 'utf8');
            const compressedContent = await gzipAsync(contentBuffer);
            
            await client.query(`
              UPDATE context_entries 
              SET content = $1, compressed = true, size = $2
              WHERE id = $3
            `, [compressedContent, compressedContent.length, row.id]);

            compressedCount++;
          } catch (compressionError) {
            logger.warn('Failed to compress context entry', { 
              id: row.id, 
              error: compressionError instanceof Error ? compressionError.message : String(compressionError)
            });
          }
        }

        logger.info('Context compression completed', { 
          entriesProcessed: result.rows.length,
          compressed: compressedCount 
        });

        return compressedCount;
      } finally {
        client.release();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to compress old context', { error: errorMessage });
      throw new Error(`Failed to compress context: ${errorMessage}`);
    }
  }

  public async migrateContext(
    fromTier: ContextTier['name'], 
    toTier: ContextTier['name']
  ): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('ContextManager not initialized');
    }

    try {
      let migratedCount = 0;

      if (fromTier === 'hot' && toTier === 'warm') {
        migratedCount = await this.migrateHotToWarm();
      } else if (fromTier === 'warm' && toTier === 'cold') {
        migratedCount = await this.migrateWarmToCold();
      }

      logger.info('Context migration completed', { 
        fromTier, 
        toTier, 
        migratedCount 
      });

      return migratedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to migrate context', { 
        fromTier, 
        toTier, 
        error: errorMessage 
      });
      throw new Error(`Failed to migrate context: ${errorMessage}`);
    }
  }

  public async getContextStats(): Promise<ContextStats> {
    if (!this.isInitialized) {
      throw new Error('ContextManager not initialized');
    }

    try {
      // Get Redis stats
      const hotKeys = await this.redisClient.keys('context:entry:*');
      const hotCount = hotKeys.length;

      // Get PostgreSQL stats
      const client = await this.pgPool.connect();
      try {
        const result = await client.query(`
          SELECT 
            tier,
            COUNT(*) as count,
            SUM(size) as total_size,
            AVG(access_count) as avg_access_count,
            MIN(created_at) as oldest,
            MAX(created_at) as newest,
            COUNT(CASE WHEN compressed THEN 1 END) as compressed_count
          FROM context_entries 
          GROUP BY tier
        `);

        const entriesByTier: Record<ContextTier['name'], number> = {
          hot: hotCount,
          warm: 0,
          cold: 0
        };

        let totalEntries = hotCount;
        let totalSize = 0;
        let averageAccessCount = 0;
        let oldestEntry = new Date();
        let newestEntry = new Date();
        let compressedEntries = 0;

        for (const row of result.rows) {
          entriesByTier[row.tier as ContextTier['name']] = parseInt(row.count);
          totalEntries += parseInt(row.count);
          totalSize += parseInt(row.total_size || '0');
          averageAccessCount += parseFloat(row.avg_access_count || '0');
          compressedEntries += parseInt(row.compressed_count || '0');
          
          if (row.oldest && new Date(row.oldest) < oldestEntry) {
            oldestEntry = new Date(row.oldest);
          }
          if (row.newest && new Date(row.newest) > newestEntry) {
            newestEntry = new Date(row.newest);
          }
        }

        const totalUncompressed = await client.query(`
          SELECT SUM(size) as total_uncompressed 
          FROM context_entries 
          WHERE compressed = false
        `);

        const uncompressedSize = parseInt(totalUncompressed.rows[0]?.total_uncompressed || '0');
        const compressionRatio = totalSize > 0 ? (totalSize - uncompressedSize) / totalSize : 0;

        return {
          totalEntries,
          entriesByTier,
          totalSize,
          averageAccessCount: averageAccessCount / Math.max(result.rows.length, 1),
          compressionRatio,
          oldestEntry,
          newestEntry
        };
      } finally {
        client.release();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get context stats', { error: errorMessage });
      throw new Error(`Failed to get context stats: ${errorMessage}`);
    }
  }

  private async storeInHotTier(entry: ContextEntry, contentString: string): Promise<void> {
    const shouldCompress = entry.size > this.config.hot.compressionThreshold;
    let dataToStore = contentString;
    
    if (shouldCompress) {
      const compressed = await gzipAsync(Buffer.from(contentString, 'utf8'));
      dataToStore = compressed.toString('base64');
      entry.compressed = true;
      entry.size = compressed.length;
    }

    // Store content
    await this.redisClient.setEx(`context:entry:${entry.id}`, this.config.hot.ttl, dataToStore);
    
    // Store metadata
    const metadata = {
      sessionId: entry.sessionId,
      userId: entry.userId,
      tier: entry.tier,
      timestamp: entry.timestamp.toISOString(),
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed.toISOString(),
      size: entry.size,
      compressed: entry.compressed
    };
    
    await this.redisClient.setEx(
      `context:meta:${entry.id}`, 
      this.config.hot.ttl, 
      JSON.stringify(metadata)
    );

    // Add to session index
    await this.redisClient.setEx(
      `context:${entry.sessionId}:${entry.id}`, 
      this.config.hot.ttl, 
      '1'
    );
  }

  private async storeInWarmTier(entry: ContextEntry, contentString: string): Promise<void> {
    await this.storeInPersistentTier(entry, contentString, 'warm');
  }

  private async storeInColdTier(entry: ContextEntry, contentString: string): Promise<void> {
    await this.storeInPersistentTier(entry, contentString, 'cold');
  }

  private async storeInPersistentTier(
    entry: ContextEntry, 
    contentString: string, 
    tier: 'warm' | 'cold'
  ): Promise<void> {
    const client = await this.pgPool.connect();
    try {
      const shouldCompress = (tier === 'warm' && this.config.warm.compressionEnabled) ||
                           (tier === 'cold' && this.config.cold.compressionEnabled);
      
      let dataToStore: Buffer | string = contentString;
      
      if (shouldCompress) {
        dataToStore = await gzipAsync(Buffer.from(contentString, 'utf8'));
        entry.compressed = true;
        entry.size = dataToStore.length;
      }

      const expiresAt = tier === 'warm' && this.config.warm.ttl 
        ? new Date(Date.now() + this.config.warm.ttl * 1000)
        : null;

      await client.query(`
        INSERT INTO context_entries (
          id, session_id, user_id, content, tier, created_at, 
          access_count, last_accessed, size, compressed, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          tier = EXCLUDED.tier,
          last_accessed = EXCLUDED.last_accessed,
          size = EXCLUDED.size,
          compressed = EXCLUDED.compressed,
          expires_at = EXCLUDED.expires_at
      `, [
        entry.id,
        entry.sessionId,
        entry.userId,
        dataToStore,
        tier,
        entry.timestamp,
        entry.accessCount,
        entry.lastAccessed,
        entry.size,
        entry.compressed,
        expiresAt
      ]);
    } finally {
      client.release();
    }
  }

  private async getFromHotTier(id: string): Promise<ContextEntry | null> {
    try {
      const [content, metadataStr] = await Promise.all([
        this.redisClient.get(`context:entry:${id}`),
        this.redisClient.get(`context:meta:${id}`)
      ]);

      if (!content || !metadataStr) {
        return null;
      }

      const metadata = JSON.parse(metadataStr);
      let actualContent: any;

      if (metadata.compressed) {
        const decompressed = await gunzipAsync(Buffer.from(content, 'base64'));
        actualContent = JSON.parse(decompressed.toString('utf8'));
      } else {
        actualContent = JSON.parse(content);
      }

      return {
        id,
        sessionId: metadata.sessionId,
        userId: metadata.userId,
        content: actualContent,
        tier: metadata.tier,
        timestamp: new Date(metadata.timestamp),
        accessCount: metadata.accessCount,
        lastAccessed: new Date(metadata.lastAccessed),
        size: metadata.size,
        compressed: metadata.compressed
      };
    } catch (error) {
      logger.error('Failed to get from hot tier', { id, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  private async getFromPersistentTier(id: string): Promise<ContextEntry | null> {
    const client = await this.pgPool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM context_entries WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return await this.rowToContextEntry(result.rows[0]);
    } finally {
      client.release();
    }
  }

  private async getSessionFromPersistentTier(sessionId: string, limit: number): Promise<ContextEntry[]> {
    const client = await this.pgPool.connect();
    try {
      const result = await client.query(`
        SELECT * FROM context_entries 
        WHERE session_id = $1 
        ORDER BY last_accessed DESC 
        LIMIT $2
      `, [sessionId, limit]);

      const entries: ContextEntry[] = [];
      for (const row of result.rows) {
        const entry = await this.rowToContextEntry(row);
        entries.push(entry);
      }

      return entries;
    } finally {
      client.release();
    }
  }

  private async rowToContextEntry(row: any): Promise<ContextEntry> {
    let content: any;

    if (row.compressed && row.content) {
      const decompressed = await gunzipAsync(row.content);
      content = JSON.parse(decompressed.toString('utf8'));
    } else if (row.content) {
      content = JSON.parse(row.content.toString('utf8'));
    } else {
      content = null;
    }

    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      content,
      tier: row.tier,
      timestamp: new Date(row.created_at),
      accessCount: row.access_count,
      lastAccessed: new Date(row.last_accessed),
      size: row.size,
      compressed: row.compressed,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  private async updateAccessStats(entry: ContextEntry): Promise<void> {
    entry.accessCount++;
    entry.lastAccessed = new Date();

    if (entry.tier === 'hot') {
      // Update metadata in Redis
      const metadata = {
        sessionId: entry.sessionId,
        userId: entry.userId,
        tier: entry.tier,
        timestamp: entry.timestamp.toISOString(),
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed.toISOString(),
        size: entry.size,
        compressed: entry.compressed
      };
      
      await this.redisClient.setEx(
        `context:meta:${entry.id}`, 
        this.config.hot.ttl, 
        JSON.stringify(metadata)
      );
    } else {
      // Update in PostgreSQL
      const client = await this.pgPool.connect();
      try {
        await client.query(`
          UPDATE context_entries 
          SET access_count = $1, last_accessed = $2 
          WHERE id = $3
        `, [entry.accessCount, entry.lastAccessed, entry.id]);
      } finally {
        client.release();
      }
    }
  }

  private async promoteToHot(entry: ContextEntry): Promise<void> {
    if (entry.tier === 'hot') return;

    try {
      // Store in hot tier
      const contentString = JSON.stringify(entry.content);
      entry.tier = 'hot';
      await this.storeInHotTier(entry, contentString);

      // Remove from persistent tier
      const client = await this.pgPool.connect();
      try {
        await client.query('DELETE FROM context_entries WHERE id = $1', [entry.id]);
      } finally {
        client.release();
      }

      logger.debug('Context promoted to hot tier', { id: entry.id });
    } catch (error) {
      logger.error('Failed to promote context to hot tier', { 
        id: entry.id, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async updateInPersistentTier(entry: ContextEntry, contentString: string): Promise<void> {
    const client = await this.pgPool.connect();
    try {
      const shouldCompress = (entry.tier === 'warm' && this.config.warm.compressionEnabled) ||
                           (entry.tier === 'cold' && this.config.cold.compressionEnabled);
      
      let dataToStore: Buffer | string = contentString;
      
      if (shouldCompress) {
        dataToStore = await gzipAsync(Buffer.from(contentString, 'utf8'));
        entry.compressed = true;
        entry.size = dataToStore.length;
      }

      await client.query(`
        UPDATE context_entries 
        SET content = $1, last_accessed = $2, size = $3, compressed = $4
        WHERE id = $5
      `, [dataToStore, entry.lastAccessed, entry.size, entry.compressed, entry.id]);
    } finally {
      client.release();
    }
  }

  private async migrateHotToWarm(): Promise<number> {
    const hotKeys = await this.redisClient.keys('context:meta:*');
    let migratedCount = 0;

    for (const key of hotKeys) {
      try {
        const metadataStr = await this.redisClient.get(key);
        if (!metadataStr) continue;

        const metadata = JSON.parse(metadataStr);
        const keyParts = key.split(':');
        if (keyParts.length >= 3 && keyParts[2]) {
          const id = keyParts[2];

          // Check if should be migrated (low access count and old enough)
          if (metadata.accessCount <= this.config.migration.hotToWarmThreshold) {
            const entry = await this.getFromHotTier(id);
            if (entry) {
              entry.tier = 'warm';
              const contentString = JSON.stringify(entry.content);
              await this.storeInWarmTier(entry, contentString);

              // Remove from Redis
              await this.redisClient.del(`context:entry:${id}`);
              await this.redisClient.del(`context:meta:${id}`);
              await this.redisClient.del(`context:${entry.sessionId}:${id}`);

              migratedCount++;
            }
          }
        }
      } catch (error) {
        logger.error('Error migrating hot to warm', { key, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return migratedCount;
  }

  private async migrateWarmToCold(): Promise<number> {
    const client = await this.pgPool.connect();
    try {
      const threshold = new Date(Date.now() - this.config.migration.warmToColdThreshold * 1000);
      
      const result = await client.query(`
        UPDATE context_entries 
        SET tier = 'cold', expires_at = NULL
        WHERE tier = 'warm' AND created_at < $1
        RETURNING id
      `, [threshold]);

      return result.rows.length;
    } finally {
      client.release();
    }
  }

  private startMigrationTimer(): void {
    this.migrationTimer = setInterval(async () => {
      try {
        const hotToWarm = await this.migrateContext('hot', 'warm');
        const warmToCold = await this.migrateContext('warm', 'cold');
        
        if (hotToWarm > 0 || warmToCold > 0) {
          logger.info('Automatic context migration completed', { 
            hotToWarm, 
            warmToCold 
          });
        }
      } catch (error) {
        logger.error('Automatic context migration failed', { error: error instanceof Error ? error.message : String(error) });
      }
    }, this.config.migration.migrationInterval * 1000);
  }

  private async createTables(): Promise<void> {
    const client = await this.pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS context_entries (
          id VARCHAR(255) PRIMARY KEY,
          session_id VARCHAR(255) NOT NULL,
          user_id VARCHAR(255) NOT NULL,
          content BYTEA,
          tier VARCHAR(10) NOT NULL CHECK (tier IN ('warm', 'cold')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          access_count INTEGER DEFAULT 0,
          last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          size INTEGER DEFAULT 0,
          compressed BOOLEAN DEFAULT FALSE,
          expires_at TIMESTAMP WITH TIME ZONE,
          metadata JSONB
        )
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_context_session_id ON context_entries(session_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_context_user_id ON context_entries(user_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_context_tier ON context_entries(tier)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_context_created_at ON context_entries(created_at)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_context_expires_at ON context_entries(expires_at)
      `);

      logger.debug('Context tables and indexes created successfully');
    } finally {
      client.release();
    }
  }
}

export default ContextManager;