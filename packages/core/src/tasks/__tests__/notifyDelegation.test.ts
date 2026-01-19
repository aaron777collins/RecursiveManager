/**
 * Tests for notifyTaskDelegation function (Task 2.3.12)
 *
 * Covers:
 * - Notification message creation and delivery
 * - Agent notification preferences
 * - Database message record creation
 * - Inbox file writing
 * - Error handling
 * - Audit logging
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { notifyTaskDelegation } from '../notifyDelegation';
import {
  createTask,
  createAgent,
  runMigrations,
  allMigrations,
  delegateTask,
  getMessage,
  getMessages,
} from '@recursive-manager/common';
import { saveAgentConfig } from '../../config';
import { AgentConfig } from '@recursive-manager/common';
import { getInboxPath } from '@recursive-manager/common';

describe('notifyTaskDelegation', () => {
  let db: Database.Database;
  let testDir: string;
  let ownerAgentId: string;
  let delegatedAgentId: string;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notify-delegation-test-'));

    // Create test agents
    ownerAgentId = createAgent(db, {
      name: 'Owner Agent',
      role: 'Manager',
      managerId: null,
    }).id;

    delegatedAgentId = createAgent(db, {
      name: 'Delegated Agent',
      role: 'Worker',
      managerId: ownerAgentId,
    }).id;

    // Create org hierarchy relationship
    db.prepare(
      `INSERT INTO org_hierarchy (agent_id, ancestor_id, depth) VALUES (?, ?, ?)`
    ).run(delegatedAgentId, ownerAgentId, 1);

    // Create default agent configs with notifications enabled
    const ownerConfig: AgentConfig = {
      version: '1.0.0',
      identity: {
        id: ownerAgentId,
        role: 'Manager',
        displayName: 'Owner Agent',
        createdAt: new Date().toISOString(),
        createdBy: 'test',
        reportingTo: null,
      },
      goal: {
        mainGoal: 'Manage tasks',
      },
      permissions: {
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 1000,
      },
      framework: {
        primary: 'claude-code',
      },
      communication: {
        notifyOnDelegation: true,
      },
    };

    const delegatedConfig: AgentConfig = {
      version: '1.0.0',
      identity: {
        id: delegatedAgentId,
        role: 'Worker',
        displayName: 'Delegated Agent',
        createdAt: new Date().toISOString(),
        createdBy: ownerAgentId,
        reportingTo: ownerAgentId,
      },
      goal: {
        mainGoal: 'Complete delegated tasks',
      },
      permissions: {
        canHire: false,
        maxSubordinates: 0,
        hiringBudget: 0,
      },
      framework: {
        primary: 'claude-code',
      },
      communication: {
        notifyOnDelegation: true,
      },
    };

    await saveAgentConfig(ownerAgentId, ownerConfig, { baseDir: testDir });
    await saveAgentConfig(delegatedAgentId, delegatedConfig, { baseDir: testDir });
  });

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
  });

  describe('successful notification', () => {
    it('should send notification when task is delegated', async () => {
      // Create and delegate a task
      const task = createTask(db, {
        agentId: ownerAgentId,
        title: 'Test Task',
        priority: 'high',
        taskPath: `/${ownerAgentId}/test-task`,
      });

      const delegatedTask = delegateTask(db, task.id, delegatedAgentId);

      // Send notification
      const messageId = await notifyTaskDelegation(db, delegatedTask, { dataDir: testDir });

      // Verify message ID was returned
      expect(messageId).toBeTruthy();
      expect(messageId).toMatch(/^msg-\d+-[a-z0-9]+$/);

      // Verify message was created in database
      const message = getMessage(db, messageId!);
      expect(message).toBeTruthy();
      expect(message?.from_agent_id).toBe(ownerAgentId);
      expect(message?.to_agent_id).toBe(delegatedAgentId);
      expect(message?.subject).toBe('Task Delegated: Test Task');
      expect(message?.priority).toBe('high');
      expect(message?.channel).toBe('internal');
      expect(message?.read).toBe(false);
      expect(message?.action_required).toBe(true);
      expect(message?.thread_id).toBe(`task-${task.id}`);

      // Verify message file was written to inbox
      const inboxPath = getInboxPath(delegatedAgentId, testDir);
      const unreadPath = path.join(inboxPath, 'unread', `${messageId}.md`);
      expect(fs.existsSync(unreadPath)).toBe(true);

      // Verify message content
      const messageContent = fs.readFileSync(unreadPath, 'utf-8');
      expect(messageContent).toContain('# Task Delegated to You');
      expect(messageContent).toContain('Test Task');
      expect(messageContent).toContain(ownerAgentId);
      expect(messageContent).toContain(task.id);
      expect(messageContent).toContain('high');
    });

    it('should include task details in message content', async () => {
      // Create parent task
      const parentTask = createTask(db, {
        agentId: ownerAgentId,
        title: 'Parent Task',
        taskPath: `/${ownerAgentId}/parent`,
      });

      // Create and delegate a child task
      const task = createTask(db, {
        agentId: ownerAgentId,
        title: 'Child Task',
        priority: 'urgent',
        parentTaskId: parentTask.id,
        taskPath: `/${ownerAgentId}/parent/child`,
      });

      const delegatedTask = delegateTask(db, task.id, delegatedAgentId);

      // Send notification
      const messageId = await notifyTaskDelegation(db, delegatedTask, { dataDir: testDir });

      // Read message file
      const inboxPath = getInboxPath(delegatedAgentId, testDir);
      const unreadPath = path.join(inboxPath, 'unread', `${messageId}.md`);
      const messageContent = fs.readFileSync(unreadPath, 'utf-8');

      // Verify all task details are present
      expect(messageContent).toContain('**Task:** Child Task');
      expect(messageContent).toContain('**Priority:** urgent');
      expect(messageContent).toContain(`**Task ID:** ${task.id}`);
      expect(messageContent).toContain(`**Parent Task:** ${parentTask.id}`);
      expect(messageContent).toContain('**Depth:** 1');
    });

    it('should handle tasks with subtasks in message', async () => {
      // Create task with subtasks
      const parentTask = createTask(db, {
        agentId: ownerAgentId,
        title: 'Parent Task',
        taskPath: `/${ownerAgentId}/parent`,
      });

      // Create subtasks
      createTask(db, {
        agentId: ownerAgentId,
        title: 'Subtask 1',
        parentTaskId: parentTask.id,
        taskPath: `/${ownerAgentId}/parent/sub1`,
      });

      createTask(db, {
        agentId: ownerAgentId,
        title: 'Subtask 2',
        parentTaskId: parentTask.id,
        taskPath: `/${ownerAgentId}/parent/sub2`,
      });

      // Update subtask counts
      db.prepare('UPDATE tasks SET subtasks_total = 2, subtasks_completed = 1 WHERE id = ?').run(
        parentTask.id
      );

      // Delegate task
      const delegatedTask = delegateTask(db, parentTask.id, delegatedAgentId);

      // Send notification
      const messageId = await notifyTaskDelegation(db, delegatedTask, { dataDir: testDir });

      // Read message file
      const inboxPath = getInboxPath(delegatedAgentId, testDir);
      const unreadPath = path.join(inboxPath, 'unread', `${messageId}.md`);
      const messageContent = fs.readFileSync(unreadPath, 'utf-8');

      // Verify subtask info is present
      expect(messageContent).toContain('**Subtasks:** 1/2 completed');
    });
  });

  describe('notification preferences', () => {
    it('should skip notification when agent has disabled delegation notifications', async () => {
      // Update agent config to disable delegation notifications
      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: delegatedAgentId,
          role: 'Worker',
          displayName: 'Delegated Agent',
          createdAt: new Date().toISOString(),
          createdBy: ownerAgentId,
          reportingTo: ownerAgentId,
        },
        goal: {
          mainGoal: 'Complete tasks',
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
        communication: {
          notifyOnDelegation: false,
        },
      };

      await saveAgentConfig(delegatedAgentId, config, { baseDir: testDir });

      // Create and delegate a task
      const task = createTask(db, {
        agentId: ownerAgentId,
        title: 'Test Task',
        taskPath: `/${ownerAgentId}/test-task`,
      });

      const delegatedTask = delegateTask(db, task.id, delegatedAgentId);

      // Send notification
      const messageId = await notifyTaskDelegation(db, delegatedTask, { dataDir: testDir });

      // Verify notification was skipped
      expect(messageId).toBeNull();

      // Verify no message in database
      const messages = getMessages(db, { agentId: delegatedAgentId });
      expect(messages).toHaveLength(0);
    });

    it('should send notification when forced even if disabled', async () => {
      // Update agent config to disable delegation notifications
      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: delegatedAgentId,
          role: 'Worker',
          displayName: 'Delegated Agent',
          createdAt: new Date().toISOString(),
          createdBy: ownerAgentId,
          reportingTo: ownerAgentId,
        },
        goal: {
          mainGoal: 'Complete tasks',
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
        communication: {
          notifyOnDelegation: false,
        },
      };

      await saveAgentConfig(delegatedAgentId, config, { baseDir: testDir });

      // Create and delegate a task
      const task = createTask(db, {
        agentId: ownerAgentId,
        title: 'Test Task',
        taskPath: `/${ownerAgentId}/test-task`,
      });

      const delegatedTask = delegateTask(db, task.id, delegatedAgentId);

      // Send notification with force option
      const messageId = await notifyTaskDelegation(db, delegatedTask, {
        dataDir: testDir,
        force: true,
      });

      // Verify notification was sent
      expect(messageId).toBeTruthy();

      // Verify message in database
      const messages = getMessages(db, { agentId: delegatedAgentId });
      expect(messages).toHaveLength(1);
    });

    it('should send notification when config has no notification settings', async () => {
      // Update agent config without notification settings
      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: delegatedAgentId,
          role: 'Worker',
          displayName: 'Delegated Agent',
          createdAt: new Date().toISOString(),
          createdBy: ownerAgentId,
          reportingTo: ownerAgentId,
        },
        goal: {
          mainGoal: 'Complete tasks',
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
        // No communication field
      };

      await saveAgentConfig(delegatedAgentId, config, { baseDir: testDir });

      // Create and delegate a task
      const task = createTask(db, {
        agentId: ownerAgentId,
        title: 'Test Task',
        taskPath: `/${ownerAgentId}/test-task`,
      });

      const delegatedTask = delegateTask(db, task.id, delegatedAgentId);

      // Send notification
      const messageId = await notifyTaskDelegation(db, delegatedTask, { dataDir: testDir });

      // Verify notification was sent (default is to notify)
      expect(messageId).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should throw error when task is not delegated', async () => {
      // Create task without delegating
      const task = createTask(db, {
        agentId: ownerAgentId,
        title: 'Test Task',
        taskPath: `/${ownerAgentId}/test-task`,
      });

      // Attempt to send notification for non-delegated task
      await expect(notifyTaskDelegation(db, task, { dataDir: testDir })).rejects.toThrow(
        'Cannot notify delegation: task'
      );
    });

    it('should throw error when delegated agent does not exist', async () => {
      // Create task
      const task = createTask(db, {
        agentId: ownerAgentId,
        title: 'Test Task',
        taskPath: `/${ownerAgentId}/test-task`,
      });

      // Manually set delegated_to to non-existent agent
      db.prepare('UPDATE tasks SET delegated_to = ?, delegated_at = ? WHERE id = ?').run(
        'non-existent-agent',
        new Date().toISOString(),
        task.id
      );

      const invalidTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id) as any;

      // Attempt to send notification
      await expect(notifyTaskDelegation(db, invalidTask, { dataDir: testDir })).rejects.toThrow(
        'Cannot notify delegation: delegated agent'
      );
    });
  });

  describe('priority mapping', () => {
    it('should map urgent task priority to urgent message priority', async () => {
      const task = createTask(db, {
        agentId: ownerAgentId,
        title: 'Urgent Task',
        priority: 'urgent',
        taskPath: `/${ownerAgentId}/urgent-task`,
      });

      const delegatedTask = delegateTask(db, task.id, delegatedAgentId);
      const messageId = await notifyTaskDelegation(db, delegatedTask, { dataDir: testDir });

      const message = getMessage(db, messageId!);
      expect(message?.priority).toBe('urgent');
    });

    it('should map high task priority to high message priority', async () => {
      const task = createTask(db, {
        agentId: ownerAgentId,
        title: 'High Priority Task',
        priority: 'high',
        taskPath: `/${ownerAgentId}/high-task`,
      });

      const delegatedTask = delegateTask(db, task.id, delegatedAgentId);
      const messageId = await notifyTaskDelegation(db, delegatedTask, { dataDir: testDir });

      const message = getMessage(db, messageId!);
      expect(message?.priority).toBe('high');
    });

    it('should map medium/low task priority to normal message priority', async () => {
      const task = createTask(db, {
        agentId: ownerAgentId,
        title: 'Medium Priority Task',
        priority: 'medium',
        taskPath: `/${ownerAgentId}/medium-task`,
      });

      const delegatedTask = delegateTask(db, task.id, delegatedAgentId);
      const messageId = await notifyTaskDelegation(db, delegatedTask, { dataDir: testDir });

      const message = getMessage(db, messageId!);
      expect(message?.priority).toBe('normal');
    });
  });
});
