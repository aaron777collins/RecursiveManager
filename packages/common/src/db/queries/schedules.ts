/**
 * Schedule Query API
 *
 * This module provides database query functions for schedule management.
 * All functions use prepared statements for security and performance.
 *
 * Responsibilities:
 * - Create, read, update, delete schedules
 * - Find schedules ready to execute
 * - Update schedule execution tracking
 * - Handle schedule enabling/disabling
 */

import Database from 'better-sqlite3';

/**
 * Schedule trigger types
 */
export type ScheduleTriggerType = 'continuous' | 'cron' | 'reactive';

/**
 * Schedule record from database
 */
export interface ScheduleRecord {
  id: string;
  agent_id: string;
  trigger_type: ScheduleTriggerType;
  description: string | null;

  // For cron triggers
  cron_expression: string | null;
  timezone: string;
  next_execution_at: string | null;

  // For continuous triggers
  minimum_interval_seconds: number | null;
  only_when_tasks_pending: number;

  // Status
  enabled: number;
  last_triggered_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a schedule
 */
export interface CreateScheduleInput {
  id?: string;
  agent_id: string;
  trigger_type: ScheduleTriggerType;
  description?: string;

  // For cron triggers
  cron_expression?: string;
  timezone?: string;
  next_execution_at?: Date;

  // For continuous triggers
  minimum_interval_seconds?: number;
  only_when_tasks_pending?: boolean;

  enabled?: boolean;
}

/**
 * Get a schedule by ID
 */
export function getSchedule(
  db: Database.Database,
  id: string
): ScheduleRecord | null {
  const query = db.prepare(`
    SELECT * FROM schedules WHERE id = ?
  `);

  const result = query.get(id) as ScheduleRecord | undefined;
  return result ?? null;
}

/**
 * Get all schedules for an agent
 */
export function getSchedulesForAgent(
  db: Database.Database,
  agentId: string
): ScheduleRecord[] {
  const query = db.prepare(`
    SELECT * FROM schedules
    WHERE agent_id = ?
    ORDER BY created_at ASC
  `);

  return query.all(agentId) as ScheduleRecord[];
}

/**
 * Get all enabled schedules for an agent
 */
export function getEnabledSchedulesForAgent(
  db: Database.Database,
  agentId: string
): ScheduleRecord[] {
  const query = db.prepare(`
    SELECT * FROM schedules
    WHERE agent_id = ? AND enabled = 1
    ORDER BY created_at ASC
  `);

  return query.all(agentId) as ScheduleRecord[];
}

/**
 * Get schedules ready to execute (for cron schedules)
 *
 * Returns enabled cron schedules whose next_execution_at is in the past
 */
export function getSchedulesReadyToExecute(
  db: Database.Database,
  currentTime: Date = new Date()
): ScheduleRecord[] {
  const query = db.prepare(`
    SELECT * FROM schedules
    WHERE enabled = 1
      AND trigger_type = 'cron'
      AND next_execution_at IS NOT NULL
      AND next_execution_at <= ?
    ORDER BY next_execution_at ASC
  `);

  return query.all(currentTime.toISOString()) as ScheduleRecord[];
}

/**
 * Get continuous schedules that should be checked
 *
 * Returns enabled continuous schedules that either:
 * - Have never been triggered
 * - Were last triggered longer than minimum_interval_seconds ago
 */
export function getContinuousSchedulesReadyToCheck(
  db: Database.Database,
  currentTime: Date = new Date()
): ScheduleRecord[] {
  const query = db.prepare(`
    SELECT * FROM schedules
    WHERE enabled = 1
      AND trigger_type = 'continuous'
      AND (
        last_triggered_at IS NULL
        OR (
          minimum_interval_seconds IS NOT NULL
          AND datetime(last_triggered_at, '+' || minimum_interval_seconds || ' seconds') <= ?
        )
      )
    ORDER BY last_triggered_at ASC NULLS FIRST
  `);

  return query.all(currentTime.toISOString()) as ScheduleRecord[];
}

/**
 * Create a new schedule
 */
export function createSchedule(
  db: Database.Database,
  input: CreateScheduleInput
): ScheduleRecord {
  const id = input.id ?? `schedule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  const query = db.prepare(`
    INSERT INTO schedules (
      id,
      agent_id,
      trigger_type,
      description,
      cron_expression,
      timezone,
      next_execution_at,
      minimum_interval_seconds,
      only_when_tasks_pending,
      enabled,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  query.run(
    id,
    input.agent_id,
    input.trigger_type,
    input.description ?? null,
    input.cron_expression ?? null,
    input.timezone ?? 'UTC',
    input.next_execution_at?.toISOString() ?? null,
    input.minimum_interval_seconds ?? null,
    input.only_when_tasks_pending ? 1 : 0,
    input.enabled !== false ? 1 : 0,
    now,
    now
  );

  const created = getSchedule(db, id);
  if (!created) {
    throw new Error(`Failed to create schedule ${id}`);
  }

  return created;
}

/**
 * Update schedule after execution
 *
 * Sets last_triggered_at to current time and optionally updates next_execution_at
 * for cron schedules
 */
export function updateScheduleAfterExecution(
  db: Database.Database,
  scheduleId: string,
  nextExecutionAt?: Date
): void {
  const now = new Date().toISOString();

  if (nextExecutionAt) {
    const query = db.prepare(`
      UPDATE schedules
      SET last_triggered_at = ?,
          next_execution_at = ?,
          updated_at = ?
      WHERE id = ?
    `);

    query.run(now, nextExecutionAt.toISOString(), now, scheduleId);
  } else {
    const query = db.prepare(`
      UPDATE schedules
      SET last_triggered_at = ?,
          updated_at = ?
      WHERE id = ?
    `);

    query.run(now, now, scheduleId);
  }
}

/**
 * Update schedule next execution time (for cron schedules)
 */
export function updateScheduleNextExecution(
  db: Database.Database,
  scheduleId: string,
  nextExecutionAt: Date
): void {
  const now = new Date().toISOString();

  const query = db.prepare(`
    UPDATE schedules
    SET next_execution_at = ?,
        updated_at = ?
    WHERE id = ?
  `);

  query.run(nextExecutionAt.toISOString(), now, scheduleId);
}

/**
 * Enable a schedule
 */
export function enableSchedule(
  db: Database.Database,
  scheduleId: string
): void {
  const now = new Date().toISOString();

  const query = db.prepare(`
    UPDATE schedules
    SET enabled = 1,
        updated_at = ?
    WHERE id = ?
  `);

  query.run(now, scheduleId);
}

/**
 * Disable a schedule
 */
export function disableSchedule(
  db: Database.Database,
  scheduleId: string
): void {
  const now = new Date().toISOString();

  const query = db.prepare(`
    UPDATE schedules
    SET enabled = 0,
        updated_at = ?
    WHERE id = ?
  `);

  query.run(now, scheduleId);
}

/**
 * Delete a schedule
 */
export function deleteSchedule(
  db: Database.Database,
  scheduleId: string
): void {
  const query = db.prepare(`
    DELETE FROM schedules WHERE id = ?
  `);

  query.run(scheduleId);
}

/**
 * Delete all schedules for an agent
 */
export function deleteSchedulesForAgent(
  db: Database.Database,
  agentId: string
): void {
  const query = db.prepare(`
    DELETE FROM schedules WHERE agent_id = ?
  `);

  query.run(agentId);
}

/**
 * Update schedule description
 */
export function updateScheduleDescription(
  db: Database.Database,
  scheduleId: string,
  description: string
): void {
  const now = new Date().toISOString();

  const query = db.prepare(`
    UPDATE schedules
    SET description = ?,
        updated_at = ?
    WHERE id = ?
  `);

  query.run(description, now, scheduleId);
}

/**
 * Update cron schedule configuration
 */
export function updateCronSchedule(
  db: Database.Database,
  scheduleId: string,
  cronExpression: string,
  nextExecutionAt: Date,
  timezone: string = 'UTC'
): void {
  const now = new Date().toISOString();

  const query = db.prepare(`
    UPDATE schedules
    SET cron_expression = ?,
        next_execution_at = ?,
        timezone = ?,
        updated_at = ?
    WHERE id = ?
  `);

  query.run(cronExpression, nextExecutionAt.toISOString(), timezone, now, scheduleId);
}

/**
 * Update continuous schedule configuration
 */
export function updateContinuousSchedule(
  db: Database.Database,
  scheduleId: string,
  minimumIntervalSeconds: number,
  onlyWhenTasksPending: boolean = true
): void {
  const now = new Date().toISOString();

  const query = db.prepare(`
    UPDATE schedules
    SET minimum_interval_seconds = ?,
        only_when_tasks_pending = ?,
        updated_at = ?
    WHERE id = ?
  `);

  query.run(minimumIntervalSeconds, onlyWhenTasksPending ? 1 : 0, now, scheduleId);
}
