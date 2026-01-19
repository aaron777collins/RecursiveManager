/**
 * Database-related constants
 *
 * This module defines constants used across database operations.
 */

/**
 * Maximum task hierarchy depth
 *
 * Tasks can be nested up to this depth. A root task has depth 0,
 * its immediate subtasks have depth 1, and so on.
 *
 * @example
 * Root Task (depth 0)
 *   └─ Subtask (depth 1)
 *       └─ Sub-subtask (depth 2)
 *           └─ ... (up to depth 5)
 */
export const TASK_MAX_DEPTH = 5;

/**
 * Maximum agent hierarchy depth
 *
 * Agents can be organized in hierarchies up to this depth.
 * The CEO has depth 0, direct reports have depth 1, etc.
 */
export const AGENT_MAX_HIERARCHY_DEPTH = 5;
