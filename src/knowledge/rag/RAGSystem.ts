import {
  RAGConfig,
  RAGContext,
  RAGResponse,
  ContextMessage,
  SearchResult,
  KnowledgeQuery
} from '../../types/Knowledge';
import { SemanticSearchEngine } from '../search/SemanticSearch';
import { AnthropicClient } from '../../integrations/ai/AnthropicClient';
import { GeminiClient } from '../../integrations/ai/GeminiClient';
import { ClaudeCLIClient } from '../../integrations/ai/ClaudeCLIClient';
import { GeminiCLIClient } from '../../integrations/ai/GeminiCLIClient';
import logger from '../../utils/logger';

export interface RAGProvider {
  name: 'claude' | 'gemini' | 'claude-cli' | 'gemini-cli' | 'qwen3';
  client: AnthropicClient | GeminiClient | ClaudeCLIClient | GeminiCLIClient | any;
  priority: number;
  maxContextLength: number;
}

export interface RAGMetrics {
  totalQueries: number;
  averageResponseTime: number;
  averageConfidence: number;
  documentsRetrieved: number;
  contextUtilization: number;
  successfulResponses: number;
  failedResponses: number;
}

export class RAGSystem {
  private searchEngine: SemanticSearchEngine;
  private providers: RAGProvider[];
  private config: RAGConfig;
  private metrics: RAGMetrics = {
    totalQueries: 0,
    averageResponseTime: 0,
    averageConfidence: 0,
    documentsRetrieved: 0,
    contextUtilization: 0,
    successfulResponses: 0,
    failedResponses: 0
  };

  constructor(
    searchEngine: SemanticSearchEngine,
    providers: RAGProvider[],
    config: Partial<RAGConfig> = {}
  ) {
    this.searchEngine = searchEngine;
    this.providers = providers.sort((a, b) => b.priority - a.priority);
    
    this.config = {
      chunkSize: 1000,
      chunkOverlap: 200,
      maxContextLength: 8000,
      retrievalStrategy: 'similarity',
      vectorStore: {
        provider: 'chroma',
        collectionName: 'claudate_documents',
        dimensions: 1536,
        distanceMetric: 'cosine'
      },
      embeddingConfig: {
        provider: 'openai',
        model: 'text-embedding-ada-002',
        dimensions: 1536,
        batchSize: 100
      },
      ...config
    };

    logger.info('RAGSystem initialized', {
      providers: this.providers.map(p => p.name),
      config: {
        maxContextLength: this.config.maxContextLength,
        retrievalStrategy: this.config.retrievalStrategy
      }
    });
  }

  public async generateResponse(context: RAGContext): Promise<RAGResponse> {
    const startTime = Date.now();
    
    try {
      logger.debug('Starting RAG response generation', {
        query: context.query.substring(0, 100),
        hasHistory: !!context.conversationHistory?.length
      });

      // Step 1: Retrieve relevant documents
      const retrievedDocuments = await this.retrieveRelevantDocuments(context);
      
      // Step 2: Prepare context for AI generation
      const preparedContext = await this.prepareContext(context, retrievedDocuments);
      
      // Step 3: Generate response using AI provider
      const response = await this.generateAIResponse(preparedContext);
      
      // Step 4: Post-process and validate response
      const finalResponse = await this.postProcessResponse(response, retrievedDocuments, context);
      
      const processingTime = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(processingTime, retrievedDocuments, finalResponse);

      logger.info('RAG response generated successfully', {
        query: context.query.substring(0, 100),
        documentsUsed: retrievedDocuments.length,
        confidence: finalResponse.confidence,
        processingTime
      });

      return finalResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('RAG response generation failed', {
        query: context.query.substring(0, 100),
        error: errorMessage
      });
      
      this.metrics.failedResponses++;
      
      throw new Error(`RAG generation failed: ${errorMessage}`);
    }
  }

  public async generateConversationalResponse(
    query: string,
    conversationHistory: ContextMessage[] = [],
    userPreferences?: Record<string, any>
  ): Promise<RAGResponse> {
    const context: RAGContext = {
      query,
      retrievedDocuments: [],
      conversationHistory,
      userPreferences,
      sessionMetadata: {
        timestamp: new Date().toISOString()
      }
    };

    return this.generateResponse(context);
  }

  public async askQuestion(
    question: string,
    conversationHistory?: ContextMessage[],
    options: { includeSource?: boolean; maxSources?: number; maxDocuments?: number } = {}
  ): Promise<RAGResponse> {
    const { includeSource = true, maxSources = 5, maxDocuments = 5 } = options;
    const context: RAGContext = {
      query: question,
      retrievedDocuments: [],
      conversationHistory: conversationHistory || [],
      sessionMetadata: {
        maxDocuments,
        includeSource,
        maxSources
      }
    };

    return this.generateResponse(context);
  }

  private async retrieveRelevantDocuments(context: RAGContext): Promise<SearchResult[]> {
    try {
      // Build search query
      const query: KnowledgeQuery = {
        query: context.query,
        limit: this.getDocumentLimit(context),
        threshold: 0.7,
        includeEmbeddings: false,
        contextWindow: 3
      };

      // Add filters from session metadata
      if (context.sessionMetadata?.filters) {
        query.filters = context.sessionMetadata.filters;
      }

      // Enhance query with conversation history
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        query.query = this.enhanceQueryWithHistory(query.query, context.conversationHistory);
      }

      const searchResponse = await this.searchEngine.search(query);
      
      logger.debug('Documents retrieved for RAG', {
        documentsFound: searchResponse.results.length,
        searchTime: searchResponse.processingTime,
        query: query.query.substring(0, 100)
      });

      return searchResponse.results;
    } catch (error) {
      logger.error('Document retrieval failed', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  private getDocumentLimit(context: RAGContext): number {
    const defaultLimit = 5;
    const maxLimit = 10;
    
    if (context.sessionMetadata?.maxDocuments) {
      return Math.min(context.sessionMetadata.maxDocuments, maxLimit);
    }
    
    return defaultLimit;
  }

  private enhanceQueryWithHistory(query: string, history: ContextMessage[]): string {
    // Get last few messages for context
    const recentMessages = history.slice(-3);
    const contextTerms: string[] = [];

    for (const message of recentMessages) {
      if (message.role === 'user') {
        // Extract key terms from user messages
        const terms = this.extractKeyTerms(message.content);
        contextTerms.push(...terms);
      }
    }

    // Remove duplicates and combine with original query
    const uniqueTerms = Array.from(new Set(contextTerms));
    if (uniqueTerms.length > 0) {
      return `${query} ${uniqueTerms.join(' ')}`;
    }

    return query;
  }

  private extractKeyTerms(text: string): string[] {
    // Simple keyword extraction - in production, use more sophisticated NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Remove common stop words
    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'many', 'over', 'such', 'take', 'than', 'them', 'well', 'were']);
    
    return words.filter(word => !stopWords.has(word)).slice(0, 5);
  }

  private async prepareContext(context: RAGContext, documents: SearchResult[]): Promise<string> {
    let contextText = '';
    let totalLength = 0;

    // Add conversation history first
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      const historyText = this.formatConversationHistory(context.conversationHistory);
      if (historyText.length + totalLength < this.config.maxContextLength) {
        contextText += historyText + '\n\n';
        totalLength += historyText.length;
      }
    }

    // Add retrieved documents
    contextText += 'Relevant information from knowledge base:\n\n';
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      if (!doc) continue; // Skip undefined documents
      
      const docText = this.formatDocumentForContext(doc, i + 1);
      
      if (totalLength + docText.length > this.config.maxContextLength) {
        break;
      }
      
      contextText += docText + '\n\n';
      totalLength += docText.length;
    }

    // Add the user's question
    contextText += `Question: ${context.query}\n\n`;
    contextText += 'Please provide a comprehensive answer based on the above information.';

    return contextText;
  }

  private formatConversationHistory(history: ContextMessage[]): string {
    const recentHistory = history.slice(-5); // Last 5 messages
    
    return recentHistory
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');
  }

  private formatDocumentForContext(result: SearchResult, index: number): string {
    const doc = result.document;
    const relevanceIndicator = result.score > 0.9 ? '[HIGH RELEVANCE]' : result.score > 0.7 ? '[MEDIUM RELEVANCE]' : '[LOW RELEVANCE]';
    
    let content = doc.content;
    
    // Truncate if too long
    if (content.length > 1500) {
      content = content.substring(0, 1500) + '...';
    }

    return `Document ${index} ${relevanceIndicator}:
Title: ${doc.title}
Source: ${doc.source}
Type: ${doc.type}
Content: ${content}`;
  }

  private async generateAIResponse(contextText: string): Promise<{ answer: string; confidence: number }> {
    for (const provider of this.providers) {
      try {
        logger.debug('Attempting AI generation', { provider: provider.name });
        
        if (provider.name === 'claude' && provider.client instanceof AnthropicClient) {
          const response = await provider.client.sendMessage({
            messages: [{ role: 'user', content: contextText }],
            system: 'You are a helpful AI assistant that provides accurate, comprehensive answers based on the provided context. Always cite your sources and indicate confidence levels.',
            temperature: 0.3,
            max_tokens: 2000
          });
          
          return {
            answer: response.content,
            confidence: this.calculateConfidence(response.content, contextText)
          };
        } else if (provider.name === 'claude-cli' && provider.client instanceof ClaudeCLIClient) {
          const response = await provider.client.sendMessage({
            messages: [{ role: 'user', content: contextText }],
            system: 'You are a helpful AI assistant that provides accurate, comprehensive answers based on the provided context. Always cite your sources and indicate confidence levels.',
            temperature: 0.3,
            max_tokens: 2000
          });
          
          return {
            answer: response.content,
            confidence: this.calculateConfidence(response.content, contextText)
          };
        } else if (provider.name === 'gemini-cli' && provider.client instanceof GeminiCLIClient) {
          const response = await provider.client.sendMessage({
            messages: [{ role: 'user', parts: [{ text: contextText }] }],
            systemInstruction: 'You are a helpful AI assistant that provides accurate, comprehensive answers based on the provided context. Always cite your sources and indicate confidence levels.',
            temperature: 0.3,
            maxOutputTokens: 2000
          });
          
          return {
            answer: response.content,
            confidence: this.calculateConfidence(response.content, contextText)
          };
        } else if (provider.name === 'gemini' && provider.client instanceof GeminiClient) {
          const response = await provider.client.sendMessage({
            messages: [{ role: 'user', parts: [{ text: contextText }] }],
            systemInstruction: 'You are a helpful AI assistant that provides accurate, comprehensive answers based on the provided context. Always cite your sources and indicate confidence levels.',
            temperature: 0.3,
            maxOutputTokens: 2000
          });
          
          return {
            answer: response.content,
            confidence: this.calculateConfidence(response.content, contextText)
          };
        } else if (provider.name === 'qwen3') {
          // Handle Qwen3 provider via sendMessage method
          const response = await provider.client.sendMessage({
            messages: [{ role: 'user', content: contextText }],
            system: 'You are a helpful AI assistant that provides accurate, comprehensive answers based on the provided context. Always cite your sources and indicate confidence levels.',
            temperature: 0.3,
            max_tokens: 2000
          });
          
          return {
            answer: response.content,
            confidence: this.calculateConfidence(response.content, contextText)
          };
        }
      } catch (error) {
        logger.warn('AI provider failed, trying next', { 
          provider: provider.name, 
          error: error instanceof Error ? error.message : String(error)
        });
        continue;
      }
    }

    throw new Error('All AI providers failed to generate response');
  }

  private calculateConfidence(answer: string, context: string): number {
    // Simple confidence calculation based on answer characteristics
    let confidence = 0.5;

    // Higher confidence if answer references the provided context
    if (answer.toLowerCase().includes('based on') || answer.toLowerCase().includes('according to')) {
      confidence += 0.2;
    }

    // Higher confidence if answer is substantial
    if (answer.length > 200) {
      confidence += 0.1;
    }

    // Lower confidence if answer indicates uncertainty
    if (answer.toLowerCase().includes('not sure') || answer.toLowerCase().includes('unclear')) {
      confidence -= 0.2;
    }

    // Higher confidence if answer cites specific sources
    if (answer.toLowerCase().includes('document') || answer.toLowerCase().includes('source')) {
      confidence += 0.15;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private async postProcessResponse(
    aiResponse: { answer: string; confidence: number },
    documents: SearchResult[],
    context: RAGContext
  ): Promise<RAGResponse> {
    const response: RAGResponse = {
      answer: aiResponse.answer,
      sources: documents,
      confidence: aiResponse.confidence,
      success: true,
      conversationId: context.sessionMetadata?.conversationId || `rag-${Date.now()}`,
      retrievalMetrics: {
        documentsRetrieved: documents.length,
        averageRelevanceScore: documents.length > 0 
          ? documents.reduce((sum, doc) => sum + doc.relevanceScore, 0) / documents.length 
          : 0,
        processingTime: 0 // Will be set by caller
      },
      metadata: {
        model: this.providers[0]?.name || 'unknown',
        retrievalStrategy: this.config.retrievalStrategy,
        contextLength: context.query.length + (documents.reduce((sum, doc) => sum + doc.document.content.length, 0)),
        timestamp: new Date().toISOString()
      }
    };

    // Add source citations if not already present
    if (!this.hasCitations(aiResponse.answer) && documents.length > 0) {
      response.answer = this.addSourceCitations(aiResponse.answer, documents);
    }

    return response;
  }

  private hasCitations(answer: string): boolean {
    return /\[Source:|Document \d+|Based on/.test(answer);
  }

  private addSourceCitations(answer: string, documents: SearchResult[]): string {
    let citedAnswer = answer;
    
    // Add sources at the end if no citations found in the text
    if (documents.length > 0) {
      citedAnswer += '\n\nSources:\n';
      documents.forEach((doc, index) => {
        citedAnswer += `${index + 1}. ${doc.document.title} (${doc.document.source})\n`;
      });
    }

    return citedAnswer;
  }

  private updateMetrics(
    processingTime: number,
    documents: SearchResult[],
    response: RAGResponse
  ): void {
    this.metrics.totalQueries++;
    this.metrics.successfulResponses++;
    this.metrics.documentsRetrieved += documents.length;
    
    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalQueries - 1) + processingTime) / 
      this.metrics.totalQueries;
    
    // Update average confidence
    this.metrics.averageConfidence = 
      (this.metrics.averageConfidence * (this.metrics.successfulResponses - 1) + response.confidence) / 
      this.metrics.successfulResponses;
    
    // Update context utilization
    const maxPossibleContext = this.config.maxContextLength;
    const actualContext = response.metadata?.contextLength || 0;
    this.metrics.contextUtilization = actualContext / maxPossibleContext;
  }

  public getMetrics(): RAGMetrics {
    return { ...this.metrics };
  }

  public async clearMetrics(): Promise<void> {
    this.metrics = {
      totalQueries: 0,
      averageResponseTime: 0,
      averageConfidence: 0,
      documentsRetrieved: 0,
      contextUtilization: 0,
      successfulResponses: 0,
      failedResponses: 0
    };
    
    logger.info('RAG metrics cleared');
  }

  public getConfig(): RAGConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<RAGConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('RAG configuration updated', { newConfig });
  }

  public setSearchEngine(searchEngine: SemanticSearchEngine): void {
    this.searchEngine = searchEngine;
    logger.info('RAG search engine updated');
  }

  public getSearchEngine(): SemanticSearchEngine {
    return this.searchEngine;
  }
}

export default RAGSystem;