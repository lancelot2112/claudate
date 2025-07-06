/**
 * Integration Test Setup
 * 
 * Sets up mocks and test utilities for integration tests
 */

// import path from 'path';

// Mock external dependencies
jest.mock('../../../src/integrations/ai/AnthropicClient', () => {
  return {
    AnthropicClient: jest.fn().mockImplementation(() => ({
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Mock response from Anthropic',
        usage: { input_tokens: 10, output_tokens: 20 },
        model: 'claude-3-haiku-20240307'
      }),
      sendCodingRequest: jest.fn().mockResolvedValue({
        content: 'Mock coding response',
        usage: { input_tokens: 15, output_tokens: 25 },
        model: 'claude-3-haiku-20240307'
      }),
      sendTestingRequest: jest.fn().mockResolvedValue({
        content: 'Mock testing response',
        usage: { input_tokens: 12, output_tokens: 22 },
        model: 'claude-3-haiku-20240307'
      }),
      sendToolExecutionRequest: jest.fn().mockResolvedValue({
        content: 'Mock tool execution response',
        usage: { input_tokens: 18, output_tokens: 28 },
        model: 'claude-3-haiku-20240307'
      }),
      healthCheck: jest.fn().mockResolvedValue(true),
      getCosts: jest.fn().mockReturnValue(new Map([['daily', 0.05]]))
    }))
  };
});

jest.mock('../../../src/integrations/ai/GeminiClient', () => {
  return {
    GeminiClient: jest.fn().mockImplementation(() => ({
      sendMessage: jest.fn().mockResolvedValue({
        content: 'Mock response from Gemini',
        usage: { input_tokens: 12, output_tokens: 24 },
        model: 'gemini-1.5-flash'
      }),
      sendStrategicRequest: jest.fn().mockResolvedValue({
        content: 'Mock strategic response',
        usage: { input_tokens: 20, output_tokens: 40 },
        model: 'gemini-1.5-flash'
      }),
      sendPlanningRequest: jest.fn().mockResolvedValue({
        content: 'Mock planning response',
        usage: { input_tokens: 25, output_tokens: 50 },
        model: 'gemini-1.5-flash'
      }),
      sendArchitecturalReview: jest.fn().mockResolvedValue({
        content: 'Mock architectural review response',
        usage: { input_tokens: 30, output_tokens: 60 },
        model: 'gemini-1.5-flash'
      }),
      healthCheck: jest.fn().mockResolvedValue(true),
      getCosts: jest.fn().mockReturnValue(new Map([['daily', 0.03]]))
    }))
  };
});

// Mock Vector Store
jest.mock('../../../src/knowledge/stores/VectorStore', () => {
  return {
    VectorStore: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      addDocument: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue([
        {
          document: {
            id: 'test-doc-1',
            title: 'Test Document',
            content: 'Test content',
            type: 'article',
            source: 'test',
            metadata: { tags: ['test'] },
            createdAt: new Date(),
            updatedAt: new Date()
          },
          score: 0.8
        }
      ]),
      getDocumentById: jest.fn().mockResolvedValue(null),
      updateDocument: jest.fn().mockResolvedValue(undefined),
      deleteDocument: jest.fn().mockResolvedValue(undefined),
      getDocumentCount: jest.fn().mockResolvedValue(3),
      healthCheck: jest.fn().mockResolvedValue(true)
    }))
  };
});

// Mock Semantic Search
jest.mock('../../../src/knowledge/search/SemanticSearch', () => {
  return {
    SemanticSearchEngine: jest.fn().mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      search: jest.fn().mockResolvedValue([
        {
          document: {
            id: 'test-doc-1',
            title: 'Test Document',
            content: 'Test content',
            type: 'article',
            source: 'test',
            metadata: { tags: ['test'] },
            createdAt: new Date(),
            updatedAt: new Date()
          },
          score: 0.9,
          explanation: 'Mock semantic search result'
        }
      ]),
      healthCheck: jest.fn().mockResolvedValue(true)
    }))
  };
});

console.log('Integration test mocks configured');