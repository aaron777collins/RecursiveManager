/**
 * OpenAI Direct Provider
 *
 * Routes AI analysis requests directly to OpenAI's API
 * (bypasses AICEO Gateway - no rate limiting or quota management)
 */

import { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from './base.js';

/**
 * OpenAI API request structure
 */
interface OpenAIRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
}

/**
 * OpenAI API response structure
 */
interface OpenAIResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Provider that calls OpenAI API directly
 *
 * Configuration via environment variables:
 * - OPENAI_API_KEY: API key for OpenAI (required)
 * - OPENAI_API_URL: OpenAI API endpoint (default: https://api.openai.com/v1/chat/completions)
 * - OPENAI_MODEL: Model to use (default: gpt-4-turbo)
 */
export class OpenAIDirectProvider implements AIProvider {
  name = 'openai-direct';

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiUrl = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo';

    if (!this.apiKey) {
      console.warn('OPENAI_API_KEY not set - requests will fail');
    }
  }

  /**
   * Submit an AI analysis request directly to OpenAI API
   */
  async submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const messages: Array<{ role: string; content: string }> = [];

      // Add system prompt if provided
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }

      // Add user prompt
      messages.push({ role: 'user', content: request.prompt });

      const requestBody: OpenAIRequest = {
        model: this.model,
        messages,
        max_tokens: request.maxTokens || 4000,
        temperature: request.temperature || 0.7
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const data = await response.json() as OpenAIResponse;

      // Extract content from first choice
      const content = data.choices[0]?.message?.content || '';

      return {
        content,
        confidence: this.extractConfidence(content),
        reasoning: this.extractReasoning(content),
        metadata: {
          model: data.model,
          usage: {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens
          },
          provider: 'openai-direct'
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAIDirectProvider failed: ${error.message}`);
      }
      throw new Error('OpenAIDirectProvider failed: Unknown error');
    }
  }

  /**
   * Check if OpenAI API is healthy and available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Make a minimal request to verify API accessibility
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
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
      console.warn('OpenAI API health check failed:', error);
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
