import {
  ContextMessage,
  ContextEntry
} from '../../types/Knowledge';
import { AIProvider, TextGenerationRequest } from '../../integrations/ai/AIProvider';
import { PromptManager, PromptOverride } from '../../config/PromptManager';
import logger from '../../utils/logger';

export interface CompressionConfig {
  maxInputLength: number;
  targetCompressionRatio: number; // 0.3 = compress to 30% of original
  preserveKeyInformation: boolean;
  useSemanticCompression: boolean;
  chunkSize: number;
  enableSummarization: boolean;
  respectContextWindow: boolean; // Whether to respect provider's context window
}

export interface CompressionResult {
  compressedContent: string;
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
  preservedKeyPoints: string[];
  tokenCount: number;
  metadata: {
    method: 'semantic' | 'statistical' | 'hybrid';
    model?: string;
    confidence: number;
    processingTime: number;
    chunks?: number;
    contextWindowRespected: boolean;
  };
}

export interface SummarizationOptions {
  maxLength?: number;
  style: 'bullet-points' | 'paragraph' | 'key-insights' | 'executive';
  preserveContext?: boolean;
  includeActionItems?: boolean;
  customPrompt?: string;
}

export class ContextCompressor {
  private aiProvider: AIProvider;
  private config: CompressionConfig;
  private promptManager: PromptManager;

  constructor(
    aiProvider: AIProvider,
    config: Partial<CompressionConfig> = {},
    promptManager?: PromptManager
  ) {
    this.aiProvider = aiProvider;
    this.promptManager = promptManager || PromptManager.getInstance();
    
    this.config = {
      maxInputLength: Math.floor(aiProvider.getMaxContextWindow() * 0.8), // Leave room for response
      targetCompressionRatio: 0.4,
      preserveKeyInformation: true,
      useSemanticCompression: true,
      chunkSize: Math.floor(aiProvider.getMaxContextWindow() * 0.3), // Smaller chunks for processing
      enableSummarization: true,
      respectContextWindow: true,
      ...config
    };

    logger.info('ContextCompressor initialized', { 
      config: this.config,
      providerName: aiProvider.name,
      maxContextWindow: aiProvider.getMaxContextWindow()
    });
  }

  public async compressContext(
    content: string, 
    customPrompt?: string
  ): Promise<CompressionResult> {
    const startTime = Date.now();
    
    try {
      logger.debug('Starting context compression', { 
        originalLength: content.length,
        targetRatio: this.config.targetCompressionRatio,
        estimatedTokens: this.aiProvider.estimateTokenCount(content)
      });

      let result: CompressionResult;
      const estimatedTokens = this.aiProvider.estimateTokenCount(content);
      const maxContextWindow = this.aiProvider.getMaxContextWindow();

      // Check if content fits in context window
      if (this.config.respectContextWindow && estimatedTokens > maxContextWindow * 0.8) {
        logger.info('Content exceeds context window, using chunked compression', {
          estimatedTokens,
          maxContextWindow,
          threshold: maxContextWindow * 0.8
        });
        result = await this.chunkedSemanticCompression(content, customPrompt);
      } else if (this.config.useSemanticCompression) {
        result = await this.semanticCompression(content, customPrompt);
      } else {
        result = await this.statisticalCompression(content);
      }

      const processingTime = Date.now() - startTime;
      result.metadata.processingTime = processingTime;
      result.metadata.contextWindowRespected = this.config.respectContextWindow;

      logger.info('Context compression completed', {
        originalLength: result.originalLength,
        compressedLength: result.compressedLength,
        ratio: result.compressionRatio,
        method: result.metadata.method,
        processingTime,
        tokenCount: result.tokenCount
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Context compression failed', { 
        contentLength: content.length,
        error: errorMessage 
      });
      throw new Error(`Compression failed: ${errorMessage}`);
    }
  }

  public async compressConversation(messages: ContextMessage[]): Promise<CompressionResult> {
    try {
      const conversationText = this.formatConversationForCompression(messages);
      return await this.compressContext(conversationText);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Conversation compression failed', { 
        messageCount: messages.length,
        error: errorMessage 
      });
      throw new Error(`Conversation compression failed: ${errorMessage}`);
    }
  }

  public async summarizeContext(
    content: string, 
    options: SummarizationOptions = { style: 'paragraph' }
  ): Promise<string> {
    try {
      if (!this.config.enableSummarization) {
        throw new Error('Summarization is disabled');
      }

      logger.debug('Starting context summarization', { 
        contentLength: content.length,
        style: options.style,
        estimatedTokens: this.aiProvider.estimateTokenCount(content)
      });

      const summary = await this.generateSummary(content, options);

      logger.info('Context summarization completed', { 
        originalLength: content.length,
        summaryLength: summary.length,
        style: options.style 
      });

      return summary;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Context summarization failed', { 
        contentLength: content.length,
        error: errorMessage 
      });
      throw new Error(`Summarization failed: ${errorMessage}`);
    }
  }

  public async compressAndSummarize(
    content: string,
    summarizationOptions?: SummarizationOptions
  ): Promise<{
    compressed: CompressionResult;
    summary: string;
  }> {
    try {
      const [compressed, summary] = await Promise.all([
        this.compressContext(content),
        this.summarizeContext(content, summarizationOptions)
      ]);

      return { compressed, summary };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Compress and summarize failed', { error: errorMessage });
      throw new Error(`Compress and summarize failed: ${errorMessage}`);
    }
  }

  public async batchCompress(
    entries: ContextEntry[],
    compressionThreshold: number = 5000
  ): Promise<Array<{
    entry: ContextEntry;
    result: CompressionResult | null;
  }>> {
    const results: Array<{ entry: ContextEntry; result: CompressionResult | null }> = [];

    for (const entry of entries) {
      try {
        const contentString = typeof entry.content === 'string' 
          ? entry.content 
          : JSON.stringify(entry.content);

        if (contentString.length > compressionThreshold) {
          const result = await this.compressContext(contentString);
          results.push({ entry, result });
        } else {
          results.push({ entry, result: null });
        }
      } catch (error) {
        logger.warn('Failed to compress individual context entry', { 
          entryId: entry.id,
          error: error instanceof Error ? error.message : String(error)
        });
        results.push({ entry, result: null });
      }
    }

    logger.info('Batch compression completed', { 
      totalEntries: entries.length,
      compressed: results.filter(r => r.result !== null).length 
    });

    return results;
  }

  public setPromptOverride(override: PromptOverride): void {
    this.promptManager.setOverride('compressor', override);
    logger.info('Compression prompt override set', { override });
  }

  public removePromptOverride(): void {
    this.promptManager.removeOverride('compressor');
    logger.info('Compression prompt override removed');
  }

  private async semanticCompression(content: string, customPrompt?: string): Promise<CompressionResult> {
    try {
      const targetLength = Math.floor(content.length * this.config.targetCompressionRatio);
      const prompt = this.promptManager.getCompressionPrompt(content, targetLength, customPrompt);
      const systemPrompt = this.promptManager.getSystemPrompt('compressor');
      const parameters = this.promptManager.getParameters('compressor');

      const request: TextGenerationRequest = {
        messages: [{ role: 'user', content: prompt }],
        systemPrompt,
        temperature: parameters.defaultTemperature,
        maxTokens: Math.max(
          parameters.minOutputTokens,
          Math.floor(targetLength * parameters.maxTokensMultiplier)
        )
      };

      const response = await this.aiProvider.generateText(request);
      const compressedContent = response.content.trim();
      const tokenCount = this.aiProvider.estimateTokenCount(compressedContent);

      // Extract key points using heuristics
      const keyPoints = this.extractKeyPoints(content);

      return {
        compressedContent,
        originalLength: content.length,
        compressedLength: compressedContent.length,
        compressionRatio: compressedContent.length / content.length,
        preservedKeyPoints: keyPoints,
        tokenCount,
        metadata: {
          method: 'semantic',
          model: response.model,
          confidence: 0.8,
          processingTime: 0, // Will be set by caller
          chunks: 1,
          contextWindowRespected: true
        }
      };
    } catch (error) {
      logger.warn('Semantic compression failed, falling back to statistical', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return await this.statisticalCompression(content);
    }
  }

  private async chunkedSemanticCompression(content: string, customPrompt?: string): Promise<CompressionResult> {
    try {
      const chunks = this.chunkContent(content);
      const compressedChunks: string[] = [];
      const allKeyPoints: string[] = [];

      logger.info('Processing content in chunks', { 
        totalChunks: chunks.length,
        chunkSize: this.config.chunkSize 
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) continue; // Skip undefined chunks
        
        logger.debug(`Processing chunk ${i + 1}/${chunks.length}`, {
          chunkLength: chunk.length,
          estimatedTokens: this.aiProvider.estimateTokenCount(chunk)
        });

        const chunkResult = await this.semanticCompression(chunk, customPrompt);
        compressedChunks.push(chunkResult.compressedContent);
        allKeyPoints.push(...chunkResult.preservedKeyPoints);
      }

      const compressedContent = compressedChunks.join('\n\n');
      const tokenCount = this.aiProvider.estimateTokenCount(compressedContent);

      return {
        compressedContent,
        originalLength: content.length,
        compressedLength: compressedContent.length,
        compressionRatio: compressedContent.length / content.length,
        preservedKeyPoints: [...new Set(allKeyPoints)], // Remove duplicates
        tokenCount,
        metadata: {
          method: 'semantic',
          model: this.aiProvider.name,
          confidence: 0.75, // Slightly lower confidence for chunked processing
          processingTime: 0, // Will be set by caller
          chunks: chunks.length,
          contextWindowRespected: true
        }
      };
    } catch (error) {
      logger.warn('Chunked semantic compression failed, falling back to statistical', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return await this.statisticalCompression(content);
    }
  }

  private async statisticalCompression(content: string): Promise<CompressionResult> {
    try {
      // Extract sentences and rank by importance
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
      const rankedSentences = this.rankSentencesByImportance(sentences, content);
      
      // Select top sentences to meet compression ratio
      const targetLength = Math.floor(content.length * this.config.targetCompressionRatio);
      const selectedSentences = this.selectSentencesForTarget(rankedSentences, targetLength);
      
      const compressedContent = selectedSentences.join('. ') + '.';
      const keyPoints = selectedSentences.slice(0, 5); // Top 5 as key points
      const tokenCount = this.aiProvider.estimateTokenCount(compressedContent);

      return {
        compressedContent,
        originalLength: content.length,
        compressedLength: compressedContent.length,
        compressionRatio: compressedContent.length / content.length,
        preservedKeyPoints: keyPoints,
        tokenCount,
        metadata: {
          method: 'statistical',
          confidence: 0.6,
          processingTime: 0,
          chunks: 1,
          contextWindowRespected: true
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Statistical compression failed', { error: errorMessage });
      throw error;
    }
  }

  private async generateSummary(content: string, options: SummarizationOptions): Promise<string> {
    const maxLength = options.maxLength || Math.floor(content.length * 0.3);
    const { prompt, systemMessage } = this.promptManager.getSummarizationPrompt(
      content,
      options.style,
      maxLength,
      options.includeActionItems,
      options.customPrompt
    );

    const parameters = this.promptManager.getParameters('compressor');
    const request: TextGenerationRequest = {
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: systemMessage,
      temperature: parameters.defaultTemperature,
      maxTokens: Math.max(parameters.minOutputTokens, Math.floor(maxLength * parameters.maxTokensMultiplier))
    };

    const response = await this.aiProvider.generateText(request);
    return response.content.trim();
  }

  private formatConversationForCompression(messages: ContextMessage[]): string {
    return messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
  }

  private chunkContent(content: string): string[] {
    const chunks: string[] = [];
    const maxChunkTokens = Math.floor(this.aiProvider.getMaxContextWindow() * 0.3);
    
    // Split by paragraphs first to maintain semantic boundaries
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      const potentialChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
      const estimatedTokens = this.aiProvider.estimateTokenCount(potentialChunk);
      
      if (estimatedTokens <= maxChunkTokens) {
        currentChunk = potentialChunk;
      } else {
        // Current chunk is full, save it and start a new one
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // If the paragraph itself is too long, split it further
        if (this.aiProvider.estimateTokenCount(paragraph) > maxChunkTokens) {
          const subChunks = this.splitLargeParagraph(paragraph, maxChunkTokens);
          chunks.push(...subChunks);
          currentChunk = '';
        } else {
          currentChunk = paragraph;
        }
      }
    }
    
    // Add the last chunk if it exists
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks.filter(chunk => chunk.trim().length > 0);
  }

  private splitLargeParagraph(paragraph: string, maxTokens: number): string[] {
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const potentialChunk = currentChunk ? `${currentChunk}. ${sentence}` : sentence;
      const estimatedTokens = this.aiProvider.estimateTokenCount(potentialChunk);
      
      if (estimatedTokens <= maxTokens) {
        currentChunk = potentialChunk;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk + '.');
        }
        currentChunk = sentence;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk + '.');
    }
    
    return chunks;
  }

  private extractKeyPoints(content: string): string[] {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const importantSentences = sentences
      .filter(s => this.isImportantSentence(s))
      .slice(0, 5);
    
    return importantSentences;
  }

  private rankSentencesByImportance(sentences: string[], fullText: string): string[] {
    const wordFreq = this.calculateWordFrequency(fullText);
    const sentenceScores: Array<{ sentence: string; score: number }> = [];

    for (const sentence of sentences) {
      const words = sentence.toLowerCase().match(/\b\w+\b/g) || [];
      let score = 0;

      // Score based on word frequency
      for (const word of words) {
        score += wordFreq[word] || 0;
      }

      // Boost for sentence position (first and last sentences are often important)
      const position = sentences.indexOf(sentence);
      if (position === 0 || position === sentences.length - 1) {
        score *= 1.5;
      }

      // Boost for sentence length (too short or too long sentences are less important)
      const length = sentence.length;
      if (length > 50 && length < 200) {
        score *= 1.2;
      }

      // Boost for certain keywords
      if (this.containsImportantKeywords(sentence)) {
        score *= 1.3;
      }

      sentenceScores.push({ sentence: sentence.trim(), score });
    }

    return sentenceScores
      .sort((a, b) => b.score - a.score)
      .map(item => item.sentence);
  }

  private calculateWordFrequency(text: string): Record<string, number> {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const freq: Record<string, number> = {};
    
    for (const word of words) {
      if (word.length > 3) { // Skip very short words
        freq[word] = (freq[word] || 0) + 1;
      }
    }

    return freq;
  }

  private selectSentencesForTarget(rankedSentences: string[], targetLength: number): string[] {
    const selected: string[] = [];
    let currentLength = 0;

    for (const sentence of rankedSentences) {
      if (currentLength + sentence.length <= targetLength) {
        selected.push(sentence);
        currentLength += sentence.length + 2; // +2 for '. '
      } else {
        break;
      }
    }

    return selected;
  }

  private isImportantSentence(sentence: string): boolean {
    const importantPatterns = [
      /\b(important|significant|key|crucial|essential|critical)\b/i,
      /\b(result|conclusion|finding|discovery)\b/i,
      /\b(should|must|need|require)\b/i,
      /\b(problem|issue|challenge|solution)\b/i,
      /\b(recommend|suggest|propose)\b/i
    ];

    return importantPatterns.some(pattern => pattern.test(sentence));
  }

  private containsImportantKeywords(sentence: string): boolean {
    const keywords = [
      'important', 'significant', 'key', 'main', 'primary', 'crucial',
      'result', 'conclusion', 'finding', 'outcome', 'impact',
      'problem', 'solution', 'issue', 'challenge',
      'recommend', 'suggest', 'should', 'must', 'need',
      'decision', 'action', 'next steps', 'follow up'
    ];

    const sentenceLower = sentence.toLowerCase();
    return keywords.some(keyword => sentenceLower.includes(keyword));
  }

  public getConfig(): CompressionConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update maxInputLength if respectContextWindow is enabled
    if (newConfig.respectContextWindow !== undefined && newConfig.respectContextWindow) {
      this.config.maxInputLength = Math.floor(this.aiProvider.getMaxContextWindow() * 0.8);
    }
    
    logger.info('ContextCompressor configuration updated', { newConfig });
  }

  public getProviderInfo(): { name: string; maxContextWindow: number; capabilities: any } {
    return {
      name: this.aiProvider.name,
      maxContextWindow: this.aiProvider.getMaxContextWindow(),
      capabilities: this.aiProvider.capabilities
    };
  }
}

export default ContextCompressor;