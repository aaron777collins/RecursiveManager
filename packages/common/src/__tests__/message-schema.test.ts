import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

describe('message.schema.json', () => {
  let ajv: Ajv;
  let schema: object;

  beforeAll(() => {
    // Initialize AJV with formats support
    ajv = new Ajv({ allErrors: true, strict: true });
    addFormats(ajv);

    // Load the schema
    const schemaPath = path.join(__dirname, '../schemas/message.schema.json');
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
        'id',
        'from',
        'to',
        'timestamp',
        'priority',
        'channel',
        'read',
        'actionRequired',
      ];
      expect((schema as { required: string[] }).required).toEqual(requiredProps);
    });
  });

  describe('Valid Configurations', () => {
    it('should validate minimal valid message configuration', () => {
      const message = {
        id: 'msg-1234567890-abc123',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      if (!valid) {
        console.log('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate complete message configuration with all optional fields', () => {
      const message = {
        $schema: 'https://recursivemanager.dev/schemas/message.schema.json',
        id: 'msg-1705574400-x9k2m',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'high',
        channel: 'slack',
        read: true,
        actionRequired: true,
        subject: 'Urgent: Production incident requires attention',
        threadId: 'thread-incident-2026-01',
        inReplyTo: 'msg-1705574300-abc123',
        externalId: 'slack-msg-12345',
        externalMetadata: {
          slackChannel: 'C01234ABCD',
          slackTs: '1705574400.123456',
          telegramChatId: '123456789',
          telegramMessageId: '987654',
          emailMessageId: '<msg-abc@example.com>',
          emailThread: 'thread-xyz',
        },
        readAt: '2026-01-18T10:05:00Z',
        archivedAt: null,
        tags: ['incident', 'production', 'urgent'],
        attachments: [
          {
            filename: 'error-log.txt',
            path: '/attachments/error-log.txt',
            size: 2048,
            mimeType: 'text/plain',
          },
          {
            filename: 'screenshot.png',
            path: '/attachments/screenshot.png',
            size: 15360,
            mimeType: 'image/png',
          },
        ],
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      if (!valid) {
        console.log('Validation errors:', validate.errors);
      }
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate message with thread reference', () => {
      const message = {
        id: 'msg-1234567890-reply',
        from: 'agent-backend',
        to: 'agent-cto',
        timestamp: '2026-01-18T11:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        threadId: 'thread-api-discussion',
        inReplyTo: 'msg-1234567800-original',
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate telegram message', () => {
      const message = {
        id: 'msg-1234567890-tg1',
        from: 'external-user',
        to: 'agent-support',
        timestamp: '2026-01-18T12:00:00Z',
        priority: 'normal',
        channel: 'telegram',
        read: false,
        actionRequired: true,
        externalId: 'tg-msg-123',
        externalMetadata: {
          telegramChatId: '987654321',
          telegramMessageId: '456',
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });

    it('should validate email message', () => {
      const message = {
        id: 'msg-1234567890-email',
        from: 'external-user',
        to: 'agent-support',
        timestamp: '2026-01-18T13:00:00Z',
        priority: 'low',
        channel: 'email',
        read: false,
        actionRequired: false,
        externalId: 'email-msg-xyz',
        externalMetadata: {
          emailMessageId: '<unique-id@example.com>',
          emailThread: 'thread-customer-inquiry',
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('Invalid Configurations', () => {
    it('should reject message without required id field', () => {
      const message = {
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
      expect(validate.errors).toBeTruthy();
    });

    it('should reject message with invalid id format', () => {
      const message = {
        id: 'invalid-message-id',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });

    it('should reject message with invalid from agent ID format', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'invalid agent id!',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });

    it('should reject message with invalid to agent ID format', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'invalid@agent',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });

    it('should reject message with invalid priority enum', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'super-urgent',
        channel: 'internal',
        read: false,
        actionRequired: false,
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });

    it('should reject message with invalid channel enum', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'discord',
        read: false,
        actionRequired: false,
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });

    it('should reject message with invalid timestamp format', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });

    it('should reject message with invalid threadId format', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        threadId: 'invalid-format',
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });

    it('should reject message with invalid inReplyTo format', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        inReplyTo: 'invalid-message-ref',
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });

    it('should reject message with additional properties at root level', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        unexpectedField: 'should not be here',
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });

    it('should reject attachment without required filename', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        attachments: [
          {
            path: '/attachments/file.txt',
            size: 1024,
          },
        ],
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });

    it('should reject attachment with negative size', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        attachments: [
          {
            filename: 'file.txt',
            path: '/attachments/file.txt',
            size: -100,
          },
        ],
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(false);
    });
  });

  describe('Enum Validation', () => {
    it('should validate all priority enum values', () => {
      const priorities = ['low', 'normal', 'high', 'urgent'];

      priorities.forEach((priority) => {
        const message = {
          id: 'msg-1234567890-abc',
          from: 'agent-ceo',
          to: 'agent-cto',
          timestamp: '2026-01-18T10:00:00Z',
          priority,
          channel: 'internal',
          read: false,
          actionRequired: false,
        };

        const validate = ajv.compile(schema);
        const valid = validate(message);
        expect(valid).toBe(true);
      });
    });

    it('should validate all channel enum values', () => {
      const channels = ['internal', 'slack', 'telegram', 'email'];

      channels.forEach((channel) => {
        const message = {
          id: 'msg-1234567890-abc',
          from: 'agent-ceo',
          to: 'agent-cto',
          timestamp: '2026-01-18T10:00:00Z',
          priority: 'normal',
          channel,
          read: false,
          actionRequired: false,
        };

        const validate = ajv.compile(schema);
        const valid = validate(message);
        expect(valid).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should allow empty tags array', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        tags: [],
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(true);
    });

    it('should allow empty attachments array', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        attachments: [],
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(true);
    });

    it('should allow externalMetadata with additional properties', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        externalMetadata: {
          customField1: 'value1',
          customField2: 123,
          nestedObject: { key: 'value' },
        },
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(true);
    });

    it('should validate message with multiple attachments', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        attachments: [
          { filename: 'file1.txt', path: '/path1.txt' },
          { filename: 'file2.pdf', path: '/path2.pdf' },
          { filename: 'file3.jpg', path: '/path3.jpg' },
        ],
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(true);
    });

    it('should validate archived message', () => {
      const message = {
        id: 'msg-1234567890-abc',
        from: 'agent-ceo',
        to: 'agent-cto',
        timestamp: '2026-01-18T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: true,
        actionRequired: false,
        readAt: '2026-01-18T10:05:00Z',
        archivedAt: '2026-01-18T15:00:00Z',
      };

      const validate = ajv.compile(schema);
      const valid = validate(message);
      expect(valid).toBe(true);
    });
  });
});
