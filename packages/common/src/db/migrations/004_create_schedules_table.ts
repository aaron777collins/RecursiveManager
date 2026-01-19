/**
 * Migration 004: Create schedules table with indexes
 *
 * This migration creates the schedules table that stores scheduling configuration
 * for agent execution. Agents can have multiple schedules with different trigger types:
 * - continuous: Run continuously when tasks are pending
 * - cron: Time-based execution with cron expressions
 * - reactive: Event-driven execution from external triggers
 *
 * The database table stores schedule metadata while the full schedule configuration
 * is stored in the agent's schedule.json file.
 *
 * Indexes:
 * - idx_schedules_agent: For querying all schedules for a specific agent
 * - idx_schedules_next_execution: For scheduler to find schedules ready to execute
 * - idx_schedules_enabled: For filtering active schedules
 */

import { Migration } from '../migrations';

export const migration004: Migration = {
  version: 4,
  description: 'Create schedules table with indexes',

  up: [
    // Create schedules table
    `
    CREATE TABLE schedules (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      trigger_type TEXT NOT NULL,
      description TEXT,

      -- For cron triggers
      cron_expression TEXT,
      timezone TEXT DEFAULT 'UTC',
      next_execution_at TIMESTAMP,

      -- For continuous triggers
      minimum_interval_seconds INTEGER,
      only_when_tasks_pending INTEGER DEFAULT 1,

      -- Status
      enabled INTEGER DEFAULT 1,
      last_triggered_at TIMESTAMP,

      -- Timestamp tracking
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `,

    // Create index on agent_id for querying schedules by agent
    // Common query: "Give me all schedules for agent X"
    `
    CREATE INDEX idx_schedules_agent ON schedules(agent_id)
    `,

    // Create index on next_execution_at for scheduler
    // Most important query: "Which schedules should run next?"
    `
    CREATE INDEX idx_schedules_next_execution ON schedules(next_execution_at)
    `,

    // Create index on enabled for filtering active schedules
    `
    CREATE INDEX idx_schedules_enabled ON schedules(enabled)
    `,
  ],

  down: [
    // Drop indexes first
    'DROP INDEX IF EXISTS idx_schedules_enabled',
    'DROP INDEX IF EXISTS idx_schedules_next_execution',
    'DROP INDEX IF EXISTS idx_schedules_agent',

    // Drop table
    'DROP TABLE IF EXISTS schedules',
  ],
};
