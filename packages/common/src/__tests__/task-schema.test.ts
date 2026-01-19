import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

describe('task.schema.json', () => {
  let ajv: Ajv;
  let schema: object;

  beforeAll(() => {
    // Initialize AJV with formats support
    ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);

    // Load the schema
    const schemaPath = path.join(__dirname, '../schemas/task.schema.json');
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
      const requiredProps = [
        'version',
        'task',
        'hierarchy',
        'delegation',
        'progress',
        'context',
        'execution',
      ];
      expect((schema as { required: string[] }).required).toEqual(requiredProps);
    });
  });

  describe('Valid Configurations', () => {
    it('should validate minimal valid task configuration', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-1-setup-api',
          title: 'Setup API',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: {
          parentTask: null,
          childTasks: [],
          depth: 0,
          maxDepth: 5,
        },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: {
          relatedFiles: [],
          externalDependencies: [],
        },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      if (!valid) {
        console.log('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate complete task configuration with all optional fields', () => {
      const task = {
        $schema: 'https://recursivemanager.dev/schemas/task.schema.json',
        version: '1.0.0',
        task: {
          id: 'task-42-implement-auth',
          title: 'Implement User Authentication',
          description: 'Add OAuth2 authentication to the API',
          status: 'in-progress',
          priority: 'high',
          createdAt: '2026-01-18T09:00:00Z',
          startedAt: '2026-01-18T10:00:00Z',
          completedAt: null,
          estimatedCompletionAt: '2026-01-19T17:00:00Z',
        },
        hierarchy: {
          parentTask: 'task-1-backend-apis',
          childTasks: ['task-43-oauth-setup', 'task-44-jwt-tokens'],
          depth: 1,
          maxDepth: 5,
        },
        delegation: {
          delegatedTo: 'backend-dev-001',
          delegatedAt: '2026-01-18T09:15:00Z',
          delegatedBy: 'CTO',
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 35,
          subtasksCompleted: 1,
          subtasksTotal: 3,
          lastUpdate: '2026-01-18T14:30:00Z',
          blockedBy: [],
          blockedSince: null,
          blockReason: null,
        },
        context: {
          relatedFiles: ['src/auth/oauth.ts', 'src/auth/jwt.ts', 'tests/auth.test.ts'],
          externalDependencies: ['passport@0.6.0', 'jsonwebtoken@9.0.0'],
          notes: 'Need to ensure backward compatibility with existing sessions',
          tags: ['authentication', 'security', 'backend'],
        },
        execution: {
          lastExecutionId: 'exec-abc123',
          executionCount: 5,
          totalTimeSpentMinutes: 120,
          failureCount: 1,
          lastFailureReason: 'Timeout waiting for OAuth provider',
          lastSuccessAt: '2026-01-18T14:30:00Z',
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      if (!valid) {
        console.log('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate task with blocked status', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-10-deploy',
          title: 'Deploy to Production',
          status: 'blocked',
          priority: 'urgent',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: {
          parentTask: null,
          childTasks: [],
          depth: 0,
          maxDepth: 5,
        },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 80,
          subtasksCompleted: 4,
          subtasksTotal: 5,
          lastUpdate: '2026-01-18T15:00:00Z',
          blockedBy: ['task-9-tests', 'task-8-security-review'],
          blockedSince: '2026-01-18T12:00:00Z',
          blockReason: 'Waiting for security audit completion',
        },
        context: {
          relatedFiles: ['deploy.sh', 'kubernetes/deployment.yaml'],
          externalDependencies: [],
        },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Invalid Configurations', () => {
    it('should reject task without required version field', () => {
      const task = {
        task: {
          id: 'task-1-test',
          title: 'Test',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(false);
      expect(validate.errors).toBeTruthy();
    });

    it('should reject task with invalid version format', () => {
      const task = {
        version: '1.0', // Invalid: should be x.y.z
        task: {
          id: 'task-1-test',
          title: 'Test',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(false);
    });

    it('should reject task with invalid task ID format', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'invalid-id', // Should be task-{number}-{slug}
          title: 'Test',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(false);
    });

    it('should reject task with invalid status enum', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-1-test',
          title: 'Test',
          status: 'invalid-status',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(false);
    });

    it('should reject task with invalid priority enum', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-1-test',
          title: 'Test',
          status: 'pending',
          priority: 'super-urgent', // Invalid
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(false);
    });

    it('should reject task with negative depth', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-1-test',
          title: 'Test',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: null, childTasks: [], depth: -1, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(false);
    });

    it('should reject task with percentComplete > 100', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-1-test',
          title: 'Test',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 150,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(false);
    });

    it('should reject task with invalid execution ID format', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-1-test',
          title: 'Test',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: 'invalid-format',
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(false);
    });

    it('should reject task with additional properties', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-1-test',
          title: 'Test',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
        unexpectedField: 'should not be here',
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(false);
    });
  });

  describe('Enum Validation', () => {
    it('should validate all task status enum values', () => {
      const statuses = ['pending', 'in-progress', 'blocked', 'completed', 'archived'];

      statuses.forEach((status) => {
        const task = {
          version: '1.0.0',
          task: {
            id: 'task-1-test',
            title: 'Test',
            status,
            priority: 'medium',
            createdAt: '2026-01-18T10:00:00Z',
          },
          hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
          delegation: {
            delegatedTo: null,
            delegatedAt: null,
            supervisionLevel: 'moderate',
            reportingFrequency: 'daily',
          },
          progress: {
            percentComplete: 0,
            subtasksCompleted: 0,
            subtasksTotal: 0,
            lastUpdate: '2026-01-18T10:00:00Z',
            blockedBy: [],
            blockedSince: null,
          },
          context: { relatedFiles: [], externalDependencies: [] },
          execution: {
            lastExecutionId: null,
            executionCount: 0,
            totalTimeSpentMinutes: 0,
            failureCount: 0,
            lastFailureReason: null,
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(task);
        expect(valid).toBe(true);
      });
    });

    it('should validate all priority enum values', () => {
      const priorities = ['low', 'medium', 'high', 'urgent'];

      priorities.forEach((priority) => {
        const task = {
          version: '1.0.0',
          task: {
            id: 'task-1-test',
            title: 'Test',
            status: 'pending',
            priority,
            createdAt: '2026-01-18T10:00:00Z',
          },
          hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
          delegation: {
            delegatedTo: null,
            delegatedAt: null,
            supervisionLevel: 'moderate',
            reportingFrequency: 'daily',
          },
          progress: {
            percentComplete: 0,
            subtasksCompleted: 0,
            subtasksTotal: 0,
            lastUpdate: '2026-01-18T10:00:00Z',
            blockedBy: [],
            blockedSince: null,
          },
          context: { relatedFiles: [], externalDependencies: [] },
          execution: {
            lastExecutionId: null,
            executionCount: 0,
            totalTimeSpentMinutes: 0,
            failureCount: 0,
            lastFailureReason: null,
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(task);
        expect(valid).toBe(true);
      });
    });

    it('should validate all supervision level enum values', () => {
      const supervisionLevels = ['minimal', 'moderate', 'strict'];

      supervisionLevels.forEach((supervisionLevel) => {
        const task = {
          version: '1.0.0',
          task: {
            id: 'task-1-test',
            title: 'Test',
            status: 'pending',
            priority: 'medium',
            createdAt: '2026-01-18T10:00:00Z',
          },
          hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
          delegation: {
            delegatedTo: null,
            delegatedAt: null,
            supervisionLevel,
            reportingFrequency: 'daily',
          },
          progress: {
            percentComplete: 0,
            subtasksCompleted: 0,
            subtasksTotal: 0,
            lastUpdate: '2026-01-18T10:00:00Z',
            blockedBy: [],
            blockedSince: null,
          },
          context: { relatedFiles: [], externalDependencies: [] },
          execution: {
            lastExecutionId: null,
            executionCount: 0,
            totalTimeSpentMinutes: 0,
            failureCount: 0,
            lastFailureReason: null,
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(task);
        expect(valid).toBe(true);
      });
    });

    it('should validate all reporting frequency enum values', () => {
      const frequencies = ['never', 'daily', 'weekly', 'on-completion'];

      frequencies.forEach((reportingFrequency) => {
        const task = {
          version: '1.0.0',
          task: {
            id: 'task-1-test',
            title: 'Test',
            status: 'pending',
            priority: 'medium',
            createdAt: '2026-01-18T10:00:00Z',
          },
          hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
          delegation: {
            delegatedTo: null,
            delegatedAt: null,
            supervisionLevel: 'moderate',
            reportingFrequency,
          },
          progress: {
            percentComplete: 0,
            subtasksCompleted: 0,
            subtasksTotal: 0,
            lastUpdate: '2026-01-18T10:00:00Z',
            blockedBy: [],
            blockedSince: null,
          },
          context: { relatedFiles: [], externalDependencies: [] },
          execution: {
            lastExecutionId: null,
            executionCount: 0,
            totalTimeSpentMinutes: 0,
            failureCount: 0,
            lastFailureReason: null,
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(task);
        expect(valid).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should allow empty child tasks array', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-1-test',
          title: 'Test',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: null, childTasks: [], depth: 0, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(true);
    });

    it('should allow valid parent task reference', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-2-subtask',
          title: 'Subtask',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: 'task-1-parent', childTasks: [], depth: 1, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(true);
    });

    it('should allow task at maximum depth', () => {
      const task = {
        version: '1.0.0',
        task: {
          id: 'task-100-deep',
          title: 'Deep Task',
          status: 'pending',
          priority: 'medium',
          createdAt: '2026-01-18T10:00:00Z',
        },
        hierarchy: { parentTask: 'task-99-parent', childTasks: [], depth: 5, maxDepth: 5 },
        delegation: {
          delegatedTo: null,
          delegatedAt: null,
          supervisionLevel: 'moderate',
          reportingFrequency: 'daily',
        },
        progress: {
          percentComplete: 0,
          subtasksCompleted: 0,
          subtasksTotal: 0,
          lastUpdate: '2026-01-18T10:00:00Z',
          blockedBy: [],
          blockedSince: null,
        },
        context: { relatedFiles: [], externalDependencies: [] },
        execution: {
          lastExecutionId: null,
          executionCount: 0,
          totalTimeSpentMinutes: 0,
          failureCount: 0,
          lastFailureReason: null,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(task);
      expect(valid).toBe(true);
    });
  });
});
