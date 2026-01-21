/**
 * Tests for mergeConfigs function (Task 2.1.4)
 *
 * These tests verify that configuration merging works correctly with proper
 * precedence rules, deep merging, and handling of special cases.
 */

import { mergeConfigs, generateDefaultConfig } from '../config';
import type { AgentConfig } from '@recursivemanager/common';

describe('mergeConfigs', () => {
  let baseConfig: AgentConfig;

  beforeEach(() => {
    // Create a base configuration for testing
    baseConfig = generateDefaultConfig('Developer', 'Build features', 'CEO');
  });

  describe('Basic Merging', () => {
    it('should return base config when override is empty', () => {
      const result = mergeConfigs(baseConfig, {});
      expect(result).toEqual(baseConfig);
      expect(result).not.toBe(baseConfig); // Should be a new object
    });

    it('should preserve base values when override has undefined', () => {
      const override = {
        version: undefined,
      };
      const result = mergeConfigs(baseConfig, override);
      expect(result.version).toBe(baseConfig.version);
    });

    it('should override with null values', () => {
      const override = {
        identity: {
          reportingTo: null,
        },
      };
      const result = mergeConfigs(baseConfig, override);
      expect(result.identity.reportingTo).toBeNull();
    });

    it('should override primitive values', () => {
      const override = {
        version: '2.0.0',
      };
      const result = mergeConfigs(baseConfig, override);
      expect(result.version).toBe('2.0.0');
    });
  });

  describe('Deep Merging', () => {
    it('should deeply merge nested objects', () => {
      const override = {
        permissions: {
          canHire: true,
          maxSubordinates: 5,
        },
      };
      const result = mergeConfigs(baseConfig, override);

      // Override values applied
      expect(result.permissions.canHire).toBe(true);
      expect(result.permissions.maxSubordinates).toBe(5);

      // Base values preserved
      expect(result.permissions.hiringBudget).toBe(baseConfig.permissions.hiringBudget);
      expect(result.permissions.canFire).toBe(baseConfig.permissions.canFire);
      expect(result.permissions.workspaceQuotaMB).toBe(baseConfig.permissions.workspaceQuotaMB);
    });

    it('should deeply merge multiple levels', () => {
      const override = {
        behavior: {
          multiPerspectiveAnalysis: {
            enabled: true,
            perspectives: ['security', 'performance'],
          },
        },
      };
      const result = mergeConfigs(baseConfig, override);

      // Override values applied at deep level
      expect(result.behavior?.multiPerspectiveAnalysis?.enabled).toBe(true);
      expect(result.behavior?.multiPerspectiveAnalysis?.perspectives).toEqual([
        'security',
        'performance',
      ]);

      // Base values preserved at same level
      expect(result.behavior?.multiPerspectiveAnalysis?.triggerOn).toEqual(
        baseConfig.behavior?.multiPerspectiveAnalysis?.triggerOn
      );

      // Other behavior fields preserved
      expect(result.behavior?.escalationPolicy).toEqual(baseConfig.behavior?.escalationPolicy);
      expect(result.behavior?.delegation).toEqual(baseConfig.behavior?.delegation);
    });

    it('should merge communication settings', () => {
      const override = {
        communication: {
          preferredChannels: ['slack', 'email'] as Array<
            'internal' | 'slack' | 'telegram' | 'email'
          >,
          slackChannel: '#dev-team',
          notifyManager: {
            onError: false,
          },
        },
      };
      const result = mergeConfigs(baseConfig, override);

      // Override values
      expect(result.communication?.preferredChannels).toEqual(['slack', 'email']);
      expect(result.communication?.slackChannel).toBe('#dev-team');
      expect(result.communication?.notifyManager?.onError).toBe(false);

      // Base values preserved
      expect(result.communication?.notifyManager?.onTaskComplete).toBe(
        baseConfig.communication?.notifyManager?.onTaskComplete
      );
      expect(result.communication?.notifyManager?.onHire).toBe(
        baseConfig.communication?.notifyManager?.onHire
      );
      expect(result.communication?.updateFrequency).toBe(baseConfig.communication?.updateFrequency);
    });
  });

  describe('Array Handling', () => {
    it('should replace arrays, not merge them', () => {
      const override = {
        goal: {
          subGoals: ['New goal 1', 'New goal 2'],
        },
      };
      const result = mergeConfigs(baseConfig, override);

      // Array should be replaced entirely
      expect(result.goal.subGoals).toEqual(['New goal 1', 'New goal 2']);
      expect(result.goal.subGoals).not.toBe(baseConfig.goal.subGoals);
    });

    it('should replace nested arrays', () => {
      const override = {
        permissions: {
          allowedDomains: ['example.com', 'api.example.com'],
        },
      };
      const result = mergeConfigs(baseConfig, override);

      expect(result.permissions.allowedDomains).toEqual(['example.com', 'api.example.com']);
    });

    it('should handle empty array override', () => {
      const override = {
        metadata: {
          tags: [],
        },
      };
      const result = mergeConfigs(baseConfig, override);

      expect(result.metadata?.tags).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle override with new fields', () => {
      const override = {
        metadata: {
          tags: ['feature', 'v2'],
          description: 'A new feature implementation',
          customData: {
            version: 2,
            experimental: true,
          },
        },
      };
      const result = mergeConfigs(baseConfig, override);

      expect(result.metadata?.tags).toEqual(['feature', 'v2']);
      expect(result.metadata?.description).toBe('A new feature implementation');
      expect(result.metadata?.customData).toEqual({
        version: 2,
        experimental: true,
      });
    });

    it('should handle override of optional fields', () => {
      const override = {
        behavior: {
          verbosity: 4,
          maxExecutionTime: 120,
          customInstructions: 'Be extra careful with security',
        },
      };
      const result = mergeConfigs(baseConfig, override);

      expect(result.behavior?.verbosity).toBe(4);
      expect(result.behavior?.maxExecutionTime).toBe(120);
      expect(result.behavior?.customInstructions).toBe('Be extra careful with security');
    });

    it('should handle complete section override', () => {
      const newIdentity = {
        id: 'new-id',
        role: 'Senior Developer',
        displayName: 'Sr Dev',
        createdAt: '2026-01-19T00:00:00Z',
        createdBy: 'CTO',
        reportingTo: 'CTO',
      };

      const override = {
        identity: newIdentity,
      };
      const result = mergeConfigs(baseConfig, override);

      expect(result.identity).toEqual(newIdentity);
    });

    it('should not mutate base config', () => {
      const baseClone = JSON.parse(JSON.stringify(baseConfig));
      const override = {
        permissions: {
          canHire: true,
          maxSubordinates: 10,
        },
      };

      mergeConfigs(baseConfig, override);

      // Base config should be unchanged
      expect(baseConfig).toEqual(baseClone);
    });

    it('should not mutate override config', () => {
      const override = {
        permissions: {
          canHire: true,
          maxSubordinates: 10,
        },
      };
      const overrideClone = JSON.parse(JSON.stringify(override));

      mergeConfigs(baseConfig, override);

      // Override config should be unchanged
      expect(override).toEqual(overrideClone);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multi-level override with mixed types', () => {
      const override = {
        version: '2.0.0',
        permissions: {
          canHire: true,
          allowedDomains: ['*.example.com'],
        },
        behavior: {
          verbosity: 5,
          multiPerspectiveAnalysis: {
            enabled: true,
          },
          escalationPolicy: {
            autoEscalateAfterFailures: 5,
          },
        },
        metadata: {
          tags: ['production', 'critical'],
          priority: 'high' as const,
        },
      };

      const result = mergeConfigs(baseConfig, override);

      // Top-level overrides
      expect(result.version).toBe('2.0.0');

      // Permissions - partial override
      expect(result.permissions.canHire).toBe(true);
      expect(result.permissions.allowedDomains).toEqual(['*.example.com']);
      expect(result.permissions.hiringBudget).toBe(baseConfig.permissions.hiringBudget);

      // Behavior - deep partial override
      expect(result.behavior?.verbosity).toBe(5);
      expect(result.behavior?.multiPerspectiveAnalysis?.enabled).toBe(true);
      expect(result.behavior?.multiPerspectiveAnalysis?.perspectives).toEqual(
        baseConfig.behavior?.multiPerspectiveAnalysis?.perspectives
      );
      expect(result.behavior?.escalationPolicy?.autoEscalateAfterFailures).toBe(5);
      expect(result.behavior?.escalationPolicy?.escalateOnBlockedTask).toBe(
        baseConfig.behavior?.escalationPolicy?.escalateOnBlockedTask
      );

      // Metadata - new values
      expect(result.metadata?.tags).toEqual(['production', 'critical']);
      expect(result.metadata?.priority).toBe('high');
    });

    it('should work with chained merges', () => {
      const override1 = {
        permissions: {
          canHire: true,
        },
      };

      const override2 = {
        permissions: {
          maxSubordinates: 10,
        },
      };

      const override3 = {
        behavior: {
          verbosity: 3,
        },
      };

      const result1 = mergeConfigs(baseConfig, override1);
      const result2 = mergeConfigs(result1, override2);
      const result3 = mergeConfigs(result2, override3);

      expect(result3.permissions.canHire).toBe(true);
      expect(result3.permissions.maxSubordinates).toBe(10);
      expect(result3.behavior?.verbosity).toBe(3);
      expect(result3.permissions.hiringBudget).toBe(baseConfig.permissions.hiringBudget);
    });

    it('should handle framework configuration override', () => {
      const override = {
        framework: {
          primary: 'opencode',
          fallback: 'claude-code',
          capabilities: ['code-generation', 'testing', 'documentation'],
        },
      };

      const result = mergeConfigs(baseConfig, override);

      expect(result.framework.primary).toBe('opencode');
      expect(result.framework.fallback).toBe('claude-code');
      expect(result.framework.capabilities).toEqual([
        'code-generation',
        'testing',
        'documentation',
      ]);
    });
  });

  describe('Real-World Use Cases', () => {
    it('should apply template with custom overrides', () => {
      // Scenario: Create a developer from template, customize permissions
      const template = generateDefaultConfig('Developer', 'Implement features', 'CTO');
      const customizations = {
        permissions: {
          canHire: true,
          maxSubordinates: 3,
        },
        behavior: {
          continuousMode: true,
          customInstructions: 'Focus on test-driven development',
        },
      };

      const result = mergeConfigs(template, customizations);

      expect(result.permissions.canHire).toBe(true);
      expect(result.permissions.maxSubordinates).toBe(3);
      expect(result.behavior?.continuousMode).toBe(true);
      expect(result.behavior?.customInstructions).toBe('Focus on test-driven development');
      expect(result.identity.role).toBe('Developer');
      expect(result.goal.mainGoal).toBe('Implement features');
    });

    it('should update existing agent config partially', () => {
      // Scenario: Update only communication settings of existing agent
      const existingConfig = baseConfig;
      const updates = {
        communication: {
          preferredChannels: ['slack'] as Array<'internal' | 'slack' | 'telegram' | 'email'>,
          slackChannel: '#engineering',
        },
      };

      const result = mergeConfigs(existingConfig, updates);

      // Communication updated
      expect(result.communication?.preferredChannels).toEqual(['slack']);
      expect(result.communication?.slackChannel).toBe('#engineering');

      // Everything else preserved
      expect(result.identity).toEqual(existingConfig.identity);
      expect(result.goal).toEqual(existingConfig.goal);
      expect(result.permissions).toEqual(existingConfig.permissions);
    });
  });
});
