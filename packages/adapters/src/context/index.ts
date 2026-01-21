/**
 * Execution Context Preparation (Task 3.2.7)
 *
 * This module provides utilities for loading and preparing execution contexts
 * for framework adapters. It handles loading agent configuration, tasks,
 * messages, and workspace files to construct a complete ExecutionContext.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Database } from 'better-sqlite3';
import {
  getWorkspacePath,
  getAgentDirectory,
  PathOptions,
  type AgentConfig,
  loadAgentConfig,
  getActiveTasks,
  getMessages,
} from '@recursivemanager/common';
import type { ExecutionContext, ExecutionMode, TaskSchema, Message } from '../types';

/**
 * Error thrown when execution context cannot be loaded
 */
export class ContextLoadError extends Error {
  constructor(
    message: string,
    public readonly agentId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ContextLoadError';
    Error.captureStackTrace(this, ContextLoadError);
  }
}

/**
 * Options for loading execution context
 */
export interface LoadContextOptions extends PathOptions {
  /**
   * Maximum number of workspace files to enumerate
   * @default 100
   */
  maxWorkspaceFiles?: number;

  /**
   * Maximum depth to scan workspace directory tree
   * @default 3
   */
  maxWorkspaceDepth?: number;

  /**
   * Maximum number of messages to load
   * @default 50
   */
  maxMessages?: number;
}

/**
 * Convert a database TaskRecord to the adapter TaskSchema format
 */
function convertTaskToSchema(task: any): TaskSchema {
  return {
    id: task.id,
    title: task.title,
    description: '', // Task description would come from task files, not DB
    status: task.status as TaskSchema['status'],
    priority: task.priority as TaskSchema['priority'],
    parentTaskId: task.parent_task_id || undefined,
    delegatedTo: task.delegated_to || undefined,
    createdAt: task.created_at,
    updatedAt: task.last_updated,
  };
}

/**
 * Convert a database MessageRecord to the adapter Message format
 */
function convertMessageToSchema(msg: any): Message {
  return {
    id: msg.id,
    from: msg.from_agent_id,
    to: msg.to_agent_id,
    content: '', // Message content comes from message files, not DB
    channel: msg.channel,
    timestamp: msg.timestamp,
    read: msg.read,
  };
}

/**
 * Recursively enumerate files in a directory up to a maximum depth
 *
 * @param dir - Directory to scan
 * @param maxDepth - Maximum depth to scan (0 = only files in dir)
 * @param maxFiles - Maximum number of files to return
 * @param currentDepth - Current recursion depth (internal)
 * @param baseDir - Base directory for calculating relative paths (internal)
 * @returns Array of relative file paths
 */
async function enumerateWorkspaceFiles(
  dir: string,
  maxDepth: number = 3,
  maxFiles: number = 100,
  currentDepth: number = 0,
  baseDir?: string
): Promise<string[]> {
  const base = baseDir || dir;
  const files: string[] = [];

  try {
    // Check if directory exists
    try {
      await fs.access(dir);
    } catch {
      // Directory doesn't exist, return empty array
      return [];
    }

    // Read directory contents
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Stop if we've hit the file limit
      if (files.length >= maxFiles) {
        break;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(base, fullPath);

      if (entry.isFile()) {
        files.push(relativePath);
      } else if (entry.isDirectory() && currentDepth < maxDepth) {
        // Recursively scan subdirectories
        const subFiles = await enumerateWorkspaceFiles(
          fullPath,
          maxDepth,
          maxFiles - files.length,
          currentDepth + 1,
          base
        );
        files.push(...subFiles);
      }
    }
  } catch (err) {
    // If we can't read the directory, log and return what we have
    console.warn(`Failed to enumerate workspace files in ${dir}:`, err);
  }

  return files;
}

/**
 * Load agent configuration from file system
 *
 * @param agentId - Agent identifier
 * @param options - Path resolution options
 * @returns Agent configuration
 * @throws {ContextLoadError} If configuration cannot be loaded
 */
export async function loadConfig(
  agentId: string,
  options: LoadContextOptions = {}
): Promise<AgentConfig> {
  try {
    return await loadAgentConfig(agentId, options);
  } catch (err) {
    throw new ContextLoadError(
      `Failed to load agent configuration: ${(err as Error).message}`,
      agentId,
      err as Error
    );
  }
}

/**
 * Load active tasks for an agent from database
 *
 * @param db - Database instance
 * @param agentId - Agent identifier
 * @returns Array of active tasks
 * @throws {ContextLoadError} If tasks cannot be loaded
 */
export async function loadTasks(db: Database, agentId: string): Promise<TaskSchema[]> {
  try {
    const tasks = getActiveTasks(db, agentId);
    return Promise.resolve(tasks.map(convertTaskToSchema));
  } catch (err) {
    throw new ContextLoadError(
      `Failed to load active tasks: ${(err as Error).message}`,
      agentId,
      err as Error
    );
  }
}

/**
 * Load unread messages for an agent from database
 *
 * @param db - Database instance
 * @param agentId - Agent identifier
 * @param options - Load context options
 * @returns Array of unread messages
 * @throws {ContextLoadError} If messages cannot be loaded
 */
export async function loadMessages(
  db: Database,
  agentId: string,
  options: LoadContextOptions = {}
): Promise<Message[]> {
  try {
    const maxMessages = options.maxMessages ?? 50;
    const messages = getMessages(db, {
      agentId,
      unreadOnly: true,
      limit: maxMessages,
    });
    return Promise.resolve(messages.map(convertMessageToSchema));
  } catch (err) {
    throw new ContextLoadError(
      `Failed to load messages: ${(err as Error).message}`,
      agentId,
      err as Error
    );
  }
}

/**
 * Load workspace files for an agent
 *
 * @param agentId - Agent identifier
 * @param options - Load context options
 * @returns Array of relative file paths in workspace
 * @throws {ContextLoadError} If workspace files cannot be loaded
 */
export async function loadWorkspaceFiles(
  agentId: string,
  options: LoadContextOptions = {}
): Promise<string[]> {
  try {
    const workspaceDir = getWorkspacePath(agentId, options);
    const maxFiles = options.maxWorkspaceFiles ?? 100;
    const maxDepth = options.maxWorkspaceDepth ?? 3;

    const files = await enumerateWorkspaceFiles(workspaceDir, maxDepth, maxFiles);

    return files;
  } catch (err) {
    throw new ContextLoadError(
      `Failed to load workspace files: ${(err as Error).message}`,
      agentId,
      err as Error
    );
  }
}

/**
 * Load complete execution context for an agent
 *
 * This function orchestrates loading all necessary data for agent execution:
 * 1. Load agent configuration from file system
 * 2. Load active tasks from database
 * 3. Load unread messages from database
 * 4. Enumerate workspace files
 * 5. Determine workspace and working directories
 * 6. Construct ExecutionContext object
 *
 * @param db - Database instance
 * @param agentId - Agent identifier
 * @param mode - Execution mode (continuous or reactive)
 * @param options - Load context options
 * @returns Complete execution context ready for framework adapter
 * @throws {ContextLoadError} If any part of context loading fails
 *
 * @example
 * ```typescript
 * const db = getDatabase();
 * const context = await loadExecutionContext(
 *   db,
 *   'ceo-001',
 *   'continuous'
 * );
 *
 * // Pass to framework adapter
 * await adapter.executeAgent('ceo-001', 'continuous', context);
 * ```
 */
export async function loadExecutionContext(
  db: Database,
  agentId: string,
  mode: ExecutionMode,
  options: LoadContextOptions = {}
): Promise<ExecutionContext> {
  try {
    // Load all context data in parallel for efficiency
    const [config, tasks, messages, workspaceFiles] = await Promise.all([
      loadConfig(agentId, options),
      loadTasks(db, agentId),
      loadMessages(db, agentId, options),
      loadWorkspaceFiles(agentId, options),
    ]);

    // Determine workspace and working directories
    const workspaceDir = getWorkspacePath(agentId, options);
    const workingDir = getAgentDirectory(agentId, options);

    // Construct execution context
    const context: ExecutionContext = {
      agentId,
      mode,
      config,
      activeTasks: tasks,
      messages,
      workspaceFiles,
      workspaceDir,
      workingDir,
    };

    return context;
  } catch (err) {
    // Re-throw ContextLoadError as-is
    if (err instanceof ContextLoadError) {
      throw err;
    }

    // Wrap other errors
    throw new ContextLoadError(
      `Failed to load execution context: ${(err as Error).message}`,
      agentId,
      err as Error
    );
  }
}

/**
 * Validate that an execution context has all required fields
 *
 * @param context - Execution context to validate
 * @throws {Error} If context is missing required fields
 */
export function validateExecutionContext(context: ExecutionContext): void {
  const required: Array<keyof ExecutionContext> = [
    'agentId',
    'mode',
    'config',
    'activeTasks',
    'messages',
    'workspaceFiles',
    'workspaceDir',
    'workingDir',
  ];

  for (const field of required) {
    if (context[field] === undefined || context[field] === null) {
      throw new Error(`ExecutionContext missing required field: ${field}`);
    }
  }
}
