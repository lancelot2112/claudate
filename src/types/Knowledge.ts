// Knowledge Management types for Claudate framework

export interface Document {
  id: string;
  title: string;
  content: string;
  type: DocumentType;
  source: string;
  metadata: DocumentMetadata;
  embeddings?: number[];
  chunks?: DocumentChunk[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  startIndex: number;
  endIndex: number;
  embeddings?: number[];
  metadata: ChunkMetadata;
}

export interface DocumentMetadata {
  author?: string;
  tags: string[];
  language: string;
  fileSize?: number;
  mimeType?: string;
  extractedAt: Date;
  processingVersion: string;
  confidence?: number;
  [key: string]: any;
}

export interface ChunkMetadata {
  chunkIndex: number;
  totalChunks: number;
  wordCount: number;
  hasCodeBlocks?: boolean;
  hasImages?: boolean;
  sections?: string[];
  [key: string]: any;
}

export type DocumentType = 
  | 'text' 
  | 'markdown' 
  | 'pdf' 
  | 'docx' 
  | 'code' 
  | 'email' 
  | 'chat' 
  | 'url' 
  | 'image' 
  | 'audio' 
  | 'video';

export interface KnowledgeQuery {
  query: string;
  filters?: QueryFilter[];
  limit?: number;
  threshold?: number;
  includeEmbeddings?: boolean;
  contextWindow?: number;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'startswith' | 'endswith';
  value: any;
}

export interface SearchResult {
  document: Document;
  chunk?: DocumentChunk;
  score: number;
  relevanceScore: number;
  contextScore?: number;
  explanation?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
  processingTime: number;
  metadata: {
    searchType: 'semantic' | 'keyword' | 'hybrid';
    model?: string;
    threshold: number;
    filters?: QueryFilter[];
  };
}

// Vector Store interfaces
export interface VectorStoreConfig {
  provider: 'chroma' | 'pinecone' | 'weaviate' | 'local';
  connectionString?: string;
  collectionName: string;
  dimensions: number;
  distanceMetric?: 'cosine' | 'euclidean' | 'dot';
  apiKey?: string;
  namespace?: string;
}

export interface EmbeddingConfig {
  provider: 'openai' | 'huggingface' | 'local';
  model: string;
  dimensions: number;
  batchSize?: number;
  maxTokens?: number;
  apiKey?: string;
}

export interface VectorSearchOptions {
  k?: number;
  threshold?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
  includeScores?: boolean;
}

// Knowledge Store interfaces
export interface IKnowledgeStore {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export interface IVectorStore extends IKnowledgeStore {
  addDocuments(documents: Document[]): Promise<void>;
  addDocument(document: Document): Promise<void>;
  updateDocument(id: string, document: Partial<Document>): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  searchSimilar(query: string, options?: VectorSearchOptions): Promise<SearchResult[]>;
  searchByEmbedding(embedding: number[], options?: VectorSearchOptions): Promise<SearchResult[]>;
  getDocument(id: string): Promise<Document | null>;
  listDocuments(limit?: number, offset?: number): Promise<Document[]>;
  getCollectionStats(): Promise<VectorStoreStats>;
}

export interface IRelationalStore extends IKnowledgeStore {
  storeDocument(document: Document): Promise<void>;
  getDocument(id: string): Promise<Document | null>;
  updateDocument(id: string, updates: Partial<Document>): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  searchDocuments(query: KnowledgeQuery): Promise<SearchResult[]>;
  getDocumentsByType(type: DocumentType): Promise<Document[]>;
  getDocumentsByTags(tags: string[]): Promise<Document[]>;
  getDocumentStats(): Promise<RelationalStoreStats>;
}

export interface IGraphStore extends IKnowledgeStore {
  addNode(id: string, type: string, properties: Record<string, any>): Promise<void>;
  addEdge(fromId: string, toId: string, type: string, properties?: Record<string, any>): Promise<void>;
  getNode(id: string): Promise<GraphNode | null>;
  getRelated(id: string, relationshipType?: string, depth?: number): Promise<GraphNode[]>;
  findPath(fromId: string, toId: string, maxDepth?: number): Promise<GraphPath | null>;
  queryGraph(query: string): Promise<GraphResult[]>;
  deleteNode(id: string): Promise<void>;
  deleteEdge(fromId: string, toId: string, type: string): Promise<void>;
}

export interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, any>;
  relationships?: GraphRelationship[];
}

export interface GraphRelationship {
  id: string;
  type: string;
  targetId: string;
  properties?: Record<string, any>;
}

export interface GraphPath {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  length: number;
  weight?: number;
}

export interface GraphResult {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
  metadata?: Record<string, any>;
}

// Document processing interfaces
export interface IDocumentProcessor {
  supports(mimeType: string): boolean;
  process(buffer: Buffer, metadata?: DocumentMetadata): Promise<ProcessedDocument>;
}

export interface ProcessedDocument {
  content: string;
  metadata: DocumentMetadata;
  chunks: DocumentChunk[];
  extractedImages?: ExtractedImage[];
  extractedTables?: ExtractedTable[];
}

export interface ExtractedImage {
  id: string;
  base64: string;
  mimeType: string;
  description?: string;
  position?: { page?: number; x?: number; y?: number };
}

export interface ExtractedTable {
  id: string;
  headers: string[];
  rows: string[][];
  caption?: string;
  position?: { page?: number; x?: number; y?: number };
}

// RAG System interfaces
export interface RAGConfig {
  vectorStore: VectorStoreConfig;
  embeddingConfig: EmbeddingConfig;
  chunkSize: number;
  chunkOverlap: number;
  maxContextLength: number;
  retrievalStrategy: 'similarity' | 'mmr' | 'hybrid';
  rerankingModel?: string;
}

export interface RAGContext {
  query: string;
  retrievedDocuments: SearchResult[];
  conversationHistory?: ContextMessage[];
  userPreferences?: Record<string, any>;
  sessionMetadata?: Record<string, any>;
}

export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  confidence: number;
  retrievalMetrics: {
    documentsRetrieved: number;
    averageRelevanceScore: number;
    processingTime: number;
  };
  metadata?: Record<string, any>;
}

// Context Management interfaces
export interface ContextTier {
  name: 'hot' | 'warm' | 'cold';
  storage: 'redis' | 'postgresql' | 'vector' | 'file';
  ttl?: number;
  maxSize?: number;
  compressionEnabled?: boolean;
}

export interface ContextEntry {
  id: string;
  sessionId: string;
  userId: string;
  content: any;
  tier: 'hot' | 'warm' | 'cold';
  timestamp: Date;
  accessCount: number;
  lastAccessed: Date;
  size: number;
  compressed?: boolean;
  metadata?: Record<string, any>;
}

export interface IContextManager {
  storeContext(sessionId: string, userId: string, content: any, tier?: 'hot' | 'warm' | 'cold'): Promise<string>;
  getContext(id: string): Promise<ContextEntry | null>;
  getSessionContext(sessionId: string, limit?: number): Promise<ContextEntry[]>;
  getUserContext(userId: string, limit?: number): Promise<ContextEntry[]>;
  updateContext(id: string, content: any): Promise<void>;
  deleteContext(id: string): Promise<void>;
  compressOldContext(olderThan: Date): Promise<number>;
  migrateContext(fromTier: ContextTier['name'], toTier: ContextTier['name']): Promise<number>;
  getContextStats(): Promise<ContextStats>;
}

// Statistics interfaces
export interface VectorStoreStats {
  totalDocuments: number;
  totalChunks: number;
  averageEmbeddingTime: number;
  storageSize: number;
  lastUpdated: Date;
  indexHealth: 'healthy' | 'degraded' | 'critical';
}

export interface RelationalStoreStats {
  totalDocuments: number;
  documentsByType: Record<DocumentType, number>;
  averageDocumentSize: number;
  totalStorageSize: number;
  indexingStatus: 'complete' | 'in_progress' | 'failed';
  lastUpdated: Date;
}

export interface ContextStats {
  totalEntries: number;
  entriesByTier: Record<ContextTier['name'], number>;
  totalSize: number;
  averageAccessCount: number;
  compressionRatio: number;
  oldestEntry: Date;
  newestEntry: Date;
}

// Error types
export interface KnowledgeError extends Error {
  code: string;
  metadata?: Record<string, any>;
}

export class DocumentProcessingError extends Error implements KnowledgeError {
  code: string;
  metadata?: Record<string, any>;

  constructor(message: string, code = 'DOCUMENT_PROCESSING_ERROR', metadata?: Record<string, any>) {
    super(message);
    this.name = 'DocumentProcessingError';
    this.code = code;
    this.metadata = metadata;
  }
}

export class VectorStoreError extends Error implements KnowledgeError {
  code: string;
  metadata?: Record<string, any>;

  constructor(message: string, code = 'VECTOR_STORE_ERROR', metadata?: Record<string, any>) {
    super(message);
    this.name = 'VectorStoreError';
    this.code = code;
    this.metadata = metadata;
  }
}

export class EmbeddingError extends Error implements KnowledgeError {
  code: string;
  metadata?: Record<string, any>;

  constructor(message: string, code = 'EMBEDDING_ERROR', metadata?: Record<string, any>) {
    super(message);
    this.name = 'EmbeddingError';
    this.code = code;
    this.metadata = metadata;
  }
}