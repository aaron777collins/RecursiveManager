/**
 * Migration 009: Add schedule dependencies column
 *
 * This migration adds a dependencies column to the schedules table to support
 * dependency-based execution ordering. Dependencies are stored as a JSON array
 * of schedule IDs that must complete before this schedule can execute.
 *
 * This enables the scheduler to use the ExecutionPool's dependency graph for
 * dependency-aware task scheduling.
 */

import { Migration } from '../migrations';

export const migration009: Migration = {
  version: 9,
  description: 'Add schedule dependencies column',

  up: [
    // Add dependencies column as JSON TEXT
    `
    ALTER TABLE schedules
    ADD COLUMN dependencies TEXT DEFAULT '[]'
    `,

    // Add execution_id column to track current execution in ExecutionPool
    `
    ALTER TABLE schedules
    ADD COLUMN execution_id TEXT
    `,

    // Create index on execution_id for quick lookup
    `
    CREATE INDEX idx_schedules_execution_id ON schedules(execution_id)
    `,
  ],

  down: [
    // Drop index first
    'DROP INDEX IF EXISTS idx_schedules_execution_id',

    // Drop columns (note: SQLite doesn't support DROP COLUMN directly in older versions,
    // but this should work in modern SQLite 3.35.0+)
    'ALTER TABLE schedules DROP COLUMN execution_id',
    'ALTER TABLE schedules DROP COLUMN dependencies',
  ],
};
