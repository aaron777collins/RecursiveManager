/**
 * Migration 005: Create audit_log table with indexes
 *
 * This migration creates the audit_log table that provides an immutable audit trail
 * of all critical operations in the system. Every important action (hiring, firing,
 * executing agents, sending messages, etc.) is logged with timestamp, actor, target,
 * success status, and detailed context.
 *
 * This table is critical for:
 * - Security auditing and compliance
 * - Debugging recursive agent hierarchies
 * - Understanding execution history
 * - Detecting anomalous behavior patterns
 *
 * The audit log is append-only and should never be modified after creation.
 *
 * Indexes:
 * - idx_audit_log_timestamp: For querying events in chronological order
 * - idx_audit_log_agent: For finding all actions performed by a specific agent
 * - idx_audit_log_action: For filtering by action type (hire, fire, execute, etc.)
 */

import { Migration } from '../migrations';

export const migration005: Migration = {
  version: 5,
  description: 'Create audit_log table with indexes',

  up: [
    // Create audit_log table
    `
    CREATE TABLE audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      agent_id TEXT REFERENCES agents(id),
      action TEXT NOT NULL,
      target_agent_id TEXT REFERENCES agents(id),
      success INTEGER NOT NULL,
      details TEXT,

      -- No updated_at field - audit logs are immutable
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    `,

    // Create index on timestamp for chronological queries
    // Common query: "Show me all events in the last hour"
    `
    CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp)
    `,

    // Create index on agent_id for filtering by actor
    // Common query: "What did agent X do?"
    `
    CREATE INDEX idx_audit_log_agent ON audit_log(agent_id)
    `,

    // Create index on action for filtering by action type
    // Common query: "Show me all hire/fire events"
    `
    CREATE INDEX idx_audit_log_action ON audit_log(action)
    `,
  ],

  down: [
    // Drop indexes first
    'DROP INDEX IF EXISTS idx_audit_log_action',
    'DROP INDEX IF EXISTS idx_audit_log_agent',
    'DROP INDEX IF EXISTS idx_audit_log_timestamp',

    // Drop table
    'DROP TABLE IF EXISTS audit_log',
  ],
};
