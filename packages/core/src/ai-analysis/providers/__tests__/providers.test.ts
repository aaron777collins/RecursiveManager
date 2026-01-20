/**
 * Unit tests for AI Provider system
 *
 * Tests all providers, factory, and health check functionality
 */

import { AIAnalysisRequest } from '../base';
import { AICEOGatewayProvider } from '../aiceo-gateway';
import { AnthropicDirectProvider } from '../anthropic-direct';
import { OpenAIDirectProvider } from '../openai-direct';
import { CustomProvider } from '../custom';
import { ProviderFactory } from '../factory';

// Mock fetch globally
global.fetch = jest.fn();

describe('AIProvider System', () => {
  // Reset mocks and env vars before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variables to test defaults
    delete process.env.AICEO_GATEWAY_URL;
    delete process.env.AICEO_GATEWAY_API_KEY;
    delete process.env.AICEO_GATEWAY_PROVIDER;
    delete process.env.AICEO_GATEWAY_MODEL;
    delete process.env.AICEO_GATEWAY_PRIORITY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_URL;
    delete process.env.ANTHROPIC_MODEL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_URL;
    delete process.env.OPENAI_MODEL;
    delete process.env.CUSTOM_PROVIDER_URL;
    delete process.env.CUSTOM_PROVIDER_API_KEY;
    delete process.env.AI_PROVIDER;
    delete process.env.AI_FALLBACK_PROVIDER;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AICEOGatewayProvider', () => {
    const mockRequest: AIAnalysisRequest = {
      prompt: 'Should we add Redis caching?',
      systemPrompt: 'You are a Security Expert.',
      agentType: 'security',
      temperature: 0.8,
      maxTokens: 2000
    };

    it('should make successful request to AICEO Gateway', async () => {
      process.env.AICEO_GATEWAY_API_KEY = 'test-api-key';

      const mockResponse = {
        success: true,
        response: {
          content: 'Security analysis...\n\nConfidence: 0.85',
          model: 'glm-4.7',
          usage: {
            inputTokens: 150,
            outputTokens: 500
          }
        },
        metadata: {
          waitTime: 1234,
          queueDepth: 2,
          requestId: 'test-request-id',
          provider: 'glm'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new AICEOGatewayProvider();
      const result = await provider.submit(mockRequest);

      expect(result).toMatchObject({
        content: 'Security analysis...\n\nConfidence: 0.85',
        confidence: 0.85,
        metadata: {
          model: 'glm-4.7',
          usage: {
            inputTokens: 150,
            outputTokens: 500
          },
          waitTime: 1234,
          provider: 'glm'
        }
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/glm/submit',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'test-api-key'
          }
        })
      );
    });

    it('should use environment variables for configuration', async () => {
      process.env.AICEO_GATEWAY_URL = 'https://custom.gateway.com/api/submit';
      process.env.AICEO_GATEWAY_API_KEY = 'custom-key';
      process.env.AICEO_GATEWAY_PROVIDER = 'anthropic';
      process.env.AICEO_GATEWAY_MODEL = 'claude-opus-4';
      process.env.AICEO_GATEWAY_PRIORITY = 'low';

      const mockResponse = {
        success: true,
        response: {
          content: 'Test response',
          model: 'claude-opus-4'
        },
        metadata: {
          waitTime: 100,
          queueDepth: 0,
          requestId: 'test-id',
          provider: 'anthropic'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new AICEOGatewayProvider();
      await provider.submit(mockRequest);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[0]).toBe('https://custom.gateway.com/api/submit');

      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody).toMatchObject({
        provider: 'anthropic',
        model: 'claude-opus-4',
        priority: 'low'
      });
    });

    it('should handle API errors gracefully', async () => {
      process.env.AICEO_GATEWAY_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key'
      });

      const provider = new AICEOGatewayProvider();

      await expect(provider.submit(mockRequest)).rejects.toThrow(
        'AICEOGatewayProvider failed: AICEO Gateway error (401): Invalid API key'
      );
    });

    it('should handle gateway success: false responses', async () => {
      process.env.AICEO_GATEWAY_API_KEY = 'test-key';

      const mockResponse = {
        success: false,
        error: 'Quota exceeded'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new AICEOGatewayProvider();

      await expect(provider.submit(mockRequest)).rejects.toThrow(
        'AICEOGatewayProvider failed: AICEO Gateway error: Quota exceeded'
      );
    });

    it('should extract confidence score correctly', async () => {
      process.env.AICEO_GATEWAY_API_KEY = 'test-key';

      const mockResponse = {
        success: true,
        response: {
          content: 'Analysis here.\n\nConfidence: 0.92\n\nMore text.',
          model: 'glm-4.7'
        },
        metadata: {
          waitTime: 100,
          queueDepth: 0,
          requestId: 'test-id',
          provider: 'glm'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new AICEOGatewayProvider();
      const result = await provider.submit(mockRequest);

      expect(result.confidence).toBe(0.92);
    });

    it('should default confidence to 0.7 if not found', async () => {
      process.env.AICEO_GATEWAY_API_KEY = 'test-key';

      const mockResponse = {
        success: true,
        response: {
          content: 'Analysis without confidence score.',
          model: 'glm-4.7'
        },
        metadata: {
          waitTime: 100,
          queueDepth: 0,
          requestId: 'test-id',
          provider: 'glm'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new AICEOGatewayProvider();
      const result = await provider.submit(mockRequest);

      expect(result.confidence).toBe(0.7);
    });

    it('should extract reasoning correctly', async () => {
      process.env.AICEO_GATEWAY_API_KEY = 'test-key';

      const mockResponse = {
        success: true,
        response: {
          content: 'Analysis.\n\nReasoning: This is because of XYZ.\n\nConfidence: 0.85',
          model: 'glm-4.7'
        },
        metadata: {
          waitTime: 100,
          queueDepth: 0,
          requestId: 'test-id',
          provider: 'glm'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new AICEOGatewayProvider();
      const result = await provider.submit(mockRequest);

      expect(result.reasoning).toBe('This is because of XYZ.');
    });

    it('should perform health check successfully', async () => {
      process.env.AICEO_GATEWAY_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const provider = new AICEOGatewayProvider();
      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/glm/status',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'X-API-Key': 'test-key'
          }
        })
      );
    });

    it('should fail health check when gateway is down', async () => {
      process.env.AICEO_GATEWAY_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const provider = new AICEOGatewayProvider();
      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe('AnthropicDirectProvider', () => {
    const mockRequest: AIAnalysisRequest = {
      prompt: 'Analyze this code.',
      systemPrompt: 'You are a code reviewer.',
      agentType: 'architecture',
      temperature: 0.7,
      maxTokens: 3000
    };

    it('should make successful request to Anthropic API', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Code review complete.\n\nConfidence: 0.88'
          }
        ],
        model: 'claude-sonnet-4-5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 200,
          output_tokens: 400
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new AnthropicDirectProvider();
      const result = await provider.submit(mockRequest);

      expect(result).toMatchObject({
        content: 'Code review complete.\n\nConfidence: 0.88',
        confidence: 0.88,
        metadata: {
          model: 'claude-sonnet-4-5',
          usage: {
            inputTokens: 200,
            outputTokens: 400
          },
          provider: 'anthropic-direct'
        }
      });
    });

    it('should use separate system field for Anthropic', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-sonnet-4-5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new AnthropicDirectProvider();
      await provider.submit(mockRequest);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody).toHaveProperty('system', 'You are a code reviewer.');
      expect(requestBody.messages).toHaveLength(1);
      expect(requestBody.messages[0]).toEqual({
        role: 'user',
        content: 'Analyze this code.'
      });
    });

    it('should use correct Anthropic headers', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Response' }],
        model: 'claude-sonnet-4-5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 10 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new AnthropicDirectProvider();
      await provider.submit(mockRequest);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers).toEqual({
        'Content-Type': 'application/json',
        'x-api-key': 'sk-ant-test-key',
        'anthropic-version': '2023-06-01'
      });
    });

    it('should handle API errors', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded'
      });

      const provider = new AnthropicDirectProvider();

      await expect(provider.submit(mockRequest)).rejects.toThrow(
        'AnthropicDirectProvider failed: Anthropic API error (429): Rate limit exceeded'
      );
    });

    it('should perform health check successfully', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const provider = new AnthropicDirectProvider();
      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it('should accept 401 as healthy (service reachable)', async () => {
      process.env.ANTHROPIC_API_KEY = 'invalid-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const provider = new AnthropicDirectProvider();
      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(true); // 401 means API is reachable
    });
  });

  describe('OpenAIDirectProvider', () => {
    const mockRequest: AIAnalysisRequest = {
      prompt: 'Optimize this algorithm.',
      systemPrompt: 'You are a performance expert.',
      agentType: 'simplicity',
      temperature: 0.6,
      maxTokens: 2500
    };

    it('should make successful request to OpenAI API', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4-turbo',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Performance analysis.\n\nConfidence: 0.91'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 180,
          completion_tokens: 320,
          total_tokens: 500
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new OpenAIDirectProvider();
      const result = await provider.submit(mockRequest);

      expect(result).toMatchObject({
        content: 'Performance analysis.\n\nConfidence: 0.91',
        confidence: 0.91,
        metadata: {
          model: 'gpt-4-turbo',
          usage: {
            inputTokens: 180,
            outputTokens: 320
          },
          provider: 'openai-direct'
        }
      });
    });

    it('should use OpenAI message format', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4-turbo',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new OpenAIDirectProvider();
      await provider.submit(mockRequest);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);

      expect(requestBody.messages).toEqual([
        { role: 'system', content: 'You are a performance expert.' },
        { role: 'user', content: 'Optimize this algorithm.' }
      ]);
    });

    it('should use correct OpenAI headers', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      const mockResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1677652288,
        model: 'gpt-4-turbo',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response' },
            finish_reason: 'stop'
          }
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new OpenAIDirectProvider();
      await provider.submit(mockRequest);

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      expect(fetchCall[1].headers).toEqual({
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-test-key'
      });
    });

    it('should handle API errors', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error'
      });

      const provider = new OpenAIDirectProvider();

      await expect(provider.submit(mockRequest)).rejects.toThrow(
        'OpenAIDirectProvider failed: OpenAI API error (500): Internal server error'
      );
    });

    it('should perform health check successfully', async () => {
      process.env.OPENAI_API_KEY = 'sk-test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const provider = new OpenAIDirectProvider();
      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(true);
    });
  });

  describe('CustomProvider', () => {
    const mockRequest: AIAnalysisRequest = {
      prompt: 'Analyze user sentiment.',
      systemPrompt: 'You are a sentiment analyst.',
      agentType: 'emotional',
      temperature: 0.5,
      maxTokens: 1500
    };

    it('should make successful request to custom endpoint', async () => {
      process.env.CUSTOM_PROVIDER_URL = 'https://custom.api.com/chat';
      process.env.CUSTOM_PROVIDER_API_KEY = 'custom-key';
      process.env.CUSTOM_PROVIDER_FORMAT = 'custom';

      const mockResponse = {
        content: 'Sentiment analysis complete.\n\nConfidence: 0.86'
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new CustomProvider();
      const result = await provider.submit(mockRequest);

      expect(result.content).toBe('Sentiment analysis complete.\n\nConfidence: 0.86');
      expect(result.confidence).toBe(0.86);
      expect(result.metadata?.provider).toBe('custom');
    });

    it('should handle OpenAI-style response format', async () => {
      process.env.CUSTOM_PROVIDER_URL = 'https://custom.api.com/chat';
      process.env.CUSTOM_PROVIDER_API_KEY = 'custom-key';
      process.env.CUSTOM_PROVIDER_FORMAT = 'openai';

      const mockResponse = {
        choices: [
          {
            message: {
              content: 'OpenAI-style response'
            }
          }
        ],
        model: 'gpt-4',
        usage: {
          prompt_tokens: 50,
          completion_tokens: 100
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new CustomProvider();
      const result = await provider.submit(mockRequest);

      expect(result.content).toBe('OpenAI-style response');
      expect(result.metadata?.usage).toEqual({
        inputTokens: 50,
        outputTokens: 100
      });
    });

    it('should handle Anthropic-style response format', async () => {
      process.env.CUSTOM_PROVIDER_URL = 'https://custom.api.com/chat';
      process.env.CUSTOM_PROVIDER_API_KEY = 'custom-key';
      process.env.CUSTOM_PROVIDER_FORMAT = 'anthropic';

      const mockResponse = {
        content: [
          {
            text: 'Anthropic-style response'
          }
        ],
        usage: {
          input_tokens: 60,
          output_tokens: 120
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const provider = new CustomProvider();
      const result = await provider.submit(mockRequest);

      expect(result.content).toBe('Anthropic-style response');
      expect(result.metadata?.usage).toEqual({
        inputTokens: 60,
        outputTokens: 120
      });
    });

    it('should handle API errors', async () => {
      process.env.CUSTOM_PROVIDER_URL = 'https://custom.api.com/chat';
      process.env.CUSTOM_PROVIDER_API_KEY = 'custom-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden'
      });

      const provider = new CustomProvider();

      await expect(provider.submit(mockRequest)).rejects.toThrow(
        'CustomProvider failed: Custom API error (403): Forbidden'
      );
    });

    it('should perform health check successfully', async () => {
      process.env.CUSTOM_PROVIDER_URL = 'https://custom.api.com/chat';
      process.env.CUSTOM_PROVIDER_API_KEY = 'custom-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const provider = new CustomProvider();
      const isHealthy = await provider.healthCheck();

      expect(isHealthy).toBe(true);
    });
  });

  describe('ProviderFactory', () => {
    it('should create AICEOGatewayProvider by default', () => {
      const provider = ProviderFactory.create();
      expect(provider).toBeInstanceOf(AICEOGatewayProvider);
      expect(provider.name).toBe('aiceo-gateway');
    });

    it('should create provider based on AI_PROVIDER env var', () => {
      process.env.AI_PROVIDER = 'anthropic-direct';
      const provider = ProviderFactory.create();
      expect(provider).toBeInstanceOf(AnthropicDirectProvider);
      expect(provider.name).toBe('anthropic-direct');
    });

    it('should create provider by explicit name parameter', () => {
      const provider = ProviderFactory.create('openai-direct');
      expect(provider).toBeInstanceOf(OpenAIDirectProvider);
      expect(provider.name).toBe('openai-direct');
    });

    it('should create custom provider', () => {
      const provider = ProviderFactory.create('custom');
      expect(provider).toBeInstanceOf(CustomProvider);
      expect(provider.name).toBe('custom');
    });

    it('should throw error for unknown provider', () => {
      expect(() => ProviderFactory.create('unknown-provider')).toThrow(
        'Unknown AI provider: unknown-provider'
      );
    });

    it('should return primary provider if healthy', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AICEO_GATEWAY_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const provider = await ProviderFactory.createWithHealthCheck();
      expect(provider).toBeInstanceOf(AICEOGatewayProvider);
    });

    it('should fallback to secondary provider if primary unhealthy', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      // Primary fails
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Fallback succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const provider = await ProviderFactory.createWithHealthCheck();
      expect(provider).toBeInstanceOf(AnthropicDirectProvider);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Primary provider aiceo-gateway unavailable, using fallback')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should throw error if primary unhealthy and no fallback configured', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      // No AI_FALLBACK_PROVIDER set

      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(ProviderFactory.createWithHealthCheck()).rejects.toThrow(
        'Primary provider aiceo-gateway unavailable and no fallback configured'
      );
    });

    it('should throw error if both primary and fallback unhealthy', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';

      // Both fail
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await expect(ProviderFactory.createWithHealthCheck()).rejects.toThrow(
        'No available AI providers. Primary (aiceo-gateway) and fallback (anthropic-direct) both failed health checks.'
      );

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});
