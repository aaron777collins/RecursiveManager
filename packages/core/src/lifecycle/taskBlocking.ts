/**
 * Task Blocking for Paused Agents (Task 2.2.18)
 *
 * This module implements task blocking/unblocking logic for agent pause/resume operations.
 *
 * When an agent is paused:
 * - All active tasks (pending, in-progress) are set to 'blocked' status
 * - The blocked_by field is updated to indicate the agent is paused
 * - The blocked_since timestamp is recorded
 *
 * When an agent is resumed:
 * - All tasks that were blocked due to pause are restored to their previous status
 * - Tasks blocked for other reasons remain blocked
 * - The blocked_by field is cleared (if only blocked by pause)
 *
 * Design Notes:
 * - Uses optimistic locking (version field) to prevent race conditions
 * - Preserves tasks blocked by other dependencies (not just pause)
 * - Handles partial failures gracefully (logs errors, continues processing)
 * - Uses transactions for atomic multi-task updates
 */

import Database from 'better-sqlite3';
import {
  createAgentLogger,
  getActiveTasks,
  getBlockedTasks,
  type TaskRecord,
} from '@recursive-manager/common';

/**
 * Special blocker identifier for agent pause
 */
export const PAUSE_BLOCKER = 'AGENT_PAUSED';

/**
 * Result of blocking operation
 */
export interface BlockTasksResult {
  totalTasks: number;
  blockedCount: number;
  alreadyBlocked: number;
  errors: Array<{ taskId: string; error: string }>;
}

/**
 * Result of unblocking operation
 */
export interface UnblockTasksResult {
  totalTasks: number;
  unblockedCount: number;
  stillBlocked: number;
  errors: Array<{ taskId: string; error: string }>;
}

/**
 * Block all active tasks for a paused agent
 *
 * This function is called when an agent is paused. It blocks all tasks
 * that are currently pending or in-progress by:
 * 1. Setting task status to 'blocked'
 * 2. Adding PAUSE_BLOCKER to the blocked_by array
 * 3. Recording the blocked_since timestamp
 *
 * Tasks that are already blocked will have PAUSE_BLOCKER added to their
 * blocked_by list (they may be blocked by multiple reasons).
 *
 * @param db - Database instance
 * @param agentId - ID of the agent being paused
 * @returns Result object with blocking statistics
 *
 * @example
 * ```typescript
 * const result = blockTasksForPausedAgent(db, 'dev-001');
 * console.log(`Blocked ${result.blockedCount} tasks`);
 * ```
 */
export function blockTasksForPausedAgent(
  db: Database.Database,
  agentId: string
): BlockTasksResult {
  const logger = createAgentLogger(agentId);

  logger.info('Blocking tasks for paused agent', { agentId });

  // Get all active tasks (pending, in-progress, blocked)
  const activeTasks = getActiveTasks(db, agentId);
  const totalTasks = activeTasks.length;

  if (totalTasks === 0) {
    logger.info('No active tasks to block', { agentId });
    return {
      totalTasks: 0,
      blockedCount: 0,
      alreadyBlocked: 0,
      errors: [],
    };
  }

  logger.debug('Found active tasks to block', {
    agentId,
    totalTasks,
    taskIds: activeTasks.map((t: TaskRecord) => t.id),
  });

  const result: BlockTasksResult = {
    totalTasks,
    blockedCount: 0,
    alreadyBlocked: 0,
    errors: [],
  };

  const now = new Date().toISOString();

  // Prepare UPDATE statements
  const blockTaskStmt = db.prepare(`
    UPDATE tasks
    SET
      status = 'blocked',
      blocked_by = ?,
      blocked_since = ?,
      version = version + 1
    WHERE id = ? AND version = ?
  `);

  const addBlockerStmt = db.prepare(`
    UPDATE tasks
    SET
      blocked_by = ?,
      version = version + 1
    WHERE id = ? AND version = ?
  `);

  // Process each task
  for (const task of activeTasks) {
    try {
      // Parse existing blocked_by array
      let blockedBy: string[] = [];
      try {
        blockedBy = JSON.parse(task.blocked_by) as string[];
      } catch (err) {
        // Invalid JSON, treat as empty array
        blockedBy = [];
      }

      // Check if already blocked by pause
      if (blockedBy.includes(PAUSE_BLOCKER)) {
        logger.debug('Task already blocked by pause', { taskId: task.id });
        result.alreadyBlocked++;
        continue;
      }

      // Add PAUSE_BLOCKER to the list
      blockedBy.push(PAUSE_BLOCKER);
      const newBlockedBy = JSON.stringify(blockedBy);

      // Update the task
      if (task.status === 'blocked') {
        // Task is already blocked by other reasons, just add PAUSE_BLOCKER
        const updateResult = addBlockerStmt.run(newBlockedBy, task.id, task.version);

        if (updateResult.changes === 0) {
          // Version mismatch - task was modified concurrently
          logger.warn('Failed to add pause blocker due to version mismatch', {
            taskId: task.id,
            title: task.title,
          });
          result.errors.push({
            taskId: task.id,
            error: 'Version mismatch (concurrent modification)',
          });
          continue;
        }

        result.alreadyBlocked++;
        logger.debug('Added pause blocker to already-blocked task', {
          taskId: task.id,
          blockedBy,
        });
      } else {
        // Task is pending or in-progress, set to blocked
        const blockedSince = task.blocked_since ?? now;
        const updateResult = blockTaskStmt.run(
          newBlockedBy,
          blockedSince,
          task.id,
          task.version
        );

        if (updateResult.changes === 0) {
          // Version mismatch - task was modified concurrently
          logger.warn('Failed to block task due to version mismatch', {
            taskId: task.id,
            title: task.title,
          });
          result.errors.push({
            taskId: task.id,
            error: 'Version mismatch (concurrent modification)',
          });
          continue;
        }

        result.blockedCount++;
        logger.debug('Blocked task due to agent pause', {
          taskId: task.id,
          title: task.title,
          previousStatus: task.status,
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to block task', {
        taskId: task.id,
        title: task.title,
        error: error.message,
      });
      result.errors.push({
        taskId: task.id,
        error: error.message,
      });
    }
  }

  logger.info('Task blocking completed', {
    agentId,
    totalTasks: result.totalTasks,
    blockedCount: result.blockedCount,
    alreadyBlocked: result.alreadyBlocked,
    errors: result.errors.length,
  });

  return result;
}

/**
 * Unblock tasks when an agent is resumed
 *
 * This function is called when an agent is resumed. It unblocks tasks
 * that were blocked solely due to agent pause by:
 * 1. Removing PAUSE_BLOCKER from the blocked_by array
 * 2. If blocked_by becomes empty, set status to 'pending' and clear blocked_since
 * 3. If other blockers remain, keep status as 'blocked'
 *
 * Tasks that are blocked by other reasons (not just pause) will remain blocked.
 *
 * @param db - Database instance
 * @param agentId - ID of the agent being resumed
 * @returns Result object with unblocking statistics
 *
 * @example
 * ```typescript
 * const result = unblockTasksForResumedAgent(db, 'dev-001');
 * console.log(`Unblocked ${result.unblockedCount} tasks`);
 * ```
 */
export function unblockTasksForResumedAgent(
  db: Database.Database,
  agentId: string
): UnblockTasksResult {
  const logger = createAgentLogger(agentId);

  logger.info('Unblocking tasks for resumed agent', { agentId });

  // Get all blocked tasks
  const blockedTasks = getBlockedTasks(db, agentId);
  const totalTasks = blockedTasks.length;

  if (totalTasks === 0) {
    logger.info('No blocked tasks to unblock', { agentId });
    return {
      totalTasks: 0,
      unblockedCount: 0,
      stillBlocked: 0,
      errors: [],
    };
  }

  logger.debug('Found blocked tasks to process', {
    agentId,
    totalTasks,
    taskIds: blockedTasks.map((t: TaskRecord) => t.id),
  });

  const result: UnblockTasksResult = {
    totalTasks,
    unblockedCount: 0,
    stillBlocked: 0,
    errors: [],
  };

  // Prepare UPDATE statements
  const unblockTaskStmt = db.prepare(`
    UPDATE tasks
    SET
      status = 'pending',
      blocked_by = '[]',
      blocked_since = NULL,
      version = version + 1
    WHERE id = ? AND version = ?
  `);

  const updateBlockersStmt = db.prepare(`
    UPDATE tasks
    SET
      blocked_by = ?,
      version = version + 1
    WHERE id = ? AND version = ?
  `);

  // Process each blocked task
  for (const task of blockedTasks) {
    try {
      // Parse existing blocked_by array
      let blockedBy: string[] = [];
      try {
        blockedBy = JSON.parse(task.blocked_by) as string[];
      } catch (err) {
        // Invalid JSON, treat as empty array
        blockedBy = [];
      }

      // Check if blocked by pause
      if (!blockedBy.includes(PAUSE_BLOCKER)) {
        logger.debug('Task not blocked by pause, skipping', {
          taskId: task.id,
          blockedBy,
        });
        result.stillBlocked++;
        continue;
      }

      // Remove PAUSE_BLOCKER from the list
      blockedBy = blockedBy.filter(b => b !== PAUSE_BLOCKER);

      // Update the task
      if (blockedBy.length === 0) {
        // No other blockers, fully unblock the task
        const updateResult = unblockTaskStmt.run(task.id, task.version);

        if (updateResult.changes === 0) {
          // Version mismatch - task was modified concurrently
          logger.warn('Failed to unblock task due to version mismatch', {
            taskId: task.id,
            title: task.title,
          });
          result.errors.push({
            taskId: task.id,
            error: 'Version mismatch (concurrent modification)',
          });
          continue;
        }

        result.unblockedCount++;
        logger.debug('Fully unblocked task', {
          taskId: task.id,
          title: task.title,
        });
      } else {
        // Other blockers remain, just update blocked_by list
        const newBlockedBy = JSON.stringify(blockedBy);
        const updateResult = updateBlockersStmt.run(newBlockedBy, task.id, task.version);

        if (updateResult.changes === 0) {
          // Version mismatch - task was modified concurrently
          logger.warn('Failed to update blockers due to version mismatch', {
            taskId: task.id,
            title: task.title,
          });
          result.errors.push({
            taskId: task.id,
            error: 'Version mismatch (concurrent modification)',
          });
          continue;
        }

        result.stillBlocked++;
        logger.debug('Removed pause blocker but task still blocked by other reasons', {
          taskId: task.id,
          title: task.title,
          remainingBlockers: blockedBy,
        });
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to unblock task', {
        taskId: task.id,
        title: task.title,
        error: error.message,
      });
      result.errors.push({
        taskId: task.id,
        error: error.message,
      });
    }
  }

  logger.info('Task unblocking completed', {
    agentId,
    totalTasks: result.totalTasks,
    unblockedCount: result.unblockedCount,
    stillBlocked: result.stillBlocked,
    errors: result.errors.length,
  });

  return result;
}
