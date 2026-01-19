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
} from '@recursive-manager/adapters';
import {
  getAgent,
  createAgentLogger,
  auditLog,
  AuditAction,
  DatabasePool,
} from '@recursive-manager/common';

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
  /** Track currently executing agents to prevent concurrent executions */
  private readonly executingAgents: Set<string> = new Set();

  constructor(options: ExecutionOrchestratorOptions) {
    this.adapterRegistry = options.adapterRegistry;
    this.database = options.database;
    this.maxExecutionTime = options.maxExecutionTime ?? 5 * 60 * 1000; // 5 minutes
    this.maxAnalysisTime = options.maxAnalysisTime ?? 2 * 60 * 1000; // 2 minutes
  }

  /**
   * Execute an agent in continuous mode
   *
   * Picks the next task from the agent's active task list and executes it.
   *
   * @param agentId - Unique agent identifier
   * @returns Promise resolving to execution result
   * @throws ExecutionError if execution fails
   */
  async executeContinuous(agentId: string): Promise<ExecutionResult> {
    const logger = createAgentLogger(agentId);
    logger.info('Starting continuous execution', { agentId });

    // Acquire lock to prevent concurrent execution
    this.acquireLock(agentId);

    const startTime = Date.now();

    try {
      // Load agent record from database
      const agent = await getAgent(agentId);
      if (!agent) {
        throw new ExecutionError(`Agent not found: ${agentId}`);
      }

      // Check agent status
      if (agent.status !== 'active') {
        throw new ExecutionError(
          `Agent is not active (status: ${agent.status})`
        );
      }

      // Load execution context (config, tasks, messages, workspace)
      const db = this.database.getConnection();
      const context = await loadExecutionContext(db, agentId, 'continuous', {});

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

      // Log audit event
      await auditLog({
        agentId,
        action: AuditAction.EXECUTE,
        details: {
          mode: 'continuous',
          success: result.success,
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
      logger.error('Continuous execution failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      // Log failure audit event
      await auditLog({
        agentId,
        action: AuditAction.EXECUTE,
        details: {
          mode: 'continuous',
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
      });

      throw error;
    } finally {
      // Always release lock, even on error
      this.releaseLock(agentId);
    }
  }

  /**
   * Execute an agent in reactive mode
   *
   * Handles a specific trigger (message, webhook, etc.) and executes the agent
   * in response to it.
   *
   * @param agentId - Unique agent identifier
   * @param trigger - Reactive trigger information
   * @returns Promise resolving to execution result
   * @throws ExecutionError if execution fails
   */
  async executeReactive(
    agentId: string,
    trigger: ReactiveTrigger
  ): Promise<ExecutionResult> {
    const logger = createAgentLogger(agentId);
    logger.info('Starting reactive execution', {
      agentId,
      triggerType: trigger.type,
      messageId: trigger.messageId,
    });

    // Acquire lock to prevent concurrent execution
    this.acquireLock(agentId);

    const startTime = Date.now();

    try {
      // Load agent record from database
      const agent = await getAgent(agentId);
      if (!agent) {
        throw new ExecutionError(`Agent not found: ${agentId}`);
      }

      // Check agent status
      if (agent.status !== 'active') {
        throw new ExecutionError(
          `Agent is not active (status: ${agent.status})`
        );
      }

      // Load execution context (config, tasks, messages, workspace)
      const db = this.database.getConnection();
      const context = await loadExecutionContext(db, agentId, 'reactive', {});

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

      // Log audit event
      await auditLog({
        agentId,
        action: AuditAction.EXECUTE,
        details: {
          mode: 'reactive',
          triggerType: trigger.type,
          messageId: trigger.messageId,
          success: result.success,
          tasksCompleted: result.tasksCompleted,
          messagesProcessed: result.messagesProcessed,
          duration,
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
      logger.error('Reactive execution failed', {
        error: error instanceof Error ? error.message : String(error),
        duration,
      });

      // Log failure audit event
      await auditLog({
        agentId,
        action: AuditAction.EXECUTE,
        details: {
          mode: 'reactive',
          triggerType: trigger.type,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          duration,
        },
      });

      throw error;
    } finally {
      // Always release lock, even on error
      this.releaseLock(agentId);
    }
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
  async runMultiPerspectiveAnalysis(
    question: string,
    perspectives: string[]
  ): Promise<Decision> {
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
          const perspectiveResults = perspectives.map((perspective) => ({
            perspective,
            response: `Analysis from ${perspective} perspective: [Sub-agent integration pending]`,
            confidence: 0.7,
          }));

          // Synthesize decision from multiple perspective results (EC-8.1)
          const synthesizedDecision = this.synthesizeDecision(
            question,
            perspectiveResults
          );

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
        rationale: `Analysis failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        warnings: [
          'Analysis failed or timed out. Using safe default decision.',
        ],
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
      let recommendation: 'approve' | 'reject' | 'conditional' | 'neutral' =
        'neutral';

      if (
        response.includes('approve') ||
        response.includes('recommend') ||
        response.includes('proceed') ||
        response.includes('yes')
      ) {
        recommendation = 'approve';
      } else if (
        response.includes('reject') ||
        response.includes('deny') ||
        response.includes("don't") ||
        response.includes('no') ||
        response.includes('against')
      ) {
        recommendation = 'reject';
      } else if (
        response.includes('conditional') ||
        response.includes('with conditions') ||
        response.includes('if') ||
        response.includes('provided that')
      ) {
        recommendation = 'conditional';
      }

      return {
        ...result,
        recommendation,
      };
    });

    logger.info('Analyzed perspective recommendations', {
      approvals: analyzedResults.filter((r) => r.recommendation === 'approve')
        .length,
      rejections: analyzedResults.filter((r) => r.recommendation === 'reject')
        .length,
      conditionals: analyzedResults.filter(
        (r) => r.recommendation === 'conditional'
      ).length,
      neutrals: analyzedResults.filter((r) => r.recommendation === 'neutral')
        .length,
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
        warnings: [
          `High-confidence rejection from ${strongRejection.perspective} perspective`,
        ],
      };
    }

    // Rule 2: Majority approve => approve
    const approvals = analyzedResults.filter(
      (r) => r.recommendation === 'approve'
    );
    const rejections = analyzedResults.filter(
      (r) => r.recommendation === 'reject'
    );
    const conditionals = analyzedResults.filter(
      (r) => r.recommendation === 'conditional'
    );
    const neutrals = analyzedResults.filter(
      (r) => r.recommendation === 'neutral'
    );

    const totalResponses = analyzedResults.length;
    const majorityThreshold = totalResponses / 2;

    if (approvals.length > majorityThreshold) {
      // Calculate average confidence from approvals
      const avgConfidence =
        approvals.reduce((sum, r) => sum + r.confidence, 0) / approvals.length;

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
        conditionals.reduce((sum, r) => sum + r.confidence, 0) /
        conditionals.length;

      logger.info('Conditional approval', {
        conditionals: conditionals.length,
        confidence: avgConfidence,
      });

      warnings.push(
        `Conditional approval requires careful consideration of constraints`
      );

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
        rejections.reduce((sum, r) => sum + r.confidence, 0) /
        rejections.length;

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
        setTimeout(
          () => reject(new ExecutionError(timeoutMessage)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Acquire execution lock for an agent
   *
   * Prevents concurrent executions of the same agent by checking if the agent
   * is already executing and adding it to the executing set if not.
   *
   * @param agentId - Agent identifier to lock
   * @throws ExecutionError if agent is already executing
   */
  private acquireLock(agentId: string): void {
    if (this.executingAgents.has(agentId)) {
      throw new ExecutionError(
        `Agent ${agentId} is already executing. Concurrent executions are not allowed.`
      );
    }
    this.executingAgents.add(agentId);
  }

  /**
   * Release execution lock for an agent
   *
   * Removes the agent from the executing set, allowing future executions.
   *
   * @param agentId - Agent identifier to unlock
   */
  private releaseLock(agentId: string): void {
    this.executingAgents.delete(agentId);
  }

  /**
   * Check if an agent is currently executing
   *
   * @param agentId - Agent identifier to check
   * @returns True if agent is currently executing
   */
  isExecuting(agentId: string): boolean {
    return this.executingAgents.has(agentId);
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
