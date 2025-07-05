import { Pool, PoolClient } from 'pg';
import {
  IRelationalStore,
  Document,
  DocumentType,
  SearchResult,
  KnowledgeQuery,
  QueryFilter,
  RelationalStoreStats,
  VectorStoreError
} from '../../types/Knowledge.js';
import { config } from '../../utils/config.js';
import logger from '../../utils/logger.js';

export interface RelationalStoreConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

export class RelationalStore implements IRelationalStore {
  private pool: Pool;
  private config: RelationalStoreConfig;
  private isInitialized = false;

  constructor(customConfig?: Partial<RelationalStoreConfig>) {
    this.config = {
      host: config.database?.host || 'localhost',
      port: config.database?.port || 5432,
      database: config.database?.name || 'claudate',
      username: config.database?.username || 'claudate',
      password: config.database?.password || 'password',
      ssl: config.database?.ssl || false,
      maxConnections: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ...customConfig
    };

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password: this.config.password,
      ssl: this.config.ssl,
      max: this.config.maxConnections,
      idleTimeoutMillis: this.config.idleTimeoutMillis,
      connectionTimeoutMillis: this.config.connectionTimeoutMillis
    });

    logger.info('RelationalStore initialized', {
      host: this.config.host,
      database: this.config.database,
      maxConnections: this.config.maxConnections
    });
  }

  public async initialize(): Promise<void> {
    try {
      await this.createTables();
      await this.createIndexes();
      this.isInitialized = true;
      logger.info('RelationalStore initialization completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize RelationalStore', { error: errorMessage });
      throw new VectorStoreError(`Failed to initialize relational store: ${errorMessage}`);
    }
  }

  public async shutdown(): Promise<void> {
    try {
      await this.pool.end();
      this.isInitialized = false;
      logger.info('RelationalStore shutdown completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error during RelationalStore shutdown', { error: errorMessage });
      throw new VectorStoreError(`Shutdown failed: ${errorMessage}`);
    }
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        return true;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('RelationalStore health check failed', { error: error.message });
      return false;
    }
  }

  public async storeDocument(document: Document): Promise<void> {
    if (!this.isInitialized) {
      throw new VectorStoreError('RelationalStore not initialized');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert document
      const documentQuery = `
        INSERT INTO documents (
          id, title, content, type, source, author, tags, language, 
          file_size, mime_type, created_at, updated_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          type = EXCLUDED.type,
          source = EXCLUDED.source,
          author = EXCLUDED.author,
          tags = EXCLUDED.tags,
          language = EXCLUDED.language,
          file_size = EXCLUDED.file_size,
          mime_type = EXCLUDED.mime_type,
          updated_at = EXCLUDED.updated_at,
          metadata = EXCLUDED.metadata
      `;

      await client.query(documentQuery, [
        document.id,
        document.title,
        document.content,
        document.type,
        document.source,
        document.metadata.author || null,
        document.metadata.tags,
        document.metadata.language,
        document.metadata.fileSize || null,
        document.metadata.mimeType || null,
        document.createdAt,
        document.updatedAt,
        JSON.stringify(document.metadata)
      ]);

      // Insert chunks if they exist
      if (document.chunks && document.chunks.length > 0) {
        // Delete existing chunks first
        await client.query('DELETE FROM document_chunks WHERE document_id = $1', [document.id]);

        // Insert new chunks
        const chunkQuery = `
          INSERT INTO document_chunks (
            id, document_id, content, start_index, end_index, chunk_index, 
            total_chunks, word_count, has_code_blocks, has_images, metadata
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        for (const chunk of document.chunks) {
          await client.query(chunkQuery, [
            chunk.id,
            chunk.documentId,
            chunk.content,
            chunk.startIndex,
            chunk.endIndex,
            chunk.metadata.chunkIndex,
            chunk.metadata.totalChunks,
            chunk.metadata.wordCount,
            chunk.metadata.hasCodeBlocks || false,
            chunk.metadata.hasImages || false,
            JSON.stringify(chunk.metadata)
          ]);
        }
      }

      await client.query('COMMIT');
      logger.debug('Document stored in relational store', { documentId: document.id });
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to store document in relational store', { 
        documentId: document.id,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to store document: ${errorMessage}`);
    } finally {
      client.release();
    }
  }

  public async getDocument(id: string): Promise<Document | null> {
    if (!this.isInitialized) {
      throw new VectorStoreError('RelationalStore not initialized');
    }

    const client = await this.pool.connect();
    try {
      // Get document
      const documentResult = await client.query(
        'SELECT * FROM documents WHERE id = $1',
        [id]
      );

      if (documentResult.rows.length === 0) {
        return null;
      }

      const row = documentResult.rows[0];

      // Get chunks
      const chunksResult = await client.query(
        'SELECT * FROM document_chunks WHERE document_id = $1 ORDER BY chunk_index',
        [id]
      );

      const document: Document = {
        id: row.id,
        title: row.title,
        content: row.content,
        type: row.type as DocumentType,
        source: row.source,
        metadata: {
          ...JSON.parse(row.metadata || '{}'),
          author: row.author,
          tags: row.tags || [],
          language: row.language,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          extractedAt: new Date(row.created_at),
          processingVersion: '1.0'
        },
        chunks: chunksResult.rows.map(chunkRow => ({
          id: chunkRow.id,
          documentId: chunkRow.document_id,
          content: chunkRow.content,
          startIndex: chunkRow.start_index,
          endIndex: chunkRow.end_index,
          metadata: {
            ...JSON.parse(chunkRow.metadata || '{}'),
            chunkIndex: chunkRow.chunk_index,
            totalChunks: chunkRow.total_chunks,
            wordCount: chunkRow.word_count,
            hasCodeBlocks: chunkRow.has_code_blocks,
            hasImages: chunkRow.has_images
          }
        })),
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      };

      return document;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get document from relational store', { 
        documentId: id,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to get document: ${errorMessage}`);
    } finally {
      client.release();
    }
  }

  public async updateDocument(id: string, updates: Partial<Document>): Promise<void> {
    if (!this.isInitialized) {
      throw new VectorStoreError('RelationalStore not initialized');
    }

    const client = await this.pool.connect();
    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.title !== undefined) {
        setParts.push(`title = $${paramIndex++}`);
        values.push(updates.title);
      }
      if (updates.content !== undefined) {
        setParts.push(`content = $${paramIndex++}`);
        values.push(updates.content);
      }
      if (updates.type !== undefined) {
        setParts.push(`type = $${paramIndex++}`);
        values.push(updates.type);
      }
      if (updates.source !== undefined) {
        setParts.push(`source = $${paramIndex++}`);
        values.push(updates.source);
      }
      if (updates.metadata !== undefined) {
        setParts.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(updates.metadata));
        
        if (updates.metadata.author !== undefined) {
          setParts.push(`author = $${paramIndex++}`);
          values.push(updates.metadata.author);
        }
        if (updates.metadata.tags !== undefined) {
          setParts.push(`tags = $${paramIndex++}`);
          values.push(updates.metadata.tags);
        }
        if (updates.metadata.language !== undefined) {
          setParts.push(`language = $${paramIndex++}`);
          values.push(updates.metadata.language);
        }
      }

      setParts.push(`updated_at = $${paramIndex++}`);
      values.push(new Date());

      values.push(id); // For WHERE clause

      const query = `UPDATE documents SET ${setParts.join(', ')} WHERE id = $${paramIndex}`;
      await client.query(query, values);

      logger.debug('Document updated in relational store', { documentId: id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update document in relational store', { 
        documentId: id,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to update document: ${errorMessage}`);
    } finally {
      client.release();
    }
  }

  public async deleteDocument(id: string): Promise<void> {
    if (!this.isInitialized) {
      throw new VectorStoreError('RelationalStore not initialized');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Delete chunks first (foreign key constraint)
      await client.query('DELETE FROM document_chunks WHERE document_id = $1', [id]);
      
      // Delete document
      await client.query('DELETE FROM documents WHERE id = $1', [id]);

      await client.query('COMMIT');
      logger.debug('Document deleted from relational store', { documentId: id });
    } catch (error) {
      await client.query('ROLLBACK');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to delete document from relational store', { 
        documentId: id,
        error: errorMessage 
      });
      throw new VectorStoreError(`Failed to delete document: ${errorMessage}`);
    } finally {
      client.release();
    }
  }

  public async searchDocuments(query: KnowledgeQuery): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new VectorStoreError('RelationalStore not initialized');
    }

    const client = await this.pool.connect();
    try {
      let sqlQuery = `
        SELECT d.*, ts_rank(to_tsvector('english', d.content || ' ' || d.title), query) as rank
        FROM documents d, plainto_tsquery('english', $1) query
        WHERE to_tsvector('english', d.content || ' ' || d.title) @@ query
      `;
      
      const values: any[] = [query.query];
      let paramIndex = 2;

      // Add filters
      if (query.filters && query.filters.length > 0) {
        const filterConditions = this.buildFilterConditions(query.filters, paramIndex);
        sqlQuery += ` AND ${filterConditions.conditions}`;
        values.push(...filterConditions.values);
        paramIndex += filterConditions.values.length;
      }

      sqlQuery += ' ORDER BY rank DESC';

      if (query.limit) {
        sqlQuery += ` LIMIT $${paramIndex}`;
        values.push(query.limit);
      }

      const result = await client.query(sqlQuery, values);

      const searchResults: SearchResult[] = result.rows.map(row => {
        const document: Document = {
          id: row.id,
          title: row.title,
          content: row.content,
          type: row.type as DocumentType,
          source: row.source,
          metadata: {
            ...JSON.parse(row.metadata || '{}'),
            author: row.author,
            tags: row.tags || [],
            language: row.language,
            fileSize: row.file_size,
            mimeType: row.mime_type,
            extractedAt: new Date(row.created_at),
            processingVersion: '1.0'
          },
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at)
        };

        return {
          document,
          score: parseFloat(row.rank) || 0,
          relevanceScore: parseFloat(row.rank) || 0
        };
      });

      logger.debug('Document search completed', { 
        query: query.query.substring(0, 100),
        results: searchResults.length 
      });

      return searchResults;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Document search failed', { 
        query: query.query.substring(0, 100),
        error: errorMessage 
      });
      throw new VectorStoreError(`Search failed: ${errorMessage}`);
    } finally {
      client.release();
    }
  }

  public async getDocumentsByType(type: DocumentType): Promise<Document[]> {
    if (!this.isInitialized) {
      throw new VectorStoreError('RelationalStore not initialized');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM documents WHERE type = $1 ORDER BY created_at DESC',
        [type]
      );

      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        type: row.type as DocumentType,
        source: row.source,
        metadata: {
          ...JSON.parse(row.metadata || '{}'),
          author: row.author,
          tags: row.tags || [],
          language: row.language,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          extractedAt: new Date(row.created_at),
          processingVersion: '1.0'
        },
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get documents by type', { type, error: errorMessage });
      throw new VectorStoreError(`Failed to get documents by type: ${errorMessage}`);
    } finally {
      client.release();
    }
  }

  public async getDocumentsByTags(tags: string[]): Promise<Document[]> {
    if (!this.isInitialized) {
      throw new VectorStoreError('RelationalStore not initialized');
    }

    const client = await this.pool.connect();
    try {
      const result = await client.query(
        'SELECT * FROM documents WHERE tags && $1 ORDER BY created_at DESC',
        [tags]
      );

      return result.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        type: row.type as DocumentType,
        source: row.source,
        metadata: {
          ...JSON.parse(row.metadata || '{}'),
          author: row.author,
          tags: row.tags || [],
          language: row.language,
          fileSize: row.file_size,
          mimeType: row.mime_type,
          extractedAt: new Date(row.created_at),
          processingVersion: '1.0'
        },
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get documents by tags', { tags, error: errorMessage });
      throw new VectorStoreError(`Failed to get documents by tags: ${errorMessage}`);
    } finally {
      client.release();
    }
  }

  public async getDocumentStats(): Promise<RelationalStoreStats> {
    if (!this.isInitialized) {
      throw new VectorStoreError('RelationalStore not initialized');
    }

    const client = await this.pool.connect();
    try {
      // Get total documents
      const totalResult = await client.query('SELECT COUNT(*) as count FROM documents');
      const totalDocuments = parseInt(totalResult.rows[0].count);

      // Get documents by type
      const typeResult = await client.query(`
        SELECT type, COUNT(*) as count 
        FROM documents 
        GROUP BY type
      `);
      
      const documentsByType: Record<DocumentType, number> = {
        'text': 0,
        'markdown': 0,
        'pdf': 0,
        'docx': 0,
        'code': 0,
        'email': 0,
        'chat': 0,
        'url': 0,
        'image': 0,
        'audio': 0,
        'video': 0
      };
      typeResult.rows.forEach(row => {
        documentsByType[row.type as DocumentType] = parseInt(row.count);
      });

      // Get average document size
      const sizeResult = await client.query(`
        SELECT AVG(LENGTH(content)) as avg_size,
               SUM(LENGTH(content)) as total_size
        FROM documents
      `);
      
      const averageDocumentSize = parseInt(sizeResult.rows[0]?.avg_size || '0');
      const totalStorageSize = parseInt(sizeResult.rows[0]?.total_size || '0');

      return {
        totalDocuments,
        documentsByType,
        averageDocumentSize,
        totalStorageSize,
        indexingStatus: 'complete',
        lastUpdated: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get document stats', { error: errorMessage });
      throw new VectorStoreError(`Failed to get stats: ${errorMessage}`);
    } finally {
      client.release();
    }
  }

  private buildFilterConditions(filters: QueryFilter[], startParamIndex: number): {
    conditions: string;
    values: any[];
  } {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = startParamIndex;

    for (const filter of filters) {
      switch (filter.operator) {
        case 'eq':
          conditions.push(`${filter.field} = $${paramIndex}`);
          values.push(filter.value);
          paramIndex++;
          break;
        case 'neq':
          conditions.push(`${filter.field} != $${paramIndex}`);
          values.push(filter.value);
          paramIndex++;
          break;
        case 'in':
          conditions.push(`${filter.field} = ANY($${paramIndex})`);
          values.push(filter.value);
          paramIndex++;
          break;
        case 'contains':
          conditions.push(`${filter.field} ILIKE $${paramIndex}`);
          values.push(`%${filter.value}%`);
          paramIndex++;
          break;
        case 'gt':
          conditions.push(`${filter.field} > $${paramIndex}`);
          values.push(filter.value);
          paramIndex++;
          break;
        case 'gte':
          conditions.push(`${filter.field} >= $${paramIndex}`);
          values.push(filter.value);
          paramIndex++;
          break;
        case 'lt':
          conditions.push(`${filter.field} < $${paramIndex}`);
          values.push(filter.value);
          paramIndex++;
          break;
        case 'lte':
          conditions.push(`${filter.field} <= $${paramIndex}`);
          values.push(filter.value);
          paramIndex++;
          break;
      }
    }

    return {
      conditions: conditions.join(' AND '),
      values
    };
  }

  private async createTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Create documents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR(255) PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          source TEXT NOT NULL,
          author VARCHAR(255),
          tags TEXT[],
          language VARCHAR(10) DEFAULT 'en',
          file_size INTEGER,
          mime_type VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          metadata JSONB
        )
      `);

      // Create document_chunks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS document_chunks (
          id VARCHAR(255) PRIMARY KEY,
          document_id VARCHAR(255) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          start_index INTEGER NOT NULL,
          end_index INTEGER NOT NULL,
          chunk_index INTEGER NOT NULL,
          total_chunks INTEGER NOT NULL,
          word_count INTEGER,
          has_code_blocks BOOLEAN DEFAULT FALSE,
          has_images BOOLEAN DEFAULT FALSE,
          metadata JSONB
        )
      `);

      logger.debug('Database tables created successfully');
    } finally {
      client.release();
    }
  }

  private async createIndexes(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Full-text search index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_fulltext 
        ON documents USING gin(to_tsvector('english', content || ' ' || title))
      `);

      // Type index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type)
      `);

      // Tags index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_tags ON documents USING gin(tags)
      `);

      // Source index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source)
      `);

      // Created date index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at)
      `);

      // Document chunks index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id)
      `);

      // Chunk index for ordering
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_chunks_chunk_index ON document_chunks(document_id, chunk_index)
      `);

      logger.debug('Database indexes created successfully');
    } finally {
      client.release();
    }
  }
}

export default RelationalStore;