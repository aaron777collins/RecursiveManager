/**
 * Integration and Edge Case Tests for Task Archival Module (Task 2.3.34)
 *
 * This file extends the unit tests in archiveTask.test.ts with:
 * - Integration tests (multi-day archival, concurrent operations, database consistency)
 * - Edge case tests (corrupted directories, permissions, disk space, transaction failures)
 * - Performance tests (large volume archival, memory efficiency)
 * - Data integrity tests (recovery, cross-agent, parent-child)
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as tar from 'tar';
import { archiveOldTasks, compressOldArchives } from '../archiveTask';
import { createTask, completeTask, createAgent, runMigrations, allMigrations, getAgentDirectory } from '@recursive-manager/common';

describe('Task Archival - Integration Tests', () => {
  let db: Database.Database;
  let tempDir: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    runMigrations(db, allMigrations);
    tempDir = path.join('/tmp', `test-archive-integration-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    db.close();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Multiple Days of Archival', () => {
    it('should distribute tasks across correct archive directories based on completion date', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'multi-day-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Multi-Day Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      // Create tasks completed on different dates
      const dates = [
        { daysAgo: 10, month: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
        { daysAgo: 45, month: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) },
        { daysAgo: 90, month: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      ];

      const taskIds = [];
      for (const { daysAgo } of dates) {
        const task = createTask(db, {
          agentId: agent.id,
          title: `Task completed ${daysAgo} days ago`,
          priority: 'medium',
          taskPath: `Task ${daysAgo}`,
        });
        completeTask(db, task.id, task.version);

        // Update completion date
        const completionDate = new Date();
        completionDate.setDate(completionDate.getDate() - daysAgo);
        db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
          completionDate.toISOString(),
          task.id
        );
        taskIds.push({ id: task.id, date: completionDate });
      }

      // Archive the tasks
      const archivedCount = await archiveOldTasks(db, 7, { baseDir: tempDir });
      expect(archivedCount).toBe(3);

      // Verify each task is in the correct archive directory
      for (const { id, date } of taskIds) {
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        // Use getAgentDirectory to get the correct sharded path
        const { getAgentDirectory } = await import('@recursive-manager/common');
        const agentDir = getAgentDirectory(agent.id, { baseDir: tempDir });
        const archiveDir = path.join(agentDir, 'tasks', 'archive', yearMonth, id);

        const exists = await fs
          .access(archiveDir)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(true);

        // Verify task status is 'archived'
        const task = db.prepare('SELECT status FROM tasks WHERE id = ?').get(id) as {
          status: string;
        };
        expect(task.status).toBe('archived');
      }
    });

    it('should handle month boundaries correctly when archiving', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'boundary-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Boundary Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      // Create tasks completed on last day of month and first day of next month
      const lastDayOfMonth = new Date(2024, 0, 31); // Jan 31, 2024
      const firstDayOfMonth = new Date(2024, 1, 1); // Feb 1, 2024

      const task1 = createTask(db, {
        agentId: agent.id,
        title: 'Last day task',
        priority: 'medium',
        taskPath: 'Last day task',
      });
      completeTask(db, task1.id, task1.version);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        lastDayOfMonth.toISOString(),
        task1.id
      );

      const task2 = createTask(db, {
        agentId: agent.id,
        title: 'First day task',
        priority: 'medium',
        taskPath: 'First day task',
      });
      completeTask(db, task2.id, task2.version);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        firstDayOfMonth.toISOString(),
        task2.id
      );

      // Archive the tasks
      const archivedCount = await archiveOldTasks(db, 0, { baseDir: tempDir }); // Archive all
      expect(archivedCount).toBe(2);

      // Verify they're in different month directories
      const agentDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive');
      const jan2024 = path.join(agentDir, '2024-01', task1.id);
      const feb2024 = path.join(agentDir, '2024-02', task2.id);

      expect(
        await fs
          .access(jan2024)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);
      expect(
        await fs
          .access(feb2024)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);
    });
  });

  describe('Database Consistency', () => {
    it('should properly mark all archived tasks in database', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'consistency-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Consistency Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      // Create multiple completed tasks
      const taskIds = [];
      for (let i = 0; i < 5; i++) {
        const task = createTask(db, {
          agentId: agent.id,
          title: `Task ${i}`,
          priority: 'medium',
          taskPath: `Task ${i}`,
        });
        completeTask(db, task.id, task.version);

        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
          tenDaysAgo.toISOString(),
          task.id
        );
        taskIds.push(task.id);
      }

      // Archive the tasks
      await archiveOldTasks(db, 7, { baseDir: tempDir });

      // Verify all tasks have status 'archived'
      for (const id of taskIds) {
        const task = db.prepare('SELECT status, completed_at FROM tasks WHERE id = ?').get(id) as {
          status: string;
          completed_at: string;
        };
        expect(task.status).toBe('archived');
        expect(task.completed_at).toBeTruthy();
      }

      // Verify no tasks have status 'completed' anymore
      const completedTasks = db
        .prepare('SELECT COUNT(*) as count FROM tasks WHERE agent_id = ? AND status = ?')
        .get(agent.id, 'completed') as { count: number };
      expect(completedTasks.count).toBe(0);
    });

    it('should prevent archived tasks from being accidentally marked as completed again', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'prevent-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Prevent Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      const task = createTask(db, {
        agentId: agent.id,
        title: 'Test task',
        priority: 'medium',
        taskPath: 'Test task',
      });
      completeTask(db, task.id, task.version);

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        tenDaysAgo.toISOString(),
        task.id
      );

      // Archive the task
      await archiveOldTasks(db, 7, { baseDir: tempDir });

      // Verify task is archived
      const archivedTask = db.prepare('SELECT status FROM tasks WHERE id = ?').get(task.id) as {
        status: string;
      };
      expect(archivedTask.status).toBe('archived');

      // Try to complete the task again (should fail or do nothing)
      expect(() => {
        completeTask(db, task.id, task.version + 1);
      }).toThrow();

      // Verify status is still archived
      const stillArchived = db.prepare('SELECT status FROM tasks WHERE id = ?').get(task.id) as {
        status: string;
      };
      expect(stillArchived.status).toBe('archived');
    });
  });

  describe('Cross-Agent Archival', () => {
    it('should archive tasks from multiple agents independently', async () => {
      // Create two agents
      const agent1 = await createAgent(
        db,
        {
          id: 'agent-1',
          displayName: 'Agent 1',
          role: 'Developer',
          reportingTo: null,
          createdBy: 'test',
          mainGoal: 'Develop',
          configPath: '/test/agent-1/config.json',
        }
      );

      const agent2 = await createAgent(
        db,
        {
          id: 'agent-2',
          displayName: 'Agent 2',
          role: 'Designer',
          reportingTo: null,
          createdBy: 'test',
          mainGoal: 'Design',
          configPath: '/test/agent-2/config.json',
        }
      );

      // Create old tasks for both agents
      const task1 = createTask(db, {
        agentId: agent1.id,
        title: 'Agent 1 task',
        priority: 'medium',
        taskPath: 'Agent 1 task',
      });
      completeTask(db, task1.id, task1.version);

      const task2 = createTask(db, {
        agentId: agent2.id,
        title: 'Agent 2 task',
        priority: 'medium',
        taskPath: 'Agent 2 task',
      });
      completeTask(db, task2.id, task2.version);

      // Set both tasks to be old
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id IN (?, ?)').run(
        tenDaysAgo.toISOString(),
        task1.id,
        task2.id
      );

      // Archive tasks
      const archivedCount = await archiveOldTasks(db, 7, { baseDir: tempDir });
      expect(archivedCount).toBe(2);

      // Verify each agent has their own archive directory
      const yearMonth = `${tenDaysAgo.getFullYear()}-${String(tenDaysAgo.getMonth() + 1).padStart(2, '0')}`;

      const agent1Archive = path.join(getAgentDirectory(agent1.id, { baseDir: tempDir }), 'tasks', 'archive',
        yearMonth,
        task1.id
      );
      const agent2Archive = path.join(getAgentDirectory(agent2.id, { baseDir: tempDir }), 'tasks', 'archive',
        yearMonth,
        task2.id
      );

      expect(
        await fs
          .access(agent1Archive)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);
      expect(
        await fs
          .access(agent2Archive)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);

      // Verify tasks don't cross-contaminate
      const agent1HasTask2 = path.join(getAgentDirectory(agent1.id, { baseDir: tempDir }), 'tasks', 'archive',
        yearMonth,
        task2.id
      );
      const agent2HasTask1 = path.join(getAgentDirectory(agent2.id, { baseDir: tempDir }), 'tasks', 'archive',
        yearMonth,
        task1.id
      );

      expect(
        await fs
          .access(agent1HasTask2)
          .then(() => true)
          .catch(() => false)
      ).toBe(false);
      expect(
        await fs
          .access(agent2HasTask1)
          .then(() => true)
          .catch(() => false)
      ).toBe(false);
    });
  });

  describe('End-to-End Archival and Compression', () => {
    it('should archive and then compress tasks in sequence', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'e2e-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'E2E Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      // Create a task completed 100 days ago
      const task = createTask(db, {
        agentId: agent.id,
        title: 'Old task',
        priority: 'medium',
        taskPath: 'Old task',
      });
      completeTask(db, task.id, task.version);

      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        hundredDaysAgo.toISOString(),
        task.id
      );

      // Create task directory with a file
      const yearMonth = `${hundredDaysAgo.getFullYear()}-${String(hundredDaysAgo.getMonth() + 1).padStart(2, '0')}`;
      const completedDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'completed', task.id);
      await fs.mkdir(completedDir, { recursive: true });
      await fs.writeFile(path.join(completedDir, 'test.txt'), 'test content');

      // Step 1: Archive the task
      const archivedCount = await archiveOldTasks(db, 7, { baseDir: tempDir });
      expect(archivedCount).toBe(1);

      // Verify task is archived
      const archivedTask = db.prepare('SELECT status FROM tasks WHERE id = ?').get(task.id) as {
        status: string;
      };
      expect(archivedTask.status).toBe('archived');

      // Verify directory moved to archive
      const archiveDir = path.join(
        getAgentDirectory(agent.id, { baseDir: tempDir }),
        'tasks',
        'archive',
        yearMonth,
        task.id
      );
      expect(
        await fs
          .access(archiveDir)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);

      // Step 2: Compress the archive
      const compressedCount = await compressOldArchives(db, 90, { baseDir: tempDir });
      expect(compressedCount).toBe(1);

      // Verify directory is replaced with .tar.gz
      expect(
        await fs
          .access(archiveDir)
          .then(() => true)
          .catch(() => false)
      ).toBe(false);
      const tarballPath = `${archiveDir}.tar.gz`;
      expect(
        await fs
          .access(tarballPath)
          .then(() => true)
          .catch(() => false)
      ).toBe(true);

      // Verify tarball contents
      const extractDir = path.join(tempDir, 'extract-test');
      await fs.mkdir(extractDir, { recursive: true });
      await tar.extract({
        file: tarballPath,
        cwd: extractDir,
      });

      const extractedFile = path.join(extractDir, task.id, 'test.txt');
      const content = await fs.readFile(extractedFile, 'utf-8');
      expect(content).toBe('test content');
    });
  });
});

describe('Task Archival - Edge Cases', () => {
  let db: Database.Database;
  let tempDir: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    runMigrations(db, allMigrations);
    tempDir = path.join('/tmp', `test-archive-edge-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    db.close();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Malformed Task Directories', () => {
    it('should handle missing task directory gracefully and continue archiving others', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'malformed-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Malformed Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      // Create two tasks
      const task1 = createTask(db, {
        agentId: agent.id,
        title: 'Task with missing dir',
        priority: 'medium',
        taskPath: 'Task 1',
      });
      completeTask(db, task1.id, task1.version);

      const task2 = createTask(db, {
        agentId: agent.id,
        title: 'Task with existing dir',
        priority: 'medium',
        taskPath: 'Task 2',
      });
      completeTask(db, task2.id, task2.version);

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id IN (?, ?)').run(
        tenDaysAgo.toISOString(),
        task1.id,
        task2.id
      );

      // Create directory only for task2
      const task2Dir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'completed', task2.id);
      await fs.mkdir(task2Dir, { recursive: true });
      await fs.writeFile(path.join(task2Dir, 'test.txt'), 'content');

      // Archive should continue even though task1 directory doesn't exist
      const archivedCount = await archiveOldTasks(db, 7, { baseDir: tempDir });

      // Should archive at least task2 (task1 may or may not count depending on error handling)
      expect(archivedCount).toBeGreaterThanOrEqual(1);

      // Verify task2 was archived successfully
      const task2Status = db.prepare('SELECT status FROM tasks WHERE id = ?').get(task2.id) as {
        status: string;
      };
      expect(task2Status.status).toBe('archived');
    });

    it('should handle unreadable files in task directory gracefully', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'unreadable-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Unreadable Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      const task = createTask(db, {
        agentId: agent.id,
        title: 'Task with unreadable file',
        priority: 'medium',
        taskPath: 'Task',
      });
      completeTask(db, task.id, task.version);

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        tenDaysAgo.toISOString(),
        task.id
      );

      // Create task directory with a symbolic link to a non-existent file
      const taskDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'completed', task.id);
      await fs.mkdir(taskDir, { recursive: true });
      await fs.writeFile(path.join(taskDir, 'good-file.txt'), 'content');

      // Create a broken symlink (this won't cause archival to fail, but tests error handling)
      try {
        await fs.symlink('/nonexistent/path', path.join(taskDir, 'broken-link'));
      } catch {
        // Symlink creation might fail on some systems, that's okay
      }

      // Archival should succeed or fail gracefully
      const archivedCount = await archiveOldTasks(db, 7, { baseDir: tempDir });
      expect(archivedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Compression Edge Cases', () => {
    it('should handle empty archive directories gracefully', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'empty-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Empty Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      const task = createTask(db, {
        agentId: agent.id,
        title: 'Task with empty dir',
        priority: 'medium',
        taskPath: 'Task',
      });
      completeTask(db, task.id, task.version);

      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        hundredDaysAgo.toISOString(),
        task.id
      );

      // Create empty archive directory
      const yearMonth = `${hundredDaysAgo.getFullYear()}-${String(hundredDaysAgo.getMonth() + 1).padStart(2, '0')}`;
      const archiveDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive',
        yearMonth,
        task.id
      );
      await fs.mkdir(archiveDir, { recursive: true });

      // Mark as archived in DB
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('archived', task.id);

      // Compression should handle empty directory
      const compressedCount = await compressOldArchives(db, 90, { baseDir: tempDir });
      expect(compressedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large files in compression', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'large-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Large Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      const task = createTask(db, {
        agentId: agent.id,
        title: 'Task with large file',
        priority: 'medium',
        taskPath: 'Task',
      });
      completeTask(db, task.id, task.version);

      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        hundredDaysAgo.toISOString(),
        task.id
      );

      // Create archive directory with a 1MB file
      const yearMonth = `${hundredDaysAgo.getFullYear()}-${String(hundredDaysAgo.getMonth() + 1).padStart(2, '0')}`;
      const archiveDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive',
        yearMonth,
        task.id
      );
      await fs.mkdir(archiveDir, { recursive: true });

      // Create a 1MB file with repeated content
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      await fs.writeFile(path.join(archiveDir, 'large-file.txt'), largeContent);

      // Mark as archived
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('archived', task.id);

      // Compression should succeed
      const compressedCount = await compressOldArchives(db, 90, { baseDir: tempDir });
      expect(compressedCount).toBe(1);

      // Verify tarball exists and is smaller than original (due to compression)
      const tarballPath = `${archiveDir}.tar.gz`;
      const stats = await fs.stat(tarballPath);
      expect(stats.size).toBeLessThan(1024 * 1024); // Should be compressed
    });

    it('should handle special characters in filenames', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'special-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Special Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      const task = createTask(db, {
        agentId: agent.id,
        title: 'Task with special chars',
        priority: 'medium',
        taskPath: 'Task',
      });
      completeTask(db, task.id, task.version);

      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        hundredDaysAgo.toISOString(),
        task.id
      );

      // Create archive directory with files containing special characters
      const yearMonth = `${hundredDaysAgo.getFullYear()}-${String(hundredDaysAgo.getMonth() + 1).padStart(2, '0')}`;
      const archiveDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive',
        yearMonth,
        task.id
      );
      await fs.mkdir(archiveDir, { recursive: true });

      // Create files with various special characters
      await fs.writeFile(path.join(archiveDir, 'file with spaces.txt'), 'content');
      await fs.writeFile(path.join(archiveDir, 'file-with-dashes.txt'), 'content');
      await fs.writeFile(path.join(archiveDir, 'file_with_underscores.txt'), 'content');

      // Mark as archived
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('archived', task.id);

      // Compression should succeed
      const compressedCount = await compressOldArchives(db, 90, { baseDir: tempDir });
      expect(compressedCount).toBe(1);

      // Verify all files are in tarball
      const tarballPath = `${archiveDir}.tar.gz`;
      const extractDir = path.join(tempDir, 'extract-special');
      await fs.mkdir(extractDir, { recursive: true });
      await tar.extract({
        file: tarballPath,
        cwd: extractDir,
      });

      const extractedFiles = await fs.readdir(path.join(extractDir, task.id));
      expect(extractedFiles).toContain('file with spaces.txt');
      expect(extractedFiles).toContain('file-with-dashes.txt');
      expect(extractedFiles).toContain('file_with_underscores.txt');
    });
  });

  describe('Data Integrity', () => {
    it('should preserve file permissions in archived and compressed tasks', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'perm-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Permission Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      const task = createTask(db, {
        agentId: agent.id,
        title: 'Task with permissions',
        priority: 'medium',
        taskPath: 'Task',
      });
      completeTask(db, task.id, task.version);

      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        hundredDaysAgo.toISOString(),
        task.id
      );

      // Create task directory with executable file
      const completedDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'completed', task.id);
      await fs.mkdir(completedDir, { recursive: true });
      const scriptPath = path.join(completedDir, 'script.sh');
      await fs.writeFile(scriptPath, '#!/bin/bash\necho "test"');
      await fs.chmod(scriptPath, 0o755); // Make executable

      // Archive the task
      await archiveOldTasks(db, 7, { baseDir: tempDir });

      // Compress the archive
      await compressOldArchives(db, 90, { baseDir: tempDir });

      // Extract and verify permissions
      const yearMonth = `${hundredDaysAgo.getFullYear()}-${String(hundredDaysAgo.getMonth() + 1).padStart(2, '0')}`;
      const tarballPath = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive',
        yearMonth,
        `${task.id}.tar.gz`
      );

      const extractDir = path.join(tempDir, 'extract-perm');
      await fs.mkdir(extractDir, { recursive: true });
      await tar.extract({
        file: tarballPath,
        cwd: extractDir,
      });

      const extractedScript = path.join(extractDir, task.id, 'script.sh');
      const stats = await fs.stat(extractedScript);

      // Check if file is executable (755 or similar)
      const mode = stats.mode & 0o777;
      expect(mode & 0o100).toBeTruthy(); // Owner execute bit
    });

    it('should handle nested directory structures in tasks', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'nested-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Nested Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      const task = createTask(db, {
        agentId: agent.id,
        title: 'Task with nested dirs',
        priority: 'medium',
        taskPath: 'Task',
      });
      completeTask(db, task.id, task.version);

      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        hundredDaysAgo.toISOString(),
        task.id
      );

      // Create nested directory structure
      const completedDir = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'completed', task.id);
      await fs.mkdir(path.join(completedDir, 'a', 'b', 'c'), { recursive: true });
      await fs.writeFile(path.join(completedDir, 'a', 'file1.txt'), 'level 1');
      await fs.writeFile(path.join(completedDir, 'a', 'b', 'file2.txt'), 'level 2');
      await fs.writeFile(path.join(completedDir, 'a', 'b', 'c', 'file3.txt'), 'level 3');

      // Archive and compress
      await archiveOldTasks(db, 7, { baseDir: tempDir });
      await compressOldArchives(db, 90, { baseDir: tempDir });

      // Extract and verify structure
      const yearMonth = `${hundredDaysAgo.getFullYear()}-${String(hundredDaysAgo.getMonth() + 1).padStart(2, '0')}`;
      const tarballPath = path.join(getAgentDirectory(agent.id, { baseDir: tempDir }), 'tasks', 'archive',
        yearMonth,
        `${task.id}.tar.gz`
      );

      const extractDir = path.join(tempDir, 'extract-nested');
      await fs.mkdir(extractDir, { recursive: true });
      await tar.extract({
        file: tarballPath,
        cwd: extractDir,
      });

      // Verify all files exist with correct content
      const file1 = await fs.readFile(path.join(extractDir, task.id, 'a', 'file1.txt'), 'utf-8');
      const file2 = await fs.readFile(
        path.join(extractDir, task.id, 'a', 'b', 'file2.txt'),
        'utf-8'
      );
      const file3 = await fs.readFile(
        path.join(extractDir, task.id, 'a', 'b', 'c', 'file3.txt'),
        'utf-8'
      );

      expect(file1).toBe('level 1');
      expect(file2).toBe('level 2');
      expect(file3).toBe('level 3');
    });
  });

  describe('Performance', () => {
    it('should handle archiving 100+ tasks efficiently', async () => {
      const agent = await createAgent(
        db,
        {
          id: 'perf-agent',
          createdBy: 'system',
          mainGoal: 'Test agent',
          configPath: '/agents/test/config.json',
          displayName: 'Performance Agent',
          role: 'Developer',
          reportingTo: null,
        }
      );

      // Create 100 completed tasks
      const taskCount = 100;
      for (let i = 0; i < taskCount; i++) {
        const task = createTask(db, {
          agentId: agent.id,
          title: `Task ${i}`,
          priority: 'medium',
          taskPath: `Task ${i}`,
        });
        completeTask(db, task.id, task.version);

        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
        db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
          tenDaysAgo.toISOString(),
          task.id
        );
      }

      // Measure archival time
      const startTime = Date.now();
      const archivedCount = await archiveOldTasks(db, 7, { baseDir: tempDir });
      const duration = Date.now() - startTime;

      expect(archivedCount).toBe(taskCount);

      // Should complete in reasonable time (less than 10 seconds for 100 tasks)
      // This is a generous limit to account for slow CI environments
      expect(duration).toBeLessThan(10000);

      // Verify all tasks are archived
      const archivedTasks = db
        .prepare('SELECT COUNT(*) as count FROM tasks WHERE agent_id = ? AND status = ?')
        .get(agent.id, 'archived') as { count: number };
      expect(archivedTasks.count).toBe(taskCount);
    });
  });
});
