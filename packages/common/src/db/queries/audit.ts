/**
 * Audit Query API (Task 1.4.8 - 1.4.11)
 *
 * This module provides database query functions for audit logging.
 * All functions use prepared statements for security and performance.
 *
 * The audit log provides an immutable trail of all critical operations,
 * supporting security auditing, debugging, and compliance requirements.
 *
 * Audit events are append-only and should never be modified after creation.
 *
 * Responsibilities:
 * - Record audit events for all critical operations
 * - Query audit logs with flexible filtering
 * - Support compliance and security analysis
 */

import Database from 'better-sqlite3';

/**
 * Standard audit action types
 *
 * These represent the major categories of operations that should be audited.
 * Use these constants to ensure consistency across the system.
 */
export const AuditAction = {
  // Agent lifecycle operations
  HIRE: 'hire',
  FIRE: 'fire',
  PAUSE: 'pause',
  RESUME: 'resume',

  // Task operations
  TASK_CREATE: 'task_create',
  TASK_UPDATE: 'task_update',
  TASK_DELEGATE: 'task_delegate',
  TASK_COMPLETE: 'task_complete',

  // Execution operations
  EXECUTE_START: 'execute_start',
  EXECUTE_END: 'execute_end',

  // Communication operations
  MESSAGE_SEND: 'message_send',
  MESSAGE_RECEIVE: 'message_receive',

  // Configuration operations
  CONFIG_UPDATE: 'config_update',

  // System operations
  SYSTEM_STARTUP: 'system_startup',
  SYSTEM_SHUTDOWN: 'system_shutdown',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Audit event input structure
 *
 * This represents the information needed to record an audit event.
 */
export interface AuditEventInput {
  /**
   * The agent performing the action (null for system events)
   */
  agentId: string | null;

  /**
   * The action being performed (use AuditAction constants)
   */
  action: AuditActionType | string;

  /**
   * The target agent affected by the action (optional)
   */
  targetAgentId?: string | null;

  /**
   * Whether the action succeeded
   */
  success: boolean;

  /**
   * Additional context details (will be JSON serialized)
   * Can include error messages, execution results, etc.
   */
  details?: Record<string, unknown> | string | null;

  /**
   * Custom timestamp (defaults to current time if not provided)
   */
  timestamp?: string;
}

/**
 * Audit event record from database
 */
export interface AuditEventRecord {
  id: number;
  timestamp: string;
  agent_id: string | null;
  action: string;
  target_agent_id: string | null;
  success: number; // SQLite stores booleans as 0/1
  details: string | null; // JSON string
  created_at: string;
}

/**
 * Audit query filter options
 */
export interface AuditQueryFilter {
  /**
   * Filter by agent performing the action
   */
  agentId?: string;

  /**
   * Filter by action type
   */
  action?: AuditActionType | string;

  /**
   * Filter by target agent
   */
  targetAgentId?: string;

  /**
   * Filter by success/failure
   */
  success?: boolean;

  /**
   * Filter events after this timestamp
   */
  startTime?: string;

  /**
   * Filter events before this timestamp
   */
  endTime?: string;

  /**
   * Maximum number of results to return
   */
  limit?: number;

  /**
   * Number of results to skip (for pagination)
   */
  offset?: number;
}

/**
 * Record an audit event
 *
 * This function writes an immutable audit log entry for any critical operation.
 * The audit log provides security, debugging, and compliance capabilities.
 *
 * Best practices:
 * - Call this at the END of an operation to record actual success/failure
 * - Include relevant context in the details field
 * - Use standard action constants from AuditAction when possible
 * - For failed operations, include error messages in details
 *
 * @param db - Database instance
 * @param event - Audit event input
 * @returns The created audit record ID
 *
 * @example
 * ```typescript
 * // Record a successful agent hire
 * auditLog(db, {
 *   agentId: 'ceo-001',
 *   action: AuditAction.HIRE,
 *   targetAgentId: 'cto-001',
 *   success: true,
 *   details: {
 *     role: 'CTO',
 *     reportingTo: 'ceo-001'
 *   }
 * });
 *
 * // Record a failed execution
 * auditLog(db, {
 *   agentId: 'worker-005',
 *   action: AuditAction.EXECUTE_END,
 *   success: false,
 *   details: {
 *     error: 'Timeout after 60 minutes',
 *     taskId: 'task-123'
 *   }
 * });
 *
 * // Record a system event (no agent)
 * auditLog(db, {
 *   agentId: null,
 *   action: AuditAction.SYSTEM_STARTUP,
 *   success: true,
 *   details: { version: '1.0.0' }
 * });
 * ```
 */
export function auditLog(db: Database.Database, event: AuditEventInput): number {
  const timestamp = event.timestamp ?? new Date().toISOString();

  // Serialize details to JSON if it's an object
  let detailsJson: string | null = null;
  if (event.details !== undefined && event.details !== null) {
    if (typeof event.details === 'string') {
      detailsJson = event.details;
    } else {
      detailsJson = JSON.stringify(event.details);
    }
  }

  const insert = db.prepare(`
    INSERT INTO audit_log (
      timestamp,
      agent_id,
      action,
      target_agent_id,
      success,
      details
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = insert.run(
    timestamp,
    event.agentId,
    event.action,
    event.targetAgentId ?? null,
    event.success ? 1 : 0,
    detailsJson
  );

  return result.lastInsertRowid as number;
}

/**
 * Query audit logs with flexible filtering
 *
 * This function allows querying audit logs with various filters for
 * security analysis, debugging, and compliance reporting.
 *
 * Results are ordered by timestamp descending (most recent first).
 *
 * @param db - Database instance
 * @param filter - Query filter options (all fields optional)
 * @returns Array of audit event records
 *
 * @example
 * ```typescript
 * // Get all actions by a specific agent
 * const agentActions = queryAuditLog(db, {
 *   agentId: 'ceo-001',
 *   limit: 100
 * });
 *
 * // Get all failed operations in the last hour
 * const recentFailures = queryAuditLog(db, {
 *   success: false,
 *   startTime: new Date(Date.now() - 3600000).toISOString(),
 *   limit: 50
 * });
 *
 * // Get all hire/fire events
 * const hireFire = queryAuditLog(db, {
 *   action: AuditAction.HIRE
 * });
 *
 * // Get events for a specific target agent
 * const targetEvents = queryAuditLog(db, {
 *   targetAgentId: 'worker-123'
 * });
 * ```
 */
export function queryAuditLog(
  db: Database.Database,
  filter: AuditQueryFilter = {}
): AuditEventRecord[] {
  // Build dynamic query based on provided filters
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (filter.agentId !== undefined) {
    conditions.push('agent_id = ?');
    values.push(filter.agentId);
  }

  if (filter.action !== undefined) {
    conditions.push('action = ?');
    values.push(filter.action);
  }

  if (filter.targetAgentId !== undefined) {
    conditions.push('target_agent_id = ?');
    values.push(filter.targetAgentId);
  }

  if (filter.success !== undefined) {
    conditions.push('success = ?');
    values.push(filter.success ? 1 : 0);
  }

  if (filter.startTime !== undefined) {
    conditions.push('timestamp >= ?');
    values.push(filter.startTime);
  }

  if (filter.endTime !== undefined) {
    conditions.push('timestamp <= ?');
    values.push(filter.endTime);
  }

  // Build WHERE clause
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Build LIMIT/OFFSET clause
  let limitClause = '';
  if (filter.limit !== undefined) {
    limitClause = `LIMIT ${filter.limit}`;
    if (filter.offset !== undefined) {
      limitClause += ` OFFSET ${filter.offset}`;
    }
  }

  // Execute query
  const query = db.prepare(`
    SELECT
      id,
      timestamp,
      agent_id,
      action,
      target_agent_id,
      success,
      details,
      created_at
    FROM audit_log
    ${whereClause}
    ORDER BY timestamp DESC
    ${limitClause}
  `);

  return query.all(...values) as AuditEventRecord[];
}

/**
 * Get recent audit events for an agent
 *
 * Convenience function to get the most recent audit events for a specific agent.
 *
 * @param db - Database instance
 * @param agentId - Agent ID
 * @param limit - Maximum number of events (default: 50)
 * @returns Array of recent audit events
 *
 * @example
 * ```typescript
 * const recentActivity = getRecentAuditEvents(db, 'ceo-001', 20);
 * ```
 */
export function getRecentAuditEvents(
  db: Database.Database,
  agentId: string,
  limit: number = 50
): AuditEventRecord[] {
  return queryAuditLog(db, { agentId, limit });
}

/**
 * Get audit statistics
 *
 * Returns summary statistics about audit events, useful for monitoring
 * system health and activity levels.
 *
 * @param db - Database instance
 * @param startTime - Optional start time for the analysis period
 * @param endTime - Optional end time for the analysis period
 * @returns Statistics object
 *
 * @example
 * ```typescript
 * // Get stats for the last 24 hours
 * const stats = getAuditStats(db, {
 *   startTime: new Date(Date.now() - 86400000).toISOString()
 * });
 * console.log(`Total events: ${stats.totalEvents}`);
 * console.log(`Success rate: ${stats.successRate}%`);
 * ```
 */
export function getAuditStats(
  db: Database.Database,
  options: { startTime?: string; endTime?: string } = {}
): {
  totalEvents: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  actionCounts: Record<string, number>;
} {
  // Build WHERE clause for time filtering
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (options.startTime) {
    conditions.push('timestamp >= ?');
    values.push(options.startTime);
  }

  if (options.endTime) {
    conditions.push('timestamp <= ?');
    values.push(options.endTime);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total counts
  const countsQuery = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_count
    FROM audit_log
    ${whereClause}
  `);

  const counts = countsQuery.get(...values) as {
    total: number;
    success_count: number;
    failure_count: number;
  };

  // Get action counts
  const actionCountsQuery = db.prepare(`
    SELECT action, COUNT(*) as count
    FROM audit_log
    ${whereClause}
    GROUP BY action
    ORDER BY count DESC
  `);

  const actionRows = actionCountsQuery.all(...values) as Array<{
    action: string;
    count: number;
  }>;

  const actionCounts: Record<string, number> = {};
  for (const row of actionRows) {
    actionCounts[row.action] = row.count;
  }

  return {
    totalEvents: counts.total,
    successCount: counts.success_count,
    failureCount: counts.failure_count,
    successRate: counts.total > 0 ? Math.round((counts.success_count / counts.total) * 100) : 0,
    actionCounts,
  };
}
