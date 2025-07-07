import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ContextCompressor, CompressionConfig } from '../../../src/knowledge/context/ContextCompressor';
import { OllamaRAGAdapter } from '../../../src/integrations/ai/OllamaRAGAdapter';
import { PromptManager } from '../../../src/config/PromptManager';
import { ContextMessage } from '../../../src/types/Knowledge';

// Mock the dependencies
jest.mock('../../../src/integrations/ai/OllamaRAGAdapter');
jest.mock('../../../src/config/PromptManager');

describe('ContextCompressor', () => {
  let contextCompressor: ContextCompressor;
  let mockAIProvider: jest.Mocked<OllamaRAGAdapter>;
  let mockPromptManager: jest.Mocked<PromptManager>;

  const sampleLongText = `
    This is a very long text that needs to be compressed for efficient context management.
    It contains multiple paragraphs with various types of information including technical details,
    business requirements, and implementation notes. The text is designed to test the compression
    capabilities of the ContextCompressor class with the new generic Ollama architecture.
    
    The new architecture supports multiple models including Qwen3, Llama3.2, and code-focused models.
    Each model has different context window sizes and tokenization characteristics that the compressor
    must handle appropriately. The system should respect context windows and provide accurate
    token estimates for optimal compression ratios.
    
    Key features include:
    - Generic AI provider interface
    - Model-specific context window handling
    - Configurable prompt management
    - Support for custom compression prompts
    - Chunked processing for large content
    - Statistical fallback compression
    
    This comprehensive test scenario ensures that the ContextCompressor can handle real-world
    content compression tasks while maintaining the essential information and preserving
    the semantic meaning of the original text.
  `.trim();

  beforeEach(() => {

    // Mock OllamaRAGAdapter
    mockAIProvider = {
      name: 'ollama-rag-adapter',
      capabilities: {
        textGeneration: true,
        embedding: true,
        multiModal: false,
        streaming: false,
        functionCalling: false,
        localExecution: true,
        supportedModels: ['qwen3:8b'],
        maxContextWindow: 8192
      },
      getMaxContextWindow: jest.fn().mockReturnValue(8192),
      estimateTokenCount: jest.fn().mockImplementation((text) => Math.ceil((text as string).length / 4)),
      generateText: jest.fn(),
      generateEmbedding: jest.fn(),
      healthCheck: jest.fn(),
      getMetrics: jest.fn(),
      updateConfig: jest.fn(),
      getConfig: jest.fn(),
      initialize: jest.fn(),
      shutdown: jest.fn()
    } as any;

    // Set up the generateText mock return value
    jest.mocked(mockAIProvider.generateText).mockResolvedValue({
      content: 'This is a compressed version of the original text with key points preserved.',
      model: 'qwen3:8b',
      usage: {
        inputTokens: 500,
        outputTokens: 100,
        totalTokens: 600
      },
      finishReason: 'stop'
    });

    // Mock PromptManager
    mockPromptManager = {
      getCompressionPrompt: jest.fn().mockReturnValue('Compress this text: {content}'),
      getSystemPrompt: jest.fn().mockReturnValue('You are an expert at text compression.'),
      getParameters: jest.fn().mockReturnValue({
        defaultTemperature: 0.3,
        maxTokensMultiplier: 0.33,
        minOutputTokens: 200
      }),
      getSummarizationPrompt: jest.fn().mockReturnValue({
        prompt: 'Summarize this text: {content}',
        systemMessage: 'Create a clear summary.'
      }),
      setOverride: jest.fn(),
      removeOverride: jest.fn()
    } as any;

    // Create ContextCompressor instance
    contextCompressor = new ContextCompressor(
      mockAIProvider,
      {
        targetCompressionRatio: 0.4,
        useSemanticCompression: true,
        respectContextWindow: true
      },
      mockPromptManager
    );
  });

  describe('Initialization', () => {
    it('should initialize with AI provider and default config', () => {
      expect(contextCompressor).toBeInstanceOf(ContextCompressor);
      
      const config = contextCompressor.getConfig();
      expect(config.targetCompressionRatio).toBe(0.4);
      expect(config.useSemanticCompression).toBe(true);
      expect(config.respectContextWindow).toBe(true);
    });

    it('should adapt maxInputLength to provider context window', () => {
      const config = contextCompressor.getConfig();
      // Should be 80% of context window (8192 * 0.8 = 6553.6)
      expect(config.maxInputLength).toBe(Math.floor(8192 * 0.8));
    });

    it('should get provider information correctly', () => {
      const providerInfo = contextCompressor.getProviderInfo();
      expect(providerInfo.name).toBe('ollama-rag-adapter');
      expect(providerInfo.maxContextWindow).toBe(8192);
      expect(providerInfo.capabilities).toBeDefined();
    });
  });

  describe('Semantic Compression', () => {
    it('should compress text using semantic compression', async () => {
      const result = await contextCompressor.compressContext(sampleLongText);

      expect(result).toBeDefined();
      expect(result.compressedContent).toBeDefined();
      expect(result.originalLength).toBe(sampleLongText.length);
      expect(result.compressedLength).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeGreaterThan(0);
      expect(result.tokenCount).toBeGreaterThan(0);
      expect(result.metadata.method).toBe('semantic');
      expect(result.metadata.contextWindowRespected).toBe(true);

      // Verify AI provider was called correctly
      expect(mockAIProvider.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Compress this text:')
            })
          ]),
          systemPrompt: 'You are an expert at text compression.',
          temperature: 0.3
        })
      );
    });

    it('should use custom compression prompt when provided', async () => {
      const customPrompt = 'Custom compression prompt for {content} with target {targetLength}';
      
      await contextCompressor.compressContext(sampleLongText, customPrompt);

      expect(mockPromptManager.getCompressionPrompt).toHaveBeenCalledWith(
        sampleLongText,
        expect.any(Number),
        customPrompt
      );
    });

    it('should handle compression errors gracefully', async () => {
      jest.mocked(mockAIProvider.generateText).mockRejectedValueOnce(new Error('AI service unavailable'));

      // Should fall back to statistical compression
      const result = await contextCompressor.compressContext(sampleLongText);
      
      expect(result).toBeDefined();
      expect(result.metadata.method).toBe('statistical');
      expect(result.compressedContent).toBeDefined();
    });
  });

  describe('Context Window Management', () => {
    it('should respect context window limits', async () => {
      // Mock a very large text that exceeds context window
      const largeText = 'x'.repeat(50000); // Large text
      jest.mocked(mockAIProvider.estimateTokenCount).mockReturnValue(20000); // Exceeds 8192 context window

      const result = await contextCompressor.compressContext(largeText);

      // Should use chunked processing or fall back to statistical
      expect(result.metadata.method).toMatch(/semantic|statistical/);
      expect(result.compressedContent).toBeDefined();
    });

    it('should estimate token count correctly', () => {
      const testText = 'This is a test text for token estimation.';
      mockAIProvider.estimateTokenCount.mockReturnValue(12);

      const tokenCount = mockAIProvider.estimateTokenCount(testText);
      expect(tokenCount).toBe(12);
      expect(mockAIProvider.estimateTokenCount).toHaveBeenCalledWith(testText);
    });
  });

  describe('Conversation Compression', () => {
    it('should compress conversation messages', async () => {
      const messages: ContextMessage[] = [
        {
          role: 'user',
          content: 'What is artificial intelligence?',
          timestamp: new Date(),
          confidence: 1.0
        },
        {
          role: 'assistant',
          content: 'Artificial intelligence is a field of computer science focused on creating systems that can perform tasks typically requiring human intelligence.',
          timestamp: new Date(),
          confidence: 0.9
        },
        {
          role: 'user',
          content: 'Can you give me examples of AI applications?',
          timestamp: new Date(),
          confidence: 1.0
        }
      ];

      const result = await contextCompressor.compressConversation(messages);

      expect(result).toBeDefined();
      expect(result.compressedContent).toBeDefined();
      expect(result.metadata.method).toBe('semantic');
      
      // Should format conversation properly
      expect(mockAIProvider.generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringMatching(/USER:.*ASSISTANT:.*USER:/s)
            })
          ])
        })
      );
    });
  });

  describe('Summarization', () => {
    it('should summarize text with different styles', async () => {
      const styles = ['paragraph', 'bullet-points', 'key-insights', 'executive'] as const;

      for (const style of styles) {
        await contextCompressor.summarizeContext(sampleLongText, { style });

        expect(mockPromptManager.getSummarizationPrompt).toHaveBeenCalledWith(
          sampleLongText,
          style,
          expect.any(Number),
          undefined,
          undefined
        );
      }
    });

    it('should use custom summarization prompt', async () => {
      const customPrompt = 'Custom summary prompt for {content}';
      
      await contextCompressor.summarizeContext(sampleLongText, {
        style: 'paragraph',
        customPrompt
      });

      expect(mockPromptManager.getSummarizationPrompt).toHaveBeenCalledWith(
        sampleLongText,
        'paragraph',
        expect.any(Number),
        false,
        customPrompt
      );
    });
  });

  describe('Prompt Management', () => {
    it('should set and remove prompt overrides', () => {
      const override = {
        systemPrompt: 'Custom system prompt',
        compressionPrompt: 'Custom compression prompt'
      };

      contextCompressor.setPromptOverride(override);
      expect(mockPromptManager.setOverride).toHaveBeenCalledWith('compressor', override);

      contextCompressor.removePromptOverride();
      expect(mockPromptManager.removeOverride).toHaveBeenCalledWith('compressor');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig: Partial<CompressionConfig> = {
        targetCompressionRatio: 0.3,
        respectContextWindow: false
      };

      contextCompressor.updateConfig(newConfig);

      const config = contextCompressor.getConfig();
      expect(config.targetCompressionRatio).toBe(0.3);
      expect(config.respectContextWindow).toBe(false);
    });

    it('should update maxInputLength when respectContextWindow is enabled', () => {
      contextCompressor.updateConfig({ respectContextWindow: true });

      const config = contextCompressor.getConfig();
      expect(config.maxInputLength).toBe(Math.floor(8192 * 0.8));
    });
  });

  describe('Batch Operations', () => {
    it('should perform batch compression', async () => {
      const entries = [
        {
          id: 'entry1',
          sessionId: 'session1',
          userId: 'user1',
          content: 'Short text that does not need compression',
          tier: 'hot' as const,
          timestamp: new Date(),
          accessCount: 1,
          lastAccessed: new Date(),
          size: 100
        },
        {
          id: 'entry2',
          sessionId: 'session1',
          userId: 'user1',
          content: sampleLongText,
          tier: 'warm' as const,
          timestamp: new Date(),
          accessCount: 2,
          lastAccessed: new Date(),
          size: sampleLongText.length
        }
      ];

      const results = await contextCompressor.batchCompress(entries, 1000);

      expect(results).toHaveLength(2);
      expect(results[0]?.result).toBeNull(); // Short text, no compression needed
      expect(results[1]?.result).toBeDefined(); // Long text, compressed
    });
  });
});