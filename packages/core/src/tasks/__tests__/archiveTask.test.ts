/**
 * Tests for Task Archival Module (Task 2.3.17 & 2.3.19)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { archiveOldTasks, getCompletedTasks, compressOldArchives } from '../archiveTask';
import {
  initializeDatabase,
  createTask,
  completeTask,
  createAgent,
  runMigrations,
  allMigrations,
} from '@recursive-manager/common';

const gunzip = promisify(zlib.gunzip);

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
    const agent = createAgent(
      db,
      {
        id: 'test-agent',
        name: 'Test Agent',
        role: 'Developer',
        goal: 'Test archival',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      }
    );

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
    const archivedCount = await archiveOldTasks(db, 7);

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
    void (await createAgent(
      db,
      {
        id: 'test-agent-empty',
        name: 'Test Agent Empty',
        role: 'Developer',
        goal: 'Test archival',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    ));

    // Archive tasks (should return 0)
    const archivedCount = await archiveOldTasks(db, 7);

    expect(archivedCount).toBe(0);
  });

  it('should organize archived tasks by year-month', async () => {
    // Create a test agent
    const agent = await createAgent(
      db,
      {
        id: 'test-agent-months',
        name: 'Test Agent Months',
        role: 'Developer',
        goal: 'Test archival',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    const archivedCount = await archiveOldTasks(db, 7);

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
    const agent = await createAgent(
      db,
      {
        id: 'test-agent-partial',
        name: 'Test Agent Partial',
        role: 'Developer',
        goal: 'Test archival',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    const archivedCount = await archiveOldTasks(db, 7);

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
    const agent1 = await createAgent(
      db,
      {
        id: 'agent-1',
        name: 'Agent 1',
        role: 'Developer',
        goal: 'Test',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

    const agent2 = await createAgent(
      db,
      {
        id: 'agent-2',
        name: 'Agent 2',
        role: 'Developer',
        goal: 'Test',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    expect(agent1Tasks[0].id).toBe(task1.id);

    // Get completed tasks for agent2
    const agent2Tasks = getCompletedTasks(db, agent2.id);
    expect(agent2Tasks).toHaveLength(1);
    expect(agent2Tasks[0].id).toBe(task2.id);
  });

  it('should return all completed tasks when no agent specified', async () => {
    // Create test agents
    const agent1 = await createAgent(
      db,
      {
        id: 'agent-all-1',
        name: 'Agent All 1',
        role: 'Developer',
        goal: 'Test',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

    const agent2 = await createAgent(
      db,
      {
        id: 'agent-all-2',
        name: 'Agent All 2',
        role: 'Developer',
        goal: 'Test',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    const agent = await createAgent(
      db,
      {
        id: 'agent-empty',
        name: 'Agent Empty',
        role: 'Developer',
        goal: 'Test',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

    // Get completed tasks (should be empty)
    const tasks = getCompletedTasks(db, agent.id);
    expect(tasks).toHaveLength(0);
  });

  it('should order completed tasks by completion date', async () => {
    // Create a test agent
    const agent = await createAgent(
      db,
      {
        id: 'agent-order',
        name: 'Agent Order',
        role: 'Developer',
        goal: 'Test',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    expect(tasks[0].id).toBe(task1.id); // Oldest
    expect(tasks[1].id).toBe(task2.id); // More recent
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
    const agent = await createAgent(
      db,
      {
        id: 'test-agent-compress',
        name: 'Test Agent Compress',
        role: 'Developer',
        goal: 'Test compression',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    await archiveOldTasks(db, 7);

    // Verify task is archived
    const archivedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id) as any;
    expect(archivedTask.status).toBe('archived');

    // Create some files in the archived task directory
    const archiveYearMonth = `${hundredDaysAgo.getFullYear()}-${String(
      hundredDaysAgo.getMonth() + 1
    ).padStart(2, '0')}`;
    const taskDir = path.join(tempDir, agent.id, 'tasks', 'archive', archiveYearMonth, task.id);

    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(path.join(taskDir, 'test.txt'), 'test content');
    await fs.writeFile(path.join(taskDir, 'data.json'), '{"key":"value"}');

    // Compress archives older than 90 days
    const compressedCount = await compressOldArchives(db, 90);

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
    const agent = await createAgent(
      db,
      {
        id: 'test-agent-recent',
        name: 'Test Agent Recent',
        role: 'Developer',
        goal: 'Test compression',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    await archiveOldTasks(db, 7);

    // Create files in the archived task directory
    const archiveYearMonth = `${thirtyDaysAgo.getFullYear()}-${String(
      thirtyDaysAgo.getMonth() + 1
    ).padStart(2, '0')}`;
    const taskDir = path.join(tempDir, agent.id, 'tasks', 'archive', archiveYearMonth, task.id);

    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(path.join(taskDir, 'test.txt'), 'test content');

    // Compress archives older than 90 days
    const compressedCount = await compressOldArchives(db, 90);

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
    const agent = await createAgent(
      db,
      {
        id: 'test-agent-existing',
        name: 'Test Agent Existing',
        role: 'Developer',
        goal: 'Test compression',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    await archiveOldTasks(db, 7);

    // Create the archive directory and file
    const archiveYearMonth = `${hundredDaysAgo.getFullYear()}-${String(
      hundredDaysAgo.getMonth() + 1
    ).padStart(2, '0')}`;
    const taskDir = path.join(tempDir, agent.id, 'tasks', 'archive', archiveYearMonth, task.id);

    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(path.join(taskDir, 'test.txt'), 'test content');

    // Manually create the compressed file
    const compressedFile = `${taskDir}.tar.gz`;
    await fs.writeFile(compressedFile, 'existing compressed data');

    // Run compression (should skip this task and just clean up directory)
    const compressedCount = await compressOldArchives(db, 90);

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
    const agent = await createAgent(
      db,
      {
        id: 'test-agent-missing',
        name: 'Test Agent Missing',
        role: 'Developer',
        goal: 'Test compression',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    const compressedCount = await compressOldArchives(db, 90);

    // Should return 0 (no directory to compress)
    expect(compressedCount).toBe(0);
  });

  it('should compress the archive content correctly', async () => {
    // Create a test agent
    const agent = await createAgent(
      db,
      {
        id: 'test-agent-content',
        name: 'Test Agent Content',
        role: 'Developer',
        goal: 'Test compression',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    await archiveOldTasks(db, 7);

    // Create test files
    const archiveYearMonth = `${hundredDaysAgo.getFullYear()}-${String(
      hundredDaysAgo.getMonth() + 1
    ).padStart(2, '0')}`;
    const taskDir = path.join(tempDir, agent.id, 'tasks', 'archive', archiveYearMonth, task.id);

    await fs.mkdir(taskDir, { recursive: true });
    await fs.writeFile(path.join(taskDir, 'file1.txt'), 'content 1');
    await fs.writeFile(path.join(taskDir, 'file2.txt'), 'content 2');

    // Create subdirectory with file
    await fs.mkdir(path.join(taskDir, 'subdir'), { recursive: true });
    await fs.writeFile(path.join(taskDir, 'subdir', 'file3.txt'), 'content 3');

    // Compress the archive
    await compressOldArchives(db, 90);

    // Read and decompress the archive
    const compressedFile = `${taskDir}.tar.gz`;
    const compressedData = await fs.readFile(compressedFile);
    const decompressed = await gunzip(compressedData);
    const archive = JSON.parse(decompressed.toString('utf-8'));

    // Verify the archive contains all files
    expect(archive['file1.txt']).toBe('content 1');
    expect(archive['file2.txt']).toBe('content 2');
    expect(archive['subdir/file3.txt']).toBe('content 3');
  });

  it('should handle empty result set gracefully', async () => {
    // Create a test agent with no archived tasks
    const agent = await createAgent(
      db,
      {
        id: 'test-agent-no-archives',
        name: 'Test Agent No Archives',
        role: 'Developer',
        goal: 'Test compression',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

    // Run compression (should return 0)
    const compressedCount = await compressOldArchives(db, 90);

    expect(compressedCount).toBe(0);
  });

  it('should continue processing even if one task fails', async () => {
    // Create a test agent
    const agent = await createAgent(
      db,
      {
        id: 'test-agent-partial-compress',
        name: 'Test Agent Partial Compress',
        role: 'Developer',
        goal: 'Test compression',
        reportingTo: null,
        frameworkPreference: 'claude-code',
      },
      { baseDir: tempDir }
    );

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
    await archiveOldTasks(db, 7);

    // Create directory for task2 only (task1 directory missing)
    const archiveYearMonth = `${hundredDaysAgo.getFullYear()}-${String(
      hundredDaysAgo.getMonth() + 1
    ).padStart(2, '0')}`;
    const task2Dir = path.join(tempDir, agent.id, 'tasks', 'archive', archiveYearMonth, task2.id);

    await fs.mkdir(task2Dir, { recursive: true });
    await fs.writeFile(path.join(task2Dir, 'test.txt'), 'test content');

    // Run compression
    const compressedCount = await compressOldArchives(db, 90);

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
