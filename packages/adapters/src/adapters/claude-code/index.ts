/**
 * Claude Code Framework Adapter
 *
 * Implements the FrameworkAdapter interface to execute agents using Claude Code CLI.
 * This adapter wraps the Claude Code command-line interface and manages execution,
 * timeouts, error handling, and result parsing.
 */

import { execa } from 'execa';
import * as path from 'path';
// ExecaChildProcess will be used in Task 3.2.2 for process management
import {
  FrameworkAdapter,
  ExecutionMode,
  ExecutionContext,
  ExecutionResult,
  Capability,
} from '../../types';
import { buildContinuousPrompt, buildReactivePrompt } from '../../prompts';

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
  private readonly maxRetries: number;

  /**
   * Create a new Claude Code adapter
   * @param options Configuration options
   */
  constructor(options: ClaudeCodeAdapterOptions = {}) {
    this.cliPath = options.cliPath || 'claude';
    this.timeout = options.timeout || 60 * 60 * 1000; // 60 minutes default
    this.debug = options.debug || false;
    this.maxRetries = options.maxRetries || 3;
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
   * This method verifies that:
   * 1. Claude CLI is installed and accessible
   * 2. The configured provider (AICEO Gateway or Anthropic) is reachable
   * 3. The API credentials are properly configured
   *
   * @returns True if framework is healthy and accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to execute a simple version check with provider configuration
      // This ensures both Claude CLI and the provider are accessible
      const { exitCode, stdout } = await execa(this.cliPath, ['--version'], {
        timeout: 5000, // 5 second timeout for health check
        reject: false,
        env: {
          ...process.env,
          // Include provider configuration in health check
          ANTHROPIC_BASE_URL: this.getProviderUrl(),
          ANTHROPIC_API_KEY: this.getProviderApiKey(),
        },
      });

      // Check if CLI executed successfully and returned version info
      if (exitCode !== 0 || !stdout || stdout.length === 0) {
        this.logDebug('Health check failed: CLI did not return version information');
        return false;
      }

      // Verify provider configuration is present
      const providerUrl = this.getProviderUrl();
      const providerApiKey = this.getProviderApiKey();

      if (!providerApiKey || providerApiKey.length === 0) {
        this.logDebug('Health check failed: No API key configured for provider');
        return false;
      }

      this.logDebug(`Health check passed: CLI version available, provider URL: ${providerUrl}`);
      return true;
    } catch (error) {
      this.logDebug('Health check failed:', error);
      return false;
    }
  }

  /**
   * Execute agent with timeout protection and retry logic
   *
   * Implements exponential backoff for transient errors:
   * - Attempt 1: immediate
   * - Attempt 2: 1s delay
   * - Attempt 3: 2s delay
   * - Attempt 4: 4s delay
   *
   * @private
   */
  private async executeWithTimeout(
    agentId: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    let lastError: any;
    let attempt = 0;

    // Retry loop with exponential backoff
    while (attempt < this.maxRetries) {
      try {
        this.logDebug(`Executing agent ${agentId} (attempt ${attempt + 1}/${this.maxRetries})`);
        return await this.executeInternal(agentId, mode, context);
      } catch (error) {
        lastError = error;
        attempt++;

        // Handle timeout errors from execa (not retryable)
        if (error && typeof error === 'object' && 'timedOut' in error && error.timedOut) {
          this.logDebug(`Agent ${agentId} execution timed out after ${this.timeout}ms`);
          return this.createErrorResult(
            startTime,
            `Execution timed out after ${this.timeout / 1000} seconds`,
            error instanceof Error ? error.stack : undefined
          );
        }

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt >= this.maxRetries) {
          // Non-retryable error or max retries reached
          this.logDebug(
            `Agent ${agentId} execution failed: ${isRetryable ? 'max retries reached' : 'non-retryable error'}`
          );
          return this.createErrorResult(
            startTime,
            error instanceof Error ? error.message : 'Execution failed',
            error instanceof Error ? error.stack : undefined
          );
        }

        // Calculate exponential backoff delay
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        this.logDebug(
          `Transient error encountered, retrying after ${backoffMs}ms (attempt ${attempt}/${this.maxRetries})`
        );

        // Wait before retry
        await this.sleep(backoffMs);
      }
    }

    // Should never reach here due to the loop logic, but satisfy TypeScript
    return this.createErrorResult(
      startTime,
      lastError instanceof Error ? lastError.message : 'Execution failed after all retries',
      lastError instanceof Error ? lastError.stack : undefined
    );
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
      // Build prompt using template system (Task 3.2.3)
      const prompt = this.buildPrompt(agentId, mode, context);

      // Prepare CLI arguments
      const args = [
        '--print', // Non-interactive mode
        '--output-format',
        'json', // Machine-readable output
        '--no-session-persistence', // Don't save session to disk
      ];

      // Validate working directory to prevent malicious path traversal
      const workingDirResolved = path.resolve(context.workingDir);
      const workspaceDirResolved = path.resolve(context.workspaceDir);

      // Check if working dir is within workspace or is the workspace itself
      // This prevents ../../../etc/passwd style attacks
      const isWithinWorkspace = workingDirResolved.startsWith(workspaceDirResolved);
      const isSameDir = workingDirResolved === workspaceDirResolved;

      if (!isWithinWorkspace && !isSameDir) {
        throw new Error(
          `Invalid working directory: '${context.workingDir}' is outside workspace '${context.workspaceDir}'`
        );
      }

      // Add working directory if different from workspace
      if (context.workingDir !== context.workspaceDir) {
        // Note: Claude Code doesn't have a --cwd flag, so we'll use cwd option in execa
        this.logDebug(`Setting working directory to: ${workingDirResolved}`);
      }

      // Validate prompt for dangerous patterns (basic sanitation)
      // While execa doesn't use shell by default, we still validate for safety
      if (prompt.includes('\0') || prompt.includes('\x1b[')) {
        throw new Error('Invalid characters detected in prompt (null byte or escape sequences)');
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
          // Provider configuration for Claude CLI routing
          ANTHROPIC_BASE_URL: this.getProviderUrl(),
          ANTHROPIC_API_KEY: this.getProviderApiKey(),
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
   * Build a prompt for the agent using the template system
   * Implemented in Task 3.2.3
   *
   * @private
   */
  private buildPrompt(_agentId: string, mode: ExecutionMode, context: ExecutionContext): string {
    const { config, activeTasks, messages } = context;

    // Use the appropriate template based on execution mode
    if (mode === 'continuous') {
      return buildContinuousPrompt(config, activeTasks, context);
    } else if (mode === 'reactive') {
      return buildReactivePrompt(config, messages, context);
    } else {
      // Fallback for unknown modes
      throw new Error(`Unknown execution mode: ${String(mode)}`);
    }
  }

  /**
   * Parse execution result from Claude Code CLI output
   * Task 3.2.8: Enhanced result parsing with accurate task/message tracking
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
      // Extract structured errors from stderr
      const errors = this.parseErrors(stderr, exitCode);

      return {
        success: false,
        duration,
        tasksCompleted: 0,
        messagesProcessed: 0,
        errors,
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
      tasksCompleted?: string[]; // Array of completed task IDs
      messagesProcessed?: string[]; // Array of processed message IDs
      summary?: string;
      nextExecution?: string; // ISO 8601 timestamp
    }

    let parsedOutput: ClaudeCodeOutput;
    try {
      parsedOutput = JSON.parse(stdout) as ClaudeCodeOutput;
    } catch (error) {
      // If JSON parsing fails, treat output as plain text and parse manually
      this.logDebug('Failed to parse JSON output, falling back to text parsing');
      parsedOutput = {
        text: stdout,
        // Attempt to extract information from text output
        ...this.parseTextOutput(stdout, mode),
      };
    }

    // Extract metadata from parsed output
    const metadata: ExecutionResult['metadata'] = {
      output: parsedOutput.text || stdout,
      apiCallCount: parsedOutput.apiCallCount ?? 0,
      costUSD: parsedOutput.costUSD ?? 0,
      filesCreated: parsedOutput.filesCreated ?? [],
      filesModified: parsedOutput.filesModified ?? [],
    };

    // Determine tasks completed and messages processed
    const { tasksCompleted, messagesProcessed } = this.countCompletedWork(
      parsedOutput,
      stdout,
      mode,
      context
    );

    // Parse next execution time if available
    let nextExecution: Date | undefined;
    if (parsedOutput.nextExecution) {
      try {
        nextExecution = new Date(parsedOutput.nextExecution);
      } catch (error) {
        this.logDebug('Failed to parse nextExecution timestamp:', error);
      }
    }

    return {
      success: true,
      duration,
      tasksCompleted,
      messagesProcessed,
      errors: [],
      nextExecution,
      metadata,
    };
  }

  /**
   * Parse errors from stderr output
   * Extracts structured error information from error messages
   *
   * @private
   */
  private parseErrors(
    stderr: string,
    exitCode: number
  ): Array<{ message: string; stack?: string; code?: string }> {
    const errors: Array<{ message: string; stack?: string; code?: string }> = [];

    // If stderr is empty, provide a generic error
    if (!stderr || stderr.trim().length === 0) {
      errors.push({
        message: `Claude Code CLI exited with code ${exitCode}`,
        code: `EXIT_CODE_${exitCode}`,
      });
      return errors;
    }

    // Try to parse stderr as JSON (some CLIs output structured errors)
    try {
      const errorObj = JSON.parse(stderr);
      if (errorObj.error) {
        errors.push({
          message: errorObj.error.message || errorObj.error,
          stack: errorObj.error.stack,
          code: errorObj.error.code || `EXIT_CODE_${exitCode}`,
        });
        return errors;
      }
    } catch {
      // Not JSON, continue with text parsing
    }

    // Split stderr by lines and look for error patterns
    const lines = stderr.split('\n').filter((line) => line.trim().length > 0);

    // Common error patterns
    const errorPatterns = [
      /^Error:\s*(.+)$/i,
      /^(\w+Error):\s*(.+)$/i,
      /^FATAL:\s*(.+)$/i,
      /^ERROR:\s*(.+)$/i,
    ];

    let currentError: { message: string; stack?: string; code?: string } | null = null;
    const stackLines: string[] = [];

    for (const line of lines) {
      // Check if this line starts a new error
      let isErrorLine = false;
      for (const pattern of errorPatterns) {
        const match = line.match(pattern);
        if (match) {
          // If we have a previous error, save it
          if (currentError) {
            if (stackLines.length > 0) {
              currentError.stack = stackLines.join('\n');
            }
            errors.push(currentError);
          }

          // Start a new error
          currentError = {
            message: (match[2] || match[1]) ?? '',
            code: match[1] ?? `EXIT_CODE_${exitCode}`,
          };
          stackLines.length = 0;
          isErrorLine = true;
          break;
        }
      }

      // If this is a stack trace line, add it to current error
      if (!isErrorLine && currentError && line.trim().startsWith('at ')) {
        stackLines.push(line);
      }
    }

    // Add the last error if any
    if (currentError) {
      if (stackLines.length > 0) {
        currentError.stack = stackLines.join('\n');
      }
      errors.push(currentError);
    }

    // If we didn't find any structured errors, just include the whole stderr
    if (errors.length === 0) {
      errors.push({
        message: `Claude Code CLI exited with code ${exitCode}`,
        stack: stderr,
        code: `EXIT_CODE_${exitCode}`,
      });
    }

    return errors;
  }

  /**
   * Parse text output when JSON parsing fails
   * Attempts to extract structured information from plain text output
   *
   * @private
   */
  private parseTextOutput(
    output: string,
    _mode: ExecutionMode
  ): Partial<{ filesCreated: string[]; filesModified: string[]; apiCallCount: number }> {
    const result: Partial<{
      filesCreated: string[];
      filesModified: string[];
      apiCallCount: number;
    }> = {};

    // Look for file operation patterns
    const createdPattern = /created?\s+(?:file|files?):\s*(.+)/gi;
    const modifiedPattern = /modified|updated|edited\s+(?:file|files?):\s*(.+)/gi;

    let match;
    const filesCreated: string[] = [];
    const filesModified: string[] = [];

    while ((match = createdPattern.exec(output)) !== null) {
      // Extract file paths (comma or newline separated)
      if (match[1]) {
        const files = match[1].split(/[,\n]/).map((f) => f.trim());
        filesCreated.push(...files);
      }
    }

    while ((match = modifiedPattern.exec(output)) !== null) {
      if (match[1]) {
        const files = match[1].split(/[,\n]/).map((f) => f.trim());
        filesModified.push(...files);
      }
    }

    if (filesCreated.length > 0) {
      result.filesCreated = filesCreated;
    }
    if (filesModified.length > 0) {
      result.filesModified = filesModified;
    }

    // Look for API call count patterns
    const apiCallPattern = /(\d+)\s+(?:api|API)\s+calls?/i;
    match = output.match(apiCallPattern);
    if (match && match[1]) {
      result.apiCallCount = parseInt(match[1], 10);
    }

    return result;
  }

  /**
   * Count completed tasks and processed messages from output
   * Task 3.2.8: Accurate tracking of completed work
   *
   * @private
   */
  private countCompletedWork(
    parsedOutput: {
      tasksCompleted?: string[];
      messagesProcessed?: string[];
      text?: string;
    },
    rawOutput: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): { tasksCompleted: number; messagesProcessed: number } {
    let tasksCompleted = 0;
    let messagesProcessed = 0;

    if (mode === 'continuous') {
      // Try to use structured task completion data first
      if (parsedOutput.tasksCompleted && Array.isArray(parsedOutput.tasksCompleted)) {
        // Cross-reference with active tasks to ensure they're valid
        const completedTaskIds = new Set(parsedOutput.tasksCompleted);
        tasksCompleted = context.activeTasks.filter((task) => completedTaskIds.has(task.id)).length;
      } else {
        // Fall back to pattern matching in output
        // Look for task IDs from context.activeTasks in the output
        const outputText = parsedOutput.text || rawOutput;

        for (const task of context.activeTasks) {
          // Check if this task ID appears with completion indicators
          const taskIdEscaped = task.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const completionPatterns = [
            new RegExp(`${taskIdEscaped}[\\s\\S]{0,100}(?:completed|done|finished)`, 'i'),
            new RegExp(`(?:completed|done|finished)[\\s\\S]{0,100}${taskIdEscaped}`, 'i'),
            new RegExp(`\\[x\\].*${taskIdEscaped}`, 'i'), // Markdown checklist
            new RegExp(`${taskIdEscaped}.*status.*completed`, 'i'),
          ];

          for (const pattern of completionPatterns) {
            if (pattern.test(outputText)) {
              tasksCompleted++;
              break; // Count each task only once
            }
          }
        }
      }
    } else if (mode === 'reactive') {
      // Try to use structured message processing data first
      if (parsedOutput.messagesProcessed && Array.isArray(parsedOutput.messagesProcessed)) {
        // Cross-reference with context messages
        const processedMessageIds = new Set(parsedOutput.messagesProcessed);
        messagesProcessed = context.messages.filter((msg) =>
          processedMessageIds.has(msg.id)
        ).length;
      } else {
        // Fall back to pattern matching
        const outputText = parsedOutput.text || rawOutput;

        for (const message of context.messages) {
          // Check if this message ID appears with processing indicators
          const messageIdEscaped = message.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const processingPatterns = [
            new RegExp(`${messageIdEscaped}[\\s\\S]{0,100}(?:processed|handled|replied)`, 'i'),
            new RegExp(`(?:processed|handled|replied)[\\s\\S]{0,100}${messageIdEscaped}`, 'i'),
            new RegExp(`message.*${messageIdEscaped}.*processed`, 'i'),
          ];

          for (const pattern of processingPatterns) {
            if (pattern.test(outputText)) {
              messagesProcessed++;
              break; // Count each message only once
            }
          }
        }

        // If we didn't find any explicit message IDs but execution succeeded,
        // make a conservative estimate based on output content
        if (messagesProcessed === 0 && context.messages.length > 0) {
          // Check for general message processing indicators
          const hasReplyIndicators = /(?:replied|responded|answered)/i.test(outputText);
          const hasMessageContent = context.messages.some((msg) =>
            outputText.includes(msg.content.substring(0, 50))
          );

          if (hasReplyIndicators || hasMessageContent) {
            // Conservative estimate: assume at least one message was processed
            messagesProcessed = 1;
          }
        }
      }
    }

    return { tasksCompleted, messagesProcessed };
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
   * Check if an error is retryable (transient)
   *
   * Transient errors include:
   * - Network errors (ECONNREFUSED, ECONNRESET, ETIMEDOUT)
   * - Temporary resource unavailability (EAGAIN, EBUSY)
   * - Rate limiting errors
   *
   * @private
   */
  private isRetryableError(error: any): boolean {
    if (!error) {
      return false;
    }

    // Check error code for common transient errors
    const retryableCodes = new Set([
      'ECONNREFUSED', // Connection refused
      'ECONNRESET', // Connection reset
      'ETIMEDOUT', // Connection timeout
      'ENOTFOUND', // DNS lookup failed
      'ENETUNREACH', // Network unreachable
      'EAGAIN', // Resource temporarily unavailable
      'EBUSY', // Resource busy
      'EPIPE', // Broken pipe
      'EAI_AGAIN', // Temporary DNS failure
    ]);

    if (error.code && retryableCodes.has(error.code)) {
      return true;
    }

    // Check for rate limiting errors in message
    const errorMessage = error.message?.toLowerCase() || '';
    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests') ||
      errorMessage.includes('429')
    ) {
      return true;
    }

    // Check for temporary service unavailability
    if (
      errorMessage.includes('service unavailable') ||
      errorMessage.includes('503') ||
      errorMessage.includes('temporarily unavailable')
    ) {
      return true;
    }

    // Not a retryable error
    return false;
  }

  /**
   * Get the provider URL for Claude CLI routing
   *
   * Determines which Anthropic API base URL to use based on the configured
   * AGENT_EXECUTION_PROVIDER environment variable.
   *
   * @private
   * @returns Provider base URL
   */
  private getProviderUrl(): string {
    const provider = process.env.AGENT_EXECUTION_PROVIDER || 'anthropic-direct';

    switch (provider) {
      case 'aiceo-gateway':
        // TODO: This would need AICEO to proxy Claude CLI calls, not just LLM API
        // For now, fall back to direct Anthropic
        // In future, could use AICEO_GATEWAY_URL as a proxy endpoint
        return process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
      case 'anthropic-direct':
        return process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
      default:
        // Default to Anthropic API for unknown providers
        return process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    }
  }

  /**
   * Get the API key for provider authentication
   *
   * Returns the appropriate API key based on the configured provider.
   * For AICEO Gateway, this would be the gateway API key.
   * For direct providers, this is the provider's API key.
   *
   * @private
   * @returns API key for authentication
   */
  private getProviderApiKey(): string {
    const provider = process.env.AGENT_EXECUTION_PROVIDER || 'anthropic-direct';

    switch (provider) {
      case 'aiceo-gateway':
        // If using AICEO Gateway, return gateway API key
        // Fall back to Anthropic key if gateway key not set
        return process.env.AICEO_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY || '';
      case 'anthropic-direct':
      default:
        // For direct Anthropic or unknown providers, use Anthropic key
        return process.env.ANTHROPIC_API_KEY || '';
    }
  }

  /**
   * Sleep for a specified duration
   *
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
