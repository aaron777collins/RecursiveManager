/**
 * Anthropic Direct Provider
 *
 * Routes AI analysis requests directly to Anthropic's API
 * (bypasses AICEO Gateway - no rate limiting or quota management)
 */

import { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from './base.js';

/**
 * Anthropic API request structure
 */
interface AnthropicRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens: number;
  temperature?: number;
  system?: string;
}

/**
 * Anthropic API response structure
 */
interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Provider that calls Anthropic API directly
 *
 * Configuration via environment variables:
 * - ANTHROPIC_API_KEY: API key for Anthropic (required)
 * - ANTHROPIC_API_URL: Anthropic API endpoint (default: https://api.anthropic.com/v1/messages)
 * - ANTHROPIC_MODEL: Model to use (default: claude-sonnet-4-5)
 */
export class AnthropicDirectProvider implements AIProvider {
  name = 'anthropic-direct';

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiUrl = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';

    if (!this.apiKey) {
      console.warn('ANTHROPIC_API_KEY not set - requests will fail');
    }
  }

  /**
   * Submit an AI analysis request directly to Anthropic API
   */
  async submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const requestBody: AnthropicRequest = {
        model: this.model,
        messages: [
          { role: 'user', content: request.prompt }
        ],
        max_tokens: request.maxTokens || 4000,
        temperature: request.temperature || 0.7
      };

      // Anthropic uses a separate 'system' field, not a message
      if (request.systemPrompt) {
        requestBody.system = request.systemPrompt;
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as AnthropicResponse;

      // Extract text content from response
      const content = data.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n');

      return {
        content,
        confidence: this.extractConfidence(content),
        reasoning: this.extractReasoning(content),
        metadata: {
          model: data.model,
          usage: {
            inputTokens: data.usage.input_tokens,
            outputTokens: data.usage.output_tokens
          },
          provider: 'anthropic-direct'
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`AnthropicDirectProvider failed: ${error.message}`);
      }
      throw new Error('AnthropicDirectProvider failed: Unknown error');
    }
  }

  /**
   * Check if Anthropic API is healthy and available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Make a minimal request to verify API accessibility
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      });

      // Accept both 200 OK and 401 Unauthorized (means API is reachable)
      // 401 just means invalid key, but service is up
      return response.ok || response.status === 401;
    } catch (error) {
      console.warn('Anthropic API health check failed:', error);
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
