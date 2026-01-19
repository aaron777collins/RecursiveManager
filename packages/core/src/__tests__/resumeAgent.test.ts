/**
 * Tests for resumeAgent function (Task 2.2.17 / Task 2.2.29)
 *
 * Covers all resume scenarios:
 * - Successful resume of paused agent
 * - Validation failures (not found, not paused)
 * - Database operations
 * - Task unblocking integration
 * - Notification delivery to agent and manager
 * - Audit logging
 * - Error handling and recovery
 */

import Database from 'better-sqlite3';
import { resumeAgent, ResumeAgentError } from '../lifecycle/resumeAgent';
import { pauseAgent } from '../lifecycle/pauseAgent';
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
} from '@recursive-manager/common';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

describe('resumeAgent', () => {
  let db: Database.Database;
  let testDir: string;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for agent configs
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resumeagent-test-'));
  });

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
  });

  describe('Successful Resume', () => {
    it('should successfully resume a paused agent', async () => {
      // Create an active agent
      const config = generateDefaultConfig('Developer', 'Write code', 'system', {
        id: 'dev-001',
        canHire: false,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Pause the agent
      await pauseAgent(db, 'dev-001', { baseDir: testDir });

      const beforeResume = getAgent(db, 'dev-001');
      expect(beforeResume?.status).toBe('paused');

      // Resume the agent
      const result = await resumeAgent(db, 'dev-001', { baseDir: testDir });

      // Verify result
      expect(result).toBeDefined();
      expect(result.agentId).toBe('dev-001');
      expect(result.status).toBe('active');
      expect(result.previousStatus).toBe('paused');
      expect(result.notificationsSent).toBeGreaterThan(0);
      expect(result.tasksUnblocked).toBeDefined();

      // Verify database updated
      const afterResume = getAgent(db, 'dev-001');
      expect(afterResume?.status).toBe('active');
    });

    it('should resume agent with subordinates', async () => {
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

      // Pause then resume the subordinate
      await pauseAgent(db, 'dev-001', { baseDir: testDir });
      const result = await resumeAgent(db, 'dev-001', { baseDir: testDir });

      expect(result.agentId).toBe('dev-001');
      expect(result.status).toBe('active');
      expect(result.notificationsSent).toBe(2); // One to agent, one to manager

      // Verify database
      const resumedAgent = getAgent(db, 'dev-001');
      expect(resumedAgent?.status).toBe('active');
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

      // Pause then resume the subordinate
      await pauseAgent(db, 'dev-001', { baseDir: testDir });

      // Clear messages from pause operation to test resume notifications
      const beforeResumeCount = getMessages(db, { agentId: 'dev-001' }).length;

      const result = await resumeAgent(db, 'dev-001', { baseDir: testDir });

      // Verify notifications sent
      expect(result.notificationsSent).toBe(2);

      // Check messages in database (should have additional messages from resume)
      const afterResumeCount = getMessages(db, { agentId: 'dev-001' }).length;
      expect(afterResumeCount).toBeGreaterThan(beforeResumeCount);

      const devMessages = getMessages(db, { agentId: 'dev-001' });
      expect(devMessages.some((m) => m.subject?.includes('Resumed'))).toBe(true);

      const managerMessages = getMessages(db, { agentId: 'manager-001' });
      expect(managerMessages.some((m) => m.subject?.includes('Subordinate Resumed'))).toBe(true);
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

      // Pause then resume the root agent
      await pauseAgent(db, 'ceo-001', { baseDir: testDir });
      const result = await resumeAgent(db, 'ceo-001', { baseDir: testDir });

      // Only agent notification, no manager
      expect(result.notificationsSent).toBe(1);

      // Verify notification to agent only
      const messages = getMessages(db, { agentId: 'ceo-001' });
      expect(messages.some((m) => m.subject?.includes('Resumed'))).toBe(true);
    });
  });

  describe('Validation Errors', () => {
    it('should fail when agent does not exist', async () => {
      await expect(resumeAgent(db, 'nonexistent', { baseDir: testDir })).rejects.toThrow(
        ResumeAgentError
      );

      await expect(resumeAgent(db, 'nonexistent', { baseDir: testDir })).rejects.toThrow(
        'Agent not found in database'
      );
    });

    it('should fail when agent is not paused (active)', async () => {
      // Create active agent
      const config = generateDefaultConfig('Developer', 'Write code', 'system', {
        id: 'dev-001',
        canHire: false,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Try to resume active agent
      await expect(resumeAgent(db, 'dev-001', { baseDir: testDir })).rejects.toThrow(
        ResumeAgentError
      );

      await expect(resumeAgent(db, 'dev-001', { baseDir: testDir })).rejects.toThrow(
        "Cannot resume agent with status 'active'. Only paused agents can be resumed."
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

      // Try to resume fired agent
      await expect(resumeAgent(db, 'dev-001', { baseDir: testDir })).rejects.toThrow(
        ResumeAgentError
      );

      await expect(resumeAgent(db, 'dev-001', { baseDir: testDir })).rejects.toThrow(
        "Cannot resume agent with status 'fired'. Only paused agents can be resumed."
      );
    });
  });

  describe('Audit Logging', () => {
    it('should log successful resume action', async () => {
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

      // Pause then resume the subordinate
      await pauseAgent(db, 'dev-001', { baseDir: testDir });
      await resumeAgent(db, 'dev-001', { baseDir: testDir });

      // Check audit log
      const logs = queryAuditLog(db, {
        action: AuditAction.RESUME,
        targetAgentId: 'dev-001',
      });

      expect(logs.length).toBeGreaterThan(0);
      const resumeLog = logs[0];
      expect(resumeLog).toBeDefined();
      expect(resumeLog!.success).toBe(true);
      expect(resumeLog!.agent_id).toBe('manager-001');
      expect(resumeLog!.target_agent_id).toBe('dev-001');
      expect(resumeLog!.details).toBeDefined();
    });

    it('should log audit entry for root agent resume', async () => {
      // Create root agent
      const config = generateDefaultConfig('CEO', 'Lead organization', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Pause then resume root agent
      await pauseAgent(db, 'ceo-001', { baseDir: testDir });
      await resumeAgent(db, 'ceo-001', { baseDir: testDir });

      // Check audit log (agentId should be null for root agents)
      const logs = queryAuditLog(db, {
        action: AuditAction.RESUME,
        targetAgentId: 'ceo-001',
      });

      expect(logs.length).toBeGreaterThan(0);
      const resumeLog = logs[0];
      expect(resumeLog).toBeDefined();
      expect(resumeLog!.success).toBe(true);
      expect(resumeLog!.agent_id).toBeNull();
      expect(resumeLog!.target_agent_id).toBe('ceo-001');
    });
  });

  describe('Task Unblocking Integration', () => {
    it('should report task unblocking results', async () => {
      // Create agent
      const config = generateDefaultConfig('Developer', 'Write code', 'system', {
        id: 'dev-001',
        canHire: false,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // Pause then resume agent
      await pauseAgent(db, 'dev-001', { baseDir: testDir });
      const result = await resumeAgent(db, 'dev-001', { baseDir: testDir });

      // Verify task unblocking result is included
      expect(result.tasksUnblocked).toBeDefined();
      expect(result.tasksUnblocked.totalTasks).toBeDefined();
      expect(result.tasksUnblocked.unblockedCount).toBeDefined();
      expect(result.tasksUnblocked.stillBlocked).toBeDefined();
      expect(result.tasksUnblocked.errors).toBeDefined();
      expect(Array.isArray(result.tasksUnblocked.errors)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should include agentId in ResumeAgentError', async () => {
      try {
        await resumeAgent(db, 'nonexistent', { baseDir: testDir });
        fail('Expected ResumeAgentError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ResumeAgentError);
        if (err instanceof ResumeAgentError) {
          expect(err.agentId).toBe('nonexistent');
          expect(err.message).toContain('Agent not found');
        }
      }
    });

    it('should preserve error name and stack trace', async () => {
      try {
        await resumeAgent(db, 'nonexistent', { baseDir: testDir });
        fail('Expected ResumeAgentError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        if (err instanceof Error) {
          expect(err.name).toBe('ResumeAgentError');
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

      // Pause agent
      await pauseAgent(db, 'dev-001', { baseDir: testDir });

      // Verify paused status
      const before = getAgent(db, 'dev-001');
      expect(before?.status).toBe('paused');

      // Resume
      const result = await resumeAgent(db, 'dev-001', { baseDir: testDir });

      // Check previousStatus
      expect(result.previousStatus).toBe('paused');
      expect(result.status).toBe('active');
    });
  });

  describe('Complete Pause/Resume Cycle', () => {
    it('should handle multiple pause/resume cycles', async () => {
      // Create agent
      const config = generateDefaultConfig('Developer', 'Write code', 'system', {
        id: 'dev-001',
        canHire: false,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      // First cycle
      await pauseAgent(db, 'dev-001', { baseDir: testDir });
      let agent = getAgent(db, 'dev-001');
      expect(agent?.status).toBe('paused');

      await resumeAgent(db, 'dev-001', { baseDir: testDir });
      agent = getAgent(db, 'dev-001');
      expect(agent?.status).toBe('active');

      // Second cycle
      await pauseAgent(db, 'dev-001', { baseDir: testDir });
      agent = getAgent(db, 'dev-001');
      expect(agent?.status).toBe('paused');

      await resumeAgent(db, 'dev-001', { baseDir: testDir });
      agent = getAgent(db, 'dev-001');
      expect(agent?.status).toBe('active');

      // Verify audit trail
      const pauseLogs = queryAuditLog(db, {
        action: AuditAction.PAUSE,
        targetAgentId: 'dev-001',
      });
      expect(pauseLogs.length).toBe(2);

      const resumeLogs = queryAuditLog(db, {
        action: AuditAction.RESUME,
        targetAgentId: 'dev-001',
      });
      expect(resumeLogs.length).toBe(2);
    });
  });
});
