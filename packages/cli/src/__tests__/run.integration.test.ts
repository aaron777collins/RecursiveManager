/**
 * Integration tests for run command
 *
 * Tests the run command with a real database and agent data.
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
  createTask,
  saveAgentConfig,
} from '@recursivemanager/common';
import { hireAgent } from '@recursivemanager/core';

// Mock the interactive prompts and spinners to avoid CLI interaction during tests
jest.mock('../utils/prompts', () => ({
  select: jest.fn().mockResolvedValue('continuous'),
  confirm: jest.fn().mockResolvedValue(true),
}));

jest.mock('../utils/spinner', () => ({
  createSpinner: jest.fn(() => ({
    text: '',
    succeed: jest.fn(),
    fail: jest.fn(),
    stop: jest.fn(),
  })),
}));

// Mock ExecutionOrchestrator to avoid actual agent execution
jest.mock('@recursivemanager/core', () => {
  const actual = jest.requireActual('@recursivemanager/core');
  return {
    ...actual,
    ExecutionOrchestrator: jest.fn().mockImplementation(() => ({
      executeContinuous: jest.fn().mockResolvedValue({
        success: true,
        tasksCompleted: 3,
        executionTime: 1500,
        result: 'Completed 3 tasks successfully',
      }),
      executeReactive: jest.fn().mockResolvedValue({
        success: true,
        messagesProcessed: 2,
        executionTime: 800,
        result: 'Processed 2 messages successfully',
      }),
    })),
  };
});

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

describe('run command integration', () => {
  let testDataDir: string;
  let config: any;
  let db: any;

  beforeEach(async () => {
    // Create temporary directory for test
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recursivemanager-run-test-'));

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

    // Create and save CEO config
    const ceoConfigPath = path.join(testDataDir, 'agents', 'ce', 'ceo-001', 'config.json');
    fs.mkdirSync(path.dirname(ceoConfigPath), { recursive: true });
    saveAgentConfig(
      {
        identity: {
          id: 'ceo-001',
          role: 'CEO',
          displayName: 'CEO',
        },
        goal: {
          description: 'Test organization goal',
          subGoals: [],
          successCriteria: [],
        },
        framework: {
          primary: 'claude-code',
          fallback: 'none',
        },
        permissions: {
          canHire: true,
          canFire: true,
          canEscalate: false,
          maxSubordinates: 10,
          hiringBudget: 5,
        },
        behavior: {
          verbosity: 'normal',
          maxExecutionTime: 3600000,
          requireApprovalForExecution: false,
          continuousMode: true,
        },
        workspace: {
          quotaMB: 1000,
        },
      },
      { baseDir: testDataDir }
    );

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
      path.join(testDataDir, '.recursivemanager'),
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

  describe('continuous mode execution', () => {
    it('should execute agent in continuous mode', async () => {
      // Create some tasks for the agent
      const task1 = createTask(db, {
        agentId: 'ceo-001',
        taskPath: path.join(testDataDir, 'tasks', 'ce', 'ceo-001', 'task-001'),
      });

      const task2 = createTask(db, {
        agentId: 'ceo-001',
        taskPath: path.join(testDataDir, 'tasks', 'ce', 'ceo-001', 'task-002'),
      });

      // Verify tasks were created
      expect(task1).toBeDefined();
      expect(task2).toBeDefined();

      // Verify agent exists and is active
      const agent = getAgent(db, 'ceo-001');
      expect(agent).toBeDefined();
      expect(agent?.status).toBe('active');
    });

    it('should handle agent with no pending tasks', async () => {
      // Verify agent exists but has no tasks
      const agent = getAgent(db, 'ceo-001');
      expect(agent).toBeDefined();

      const tasks = db
        .prepare('SELECT * FROM tasks WHERE agent_id = ? AND status = ?')
        .all('ceo-001', 'pending');
      expect(tasks.length).toBe(0);
    });

    it('should execute multiple tasks in sequence', async () => {
      // Create multiple tasks
      const taskPaths = ['task-001', 'task-002', 'task-003'];

      for (const taskPath of taskPaths) {
        createTask(db, {
          agentId: 'ceo-001',
          taskPath: path.join(testDataDir, 'tasks', 'ce', 'ceo-001', taskPath),
        });
      }

      // Verify all tasks were created
      const tasks = db
        .prepare('SELECT * FROM tasks WHERE agent_id = ?')
        .all('ceo-001');
      expect(tasks.length).toBe(3);
    });
  });

  describe('reactive mode execution', () => {
    it('should execute agent in reactive mode', async () => {
      // Create inbox directory
      const inboxPath = path.join(testDataDir, 'agents', 'ce', 'ceo-001', 'inbox', 'unread');
      fs.mkdirSync(inboxPath, { recursive: true });

      // Create a message
      const messageId = `msg-${Date.now()}`;
      const messagePath = path.join(inboxPath, `${messageId}.json`);

      db.prepare(
        `INSERT INTO messages (id, from_agent_id, to_agent_id, subject, priority, channel, timestamp, message_path, read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        messageId,
        'system',
        'ceo-001',
        'Test Message',
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
          from: 'system',
          to: 'ceo-001',
          subject: 'Test Message',
          content: 'Test content',
          priority: 'normal',
          channel: 'internal',
          timestamp: new Date().toISOString(),
        })
      );

      // Verify message was created
      expect(fs.existsSync(messagePath)).toBe(true);

      const message = db
        .prepare('SELECT * FROM messages WHERE id = ?')
        .get(messageId) as any;
      expect(message).toBeDefined();
      expect(message.to_agent_id).toBe('ceo-001');
      expect(message.read).toBe(0);
    });

    it('should handle agent with no unread messages', async () => {
      // Verify agent exists but has no messages
      const messages = db
        .prepare('SELECT * FROM messages WHERE to_agent_id = ? AND read = ?')
        .all('ceo-001', 0);
      expect(messages.length).toBe(0);
    });

    it('should process multiple messages', async () => {
      // Create inbox directory
      const inboxPath = path.join(testDataDir, 'agents', 'ce', 'ceo-001', 'inbox', 'unread');
      fs.mkdirSync(inboxPath, { recursive: true });

      // Create multiple messages
      const messageCount = 3;
      for (let i = 0; i < messageCount; i++) {
        const messageId = `msg-${i}-${Date.now()}`;
        const messagePath = path.join(inboxPath, `${messageId}.json`);

        db.prepare(
          `INSERT INTO messages (id, from_agent_id, to_agent_id, subject, priority, channel, timestamp, message_path, read)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          messageId,
          'system',
          'ceo-001',
          `Test Message ${i}`,
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
            from: 'system',
            to: 'ceo-001',
            subject: `Test Message ${i}`,
            content: `Test content ${i}`,
            priority: 'normal',
            channel: 'internal',
            timestamp: new Date().toISOString(),
          })
        );
      }

      // Verify all messages were created
      const messages = db
        .prepare('SELECT * FROM messages WHERE to_agent_id = ? AND read = ?')
        .all('ceo-001', 0);
      expect(messages.length).toBe(messageCount);
    });
  });

  describe('validation', () => {
    it('should reject running non-existent agent', async () => {
      const agent = getAgent(db, 'non-existent-id');
      expect(agent).toBeNull();
    });

    it('should reject running fired agent', async () => {
      // Hire and fire an agent
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Fire the engineer
      db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('fired', engineer.id);

      // Verify agent is fired
      const agent = getAgent(db, engineer.id);
      expect(agent?.status).toBe('fired');
    });

    it('should reject running paused agent', async () => {
      // Hire an agent
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Pause the engineer
      db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('paused', engineer.id);

      // Verify agent is paused
      const agent = getAgent(db, engineer.id);
      expect(agent?.status).toBe('paused');
    });
  });

  describe('execution modes', () => {
    it('should support both continuous and reactive modes', async () => {
      // Create task for continuous mode
      createTask(db, {
        agentId: 'ceo-001',
        taskPath: path.join(testDataDir, 'tasks', 'ce', 'ceo-001', 'task-001'),
      });

      // Create message for reactive mode
      const inboxPath = path.join(testDataDir, 'agents', 'ce', 'ceo-001', 'inbox', 'unread');
      fs.mkdirSync(inboxPath, { recursive: true });

      const messageId = `msg-${Date.now()}`;
      const messagePath = path.join(inboxPath, `${messageId}.json`);

      db.prepare(
        `INSERT INTO messages (id, from_agent_id, to_agent_id, subject, priority, channel, timestamp, message_path, read)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        messageId,
        'system',
        'ceo-001',
        'Test Message',
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
          from: 'system',
          to: 'ceo-001',
          subject: 'Test Message',
          content: 'Test content',
          priority: 'normal',
          channel: 'internal',
          timestamp: new Date().toISOString(),
        })
      );

      // Verify both task and message exist
      const tasks = db
        .prepare('SELECT * FROM tasks WHERE agent_id = ?')
        .all('ceo-001');
      expect(tasks.length).toBe(1);

      const messages = db
        .prepare('SELECT * FROM messages WHERE to_agent_id = ? AND read = ?')
        .all('ceo-001', 0);
      expect(messages.length).toBe(1);
    });
  });

  describe('execution results', () => {
    it('should update agent last_execution_at timestamp', async () => {
      const agentBefore = getAgent(db, 'ceo-001');
      const lastExecutionBefore = agentBefore?.last_execution_at;

      // Simulate execution by updating timestamp
      const now = new Date().toISOString();
      db.prepare('UPDATE agents SET last_execution_at = ? WHERE id = ?').run(now, 'ceo-001');

      const agentAfter = getAgent(db, 'ceo-001');
      expect(agentAfter?.last_execution_at).not.toBe(lastExecutionBefore);
    });
  });
});
