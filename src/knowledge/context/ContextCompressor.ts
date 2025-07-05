import {
  ContextMessage,
  ContextEntry
} from '../../types/Knowledge.js';
import { AnthropicClient } from '../../integrations/ai/AnthropicClient.js';
import { GeminiClient } from '../../integrations/ai/GeminiClient.js';
import logger from '../../utils/logger.js';

export interface CompressionConfig {
  maxInputLength: number;
  targetCompressionRatio: number; // 0.3 = compress to 30% of original
  preserveKeyInformation: boolean;
  useSemanticCompression: boolean;
  chunkSize: number;
  enableSummarization: boolean;
}

export interface CompressionResult {
  compressedContent: string;
  originalLength: number;
  compressedLength: number;
  compressionRatio: number;
  preservedKeyPoints: string[];
  metadata: {
    method: 'semantic' | 'statistical' | 'hybrid';
    model?: string;
    confidence: number;
    processingTime: number;
  };
}

export interface SummarizationOptions {
  maxLength?: number;
  style: 'bullet-points' | 'paragraph' | 'key-insights' | 'executive';
  preserveContext?: boolean;
  includeActionItems?: boolean;
}

export class ContextCompressor {
  private anthropicClient?: AnthropicClient;
  private geminiClient?: GeminiClient;
  private config: CompressionConfig;

  constructor(
    config: Partial<CompressionConfig> = {},
    anthropicClient?: AnthropicClient,
    geminiClient?: GeminiClient
  ) {
    this.config = {
      maxInputLength: 10000,
      targetCompressionRatio: 0.4,
      preserveKeyInformation: true,
      useSemanticCompression: true,
      chunkSize: 2000,
      enableSummarization: true,
      ...config
    };

    this.anthropicClient = anthropicClient;
    this.geminiClient = geminiClient;

    logger.info('ContextCompressor initialized', { config: this.config });
  }

  public async compressContext(content: string): Promise<CompressionResult> {
    const startTime = Date.now();
    
    try {
      logger.debug('Starting context compression', { 
        originalLength: content.length,
        targetRatio: this.config.targetCompressionRatio 
      });

      let result: CompressionResult;

      if (this.config.useSemanticCompression && (this.anthropicClient || this.geminiClient)) {
        result = await this.semanticCompression(content);
      } else {
        result = await this.statisticalCompression(content);
      }

      const processingTime = Date.now() - startTime;
      result.metadata.processingTime = processingTime;

      logger.info('Context compression completed', {
        originalLength: result.originalLength,
        compressedLength: result.compressedLength,
        ratio: result.compressionRatio,
        method: result.metadata.method,
        processingTime
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
        style: options.style 
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

  private async semanticCompression(content: string): Promise<CompressionResult> {
    try {
      const chunks = this.chunkContent(content);
      const compressedChunks: string[] = [];
      const keyPoints: string[] = [];

      for (const chunk of chunks) {
        const compressed = await this.compressChunkSemantically(chunk);
        compressedChunks.push(compressed.content);
        keyPoints.push(...compressed.keyPoints);
      }

      const compressedContent = compressedChunks.join('\n\n');
      
      return {
        compressedContent,
        originalLength: content.length,
        compressedLength: compressedContent.length,
        compressionRatio: compressedContent.length / content.length,
        preservedKeyPoints: [...new Set(keyPoints)], // Remove duplicates
        metadata: {
          method: 'semantic',
          model: this.anthropicClient ? 'claude' : 'gemini',
          confidence: 0.8,
          processingTime: 0 // Will be set by caller
        }
      };
    } catch (error) {
      logger.warn('Semantic compression failed, falling back to statistical', { 
        error: error instanceof Error ? error.message : String(error)
      });
      return await this.statisticalCompression(content);
    }
  }

  private async compressChunkSemantically(chunk: string): Promise<{
    content: string;
    keyPoints: string[];
  }> {
    const targetLength = Math.floor(chunk.length * this.config.targetCompressionRatio);
    
    const prompt = `Please compress the following text to approximately ${targetLength} characters while preserving all key information and meaning. Focus on:

1. Maintaining the essential facts and relationships
2. Preserving important details and context
3. Using concise but clear language
4. Keeping the logical flow intact

Original text:
${chunk}

Compressed version (target ~${targetLength} characters):`;

    let compressedText: string;
    const keyPoints: string[] = [];

    if (this.anthropicClient) {
      const response = await this.anthropicClient.sendMessage({
        messages: [{ role: 'user', content: prompt }],
        system: 'You are an expert at text compression and summarization. Preserve meaning while reducing length.',
        temperature: 0.3,
        max_tokens: Math.max(500, Math.floor(targetLength / 3))
      });
      compressedText = response.content;
    } else if (this.geminiClient) {
      const response = await this.geminiClient.sendMessage({
        messages: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: 'You are an expert at text compression and summarization. Preserve meaning while reducing length.',
        temperature: 0.3,
        maxOutputTokens: Math.max(500, Math.floor(targetLength / 3))
      });
      compressedText = response.content;
    } else {
      throw new Error('No AI client available for semantic compression');
    }

    // Extract key points (simple heuristic)
    const sentences = chunk.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const importantSentences = sentences
      .filter(s => this.isImportantSentence(s))
      .slice(0, 3);
    
    keyPoints.push(...importantSentences);

    return {
      content: compressedText.trim(),
      keyPoints
    };
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

      return {
        compressedContent,
        originalLength: content.length,
        compressedLength: compressedContent.length,
        compressionRatio: compressedContent.length / content.length,
        preservedKeyPoints: keyPoints,
        metadata: {
          method: 'statistical',
          confidence: 0.6,
          processingTime: 0
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
    
    let prompt: string;
    let systemMessage: string;

    switch (options.style) {
      case 'bullet-points':
        prompt = `Create a concise bullet-point summary (max ${maxLength} characters) of the following content:

${content}

Summary (bullet points):`;
        systemMessage = 'Create clear, informative bullet points that capture the essential information.';
        break;

      case 'key-insights':
        prompt = `Extract the key insights and main takeaways (max ${maxLength} characters) from:

${content}

Key insights:`;
        systemMessage = 'Focus on the most important insights, conclusions, and actionable information.';
        break;

      case 'executive':
        prompt = `Create an executive summary (max ${maxLength} characters) for:

${content}

Executive summary:`;
        systemMessage = 'Write for executives: focus on business impact, decisions, and high-level outcomes.';
        break;

      default: // paragraph
        prompt = `Summarize the following content in a clear paragraph (max ${maxLength} characters):

${content}

Summary:`;
        systemMessage = 'Create a coherent, flowing summary that preserves the main points and context.';
    }

    if (options.includeActionItems) {
      prompt += '\n\nInclude any action items or next steps mentioned.';
    }

    let summary: string;

    if (this.anthropicClient) {
      const response = await this.anthropicClient.sendMessage({
        messages: [{ role: 'user', content: prompt }],
        system: systemMessage,
        temperature: 0.3,
        max_tokens: Math.max(200, Math.floor(maxLength / 3))
      });
      summary = response.content;
    } else if (this.geminiClient) {
      const response = await this.geminiClient.sendMessage({
        messages: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: systemMessage,
        temperature: 0.3,
        maxOutputTokens: Math.max(200, Math.floor(maxLength / 3))
      });
      summary = response.content;
    } else {
      // Fallback to simple statistical summarization
      return this.simpleTextSummary(content, maxLength);
    }

    return summary.trim();
  }

  private formatConversationForCompression(messages: ContextMessage[]): string {
    return messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');
  }

  private chunkContent(content: string): string[] {
    const chunks: string[] = [];
    const words = content.split(/\s+/);
    const wordsPerChunk = Math.floor(this.config.chunkSize / 6); // Rough estimate

    for (let i = 0; i < words.length; i += wordsPerChunk) {
      const chunk = words.slice(i, i + wordsPerChunk).join(' ');
      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }
    }

    return chunks;
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

  private simpleTextSummary(content: string, maxLength: number): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const rankedSentences = this.rankSentencesByImportance(sentences, content);
    const selectedSentences = this.selectSentencesForTarget(rankedSentences, maxLength);
    
    return selectedSentences.join('. ') + '.';
  }

  public getConfig(): CompressionConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('ContextCompressor configuration updated', { newConfig });
  }
}

export default ContextCompressor;