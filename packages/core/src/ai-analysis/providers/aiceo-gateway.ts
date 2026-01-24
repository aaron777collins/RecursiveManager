/**
 * AICEO Gateway Provider
 *
 * Routes AI analysis requests through AICEO's centralized LLM Gateway
 * for rate limiting, quota management, and provider abstraction.
 *
 * Available providers:
 * - openrouter: Routes through OpenRouter whitelist proxy (recommended)
 * - anthropic: Direct Anthropic API
 * - openai: Direct OpenAI API
 * - custom: Custom OpenAI-compatible endpoint
 */

import { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from './base.js';

/**
 * Message format for AI requests
 */
interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * AICEO Gateway API response structure
 */
interface AICEOGatewayResponse {
  success: boolean;
  response?: {
    content: string;
    model: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  };
  error?: string;
  metadata?: {
    waitTime: number;
    queueDepth: number;
    requestId: string;
    provider: string;
  };
}

/**
 * Provider that routes requests through AICEO Gateway
 *
 * Configuration via environment variables:
 * - AICEO_GATEWAY_URL: Gateway endpoint (default: http://localhost:4000/api/llm/submit)
 * - AICEO_GATEWAY_API_KEY: Shared secret for authentication
 * - AICEO_GATEWAY_PROVIDER: Which LLM provider AICEO should use (openrouter, anthropic, openai, custom)
 * - AICEO_GATEWAY_MODEL: Model to request (e.g., anthropic/claude-3.5-sonnet, openai/gpt-4-turbo)
 * - AICEO_GATEWAY_PRIORITY: Request priority (high, normal, low)
 * - AICEO_GATEWAY_CUSTOM_ENDPOINT: Custom endpoint URL (when provider=custom)
 * - AICEO_GATEWAY_CUSTOM_API_KEY: Custom endpoint API key (when provider=custom)
 */
export class AICEOGatewayProvider implements AIProvider {
  name = 'aiceo-gateway';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly provider: string;
  private readonly model: string;
  private readonly priority: 'high' | 'normal' | 'low';
  private readonly customEndpoint?: string;
  private readonly customApiKey?: string;

  constructor() {
    this.baseUrl = process.env.AICEO_GATEWAY_URL || 'http://localhost:4000/api/llm/submit';
    this.apiKey = process.env.AICEO_GATEWAY_API_KEY || '';
    this.provider = process.env.AICEO_GATEWAY_PROVIDER || 'openrouter';
    this.model = process.env.AICEO_GATEWAY_MODEL || 'anthropic/claude-3.5-sonnet';
    this.priority = (process.env.AICEO_GATEWAY_PRIORITY || 'high') as 'high' | 'normal' | 'low';
    this.customEndpoint = process.env.AICEO_GATEWAY_CUSTOM_ENDPOINT;
    this.customApiKey = process.env.AICEO_GATEWAY_CUSTOM_API_KEY;

    if (!this.apiKey) {
      console.warn('AICEO_GATEWAY_API_KEY not set - requests will fail');
    }

    // Validate custom provider configuration
    if (this.provider === 'custom') {
      if (!this.customEndpoint) {
        console.warn('AICEO_GATEWAY_PROVIDER=custom but AICEO_GATEWAY_CUSTOM_ENDPOINT not set');
      }
      if (!this.customApiKey) {
        console.warn('AICEO_GATEWAY_PROVIDER=custom but AICEO_GATEWAY_CUSTOM_API_KEY not set');
      }
    }
  }

  /**
   * Format messages for the custom provider
   *
   * The custom provider (z.ai) uses OpenAI-style format and doesn't support
   * the 'system' role directly. We prepend the system prompt to the user message.
   */
  private formatMessagesForCustom(messages: Message[]): Message[] {
    // Find system message and user message
    const systemMessage = messages.find(m => m.role === 'system');
    const userMessage = messages.find(m => m.role === 'user');

    if (!systemMessage || !userMessage) {
      // If no system message, return as-is
      return messages.filter(m => m.role !== 'system');
    }

    // Prepend system prompt to user message
    const combinedContent = `${systemMessage.content}\n\n${userMessage.content}`;

    return [
      { role: 'user', content: combinedContent }
    ];
  }

  /**
   * Submit an AI analysis request through AICEO Gateway
   */
  async submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      // Build request messages
      const messages: Message[] = [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.prompt }
      ];

      // Format messages for custom provider if needed
      const formattedMessages = this.provider === 'custom'
        ? this.formatMessagesForCustom(messages)
        : messages;

      // Build request body
      const requestBody: Record<string, any> = {
        provider: this.provider,
        model: this.model,
        priority: this.priority,
        source: 'recursivemanager',
        sourceId: `${request.agentType}-analysis`,
        messages: formattedMessages,
        temperature: request.temperature || 0.7,
        maxTokens: request.maxTokens || 4000
      };

      // Add custom provider fields if using custom provider
      if (this.provider === 'custom') {
        if (this.customEndpoint) {
          requestBody.customEndpoint = this.customEndpoint;
        }
        if (this.customApiKey) {
          requestBody.customApiKey = this.customApiKey;
        }
      }

      // CRITICAL: Set 30-minute timeout for GLM gateway to handle long queues
      // Without this, the request can hang forever if the gateway is unresponsive
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30 * 60 * 1000); // 30 minutes

      try {
        const response = await fetch(this.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`AICEO Gateway error (${response.status}): ${errorText}`);
        }

        const data = await response.json() as AICEOGatewayResponse;

        if (!data.success) {
          throw new Error(`AICEO Gateway error: ${data.error || 'Unknown error'}`);
        }

        if (!data.response) {
          throw new Error('AICEO Gateway returned success but no response data');
        }

        return {
          content: data.response.content,
          confidence: this.extractConfidence(data.response.content),
          reasoning: this.extractReasoning(data.response.content),
          metadata: {
            model: data.response.model || this.model,
            usage: data.response.usage,
            waitTime: data.metadata?.waitTime,
            provider: data.metadata?.provider || this.provider
          }
        };
      } catch (fetchError) {
        clearTimeout(timeoutId);

        // Check if this was a timeout error
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error('AICEO Gateway request timed out after 30 minutes (GLM queue was too long)');
        }

        throw fetchError;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AICEOGatewayProvider failed: ${error.message}`);
      }
      throw new Error('AICEOGatewayProvider failed: Unknown error');
    }
  }

  /**
   * Check if AICEO Gateway is healthy and available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to reach the status endpoint
      const statusUrl = this.baseUrl.replace('/submit', '/status');
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey
        }
      });

      return response.ok;
    } catch (error) {
      console.warn('AICEO Gateway health check failed:', error);
      return false;
    }
  }

  /**
   * Extract confidence score from AI response content
   *
   * Looks for "Confidence: X.X" pattern in the response
   * Returns 0.7 as default if not found
   */
  private extractConfidence(content: string): number {
    const match = content.match(/Confidence:\s*([0-9.]+)/i);
    if (match && match[1]) {
      const confidence = parseFloat(match[1]);
      // Ensure it's in valid range 0.0-1.0
      return Math.max(0.0, Math.min(1.0, confidence));
    }
    return 0.7; // Default confidence
  }

  /**
   * Extract reasoning from AI response content
   *
   * Looks for reasoning section in the response
   * Returns undefined if not found
   */
  private extractReasoning(content: string): string | undefined {
    // Look for common reasoning patterns
    const patterns = [
      /Reasoning:\s*(.+?)(?:\n\n|$)/is,
      /Rationale:\s*(.+?)(?:\n\n|$)/is,
      /Explanation:\s*(.+?)(?:\n\n|$)/is
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }
}
