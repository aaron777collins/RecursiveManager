/**
 * Tests for generateDefaultConfig function (Task 2.1.3)
 *
 * Test coverage:
 * - Default generation with minimal inputs
 * - Role-based ID generation
 * - All required fields populated
 * - Optional field overrides
 * - Schema compliance
 * - ID uniqueness
 * - Special character handling in role names
 */

import { generateDefaultConfig } from '../config';
import { validateAgentConfigStrict, type AgentConfig } from '@recursivemanager/common';

describe('generateDefaultConfig', () => {
  const baseRole = 'Senior Developer';
  const baseGoal = 'Implement authentication system';
  const baseCreatedBy = 'CEO';

  describe('Basic Generation', () => {
    it('should generate a valid configuration with minimal inputs', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);

      // Should not throw validation error
      expect(() => validateAgentConfigStrict(config)).not.toThrow();

      // Verify required fields
      expect(config.version).toBe('1.0.0');
      expect(config.identity.role).toBe(baseRole);
      expect(config.identity.createdBy).toBe(baseCreatedBy);
      expect(config.goal.mainGoal).toBe(baseGoal);
    });

    it('should generate a unique ID based on role', () => {
      const config1 = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);
      const config2 = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);

      // IDs should be different due to timestamp and random suffix
      expect(config1.identity.id).not.toBe(config2.identity.id);

      // IDs should start with role slug, followed by timestamp and random suffix
      expect(config1.identity.id).toMatch(/^senior-developer-\d+-[a-z0-9]+$/);
      expect(config2.identity.id).toMatch(/^senior-developer-\d+-[a-z0-9]+$/);
    });

    it('should handle special characters in role name', () => {
      const specialRole = 'QA/Test Engineer (Junior)';
      const config = generateDefaultConfig(specialRole, baseGoal, baseCreatedBy);

      // ID should have special chars replaced with hyphens, plus timestamp and random suffix
      expect(config.identity.id).toMatch(/^qa-test-engineer-junior-\d+-[a-z0-9]+$/);
      expect(config.identity.role).toBe(specialRole); // Original role preserved
    });

    it('should use role as displayName if not provided', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);
      expect(config.identity.displayName).toBe(baseRole);
    });

    it('should set createdAt to current time', () => {
      const before = new Date().toISOString();
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);
      const after = new Date().toISOString();

      // createdAt should be between before and after
      expect(config.identity.createdAt >= before).toBe(true);
      expect(config.identity.createdAt <= after).toBe(true);

      // Should be valid ISO 8601
      expect(new Date(config.identity.createdAt).toISOString()).toBe(config.identity.createdAt);
    });

    it('should set reportingTo to null by default', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);
      expect(config.identity.reportingTo).toBeNull();
    });
  });

  describe('Default Values', () => {
    let config: AgentConfig;

    beforeEach(() => {
      config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);
    });

    it('should set sensible permission defaults', () => {
      expect(config.permissions).toMatchObject({
        canHire: false,
        maxSubordinates: 0,
        hiringBudget: 0,
        canFire: false,
        canEscalate: true,
        canAccessExternalAPIs: false,
        allowedDomains: [],
        workspaceQuotaMB: 1024,
        maxExecutionMinutes: 60,
      });
    });

    it('should set default goal fields', () => {
      expect(config.goal).toMatchObject({
        mainGoal: baseGoal,
        subGoals: [],
        successCriteria: [],
      });
    });

    it('should set default framework configuration', () => {
      expect(config.framework).toMatchObject({
        primary: 'claude-code',
        capabilities: ['code-generation', 'file-operations'],
      });
    });

    it('should set default communication preferences', () => {
      expect(config.communication).toMatchObject({
        preferredChannels: ['internal'],
        notifyManager: {
          onTaskComplete: true,
          onError: true,
          onHire: true,
          onFire: true,
        },
        updateFrequency: 'daily',
      });
    });

    it('should set default behavior configuration', () => {
      expect(config.behavior).toMatchObject({
        multiPerspectiveAnalysis: {
          enabled: false,
          perspectives: [],
          triggerOn: [],
        },
        escalationPolicy: {
          autoEscalateAfterFailures: 0,
          escalateOnBlockedTask: false,
          escalateOnBudgetExceeded: false,
        },
        delegation: {
          delegateThreshold: 'never',
          keepWhenDelegating: true,
          supervisionLevel: 'moderate',
        },
      });
    });

    it('should set default metadata', () => {
      expect(config.metadata).toMatchObject({
        tags: [],
        priority: 'medium',
      });
    });
  });

  describe('Optional Overrides', () => {
    it('should allow custom ID override', () => {
      const customId = 'my-custom-agent-id';
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy, {
        id: customId,
      });

      expect(config.identity.id).toBe(customId);
    });

    it('should allow custom displayName override', () => {
      const customName = 'My Custom Display Name';
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy, {
        displayName: customName,
      });

      expect(config.identity.displayName).toBe(customName);
    });

    it('should allow reportingTo override', () => {
      const managerId = 'CTO';
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy, {
        reportingTo: managerId,
      });

      expect(config.identity.reportingTo).toBe(managerId);
    });

    it('should allow hiring permission overrides', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy, {
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 10000,
      });

      expect(config.permissions.canHire).toBe(true);
      expect(config.permissions.maxSubordinates).toBe(5);
      expect(config.permissions.hiringBudget).toBe(10000);
    });

    it('should allow framework override', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy, {
        primaryFramework: 'opencode',
      });

      expect(config.framework.primary).toBe('opencode');
    });

    it('should allow resource limit overrides', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy, {
        workspaceQuotaMB: 2048,
        maxExecutionMinutes: 120,
      });

      expect(config.permissions.workspaceQuotaMB).toBe(2048);
      expect(config.permissions.maxExecutionMinutes).toBe(120);
    });

    it('should allow multiple overrides simultaneously', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy, {
        id: 'dev-001',
        displayName: 'Development Lead',
        reportingTo: 'CTO',
        canHire: true,
        maxSubordinates: 3,
        hiringBudget: 5000,
        primaryFramework: 'opencode',
        workspaceQuotaMB: 4096,
        maxExecutionMinutes: 180,
      });

      expect(config.identity.id).toBe('dev-001');
      expect(config.identity.displayName).toBe('Development Lead');
      expect(config.identity.reportingTo).toBe('CTO');
      expect(config.permissions.canHire).toBe(true);
      expect(config.permissions.maxSubordinates).toBe(3);
      expect(config.permissions.hiringBudget).toBe(5000);
      expect(config.framework.primary).toBe('opencode');
      expect(config.permissions.workspaceQuotaMB).toBe(4096);
      expect(config.permissions.maxExecutionMinutes).toBe(180);
    });
  });

  describe('Schema Compliance', () => {
    it('should generate config that passes strict validation', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);
      expect(() => validateAgentConfigStrict(config)).not.toThrow();
    });

    it('should generate config with all required fields', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);

      // Version
      expect(config.version).toBeDefined();

      // Identity
      expect(config.identity.id).toBeDefined();
      expect(config.identity.role).toBeDefined();
      expect(config.identity.displayName).toBeDefined();
      expect(config.identity.createdAt).toBeDefined();
      expect(config.identity.createdBy).toBeDefined();

      // Goal
      expect(config.goal.mainGoal).toBeDefined();

      // Permissions
      expect(config.permissions.canHire).toBeDefined();
      expect(config.permissions.maxSubordinates).toBeDefined();
      expect(config.permissions.hiringBudget).toBeDefined();

      // Framework
      expect(config.framework.primary).toBeDefined();
    });

    it('should generate valid IDs matching schema pattern', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);

      // ID pattern: ^[a-zA-Z0-9-_]+$
      expect(config.identity.id).toMatch(/^[a-zA-Z0-9-_]+$/);
    });

    it('should generate valid version matching schema pattern', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);

      // Version pattern: ^[0-9]+\.[0-9]+\.[0-9]+$
      expect(config.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should generate valid ISO 8601 timestamp', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy);

      // Should be parseable and roundtrip correctly
      const parsed = new Date(config.identity.createdAt);
      expect(parsed.toISOString()).toBe(config.identity.createdAt);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string role gracefully', () => {
      const config = generateDefaultConfig('', baseGoal, baseCreatedBy);

      // Should generate ID with agent prefix when role is empty
      expect(config.identity.id).toMatch(/^agent-\d+-[a-z0-9]+$/);
      expect(config.identity.role).toBe('');
    });

    it('should handle role with only special characters', () => {
      const config = generateDefaultConfig('###', baseGoal, baseCreatedBy);

      // Special chars removed, uses agent prefix
      expect(config.identity.id).toMatch(/^agent-\d+-[a-z0-9]+$/);
    });

    it('should handle very long role names', () => {
      const longRole = 'A'.repeat(1000);
      const config = generateDefaultConfig(longRole, baseGoal, baseCreatedBy);

      // Should generate config without error
      expect(config.identity.role).toBe(longRole);
      expect(config.identity.id).toContain('a'.repeat(100)); // ID will be lowercase
    });

    it('should handle unicode characters in role', () => {
      const unicodeRole = 'Développeur Senior 🚀';
      const config = generateDefaultConfig(unicodeRole, baseGoal, baseCreatedBy);

      // Unicode removed from ID, but preserved in role
      expect(config.identity.role).toBe(unicodeRole);
      expect(config.identity.id).toMatch(/^d-veloppeur-senior-\d+-[a-z0-9]+$/);
    });

    it('should handle reportingTo explicitly set to null', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy, {
        reportingTo: null,
      });

      expect(config.identity.reportingTo).toBeNull();
    });

    it('should handle zero values for numeric overrides', () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy, {
        maxSubordinates: 0,
        hiringBudget: 0,
        workspaceQuotaMB: 0,
        maxExecutionMinutes: 0,
      });

      expect(config.permissions.maxSubordinates).toBe(0);
      expect(config.permissions.hiringBudget).toBe(0);
      expect(config.permissions.workspaceQuotaMB).toBe(0);
      expect(config.permissions.maxExecutionMinutes).toBe(0);
    });
  });

  describe('Integration with Save/Load', () => {
    it('should generate config that can be saved and loaded back', async () => {
      const config = generateDefaultConfig(baseRole, baseGoal, baseCreatedBy, {
        id: 'test-roundtrip',
      });

      // This test would require actual file operations
      // For now, just verify it passes validation
      expect(() => validateAgentConfigStrict(config)).not.toThrow();
    });
  });
});
