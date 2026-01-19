/**
 * Database query functions for messages
 */

import type { Database } from 'better-sqlite3';

/**
 * Message input structure for creating messages
 */
export interface MessageInput {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  timestamp: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channel: 'internal' | 'slack' | 'telegram' | 'email';
  read?: boolean;
  action_required?: boolean;
  subject?: string;
  thread_id?: string;
  in_reply_to?: string;
  external_id?: string;
  external_metadata?: string;
  message_path: string;
}

/**
 * Message record structure from database
 */
export interface MessageRecord extends MessageInput {
  read: boolean;
  action_required: boolean;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
}

/**
 * Filter options for querying messages
 */
export interface MessageFilter {
  agentId: string;
  unreadOnly?: boolean;
  channel?: string;
  priority?: string;
  actionRequiredOnly?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Create a new message record in the database
 *
 * @param db - Database connection
 * @param message - Message input data
 * @returns The created message record
 */
export function createMessage(db: Database, message: MessageInput): MessageRecord {
  const stmt = db.prepare(`
    INSERT INTO messages (
      id,
      from_agent_id,
      to_agent_id,
      timestamp,
      priority,
      channel,
      read,
      action_required,
      subject,
      thread_id,
      in_reply_to,
      external_id,
      external_metadata,
      message_path
    ) VALUES (
      @id,
      @from_agent_id,
      @to_agent_id,
      @timestamp,
      @priority,
      @channel,
      @read,
      @action_required,
      @subject,
      @thread_id,
      @in_reply_to,
      @external_id,
      @external_metadata,
      @message_path
    )
  `);

  stmt.run({
    id: message.id,
    from_agent_id: message.from_agent_id,
    to_agent_id: message.to_agent_id,
    timestamp: message.timestamp,
    priority: message.priority,
    channel: message.channel,
    read: message.read ? 1 : 0,
    action_required: message.action_required ? 1 : 0,
    subject: message.subject || null,
    thread_id: message.thread_id || null,
    in_reply_to: message.in_reply_to || null,
    external_id: message.external_id || null,
    external_metadata: message.external_metadata || null,
    message_path: message.message_path,
  });

  // Retrieve and return the created record
  return getMessage(db, message.id)!;
}

/**
 * Get a single message by ID
 *
 * @param db - Database connection
 * @param messageId - Message ID
 * @returns The message record or null if not found
 */
export function getMessage(db: Database, messageId: string): MessageRecord | null {
  const stmt = db.prepare(`
    SELECT * FROM messages WHERE id = ?
  `);

  const row = stmt.get(messageId) as any;
  if (!row) return null;

  return {
    id: row.id,
    from_agent_id: row.from_agent_id,
    to_agent_id: row.to_agent_id,
    timestamp: row.timestamp,
    priority: row.priority,
    channel: row.channel,
    read: Boolean(row.read),
    action_required: Boolean(row.action_required),
    subject: row.subject,
    thread_id: row.thread_id,
    in_reply_to: row.in_reply_to,
    external_id: row.external_id,
    external_metadata: row.external_metadata,
    read_at: row.read_at,
    archived_at: row.archived_at,
    message_path: row.message_path,
    created_at: row.created_at,
  };
}

/**
 * Get messages for an agent with optional filtering
 *
 * @param db - Database connection
 * @param filter - Filter options
 * @returns Array of message records
 */
export function getMessages(db: Database, filter: MessageFilter): MessageRecord[] {
  const conditions: string[] = ['to_agent_id = @agentId'];
  const params: Record<string, any> = { agentId: filter.agentId };

  if (filter.unreadOnly) {
    conditions.push('read = 0');
  }

  if (filter.channel) {
    conditions.push('channel = @channel');
    params.channel = filter.channel;
  }

  if (filter.priority) {
    conditions.push('priority = @priority');
    params.priority = filter.priority;
  }

  if (filter.actionRequiredOnly) {
    conditions.push('action_required = 1');
  }

  const whereClause = conditions.join(' AND ');
  const limit = filter.limit || 100;
  const offset = filter.offset || 0;

  const stmt = db.prepare(`
    SELECT * FROM messages
    WHERE ${whereClause}
    ORDER BY timestamp DESC
    LIMIT @limit OFFSET @offset
  `);

  const rows = stmt.all({
    ...params,
    limit,
    offset,
  }) as any[];

  return rows.map((row) => ({
    id: row.id,
    from_agent_id: row.from_agent_id,
    to_agent_id: row.to_agent_id,
    timestamp: row.timestamp,
    priority: row.priority,
    channel: row.channel,
    read: Boolean(row.read),
    action_required: Boolean(row.action_required),
    subject: row.subject,
    thread_id: row.thread_id,
    in_reply_to: row.in_reply_to,
    external_id: row.external_id,
    external_metadata: row.external_metadata,
    read_at: row.read_at,
    archived_at: row.archived_at,
    message_path: row.message_path,
    created_at: row.created_at,
  }));
}

/**
 * Mark a message as read
 *
 * @param db - Database connection
 * @param messageId - Message ID
 * @returns True if updated, false if not found
 */
export function markMessageAsRead(db: Database, messageId: string): boolean {
  const stmt = db.prepare(`
    UPDATE messages
    SET read = 1, read_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const result = stmt.run(messageId);
  return result.changes > 0;
}

/**
 * Mark a message as archived
 *
 * @param db - Database connection
 * @param messageId - Message ID
 * @returns True if updated, false if not found
 */
export function markMessageAsArchived(db: Database, messageId: string): boolean {
  const stmt = db.prepare(`
    UPDATE messages
    SET archived_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  const result = stmt.run(messageId);
  return result.changes > 0;
}

/**
 * Get unread message count for an agent
 *
 * @param db - Database connection
 * @param agentId - Agent ID
 * @returns Count of unread messages
 */
export function getUnreadMessageCount(db: Database, agentId: string): number {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM messages
    WHERE to_agent_id = ? AND read = 0
  `);

  const result = stmt.get(agentId) as any;
  return result.count;
}

/**
 * Delete a message (use sparingly, prefer archiving)
 *
 * @param db - Database connection
 * @param messageId - Message ID
 * @returns True if deleted, false if not found
 */
export function deleteMessage(db: Database, messageId: string): boolean {
  const stmt = db.prepare(`
    DELETE FROM messages WHERE id = ?
  `);

  const result = stmt.run(messageId);
  return result.changes > 0;
}
