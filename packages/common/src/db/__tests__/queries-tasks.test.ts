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
import { createAgent, createTask, getTask, CreateTaskInput } from '../queries';
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
});
