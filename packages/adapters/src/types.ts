/**
 * TypeScript types for Framework Adapters
 *
 * These types define the interface for framework adapters and related
 * execution contexts/results.
 */

import type { AgentConfig } from '@recursivemanager/common';

/**
 * Execution mode for agent execution
 */
export type ExecutionMode = 'continuous' | 'reactive';

/**
 * Task schema for execution context
 * This is a simplified version focused on execution needs
 */
export interface TaskSchema {
  /** Unique task identifier */
  id: string;
  /** Task title */
  title: string;
  /** Task description/details */
  description: string;
  /** Current status */
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'failed';
  /** Task priority */
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Parent task ID if this is a subtask */
  parentTaskId?: string;
  /** Agent ID this task is delegated to */
  delegatedTo?: string;
  /** ISO 8601 timestamp of task creation */
  createdAt: string;
  /** ISO 8601 timestamp of last update */
  updatedAt: string;
}

/**
 * Message for execution context
 */
export interface Message {
  /** Unique message identifier */
  id: string;
  /** Sender agent ID or channel */
  from: string;
  /** Recipient agent ID */
  to: string;
  /** Message content */
  content: string;
  /** Message channel (internal, slack, telegram, email) */
  channel: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Whether message has been read */
  read: boolean;
}

/**
 * Execution context provided to framework adapters
 *
 * Contains all information needed for an agent execution session
 */
export interface ExecutionContext {
  /** Agent identifier */
  agentId: string;
  /** Execution mode */
  mode: ExecutionMode;
  /** Agent configuration */
  config: AgentConfig;
  /** Active tasks for this agent */
  activeTasks: TaskSchema[];
  /** Unread messages for this agent */
  messages: Message[];
  /** List of files in agent's workspace */
  workspaceFiles: string[];
  /** Workspace directory path */
  workspaceDir: string;
  /** Working directory for execution */
  workingDir: string;
}

/**
 * Result from framework adapter execution
 */
export interface ExecutionResult {
  /** Whether execution succeeded */
  success: boolean;
  /** Execution duration in milliseconds */
  duration: number;
  /** Number of tasks completed during execution */
  tasksCompleted: number;
  /** Number of messages processed during execution */
  messagesProcessed: number;
  /** Errors encountered during execution */
  errors: Array<{
    /** Error message */
    message: string;
    /** Error stack trace if available */
    stack?: string;
    /** Error code or type */
    code?: string;
  }>;
  /** When the next execution should occur (for continuous mode) */
  nextExecution?: Date;
  /** Additional metadata from execution */
  metadata?: {
    /** Files created during execution */
    filesCreated?: string[];
    /** Files modified during execution */
    filesModified?: string[];
    /** API calls made */
    apiCallCount?: number;
    /** Cost of execution in USD */
    costUSD?: number;
    /** Output logs or summary */
    output?: string;
  };
}

/**
 * Framework capability definition
 */
export interface Capability {
  /** Capability identifier (e.g., "file-operations", "multi-perspective", "web-search") */
  name: string;
  /** Human-readable capability description */
  description: string;
  /** Whether this capability is available/enabled */
  available: boolean;
  /** Capability version if versioned */
  version?: string;
}

/**
 * Framework adapter interface
 *
 * All framework adapters (Claude Code, OpenCode, etc.) must implement this interface
 */
export interface FrameworkAdapter {
  /** Framework name (e.g., "claude-code", "opencode") */
  readonly name: string;

  /** Framework version */
  readonly version: string;

  /**
   * Execute an agent with the given context
   *
   * @param agentId - Unique agent identifier
   * @param mode - Execution mode (continuous or reactive)
   * @param context - Full execution context
   * @returns Promise resolving to execution result
   */
  executeAgent(
    agentId: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  /**
   * Check if framework supports a specific feature
   *
   * @param feature - Feature identifier
   * @returns True if feature is supported
   */
  supportsFeature(feature: string): boolean;

  /**
   * Get all capabilities provided by this framework
   *
   * @returns Array of capability definitions
   */
  getCapabilities(): Capability[];

  /**
   * Check if framework is available and healthy
   *
   * @returns Promise resolving to true if framework is operational
   */
  healthCheck(): Promise<boolean>;
}
