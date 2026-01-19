/**
 * Migration 001: Create agents table with indexes
 *
 * This migration creates the core agents table that stores agent metadata
 * and configuration references. This is the foundational table for the
 * entire agent hierarchy system.
 *
 * Indexes:
 * - idx_status: For filtering agents by status (active, paused, fired)
 * - idx_reporting_to: For hierarchical queries (finding subordinates)
 * - idx_created_at: For chronological queries and analytics
 */

import { Migration } from '../migrations';

export const migration001: Migration = {
  version: 1,
  description: 'Create agents table with indexes',

  up: [
    // Create agents table
    `
    CREATE TABLE agents (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL,
      created_by TEXT,
      reporting_to TEXT REFERENCES agents(id),
      status TEXT NOT NULL DEFAULT 'active',
      main_goal TEXT NOT NULL,
      config_path TEXT NOT NULL,
      last_execution_at TIMESTAMP,
      total_executions INTEGER DEFAULT 0,
      total_runtime_minutes INTEGER DEFAULT 0
    )
    `,

    // Create index on status for filtering
    `
    CREATE INDEX idx_status ON agents(status)
    `,

    // Create index on reporting_to for hierarchical queries
    `
    CREATE INDEX idx_reporting_to ON agents(reporting_to)
    `,

    // Create index on created_at for chronological queries
    `
    CREATE INDEX idx_created_at ON agents(created_at)
    `,
  ],

  down: [
    // Drop indexes first
    'DROP INDEX IF EXISTS idx_created_at',
    'DROP INDEX IF EXISTS idx_reporting_to',
    'DROP INDEX IF EXISTS idx_status',

    // Drop table
    'DROP TABLE IF EXISTS agents',
  ],
};
