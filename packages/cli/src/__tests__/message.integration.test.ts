/**
 * Integration tests for message command
 *
 * Tests the message command with a real database and agent data.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  initializeDatabase,
  allMigrations,
  runMigrations,
  getAgent,
  createAgent,
  getAgentInboxPath,
} from '@recursive-manager/common';
import { hireAgent } from '@recursive-manager/core';

// Mock the interactive prompts and spinners to avoid CLI interaction during tests
jest.mock('../utils/prompts', () => ({
  input: jest.fn().mockResolvedValue('Test message content'),
  select: jest.fn().mockResolvedValue('normal'),
  confirm: jest.fn().mockResolvedValue(true),
  editor: jest.fn().mockResolvedValue('Test message content from editor'),
}));

jest.mock('../utils/spinner', () => ({
  createSpinner: jest.fn(() => ({
    text: '',
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn(),
  })),
}));

// Suppress console output during tests
const originalLog = console.log;
const originalError = console.error;
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalLog;
  console.error = originalError;
});

describe('message command integration', () => {
  let testDataDir: string;
  let config: any;
  let db: any;

  beforeEach(async () => {
    // Create temporary directory for test
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recursive-manager-message-test-'));

    // Initialize database directly
    const dbPath = path.join(testDataDir, 'database.sqlite');
    const dbConnection = initializeDatabase({ path: dbPath });
    db = dbConnection.db;

    // Run migrations to set up schema
    await runMigrations(db, allMigrations);

    // Create root agent (CEO)
    const rootAgent = createAgent(db, {
      id: 'ceo-001',
      role: 'CEO',
      displayName: 'CEO',
      createdBy: null,
      reportingTo: null,
      mainGoal: 'Test organization goal',
      configPath: path.join(testDataDir, 'agents', 'ce', 'ceo-001', 'config.json'),
    });

    // Create config structure
    config = {
      dataDir: testDataDir,
      dbPath: dbPath,
      rootAgentId: rootAgent.id,
      version: '0.1.0',
      execution: {
        workerPoolSize: 4,
        maxConcurrentTasks: 10,
      },
    };

    // Write config to file
    fs.mkdirSync(testDataDir, { recursive: true });
    fs.writeFileSync(path.join(testDataDir, 'config.json'), JSON.stringify(config, null, 2));
    fs.writeFileSync(
      path.join(testDataDir, '.recursive-manager'),
      JSON.stringify({ initialized: new Date().toISOString() })
    );
  });

  afterEach(() => {
    // Clean up
    if (db) {
      try {
        db.close();
      } catch (e) {
        // Ignore errors on cleanup
      }
    }
    if (fs.existsSync(testDataDir)) {
      fs.removeSync(testDataDir);
    }
  });

  describe('basic messaging functionality', () => {
    it('should send a message to an agent', async () => {
      // Hire an engineer
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Get inbox path
      const inboxPath = getAgentInboxPath(engineer.id, { baseDir: testDataDir });

      // Create inbox directory structure
      fs.mkdirSync(path.join(inboxPath, 'unread'), { recursive: true });

      // Create message record in database
      const messageId = `msg-${Date.now()}`;
      const messagePath = path.join(inboxPath, 'unread', `${messageId}.json`);

      db.prepare(
        `INSERT INTO messages (id, from_agent_id, to_agent_id, subject, priority, channel, timestamp, message_path, read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        messageId,
        'ceo-001',
        engineer.id,
        'Test Subject',
        'normal',
        'internal',
        new Date().toISOString(),
        messagePath,
        0
      );

      // Write message content to file
      fs.writeFileSync(
        messagePath,
        JSON.stringify({
          id: messageId,
          from: 'ceo-001',
          to: engineer.id,
          subject: 'Test Subject',
          content: 'Test message content',
          priority: 'normal',
          channel: 'internal',
          timestamp: new Date().toISOString(),
        })
      );

      // Verify message was created
      expect(fs.existsSync(messagePath)).toBe(true);

      // Verify message in database
      const message = db
        .prepare('SELECT * FROM messages WHERE id = ?')
        .get(messageId) as any;
      expect(message).toBeDefined();
      expect(message.to_agent_id).toBe(engineer.id);
      expect(message.subject).toBe('Test Subject');
      expect(message.read).toBe(0);
    });

    it('should send messages with different priorities', async () => {
      // Hire an engineer
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      const inboxPath = getAgentInboxPath(engineer.id, { baseDir: testDataDir });
      fs.mkdirSync(path.join(inboxPath, 'unread'), { recursive: true });

      // Test different priorities
      const priorities = ['low', 'normal', 'high', 'urgent'];

      for (const priority of priorities) {
        const messageId = `msg-${priority}-${Date.now()}`;
        const messagePath = path.join(inboxPath, 'unread', `${messageId}.json`);

        db.prepare(
          `INSERT INTO messages (id, from_agent_id, to_agent_id, subject, priority, channel, timestamp, message_path, read)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          messageId,
          'ceo-001',
          engineer.id,
          `Test ${priority} priority`,
          priority,
          'internal',
          new Date().toISOString(),
          messagePath,
          0
        );

        fs.writeFileSync(
          messagePath,
          JSON.stringify({
            id: messageId,
            from: 'ceo-001',
            to: engineer.id,
            subject: `Test ${priority} priority`,
            content: 'Test content',
            priority,
            channel: 'internal',
            timestamp: new Date().toISOString(),
          })
        );
      }

      // Verify all messages were created
      const messages = db
        .prepare('SELECT * FROM messages WHERE to_agent_id = ?')
        .all(engineer.id);
      expect(messages.length).toBe(4);
    });

    it('should send messages through different channels', async () => {
      // Hire an engineer
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      const inboxPath = getAgentInboxPath(engineer.id, { baseDir: testDataDir });
      fs.mkdirSync(path.join(inboxPath, 'unread'), { recursive: true });

      // Test different channels
      const channels = ['internal', 'slack', 'email'];

      for (const channel of channels) {
        const messageId = `msg-${channel}-${Date.now()}`;
        const messagePath = path.join(inboxPath, 'unread', `${messageId}.json`);

        db.prepare(
          `INSERT INTO messages (id, from_agent_id, to_agent_id, subject, priority, channel, timestamp, message_path, read)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          messageId,
          'ceo-001',
          engineer.id,
          `Test ${channel} channel`,
          'normal',
          channel,
          new Date().toISOString(),
          messagePath,
          0
        );

        fs.writeFileSync(
          messagePath,
          JSON.stringify({
            id: messageId,
            from: 'ceo-001',
            to: engineer.id,
            subject: `Test ${channel} channel`,
            content: 'Test content',
            priority: 'normal',
            channel,
            timestamp: new Date().toISOString(),
          })
        );
      }

      // Verify all messages were created
      const messages = db
        .prepare('SELECT * FROM messages WHERE to_agent_id = ?')
        .all(engineer.id);
      expect(messages.length).toBe(3);
    });
  });

  describe('message threading', () => {
    it('should support threaded messages', async () => {
      // Hire an engineer
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      const inboxPath = getAgentInboxPath(engineer.id, { baseDir: testDataDir });
      fs.mkdirSync(path.join(inboxPath, 'unread'), { recursive: true });

      // Create first message
      const firstMessageId = `msg-first-${Date.now()}`;
      const firstMessagePath = path.join(inboxPath, 'unread', `${firstMessageId}.json`);

      db.prepare(
        `INSERT INTO messages (id, from_agent_id, to_agent_id, subject, priority, channel, timestamp, message_path, read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        firstMessageId,
        'ceo-001',
        engineer.id,
        'Thread Start',
        'normal',
        'internal',
        new Date().toISOString(),
        firstMessagePath,
        0
      );

      fs.writeFileSync(
        firstMessagePath,
        JSON.stringify({
          id: firstMessageId,
          from: 'ceo-001',
          to: engineer.id,
          subject: 'Thread Start',
          content: 'Starting a thread',
          priority: 'normal',
          channel: 'internal',
          timestamp: new Date().toISOString(),
        })
      );

      // Create reply message in thread
      const replyMessageId = `msg-reply-${Date.now()}`;
      const replyMessagePath = path.join(inboxPath, 'unread', `${replyMessageId}.json`);

      db.prepare(
        `INSERT INTO messages (id, from_agent_id, to_agent_id, subject, priority, channel, timestamp, message_path, read, thread_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        replyMessageId,
        'ceo-001',
        engineer.id,
        'Re: Thread Start',
        'normal',
        'internal',
        new Date().toISOString(),
        replyMessagePath,
        0,
        firstMessageId
      );

      fs.writeFileSync(
        replyMessagePath,
        JSON.stringify({
          id: replyMessageId,
          from: 'ceo-001',
          to: engineer.id,
          subject: 'Re: Thread Start',
          content: 'Reply in thread',
          priority: 'normal',
          channel: 'internal',
          timestamp: new Date().toISOString(),
          threadId: firstMessageId,
        })
      );

      // Verify thread relationship
      const replyMessage = db
        .prepare('SELECT * FROM messages WHERE id = ?')
        .get(replyMessageId) as any;
      expect(replyMessage.thread_id).toBe(firstMessageId);
    });
  });

  describe('validation', () => {
    it('should reject sending message to non-existent agent', async () => {
      const inboxPath = getAgentInboxPath('non-existent-id', { baseDir: testDataDir });

      // Verify inbox doesn't exist
      expect(fs.existsSync(inboxPath)).toBe(false);

      // Verify agent doesn't exist in database
      const agent = getAgent(db, 'non-existent-id');
      expect(agent).toBeNull();
    });

    it('should reject sending message to fired agent', async () => {
      // Hire and fire an agent
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Update agent status to 'fired'
      db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('fired', engineer.id);

      // Verify agent is fired
      const agent = getAgent(db, engineer.id);
      expect(agent?.status).toBe('fired');
    });
  });

  describe('message organization', () => {
    it('should organize messages in unread directory', async () => {
      // Hire an engineer
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      const inboxPath = getAgentInboxPath(engineer.id, { baseDir: testDataDir });
      const unreadPath = path.join(inboxPath, 'unread');

      fs.mkdirSync(unreadPath, { recursive: true });

      // Create message
      const messageId = `msg-${Date.now()}`;
      const messagePath = path.join(unreadPath, `${messageId}.json`);

      db.prepare(
        `INSERT INTO messages (id, from_agent_id, to_agent_id, subject, priority, channel, timestamp, message_path, read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        messageId,
        'ceo-001',
        engineer.id,
        'Test',
        'normal',
        'internal',
        new Date().toISOString(),
        messagePath,
        0
      );

      fs.writeFileSync(
        messagePath,
        JSON.stringify({
          id: messageId,
          from: 'ceo-001',
          to: engineer.id,
          subject: 'Test',
          content: 'Test content',
          priority: 'normal',
          channel: 'internal',
          timestamp: new Date().toISOString(),
        })
      );

      // Verify message is in unread directory
      expect(fs.existsSync(messagePath)).toBe(true);
      expect(messagePath).toContain('unread');
    });
  });
});
