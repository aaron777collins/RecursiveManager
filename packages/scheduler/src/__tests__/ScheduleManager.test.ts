/**
 * Tests for ScheduleManager
 *
 * Tests the schedule management functionality including cron scheduling,
 * schedule execution tracking, and the daily archival job registration.
 */

import { ScheduleManager } from '../ScheduleManager';
import type { Database } from 'better-sqlite3';
import SqliteDatabase from 'better-sqlite3';
import { runMigrations, allMigrations } from '@recursive-manager/common';
import * as fs from 'fs';
import * as path from 'path';

describe('ScheduleManager', () => {
  let db: Database;
  let scheduleManager: ScheduleManager;
  let testDbPath: string;

  beforeEach(() => {
    // Create a temporary database for testing
    testDbPath = path.join(__dirname, `test-${Date.now()}.db`);
    db = new SqliteDatabase(testDbPath);

    // Apply migrations
    runMigrations(db, allMigrations);

    // Create test agents required for foreign key constraints
    const insertAgent = db.prepare(`
      INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'active', ?, ?)
    `);

    insertAgent.run('test-agent', 'test', 'Test Agent', 'Test goals', '/tmp/test-agent');
    insertAgent.run('system', 'system', 'System Agent', 'System operations', '/tmp/system');
    insertAgent.run('other-agent', 'test', 'Other Agent', 'Test goals', '/tmp/other-agent');

    // Create schedule manager
    scheduleManager = new ScheduleManager(db);
  });

  afterEach(() => {
    // Close database
    db.close();

    // Delete test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('createCronSchedule', () => {
    it('should create a cron schedule with valid expression', () => {
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Test daily job',
        cronExpression: '0 2 * * *', // 2 AM daily
        timezone: 'UTC',
      });

      expect(scheduleId).toBeDefined();
      expect(typeof scheduleId).toBe('string');

      // Verify schedule was created
      const schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule).toBeDefined();
      expect(schedule?.agent_id).toBe('test-agent');
      expect(schedule?.description).toBe('Test daily job');
      expect(schedule?.cron_expression).toBe('0 2 * * *');
      expect(schedule?.timezone).toBe('UTC');
      expect(schedule?.enabled).toBe(1);
      expect(schedule?.next_execution_at).toBeDefined();
    });

    it('should throw error for invalid cron expression', () => {
      expect(() => {
        scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Invalid cron',
          cronExpression: 'invalid cron',
        });
      }).toThrow(/Invalid cron expression/);
    });

    it('should use UTC as default timezone', () => {
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Test job',
        cronExpression: '0 0 * * *',
      });

      const schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule?.timezone).toBe('UTC');
    });

    it('should create schedule as enabled by default', () => {
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Test job',
        cronExpression: '0 0 * * *',
      });

      const schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule?.enabled).toBe(1);
    });

    it('should create schedule as disabled when specified', () => {
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Test job',
        cronExpression: '0 0 * * *',
        enabled: false,
      });

      const schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule?.enabled).toBe(0);
    });

    it('should calculate next_execution_at correctly', () => {
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Test job',
        cronExpression: '0 0 1 1 *', // Jan 1st at midnight
        timezone: 'UTC',
      });

      const schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule?.next_execution_at).toBeDefined();

      // Should be a valid ISO timestamp
      const nextDate = new Date(schedule!.next_execution_at!);
      expect(nextDate).toBeInstanceOf(Date);
      expect(nextDate.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('getSchedulesReadyToExecute', () => {
    it('should return empty array when no schedules are ready', () => {
      // Create a schedule in the future (Jan 1st at midnight)
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Future job',
        cronExpression: '0 0 1 1 *', // Jan 1st at midnight every year
      });

      // Manually set next_execution_at to far future to ensure it's not ready
      const updateStmt = db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?');
      updateStmt.run('2099-01-01T00:00:00.000Z', scheduleId);

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();
      expect(readySchedules).toEqual([]);
    });

    it('should return schedules with past execution times', () => {
      // Create a schedule and manually set next_execution_at to the past
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Past job',
        cronExpression: '0 0 * * *',
      });

      // Manually set next_execution_at to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
        yesterday.toISOString(),
        scheduleId
      );

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();
      expect(readySchedules.length).toBe(1);
      expect(readySchedules[0]?.id).toBe(scheduleId);
    });

    it('should not return disabled schedules', () => {
      // Create a disabled schedule with past execution time
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Disabled job',
        cronExpression: '0 0 * * *',
        enabled: false,
      });

      // Manually set next_execution_at to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
        yesterday.toISOString(),
        scheduleId
      );

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();
      expect(readySchedules).toEqual([]);
    });

    it('should return schedules ordered by next_execution_at', () => {
      // Create two schedules with different past times
      const schedule1 = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Job 1',
        cronExpression: '0 0 * * *',
      });

      const schedule2 = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Job 2',
        cronExpression: '0 0 * * *',
      });

      // Set schedule1 to 2 days ago, schedule2 to 1 day ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
        twoDaysAgo.toISOString(),
        schedule1
      );
      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
        oneDayAgo.toISOString(),
        schedule2
      );

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();
      expect(readySchedules.length).toBe(2);
      expect(readySchedules[0]?.id).toBe(schedule1); // Oldest first
      expect(readySchedules[1]?.id).toBe(schedule2);
    });
  });

  describe('updateScheduleAfterExecution', () => {
    it('should update last_triggered_at and next_execution_at', () => {
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Test job',
        cronExpression: '0 0 * * *', // Daily at midnight
      });

      const scheduleBefore = scheduleManager.getScheduleById(scheduleId);
      const nextExecutionBefore = scheduleBefore!.next_execution_at;

      // Update after execution
      scheduleManager.updateScheduleAfterExecution(scheduleId);

      const scheduleAfter = scheduleManager.getScheduleById(scheduleId);
      expect(scheduleAfter!.last_triggered_at).toBeDefined();
      expect(scheduleAfter!.next_execution_at).not.toBe(nextExecutionBefore);

      // Next execution should be in the future
      const nextDate = new Date(scheduleAfter!.next_execution_at!);
      expect(nextDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('should throw error for non-existent schedule', () => {
      expect(() => {
        scheduleManager.updateScheduleAfterExecution('non-existent-id');
      }).toThrow(/not found/);
    });
  });

  describe('getScheduleById', () => {
    it('should return schedule by ID', () => {
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Test job',
        cronExpression: '0 0 * * *',
      });

      const schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule).toBeDefined();
      expect(schedule?.id).toBe(scheduleId);
    });

    it('should return undefined for non-existent ID', () => {
      const schedule = scheduleManager.getScheduleById('non-existent-id');
      expect(schedule).toBeUndefined();
    });
  });

  describe('getSchedulesByAgentId', () => {
    it('should return all schedules for an agent', () => {
      const agentId = 'test-agent';

      scheduleManager.createCronSchedule({
        agentId,
        description: 'Job 1',
        cronExpression: '0 0 * * *',
      });

      scheduleManager.createCronSchedule({
        agentId,
        description: 'Job 2',
        cronExpression: '0 1 * * *',
      });

      scheduleManager.createCronSchedule({
        agentId: 'other-agent',
        description: 'Job 3',
        cronExpression: '0 2 * * *',
      });

      const schedules = scheduleManager.getSchedulesByAgentId(agentId);
      expect(schedules.length).toBe(2);
      expect(schedules.every((s) => s.agent_id === agentId)).toBe(true);
    });

    it('should return empty array for agent with no schedules', () => {
      const schedules = scheduleManager.getSchedulesByAgentId('no-schedules-agent');
      expect(schedules).toEqual([]);
    });
  });

  describe('enableSchedule', () => {
    it('should enable a disabled schedule', () => {
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Test job',
        cronExpression: '0 0 * * *',
        enabled: false,
      });

      let schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule?.enabled).toBe(0);

      scheduleManager.enableSchedule(scheduleId);

      schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule?.enabled).toBe(1);
    });
  });

  describe('disableSchedule', () => {
    it('should disable an enabled schedule', () => {
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Test job',
        cronExpression: '0 0 * * *',
      });

      let schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule?.enabled).toBe(1);

      scheduleManager.disableSchedule(scheduleId);

      schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule?.enabled).toBe(0);
    });
  });

  describe('deleteSchedule', () => {
    it('should delete a schedule', () => {
      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'test-agent',
        description: 'Test job',
        cronExpression: '0 0 * * *',
      });

      let schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule).toBeDefined();

      scheduleManager.deleteSchedule(scheduleId);

      schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule).toBeUndefined();
    });
  });

  describe('registerDailyArchivalJob', () => {
    it('should register daily archival job with correct parameters', () => {
      const scheduleId = scheduleManager.registerDailyArchivalJob('system');

      expect(scheduleId).toBeDefined();

      const schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule).toBeDefined();
      expect(schedule?.agent_id).toBe('system');
      expect(schedule?.description).toBe('Archive tasks older than 7 days');
      expect(schedule?.cron_expression).toBe('0 2 * * *'); // 2 AM daily
      expect(schedule?.timezone).toBe('UTC');
      expect(schedule?.enabled).toBe(1);
    });

    it('should not create duplicate jobs', () => {
      const scheduleId1 = scheduleManager.registerDailyArchivalJob('system');
      const scheduleId2 = scheduleManager.registerDailyArchivalJob('system');

      // Should return the same ID
      expect(scheduleId1).toBe(scheduleId2);

      // Should only be one schedule with this description
      const schedules = scheduleManager.getSchedulesByAgentId('system');
      const archivalSchedules = schedules.filter(
        (s) => s.description === 'Archive tasks older than 7 days'
      );
      expect(archivalSchedules.length).toBe(1);
    });

    it('should use default agent ID if not specified', () => {
      const scheduleId = scheduleManager.registerDailyArchivalJob();

      const schedule = scheduleManager.getScheduleById(scheduleId);
      expect(schedule?.agent_id).toBe('system');
    });
  });
});
