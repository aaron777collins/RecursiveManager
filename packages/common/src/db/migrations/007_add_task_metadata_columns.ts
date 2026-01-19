/**
 * Migration 007: Add task metadata columns
 *
 * This migration adds metadata tracking columns to the tasks table:
 * - last_updated: Timestamp of last update to the task (any field change)
 * - last_executed: Timestamp of last execution attempt by an agent
 * - execution_count: Count of execution attempts
 *
 * These fields enable tracking task activity and execution history, which is
 * useful for debugging, monitoring agent behavior, and identifying stale tasks.
 *
 * Task 2.3.8: Update task metadata (last update timestamp, execution counts)
 */

import { Migration } from '../migrations';

export const migration007: Migration = {
  version: 7,
  description: 'Add task metadata columns',

  up: [
    // Add last_updated column - tracks any update to the task
    `
    ALTER TABLE tasks
    ADD COLUMN last_updated TIMESTAMP
    `,

    // Add last_executed column - tracks execution attempts
    `
    ALTER TABLE tasks
    ADD COLUMN last_executed TIMESTAMP
    `,

    // Add execution_count column - counts execution attempts
    `
    ALTER TABLE tasks
    ADD COLUMN execution_count INTEGER NOT NULL DEFAULT 0
    `,

    // Create index on last_updated for querying recently updated tasks
    `
    CREATE INDEX idx_tasks_last_updated ON tasks(last_updated)
    `,

    // Create index on last_executed for monitoring execution activity
    `
    CREATE INDEX idx_tasks_last_executed ON tasks(last_executed)
    `,

    // Initialize last_updated to created_at for existing tasks
    `
    UPDATE tasks
    SET last_updated = created_at
    WHERE last_updated IS NULL
    `,
  ],

  down: [
    // Drop indexes first
    'DROP INDEX IF EXISTS idx_tasks_last_executed',
    'DROP INDEX IF EXISTS idx_tasks_last_updated',

    // Drop columns (SQLite doesn't support DROP COLUMN in older versions,
    // but this works in modern SQLite 3.35.0+)
    'ALTER TABLE tasks DROP COLUMN execution_count',
    'ALTER TABLE tasks DROP COLUMN last_executed',
    'ALTER TABLE tasks DROP COLUMN last_updated',
  ],
};
