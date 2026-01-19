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
          // TODO: Implement actual multi-perspective analysis
          // For now, return a simple decision structure
          // This will be fully implemented when Phase 3.3.5-3.3.6 are tackled

          // Placeholder implementation
          const perspectiveResults = perspectives.map((perspective) => ({
            perspective,
            response: `Analysis from ${perspective} perspective: [To be implemented]`,
            confidence: 0.7,
          }));

          const decision: Decision = {
            recommendation: 'Decision synthesis to be implemented in Phase 3.3.6',
            confidence: 0.5,
            perspectives,
            perspectiveResults,
            rationale:
              'Multi-perspective analysis placeholder - full implementation pending',
            warnings: [
              'This is a placeholder implementation. Full multi-perspective analysis will be implemented in Phase 3.3.5-3.3.6',
            ],
          };

          return decision;
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
