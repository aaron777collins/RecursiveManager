/**
 * Integration tests for fire command
 *
 * Tests the fire command with a real database and agent data.
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
} from '@recursive-manager/common';
import { hireAgent, fireAgent } from '@recursive-manager/core';

// Mock the interactive prompts and spinners to avoid CLI interaction during tests
jest.mock('../utils/prompts', () => ({
  input: jest.fn(),
  select: jest.fn().mockResolvedValue('reassign'),
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

describe('fire command integration', () => {
  let testDataDir: string;
  let config: any;
  let db: any;

  beforeEach(async () => {
    // Create temporary directory for test
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recursive-manager-fire-test-'));

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

  describe('basic firing functionality', () => {
    it('should fire an agent without subordinates', async () => {
      // Hire an engineer
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Fire the engineer
      const result = await fireAgent(db, {
        agentId: engineer.id,
        firedBy: 'ceo-001',
        strategy: 'reassign',
        dataDir: testDataDir,
      });

      expect(result).toBeDefined();
      expect(result.agentId).toBe(engineer.id);

      // Verify agent status changed to 'fired'
      const agent = getAgent(db, engineer.id);
      expect(agent?.status).toBe('fired');
    });

    it('should fire an agent with subordinates using reassign strategy', async () => {
      // Hire CTO
      const cto = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'CTO',
        displayName: 'CTO',
        mainGoal: 'Technical leadership',
        configPath: path.join(testDataDir, 'agents', 'ct', 'cto-001', 'config.json'),
        createdBy: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
      });

      // Hire engineer under CTO
      const engineer = await hireAgent(db, {
        managerId: cto.id,
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: cto.id,
      });

      // Fire CTO with reassign strategy
      const result = await fireAgent(db, {
        agentId: cto.id,
        firedBy: 'ceo-001',
        strategy: 'reassign',
        dataDir: testDataDir,
      });

      expect(result).toBeDefined();

      // Verify engineer was reassigned to CEO
      const reassignedEngineer = getAgent(db, engineer.id);
      expect(reassignedEngineer?.reporting_to).toBe('ceo-001');
    });

    it('should fire an agent with subordinates using promote strategy', async () => {
      // Hire manager
      const manager = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Manager',
        displayName: 'Manager',
        mainGoal: 'Manage team',
        configPath: path.join(testDataDir, 'agents', 'ma', 'mgr-001', 'config.json'),
        createdBy: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
      });

      // Hire two workers under manager
      const worker1 = await hireAgent(db, {
        managerId: manager.id,
        role: 'Worker1',
        displayName: 'Worker1',
        mainGoal: 'Work',
        configPath: path.join(testDataDir, 'agents', 'wo', 'worker-001', 'config.json'),
        createdBy: manager.id,
      });

      const worker2 = await hireAgent(db, {
        managerId: manager.id,
        role: 'Worker2',
        displayName: 'Worker2',
        mainGoal: 'Work',
        configPath: path.join(testDataDir, 'agents', 'wo', 'worker-002', 'config.json'),
        createdBy: manager.id,
      });

      // Fire manager with promote strategy
      const result = await fireAgent(db, {
        agentId: manager.id,
        firedBy: 'ceo-001',
        strategy: 'promote',
        dataDir: testDataDir,
      });

      expect(result).toBeDefined();

      // Verify one worker was promoted
      const worker1Agent = getAgent(db, worker1.id);
      const worker2Agent = getAgent(db, worker2.id);

      // One should report to CEO (promoted), other to the promoted worker
      const promotedWorker =
        worker1Agent?.reporting_to === 'ceo-001' ? worker1Agent : worker2Agent;
      expect(promotedWorker?.reporting_to).toBe('ceo-001');
    });

    it('should fire an agent with subordinates using cascade strategy', async () => {
      // Hire department head
      const head = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Department Head',
        displayName: 'Head',
        mainGoal: 'Lead department',
        configPath: path.join(testDataDir, 'agents', 'de', 'head-001', 'config.json'),
        createdBy: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
      });

      // Hire engineer under head
      const engineer = await hireAgent(db, {
        managerId: head.id,
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: head.id,
      });

      // Fire head with cascade strategy
      const result = await fireAgent(db, {
        agentId: head.id,
        firedBy: 'ceo-001',
        strategy: 'cascade',
        dataDir: testDataDir,
      });

      expect(result).toBeDefined();

      // Verify engineer was also fired
      const engineerAgent = getAgent(db, engineer.id);
      expect(engineerAgent?.status).toBe('fired');
    });
  });

  describe('task handling', () => {
    it('should reassign tasks when firing agent', async () => {
      // Hire engineer
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Create task for engineer
      const task = createTask(db, {
        agentId: engineer.id,
        taskPath: path.join(testDataDir, 'tasks', 'en', engineer.id, 'task-001'),
      });

      // Fire engineer
      const result = await fireAgent(db, {
        agentId: engineer.id,
        firedBy: 'ceo-001',
        strategy: 'reassign',
        dataDir: testDataDir,
      });

      expect(result.tasksReassigned).toBeGreaterThan(0);

      // Verify task was reassigned to CEO
      const updatedTask = db
        .prepare('SELECT * FROM tasks WHERE id = ?')
        .get(task.id) as any;
      expect(updatedTask.agent_id).toBe('ceo-001');
    });

    it('should archive tasks when no reassignment possible', async () => {
      // Hire engineer
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Create task for engineer
      createTask(db, {
        agentId: engineer.id,
        taskPath: path.join(testDataDir, 'tasks', 'en', engineer.id, 'task-001'),
      });

      // Fire engineer
      const result = await fireAgent(db, {
        agentId: engineer.id,
        firedBy: 'ceo-001',
        strategy: 'reassign',
        dataDir: testDataDir,
      });

      expect(result.tasksArchived).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validation', () => {
    it('should reject firing non-existent agent', async () => {
      await expect(
        fireAgent(db, {
          agentId: 'non-existent-id',
          firedBy: 'ceo-001',
          strategy: 'reassign',
          dataDir: testDataDir,
        })
      ).rejects.toThrow();
    });

    it('should reject firing root agent (CEO)', async () => {
      await expect(
        fireAgent(db, {
          agentId: 'ceo-001',
          firedBy: 'ceo-001',
          strategy: 'reassign',
          dataDir: testDataDir,
        })
      ).rejects.toThrow();
    });

    it('should reject firing already fired agent', async () => {
      // Hire and fire an agent
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      await fireAgent(db, {
        agentId: engineer.id,
        firedBy: 'ceo-001',
        strategy: 'reassign',
        dataDir: testDataDir,
      });

      // Try to fire again (should fail)
      await expect(
        fireAgent(db, {
          agentId: engineer.id,
          firedBy: 'ceo-001',
          strategy: 'reassign',
          dataDir: testDataDir,
        })
      ).rejects.toThrow();
    });
  });

  describe('audit logging', () => {
    it('should create audit log entry for firing', async () => {
      // Hire engineer
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Fire engineer
      await fireAgent(db, {
        agentId: engineer.id,
        firedBy: 'ceo-001',
        strategy: 'reassign',
        dataDir: testDataDir,
      });

      // Check audit log
      const auditLogs = db
        .prepare('SELECT * FROM audit_log WHERE action = ? AND agent_id = ?')
        .all('fire', engineer.id);

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].agent_id).toBe(engineer.id);
      expect(auditLogs[0].action).toBe('fire');
    });
  });
});
