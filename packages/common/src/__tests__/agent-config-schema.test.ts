import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

describe('agent-config.schema.json', () => {
  let ajv: Ajv;
  let schema: object;

  beforeAll(() => {
    // Initialize AJV with formats support
    ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);

    // Load the schema
    const schemaPath = path.join(__dirname, '../schemas/agent-config.schema.json');
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
      const requiredProps = ['version', 'identity', 'goal', 'permissions', 'framework'];
      expect((schema as { required: string[] }).required).toEqual(requiredProps);
    });
  });

  describe('Valid Configurations', () => {
    it('should validate minimal valid configuration', () => {
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

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate complete configuration from spec', () => {
      const config = {
        $schema: 'https://recursivemanager.dev/schemas/agent-config.schema.json',
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
          mainGoal: 'Build REST API for user management system',
          subGoals: [
            'Design API endpoints',
            'Implement authentication',
            'Create database schema',
            'Write API documentation',
          ],
          successCriteria: ['All endpoints functional', '100% test coverage', 'API docs published'],
        },
        permissions: {
          canHire: true,
          maxSubordinates: 5,
          hiringBudget: 3,
          canFire: true,
          canEscalate: true,
          canAccessExternalAPIs: true,
          allowedDomains: ['github.com', 'api.anthropic.com'],
          workspaceQuotaMB: 5120,
          maxExecutionMinutes: 60,
        },
        framework: {
          primary: 'claude-code',
          fallback: 'opencode',
          capabilities: ['code-generation', 'file-operations', 'bash-execution'],
        },
        communication: {
          preferredChannels: ['internal', 'slack'],
          slackChannel: '#backend-team',
          notifyManager: {
            onTaskComplete: true,
            onError: true,
            onHire: true,
            onFire: true,
          },
          updateFrequency: 'daily',
        },
        behavior: {
          multiPerspectiveAnalysis: {
            enabled: true,
            perspectives: ['security', 'performance', 'maintainability', 'cost'],
            triggerOn: ['hire', 'fire', 'major-decision', 'task-planning'],
          },
          escalationPolicy: {
            autoEscalateAfterFailures: 3,
            escalateOnBlockedTask: true,
            escalateOnBudgetExceeded: true,
          },
          delegation: {
            delegateThreshold: 'non-trivial',
            keepWhenDelegating: true,
            supervisionLevel: 'moderate',
          },
        },
        metadata: {
          tags: ['backend', 'api', 'nodejs'],
          priority: 'high',
          estimatedCompletionDays: 14,
          actualStartDate: '2026-01-18',
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      if (!valid) {
        console.error('Validation errors:', JSON.stringify(validate.errors, null, 2));
      }
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate configuration with null reportingTo', () => {
      const config = {
        version: '1.0.0',
        identity: {
          id: 'ceo',
          role: 'CEO',
          displayName: 'Chief Executive Officer',
          createdAt: '2026-01-18T10:00:00Z',
          createdBy: 'system',
          reportingTo: null,
        },
        goal: {
          mainGoal: 'Lead organization',
        },
        permissions: {
          canHire: true,
          maxSubordinates: 10,
          hiringBudget: 10,
        },
        framework: {
          primary: 'claude-code',
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
    });

    it('should validate all framework options', () => {
      const frameworks = ['claude-code', 'opencode'];

      frameworks.forEach((fw) => {
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
            primary: fw,
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(config);
        expect(valid).toBe(true);
      });
    });
  });

  describe('Invalid Configurations', () => {
    it('should reject configuration missing required fields', () => {
      const config = {
        version: '1.0.0',
        // Missing identity, goal, permissions, framework
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors?.length).toBeGreaterThan(0);
    });

    it('should reject invalid version format', () => {
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

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
    });

    it('should reject invalid agent ID format', () => {
      const config = {
        version: '1.0.0',
        identity: {
          id: 'invalid id with spaces!',
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

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    it('should reject invalid date-time format', () => {
      const config = {
        version: '1.0.0',
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
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    it('should reject negative permission values', () => {
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
          maxSubordinates: -1,
          hiringBudget: 0,
        },
        framework: {
          primary: 'claude-code',
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    it('should reject invalid framework name', () => {
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
          primary: 'invalid-framework',
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    it('should reject invalid email format', () => {
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
        communication: {
          emailAddress: 'not-an-email',
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    it('should reject invalid priority value', () => {
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
        metadata: {
          priority: 'super-urgent',
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
    });

    it('should reject additional properties at top level', () => {
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

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
    });
  });

  describe('Default Values', () => {
    it('should allow optional fields to be omitted', () => {
      const config = {
        version: '1.0.0',
        identity: {
          id: 'test',
          role: 'Test',
          displayName: 'Test',
          createdAt: '2026-01-18T10:00:00Z',
          createdBy: 'system',
          // reportingTo is optional
        },
        goal: {
          mainGoal: 'Test',
          // subGoals and successCriteria are optional
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          // Other permissions are optional
        },
        framework: {
          primary: 'claude-code',
          // fallback and capabilities are optional
        },
        // communication, behavior, metadata are all optional
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
    });
  });

  describe('Enum Validation', () => {
    it('should validate all communication channels', () => {
      const channels = ['internal', 'slack', 'telegram', 'email'];

      channels.forEach((channel) => {
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
          communication: {
            preferredChannels: [channel],
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(config);
        expect(valid).toBe(true);
      });
    });

    it('should validate all perspective types', () => {
      const perspectives = [
        'security',
        'performance',
        'maintainability',
        'cost',
        'scalability',
        'usability',
        'reliability',
        'simplicity',
      ];

      perspectives.forEach((perspective) => {
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
          behavior: {
            multiPerspectiveAnalysis: {
              enabled: true,
              perspectives: [perspective],
            },
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(config);
        expect(valid).toBe(true);
      });
    });

    it('should validate all delegation thresholds', () => {
      const thresholds = ['never', 'trivial', 'non-trivial', 'complex', 'always'];

      thresholds.forEach((threshold) => {
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
          behavior: {
            delegation: {
              delegateThreshold: threshold,
            },
          },
        };

        const validate = ajv.compile(schema);
        const valid = validate(config);
        expect(valid).toBe(true);
      });
    });
  });
});
