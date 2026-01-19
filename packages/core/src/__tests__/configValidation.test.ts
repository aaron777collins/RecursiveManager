/**
 * Unit Tests for Config Validation (Task 2.1.7)
 *
 * Comprehensive tests for agent configuration validation including:
 * - Valid configuration acceptance
 * - Invalid configuration rejection
 * - Schema validation error handling
 * - Business logic validation
 * - Edge cases and boundary conditions
 */

import {
  validateAgentConfig,
  validateAgentConfigStrict,
  SchemaValidationError,
  type AgentConfig,
} from '@recursive-manager/common';
import {
  validateAgentConfigBusinessLogic,
  validateAgentConfigBusinessLogicStrict,
} from '../validation/business-validation';

describe('Config Validation (Task 2.1.7)', () => {
  // Valid minimal config for testing
  const validMinimalConfig: AgentConfig = {
    version: '1.0.0',
    identity: {
      id: 'test-agent',
      role: 'Test Agent',
      displayName: 'Test Agent #1',
      createdAt: '2026-01-18T10:00:00Z',
      createdBy: 'system',
    },
    goal: {
      mainGoal: 'Test goal',
    },
    permissions: {
      canHire: false,
      maxSubordinates: 0,
      hiringBudget: 0,
    },
    framework: {
      primary: 'claude-code',
    },
  };

  // Valid complete config with many optional fields
  const validCompleteConfig: AgentConfig = {
    version: '1.0.0',
    identity: {
      id: 'complete-agent',
      role: 'Complete Test Agent',
      displayName: 'Complete Agent #1',
      reportingTo: 'manager-agent',
      createdAt: '2026-01-18T10:00:00Z',
      createdBy: 'system',
    },
    goal: {
      mainGoal: 'Complete test goal',
      successCriteria: ['Criterion 1', 'Criterion 2'],
      subGoals: ['SubGoal 1', 'SubGoal 2'],
    },
    permissions: {
      canHire: true,
      maxSubordinates: 5,
      hiringBudget: 10000,
      canFire: true,
      canEscalate: true,
    },
    framework: {
      primary: 'claude-code',
      fallback: 'opencode',
    },
    communication: {
      preferredChannels: ['internal', 'slack'],
      slackChannel: '#test-channel',
      updateFrequency: 'daily',
    },
    behavior: {
      verbosity: 3,
      maxExecutionTime: 60,
      continuousMode: true,
    },
    metadata: {
      tags: ['test', 'validation'],
      description: 'A fully configured test agent',
      priority: 'high',
    },
  };

  describe('Valid Configuration Acceptance', () => {
    it('should accept valid minimal configuration', () => {
      const result = validateAgentConfig(validMinimalConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should accept valid complete configuration with all fields', () => {
      const result = validateAgentConfig(validCompleteConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should not throw when using validateAgentConfigStrict on valid config', () => {
      expect(() => validateAgentConfigStrict(validMinimalConfig)).not.toThrow();
      expect(() => validateAgentConfigStrict(validCompleteConfig)).not.toThrow();
    });

    it('should accept config with null optional fields', () => {
      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: 'test-agent',
          role: 'Test',
          displayName: 'Test',
          createdAt: '2026-01-18T10:00:00Z',
          createdBy: 'system',
          reportingTo: null,
        },
        goal: {
          mainGoal: 'Test',
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should accept config with empty arrays', () => {
      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: 'test-agent',
          role: 'Test',
          displayName: 'Test',
          createdAt: '2026-01-18T10:00:00Z',
          createdBy: 'system',
        },
        goal: {
          mainGoal: 'Test',
          successCriteria: [],
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('Invalid Configuration Rejection - Missing Fields', () => {
    it('should reject config missing version', () => {
      const config = {
        identity: validMinimalConfig.identity,
        goal: validMinimalConfig.goal,
        permissions: validMinimalConfig.permissions,
        framework: validMinimalConfig.framework,
      };

      const result = validateAgentConfig(config as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e: any) => e.field.includes('version'))).toBe(true);
    });

    it('should reject config missing identity', () => {
      const config = {
        version: validMinimalConfig.version,
        goal: validMinimalConfig.goal,
        permissions: validMinimalConfig.permissions,
        framework: validMinimalConfig.framework,
      };

      const result = validateAgentConfig(config as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e: any) => e.field.includes('identity'))).toBe(true);
    });

    it('should reject config missing goal', () => {
      const config = {
        version: validMinimalConfig.version,
        identity: validMinimalConfig.identity,
        permissions: validMinimalConfig.permissions,
        framework: validMinimalConfig.framework,
      };

      const result = validateAgentConfig(config as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e: any) => e.field.includes('goal'))).toBe(true);
    });

    it('should reject config missing permissions', () => {
      const config = {
        version: validMinimalConfig.version,
        identity: validMinimalConfig.identity,
        goal: validMinimalConfig.goal,
        framework: validMinimalConfig.framework,
      };

      const result = validateAgentConfig(config as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e: any) => e.field.includes('permissions'))).toBe(true);
    });

    it('should reject config missing framework', () => {
      const config = {
        version: validMinimalConfig.version,
        identity: validMinimalConfig.identity,
        goal: validMinimalConfig.goal,
        permissions: validMinimalConfig.permissions,
      };

      const result = validateAgentConfig(config as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e: any) => e.field.includes('framework'))).toBe(true);
    });

    it('should reject config missing required nested fields in identity', () => {
      const config = {
        ...validMinimalConfig,
        identity: {
          id: 'test',
          // Missing required fields: role, displayName, createdAt, createdBy
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Invalid Configuration Rejection - Invalid Types', () => {
    it('should reject config with invalid version format', () => {
      const config = {
        ...validMinimalConfig,
        version: 'not-semver',
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors!.some((e: any) => e.field.includes('version'))).toBe(true);
    });

    it('should reject config with invalid agentId pattern', () => {
      const config = {
        ...validMinimalConfig,
        identity: {
          ...validMinimalConfig.identity,
          id: 'invalid id with spaces!',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors!.some((e: any) => e.field.includes('identity'))).toBe(true);
    });

    it('should reject config with invalid createdAt format', () => {
      const config = {
        ...validMinimalConfig,
        identity: {
          ...validMinimalConfig.identity,
          createdAt: 'not-a-date',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors!.some((e: any) => e.field.includes('createdAt'))).toBe(true);
    });

    it('should reject config with boolean instead of string', () => {
      const config = {
        ...validMinimalConfig,
        goal: {
          mainGoal: true as any, // Should be string
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject config with string instead of boolean', () => {
      const config = {
        ...validMinimalConfig,
        permissions: {
          ...validMinimalConfig.permissions,
          canHire: 'yes' as any, // Should be boolean
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject config with string instead of number', () => {
      const config = {
        ...validMinimalConfig,
        permissions: {
          ...validMinimalConfig.permissions,
          maxSubordinates: '5' as any, // Should be number
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject config with negative numbers where positive expected', () => {
      const config = {
        ...validMinimalConfig,
        permissions: {
          ...validMinimalConfig.permissions,
          maxSubordinates: -1,
          hiringBudget: -1000,
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject config with invalid framework primary value', () => {
      const config = {
        ...validMinimalConfig,
        framework: {
          primary: 'invalid-framework' as any,
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors!.some((e: any) => e.field.includes('framework'))).toBe(true);
    });
  });

  describe('Invalid Configuration Rejection - Additional Properties', () => {
    it('should reject config with unknown top-level properties', () => {
      const config = {
        ...validMinimalConfig,
        unknownField: 'should-not-be-here',
      } as any;

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(
        result.errors!.some(
          (e: any) =>
            e.message.toLowerCase().includes('additional') ||
            e.message.toLowerCase().includes('unknown')
        )
      ).toBe(true);
    });

    it('should reject config with unknown nested properties in identity', () => {
      const config = {
        ...validMinimalConfig,
        identity: {
          ...validMinimalConfig.identity,
          unknownField: 'value',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should reject config with unknown properties in permissions', () => {
      const config = {
        ...validMinimalConfig,
        permissions: {
          ...validMinimalConfig.permissions,
          unknownPermission: true,
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
    });
  });

  describe('Invalid Configuration Rejection - Boundary Conditions', () => {
    it('should reject empty config object', () => {
      const config = {};

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(3); // Multiple missing required fields
    });

    it('should reject null config', () => {
      const result = validateAgentConfig(null as any);
      expect(result.valid).toBe(false);
    });

    it('should reject undefined config', () => {
      const result = validateAgentConfig(undefined as any);
      expect(result.valid).toBe(false);
    });

    it('should reject config with empty strings for required fields', () => {
      const config = {
        ...validMinimalConfig,
        identity: {
          ...validMinimalConfig.identity,
          id: '',
          role: '',
          displayName: '',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
    });

    it('should warn on config with very large numbers in business validation', () => {
      const config = {
        ...validMinimalConfig,
        permissions: {
          ...validMinimalConfig.permissions,
          maxSubordinates: 10000,
        },
      };

      const schemaResult = validateAgentConfig(config);
      // Schema validation should pass for large but valid numbers
      expect(schemaResult.valid).toBe(true);

      // Business validation may warn about excessively large values
      const businessResult = validateAgentConfigBusinessLogic(config);
      expect(businessResult.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Schema Validation Error Handling', () => {
    it('should throw SchemaValidationError with validateAgentConfigStrict on invalid config', () => {
      const config = {
        ...validMinimalConfig,
        version: 'invalid',
      };

      expect(() => validateAgentConfigStrict(config)).toThrow(SchemaValidationError);
    });

    it('should include detailed error information in SchemaValidationError', () => {
      const config = {
        version: 'invalid',
        identity: {
          id: 'invalid id!',
        },
      } as any;

      try {
        validateAgentConfigStrict(config);
        fail('Should have thrown SchemaValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError);
        const schemaError = error as SchemaValidationError;
        expect(schemaError.errors).toBeDefined();
        expect(schemaError.errors.length).toBeGreaterThan(0);
        expect(schemaError.errors[0]).toHaveProperty('field');
        expect(schemaError.errors[0]).toHaveProperty('message');
      }
    });

    it('should provide helpful error messages for common mistakes', () => {
      const config = {
        ...validMinimalConfig,
        permissions: {
          ...validMinimalConfig.permissions,
          canHire: 'true', // String instead of boolean
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]!.message.toLowerCase()).toMatch(/type|boolean|string/);
    });
  });

  describe('Business Logic Validation', () => {
    it('should pass business validation for valid config', () => {
      const result = validateAgentConfigBusinessLogic(validMinimalConfig);
      expect(result.valid).toBe(true);
    });

    it('should not throw for valid config with validateAgentConfigBusinessLogicStrict', () => {
      expect(() => validateAgentConfigBusinessLogicStrict(validMinimalConfig)).not.toThrow();
    });

    it('should return warnings for potentially problematic configs', () => {
      const config: AgentConfig = {
        ...validMinimalConfig,
        permissions: {
          ...validMinimalConfig.permissions,
          canHire: true,
          maxSubordinates: 0,
        },
      };

      const result = validateAgentConfigBusinessLogic(config);
      // Business validation should complete and may have warnings
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('errors');
    });

    it('should validate config with valid hiring permissions', () => {
      const config: AgentConfig = {
        ...validMinimalConfig,
        permissions: {
          ...validMinimalConfig.permissions,
          canHire: true,
          maxSubordinates: 5,
          hiringBudget: 5, // Must be <= maxSubordinates
        },
      };

      const result = validateAgentConfigBusinessLogic(config);
      expect(result.valid).toBe(true);
    });

    it('should validate config with various behavior settings', () => {
      const config: AgentConfig = {
        ...validMinimalConfig,
        behavior: {
          verbosity: 3,
          maxExecutionTime: 120,
        },
      };

      const result = validateAgentConfigBusinessLogic(config);
      expect(result).toHaveProperty('valid');
    });

    it('should not throw with strict validation on valid config', () => {
      expect(() => validateAgentConfigBusinessLogicStrict(validMinimalConfig)).not.toThrow();
    });
  });

  describe('Combined Schema and Business Validation', () => {
    it('should fail schema validation before business validation', () => {
      const config = {
        ...validMinimalConfig,
        version: 'invalid-version',
        permissions: {
          ...validMinimalConfig.permissions,
          canHire: true,
          maxSubordinates: 0, // Would trigger business warning
        },
      };

      // Schema validation should fail first
      const schemaResult = validateAgentConfig(config);
      expect(schemaResult.valid).toBe(false);

      // Business validation won't run on invalid schema
      expect(() => validateAgentConfigStrict(config)).toThrow(SchemaValidationError);
    });

    it('should perform both schema and business validation', () => {
      const config = validMinimalConfig;

      // Schema validation should pass
      const schemaResult = validateAgentConfig(config);
      expect(schemaResult.valid).toBe(true);

      // Business validation should also pass
      const businessResult = validateAgentConfigBusinessLogic(config);
      expect(businessResult.valid).toBe(true);
    });

    it('should handle config with both schema and business issues', () => {
      const config = {
        version: 'invalid',
        identity: {
          id: 'test',
          role: 'Test',
          displayName: 'Test',
          createdAt: '2026-01-18T10:00:00Z',
          createdBy: 'system',
        },
        goal: {
          mainGoal: 'Test',
        },
        permissions: {
          canHire: true,
          maxSubordinates: 0, // Business issue
          hiringBudget: 0, // Business issue
        },
        framework: {
          primary: 'claude-code',
        },
      };

      // Schema validation fails first
      const schemaResult = validateAgentConfig(config);
      expect(schemaResult.valid).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle config with special characters in strings', () => {
      const config = {
        ...validMinimalConfig,
        goal: {
          mainGoal: 'Test with special chars: @#$%^&*()',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should handle config with unicode characters', () => {
      const config = {
        ...validMinimalConfig,
        identity: {
          ...validMinimalConfig.identity,
          displayName: 'Test Agent 日本語 🚀',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should handle config with very long strings', () => {
      const longString = 'a'.repeat(10000);
      const config = {
        ...validMinimalConfig,
        goal: {
          mainGoal: longString,
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should handle config with deeply nested optional objects', () => {
      const config: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: 'test-nested',
          role: 'Test',
          displayName: 'Test',
          createdAt: '2026-01-18T10:00:00Z',
          createdBy: 'system',
        },
        goal: {
          mainGoal: 'Test',
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
          preferredChannels: ['internal'],
          notifyManager: {
            onTaskComplete: true,
            onError: true,
            onHire: true,
            onFire: true,
          },
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should validate config with minimal communication settings', () => {
      const config: AgentConfig = {
        ...validMinimalConfig,
        communication: {
          preferredChannels: ['internal'] as const,
          updateFrequency: 'never',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should validate config with minimal behavior settings', () => {
      const config: AgentConfig = {
        ...validMinimalConfig,
        behavior: {
          verbosity: 1,
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should handle config with array of allowed domains', () => {
      const config = {
        ...validMinimalConfig,
        permissions: {
          ...validMinimalConfig.permissions,
          allowedDomains: ['github.com', 'slack.com', 'jira.com', 'trello.com'],
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should handle config with empty metadata', () => {
      const config = {
        ...validMinimalConfig,
        metadata: {
          tags: [],
          customData: {},
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should validate config in reasonable time for large configs', () => {
      const largeConfig: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: 'large-config',
          role: 'Test',
          displayName: 'Test',
          createdAt: '2026-01-18T10:00:00Z',
          createdBy: 'system',
        },
        goal: {
          mainGoal: 'Test',
          successCriteria: Array(100).fill('criterion'),
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          allowedDomains: Array(100).fill('example.com'),
        },
        framework: {
          primary: 'claude-code',
        },
        metadata: {
          tags: Array(100).fill('tag'),
          customData: Object.fromEntries(
            Array(100)
              .fill(0)
              .map((_, i) => [`field${i}`, `value${i}`])
          ),
        },
      };

      const start = Date.now();
      const result = validateAgentConfig(largeConfig);
      const duration = Date.now() - start;

      expect(result.valid).toBe(true);
      expect(duration).toBeLessThan(100); // Should validate in under 100ms
    });

    it('should validate multiple configs efficiently', () => {
      const configs = Array(100)
        .fill(0)
        .map((_, i) => ({
          ...validMinimalConfig,
          identity: {
            ...validMinimalConfig.identity,
            id: `agent-${i}`,
          },
        }));

      const start = Date.now();
      configs.forEach((config) => {
        validateAgentConfig(config);
      });
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(500); // 100 validations in under 500ms
    });
  });
});
