import { AnthropicClient } from '../../../src/integrations/ai/AnthropicClient.js';
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn()
      }
    }))
  };
});

describe('AnthropicClient Integration Tests', () => {
  let client: AnthropicClient;
  let mockAnthropic: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock Anthropic SDK
    const AnthropicMock = require('@anthropic-ai/sdk').default;
    mockAnthropic = {
      messages: {
        create: jest.fn()
      }
    };
    AnthropicMock.mockImplementation(() => mockAnthropic);

    client = new AnthropicClient({
      apiKey: 'test-api-key',
      defaultModel: 'claude-3-sonnet-20240229',
      maxTokens: 1000,
      temperature: 0.7,
      timeout: 30000,
      maxRetries: 3
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendMessage', () => {
    test('should send a basic message successfully', async () => {
      // Mock successful response
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Hello, I am Claude!' }],
        model: 'claude-3-sonnet-20240229',
        usage: {
          input_tokens: 10,
          output_tokens: 15
        }
      });

      const response = await client.sendMessage({
        messages: [{ role: 'user', content: 'Hello, Claude!' }]
      });

      expect(response).toEqual({
        content: 'Hello, I am Claude!',
        usage: {
          input_tokens: 10,
          output_tokens: 15
        },
        model: 'claude-3-sonnet-20240229'
      });

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.7,
        system: undefined,
        messages: [{ role: 'user', content: 'Hello, Claude!' }]
      });
    });

    test('should send message with system prompt', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Code response' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 20, output_tokens: 30 }
      });

      await client.sendMessage({
        messages: [{ role: 'user', content: 'Write a function' }],
        system: 'You are a coding assistant'
      });

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0.7,
        system: 'You are a coding assistant',
        messages: [{ role: 'user', content: 'Write a function' }]
      });
    });

    test('should handle API errors gracefully', async () => {
      mockAnthropic.messages.create.mockRejectedValue(new Error('API Rate Limit'));

      await expect(client.sendMessage({
        messages: [{ role: 'user', content: 'Hello' }]
      })).rejects.toThrow('Anthropic API error: API Rate Limit');
    });

    test('should use custom model and parameters', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-haiku-20240307',
        usage: { input_tokens: 5, output_tokens: 10 }
      });

      await client.sendMessage({
        messages: [{ role: 'user', content: 'Quick question' }],
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        temperature: 0.2
      });

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-haiku-20240307',
        max_tokens: 500,
        temperature: 0.2,
        system: undefined,
        messages: [{ role: 'user', content: 'Quick question' }]
      });
    });
  });

  describe('sendCodingRequest', () => {
    test('should send coding request with system prompt', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'function add(a, b) { return a + b; }' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 50, output_tokens: 25 }
      });

      const response = await client.sendCodingRequest(
        'Create an add function',
        'JavaScript math utilities',
        'JavaScript'
      );

      expect(response.content).toContain('function add(a, b)');
      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3, // Lower temperature for coding
          system: expect.stringContaining('expert software engineer'),
          messages: [{ role: 'user', content: 'Create an add function' }]
        })
      );
    });

    test('should include language-specific guidance', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'TypeScript code here' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 40, output_tokens: 60 }
      });

      await client.sendCodingRequest(
        'Create a type-safe function',
        undefined,
        'TypeScript'
      );

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('Focus on TypeScript programming language')
        })
      );
    });
  });

  describe('sendTestingRequest', () => {
    test('should send testing request with appropriate system prompt', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'describe("add function", () => { ... })' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 30, output_tokens: 40 }
      });

      const response = await client.sendTestingRequest(
        'function add(a, b) { return a + b; }',
        'unit'
      );

      expect(response.content).toContain('describe(');
      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.2, // Very low temperature for testing
          system: expect.stringContaining('expert test engineer'),
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Write unit tests')
            })
          ])
        })
      );
    });

    test('should handle different test types', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Integration test code' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 35, output_tokens: 45 }
      });

      await client.sendTestingRequest('const api = new API()', 'integration');

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Write integration tests')
            })
          ])
        })
      );
    });

    test('should default to unit tests', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Unit test code' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 25, output_tokens: 35 }
      });

      await client.sendTestingRequest('function test() {}');

      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Write unit tests')
            })
          ])
        })
      );
    });
  });

  describe('sendToolExecutionRequest', () => {
    test('should send tool execution request', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Tool execution plan' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 45, output_tokens: 55 }
      });

      const response = await client.sendToolExecutionRequest(
        'npm',
        { command: 'install', package: 'typescript' },
        'Install TypeScript package'
      );

      expect(response.content).toContain('Tool execution plan');
      expect(mockAnthropic.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.1, // Very low temperature for tool execution
          system: expect.stringContaining('expert tool execution agent'),
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('npm')
            })
          ])
        })
      );
    });
  });

  describe('cost tracking', () => {
    test('should track costs for requests', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 100, output_tokens: 200 }
      });

      await client.sendMessage({
        messages: [{ role: 'user', content: 'Test message' }]
      });

      const dailyCost = client.getDailyCost();
      expect(dailyCost).toBeGreaterThan(0);
      
      // Expected cost: (100/1000 * 0.003) + (200/1000 * 0.015) = 0.0003 + 0.003 = 0.0033
      expect(dailyCost).toBeCloseTo(0.0033, 4);
    });

    test('should accumulate costs over multiple requests', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 50, output_tokens: 50 }
      });

      const initialCost = client.getDailyCost();
      
      await client.sendMessage({
        messages: [{ role: 'user', content: 'First message' }]
      });
      
      const firstCost = client.getDailyCost();
      
      await client.sendMessage({
        messages: [{ role: 'user', content: 'Second message' }]
      });
      
      const secondCost = client.getDailyCost();
      
      expect(secondCost).toBeGreaterThan(firstCost);
      expect(firstCost).toBeGreaterThan(initialCost);
    });
  });

  describe('healthCheck', () => {
    test('should return true for healthy service', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'OK' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 5, output_tokens: 1 }
      });

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    test('should return false for unhealthy service', async () => {
      mockAnthropic.messages.create.mockRejectedValue(new Error('Service unavailable'));

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });

    test('should return false if response does not contain OK', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Service error' }],
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 5, output_tokens: 5 }
      });

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should handle network errors', async () => {
      mockAnthropic.messages.create.mockRejectedValue(new Error('Network error'));

      await expect(client.sendMessage({
        messages: [{ role: 'user', content: 'Test' }]
      })).rejects.toThrow('Anthropic API error: Network error');
    });

    test('should handle malformed responses', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [], // No content
        model: 'claude-3-sonnet-20240229',
        usage: { input_tokens: 5, output_tokens: 0 }
      });

      const response = await client.sendMessage({
        messages: [{ role: 'user', content: 'Test' }]
      });

      expect(response.content).toBe('');
    });
  });

  describe('configuration', () => {
    test('should use default configuration when not provided', () => {
      const defaultClient = new AnthropicClient();
      expect(defaultClient).toBeDefined();
    });

    test('should override default configuration', () => {
      const customClient = new AnthropicClient({
        defaultModel: 'claude-3-haiku-20240307',
        maxTokens: 2000,
        temperature: 0.9
      });
      expect(customClient).toBeDefined();
    });
  });
});