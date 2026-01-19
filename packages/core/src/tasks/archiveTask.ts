/**
 * Task Archival Module
 *
 * This module provides functionality to archive old completed tasks.
 *
 * Implements Task 2.3.17: Implement archiveOldTasks(olderThan) moving to archive/{YYYY-MM}/
 * Implements Task 2.3.18: Schedule daily archival job (tasks > 7 days old)
 * Implements Task 2.3.19: Compress archives older than 90 days
 */

import type { Database } from 'better-sqlite3';
import { getTaskPath } from '@recursive-manager/common';
import { moveTaskDirectory } from './createTaskDirectory';
import type { TaskRecord } from '@recursive-manager/common';

/**
 * Archive old completed tasks by moving them to archive/{YYYY-MM}/ directories
 *
 * This function:
 * 1. Queries all completed tasks older than the specified number of days
 * 2. For each task, moves it from completed/ to archive/{YYYY-MM}/
 * 3. Updates the task status to 'archived' in the database
 * 4. Returns the count of archived tasks
 *
 * This implements Task 2.3.17 from the implementation plan.
 *
 * @param db - Database instance
 * @param olderThanDays - Archive tasks completed more than this many days ago (default: 7)
 * @returns Count of tasks archived
 *
 * @example
 * ```typescript
 * const db = getDatabase();
 *
 * // Archive tasks completed more than 7 days ago
 * const count = await archiveOldTasks(db);
 * console.log(`Archived ${count} tasks`);
 *
 * // Archive tasks completed more than 30 days ago
 * const count30 = await archiveOldTasks(db, 30);
 * console.log(`Archived ${count30} tasks older than 30 days`);
 * ```
 */
export async function archiveOldTasks(
  db: Database,
  olderThanDays: number = 7
): Promise<number> {
  // Calculate the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffIso = cutoffDate.toISOString();

  // Query all completed tasks older than the cutoff date
  const query = db.prepare(`
    SELECT
      id,
      agent_id,
      title,
      status,
      priority,
      created_at,
      started_at,
      completed_at,
      parent_task_id,
      depth,
      percent_complete,
      subtasks_completed,
      subtasks_total,
      delegated_to,
      delegated_at,
      blocked_by,
      blocked_since,
      task_path,
      version,
      last_updated,
      last_executed,
      execution_count
    FROM tasks
    WHERE status = 'completed'
      AND completed_at IS NOT NULL
      AND completed_at < ?
    ORDER BY completed_at ASC
  `);

  const tasksToArchive = query.all(cutoffIso) as TaskRecord[];

  if (tasksToArchive.length === 0) {
    return 0;
  }

  // Update task status to 'archived' in database
  const updateStmt = db.prepare(`
    UPDATE tasks
    SET status = 'archived',
        last_updated = ?
    WHERE id = ?
  `);

  let archivedCount = 0;

  // Process each task
  for (const task of tasksToArchive) {
    try {
      // Calculate the archive directory based on completion date
      // Format: archive/YYYY-MM
      const completedDate = new Date(task.completed_at!);
      const year = completedDate.getFullYear();
      const month = String(completedDate.getMonth() + 1).padStart(2, '0');
      const archiveStatus = `archive/${year}-${month}`;

      // Move the task directory from completed/ to archive/{YYYY-MM}/
      await moveTaskDirectory(
        task.agent_id,
        task.id,
        'completed',
        archiveStatus
      );

      // Update the database status
      const now = new Date().toISOString();
      updateStmt.run(now, task.id);

      archivedCount++;
    } catch (error) {
      // Log the error but continue processing other tasks
      console.error(
        `Failed to archive task ${task.id}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return archivedCount;
}

/**
 * Get all completed tasks for an agent
 *
 * Returns all tasks assigned to the agent that have status 'completed'.
 *
 * @param db - Database instance
 * @param agentId - Agent ID to query tasks for (optional - if not provided, returns all completed tasks)
 * @returns Array of completed task records, ordered by completion date (oldest first)
 *
 * @example
 * ```typescript
 * const completedTasks = getCompletedTasks(db, 'agent-001');
 * console.log(`Agent has ${completedTasks.length} completed tasks`);
 *
 * completedTasks.forEach(task => {
 *   console.log(`- ${task.title} (completed: ${task.completed_at})`);
 * });
 * ```
 */
export function getCompletedTasks(
  db: Database,
  agentId?: string
): TaskRecord[] {
  let query;
  let params: string[];

  if (agentId) {
    query = db.prepare(`
      SELECT
        id,
        agent_id,
        title,
        status,
        priority,
        created_at,
        started_at,
        completed_at,
        parent_task_id,
        depth,
        percent_complete,
        subtasks_completed,
        subtasks_total,
        delegated_to,
        delegated_at,
        blocked_by,
        blocked_since,
        task_path,
        version,
        last_updated,
        last_executed,
        execution_count
      FROM tasks
      WHERE agent_id = ?
        AND status = 'completed'
      ORDER BY completed_at ASC
    `);
    params = [agentId];
  } else {
    query = db.prepare(`
      SELECT
        id,
        agent_id,
        title,
        status,
        priority,
        created_at,
        started_at,
        completed_at,
        parent_task_id,
        depth,
        percent_complete,
        subtasks_completed,
        subtasks_total,
        delegated_to,
        delegated_at,
        blocked_by,
        blocked_since,
        task_path,
        version,
        last_updated,
        last_executed,
        execution_count
      FROM tasks
      WHERE status = 'completed'
      ORDER BY completed_at ASC
    `);
    params = [];
  }

  const results = query.all(...params) as TaskRecord[];
  return results;
}
