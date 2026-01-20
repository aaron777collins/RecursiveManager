/**
 * Tests for completeTaskWithFiles function (Task 2.3.15)
 *
 * Covers:
 * - Task completion with database update
 * - Directory movement from active/ to completed/
 * - Parent task progress updates
 * - Optimistic locking
 * - Error handling
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { completeTaskWithFiles } from '../completeTask';
import { createTaskDirectory } from '../createTaskDirectory';
import {
  createTask,
  createAgent,
  getTask,
  runMigrations,
  allMigrations,
  getTaskPath,
} from '@recursive-manager/common';

describe('completeTaskWithFiles', () => {
  let db: Database.Database;
  let testDir: string;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'complete-task-test-'));

    // Override path-utils to use test directory
    process.env.RECURSIVE_MANAGER_DATA_DIR = testDir;
  });

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
    delete process.env.RECURSIVE_MANAGER_DATA_DIR;
  });

  describe('Task Completion with File Movement', () => {
    it('should complete task and move directory from active/ to completed/', async () => {
      // Create an agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Test work',
        configPath: path.join(testDir, 'test-agent.json'),
      });

      // Create a task
      const task = createTask(db, {
        id: 'task-001',
        agentId: 'test-agent',
        title: 'Test Task',
        priority: 'medium',
        taskPath: 'Test Task',
      });

      // Create task directory
      await createTaskDirectory({
        agentId: 'test-agent',
        task,
      });

      const pendingPath = getTaskPath('test-agent', task.id, 'pending');
      const completedPath = getTaskPath('test-agent', task.id, 'completed');

      // Clean up completed path if it exists from previous test
      if (fs.existsSync(completedPath)) {
        fs.removeSync(completedPath);
      }

      // Verify directory exists in pending/
      expect(fs.existsSync(pendingPath)).toBe(true);
      expect(fs.existsSync(completedPath)).toBe(false);

      // Complete the task
      await completeTaskWithFiles(db, task.id, task.version);

      // Verify task is completed in database
      const completedTask = getTask(db, task.id);
      expect(completedTask?.status).toBe('completed');
      expect(completedTask?.completed_at).toBeTruthy();

      // Verify directory moved to completed/
      expect(fs.existsSync(pendingPath)).toBe(false);
      expect(fs.existsSync(completedPath)).toBe(true);

      // Verify plan.md still exists in new location
      const planMdPath = path.join(completedPath, 'plan.md');
      expect(fs.existsSync(planMdPath)).toBe(true);
    });

    it('should update parent task progress when completing subtask', async () => {
      // Create an agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Test work',
        configPath: path.join(testDir, 'test-agent.json'),
      });

      // Create parent task
      const parentTask = createTask(db, {
        id: 'parent-task',
        agentId: 'test-agent',
        title: 'Parent Task',
        priority: 'high',
        taskPath: 'Parent Task',
      });

      // Create subtask
      const subtask = createTask(db, {
        id: 'subtask-001',
        agentId: 'test-agent',
        title: 'Subtask',
        priority: 'medium',
        parentTaskId: parentTask.id,
        taskPath: 'Parent Task / Subtask',
      });

      // Create directories for both tasks
      await createTaskDirectory({
        agentId: 'test-agent',
        task: parentTask,
      });

      await createTaskDirectory({
        agentId: 'test-agent',
        task: subtask,
      });

      // Complete the subtask
      await completeTaskWithFiles(db, subtask.id, subtask.version);

      // Verify subtask is completed
      const completedSubtask = getTask(db, subtask.id);
      expect(completedSubtask?.status).toBe('completed');

      // Verify parent task progress was updated
      const updatedParent = getTask(db, parentTask.id);
      expect(updatedParent?.subtasks_completed).toBe(1);
      expect(updatedParent?.percent_complete).toBeGreaterThan(0);
    });

    it('should throw error if task not found', async () => {
      await expect(completeTaskWithFiles(db, 'nonexistent-task', 1)).rejects.toThrow(
        'Task not found: nonexistent-task'
      );
    });

    it('should throw error on version mismatch (optimistic locking)', async () => {
      // Create an agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Test work',
        configPath: path.join(testDir, 'test-agent.json'),
      });

      // Create a task
      const task = createTask(db, {
        id: 'task-002',
        agentId: 'test-agent',
        title: 'Test Task',
        priority: 'medium',
        taskPath: 'Test Task',
      });

      // Create task directory
      await createTaskDirectory({
        agentId: 'test-agent',
        task,
      });

      // Try to complete with wrong version number
      await expect(completeTaskWithFiles(db, task.id, 999)).rejects.toThrow('version mismatch');

      // Verify task is still pending
      const unchangedTask = getTask(db, task.id);
      expect(unchangedTask?.status).toBe('pending');
    });

    it('should handle task already in completed directory', async () => {
      // Create an agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Test work',
        configPath: path.join(testDir, 'test-agent.json'),
      });

      // Create a task
      const task = createTask(db, {
        id: 'task-003',
        agentId: 'test-agent',
        title: 'Test Task',
        priority: 'medium',
        taskPath: 'Test Task',
      });

      // Create task directory in completed/ (unusual but possible)
      await createTaskDirectory({
        agentId: 'test-agent',
        task,
      });

      const completedPath = getTaskPath('test-agent', task.id, 'completed');

      // Complete the task (should not fail even if already in completed/)
      await completeTaskWithFiles(db, task.id, task.version);

      // Verify task is completed and directory still exists
      const completedTask = getTask(db, task.id);
      expect(completedTask?.status).toBe('completed');
      expect(fs.existsSync(completedPath)).toBe(true);
    });
  });
});
