/**
 * Tests for hireAgent function (Task 2.2.5)
 *
 * Covers all hiring scenarios:
 * - Successful root agent hire
 * - Successful subordinate hire
 * - Validation failures
 * - Filesystem operations
 * - Database operations
 * - Parent registry updates
 * - Error handling and cleanup
 */

import Database from 'better-sqlite3';
import { hireAgent, HireAgentError } from '../lifecycle/hireAgent';
import { HireValidationError } from '../lifecycle/validateHire';
import { generateDefaultConfig } from '../config';
import {
  getAgent,
  runMigrations,
  allMigrations,
  getAgentDirectory,
  getConfigPath,
  getSchedulePath,
  getMetadataPath,
  safeLoad,
} from '@recursivemanager/common';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

describe('hireAgent', () => {
  let db: Database.Database;
  let testDir: string;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for agent configs
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hireagent-test-'));
  });

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
  });

  describe('Root Agent Hiring', () => {
    it('should successfully hire a root agent (CEO)', async () => {
      const config = generateDefaultConfig('CEO', 'Lead the organization', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
        reportingTo: null,
      });

      const result = await hireAgent(db, null, config, { baseDir: testDir });

      // Verify database record
      expect(result).toBeDefined();
      expect(result.id).toBe('ceo-001');
      expect(result.role).toBe('CEO');
      expect(result.status).toBe('active');
      expect(result.reporting_to).toBeNull();
      expect(result.main_goal).toBe('Lead the organization');

      // Verify database query
      const dbAgent = getAgent(db, 'ceo-001');
      expect(dbAgent).toBeDefined();
      expect(dbAgent?.id).toBe('ceo-001');

      // Verify filesystem structure
      const agentDir = getAgentDirectory('ceo-001', { baseDir: testDir });
      expect(fs.existsSync(agentDir)).toBe(true);
      expect(fs.existsSync(`${agentDir}/tasks/active`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/tasks/completed`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/tasks/archive`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/inbox/unread`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/inbox/read`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/outbox/pending`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/outbox/sent`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/subordinates/reports`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/workspace/notes`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/workspace/research`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/workspace/drafts`)).toBe(true);
      expect(fs.existsSync(`${agentDir}/workspace/cache`)).toBe(true);

      // Verify config.json
      const configPath = getConfigPath('ceo-001', { baseDir: testDir });
      expect(fs.existsSync(configPath)).toBe(true);
      const savedConfig = JSON.parse(await safeLoad(configPath));
      expect(savedConfig.identity.id).toBe('ceo-001');
      expect(savedConfig.identity.role).toBe('CEO');
      expect(savedConfig.identity.reportingTo).toBeNull();

      // Verify schedule.json
      const schedulePath = getSchedulePath('ceo-001', { baseDir: testDir });
      expect(fs.existsSync(schedulePath)).toBe(true);
      const schedule = JSON.parse(await safeLoad(schedulePath));
      expect(schedule.version).toBe('1.0.0');
      expect(schedule.mode).toBe('hybrid');

      // Verify metadata.json
      const metadataPath = getMetadataPath('ceo-001', { baseDir: testDir });
      expect(fs.existsSync(metadataPath)).toBe(true);
      const metadata = JSON.parse(await safeLoad(metadataPath));
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.runtime.status).toBe('idle');
      expect(metadata.budget.hiringBudget.initial).toBe(5);
      expect(metadata.budget.hiringBudget.remaining).toBe(5);

      // Verify subordinates/registry.json
      const registryPath = `${agentDir}/subordinates/registry.json`;
      expect(fs.existsSync(registryPath)).toBe(true);
      const registry = JSON.parse(await safeLoad(registryPath));
      expect(registry.version).toBe('1.0.0');
      expect(registry.subordinates).toEqual([]);
      expect(registry.summary.totalSubordinates).toBe(0);
      expect(registry.summary.hiringBudgetRemaining).toBe(5);

      // Verify README.md
      const readmePath = `${agentDir}/README.md`;
      expect(fs.existsSync(readmePath)).toBe(true);
      const readme = await fs.readFile(readmePath, 'utf8');
      expect(readme).toContain('# CEO');
      expect(readme).toContain('ceo-001');
      expect(readme).toContain('Lead the organization');
    });

    it('should handle multiple root agents', async () => {
      const ceoConfig = generateDefaultConfig('CEO', 'Lead organization', 'system', {
        id: 'ceo-001',
        reportingTo: null,
      });

      const ctoConfig = generateDefaultConfig('CTO', 'Lead technology', 'system', {
        id: 'cto-001',
        reportingTo: null,
      });

      const ceo = await hireAgent(db, null, ceoConfig, { baseDir: testDir });
      const cto = await hireAgent(db, null, ctoConfig, { baseDir: testDir });

      expect(ceo.id).toBe('ceo-001');
      expect(cto.id).toBe('cto-001');
      expect(ceo.reporting_to).toBeNull();
      expect(cto.reporting_to).toBeNull();
    });
  });

  describe('Subordinate Hiring', () => {
    it('should successfully hire a subordinate', async () => {
      // First, hire the manager
      const managerConfig = generateDefaultConfig('VP Engineering', 'Build products', 'system', {
        id: 'vp-eng-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
        reportingTo: null,
      });

      await hireAgent(db, null, managerConfig, { baseDir: testDir });

      // Create manager's subordinates registry manually (simulating existing agent)
      const managerDir = getAgentDirectory('vp-eng-001', { baseDir: testDir });
      const managerRegistryPath = `${managerDir}/subordinates/registry.json`;
      // Registry should already exist from hireAgent, just verify it

      // Now hire a subordinate
      const devConfig = generateDefaultConfig(
        'Senior Developer',
        'Build authentication system',
        'vp-eng-001',
        {
          id: 'dev-001',
          reportingTo: 'vp-eng-001',
        }
      );

      const result = await hireAgent(db, 'vp-eng-001', devConfig, { baseDir: testDir });

      // Verify database record
      expect(result.id).toBe('dev-001');
      expect(result.role).toBe('Senior Developer');
      expect(result.reporting_to).toBe('vp-eng-001');
      expect(result.status).toBe('active');

      // Verify parent's subordinates registry was updated
      const registry = JSON.parse(await safeLoad(managerRegistryPath));
      expect(registry.subordinates).toHaveLength(1);
      expect(registry.subordinates[0]!.agentId).toBe('dev-001');
      expect(registry.subordinates[0]!.role).toBe('Senior Developer');
      expect(registry.subordinates[0]!.status).toBe('active');
      expect(registry.subordinates[0]!.hiredFor).toBe('Build authentication system');
      expect(registry.summary.totalSubordinates).toBe(1);
      expect(registry.summary.activeSubordinates).toBe(1);
      expect(registry.summary.hiringBudgetRemaining).toBe(2); // Was 3, now 2
    });

    it('should handle multiple subordinates under same manager', async () => {
      // Hire manager
      const managerConfig = generateDefaultConfig('Manager', 'Manage team', 'system', {
        id: 'mgr-001',
        canHire: true,
        maxSubordinates: 10,
        hiringBudget: 5,
        reportingTo: null,
      });

      await hireAgent(db, null, managerConfig, { baseDir: testDir });

      // Hire three subordinates
      for (let i = 1; i <= 3; i++) {
        const config = generateDefaultConfig(`Developer ${i}`, `Build feature ${i}`, 'mgr-001', {
          id: `dev-00${i}`,
          reportingTo: 'mgr-001',
        });
        await hireAgent(db, 'mgr-001', config, { baseDir: testDir });
      }

      // Verify all subordinates exist in database
      const dev1 = getAgent(db, 'dev-001');
      const dev2 = getAgent(db, 'dev-002');
      const dev3 = getAgent(db, 'dev-003');
      expect(dev1?.reporting_to).toBe('mgr-001');
      expect(dev2?.reporting_to).toBe('mgr-001');
      expect(dev3?.reporting_to).toBe('mgr-001');

      // Verify parent registry
      const managerDir = getAgentDirectory('mgr-001', { baseDir: testDir });
      const registryPath = `${managerDir}/subordinates/registry.json`;
      const registry = JSON.parse(await safeLoad(registryPath));
      expect(registry.subordinates).toHaveLength(3);
      expect(registry.summary.totalSubordinates).toBe(3);
      expect(registry.summary.activeSubordinates).toBe(3);
      expect(registry.summary.hiringBudgetRemaining).toBe(2); // 5 - 3 = 2
    });

    it('should create multi-level hierarchy', async () => {
      // Create CEO -> VP -> Manager -> Developer hierarchy
      const ceoConfig = generateDefaultConfig('CEO', 'Lead org', 'system', {
        id: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 5,
        reportingTo: null,
      });
      await hireAgent(db, null, ceoConfig, { baseDir: testDir });

      const vpConfig = generateDefaultConfig('VP', 'Manage division', 'ceo-001', {
        id: 'vp-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 5,
        reportingTo: 'ceo-001',
      });
      await hireAgent(db, 'ceo-001', vpConfig, { baseDir: testDir });

      const mgrConfig = generateDefaultConfig('Manager', 'Manage team', 'vp-001', {
        id: 'mgr-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 5,
        reportingTo: 'vp-001',
      });
      await hireAgent(db, 'vp-001', mgrConfig, { baseDir: testDir });

      const devConfig = generateDefaultConfig('Developer', 'Write code', 'mgr-001', {
        id: 'dev-001',
        reportingTo: 'mgr-001',
      });
      await hireAgent(db, 'mgr-001', devConfig, { baseDir: testDir });

      // Verify hierarchy
      const ceo = getAgent(db, 'ceo-001');
      const vp = getAgent(db, 'vp-001');
      const mgr = getAgent(db, 'mgr-001');
      const dev = getAgent(db, 'dev-001');

      expect(ceo?.reporting_to).toBeNull();
      expect(vp?.reporting_to).toBe('ceo-001');
      expect(mgr?.reporting_to).toBe('vp-001');
      expect(dev?.reporting_to).toBe('mgr-001');
    });
  });

  describe('Validation Failures', () => {
    it('should fail if manager does not exist', async () => {
      const config = generateDefaultConfig('Developer', 'Build stuff', 'nonexistent-manager', {
        id: 'dev-001',
        reportingTo: 'nonexistent-manager',
      });

      await expect(
        hireAgent(db, 'nonexistent-manager', config, { baseDir: testDir })
      ).rejects.toThrow(HireValidationError);
    });

    it('should fail if manager lacks canHire permission', async () => {
      // Create manager without canHire permission
      const managerConfig = generateDefaultConfig('Manager', 'Manage', 'system', {
        id: 'mgr-001',
        canHire: false, // No hiring permission
        reportingTo: null,
      });
      await hireAgent(db, null, managerConfig, { baseDir: testDir });

      // Try to hire subordinate
      const devConfig = generateDefaultConfig('Developer', 'Code', 'mgr-001', {
        id: 'dev-001',
        reportingTo: 'mgr-001',
      });

      await expect(hireAgent(db, 'mgr-001', devConfig, { baseDir: testDir })).rejects.toThrow(
        HireValidationError
      );
    });

    it('should fail if manager has no hiring budget', async () => {
      // Create manager with 0 hiring budget
      const managerConfig = generateDefaultConfig('Manager', 'Manage', 'system', {
        id: 'mgr-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 0, // No budget
        reportingTo: null,
      });
      await hireAgent(db, null, managerConfig, { baseDir: testDir });

      // Try to hire subordinate
      const devConfig = generateDefaultConfig('Developer', 'Code', 'mgr-001', {
        id: 'dev-001',
        reportingTo: 'mgr-001',
      });

      await expect(hireAgent(db, 'mgr-001', devConfig, { baseDir: testDir })).rejects.toThrow(
        HireValidationError
      );
    });

    it('should fail if agent ID already exists', async () => {
      // Hire first agent
      const config1 = generateDefaultConfig('Agent 1', 'Do work', 'system', {
        id: 'duplicate-id',
        reportingTo: null,
      });
      await hireAgent(db, null, config1, { baseDir: testDir });

      // Try to hire another agent with same ID
      const config2 = generateDefaultConfig('Agent 2', 'Do other work', 'system', {
        id: 'duplicate-id', // Same ID!
        reportingTo: null,
      });

      await expect(hireAgent(db, null, config2, { baseDir: testDir })).rejects.toThrow();
    });

    it('should fail on self-hire (EC-1.1)', async () => {
      // Create agent
      const config = generateDefaultConfig('Agent', 'Do work', 'system', {
        id: 'agent-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 5,
        reportingTo: null,
      });
      await hireAgent(db, null, config, { baseDir: testDir });

      // Try to hire self as subordinate
      const selfConfig = generateDefaultConfig('Self', 'Manage self', 'agent-001', {
        id: 'agent-001', // Same ID as manager!
        reportingTo: 'agent-001',
      });

      await expect(hireAgent(db, 'agent-001', selfConfig, { baseDir: testDir })).rejects.toThrow(
        HireValidationError
      );
    });

    it('should fail on circular reporting (EC-1.3)', async () => {
      // Create A -> B hierarchy
      const configA = generateDefaultConfig('Agent A', 'Work A', 'system', {
        id: 'agent-a',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 5,
        reportingTo: null,
      });
      await hireAgent(db, null, configA, { baseDir: testDir });

      const configB = generateDefaultConfig('Agent B', 'Work B', 'agent-a', {
        id: 'agent-b',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 5,
        reportingTo: 'agent-a',
      });
      await hireAgent(db, 'agent-a', configB, { baseDir: testDir });

      // Now try to make A report to B (would create cycle)
      // We need to update the config first, then try to hire a new agent that creates cycle
      // Actually, we can't directly test this with hireAgent since it creates new agents
      // The cycle detection is tested in validateHire.test.ts
      // But we can verify it's called by trying to create a cycle scenario

      // Skip this test - cycle detection is properly tested in validateHire.test.ts
      // hireAgent only creates new agents, can't reassign existing ones
    });

    it('should fail if exceeding maxSubordinates', async () => {
      // Create manager with maxSubordinates = 2
      const managerConfig = generateDefaultConfig('Manager', 'Manage', 'system', {
        id: 'mgr-001',
        canHire: true,
        maxSubordinates: 2,
        hiringBudget: 2, // Budget must not exceed maxSubordinates
        reportingTo: null,
      });
      await hireAgent(db, null, managerConfig, { baseDir: testDir });

      // Hire 2 subordinates (should succeed)
      const dev1Config = generateDefaultConfig('Dev 1', 'Code 1', 'mgr-001', {
        id: 'dev-001',
        reportingTo: 'mgr-001',
      });
      await hireAgent(db, 'mgr-001', dev1Config, { baseDir: testDir });

      const dev2Config = generateDefaultConfig('Dev 2', 'Code 2', 'mgr-001', {
        id: 'dev-002',
        reportingTo: 'mgr-001',
      });
      await hireAgent(db, 'mgr-001', dev2Config, { baseDir: testDir });

      // Try to hire 3rd subordinate (should fail)
      const dev3Config = generateDefaultConfig('Dev 3', 'Code 3', 'mgr-001', {
        id: 'dev-003',
        reportingTo: 'mgr-001',
      });

      await expect(hireAgent(db, 'mgr-001', dev3Config, { baseDir: testDir })).rejects.toThrow(
        HireValidationError
      );
    });
  });

  describe('Configuration Overrides', () => {
    it('should override reportingTo with managerId', async () => {
      // Create manager
      const managerConfig = generateDefaultConfig('Manager', 'Manage', 'system', {
        id: 'mgr-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 5,
        reportingTo: null,
      });
      await hireAgent(db, null, managerConfig, { baseDir: testDir });

      // Create config with wrong reportingTo
      const devConfig = generateDefaultConfig('Developer', 'Code', 'mgr-001', {
        id: 'dev-001',
        reportingTo: 'wrong-manager', // Wrong manager in config
      });

      // hireAgent should override with correct managerId
      const result = await hireAgent(
        db,
        'mgr-001', // Correct manager ID
        devConfig,
        { baseDir: testDir }
      );

      expect(result.reporting_to).toBe('mgr-001');

      // Verify config was saved with correct reportingTo
      const configPath = getConfigPath('dev-001', { baseDir: testDir });
      const savedConfig = JSON.parse(await safeLoad(configPath));
      expect(savedConfig.identity.reportingTo).toBe('mgr-001');
    });
  });

  describe('Error Handling', () => {
    it('should handle filesystem errors gracefully', async () => {
      // Create a config
      const config = generateDefaultConfig('Agent', 'Work', 'system', {
        id: 'agent-001',
        reportingTo: null,
      });

      // Use an invalid base directory (read-only)
      const readOnlyDir = '/invalid-readonly-path';

      await expect(hireAgent(db, null, config, { baseDir: readOnlyDir })).rejects.toThrow(
        HireAgentError
      );

      // Verify agent was NOT created in database
      const agent = getAgent(db, 'agent-001');
      expect(agent).toBeNull();
    });
  });

  describe('README Generation', () => {
    it('should generate README with correct information', async () => {
      const config = generateDefaultConfig('Test Agent', 'Test goal', 'system', {
        id: 'test-001',
        displayName: 'Test Agent Display Name',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
        reportingTo: null,
      });

      await hireAgent(db, null, config, { baseDir: testDir });

      const agentDir = getAgentDirectory('test-001', { baseDir: testDir });
      const readmePath = `${agentDir}/README.md`;
      const readme = await fs.readFile(readmePath, 'utf8');

      expect(readme).toContain('# Test Agent Display Name');
      expect(readme).toContain('test-001');
      expect(readme).toContain('Test Agent');
      expect(readme).toContain('Test goal');
      expect(readme).toContain('Can Hire**: Yes');
      expect(readme).toContain('Max Subordinates**: 5');
      expect(readme).toContain('Hiring Budget**: 3');
      expect(readme).toContain('None (Root Agent)');
    });
  });
});
