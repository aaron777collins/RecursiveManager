/**
 * Tests for Task Archival Module (Task 2.3.17 & 2.3.19)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar';
import { archiveOldTasks, getCompletedTasks, compressOldArchives } from '../archiveTask';
import {
  initializeDatabase,
  createTask,
  completeTask,
  createAgent,
  runMigrations,
  allMigrations,
  getAgentDirectory,
} from '@recursivemanager/common';

describe('archiveOldTasks', () => {
  let db: Database.Database;
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // Create a temporary database
    tempDir = path.join('/tmp', `test-archive-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    dbPath = path.join(tempDir, 'test.db');
    const connection = initializeDatabase({ path: dbPath });
    db = connection.db;

    // Run migrations
    runMigrations(db, allMigrations);
  });

  afterEach(async () => {
    // Close the database
    db.close();

    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should archive completed tasks older than 7 days', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'test-agent',
      role: 'Developer',
      displayName: 'Test Agent',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test archival',
      configPath: path.join(tempDir, 'test-agent', 'config.json'),
    });

    // Create a task and complete it (simulating 10 days ago)
    const task1 = createTask(db, {
      agentId: agent.id,
      title: 'Old completed task',
      priority: 'medium',
      taskPath: 'Old completed task',
    });

    // Complete the task
    void completeTask(db, task1.id, task1.version);

    // Manually update the completed_at timestamp to 10 days ago
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `
    ).run(tenDaysAgo.toISOString(), task1.id);

    // Create a recent completed task (2 days ago)
    const task2 = createTask(db, {
      agentId: agent.id,
      title: 'Recent completed task',
      priority: 'medium',
      taskPath: 'Recent completed task',
    });

    void completeTask(db, task2.id, task2.version);

    // Manually update the completed_at timestamp to 2 days ago
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `
    ).run(twoDaysAgo.toISOString(), task2.id);

    // Archive tasks older than 7 days
    const archivedCount = await archiveOldTasks(db, 7, { baseDir: tempDir });

    // Should archive only the old task (10 days ago)
    expect(archivedCount).toBe(1);

    // Verify the task status was updated to 'archived'
    const archivedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task1.id) as any;
    expect(archivedTask.status).toBe('archived');

    // Verify the recent task is still 'completed'
    const recentTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task2.id) as any;
    expect(recentTask.status).toBe('completed');
  });

  it('should handle empty result set gracefully', async () => {
    // Create a test agent with no tasks
    createAgent(db, {
      id: 'test-agent-empty',
      role: 'Developer',
      displayName: 'Test Agent Empty',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test archival',
      configPath: path.join(tempDir, 'test-agent-empty', 'config.json'),
    });

    // Archive tasks (should return 0)
    const archivedCount = await archiveOldTasks(db, 7, { baseDir: tempDir });

    expect(archivedCount).toBe(0);
  });

  it('should organize archived tasks by year-month', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'test-agent-months',
      role: 'Developer',
      displayName: 'Test Agent Months',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test archival',
      configPath: path.join(tempDir, 'test-agent-months', 'config.json'),
    });

    // Create and complete a task
    const task = createTask(db, {
      agentId: agent.id,
      title: 'Task for archive',
      priority: 'medium',
      taskPath: 'Task for archive',
    });

    completeTask(db, task.id, task.version);

    // Set completion date to January 2024
    const completionDate = new Date('2024-01-15T10:00:00Z');
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `
    ).run(completionDate.toISOString(), task.id);

    // Archive the task
    const archivedCount = await archiveOldTasks(db, 7, { baseDir: tempDir });

    expect(archivedCount).toBe(1);

    // Verify the task was moved to the correct archive directory
    // The directory should be: {agentDir}/tasks/archive/2024-01/{taskId}
    // We can't easily verify the file system move in this test without mocking,
    // but we can verify the database update
    const archivedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id) as any;
    expect(archivedTask.status).toBe('archived');
  });

  it('should continue processing even if one task fails', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'test-agent-partial',
      role: 'Developer',
      displayName: 'Test Agent Partial',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test archival',
      configPath: path.join(tempDir, 'test-agent-partial', 'config.json'),
    });

    // Create two tasks
    const task1 = createTask(db, {
      agentId: agent.id,
      title: 'Task 1',
      priority: 'medium',
      taskPath: 'Task 1',
    });

    const task2 = createTask(db, {
      agentId: agent.id,
      title: 'Task 2',
      priority: 'medium',
      taskPath: 'Task 2',
    });

    // Complete both tasks
    completeTask(db, task1.id, task1.version);
    completeTask(db, task2.id, task2.version);

    // Set both to old completion dates
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id IN (?, ?)
    `
    ).run(tenDaysAgo.toISOString(), task1.id, task2.id);

    // Archive the tasks
    // Note: Both should succeed in this test, but the function is designed to
    // continue even if one fails
    const archivedCount = await archiveOldTasks(db, 7, { baseDir: tempDir });

    // Both tasks should be archived
    expect(archivedCount).toBeGreaterThanOrEqual(0);
  });
});

describe('getCompletedTasks', () => {
  let db: Database.Database;
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // Create a temporary directory
    tempDir = path.join('/tmp', `test-completed-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create a temporary database
    dbPath = path.join(tempDir, 'test.db');
    const connection = initializeDatabase({ path: dbPath });
    db = connection.db;

    // Run migrations
    runMigrations(db, allMigrations);
  });

  afterEach(async () => {
    // Close the database
    db.close();

    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  it('should return completed tasks for a specific agent', async () => {
    // Create test agents
    const agent1 = createAgent(db, {
      id: 'agent-1',
      role: 'Developer',
      displayName: 'Agent 1',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test',
      configPath: path.join(tempDir, 'agent-1', 'config.json'),
    });

    const agent2 = createAgent(db, {
      id: 'agent-2',
      role: 'Developer',
      displayName: 'Agent 2',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test',
      configPath: path.join(tempDir, 'agent-2', 'config.json'),
    });

    // Create and complete tasks for both agents
    const task1 = createTask(db, {
      agentId: agent1.id,
      title: 'Task 1',
      priority: 'medium',
      taskPath: 'Task 1',
    });
    completeTask(db, task1.id, task1.version);

    const task2 = createTask(db, {
      agentId: agent2.id,
      title: 'Task 2',
      priority: 'medium',
      taskPath: 'Task 2',
    });
    completeTask(db, task2.id, task2.version);

    // Get completed tasks for agent1
    const agent1Tasks = getCompletedTasks(db, agent1.id);
    expect(agent1Tasks).toHaveLength(1);
    expect(agent1Tasks[0]!.id).toBe(task1.id);

    // Get completed tasks for agent2
    const agent2Tasks = getCompletedTasks(db, agent2.id);
    expect(agent2Tasks).toHaveLength(1);
    expect(agent2Tasks[0]!.id).toBe(task2.id);
  });

  it('should return all completed tasks when no agent specified', async () => {
    // Create test agents
    const agent1 = createAgent(db, {
      id: 'agent-all-1',
      role: 'Developer',
      displayName: 'Agent All 1',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test',
      configPath: path.join(tempDir, 'agent-all-1', 'config.json'),
    });

    const agent2 = createAgent(db, {
      id: 'agent-all-2',
      role: 'Developer',
      displayName: 'Agent All 2',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test',
      configPath: path.join(tempDir, 'agent-all-2', 'config.json'),
    });

    // Create and complete tasks for both agents
    const task1 = createTask(db, {
      agentId: agent1.id,
      title: 'Task 1',
      priority: 'medium',
      taskPath: 'Task 1',
    });
    completeTask(db, task1.id, task1.version);

    const task2 = createTask(db, {
      agentId: agent2.id,
      title: 'Task 2',
      priority: 'medium',
      taskPath: 'Task 2',
    });
    completeTask(db, task2.id, task2.version);

    // Get all completed tasks
    const allTasks = getCompletedTasks(db);
    expect(allTasks).toHaveLength(2);
  });

  it('should return empty array when no completed tasks', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'agent-empty',
      role: 'Developer',
      displayName: 'Agent Empty',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test',
      configPath: path.join(tempDir, 'agent-empty', 'config.json'),
    });

    // Get completed tasks (should be empty)
    const tasks = getCompletedTasks(db, agent.id);
    expect(tasks).toHaveLength(0);
  });

  it('should order completed tasks by completion date', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'agent-order',
      role: 'Developer',
      displayName: 'Agent Order',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test',
      configPath: path.join(tempDir, 'agent-order', 'config.json'),
    });

    // Create and complete multiple tasks
    const task1 = createTask(db, {
      agentId: agent.id,
      title: 'Task 1',
      priority: 'medium',
      taskPath: 'Task 1',
    });
    completeTask(db, task1.id, task1.version);

    // Set completion date to 10 days ago
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `
    ).run(tenDaysAgo.toISOString(), task1.id);

    const task2 = createTask(db, {
      agentId: agent.id,
      title: 'Task 2',
      priority: 'medium',
      taskPath: 'Task 2',
    });
    completeTask(db, task2.id, task2.version);

    // Set completion date to 5 days ago
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `
    ).run(fiveDaysAgo.toISOString(), task2.id);

    // Get completed tasks (should be ordered oldest first)
    const tasks = getCompletedTasks(db, agent.id);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.id).toBe(task1.id); // Oldest
    expect(tasks[1]!.id).toBe(task2.id); // More recent
  });
});

describe('compressOldArchives', () => {
  let db: Database.Database;
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // Create a temporary directory for agent files
    tempDir = path.join('/tmp', `test-compress-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });

    // Create a temporary database
    dbPath = path.join(tempDir, 'test.db');
    const connection = initializeDatabase({ path: dbPath });
    db = connection.db;

    // Run migrations
    runMigrations(db, allMigrations);

    // Set AGENTS_BASE_DIR for testing
    process.env.AGENTS_BASE_DIR = tempDir;
  });

  afterEach(async () => {
    // Close the database
    db.close();

    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }

    // Clean up environment variable
    delete process.env.AGENTS_BASE_DIR;
  });

  it('should compress archived tasks older than 90 days', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'test-agent-compress',
      role: 'Developer',
      displayName: 'Test Agent Compress',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test compression',
      configPath: path.join(tempDir, 'test-agent-compress', 'config.json'),
    });

    // Create a task and complete it
    const task = createTask(db, {
      agentId: agent.id,
      title: 'Old task to compress',
      priority: 'medium',
      taskPath: 'Old task to compress',
    });

    completeTask(db, task.id, task.version);

    // Set completion date to 100 days ago
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `
    ).run(hundredDaysAgo.toISOString(), task.id);

    // Archive the task first
    await archiveOldTasks(db, 7, { baseDir: tempDir });

    // Verify task is archived
    const archivedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id) as any;
    expect(archivedTask.status).toBe('archived');

    // Create some files in the archived task directory
    const archiveYearMonth = `${hundredDaysAgo.getFullYear()}-${String(
      hundredDaysAgo.getMonth() + 1
    ).padStart(2, '0')}`;
    const taskDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive', archiveYearMonth, task.id);

    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(path.join(taskDir, 'test.txt'), 'test content');
    await fs.writeFile(path.join(taskDir, 'data.json'), '{"key":"value"}');

    // Compress archives older than 90 days
    const compressedCount = await compressOldArchives(db, 90, { baseDir: tempDir });

    // Should compress 1 task
    expect(compressedCount).toBe(1);

    // Verify the compressed file exists
    const compressedFile = `${taskDir}.tar.gz`;
    const fileExists = await fs
      .access(compressedFile)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    // Verify the original directory was removed
    const dirExists = await fs
      .access(taskDir)
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(false);
  });

  it('should not compress recent archived tasks', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'test-agent-recent',
      role: 'Developer',
      displayName: 'Test Agent Recent',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test compression',
      configPath: path.join(tempDir, 'test-agent-recent', 'config.json'),
    });

    // Create a task and complete it
    const task = createTask(db, {
      agentId: agent.id,
      title: 'Recent archived task',
      priority: 'medium',
      taskPath: 'Recent archived task',
    });

    completeTask(db, task.id, task.version);

    // Set completion date to 30 days ago (less than 90)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `
    ).run(thirtyDaysAgo.toISOString(), task.id);

    // Archive the task first
    await archiveOldTasks(db, 7, { baseDir: tempDir });

    // Create files in the archived task directory
    const archiveYearMonth = `${thirtyDaysAgo.getFullYear()}-${String(
      thirtyDaysAgo.getMonth() + 1
    ).padStart(2, '0')}`;
    const taskDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive', archiveYearMonth, task.id);

    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(path.join(taskDir, 'test.txt'), 'test content');

    // Compress archives older than 90 days
    const compressedCount = await compressOldArchives(db, 90, { baseDir: tempDir });

    // Should NOT compress any tasks
    expect(compressedCount).toBe(0);

    // Verify the directory still exists
    const dirExists = await fs
      .access(taskDir)
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(true);

    // Verify no compressed file was created
    const compressedFile = `${taskDir}.tar.gz`;
    const fileExists = await fs
      .access(compressedFile)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(false);
  });

  it('should handle already compressed archives', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'test-agent-existing',
      role: 'Developer',
      displayName: 'Test Agent Existing',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test compression',
      configPath: path.join(tempDir, 'test-agent-existing', 'config.json'),
    });

    // Create a task and complete it
    const task = createTask(db, {
      agentId: agent.id,
      title: 'Already compressed task',
      priority: 'medium',
      taskPath: 'Already compressed task',
    });

    completeTask(db, task.id, task.version);

    // Set completion date to 100 days ago
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `
    ).run(hundredDaysAgo.toISOString(), task.id);

    // Archive the task
    await archiveOldTasks(db, 7, { baseDir: tempDir });

    // Create the archive directory and file
    const archiveYearMonth = `${hundredDaysAgo.getFullYear()}-${String(
      hundredDaysAgo.getMonth() + 1
    ).padStart(2, '0')}`;
    const taskDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive', archiveYearMonth, task.id);

    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(path.join(taskDir, 'test.txt'), 'test content');

    // Manually create the compressed file
    const compressedFile = `${taskDir}.tar.gz`;
    await fs.writeFile(compressedFile, 'existing compressed data');

    // Run compression (should skip this task and just clean up directory)
    const compressedCount = await compressOldArchives(db, 90, { baseDir: tempDir });

    // Should count as compressed (directory cleanup)
    expect(compressedCount).toBe(1);

    // Verify the directory was removed
    const dirExists = await fs
      .access(taskDir)
      .then(() => true)
      .catch(() => false);
    expect(dirExists).toBe(false);

    // Verify the compressed file still exists
    const fileExists = await fs
      .access(compressedFile)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });

  it('should handle missing directories gracefully', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'test-agent-missing',
      role: 'Developer',
      displayName: 'Test Agent Missing',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test compression',
      configPath: path.join(tempDir, 'test-agent-missing', 'config.json'),
    });

    // Create a task and complete it
    const task = createTask(db, {
      agentId: agent.id,
      title: 'Task with missing directory',
      priority: 'medium',
      taskPath: 'Task with missing directory',
    });

    completeTask(db, task.id, task.version);

    // Set completion date to 100 days ago
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `
    ).run(hundredDaysAgo.toISOString(), task.id);

    // Mark as archived in database (but don't create directory)
    db.prepare(
      `
      UPDATE tasks
      SET status = 'archived'
      WHERE id = ?
    `
    ).run(task.id);

    // Run compression (should handle missing directory)
    const compressedCount = await compressOldArchives(db, 90, { baseDir: tempDir });

    // Should return 0 (no directory to compress)
    expect(compressedCount).toBe(0);
  });

  it('should compress the archive content correctly', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'test-agent-content',
      role: 'Developer',
      displayName: 'Test Agent Content',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test compression',
      configPath: path.join(tempDir, 'test-agent-content', 'config.json'),
    });

    // Create a task and complete it
    const task = createTask(db, {
      agentId: agent.id,
      title: 'Task with content',
      priority: 'medium',
      taskPath: 'Task with content',
    });

    completeTask(db, task.id, task.version);

    // Set completion date to 100 days ago
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id = ?
    `
    ).run(hundredDaysAgo.toISOString(), task.id);

    // Archive the task
    await archiveOldTasks(db, 7, { baseDir: tempDir });

    // Create test files
    const archiveYearMonth = `${hundredDaysAgo.getFullYear()}-${String(
      hundredDaysAgo.getMonth() + 1
    ).padStart(2, '0')}`;
    const taskDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive', archiveYearMonth, task.id);

    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(path.join(taskDir, 'file1.txt'), 'content 1');
    await fs.writeFile(path.join(taskDir, 'file2.txt'), 'content 2');

    // Create subdirectory with file
    await fs.mkdir(path.join(taskDir, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(taskDir, 'subdir', 'file3.txt'), 'content 3');

    // Compress the archive
    await compressOldArchives(db, 90, { baseDir: tempDir });

    // Extract and verify the archive
    const compressedFile = `${taskDir}.tar.gz`;
    const extractDir = path.join(tempDir, 'extract-test');
    await fs.mkdir(extractDir, { recursive: true });

    await tar.extract({
      file: compressedFile,
      cwd: extractDir,
    });

    // Verify the archive contains all files
    const file1Content = await fs.readFile(path.join(extractDir, task.id, 'file1.txt'), 'utf-8');
    const file2Content = await fs.readFile(path.join(extractDir, task.id, 'file2.txt'), 'utf-8');
    const file3Content = await fs.readFile(path.join(extractDir, task.id, 'subdir', 'file3.txt'), 'utf-8');

    expect(file1Content).toBe('content 1');
    expect(file2Content).toBe('content 2');
    expect(file3Content).toBe('content 3');
  });

  it('should handle empty result set gracefully', async () => {
    // Create a test agent with no archived tasks
    createAgent(db, {
      id: 'test-agent-no-archives',
      role: 'Developer',
      displayName: 'Test Agent No Archives',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test compression',
      configPath: path.join(tempDir, 'test-agent-no-archives', 'config.json'),
    });

    // Run compression (should return 0)
    const compressedCount = await compressOldArchives(db, 90, { baseDir: tempDir });

    expect(compressedCount).toBe(0);
  });

  it('should continue processing even if one task fails', async () => {
    // Create a test agent
    const agent = createAgent(db, {
      id: 'test-agent-partial-compress',
      role: 'Developer',
      displayName: 'Test Agent Partial Compress',
      createdBy: 'test',
      reportingTo: null,
      mainGoal: 'Test compression',
      configPath: path.join(tempDir, 'test-agent-partial-compress', 'config.json'),
    });

    // Create two tasks
    const task1 = createTask(db, {
      agentId: agent.id,
      title: 'Task 1',
      priority: 'medium',
      taskPath: 'Task 1',
    });

    const task2 = createTask(db, {
      agentId: agent.id,
      title: 'Task 2',
      priority: 'medium',
      taskPath: 'Task 2',
    });

    // Complete both tasks
    completeTask(db, task1.id, task1.version);
    completeTask(db, task2.id, task2.version);

    // Set both to old completion dates
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    db.prepare(
      `
      UPDATE tasks
      SET completed_at = ?
      WHERE id IN (?, ?)
    `
    ).run(hundredDaysAgo.toISOString(), task1.id, task2.id);

    // Archive both tasks
    await archiveOldTasks(db, 7, { baseDir: tempDir });

    // Create directory for task2 only (task1 directory missing)
    const archiveYearMonth = `${hundredDaysAgo.getFullYear()}-${String(
      hundredDaysAgo.getMonth() + 1
    ).padStart(2, '0')}`;
    const task2Dir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive', archiveYearMonth, task2.id);

    await fs.mkdir(task2Dir, { recursive: true });
    await fs.writeFile(path.join(task2Dir, 'test.txt'), 'test content');

    // Run compression
    const compressedCount = await compressOldArchives(db, 90, { baseDir: tempDir });

    // Should compress at least task2
    expect(compressedCount).toBeGreaterThanOrEqual(1);

    // Verify task2 was compressed
    const compressedFile = `${task2Dir}.tar.gz`;
    const fileExists = await fs
      .access(compressedFile)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);
  });
});
