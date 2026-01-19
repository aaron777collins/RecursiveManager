/**
 * Claude Code Framework Adapter
 *
 * Implements the FrameworkAdapter interface to execute agents using Claude Code CLI.
 * This adapter wraps the Claude Code command-line interface and manages execution,
 * timeouts, error handling, and result parsing.
 */

import { execa } from 'execa';
// ExecaChildProcess will be used in Task 3.2.2 for process management
import {
  FrameworkAdapter,
  ExecutionMode,
  ExecutionContext,
  ExecutionResult,
  Capability,
} from '../../types';

/**
 * Options for configuring the ClaudeCodeAdapter
 */
export interface ClaudeCodeAdapterOptions {
  /** Path to claude-code CLI executable (defaults to 'claude') */
  cliPath?: string;
  /** Timeout in milliseconds (defaults to 60 minutes) */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Maximum retries on transient errors */
  maxRetries?: number;
}

/**
 * Claude Code Framework Adapter
 *
 * Provides integration with Claude Code CLI for executing AI agents.
 * Handles continuous and reactive execution modes, timeout protection,
 * error handling, and result parsing.
 */
export class ClaudeCodeAdapter implements FrameworkAdapter {
  public readonly name = 'claude-code';
  public readonly version: string;

  private readonly cliPath: string;
  private readonly timeout: number;
  private readonly debug: boolean;
  // maxRetries reserved for future use in Task 3.2.10 (retry logic)
  // private readonly maxRetries: number;

  /**
   * Create a new Claude Code adapter
   * @param options Configuration options
   */
  constructor(options: ClaudeCodeAdapterOptions = {}) {
    this.cliPath = options.cliPath || 'claude';
    this.timeout = options.timeout || 60 * 60 * 1000; // 60 minutes default
    this.debug = options.debug || false;
    // maxRetries will be used in Task 3.2.10 (retry logic)
    // this.maxRetries = options.maxRetries || 3;
    this.version = this.detectVersion();
  }

  /**
   * Execute an agent with the given context
   *
   * @param agentId - Unique identifier for the agent
   * @param mode - Execution mode (continuous or reactive)
   * @param context - Execution context containing tasks, messages, etc.
   * @returns Execution result with success status, duration, and metadata
   */
  async executeAgent(
    agentId: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      this.logDebug(`Executing agent ${agentId} in ${mode} mode`);

      // Validate context
      this.validateContext(context);

      // Check health before execution
      const isHealthy = await this.healthCheck();
      if (!isHealthy) {
        return this.createErrorResult(
          startTime,
          'Framework unavailable: Claude Code CLI not accessible'
        );
      }

      // Execute with timeout protection
      const result = await this.executeWithTimeout(agentId, mode, context);

      this.logDebug(
        `Agent ${agentId} execution completed: ${result.success ? 'SUCCESS' : 'FAILURE'}`
      );

      return result;
    } catch (error) {
      this.logDebug(`Agent ${agentId} execution failed:`, error);

      return this.createErrorResult(
        startTime,
        error instanceof Error ? error.message : 'Unknown error occurred',
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  /**
   * Check if framework supports a specific feature
   *
   * @param feature - Feature name to check
   * @returns True if feature is supported
   */
  supportsFeature(feature: string): boolean {
    const supportedFeatures = new Set([
      'continuous-mode',
      'reactive-mode',
      'file-operations',
      'code-generation',
      'code-analysis',
      'bash-execution',
      'task-management',
      'multi-file-editing',
      'context-awareness',
      'error-recovery',
    ]);

    return supportedFeatures.has(feature);
  }

  /**
   * Get all capabilities provided by this framework
   *
   * @returns Array of capabilities
   */
  getCapabilities(): Capability[] {
    return [
      {
        name: 'continuous-mode',
        description: 'Execute agents continuously for active task work',
        available: true,
        version: this.version,
      },
      {
        name: 'reactive-mode',
        description: 'Execute agents reactively in response to messages',
        available: true,
        version: this.version,
      },
      {
        name: 'file-operations',
        description: 'Read, write, and edit files in workspace',
        available: true,
        version: this.version,
      },
      {
        name: 'code-generation',
        description: 'Generate new code files and modules',
        available: true,
        version: this.version,
      },
      {
        name: 'code-analysis',
        description: 'Analyze and understand existing codebases',
        available: true,
        version: this.version,
      },
      {
        name: 'bash-execution',
        description: 'Execute bash commands and scripts',
        available: true,
        version: this.version,
      },
      {
        name: 'task-management',
        description: 'Manage tasks and subtasks hierarchically',
        available: true,
        version: this.version,
      },
      {
        name: 'multi-file-editing',
        description: 'Edit multiple files in a single execution',
        available: true,
        version: this.version,
      },
      {
        name: 'context-awareness',
        description: 'Maintain context across execution sessions',
        available: true,
        version: this.version,
      },
      {
        name: 'error-recovery',
        description: 'Recover from errors and continue execution',
        available: true,
        version: this.version,
      },
    ];
  }

  /**
   * Check if framework is available and healthy
   *
   * @returns True if framework is healthy and accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to execute a simple version check
      const { stdout } = await execa(this.cliPath, ['--version'], {
        timeout: 5000, // 5 second timeout for health check
        reject: false,
      });

      // If we got any output, consider it healthy
      return stdout.length > 0;
    } catch (error) {
      this.logDebug('Health check failed:', error);
      return false;
    }
  }

  /**
   * Execute agent with timeout protection
   *
   * @private
   */
  private async executeWithTimeout(
    agentId: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    return new Promise<ExecutionResult>((resolve) => {
      let completed = false;
      // Process tracking and killing will be implemented in Task 3.2.2
      // when we actually spawn the Claude Code CLI process

      // Set up timeout
      const timer = setTimeout(() => {
        if (!completed) {
          completed = true;
          this.logDebug(`Agent ${agentId} execution timed out after ${this.timeout}ms`);

          // Process killing will be implemented in Task 3.2.2
          // Kill the process if it's still running
          // if (process && !process.killed) {
          //   process.kill('SIGTERM');
          //   setTimeout(() => {
          //     if (process && !process.killed) {
          //       process.kill('SIGKILL');
          //     }
          //   }, 5000); // Force kill after 5 seconds
          // }

          resolve(
            this.createErrorResult(
              startTime,
              `Execution timed out after ${this.timeout / 1000} seconds`
            )
          );
        }
      }, this.timeout);

      // Execute the agent
      this.executeInternal(agentId, mode, context)
        .then((result) => {
          if (!completed) {
            completed = true;
            clearTimeout(timer);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!completed) {
            completed = true;
            clearTimeout(timer);
            resolve(
              this.createErrorResult(
                startTime,
                error instanceof Error ? error.message : 'Execution failed',
                error instanceof Error ? error.stack : undefined
              )
            );
          }
        });
    });
  }

  /**
   * Internal execution implementation
   *
   * @private
   */
  private executeInternal(
    agentId: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // For now, return a placeholder result
    // This will be fully implemented in subsequent tasks:
    // - Task 3.2.2: executeAgent() implementation
    // - Task 3.2.3-6: Prompt template system
    // - Task 3.2.7: Execution context preparation
    // - Task 3.2.8: Result parsing

    // Placeholder implementation that returns success
    return Promise.resolve({
      success: true,
      duration: Date.now() - startTime,
      tasksCompleted: 0,
      messagesProcessed: mode === 'reactive' ? context.messages.length : 0,
      errors: [],
      metadata: {
        output: `Placeholder execution for agent ${agentId} in ${mode} mode`,
        apiCallCount: 0,
        costUSD: 0,
      },
    });
  }

  /**
   * Validate execution context
   *
   * @private
   */
  private validateContext(context: ExecutionContext): void {
    if (!context.agentId) {
      throw new Error('ExecutionContext must have agentId');
    }

    if (!context.config) {
      throw new Error('ExecutionContext must have config');
    }

    if (!context.workspaceDir) {
      throw new Error('ExecutionContext must have workspaceDir');
    }

    if (!context.workingDir) {
      throw new Error('ExecutionContext must have workingDir');
    }
  }

  /**
   * Create an error result
   *
   * @private
   */
  private createErrorResult(startTime: number, message: string, stack?: string): ExecutionResult {
    return {
      success: false,
      duration: Date.now() - startTime,
      tasksCompleted: 0,
      messagesProcessed: 0,
      errors: [
        {
          message,
          stack,
          code: 'EXECUTION_ERROR',
        },
      ],
    };
  }

  /**
   * Detect Claude Code version
   *
   * @private
   */
  private detectVersion(): string {
    try {
      // Try to get version synchronously
      // For now, return a default version
      // This will be properly implemented with actual CLI version detection
      return '1.0.0';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Log debug messages if debug mode is enabled
   *
   * @private
   */
  private logDebug(message: string, ...args: unknown[]): void {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log(`[ClaudeCodeAdapter] ${message}`, ...args);
    }
  }
}

/**
 * Default export for convenience
 */
export default ClaudeCodeAdapter;
