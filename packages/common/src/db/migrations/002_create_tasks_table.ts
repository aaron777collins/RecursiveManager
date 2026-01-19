/**
 * Migration 002: Create tasks table with indexes
 *
 * This migration creates the tasks table that stores task metadata, hierarchy,
 * delegation, and progress tracking. Includes version field for optimistic locking
 * to prevent race conditions when multiple agents update the same task.
 *
 * Indexes:
 * - idx_agent_status: Composite index for querying tasks by agent and status
 * - idx_status: For filtering tasks by status
 * - idx_parent: For hierarchical queries (finding subtasks)
 * - idx_delegated: For finding tasks delegated to specific agents
 */

import { Migration } from '../migrations';

export const migration002: Migration = {
  version: 2,
  description: 'Create tasks table with indexes',

  up: [
    // Create tasks table
    `
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      created_at TIMESTAMP NOT NULL,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,

      -- Hierarchy
      parent_task_id TEXT REFERENCES tasks(id),
      depth INTEGER NOT NULL DEFAULT 0,

      -- Progress
      percent_complete INTEGER DEFAULT 0,
      subtasks_completed INTEGER DEFAULT 0,
      subtasks_total INTEGER DEFAULT 0,

      -- Delegation
      delegated_to TEXT REFERENCES agents(id),
      delegated_at TIMESTAMP,

      -- Blocking
      blocked_by TEXT,
      blocked_since TIMESTAMP,

      -- Paths
      task_path TEXT NOT NULL,

      -- Optimistic locking
      version INTEGER NOT NULL DEFAULT 0
    )
    `,

    // Create composite index for agent and status queries
    `
    CREATE INDEX idx_tasks_agent_status ON tasks(agent_id, status)
    `,

    // Create index on status for filtering
    `
    CREATE INDEX idx_tasks_status ON tasks(status)
    `,

    // Create index on parent_task_id for hierarchical queries
    `
    CREATE INDEX idx_tasks_parent ON tasks(parent_task_id)
    `,

    // Create index on delegated_to for delegation queries
    `
    CREATE INDEX idx_tasks_delegated ON tasks(delegated_to)
    `,
  ],

  down: [
    // Drop indexes first
    'DROP INDEX IF EXISTS idx_tasks_delegated',
    'DROP INDEX IF EXISTS idx_tasks_parent',
    'DROP INDEX IF EXISTS idx_tasks_status',
    'DROP INDEX IF EXISTS idx_tasks_agent_status',

    // Drop table
    'DROP TABLE IF EXISTS tasks',
  ],
};
