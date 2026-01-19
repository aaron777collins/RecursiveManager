/**
 * Tests for notifyDeadlock function (Task 2.3.33)
 *
 * Covers:
 * - Notification message creation and delivery to all agents in deadlock cycle
 * - Agent notification preferences (notifyOnDeadlock)
 * - Database message record creation
 * - Inbox file writing
 * - Error handling for non-existent tasks/agents
 * - Audit logging
 * - Cycle visualization formatting
 * - Multiple agents in same cycle
 * - Force notification option
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { notifyDeadlock } from '../notifyDeadlock';
import {
  createTask,
  createAgent,
  runMigrations,
  allMigrations,
  getMessages,
} from '@recursive-manager/common';
import { saveAgentConfig } from '../../config';
import { AgentConfig } from '@recursive-manager/common';
import { getInboxPath } from '@recursive-manager/common';

describe('notifyDeadlock', () => {
  let db: Database.Database;
  let testDir: string;
  let agentA: string;
  let agentB: string;
  let agentC: string;

  beforeEach(async () => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for testing
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notify-deadlock-test-'));

    // Create test agents
    agentA = createAgent(db, {
      id: 'agent-a-id',
      displayName: 'Agent A',
      role: 'Worker',
      reportingTo: null,
      createdBy: 'test',
      mainGoal: 'Test work',
      configPath: path.join(testDir, 'agent-a.json'),
    }).id;

    agentB = createAgent(db, {
      id: 'agent-b-id',
      displayName: 'Agent B',
      role: 'Worker',
      reportingTo: null,
      createdBy: 'test',
      mainGoal: 'Test work',
      configPath: path.join(testDir, 'agent-b.json'),
    }).id;

    agentC = createAgent(db, {
      id: 'agent-c-id',
      displayName: 'Agent C',
      role: 'Worker',
      reportingTo: null,
      createdBy: 'test',
      mainGoal: 'Test work',
      configPath: path.join(testDir, 'agent-c.json'),
    }).id;

    // Create default agent configs with notifications enabled
    const createDefaultConfig = (agentId: string, role: string): AgentConfig => ({
      version: '1.0.0',
      identity: {
        id: agentId,
        role,
        displayName: role,
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
      },
      framework: {
        primary: 'claude-code',
      },
      communication: {
        notifyOnCompletion: true,
        notifyOnDelegation: true,
        notifyOnDeadlock: true, // Enable deadlock notifications
      },
      behavior: {
        continuousMode: true,
      },
      metadata: {
        tags: [],
      },
    });

    await saveAgentConfig(agentA, createDefaultConfig(agentA, 'Agent A'), testDir);
    await saveAgentConfig(agentB, createDefaultConfig(agentB, 'Agent B'), testDir);
    await saveAgentConfig(agentC, createDefaultConfig(agentC, 'Agent C'), testDir);
  });

  afterEach(async () => {
    // Clean up
    db.close();
    await fs.remove(testDir);
  });

  describe('Basic Functionality', () => {
    it('should send notifications to all agents involved in deadlock cycle', async () => {
      // Create tasks forming a deadlock: A -> B -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      // Set up blocking relationships
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Send deadlock notifications
      const messageIds = await notifyDeadlock(db, [taskA.id, taskB.id], { dataDir: testDir });

      // Should send 2 notifications (one per agent)
      expect(messageIds).toHaveLength(2);

      // Verify messages were created in database
      const messages = getMessages(db, { toAgentId: agentA });
      expect(messages).toHaveLength(1);
      expect(messages[0].subject).toContain('DEADLOCK');
      expect(messages[0].priority).toBe('urgent');
      expect(messages[0].action_required).toBe(true);
      expect(messages[0].from_agent_id).toBe('system');

      const messagesB = getMessages(db, { toAgentId: agentB });
      expect(messagesB).toHaveLength(1);
      expect(messagesB[0].subject).toContain('DEADLOCK');

      // Verify message files were written to inbox
      const inboxPathA = getInboxPath(agentA, testDir);
      const inboxFilesA = await fs.readdir(inboxPathA);
      expect(inboxFilesA.length).toBeGreaterThan(0);

      const inboxPathB = getInboxPath(agentB, testDir);
      const inboxFilesB = await fs.readdir(inboxPathB);
      expect(inboxFilesB.length).toBeGreaterThan(0);

      // Read message content and verify it contains cycle information
      const messageFileA = inboxFilesA[0]!;
      const messageContentA = await fs.readFile(path.join(inboxPathA, messageFileA), 'utf-8');
      expect(messageContentA).toContain('Task Deadlock Detected');
      expect(messageContentA).toContain('Task A');
      expect(messageContentA).toContain('Task B');
      expect(messageContentA).toContain('circular dependency');
    });

    it('should handle three-way deadlock cycle', async () => {
      // Create tasks: A -> B -> C -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      const taskC = createTask(db, {
        agentId: agentC,
        title: 'Task C',
        description: 'Task C description',
        priority: 'high',
        status: 'blocked',
      });

      // Set up blocking relationships
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskC.id]),
        taskB.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskC.id
      );

      // Send deadlock notifications
      const messageIds = await notifyDeadlock(db, [taskA.id, taskB.id, taskC.id], {
        dataDir: testDir,
      });

      // Should send 3 notifications (one per agent)
      expect(messageIds).toHaveLength(3);

      // Verify all agents received notifications
      expect(getMessages(db, { toAgentId: agentA })).toHaveLength(1);
      expect(getMessages(db, { toAgentId: agentB })).toHaveLength(1);
      expect(getMessages(db, { toAgentId: agentC })).toHaveLength(1);
    });

    it('should handle agent owning multiple tasks in cycle', async () => {
      // Create tasks where agentA owns 2 tasks in the cycle: A1 -> B -> A2 -> A1
      const taskA1 = createTask(db, {
        agentId: agentA,
        title: 'Task A1',
        description: 'Task A1 description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      const taskA2 = createTask(db, {
        agentId: agentA,
        title: 'Task A2',
        description: 'Task A2 description',
        priority: 'high',
        status: 'blocked',
      });

      // Set up blocking relationships
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA1.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA2.id]),
        taskB.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA1.id]),
        taskA2.id
      );

      // Send deadlock notifications
      const messageIds = await notifyDeadlock(db, [taskA1.id, taskB.id, taskA2.id], {
        dataDir: testDir,
      });

      // Should send 2 notifications (agentA and agentB), not 3
      expect(messageIds).toHaveLength(2);

      // Verify agentA received one notification mentioning both tasks
      const messagesA = getMessages(db, { toAgentId: agentA });
      expect(messagesA).toHaveLength(1);
      expect(messagesA[0].subject).toContain('Task A1');
      expect(messagesA[0].subject).toContain('Task A2');

      // Read message content and verify it mentions both tasks
      const inboxPathA = getInboxPath(agentA, testDir);
      const inboxFilesA = await fs.readdir(inboxPathA);
      const messageContentA = await fs.readFile(path.join(inboxPathA, inboxFilesA[0]!), 'utf-8');
      expect(messageContentA).toContain('Your tasks are involved');
      expect(messageContentA).toContain('Task A1');
      expect(messageContentA).toContain('Task A2');
    });
  });

  describe('Agent Preferences', () => {
    it('should respect agent notification preferences (notifyOnDeadlock = false)', async () => {
      // Disable deadlock notifications for agentA
      await saveAgentConfig(
        agentA,
        {
          version: '1.0.0',
          identity: {
            id: agentA,
            role: 'Worker',
            displayName: 'Agent A',
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
          },
          framework: {
            primary: 'claude-code',
          },
          communication: {
            notifyOnCompletion: true,
            notifyOnDelegation: true,
            notifyOnDeadlock: false, // Disable deadlock notifications
          },
          behavior: {
            continuousMode: true,
          },
          metadata: {
            tags: [],
          },
        },
        testDir
      );

      // Create tasks forming a deadlock: A -> B -> A
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Send deadlock notifications
      const messageIds = await notifyDeadlock(db, [taskA.id, taskB.id], { dataDir: testDir });

      // Should only send 1 notification (to agentB, not agentA)
      expect(messageIds).toHaveLength(1);

      // Verify agentA did NOT receive notification
      const messagesA = getMessages(db, { toAgentId: agentA });
      expect(messagesA).toHaveLength(0);

      // Verify agentB did receive notification
      const messagesB = getMessages(db, { toAgentId: agentB });
      expect(messagesB).toHaveLength(1);
    });

    it('should send notification when force = true even if notifications disabled', async () => {
      // Disable deadlock notifications for agentA
      await saveAgentConfig(
        agentA,
        {
          version: '1.0.0',
          identity: {
            id: agentA,
            role: 'Worker',
            displayName: 'Agent A',
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
          },
          framework: {
            primary: 'claude-code',
          },
          communication: {
            notifyOnCompletion: true,
            notifyOnDelegation: true,
            notifyOnDeadlock: false, // Disable deadlock notifications
          },
          behavior: {
            continuousMode: true,
          },
          metadata: {
            tags: [],
          },
        },
        testDir
      );

      // Create tasks forming a deadlock
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Send deadlock notifications with force = true
      const messageIds = await notifyDeadlock(db, [taskA.id, taskB.id], {
        dataDir: testDir,
        force: true, // Force notification
      });

      // Should send 2 notifications (including to agentA despite preferences)
      expect(messageIds).toHaveLength(2);

      // Verify agentA received notification
      const messagesA = getMessages(db, { toAgentId: agentA });
      expect(messagesA).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for invalid cycle (less than 2 tasks)', async () => {
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'active',
      });

      await expect(notifyDeadlock(db, [taskA.id], { dataDir: testDir })).rejects.toThrow(
        'cycle must contain at least 2 tasks'
      );

      await expect(notifyDeadlock(db, [], { dataDir: testDir })).rejects.toThrow(
        'cycle must contain at least 2 tasks'
      );
    });

    it('should throw error if task in cycle does not exist', async () => {
      await expect(
        notifyDeadlock(db, ['non-existent-task-1', 'non-existent-task-2'], { dataDir: testDir })
      ).rejects.toThrow('task non-existent-task-1 does not exist');
    });

    it('should continue notifying other agents if one notification fails', async () => {
      // Create tasks
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Delete agentA's directory to cause write failure
      const agentDirA = path.join(testDir, 'agents', agentA.substring(0, 2), agentA);
      await fs.remove(agentDirA);

      // Send notifications - should not throw, but should log error
      const messageIds = await notifyDeadlock(db, [taskA.id, taskB.id], { dataDir: testDir });

      // Should still send notification to agentB (1 notification)
      expect(messageIds.length).toBeLessThanOrEqual(2);
      expect(messageIds.length).toBeGreaterThanOrEqual(1);

      // Verify agentB received notification
      const messagesB = getMessages(db, { toAgentId: agentB });
      expect(messagesB).toHaveLength(1);
    });

    it('should handle missing agent config gracefully (proceed with notification)', async () => {
      // Create tasks
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Delete agentA's config file
      const configPath = path.join(
        testDir,
        'agents',
        agentA.substring(0, 2),
        agentA,
        'config.json'
      );
      await fs.remove(configPath);

      // Send notifications - should proceed despite missing config
      const messageIds = await notifyDeadlock(db, [taskA.id, taskB.id], { dataDir: testDir });

      // Should still send both notifications (fail-safe behavior)
      expect(messageIds).toHaveLength(2);
    });
  });

  describe('Message Content', () => {
    it('should include all required information in notification message', async () => {
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      await notifyDeadlock(db, [taskA.id, taskB.id], { dataDir: testDir });

      // Read message content
      const inboxPathA = getInboxPath(agentA, testDir);
      const inboxFilesA = await fs.readdir(inboxPathA);
      const messageContentA = await fs.readFile(path.join(inboxPathA, inboxFilesA[0]), 'utf-8');

      // Verify required sections
      expect(messageContentA).toContain('Task Deadlock Detected');
      expect(messageContentA).toContain('What is a Deadlock?');
      expect(messageContentA).toContain('The Deadlock Cycle');
      expect(messageContentA).toContain('How to Resolve This');
      expect(messageContentA).toContain('Action Required');
      expect(messageContentA).toContain('Additional Context');

      // Verify specific details
      expect(messageContentA).toContain('Task A');
      expect(messageContentA).toContain('Task B');
      expect(messageContentA).toContain(taskA.id);
      expect(messageContentA).toContain(taskB.id);
      expect(messageContentA).toContain('Total Tasks in Cycle: 2');
      expect(messageContentA).toContain('Priority: URGENT');
    });

    it('should use consistent thread ID for all notifications in same cycle', async () => {
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      await notifyDeadlock(db, [taskA.id, taskB.id], { dataDir: testDir });

      // Verify both messages share the same thread ID
      const messagesA = getMessages(db, { toAgentId: agentA });
      const messagesB = getMessages(db, { toAgentId: agentB });

      expect(messagesA[0].thread_id).toBeDefined();
      expect(messagesB[0].thread_id).toBeDefined();
      expect(messagesA[0].thread_id).toBe(messagesB[0].thread_id);
      expect(messagesA[0].thread_id).toContain('deadlock');
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log entries for successful notifications', async () => {
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      await notifyDeadlock(db, [taskA.id, taskB.id], { dataDir: testDir });

      // Verify audit log entries
      const auditLogs = db
        .prepare(
          `
        SELECT * FROM audit_log
        WHERE action = 'task_update'
        AND details LIKE '%deadlock_notification%'
        ORDER BY timestamp ASC
      `
        )
        .all() as any[];

      expect(auditLogs.length).toBeGreaterThanOrEqual(2);

      // Verify log details
      auditLogs.forEach((log) => {
        expect(log.success).toBe(1); // SQLite stores boolean as 1/0
        const details = JSON.parse(log.details);
        expect(details.type).toBe('deadlock_notification');
        expect(details.messageId).toBeDefined();
        expect(details.cycleTaskIds).toEqual([taskA.id, taskB.id]);
        expect(details.cycleSize).toBe(2);
        expect(details.agentsAffected).toBe(2);
      });
    });

    it('should create audit log entry for failed notification', async () => {
      const taskA = createTask(db, {
        agentId: agentA,
        title: 'Task A',
        description: 'Task A description',
        priority: 'high',
        status: 'blocked',
      });

      const taskB = createTask(db, {
        agentId: agentB,
        title: 'Task B',
        description: 'Task B description',
        priority: 'high',
        status: 'blocked',
      });

      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskB.id]),
        taskA.id
      );
      db.prepare('UPDATE tasks SET blocked_by = ? WHERE id = ?').run(
        JSON.stringify([taskA.id]),
        taskB.id
      );

      // Delete agentA's directory to cause failure
      const agentDirA = path.join(testDir, 'agents', agentA.substring(0, 2), agentA);
      await fs.remove(agentDirA);

      await notifyDeadlock(db, [taskA.id, taskB.id], { dataDir: testDir });

      // Verify audit log entry for failure
      const failedLogs = db
        .prepare(
          `
        SELECT * FROM audit_log
        WHERE action = 'task_update'
        AND success = 0
        AND details LIKE '%deadlock_notification%'
      `
        )
        .all() as any[];

      expect(failedLogs.length).toBeGreaterThanOrEqual(1);

      const details = JSON.parse(failedLogs[0].details);
      expect(details.type).toBe('deadlock_notification');
      expect(details.error).toBeDefined();
    });
  });
});
