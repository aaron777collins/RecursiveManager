/**
 * Migration 010: Add missing foreign keys and indexes
 *
 * This migration addresses critical data integrity and performance issues:
 *
 * 1. CRITICAL: Add FK constraint on messages.from_agent_id
 *    - Without this, messages can reference non-existent sender agents
 *    - Leads to orphaned messages when agents are deleted
 *    - Violates referential integrity
 *
 * 2. Add index on messages.from_agent_id
 *    - Common query: "Show me all messages sent by agent X"
 *    - Without index, requires full table scan
 *
 * 3. Add index on audit_log.target_agent_id
 *    - Common query: "Show me all actions performed on agent X"
 *    - Critical for auditing and debugging
 */

import { Migration } from '../migrations';

export const migration010: Migration = {
  version: 10,
  description: 'Add missing foreign keys and indexes for data integrity',

  up: [
    // Add FK constraint on messages.from_agent_id
    // Uses CASCADE to delete messages when sender agent is deleted
    `
    CREATE TABLE messages_new (
      id TEXT PRIMARY KEY,
      from_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      to_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      timestamp TIMESTAMP NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      channel TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      action_required INTEGER NOT NULL DEFAULT 0,

      -- Optional fields
      subject TEXT,
      thread_id TEXT,
      in_reply_to TEXT REFERENCES messages(id),
      external_id TEXT,
      read_at TIMESTAMP,
      archived_at TIMESTAMP,

      -- File path to markdown message content
      message_path TEXT NOT NULL,

      -- External metadata stored as JSON
      external_metadata TEXT,

      -- Timestamp tracking
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `,

    // Copy data from old table
    `
    INSERT INTO messages_new
    SELECT * FROM messages
    `,

    // Drop old table
    `
    DROP TABLE messages
    `,

    // Rename new table
    `
    ALTER TABLE messages_new RENAME TO messages
    `,

    // Recreate existing indexes
    `
    CREATE INDEX idx_messages_to_unread ON messages(to_agent_id, read)
    `,
    `
    CREATE INDEX idx_messages_timestamp ON messages(timestamp)
    `,
    `
    CREATE INDEX idx_messages_channel ON messages(channel)
    `,

    // Add NEW index on from_agent_id for sender queries
    `
    CREATE INDEX idx_messages_from_agent ON messages(from_agent_id)
    `,

    // Add NEW index on audit_log.target_agent_id for audit queries
    `
    CREATE INDEX idx_audit_log_target_agent ON audit_log(target_agent_id)
    `,
  ],

  down: [
    // Drop new indexes
    'DROP INDEX IF EXISTS idx_audit_log_target_agent',
    'DROP INDEX IF EXISTS idx_messages_from_agent',

    // Recreate old messages table without FK on from_agent_id
    `
    CREATE TABLE messages_old (
      id TEXT PRIMARY KEY,
      from_agent_id TEXT NOT NULL,
      to_agent_id TEXT NOT NULL REFERENCES agents(id),
      timestamp TIMESTAMP NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      channel TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0,
      action_required INTEGER NOT NULL DEFAULT 0,
      subject TEXT,
      thread_id TEXT,
      in_reply_to TEXT REFERENCES messages(id),
      external_id TEXT,
      read_at TIMESTAMP,
      archived_at TIMESTAMP,
      message_path TEXT NOT NULL,
      external_metadata TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `,
    `
    INSERT INTO messages_old SELECT * FROM messages
    `,
    `
    DROP TABLE messages
    `,
    `
    ALTER TABLE messages_old RENAME TO messages
    `,
    `
    CREATE INDEX idx_messages_to_unread ON messages(to_agent_id, read)
    `,
    `
    CREATE INDEX idx_messages_timestamp ON messages(timestamp)
    `,
    `
    CREATE INDEX idx_messages_channel ON messages(channel)
    `,
  ],
};
