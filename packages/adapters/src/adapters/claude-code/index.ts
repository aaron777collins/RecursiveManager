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

    // Note: The timeout is now handled by execa's built-in timeout option
    // in executeInternal(). Execa will automatically kill the process with
    // SIGTERM and then SIGKILL if it doesn't exit gracefully.
    // This provides more robust timeout handling than manual process tracking.

    // We keep this wrapper for potential future enhancements like:
    // - Multi-step execution with inter-step timeouts
    // - Custom cleanup logic before/after execution
    // - Progress tracking and partial result handling

    try {
      return await this.executeInternal(agentId, mode, context);
    } catch (error) {
      // Handle timeout errors from execa
      if (error && typeof error === 'object' && 'timedOut' in error && error.timedOut) {
        this.logDebug(`Agent ${agentId} execution timed out after ${this.timeout}ms`);
        return this.createErrorResult(
          startTime,
          `Execution timed out after ${this.timeout / 1000} seconds`,
          error instanceof Error ? error.stack : undefined
        );
      }

      // Handle other execution errors
      return this.createErrorResult(
        startTime,
        error instanceof Error ? error.message : 'Execution failed',
        error instanceof Error ? error.stack : undefined
      );
    }
  }

  /**
   * Internal execution implementation
   *
   * @private
   */
  private async executeInternal(
    agentId: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    try {
      // Build a simple prompt (will be enhanced in tasks 3.2.3-3.2.6)
      const prompt = this.buildSimplePrompt(agentId, mode, context);

      // Prepare CLI arguments
      const args = [
        '--print', // Non-interactive mode
        '--output-format',
        'json', // Machine-readable output
        '--no-session-persistence', // Don't save session to disk
      ];

      // Add working directory if different from workspace
      if (context.workingDir !== context.workspaceDir) {
        // Note: Claude Code doesn't have a --cwd flag, so we'll use cwd option in execa
        this.logDebug(`Setting working directory to: ${context.workingDir}`);
      }

      // Add the prompt as the final argument
      args.push(prompt);

      this.logDebug(`Executing Claude Code CLI with args:`, args);

      // Execute Claude Code CLI
      const result = await execa(this.cliPath, args, {
        cwd: context.workingDir,
        timeout: this.timeout,
        reject: false, // Don't throw on non-zero exit codes
        encoding: 'utf8', // Ensure stdout/stderr are strings, not Buffers
        env: {
          ...process.env,
          // Ensure no interactive prompts
          CI: '1',
        },
      });

      this.logDebug(`CLI execution completed with exit code: ${result.exitCode}`);

      // Parse the result
      return this.parseExecutionResult(result, startTime, mode, context);
    } catch (error) {
      this.logDebug('CLI execution failed:', error);
      throw error;
    }
  }

  /**
   * Build a simple prompt for the agent
   * This is a basic implementation - will be enhanced in tasks 3.2.3-3.2.6
   *
   * @private
   */
  private buildSimplePrompt(
    _agentId: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): string {
    const { config, activeTasks, messages } = context;

    let prompt = `You are ${config.identity.displayName}, an AI agent in the RecursiveManager system.\n\n`;
    prompt += `Your role: ${config.identity.role}\n\n`;

    if (mode === 'continuous' && activeTasks.length > 0) {
      prompt += `You have ${activeTasks.length} active task(s) to work on:\n\n`;
      activeTasks.forEach((task, index) => {
        prompt += `${index + 1}. [${task.priority}] ${task.title}\n`;
        prompt += `   Status: ${task.status}\n`;
        prompt += `   Description: ${task.description}\n\n`;
      });
      prompt += `Please work on the highest priority pending task. `;
      prompt += `Update task status as you progress, and mark as completed when done.\n`;
    } else if (mode === 'reactive' && messages.length > 0) {
      prompt += `You have ${messages.length} unread message(s):\n\n`;
      messages.forEach((msg, index) => {
        prompt += `${index + 1}. From: ${msg.from} (${msg.channel})\n`;
        prompt += `   ${msg.content}\n\n`;
      });
      prompt += `Please respond to these messages appropriately.\n`;
    } else {
      prompt += `No active tasks or messages. Please check your workspace and report your status.\n`;
    }

    return prompt;
  }

  /**
   * Parse execution result from Claude Code CLI output
   *
   * @private
   */
  private parseExecutionResult(
    cliResult: { exitCode: number; stdout: string; stderr: string },
    startTime: number,
    mode: ExecutionMode,
    context: ExecutionContext
  ): ExecutionResult {
    const duration = Date.now() - startTime;
    const { exitCode, stdout, stderr } = cliResult;

    // Check for execution failure
    if (exitCode !== 0) {
      return {
        success: false,
        duration,
        tasksCompleted: 0,
        messagesProcessed: 0,
        errors: [
          {
            message: `Claude Code CLI exited with code ${exitCode}`,
            stack: stderr,
            code: `EXIT_CODE_${exitCode}`,
          },
        ],
        metadata: {
          output: stdout,
        },
      };
    }

    // Try to parse JSON output
    interface ClaudeCodeOutput {
      text?: string;
      apiCallCount?: number;
      costUSD?: number;
      filesCreated?: string[];
      filesModified?: string[];
    }

    let parsedOutput: ClaudeCodeOutput;
    try {
      parsedOutput = JSON.parse(stdout) as ClaudeCodeOutput;
    } catch (error) {
      // If JSON parsing fails, treat output as plain text
      this.logDebug('Failed to parse JSON output, treating as plain text');
      parsedOutput = { text: stdout };
    }

    // Extract metadata from parsed output
    // Claude Code JSON output structure may vary, so we handle different formats
    const metadata: ExecutionResult['metadata'] = {
      output: typeof parsedOutput === 'string' ? parsedOutput : stdout,
      apiCallCount: parsedOutput.apiCallCount ?? 0,
      costUSD: parsedOutput.costUSD ?? 0,
      filesCreated: parsedOutput.filesCreated ?? [],
      filesModified: parsedOutput.filesModified ?? [],
    };

    // Estimate tasks completed and messages processed
    // This is a heuristic until we have better result parsing (Task 3.2.8)
    let tasksCompleted = 0;
    let messagesProcessed = 0;

    if (mode === 'continuous') {
      // Check if any tasks were mentioned as completed in output
      const completedMatches = stdout.match(/task.*completed/gi) || [];
      tasksCompleted = Math.min(completedMatches.length, context.activeTasks.length);
    } else if (mode === 'reactive') {
      // Assume all messages were processed if execution succeeded
      messagesProcessed = context.messages.length;
    }

    return {
      success: true,
      duration,
      tasksCompleted,
      messagesProcessed,
      errors: [],
      metadata,
    };
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
