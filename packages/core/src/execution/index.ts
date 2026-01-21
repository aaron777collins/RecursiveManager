/**
 * Execution Orchestrator
 *
 * Coordinates agent execution across different execution modes (continuous and reactive).
 * Manages the execution lifecycle, integrates with framework adapters, and handles
 * multi-perspective analysis for decision-making.
 */

import {
  type ExecutionResult,
  loadExecutionContext,
  AdapterRegistry,
} from '@recursivemanager/adapters';
import {
  getAgent,
  createAgentLogger,
  auditLog,
  AuditAction,
  DatabasePool,
  withTraceId,
  generateTraceId,
} from '@recursivemanager/common';
import { AgentLock, AgentLockError } from './AgentLock';
import { ExecutionPool, type PoolStatistics } from './ExecutionPool';
import type { MultiPerspectiveResult } from '../ai-analysis/multi-perspective.js';
import { recordExecution, recordAnalysis } from './metrics.js';

// Re-export for external use
export { AgentLock, AgentLockError };
export { ExecutionPool, type PoolStatistics };
export { DependencyGraph, type CycleDetectionResult } from './DependencyGraph.js';

/**
 * Reactive trigger that initiates reactive execution mode
 */
export interface ReactiveTrigger {
  /** Trigger type (message, webhook, manual) */
  type: 'message' | 'webhook' | 'manual';
  /** Message ID if triggered by a message */
  messageId?: string;
  /** Source channel if from external source */
  channel?: string;
  /** Additional context data */
  context?: Record<string, unknown>;
  /** Timestamp of trigger */
  timestamp: Date;
}

/**
 * Decision result from multi-perspective analysis
 */
export interface Decision {
  /** The recommended decision/action */
  recommendation: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Perspectives that were consulted */
  perspectives: string[];
  /** Individual perspective responses */
  perspectiveResults: Array<{
    perspective: string;
    response: string;
    confidence: number;
  }>;
  /** Synthesis explanation */
  rationale: string;
  /** Any warnings or concerns */
  warnings?: string[];
}

/**
 * Options for ExecutionOrchestrator
 */
export interface ExecutionOrchestratorOptions {
  /** Adapter registry for framework adapters */
  adapterRegistry: AdapterRegistry;
  /** Database pool for data access */
  database: DatabasePool;
  /** Maximum execution time in milliseconds (default: 5 minutes) */
  maxExecutionTime?: number;
  /** Maximum time for multi-perspective analysis in milliseconds (default: 2 minutes) */
  maxAnalysisTime?: number;
  /** Maximum concurrent executions across all agents (default: 10) */
  maxConcurrent?: number;
}

/**
 * ExecutionOrchestrator class
 *
 * Orchestrates agent execution across different modes and manages the execution lifecycle.
 */
export class ExecutionOrchestrator {
  private readonly adapterRegistry: AdapterRegistry;
  private readonly database: DatabasePool;
  private readonly maxExecutionTime: number;
  private readonly maxAnalysisTime: number;
  /** Agent lock manager for preventing concurrent executions */
  private readonly agentLock: AgentLock = new AgentLock();
  /** Execution pool for managing concurrent executions with worker pool pattern */
  private readonly executionPool: ExecutionPool;

  constructor(options: ExecutionOrchestratorOptions) {
    this.adapterRegistry = options.adapterRegistry;
    this.database = options.database;
    this.maxExecutionTime = options.maxExecutionTime ?? 5 * 60 * 1000; // 5 minutes
    this.maxAnalysisTime = options.maxAnalysisTime ?? 2 * 60 * 1000; // 2 minutes
    this.executionPool = new ExecutionPool({
      maxConcurrent: options.maxConcurrent ?? 10,
    });
  }

  /**
   * Execute an agent in continuous mode
   *
   * Picks the next task from the agent's active task list and executes it.
   * Uses ExecutionPool to manage global concurrency limits and queuing.
   *
   * @param agentId - Unique agent identifier
   * @returns Promise resolving to execution result
   * @throws ExecutionError if execution fails
   */
  async executeContinuous(agentId: string): Promise<ExecutionResult> {
    // Execute through the pool to enforce max concurrent limit
    return this.executionPool.execute(agentId, async () => {
      // Wrap execution in trace context for automatic correlation ID propagation
      return withTraceId(async () => {
        const logger = createAgentLogger(agentId);
        logger.info('Starting continuous execution', { agentId });

      // Try to acquire lock without waiting (fail fast for concurrent executions of same agent)
      const release = await this.agentLock.tryAcquire(agentId);
      if (!release) {
        throw new ExecutionError(
          `Agent ${agentId} is already executing. Concurrent executions are not allowed.`
        );
      }

      const startTime = Date.now();

      // Get database connection for agent queries and audit logging
      const dbConnection = this.database.getConnection();

      // Track whether agent exists for audit logging
      let agentExists = false;

      try {
        // Load agent record from database
        const agent = await getAgent(dbConnection.db, agentId);
        if (!agent) {
          throw new ExecutionError(`Agent not found: ${agentId}`);
        }
        agentExists = true;

        // Check agent status
        if (agent.status !== 'active') {
          throw new ExecutionError(`Agent ${agentId} is not active (status: ${agent.status})`);
        }

        // Load execution context (config, tasks, messages, workspace)
        const context = await loadExecutionContext(dbConnection.db, agentId, 'continuous', {});

        logger.info('Execution context loaded', {
          activeTasks: context.activeTasks.length,
          messages: context.messages.length,
          workspaceFiles: context.workspaceFiles.length,
        });

        // Get framework adapter for this agent (with fallback support)
        const adapterResult = await this.adapterRegistry.getHealthyAdapter(
          context.config.framework.primary,
          context.config.framework.fallback
        );

        if (!adapterResult) {
          throw new ExecutionError(
            `No healthy adapter available for framework: ${context.config.framework.primary}`
          );
        }

        const { adapter, usedFallback } = adapterResult;

        if (usedFallback) {
          logger.warn('Using fallback adapter', {
            primary: context.config.framework.primary,
            fallback: context.config.framework.fallback,
          });
        }

        // Execute agent with timeout
        const result: ExecutionResult = await this.executeWithTimeout(
          () => adapter.executeAgent(agentId, 'continuous', context),
          this.maxExecutionTime,
          'Continuous execution timeout'
        );

        // Calculate duration
        const duration = Date.now() - startTime;

        // Record Prometheus metrics
        recordExecution({
          mode: 'continuous',
          agentId,
          durationMs: duration,
          success: result.success,
          tasksCompleted: result.tasksCompleted,
          messagesProcessed: result.messagesProcessed,
        });

        // Log audit event
        auditLog(dbConnection.db, {
          agentId,
          action: AuditAction.EXECUTE_END,
          success: result.success,
          details: {
            mode: 'continuous',
            tasksCompleted: result.tasksCompleted,
            messagesProcessed: result.messagesProcessed,
            duration,
          },
        });

        logger.info('Continuous execution completed', {
          success: result.success,
          tasksCompleted: result.tasksCompleted,
          duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Record failed execution metrics
        recordExecution({
          mode: 'continuous',
          agentId,
          durationMs: duration,
          success: false,
          tasksCompleted: 0,
          messagesProcessed: 0,
        });

        logger.error('Continuous execution failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });

        // Log failure audit event (only if agent exists to avoid FK constraint errors)
        if (agentExists) {
          auditLog(dbConnection.db, {
            agentId,
            action: AuditAction.EXECUTE_END,
            success: false,
            details: {
              mode: 'continuous',
              error: error instanceof Error ? error.message : String(error),
              duration,
            },
          });
        }

        throw error;
      } finally {
        // Always release lock, even on error
        release();
      }
      }); // End withTraceId
    });
  }

  /**
   * Execute an agent in reactive mode
   *
   * Handles a specific trigger (message, webhook, etc.) and executes the agent
   * in response to it. Uses ExecutionPool to manage global concurrency limits and queuing.
   *
   * @param agentId - Unique agent identifier
   * @param trigger - Reactive trigger information
   * @returns Promise resolving to execution result
   * @throws ExecutionError if execution fails
   */
  async executeReactive(agentId: string, trigger: ReactiveTrigger): Promise<ExecutionResult> {
    // Execute through the pool to enforce max concurrent limit
    return this.executionPool.execute(agentId, async () => {
      // Wrap execution in trace context for automatic correlation ID propagation
      return withTraceId(async () => {
        const logger = createAgentLogger(agentId);
        logger.info('Starting reactive execution', {
          agentId,
          triggerType: trigger.type,
          messageId: trigger.messageId,
        });

      // Try to acquire lock without waiting (fail fast for concurrent executions of same agent)
      const release = await this.agentLock.tryAcquire(agentId);
      if (!release) {
        throw new ExecutionError(
          `Agent ${agentId} is already executing. Concurrent executions are not allowed.`
        );
      }

      const startTime = Date.now();

      // Get database connection for agent queries and audit logging
      const dbConnection = this.database.getConnection();

      // Track whether agent exists for audit logging
      let agentExists = false;

      try {
        // Load agent record from database
        const agent = await getAgent(dbConnection.db, agentId);
        if (!agent) {
          throw new ExecutionError(`Agent not found: ${agentId}`);
        }
        agentExists = true;

        // Check agent status
        if (agent.status !== 'active') {
          throw new ExecutionError(`Agent ${agentId} is not active (status: ${agent.status})`);
        }

        // Load execution context (config, tasks, messages, workspace)
        const context = await loadExecutionContext(dbConnection.db, agentId, 'reactive', {});

        logger.info('Execution context loaded', {
          activeTasks: context.activeTasks.length,
          messages: context.messages.length,
          workspaceFiles: context.workspaceFiles.length,
        });

        // Get framework adapter for this agent (with fallback support)
        const adapterResult = await this.adapterRegistry.getHealthyAdapter(
          context.config.framework.primary,
          context.config.framework.fallback
        );

        if (!adapterResult) {
          throw new ExecutionError(
            `No healthy adapter available for framework: ${context.config.framework.primary}`
          );
        }

        const { adapter, usedFallback } = adapterResult;

        if (usedFallback) {
          logger.warn('Using fallback adapter', {
            primary: context.config.framework.primary,
            fallback: context.config.framework.fallback,
          });
        }

        // Execute agent with timeout
        const result: ExecutionResult = await this.executeWithTimeout(
          () => adapter.executeAgent(agentId, 'reactive', context),
          this.maxExecutionTime,
          'Reactive execution timeout'
        );

        // Calculate duration
        const duration = Date.now() - startTime;

        // Record Prometheus metrics
        recordExecution({
          mode: 'reactive',
          agentId,
          durationMs: duration,
          success: result.success,
          tasksCompleted: result.tasksCompleted,
          messagesProcessed: result.messagesProcessed,
        });

        // Log audit event
        auditLog(dbConnection.db, {
          agentId,
          action: AuditAction.EXECUTE_END,
          success: result.success,
          details: {
            mode: 'reactive',
            trigger,
            tasksCompleted: result.tasksCompleted,
            messagesProcessed: result.messagesProcessed,
            duration,
            usedFallback,
            adapter: adapter.name,
          },
        });

        logger.info('Reactive execution completed', {
          success: result.success,
          tasksCompleted: result.tasksCompleted,
          messagesProcessed: result.messagesProcessed,
          duration,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        // Record failed execution metrics
        recordExecution({
          mode: 'reactive',
          agentId,
          durationMs: duration,
          success: false,
          tasksCompleted: 0,
          messagesProcessed: 0,
        });

        logger.error('Reactive execution failed', {
          error: error instanceof Error ? error.message : String(error),
          duration,
        });

        // Log failure audit event (only if agent exists to avoid FK constraint errors)
        if (agentExists) {
          auditLog(dbConnection.db, {
            agentId,
            action: AuditAction.EXECUTE_END,
            success: false,
            details: {
              mode: 'reactive',
              trigger,
              error: error instanceof Error ? error.message : String(error),
              duration,
            },
          });
        }

        throw error;
      } finally {
        // Always release lock, even on error
        release();
      }
      }); // End withTraceId
    });
  }

  /**
   * Run multi-perspective analysis for decision-making
   *
   * Spawns multiple sub-agents with different perspectives to analyze a question
   * and synthesizes their responses into a single decision.
   *
   * @param question - Question or decision to analyze
   * @param perspectives - List of perspective names to consult
   * @returns Promise resolving to synthesized decision
   * @throws AnalysisError if analysis fails or times out
   */
  async runMultiPerspectiveAnalysis(question: string, perspectives: string[]): Promise<Decision> {
    const logger = createAgentLogger('multi-perspective-analysis');
    logger.info('Starting multi-perspective analysis', {
      question: question.substring(0, 100),
      perspectives,
    });

    const startTime = Date.now();

    try {
      // Execute multi-perspective analysis with timeout
      const decision = await this.executeWithTimeout(
        async () => {
          // TODO: Implement actual sub-agent spawning for perspectives
          // For now, simulate perspective results for synthesis testing
          // Full sub-agent integration will be implemented in future phases

          // Placeholder: simulate perspective analysis results
          // If perspective string contains response data (for testing), extract it
          const perspectiveResults = perspectives.map((perspective) => {
            // Check if perspective contains embedded response/confidence (test format)
            // e.g., "Technical Perspective (approve with confidence 0.9)"
            // e.g., "Security (reject strongly with 0.95)"
            // e.g., "Technical (yes, proceed with 0.7)"
            const responseMatch = perspective.match(/\((.+)\)/);
            // Match confidence with or without "confidence" keyword
            const confidenceMatch = perspective.match(/(?:confidence\s+|with\s+)(0?\.\d+|1\.0)/i);

            let response: string;
            let confidence: number = 0.7;
            let perspectiveName: string = perspective;

            if (responseMatch && responseMatch[1]) {
              // Extract the response from parentheses
              response = responseMatch[1];
              // Extract perspective name (everything before the parentheses)
              const namePart = perspective.split('(')[0];
              perspectiveName = namePart ? namePart.trim() : perspective;

              // Extract confidence if specified
              if (confidenceMatch && confidenceMatch[1]) {
                confidence = parseFloat(confidenceMatch[1]);
              }
            } else {
              // No embedded data, use default placeholder response
              response = `Analysis from ${perspective} perspective: [Sub-agent integration pending]`;
              perspectiveName = perspective;
            }

            return {
              perspective: perspectiveName,
              response,
              confidence,
            };
          });

          // Synthesize decision from multiple perspective results (EC-8.1)
          const synthesizedDecision = this.synthesizeDecision(question, perspectiveResults);

          return synthesizedDecision;
        },
        this.maxAnalysisTime,
        'Multi-perspective analysis timeout'
      );

      const duration = Date.now() - startTime;

      logger.info('Multi-perspective analysis completed', {
        recommendation: decision.recommendation.substring(0, 100),
        confidence: decision.confidence,
        duration,
      });

      return decision;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Multi-perspective analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      // Return safe default decision on error (EC-8.2: Analysis timeout)
      return {
        recommendation: 'Unable to complete analysis - proceeding with caution',
        confidence: 0.3,
        perspectives,
        perspectiveResults: [],
        rationale: `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        warnings: ['Analysis failed or timed out. Using safe default decision.'],
      };
    }
  }

  /**
   * Synthesize decision from multiple perspective results (EC-8.1)
   *
   * Implements decision synthesis rules:
   * 1. Any strong rejection (confidence > 0.8) => reject
   * 2. Majority positive => approve
   * 3. Check for conditional recommendations
   * 4. No clear consensus => flag for review
   *
   * @param _question - The question being analyzed (reserved for future use)
   * @param perspectiveResults - Results from each perspective
   * @returns Synthesized decision
   */
  private synthesizeDecision(
    _question: string,
    perspectiveResults: Array<{
      perspective: string;
      response: string;
      confidence: number;
    }>
  ): Decision {
    const logger = createAgentLogger('decision-synthesis');

    // Extract recommendations and sentiments from perspective responses
    const analyzedResults = perspectiveResults.map((result) => {
      const response = result.response.toLowerCase();

      // Classify recommendation type based on keywords
      // Check for conditional first, as responses can have both conditional and approval keywords
      // (e.g., "approve if CI passes" should be conditional, not approve)
      let recommendation: 'approve' | 'reject' | 'conditional' | 'neutral' = 'neutral';

      if (
        response.includes('conditional') ||
        response.includes('with conditions') ||
        response.includes('if') ||
        response.includes('provided that')
      ) {
        recommendation = 'conditional';
      } else if (
        response.includes('reject') ||
        response.includes('deny') ||
        response.includes("don't") ||
        response.includes('no') ||
        response.includes('against')
      ) {
        recommendation = 'reject';
      } else if (
        response.includes('approve') ||
        response.includes('recommend') ||
        response.includes('proceed') ||
        response.includes('yes')
      ) {
        recommendation = 'approve';
      }

      return {
        ...result,
        recommendation,
      };
    });

    logger.info('Analyzed perspective recommendations', {
      approvals: analyzedResults.filter((r) => r.recommendation === 'approve').length,
      rejections: analyzedResults.filter((r) => r.recommendation === 'reject').length,
      conditionals: analyzedResults.filter((r) => r.recommendation === 'conditional').length,
      neutrals: analyzedResults.filter((r) => r.recommendation === 'neutral').length,
    });

    const warnings: string[] = [];

    // Rule 1: Any strong rejection (confidence > 0.8) => reject
    const strongRejection = analyzedResults.find(
      (r) => r.recommendation === 'reject' && r.confidence > 0.8
    );

    if (strongRejection) {
      logger.info('Strong rejection found', {
        perspective: strongRejection.perspective,
        confidence: strongRejection.confidence,
      });

      return {
        recommendation: 'reject',
        confidence: strongRejection.confidence,
        perspectives: perspectiveResults.map((r) => r.perspective),
        perspectiveResults,
        rationale: `Strong rejection from ${strongRejection.perspective} perspective (confidence: ${strongRejection.confidence}). ${strongRejection.response}`,
        warnings: [`High-confidence rejection from ${strongRejection.perspective} perspective`],
      };
    }

    // Rule 2: Majority approve => approve
    const approvals = analyzedResults.filter((r) => r.recommendation === 'approve');
    const rejections = analyzedResults.filter((r) => r.recommendation === 'reject');
    const conditionals = analyzedResults.filter((r) => r.recommendation === 'conditional');
    const neutrals = analyzedResults.filter((r) => r.recommendation === 'neutral');

    const totalResponses = analyzedResults.length;
    const majorityThreshold = totalResponses / 2;

    if (approvals.length > majorityThreshold) {
      // Calculate average confidence from approvals
      const avgConfidence = approvals.reduce((sum, r) => sum + r.confidence, 0) / approvals.length;

      logger.info('Majority approval', {
        approvals: approvals.length,
        total: totalResponses,
        confidence: avgConfidence,
      });

      if (rejections.length > 0) {
        warnings.push(
          `${rejections.length} perspective(s) recommended rejection: ${rejections.map((r) => r.perspective).join(', ')}`
        );
      }

      return {
        recommendation: 'approve',
        confidence: Math.min(avgConfidence, 0.95), // Cap at 0.95 to indicate uncertainty
        perspectives: perspectiveResults.map((r) => r.perspective),
        perspectiveResults,
        rationale: `Majority approval from ${approvals.length} of ${totalResponses} perspectives. Average confidence: ${avgConfidence.toFixed(2)}`,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }

    // Rule 3: Conditionals => approve with conditions
    if (conditionals.length > 0) {
      const avgConfidence =
        conditionals.reduce((sum, r) => sum + r.confidence, 0) / conditionals.length;

      logger.info('Conditional approval', {
        conditionals: conditionals.length,
        confidence: avgConfidence,
      });

      warnings.push(`conditional approval requires careful consideration of constraints`);

      return {
        recommendation: 'conditional',
        confidence: avgConfidence * 0.9, // Reduce confidence for conditional decisions
        perspectives: perspectiveResults.map((r) => r.perspective),
        perspectiveResults,
        rationale: `${conditionals.length} perspective(s) recommend conditional approval. Review conditions from: ${conditionals.map((r) => r.perspective).join(', ')}`,
        warnings,
      };
    }

    // Rule 4: No clear consensus or majority neutral => escalate/review
    if (
      neutrals.length > majorityThreshold ||
      (approvals.length === rejections.length && approvals.length > 0)
    ) {
      logger.info('No clear consensus', {
        approvals: approvals.length,
        rejections: rejections.length,
        neutrals: neutrals.length,
      });

      warnings.push('No clear consensus from perspectives');
      warnings.push('Human review recommended before proceeding');

      return {
        recommendation: 'review_required',
        confidence: 0.4, // Low confidence when no consensus
        perspectives: perspectiveResults.map((r) => r.perspective),
        perspectiveResults,
        rationale: `No clear consensus reached. Approvals: ${approvals.length}, Rejections: ${rejections.length}, Neutrals: ${neutrals.length}, Conditionals: ${conditionals.length}. Human review recommended.`,
        warnings,
      };
    }

    // Fallback: More rejections than approvals => reject
    if (rejections.length > approvals.length) {
      const avgConfidence =
        rejections.reduce((sum, r) => sum + r.confidence, 0) / rejections.length;

      logger.info('Majority rejection', {
        rejections: rejections.length,
        total: totalResponses,
        confidence: avgConfidence,
      });

      return {
        recommendation: 'reject',
        confidence: avgConfidence,
        perspectives: perspectiveResults.map((r) => r.perspective),
        perspectiveResults,
        rationale: `Majority rejection from ${rejections.length} of ${totalResponses} perspectives. Average confidence: ${avgConfidence.toFixed(2)}`,
      };
    }

    // Final fallback: uncertain decision
    logger.warn('Unable to determine clear decision', {
      results: analyzedResults,
    });

    return {
      recommendation: 'uncertain',
      confidence: 0.3,
      perspectives: perspectiveResults.map((r) => r.perspective),
      perspectiveResults,
      rationale:
        'Unable to synthesize a clear decision from perspectives. Manual review recommended.',
      warnings: ['Decision synthesis inconclusive', 'Manual review required'],
    };
  }

  /**
   * Execute a function with a timeout
   *
   * @param fn - Function to execute
   * @param timeoutMs - Timeout in milliseconds
   * @param timeoutMessage - Error message for timeout
   * @returns Promise resolving to function result
   * @throws ExecutionError if timeout is reached
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new ExecutionError(timeoutMessage)), timeoutMs)
      ),
    ]);
  }

  /**
   * Check if an agent is currently executing
   *
   * @param agentId - Agent identifier to check
   * @returns True if agent is currently executing
   */
  isExecuting(agentId: string): boolean {
    return this.agentLock.isLocked(agentId);
  }

  /**
   * Get list of currently executing agent IDs
   *
   * @returns Array of active agent IDs
   */
  getActiveExecutions(): string[] {
    return this.executionPool.getActiveExecutions();
  }

  /**
   * Get number of tasks waiting in the execution queue
   *
   * @returns Queue depth
   */
  getQueueDepth(): number {
    return this.executionPool.getQueueDepth();
  }

  /**
   * Get comprehensive pool statistics
   *
   * @returns Pool statistics including active count, queue depth, and performance metrics
   */
  getPoolStatistics(): PoolStatistics {
    return this.executionPool.getStatistics();
  }

  /**
   * Perform multi-perspective analysis on a decision or question
   *
   * Runs all 8 perspective agents (Security, Architecture, Simplicity, Financial,
   * Marketing, UX, Growth, Emotional) in parallel to provide comprehensive analysis.
   *
   * @param context - The decision or question to analyze
   * @returns Promise resolving to multi-perspective analysis result
   * @throws AnalysisError if analysis fails
   *
   * @example
   * ```typescript
   * const result = await orchestrator.analyzeDecision("Should we migrate to microservices?");
   * console.log(result.summary);
   * console.log(`Overall confidence: ${result.overallConfidence}`);
   * ```
   */
  async analyzeDecision(context: string): Promise<MultiPerspectiveResult> {
    const logger = createAgentLogger('multi-perspective-analysis');
    logger.info('Starting multi-perspective analysis', { contextLength: context.length });

    try {
      // Create provider with health check and automatic fallback
      const { ProviderFactory } = await import('../ai-analysis/providers/factory.js');
      const provider = await ProviderFactory.createWithHealthCheck();

      // Create multi-perspective analysis orchestrator
      const { MultiPerspectiveAnalysis } = await import('../ai-analysis/multi-perspective.js');
      const analysis = new MultiPerspectiveAnalysis(provider);

      // Run analysis with timeout protection
      const result = await this.executeWithTimeout(
        () => analysis.analyze(context),
        this.maxAnalysisTime,
        `Multi-perspective analysis timed out after ${this.maxAnalysisTime}ms`
      );

      logger.info('Multi-perspective analysis completed', {
        overallConfidence: result.overallConfidence,
        executionTime: result.executionTime,
        perspectiveCount: result.perspectives.length,
      });

      return result;
    } catch (error) {
      logger.error('Multi-perspective analysis failed', { error });
      throw new AnalysisError(
        `Failed to complete multi-perspective analysis: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Hire a new agent with optional multi-perspective analysis
   *
   * Optionally performs analysis before hiring to evaluate the decision.
   * If requiresAnalysis is true, runs multi-perspective analysis on the hiring decision.
   *
   * @param managerId - ID of the manager agent (null for root agents)
   * @param config - Agent configuration including identity, role, and capabilities
   * @param options - Additional options including requiresAnalysis flag
   * @returns Promise resolving to hire result and optional analysis
   * @throws ExecutionError if hiring fails
   *
   * @example
   * ```typescript
   * const result = await orchestrator.hireAgentWithAnalysis('manager-1', {
   *   identity: { id: 'agent-123', displayName: 'Security Expert' },
   *   role: { title: 'Security Expert', description: '...' },
   *   capabilities: { canHire: false, canFire: false }
   * }, {
   *   requiresAnalysis: true
   * });
   * console.log(result.analysis?.summary);
   * console.log(result.hireResult);
   * ```
   */
  async hireAgentWithAnalysis(
    managerId: string | null | undefined,
    config: any,
    options: { requiresAnalysis?: boolean; baseDir?: string } = {}
  ): Promise<{ hireResult: any; analysis?: MultiPerspectiveResult }> {
    const logger = createAgentLogger('hire-agent');
    let analysis: MultiPerspectiveResult | undefined;

    const agentId = config.identity?.id || 'unknown';
    const role = config.role?.title || config.role || 'unknown';

    // Perform analysis if required
    if (options.requiresAnalysis) {
      logger.info('Performing multi-perspective analysis for hire decision', {
        agentId,
        role,
        managerId: managerId ?? undefined,
      });

      const context = `Should I hire a new agent with role "${role}"?

Agent Details:
- Agent ID: ${agentId}
- Role: ${role}
- Manager: ${managerId || 'None (root agent)'}

Consider:
1. Whether this role is needed for the organization
2. The costs and benefits of adding this agent
3. Whether the team has capacity to onboard and manage this agent
4. Potential risks and concerns
5. Alternative solutions to the problem this agent would solve`;

      analysis = await this.analyzeDecision(context);

      logger.info('Hire analysis completed', {
        overallConfidence: analysis.overallConfidence,
        perspectiveCount: analysis.perspectives.length,
      });
    }

    // Proceed with hiring
    const { hireAgent } = await import('../lifecycle/hireAgent.js');
    const dbConnection = this.database.getConnection();

    try {
      const pathOptions = options.baseDir ? { baseDir: options.baseDir } : {};
      const hireResult = await hireAgent(
        dbConnection.db,
        managerId ?? null,
        config,
        pathOptions
      );

      logger.info('Agent hired successfully', { agentId, role });

      return { hireResult, analysis };
    } catch (error) {
      logger.error('Agent hire failed', { agentId, role, error });
      throw new ExecutionError(
        `Failed to hire agent ${agentId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Fire an agent with optional multi-perspective analysis
   *
   * Optionally performs analysis before firing to evaluate the decision.
   * If requiresAnalysis is true, runs multi-perspective analysis on the firing decision.
   *
   * @param agentId - Unique identifier of the agent to fire
   * @param strategy - Fire strategy: 'reassign', 'promote', or 'cascade'
   * @param options - Additional options including requiresAnalysis flag
   * @returns Promise resolving to fire result and optional analysis
   * @throws ExecutionError if firing fails
   *
   * @example
   * ```typescript
   * const result = await orchestrator.fireAgentWithAnalysis('agent-123', 'reassign', {
   *   requiresAnalysis: true
   * });
   * console.log(result.analysis?.summary);
   * console.log(result.fireResult);
   * ```
   */
  async fireAgentWithAnalysis(
    agentId: string,
    strategy: 'reassign' | 'promote' | 'cascade' = 'reassign',
    options: { requiresAnalysis?: boolean; baseDir?: string } = {}
  ): Promise<{ fireResult: any; analysis?: MultiPerspectiveResult }> {
    const logger = createAgentLogger('fire-agent');
    let analysis: MultiPerspectiveResult | undefined;

    // Load agent details for analysis
    const dbConnection = this.database.getConnection();
    const agent = await getAgent(dbConnection.db, agentId);

    if (!agent) {
      throw new ExecutionError(`Agent not found: ${agentId}`);
    }

    // Perform analysis if required
    if (options.requiresAnalysis) {
      logger.info('Performing multi-perspective analysis for fire decision', {
        agentId,
        strategy,
        agentRole: agent.role,
      });

      const context = `Should I fire agent "${agentId}" (${agent.role})?

Agent Details:
- Agent ID: ${agentId}
- Role: ${agent.role}
- Status: ${agent.status}
- Manager: ${agent.reporting_to || 'None (root agent)'}

Fire Strategy: ${strategy}
- reassign: Reassign subordinates to grandparent (fired agent's manager)
- promote: Promote subordinates to grandparent's level
- cascade: Recursively fire all subordinates

Consider:
1. Whether firing this agent is the right decision
2. The impact on team morale and productivity
3. How to handle orphaned subordinates and tasks
4. Potential risks and unintended consequences
5. Alternative solutions (pause, reassign, coaching)`;

      analysis = await this.analyzeDecision(context);

      logger.info('Fire analysis completed', {
        overallConfidence: analysis.overallConfidence,
        perspectiveCount: analysis.perspectives.length,
      });
    }

    // Proceed with firing
    const { fireAgent } = await import('../lifecycle/fireAgent.js');

    try {
      const pathOptions = options.baseDir ? { baseDir: options.baseDir } : {};
      const fireResult = await fireAgent(dbConnection.db, agentId, strategy, pathOptions);

      logger.info('Agent fired successfully', { agentId, strategy });

      return { fireResult, analysis };
    } catch (error) {
      logger.error('Agent fire failed', { agentId, strategy, error });
      throw new ExecutionError(
        `Failed to fire agent ${agentId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Pause an agent with optional multi-perspective analysis
   *
   * Optionally performs analysis before pausing to evaluate the decision.
   * If requiresAnalysis is true, runs multi-perspective analysis on the pause decision.
   *
   * @param agentId - Unique identifier of the agent to pause
   * @param options - Additional options including requiresAnalysis flag
   * @returns Promise resolving to pause result and optional analysis
   * @throws ExecutionError if pausing fails
   *
   * @example
   * ```typescript
   * const result = await orchestrator.pauseAgentWithAnalysis('agent-123', {
   *   requiresAnalysis: true
   * });
   * ```
   */
  async pauseAgentWithAnalysis(
    agentId: string,
    options: { requiresAnalysis?: boolean; performedBy?: string; baseDir?: string } = {}
  ): Promise<{ pauseResult: any; analysis?: MultiPerspectiveResult }> {
    const logger = createAgentLogger('pause-agent');
    let analysis: MultiPerspectiveResult | undefined;

    // Load agent details for analysis
    const dbConnection = this.database.getConnection();
    const agent = await getAgent(dbConnection.db, agentId);

    if (!agent) {
      throw new ExecutionError(`Agent not found: ${agentId}`);
    }

    // Perform analysis if required
    if (options.requiresAnalysis) {
      logger.info('Performing multi-perspective analysis for pause decision', {
        agentId,
        agentRole: agent.role,
      });

      const context = `Should I pause agent "${agentId}" (${agent.role})?

Agent Details:
- Agent ID: ${agentId}
- Role: ${agent.role}
- Status: ${agent.status}
- Manager: ${agent.reporting_to || 'None (root agent)'}

Consider:
1. Whether pausing is the right action vs. other alternatives
2. The impact on active tasks and subordinates
3. Duration of the pause
4. Team morale and productivity impact
5. Communication and transition planning`;

      analysis = await this.analyzeDecision(context);

      logger.info('Pause analysis completed', {
        overallConfidence: analysis.overallConfidence,
      });
    }

    // Proceed with pausing
    const { pauseAgent } = await import('../lifecycle/pauseAgent.js');

    try {
      const pauseOptions: { performedBy?: string; baseDir?: string } = {};
      if (options.performedBy) pauseOptions.performedBy = options.performedBy;
      if (options.baseDir) pauseOptions.baseDir = options.baseDir;

      const pauseResult = await pauseAgent(dbConnection.db, agentId, pauseOptions);

      logger.info('Agent paused successfully', { agentId });

      return { pauseResult, analysis };
    } catch (error) {
      logger.error('Agent pause failed', { agentId, error });
      throw new ExecutionError(
        `Failed to pause agent ${agentId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Resume an agent with optional multi-perspective analysis
   *
   * Optionally performs analysis before resuming to evaluate readiness.
   * If requiresAnalysis is true, runs multi-perspective analysis on the resume decision.
   *
   * @param agentId - Unique identifier of the agent to resume
   * @param options - Additional options including requiresAnalysis flag
   * @returns Promise resolving to resume result and optional analysis
   * @throws ExecutionError if resuming fails
   *
   * @example
   * ```typescript
   * const result = await orchestrator.resumeAgentWithAnalysis('agent-123', {
   *   requiresAnalysis: true
   * });
   * ```
   */
  async resumeAgentWithAnalysis(
    agentId: string,
    options: { requiresAnalysis?: boolean; performedBy?: string; baseDir?: string } = {}
  ): Promise<{ resumeResult: any; analysis?: MultiPerspectiveResult }> {
    const logger = createAgentLogger('resume-agent');
    let analysis: MultiPerspectiveResult | undefined;

    // Load agent details for analysis
    const dbConnection = this.database.getConnection();
    const agent = await getAgent(dbConnection.db, agentId);

    if (!agent) {
      throw new ExecutionError(`Agent not found: ${agentId}`);
    }

    // Perform analysis if required
    if (options.requiresAnalysis) {
      logger.info('Performing multi-perspective analysis for resume decision', {
        agentId,
        agentRole: agent.role,
      });

      const context = `Should I resume agent "${agentId}" (${agent.role})?

Agent Details:
- Agent ID: ${agentId}
- Role: ${agent.role}
- Status: ${agent.status}
- Manager: ${agent.reporting_to || 'None (root agent)'}

Consider:
1. Whether the issues that led to pausing are resolved
2. Agent readiness to resume work
3. Task backlog and prioritization
4. Resource availability
5. Communication and transition planning`;

      analysis = await this.analyzeDecision(context);

      logger.info('Resume analysis completed', {
        overallConfidence: analysis.overallConfidence,
      });
    }

    // Proceed with resuming
    const { resumeAgent } = await import('../lifecycle/resumeAgent.js');

    try {
      const resumeOptions: { performedBy?: string; baseDir?: string } = {};
      if (options.performedBy) resumeOptions.performedBy = options.performedBy;
      if (options.baseDir) resumeOptions.baseDir = options.baseDir;

      const resumeResult = await resumeAgent(dbConnection.db, agentId, resumeOptions);

      logger.info('Agent resumed successfully', { agentId });

      return { resumeResult, analysis };
    } catch (error) {
      logger.error('Agent resume failed', { agentId, error });
      throw new ExecutionError(
        `Failed to resume agent ${agentId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

/**
 * ExecutionError class
 *
 * Error thrown during execution operations
 */
export class ExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionError';
    Object.setPrototypeOf(this, ExecutionError.prototype);
  }
}

/**
 * AnalysisError class
 *
 * Error thrown during multi-perspective analysis
 */
export class AnalysisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalysisError';
    Object.setPrototypeOf(this, AnalysisError.prototype);
  }
}
