/**
 * Tests for Task Query API (Task 1.3.16)
 *
 * This test suite verifies:
 * - createTask() creates task with correct depth
 * - getTask() retrieves task by ID
 * - Depth validation enforces TASK_MAX_DEPTH
 * - Parent task subtask count is updated
 * - Error handling for invalid inputs
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { initializeDatabase } from '../index';
import { runMigrations } from '../migrations';
import { allMigrations } from '../migrations/index';
import {
  createAgent,
  createTask,
  getTask,
  updateTaskStatus,
  getActiveTasks,
  CreateTaskInput,
} from '../queries';
import { TASK_MAX_DEPTH } from '../constants';

describe('Task Query API', () => {
  let dbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    // Create temporary database
    dbPath = path.join(__dirname, `test-tasks-${Date.now()}.db`);
    const connection = initializeDatabase({ path: dbPath });
    db = connection.db;

    // Run migrations to create tables
    runMigrations(db, allMigrations);

    // Create a test agent for tasks
    createAgent(db, {
      id: 'agent-001',
      role: 'Developer',
      displayName: 'Alice Developer',
      createdBy: null,
      reportingTo: null,
      mainGoal: 'Build software',
      configPath: '/data/agents/ag/agent-001/config.json',
    });
  });

  afterEach(() => {
    // Clean up
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Clean up WAL and SHM files
    ['-wal', '-shm'].forEach((ext) => {
      const file = dbPath + ext;
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe('getTask()', () => {
    it('should return null for non-existent task', () => {
      const task = getTask(db, 'non-existent');
      expect(task).toBeNull();
    });
  });

  describe('createTask()', () => {
    it('should create a root task (no parent) with depth 0', () => {
      const input: CreateTaskInput = {
        id: 'task-001',
        agentId: 'agent-001',
        title: 'Build new feature',
        priority: 'high',
        taskPath: 'Build new feature',
      };

      const task = createTask(db, input);

      expect(task).toBeDefined();
      expect(task.id).toBe('task-001');
      expect(task.agent_id).toBe('agent-001');
      expect(task.title).toBe('Build new feature');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('high');
      expect(task.parent_task_id).toBeNull();
      expect(task.depth).toBe(0);
      expect(task.percent_complete).toBe(0);
      expect(task.subtasks_completed).toBe(0);
      expect(task.subtasks_total).toBe(0);
      expect(task.delegated_to).toBeNull();
      expect(task.delegated_at).toBeNull();
      expect(task.blocked_by).toBe('[]');
      expect(task.blocked_since).toBeNull();
      expect(task.task_path).toBe('Build new feature');
      expect(task.version).toBe(0);
      expect(task.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO 8601
      expect(task.started_at).toBeNull();
      expect(task.completed_at).toBeNull();
    });

    it('should use default priority "medium" if not specified', () => {
      const input: CreateTaskInput = {
        id: 'task-002',
        agentId: 'agent-001',
        title: 'Another task',
        taskPath: 'Another task',
      };

      const task = createTask(db, input);

      expect(task.priority).toBe('medium');
    });

    it('should create a subtask with depth 1', () => {
      // Create root task
      const rootInput: CreateTaskInput = {
        id: 'task-root',
        agentId: 'agent-001',
        title: 'Root task',
        taskPath: 'Root task',
      };
      createTask(db, rootInput);

      // Create subtask
      const subtaskInput: CreateTaskInput = {
        id: 'task-sub-1',
        agentId: 'agent-001',
        title: 'Subtask 1',
        parentTaskId: 'task-root',
        taskPath: 'Root task / Subtask 1',
      };
      const subtask = createTask(db, subtaskInput);

      expect(subtask.depth).toBe(1);
      expect(subtask.parent_task_id).toBe('task-root');
    });

    it('should update parent subtasks_total count', () => {
      // Create root task
      createTask(db, {
        id: 'task-root',
        agentId: 'agent-001',
        title: 'Root task',
        taskPath: 'Root task',
      });

      // Create first subtask
      createTask(db, {
        id: 'task-sub-1',
        agentId: 'agent-001',
        title: 'Subtask 1',
        parentTaskId: 'task-root',
        taskPath: 'Root task / Subtask 1',
      });

      // Check parent's subtask count
      const parent = getTask(db, 'task-root');
      expect(parent?.subtasks_total).toBe(1);

      // Create second subtask
      createTask(db, {
        id: 'task-sub-2',
        agentId: 'agent-001',
        title: 'Subtask 2',
        parentTaskId: 'task-root',
        taskPath: 'Root task / Subtask 2',
      });

      // Check parent's subtask count again
      const parentUpdated = getTask(db, 'task-root');
      expect(parentUpdated?.subtasks_total).toBe(2);
    });

    it('should create nested tasks with correct depths', () => {
      // Create depth 0
      createTask(db, {
        id: 'task-d0',
        agentId: 'agent-001',
        title: 'Depth 0',
        taskPath: 'D0',
      });

      // Create depth 1
      createTask(db, {
        id: 'task-d1',
        agentId: 'agent-001',
        title: 'Depth 1',
        parentTaskId: 'task-d0',
        taskPath: 'D0 / D1',
      });

      // Create depth 2
      createTask(db, {
        id: 'task-d2',
        agentId: 'agent-001',
        title: 'Depth 2',
        parentTaskId: 'task-d1',
        taskPath: 'D0 / D1 / D2',
      });

      // Create depth 3
      createTask(db, {
        id: 'task-d3',
        agentId: 'agent-001',
        title: 'Depth 3',
        parentTaskId: 'task-d2',
        taskPath: 'D0 / D1 / D2 / D3',
      });

      // Verify depths
      expect(getTask(db, 'task-d0')?.depth).toBe(0);
      expect(getTask(db, 'task-d1')?.depth).toBe(1);
      expect(getTask(db, 'task-d2')?.depth).toBe(2);
      expect(getTask(db, 'task-d3')?.depth).toBe(3);
    });

    it('should create task with delegated_to field', () => {
      // Create another agent to delegate to
      createAgent(db, {
        id: 'agent-002',
        role: 'Junior Dev',
        displayName: 'Bob Junior',
        createdBy: 'agent-001',
        reportingTo: 'agent-001',
        mainGoal: 'Learn and help',
        configPath: '/data/agents/ag/agent-002/config.json',
      });

      const task = createTask(db, {
        id: 'task-delegated',
        agentId: 'agent-001',
        title: 'Delegated task',
        delegatedTo: 'agent-002',
        taskPath: 'Delegated task',
      });

      expect(task.delegated_to).toBe('agent-002');
    });

    it('should throw error if agent does not exist', () => {
      const input: CreateTaskInput = {
        id: 'task-bad',
        agentId: 'non-existent-agent',
        title: 'Bad task',
        taskPath: 'Bad task',
      };

      expect(() => createTask(db, input)).toThrow('Agent not found: non-existent-agent');
    });

    it('should throw error if parent task does not exist', () => {
      const input: CreateTaskInput = {
        id: 'task-orphan',
        agentId: 'agent-001',
        title: 'Orphan task',
        parentTaskId: 'non-existent-parent',
        taskPath: 'Orphan task',
      };

      expect(() => createTask(db, input)).toThrow('Parent task not found: non-existent-parent');
    });

    it('should throw error if parent is at maximum depth', () => {
      // Create tasks up to max depth
      let parentId = null;
      for (let depth = 0; depth <= TASK_MAX_DEPTH; depth++) {
        const taskId = `task-depth-${depth}`;
        createTask(db, {
          id: taskId,
          agentId: 'agent-001',
          title: `Task at depth ${depth}`,
          parentTaskId: parentId,
          taskPath: `Path ${depth}`,
        });
        parentId = taskId;
      }

      // Try to create one more level beyond max depth
      const input: CreateTaskInput = {
        id: 'task-too-deep',
        agentId: 'agent-001',
        title: 'Task too deep',
        parentTaskId: parentId!,
        taskPath: 'Too deep',
      };

      expect(() => createTask(db, input)).toThrow(
        `Cannot create subtask: parent task is at maximum depth (${TASK_MAX_DEPTH})`
      );
    });

    it('should provide detailed error message with parent info when depth exceeded', () => {
      // Create tasks up to max depth
      let parentId = null;
      for (let depth = 0; depth <= TASK_MAX_DEPTH; depth++) {
        const taskId = `task-depth-${depth}`;
        createTask(db, {
          id: taskId,
          agentId: 'agent-001',
          title: `Task at depth ${depth}`,
          parentTaskId: parentId,
          taskPath: `Path ${depth}`,
        });
        parentId = taskId;
      }

      expect(() =>
        createTask(db, {
          id: 'task-too-deep',
          agentId: 'agent-001',
          title: 'Task too deep',
          parentTaskId: parentId!,
          taskPath: 'Too deep',
        })
      ).toThrow(
        new RegExp(
          `Cannot create subtask: parent task is at maximum depth \\(${TASK_MAX_DEPTH}\\).*` +
            `Parent task ".*" \\(${parentId}\\) has depth ${TASK_MAX_DEPTH}`
        )
      );
    });

    it('should allow creating task at exactly max depth', () => {
      // Create tasks up to max depth (not beyond)
      let parentId = null;
      for (let depth = 0; depth < TASK_MAX_DEPTH; depth++) {
        const taskId = `task-depth-${depth}`;
        createTask(db, {
          id: taskId,
          agentId: 'agent-001',
          title: `Task at depth ${depth}`,
          parentTaskId: parentId,
          taskPath: `Path ${depth}`,
        });
        parentId = taskId;
      }

      // Create task at exactly max depth - should succeed
      const task = createTask(db, {
        id: 'task-max-depth',
        agentId: 'agent-001',
        title: 'Task at max depth',
        parentTaskId: parentId!,
        taskPath: 'Max depth',
      });

      expect(task.depth).toBe(TASK_MAX_DEPTH);
    });
  });

  describe('updateTaskStatus()', () => {
    it('should update task status with optimistic locking', () => {
      // Create a task
      const task = createTask(db, {
        id: 'task-001',
        agentId: 'agent-001',
        title: 'Test task',
        taskPath: 'Test task',
      });

      expect(task.status).toBe('pending');
      expect(task.version).toBe(0);

      // Update status
      const updated = updateTaskStatus(db, task.id, 'in-progress', task.version);

      expect(updated.status).toBe('in-progress');
      expect(updated.version).toBe(1); // version incremented
    });

    it('should set started_at timestamp when transitioning to in-progress', () => {
      const task = createTask(db, {
        id: 'task-002',
        agentId: 'agent-001',
        title: 'Test task',
        taskPath: 'Test task',
      });

      expect(task.started_at).toBeNull();

      // Update to in-progress
      const updated = updateTaskStatus(db, task.id, 'in-progress', task.version);

      expect(updated.started_at).not.toBeNull();
      expect(updated.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO 8601
    });

    it('should not change started_at if already set', () => {
      const task = createTask(db, {
        id: 'task-003',
        agentId: 'agent-001',
        title: 'Test task',
        taskPath: 'Test task',
      });

      // First transition to in-progress
      const firstUpdate = updateTaskStatus(db, task.id, 'in-progress', task.version);
      const firstStartedAt = firstUpdate.started_at;

      // Wait a tiny bit to ensure timestamp would be different
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Small delay
      }

      // Transition to blocked and back to in-progress
      const blocked = updateTaskStatus(db, task.id, 'blocked', firstUpdate.version);
      const backToProgress = updateTaskStatus(db, task.id, 'in-progress', blocked.version);

      // started_at should be the same as the first time
      expect(backToProgress.started_at).toBe(firstStartedAt);
    });

    it('should set completed_at timestamp when transitioning to completed', () => {
      const task = createTask(db, {
        id: 'task-004',
        agentId: 'agent-001',
        title: 'Test task',
        taskPath: 'Test task',
      });

      expect(task.completed_at).toBeNull();

      // Update to completed
      const updated = updateTaskStatus(db, task.id, 'completed', task.version);

      expect(updated.completed_at).not.toBeNull();
      expect(updated.completed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO 8601
    });

    it('should clear completed_at when moving away from completed status', () => {
      const task = createTask(db, {
        id: 'task-005',
        agentId: 'agent-001',
        title: 'Test task',
        taskPath: 'Test task',
      });

      // Mark as completed
      const completed = updateTaskStatus(db, task.id, 'completed', task.version);
      expect(completed.completed_at).not.toBeNull();

      // Move back to in-progress
      const backToProgress = updateTaskStatus(db, task.id, 'in-progress', completed.version);
      expect(backToProgress.completed_at).toBeNull();
    });

    it('should throw error if task does not exist', () => {
      expect(() => updateTaskStatus(db, 'non-existent', 'in-progress', 0)).toThrow(
        'Task not found: non-existent'
      );
    });

    it('should throw error on version mismatch (optimistic locking)', () => {
      const task = createTask(db, {
        id: 'task-006',
        agentId: 'agent-001',
        title: 'Test task',
        taskPath: 'Test task',
      });

      // Update with correct version
      updateTaskStatus(db, task.id, 'in-progress', task.version);

      // Try to update again with old version (simulating concurrent modification)
      expect(() => updateTaskStatus(db, task.id, 'completed', task.version)).toThrow(
        /version mismatch/
      );
    });

    it('should provide helpful error message on version mismatch', () => {
      const task = createTask(db, {
        id: 'task-007',
        agentId: 'agent-001',
        title: 'Test task',
        taskPath: 'Test task',
      });

      // Simulate concurrent modification
      updateTaskStatus(db, task.id, 'in-progress', task.version);

      expect(() => updateTaskStatus(db, task.id, 'completed', task.version)).toThrow(
        /Expected version 0.*modified by another process.*re-fetch/
      );
    });

    it('should handle multiple sequential updates correctly', () => {
      const task = createTask(db, {
        id: 'task-008',
        agentId: 'agent-001',
        title: 'Test task',
        taskPath: 'Test task',
      });

      // Update 1: pending -> in-progress
      const v1 = updateTaskStatus(db, task.id, 'in-progress', task.version);
      expect(v1.status).toBe('in-progress');
      expect(v1.version).toBe(1);

      // Update 2: in-progress -> blocked
      const v2 = updateTaskStatus(db, task.id, 'blocked', v1.version);
      expect(v2.status).toBe('blocked');
      expect(v2.version).toBe(2);

      // Update 3: blocked -> in-progress
      const v3 = updateTaskStatus(db, task.id, 'in-progress', v2.version);
      expect(v3.status).toBe('in-progress');
      expect(v3.version).toBe(3);

      // Update 4: in-progress -> completed
      const v4 = updateTaskStatus(db, task.id, 'completed', v3.version);
      expect(v4.status).toBe('completed');
      expect(v4.version).toBe(4);
    });

    it('should allow all valid status transitions', () => {
      const statuses: Array<'pending' | 'in-progress' | 'blocked' | 'completed' | 'archived'> = [
        'pending',
        'in-progress',
        'blocked',
        'completed',
        'archived',
      ];

      let task = createTask(db, {
        id: 'task-009',
        agentId: 'agent-001',
        title: 'Test task',
        taskPath: 'Test task',
      });

      // Try transitioning through all statuses
      for (const status of statuses) {
        const updated = updateTaskStatus(db, task.id, status, task.version);
        expect(updated.status).toBe(status);
        task = updated; // Use the updated version for next iteration
      }
    });

    it('should prevent concurrent modifications from multiple processes', () => {
      const task = createTask(db, {
        id: 'task-010',
        agentId: 'agent-001',
        title: 'Test task',
        taskPath: 'Test task',
      });

      // Simulate two processes reading the same task version
      const process1Task = getTask(db, task.id)!;
      const process2Task = getTask(db, task.id)!;

      expect(process1Task.version).toBe(0);
      expect(process2Task.version).toBe(0);

      // Process 1 updates successfully
      const process1Update = updateTaskStatus(db, task.id, 'in-progress', process1Task.version);
      expect(process1Update.version).toBe(1);

      // Process 2 tries to update with old version - should fail
      expect(() => updateTaskStatus(db, task.id, 'blocked', process2Task.version)).toThrow(
        /version mismatch/
      );

      // Process 2 should re-fetch and retry
      const refreshedTask = getTask(db, task.id)!;
      expect(refreshedTask.version).toBe(1);

      const process2Retry = updateTaskStatus(db, task.id, 'blocked', refreshedTask.version);
      expect(process2Retry.status).toBe('blocked');
      expect(process2Retry.version).toBe(2);
    });
  });

  describe('getActiveTasks()', () => {
    it('should return empty array when agent has no tasks', () => {
      const tasks = getActiveTasks(db, 'agent-001');
      expect(tasks).toEqual([]);
    });

    it('should return only active tasks (pending, in-progress, blocked)', () => {
      // Create tasks with different statuses
      createTask(db, {
        id: 'task-pending',
        agentId: 'agent-001',
        title: 'Pending task',
        taskPath: 'Pending task',
      });

      const inProgressTask = createTask(db, {
        id: 'task-in-progress',
        agentId: 'agent-001',
        title: 'In progress task',
        taskPath: 'In progress task',
      });

      const blockedTask = createTask(db, {
        id: 'task-blocked',
        agentId: 'agent-001',
        title: 'Blocked task',
        taskPath: 'Blocked task',
      });

      const completedTask = createTask(db, {
        id: 'task-completed',
        agentId: 'agent-001',
        title: 'Completed task',
        taskPath: 'Completed task',
      });

      const archivedTask = createTask(db, {
        id: 'task-archived',
        agentId: 'agent-001',
        title: 'Archived task',
        taskPath: 'Archived task',
      });

      // Update statuses
      updateTaskStatus(db, inProgressTask.id, 'in-progress', inProgressTask.version);
      updateTaskStatus(db, blockedTask.id, 'blocked', blockedTask.version);
      updateTaskStatus(db, completedTask.id, 'completed', completedTask.version);
      updateTaskStatus(db, archivedTask.id, 'archived', archivedTask.version);

      // Get active tasks
      const activeTasks = getActiveTasks(db, 'agent-001');

      // Should return only pending, in-progress, and blocked tasks
      expect(activeTasks).toHaveLength(3);
      const activeIds = activeTasks.map((t) => t.id).sort();
      expect(activeIds).toEqual(['task-blocked', 'task-in-progress', 'task-pending'].sort());
    });

    it('should only return tasks for the specified agent', () => {
      // Create another agent
      createAgent(db, {
        id: 'agent-002',
        role: 'Designer',
        displayName: 'Bob Designer',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Design things',
        configPath: '/data/agents/ag/agent-002/config.json',
      });

      // Create tasks for both agents
      createTask(db, {
        id: 'task-agent1-1',
        agentId: 'agent-001',
        title: 'Agent 1 task 1',
        taskPath: 'Agent 1 task 1',
      });

      createTask(db, {
        id: 'task-agent1-2',
        agentId: 'agent-001',
        title: 'Agent 1 task 2',
        taskPath: 'Agent 1 task 2',
      });

      createTask(db, {
        id: 'task-agent2-1',
        agentId: 'agent-002',
        title: 'Agent 2 task 1',
        taskPath: 'Agent 2 task 1',
      });

      // Get tasks for agent-001
      const agent1Tasks = getActiveTasks(db, 'agent-001');
      expect(agent1Tasks).toHaveLength(2);
      expect(agent1Tasks.every((t) => t.agent_id === 'agent-001')).toBe(true);

      // Get tasks for agent-002
      const agent2Tasks = getActiveTasks(db, 'agent-002');
      expect(agent2Tasks).toHaveLength(1);
      expect(agent2Tasks[0]!.agent_id).toBe('agent-002');
    });

    it('should order tasks by priority (urgent > high > medium > low)', () => {
      // Create tasks with different priorities
      createTask(db, {
        id: 'task-low',
        agentId: 'agent-001',
        title: 'Low priority',
        priority: 'low',
        taskPath: 'Low priority',
      });

      createTask(db, {
        id: 'task-urgent',
        agentId: 'agent-001',
        title: 'Urgent priority',
        priority: 'urgent',
        taskPath: 'Urgent priority',
      });

      createTask(db, {
        id: 'task-medium',
        agentId: 'agent-001',
        title: 'Medium priority',
        priority: 'medium',
        taskPath: 'Medium priority',
      });

      createTask(db, {
        id: 'task-high',
        agentId: 'agent-001',
        title: 'High priority',
        priority: 'high',
        taskPath: 'High priority',
      });

      const activeTasks = getActiveTasks(db, 'agent-001');

      expect(activeTasks).toHaveLength(4);
      expect(activeTasks[0]!.id).toBe('task-urgent');
      expect(activeTasks[1]!.id).toBe('task-high');
      expect(activeTasks[2]!.id).toBe('task-medium');
      expect(activeTasks[3]!.id).toBe('task-low');
    });

    it('should order tasks by creation date within same priority', () => {
      // Create multiple tasks with same priority at different times
      createTask(db, {
        id: 'task-high-1',
        agentId: 'agent-001',
        title: 'High priority 1',
        priority: 'high',
        taskPath: 'High priority 1',
      });

      // Small delay to ensure different timestamps
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Small delay
      }

      createTask(db, {
        id: 'task-high-2',
        agentId: 'agent-001',
        title: 'High priority 2',
        priority: 'high',
        taskPath: 'High priority 2',
      });

      while (Date.now() - startTime < 20) {
        // Small delay
      }

      createTask(db, {
        id: 'task-high-3',
        agentId: 'agent-001',
        title: 'High priority 3',
        priority: 'high',
        taskPath: 'High priority 3',
      });

      const activeTasks = getActiveTasks(db, 'agent-001');

      expect(activeTasks).toHaveLength(3);
      // Should be ordered by creation time (oldest first)
      expect(activeTasks[0]!.id).toBe('task-high-1');
      expect(activeTasks[1]!.id).toBe('task-high-2');
      expect(activeTasks[2]!.id).toBe('task-high-3');
    });

    it('should include all task fields in returned records', () => {
      createTask(db, {
        id: 'task-full',
        agentId: 'agent-001',
        title: 'Full task',
        priority: 'high',
        taskPath: 'Full task',
      });

      const activeTasks = getActiveTasks(db, 'agent-001');

      expect(activeTasks).toHaveLength(1);
      const returnedTask = activeTasks[0]!;

      // Verify all fields are present
      expect(returnedTask.id).toBe('task-full');
      expect(returnedTask.agent_id).toBe('agent-001');
      expect(returnedTask.title).toBe('Full task');
      expect(returnedTask.status).toBe('pending');
      expect(returnedTask.priority).toBe('high');
      expect(returnedTask.created_at).toBeDefined();
      expect(returnedTask.started_at).toBeNull();
      expect(returnedTask.completed_at).toBeNull();
      expect(returnedTask.parent_task_id).toBeNull();
      expect(returnedTask.depth).toBe(0);
      expect(returnedTask.percent_complete).toBe(0);
      expect(returnedTask.subtasks_completed).toBe(0);
      expect(returnedTask.subtasks_total).toBe(0);
      expect(returnedTask.delegated_to).toBeNull();
      expect(returnedTask.delegated_at).toBeNull();
      expect(returnedTask.blocked_by).toBe('[]');
      expect(returnedTask.blocked_since).toBeNull();
      expect(returnedTask.task_path).toBe('Full task');
      expect(returnedTask.version).toBe(0);
    });

    it('should include tasks at all depths', () => {
      // Create parent task
      createTask(db, {
        id: 'task-parent',
        agentId: 'agent-001',
        title: 'Parent task',
        taskPath: 'Parent',
      });

      // Create child task
      createTask(db, {
        id: 'task-child',
        agentId: 'agent-001',
        title: 'Child task',
        parentTaskId: 'task-parent',
        taskPath: 'Parent / Child',
      });

      const activeTasks = getActiveTasks(db, 'agent-001');

      expect(activeTasks).toHaveLength(2);
      const parentTask = activeTasks.find((t) => t.id === 'task-parent');
      const childTask = activeTasks.find((t) => t.id === 'task-child');

      expect(parentTask?.depth).toBe(0);
      expect(childTask?.depth).toBe(1);
    });

    it('should handle agent with no active tasks but some completed tasks', () => {
      // Create a task and mark it as completed
      const task = createTask(db, {
        id: 'task-only-completed',
        agentId: 'agent-001',
        title: 'Completed task',
        taskPath: 'Completed task',
      });

      updateTaskStatus(db, task.id, 'completed', task.version);

      const activeTasks = getActiveTasks(db, 'agent-001');

      expect(activeTasks).toEqual([]);
    });

    it('should work with non-existent agent (return empty array)', () => {
      const activeTasks = getActiveTasks(db, 'non-existent-agent');
      expect(activeTasks).toEqual([]);
    });

    it('should handle mixed priorities and statuses correctly', () => {
      // Create a variety of tasks
      createTask(db, {
        id: 'task-1',
        agentId: 'agent-001',
        title: 'Urgent pending',
        priority: 'urgent',
        taskPath: 'Urgent pending',
      });

      const task2 = createTask(db, {
        id: 'task-2',
        agentId: 'agent-001',
        title: 'High in-progress',
        priority: 'high',
        taskPath: 'High in-progress',
      });
      updateTaskStatus(db, task2.id, 'in-progress', task2.version);

      createTask(db, {
        id: 'task-3',
        agentId: 'agent-001',
        title: 'Low pending',
        priority: 'low',
        taskPath: 'Low pending',
      });

      const task4 = createTask(db, {
        id: 'task-4',
        agentId: 'agent-001',
        title: 'Medium completed',
        priority: 'medium',
        taskPath: 'Medium completed',
      });
      updateTaskStatus(db, task4.id, 'completed', task4.version);

      const task5 = createTask(db, {
        id: 'task-5',
        agentId: 'agent-001',
        title: 'Urgent blocked',
        priority: 'urgent',
        taskPath: 'Urgent blocked',
      });
      updateTaskStatus(db, task5.id, 'blocked', task5.version);

      const activeTasks = getActiveTasks(db, 'agent-001');

      // Should return 4 tasks (all except the completed one)
      expect(activeTasks).toHaveLength(4);

      // Verify correct ordering: urgent tasks first, then high, then low
      const ids = activeTasks.map((t) => t.id);
      expect(ids[0]).toMatch(/^task-(1|5)$/); // Both urgent
      expect(ids[1]).toMatch(/^task-(1|5)$/); // Both urgent
      expect(ids[2]).toBe('task-2'); // High
      expect(ids[3]).toBe('task-3'); // Low
    });
  });
});
