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
