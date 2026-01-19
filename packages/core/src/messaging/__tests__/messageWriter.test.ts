/**
 * Tests for message writer utilities
 */

import { mkdir, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  generateMessageId,
  formatMessageFile,
  writeMessageToInbox,
  writeMessagesInBatch,
  MessageData,
} from '../messageWriter';

describe('Message Writer', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `test-messages-${Date.now()}-${Math.random()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('generateMessageId', () => {
    it('should generate a unique message ID', () => {
      const id1 = generateMessageId();
      const id2 = generateMessageId();

      expect(id1).toMatch(/^msg-\d+-[a-z0-9]{6}$/);
      expect(id2).toMatch(/^msg-\d+-[a-z0-9]{6}$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with correct format', () => {
      const id = generateMessageId();
      const parts = id.split('-');

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('msg');
      expect(parseInt(parts[1] ?? '0')).toBeGreaterThan(0);
      expect(parts[2] ?? '').toHaveLength(6);
    });
  });

  describe('formatMessageFile', () => {
    it('should format a message with all required fields', () => {
      const message: MessageData = {
        id: 'msg-001',
        from: 'agent-001',
        to: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'high',
        channel: 'internal',
        read: false,
        actionRequired: true,
        subject: 'Test Subject',
        content: 'Test message content',
      };

      const formatted = formatMessageFile(message);

      expect(formatted).toContain('---');
      expect(formatted).toContain('id: "msg-001"');
      expect(formatted).toContain('from: "agent-001"');
      expect(formatted).toContain('to: "agent-002"');
      expect(formatted).toContain('priority: "high"');
      expect(formatted).toContain('channel: "internal"');
      expect(formatted).toContain('read: false');
      expect(formatted).toContain('actionRequired: true');
      expect(formatted).toContain('subject: "Test Subject"');
      expect(formatted).toContain('Test message content');
    });

    it('should handle optional fields correctly', () => {
      const message: MessageData = {
        id: 'msg-002',
        from: 'system',
        to: 'agent-001',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        content: 'Simple message',
      };

      const formatted = formatMessageFile(message);

      expect(formatted).toContain('id: "msg-002"');
      expect(formatted).not.toContain('subject:');
      expect(formatted).not.toContain('threadId:');
      expect(formatted).not.toContain('inReplyTo:');
      expect(formatted).toContain('Simple message');
    });

    it('should escape quotes in string values', () => {
      const message: MessageData = {
        id: 'msg-003',
        from: 'agent-001',
        to: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'high',
        channel: 'internal',
        subject: 'Test "quoted" subject',
        content: 'Content with "quotes"',
      };

      const formatted = formatMessageFile(message);

      expect(formatted).toContain('subject: "Test \\"quoted\\" subject"');
      expect(formatted).toContain('Content with "quotes"');
    });

    it('should include thread and reply fields when provided', () => {
      const message: MessageData = {
        id: 'msg-004',
        from: 'agent-001',
        to: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        threadId: 'thread-001',
        inReplyTo: 'msg-003',
        content: 'Reply message',
      };

      const formatted = formatMessageFile(message);

      expect(formatted).toContain('threadId: "thread-001"');
      expect(formatted).toContain('inReplyTo: "msg-003"');
    });
  });

  describe('writeMessageToInbox', () => {
    it('should write an unread message to inbox/unread/', async () => {
      const message: MessageData = {
        id: 'msg-001',
        from: 'agent-001',
        to: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'high',
        channel: 'internal',
        read: false,
        content: 'Test message',
      };

      const filePath = await writeMessageToInbox('agent-002', message, {
        dataDir: testDir,
      });

      expect(filePath).toContain('inbox/unread/msg-001.md');

      const content = await readFile(filePath, 'utf-8');
      expect(content).toContain('id: "msg-001"');
      expect(content).toContain('Test message');
    });

    it('should write a read message to inbox/read/', async () => {
      const message: MessageData = {
        id: 'msg-002',
        from: 'agent-001',
        to: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: true,
        content: 'Read message',
      };

      const filePath = await writeMessageToInbox('agent-002', message, {
        dataDir: testDir,
      });

      expect(filePath).toContain('inbox/read/msg-002.md');
    });

    it('should create directory structure if it does not exist', async () => {
      const message: MessageData = {
        id: 'msg-003',
        from: 'system',
        to: 'new-agent',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'urgent',
        channel: 'internal',
        read: false,
        actionRequired: true,
        content: 'New agent message',
      };

      const filePath = await writeMessageToInbox('new-agent', message, {
        dataDir: testDir,
      });

      expect(filePath).toBeDefined();

      const content = await readFile(filePath, 'utf-8');
      expect(content).toContain('New agent message');
    });
  });

  describe('writeMessagesInBatch', () => {
    it('should write multiple messages successfully', async () => {
      const messages = [
        {
          agentId: 'agent-001',
          message: {
            id: 'msg-001',
            from: 'system',
            to: 'agent-001',
            timestamp: '2026-01-19T10:00:00Z',
            priority: 'high' as const,
            channel: 'internal' as const,
            read: false,
            content: 'Message 1',
          },
        },
        {
          agentId: 'agent-002',
          message: {
            id: 'msg-002',
            from: 'system',
            to: 'agent-002',
            timestamp: '2026-01-19T10:01:00Z',
            priority: 'normal' as const,
            channel: 'internal' as const,
            read: false,
            content: 'Message 2',
          },
        },
        {
          agentId: 'agent-003',
          message: {
            id: 'msg-003',
            from: 'system',
            to: 'agent-003',
            timestamp: '2026-01-19T10:02:00Z',
            priority: 'urgent' as const,
            channel: 'internal' as const,
            read: false,
            content: 'Message 3',
          },
        },
      ];

      const paths = await writeMessagesInBatch(messages, {
        dataDir: testDir,
      });

      expect(paths).toHaveLength(3);
      expect(paths[0]).toContain('msg-001.md');
      expect(paths[1]).toContain('msg-002.md');
      expect(paths[2]).toContain('msg-003.md');
    });

    it('should handle partial failures gracefully', async () => {
      // Mock console.warn to suppress warnings during test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      const messages = [
        {
          agentId: 'agent-001',
          message: {
            id: 'msg-001',
            from: 'system',
            to: 'agent-001',
            timestamp: '2026-01-19T10:00:00Z',
            priority: 'high' as const,
            channel: 'internal' as const,
            read: false,
            content: 'Valid message',
          },
        },
        {
          agentId: '/invalid/path/../../../etc/passwd', // Invalid path
          message: {
            id: 'msg-002',
            from: 'system',
            to: 'invalid',
            timestamp: '2026-01-19T10:01:00Z',
            priority: 'normal' as const,
            channel: 'internal' as const,
            read: false,
            content: 'This might fail',
          },
        },
      ];

      const paths = await writeMessagesInBatch(messages, {
        dataDir: testDir,
      });

      // Should succeed for at least the valid message
      expect(paths.length).toBeGreaterThanOrEqual(1);
      expect(console.warn).toHaveBeenCalled();

      console.warn = originalWarn;
    });

    it('should handle empty batch', async () => {
      const paths = await writeMessagesInBatch([], {
        dataDir: testDir,
      });

      expect(paths).toHaveLength(0);
    });
  });
});
