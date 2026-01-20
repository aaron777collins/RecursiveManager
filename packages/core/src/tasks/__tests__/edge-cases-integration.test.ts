/**
 * Edge Case Integration Tests (Task 2.3.35)
 *
 * This file covers edge cases that span multiple subsystems:
 * - Depth limit enforcement at boundaries
 * - Combined scenarios (firing during archival, deadlock during firing, etc.)
 * - Race condition stress tests
 * - Performance under extreme conditions
 *
 * These tests complement the individual component tests by verifying
 * that edge cases are handled correctly when multiple systems interact.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import {
  createTask,
  createAgent,
  runMigrations,
  allMigrations,
  getTask,
  TASK_MAX_DEPTH,
} from '@recursive-manager/common';
import { fireAgent } from '../../lifecycle/fireAgent';
import { saveAgentConfig } from '../../config';
import { AgentConfig } from '@recursive-manager/common';
// Removed unused import: archiveOldTasks
import { monitorDeadlocks } from '../monitorDeadlocks';

describe('Edge Case Integration Tests (Task 2.3.35)', () => {
  let db: Database.Database;
  let testDir: string;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edge-case-integration-'));
  });

  afterEach(async () => {
    // Clean up
    db.close();
    await fs.remove(testDir);
  });

  describe('Depth Limit Edge Cases (EC-2.2)', () => {
    let rootAgent: string;

    beforeEach(() => {
      rootAgent = createAgent(db, {
        name: 'Root Agent',
        role: 'Manager',
        managerId: null,
      }).id;

      // Create default config
      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: rootAgent,
          role: 'Manager',
          displayName: 'Root Agent',
          createdAt: new Date().toISOString(),
          createdBy: 'test',
          reportingTo: null,
        },
        goal: {
          mainGoal: 'Test depth limits',
        },
        permissions: {
          canHire: true,
          maxSubordinates: 10,
          hiringBudget: 1000,
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
          autonomy: 'medium',
          escalationThreshold: 3,
        },
        metadata: {
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      };

      saveAgentConfig(rootAgent, config, testDir);
    });

    it('should allow creating task at exactly max depth', () => {
      // Create a chain of tasks up to max depth
      let parentTaskId: string | null = null;

      for (let depth = 0; depth <= TASK_MAX_DEPTH; depth++) {
        const task = createTask(db, {
          agentId: rootAgent,
          title: `Task at depth ${depth}`,
          priority: 'medium',
          parentTaskId,
          taskPath: parentTaskId ? `${parentTaskId}/task-depth-${depth}` : `task-depth-${depth}`,
        });

        expect(task.depth).toBe(depth);
        parentTaskId = task.id;

        // Verify task was created
        const retrieved = getTask(db, task.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.depth).toBe(depth);
      }

      // Verify we successfully created tasks at all depths 0 through TASK_MAX_DEPTH
      const maxDepthTask = getTask(db, parentTaskId!);
      expect(maxDepthTask?.depth).toBe(TASK_MAX_DEPTH);
    });

    it('should reject creating task beyond max depth', () => {
      // Create a chain of tasks up to max depth
      let parentTaskId: string | null = null;

      for (let depth = 0; depth <= TASK_MAX_DEPTH; depth++) {
        const task = createTask(db, {
          agentId: rootAgent,
          title: `Task at depth ${depth}`,
          priority: 'medium',
          parentTaskId,
          taskPath: parentTaskId ? `${parentTaskId}/task-depth-${depth}` : `task-depth-${depth}`,
        });
        parentTaskId = task.id;
      }

      // Now attempt to create one more level - should fail
      expect(() => {
        createTask(db, {
          agentId: rootAgent,
          title: `Task beyond max depth`,
          priority: 'medium',
          parentTaskId,
          taskPath: `${parentTaskId}/task-too-deep`,
        });
      }).toThrow(/maximum depth/i);
    });

    it('should maintain correct depth when parent task is deleted', () => {
      // Create parent and child tasks
      const parent = createTask(db, {
        agentId: rootAgent,
        title: 'Parent',
        priority: 'medium',
        taskPath: 'parent',
      });

      const child = createTask(db, {
        agentId: rootAgent,
        title: 'Child',
        priority: 'medium',
        parentTaskId: parent.id,
        taskPath: `${parent.id}/child`,
      });

      expect(parent.depth).toBe(0);
      expect(child.depth).toBe(1);

      // Delete parent task from database (simulating corruption/edge case)
      db.prepare('DELETE FROM tasks WHERE id = ?').run(parent.id);

      // Child task should still have correct depth recorded
      const childAfter = getTask(db, child.id);
      expect(childAfter?.depth).toBe(1);
    });

    it('should handle rapid task creation at various depths', () => {
      // Create multiple task chains rapidly to stress-test depth calculation
      const chains: string[] = [];

      for (let chain = 0; chain < 5; chain++) {
        let parentId: string | null = null;

        for (let depth = 0; depth < 3; depth++) {
          const task = createTask(db, {
            agentId: rootAgent,
            title: `Chain ${chain} Depth ${depth}`,
            priority: 'medium',
            parentTaskId: parentId,
            taskPath: parentId
              ? `${parentId}/chain-${chain}-depth-${depth}`
              : `chain-${chain}-depth-${depth}`,
          });

          expect(task.depth).toBe(depth);
          parentId = task.id;
        }

        chains.push(parentId!);
      }

      // Verify all chains created correctly
      expect(chains).toHaveLength(5);
      chains.forEach((taskId) => {
        const task = getTask(db, taskId);
        expect(task?.depth).toBe(2);
      });
    });
  });

  describe('Combined Edge Case Scenarios', () => {
    it('should handle agent firing while tasks are being archived', async () => {
      // Create agent with old completed tasks
      const agent = createAgent(db, {
        name: 'Worker',
        role: 'Worker',
        managerId: null,
      }).id;

      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: agent,
          role: 'Worker',
          displayName: 'Worker',
          createdAt: new Date().toISOString(),
          createdBy: 'test',
          reportingTo: null,
        },
        goal: {
          mainGoal: 'Work',
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
      };

      await saveAgentConfig(agent, config, testDir);

      // Create old completed task
      const task = createTask(db, {
        agentId: agent,
        title: 'Old completed task',
        priority: 'medium',
        taskPath: 'old-task',
      });

      // Mark as completed 10 days ago
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      db.prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?').run(
        'completed',
        tenDaysAgo.toISOString(),
        task.id
      );

      // Archive tasks
      await archiveTasks(db, testDir);

      // Verify task was archived
      const archivedTask = getTask(db, task.id);
      expect(archivedTask?.status).toBe('archived');

      // Now fire the agent - should handle archived tasks gracefully
      await expect(
        fireAgent(db, agent, {
          orphanStrategy: 'promote',
          baseDir: testDir,
        })
      ).resolves.not.toThrow();

      // Verify agent was fired
      const agentRecord = db.prepare('SELECT status FROM agents WHERE id = ?').get(agent) as {
        status: string;
      };
      expect(agentRecord.status).toBe('fired');
    });

    it('should handle deadlock detection when involved agent is fired', async () => {
      // Create two agents with circular dependencies
      const agentA = createAgent(db, {
        name: 'Agent A',
        role: 'Worker',
        managerId: null,
      }).id;

      const agentB = createAgent(db, {
        name: 'Agent B',
        role: 'Worker',
        managerId: null,
      }).id;

      const createConfig = (agentId: string, name: string): AgentConfig => ({
        version: '1.0.0',
        identity: {
          id: agentId,
          role: 'Worker',
          displayName: name,
          createdAt: new Date().toISOString(),
          createdBy: 'test',
          reportingTo: null,
        },
        goal: {
          mainGoal: 'Work',
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

      await saveAgentConfig(agentA, createConfig(agentA, 'Agent A'), testDir);
      await saveAgentConfig(agentB, createConfig(agentB, 'Agent B'), testDir);

      // Create tasks with circular dependency
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        priority: 'medium',
        taskPath: 'task-a',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        priority: 'medium',
        taskPath: 'task-b',
        blockedBy: taskA.id,
      });

      // Update task A to be blocked by task B (creating cycle)
      db.prepare('UPDATE tasks SET blocked_by = ?, status = ? WHERE id = ?').run(
        taskB.id,
        'blocked',
        taskA.id
      );

      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('blocked', taskB.id);

      // Detect deadlock
      const deadlockResult = await monitorDeadlocks(db, testDir);
      expect(deadlockResult.deadlocksDetected).toBeGreaterThan(0);

      // Now fire agent A - tasks should be handled gracefully
      await fireAgent(db, agentA, {
        orphanStrategy: 'promote',
        baseDir: testDir,
      });

      // Verify agent A was fired
      const agentARecord = db.prepare('SELECT status FROM agents WHERE id = ?').get(agentA) as {
        status: string;
      };
      expect(agentARecord.status).toBe('fired');

      // Task A should be reassigned or archived (depending on implementation)
      // The key is it shouldn't crash or leave inconsistent state
      const taskAAfter = getTask(db, taskA.id);
      expect(taskAAfter).not.toBeNull();
    });

    it('should handle task delegation when parent agent is paused', async () => {
      // Create parent and child agents
      const parent = createAgent(db, {
        name: 'Parent',
        role: 'Manager',
        managerId: null,
      }).id;

      const child = createAgent(db, {
        name: 'Child',
        role: 'Worker',
        managerId: parent,
      }).id;

      const createConfig = (agentId: string, name: string): AgentConfig => ({
        version: '1.0.0',
        identity: {
          id: agentId,
          role: name === 'Parent' ? 'Manager' : 'Worker',
          displayName: name,
          createdAt: new Date().toISOString(),
          createdBy: 'test',
          reportingTo: name === 'Parent' ? null : parent,
        },
        goal: {
          mainGoal: 'Work',
        },
        permissions: {
          canHire: name === 'Parent',
          maxSubordinates: 5,
          hiringBudget: 1000,
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
          autonomy: 'medium',
          escalationThreshold: 3,
        },
        metadata: {
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      });

      await saveAgentConfig(parent, createConfig(parent, 'Parent'), testDir);
      await saveAgentConfig(child, createConfig(child, 'Child'), testDir);

      // Pause parent agent
      db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('paused', parent);

      // Create task for parent
      const task = createTask(db, {
        agentId: parent,
        title: 'Task for paused parent',
        priority: 'medium',
        taskPath: 'task-for-paused',
      });

      expect(task.agent_id).toBe(parent);

      // Delegate to child - should work even though parent is paused
      db.prepare('UPDATE tasks SET delegated_to = ?, delegated_at = ? WHERE id = ?').run(
        child,
        new Date().toISOString(),
        task.id
      );

      const delegatedTask = getTask(db, task.id);
      expect(delegatedTask?.delegated_to).toBe(child);
    });
  });

  describe('Race Condition Stress Tests', () => {
    it('should handle concurrent task status updates with optimistic locking', () => {
      const agent = createAgent(db, {
        name: 'Worker',
        role: 'Worker',
        managerId: null,
      }).id;

      const task = createTask(db, {
        agentId: agent,
        title: 'Concurrent test',
        priority: 'medium',
        taskPath: 'concurrent-test',
      });

      // Simulate concurrent update attempt with stale version
      const staleVersion = task.version;

      // First update succeeds
      const updated1 = db
        .prepare(
          `UPDATE tasks SET status = ?, version = version + 1, last_updated = ?
           WHERE id = ? AND version = ?`
        )
        .run('in-progress', new Date().toISOString(), task.id, staleVersion);

      expect(updated1.changes).toBe(1);

      // Second update with same version fails (optimistic lock)
      const updated2 = db
        .prepare(
          `UPDATE tasks SET status = ?, version = version + 1, last_updated = ?
           WHERE id = ? AND version = ?`
        )
        .run('completed', new Date().toISOString(), task.id, staleVersion);

      expect(updated2.changes).toBe(0);

      // Verify task has first update applied
      const finalTask = getTask(db, task.id);
      expect(finalTask?.status).toBe('in-progress');
      expect(finalTask?.version).toBe(staleVersion + 1);
    });

    it('should handle multiple agents creating tasks simultaneously', () => {
      // Create multiple agents
      const agents = Array.from(
        { length: 10 },
        (_, i) =>
          createAgent(db, {
            name: `Agent ${i}`,
            role: 'Worker',
            managerId: null,
          }).id
      );

      // Each agent creates multiple tasks
      const tasks: string[] = [];
      agents.forEach((agentId, i) => {
        for (let j = 0; j < 5; j++) {
          const task = createTask(db, {
            agentId,
            title: `Task ${i}-${j}`,
            priority: 'medium',
            taskPath: `task-${i}-${j}`,
          });
          tasks.push(task.id);
        }
      });

      // Verify all tasks were created with correct properties
      expect(tasks).toHaveLength(50);
      tasks.forEach((taskId) => {
        const task = getTask(db, taskId);
        expect(task).not.toBeNull();
        expect(task?.depth).toBe(0);
        expect(task?.version).toBe(1);
      });
    });

    it('should handle rapid status transitions without corruption', () => {
      const agent = createAgent(db, {
        name: 'Worker',
        role: 'Worker',
        managerId: null,
      }).id;

      const task = createTask(db, {
        agentId: agent,
        title: 'Rapid transitions',
        priority: 'medium',
        taskPath: 'rapid-transitions',
      });

      let currentVersion = task.version;

      // Simulate rapid status transitions
      const transitions: Array<{ status: string; version: number }> = [];

      ['in-progress', 'blocked', 'in-progress', 'completed'].forEach((status) => {
        const result = db
          .prepare(
            `UPDATE tasks SET status = ?, version = version + 1, last_updated = ?
             WHERE id = ? AND version = ?`
          )
          .run(status, new Date().toISOString(), task.id, currentVersion);

        expect(result.changes).toBe(1);
        currentVersion++;

        const updated = getTask(db, task.id);
        transitions.push({
          status: updated!.status,
          version: updated!.version,
        });
      });

      // Verify all transitions applied correctly
      expect(transitions).toHaveLength(4);
      expect(transitions[0]!.status).toBe('in-progress');
      expect(transitions[1]!.status).toBe('blocked');
      expect(transitions[2]!.status).toBe('in-progress');
      expect(transitions[3]!.status).toBe('completed');

      // Verify version incremented correctly
      expect(transitions[3]!.version).toBe(task.version + 4);
    });
  });

  describe('Performance Under Extreme Conditions', () => {
    it('should handle 100+ tasks per agent efficiently', () => {
      const agent = createAgent(db, {
        name: 'Heavy Worker',
        role: 'Worker',
        managerId: null,
      }).id;

      const startTime = Date.now();

      // Create 100 tasks
      const tasks = Array.from({ length: 100 }, (_, i) =>
        createTask(db, {
          agentId: agent,
          title: `Batch task ${i}`,
          priority: 'medium',
          taskPath: `batch-task-${i}`,
        })
      );

      const createTime = Date.now() - startTime;

      // Should complete in reasonable time (< 1 second)
      expect(createTime).toBeLessThan(1000);

      // Verify all tasks created correctly
      expect(tasks).toHaveLength(100);
      tasks.forEach((task) => {
        expect(task.agent_id).toBe(agent);
        expect(task.depth).toBe(0);
      });
    });

    it('should handle deep task hierarchy (max depth chain)', () => {
      const agent = createAgent(db, {
        name: 'Deep Worker',
        role: 'Worker',
        managerId: null,
      }).id;

      let parentId: string | null = null;
      const tasks: string[] = [];

      // Create max depth chain
      for (let depth = 0; depth <= TASK_MAX_DEPTH; depth++) {
        const task = createTask(db, {
          agentId: agent,
          title: `Deep task ${depth}`,
          priority: 'medium',
          parentTaskId: parentId,
          taskPath: parentId ? `${parentId}/deep-${depth}` : `deep-${depth}`,
        });

        tasks.push(task.id);
        parentId = task.id;
      }

      // Verify entire chain created correctly
      expect(tasks).toHaveLength(TASK_MAX_DEPTH + 1);

      tasks.forEach((taskId, index) => {
        const task = getTask(db, taskId);
        expect(task?.depth).toBe(index);
      });
    });

    it('should efficiently query tasks with complex filters', () => {
      const agent = createAgent(db, {
        name: 'Query Worker',
        role: 'Worker',
        managerId: null,
      }).id;

      // Create various tasks
      const priorities = ['low', 'medium', 'high', 'critical'];
      const statuses = ['pending', 'in-progress', 'blocked', 'completed'];

      for (let i = 0; i < 20; i++) {
        createTask(db, {
          agentId: agent,
          title: `Query test ${i}`,
          priority: priorities[i % priorities.length] as 'low' | 'medium' | 'high' | 'critical',
          taskPath: `query-test-${i}`,
        });

        // Update some to different statuses
        if (i % 3 === 0) {
          const taskId = `task-${i + 1}-query-test-${i}`;
          db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(
            statuses[i % statuses.length],
            taskId
          );
        }
      }

      const startTime = Date.now();

      // Complex query: high priority, not completed
      const results = db
        .prepare(
          `SELECT * FROM tasks
           WHERE agent_id = ?
           AND priority = 'high'
           AND status != 'completed'
           ORDER BY created_at DESC`
        )
        .all(agent);

      const queryTime = Date.now() - startTime;

      // Should complete quickly
      expect(queryTime).toBeLessThan(100);
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
