/**
 * Tests for notifyTaskCompletion function (Task 2.3.16)
 *
 * Covers:
 * - Notification message creation and delivery to manager
 * - Manager notification preferences
 * - Database message record creation
 * - Inbox file writing
 * - Error handling
 * - Audit logging
 * - Root agent handling (no manager)
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { notifyTaskCompletion } from '../notifyCompletion';
import {
  createTask,
  createAgent,
  runMigrations,
  allMigrations,
  completeTask as dbCompleteTask,
  getMessage,
  getMessages,
} from '@recursive-manager/common';
import { saveAgentConfig } from '../../config';
import { AgentConfig } from '@recursive-manager/common';
import { getInboxPath } from '@recursive-manager/common';

describe('notifyTaskCompletion', () => {
  let db: Database.Database;
  let testDir: string;
  let managerAgentId: string;
  let subordinateAgentId: string;
  let rootAgentId: string;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notify-completion-test-'));

    // Create test agents: root (CEO) -> manager -> subordinate
    rootAgentId = createAgent(db, {
      id: 'root-agent-id',
      displayName: 'CEO',
      role: 'CEO',
      reportingTo: null,
      createdBy: 'test',
      mainGoal: 'Lead organization',
      configPath: path.join(testDir, 'root.json'),
    }).id;

    managerAgentId = createAgent(db, {
      id: 'manager-agent-id',
      displayName: 'Manager',
      role: 'Manager',
      reportingTo: rootAgentId,
      createdBy: 'test',
      mainGoal: 'Manage team',
      configPath: path.join(testDir, 'manager.json'),
    }).id;

    subordinateAgentId = createAgent(db, {
      id: 'subordinate-agent-id',
      displayName: 'Subordinate',
      role: 'Worker',
      reportingTo: managerAgentId,
      createdBy: 'test',
      mainGoal: 'Complete tasks',
      configPath: path.join(testDir, 'subordinate.json'),
    }).id;

    // Create default agent configs with notifications enabled
    const rootConfig: AgentConfig = {
      version: '1.0.0',
      identity: {
        id: rootAgentId,
        role: 'CEO',
        displayName: 'CEO',
        createdAt: new Date().toISOString(),
        createdBy: 'test',
        reportingTo: null,
      },
      goal: {
        mainGoal: 'Lead organization',
      },
      permissions: {
        canHire: true,
        maxSubordinates: 20,
        hiringBudget: 20,
        workspaceQuotaMB: 1000,
      },
      framework: {
        primary: 'claude-code',
      },
      communication: {
        notifyOnCompletion: true,
      },
    };

    const managerConfig: AgentConfig = {
      version: '1.0.0',
      identity: {
        id: managerAgentId,
        role: 'Manager',
        displayName: 'Manager',
        createdAt: new Date().toISOString(),
        createdBy: rootAgentId,
        reportingTo: rootAgentId,
      },
      goal: {
        mainGoal: 'Manage team',
      },
      permissions: {
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 10,
        workspaceQuotaMB: 500,
      },
      framework: {
        primary: 'claude-code',
      },
      communication: {
        notifyOnCompletion: true,
      },
    };

    const subordinateConfig: AgentConfig = {
      version: '1.0.0',
      identity: {
        id: subordinateAgentId,
        role: 'Worker',
        displayName: 'Subordinate',
        createdAt: new Date().toISOString(),
        createdBy: managerAgentId,
        reportingTo: managerAgentId,
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
        notifyOnCompletion: true,
      },
    };

    await saveAgentConfig(rootAgentId, rootConfig, { baseDir: testDir });
    await saveAgentConfig(managerAgentId, managerConfig, { baseDir: testDir });
    await saveAgentConfig(subordinateAgentId, subordinateConfig, { baseDir: testDir });
  });

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
  });

  describe('successful notification', () => {
    it('should send notification to manager when subordinate completes a task', async () => {
      // Create and complete a task
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Test Task',
        priority: 'high',
        taskPath: `/${subordinateAgentId}/test-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);

      // Send notification
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      // Verify message ID was returned
      expect(messageId).toBeTruthy();
      expect(messageId).toMatch(/^msg-\d+-[a-z0-9]+$/);

      // Verify message was created in database
      const message = getMessage(db, messageId!);
      expect(message).toBeTruthy();
      expect(message?.from_agent_id).toBe(subordinateAgentId);
      expect(message?.to_agent_id).toBe(managerAgentId);
      expect(message?.subject).toBe('Task Completed: Test Task');
      expect(message?.priority).toBe('high');
      expect(message?.channel).toBe('internal');
      expect(message?.read).toBe(false);
      expect(message?.action_required).toBe(false); // Completions are informational
      expect(message?.thread_id).toBe(`task-${task.id}`);

      // Verify message file was written to manager's inbox
      const inboxPath = getInboxPath(managerAgentId, { baseDir: testDir });
      const unreadPath = path.join(inboxPath, 'unread', `${messageId}.md`);
      expect(fs.existsSync(unreadPath)).toBe(true);

      // Verify message content
      const messageContent = fs.readFileSync(unreadPath, 'utf-8');
      expect(messageContent).toContain('# Task Completed by Subordinate');
      expect(messageContent).toContain('Test Task');
      expect(messageContent).toContain(subordinateAgentId);
      expect(messageContent).toContain(task.id);
      expect(messageContent).toContain('high');
      expect(messageContent).toContain('completed');
    });

    it('should include task completion details in message', async () => {
      // Create parent task
      const parentTask = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Parent Task',
        taskPath: `/${subordinateAgentId}/parent`,
      });

      // Create and complete a child task
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Child Task',
        priority: 'urgent',
        parentTaskId: parentTask.id,
        taskPath: `/${subordinateAgentId}/parent/child`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);

      // Send notification
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      // Read message file
      const inboxPath = getInboxPath(managerAgentId, { baseDir: testDir });
      const unreadPath = path.join(inboxPath, 'unread', `${messageId}.md`);
      const messageContent = fs.readFileSync(unreadPath, 'utf-8');

      // Verify all task details are present
      expect(messageContent).toContain('**Task:** Child Task');
      expect(messageContent).toContain('**Priority:** urgent');
      expect(messageContent).toContain(`**Task ID:** ${task.id}`);
      expect(messageContent).toContain(`**Parent Task:** ${parentTask.id}`);
      expect(messageContent).toContain('**Depth:** 1');
      expect(messageContent).toContain('**Completed At:**');
    });

    it('should calculate and show time to completion', async () => {
      // Create task with known timestamps
      const createdAt = new Date('2026-01-19T10:00:00Z').toISOString();
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Test Task',
        taskPath: `/${subordinateAgentId}/test-task`,
      });

      // Update created_at timestamp
      db.prepare('UPDATE tasks SET created_at = ? WHERE id = ?').run(createdAt, task.id);

      // Complete task (this sets completed_at to current time)
      const completedTask = dbCompleteTask(db, task.id, task.version);

      // Send notification
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      // Read message file
      const inboxPath = getInboxPath(managerAgentId, { baseDir: testDir });
      const unreadPath = path.join(inboxPath, 'unread', `${messageId}.md`);
      const messageContent = fs.readFileSync(unreadPath, 'utf-8');

      // Verify time to complete is present (format: "Xh Ym" or "Ym")
      expect(messageContent).toContain('**Time to Complete:**');
    });

    it('should return null when root agent has no manager', async () => {
      // Create and complete a task for root agent (CEO)
      const task = createTask(db, {
        agentId: rootAgentId,
        title: 'CEO Task',
        taskPath: `/${rootAgentId}/ceo-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);

      // Send notification
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      // Verify notification was skipped (no manager to notify)
      expect(messageId).toBeNull();

      // Verify no messages were created
      const messages = getMessages(db, { agentId: rootAgentId });
      expect(messages).toHaveLength(0);
    });
  });

  describe('notification preferences', () => {
    it('should skip notification when manager has disabled completion notifications', async () => {
      // Update manager config to disable completion notifications
      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: managerAgentId,
          role: 'Manager',
          displayName: 'Manager',
          createdAt: new Date().toISOString(),
          createdBy: rootAgentId,
          reportingTo: rootAgentId,
        },
        goal: {
          mainGoal: 'Manage team',
        },
        permissions: {
          canHire: true,
          maxSubordinates: 10,
          hiringBudget: 10,
          workspaceQuotaMB: 500,
        },
        framework: {
          primary: 'claude-code',
        },
        communication: {
          notifyOnCompletion: false,
        },
      };

      await saveAgentConfig(managerAgentId, config, { baseDir: testDir });

      // Create and complete a task
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Test Task',
        taskPath: `/${subordinateAgentId}/test-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);

      // Send notification
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      // Verify notification was skipped
      expect(messageId).toBeNull();

      // Verify no message in database
      const messages = getMessages(db, { agentId: managerAgentId });
      expect(messages).toHaveLength(0);
    });

    it('should send notification when forced even if disabled', async () => {
      // Update manager config to disable completion notifications
      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: managerAgentId,
          role: 'Manager',
          displayName: 'Manager',
          createdAt: new Date().toISOString(),
          createdBy: rootAgentId,
          reportingTo: rootAgentId,
        },
        goal: {
          mainGoal: 'Manage team',
        },
        permissions: {
          canHire: true,
          maxSubordinates: 10,
          hiringBudget: 10,
          workspaceQuotaMB: 500,
        },
        framework: {
          primary: 'claude-code',
        },
        communication: {
          notifyOnCompletion: false,
        },
      };

      await saveAgentConfig(managerAgentId, config, { baseDir: testDir });

      // Create and complete a task
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Test Task',
        taskPath: `/${subordinateAgentId}/test-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);

      // Send notification with force option
      const messageId = await notifyTaskCompletion(db, completedTask, {
        dataDir: testDir,
        force: true,
      });

      // Verify notification was sent
      expect(messageId).toBeTruthy();

      // Verify message in database
      const messages = getMessages(db, { agentId: managerAgentId });
      expect(messages).toHaveLength(1);
    });

    it('should send notification when config has no notification settings', async () => {
      // Update manager config without notification settings
      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: managerAgentId,
          role: 'Manager',
          displayName: 'Manager',
          createdAt: new Date().toISOString(),
          createdBy: rootAgentId,
          reportingTo: rootAgentId,
        },
        goal: {
          mainGoal: 'Manage team',
        },
        permissions: {
          canHire: true,
          maxSubordinates: 10,
          hiringBudget: 10,
          workspaceQuotaMB: 500,
        },
        framework: {
          primary: 'claude-code',
        },
        communication: {
        },
        // No notifyOnCompletion field (testing default behavior)
      };

      await saveAgentConfig(managerAgentId, config, { baseDir: testDir });

      // Create and complete a task
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Test Task',
        taskPath: `/${subordinateAgentId}/test-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);

      // Send notification
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      // Verify notification was sent (default is to notify)
      expect(messageId).toBeTruthy();
    });
  });

  describe('error handling', () => {
    it('should throw error when task owner does not exist', async () => {
      // Create task
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Test Task',
        taskPath: `/${subordinateAgentId}/test-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);

      // Delete the task first (to avoid FK constraint), then delete related records, then agent
      // Note: Audit logs are immutable, so we disable triggers temporarily
      db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
      db.pragma('recursive_triggers = OFF'); // Disable triggers to allow deletion
      db.prepare('DELETE FROM audit_log WHERE agent_id = ? OR target_agent_id = ?').run(subordinateAgentId, subordinateAgentId);
      db.pragma('recursive_triggers = ON'); // Re-enable triggers
      db.prepare('DELETE FROM org_hierarchy WHERE agent_id = ?').run(subordinateAgentId);
      db.prepare('DELETE FROM agents WHERE id = ?').run(subordinateAgentId);

      // Attempt to send notification
      await expect(notifyTaskCompletion(db, completedTask, { dataDir: testDir })).rejects.toThrow(
        'Cannot notify completion: task owner'
      );
    });

    it('should throw error when manager does not exist', async () => {
      // Create task
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Test Task',
        taskPath: `/${subordinateAgentId}/test-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);

      // Delete subordinate's tasks first (to avoid FK constraint), then delete related records, then manager
      // Note: Audit logs are immutable, so we disable triggers temporarily
      db.prepare('DELETE FROM tasks WHERE agent_id = ?').run(subordinateAgentId);
      db.pragma('recursive_triggers = OFF'); // Disable triggers to allow deletion
      db.prepare('DELETE FROM audit_log WHERE agent_id = ? OR target_agent_id = ?').run(managerAgentId, managerAgentId);
      db.pragma('recursive_triggers = ON'); // Re-enable triggers
      db.prepare('DELETE FROM org_hierarchy WHERE agent_id = ?').run(managerAgentId);
      db.prepare('DELETE FROM agents WHERE id = ?').run(managerAgentId);

      // Attempt to send notification
      await expect(notifyTaskCompletion(db, completedTask, { dataDir: testDir })).rejects.toThrow(
        'Cannot notify completion: manager agent'
      );
    });
  });

  describe('priority mapping', () => {
    it('should map urgent task priority to high message priority', async () => {
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Urgent Task',
        priority: 'urgent',
        taskPath: `/${subordinateAgentId}/urgent-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      const message = getMessage(db, messageId!);
      expect(message?.priority).toBe('high'); // Completions are lower priority than delegations
    });

    it('should map high task priority to high message priority', async () => {
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'High Priority Task',
        priority: 'high',
        taskPath: `/${subordinateAgentId}/high-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      const message = getMessage(db, messageId!);
      expect(message?.priority).toBe('high');
    });

    it('should map medium/low task priority to normal message priority', async () => {
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Medium Priority Task',
        priority: 'medium',
        taskPath: `/${subordinateAgentId}/medium-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      const message = getMessage(db, messageId!);
      expect(message?.priority).toBe('normal');
    });
  });

  describe('message properties', () => {
    it('should set action_required to false for completion notifications', async () => {
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Test Task',
        taskPath: `/${subordinateAgentId}/test-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      const message = getMessage(db, messageId!);
      expect(message?.action_required).toBe(false);
    });

    it('should include completed task directory path in message', async () => {
      const task = createTask(db, {
        agentId: subordinateAgentId,
        title: 'Test Task',
        taskPath: `/${subordinateAgentId}/test-task`,
      });

      const completedTask = dbCompleteTask(db, task.id, task.version);
      const messageId = await notifyTaskCompletion(db, completedTask, { dataDir: testDir });

      const inboxPath = getInboxPath(managerAgentId, { baseDir: testDir });
      const unreadPath = path.join(inboxPath, 'unread', `${messageId}.md`);
      const messageContent = fs.readFileSync(unreadPath, 'utf-8');

      expect(messageContent).toContain(`agents/${subordinateAgentId}/tasks/completed/${task.id}/`);
    });
  });
});
