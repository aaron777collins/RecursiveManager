/**
 * Tests for schema-validation.ts (Phase 1.2.16)
 *
 * Tests the validateAgentConfig and other validation functions
 */

import {
  validateAgentConfig,
  validateAgentConfigStrict,
  validateSchedule,
  validateScheduleStrict,
  validateTask,
  validateTaskStrict,
  validateMessage,
  validateMessageStrict,
  validateMetadata,
  validateMetadataStrict,
  validateSubordinates,
  validateSubordinatesStrict,
  SchemaValidationError,
  clearValidatorCache,
} from '../schema-validation';

describe('schema-validation', () => {
  describe('validateAgentConfig', () => {
    it('should validate a valid minimal agent config', () => {
      const config = {
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

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should return detailed errors for invalid config', () => {
      const config = {
        version: '1.0.0',
        // Missing required fields
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
      expect(result.errors![0]).toHaveProperty('field');
      expect(result.errors![0]).toHaveProperty('message');
    });

    it('should provide specific error messages for invalid fields', () => {
      const config = {
        version: 'not-semver',
        identity: {
          id: 'invalid id with spaces!',
          role: 'Test',
          displayName: 'Test',
          createdAt: 'not-a-date',
          createdBy: 'system',
        },
        goal: {
          mainGoal: 'Test',
        },
        permissions: {
          canHire: false,
          maxSubordinates: -1, // Invalid: negative
          hiringBudget: 0,
        },
        framework: {
          primary: 'invalid-framework',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();

      // Should have errors for version, id, createdAt, maxSubordinates, framework
      const errorFields = result.errors!.map((e) => e.field);
      expect(errorFields.some((f) => f.includes('version'))).toBe(true);
      expect(errorFields.some((f) => f.includes('identity'))).toBe(true);
      expect(errorFields.some((f) => f.includes('permissions'))).toBe(true);
      expect(errorFields.some((f) => f.includes('framework'))).toBe(true);
    });

    it('should validate a complete agent config', () => {
      const config = {
        version: '1.0.0',
        identity: {
          id: 'backend-dev-001',
          role: 'Backend Developer',
          displayName: 'Backend Dev #1',
          createdAt: '2026-01-18T10:00:00Z',
          createdBy: 'CTO',
          reportingTo: 'CTO',
        },
        goal: {
          mainGoal: 'Build REST API',
          subGoals: ['Design endpoints', 'Implement auth'],
          successCriteria: ['All endpoints functional'],
        },
        permissions: {
          canHire: true,
          maxSubordinates: 5,
          hiringBudget: 3,
          canFire: true,
          canEscalate: true,
          canAccessExternalAPIs: true,
          allowedDomains: ['github.com'],
          workspaceQuotaMB: 5120,
          maxExecutionMinutes: 60,
        },
        framework: {
          primary: 'claude-code',
          fallback: 'opencode',
          capabilities: ['code-generation'],
        },
        communication: {
          preferredChannels: ['internal'],
          notifyManager: {
            onTaskComplete: true,
            onError: true,
          },
        },
        behavior: {
          multiPerspectiveAnalysis: {
            enabled: true,
            perspectives: ['security', 'performance'],
          },
        },
        metadata: {
          tags: ['backend'],
          priority: 'high',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(true);
    });

    it('should reject additional properties', () => {
      const config = {
        version: '1.0.0',
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
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
        unknownField: 'should not be here',
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.message.includes('Additional property'))).toBe(true);
    });
  });

  describe('validateAgentConfigStrict', () => {
    it('should not throw for valid config', () => {
      const config = {
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

      expect(() => validateAgentConfigStrict(config)).not.toThrow();
    });

    it('should throw SchemaValidationError for invalid config', () => {
      const config = {
        version: '1.0.0',
        // Missing required fields
      };

      expect(() => validateAgentConfigStrict(config)).toThrow(SchemaValidationError);
    });

    it('should include formatted errors in exception', () => {
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
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
      };

      try {
        validateAgentConfigStrict(config);
        fail('Should have thrown SchemaValidationError');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError);
        const schemaError = error as SchemaValidationError;
        expect(schemaError.errors).toBeDefined();
        expect(schemaError.errors.length).toBeGreaterThan(0);

        const formatted = schemaError.getFormattedErrors();
        expect(formatted).toContain('Field:');
        expect(formatted).toContain('Message:');
      }
    });
  });

  describe('validateSchedule', () => {
    it('should validate a minimal valid schedule config', () => {
      const schedule = {
        version: '1.0.0',
        mode: 'hybrid',
      };

      const result = validateSchedule(schedule);
      expect(result.valid).toBe(true);
    });

    it('should return errors for invalid schedule', () => {
      const schedule = {
        version: '1.0.0',
        mode: 'invalid-mode',
      };

      const result = validateSchedule(schedule);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateTask', () => {
    it('should return errors for invalid task (smoke test)', () => {
      const task = {
        version: '1.0.0',
        // Missing required fields
      };

      const result = validateTask(task);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('validateMessage', () => {
    it('should return errors for invalid message (smoke test)', () => {
      const message = {
        version: '1.0.0',
        channel: 'invalid-channel',
      };

      const result = validateMessage(message);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateMetadata', () => {
    it('should return errors for invalid metadata (smoke test)', () => {
      const metadata = {
        version: '1.0.0',
        health: {
          status: 'invalid-status',
        },
      };

      const result = validateMetadata(metadata);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('validateSubordinates', () => {
    it('should return errors for invalid subordinates (smoke test)', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            status: 'invalid-status',
          },
        ],
      };

      const result = validateSubordinates(subordinates);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('Strict validation functions', () => {
    it('validateScheduleStrict should throw on invalid input', () => {
      expect(() => validateScheduleStrict({ invalid: true })).toThrow(SchemaValidationError);
    });

    it('validateTaskStrict should throw on invalid input', () => {
      expect(() => validateTaskStrict({ invalid: true })).toThrow(SchemaValidationError);
    });

    it('validateMessageStrict should throw on invalid input', () => {
      expect(() => validateMessageStrict({ invalid: true })).toThrow(SchemaValidationError);
    });

    it('validateMetadataStrict should throw on invalid input', () => {
      expect(() => validateMetadataStrict({ invalid: true })).toThrow(SchemaValidationError);
    });

    it('validateSubordinatesStrict should throw on invalid input', () => {
      expect(() => validateSubordinatesStrict({ invalid: true })).toThrow(SchemaValidationError);
    });
  });

  describe('Error formatting', () => {
    it('should format error messages with all details', () => {
      const config = {
        version: 'invalid',
        identity: {
          id: 'test',
          role: 'Test',
          displayName: 'Test',
          createdAt: 'not-a-date',
          createdBy: 'system',
        },
        goal: {
          mainGoal: 'Test',
        },
        permissions: {
          canHire: false,
          maxSubordinates: -1,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);

      // Check error structure
      result.errors!.forEach((error) => {
        expect(error.field).toBeDefined();
        expect(error.message).toBeDefined();
        expect(typeof error.field).toBe('string');
        expect(typeof error.message).toBe('string');
      });
    });

    it('should handle missing required fields error', () => {
      const config = {
        version: '1.0.0',
      };

      const result = validateAgentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.some((e) => e.message.includes('Missing required field'))).toBe(true);
    });
  });

  describe('Validator cache', () => {
    it('should cache validators for performance', () => {
      const config = {
        version: '1.0.0',
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
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
      };

      // First call
      const result1 = validateAgentConfig(config);
      expect(result1.valid).toBe(true);

      // Second call should use cached validator
      const result2 = validateAgentConfig(config);
      expect(result2.valid).toBe(true);
    });

    it('should allow cache clearing', () => {
      expect(() => clearValidatorCache()).not.toThrow();
    });
  });
});
