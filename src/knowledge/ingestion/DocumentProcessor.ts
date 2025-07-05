import { 
  IDocumentProcessor, 
  ProcessedDocument, 
  Document, 
  DocumentChunk, 
  DocumentMetadata,
  DocumentType,
  DocumentProcessingError 
} from '../../types/Knowledge.js';
import logger from '../../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseDocumentProcessor implements IDocumentProcessor {
  protected chunkSize: number;
  protected chunkOverlap: number;

  constructor(chunkSize = 1000, chunkOverlap = 200) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  abstract supports(mimeType: string): boolean;
  abstract process(buffer: Buffer, metadata?: DocumentMetadata): Promise<ProcessedDocument>;

  protected createChunks(content: string, metadata: DocumentMetadata): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const words = content.split(/\s+/);
    const wordsPerChunk = Math.floor(this.chunkSize / 6); // Rough estimate: 6 chars per word
    const overlapWords = Math.floor(this.chunkOverlap / 6);

    for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const chunkContent = chunkWords.join(' ');
      
      if (chunkContent.trim().length > 0) {
        const chunk: DocumentChunk = {
          id: uuidv4(),
          documentId: '', // Will be set by the document processor
          content: chunkContent,
          startIndex: content.indexOf(chunkWords[0]),
          endIndex: content.indexOf(chunkWords[chunkWords.length - 1]) + chunkWords[chunkWords.length - 1].length,
          metadata: {
            chunkIndex: chunks.length,
            totalChunks: 0, // Will be updated after all chunks are created
            wordCount: chunkWords.length,
            hasCodeBlocks: this.hasCodeBlocks(chunkContent),
            hasImages: this.hasImages(chunkContent)
          }
        };
        
        chunks.push(chunk);
      }
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  protected hasCodeBlocks(content: string): boolean {
    return /```[\s\S]*?```|`[^`]+`/.test(content);
  }

  protected hasImages(content: string): boolean {
    return /!\[.*?\]\(.*?\)/.test(content);
  }

  protected cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export class TextDocumentProcessor extends BaseDocumentProcessor {
  supports(mimeType: string): boolean {
    return [
      'text/plain',
      'text/markdown',
      'text/x-markdown',
      'application/x-markdown'
    ].includes(mimeType);
  }

  async process(buffer: Buffer, metadata?: DocumentMetadata): Promise<ProcessedDocument> {
    try {
      const content = this.cleanText(buffer.toString('utf-8'));
      
      const processedMetadata: DocumentMetadata = {
        language: 'en',
        tags: [],
        extractedAt: new Date(),
        processingVersion: '1.0',
        fileSize: buffer.length,
        mimeType: metadata?.mimeType || 'text/plain',
        ...metadata
      };

      const chunks = this.createChunks(content, processedMetadata);

      return {
        content,
        metadata: processedMetadata,
        chunks
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Text document processing failed', { error: errorMessage });
      throw new DocumentProcessingError(`Text processing failed: ${errorMessage}`);
    }
  }
}

export class PDFDocumentProcessor extends BaseDocumentProcessor {
  supports(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  async process(buffer: Buffer, metadata?: DocumentMetadata): Promise<ProcessedDocument> {
    try {
      // Import pdf-parse dynamically
      const pdfParse = await import('pdf-parse');
      const data = await pdfParse.default(buffer);
      
      const content = this.cleanText(data.text);
      
      const processedMetadata: DocumentMetadata = {
        language: 'en',
        tags: [],
        extractedAt: new Date(),
        processingVersion: '1.0',
        fileSize: buffer.length,
        mimeType: 'application/pdf',
        confidence: data.text.length > 100 ? 0.9 : 0.5,
        pages: data.numpages,
        ...metadata
      };

      const chunks = this.createChunks(content, processedMetadata);

      return {
        content,
        metadata: processedMetadata,
        chunks
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('PDF document processing failed', { error: errorMessage });
      throw new DocumentProcessingError(`PDF processing failed: ${errorMessage}`);
    }
  }
}

export class DocxDocumentProcessor extends BaseDocumentProcessor {
  supports(mimeType: string): boolean {
    return [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ].includes(mimeType);
  }

  async process(buffer: Buffer, metadata?: DocumentMetadata): Promise<ProcessedDocument> {
    try {
      // Import mammoth dynamically
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      
      const content = this.cleanText(result.value);
      
      const processedMetadata: DocumentMetadata = {
        language: 'en',
        tags: [],
        extractedAt: new Date(),
        processingVersion: '1.0',
        fileSize: buffer.length,
        mimeType: metadata?.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        confidence: content.length > 100 ? 0.9 : 0.5,
        ...metadata
      };

      const chunks = this.createChunks(content, processedMetadata);

      return {
        content,
        metadata: processedMetadata,
        chunks
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('DOCX document processing failed', { error: errorMessage });
      throw new DocumentProcessingError(`DOCX processing failed: ${errorMessage}`);
    }
  }
}

export class JSONDocumentProcessor extends BaseDocumentProcessor {
  supports(mimeType: string): boolean {
    return mimeType === 'application/json';
  }

  async process(buffer: Buffer, metadata?: DocumentMetadata): Promise<ProcessedDocument> {
    try {
      const jsonData = JSON.parse(buffer.toString('utf-8'));
      const content = this.cleanText(JSON.stringify(jsonData, null, 2));
      
      const processedMetadata: DocumentMetadata = {
        language: 'en',
        tags: ['json', 'structured-data'],
        extractedAt: new Date(),
        processingVersion: '1.0',
        fileSize: buffer.length,
        mimeType: 'application/json',
        confidence: 1.0,
        ...metadata
      };

      const chunks = this.createChunks(content, processedMetadata);

      return {
        content,
        metadata: processedMetadata,
        chunks
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('JSON document processing failed', { error: errorMessage });
      throw new DocumentProcessingError(`JSON processing failed: ${errorMessage}`);
    }
  }
}

export class CodeDocumentProcessor extends BaseDocumentProcessor {
  private readonly supportedMimeTypes = [
    'text/javascript',
    'application/javascript',
    'text/typescript',
    'application/typescript',
    'text/x-python',
    'application/x-python',
    'text/x-java-source',
    'text/x-c',
    'text/x-c++src',
    'text/x-csharp',
    'text/x-go',
    'text/x-rust',
    'text/x-php',
    'text/x-ruby',
    'text/x-scala',
    'text/x-kotlin',
    'text/x-swift',
    'text/css',
    'text/html',
    'application/xml',
    'text/xml'
  ];

  supports(mimeType: string): boolean {
    return this.supportedMimeTypes.includes(mimeType);
  }

  async process(buffer: Buffer, metadata?: DocumentMetadata): Promise<ProcessedDocument> {
    try {
      const content = this.cleanText(buffer.toString('utf-8'));
      const language = this.detectLanguage(metadata?.mimeType || '');
      
      const processedMetadata: DocumentMetadata = {
        language: 'en',
        tags: ['code', language].filter(Boolean),
        extractedAt: new Date(),
        processingVersion: '1.0',
        fileSize: buffer.length,
        mimeType: metadata?.mimeType || 'text/plain',
        confidence: 1.0,
        programmingLanguage: language,
        ...metadata
      };

      // For code, we might want smaller chunks to preserve function/class boundaries
      const chunks = this.createCodeChunks(content, processedMetadata);

      return {
        content,
        metadata: processedMetadata,
        chunks
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Code document processing failed', { error: errorMessage });
      throw new DocumentProcessingError(`Code processing failed: ${errorMessage}`);
    }
  }

  private detectLanguage(mimeType: string): string {
    const mimeToLanguage: Record<string, string> = {
      'text/javascript': 'javascript',
      'application/javascript': 'javascript',
      'text/typescript': 'typescript',
      'application/typescript': 'typescript',
      'text/x-python': 'python',
      'application/x-python': 'python',
      'text/x-java-source': 'java',
      'text/x-c': 'c',
      'text/x-c++src': 'cpp',
      'text/x-csharp': 'csharp',
      'text/x-go': 'go',
      'text/x-rust': 'rust',
      'text/x-php': 'php',
      'text/x-ruby': 'ruby',
      'text/x-scala': 'scala',
      'text/x-kotlin': 'kotlin',
      'text/x-swift': 'swift',
      'text/css': 'css',
      'text/html': 'html',
      'application/xml': 'xml',
      'text/xml': 'xml'
    };

    return mimeToLanguage[mimeType] || 'unknown';
  }

  private createCodeChunks(content: string, metadata: DocumentMetadata): DocumentChunk[] {
    // For code, try to chunk by functions/classes rather than arbitrary word counts
    const lines = content.split('\n');
    const chunks: DocumentChunk[] = [];
    let currentChunk: string[] = [];
    let currentChunkSize = 0;
    let chunkIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length;

      // Check if this line starts a new function/class/method
      const isNewBlock = this.isNewCodeBlock(line);
      
      // If current chunk is getting too large and we hit a new block, finalize current chunk
      if (currentChunkSize + lineSize > this.chunkSize && currentChunk.length > 0 && isNewBlock) {
        if (currentChunk.length > 0) {
          const chunkContent = currentChunk.join('\n');
          chunks.push({
            id: uuidv4(),
            documentId: '',
            content: chunkContent,
            startIndex: content.indexOf(currentChunk[0]),
            endIndex: content.indexOf(currentChunk[currentChunk.length - 1]) + currentChunk[currentChunk.length - 1].length,
            metadata: {
              chunkIndex,
              totalChunks: 0,
              wordCount: chunkContent.split(/\s+/).length,
              hasCodeBlocks: true,
              hasImages: false,
              sections: this.extractCodeSections(chunkContent)
            }
          });
          chunkIndex++;
        }
        
        currentChunk = [line];
        currentChunkSize = lineSize;
      } else {
        currentChunk.push(line);
        currentChunkSize += lineSize + 1; // +1 for newline
      }
    }

    // Add the last chunk if it exists
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      chunks.push({
        id: uuidv4(),
        documentId: '',
        content: chunkContent,
        startIndex: content.indexOf(currentChunk[0]),
        endIndex: content.indexOf(currentChunk[currentChunk.length - 1]) + currentChunk[currentChunk.length - 1].length,
        metadata: {
          chunkIndex,
          totalChunks: 0,
          wordCount: chunkContent.split(/\s+/).length,
          hasCodeBlocks: true,
          hasImages: false,
          sections: this.extractCodeSections(chunkContent)
        }
      });
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  private isNewCodeBlock(line: string): boolean {
    const trimmed = line.trim();
    
    // Common patterns for new code blocks
    const patterns = [
      /^(class|interface|enum|function|def|async\s+def|const\s+\w+\s*=\s*(function|\()|let\s+\w+\s*=\s*(function|\()|var\s+\w+\s*=\s*(function|\()|export\s+(class|interface|function|const|let))/,
      /^(public|private|protected|static)?\s*(class|interface|function|method)/,
      /^@\w+/, // Decorators
      /^\/\*\*/, // JSDoc comments
      /^#/, // Python comments or directives
    ];

    return patterns.some(pattern => pattern.test(trimmed));
  }

  private extractCodeSections(content: string): string[] {
    const sections: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Extract class names
      const classMatch = trimmed.match(/^(export\s+)?(class|interface)\s+(\w+)/);
      if (classMatch) {
        sections.push(`${classMatch[2]}:${classMatch[3]}`);
      }

      // Extract function names
      const functionMatch = trimmed.match(/^(export\s+)?(function|const|let|var)\s+(\w+)|^(async\s+)?def\s+(\w+)/);
      if (functionMatch) {
        const name = functionMatch[3] || functionMatch[5];
        sections.push(`function:${name}`);
      }
    }

    return sections;
  }
}

export class DocumentProcessorRegistry {
  private processors: IDocumentProcessor[] = [];

  constructor() {
    // Register default processors
    this.registerProcessor(new TextDocumentProcessor());
    this.registerProcessor(new PDFDocumentProcessor());
    this.registerProcessor(new DocxDocumentProcessor());
    this.registerProcessor(new JSONDocumentProcessor());
    this.registerProcessor(new CodeDocumentProcessor());
  }

  registerProcessor(processor: IDocumentProcessor): void {
    this.processors.push(processor);
    logger.debug('Document processor registered', { 
      processor: processor.constructor.name 
    });
  }

  getProcessor(mimeType: string): IDocumentProcessor | null {
    return this.processors.find(processor => processor.supports(mimeType)) || null;
  }

  getSupportedMimeTypes(): string[] {
    const mimeTypes: string[] = [];
    
    // Common mime types that our processors support
    const supportedTypes = [
      'text/plain',
      'text/markdown',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/json',
      'text/javascript',
      'text/typescript',
      'text/x-python',
      'text/html',
      'text/css',
      'application/xml'
    ];

    for (const mimeType of supportedTypes) {
      if (this.getProcessor(mimeType)) {
        mimeTypes.push(mimeType);
      }
    }

    return mimeTypes;
  }

  async processDocument(
    buffer: Buffer, 
    mimeType: string, 
    metadata?: DocumentMetadata
  ): Promise<ProcessedDocument> {
    const processor = this.getProcessor(mimeType);
    
    if (!processor) {
      throw new DocumentProcessingError(
        `No processor found for mime type: ${mimeType}`,
        'UNSUPPORTED_MIME_TYPE'
      );
    }

    try {
      const startTime = Date.now();
      const result = await processor.process(buffer, metadata);
      const duration = Date.now() - startTime;

      logger.info('Document processed successfully', {
        mimeType,
        contentLength: result.content.length,
        chunks: result.chunks.length,
        duration
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Document processing failed', { 
        mimeType,
        error: errorMessage 
      });
      throw error;
    }
  }
}

export default DocumentProcessorRegistry;