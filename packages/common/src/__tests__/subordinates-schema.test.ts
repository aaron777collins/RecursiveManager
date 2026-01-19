import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

describe('subordinates.schema.json', () => {
  let ajv: Ajv;
  let schema: object;

  beforeAll(() => {
    // Initialize AJV with formats support
    ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);

    // Load the schema
    const schemaPath = path.join(__dirname, '../schemas/subordinates.schema.json');
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
      const requiredProps = ['version', 'subordinates', 'summary'];
      expect((schema as { required: string[] }).required).toEqual(requiredProps);
    });
  });

  describe('Valid Configurations', () => {
    it('should validate minimal valid subordinates configuration', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [],
        summary: {
          totalSubordinates: 0,
          activeSubordinates: 0,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 10,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      if (!valid) {
        console.log('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate complete subordinates configuration with all fields', () => {
      const subordinates = {
        $schema: 'https://recursivemanager.dev/schemas/subordinates.schema.json',
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'backend-dev-001',
            role: 'Backend Developer',
            hiredAt: '2026-01-15T09:00:00Z',
            hiredFor: 'Build REST API for user management',
            status: 'active',
            lastReportAt: '2026-01-18T10:00:00Z',
            healthStatus: 'healthy',
            tasksAssigned: 5,
            tasksCompleted: 3,
          },
          {
            agentId: 'frontend-dev-001',
            role: 'Frontend Developer',
            hiredAt: '2026-01-16T10:00:00Z',
            hiredFor: 'Create UI components',
            status: 'active',
            lastReportAt: '2026-01-18T09:30:00Z',
            healthStatus: 'warning',
            tasksAssigned: 7,
            tasksCompleted: 4,
          },
          {
            agentId: 'qa-engineer-001',
            role: 'QA Engineer',
            hiredAt: '2026-01-17T11:00:00Z',
            hiredFor: 'Test automation',
            status: 'paused',
            lastReportAt: '2026-01-17T15:00:00Z',
            healthStatus: 'unknown',
            tasksAssigned: 2,
            tasksCompleted: 1,
          },
          {
            agentId: 'devops-001',
            role: 'DevOps Engineer',
            hiredAt: '2026-01-10T08:00:00Z',
            hiredFor: 'Setup CI/CD pipeline',
            status: 'fired',
            lastReportAt: '2026-01-14T16:00:00Z',
            healthStatus: 'critical',
            tasksAssigned: 3,
            tasksCompleted: 1,
            firedAt: '2026-01-15T09:00:00Z',
            firedReason: 'Consistently failed to meet deadlines',
          },
        ],
        summary: {
          totalSubordinates: 4,
          activeSubordinates: 2,
          pausedSubordinates: 1,
          firedSubordinates: 1,
          hiringBudgetRemaining: 6,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      if (!valid) {
        console.log('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate subordinates with minimal subordinate fields', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'test-agent-001',
            role: 'Test Role',
            hiredAt: '2026-01-18T10:00:00Z',
            hiredFor: 'Testing purpose',
            status: 'active',
            tasksAssigned: 0,
            tasksCompleted: 0,
          },
        ],
        summary: {
          totalSubordinates: 1,
          activeSubordinates: 1,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 5,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Invalid Configurations', () => {
    it('should reject subordinates without required version field', () => {
      const subordinates = {
        subordinates: [],
        summary: {
          totalSubordinates: 0,
          activeSubordinates: 0,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 10,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(false);
      expect(validate.errors).toBeTruthy();
    });

    it('should reject subordinates with invalid version format', () => {
      const subordinates = {
        version: '1.0',
        subordinates: [],
        summary: {
          totalSubordinates: 0,
          activeSubordinates: 0,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 10,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(false);
    });

    it('should reject subordinate with invalid agentId format', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'invalid agent!',
            role: 'Test',
            hiredAt: '2026-01-18T10:00:00Z',
            hiredFor: 'Testing',
            status: 'active',
            tasksAssigned: 0,
            tasksCompleted: 0,
          },
        ],
        summary: {
          totalSubordinates: 1,
          activeSubordinates: 1,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 9,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(false);
    });

    it('should reject subordinate with invalid status enum', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'test-agent',
            role: 'Test',
            hiredAt: '2026-01-18T10:00:00Z',
            hiredFor: 'Testing',
            status: 'inactive',
            tasksAssigned: 0,
            tasksCompleted: 0,
          },
        ],
        summary: {
          totalSubordinates: 1,
          activeSubordinates: 0,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 9,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(false);
    });

    it('should reject subordinate with invalid healthStatus enum', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'test-agent',
            role: 'Test',
            hiredAt: '2026-01-18T10:00:00Z',
            hiredFor: 'Testing',
            status: 'active',
            healthStatus: 'good',
            tasksAssigned: 0,
            tasksCompleted: 0,
          },
        ],
        summary: {
          totalSubordinates: 1,
          activeSubordinates: 1,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 9,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(false);
    });

    it('should reject subordinate with negative tasksAssigned', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'test-agent',
            role: 'Test',
            hiredAt: '2026-01-18T10:00:00Z',
            hiredFor: 'Testing',
            status: 'active',
            tasksAssigned: -1,
            tasksCompleted: 0,
          },
        ],
        summary: {
          totalSubordinates: 1,
          activeSubordinates: 1,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 9,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(false);
    });

    it('should reject subordinate with negative tasksCompleted', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'test-agent',
            role: 'Test',
            hiredAt: '2026-01-18T10:00:00Z',
            hiredFor: 'Testing',
            status: 'active',
            tasksAssigned: 0,
            tasksCompleted: -5,
          },
        ],
        summary: {
          totalSubordinates: 1,
          activeSubordinates: 1,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 9,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(false);
    });

    it('should reject summary with negative counts', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [],
        summary: {
          totalSubordinates: -1,
          activeSubordinates: 0,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 10,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(false);
    });

    it('should reject subordinates with additional properties at root level', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [],
        summary: {
          totalSubordinates: 0,
          activeSubordinates: 0,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 10,
        },
        unexpectedField: 'should fail',
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(false);
    });

    it('should reject subordinate with additional properties', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'test-agent',
            role: 'Test',
            hiredAt: '2026-01-18T10:00:00Z',
            hiredFor: 'Testing',
            status: 'active',
            tasksAssigned: 0,
            tasksCompleted: 0,
            unexpectedField: 'should fail',
          },
        ],
        summary: {
          totalSubordinates: 1,
          activeSubordinates: 1,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 9,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(false);
    });
  });

  describe('Enum Validation', () => {
    it('should validate all subordinate status enum values', () => {
      const statuses = ['active', 'paused', 'fired'];

      statuses.forEach((status) => {
        const subordinates = {
          version: '1.0.0',
          subordinates: [
            {
              agentId: 'test-agent',
              role: 'Test',
              hiredAt: '2026-01-18T10:00:00Z',
              hiredFor: 'Testing',
              status,
              tasksAssigned: 0,
              tasksCompleted: 0,
            },
          ],
          summary: {
            totalSubordinates: 1,
            activeSubordinates: status === 'active' ? 1 : 0,
            pausedSubordinates: status === 'paused' ? 1 : 0,
            firedSubordinates: status === 'fired' ? 1 : 0,
            hiringBudgetRemaining: 9,
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(subordinates);
        expect(valid).toBe(true);
      });
    });

    it('should validate all health status enum values', () => {
      const healthStatuses = ['healthy', 'warning', 'critical', 'unknown'];

      healthStatuses.forEach((healthStatus) => {
        const subordinates = {
          version: '1.0.0',
          subordinates: [
            {
              agentId: 'test-agent',
              role: 'Test',
              hiredAt: '2026-01-18T10:00:00Z',
              hiredFor: 'Testing',
              status: 'active',
              healthStatus,
              tasksAssigned: 0,
              tasksCompleted: 0,
            },
          ],
          summary: {
            totalSubordinates: 1,
            activeSubordinates: 1,
            pausedSubordinates: 0,
            firedSubordinates: 0,
            hiringBudgetRemaining: 9,
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(subordinates);
        expect(valid).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should allow empty subordinates array', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [],
        summary: {
          totalSubordinates: 0,
          activeSubordinates: 0,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 10,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(true);
    });

    it('should validate fired subordinate with all firing details', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'fired-agent',
            role: 'Developer',
            hiredAt: '2026-01-10T09:00:00Z',
            hiredFor: 'Build feature X',
            status: 'fired',
            lastReportAt: '2026-01-15T10:00:00Z',
            healthStatus: 'critical',
            tasksAssigned: 5,
            tasksCompleted: 1,
            firedAt: '2026-01-16T09:00:00Z',
            firedReason: 'Poor performance and missed deadlines',
          },
        ],
        summary: {
          totalSubordinates: 1,
          activeSubordinates: 0,
          pausedSubordinates: 0,
          firedSubordinates: 1,
          hiringBudgetRemaining: 9,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(true);
    });

    it('should allow zero hiring budget remaining', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [],
        summary: {
          totalSubordinates: 0,
          activeSubordinates: 0,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 0,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(true);
    });

    it('should allow subordinate with zero tasks', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'new-agent',
            role: 'Junior Developer',
            hiredAt: '2026-01-18T14:00:00Z',
            hiredFor: 'Learn the codebase',
            status: 'active',
            tasksAssigned: 0,
            tasksCompleted: 0,
          },
        ],
        summary: {
          totalSubordinates: 1,
          activeSubordinates: 1,
          pausedSubordinates: 0,
          firedSubordinates: 0,
          hiringBudgetRemaining: 9,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(true);
    });

    it('should allow multiple subordinates with mixed statuses', () => {
      const subordinates = {
        version: '1.0.0',
        subordinates: [
          {
            agentId: 'agent-1',
            role: 'Developer',
            hiredAt: '2026-01-10T09:00:00Z',
            hiredFor: 'Backend work',
            status: 'active',
            tasksAssigned: 3,
            tasksCompleted: 2,
          },
          {
            agentId: 'agent-2',
            role: 'Tester',
            hiredAt: '2026-01-11T09:00:00Z',
            hiredFor: 'QA testing',
            status: 'paused',
            tasksAssigned: 1,
            tasksCompleted: 1,
          },
          {
            agentId: 'agent-3',
            role: 'Designer',
            hiredAt: '2026-01-09T09:00:00Z',
            hiredFor: 'UI design',
            status: 'fired',
            tasksAssigned: 2,
            tasksCompleted: 0,
            firedAt: '2026-01-15T09:00:00Z',
            firedReason: 'Did not meet requirements',
          },
        ],
        summary: {
          totalSubordinates: 3,
          activeSubordinates: 1,
          pausedSubordinates: 1,
          firedSubordinates: 1,
          hiringBudgetRemaining: 7,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(subordinates);
      expect(valid).toBe(true);
    });
  });
});
