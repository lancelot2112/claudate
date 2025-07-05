import { 
  Document, 
  DocumentType, 
  DocumentMetadata,
  ProcessedDocument,
  IVectorStore,
  IRelationalStore,
  DocumentProcessingError
} from '../../types/Knowledge.js';
import { DocumentProcessorRegistry } from './DocumentProcessor.js';
import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

export interface IngestionJob {
  id: string;
  source: string;
  buffer: Buffer;
  mimeType: string;
  metadata?: Partial<DocumentMetadata>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  documentId?: string;
}

export interface IngestionConfig {
  batchSize: number;
  maxConcurrentJobs: number;
  retryAttempts: number;
  retryDelay: number;
  enableDeduplication: boolean;
  autoTagging: boolean;
}

export interface IngestionStats {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  processingJobs: number;
  averageProcessingTime: number;
  documentsIngested: number;
  chunksCreated: number;
  totalSizeProcessed: number;
}

export class IngestionPipeline extends EventEmitter {
  private processorRegistry: DocumentProcessorRegistry;
  private vectorStore?: IVectorStore;
  private relationalStore?: IRelationalStore;
  private config: IngestionConfig;
  private jobs: Map<string, IngestionJob> = new Map();
  private processingQueue: string[] = [];
  private activeJobs: Set<string> = new Set();
  private stats: IngestionStats = {
    totalJobs: 0,
    completedJobs: 0,
    failedJobs: 0,
    processingJobs: 0,
    averageProcessingTime: 0,
    documentsIngested: 0,
    chunksCreated: 0,
    totalSizeProcessed: 0
  };

  constructor(
    config: Partial<IngestionConfig> = {},
    vectorStore?: IVectorStore,
    relationalStore?: IRelationalStore
  ) {
    super();
    
    this.config = {
      batchSize: 10,
      maxConcurrentJobs: 3,
      retryAttempts: 3,
      retryDelay: 1000,
      enableDeduplication: true,
      autoTagging: true,
      ...config
    };

    this.processorRegistry = new DocumentProcessorRegistry();
    this.vectorStore = vectorStore;
    this.relationalStore = relationalStore;

    logger.info('IngestionPipeline initialized', { config: this.config });
  }

  public setVectorStore(vectorStore: IVectorStore): void {
    this.vectorStore = vectorStore;
  }

  public setRelationalStore(relationalStore: IRelationalStore): void {
    this.relationalStore = relationalStore;
  }

  public async ingestDocument(
    source: string,
    buffer: Buffer,
    mimeType: string,
    metadata?: Partial<DocumentMetadata>
  ): Promise<string> {
    const jobId = uuidv4();
    const job: IngestionJob = {
      id: jobId,
      source,
      buffer,
      mimeType,
      metadata,
      status: 'pending',
      createdAt: new Date()
    };

    this.jobs.set(jobId, job);
    this.processingQueue.push(jobId);
    this.stats.totalJobs++;

    logger.info('Document queued for ingestion', { 
      jobId, 
      source, 
      mimeType,
      bufferSize: buffer.length 
    });

    this.emit('job-queued', job);
    this.processQueue();

    return jobId;
  }

  public async ingestFromFile(filePath: string, metadata?: Partial<DocumentMetadata>): Promise<string> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const buffer = await fs.readFile(filePath);
      const mimeType = this.detectMimeType(path.extname(filePath));
      
      const fileMetadata: Partial<DocumentMetadata> = {
        source: filePath,
        ...metadata
      };

      return this.ingestDocument(filePath, buffer, mimeType, fileMetadata);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to ingest file', { filePath, error: errorMessage });
      throw new DocumentProcessingError(`Failed to ingest file ${filePath}: ${errorMessage}`);
    }
  }

  public async ingestFromURL(url: string, metadata?: Partial<DocumentMetadata>): Promise<string> {
    try {
      // Use built-in fetch if available, otherwise throw error
      if (typeof fetch === 'undefined') {
        throw new Error('Fetch is not available. Please use Node.js 18+ or install a fetch polyfill.');
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const mimeType = response.headers.get('content-type') || 'application/octet-stream';
      
      const urlMetadata: Partial<DocumentMetadata> = {
        source: url,
        author: new URL(url).hostname,
        ...metadata
      };

      return this.ingestDocument(url, buffer, mimeType, urlMetadata);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to ingest URL', { url, error: errorMessage });
      throw new DocumentProcessingError(`Failed to ingest URL ${url}: ${errorMessage}`);
    }
  }

  public async ingestBatch(
    items: Array<{
      source: string;
      buffer: Buffer;
      mimeType: string;
      metadata?: Partial<DocumentMetadata>;
    }>
  ): Promise<string[]> {
    const jobIds: string[] = [];

    for (const item of items) {
      const jobId = await this.ingestDocument(
        item.source,
        item.buffer,
        item.mimeType,
        item.metadata
      );
      jobIds.push(jobId);
    }

    logger.info('Batch ingestion started', { 
      batchSize: items.length,
      jobIds: jobIds.slice(0, 5) // Log first 5 job IDs
    });

    return jobIds;
  }

  private async processQueue(): Promise<void> {
    while (
      this.processingQueue.length > 0 && 
      this.activeJobs.size < this.config.maxConcurrentJobs
    ) {
      const jobId = this.processingQueue.shift();
      if (jobId) {
        this.activeJobs.add(jobId);
        this.processJob(jobId);
      }
    }
  }

  private async processJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      logger.error('Job not found', { jobId });
      this.activeJobs.delete(jobId);
      return;
    }

    try {
      job.status = 'processing';
      job.startedAt = new Date();
      this.stats.processingJobs++;

      logger.debug('Processing job started', { jobId, source: job.source });
      this.emit('job-started', job);

      // Process document
      const processed = await this.processorRegistry.processDocument(
        job.buffer,
        job.mimeType,
        job.metadata as DocumentMetadata
      );

      // Create document
      const document = await this.createDocument(job, processed);
      job.documentId = document.id;

      // Store in vector store
      if (this.vectorStore) {
        await this.vectorStore.addDocument(document);
        logger.debug('Document added to vector store', { documentId: document.id });
      }

      // Store in relational store
      if (this.relationalStore) {
        await this.relationalStore.storeDocument(document);
        logger.debug('Document added to relational store', { documentId: document.id });
      }

      // Update job status
      job.status = 'completed';
      job.completedAt = new Date();
      
      // Update stats
      this.updateStats(job, processed);

      logger.info('Document ingestion completed', { 
        jobId, 
        documentId: document.id,
        chunks: processed.chunks.length 
      });

      this.emit('job-completed', job);
    } catch (error) {
      await this.handleJobError(jobId, error);
    } finally {
      this.stats.processingJobs--;
      this.activeJobs.delete(jobId);
      this.processQueue();
    }
  }

  private async createDocument(job: IngestionJob, processed: ProcessedDocument): Promise<Document> {
    const documentId = uuidv4();
    
    // Auto-tagging
    const tags = [...(processed.metadata.tags || [])];
    if (this.config.autoTagging) {
      tags.push(...this.autoGenerateTags(processed));
    }

    // Deduplication check
    if (this.config.enableDeduplication) {
      const isDuplicate = await this.checkForDuplicate(processed.content);
      if (isDuplicate) {
        logger.warn('Duplicate document detected', { source: job.source });
        tags.push('duplicate');
      }
    }

    // Set document IDs for chunks
    processed.chunks.forEach(chunk => {
      chunk.documentId = documentId;
    });

    const document: Document = {
      id: documentId,
      title: this.extractTitle(job.source, processed.content),
      content: processed.content,
      type: this.determineDocumentType(job.mimeType),
      source: job.source,
      metadata: {
        ...processed.metadata,
        tags: [...new Set(tags)], // Remove duplicates
        fileSize: job.buffer.length,
        mimeType: job.mimeType
      },
      chunks: processed.chunks,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    return document;
  }

  private autoGenerateTags(processed: ProcessedDocument): string[] {
    const tags: string[] = [];
    const content = processed.content.toLowerCase();

    // Language detection
    if (processed.metadata.programmingLanguage) {
      tags.push(processed.metadata.programmingLanguage);
    }

    // Content type detection
    if (content.includes('api') || content.includes('endpoint')) {
      tags.push('api');
    }
    if (content.includes('documentation') || content.includes('readme')) {
      tags.push('documentation');
    }
    if (content.includes('test') || content.includes('spec')) {
      tags.push('test');
    }
    if (content.includes('config') || content.includes('setting')) {
      tags.push('configuration');
    }

    // Technical terms
    const technicalTerms = ['database', 'security', 'performance', 'deployment', 'monitoring'];
    for (const term of technicalTerms) {
      if (content.includes(term)) {
        tags.push(term);
      }
    }

    return tags;
  }

  private async checkForDuplicate(content: string): Promise<boolean> {
    // Simple hash-based deduplication
    const crypto = await import('crypto');
    // Hash is computed but not used in this simple implementation
    crypto.createHash('sha256').update(content).digest('hex');
    
    // In a real implementation, you'd check against stored hashes
    // For now, we'll just return false
    return false;
  }

  private extractTitle(source: string, content: string): string {
    // Try to extract title from content first
    const lines = content.split('\n');
    const firstLine = lines[0]?.trim();
    
    if (firstLine && firstLine.length < 100) {
      // Remove markdown heading symbols
      const title = firstLine.replace(/^#+\s*/, '').trim();
      if (title.length > 0) {
        return title;
      }
    }

    // Fall back to filename - use sync path functions
    const pathModule = require('path');
    return pathModule.basename(source, pathModule.extname(source));
  }

  private determineDocumentType(mimeType: string): DocumentType {
    const typeMap: Record<string, DocumentType> = {
      'text/plain': 'text',
      'text/markdown': 'markdown',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/json': 'text',
      'text/javascript': 'code',
      'text/typescript': 'code',
      'text/x-python': 'code',
      'text/html': 'code',
      'text/css': 'code'
    };

    return typeMap[mimeType] || 'text';
  }

  private detectMimeType(extension: string): string {
    const extMap: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.json': 'application/json',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.py': 'text/x-python',
      '.html': 'text/html',
      '.css': 'text/css',
      '.xml': 'application/xml'
    };

    return extMap[extension.toLowerCase()] || 'application/octet-stream';
  }

  private async handleJobError(jobId: string, error: any): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    job.error = errorMessage;
    job.status = 'failed';
    job.completedAt = new Date();
    this.stats.failedJobs++;

    logger.error('Job processing failed', { 
      jobId, 
      source: job.source,
      error: errorMessage 
    });

    this.emit('job-failed', job);
  }

  private updateStats(job: IngestionJob, processed: ProcessedDocument): void {
    this.stats.completedJobs++;
    this.stats.documentsIngested++;
    this.stats.chunksCreated += processed.chunks.length;
    this.stats.totalSizeProcessed += job.buffer.length;

    if (job.startedAt && job.completedAt) {
      const processingTime = job.completedAt.getTime() - job.startedAt.getTime();
      this.stats.averageProcessingTime = 
        (this.stats.averageProcessingTime * (this.stats.completedJobs - 1) + processingTime) / 
        this.stats.completedJobs;
    }
  }

  public getJob(jobId: string): IngestionJob | undefined {
    return this.jobs.get(jobId);
  }

  public getStats(): IngestionStats {
    return { ...this.stats };
  }

  public getQueueStatus(): {
    queueLength: number;
    activeJobs: number;
    maxConcurrentJobs: number;
  } {
    return {
      queueLength: this.processingQueue.length,
      activeJobs: this.activeJobs.size,
      maxConcurrentJobs: this.config.maxConcurrentJobs
    };
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down ingestion pipeline');
    
    // Wait for active jobs to complete (with timeout)
    const timeout = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (this.activeJobs.size > 0) {
      logger.warn('Some jobs did not complete during shutdown', { 
        activeJobs: this.activeJobs.size 
      });
    }

    this.removeAllListeners();
    logger.info('Ingestion pipeline shutdown completed');
  }
}

export default IngestionPipeline;