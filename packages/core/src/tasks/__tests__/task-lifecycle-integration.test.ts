/**
 * Integration tests for full task lifecycle (Task 2.3.32)
 *
 * This test suite validates the complete lifecycle of tasks from creation to archival:
 * 1. CREATE: Create task in database and file system
 * 2. START: Transition task from pending to in-progress
 * 3. DELEGATE: Delegate task to subordinate agent
 * 4. COMPLETE: Mark task as completed, move files, update parent
 * 5. ARCHIVE: Archive old completed tasks
 *
 * Tests cover:
 * - Database state transitions
 * - File system operations (directory creation/movement)
 * - Optimistic locking and version management
 * - Parent-child task relationships
 * - Notification generation
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import {
  createTask,
  createAgent,
  getTask,
  updateTaskStatus,
  delegateTask,
  runMigrations,
  allMigrations,
  getTaskPath,
  detectTaskDeadlock,
  getMessages,
} from '@recursivemanager/common';
import {
  createTaskDirectory,
  completeTaskWithFiles,
  archiveOldTasks,
  notifyDeadlock,
  monitorDeadlocks,
} from '../index';
import { saveAgentConfig } from '../../config';
import { AgentConfig } from '@recursivemanager/common';

describe('Task Lifecycle Integration Tests', () => {
  let db: Database.Database;
  let testDir: string;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-lifecycle-test-'));

    // Override path-utils to use test directory
    process.env.RECURSIVEMANAGER_DATA_DIR = testDir;
  });

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
    delete process.env.RECURSIVEMANAGER_DATA_DIR;
  });

  describe('Complete Task Lifecycle', () => {
    it('should handle full lifecycle: create -> start -> complete -> archive', async () => {
      // Setup: Create a manager agent
      createAgent(db, {
        id: 'manager-001',
        role: 'Engineering Manager',
        displayName: 'Test Manager',
        reportingTo: null,
        createdBy: null,
        mainGoal: 'Manage engineering team',
        configPath: '/agents/manager-001/config.json',
      });

      // STEP 1: CREATE - Create task in pending state
      const task = createTask(db, {
        id: 'task-lifecycle-001',
        agentId: 'manager-001',
        title: 'Implement user authentication',
        taskPath: '/manager-001/Implement user authentication',
        priority: 'high',
      });

      // Verify task created in pending state
      expect(task.status).toBe('pending');
      expect(task.version).toBe(1);
      expect(task.depth).toBe(0);

      // Create task directory structure
      await createTaskDirectory({
        agentId: 'manager-001',
        task: task,
        options: { baseDir: testDir },
      });

      // Verify directory created
      const pendingPath = getTaskPath('manager-001', task.id, 'pending', { baseDir: testDir });
      expect(fs.existsSync(pendingPath)).toBe(true);
      expect(fs.existsSync(path.join(pendingPath, 'plan.md'))).toBe(true);
      expect(fs.existsSync(path.join(pendingPath, 'progress.md'))).toBe(true);

      // STEP 2: START - Transition to in-progress
      const inProgressTask = updateTaskStatus(db, task.id, 'in-progress', task.version);

      // Verify status updated
      expect(inProgressTask.status).toBe('in-progress');
      expect(inProgressTask.version).toBe(2); // Version incremented
      expect(inProgressTask.started_at).toBeTruthy();

      // Move directory to reflect status change
      const inProgressPath = getTaskPath('manager-001', task.id, 'in-progress', { baseDir: testDir });
      await fs.move(pendingPath, inProgressPath, { overwrite: true });

      // Verify directory moved
      expect(fs.existsSync(pendingPath)).toBe(false);
      expect(fs.existsSync(inProgressPath)).toBe(true);

      // STEP 3: COMPLETE - Mark task as completed
      await completeTaskWithFiles(db, task.id, inProgressTask.version, { dataDir: testDir });

      // Verify task completed in database
      const completedTask = getTask(db, task.id);
      expect(completedTask?.status).toBe('completed');
      expect(completedTask?.completed_at).toBeTruthy();
      expect(completedTask?.version).toBe(3); // Version incremented again

      // Verify directory moved to completed/
      const completedPath = getTaskPath('manager-001', task.id, 'completed', { baseDir: testDir });
      expect(fs.existsSync(inProgressPath)).toBe(false);
      expect(fs.existsSync(completedPath)).toBe(true);
      expect(fs.existsSync(path.join(completedPath, 'plan.md'))).toBe(true);

      // STEP 4: ARCHIVE - Archive old completed tasks
      // Simulate task completed 10 days ago
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
      db.prepare('UPDATE tasks SET completed_at = ? WHERE id = ?').run(
        tenDaysAgo.toISOString(),
        task.id
      );

      // Run archival process
      const archivedCount = await archiveOldTasks(db, 7, { baseDir: testDir });

      // Verify task was archived
      expect(archivedCount).toBe(1);

      // Verify task still in database but marked archived
      const archivedTask = getTask(db, task.id);
      expect(archivedTask?.status).toBe('archived');

      // Verify archived directory exists (not compressed yet - compression is separate)
      const year = tenDaysAgo.getFullYear();
      const month = String(tenDaysAgo.getMonth() + 1).padStart(2, '0');
      const archivePath = path.join(
        testDir,
        'agents',
        'd0-df',
        'manager-001',
        'tasks',
        'archive',
        `${year}-${month}`,
        task.id
      );
      expect(fs.existsSync(archivePath)).toBe(true);

      // Verify original directory removed after archival
      expect(fs.existsSync(completedPath)).toBe(false);
    });

    it('should handle task delegation lifecycle with subordinate', async () => {
      // Setup: Create manager and subordinate agents
      createAgent(db, {
        id: 'manager-002',
        role: 'Engineering Manager',
        displayName: 'Test Manager',
        reportingTo: null,
        createdBy: null,
        mainGoal: 'Manage engineering team',
        configPath: '/agents/manager-002/config.json',
      });

      createAgent(db, {
        id: 'developer-001',
        role: 'Developer',
        displayName: 'Test Developer',
        reportingTo: 'manager-002',
        createdBy: null,
        mainGoal: 'Write code',
        configPath: '/agents/developer-001/config.json',
      });

      // Create a task for the manager
      const managerTask = createTask(db, {
        id: 'task-manager-001',
        agentId: 'manager-002',
        title: 'Build new feature',
        taskPath: '/manager-002/Build new feature',
        priority: 'high',
      });

      // Create task directory
      await createTaskDirectory({
        agentId: 'manager-002',
        task: managerTask,
      });

      // STEP 1: DELEGATE - Manager delegates to subordinate
      const delegatedTask = delegateTask(db, managerTask.id, 'developer-001', managerTask.version);

      // Verify delegation
      expect(delegatedTask.delegated_to).toBe('developer-001');
      expect(delegatedTask.version).toBe(2); // Version incremented

      // STEP 2: CREATE SUBTASK - Developer creates subtask
      const subtask = createTask(db, {
        id: 'task-subtask-001',
        agentId: 'developer-001',
        title: 'Implement API endpoint',
        taskPath: '/manager-002/Build new feature/Implement API endpoint',
        priority: 'high',
        parentTaskId: managerTask.id,
      });

      // Verify subtask relationship
      expect(subtask.parent_task_id).toBe(managerTask.id);
      expect(subtask.depth).toBe(1); // Child is depth 1

      // Create subtask directory
      await createTaskDirectory({
        agentId: 'developer-001',
        task: subtask,
      });

      // STEP 3: COMPLETE SUBTASK - Developer completes subtask
      const inProgressSubtask = updateTaskStatus(db, subtask.id, 'in-progress', subtask.version);
      await completeTaskWithFiles(db, subtask.id, inProgressSubtask.version);

      // Verify subtask completed
      const completedSubtask = getTask(db, subtask.id);
      expect(completedSubtask?.status).toBe('completed');

      // Verify parent task progress updated (EC-2.5)
      const updatedParent = getTask(db, managerTask.id);
      expect(updatedParent?.percent_complete).toBeGreaterThan(0);
    });

    it('should enforce optimistic locking throughout lifecycle', async () => {
      // Setup: Create agent and task
      createAgent(db, {
        id: 'lock-agent',
        role: 'Developer',
        displayName: 'Lock Test Agent',
        reportingTo: null,
        createdBy: null,
        mainGoal: 'Test locking',
        configPath: '/agents/lock-agent/config.json',
      });

      const task = createTask(db, {
        id: 'task-lock-001',
        agentId: 'lock-agent',
        title: 'Test locking',
        taskPath: '/lock-agent/Test locking',
        priority: 'medium',
      });

      // Simulate concurrent modification attempt
      const version1 = task.version;

      // First update succeeds
      const updated1 = updateTaskStatus(db, task.id, 'in-progress', version1);
      expect(updated1.version).toBe(2);

      // Second update with stale version fails
      expect(() => {
        updateTaskStatus(db, task.id, 'completed', version1); // Using stale version
      }).toThrow(/version mismatch/i);

      // Update with current version succeeds
      const updated2 = updateTaskStatus(db, task.id, 'completed', updated1.version);
      expect(updated2.version).toBe(3);
    });

    it('should handle parent task progress updates when child completes', async () => {
      // Setup: Create agent
      createAgent(db, {
        id: 'parent-agent',
        role: 'Manager',
        displayName: 'Parent Agent',
        reportingTo: null,
        createdBy: null,
        mainGoal: 'Manage tasks',
        configPath: '/agents/parent-agent/config.json',
      });

      // Create parent task
      const parentTask = createTask(db, {
        id: 'task-parent-001',
        agentId: 'parent-agent',
        title: 'Parent Task',
        taskPath: '/parent-agent/Parent Task',
        priority: 'high',
      });

      await createTaskDirectory({
        agentId: 'parent-agent',
        task: parentTask,
      });

      // Create 3 child tasks
      const child1 = createTask(db, {
        id: 'task-child-001',
        agentId: 'parent-agent',
        title: 'Child Task 1',
        taskPath: '/parent-agent/Parent Task/Child Task 1',
        priority: 'medium',
        parentTaskId: parentTask.id,
      });

      const child2 = createTask(db, {
        id: 'task-child-002',
        agentId: 'parent-agent',
        title: 'Child Task 2',
        taskPath: '/parent-agent/Parent Task/Child Task 2',
        priority: 'medium',
        parentTaskId: parentTask.id,
      });

      const child3 = createTask(db, {
        id: 'task-child-003',
        agentId: 'parent-agent',
        title: 'Child Task 3',
        taskPath: '/parent-agent/Parent Task/Child Task 3',
        priority: 'medium',
        parentTaskId: parentTask.id,
      });

      // Create directories for children
      for (const child of [child1, child2, child3]) {
        await createTaskDirectory({
          agentId: 'parent-agent',
          task: child,
        });
      }

      // Complete first child
      const child1InProgress = updateTaskStatus(db, child1.id, 'in-progress', child1.version);
      await completeTaskWithFiles(db, child1.id, child1InProgress.version);

      // Verify parent progress updated
      let parent = getTask(db, parentTask.id);
      expect(parent?.percent_complete).toBe(33); // 1 of 3 = 33% (rounded to nearest integer)

      // Complete second child
      const child2InProgress = updateTaskStatus(db, child2.id, 'in-progress', child2.version);
      await completeTaskWithFiles(db, child2.id, child2InProgress.version);

      // Verify parent progress updated
      parent = getTask(db, parentTask.id);
      expect(parent?.percent_complete).toBe(67); // 2 of 3 = 67% (rounded to nearest integer)

      // Complete third child
      const child3InProgress = updateTaskStatus(db, child3.id, 'in-progress', child3.version);
      await completeTaskWithFiles(db, child3.id, child3InProgress.version);

      // Verify parent progress updated
      parent = getTask(db, parentTask.id);
      expect(parent?.percent_complete).toBe(100); // 3 of 3 = 100%
    });

    it('should maintain file system consistency during status transitions', async () => {
      // Setup: Create agent and task
      createAgent(db, {
        id: 'fs-agent',
        role: 'Developer',
        displayName: 'File System Test Agent',
        reportingTo: null,
        createdBy: null,
        mainGoal: 'Test file operations',
        configPath: '/agents/fs-agent/config.json',
      });

      const task = createTask(db, {
        id: 'task-fs-001',
        agentId: 'fs-agent',
        title: 'File System Test',
        taskPath: '/fs-agent/File System Test',
        priority: 'medium',
      });

      // Create initial directory
      await createTaskDirectory({
        agentId: 'fs-agent',
        task: task,
      });

      const pendingPath = getTaskPath('fs-agent', task.id, 'pending');

      // Verify initial state
      expect(fs.existsSync(pendingPath)).toBe(true);
      expect(fs.existsSync(path.join(pendingPath, 'plan.md'))).toBe(true);
      expect(fs.existsSync(path.join(pendingPath, 'progress.md'))).toBe(true);

      // Transition through all states
      const states: Array<'in-progress' | 'blocked' | 'completed'> = [
        'in-progress',
        'blocked',
        'in-progress',
      ];
      let currentVersion = task.version;
      let currentStatus = task.status;

      for (const newStatus of states) {
        // Update status in database
        const updated = updateTaskStatus(db, task.id, newStatus, currentVersion);

        // Move directory
        const oldPath = getTaskPath('fs-agent', task.id, currentStatus);
        const newPath = getTaskPath('fs-agent', task.id, newStatus);

        if (fs.existsSync(oldPath)) {
          await fs.move(oldPath, newPath);
        }

        // Verify old location empty, new location populated
        expect(fs.existsSync(oldPath)).toBe(false);
        expect(fs.existsSync(newPath)).toBe(true);
        expect(fs.existsSync(path.join(newPath, 'plan.md'))).toBe(true);

        currentVersion = updated.version;
        currentStatus = newStatus;
      }

      // Final completion
      await completeTaskWithFiles(db, task.id, currentVersion);

      // Verify final state
      const completedPath = getTaskPath('fs-agent', task.id, 'completed');
      expect(fs.existsSync(completedPath)).toBe(true);
      expect(fs.existsSync(path.join(completedPath, 'plan.md'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle completion of task with no parent gracefully', async () => {
      createAgent(db, {
        id: 'orphan-agent',
        role: 'Developer',
        displayName: 'Orphan Agent',
        reportingTo: null,
        createdBy: null,
        mainGoal: 'Test orphan tasks',
        configPath: '/agents/orphan-agent/config.json',
      });

      const task = createTask(db, {
        id: 'task-orphan-001',
        agentId: 'orphan-agent',
        title: 'Orphan Task',
        taskPath: '/orphan-agent/Orphan Task',
        priority: 'low',
      });

      await createTaskDirectory({
        agentId: 'orphan-agent',
        task: task,
      });

      // Should not throw when completing task with no parent
      const inProgress = updateTaskStatus(db, task.id, 'in-progress', task.version);
      await expect(completeTaskWithFiles(db, task.id, inProgress.version)).resolves.not.toThrow();

      const completed = getTask(db, task.id);
      expect(completed?.status).toBe('completed');
    });

    it('should not archive tasks newer than retention period', async () => {
      createAgent(db, {
        id: 'recent-agent',
        role: 'Developer',
        displayName: 'Recent Agent',
        reportingTo: null,
        createdBy: null,
        mainGoal: 'Test recent tasks',
        configPath: '/agents/recent-agent/config.json',
      });

      const task = createTask(db, {
        id: 'task-recent-001',
        agentId: 'recent-agent',
        title: 'Recent Task',
        taskPath: '/recent-agent/Recent Task',
        priority: 'low',
      });

      await createTaskDirectory({
        agentId: 'recent-agent',
        task: task,
      });

      // Complete task (completed_at = now)
      const inProgress = updateTaskStatus(db, task.id, 'in-progress', task.version);
      await completeTaskWithFiles(db, task.id, inProgress.version);

      // Try to archive with 7-day retention
      const archivedCount = await archiveOldTasks(db, 7);

      // Should not archive recent task
      expect(archivedCount).toBe(0);

      // Task should still be in completed directory
      const completedPath = getTaskPath('recent-agent', task.id, 'completed');
      expect(fs.existsSync(completedPath)).toBe(true);
    });
  });

  describe('Deadlock Detection and Notification', () => {
    it('should detect deadlock, notify agents, and resolve when dependency removed', async () => {
      // Setup: Create two agents
      const agentA = createAgent(db, {
        id: 'deadlock-agent-a',
        role: 'Developer',
        displayName: 'Agent A',
        reportingTo: null,
        createdBy: null,
        mainGoal: 'Test deadlock',
        configPath: '/agents/deadlock-agent-a/config.json',
      });

      const agentB = createAgent(db, {
        id: 'deadlock-agent-b',
        role: 'Developer',
        displayName: 'Agent B',
        reportingTo: null,
        createdBy: null,
        mainGoal: 'Test deadlock',
        configPath: '/agents/deadlock-agent-b/config.json',
      });

      // Create agent configs with deadlock notifications enabled
      const createConfig = (agentId: string): AgentConfig => ({
        version: '1.0.0',
        identity: {
          id: agentId,
          role: 'Developer',
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
          workspaceQuotaMB: 500,
        },
        framework: {
          primary: 'claude-code',
          fallback: 'none',
        },
        communication: {
          notifyOnCompletion: true,
          notifyOnDelegation: true,
          notifyOnDeadlock: true,
        },
        behavior: {
          continuousMode: true,
          autoEscalateBlockedTasks: true,
          escalationTimeoutMinutes: 30,
        },
        metadata: {},
      });

      await saveAgentConfig(agentA.id, createConfig(agentA.id), { baseDir: testDir });
      await saveAgentConfig(agentB.id, createConfig(agentB.id), { baseDir: testDir });

      // STEP 1: CREATE DEADLOCK - Create circular dependency: A -> B -> A
      const taskA = createTask(db, {
        id: 'task-deadlock-a',
        agentId: agentA.id,
        title: 'Task A blocks on B',
        taskPath: '/deadlock-agent-a/Task A',
        priority: 'high',
      });

      const taskB = createTask(db, {
        id: 'task-deadlock-b',
        agentId: agentB.id,
        title: 'Task B blocks on A',
        taskPath: '/deadlock-agent-b/Task B',
        priority: 'high',
      });

      // Set up circular blocking relationships
      db.prepare('UPDATE tasks SET status = ?, blocked_by = ? WHERE id = ?').run(
        'blocked',
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET status = ?, blocked_by = ? WHERE id = ?').run(
        'blocked',
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // STEP 2: DETECT DEADLOCK - Verify deadlock is detected from either task
      const cycleFromA = detectTaskDeadlock(db, taskA.id);
      const cycleFromB = detectTaskDeadlock(db, taskB.id);

      expect(cycleFromA).toBeTruthy();
      expect(cycleFromA).toHaveLength(2);
      expect(cycleFromB).toBeTruthy();
      expect(cycleFromB).toHaveLength(2);

      // STEP 3: NOTIFY AGENTS - Send deadlock notifications
      const messageIds = await notifyDeadlock(db, [taskA.id, taskB.id], { dataDir: testDir });

      // Verify notifications sent
      expect(messageIds).toHaveLength(2);

      // Verify both agents received urgent notifications
      const messagesA = getMessages(db, { agentId: agentA.id });
      const messagesB = getMessages(db, { agentId: agentB.id });

      expect(messagesA).toHaveLength(1);
      expect(messagesA[0]!.priority).toBe('urgent');
      expect(messagesA[0]!.action_required).toBe(true);
      expect(messagesA[0]!.subject).toContain('DEADLOCK');

      expect(messagesB).toHaveLength(1);
      expect(messagesB[0]!.priority).toBe('urgent');
      expect(messagesB[0]!.subject).toContain('DEADLOCK');

      // STEP 4: RESOLVE DEADLOCK - Remove one dependency
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(JSON.stringify([]), taskA.id);

      // STEP 5: VERIFY RESOLUTION - Deadlock should no longer be detected
      const cycleAfterResolution = detectTaskDeadlock(db, taskA.id);
      expect(cycleAfterResolution).toBeNull();

      // Task A should now be unblocked
      const updatedTaskA = getTask(db, taskA.id);
      expect(JSON.parse(updatedTaskA?.blocked_by || '[]')).toHaveLength(0);
    });

    it('should monitor all blocked tasks and detect multiple deadlocks', async () => {
      // Setup: Create four agents
      const agents = ['monitor-a', 'monitor-b', 'monitor-c', 'monitor-d'].map((id) =>
        createAgent(db, {
          id,
          role: 'Developer',
          displayName: `Agent ${id}`,
          reportingTo: null,
          createdBy: null,
          mainGoal: 'Test monitoring',
          configPath: `/agents/${id}/config.json`,
        })
      );

      // Create configs for all agents
      const createConfig = (agentId: string): AgentConfig => ({
        version: '1.0.0',
        identity: {
          id: agentId,
          role: 'Developer',
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
          workspaceQuotaMB: 500,
        },
        framework: {
          primary: 'claude-code',
          fallback: 'none',
        },
        communication: {
          notifyOnCompletion: true,
          notifyOnDelegation: true,
          notifyOnDeadlock: true,
        },
        behavior: {
          continuousMode: true,
          autoEscalateBlockedTasks: true,
          escalationTimeoutMinutes: 30,
        },
        metadata: {},
      });

      for (const agent of agents) {
        await saveAgentConfig(agent.id, createConfig(agent.id), { baseDir: testDir });
      }

      // Create first deadlock cycle: A -> B -> A
      const taskA = createTask(db, {
        id: 'task-monitor-a',
        agentId: agents[0]!.id,
        title: 'Task A',
        taskPath: '/monitor-a/Task A',
        priority: 'high',
      });

      const taskB = createTask(db, {
        id: 'task-monitor-b',
        agentId: agents[1]!.id,
        title: 'Task B',
        taskPath: '/monitor-b/Task B',
        priority: 'high',
      });

      db.prepare('UPDATE tasks SET status = ?, blocked_by = ? WHERE id = ?').run(
        'blocked',
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET status = ?, blocked_by = ? WHERE id = ?').run(
        'blocked',
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Create second independent deadlock cycle: C -> D -> C
      const taskC = createTask(db, {
        id: 'task-monitor-c',
        agentId: agents[2]!.id,
        title: 'Task C',
        taskPath: '/monitor-c/Task C',
        priority: 'high',
      });

      const taskD = createTask(db, {
        id: 'task-monitor-d',
        agentId: agents[3]!.id,
        title: 'Task D',
        taskPath: '/monitor-d/Task D',
        priority: 'high',
      });

      db.prepare('UPDATE tasks SET status = ?, blocked_by = ? WHERE id = ?').run(
        'blocked',
        JSON.stringify([taskD.id]),
        taskC.id
      );
      db.prepare('UPDATE tasks SET status = ?, blocked_by = ? WHERE id = ?').run(
        'blocked',
        JSON.stringify([taskC.id]),
        taskD.id
      );

      // Create a non-deadlocked blocked task (should be ignored)
      const taskE = createTask(db, {
        id: 'task-monitor-e',
        agentId: agents[0]!.id,
        title: 'Task E',
        taskPath: '/monitor-a/Task E',
        priority: 'low',
      });

      db.prepare('UPDATE tasks SET status = ?, blocked_by = ? WHERE id = ?').run(
        'blocked',
        JSON.stringify(['non-existent-task']),
        taskE.id
      );

      // MONITOR ALL DEADLOCKS
      const result = await monitorDeadlocks(db, { dataDir: testDir });

      // Verify monitoring results
      expect(result.deadlocksDetected).toBe(2); // Two independent cycles
      expect(result.notificationsSent).toBe(4); // One per agent in deadlocks
      expect(result.deadlockedTaskIds).toHaveLength(4);
      expect(result.cycles).toHaveLength(2);

      // Verify all deadlocked task IDs are included
      expect(result.deadlockedTaskIds).toContain(taskA.id);
      expect(result.deadlockedTaskIds).toContain(taskB.id);
      expect(result.deadlockedTaskIds).toContain(taskC.id);
      expect(result.deadlockedTaskIds).toContain(taskD.id);
      expect(result.deadlockedTaskIds).not.toContain(taskE.id); // Non-deadlocked task excluded

      // Verify all agents in deadlocks received notifications
      expect(getMessages(db, { agentId: agents[0]!.id })).toHaveLength(1);
      expect(getMessages(db, { agentId: agents[1]!.id })).toHaveLength(1);
      expect(getMessages(db, { agentId: agents[2]!.id })).toHaveLength(1);
      expect(getMessages(db, { agentId: agents[3]!.id })).toHaveLength(1);
    });

    it('should handle three-way deadlock with proper cycle detection', async () => {
      // Setup: Create three agents
      const agentIds = ['three-a', 'three-b', 'three-c'];
      const agents = agentIds.map((id) =>
        createAgent(db, {
          id,
          role: 'Developer',
          displayName: `Agent ${id}`,
          reportingTo: null,
          createdBy: null,
          mainGoal: 'Test three-way deadlock',
          configPath: `/agents/${id}/config.json`,
        })
      );

      // Create configs
      const createConfig = (agentId: string): AgentConfig => ({
        version: '1.0.0',
        identity: {
          id: agentId,
          role: 'Developer',
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
          workspaceQuotaMB: 500,
        },
        framework: {
          primary: 'claude-code',
          fallback: 'none',
        },
        communication: {
          notifyOnCompletion: true,
          notifyOnDelegation: true,
          notifyOnDeadlock: true,
        },
        behavior: {
          continuousMode: true,
          autoEscalateBlockedTasks: true,
          escalationTimeoutMinutes: 30,
        },
        metadata: {},
      });

      for (const agent of agents) {
        await saveAgentConfig(agent.id, createConfig(agent.id), { baseDir: testDir });
      }

      // Create three-way deadlock: A -> B -> C -> A
      const taskA = createTask(db, {
        id: 'task-three-a',
        agentId: agents[0]!.id,
        title: 'Task A',
        taskPath: '/three-a/Task A',
        priority: 'high',
      });

      const taskB = createTask(db, {
        id: 'task-three-b',
        agentId: agents[1]!.id,
        title: 'Task B',
        taskPath: '/three-b/Task B',
        priority: 'high',
      });

      const taskC = createTask(db, {
        id: 'task-three-c',
        agentId: agents[2]!.id,
        title: 'Task C',
        taskPath: '/three-c/Task C',
        priority: 'high',
      });

      db.prepare('UPDATE tasks SET status = ?, blocked_by = ? WHERE id = ?').run(
        'blocked',
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET status = ?, blocked_by = ? WHERE id = ?').run(
        'blocked',
        JSON.stringify([taskC.id]),
        taskB.id
      );
      db.prepare('UPDATE tasks SET status = ?, blocked_by = ? WHERE id = ?').run(
        'blocked',
        JSON.stringify([taskA.id]),
        taskC.id
      );

      // Detect deadlock from each entry point
      const cycleFromA = detectTaskDeadlock(db, taskA.id);
      const cycleFromB = detectTaskDeadlock(db, taskB.id);
      const cycleFromC = detectTaskDeadlock(db, taskC.id);

      // All should detect the same cycle (possibly rotated)
      expect(cycleFromA).toHaveLength(3);
      expect(cycleFromB).toHaveLength(3);
      expect(cycleFromC).toHaveLength(3);

      // Monitor should deduplicate these to a single cycle
      const result = await monitorDeadlocks(db, { dataDir: testDir });

      expect(result.deadlocksDetected).toBe(1); // Single cycle despite 3 entry points
      expect(result.notificationsSent).toBe(3); // One per agent
      expect(result.cycles[0]).toHaveLength(3);

      // All three agents should receive notifications
      expect(getMessages(db, { agentId: agents[0]!.id })).toHaveLength(1);
      expect(getMessages(db, { agentId: agents[1]!.id })).toHaveLength(1);
      expect(getMessages(db, { agentId: agents[2]!.id })).toHaveLength(1);

      // Verify notifications share the same thread ID (same cycle)
      const msg1 = getMessages(db, { agentId: agents[0]!.id })[0]!;
      const msg2 = getMessages(db, { agentId: agents[1]!.id })[0]!;
      const msg3 = getMessages(db, { agentId: agents[2]!.id })[0]!;

      expect(msg1.thread_id).toBe(msg2.thread_id);
      expect(msg2.thread_id).toBe(msg3.thread_id);
    });
  });
});
