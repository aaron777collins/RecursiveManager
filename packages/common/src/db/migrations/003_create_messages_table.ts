/**
 * Migration 003: Create messages table with indexes
 *
 * This migration creates the messages table that stores message metadata
 * for communication between agents and external channels (Slack, Telegram, Email).
 * Messages are stored in the database for quick queries, while the full message
 * content is stored as markdown files in agent inbox/outbox directories.
 *
 * Indexes:
 * - idx_messages_to_unread: Composite index for querying unread messages by recipient
 * - idx_messages_timestamp: For chronological queries and message ordering
 * - idx_messages_channel: For filtering messages by communication channel
 */

import { Migration } from '../migrations';

export const migration003: Migration = {
  version: 3,
  description: 'Create messages table with indexes',

  up: [
    // Create messages table
    `
    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      from_agent_id TEXT NOT NULL,
      to_agent_id TEXT NOT NULL REFERENCES agents(id),
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

    // Create composite index for querying unread messages by recipient
    // Most common query: "Give me all unread messages for agent X"
    `
    CREATE INDEX idx_messages_to_unread ON messages(to_agent_id, read)
    `,

    // Create index on timestamp for chronological ordering
    `
    CREATE INDEX idx_messages_timestamp ON messages(timestamp)
    `,

    // Create index on channel for filtering by communication source
    `
    CREATE INDEX idx_messages_channel ON messages(channel)
    `,
  ],

  down: [
    // Drop indexes first
    'DROP INDEX IF EXISTS idx_messages_channel',
    'DROP INDEX IF EXISTS idx_messages_timestamp',
    'DROP INDEX IF EXISTS idx_messages_to_unread',

    // Drop table
    'DROP TABLE IF EXISTS messages',
  ],
};
