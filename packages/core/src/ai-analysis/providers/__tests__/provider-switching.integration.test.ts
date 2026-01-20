/**
 * Integration Test: Provider Switching & Failover
 *
 * Tests the complete provider switching scenario:
 * 1. Start with AICEO Gateway as primary, Anthropic as fallback
 * 2. Verify AICEO Gateway is used when available
 * 3. Simulate AICEO Gateway going down
 * 4. Verify automatic failover to Anthropic
 * 5. Simulate AICEO Gateway coming back up
 * 6. Verify switch back to AICEO Gateway
 *
 * This tests the full lifecycle of provider health monitoring and failover logic.
 */

import { ProviderFactory } from '../factory';
import { AICEOGatewayProvider } from '../aiceo-gateway';
import { AnthropicDirectProvider } from '../anthropic-direct';
import { AIAnalysisRequest } from '../base';

// Mock fetch globally
global.fetch = jest.fn();

describe('Provider Switching Integration Tests', () => {
  const mockRequest: AIAnalysisRequest = {
    prompt: 'Should we migrate to microservices?',
    systemPrompt: 'You are a Security Expert.',
    agentType: 'security',
    temperature: 0.7,
    maxTokens: 4000
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Clear all environment variables
    delete process.env.AI_PROVIDER;
    delete process.env.AI_FALLBACK_PROVIDER;
    delete process.env.AICEO_GATEWAY_URL;
    delete process.env.AICEO_GATEWAY_API_KEY;
    delete process.env.AICEO_GATEWAY_PROVIDER;
    delete process.env.AICEO_GATEWAY_MODEL;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_URL;
    delete process.env.ANTHROPIC_MODEL;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Scenario 1: Primary Available → Use Primary', () => {
    it('should use AICEO Gateway when it is healthy', async () => {
      // Configure primary (AICEO Gateway) and fallback (Anthropic)
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.AICEO_GATEWAY_API_KEY = 'test-gateway-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Mock AICEO Gateway health check - HEALTHY
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      // Create provider with health check
      const provider = await ProviderFactory.createWithHealthCheck();

      // Verify we got the AICEO Gateway provider
      expect(provider).toBeInstanceOf(AICEOGatewayProvider);
      expect(provider.name).toBe('aiceo-gateway');

      // Verify health check was called on primary
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:4000/api/glm/status',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'X-API-Key': 'test-gateway-key'
          }
        })
      );
    });

    it('should successfully submit request through AICEO Gateway', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AICEO_GATEWAY_API_KEY = 'test-gateway-key';

      // Mock health check - healthy
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const provider = await ProviderFactory.createWithHealthCheck();

      // Mock actual request to AICEO Gateway
      const mockGatewayResponse = {
        success: true,
        response: {
          content: 'Security analysis: Microservices increase attack surface...\n\nConfidence: 0.85',
          model: 'glm-4.7',
          usage: {
            inputTokens: 200,
            outputTokens: 600
          }
        },
        metadata: {
          waitTime: 1234,
          queueDepth: 0,
          requestId: 'test-request-id',
          provider: 'glm'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGatewayResponse
      });

      const result = await provider.submit(mockRequest);

      expect(result.content).toContain('Security analysis');
      expect(result.confidence).toBe(0.85);
      expect(result.metadata?.provider).toBe('glm');
    });
  });

  describe('Scenario 2: Primary Down → Fallback to Secondary', () => {
    it('should fallback to Anthropic when AICEO Gateway is down', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.AICEO_GATEWAY_API_KEY = 'test-gateway-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Mock console.warn to verify warning is logged
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock AICEO Gateway health check - DOWN (network error)
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('ECONNREFUSED: Connection refused')
      );

      // Mock Anthropic health check - HEALTHY
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200
      });

      // Create provider with health check
      const provider = await ProviderFactory.createWithHealthCheck();

      // Verify we got the fallback Anthropic provider
      expect(provider).toBeInstanceOf(AnthropicDirectProvider);
      expect(provider.name).toBe('anthropic-direct');

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Primary provider aiceo-gateway unavailable, using fallback')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should successfully submit request through fallback provider', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Primary down
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Fallback healthy
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const provider = await ProviderFactory.createWithHealthCheck();
      expect(provider).toBeInstanceOf(AnthropicDirectProvider);

      // Mock Anthropic API response
      const mockAnthropicResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Security analysis from Anthropic: Microservices can be secure...\n\nConfidence: 0.88'
          }
        ],
        model: 'claude-sonnet-4-5',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 210,
          output_tokens: 580
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnthropicResponse
      });

      const result = await provider.submit(mockRequest);

      expect(result.content).toContain('Security analysis from Anthropic');
      expect(result.confidence).toBe(0.88);
      expect(result.metadata?.provider).toBe('anthropic-direct');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Scenario 3: No Fallback Configured → Error', () => {
    it('should throw error if primary down and no fallback configured', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      // AI_FALLBACK_PROVIDER not set

      // Mock AICEO Gateway health check - DOWN
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Connection refused')
      );

      // Should throw error
      await expect(ProviderFactory.createWithHealthCheck()).rejects.toThrow(
        'Primary provider aiceo-gateway unavailable and no fallback configured'
      );
    });
  });

  describe('Scenario 4: Both Providers Down → Error', () => {
    it('should throw error if both primary and fallback are down', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Mock both health checks as DOWN
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('AICEO Gateway down'));
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Anthropic down'));

      // Should throw error
      await expect(ProviderFactory.createWithHealthCheck()).rejects.toThrow(
        'No available AI providers. Primary (aiceo-gateway) and fallback (anthropic-direct) both failed health checks.'
      );

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Scenario 5: Primary Recovers → Switch Back', () => {
    it('should use primary again when it recovers', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.AICEO_GATEWAY_API_KEY = 'test-gateway-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // Step 1: Primary is down, fallback to Anthropic
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Gateway down'));
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const provider1 = await ProviderFactory.createWithHealthCheck();

      expect(provider1).toBeInstanceOf(AnthropicDirectProvider);
      consoleWarnSpy.mockRestore();

      // Step 2: Primary recovers, should use primary again
      jest.clearAllMocks();
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const provider2 = await ProviderFactory.createWithHealthCheck();

      expect(provider2).toBeInstanceOf(AICEOGatewayProvider);
      expect(provider2.name).toBe('aiceo-gateway');
    });
  });

  describe('Scenario 6: Multiple Sequential Requests with Provider Changes', () => {
    it('should handle multiple requests as providers come up and down', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.AICEO_GATEWAY_API_KEY = 'test-gateway-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Request 1: Primary healthy
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      const provider1 = await ProviderFactory.createWithHealthCheck();
      expect(provider1.name).toBe('aiceo-gateway');

      // Request 2: Primary goes down
      jest.clearAllMocks();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Down'));
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      const provider2 = await ProviderFactory.createWithHealthCheck();
      expect(provider2.name).toBe('anthropic-direct');

      // Request 3: Primary still down
      jest.clearAllMocks();
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Down'));
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      const provider3 = await ProviderFactory.createWithHealthCheck();
      expect(provider3.name).toBe('anthropic-direct');

      // Request 4: Primary recovers
      jest.clearAllMocks();
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      const provider4 = await ProviderFactory.createWithHealthCheck();
      expect(provider4.name).toBe('aiceo-gateway');

      // Request 5: Primary healthy
      jest.clearAllMocks();
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });
      const provider5 = await ProviderFactory.createWithHealthCheck();
      expect(provider5.name).toBe('aiceo-gateway');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Scenario 7: Different Provider Types as Primary/Fallback', () => {
    it('should support OpenAI as primary with Anthropic as fallback', async () => {
      process.env.AI_PROVIDER = 'openai-direct';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      // OpenAI healthy
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const provider = await ProviderFactory.createWithHealthCheck();
      expect(provider.name).toBe('openai-direct');
    });

    it('should fallback from OpenAI to Anthropic when OpenAI is down', async () => {
      process.env.AI_PROVIDER = 'openai-direct';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // OpenAI down
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('OpenAI down'));
      // Anthropic healthy
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const provider = await ProviderFactory.createWithHealthCheck();
      expect(provider.name).toBe('anthropic-direct');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Primary provider openai-direct unavailable')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Scenario 8: Health Check Edge Cases', () => {
    it('should treat 401 as healthy for Anthropic (service reachable)', async () => {
      process.env.AI_PROVIDER = 'anthropic-direct';
      process.env.ANTHROPIC_API_KEY = 'invalid-key';

      // Mock 401 response (bad API key, but service is up)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401
      });

      const provider = await ProviderFactory.createWithHealthCheck();
      expect(provider.name).toBe('anthropic-direct');
    });

    it('should treat 5xx errors as unhealthy', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // AICEO returns 503 (service unavailable)
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503
      });

      // Anthropic healthy
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const provider = await ProviderFactory.createWithHealthCheck();
      expect(provider.name).toBe('anthropic-direct');

      consoleWarnSpy.mockRestore();
    });

    it('should handle timeout as unhealthy', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Timeout on primary
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Request timeout')
      );

      // Fallback healthy
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true
      });

      const provider = await ProviderFactory.createWithHealthCheck();
      expect(provider.name).toBe('anthropic-direct');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Scenario 9: Configuration Validation', () => {
    it('should throw error for unknown provider type', () => {
      expect(() => ProviderFactory.create('unknown-provider')).toThrow(
        'Unknown AI provider: unknown-provider'
      );
    });

    it('should use default provider when AI_PROVIDER not set', async () => {
      // No AI_PROVIDER set - should default to aiceo-gateway
      process.env.AICEO_GATEWAY_API_KEY = 'test-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const provider = await ProviderFactory.createWithHealthCheck();
      expect(provider.name).toBe('aiceo-gateway');
    });
  });

  describe('Scenario 10: Request Metadata Preservation', () => {
    it('should preserve metadata when using AICEO Gateway', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AICEO_GATEWAY_API_KEY = 'test-key';

      // Health check
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const provider = await ProviderFactory.createWithHealthCheck();

      // Mock request with metadata
      const mockResponse = {
        success: true,
        response: {
          content: 'Analysis\n\nConfidence: 0.90',
          model: 'glm-4.7',
          usage: { inputTokens: 100, outputTokens: 200 }
        },
        metadata: {
          waitTime: 2345,
          queueDepth: 3,
          requestId: 'req-123',
          provider: 'glm'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await provider.submit(mockRequest);

      // Verify all metadata is preserved
      expect(result.metadata).toMatchObject({
        model: 'glm-4.7',
        usage: {
          inputTokens: 100,
          outputTokens: 200
        },
        waitTime: 2345,
        provider: 'glm'
      });
    });

    it('should preserve metadata when using fallback Anthropic', async () => {
      process.env.AI_PROVIDER = 'aiceo-gateway';
      process.env.AI_FALLBACK_PROVIDER = 'anthropic-direct';
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Primary down
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Down'));
      // Fallback healthy
      (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

      const provider = await ProviderFactory.createWithHealthCheck();

      // Mock Anthropic response
      const mockResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Analysis\n\nConfidence: 0.87' }],
        model: 'claude-sonnet-4-5',
        usage: { input_tokens: 150, output_tokens: 250 }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await provider.submit(mockRequest);

      expect(result.metadata).toMatchObject({
        model: 'claude-sonnet-4-5',
        usage: {
          inputTokens: 150,
          outputTokens: 250
        },
        provider: 'anthropic-direct'
      });

      consoleWarnSpy.mockRestore();
    });
  });
});
