/**
 * Path Utilities
 *
 * Provides centralized path resolution for agent directories, task paths, and
 * other system resources. Implements directory sharding to distribute agents
 * across multiple subdirectories for better filesystem performance.
 *
 * @module path-utils
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Default base directory for all RecursiveManager data
 */
export const DEFAULT_BASE_DIR = path.join(os.homedir(), '.recursive-manager');

/**
 * Number of sharding buckets (16 for hex digits 0-F)
 */
const SHARD_COUNT = 16;

/**
 * Options for path resolution
 */
export interface PathOptions {
  /**
   * Base directory for all RecursiveManager data
   * @default ~/.recursive-manager
   */
  baseDir?: string;
}

/**
 * Custom error class for path-related errors
 */
export class PathError extends Error {
  constructor(
    message: string,
    public readonly agentId?: string,
    public readonly taskId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PathError';
    Error.captureStackTrace(this, PathError);
  }
}

/**
 * Get the hex prefix shard for an agent ID
 *
 * Uses the first character of the agent ID after hashing to determine the shard.
 * This distributes agents across 16 buckets (0-F) to prevent filesystem performance
 * degradation when there are many agents.
 *
 * @param agentId - The agent identifier
 * @returns Shard range string (e.g., "00-0f", "10-1f", etc.)
 *
 * @example
 * ```typescript
 * getAgentShard('CEO')          // => "c0-cf"
 * getAgentShard('backend-dev')  // => "b0-bf"
 * getAgentShard('alice')        // => "a0-af"
 * ```
 */
export function getAgentShard(agentId: string): string {
  if (!agentId || agentId.trim().length === 0) {
    throw new PathError('Agent ID cannot be empty', agentId);
  }

  // Get the first character and convert to lowercase
  const firstChar = agentId.toLowerCase()[0];

  // This should never happen due to the empty check above, but TypeScript strict mode requires it
  if (firstChar === undefined) {
    throw new PathError('Agent ID cannot be empty', agentId);
  }

  // Get the character code
  const charCode = firstChar.charCodeAt(0);

  // Determine shard based on character code
  // For hex digits (0-9, a-f), use the digit directly
  // For other characters, hash to a shard bucket
  let shardIndex: number;

  if (firstChar >= '0' && firstChar <= '9') {
    // Numeric: 0-9 maps to shards 0-9
    shardIndex = charCode - 48; // '0' is ASCII 48
  } else if (firstChar >= 'a' && firstChar <= 'f') {
    // Hex letters: a-f maps to shards 10-15
    shardIndex = charCode - 87; // 'a' is ASCII 97, we want 10
  } else {
    // Other characters: hash to a shard bucket
    shardIndex = charCode % SHARD_COUNT;
  }

  // Ensure shard index is within valid range
  shardIndex = shardIndex % SHARD_COUNT;

  // Convert to hex range string (e.g., 0 => "00-0f", 10 => "a0-af")
  const shardHex = shardIndex.toString(16).toLowerCase();
  return `${shardHex}0-${shardHex}f`;
}

/**
 * Get the absolute directory path for an agent
 *
 * Implements directory sharding to distribute agents across subdirectories.
 * The agent directory structure is: {baseDir}/agents/{shard}/{agentId}/
 *
 * @param agentId - The agent identifier
 * @param options - Path resolution options
 * @returns Absolute path to the agent's directory
 *
 * @example
 * ```typescript
 * getAgentDirectory('CEO')
 * // => "/home/user/.recursive-manager/agents/c0-cf/CEO"
 *
 * getAgentDirectory('backend-dev-001', { baseDir: '/opt/rm' })
 * // => "/opt/rm/agents/b0-bf/backend-dev-001"
 * ```
 */
export function getAgentDirectory(agentId: string, options: PathOptions = {}): string {
  if (!agentId || agentId.trim().length === 0) {
    throw new PathError('Agent ID cannot be empty', agentId);
  }

  const baseDir = options.baseDir ?? DEFAULT_BASE_DIR;
  const shard = getAgentShard(agentId);

  return path.resolve(baseDir, 'agents', shard, agentId);
}

/**
 * Get the absolute path for a task within an agent's directory
 *
 * Task paths are organized as: {agentDir}/tasks/{status}/{taskId}/
 * where status is typically 'active', 'completed', or 'archive/{YYYY-MM}'
 *
 * @param agentId - The agent identifier
 * @param taskId - The task identifier
 * @param status - Task status directory (default: 'active')
 * @param options - Path resolution options
 * @returns Absolute path to the task's directory
 *
 * @example
 * ```typescript
 * getTaskPath('CEO', 'task-1-implement-feature')
 * // => "/home/user/.recursive-manager/agents/c0-cf/CEO/tasks/active/task-1-implement-feature"
 *
 * getTaskPath('CEO', 'task-2-review', 'completed')
 * // => "/home/user/.recursive-manager/agents/c0-cf/CEO/tasks/completed/task-2-review"
 * ```
 */
export function getTaskPath(
  agentId: string,
  taskId: string,
  status: string = 'active',
  options: PathOptions = {}
): string {
  if (!agentId || agentId.trim().length === 0) {
    throw new PathError('Agent ID cannot be empty', agentId, taskId);
  }

  if (!taskId || taskId.trim().length === 0) {
    throw new PathError('Task ID cannot be empty', agentId, taskId);
  }

  const agentDir = getAgentDirectory(agentId, options);
  return path.join(agentDir, 'tasks', status, taskId);
}

/**
 * Get the absolute path for an agent's inbox directory
 *
 * @param agentId - The agent identifier
 * @param options - Path resolution options
 * @returns Absolute path to the agent's inbox directory
 *
 * @example
 * ```typescript
 * getInboxPath('CEO')
 * // => "/home/user/.recursive-manager/agents/c0-cf/CEO/inbox"
 * ```
 */
export function getInboxPath(agentId: string, options: PathOptions = {}): string {
  const agentDir = getAgentDirectory(agentId, options);
  return path.join(agentDir, 'inbox');
}

/**
 * Get the absolute path for an agent's outbox directory
 *
 * @param agentId - The agent identifier
 * @param options - Path resolution options
 * @returns Absolute path to the agent's outbox directory
 *
 * @example
 * ```typescript
 * getOutboxPath('CEO')
 * // => "/home/user/.recursive-manager/agents/c0-cf/CEO/outbox"
 * ```
 */
export function getOutboxPath(agentId: string, options: PathOptions = {}): string {
  const agentDir = getAgentDirectory(agentId, options);
  return path.join(agentDir, 'outbox');
}

/**
 * Get the absolute path for an agent's workspace directory
 *
 * @param agentId - The agent identifier
 * @param options - Path resolution options
 * @returns Absolute path to the agent's workspace directory
 *
 * @example
 * ```typescript
 * getWorkspacePath('CEO')
 * // => "/home/user/.recursive-manager/agents/c0-cf/CEO/workspace"
 * ```
 */
export function getWorkspacePath(agentId: string, options: PathOptions = {}): string {
  const agentDir = getAgentDirectory(agentId, options);
  return path.join(agentDir, 'workspace');
}

/**
 * Get the absolute path for an agent's subordinates directory
 *
 * @param agentId - The agent identifier
 * @param options - Path resolution options
 * @returns Absolute path to the agent's subordinates directory
 *
 * @example
 * ```typescript
 * getSubordinatesPath('CEO')
 * // => "/home/user/.recursive-manager/agents/c0-cf/CEO/subordinates"
 * ```
 */
export function getSubordinatesPath(agentId: string, options: PathOptions = {}): string {
  const agentDir = getAgentDirectory(agentId, options);
  return path.join(agentDir, 'subordinates');
}

/**
 * Get the absolute path for an agent's configuration file
 *
 * @param agentId - The agent identifier
 * @param options - Path resolution options
 * @returns Absolute path to the agent's config.json file
 *
 * @example
 * ```typescript
 * getConfigPath('CEO')
 * // => "/home/user/.recursive-manager/agents/c0-cf/CEO/config.json"
 * ```
 */
export function getConfigPath(agentId: string, options: PathOptions = {}): string {
  const agentDir = getAgentDirectory(agentId, options);
  return path.join(agentDir, 'config.json');
}

/**
 * Get the absolute path for an agent's schedule file
 *
 * @param agentId - The agent identifier
 * @param options - Path resolution options
 * @returns Absolute path to the agent's schedule.json file
 *
 * @example
 * ```typescript
 * getSchedulePath('CEO')
 * // => "/home/user/.recursive-manager/agents/c0-cf/CEO/schedule.json"
 * ```
 */
export function getSchedulePath(agentId: string, options: PathOptions = {}): string {
  const agentDir = getAgentDirectory(agentId, options);
  return path.join(agentDir, 'schedule.json');
}

/**
 * Get the absolute path for an agent's metadata file
 *
 * @param agentId - The agent identifier
 * @param options - Path resolution options
 * @returns Absolute path to the agent's metadata.json file
 *
 * @example
 * ```typescript
 * getMetadataPath('CEO')
 * // => "/home/user/.recursive-manager/agents/c0-cf/CEO/metadata.json"
 * ```
 */
export function getMetadataPath(agentId: string, options: PathOptions = {}): string {
  const agentDir = getAgentDirectory(agentId, options);
  return path.join(agentDir, 'metadata.json');
}

/**
 * Get the absolute path for the logs directory
 *
 * @param options - Path resolution options
 * @returns Absolute path to the logs directory
 *
 * @example
 * ```typescript
 * getLogsDirectory()
 * // => "/home/user/.recursive-manager/logs"
 * ```
 */
export function getLogsDirectory(options: PathOptions = {}): string {
  const baseDir = options.baseDir ?? DEFAULT_BASE_DIR;
  return path.resolve(baseDir, 'logs');
}

/**
 * Get the absolute path for an agent's log file
 *
 * @param agentId - The agent identifier
 * @param options - Path resolution options
 * @returns Absolute path to the agent's log file
 *
 * @example
 * ```typescript
 * getAgentLogPath('CEO')
 * // => "/home/user/.recursive-manager/logs/agents/CEO.log"
 * ```
 */
export function getAgentLogPath(agentId: string, options: PathOptions = {}): string {
  if (!agentId || agentId.trim().length === 0) {
    throw new PathError('Agent ID cannot be empty', agentId);
  }

  const logsDir = getLogsDirectory(options);
  return path.join(logsDir, 'agents', `${agentId}.log`);
}

/**
 * Get the absolute path for the database file
 *
 * @param options - Path resolution options
 * @returns Absolute path to the SQLite database file
 *
 * @example
 * ```typescript
 * getDatabasePath()
 * // => "/home/user/.recursive-manager/recursive-manager.db"
 * ```
 */
export function getDatabasePath(options: PathOptions = {}): string {
  const baseDir = options.baseDir ?? DEFAULT_BASE_DIR;
  return path.resolve(baseDir, 'recursive-manager.db');
}

/**
 * Get the absolute path for the backups directory
 *
 * @param options - Path resolution options
 * @returns Absolute path to the backups directory
 *
 * @example
 * ```typescript
 * getBackupsDirectory()
 * // => "/home/user/.recursive-manager/backups"
 * ```
 */
export function getBackupsDirectory(options: PathOptions = {}): string {
  const baseDir = options.baseDir ?? DEFAULT_BASE_DIR;
  return path.resolve(baseDir, 'backups');
}

// ============================================================================
// Path Validation Utilities
// ============================================================================

/**
 * Options for path validation
 */
export interface PathValidationOptions {
  /**
   * Base directory for path containment checks
   * @default ~/.recursive-manager
   */
  baseDir?: string;

  /**
   * Whether to allow empty values (default: false)
   */
  allowEmpty?: boolean;
}

/**
 * Result of path validation
 */
export interface PathValidationResult {
  /**
   * Whether the path is valid
   */
  valid: boolean;

  /**
   * Error message if validation failed
   */
  error?: string;

  /**
   * Normalized/sanitized path if validation succeeded
   */
  sanitized?: string;
}

/**
 * Validate an agent ID
 *
 * Agent IDs must:
 * - Not be empty (unless allowEmpty is true)
 * - Not contain path separators (/ or \)
 * - Not contain null bytes
 * - Not be exactly '.' or '..'
 * - Not start or end with whitespace
 *
 * @param agentId - The agent ID to validate
 * @param options - Validation options
 * @returns Validation result with sanitized ID
 *
 * @example
 * ```typescript
 * validateAgentId('CEO')                    // => { valid: true, sanitized: 'CEO' }
 * validateAgentId('backend-dev-001')        // => { valid: true, sanitized: 'backend-dev-001' }
 * validateAgentId('../../../etc/passwd')    // => { valid: false, error: '...' }
 * validateAgentId('agent/with/slash')       // => { valid: false, error: '...' }
 * ```
 */
export function validateAgentId(
  agentId: string,
  options: PathValidationOptions = {}
): PathValidationResult {
  const { allowEmpty = false } = options;

  // Check for empty
  if (!agentId || agentId.trim().length === 0) {
    if (allowEmpty) {
      return { valid: true, sanitized: '' };
    }
    return { valid: false, error: 'Agent ID cannot be empty' };
  }

  // Check for whitespace at start or end
  if (agentId !== agentId.trim()) {
    return {
      valid: false,
      error: 'Agent ID cannot start or end with whitespace',
    };
  }

  // Check for path separators
  if (agentId.includes('/') || agentId.includes('\\')) {
    return {
      valid: false,
      error: 'Agent ID cannot contain path separators (/ or \\)',
    };
  }

  // Check for null bytes
  if (agentId.includes('\0')) {
    return {
      valid: false,
      error: 'Agent ID cannot contain null bytes',
    };
  }

  // Check for relative path components
  if (agentId === '.' || agentId === '..') {
    return {
      valid: false,
      error: 'Agent ID cannot be "." or ".."',
    };
  }

  return { valid: true, sanitized: agentId };
}

/**
 * Validate a task ID
 *
 * Task IDs must follow the same rules as agent IDs
 *
 * @param taskId - The task ID to validate
 * @param options - Validation options
 * @returns Validation result with sanitized ID
 *
 * @example
 * ```typescript
 * validateTaskId('task-1-implement-feature')  // => { valid: true, sanitized: '...' }
 * validateTaskId('task/../../../etc')         // => { valid: false, error: '...' }
 * ```
 */
export function validateTaskId(
  taskId: string,
  options: PathValidationOptions = {}
): PathValidationResult {
  // Task IDs follow the same validation rules as agent IDs
  const result = validateAgentId(taskId, options);
  if (!result.valid) {
    // Adjust error message to say "Task ID" instead of "Agent ID"
    return {
      ...result,
      error: result.error?.replace('Agent ID', 'Task ID'),
    };
  }
  return result;
}

/**
 * Validate that a path is within a base directory (prevents path traversal)
 *
 * This function ensures that:
 * - The resolved path is within the base directory
 * - The path doesn't escape via symlinks or .. components
 * - The path is absolute after resolution
 *
 * @param targetPath - The path to validate
 * @param options - Validation options (baseDir required)
 * @returns Validation result with normalized path
 *
 * @example
 * ```typescript
 * validatePathContainment('/home/user/.recursive-manager/agents/CEO', {
 *   baseDir: '/home/user/.recursive-manager'
 * })
 * // => { valid: true, sanitized: '/home/user/.recursive-manager/agents/CEO' }
 *
 * validatePathContainment('/etc/passwd', {
 *   baseDir: '/home/user/.recursive-manager'
 * })
 * // => { valid: false, error: 'Path is outside base directory' }
 *
 * validatePathContainment('../../../etc/passwd', {
 *   baseDir: '/home/user/.recursive-manager'
 * })
 * // => { valid: false, error: 'Path is outside base directory' }
 * ```
 */
export function validatePathContainment(
  targetPath: string,
  options: PathValidationOptions = {}
): PathValidationResult {
  const { baseDir = DEFAULT_BASE_DIR } = options;

  // Resolve both paths to absolute paths (eliminates .. and . components)
  // If targetPath is relative, resolve it relative to baseDir
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(baseDir, targetPath);

  // Normalize paths to handle trailing slashes consistently
  const normalizedBase = path.normalize(resolvedBase);
  const normalizedTarget = path.normalize(resolvedTarget);

  // Check if target is within base directory
  // Use path.relative to determine if target is within base
  const relativePath = path.relative(normalizedBase, normalizedTarget);

  // If relative path starts with '..' or is absolute, it's outside base
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return {
      valid: false,
      error: `Path is outside base directory: ${normalizedTarget} is not within ${normalizedBase}`,
    };
  }

  return { valid: true, sanitized: normalizedTarget };
}

/**
 * Validate a complete agent directory path
 *
 * This combines validation of:
 * - Agent ID format
 * - Path containment within base directory
 * - No path traversal attempts
 *
 * @param agentId - The agent ID
 * @param options - Validation options
 * @returns Validation result with normalized agent directory path
 *
 * @example
 * ```typescript
 * validateAgentPath('CEO')
 * // => { valid: true, sanitized: '/home/user/.recursive-manager/agents/c0-cf/CEO' }
 *
 * validateAgentPath('../../../etc')
 * // => { valid: false, error: '...' }
 * ```
 */
export function validateAgentPath(
  agentId: string,
  options: PathValidationOptions = {}
): PathValidationResult {
  // First validate the agent ID
  const idValidation = validateAgentId(agentId, options);
  if (!idValidation.valid) {
    return idValidation;
  }

  // Get the agent directory path
  const baseDir = options.baseDir ?? DEFAULT_BASE_DIR;
  const agentDir = getAgentDirectory(agentId, { baseDir });

  // Validate path containment
  const containmentValidation = validatePathContainment(agentDir, { baseDir });
  if (!containmentValidation.valid) {
    return containmentValidation;
  }

  return { valid: true, sanitized: agentDir };
}

/**
 * Validate a complete task path
 *
 * This combines validation of:
 * - Agent ID format
 * - Task ID format
 * - Path containment within base directory
 * - No path traversal attempts
 *
 * @param agentId - The agent ID
 * @param taskId - The task ID
 * @param status - Task status directory (default: 'active')
 * @param options - Validation options
 * @returns Validation result with normalized task path
 *
 * @example
 * ```typescript
 * validateTaskPath('CEO', 'task-1-implement-feature')
 * // => { valid: true, sanitized: '/home/user/.recursive-manager/agents/c0-cf/CEO/tasks/active/task-1-implement-feature' }
 *
 * validateTaskPath('CEO', '../../../etc/passwd')
 * // => { valid: false, error: '...' }
 * ```
 */
export function validateTaskPath(
  agentId: string,
  taskId: string,
  status: string = 'active',
  options: PathValidationOptions = {}
): PathValidationResult {
  // First validate the agent ID
  const agentValidation = validateAgentId(agentId, options);
  if (!agentValidation.valid) {
    return agentValidation;
  }

  // Then validate the task ID
  const taskValidation = validateTaskId(taskId, options);
  if (!taskValidation.valid) {
    return taskValidation;
  }

  // Get the task path
  const baseDir = options.baseDir ?? DEFAULT_BASE_DIR;
  const taskPath = getTaskPath(agentId, taskId, status, { baseDir });

  // Validate path containment
  const containmentValidation = validatePathContainment(taskPath, { baseDir });
  if (!containmentValidation.valid) {
    return containmentValidation;
  }

  return { valid: true, sanitized: taskPath };
}

/**
 * Sanitize a string for use as a filename or directory name
 *
 * Removes or replaces characters that are problematic in filenames:
 * - Path separators (/ and \)
 * - Null bytes
 * - Control characters
 * - Leading/trailing whitespace
 * - Leading/trailing dots
 *
 * @param name - The name to sanitize
 * @param replacement - Character to use for replacements (default: '-')
 * @returns Sanitized name safe for use in file paths
 *
 * @example
 * ```typescript
 * sanitizePathComponent('My Task / Feature')  // => 'My-Task-Feature'
 * sanitizePathComponent('../../../etc')       // => 'etc'
 * sanitizePathComponent('  task  ')           // => 'task'
 * sanitizePathComponent('.hidden')            // => 'hidden'
 * ```
 */
export function sanitizePathComponent(name: string, replacement: string = '-'): string {
  // Remove leading/trailing whitespace
  let sanitized = name.trim();

  // Replace path separators and colons with replacement character
  // Also trim whitespace around them
  sanitized = sanitized.replace(/\s*[/\\:]\s*/g, replacement);

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove or replace control characters (ASCII 0-31)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x1f]/g, '');

  // Remove leading/trailing dots (prevents hidden files and relative paths)
  sanitized = sanitized.replace(/^\.+|\.+$/g, '');

  // Collapse multiple replacement characters into one
  const escapedReplacement = replacement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const multipleRegex = new RegExp(`${escapedReplacement}+`, 'g');
  sanitized = sanitized.replace(multipleRegex, replacement);

  // Remove leading/trailing replacement characters
  const trimRegex = new RegExp(`^${escapedReplacement}+|${escapedReplacement}+$`, 'g');
  sanitized = sanitized.replace(trimRegex, '');

  return sanitized;
}
