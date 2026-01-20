/**
 * Tests for validateHire function (Task 2.2.1)
 *
 * Covers all validation scenarios:
 * - Permission checks
 * - Budget validation
 * - Rate limiting
 * - Cycle detection
 * - Self-hire prevention
 * - Edge cases from EC-1.1, EC-1.3, EC-1.4
 */

import Database from 'better-sqlite3';
import {
  validateHire,
  validateHireStrict,
  detectCycle,
  checkHiringBudget,
  checkRateLimit,
  HireValidationError,
} from '../lifecycle/validateHire';
import {
  createAgent,
  auditLog,
  AuditAction,
  runMigrations,
  allMigrations,
} from '@recursive-manager/common';
import { saveAgentConfig, generateDefaultConfig } from '../config';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

describe('validateHire', () => {
  let db: Database.Database;
  let testDir: string;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations to create schema
    runMigrations(db, allMigrations);

    // Create temporary directory for agent configs
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validatehire-test-'));
  });

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
  });

  describe('detectCycle', () => {
    it('should detect self-hire (EC-1.1)', () => {
      const result = detectCycle(db, 'agent-001', 'agent-001');
      expect(result).toBe(true);
    });

    it('should detect direct circular reporting', () => {
      // Create two agents: A reports to B
      createAgent(db, {
        id: 'agent-a',
        role: 'Manager A',
        displayName: 'Alice',
        createdBy: null,
        reportingTo: 'agent-b',
        mainGoal: 'Manage',
        configPath: '/test/agent-a/config.json',
      });

      createAgent(db, {
        id: 'agent-b',
        role: 'Manager B',
        displayName: 'Bob',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: '/test/agent-b/config.json',
      });

      // Now try to make B report to A (would create cycle)
      const result = detectCycle(db, 'agent-b', 'agent-a');
      expect(result).toBe(true);
    });

    it('should detect indirect circular reporting (EC-1.3)', () => {
      // Create chain: A -> B -> C
      createAgent(db, {
        id: 'agent-c',
        role: 'CEO',
        displayName: 'Charlie',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead',
        configPath: '/test/agent-c/config.json',
      });

      createAgent(db, {
        id: 'agent-b',
        role: 'CTO',
        displayName: 'Bob',
        createdBy: null,
        reportingTo: 'agent-c',
        mainGoal: 'Manage Tech',
        configPath: '/test/agent-b/config.json',
      });

      createAgent(db, {
        id: 'agent-a',
        role: 'Engineer',
        displayName: 'Alice',
        createdBy: null,
        reportingTo: 'agent-b',
        mainGoal: 'Code',
        configPath: '/test/agent-a/config.json',
      });

      // Try to make C report to A (would create cycle: A -> B -> C -> A)
      const result = detectCycle(db, 'agent-c', 'agent-a');
      expect(result).toBe(true);
    });

    it('should allow valid hierarchical reporting', () => {
      // Create CEO
      createAgent(db, {
        id: 'ceo',
        role: 'CEO',
        displayName: 'CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead',
        configPath: '/test/ceo/config.json',
      });

      // CEO hiring CTO is valid (no cycle)
      const result = detectCycle(db, 'cto', 'ceo');
      expect(result).toBe(false);
    });

    it('should handle non-existent agents gracefully', () => {
      const result = detectCycle(db, 'new-agent', 'nonexistent-manager');
      expect(result).toBe(false); // No cycle if manager doesn't exist
    });
  });

  describe('checkHiringBudget', () => {
    it('should pass when manager has budget and capacity', () => {
      // Create manager
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      // Create config with budget
      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = true;
      config.permissions.maxSubordinates = 5;
      config.permissions.hiringBudget = 3;
      saveAgentConfig('manager', config);

      const errors = checkHiringBudget(db, 'manager', config);
      expect(errors).toEqual([]);
    });

    it('should fail when maxSubordinates is reached', () => {
      // Create manager
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      // Create config with low limit
      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = true;
      config.permissions.maxSubordinates = 2;
      config.permissions.hiringBudget = 5;
      saveAgentConfig('manager', config);

      // Create 2 subordinates
      createAgent(db, {
        id: 'sub-1',
        role: 'Sub 1',
        displayName: 'Sub 1',
        createdBy: 'manager',
        reportingTo: 'manager',
        mainGoal: 'Work',
        configPath: '/test/sub-1/config.json',
      });

      createAgent(db, {
        id: 'sub-2',
        role: 'Sub 2',
        displayName: 'Sub 2',
        createdBy: 'manager',
        reportingTo: 'manager',
        mainGoal: 'Work',
        configPath: '/test/sub-2/config.json',
      });

      const errors = checkHiringBudget(db, 'manager', config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.code).toBe('MAX_SUBORDINATES_EXCEEDED');
      expect(errors[0]!.context?.currentCount).toBe(2);
    });

    it('should fail when hiring budget is exceeded', () => {
      // Create manager
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      // Create config with low budget
      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = true;
      config.permissions.maxSubordinates = 5;
      config.permissions.hiringBudget = 1;
      saveAgentConfig('manager', config);

      // Create 1 subordinate (exhausts budget)
      createAgent(db, {
        id: 'sub-1',
        role: 'Sub 1',
        displayName: 'Sub 1',
        createdBy: 'manager',
        reportingTo: 'manager',
        mainGoal: 'Work',
        configPath: '/test/sub-1/config.json',
      });

      const errors = checkHiringBudget(db, 'manager', config);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.code).toBe('HIRING_BUDGET_EXCEEDED');
    });
  });

  describe('checkRateLimit', () => {
    it('should pass when no recent hires', () => {
      // Create manager
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: '/test/manager/config.json',
      });

      const errors = checkRateLimit(db, 'manager');
      expect(errors).toEqual([]);
    });

    it('should pass when hires are within limit', () => {
      // Create manager
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: '/test/manager/config.json',
      });

      // Log 4 hires (below limit of 5)
      for (let i = 0; i < 4; i++) {
        auditLog(db, {
          agentId: 'manager',
          action: AuditAction.HIRE,
          targetAgentId: `sub-${i}`,
          success: true,
          details: `Hired sub-${i}`,
        });
      }

      const errors = checkRateLimit(db, 'manager');
      expect(errors).toEqual([]);
    });

    it('should fail when rate limit is exceeded (EC-1.4)', () => {
      // Create manager
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: '/test/manager/config.json',
      });

      // Log 5 hires (at limit)
      for (let i = 0; i < 5; i++) {
        auditLog(db, {
          agentId: 'manager',
          action: AuditAction.HIRE,
          targetAgentId: `sub-${i}`,
          success: true,
          details: `Hired sub-${i}`,
        });
      }

      const errors = checkRateLimit(db, 'manager');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(errors[0]!.context?.recentHires).toBe(5);
    });

    it('should only count successful hires', () => {
      // Create manager
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: '/test/manager/config.json',
      });

      // Log 3 successful and 2 failed hires
      for (let i = 0; i < 3; i++) {
        auditLog(db, {
          agentId: 'manager',
          action: AuditAction.HIRE,
          targetAgentId: `sub-${i}`,
          success: true,
          details: `Hired sub-${i}`,
        });
      }

      for (let i = 3; i < 5; i++) {
        auditLog(db, {
          agentId: 'manager',
          action: AuditAction.HIRE,
          targetAgentId: `sub-${i}`,
          success: false,
          details: `Failed to hire sub-${i}`,
        });
      }

      const errors = checkRateLimit(db, 'manager');
      expect(errors).toEqual([]); // Only 3 successful hires
    });
  });

  describe('validateHire', () => {
    it('should pass for valid hire scenario', async () => {
      // Create manager with proper config
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = true;
      config.permissions.maxSubordinates = 5;
      config.permissions.hiringBudget = 3;
      await saveAgentConfig('manager', config);

      const result = await validateHire(db, 'manager', 'new-hire');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should fail when manager does not exist', async () => {
      const result = await validateHire(db, 'nonexistent', 'new-hire');
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('MANAGER_NOT_FOUND');
    });

    it('should fail when manager is not active', async () => {
      // Create paused manager
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      // Pause the agent
      const updateAgent = db.prepare('UPDATE agents SET status = ? WHERE id = ?');
      updateAgent.run('paused', 'manager');

      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = true;
      await saveAgentConfig('manager', config);

      const result = await validateHire(db, 'manager', 'new-hire');
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('MANAGER_NOT_ACTIVE');
    });

    it('should fail when manager lacks canHire permission', async () => {
      // Create manager without hire permission
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = false;
      config.permissions.maxSubordinates = 0;
      config.permissions.hiringBudget = 0;
      await saveAgentConfig('manager', config);

      const result = await validateHire(db, 'manager', 'new-hire');
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('NO_HIRE_PERMISSION');
    });

    it('should fail when new agent ID already exists', async () => {
      // Create manager
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = true;
      config.permissions.maxSubordinates = 5;
      config.permissions.hiringBudget = 3;
      await saveAgentConfig('manager', config);

      // Create existing agent
      createAgent(db, {
        id: 'existing',
        role: 'Existing',
        displayName: 'Existing Agent',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Work',
        configPath: '/test/existing/config.json',
      });

      const result = await validateHire(db, 'manager', 'existing');
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('AGENT_ALREADY_EXISTS');
    });

    it('should fail on self-hire (EC-1.1)', async () => {
      // Create manager
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = true;
      config.permissions.maxSubordinates = 5;
      config.permissions.hiringBudget = 3;
      await saveAgentConfig('manager', config);

      const result = await validateHire(db, 'manager', 'manager');
      expect(result.valid).toBe(false);
      const selfHireError = result.errors.find((e: any) => e.code === 'SELF_HIRE_FORBIDDEN');
      expect(selfHireError).toBeDefined();
    });

    it('should fail on circular reporting (EC-1.3)', async () => {
      // Create chain: manager -> sub
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      createAgent(db, {
        id: 'sub',
        role: 'Subordinate',
        displayName: 'Sub',
        createdBy: 'manager',
        reportingTo: 'manager',
        mainGoal: 'Work',
        configPath: path.join(testDir, 'sub', 'config.json'),
      });

      const managerConfig = generateDefaultConfig('Manager', 'Manage team', 'system');
      managerConfig.permissions.canHire = true;
      managerConfig.permissions.maxSubordinates = 5;
      managerConfig.permissions.hiringBudget = 3;
      await saveAgentConfig('manager', managerConfig);

      const subConfig = generateDefaultConfig('Subordinate', 'Work', 'manager');
      subConfig.permissions.canHire = true;
      subConfig.permissions.maxSubordinates = 2;
      subConfig.permissions.hiringBudget = 1;
      await saveAgentConfig('sub', subConfig);

      // Try to make manager report to sub (would create cycle)
      const result = await validateHire(db, 'sub', 'manager');
      expect(result.valid).toBe(false);
      const cycleError = result.errors.find((e: any) => e.code === 'CIRCULAR_REPORTING_DETECTED');
      expect(cycleError).toBeDefined();
    });

    it('should include all validation errors when multiple issues exist', async () => {
      // Create manager that will hit multiple validation errors
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = true;
      config.permissions.maxSubordinates = 1;
      config.permissions.hiringBudget = 1;
      await saveAgentConfig('manager', config);

      // Create existing subordinate (exhausts both limits)
      createAgent(db, {
        id: 'sub-1',
        role: 'Sub 1',
        displayName: 'Sub 1',
        createdBy: 'manager',
        reportingTo: 'manager',
        mainGoal: 'Work',
        configPath: '/test/sub-1/config.json',
      });

      // Try to hire another (will fail budget AND try to hire existing agent with same ID)
      const result = await validateHire(db, 'manager', 'sub-1');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);

      // Should have AGENT_ALREADY_EXISTS
      expect(result.errors.some((e: any) => e.code === 'AGENT_ALREADY_EXISTS')).toBe(true);

      // Should have budget errors
      expect(
        result.errors.some(
          (e: any) => e.code === 'MAX_SUBORDINATES_EXCEEDED' || e.code === 'HIRING_BUDGET_EXCEEDED'
        )
      ).toBe(true);
    });

    it('should include warnings for configuration inconsistencies', async () => {
      // Create manager with inconsistent config
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = true;
      config.permissions.maxSubordinates = 0; // Inconsistent!
      config.permissions.hiringBudget = 0;
      await saveAgentConfig('manager', config);

      const result = await validateHire(db, 'manager', 'new-hire');
      expect(result.valid).toBe(false); // Will fail because maxSubordinates = 0
      expect(result.warnings?.length).toBeGreaterThan(0);
      expect(result.warnings?.some((w: any) => w.code === 'INCONSISTENT_PERMISSIONS')).toBe(true);
    });
  });

  describe('validateHireStrict', () => {
    it('should throw HireValidationError on validation failure', () => {
      // Create manager without permission
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = false;
      saveAgentConfig('manager', config);

      expect(() => {
        validateHireStrict(db, 'manager', 'new-hire');
      }).toThrow(HireValidationError);
    });

    it('should not throw on successful validation', () => {
      // Create manager with proper config
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = true;
      config.permissions.maxSubordinates = 5;
      config.permissions.hiringBudget = 3;
      saveAgentConfig('manager', config);

      expect(() => {
        validateHireStrict(db, 'manager', 'new-hire');
      }).not.toThrow();
    });

    it('should include formatted error messages in exception', () => {
      createAgent(db, {
        id: 'manager',
        role: 'Manager',
        displayName: 'Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Manage',
        configPath: path.join(testDir, 'manager', 'config.json'),
      });

      const config = generateDefaultConfig('Manager', 'Manage team', 'system');
      config.permissions.canHire = false;
      saveAgentConfig('manager', config);

      try {
        validateHireStrict(db, 'manager', 'new-hire');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(HireValidationError);
        const validationError = error as HireValidationError;
        expect(validationError.getFormattedErrors()).toContain('NO_HIRE_PERMISSION');
      }
    });
  });

  describe('HireValidationError', () => {
    it('should format errors with context', () => {
      const error = new HireValidationError([
        {
          code: 'TEST_ERROR',
          message: 'Test error message',
          context: { key: 'value' },
        },
      ]);

      const formatted = error.getFormattedErrors();
      expect(formatted).toContain('TEST_ERROR');
      expect(formatted).toContain('Test error message');
      expect(formatted).toContain('Context:');
    });

    it('should include warnings in formatted output', () => {
      const error = new HireValidationError(
        [
          {
            code: 'ERROR',
            message: 'Error message',
          },
        ],
        [
          {
            code: 'WARNING',
            message: 'Warning message',
          },
        ]
      );

      const formatted = error.getFormattedErrors();
      expect(formatted).toContain('Warnings:');
      expect(formatted).toContain('WARNING');
      expect(formatted).toContain('Warning message');
    });
  });
});
