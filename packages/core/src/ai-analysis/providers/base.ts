/**
 * Base types and interfaces for AI provider system
 *
 * This module defines the core abstractions for pluggable AI providers
 * that can be used for multi-perspective analysis and decision-making.
 */

/**
 * Request structure for AI analysis
 */
export interface AIAnalysisRequest {
  /** The user prompt/question to analyze */
  prompt: string;

  /** System prompt defining the AI's role and behavior */
  systemPrompt: string;

  /** Type of agent making the request (e.g., 'security', 'architecture') */
  agentType: string;

  /** Additional context for the analysis (optional) */
  context?: Record<string, any>;

  /** Maximum tokens to generate in response (optional) */
  maxTokens?: number;

  /** Temperature for response randomness 0.0-1.0 (optional) */
  temperature?: number;
}

/**
 * Response structure from AI analysis
 */
export interface AIAnalysisResponse {
  /** The AI-generated analysis content */
  content: string;

  /** Confidence score 0.0-1.0 */
  confidence: number;

  /** Reasoning/explanation for the analysis (optional) */
  reasoning?: string;

  /** Additional metadata about the response */
  metadata?: {
    /** Model used for generation */
    model: string;

    /** Token usage statistics */
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };

    /** Time spent waiting in queue (ms) */
    waitTime?: number;

    /** Provider that fulfilled the request */
    provider: string;
  };
}

/**
 * Configuration for an AI provider
 */
export interface ProviderConfig {
  /** Provider endpoint URL */
  endpoint: string;

  /** API key for authentication */
  apiKey: string;

  /** Model to use (e.g., 'claude-sonnet-4-5', 'gpt-4-turbo') */
  model?: string;

  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;

  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;

  /** Additional provider-specific configuration */
  [key: string]: any;
}

/**
 * Base error class for provider-related errors
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ProviderError';
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

/**
 * Error thrown when rate limit is exceeded
 */
export class RateLimitError extends ProviderError {
  constructor(
    message: string,
    provider: string,
    public readonly retryAfter?: number,
  ) {
    super(message, provider, 'RATE_LIMIT');
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Error thrown when request times out
 */
export class TimeoutError extends ProviderError {
  constructor(
    message: string,
    provider: string,
    public readonly timeoutMs: number,
  ) {
    super(message, provider, 'TIMEOUT');
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Core interface that all AI providers must implement
 *
 * Providers can route to different LLM APIs (GLM, Anthropic, OpenAI, etc.)
 * or to centralized gateways like AICEO Gateway for rate limiting.
 */
export interface AIProvider {
  /** Unique name of this provider */
  name: string;

  /**
   * Submit an AI analysis request
   * @param request - The analysis request
   * @returns Promise resolving to the analysis response
   * @throws Error if the request fails
   */
  submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;

  /**
   * Check if the provider is healthy and available
   * @returns Promise resolving to true if healthy, false otherwise
   */
  healthCheck(): Promise<boolean>;
}

/** Alias for backwards compatibility */
export type AIAnalysisProvider = AIProvider;
