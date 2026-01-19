/**
 * Tests for message query functions
 */

import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  createMessage,
  getMessage,
  getMessages,
  markMessageAsRead,
  markMessageAsArchived,
  getUnreadMessageCount,
  deleteMessage,
  MessageInput,
} from '../messages';
import { runMigrations } from '../../migrations';

describe('Message Query Functions', () => {
  let db: Database.Database;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for test database
    testDir = join(tmpdir(), `test-messages-${Date.now()}-${Math.random()}`);
    await mkdir(testDir, { recursive: true });

    // Initialize database
    const dbPath = join(testDir, 'test.db');
    db = new Database(dbPath);

    // Run migrations
    await runMigrations(db);

    // Insert test agents for foreign key constraints
    db.prepare(`
      INSERT INTO agents (id, role, display_name, status, created_by, reporting_to, main_goal, config_path)
      VALUES
        ('agent-001', 'CEO', 'Test CEO', 'active', NULL, NULL, 'Lead company', '/data/agents/a/agent-001/config.json'),
        ('agent-002', 'CTO', 'Test CTO', 'active', 'agent-001', 'agent-001', 'Lead tech', '/data/agents/a/agent-002/config.json'),
        ('system', 'System', 'System', 'active', NULL, NULL, 'System operations', '/data/agents/s/system/config.json')
    `).run();
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  describe('createMessage', () => {
    it('should create a message with all required fields', () => {
      const messageInput: MessageInput = {
        id: 'msg-001',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'high',
        channel: 'internal',
        read: false,
        action_required: true,
        message_path: 'inbox/unread/msg-001.md',
      };

      const created = createMessage(db, messageInput);

      expect(created).toBeDefined();
      expect(created.id).toBe('msg-001');
      expect(created.from_agent_id).toBe('agent-001');
      expect(created.to_agent_id).toBe('agent-002');
      expect(created.priority).toBe('high');
      expect(created.read).toBe(false);
      expect(created.action_required).toBe(true);
    });

    it('should create a message with optional fields', () => {
      const messageInput: MessageInput = {
        id: 'msg-002',
        from_agent_id: 'system',
        to_agent_id: 'agent-001',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'urgent',
        channel: 'internal',
        subject: 'Test Subject',
        thread_id: 'thread-001',
        in_reply_to: 'msg-001',
        message_path: 'inbox/unread/msg-002.md',
      };

      const created = createMessage(db, messageInput);

      expect(created.subject).toBe('Test Subject');
      expect(created.thread_id).toBe('thread-001');
      expect(created.in_reply_to).toBe('msg-001');
    });

    it('should set default values for read and action_required', () => {
      const messageInput: MessageInput = {
        id: 'msg-003',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'normal',
        channel: 'internal',
        message_path: 'inbox/unread/msg-003.md',
      };

      const created = createMessage(db, messageInput);

      expect(created.read).toBe(false);
      expect(created.action_required).toBe(false);
    });
  });

  describe('getMessage', () => {
    beforeEach(() => {
      createMessage(db, {
        id: 'msg-001',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'high',
        channel: 'internal',
        message_path: 'inbox/unread/msg-001.md',
      });
    });

    it('should retrieve an existing message', () => {
      const message = getMessage(db, 'msg-001');

      expect(message).toBeDefined();
      expect(message!.id).toBe('msg-001');
      expect(message!.from_agent_id).toBe('agent-001');
      expect(message!.to_agent_id).toBe('agent-002');
    });

    it('should return null for non-existent message', () => {
      const message = getMessage(db, 'msg-999');

      expect(message).toBeNull();
    });
  });

  describe('getMessages', () => {
    beforeEach(() => {
      // Create multiple messages
      createMessage(db, {
        id: 'msg-001',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'high',
        channel: 'internal',
        read: false,
        action_required: true,
        message_path: 'inbox/unread/msg-001.md',
      });

      createMessage(db, {
        id: 'msg-002',
        from_agent_id: 'system',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T11:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: true,
        message_path: 'inbox/read/msg-002.md',
      });

      createMessage(db, {
        id: 'msg-003',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T12:00:00Z',
        priority: 'urgent',
        channel: 'slack',
        read: false,
        message_path: 'inbox/unread/msg-003.md',
      });

      createMessage(db, {
        id: 'msg-004',
        from_agent_id: 'agent-002',
        to_agent_id: 'agent-001',
        timestamp: '2026-01-19T13:00:00Z',
        priority: 'low',
        channel: 'internal',
        message_path: 'inbox/unread/msg-004.md',
      });
    });

    it('should get all messages for an agent', () => {
      const messages = getMessages(db, { agentId: 'agent-002' });

      expect(messages).toHaveLength(3);
      expect(messages[0].id).toBe('msg-003'); // Most recent first
    });

    it('should filter unread messages only', () => {
      const messages = getMessages(db, {
        agentId: 'agent-002',
        unreadOnly: true,
      });

      expect(messages).toHaveLength(2);
      expect(messages.every((m) => !m.read)).toBe(true);
    });

    it('should filter by channel', () => {
      const messages = getMessages(db, {
        agentId: 'agent-002',
        channel: 'slack',
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-003');
    });

    it('should filter by priority', () => {
      const messages = getMessages(db, {
        agentId: 'agent-002',
        priority: 'high',
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-001');
    });

    it('should filter action required only', () => {
      const messages = getMessages(db, {
        agentId: 'agent-002',
        actionRequiredOnly: true,
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe('msg-001');
    });

    it('should support limit and offset', () => {
      const messages = getMessages(db, {
        agentId: 'agent-002',
        limit: 2,
        offset: 1,
      });

      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe('msg-002');
    });
  });

  describe('markMessageAsRead', () => {
    beforeEach(() => {
      createMessage(db, {
        id: 'msg-001',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'high',
        channel: 'internal',
        read: false,
        message_path: 'inbox/unread/msg-001.md',
      });
    });

    it('should mark a message as read', () => {
      const updated = markMessageAsRead(db, 'msg-001');

      expect(updated).toBe(true);

      const message = getMessage(db, 'msg-001');
      expect(message!.read).toBe(true);
      expect(message!.read_at).toBeDefined();
    });

    it('should return false for non-existent message', () => {
      const updated = markMessageAsRead(db, 'msg-999');

      expect(updated).toBe(false);
    });
  });

  describe('markMessageAsArchived', () => {
    beforeEach(() => {
      createMessage(db, {
        id: 'msg-001',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'high',
        channel: 'internal',
        message_path: 'inbox/unread/msg-001.md',
      });
    });

    it('should mark a message as archived', () => {
      const updated = markMessageAsArchived(db, 'msg-001');

      expect(updated).toBe(true);

      const message = getMessage(db, 'msg-001');
      expect(message!.archived_at).toBeDefined();
    });

    it('should return false for non-existent message', () => {
      const updated = markMessageAsArchived(db, 'msg-999');

      expect(updated).toBe(false);
    });
  });

  describe('getUnreadMessageCount', () => {
    beforeEach(() => {
      createMessage(db, {
        id: 'msg-001',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'high',
        channel: 'internal',
        read: false,
        message_path: 'inbox/unread/msg-001.md',
      });

      createMessage(db, {
        id: 'msg-002',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T11:00:00Z',
        priority: 'normal',
        channel: 'internal',
        read: true,
        message_path: 'inbox/read/msg-002.md',
      });

      createMessage(db, {
        id: 'msg-003',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T12:00:00Z',
        priority: 'urgent',
        channel: 'internal',
        read: false,
        message_path: 'inbox/unread/msg-003.md',
      });
    });

    it('should return correct unread message count', () => {
      const count = getUnreadMessageCount(db, 'agent-002');

      expect(count).toBe(2);
    });

    it('should return 0 for agent with no unread messages', () => {
      const count = getUnreadMessageCount(db, 'agent-001');

      expect(count).toBe(0);
    });
  });

  describe('deleteMessage', () => {
    beforeEach(() => {
      createMessage(db, {
        id: 'msg-001',
        from_agent_id: 'agent-001',
        to_agent_id: 'agent-002',
        timestamp: '2026-01-19T10:00:00Z',
        priority: 'high',
        channel: 'internal',
        message_path: 'inbox/unread/msg-001.md',
      });
    });

    it('should delete a message', () => {
      const deleted = deleteMessage(db, 'msg-001');

      expect(deleted).toBe(true);

      const message = getMessage(db, 'msg-001');
      expect(message).toBeNull();
    });

    it('should return false for non-existent message', () => {
      const deleted = deleteMessage(db, 'msg-999');

      expect(deleted).toBe(false);
    });
  });
});
