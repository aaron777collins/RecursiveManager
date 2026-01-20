/**
 * Custom Provider
 *
 * Routes AI analysis requests to a custom endpoint
 * Supports different request/response formats (OpenAI, Anthropic, custom)
 */

import { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from './base.js';

/**
 * Provider that calls a custom endpoint with configurable format
 *
 * Configuration via environment variables:
 * - CUSTOM_PROVIDER_URL: Custom endpoint URL (required)
 * - CUSTOM_PROVIDER_API_KEY: API key for authentication (required)
 * - CUSTOM_PROVIDER_FORMAT: Request format - 'openai', 'anthropic', or 'custom' (default: 'openai')
 */
export class CustomProvider implements AIProvider {
  name = 'custom';

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly format: string;

  constructor() {
    this.apiUrl = process.env.CUSTOM_PROVIDER_URL || '';
    this.apiKey = process.env.CUSTOM_PROVIDER_API_KEY || '';
    this.format = process.env.CUSTOM_PROVIDER_FORMAT || 'openai';

    if (!this.apiUrl) {
      console.warn('CUSTOM_PROVIDER_URL not set - requests will fail');
    }
    if (!this.apiKey) {
      console.warn('CUSTOM_PROVIDER_API_KEY not set - requests will fail');
    }
  }

  /**
   * Submit an AI analysis request to custom endpoint
   */
  async submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const requestBody = this.formatRequest(request);
      const headers = this.buildHeaders();

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Custom API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      return this.parseResponse(data);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`CustomProvider failed: ${error.message}`);
      }
      throw new Error('CustomProvider failed: Unknown error');
    }
  }

  /**
   * Check if custom endpoint is healthy and available
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try a HEAD or OPTIONS request first
      const response = await fetch(this.apiUrl, {
        method: 'OPTIONS',
        headers: this.buildHeaders()
      });

      // Accept 200, 204, or 401 (means endpoint is reachable)
      return response.ok || response.status === 401 || response.status === 405;
    } catch (error) {
      console.warn('Custom API health check failed:', error);
      return false;
    }
  }

  /**
   * Build request headers based on format
   */
  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Format-specific authentication headers
    switch (this.format) {
      case 'openai':
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        break;
      case 'anthropic':
        headers['x-api-key'] = this.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        break;
      default:
        // For custom format, use Authorization header as default
        headers['Authorization'] = `Bearer ${this.apiKey}`;
        break;
    }

    return headers;
  }

  /**
   * Format request body based on configured format
   */
  private formatRequest(request: AIAnalysisRequest): any {
    switch (this.format) {
      case 'openai':
        return this.formatOpenAIRequest(request);
      case 'anthropic':
        return this.formatAnthropicRequest(request);
      default:
        return this.formatCustomRequest(request);
    }
  }

  /**
   * Format request in OpenAI style
   */
  private formatOpenAIRequest(request: AIAnalysisRequest): any {
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.prompt });

    return {
      model: process.env.CUSTOM_PROVIDER_MODEL || 'gpt-4',
      messages,
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature || 0.7
    };
  }

  /**
   * Format request in Anthropic style
   */
  private formatAnthropicRequest(request: AIAnalysisRequest): any {
    return {
      model: process.env.CUSTOM_PROVIDER_MODEL || 'claude-3-sonnet-20240229',
      system: request.systemPrompt,
      messages: [
        { role: 'user', content: request.prompt }
      ],
      max_tokens: request.maxTokens || 4000,
      temperature: request.temperature || 0.7
    };
  }

  /**
   * Format request in custom style (generic)
   */
  private formatCustomRequest(request: AIAnalysisRequest): any {
    return {
      prompt: request.prompt,
      systemPrompt: request.systemPrompt,
      agentType: request.agentType,
      context: request.context,
      maxTokens: request.maxTokens || 4000,
      temperature: request.temperature || 0.7
    };
  }

  /**
   * Parse response based on configured format
   */
  private parseResponse(data: any): AIAnalysisResponse {
    let content: string;
    let model: string;
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    switch (this.format) {
      case 'openai':
        content = data.choices?.[0]?.message?.content || '';
        model = data.model || 'unknown';
        usage = data.usage ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens
        } : undefined;
        break;

      case 'anthropic':
        // Anthropic returns array of content blocks
        content = data.content?.[0]?.text || '';
        model = data.model || 'unknown';
        usage = data.usage ? {
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens
        } : undefined;
        break;

      default:
        // Custom format - try to extract common fields
        content = data.content || data.response || data.text || '';
        model = data.model || 'custom';
        usage = data.usage ? {
          inputTokens: data.usage.inputTokens || data.usage.input_tokens || 0,
          outputTokens: data.usage.outputTokens || data.usage.output_tokens || 0
        } : undefined;
        break;
    }

    return {
      content,
      confidence: this.extractConfidence(content),
      reasoning: this.extractReasoning(content),
      metadata: {
        model,
        usage,
        provider: 'custom'
      }
    };
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
