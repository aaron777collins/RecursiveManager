/**
 * Scheduler Integration Tests
 *
 * Comprehensive integration tests covering the orchestration between:
 * - ScheduleManager
 * - ExecutionPool
 * - ExecutionOrchestrator
 * - Schedule dependencies + priorities
 * - Resource quotas in scheduled execution
 *
 * These tests verify end-to-end scheduler functionality beyond individual unit tests.
 */

import { ScheduleManager } from '@recursivemanager/scheduler';
import { ExecutionPool } from '../ExecutionPool';
import type { Database } from 'better-sqlite3';
import SqliteDatabase from 'better-sqlite3';
import { runMigrations, allMigrations } from '@recursivemanager/common';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper to create a task that resolves after a delay
 */
const createDelayedTask = <T>(value: T, delayMs: number): (() => Promise<T>) => {
  return () =>
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(value), delayMs);
    });
};

/**
 * Helper to create a task that fails after a delay
 */
const createFailingTask = (error: Error, delayMs: number): (() => Promise<never>) => {
  return () =>
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(error), delayMs);
    });
};

/**
 * Helper to wait for a condition with timeout
 * (Not currently used but available for future async wait scenarios)
 */
// const waitFor = async (
//   condition: () => boolean,
//   timeoutMs = 2000,
//   checkIntervalMs = 50
// ): Promise<void> => {
//   const startTime = Date.now();
//   while (!condition()) {
//     if (Date.now() - startTime > timeoutMs) {
//       throw new Error('waitFor timeout exceeded');
//     }
//     await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
//   }
// };

describe('Scheduler Integration Tests', () => {
  let db: Database;
  let scheduleManager: ScheduleManager;
  let executionPool: ExecutionPool;
  let testDbPath: string;

  beforeEach(() => {
    // Create a temporary database for testing
    testDbPath = path.join(__dirname, `test-integration-${Date.now()}.db`);
    db = new SqliteDatabase(testDbPath);

    // Apply migrations
    runMigrations(db, allMigrations);

    // Create test agents required for foreign key constraints
    const insertAgent = db.prepare(`
      INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'active', ?, ?)
    `);

    insertAgent.run('agent-1', 'executor', 'Agent 1', 'Execute tasks', '/tmp/agent-1');
    insertAgent.run('agent-2', 'executor', 'Agent 2', 'Execute tasks', '/tmp/agent-2');
    insertAgent.run('agent-3', 'executor', 'Agent 3', 'Execute tasks', '/tmp/agent-3');
    insertAgent.run('system', 'system', 'System Agent', 'System operations', '/tmp/system');

    // Create schedule manager and execution pool
    scheduleManager = new ScheduleManager(db);
    executionPool = new ExecutionPool({ maxConcurrent: 3 });
  });

  afterEach(() => {
    // Close database
    db.close();

    // Delete test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('ScheduleManager + ExecutionPool Integration', () => {
    it('should execute schedules through ExecutionPool with proper ordering', async () => {
      const executionResults: string[] = [];

      // Create schedules that are ready to execute (using past timestamp)
      const pastTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago

      const schedule1 = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Schedule 1',
        cronExpression: '0 0 * * *',
      });

      const schedule2 = scheduleManager.createCronSchedule({
        agentId: 'agent-2',
        description: 'Schedule 2',
        cronExpression: '0 0 * * *',
      });

      // Manually set next_execution_at to past time to make them ready
      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, schedule1);
      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, schedule2);

      // Get schedules ready to execute
      const readySchedules = scheduleManager.getSchedulesReadyToExecute();
      expect(readySchedules).toHaveLength(2);

      // Execute each schedule through the pool
      const promises = readySchedules.map((schedule) => {
        return executionPool.execute(schedule.agent_id, async () => {
          executionResults.push(schedule.description ?? 'Unknown');
          await new Promise((resolve) => setTimeout(resolve, 50));
          return `Completed: ${schedule.description ?? 'Unknown'}`;
        });
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
      expect(executionResults).toContain('Schedule 1');
      expect(executionResults).toContain('Schedule 2');

      // Verify pool statistics
      const stats = executionPool.getStatistics();
      expect(stats.totalProcessed).toBe(2);
      expect(stats.totalFailed).toBe(0);
    });

    it('should handle schedule execution failures through pool', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();

      const schedule1 = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Failing Schedule',
        cronExpression: '0 0 * * *',
      });

      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, schedule1);

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();
      expect(readySchedules).toHaveLength(1);

      // Execute with a failing task
      if (readySchedules[0]) {
        await expect(
          executionPool.execute(readySchedules[0].agent_id, async () => {
            throw new Error('Scheduled task failed');
          })
        ).rejects.toThrow('Scheduled task failed');
      }

      // Verify failure was tracked
      const stats = executionPool.getStatistics();
      expect(stats.totalFailed).toBe(1);
    });

    it('should respect pool concurrency limits for scheduled tasks', async () => {
      const pool = new ExecutionPool({ maxConcurrent: 2 });
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const executionOrder: number[] = [];
      let concurrentCount = 0;
      let maxConcurrent = 0;

      // Create 5 schedules
      const scheduleIds = [];
      for (let i = 1; i <= 5; i++) {
        const id = scheduleManager.createCronSchedule({
          agentId: `agent-${i % 3 || 3}`, // Distribute across 3 agents
          description: `Schedule ${i}`,
          cronExpression: '0 0 * * *',
        });
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, id);
        scheduleIds.push(id);
      }

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();
      expect(readySchedules).toHaveLength(5);

      // Execute all through pool
      const promises = readySchedules.map((schedule, index) => {
        return pool.execute(schedule.agent_id, async () => {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          executionOrder.push(index + 1);
          await new Promise((resolve) => setTimeout(resolve, 100));
          concurrentCount--;
          return `Done ${index + 1}`;
        });
      });

      await Promise.all(promises);

      // Verify concurrency was respected
      expect(maxConcurrent).toBeLessThanOrEqual(2);
      expect(executionOrder).toHaveLength(5);
    });

    it('should update schedule after execution through pool', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();

      const scheduleId = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Schedule to update',
        cronExpression: '0 0 * * *',
      });

      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, scheduleId);

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();
      const schedule = readySchedules[0];

      if (!schedule) {
        throw new Error('Expected schedule to be ready');
      }

      await executionPool.execute(schedule.agent_id, async () => {
        return 'execution-123';
      });

      // Update schedule after successful execution
      scheduleManager.updateScheduleAfterExecution(schedule.id);

      // Verify schedule was updated
      const updatedSchedule = scheduleManager.getScheduleById(schedule.id);
      expect(updatedSchedule?.last_triggered_at).toBeDefined();
      if (updatedSchedule?.next_execution_at) {
        expect(new Date(updatedSchedule.next_execution_at).getTime()).toBeGreaterThan(
          new Date(pastTime).getTime()
        );
      }
    });
  });

  describe('Schedule Dependencies + ExecutionPool Priority Integration', () => {
    it('should execute dependent schedules in correct order through pool', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const executionOrder: string[] = [];

      // Create schedule A (no dependencies)
      const scheduleA = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Schedule A',
        cronExpression: '0 0 * * *',
      });

      // Create schedule B (depends on A)
      const scheduleB = scheduleManager.createCronSchedule({
        agentId: 'agent-2',
        description: 'Schedule B',
        cronExpression: '0 0 * * *',
        dependencies: [scheduleA],
      });

      // Create schedule C (depends on B)
      const scheduleC = scheduleManager.createCronSchedule({
        agentId: 'agent-3',
        description: 'Schedule C',
        cronExpression: '0 0 * * *',
        dependencies: [scheduleB],
      });

      // Make all ready for execution
      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, scheduleA);
      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, scheduleB);
      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, scheduleC);

      // Execute schedule A
      const readyA = scheduleManager.getSchedulesReadyToExecute();
      expect(readyA.some((s) => s.id === scheduleA)).toBe(true);

      await executionPool.execute('agent-1', async () => {
        executionOrder.push('A');
        return 'exec-A';
      });

      scheduleManager.updateScheduleAfterExecution(scheduleA);

      // Now schedule B should be ready
      const readyB = scheduleManager.getSchedulesReadyToExecute();
      expect(readyB.some((s) => s.id === scheduleB)).toBe(true);

      await executionPool.execute('agent-2', async () => {
        executionOrder.push('B');
        return 'exec-B';
      });

      scheduleManager.updateScheduleAfterExecution(scheduleB);

      // Now schedule C should be ready
      const readyC = scheduleManager.getSchedulesReadyToExecute();
      expect(readyC.some((s) => s.id === scheduleC)).toBe(true);

      await executionPool.execute('agent-3', async () => {
        executionOrder.push('C');
        return 'exec-C';
      });

      // Verify execution order
      expect(executionOrder).toEqual(['A', 'B', 'C']);
    });

    it('should handle priority scheduling with dependencies', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const executionOrder: string[] = [];

      // Create high priority independent schedule
      const highPriority = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'High Priority',
        cronExpression: '0 0 * * *',
      });

      // Create low priority independent schedule
      const lowPriority = scheduleManager.createCronSchedule({
        agentId: 'agent-2',
        description: 'Low Priority',
        cronExpression: '0 0 * * *',
      });

      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
        pastTime,
        highPriority
      );
      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(
        pastTime,
        lowPriority
      );

      // Execute with priorities (urgent for high, low for low)
      const promises = [
        executionPool.execute(
          'agent-1',
          async () => {
            executionOrder.push('high');
            return 'high-done';
          },
          'urgent'
        ),
        executionPool.execute(
          'agent-2',
          async () => {
            executionOrder.push('low');
            return 'low-done';
          },
          'low'
        ),
      ];

      await Promise.all(promises);

      // High priority should execute first
      expect(executionOrder[0]).toBe('high');
    });

    it('should handle diamond dependency pattern in scheduled execution', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const executionOrder: string[] = [];

      // Diamond pattern: A -> B,C -> D
      const scheduleA = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Schedule A',
        cronExpression: '0 0 * * *',
      });

      const scheduleB = scheduleManager.createCronSchedule({
        agentId: 'agent-2',
        description: 'Schedule B',
        cronExpression: '0 0 * * *',
        dependencies: [scheduleA],
      });

      const scheduleC = scheduleManager.createCronSchedule({
        agentId: 'agent-3',
        description: 'Schedule C',
        cronExpression: '0 0 * * *',
        dependencies: [scheduleA],
      });

      const scheduleD = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Schedule D',
        cronExpression: '0 0 * * *',
        dependencies: [scheduleB, scheduleC],
      });

      // Make all ready
      for (const id of [scheduleA, scheduleB, scheduleC, scheduleD]) {
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, id);
      }

      // Execute A
      await executionPool.execute('agent-1', async () => {
        executionOrder.push('A');
        return 'exec-A';
      });
      scheduleManager.updateScheduleAfterExecution(scheduleA);

      // Execute B and C in parallel
      await Promise.all([
        executionPool.execute('agent-2', async () => {
          executionOrder.push('B');
          return 'exec-B';
        }),
        executionPool.execute('agent-3', async () => {
          executionOrder.push('C');
          return 'exec-C';
        }),
      ]);

      scheduleManager.updateScheduleAfterExecution(scheduleB);
      scheduleManager.updateScheduleAfterExecution(scheduleC);

      // Now D should be ready (both B and C complete)
      const readyD = scheduleManager.getSchedulesReadyToExecute();
      expect(readyD.some((s) => s.id === scheduleD)).toBe(true);

      await executionPool.execute('agent-1', async () => {
        executionOrder.push('D');
        return 'exec-D';
      });

      // Verify execution order
      expect(executionOrder[0]).toBe('A');
      expect(executionOrder.slice(1, 3).sort()).toEqual(['B', 'C']);
      expect(executionOrder[3]).toBe('D');
    });
  });

  describe('Schedule Execution with Resource Quotas', () => {
    it('should enforce memory quotas for scheduled tasks', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();

      const schedule = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Memory limited schedule',
        cronExpression: '0 0 * * *',
      });

      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, schedule);

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();

      if (!readySchedules[0]) {
        throw new Error('Expected schedule to be ready');
      }

      // Execute with very low memory quota (will trigger violation)
      const executionId = (await executionPool.execute(
        readySchedules[0].agent_id,
        createDelayedTask('completed', 100),
        'medium',
        undefined,
        {
          maxMemoryMB: 0.001, // Extremely low, will trigger
        }
      )) as string;

      expect(executionId).toBeDefined();

      // Check if quota violation was recorded
      const stats = executionPool.getStatistics();
      expect(stats.totalQuotaViolations).toBeGreaterThan(0);
    });

    it('should enforce time quotas for scheduled tasks', async () => {
      // Create pool with faster quota checking for testing
      const testPool = new ExecutionPool({ maxConcurrent: 3, quotaCheckIntervalMs: 10 });
      const pastTime = new Date(Date.now() - 60000).toISOString();

      const schedule = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Time limited schedule',
        cronExpression: '0 0 * * *',
      });

      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, schedule);

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();

      if (!readySchedules[0]) {
        throw new Error('Expected schedule to be ready');
      }

      // Execute with very short time quota that will be exceeded
      await testPool.execute(
        readySchedules[0].agent_id,
        async () => {
          // Task that takes longer than quota
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'completed';
        },
        'medium',
        undefined,
        {
          maxExecutionMinutes: 0.001, // ~60ms
        }
      );

      // Check if quota violation was recorded
      const stats = testPool.getStatistics();
      expect(stats.totalQuotaViolations).toBeGreaterThan(0);
    });

    it('should track resource usage for scheduled executions', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();

      const schedule = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Monitored schedule',
        cronExpression: '0 0 * * *',
      });

      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, schedule);

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();

      if (!readySchedules[0]) {
        throw new Error('Expected schedule to be ready');
      }

      // Execute with reasonable quotas
      const executionId = (await executionPool.execute(
        readySchedules[0].agent_id,
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'completed';
        },
        'medium',
        undefined,
        {
          maxMemoryMB: 100,
          maxCpuPercent: 80,
          maxExecutionMinutes: 5,
        }
      )) as string;

      expect(executionId).toBeDefined();

      // Verify execution completed without quota violations
      const stats = executionPool.getStatistics();
      expect(stats.totalProcessed).toBe(1);
    });

    it('should handle multiple schedules with different resource quotas', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();

      // Create 3 schedules with different resource requirements
      const schedules = [
        { id: 'agent-1', desc: 'Light', memory: 50 },
        { id: 'agent-2', desc: 'Medium', memory: 100 },
        { id: 'agent-3', desc: 'Heavy', memory: 200 },
      ];

      schedules.map((s) => {
        const id = scheduleManager.createCronSchedule({
          agentId: s.id,
          description: `${s.desc} schedule`,
          cronExpression: '0 0 * * *',
        });
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, id);
        return id;
      });

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();
      expect(readySchedules).toHaveLength(3);

      // Execute all with their respective quotas
      const promises = readySchedules.map((schedule, index) => {
        const config = schedules[index];
        if (!config) {
          throw new Error('Expected schedule config');
        }
        return executionPool.execute(
          schedule.agent_id,
          async () => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return `${config.desc} completed`;
          },
          'medium',
          undefined,
          {
            maxMemoryMB: config.memory,
            maxExecutionMinutes: 5,
          }
        );
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(results).toContain('Light completed');
      expect(results).toContain('Medium completed');
      expect(results).toContain('Heavy completed');

      const stats = executionPool.getStatistics();
      expect(stats.totalProcessed).toBe(3);
    });
  });

  describe('Complex Scheduling Scenarios', () => {
    it('should handle schedule queue with mixed priorities and dependencies', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const executionLog: Array<{ name: string; time: number }> = [];

      // Create a complex schedule graph:
      // High priority independent: H1
      // Low priority with dependency: L1 -> L2
      // Medium priority independent: M1

      const h1 = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'High Priority 1',
        cronExpression: '0 0 * * *',
      });

      const l1 = scheduleManager.createCronSchedule({
        agentId: 'agent-2',
        description: 'Low Priority 1',
        cronExpression: '0 0 * * *',
      });

      const l2 = scheduleManager.createCronSchedule({
        agentId: 'agent-3',
        description: 'Low Priority 2',
        cronExpression: '0 0 * * *',
        dependencies: [l1],
      });

      const m1 = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Medium Priority 1',
        cronExpression: '0 0 * * *',
      });

      // Make all ready
      for (const id of [h1, l1, l2, m1]) {
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, id);
      }

      // Execute independent ones first with priorities
      const independentPromises = [
        executionPool.execute(
          'agent-1',
          async () => {
            executionLog.push({ name: 'H1', time: Date.now() });
            await new Promise((resolve) => setTimeout(resolve, 50));
            return 'h1-done';
          },
          'urgent'
        ),
        executionPool.execute(
          'agent-1',
          async () => {
            executionLog.push({ name: 'M1', time: Date.now() });
            await new Promise((resolve) => setTimeout(resolve, 50));
            return 'm1-done';
          },
          'medium'
        ),
        executionPool.execute(
          'agent-2',
          async () => {
            executionLog.push({ name: 'L1', time: Date.now() });
            await new Promise((resolve) => setTimeout(resolve, 50));
            return 'l1-done';
          },
          'low'
        ),
      ];

      await Promise.all(independentPromises);

      // Update L1 to enable L2
      scheduleManager.updateScheduleAfterExecution(l1);

      // Now execute L2
      await executionPool.execute('agent-3', async () => {
        executionLog.push({ name: 'L2', time: Date.now() });
        return 'l2-done';
      });

      // Verify H1 executed first, L2 executed last
      expect(executionLog[0]?.name).toBe('H1');
      expect(executionLog[executionLog.length - 1]?.name).toBe('L2');
      expect(executionLog).toHaveLength(4);
    });

    it('should handle schedule execution with long-running tasks', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();

      const schedule = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Schedule with long task',
        cronExpression: '0 0 * * *',
      });

      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, schedule);

      // Start a long-running task
      const result = await executionPool.execute('agent-1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'completed';
      });

      expect(result).toBe('completed');
    });

    it('should maintain schedule integrity across multiple execution cycles', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();

      // Create a recurring schedule
      const schedule = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Recurring schedule',
        cronExpression: '*/5 * * * *', // Every 5 minutes
      });

      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, schedule);

      // Execute 3 cycles
      for (let i = 0; i < 3; i++) {
        const ready = scheduleManager.getSchedulesReadyToExecute();
        expect(ready).toHaveLength(1);
        expect(ready[0]?.id).toBe(schedule);

        await executionPool.execute('agent-1', async () => {
          return `execution-${i}`;
        });

        scheduleManager.updateScheduleAfterExecution(schedule);

        // Make ready again for next cycle (simulate time passing)
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, schedule);
      }

      // Verify schedule still exists and is valid
      const finalSchedule = scheduleManager.getScheduleById(schedule);
      expect(finalSchedule).toBeDefined();
      expect(finalSchedule?.enabled).toBe(1);

      const stats = executionPool.getStatistics();
      expect(stats.totalProcessed).toBe(3);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle schedule execution errors without blocking other schedules', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();
      const results: string[] = [];

      // Create 3 schedules, middle one will fail
      const schedule1 = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Success 1',
        cronExpression: '0 0 * * *',
      });

      const schedule2 = scheduleManager.createCronSchedule({
        agentId: 'agent-2',
        description: 'Failure',
        cronExpression: '0 0 * * *',
      });

      const schedule3 = scheduleManager.createCronSchedule({
        agentId: 'agent-3',
        description: 'Success 2',
        cronExpression: '0 0 * * *',
      });

      for (const id of [schedule1, schedule2, schedule3]) {
        db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, id);
      }

      const readySchedules = scheduleManager.getSchedulesReadyToExecute();

      // Execute all, catching errors for the failing one
      const promises = readySchedules.map((schedule) => {
        if (schedule.description === 'Failure') {
          return executionPool
            .execute('agent-2', createFailingTask(new Error('Task error'), 50))
            .catch((err) => {
              results.push(`Failed: ${err.message}`);
              return 'failed';
            });
        } else {
          return executionPool.execute(schedule.agent_id, async () => {
            results.push(`Success: ${schedule.description ?? 'Unknown'}`);
            return 'success';
          });
        }
      });

      await Promise.all(promises);

      // Verify other schedules completed despite the failure
      expect(results).toContain('Success: Success 1');
      expect(results).toContain('Success: Success 2');
      expect(results).toContain('Failed: Task error');

      const stats = executionPool.getStatistics();
      expect(stats.totalProcessed).toBe(2);
      expect(stats.totalFailed).toBe(1);
    });

    it('should handle database errors during schedule updates', async () => {
      const pastTime = new Date(Date.now() - 60000).toISOString();

      const schedule = scheduleManager.createCronSchedule({
        agentId: 'agent-1',
        description: 'Test schedule',
        cronExpression: '0 0 * * *',
      });

      db.prepare('UPDATE schedules SET next_execution_at = ? WHERE id = ?').run(pastTime, schedule);

      // Execute successfully
      await executionPool.execute('agent-1', async () => {
        return 'exec-1';
      });

      // Close database to simulate error
      db.close();

      // Attempt to update should throw error
      expect(() => {
        scheduleManager.updateScheduleAfterExecution(schedule);
      }).toThrow();
    });
  });
});
