/**
 * Tests for monitorDeadlocks function (Task 2.3.33)
 *
 * Covers:
 * - Scanning all blocked tasks for deadlocks
 * - Cycle deduplication (same cycle from different entry points)
 * - Statistics reporting (deadlocksDetected, notificationsSent, etc.)
 * - Integration with detectTaskDeadlock and notifyDeadlock
 * - Error handling for individual task failures
 * - Multiple independent deadlock cycles
 * - Performance with many blocked tasks
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { monitorDeadlocks } from '../monitorDeadlocks';
import {
  createTask,
  createAgent,
  runMigrations,
  allMigrations,
  getMessages,
} from '@recursive-manager/common';
import { saveAgentConfig } from '../../config';
import { AgentConfig } from '@recursive-manager/common';

describe('monitorDeadlocks', () => {
  let db: Database.Database;
  let testDir: string;
  let agentA: string;
  let agentB: string;
  let agentC: string;
  let agentD: string;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'monitor-deadlock-test-'));

    // Create test agents
    agentA = createAgent(db, { name: 'Agent A', role: 'Worker', managerId: null }).id;
    agentB = createAgent(db, { name: 'Agent B', role: 'Worker', managerId: null }).id;
    agentC = createAgent(db, { name: 'Agent C', role: 'Worker', managerId: null }).id;
    agentD = createAgent(db, { name: 'Agent D', role: 'Worker', managerId: null }).id;

    // Create default agent configs with notifications enabled
    const createDefaultConfig = (agentId: string, role: string): AgentConfig => ({
      version: '1.0.0',
      identity: {
        id: agentId,
        role,
        displayName: role,
        createdAt: new Date().toISOString(),
        createdBy: 'test',
        reportingTo: null,
      },
      goal: {
        mainGoal: 'Test work',
      },
      permissions: {
        canHire: false,
        maxSubordinates: 0,
        hiringBudget: 0,
      },
      framework: {
        primary: 'claude-code',
        fallbacks: [],
      },
      communication: {
        notifyOnCompletion: true,
        notifyOnDelegation: true,
        notifyOnDeadlock: true,
      },
      behavior: {
        executionMode: 'continuous',
        autonomy: 'low',
        escalationThreshold: 3,
      },
      metadata: {
        version: 1,
        updatedAt: new Date().toISOString(),
      },
    });

    await saveAgentConfig(agentA, createDefaultConfig(agentA, 'Agent A'), testDir);
    await saveAgentConfig(agentB, createDefaultConfig(agentB, 'Agent B'), testDir);
    await saveAgentConfig(agentC, createDefaultConfig(agentC, 'Agent C'), testDir);
    await saveAgentConfig(agentD, createDefaultConfig(agentD, 'Agent D'), testDir);
  });

  afterEach(async () => {
    // Clean up
    db.close();
    await fs.remove(testDir);
  });

  describe('Basic Functionality', () => {
    it('should return zero results when no blocked tasks exist', async () => {
      // Create some active tasks (not blocked)
      createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Active task',
        priority: 'high',
        status: 'active',
      });

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      expect(result.deadlocksDetected).toBe(0);
      expect(result.notificationsSent).toBe(0);
      expect(result.deadlockedTaskIds).toHaveLength(0);
      expect(result.cycles).toHaveLength(0);
    });

    it('should return zero results when blocked tasks have no circular dependencies', async () => {
      // Create blocked tasks without circular dependencies: A -> B -> C (linear)
      const taskC = createTask(db, {
        agentId: agentC,
        title: 'Task C',
        description: 'Task C',
        priority: 'high',
        status: 'active',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      // Set up linear blocking: A blocks on B, B blocks on C
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskC.id]),
        taskB.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      expect(result.deadlocksDetected).toBe(0);
      expect(result.notificationsSent).toBe(0);
      expect(result.deadlockedTaskIds).toHaveLength(0);
      expect(result.cycles).toHaveLength(0);
    });

    it('should detect single deadlock cycle and send notifications', async () => {
      // Create simple deadlock: A -> B -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      expect(result.deadlocksDetected).toBe(1);
      expect(result.notificationsSent).toBe(2); // One per agent
      expect(result.deadlockedTaskIds).toHaveLength(2);
      expect(result.deadlockedTaskIds).toContain(taskA.id);
      expect(result.deadlockedTaskIds).toContain(taskB.id);
      expect(result.cycles).toHaveLength(1);
      expect(result.cycles[0]).toHaveLength(2);

      // Verify notifications were sent
      expect(getMessages(db, { toAgentId: agentA })).toHaveLength(1);
      expect(getMessages(db, { toAgentId: agentB })).toHaveLength(1);
    });

    it('should detect three-way deadlock cycle', async () => {
      // Create deadlock: A -> B -> C -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      const taskC = createTask(db, {
        agentId: agentC,
        title: 'Task C',
        description: 'Task C',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskC.id]),
        taskB.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskC.id
      );

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      expect(result.deadlocksDetected).toBe(1);
      expect(result.notificationsSent).toBe(3); // One per agent
      expect(result.deadlockedTaskIds).toHaveLength(3);
      expect(result.cycles).toHaveLength(1);
      expect(result.cycles[0]).toHaveLength(3);
    });
  });

  describe('Cycle Deduplication', () => {
    it('should deduplicate same cycle detected from different entry points', async () => {
      // Create deadlock: A -> B -> C -> A
      // All three tasks are blocked, so we'll detect the same cycle 3 times
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      const taskC = createTask(db, {
        agentId: agentC,
        title: 'Task C',
        description: 'Task C',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskC.id]),
        taskB.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskC.id
      );

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      // Should detect only 1 unique cycle (not 3)
      expect(result.deadlocksDetected).toBe(1);
      expect(result.cycles).toHaveLength(1);

      // Should send 3 notifications (one per agent)
      expect(result.notificationsSent).toBe(3);

      // All three agents should receive exactly one notification
      expect(getMessages(db, { toAgentId: agentA })).toHaveLength(1);
      expect(getMessages(db, { toAgentId: agentB })).toHaveLength(1);
      expect(getMessages(db, { toAgentId: agentC })).toHaveLength(1);
    });

    it('should correctly identify rotated cycles as the same cycle', async () => {
      // Create a cycle where tasks are discovered in different orders
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      const taskC = createTask(db, {
        agentId: agentC,
        title: 'Task C',
        description: 'Task C',
        priority: 'high',
        status: 'blocked',
      });

      const taskD = createTask(db, {
        agentId: agentD,
        title: 'Task D',
        description: 'Task D',
        priority: 'high',
        status: 'blocked',
      });

      // Create cycle: A -> B -> C -> D -> A
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskC.id]),
        taskB.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskD.id]),
        taskC.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskD.id
      );

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      // Should detect only 1 unique cycle
      expect(result.deadlocksDetected).toBe(1);
      expect(result.cycles).toHaveLength(1);
      expect(result.cycles[0]).toHaveLength(4);

      // Should send 4 notifications (one per agent)
      expect(result.notificationsSent).toBe(4);
    });
  });

  describe('Multiple Independent Cycles', () => {
    it('should detect multiple independent deadlock cycles', async () => {
      // Create first cycle: A -> B -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Create second cycle: C -> D -> C
      const taskC = createTask(db, {
        agentId: agentC,
        title: 'Task C',
        description: 'Task C',
        priority: 'high',
        status: 'blocked',
      });

      const taskD = createTask(db, {
        agentId: agentD,
        title: 'Task D',
        description: 'Task D',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskD.id]),
        taskC.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskC.id]),
        taskD.id
      );

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      // Should detect 2 unique cycles
      expect(result.deadlocksDetected).toBe(2);
      expect(result.cycles).toHaveLength(2);

      // Should send 4 notifications total (2 per cycle)
      expect(result.notificationsSent).toBe(4);

      // All task IDs should be included
      expect(result.deadlockedTaskIds).toHaveLength(4);
      expect(result.deadlockedTaskIds).toContain(taskA.id);
      expect(result.deadlockedTaskIds).toContain(taskB.id);
      expect(result.deadlockedTaskIds).toContain(taskC.id);
      expect(result.deadlockedTaskIds).toContain(taskD.id);

      // All agents should receive notifications
      expect(getMessages(db, { toAgentId: agentA })).toHaveLength(1);
      expect(getMessages(db, { toAgentId: agentB })).toHaveLength(1);
      expect(getMessages(db, { toAgentId: agentC })).toHaveLength(1);
      expect(getMessages(db, { toAgentId: agentD })).toHaveLength(1);
    });

    it('should handle mix of deadlocked and non-deadlocked blocked tasks', async () => {
      // Create deadlock cycle: A -> B -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Create non-deadlocked blocked task: C -> D (where D is active)
      const taskD = createTask(db, {
        agentId: agentD,
        title: 'Task D',
        description: 'Task D',
        priority: 'high',
        status: 'active', // Not blocked
      });

      const taskC = createTask(db, {
        agentId: agentC,
        title: 'Task C',
        description: 'Task C',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskD.id]),
        taskC.id
      );

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      // Should detect only 1 cycle (A-B, not C)
      expect(result.deadlocksDetected).toBe(1);
      expect(result.cycles).toHaveLength(1);
      expect(result.cycles[0]).toHaveLength(2);

      // Should send 2 notifications (A and B, not C or D)
      expect(result.notificationsSent).toBe(2);

      // Only deadlocked tasks included
      expect(result.deadlockedTaskIds).toHaveLength(2);
      expect(result.deadlockedTaskIds).toContain(taskA.id);
      expect(result.deadlockedTaskIds).toContain(taskB.id);
      expect(result.deadlockedTaskIds).not.toContain(taskC.id);
      expect(result.deadlockedTaskIds).not.toContain(taskD.id);
    });
  });

  describe('Error Handling', () => {
    it('should continue monitoring if one task detection fails', async () => {
      // Create valid deadlock: A -> B -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Create a task with corrupted blocked_by data
      const taskC = createTask(db, {
        agentId: agentC,
        title: 'Task C',
        description: 'Task C',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        'invalid json{{{',
        taskC.id
      );

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      // Should still detect the valid deadlock despite corrupted task
      expect(result.deadlocksDetected).toBeGreaterThanOrEqual(1);
      expect(result.notificationsSent).toBeGreaterThanOrEqual(2);
    });

    it('should continue processing if notification fails for one cycle', async () => {
      // Create first cycle: A -> B -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Create second cycle: C -> D -> C
      const taskC = createTask(db, {
        agentId: agentC,
        title: 'Task C',
        description: 'Task C',
        priority: 'high',
        status: 'blocked',
      });

      const taskD = createTask(db, {
        agentId: agentD,
        title: 'Task D',
        description: 'Task D',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskD.id]),
        taskC.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskC.id]),
        taskD.id
      );

      // Delete agentA's directory to cause notification failure
      const agentDirA = path.join(testDir, 'agents', agentA.substring(0, 2), agentA);
      await fs.remove(agentDirA);

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      // Should detect both cycles
      expect(result.deadlocksDetected).toBe(2);

      // Should send some notifications (at least for second cycle)
      expect(result.notificationsSent).toBeGreaterThanOrEqual(2);

      // Verify second cycle agents received notifications
      expect(getMessages(db, { toAgentId: agentC })).toHaveLength(1);
      expect(getMessages(db, { toAgentId: agentD })).toHaveLength(1);
    });
  });

  describe('Agent Notification Preferences', () => {
    it('should respect agent notification preferences', async () => {
      // Disable deadlock notifications for agentA
      await saveAgentConfig(agentA, {
        version: '1.0.0',
        identity: {
          id: agentA,
          role: 'Worker',
          displayName: 'Agent A',
          createdAt: new Date().toISOString(),
          createdBy: 'test',
          reportingTo: null,
        },
        goal: {
          mainGoal: 'Test work',
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
          fallbacks: [],
        },
        communication: {
          notifyOnCompletion: true,
          notifyOnDelegation: true,
          notifyOnDeadlock: false, // Disable deadlock notifications
        },
        behavior: {
          executionMode: 'continuous',
          autonomy: 'low',
          escalationThreshold: 3,
        },
        metadata: {
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      }, testDir);

      // Create deadlock: A -> B -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      const result = await monitorDeadlocks(db, { dataDir: testDir });

      // Should detect deadlock
      expect(result.deadlocksDetected).toBe(1);

      // Should send only 1 notification (to agentB, not agentA)
      expect(result.notificationsSent).toBe(1);

      // Verify agentA did NOT receive notification
      expect(getMessages(db, { toAgentId: agentA })).toHaveLength(0);

      // Verify agentB did receive notification
      expect(getMessages(db, { toAgentId: agentB })).toHaveLength(1);
    });

    it('should force notifications when force = true', async () => {
      // Disable deadlock notifications for all agents
      const disabledConfig = (agentId: string): AgentConfig => ({
        version: '1.0.0',
        identity: {
          id: agentId,
          role: 'Worker',
          displayName: `Agent ${agentId}`,
          createdAt: new Date().toISOString(),
          createdBy: 'test',
          reportingTo: null,
        },
        goal: {
          mainGoal: 'Test work',
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
          fallbacks: [],
        },
        communication: {
          notifyOnCompletion: true,
          notifyOnDelegation: true,
          notifyOnDeadlock: false, // Disable
        },
        behavior: {
          executionMode: 'continuous',
          autonomy: 'low',
          escalationThreshold: 3,
        },
        metadata: {
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      });

      await saveAgentConfig(agentA, disabledConfig(agentA), testDir);
      await saveAgentConfig(agentB, disabledConfig(agentB), testDir);

      // Create deadlock: A -> B -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      const result = await monitorDeadlocks(db, { dataDir: testDir, force: true });

      // Should detect deadlock
      expect(result.deadlocksDetected).toBe(1);

      // Should send 2 notifications (forced despite preferences)
      expect(result.notificationsSent).toBe(2);

      // Both agents should receive notifications
      expect(getMessages(db, { toAgentId: agentA })).toHaveLength(1);
      expect(getMessages(db, { toAgentId: agentB })).toHaveLength(1);
    });
  });

  describe('Performance', () => {
    it('should handle many blocked tasks efficiently', async () => {
      // Create 20 blocked tasks without deadlocks
      for (let i = 0; i < 20; i++) {
        const task = createTask(db, {
          agentId: agentA,
          title: `Task ${i}`,
          description: `Task ${i}`,
          priority: 'high',
          status: 'blocked',
        });

        // Block on a non-existent task (no circular dependency)
        db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
          JSON.stringify(['non-existent-task']),
          task.id
        );
      }

      // Create one actual deadlock: A -> B -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      const startTime = Date.now();
      const result = await monitorDeadlocks(db, { dataDir: testDir });
      const endTime = Date.now();

      // Should complete in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      // Should detect only the real deadlock
      expect(result.deadlocksDetected).toBe(1);
      expect(result.notificationsSent).toBe(2);
    });
  });
});
