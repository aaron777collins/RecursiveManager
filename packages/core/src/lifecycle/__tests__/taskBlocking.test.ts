/**
 * Tests for Task Blocking (Task 2.2.18)
 *
 * This test suite validates the task blocking/unblocking logic for paused agents.
 */

import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  blockTasksForPausedAgent,
  unblockTasksForResumedAgent,
  PAUSE_BLOCKER,
} from '../taskBlocking';
import { createAgent, createTask, getTask, runMigrations, allMigrations } from '@recursivemanager/common';

describe('Task Blocking for Paused Agents', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create an in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    // Initialize schema
    runMigrations(db, allMigrations);
  });

  afterEach(() => {
    // Clean up
    if (db) {
      db.close();
    }
  });

  describe('blockTasksForPausedAgent', () => {
    it('should block all active tasks when agent is paused', () => {
      // Create an agent
      const agent = createAgent(db, {
        id: 'test-agent-001',
        role: 'Developer',
        displayName: 'Test Dev',
        mainGoal: 'Test development',
        createdBy: 'test',
        configPath: '/tmp/test-agent-001.json',
        reportingTo: null,
      });

      // Create some tasks
      createTask(db, {
        id: 'task-001',
        agentId: agent.id,
        title: 'Pending task',
        priority: 'high',
        taskPath: 'Pending task',
      });

      createTask(db, {
        id: 'task-002',
        agentId: agent.id,
        title: 'Another pending task',
        priority: 'medium',
        taskPath: 'Another pending task',
      });

      // Block tasks
      const result = blockTasksForPausedAgent(db, agent.id);

      // Verify results
      expect(result.totalTasks).toBe(2);
      expect(result.blockedCount).toBe(2);
      expect(result.alreadyBlocked).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify tasks are blocked in database
      const updatedTask1 = getTask(db, 'task-001');
      const updatedTask2 = getTask(db, 'task-002');

      expect(updatedTask1?.status).toBe('blocked');
      expect(updatedTask2?.status).toBe('blocked');

      const blockedBy1 = JSON.parse(updatedTask1?.blocked_by || '[]');
      const blockedBy2 = JSON.parse(updatedTask2?.blocked_by || '[]');

      expect(blockedBy1).toContain(PAUSE_BLOCKER);
      expect(blockedBy2).toContain(PAUSE_BLOCKER);
      expect(updatedTask1?.blocked_since).toBeTruthy();
      expect(updatedTask2?.blocked_since).toBeTruthy();
    });

    it('should handle agent with no active tasks', () => {
      // Create an agent with no tasks
      const agent = createAgent(db, {
        id: 'test-agent-002',
        role: 'Developer',
        displayName: 'Test Dev 2',
        mainGoal: 'Test development',
        createdBy: 'test',
        configPath: '/tmp/test-agent-002.json',
        reportingTo: null,
      });

      // Block tasks
      const result = blockTasksForPausedAgent(db, agent.id);

      // Verify results
      expect(result.totalTasks).toBe(0);
      expect(result.blockedCount).toBe(0);
      expect(result.alreadyBlocked).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should add PAUSE_BLOCKER to already blocked tasks', () => {
      // Create an agent
      const agent = createAgent(db, {
        id: 'test-agent-003',
        role: 'Developer',
        displayName: 'Test Dev 3',
        mainGoal: 'Test development',
        createdBy: 'test',
        configPath: '/tmp/test-agent-003.json',
        reportingTo: null,
      });

      // Create a task that's already blocked by something else
      const task = createTask(db, {
        id: 'task-003',
        agentId: agent.id,
        title: 'Already blocked task',
        priority: 'high',
        taskPath: 'Already blocked task',
      });

      // Manually set it to blocked with a different blocker
      const updateStmt = db.prepare(`
        UPDATE tasks
        SET status = 'blocked', blocked_by = ?, blocked_since = ?
        WHERE id = ?
      `);
      updateStmt.run(JSON.stringify(['OTHER_BLOCKER']), new Date().toISOString(), task.id);

      // Block tasks
      const result = blockTasksForPausedAgent(db, agent.id);

      // Verify results
      expect(result.totalTasks).toBe(1);
      expect(result.blockedCount).toBe(0);
      expect(result.alreadyBlocked).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify task has both blockers
      const updatedTask = getTask(db, 'task-003');
      const blockedBy = JSON.parse(updatedTask?.blocked_by || '[]');

      expect(blockedBy).toContain('OTHER_BLOCKER');
      expect(blockedBy).toContain(PAUSE_BLOCKER);
      expect(blockedBy).toHaveLength(2);
    });
  });

  describe('unblockTasksForResumedAgent', () => {
    it('should unblock tasks that were blocked only by pause', () => {
      // Create an agent
      const agent = createAgent(db, {
        id: 'test-agent-004',
        role: 'Developer',
        displayName: 'Test Dev 4',
        mainGoal: 'Test development',
        createdBy: 'test',
        configPath: '/tmp/test-agent-004.json',
        reportingTo: null,
      });

      // Create and block tasks
      createTask(db, {
        id: 'task-004',
        agentId: agent.id,
        title: 'Blocked task',
        priority: 'high',
        taskPath: 'Blocked task',
      });

      blockTasksForPausedAgent(db, agent.id);

      // Unblock tasks
      const result = unblockTasksForResumedAgent(db, agent.id);

      // Verify results
      expect(result.totalTasks).toBe(1);
      expect(result.unblockedCount).toBe(1);
      expect(result.stillBlocked).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Verify task is unblocked in database
      const updatedTask = getTask(db, 'task-004');
      expect(updatedTask?.status).toBe('pending');
      expect(updatedTask?.blocked_by).toBe('[]');
      expect(updatedTask?.blocked_since).toBeNull();
    });

    it('should keep tasks blocked by other reasons', () => {
      // Create an agent
      const agent = createAgent(db, {
        id: 'test-agent-005',
        role: 'Developer',
        displayName: 'Test Dev 5',
        mainGoal: 'Test development',
        createdBy: 'test',
        configPath: '/tmp/test-agent-005.json',
        reportingTo: null,
      });

      // Create a task
      const task = createTask(db, {
        id: 'task-005',
        agentId: agent.id,
        title: 'Multi-blocked task',
        priority: 'high',
        taskPath: 'Multi-blocked task',
      });

      // Manually set it to blocked with multiple blockers
      const updateStmt = db.prepare(`
        UPDATE tasks
        SET status = 'blocked', blocked_by = ?, blocked_since = ?
        WHERE id = ?
      `);
      updateStmt.run(
        JSON.stringify(['OTHER_BLOCKER', PAUSE_BLOCKER]),
        new Date().toISOString(),
        task.id
      );

      // Unblock tasks
      const result = unblockTasksForResumedAgent(db, agent.id);

      // Verify results
      expect(result.totalTasks).toBe(1);
      expect(result.unblockedCount).toBe(0);
      expect(result.stillBlocked).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Verify task is still blocked but PAUSE_BLOCKER removed
      const updatedTask = getTask(db, 'task-005');
      expect(updatedTask?.status).toBe('blocked');

      const blockedBy = JSON.parse(updatedTask?.blocked_by || '[]');
      expect(blockedBy).toContain('OTHER_BLOCKER');
      expect(blockedBy).not.toContain(PAUSE_BLOCKER);
      expect(blockedBy).toHaveLength(1);
    });

    it('should handle agent with no blocked tasks', () => {
      // Create an agent
      const agent = createAgent(db, {
        id: 'test-agent-006',
        role: 'Developer',
        displayName: 'Test Dev 6',
        mainGoal: 'Test development',
        createdBy: 'test',
        configPath: '/tmp/test-agent-006.json',
        reportingTo: null,
      });

      // Unblock tasks (no tasks exist)
      const result = unblockTasksForResumedAgent(db, agent.id);

      // Verify results
      expect(result.totalTasks).toBe(0);
      expect(result.unblockedCount).toBe(0);
      expect(result.stillBlocked).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
