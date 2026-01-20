import { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from '../providers/base.js';

/**
 * Result of a perspective-based analysis
 */
export interface PerspectiveAnalysis {
  /** Name of the perspective (e.g., "Security", "Architecture") */
  perspective: string;
  /** The analysis content from the AI agent */
  analysis: string;
  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
  /** Optional reasoning or rationale for the analysis */
  reasoning?: string;
  /** Optional metadata about the analysis (model used, token usage, etc.) */
  metadata?: any;
}

/**
 * Base class for all perspective-based agents in multi-perspective analysis.
 *
 * Each agent provides a unique perspective on business and technical decisions:
 * - Security: Identifies vulnerabilities and compliance issues
 * - Architecture: Evaluates scalability and maintainability
 * - Simplicity: Advocates for reducing complexity
 * - Financial: Analyzes costs, ROI, and resource utilization
 * - Marketing: Considers positioning and competitive advantage
 * - UX: Focuses on user experience and accessibility
 * - Growth: Evaluates adoption and retention potential
 * - Emotional: Assesses team morale and psychological impact
 *
 * Each agent must implement:
 * - getSystemPrompt(): Define the agent's role and expertise
 * - buildPrompt(context): Create the analysis prompt from context
 */
export abstract class PerspectiveAgent {
  /** Name of this agent (e.g., "security", "architecture") */
  abstract name: string;

  /** Human-readable perspective name (e.g., "Security", "Architecture") */
  abstract perspective: string;

  /**
   * Creates a new perspective agent
   * @param provider The AI provider to use for analysis
   */
  constructor(protected provider: AIProvider) {}

  /**
   * Analyzes the given context from this agent's perspective
   * @param context The context or question to analyze
   * @returns A perspective analysis with confidence score
   */
  async analyze(context: string): Promise<PerspectiveAnalysis> {
    const request: AIAnalysisRequest = {
      prompt: this.buildPrompt(context),
      systemPrompt: this.getSystemPrompt(),
      agentType: this.name,
      temperature: 0.7,
      maxTokens: 4000
    };

    const response: AIAnalysisResponse = await this.provider.submit(request);

    return {
      perspective: this.perspective,
      analysis: response.content,
      confidence: response.confidence,
      reasoning: response.reasoning,
      metadata: response.metadata
    };
  }

  /**
   * Get the system prompt that defines this agent's role and expertise.
   * This should describe the agent's perspective, focus areas, and output format.
   *
   * Example:
   * ```
   * You are a Security Expert analyzing business and technical decisions.
   * Your role: Identify security risks, vulnerabilities, and compliance issues.
   * Focus areas: Authentication, authorization, data protection, OWASP Top 10, regulatory compliance.
   * Output format: Provide analysis, then end with "Confidence: X.X" (0.0-1.0).
   * ```
   */
  abstract getSystemPrompt(): string;

  /**
   * Build the analysis prompt from the given context.
   * This should transform the context into a perspective-specific question.
   *
   * Example:
   * ```
   * Analyze the following from a security perspective:
   *
   * {context}
   *
   * Provide:
   * 1. Security risks and vulnerabilities
   * 2. Compliance concerns
   * 3. Recommendations
   * 4. Risk severity (low/medium/high/critical)
   * ```
   *
   * @param context The context or question to analyze
   * @returns The formatted prompt for the AI provider
   */
  abstract buildPrompt(context: string): string;
}
