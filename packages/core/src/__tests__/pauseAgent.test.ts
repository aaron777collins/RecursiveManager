/**
 * Tests for pauseAgent function (Task 2.2.16 / Task 2.2.29)
 *
 * Covers all pause scenarios:
 * - Successful pause of active agent
 * - Validation failures (not found, already paused, fired)
 * - Database operations
 * - Task blocking integration
 * - Notification delivery to agent and manager
 * - Audit logging
 * - Error handling and recovery
 */

import Database from 'better-sqlite3';
import { pauseAgent, PauseAgentError } from '../lifecycle/pauseAgent';
import { hireAgent } from '../lifecycle/hireAgent';
import { generateDefaultConfig } from '../config';
import {
  getAgent,
  updateAgent,
  runMigrations,
  allMigrations,
  queryAuditLog,
  AuditAction,
  getMessages,
} from '@recursivemanager/common';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

describe('pauseAgent', () => {
  let db: Database.Database;
  let testDir: string;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for agent configs
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pauseagent-test-'));
  });

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
  });

  describe('Successful Pause', () => {
    it('should successfully pause an active agent', async () => {
      // Create an active agent
      const config = generateDefaultConfig('Developer', 'Write code', 'system', {
        id: 'dev-001',
        canHire: false,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Verify agent is active
      const beforePause = getAgent(db, 'dev-001');
      expect(beforePause?.status).toBe('active');

      // Pause the agent
      const result = await pauseAgent(db, 'dev-001', { baseDir: testDir });

      // Verify result
      expect(result).toBeDefined();
      expect(result.agentId).toBe('dev-001');
      expect(result.status).toBe('paused');
      expect(result.previousStatus).toBe('active');
      expect(result.notificationsSent).toBeGreaterThan(0);
      expect(result.tasksBlocked).toBeDefined();

      // Verify database updated
      const afterPause = getAgent(db, 'dev-001');
      expect(afterPause?.status).toBe('paused');
    });

    it('should pause agent with subordinates', async () => {
      // Create manager
      const managerConfig = generateDefaultConfig('Manager', 'Manage team', 'system', {
        id: 'manager-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
        reportingTo: null,
      });

      await hireAgent(db, null, managerConfig, { baseDir: testDir });

      // Create subordinate
      const devConfig = generateDefaultConfig('Developer', 'Write code', 'manager-001', {
        id: 'dev-001',
        canHire: false,
        reportingTo: 'manager-001',
      });

      await hireAgent(db, 'manager-001', devConfig, { baseDir: testDir });

      // Pause the subordinate
      const result = await pauseAgent(db, 'dev-001', { baseDir: testDir });

      expect(result.agentId).toBe('dev-001');
      expect(result.status).toBe('paused');
      expect(result.notificationsSent).toBe(2); // One to agent, one to manager

      // Verify database
      const pausedAgent = getAgent(db, 'dev-001');
      expect(pausedAgent?.status).toBe('paused');
    });

    it('should send notifications to agent and manager', async () => {
      // Create manager
      const managerConfig = generateDefaultConfig('Manager', 'Manage team', 'system', {
        id: 'manager-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
        reportingTo: null,
      });

      await hireAgent(db, null, managerConfig, { baseDir: testDir });

      // Create subordinate
      const devConfig = generateDefaultConfig('Developer', 'Write code', 'manager-001', {
        id: 'dev-001',
        canHire: false,
        reportingTo: 'manager-001',
      });

      await hireAgent(db, 'manager-001', devConfig, { baseDir: testDir });

      // Pause the subordinate
      const result = await pauseAgent(db, 'dev-001', { baseDir: testDir });

      // Verify notifications sent
      expect(result.notificationsSent).toBe(2);

      // Check messages in database
      const devMessages = getMessages(db, { agentId: 'dev-001', unreadOnly: true });
      expect(devMessages.length).toBeGreaterThan(0);
      expect(devMessages.some((m: any) => m.subject?.includes('Paused'))).toBe(true);

      const managerMessages = getMessages(db, { agentId: 'manager-001', unreadOnly: true });
      expect(managerMessages.length).toBeGreaterThan(0);
      expect(managerMessages.some((m: any) => m.subject?.includes('Subordinate Paused'))).toBe(true);
    });

    it('should send only one notification for root agent', async () => {
      // Create root agent without manager
      const config = generateDefaultConfig('CEO', 'Lead organization', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Pause the root agent
      const result = await pauseAgent(db, 'ceo-001', { baseDir: testDir });

      // Only agent notification, no manager
      expect(result.notificationsSent).toBe(1);

      // Verify notification to agent only
      const messages = getMessages(db, { agentId: 'ceo-001', unreadOnly: true });
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe('Validation Errors', () => {
    it('should fail when agent does not exist', async () => {
      await expect(pauseAgent(db, 'nonexistent', { baseDir: testDir })).rejects.toThrow(
        PauseAgentError
      );

      await expect(pauseAgent(db, 'nonexistent', { baseDir: testDir })).rejects.toThrow(
        'Agent not found in database'
      );
    });

    it('should fail when agent is already paused', async () => {
      // Create agent
      const config = generateDefaultConfig('Developer', 'Write code', 'system', {
        id: 'dev-001',
        canHire: false,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Pause once
      await pauseAgent(db, 'dev-001', { baseDir: testDir });

      // Try to pause again
      await expect(pauseAgent(db, 'dev-001', { baseDir: testDir })).rejects.toThrow(
        PauseAgentError
      );

      await expect(pauseAgent(db, 'dev-001', { baseDir: testDir })).rejects.toThrow(
        'Agent is already paused'
      );
    });

    it('should fail when agent is fired', async () => {
      // Create agent
      const config = generateDefaultConfig('Developer', 'Write code', 'system', {
        id: 'dev-001',
        canHire: false,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Manually set status to fired
      updateAgent(db, 'dev-001', { status: 'fired' });

      // Try to pause fired agent
      await expect(pauseAgent(db, 'dev-001', { baseDir: testDir })).rejects.toThrow(
        PauseAgentError
      );

      await expect(pauseAgent(db, 'dev-001', { baseDir: testDir })).rejects.toThrow(
        'Cannot pause a fired agent'
      );
    });
  });

  describe('Audit Logging', () => {
    it('should log successful pause action', async () => {
      // Create manager and subordinate
      const managerConfig = generateDefaultConfig('Manager', 'Manage team', 'system', {
        id: 'manager-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
        reportingTo: null,
      });

      await hireAgent(db, null, managerConfig, { baseDir: testDir });

      const devConfig = generateDefaultConfig('Developer', 'Write code', 'manager-001', {
        id: 'dev-001',
        canHire: false,
        reportingTo: 'manager-001',
      });

      await hireAgent(db, 'manager-001', devConfig, { baseDir: testDir });

      // Pause the subordinate
      await pauseAgent(db, 'dev-001', { baseDir: testDir });

      // Check audit log
      const logs = queryAuditLog(db, {
        action: AuditAction.PAUSE,
        targetAgentId: 'dev-001',
      });

      expect(logs.length).toBeGreaterThan(0);
      const pauseLog = logs[0]!;
      expect(pauseLog).toBeDefined();
      expect(Boolean(pauseLog.success)).toBe(true);
      // Note: agent_id is null because updateAgent doesn't yet support performedBy parameter
      // TODO: Update when updateAgent is enhanced to track who performed the action
      expect(pauseLog.agent_id).toBe(null);
      expect(pauseLog.target_agent_id).toBe('dev-001');
      expect(pauseLog.details).toBeDefined();
    });

    it('should log audit entry for root agent pause', async () => {
      // Create root agent
      const config = generateDefaultConfig('CEO', 'Lead organization', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Pause root agent
      await pauseAgent(db, 'ceo-001', { baseDir: testDir });

      // Check audit log (agentId should be null for root agents)
      const logs = queryAuditLog(db, {
        action: AuditAction.PAUSE,
        targetAgentId: 'ceo-001',
      });

      expect(logs.length).toBeGreaterThan(0);
      const pauseLog = logs[0]!;
      expect(pauseLog).toBeDefined();
      expect(Boolean(pauseLog.success)).toBe(true);
      expect(pauseLog.agent_id).toBeNull();
      expect(pauseLog.target_agent_id).toBe('ceo-001');
    });
  });

  describe('Task Blocking Integration', () => {
    it('should report task blocking results', async () => {
      // Create agent
      const config = generateDefaultConfig('Developer', 'Write code', 'system', {
        id: 'dev-001',
        canHire: false,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Pause agent
      const result = await pauseAgent(db, 'dev-001', { baseDir: testDir });

      // Verify task blocking result is included
      expect(result.tasksBlocked).toBeDefined();
      expect(result.tasksBlocked.totalTasks).toBeDefined();
      expect(result.tasksBlocked.blockedCount).toBeDefined();
      expect(result.tasksBlocked.alreadyBlocked).toBeDefined();
      expect(result.tasksBlocked.errors).toBeDefined();
      expect(Array.isArray(result.tasksBlocked.errors)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should include agentId in PauseAgentError', async () => {
      try {
        await pauseAgent(db, 'nonexistent', { baseDir: testDir });
        fail('Expected PauseAgentError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PauseAgentError);
        if (err instanceof PauseAgentError) {
          expect(err.agentId).toBe('nonexistent');
          expect(err.message).toContain('Agent not found');
        }
      }
    });

    it('should preserve error name and stack trace', async () => {
      try {
        await pauseAgent(db, 'nonexistent', { baseDir: testDir });
        fail('Expected PauseAgentError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        if (err instanceof Error) {
          expect(err.name).toBe('PauseAgentError');
          expect(err.stack).toBeDefined();
        }
      }
    });
  });

  describe('Status Transitions', () => {
    it('should preserve previousStatus in result', async () => {
      // Create agent
      const config = generateDefaultConfig('Developer', 'Write code', 'system', {
        id: 'dev-001',
        canHire: false,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Verify initial status
      const before = getAgent(db, 'dev-001');
      expect(before?.status).toBe('active');

      // Pause
      const result = await pauseAgent(db, 'dev-001', { baseDir: testDir });

      // Check previousStatus
      expect(result.previousStatus).toBe('active');
      expect(result.status).toBe('paused');
    });
  });
});
