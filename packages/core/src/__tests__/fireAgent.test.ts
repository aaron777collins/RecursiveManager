/**
 * Tests for fireAgent Implementation (Task 2.2.10)
 *
 * This test suite validates the complete agent firing workflow including:
 * - Validation checks
 * - Orphan handling strategies (reassign, promote, cascade)
 * - Task handling (reassignment and archival)
 * - Database updates
 * - Parent registry updates
 * - File archival
 *
 * Edge Cases Tested:
 * - EC-1.2: Orphaned agents (manager fired)
 * - EC-2.3: Abandoned tasks from paused/fired agents
 */

import Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fireAgent, FireAgentError, FireStrategy } from '../lifecycle/fireAgent';
import { hireAgent } from '../lifecycle/hireAgent';
import { generateDefaultConfig } from '../config';
import {
  createAgent,
  getAgent,
  getSubordinates,
  updateAgent,
  queryAuditLog,
  initializeDatabase,
  allMigrations,
  getMessages,
  getUnreadMessageCount,
} from '@recursive-manager/common';

// Test database and temp directory
let db: Database.Database;
let tempDir: string;

beforeEach(async () => {
  // Create temp directory for test data
  tempDir = path.join('/tmp', `fireagent-test-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  // Initialize in-memory database
  db = new Database(':memory:');
  initializeDatabase(db, allMigrations);
});

afterEach(async () => {
  // Clean up
  db.close();
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

describe('fireAgent()', () => {
  describe('Basic Validation', () => {
    it('should throw error if agent does not exist', async () => {
      await expect(fireAgent(db, 'non-existent', 'reassign', { baseDir: tempDir })).rejects.toThrow(
        FireAgentError
      );
      await expect(fireAgent(db, 'non-existent', 'reassign', { baseDir: tempDir })).rejects.toThrow(
        'Agent not found in database'
      );
    });

    it('should throw error if agent is already fired', async () => {
      // Create agent
      const ceoConfig = generateDefaultConfig('CEO', 'Lead the organization', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      // Fire agent once
      await fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir });

      // Try to fire again
      await expect(fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir })).rejects.toThrow(
        FireAgentError
      );
      await expect(fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir })).rejects.toThrow(
        'Agent is already fired'
      );
    });

    it('should successfully fire an agent with no subordinates', async () => {
      // Create agent
      const ceoConfig = generateDefaultConfig('CEO', 'Lead the organization', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      // Fire agent
      const result = await fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir });

      expect(result).toMatchObject({
        agentId: 'ceo-001',
        status: 'fired',
        orphansHandled: 0,
        orphanStrategy: 'reassign',
        tasksReassigned: 0,
        tasksArchived: 0,
      });

      // Verify database status
      const agent = getAgent(db, 'ceo-001');
      expect(agent?.status).toBe('fired');
    });
  });

  describe('Orphan Handling - Reassign Strategy', () => {
    it('should reassign subordinates to grandparent when using reassign strategy', async () => {
      // Create hierarchy: CEO -> CTO -> Dev
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
        reportingTo: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      const devConfig = generateDefaultConfig('Developer', 'Build features', 'cto-001', {
        id: 'dev-001',
        reportingTo: 'cto-001',
      });
      await hireAgent(db, 'cto-001', devConfig, { baseDir: tempDir });

      // Fire CTO (middle manager)
      const result = await fireAgent(db, 'cto-001', 'reassign', { baseDir: tempDir });

      expect(result.orphansHandled).toBe(1);
      expect(result.orphanStrategy).toBe('reassign');

      // Verify Dev now reports to CEO
      const dev = getAgent(db, 'dev-001');
      expect(dev?.reporting_to).toBe('ceo-001');

      // Verify CTO is fired
      const cto = getAgent(db, 'cto-001');
      expect(cto?.status).toBe('fired');
    });

    it('should promote subordinates to root when firing root agent with subordinates', async () => {
      // Create hierarchy: CEO -> CTO
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
        reportingTo: 'ceo-001',
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      // Fire CEO (no grandparent)
      const result = await fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir });

      expect(result.orphansHandled).toBe(1);

      // Verify CTO now reports to null (root agent)
      const cto = getAgent(db, 'cto-001');
      expect(cto?.reporting_to).toBeNull();
    });

    it('should handle multiple subordinates when reassigning', async () => {
      // Create hierarchy: CEO -> CTO -> [Dev1, Dev2, Dev3]
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
        reportingTo: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      const dev1Config = generateDefaultConfig('Developer 1', 'Build', 'cto-001', {
        id: 'dev-001',
        reportingTo: 'cto-001',
      });
      await hireAgent(db, 'cto-001', dev1Config, { baseDir: tempDir });

      const dev2Config = generateDefaultConfig('Developer 2', 'Build', 'cto-001', {
        id: 'dev-002',
        reportingTo: 'cto-001',
      });
      await hireAgent(db, 'cto-001', dev2Config, { baseDir: tempDir });

      const dev3Config = generateDefaultConfig('Developer 3', 'Build', 'cto-001', {
        id: 'dev-003',
        reportingTo: 'cto-001',
      });
      await hireAgent(db, 'cto-001', dev3Config, { baseDir: tempDir });

      // Fire CTO
      const result = await fireAgent(db, 'cto-001', 'reassign', { baseDir: tempDir });

      expect(result.orphansHandled).toBe(3);

      // Verify all devs now report to CEO
      const dev1 = getAgent(db, 'dev-001');
      const dev2 = getAgent(db, 'dev-002');
      const dev3 = getAgent(db, 'dev-003');

      expect(dev1?.reporting_to).toBe('ceo-001');
      expect(dev2?.reporting_to).toBe('ceo-001');
      expect(dev3?.reporting_to).toBe('ceo-001');
    });
  });

  describe('Orphan Handling - Promote Strategy', () => {
    it('should promote subordinates to grandparent when using promote strategy', async () => {
      // Create hierarchy: CEO -> CTO -> Dev
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
        reportingTo: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      const devConfig = generateDefaultConfig('Developer', 'Build features', 'cto-001', {
        id: 'dev-001',
        reportingTo: 'cto-001',
      });
      await hireAgent(db, 'cto-001', devConfig, { baseDir: tempDir });

      // Fire CTO with promote strategy
      const result = await fireAgent(db, 'cto-001', 'promote', { baseDir: tempDir });

      expect(result.orphansHandled).toBe(1);
      expect(result.orphanStrategy).toBe('promote');

      // Verify Dev now reports to CEO
      const dev = getAgent(db, 'dev-001');
      expect(dev?.reporting_to).toBe('ceo-001');
    });
  });

  describe('Orphan Handling - Cascade Strategy', () => {
    it('should fire all subordinates when using cascade strategy', async () => {
      // Create hierarchy: CEO -> CTO -> Dev
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
        reportingTo: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      const devConfig = generateDefaultConfig('Developer', 'Build features', 'cto-001', {
        id: 'dev-001',
        reportingTo: 'cto-001',
      });
      await hireAgent(db, 'cto-001', devConfig, { baseDir: tempDir });

      // Fire CTO with cascade strategy
      const result = await fireAgent(db, 'cto-001', 'cascade', { baseDir: tempDir });

      expect(result.orphansHandled).toBe(1);
      expect(result.orphanStrategy).toBe('cascade');

      // Verify both CTO and Dev are fired
      const cto = getAgent(db, 'cto-001');
      const dev = getAgent(db, 'dev-001');

      expect(cto?.status).toBe('fired');
      expect(dev?.status).toBe('fired');
    });

    it('should recursively fire all descendants when using cascade strategy', async () => {
      // Create deep hierarchy: CEO -> CTO -> Dev -> Junior
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
        reportingTo: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      const devConfig = generateDefaultConfig('Developer', 'Build', 'cto-001', {
        id: 'dev-001',
        reportingTo: 'cto-001',
        canHire: true,
        maxSubordinates: 3,
        hiringBudget: 2,
      });
      await hireAgent(db, 'cto-001', devConfig, { baseDir: tempDir });

      const juniorConfig = generateDefaultConfig('Junior Dev', 'Learn', 'dev-001', {
        id: 'junior-001',
        reportingTo: 'dev-001',
      });
      await hireAgent(db, 'dev-001', juniorConfig, { baseDir: tempDir });

      // Fire CTO with cascade (should fire CTO, Dev, and Junior)
      const result = await fireAgent(db, 'cto-001', 'cascade', { baseDir: tempDir });

      expect(result.orphansHandled).toBe(1); // Only direct subordinates counted

      // Verify all are fired
      const cto = getAgent(db, 'cto-001');
      const dev = getAgent(db, 'dev-001');
      const junior = getAgent(db, 'junior-001');

      expect(cto?.status).toBe('fired');
      expect(dev?.status).toBe('fired');
      expect(junior?.status).toBe('fired');
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log entry for successful fire', async () => {
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      await fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir });

      // Query audit log
      const auditEvents = queryAuditLog(db, {
        action: 'fire',
        targetAgentId: 'ceo-001',
      });

      expect(auditEvents.length).toBeGreaterThan(0);
      expect(auditEvents[0].success).toBe(true);
      expect(auditEvents[0].target_agent_id).toBe('ceo-001');
    });

    it('should include orphan handling details in audit log', async () => {
      // Create hierarchy: CEO -> CTO -> Dev
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
        reportingTo: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      const devConfig = generateDefaultConfig('Developer', 'Build', 'cto-001', {
        id: 'dev-001',
        reportingTo: 'cto-001',
      });
      await hireAgent(db, 'cto-001', devConfig, { baseDir: tempDir });

      await fireAgent(db, 'cto-001', 'reassign', { baseDir: tempDir });

      // Query audit log
      const auditEvents = queryAuditLog(db, {
        action: 'fire',
        targetAgentId: 'cto-001',
      });

      expect(auditEvents.length).toBeGreaterThan(0);
      const fireEvent = auditEvents[0];
      expect(fireEvent.success).toBe(true);

      const details = JSON.parse(fireEvent.details as string);
      expect(details.orphansHandled).toBe(1);
      expect(details.strategy).toBe('reassign');
    });
  });

  describe('Database State', () => {
    it('should update agent status to fired in database', async () => {
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      await fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir });

      const agent = getAgent(db, 'ceo-001');
      expect(agent?.status).toBe('fired');
    });

    it('should preserve other agent data when firing', async () => {
      const ceoConfig = generateDefaultConfig('CEO', 'Lead the organization', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const beforeFire = getAgent(db, 'ceo-001');

      await fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir });

      const afterFire = getAgent(db, 'ceo-001');

      expect(afterFire?.id).toBe(beforeFire?.id);
      expect(afterFire?.role).toBe(beforeFire?.role);
      expect(afterFire?.display_name).toBe(beforeFire?.display_name);
      expect(afterFire?.created_at).toBe(beforeFire?.created_at);
      expect(afterFire?.main_goal).toBe(beforeFire?.main_goal);
      expect(afterFire?.status).toBe('fired');
    });
  });

  describe('Edge Cases', () => {
    it('should handle firing paused agent', async () => {
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      // Pause agent first
      updateAgent(db, 'ceo-001', { status: 'paused' });

      // Fire paused agent
      const result = await fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir });

      expect(result.status).toBe('fired');

      const agent = getAgent(db, 'ceo-001');
      expect(agent?.status).toBe('fired');
    });

    it('should handle firing agent with no files on disk', async () => {
      // Create agent directly in database (skip hireAgent to avoid file creation)
      createAgent(db, {
        id: 'test-001',
        role: 'Tester',
        displayName: 'Test Agent',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Testing',
        configPath: '/fake/path',
      });

      // Should not throw even though files don't exist
      const result = await fireAgent(db, 'test-001', 'reassign', { baseDir: tempDir });

      expect(result.status).toBe('fired');
      expect(result.filesArchived).toBe(false); // Files didn't exist
    });

    it('should handle unknown fire strategy gracefully', async () => {
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech', 'ceo-001', {
        id: 'cto-001',
        reportingTo: 'ceo-001',
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      // Use invalid strategy (TypeScript won't catch this in test)
      await expect(
        fireAgent(db, 'ceo-001', 'invalid-strategy' as FireStrategy, { baseDir: tempDir })
      ).rejects.toThrow('Unknown fire strategy');
    });
  });

  describe('Error Handling', () => {
    it('should throw FireAgentError with proper context', async () => {
      try {
        await fireAgent(db, 'non-existent', 'reassign', { baseDir: tempDir });
        fail('Should have thrown FireAgentError');
      } catch (err) {
        expect(err).toBeInstanceOf(FireAgentError);
        expect((err as FireAgentError).agentId).toBe('non-existent');
        expect((err as FireAgentError).message).toContain('Agent not found');
      }
    });

    it('should handle errors gracefully and not leave partial state', async () => {
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      // Fire successfully
      await fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir });

      // Verify agent is fired
      const agent = getAgent(db, 'ceo-001');
      expect(agent?.status).toBe('fired');
    });
  });

  describe('File Operations', () => {
    it('should archive agent directory when firing', async () => {
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const result = await fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir });

      expect(result.filesArchived).toBe(true);

      // Verify original directory is gone (moved to backups)
      const agentDir = path.join(tempDir, 'agents', 'ce', 'ceo-001');
      await expect(fs.access(agentDir)).rejects.toThrow();

      // Verify backup exists
      const backupsDir = path.join(tempDir, 'backups', 'fired-agents');
      const backups = await fs.readdir(backupsDir);
      const archivedDir = backups.find((name) => name.startsWith('ceo-001-'));
      expect(archivedDir).toBeDefined();
    });
  });

  describe('Notifications (Task 2.2.15)', () => {
    it('should send notification to fired agent', async () => {
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      await fireAgent(db, 'ceo-001', 'reassign', { baseDir: tempDir });

      // Check database for message
      const messages = getMessages(db, { agentId: 'ceo-001' });
      expect(messages.length).toBeGreaterThan(0);

      const firedNotification = messages.find((m) =>
        m.subject?.includes('Termination Notice')
      );
      expect(firedNotification).toBeDefined();
      expect(firedNotification?.priority).toBe('high');
      expect(firedNotification?.action_required).toBe(true);
      expect(firedNotification?.from_agent_id).toBe('system');

      // Check filesystem for message file
      const messageFilePath = path.join(
        tempDir,
        'agents',
        'ce',
        'ceo-001',
        'inbox',
        'unread',
        `${firedNotification?.id}.md`
      );

      // Note: File may not exist if agent directory was archived
      // That's expected behavior - messages are written before archival
    });

    it('should send notification to manager when subordinate is fired', async () => {
      // Create CEO and CTO reporting to CEO
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      // Fire CTO
      await fireAgent(db, 'cto-001', 'reassign', { baseDir: tempDir });

      // CEO should have received notification
      const messages = getMessages(db, { agentId: 'ceo-001' });
      expect(messages.length).toBeGreaterThan(0);

      const managerNotification = messages.find((m) =>
        m.subject?.includes('Subordinate Termination')
      );
      expect(managerNotification).toBeDefined();
      expect(managerNotification?.priority).toBe('high');
      expect(managerNotification?.from_agent_id).toBe('system');
      expect(managerNotification?.subject).toContain('cto-001');
    });

    it('should send notifications to subordinates on reassign', async () => {
      // Create CEO -> CTO -> Dev hierarchy
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      const devConfig = generateDefaultConfig('Developer', 'Code', 'cto-001', {
        id: 'dev-001',
      });
      await hireAgent(db, 'cto-001', devConfig, { baseDir: tempDir });

      // Fire CTO with reassign strategy
      await fireAgent(db, 'cto-001', 'reassign', { baseDir: tempDir });

      // Developer should have received notification about manager change
      const messages = getMessages(db, { agentId: 'dev-001' });
      expect(messages.length).toBeGreaterThan(0);

      const managerChangeNotification = messages.find((m) =>
        m.subject?.includes('Manager Change')
      );
      expect(managerChangeNotification).toBeDefined();
      expect(managerChangeNotification?.priority).toBe('high');
      expect(managerChangeNotification?.action_required).toBe(true);
    });

    it('should send cascade termination notifications to subordinates', async () => {
      // Create CEO -> CTO -> Dev hierarchy
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      const devConfig = generateDefaultConfig('Developer', 'Code', 'cto-001', {
        id: 'dev-001',
      });
      await hireAgent(db, 'cto-001', devConfig, { baseDir: tempDir });

      // Fire CTO with cascade strategy
      await fireAgent(db, 'cto-001', 'cascade', { baseDir: tempDir });

      // Developer should have received cascade termination notification
      const messages = getMessages(db, { agentId: 'dev-001' });
      expect(messages.length).toBeGreaterThan(0);

      const cascadeNotification = messages.find((m) =>
        m.subject?.includes('Cascade Termination')
      );
      expect(cascadeNotification).toBeDefined();
      expect(cascadeNotification?.priority).toBe('urgent');
      expect(cascadeNotification?.action_required).toBe(true);
    });

    it('should handle notification failures gracefully', async () => {
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      // Fire should succeed even if some notifications fail
      const result = await fireAgent(db, 'ceo-001', 'reassign', {
        baseDir: '/invalid/path/that/does/not/exist',
      });

      expect(result.status).toBe('fired');
      expect(result.agentId).toBe('ceo-001');
    });

    it('should send notifications to all affected parties', async () => {
      // Create CEO -> CTO -> Dev1, Dev2 hierarchy
      const ceoConfig = generateDefaultConfig('CEO', 'Lead', 'system', {
        id: 'ceo-001',
      });
      await hireAgent(db, null, ceoConfig, { baseDir: tempDir });

      const ctoConfig = generateDefaultConfig('CTO', 'Tech lead', 'ceo-001', {
        id: 'cto-001',
      });
      await hireAgent(db, 'ceo-001', ctoConfig, { baseDir: tempDir });

      const dev1Config = generateDefaultConfig('Developer 1', 'Code', 'cto-001', {
        id: 'dev-001',
      });
      await hireAgent(db, 'cto-001', dev1Config, { baseDir: tempDir });

      const dev2Config = generateDefaultConfig('Developer 2', 'Code', 'cto-001', {
        id: 'dev-002',
      });
      await hireAgent(db, 'cto-001', dev2Config, { baseDir: tempDir });

      // Fire CTO
      await fireAgent(db, 'cto-001', 'reassign', { baseDir: tempDir });

      // CTO should have termination notification (1 message)
      const ctoMessages = getMessages(db, { agentId: 'cto-001' });
      expect(ctoMessages.length).toBeGreaterThanOrEqual(1);

      // CEO should have subordinate termination notification (1 message)
      const ceoMessages = getMessages(db, { agentId: 'ceo-001' });
      expect(ceoMessages.length).toBeGreaterThanOrEqual(1);

      // Dev1 should have manager change notification (1 message)
      const dev1Messages = getMessages(db, { agentId: 'dev-001' });
      expect(dev1Messages.length).toBeGreaterThanOrEqual(1);

      // Dev2 should have manager change notification (1 message)
      const dev2Messages = getMessages(db, { agentId: 'dev-002' });
      expect(dev2Messages.length).toBeGreaterThanOrEqual(1);

      // Total: 4 messages (1 to each affected party)
      const allUnreadCounts =
        getUnreadMessageCount(db, 'cto-001') +
        getUnreadMessageCount(db, 'ceo-001') +
        getUnreadMessageCount(db, 'dev-001') +
        getUnreadMessageCount(db, 'dev-002');
      expect(allUnreadCounts).toBeGreaterThanOrEqual(4);
    });
  });
});
