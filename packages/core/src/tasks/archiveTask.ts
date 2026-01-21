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
import { getAgentDirectory, type PathOptions } from '@recursivemanager/common';
import { moveTaskDirectory } from './createTaskDirectory';
import type { TaskRecord, TaskStatus } from '@recursivemanager/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar';

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
 * @param options - Path options for resolving agent directories
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
export async function archiveOldTasks(db: Database, olderThanDays: number = 7, options: PathOptions = {}): Promise<number> {
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
      const archiveStatus = `archive/${year}-${month}` as TaskStatus;

      // Move the task directory from completed/ to archive/{YYYY-MM}/
      await moveTaskDirectory(task.agent_id, task.id, 'completed' as TaskStatus, archiveStatus, options);

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
export function getCompletedTasks(db: Database, agentId?: string): TaskRecord[] {
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

/**
 * Compress old archived task directories into .tar.gz files
 *
 * This function:
 * 1. Queries all archived tasks older than the specified number of days
 * 2. For each archived task, checks if its directory exists and hasn't been compressed
 * 3. Creates a tar.gz archive of the task directory
 * 4. Removes the original directory after successful compression
 * 5. Returns the count of compressed tasks
 *
 * This implements Task 2.3.19 from the implementation plan.
 *
 * @param db - Database instance
 * @param olderThanDays - Compress archives older than this many days (default: 90)
 * @param options - Path options for resolving agent directories
 * @returns Promise that resolves to count of tasks compressed
 *
 * @example
 * ```typescript
 * const db = getDatabase();
 *
 * // Compress archives older than 90 days
 * const count = await compressOldArchives(db);
 * console.log(`Compressed ${count} archived tasks`);
 *
 * // Compress archives older than 180 days
 * const count180 = await compressOldArchives(db, 180);
 * console.log(`Compressed ${count180} archived tasks older than 180 days`);
 * ```
 */
export async function compressOldArchives(
  db: Database,
  olderThanDays: number = 90,
  options: PathOptions = {}
): Promise<number> {
  // Calculate the cutoff date
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  const cutoffIso = cutoffDate.toISOString();

  // Query all archived tasks older than the cutoff date
  const query = db.prepare(`
    SELECT
      id,
      agent_id,
      title,
      status,
      completed_at,
      task_path
    FROM tasks
    WHERE status = 'archived'
      AND completed_at IS NOT NULL
      AND completed_at < ?
    ORDER BY completed_at ASC
  `);

  const tasksToCompress = query.all(cutoffIso) as TaskRecord[];

  if (tasksToCompress.length === 0) {
    return 0;
  }

  let compressedCount = 0;

  // Process each task
  for (const task of tasksToCompress) {
    try {
      // Get the archive directory path
      const completedDate = new Date(task.completed_at!);
      const year = completedDate.getFullYear();
      const month = String(completedDate.getMonth() + 1).padStart(2, '0');
      const archiveYearMonth = `${year}-${month}`;

      // Construct the task directory path
      const agentDir = getAgentDirectory(task.agent_id, options);
      const taskDir = path.join(agentDir, 'tasks', 'archive', archiveYearMonth, task.id);

      // Check if the directory exists (and hasn't been compressed already)
      try {
        await fs.access(taskDir);
      } catch {
        // Directory doesn't exist (already compressed or deleted), skip
        continue;
      }

      // Check if the compressed file already exists
      const compressedFile = `${taskDir}.tar.gz`;
      try {
        await fs.access(compressedFile);
        // Compressed file already exists, remove the original directory and skip
        await fs.rm(taskDir, { recursive: true, force: true });
        compressedCount++;
        continue;
      } catch {
        // Compressed file doesn't exist, proceed with compression
      }

      // Create tar.gz archive
      await compressDirectory(taskDir, compressedFile);

      // Verify the compressed file was created
      await fs.access(compressedFile);

      // Remove the original directory
      await fs.rm(taskDir, { recursive: true, force: true });

      compressedCount++;
    } catch (error) {
      // Log the error but continue processing other tasks
      console.error(
        `Failed to compress archived task ${task.id}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return compressedCount;
}

/**
 * Compress a directory into a tar.gz file
 *
 * Uses the 'tar' npm package to create a proper tar.gz archive.
 *
 * @param sourceDir - Directory to compress
 * @param outputFile - Output .tar.gz file path
 */
async function compressDirectory(sourceDir: string, outputFile: string): Promise<void> {
  // Get the parent directory and the directory name
  const parentDir = path.dirname(sourceDir);
  const dirName = path.basename(sourceDir);

  // Create tar.gz archive using the tar library
  await tar.create(
    {
      gzip: true,
      file: outputFile,
      cwd: parentDir,
    },
    [dirName]
  );
}
