/**
 * Schedule Manager
 *
 * This module provides functionality to manage scheduled jobs in RecursiveManager.
 * It supports cron-based scheduling for periodic tasks like archiving old tasks.
 *
 * Implements Task 2.3.18: Schedule daily archival job (tasks > 7 days old)
 */

import type { Database } from 'better-sqlite3';
import { parseExpression } from 'cron-parser';
import { v4 as uuidv4 } from 'uuid';

/**
 * Schedule trigger types
 */
export type ScheduleTriggerType = 'continuous' | 'cron' | 'reactive';

/**
 * Schedule record from the database
 */
export interface ScheduleRecord {
  id: string;
  agent_id: string;
  trigger_type: ScheduleTriggerType;
  description: string | null;
  cron_expression: string | null;
  timezone: string;
  next_execution_at: string | null;
  minimum_interval_seconds: number | null;
  only_when_tasks_pending: number;
  enabled: number;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a cron schedule
 */
export interface CreateCronScheduleInput {
  agentId: string;
  description: string;
  cronExpression: string;
  timezone?: string;
  enabled?: boolean;
}

/**
 * ScheduleManager class
 *
 * Manages scheduled jobs using cron expressions and the schedules database table.
 */
export class ScheduleManager {
  constructor(private db: Database) {}

  /**
   * Create a new cron-based schedule
   *
   * @param input - Schedule creation input
   * @returns The created schedule ID
   *
   * @example
   * ```typescript
   * const manager = new ScheduleManager(db);
   * const scheduleId = manager.createCronSchedule({
   *   agentId: 'system',
   *   description: 'Archive tasks older than 7 days',
   *   cronExpression: '0 2 * * *', // 2 AM daily
   *   timezone: 'UTC'
   * });
   * ```
   */
  createCronSchedule(input: CreateCronScheduleInput): string {
    // Validate cron expression by trying to parse it
    try {
      parseExpression(input.cronExpression, {
        tz: input.timezone || 'UTC',
      });
    } catch (error) {
      throw new Error(
        `Invalid cron expression "${input.cronExpression}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    const scheduleId = uuidv4();
    const timezone = input.timezone || 'UTC';
    const enabled = input.enabled !== false ? 1 : 0;

    // Calculate next execution time
    const nextExecution = this.calculateNextExecution(
      input.cronExpression,
      timezone
    );

    const stmt = this.db.prepare(`
      INSERT INTO schedules (
        id,
        agent_id,
        trigger_type,
        description,
        cron_expression,
        timezone,
        next_execution_at,
        enabled,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      scheduleId,
      input.agentId,
      'cron',
      input.description,
      input.cronExpression,
      timezone,
      nextExecution,
      enabled
    );

    return scheduleId;
  }

  /**
   * Calculate the next execution time for a cron expression
   *
   * @param cronExpression - The cron expression
   * @param timezone - The timezone (default: UTC)
   * @returns ISO 8601 timestamp of next execution
   */
  private calculateNextExecution(
    cronExpression: string,
    timezone: string = 'UTC'
  ): string {
    const interval = parseExpression(cronExpression, {
      tz: timezone,
      currentDate: new Date(),
    });
    const nextDate = interval.next().toDate();
    return nextDate.toISOString();
  }

  /**
   * Get all schedules ready to execute
   *
   * Returns all enabled schedules where next_execution_at is in the past.
   *
   * @returns Array of schedule records ready to execute
   */
  getSchedulesReadyToExecute(): ScheduleRecord[] {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT
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
        last_triggered_at,
        created_at,
        updated_at
      FROM schedules
      WHERE enabled = 1
        AND next_execution_at IS NOT NULL
        AND next_execution_at <= ?
      ORDER BY next_execution_at ASC
    `);

    return stmt.all(now) as ScheduleRecord[];
  }

  /**
   * Update schedule after execution
   *
   * Updates last_triggered_at and calculates the next execution time.
   *
   * @param scheduleId - The schedule ID
   */
  updateScheduleAfterExecution(scheduleId: string): void {
    // Get the schedule
    const schedule = this.db
      .prepare(
        `
      SELECT cron_expression, timezone
      FROM schedules
      WHERE id = ?
    `
      )
      .get(scheduleId) as Pick<ScheduleRecord, 'cron_expression' | 'timezone'> | undefined;

    if (!schedule || !schedule.cron_expression) {
      throw new Error(`Schedule ${scheduleId} not found or not a cron schedule`);
    }

    // Calculate next execution
    const nextExecution = this.calculateNextExecution(
      schedule.cron_expression,
      schedule.timezone
    );

    // Update the schedule
    const stmt = this.db.prepare(`
      UPDATE schedules
      SET last_triggered_at = CURRENT_TIMESTAMP,
          next_execution_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(nextExecution, scheduleId);
  }

  /**
   * Get a schedule by ID
   *
   * @param scheduleId - The schedule ID
   * @returns The schedule record or undefined if not found
   */
  getScheduleById(scheduleId: string): ScheduleRecord | undefined {
    const stmt = this.db.prepare(`
      SELECT
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
        last_triggered_at,
        created_at,
        updated_at
      FROM schedules
      WHERE id = ?
    `);

    return stmt.get(scheduleId) as ScheduleRecord | undefined;
  }

  /**
   * Get all schedules for an agent
   *
   * @param agentId - The agent ID
   * @returns Array of schedule records
   */
  getSchedulesByAgentId(agentId: string): ScheduleRecord[] {
    const stmt = this.db.prepare(`
      SELECT
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
        last_triggered_at,
        created_at,
        updated_at
      FROM schedules
      WHERE agent_id = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(agentId) as ScheduleRecord[];
  }

  /**
   * Enable a schedule
   *
   * @param scheduleId - The schedule ID
   */
  enableSchedule(scheduleId: string): void {
    const stmt = this.db.prepare(`
      UPDATE schedules
      SET enabled = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(scheduleId);
  }

  /**
   * Disable a schedule
   *
   * @param scheduleId - The schedule ID
   */
  disableSchedule(scheduleId: string): void {
    const stmt = this.db.prepare(`
      UPDATE schedules
      SET enabled = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(scheduleId);
  }

  /**
   * Delete a schedule
   *
   * @param scheduleId - The schedule ID
   */
  deleteSchedule(scheduleId: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM schedules
      WHERE id = ?
    `);

    stmt.run(scheduleId);
  }

  /**
   * Register the daily archival job
   *
   * Creates a schedule that runs daily at 2 AM UTC to archive tasks older than 7 days.
   * If a schedule with the same description already exists, it will not create a duplicate.
   *
   * @param agentId - The agent ID (typically 'system')
   * @returns The schedule ID (existing or newly created)
   *
   * @example
   * ```typescript
   * const manager = new ScheduleManager(db);
   * const scheduleId = manager.registerDailyArchivalJob('system');
   * console.log(`Archival job registered with ID: ${scheduleId}`);
   * ```
   */
  registerDailyArchivalJob(agentId: string = 'system'): string {
    const description = 'Archive tasks older than 7 days';

    // Check if a schedule with this description already exists for this agent
    const existing = this.db
      .prepare(
        `
      SELECT id FROM schedules
      WHERE agent_id = ? AND description = ?
    `
      )
      .get(agentId, description) as { id: string } | undefined;

    if (existing) {
      return existing.id;
    }

    // Create new schedule: daily at 2 AM UTC
    return this.createCronSchedule({
      agentId,
      description,
      cronExpression: '0 2 * * *',
      timezone: 'UTC',
      enabled: true,
    });
  }
}
