import { GeminiClient } from '../../../src/integrations/ai/GeminiClient.js';
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Mock the Google AI SDK
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn()
    }))
  };
});

describe('GeminiClient Integration Tests', () => {
  let client: GeminiClient;
  let mockGoogleAI: any;
  let mockModel: any;
  let mockChat: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock chat and model
    mockChat = {
      sendMessage: jest.fn()
    };

    mockModel = {
      startChat: jest.fn().mockReturnValue(mockChat)
    };

    // Mock GoogleGenerativeAI
    const GoogleGenerativeAIMock = require('@google/generative-ai').GoogleGenerativeAI;
    mockGoogleAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel)
    };
    GoogleGenerativeAIMock.mockImplementation(() => mockGoogleAI);

    client = new GeminiClient({
      apiKey: 'test-api-key',
      defaultModel: 'gemini-1.5-pro',
      temperature: 0.7,
      maxOutputTokens: 2000,
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
      const mockResult = {
        response: {
          text: () => 'Hello! I am Gemini.',
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 15,
            totalTokenCount: 25
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      const response = await client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'Hello, Gemini!' }] }]
      });

      expect(response).toEqual({
        content: 'Hello! I am Gemini.',
        usage: {
          promptTokenCount: 10,
          candidatesTokenCount: 15,
          totalTokenCount: 25
        },
        model: 'gemini-1.5-pro'
      });

      expect(mockGoogleAI.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-1.5-pro',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000
        },
        systemInstruction: undefined
      });

      expect(mockModel.startChat).toHaveBeenCalledWith({
        history: []
      });

      expect(mockChat.sendMessage).toHaveBeenCalledWith('Hello, Gemini!');
    });

    test('should handle conversation history', async () => {
      const mockResult = {
        response: {
          text: () => 'Continuing our conversation.',
          usageMetadata: {
            promptTokenCount: 25,
            candidatesTokenCount: 20,
            totalTokenCount: 45
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      await client.sendMessage({
        messages: [
          { role: 'user', parts: [{ text: 'First message' }] },
          { role: 'model', parts: [{ text: 'First response' }] },
          { role: 'user', parts: [{ text: 'Second message' }] }
        ]
      });

      expect(mockModel.startChat).toHaveBeenCalledWith({
        history: [
          { role: 'user', parts: [{ text: 'First message' }] },
          { role: 'model', parts: [{ text: 'First response' }] }
        ]
      });

      expect(mockChat.sendMessage).toHaveBeenCalledWith('Second message');
    });

    test('should use system instruction', async () => {
      const mockResult = {
        response: {
          text: () => 'Strategic response',
          usageMetadata: {
            promptTokenCount: 30,
            candidatesTokenCount: 25,
            totalTokenCount: 55
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      await client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'Analyze this' }] }],
        systemInstruction: 'You are a strategic advisor'
      });

      expect(mockGoogleAI.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-1.5-pro',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000
        },
        systemInstruction: 'You are a strategic advisor'
      });
    });

    test('should handle API errors gracefully', async () => {
      mockChat.sendMessage.mockRejectedValue(new Error('API quota exceeded'));

      await expect(client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'Hello' }] }]
      })).rejects.toThrow('Gemini API error: API quota exceeded');
    });

    test('should use custom model and parameters', async () => {
      const mockResult = {
        response: {
          text: () => 'Quick response',
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 8,
            totalTokenCount: 13
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      await client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'Quick question' }] }],
        model: 'gemini-1.5-flash',
        temperature: 0.2,
        maxOutputTokens: 500
      });

      expect(mockGoogleAI.getGenerativeModel).toHaveBeenCalledWith({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 500
        },
        systemInstruction: undefined
      });
    });

    test('should handle response without usage metadata', async () => {
      const mockResult = {
        response: {
          text: () => 'Response without metadata'
          // No usageMetadata
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      const response = await client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'Test' }] }]
      });

      expect(response).toEqual({
        content: 'Response without metadata',
        usage: undefined,
        model: 'gemini-1.5-pro'
      });
    });
  });

  describe('sendStrategicRequest', () => {
    test('should send strategic request with appropriate system instruction', async () => {
      const mockResult = {
        response: {
          text: () => 'Strategic analysis complete.',
          usageMetadata: {
            promptTokenCount: 50,
            candidatesTokenCount: 75,
            totalTokenCount: 125
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      const response = await client.sendStrategicRequest(
        'Analyze our technology stack',
        'Current system using Node.js and React',
        'Technology'
      );

      expect(response.content).toContain('Strategic analysis complete');
      expect(mockGoogleAI.getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.8, // Higher temperature for strategic thinking
          systemInstruction: expect.stringContaining('strategic planning expert')
        })
      );
      expect(mockChat.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Analyze our technology stack')
      );
    });

    test('should include domain specialization', async () => {
      const mockResult = {
        response: {
          text: () => 'Financial strategic analysis',
          usageMetadata: {
            promptTokenCount: 40,
            candidatesTokenCount: 60,
            totalTokenCount: 100
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      await client.sendStrategicRequest(
        'Optimize our budget allocation',
        undefined,
        'Finance'
      );

      expect(mockGoogleAI.getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          systemInstruction: expect.stringContaining('You specialize in Finance domain')
        })
      );
    });
  });

  describe('sendPlanningRequest', () => {
    test('should send planning request with comprehensive prompt', async () => {
      const mockResult = {
        response: {
          text: () => 'Comprehensive project plan created.',
          usageMetadata: {
            promptTokenCount: 80,
            candidatesTokenCount: 120,
            totalTokenCount: 200
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      const response = await client.sendPlanningRequest(
        'Launch new product feature',
        ['Limited budget', 'Three-month deadline'],
        '3 months'
      );

      expect(response.content).toContain('Comprehensive project plan created');
      expect(mockGoogleAI.getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.6, // Moderate temperature for structured planning
          systemInstruction: expect.stringContaining('expert project planner')
        })
      );
      expect(mockChat.sendMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Launch new product feature[\s\S]*Limited budget[\s\S]*Three-month deadline[\s\S]*3 months/)
      );
    });

    test('should handle minimal planning request', async () => {
      const mockResult = {
        response: {
          text: () => 'Basic plan outline',
          usageMetadata: {
            promptTokenCount: 30,
            candidatesTokenCount: 40,
            totalTokenCount: 70
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      await client.sendPlanningRequest('Simple task planning');

      expect(mockChat.sendMessage).toHaveBeenCalledWith(
        expect.stringContaining('Simple task planning')
      );
    });
  });

  describe('sendArchitecturalReview', () => {
    test('should send architectural review request', async () => {
      const mockResult = {
        response: {
          text: () => 'Architecture review completed with recommendations.',
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 150,
            totalTokenCount: 250
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      const response = await client.sendArchitecturalReview(
        'Microservices architecture with Node.js',
        ['High availability', 'Scalable to 1M users'],
        ['Budget constraints', 'Existing team expertise']
      );

      expect(response.content).toContain('Architecture review completed');
      expect(mockGoogleAI.getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5, // Lower temperature for technical analysis
          systemInstruction: expect.stringContaining('senior software architect')
        })
      );
      expect(mockChat.sendMessage).toHaveBeenCalledWith(
        expect.stringMatching(/Microservices architecture[\s\S]*High availability[\s\S]*Scalable to 1M users[\s\S]*Budget constraints[\s\S]*Existing team expertise/)
      );
    });
  });

  describe('cost tracking', () => {
    test('should track costs for requests', async () => {
      const mockResult = {
        response: {
          text: () => 'Response',
          usageMetadata: {
            promptTokenCount: 100,
            candidatesTokenCount: 200,
            totalTokenCount: 300
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      await client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'Test message' }] }]
      });

      const dailyCost = client.getDailyCost();
      expect(dailyCost).toBeGreaterThan(0);
      
      // Expected cost: (100/1000 * 0.0035) + (200/1000 * 0.0105) = 0.00035 + 0.0021 = 0.00245
      expect(dailyCost).toBeCloseTo(0.00245, 5);
    });

    test('should accumulate costs over multiple requests', async () => {
      const mockResult = {
        response: {
          text: () => 'Response',
          usageMetadata: {
            promptTokenCount: 50,
            candidatesTokenCount: 50,
            totalTokenCount: 100
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      const initialCost = client.getDailyCost();
      
      await client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'First message' }] }]
      });
      
      const firstCost = client.getDailyCost();
      
      await client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'Second message' }] }]
      });
      
      const secondCost = client.getDailyCost();
      
      expect(secondCost).toBeGreaterThan(firstCost);
      expect(firstCost).toBeGreaterThan(initialCost);
    });

    test('should handle requests without usage metadata', async () => {
      const mockResult = {
        response: {
          text: () => 'Response without metadata'
          // No usageMetadata
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      const initialCost = client.getDailyCost();
      
      await client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'Test message' }] }]
      });
      
      const finalCost = client.getDailyCost();
      
      // Cost should not change if no usage metadata
      expect(finalCost).toBe(initialCost);
    });
  });

  describe('healthCheck', () => {
    test('should return true for healthy service', async () => {
      const mockResult = {
        response: {
          text: () => 'OK',
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 1,
            totalTokenCount: 6
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    test('should return false for unhealthy service', async () => {
      mockChat.sendMessage.mockRejectedValue(new Error('Service unavailable'));

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });

    test('should return false if response does not contain OK', async () => {
      const mockResult = {
        response: {
          text: () => 'Service error',
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 5,
            totalTokenCount: 10
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should handle network errors', async () => {
      mockChat.sendMessage.mockRejectedValue(new Error('Network error'));

      await expect(client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'Test' }] }]
      })).rejects.toThrow('Gemini API error: Network error');
    });

    test('should handle empty responses', async () => {
      const mockResult = {
        response: {
          text: () => '',
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 0,
            totalTokenCount: 5
          }
        }
      };
      mockChat.sendMessage.mockResolvedValue(mockResult);

      const response = await client.sendMessage({
        messages: [{ role: 'user', parts: [{ text: 'Test' }] }]
      });

      expect(response.content).toBe('');
    });
  });

  describe('configuration', () => {
    test('should use default configuration when not provided', () => {
      const defaultClient = new GeminiClient();
      expect(defaultClient).toBeDefined();
    });

    test('should override default configuration', () => {
      const customClient = new GeminiClient({
        defaultModel: 'gemini-1.5-flash',
        temperature: 0.9,
        maxOutputTokens: 1000
      });
      expect(customClient).toBeDefined();
    });
  });
});