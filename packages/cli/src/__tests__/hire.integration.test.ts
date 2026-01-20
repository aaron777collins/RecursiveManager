/**
 * Integration tests for hire command
 *
 * Tests the hire command with a real database and agent data.
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
} from '@recursive-manager/common';
import { hireAgent } from '@recursive-manager/core';

// Mock the interactive prompts and spinners to avoid CLI interaction during tests
jest.mock('../utils/prompts', () => ({
  input: jest.fn(),
  select: jest.fn(),
  confirm: jest.fn().mockResolvedValue(true),
  number: jest.fn(),
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

describe('hire command integration', () => {
  let testDataDir: string;
  let config: any;
  let db: any;

  beforeEach(async () => {
    // Create temporary directory for test
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recursive-manager-hire-test-'));

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

  describe('basic hiring functionality', () => {
    it('should hire a new agent with minimal configuration', async () => {
      // Hire a CTO under CEO
      const result = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'CTO',
        displayName: 'Chief Technology Officer',
        mainGoal: 'Lead technical strategy and architecture',
        configPath: path.join(testDataDir, 'agents', 'ct', 'cto-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.role).toBe('CTO');
      expect(result.displayName).toBe('Chief Technology Officer');

      // Verify agent was created in database
      const agent = getAgent(db, result.id);
      expect(agent).toBeDefined();
      expect(agent?.role).toBe('CTO');
      expect(agent?.reporting_to).toBe('ceo-001');
    });

    it('should hire multiple agents under the same manager', async () => {
      // Hire CTO
      const cto = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'CTO',
        displayName: 'CTO',
        mainGoal: 'Technical leadership',
        configPath: path.join(testDataDir, 'agents', 'ct', 'cto-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Hire CFO
      const cfo = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'CFO',
        displayName: 'CFO',
        mainGoal: 'Financial management',
        configPath: path.join(testDataDir, 'agents', 'cf', 'cfo-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      expect(cto.id).toBeDefined();
      expect(cfo.id).toBeDefined();
      expect(cto.id).not.toBe(cfo.id);

      // Verify both report to CEO
      const ctoAgent = getAgent(db, cto.id);
      const cfoAgent = getAgent(db, cfo.id);
      expect(ctoAgent?.reporting_to).toBe('ceo-001');
      expect(cfoAgent?.reporting_to).toBe('ceo-001');
    });

    it('should create hierarchical structure with multiple levels', async () => {
      // Hire CTO under CEO
      const cto = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'CTO',
        displayName: 'CTO',
        mainGoal: 'Technical leadership',
        configPath: path.join(testDataDir, 'agents', 'ct', 'cto-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Hire Engineering Manager under CTO
      const engManager = await hireAgent(db, {
        managerId: cto.id,
        role: 'Engineering Manager',
        displayName: 'Eng Manager',
        mainGoal: 'Manage engineering team',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-mgr-001', 'config.json'),
        createdBy: cto.id,
      });

      // Verify hierarchy
      const ctoAgent = getAgent(db, cto.id);
      const engMgrAgent = getAgent(db, engManager.id);

      expect(ctoAgent?.reporting_to).toBe('ceo-001');
      expect(engMgrAgent?.reporting_to).toBe(cto.id);
    });
  });

  describe('agent permissions and capabilities', () => {
    it('should set hiring permissions correctly', async () => {
      const result = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'CTO',
        displayName: 'CTO',
        mainGoal: 'Technical leadership',
        configPath: path.join(testDataDir, 'agents', 'ct', 'cto-001', 'config.json'),
        createdBy: 'ceo-001',
        canHire: true,
        maxSubordinates: 5,
        hiringBudget: 3,
      });

      const agent = getAgent(db, result.id);
      expect(agent?.can_hire).toBe(1);
      expect(agent?.max_subordinates).toBe(5);
      expect(agent?.hiring_budget).toBe(3);
    });

    it('should set firing permissions correctly', async () => {
      const result = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'CTO',
        displayName: 'CTO',
        mainGoal: 'Technical leadership',
        configPath: path.join(testDataDir, 'agents', 'ct', 'cto-001', 'config.json'),
        createdBy: 'ceo-001',
        canFire: true,
      });

      const agent = getAgent(db, result.id);
      expect(agent?.can_fire).toBe(1);
    });

    it('should set escalation permissions correctly', async () => {
      const result = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Senior Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
        canEscalate: true,
      });

      const agent = getAgent(db, result.id);
      expect(agent?.can_escalate).toBe(1);
    });
  });

  describe('validation', () => {
    it('should reject hiring under non-existent manager', async () => {
      await expect(
        hireAgent(db, {
          managerId: 'non-existent-id',
          role: 'Engineer',
          displayName: 'Engineer',
          mainGoal: 'Build stuff',
          configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
          createdBy: 'ceo-001',
        })
      ).rejects.toThrow();
    });

    it('should reject hiring when manager cannot hire', async () => {
      // Create agent without hiring permission
      const worker = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Worker',
        displayName: 'Worker',
        mainGoal: 'Do work',
        configPath: path.join(testDataDir, 'agents', 'wo', 'worker-001', 'config.json'),
        createdBy: 'ceo-001',
        canHire: false,
      });

      // Try to hire under worker (should fail)
      await expect(
        hireAgent(db, {
          managerId: worker.id,
          role: 'Junior',
          displayName: 'Junior',
          mainGoal: 'Learn',
          configPath: path.join(testDataDir, 'agents', 'ju', 'junior-001', 'config.json'),
          createdBy: worker.id,
        })
      ).rejects.toThrow();
    });

    it('should reject hiring when manager exceeds max subordinates', async () => {
      // Create manager with max 1 subordinate
      const manager = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Manager',
        displayName: 'Manager',
        mainGoal: 'Manage team',
        configPath: path.join(testDataDir, 'agents', 'ma', 'mgr-001', 'config.json'),
        createdBy: 'ceo-001',
        canHire: true,
        maxSubordinates: 1,
      });

      // Hire first subordinate (should succeed)
      await hireAgent(db, {
        managerId: manager.id,
        role: 'Worker1',
        displayName: 'Worker1',
        mainGoal: 'Work',
        configPath: path.join(testDataDir, 'agents', 'wo', 'worker-001', 'config.json'),
        createdBy: manager.id,
      });

      // Try to hire second subordinate (should fail)
      await expect(
        hireAgent(db, {
          managerId: manager.id,
          role: 'Worker2',
          displayName: 'Worker2',
          mainGoal: 'Work',
          configPath: path.join(testDataDir, 'agents', 'wo', 'worker-002', 'config.json'),
          createdBy: manager.id,
        })
      ).rejects.toThrow();
    });
  });

  describe('audit logging', () => {
    it('should create audit log entry for hiring', async () => {
      const result = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'CTO',
        displayName: 'CTO',
        mainGoal: 'Technical leadership',
        configPath: path.join(testDataDir, 'agents', 'ct', 'cto-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Check audit log
      const auditLogs = db
        .prepare('SELECT * FROM audit_log WHERE action = ? AND agent_id = ?')
        .all('hire', result.id);

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].agent_id).toBe(result.id);
      expect(auditLogs[0].action).toBe('hire');
    });
  });
});
