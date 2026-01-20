import { AIProvider } from './providers/base.js';
import { PerspectiveAgent, PerspectiveAnalysis } from './agents/base.js';
import { SecurityAgent } from './agents/security.js';
import { ArchitectureAgent } from './agents/architecture.js';
import { SimplicityAgent } from './agents/simplicity.js';
import { FinancialAgent } from './agents/financial.js';
import { MarketingAgent } from './agents/marketing.js';
import { UXAgent } from './agents/ux.js';
import { GrowthAgent } from './agents/growth.js';
import { EmotionalAgent } from './agents/emotional.js';
import { AnalysisCache, globalAnalysisCache } from './cache.js';
import * as History from './history.js';

/**
 * Result of multi-perspective analysis combining all 8 agent perspectives
 */
export interface MultiPerspectiveResult {
  /** Individual analyses from each perspective */
  perspectives: PerspectiveAnalysis[];

  /** Executive summary combining all perspectives */
  summary: string;

  /** Overall confidence score (0.0 - 1.0) */
  overallConfidence: number;

  /** Execution time in milliseconds */
  executionTime: number;

  /** ISO timestamp of when analysis was performed */
  timestamp: string;
}

/**
 * Multi-Perspective Analysis Orchestrator
 *
 * Coordinates all 8 perspective agents to analyze a question or decision
 * from multiple viewpoints (Security, Architecture, Simplicity, Financial,
 * Marketing, UX, Growth, Emotional Intelligence).
 *
 * Key Features:
 * - Parallel execution of all 8 agents for speed
 * - Variance-based confidence scoring (lower confidence if high disagreement)
 * - Executive summary synthesizing all perspectives
 * - Full metadata tracking (execution time, timestamps)
 * - Intelligent caching (identical contexts return cached results)
 *
 * Example Usage:
 * ```typescript
 * const provider = await ProviderFactory.createWithHealthCheck();
 * const analysis = new MultiPerspectiveAnalysis(provider);
 * const result = await analysis.analyze('Should we migrate to microservices?');
 *
 * console.log(`Overall Confidence: ${result.overallConfidence}`);
 * console.log(`Execution Time: ${result.executionTime}ms`);
 * result.perspectives.forEach(p => {
 *   console.log(`${p.perspective}: ${p.confidence} - ${p.analysis}`);
 * });
 * ```
 */
export class MultiPerspectiveAnalysis {
  private agents: PerspectiveAgent[];
  private cache: AnalysisCache;
  private agentId: string;
  private persistHistory: boolean;

  /**
   * Creates a new MultiPerspectiveAnalysis orchestrator
   *
   * @param provider - AI provider to use for all 8 agents
   * @param cache - Optional cache instance (defaults to global cache)
   * @param agentId - Optional agent identifier for history persistence (defaults to 'default')
   * @param persistHistory - Whether to save analyses to disk (defaults to true)
   */
  constructor(
    provider: AIProvider,
    cache?: AnalysisCache,
    agentId: string = 'default',
    persistHistory: boolean = true
  ) {
    // Initialize all 8 perspective agents with the same provider
    this.agents = [
      new SecurityAgent(provider),
      new ArchitectureAgent(provider),
      new SimplicityAgent(provider),
      new FinancialAgent(provider),
      new MarketingAgent(provider),
      new UXAgent(provider),
      new GrowthAgent(provider),
      new EmotionalAgent(provider)
    ];

    // Use provided cache or default to global singleton
    this.cache = cache ?? globalAnalysisCache;

    // Store agent ID and history persistence setting
    this.agentId = agentId;
    this.persistHistory = persistHistory;
  }

  /**
   * Analyzes a question or decision from all 8 perspectives in parallel
   *
   * Uses intelligent caching to avoid redundant API calls for identical
   * contexts. Cache hits return results immediately, cache misses perform
   * full analysis and cache the result.
   *
   * @param context - The question, decision, or context to analyze
   * @returns MultiPerspectiveResult with all analyses and aggregated insights
   *
   * @example
   * ```typescript
   * const result = await analysis.analyze('Should we add Redis caching?');
   * ```
   */
  async analyze(context: string): Promise<MultiPerspectiveResult> {
    // Check cache first
    const cached = this.cache.get(context);
    if (cached) {
      return cached as MultiPerspectiveResult;
    }

    // Cache miss - perform full analysis
    const startTime = Date.now();

    // Run all 8 agents in parallel for speed
    // Using Promise.all ensures we wait for all to complete
    const analyses = await Promise.all(
      this.agents.map(agent => agent.analyze(context))
    );

    // Aggregate results
    const result: MultiPerspectiveResult = {
      perspectives: analyses,
      summary: this.synthesize(analyses),
      overallConfidence: this.calculateOverallConfidence(analyses),
      executionTime: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    // Cache the result for future requests
    this.cache.set(context, result);

    // Persist to disk if enabled
    if (this.persistHistory) {
      try {
        await History.saveAnalysis(this.agentId, result);
      } catch (error) {
        // Log error but don't fail the analysis
        console.error('Failed to persist analysis to disk:', error);
      }
    }

    return result;
  }

  /**
   * Synthesizes all perspective analyses into an executive summary
   *
   * Combines all 8 perspectives with their confidence scores into
   * a single readable document with clear separation between sections.
   *
   * @param analyses - Array of all perspective analyses
   * @returns Executive summary string
   */
  private synthesize(analyses: PerspectiveAnalysis[]): string {
    const sections = analyses.map(a =>
      `**${a.perspective}** (Confidence: ${a.confidence.toFixed(2)}):\n${a.analysis}`
    );

    return sections.join('\n\n---\n\n');
  }

  /**
   * Calculates overall confidence score with variance-based adjustment
   *
   * Strategy:
   * 1. Calculate mean confidence across all 8 perspectives
   * 2. Calculate variance (disagreement between perspectives)
   * 3. Lower confidence if high variance (agents disagree)
   * 4. Formula: avg - (stdDev * 0.5)
   *
   * This ensures that even if average confidence is high, disagreement
   * between perspectives reduces overall confidence (healthy skepticism).
   *
   * @param analyses - Array of all perspective analyses
   * @returns Overall confidence score (0.0 - 1.0)
   */
  private calculateOverallConfidence(analyses: PerspectiveAnalysis[]): number {
    // Calculate average confidence
    const avg = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;

    // Calculate variance (how much agents disagree)
    const variance = analyses.reduce((sum, a) =>
      sum + Math.pow(a.confidence - avg, 2), 0
    ) / analyses.length;

    // Calculate standard deviation
    const stdDev = Math.sqrt(variance);

    // Lower confidence if high variance (disagreement between agents)
    // The 0.5 multiplier balances skepticism with usefulness
    const adjustedConfidence = avg - (stdDev * 0.5);

    // Ensure result is in valid range [0, 1]
    return Math.max(0, Math.min(1, adjustedConfidence));
  }

  /**
   * Gets list of all agent names for reference
   *
   * @returns Array of agent names
   */
  getAgentNames(): string[] {
    return this.agents.map(agent => agent.name);
  }

  /**
   * Gets list of all perspective names for display
   *
   * @returns Array of perspective names
   */
  getPerspectiveNames(): string[] {
    return this.agents.map(agent => agent.perspective);
  }

  /**
   * Gets cache statistics for monitoring
   *
   * @returns Cache statistics including hits, misses, size, hit rate
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clears the analysis cache
   *
   * Useful for testing or when you want to force re-analysis
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Manually removes expired cache entries (garbage collection)
   *
   * @returns Number of entries removed
   */
  cleanupCache(): number {
    return this.cache.cleanup();
  }

  /**
   * Lists all saved analysis history
   *
   * @param filter - Optional filter criteria
   * @returns Array of stored analyses
   */
  async listHistory(filter?: History.HistoryFilter): Promise<History.StoredAnalysis[]> {
    return History.listAnalyses(this.agentId, filter);
  }

  /**
   * Loads a specific analysis from history by timestamp
   *
   * @param timestamp - ISO timestamp of the analysis
   * @returns The analysis result, or null if not found
   */
  async getHistoryItem(timestamp: string): Promise<MultiPerspectiveResult | null> {
    return History.loadAnalysis(this.agentId, timestamp);
  }

  /**
   * Gets statistics about analysis history
   *
   * @returns Statistics including total analyses, averages, storage size
   */
  async getHistoryStats(): Promise<History.HistoryStats> {
    return History.getHistoryStats(this.agentId);
  }

  /**
   * Deletes a specific analysis from history
   *
   * @param timestamp - ISO timestamp of the analysis to delete
   * @returns true if deleted, false if not found
   */
  async deleteHistoryItem(timestamp: string): Promise<boolean> {
    return History.deleteAnalysis(this.agentId, timestamp);
  }

  /**
   * Clears all analysis history
   *
   * @returns Number of analyses deleted
   */
  async clearHistory(): Promise<number> {
    return History.clearHistory(this.agentId);
  }

  /**
   * Deletes analyses older than a specified date
   *
   * @param beforeDate - ISO timestamp - delete analyses before this date
   * @returns Number of analyses deleted
   */
  async deleteHistoryBefore(beforeDate: string): Promise<number> {
    return History.deleteAnalysesBefore(this.agentId, beforeDate);
  }

  /**
   * Exports all analysis history to a single JSON file
   *
   * @param outputPath - Path to export file
   * @returns Number of analyses exported
   */
  async exportHistory(outputPath: string): Promise<number> {
    return History.exportHistory(this.agentId, outputPath);
  }
}
