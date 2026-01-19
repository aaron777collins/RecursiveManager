import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

describe('metadata.schema.json', () => {
  let ajv: Ajv;
  let schema: object;

  beforeAll(() => {
    // Initialize AJV with formats support
    ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);

    // Load the schema
    const schemaPath = path.join(__dirname, '../schemas/metadata.schema.json');
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    schema = JSON.parse(schemaContent) as object;
  });

  describe('Schema Structure', () => {
    it('should have valid JSON Schema metadata', () => {
      expect(schema).toHaveProperty('$schema');
      expect(schema).toHaveProperty('$id');
      expect(schema).toHaveProperty('title');
      expect(schema).toHaveProperty('description');
    });

    it('should compile successfully', () => {
      const validate = ajv.compile(schema);
      expect(validate).toBeDefined();
      expect(typeof validate).toBe('function');
    });

    it('should have all required top-level properties', () => {
      const requiredProps = ['version', 'runtime', 'statistics', 'health', 'budget'];
      expect((schema as { required: string[] }).required).toEqual(requiredProps);
    });
  });

  describe('Valid Configurations', () => {
    it('should validate minimal valid metadata configuration', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'unknown',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: {
            initial: 0,
            remaining: 0,
            used: 0,
          },
          executionBudget: {
            maxExecutionsPerDay: 100,
            usedToday: 0,
            remainingToday: 100,
          },
          resourceUsage: {
            workspaceMB: 0,
            quotaMB: 1024,
            percentUsed: 0,
          },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      if (!valid) {
        console.log('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate complete metadata configuration with all optional fields', () => {
      const metadata = {
        $schema: 'https://recursivemanager.dev/schemas/metadata.schema.json',
        version: '1.0.0',
        runtime: {
          status: 'active',
          lastExecutionAt: '2026-01-18T14:30:00Z',
          lastExecutionDuration: 120,
          lastExecutionType: 'continuous',
          lastExecutionResult: 'success',
          nextScheduledExecution: '2026-01-18T15:00:00Z',
        },
        statistics: {
          totalExecutions: 150,
          successfulExecutions: 142,
          failedExecutions: 8,
          totalRuntimeMinutes: 3600,
          averageExecutionMinutes: 24,
          tasksCompleted: 45,
          tasksActive: 3,
          messagesSent: 89,
          messagesReceived: 112,
          subordinatesHired: 5,
          subordinatesFired: 1,
        },
        health: {
          overallHealth: 'healthy',
          lastHealthCheck: '2026-01-18T14:30:00Z',
          issues: [],
          warnings: ['Disk usage at 75%', 'High memory consumption'],
        },
        budget: {
          hiringBudget: {
            initial: 10,
            remaining: 4,
            used: 6,
          },
          executionBudget: {
            maxExecutionsPerDay: 200,
            usedToday: 48,
            remainingToday: 152,
          },
          resourceUsage: {
            workspaceMB: 768.5,
            quotaMB: 1024,
            percentUsed: 75.05,
          },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      if (!valid) {
        console.log('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate metadata with error status', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'error',
          lastExecutionAt: '2026-01-18T14:00:00Z',
          lastExecutionDuration: 45,
          lastExecutionType: 'manual',
          lastExecutionResult: 'error',
        },
        statistics: {
          totalExecutions: 10,
          successfulExecutions: 8,
          failedExecutions: 2,
          totalRuntimeMinutes: 120,
          averageExecutionMinutes: 12,
          tasksCompleted: 5,
          tasksActive: 2,
          messagesSent: 15,
          messagesReceived: 20,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'critical',
          lastHealthCheck: '2026-01-18T14:00:00Z',
          issues: ['Agent execution failed', 'Database connection lost'],
          warnings: ['High error rate'],
        },
        budget: {
          hiringBudget: {
            initial: 5,
            remaining: 5,
            used: 0,
          },
          executionBudget: {
            maxExecutionsPerDay: 100,
            usedToday: 10,
            remainingToday: 90,
          },
          resourceUsage: {
            workspaceMB: 50.2,
            quotaMB: 1024,
            percentUsed: 4.9,
          },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Invalid Configurations', () => {
    it('should reject metadata without required version field', () => {
      const metadata = {
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'unknown',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
          resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(false);
      expect(validate.errors).toBeTruthy();
    });

    it('should reject metadata with invalid version format', () => {
      const metadata = {
        version: '1.0',
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'unknown',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
          resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(false);
    });

    it('should reject metadata with invalid runtime status enum', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'running',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'unknown',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
          resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(false);
    });

    it('should reject metadata with invalid health status enum', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'ok',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
          resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(false);
    });

    it('should reject metadata with negative execution duration', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: -10,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'unknown',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
          resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(false);
    });

    it('should reject metadata with negative statistics', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: -5,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'unknown',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
          resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(false);
    });

    it('should reject metadata with percentUsed > 100', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'unknown',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
          resourceUsage: { workspaceMB: 2048, quotaMB: 1024, percentUsed: 150 },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(false);
    });

    it('should reject metadata with additional properties', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'unknown',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
          resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
        },
        unexpectedField: 'should fail',
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(false);
    });
  });

  describe('Enum Validation', () => {
    it('should validate all runtime status enum values', () => {
      const statuses = ['active', 'paused', 'idle', 'error', 'terminated'];

      statuses.forEach((status) => {
        const metadata = {
          version: '1.0.0',
          runtime: {
            status,
            lastExecutionAt: null,
            lastExecutionDuration: 0,
            lastExecutionType: null,
            lastExecutionResult: null,
          },
          statistics: {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            totalRuntimeMinutes: 0,
            averageExecutionMinutes: 0,
            tasksCompleted: 0,
            tasksActive: 0,
            messagesSent: 0,
            messagesReceived: 0,
            subordinatesHired: 0,
            subordinatesFired: 0,
          },
          health: {
            overallHealth: 'unknown',
            lastHealthCheck: null,
            issues: [],
            warnings: [],
          },
          budget: {
            hiringBudget: { initial: 0, remaining: 0, used: 0 },
            executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
            resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(metadata);
        expect(valid).toBe(true);
      });
    });

    it('should validate all execution type enum values', () => {
      const executionTypes = ['continuous', 'reactive', 'cron', 'manual', null];

      executionTypes.forEach((lastExecutionType) => {
        const metadata = {
          version: '1.0.0',
          runtime: {
            status: 'idle',
            lastExecutionAt: null,
            lastExecutionDuration: 0,
            lastExecutionType,
            lastExecutionResult: null,
          },
          statistics: {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            totalRuntimeMinutes: 0,
            averageExecutionMinutes: 0,
            tasksCompleted: 0,
            tasksActive: 0,
            messagesSent: 0,
            messagesReceived: 0,
            subordinatesHired: 0,
            subordinatesFired: 0,
          },
          health: {
            overallHealth: 'unknown',
            lastHealthCheck: null,
            issues: [],
            warnings: [],
          },
          budget: {
            hiringBudget: { initial: 0, remaining: 0, used: 0 },
            executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
            resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(metadata);
        expect(valid).toBe(true);
      });
    });

    it('should validate all execution result enum values', () => {
      const executionResults = ['success', 'failure', 'error', 'timeout', null];

      executionResults.forEach((lastExecutionResult) => {
        const metadata = {
          version: '1.0.0',
          runtime: {
            status: 'idle',
            lastExecutionAt: null,
            lastExecutionDuration: 0,
            lastExecutionType: null,
            lastExecutionResult,
          },
          statistics: {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            totalRuntimeMinutes: 0,
            averageExecutionMinutes: 0,
            tasksCompleted: 0,
            tasksActive: 0,
            messagesSent: 0,
            messagesReceived: 0,
            subordinatesHired: 0,
            subordinatesFired: 0,
          },
          health: {
            overallHealth: 'unknown',
            lastHealthCheck: null,
            issues: [],
            warnings: [],
          },
          budget: {
            hiringBudget: { initial: 0, remaining: 0, used: 0 },
            executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
            resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(metadata);
        expect(valid).toBe(true);
      });
    });

    it('should validate all health status enum values', () => {
      const healthStatuses = ['healthy', 'warning', 'critical', 'unknown'];

      healthStatuses.forEach((overallHealth) => {
        const metadata = {
          version: '1.0.0',
          runtime: {
            status: 'idle',
            lastExecutionAt: null,
            lastExecutionDuration: 0,
            lastExecutionType: null,
            lastExecutionResult: null,
          },
          statistics: {
            totalExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            totalRuntimeMinutes: 0,
            averageExecutionMinutes: 0,
            tasksCompleted: 0,
            tasksActive: 0,
            messagesSent: 0,
            messagesReceived: 0,
            subordinatesHired: 0,
            subordinatesFired: 0,
          },
          health: {
            overallHealth,
            lastHealthCheck: null,
            issues: [],
            warnings: [],
          },
          budget: {
            hiringBudget: { initial: 0, remaining: 0, used: 0 },
            executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
            resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(metadata);
        expect(valid).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should allow empty issues and warnings arrays', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'healthy',
          lastHealthCheck: '2026-01-18T10:00:00Z',
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
          resourceUsage: { workspaceMB: 0, quotaMB: 1024, percentUsed: 0 },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(true);
    });

    it('should allow fractional workspace usage', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 12.5,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'unknown',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 100, usedToday: 0, remainingToday: 100 },
          resourceUsage: { workspaceMB: 123.456, quotaMB: 1024, percentUsed: 12.05 },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(true);
    });

    it('should allow zero budget and quota', () => {
      const metadata = {
        version: '1.0.0',
        runtime: {
          status: 'idle',
          lastExecutionAt: null,
          lastExecutionDuration: 0,
          lastExecutionType: null,
          lastExecutionResult: null,
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalRuntimeMinutes: 0,
          averageExecutionMinutes: 0,
          tasksCompleted: 0,
          tasksActive: 0,
          messagesSent: 0,
          messagesReceived: 0,
          subordinatesHired: 0,
          subordinatesFired: 0,
        },
        health: {
          overallHealth: 'unknown',
          lastHealthCheck: null,
          issues: [],
          warnings: [],
        },
        budget: {
          hiringBudget: { initial: 0, remaining: 0, used: 0 },
          executionBudget: { maxExecutionsPerDay: 1, usedToday: 0, remainingToday: 1 },
          resourceUsage: { workspaceMB: 0, quotaMB: 0, percentUsed: 0 },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(metadata);
      expect(valid).toBe(true);
    });
  });
});
