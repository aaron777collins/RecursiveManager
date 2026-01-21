/**
 * AICEO Gateway Provider
 *
 * Routes AI analysis requests through AICEO's centralized GLM Gateway
 * for rate limiting, quota management, and provider abstraction.
 */

import { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from './base.js';

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
 * - AICEO_GATEWAY_URL: Gateway endpoint (default: http://localhost:4000/api/glm/submit)
 * - AICEO_GATEWAY_API_KEY: Shared secret for authentication
 * - AICEO_GATEWAY_PROVIDER: Which LLM provider AICEO should use (glm, anthropic, openai)
 * - AICEO_GATEWAY_MODEL: Model to request (e.g., glm-4.7)
 * - AICEO_GATEWAY_PRIORITY: Request priority (high, normal, low)
 */
export class AICEOGatewayProvider implements AIProvider {
  name = 'aiceo-gateway';

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly provider: string;
  private readonly model: string;
  private readonly priority: 'high' | 'normal' | 'low';

  constructor() {
    this.baseUrl = process.env.AICEO_GATEWAY_URL || 'http://localhost:4000/api/glm/submit';
    this.apiKey = process.env.AICEO_GATEWAY_API_KEY || '';
    this.provider = process.env.AICEO_GATEWAY_PROVIDER || 'glm';
    this.model = process.env.AICEO_GATEWAY_MODEL || 'glm-4.7';
    this.priority = (process.env.AICEO_GATEWAY_PRIORITY || 'high') as 'high' | 'normal' | 'low';

    if (!this.apiKey) {
      console.warn('AICEO_GATEWAY_API_KEY not set - requests will fail');
    }
  }

  /**
   * Submit an AI analysis request through AICEO Gateway
   */
  async submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          provider: this.provider,
          model: this.model,
          priority: this.priority,
          source: 'recursivemanager',
          sourceId: `${request.agentType}-analysis`,
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.prompt }
          ],
          temperature: request.temperature || 0.7,
          maxTokens: request.maxTokens || 4000
        })
      });

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
