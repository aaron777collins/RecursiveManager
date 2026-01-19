import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

describe('schedule.schema.json', () => {
  let ajv: Ajv;
  let schema: object;

  beforeAll(() => {
    // Initialize AJV with formats support
    ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);

    // Load the schema
    const schemaPath = path.join(__dirname, '../schemas/schedule.schema.json');
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
      const requiredProps = ['version', 'mode'];
      expect((schema as { required: string[] }).required).toEqual(requiredProps);
    });
  });

  describe('Valid Configurations', () => {
    it('should validate minimal valid configuration', () => {
      const config = {
        version: '1.0.0',
        mode: 'hybrid',
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate complete configuration from spec', () => {
      const config = {
        $schema: 'https://recursivemanager.dev/schemas/schedule.schema.json',
        version: '1.0.0',
        mode: 'hybrid',
        continuous: {
          enabled: true,
          conditions: {
            onlyWhenTasksPending: true,
            minimumInterval: '5m',
            pauseBetweenRuns: '1m',
          },
        },
        timeBased: {
          enabled: true,
          triggers: [
            {
              id: 'daily-standup',
              description: 'Daily status update to manager',
              schedule: '0 9 * * *',
              action: 'send-status-report',
              timezone: 'America/Los_Angeles',
            },
            {
              id: 'weekly-review',
              description: 'Review progress and plan next week',
              schedule: '0 17 * * 5',
              action: 'weekly-planning',
              timezone: 'America/Los_Angeles',
            },
          ],
        },
        reactive: {
          enabled: true,
          triggers: [
            {
              source: 'slack',
              channel: '#backend-team',
              mentions: true,
              directMessages: true,
              debounce: '30s',
            },
            {
              source: 'internal',
              fromAgents: ['CTO', 'CEO'],
              priority: 'immediate',
            },
          ],
        },
        pauseConditions: {
          ifManagerPaused: true,
          ifOutOfBudget: true,
          ifSystemMaintenance: true,
          manualPause: false,
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

    it('should validate continuous-only mode', () => {
      const config = {
        version: '1.0.0',
        mode: 'continuous',
        continuous: {
          enabled: true,
          conditions: {
            onlyWhenTasksPending: true,
            minimumInterval: '10m',
            pauseBetweenRuns: '2m',
          },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate timeBased-only mode', () => {
      const config = {
        version: '1.0.0',
        mode: 'timeBased',
        timeBased: {
          enabled: true,
          triggers: [
            {
              id: 'hourly-check',
              description: 'Check for new tasks',
              schedule: '0 * * * *',
              action: 'check-tasks',
            },
          ],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate reactive-only mode', () => {
      const config = {
        version: '1.0.0',
        mode: 'reactive',
        reactive: {
          enabled: true,
          triggers: [
            {
              source: 'telegram',
              directMessages: true,
              debounce: '1m',
            },
          ],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate all supported modes', () => {
      const modes = ['continuous', 'timeBased', 'reactive', 'hybrid'];
      const validate = ajv.compile(schema);

      modes.forEach((mode) => {
        const config = {
          version: '1.0.0',
          mode,
        };
        expect(validate(config)).toBe(true);
      });
    });

    it('should validate all reactive sources', () => {
      const sources = ['slack', 'telegram', 'email', 'internal'];
      const validate = ajv.compile(schema);

      sources.forEach((source) => {
        const config = {
          version: '1.0.0',
          mode: 'reactive',
          reactive: {
            enabled: true,
            triggers: [
              {
                source,
              },
            ],
          },
        };
        expect(validate(config)).toBe(true);
      });
    });

    it('should validate all priority levels', () => {
      const priorities = ['immediate', 'high', 'normal', 'low'];
      const validate = ajv.compile(schema);

      priorities.forEach((priority) => {
        const config = {
          version: '1.0.0',
          mode: 'reactive',
          reactive: {
            enabled: true,
            triggers: [
              {
                source: 'internal',
                priority,
              },
            ],
          },
        };
        expect(validate(config)).toBe(true);
      });
    });

    it('should validate various interval patterns', () => {
      const intervals = ['1s', '30s', '5m', '1h', '2d'];
      const validate = ajv.compile(schema);

      intervals.forEach((interval) => {
        const config = {
          version: '1.0.0',
          mode: 'continuous',
          continuous: {
            enabled: true,
            conditions: {
              minimumInterval: interval,
              pauseBetweenRuns: interval,
            },
          },
        };
        expect(validate(config)).toBe(true);
      });
    });

    it('should validate various debounce patterns', () => {
      const debounces = ['1s', '30s', '5m', '1h'];
      const validate = ajv.compile(schema);

      debounces.forEach((debounce) => {
        const config = {
          version: '1.0.0',
          mode: 'reactive',
          reactive: {
            enabled: true,
            triggers: [
              {
                source: 'slack',
                debounce,
              },
            ],
          },
        };
        expect(validate(config)).toBe(true);
      });
    });
  });

  describe('Invalid Configurations', () => {
    it('should reject missing version', () => {
      const config = {
        mode: 'hybrid',
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors?.[0]?.params).toHaveProperty('missingProperty', 'version');
    });

    it('should reject missing mode', () => {
      const config = {
        version: '1.0.0',
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors?.[0]?.params).toHaveProperty('missingProperty', 'mode');
    });

    it('should reject invalid version format', () => {
      const config = {
        version: '1.0',
        mode: 'hybrid',
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
    });

    it('should reject invalid mode enum', () => {
      const config = {
        version: '1.0.0',
        mode: 'invalid-mode',
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors?.[0]?.keyword).toBe('enum');
    });

    it('should reject invalid interval format', () => {
      const config = {
        version: '1.0.0',
        mode: 'continuous',
        continuous: {
          enabled: true,
          conditions: {
            minimumInterval: '5 minutes', // Invalid format
          },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
    });

    it('should reject invalid debounce format', () => {
      const config = {
        version: '1.0.0',
        mode: 'reactive',
        reactive: {
          enabled: true,
          triggers: [
            {
              source: 'slack',
              debounce: '30 seconds', // Invalid format
            },
          ],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
    });

    it('should reject invalid reactive source', () => {
      const config = {
        version: '1.0.0',
        mode: 'reactive',
        reactive: {
          enabled: true,
          triggers: [
            {
              source: 'discord', // Invalid source
            },
          ],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors?.[0]?.keyword).toBe('enum');
    });

    it('should reject invalid priority', () => {
      const config = {
        version: '1.0.0',
        mode: 'reactive',
        reactive: {
          enabled: true,
          triggers: [
            {
              source: 'internal',
              priority: 'urgent', // Invalid priority
            },
          ],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors?.[0]?.keyword).toBe('enum');
    });

    it('should reject time-based trigger missing required fields', () => {
      const config = {
        version: '1.0.0',
        mode: 'timeBased',
        timeBased: {
          enabled: true,
          triggers: [
            {
              id: 'test-trigger',
              // Missing description, schedule, action
            },
          ],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
    });

    it('should reject reactive trigger missing source', () => {
      const config = {
        version: '1.0.0',
        mode: 'reactive',
        reactive: {
          enabled: true,
          triggers: [
            {
              // Missing source
              debounce: '30s',
            },
          ],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors?.[0]?.params).toHaveProperty('missingProperty', 'source');
    });

    it('should reject invalid trigger id pattern', () => {
      const config = {
        version: '1.0.0',
        mode: 'timeBased',
        timeBased: {
          enabled: true,
          triggers: [
            {
              id: 'invalid trigger id!', // Contains spaces and special chars
              description: 'Test trigger',
              schedule: '0 9 * * *',
              action: 'test-action',
            },
          ],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
    });

    it('should reject additional properties at top level', () => {
      const config = {
        version: '1.0.0',
        mode: 'hybrid',
        unknownField: 'value',
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(false);
      expect(validate.errors).not.toBeNull();
      expect(validate.errors?.[0]?.keyword).toBe('additionalProperties');
    });
  });

  describe('Default Values', () => {
    it('should have correct default values in schema', () => {
      const properties = (schema as { properties: Record<string, unknown> }).properties;

      expect((properties.mode as { default: string }).default).toBe('hybrid');
      expect((properties.version as { default: string }).default).toBe('1.0.0');
    });

    it('should have correct continuous defaults', () => {
      const properties = (schema as { properties: Record<string, unknown> }).properties;
      const continuous = properties.continuous as { default: Record<string, unknown> };

      expect(continuous.default).toHaveProperty('enabled', true);
      expect(continuous.default.conditions).toMatchObject({
        onlyWhenTasksPending: true,
        minimumInterval: '5m',
        pauseBetweenRuns: '1m',
      });
    });

    it('should have correct pauseConditions defaults', () => {
      const properties = (schema as { properties: Record<string, unknown> }).properties;
      const pauseConditions = properties.pauseConditions as { default: Record<string, unknown> };

      expect(pauseConditions.default).toMatchObject({
        ifManagerPaused: true,
        ifOutOfBudget: true,
        ifSystemMaintenance: true,
        manualPause: false,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should validate empty triggers arrays', () => {
      const config = {
        version: '1.0.0',
        mode: 'hybrid',
        timeBased: {
          enabled: true,
          triggers: [],
        },
        reactive: {
          enabled: true,
          triggers: [],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate disabled sections', () => {
      const config = {
        version: '1.0.0',
        mode: 'hybrid',
        continuous: {
          enabled: false,
        },
        timeBased: {
          enabled: false,
        },
        reactive: {
          enabled: false,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate multiple time-based triggers', () => {
      const config = {
        version: '1.0.0',
        mode: 'timeBased',
        timeBased: {
          enabled: true,
          triggers: [
            {
              id: 'trigger-1',
              description: 'First trigger',
              schedule: '0 9 * * *',
              action: 'action-1',
            },
            {
              id: 'trigger-2',
              description: 'Second trigger',
              schedule: '0 17 * * *',
              action: 'action-2',
            },
            {
              id: 'trigger-3',
              description: 'Third trigger',
              schedule: '0 12 * * 0',
              action: 'action-3',
            },
          ],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate multiple reactive triggers', () => {
      const config = {
        version: '1.0.0',
        mode: 'reactive',
        reactive: {
          enabled: true,
          triggers: [
            { source: 'slack', channel: '#team-1' },
            { source: 'telegram' },
            { source: 'email' },
            { source: 'internal', fromAgents: ['manager'] },
          ],
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate all pause conditions set to false', () => {
      const config = {
        version: '1.0.0',
        mode: 'continuous',
        pauseConditions: {
          ifManagerPaused: false,
          ifOutOfBudget: false,
          ifSystemMaintenance: false,
          manualPause: false,
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(config);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });
});
