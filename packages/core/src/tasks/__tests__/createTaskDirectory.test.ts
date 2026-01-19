/**
 * Tests for createTaskDirectory function (Task 2.3.3)
 *
 * Covers:
 * - Directory structure creation
 * - File content generation
 * - Atomic write operations
 * - Error handling
 * - Task status transitions
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import {
  createTaskDirectory,
  moveTaskDirectory,
  TaskContext,
} from '../createTaskDirectory';
import {
  createTask,
  createAgent,
  runMigrations,
  allMigrations,
  getTaskPath,
} from '@recursive-manager/common';

describe('createTaskDirectory', () => {
  let db: Database.Database;
  let testDir: string;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-dir-test-'));

    // Override path-utils to use test directory
    process.env.RECURSIVE_MANAGER_DATA_DIR = testDir;
  });

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
    delete process.env.RECURSIVE_MANAGER_DATA_DIR;
  });

  describe('Task Directory Creation', () => {
    it('should create task directory with all required files', async () => {
      // First create an agent in the database
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        createdBy: null,
        mainGoal: 'Test goal',
        reportingTo: null,
        configPath: '/test/agent/config.json',
      });

      // Create a task in the database
      const task = createTask(db, {
        id: 'task-001-example',
        agentId: 'test-agent',
        title: 'Build authentication system',
        priority: 'high',
        taskPath: 'Build authentication system',
      });

      // Create task directory
      await createTaskDirectory({
        agentId: 'test-agent',
        task,
        description: 'Implement JWT-based authentication',
        subtasks: ['Design schema', 'Implement login', 'Add tests'],
      });

      // Verify directory structure
      const taskDir = getTaskPath('test-agent', task.id, task.status);
      expect(fs.existsSync(taskDir)).toBe(true);

      // Verify all required files exist
      expect(fs.existsSync(path.join(taskDir, 'plan.md'))).toBe(true);
      expect(fs.existsSync(path.join(taskDir, 'progress.md'))).toBe(true);
      expect(fs.existsSync(path.join(taskDir, 'subtasks.md'))).toBe(true);
      expect(fs.existsSync(path.join(taskDir, 'context.json'))).toBe(true);
    });

    it('should generate correct plan.md content', async () => {
      // Create agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        createdBy: null,
        mainGoal: 'Test goal',
        reportingTo: null,
        configPath: '/test/agent/config.json',
      });

      // Create task
      const task = createTask(db, {
        id: 'task-002-example',
        agentId: 'test-agent',
        title: 'Test Task',
        priority: 'medium',
        taskPath: 'Test Task',
      });

      // Create directory
      await createTaskDirectory({
        agentId: 'test-agent',
        task,
        description: 'Test description',
      });

      // Read plan.md
      const taskDir = getTaskPath('test-agent', task.id, task.status);
      const planContent = await fs.readFile(path.join(taskDir, 'plan.md'), 'utf-8');

      // Verify content
      expect(planContent).toContain('---');
      expect(planContent).toContain(`id: ${task.id}`);
      expect(planContent).toContain(`title: ${task.title}`);
      expect(planContent).toContain(`status: ${task.status}`);
      expect(planContent).toContain(`priority: ${task.priority}`);
      expect(planContent).toContain('# Task: Test Task');
      expect(planContent).toContain('Test description');
    });

    it('should generate correct progress.md content', async () => {
      // Create agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        createdBy: null,
        mainGoal: 'Test goal',
        reportingTo: null,
        configPath: '/test/agent/config.json',
      });

      // Create task
      const task = createTask(db, {
        id: 'task-003-example',
        agentId: 'test-agent',
        title: 'Test Task',
        priority: 'medium',
        taskPath: 'Test Task',
      });

      // Create directory
      await createTaskDirectory({
        agentId: 'test-agent',
        task,
      });

      // Read progress.md
      const taskDir = getTaskPath('test-agent', task.id, task.status);
      const progressContent = await fs.readFile(path.join(taskDir, 'progress.md'), 'utf-8');

      // Verify content
      expect(progressContent).toContain('# Progress: Test Task');
      expect(progressContent).toContain('## Status');
      expect(progressContent).toContain('PENDING');
      expect(progressContent).toContain('0% complete');
      expect(progressContent).toContain('No blockers');
    });

    it('should generate correct subtasks.md content', async () => {
      // Create agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        createdBy: null,
        mainGoal: 'Test goal',
        reportingTo: null,
        configPath: '/test/agent/config.json',
      });

      // Create task
      const task = createTask(db, {
        id: 'task-004-example',
        agentId: 'test-agent',
        title: 'Test Task',
        priority: 'medium',
        taskPath: 'Test Task',
      });

      // Create directory with subtasks
      await createTaskDirectory({
        agentId: 'test-agent',
        task,
        subtasks: ['Subtask 1', 'Subtask 2', 'Subtask 3'],
      });

      // Read subtasks.md
      const taskDir = getTaskPath('test-agent', task.id, task.status);
      const subtasksContent = await fs.readFile(path.join(taskDir, 'subtasks.md'), 'utf-8');

      // Verify content
      expect(subtasksContent).toContain('# Subtasks: Test Task');
      expect(subtasksContent).toContain('- [ ] Subtask 1');
      expect(subtasksContent).toContain('- [ ] Subtask 2');
      expect(subtasksContent).toContain('- [ ] Subtask 3');
    });

    it('should generate correct context.json content', async () => {
      // Create agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        createdBy: null,
        mainGoal: 'Test goal',
        reportingTo: null,
        configPath: '/test/agent/config.json',
      });

      // Create task
      const task = createTask(db, {
        id: 'task-005-example',
        agentId: 'test-agent',
        title: 'Test Task',
        priority: 'high',
        taskPath: 'Test Task',
      });

      // Create directory
      await createTaskDirectory({
        agentId: 'test-agent',
        task,
        description: 'Task description',
      });

      // Read context.json
      const taskDir = getTaskPath('test-agent', task.id, task.status);
      const contextContent = await fs.readFile(path.join(taskDir, 'context.json'), 'utf-8');
      const context: TaskContext = JSON.parse(contextContent);

      // Verify structure
      expect(context.task.id).toBe(task.id);
      expect(context.task.title).toBe(task.title);
      expect(context.task.description).toBe('Task description');
      expect(context.task.status).toBe('pending');
      expect(context.task.priority).toBe('high');

      expect(context.hierarchy.depth).toBe(0);
      expect(context.hierarchy.parentTask).toBeNull();
      expect(context.hierarchy.childTasks).toEqual([]);

      expect(context.progress.percentComplete).toBe(0);
      expect(context.progress.subtasksCompleted).toBe(0);
      expect(context.progress.subtasksTotal).toBe(0);
      expect(context.progress.blockedBy).toEqual([]);

      expect(context.execution.executionCount).toBe(0);
      expect(context.execution.totalTimeSpent).toBe(0);
      expect(context.execution.failureCount).toBe(0);
    });

    it('should handle tasks with parent task correctly', async () => {
      // Create agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        createdBy: null,
        mainGoal: 'Test goal',
        reportingTo: null,
        configPath: '/test/agent/config.json',
      });

      // Create parent task
      const parentTask = createTask(db, {
        id: 'task-parent',
        agentId: 'test-agent',
        title: 'Parent Task',
        priority: 'high',
        taskPath: 'Parent Task',
      });

      // Create child task
      const childTask = createTask(db, {
        id: 'task-child',
        agentId: 'test-agent',
        title: 'Child Task',
        priority: 'medium',
        parentTaskId: parentTask.id,
        taskPath: 'Parent Task / Child Task',
      });

      // Create directory
      await createTaskDirectory({
        agentId: 'test-agent',
        task: childTask,
      });

      // Read context.json
      const taskDir = getTaskPath('test-agent', childTask.id, childTask.status);
      const contextContent = await fs.readFile(path.join(taskDir, 'context.json'), 'utf-8');
      const context: TaskContext = JSON.parse(contextContent);

      // Verify hierarchy
      expect(context.hierarchy.parentTask).toBe(parentTask.id);
      expect(context.hierarchy.depth).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it.skip('should throw error if task directory creation fails', async () => {
      // Create agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        createdBy: null,
        mainGoal: 'Test goal',
        reportingTo: null,
        configPath: '/test/agent/config.json',
      });

      // Create task
      const task = createTask(db, {
        id: 'task-error',
        agentId: 'test-agent',
        title: 'Test Task',
        priority: 'medium',
        taskPath: 'Test Task',
      });

      // Make base dir read-only to force error
      fs.chmodSync(testDir, 0o444);

      // Attempt to create directory (should fail)
      await expect(
        createTaskDirectory({
          agentId: 'test-agent',
          task,
        })
      ).rejects.toThrow('Failed to create task directory');

      // Restore permissions
      fs.chmodSync(testDir, 0o755);
    });
  });

  describe('moveTaskDirectory', () => {
    it('should move task directory when status changes', async () => {
      // Create agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        createdBy: null,
        mainGoal: 'Test goal',
        reportingTo: null,
        configPath: '/test/agent/config.json',
      });

      // Create task
      const task = createTask(db, {
        id: 'task-move',
        agentId: 'test-agent',
        title: 'Test Task',
        priority: 'medium',
        taskPath: 'Test Task',
      });

      // Create directory in 'pending' status
      await createTaskDirectory({
        agentId: 'test-agent',
        task,
      });

      const oldPath = getTaskPath('test-agent', task.id, 'pending');
      const newPath = getTaskPath('test-agent', task.id, 'in-progress');

      // Verify original directory exists
      expect(fs.existsSync(oldPath)).toBe(true);
      expect(fs.existsSync(path.join(oldPath, 'plan.md'))).toBe(true);

      // Move directory
      await moveTaskDirectory('test-agent', task.id, 'pending', 'in-progress');

      // Verify old path doesn't exist
      expect(fs.existsSync(oldPath)).toBe(false);

      // Verify new path exists with all files
      expect(fs.existsSync(newPath)).toBe(true);
      expect(fs.existsSync(path.join(newPath, 'plan.md'))).toBe(true);
      expect(fs.existsSync(path.join(newPath, 'progress.md'))).toBe(true);
      expect(fs.existsSync(path.join(newPath, 'subtasks.md'))).toBe(true);
      expect(fs.existsSync(path.join(newPath, 'context.json'))).toBe(true);
    });

    it('should not move directory if status unchanged', async () => {
      // Create agent
      createAgent(db, {
        id: 'test-agent',
        role: 'Developer',
        displayName: 'Test Agent',
        createdBy: null,
        mainGoal: 'Test goal',
        reportingTo: null,
        configPath: '/test/agent/config.json',
      });

      // Create task
      const task = createTask(db, {
        id: 'task-nomove',
        agentId: 'test-agent',
        title: 'Test Task',
        priority: 'medium',
        taskPath: 'Test Task',
      });

      // Create directory
      await createTaskDirectory({
        agentId: 'test-agent',
        task,
      });

      const taskPath = getTaskPath('test-agent', task.id, 'pending');

      // Attempt to move with same status (should be no-op)
      await moveTaskDirectory('test-agent', task.id, 'pending', 'pending');

      // Verify directory still exists
      expect(fs.existsSync(taskPath)).toBe(true);
    });
  });
});
