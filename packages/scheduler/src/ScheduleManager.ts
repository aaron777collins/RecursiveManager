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
import type { ExecutionPool } from '@recursive-manager/core';

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
  dependencies: string; // JSON array of schedule IDs
  execution_id: string | null; // Current execution ID in ExecutionPool
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
  dependencies?: string[]; // Array of schedule IDs that must complete before this schedule
}

/**
 * ScheduleManager class
 *
 * Manages scheduled jobs using cron expressions and the schedules database table.
 * Optionally integrates with ExecutionPool for dependency-aware scheduling.
 */
export class ScheduleManager {
  constructor(
    private db: Database,
    private executionPool?: ExecutionPool
  ) {}

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
    const dependencies = JSON.stringify(input.dependencies || []);

    // Calculate next execution time
    const nextExecution = this.calculateNextExecution(input.cronExpression, timezone);

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
        dependencies,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    stmt.run(
      scheduleId,
      input.agentId,
      'cron',
      input.description,
      input.cronExpression,
      timezone,
      nextExecution,
      enabled,
      dependencies
    );

    return scheduleId;
  }

  /**
   * Set the execution ID for a schedule
   * This links a schedule to its current execution in the ExecutionPool
   *
   * @param scheduleId - The schedule ID
   * @param executionId - The execution ID from ExecutionPool
   */
  setExecutionId(scheduleId: string, executionId: string | null): void {
    const stmt = this.db.prepare(`
      UPDATE schedules
      SET execution_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(executionId, scheduleId);
  }

  /**
   * Get schedules that have completed (execution_id is null and last_triggered_at is set)
   *
   * @returns Array of completed schedule IDs
   */
  getCompletedScheduleIds(): string[] {
    const stmt = this.db.prepare(`
      SELECT id
      FROM schedules
      WHERE execution_id IS NULL
        AND last_triggered_at IS NOT NULL
    `);

    return (stmt.all() as Array<{ id: string }>).map((row) => row.id);
  }

  /**
   * Get schedule dependencies
   *
   * @param scheduleId - The schedule ID
   * @returns Array of schedule IDs that this schedule depends on
   */
  getScheduleDependencies(scheduleId: string): string[] {
    const schedule = this.getScheduleById(scheduleId);
    if (!schedule) {
      return [];
    }

    try {
      const dependencies = JSON.parse(schedule.dependencies || '[]');
      return Array.isArray(dependencies) ? dependencies : [];
    } catch {
      return [];
    }
  }

  /**
   * Submit a schedule to the ExecutionPool with dependency tracking
   * Returns true if successful, false if ExecutionPool is not configured
   *
   * @param scheduleId - The schedule ID to submit
   * @param executionFn - The function to execute for this schedule
   * @param priority - Execution priority (default: 'medium')
   * @returns True if submitted to pool, false otherwise
   */
  async submitScheduleToPool<T>(
    scheduleId: string,
    executionFn: () => Promise<T>,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<boolean> {
    if (!this.executionPool) {
      return false;
    }

    const schedule = this.getScheduleById(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    // Get dependencies and map schedule IDs to execution IDs
    const scheduleDependencies = this.getScheduleDependencies(scheduleId);
    const executionDependencies: string[] = [];

    for (const depScheduleId of scheduleDependencies) {
      const depSchedule = this.getScheduleById(depScheduleId);
      if (depSchedule?.execution_id) {
        executionDependencies.push(depSchedule.execution_id);
      }
    }

    // Submit to execution pool (agentId is the agent_id from schedule)
    // Note: execute returns Promise<T>, not executionId
    // We'll track the execution in the background
    const executionId = `schedule-${scheduleId}-${Date.now()}`;

    // Store the execution ID in the schedule before executing
    this.setExecutionId(scheduleId, executionId);

    // Execute in background (don't await)
    this.executionPool.execute(
      schedule.agent_id,
      executionFn,
      priority,
      executionDependencies
    ).then(() => {
      // Clear execution ID when complete
      this.setExecutionId(scheduleId, null);
    }).catch(() => {
      // Clear execution ID on error
      this.setExecutionId(scheduleId, null);
    });

    return true;
  }

  /**
   * Get schedules ready to execute based on dependency resolution
   * Only returns schedules where all dependencies have completed
   *
   * @returns Array of schedule records ready to execute
   */
  getSchedulesReadyWithDependencies(): ScheduleRecord[] {
    const readySchedules = this.getSchedulesReadyToExecute();

    // Filter schedules based on dependency satisfaction
    // Always check dependencies regardless of whether execution pool exists
    return readySchedules.filter((schedule) => {
      const dependencies = this.getScheduleDependencies(schedule.id);

      // If no dependencies, schedule is ready
      if (dependencies.length === 0) {
        return true;
      }

      // Check if all dependencies have completed
      for (const depScheduleId of dependencies) {
        const depSchedule = this.getScheduleById(depScheduleId);

        // Dependency must exist, be triggered, and not have an active execution
        if (!depSchedule || !depSchedule.last_triggered_at || depSchedule.execution_id) {
          return false; // Dependency not complete
        }
      }

      return true; // All dependencies satisfied
    });
  }

  /**
   * Calculate the next execution time for a cron expression
   *
   * @param cronExpression - The cron expression
   * @param timezone - The timezone (default: UTC)
   * @returns ISO 8601 timestamp of next execution
   */
  private calculateNextExecution(cronExpression: string, timezone: string = 'UTC'): string {
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
        dependencies,
        execution_id,
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
      SELECT cron_expression, timezone, next_execution_at
      FROM schedules
      WHERE id = ?
    `
      )
      .get(scheduleId) as
      | Pick<ScheduleRecord, 'cron_expression' | 'timezone' | 'next_execution_at'>
      | undefined;

    if (!schedule || !schedule.cron_expression) {
      throw new Error(`Schedule ${scheduleId} not found or not a cron schedule`);
    }

    // Calculate next execution from the current next_execution_at time
    // This ensures we move forward from the scheduled time, not from "now"
    const currentDate = schedule.next_execution_at
      ? new Date(schedule.next_execution_at)
      : new Date();

    const interval = parseExpression(schedule.cron_expression, {
      tz: schedule.timezone,
      currentDate: currentDate,
    });
    const nextDate = interval.next().toDate();
    const nextExecution = nextDate.toISOString();

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
        dependencies,
        execution_id,
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
        dependencies,
        execution_id,
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

  /**
   * Register the deadlock monitoring job (Task 2.3.22)
   *
   * Creates a schedule that runs hourly to check for task deadlocks and send alerts.
   * If a schedule with the same description already exists, it will not create a duplicate.
   *
   * @param agentId - The agent ID (typically 'system')
   * @returns The schedule ID (existing or newly created)
   *
   * @example
   * ```typescript
   * const manager = new ScheduleManager(db);
   * const scheduleId = manager.registerDeadlockMonitoringJob('system');
   * console.log(`Deadlock monitoring job registered with ID: ${scheduleId}`);
   * ```
   */
  registerDeadlockMonitoringJob(agentId: string = 'system'): string {
    const description = 'Monitor for task deadlocks and send alerts';

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

    // Create new schedule: hourly at minute 0
    return this.createCronSchedule({
      agentId,
      description,
      cronExpression: '0 * * * *',
      timezone: 'UTC',
      enabled: true,
    });
  }
}
