/**
 * Tests for ScheduleManager
 *
 * Tests the schedule management functionality including cron scheduling,
 * schedule execution tracking, and the daily archival job registration.
 */

import { ScheduleManager } from '../ScheduleManager';
import type { Database } from 'better-sqlite3';
import SqliteDatabase from 'better-sqlite3';
import { runMigrations, allMigrations } from '@recursivemanager/common';
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

  describe('Dependency Resolution', () => {
    describe('createCronSchedule with dependencies', () => {
      it('should create a schedule with dependencies', () => {
        // Create two schedules where schedule2 depends on schedule1
        const schedule1Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'First job',
          cronExpression: '0 0 * * *',
        });

        const schedule2Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Second job',
          cronExpression: '0 1 * * *',
          dependencies: [schedule1Id],
        });

        const schedule2 = scheduleManager.getScheduleById(schedule2Id);
        expect(schedule2).toBeDefined();
        expect(schedule2?.dependencies).toBe(JSON.stringify([schedule1Id]));
      });

      it('should create a schedule with multiple dependencies', () => {
        const schedule1Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'First job',
          cronExpression: '0 0 * * *',
        });

        const schedule2Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Second job',
          cronExpression: '0 1 * * *',
        });

        const schedule3Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Third job',
          cronExpression: '0 2 * * *',
          dependencies: [schedule1Id, schedule2Id],
        });

        const schedule3 = scheduleManager.getScheduleById(schedule3Id);
        expect(schedule3).toBeDefined();
        const dependencies = JSON.parse(schedule3?.dependencies || '[]');
        expect(dependencies).toHaveLength(2);
        expect(dependencies).toContain(schedule1Id);
        expect(dependencies).toContain(schedule2Id);
      });

      it('should create a schedule with no dependencies by default', () => {
        const scheduleId = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Test job',
          cronExpression: '0 0 * * *',
        });

        const schedule = scheduleManager.getScheduleById(scheduleId);
        expect(schedule?.dependencies).toBe('[]');
      });
    });

    describe('getScheduleDependencies', () => {
      it('should return dependencies for a schedule', () => {
        const schedule1Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'First job',
          cronExpression: '0 0 * * *',
        });

        const schedule2Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Second job',
          cronExpression: '0 1 * * *',
          dependencies: [schedule1Id],
        });

        const dependencies = scheduleManager.getScheduleDependencies(schedule2Id);
        expect(dependencies).toHaveLength(1);
        expect(dependencies[0]).toBe(schedule1Id);
      });

      it('should return empty array for schedule with no dependencies', () => {
        const scheduleId = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Test job',
          cronExpression: '0 0 * * *',
        });

        const dependencies = scheduleManager.getScheduleDependencies(scheduleId);
        expect(dependencies).toHaveLength(0);
      });

      it('should return empty array for non-existent schedule', () => {
        const dependencies = scheduleManager.getScheduleDependencies('non-existent-id');
        expect(dependencies).toHaveLength(0);
      });
    });

    describe('setExecutionId', () => {
      it('should set execution ID for a schedule', () => {
        const scheduleId = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Test job',
          cronExpression: '0 0 * * *',
        });

        scheduleManager.setExecutionId(scheduleId, 'exec-123');

        const schedule = scheduleManager.getScheduleById(scheduleId);
        expect(schedule?.execution_id).toBe('exec-123');
      });

      it('should clear execution ID when set to null', () => {
        const scheduleId = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Test job',
          cronExpression: '0 0 * * *',
        });

        scheduleManager.setExecutionId(scheduleId, 'exec-123');
        scheduleManager.setExecutionId(scheduleId, null);

        const schedule = scheduleManager.getScheduleById(scheduleId);
        expect(schedule?.execution_id).toBeNull();
      });
    });

    describe('getSchedulesReadyWithDependencies', () => {
      it('should return schedules with no dependencies when ready', () => {
        // Create a schedule with next_execution_at in the past
        const scheduleId = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Test job',
          cronExpression: '0 0 * * *',
        });

        // Manually set next_execution_at to past
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
          new Date(Date.now() - 1000).toISOString(),
          scheduleId
        );

        const ready = scheduleManager.getSchedulesReadyWithDependencies();
        expect(ready).toHaveLength(1);
        expect(ready[0]!.id).toBe(scheduleId);
      });

      it('should not return schedules with unfulfilled dependencies', () => {
        // Create schedule1 (dependency)
        const schedule1Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'First job',
          cronExpression: '0 0 * * *',
        });

        // Create schedule2 that depends on schedule1
        const schedule2Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Second job',
          cronExpression: '0 1 * * *',
          dependencies: [schedule1Id],
        });

        // Set both to be ready time-wise
        const pastTime = new Date(Date.now() - 1000).toISOString();
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
          pastTime,
          schedule1Id
        );
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
          pastTime,
          schedule2Id
        );

        const ready = scheduleManager.getSchedulesReadyWithDependencies();
        // Only schedule1 should be ready (no dependencies)
        expect(ready).toHaveLength(1);
        expect(ready[0]!.id).toBe(schedule1Id);
      });

      it('should return schedules when dependencies are completed', () => {
        // Create schedule1 (dependency)
        const schedule1Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'First job',
          cronExpression: '0 0 * * *',
        });

        // Create schedule2 that depends on schedule1
        const schedule2Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Second job',
          cronExpression: '0 1 * * *',
          dependencies: [schedule1Id],
        });

        // Set both to be ready time-wise
        const pastTime = new Date(Date.now() - 1000).toISOString();
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
          pastTime,
          schedule1Id
        );
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
          pastTime,
          schedule2Id
        );

        // Mark schedule1 as triggered (completed)
        db.prepare('UPDATE schedules SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?').run(
          schedule1Id
        );

        const ready = scheduleManager.getSchedulesReadyWithDependencies();
        // Both schedules should be ready now
        expect(ready).toHaveLength(2);
        const readyIds = ready.map((s) => s.id);
        expect(readyIds).toContain(schedule1Id);
        expect(readyIds).toContain(schedule2Id);
      });

      it('should not return schedules when dependencies are still executing', () => {
        // Create schedule1 (dependency)
        const schedule1Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'First job',
          cronExpression: '0 0 * * *',
        });

        // Create schedule2 that depends on schedule1
        const schedule2Id = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Second job',
          cronExpression: '0 1 * * *',
          dependencies: [schedule1Id],
        });

        // Set both to be ready time-wise
        const pastTime = new Date(Date.now() - 1000).toISOString();
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
          pastTime,
          schedule1Id
        );
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
          pastTime,
          schedule2Id
        );

        // Mark schedule1 as triggered but still executing
        db.prepare(
          'UPDATE schedules SET last_triggered_at = CURRENT_TIMESTAMP, execution_id = ? WHERE id = ?'
        ).run('exec-123', schedule1Id);

        const ready = scheduleManager.getSchedulesReadyWithDependencies();
        // Only schedule1 should be ready (it's already executing)
        // schedule2 should NOT be ready because schedule1 is still executing
        expect(ready).toHaveLength(1);
        expect(ready[0]!.id).toBe(schedule1Id);
      });

      it('should handle diamond dependencies correctly', () => {
        // Create diamond dependency structure:
        //     A
        //    / \
        //   B   C
        //    \ /
        //     D
        const scheduleAId = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Job A',
          cronExpression: '0 0 * * *',
        });

        const scheduleBId = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Job B',
          cronExpression: '0 1 * * *',
          dependencies: [scheduleAId],
        });

        const scheduleCId = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Job C',
          cronExpression: '0 1 * * *',
          dependencies: [scheduleAId],
        });

        const scheduleDId = scheduleManager.createCronSchedule({
          agentId: 'test-agent',
          description: 'Job D',
          cronExpression: '0 2 * * *',
          dependencies: [scheduleBId, scheduleCId],
        });

        // Set all to be ready time-wise
        const pastTime = new Date(Date.now() - 1000).toISOString();
        db.prepare('UPDATE schedules SET next_execution_at = ?').run(pastTime);

        // Initially, only A should be ready
        let ready = scheduleManager.getSchedulesReadyWithDependencies();
        expect(ready).toHaveLength(1);
        expect(ready[0]!.id).toBe(scheduleAId);

        // Mark A as completed
        db.prepare('UPDATE schedules SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?').run(
          scheduleAId
        );

        // Now B and C should be ready
        ready = scheduleManager.getSchedulesReadyWithDependencies();
        expect(ready).toHaveLength(3); // A, B, C
        const readyIds = ready.map((s) => s.id);
        expect(readyIds).toContain(scheduleBId);
        expect(readyIds).toContain(scheduleCId);

        // Mark B and C as completed
        db.prepare('UPDATE schedules SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?').run(
          scheduleBId
        );
        db.prepare('UPDATE schedules SET last_triggered_at = CURRENT_TIMESTAMP WHERE id = ?').run(
          scheduleCId
        );

        // Now D should be ready
        ready = scheduleManager.getSchedulesReadyWithDependencies();
        expect(ready).toHaveLength(4); // A, B, C, D
        expect(ready.map((s) => s.id)).toContain(scheduleDId);
      });
    });
  });
});
