/**
 * Task Completion Module
 *
 * This module provides high-level task completion functionality that coordinates
 * both database updates and file system operations.
 *
 * Implements Task 2.3.15: Move completed tasks to completed/ directory
 * Implements Task 2.3.16: Notify manager of completion
 */

import type { Database } from 'better-sqlite3';
import { completeTask as dbCompleteTask, getTask } from '@recursive-manager/common';
import { moveTaskDirectory } from './createTaskDirectory';
import { notifyTaskCompletion, NotifyCompletionOptions } from './notifyCompletion';

/**
 * Complete a task with full coordination of database and file system operations
 *
 * This function:
 * 1. Updates the task status to 'completed' in the database (with optimistic locking)
 * 2. Updates parent task progress recursively
 * 3. Moves the task directory from active/ to completed/
 * 4. Notifies the manager of task completion
 *
 * This implements Task 2.3.15 and Task 2.3.16 from the implementation plan.
 *
 * @param db - Database instance
 * @param taskId - Task ID to complete
 * @param version - Current version number (for optimistic locking)
 * @param options - Optional notification settings
 * @returns Updated task record with status='completed'
 * @throws Error if task not found, version mismatch, or file move fails
 *
 * @example
 * ```typescript
 * const db = getDatabase();
 * const task = getTask(db, 'task-123');
 *
 * if (task && task.status !== 'completed') {
 *   try {
 *     const completed = await completeTaskWithFiles(db, task.id, task.version);
 *     console.log(`Task completed and moved to completed/ directory`);
 *   } catch (error) {
 *     if (error.message.includes('version mismatch')) {
 *       console.log('Concurrent modification detected, retrying...');
 *     } else {
 *       console.error('Task completion failed:', error);
 *     }
 *   }
 * }
 * ```
 */
export async function completeTaskWithFiles(
  db: Database,
  taskId: string,
  version: number,
  options?: NotifyCompletionOptions
): Promise<void> {
  // Get the task's current status before completing it
  const task = getTask(db, taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  const oldStatus = task.status;

  // Complete the task in the database (with optimistic locking)
  // This also updates parent task progress recursively
  const completedTask = dbCompleteTask(db, taskId, version);

  // Move the task directory from old status to completed
  // This implements Task 2.3.15: Move completed tasks to completed/ directory
  await moveTaskDirectory(completedTask.agent_id, taskId, oldStatus, 'completed');

  // Notify the manager of task completion
  // This implements Task 2.3.16: Notify manager of completion
  try {
    const messageId = await notifyTaskCompletion(db, completedTask, options);
    if (messageId) {
      console.log(`Manager notified of task completion: ${messageId}`);
    }
  } catch (error) {
    // Log notification failure but don't fail the entire completion
    console.error(
      `Failed to notify manager of task completion for ${taskId}:`,
      error instanceof Error ? error.message : String(error)
    );
  }
}
