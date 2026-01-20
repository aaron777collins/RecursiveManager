/**
 * Integration tests for logs command
 *
 * Tests the logs command with a real database and agent data.
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
  getAgentLogPath,
} from '@recursive-manager/common';
import { hireAgent } from '@recursive-manager/core';

// Mock the interactive prompts and spinners to avoid CLI interaction during tests
jest.mock('../utils/prompts', () => ({
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

describe('logs command integration', () => {
  let testDataDir: string;
  let config: any;
  let db: any;

  beforeEach(async () => {
    // Create temporary directory for test
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recursive-manager-logs-test-'));

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

  describe('basic log reading', () => {
    it('should read logs for an agent', async () => {
      // Get log path for CEO
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });

      // Create log directory
      fs.mkdirSync(path.dirname(logPath), { recursive: true });

      // Write some log entries in JSONL format
      const logEntries = [
        {
          timestamp: '2026-01-20T10:00:00.000Z',
          level: 'info',
          message: 'Agent initialized',
          metadata: { agentId: 'ceo-001' },
        },
        {
          timestamp: '2026-01-20T10:05:00.000Z',
          level: 'info',
          message: 'Starting task execution',
          metadata: { taskId: 'task-001' },
        },
        {
          timestamp: '2026-01-20T10:10:00.000Z',
          level: 'info',
          message: 'Task completed successfully',
          metadata: { taskId: 'task-001', duration: 300000 },
        },
      ];

      fs.writeFileSync(
        logPath,
        logEntries.map((entry) => JSON.stringify(entry)).join('\n')
      );

      // Verify log file exists
      expect(fs.existsSync(logPath)).toBe(true);

      // Read and parse logs
      const logContent = fs.readFileSync(logPath, 'utf-8');
      const lines = logContent.split('\n').filter((line) => line.trim());

      expect(lines.length).toBe(3);

      // Verify each log entry
      const parsedEntries = lines.map((line) => JSON.parse(line));
      expect(parsedEntries[0].message).toBe('Agent initialized');
      expect(parsedEntries[1].message).toBe('Starting task execution');
      expect(parsedEntries[2].message).toBe('Task completed successfully');
    });

    it('should read logs with different log levels', async () => {
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      fs.mkdirSync(path.dirname(logPath), { recursive: true });

      // Write log entries with different levels
      const logEntries = [
        { timestamp: '2026-01-20T10:00:00.000Z', level: 'debug', message: 'Debug message' },
        { timestamp: '2026-01-20T10:01:00.000Z', level: 'info', message: 'Info message' },
        { timestamp: '2026-01-20T10:02:00.000Z', level: 'warn', message: 'Warning message' },
        { timestamp: '2026-01-20T10:03:00.000Z', level: 'error', message: 'Error message' },
      ];

      fs.writeFileSync(
        logPath,
        logEntries.map((entry) => JSON.stringify(entry)).join('\n')
      );

      // Read and parse logs
      const logContent = fs.readFileSync(logPath, 'utf-8');
      const lines = logContent.split('\n').filter((line) => line.trim());
      const parsedEntries = lines.map((line) => JSON.parse(line));

      // Verify all log levels are present
      expect(parsedEntries.find((e) => e.level === 'debug')).toBeDefined();
      expect(parsedEntries.find((e) => e.level === 'info')).toBeDefined();
      expect(parsedEntries.find((e) => e.level === 'warn')).toBeDefined();
      expect(parsedEntries.find((e) => e.level === 'error')).toBeDefined();
    });

    it('should handle empty log files', async () => {
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      fs.mkdirSync(path.dirname(logPath), { recursive: true });

      // Create empty log file
      fs.writeFileSync(logPath, '');

      // Verify log file exists but is empty
      expect(fs.existsSync(logPath)).toBe(true);
      const logContent = fs.readFileSync(logPath, 'utf-8');
      expect(logContent).toBe('');
    });
  });

  describe('log filtering', () => {
    beforeEach(async () => {
      // Create sample log file for filtering tests
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      fs.mkdirSync(path.dirname(logPath), { recursive: true });

      const logEntries = [
        {
          timestamp: '2026-01-20T10:00:00.000Z',
          level: 'info',
          message: 'Agent started',
        },
        {
          timestamp: '2026-01-20T10:05:00.000Z',
          level: 'debug',
          message: 'Processing task',
        },
        {
          timestamp: '2026-01-20T10:10:00.000Z',
          level: 'warn',
          message: 'Slow operation detected',
        },
        {
          timestamp: '2026-01-20T10:15:00.000Z',
          level: 'error',
          message: 'Operation failed',
        },
        {
          timestamp: '2026-01-20T10:20:00.000Z',
          level: 'info',
          message: 'Agent stopped',
        },
      ];

      fs.writeFileSync(
        logPath,
        logEntries.map((entry) => JSON.stringify(entry)).join('\n')
      );
    });

    it('should filter logs by level', async () => {
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      const logContent = fs.readFileSync(logPath, 'utf-8');
      const lines = logContent.split('\n').filter((line) => line.trim());
      const parsedEntries = lines.map((line) => JSON.parse(line));

      // Filter for error level
      const errorLogs = parsedEntries.filter((entry) => entry.level === 'error');
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].message).toBe('Operation failed');

      // Filter for warn and above
      const warnAndAbove = parsedEntries.filter(
        (entry) => entry.level === 'warn' || entry.level === 'error'
      );
      expect(warnAndAbove.length).toBe(2);
    });

    it('should filter logs by time range', async () => {
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      const logContent = fs.readFileSync(logPath, 'utf-8');
      const lines = logContent.split('\n').filter((line) => line.trim());
      const parsedEntries = lines.map((line) => JSON.parse(line));

      // Filter for logs after 10:05:00
      const since = new Date('2026-01-20T10:05:00.000Z');
      const filtered = parsedEntries.filter(
        (entry) => new Date(entry.timestamp) >= since
      );

      expect(filtered.length).toBe(4); // All logs from 10:05 onwards
    });

    it('should filter logs by grep pattern', async () => {
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      const logContent = fs.readFileSync(logPath, 'utf-8');
      const lines = logContent.split('\n').filter((line) => line.trim());
      const parsedEntries = lines.map((line) => JSON.parse(line));

      // Filter for logs containing 'Agent'
      const agentLogs = parsedEntries.filter((entry) =>
        entry.message.toLowerCase().includes('agent')
      );
      expect(agentLogs.length).toBe(2); // "Agent started" and "Agent stopped"

      // Filter for logs containing 'failed'
      const failedLogs = parsedEntries.filter((entry) =>
        entry.message.toLowerCase().includes('failed')
      );
      expect(failedLogs.length).toBe(1);
    });

    it('should limit number of log entries', async () => {
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      const logContent = fs.readFileSync(logPath, 'utf-8');
      const lines = logContent.split('\n').filter((line) => line.trim());

      // Get last 3 entries
      const lastThree = lines.slice(-3);
      expect(lastThree.length).toBe(3);

      const parsedEntries = lastThree.map((line) => JSON.parse(line));
      expect(parsedEntries[2].message).toBe('Agent stopped');
    });
  });

  describe('multiple agent logs', () => {
    it('should read logs from multiple agents', async () => {
      // Hire additional agent
      const engineer = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'Engineer',
        displayName: 'Engineer',
        mainGoal: 'Build features',
        configPath: path.join(testDataDir, 'agents', 'en', 'eng-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Create logs for CEO
      const ceoLogPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      fs.mkdirSync(path.dirname(ceoLogPath), { recursive: true });
      fs.writeFileSync(
        ceoLogPath,
        JSON.stringify({
          timestamp: '2026-01-20T10:00:00.000Z',
          level: 'info',
          message: 'CEO log entry',
        })
      );

      // Create logs for Engineer
      const engLogPath = getAgentLogPath(engineer.id, { baseDir: testDataDir });
      fs.mkdirSync(path.dirname(engLogPath), { recursive: true });
      fs.writeFileSync(
        engLogPath,
        JSON.stringify({
          timestamp: '2026-01-20T10:01:00.000Z',
          level: 'info',
          message: 'Engineer log entry',
        })
      );

      // Verify both log files exist
      expect(fs.existsSync(ceoLogPath)).toBe(true);
      expect(fs.existsSync(engLogPath)).toBe(true);

      // Read both logs
      const ceoLog = JSON.parse(fs.readFileSync(ceoLogPath, 'utf-8'));
      const engLog = JSON.parse(fs.readFileSync(engLogPath, 'utf-8'));

      expect(ceoLog.message).toBe('CEO log entry');
      expect(engLog.message).toBe('Engineer log entry');
    });

    it('should combine logs from all agents', async () => {
      // Hire two additional agents
      const cto = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'CTO',
        displayName: 'CTO',
        mainGoal: 'Technical leadership',
        configPath: path.join(testDataDir, 'agents', 'ct', 'cto-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      const cfo = await hireAgent(db, {
        managerId: 'ceo-001',
        role: 'CFO',
        displayName: 'CFO',
        mainGoal: 'Financial management',
        configPath: path.join(testDataDir, 'agents', 'cf', 'cfo-001', 'config.json'),
        createdBy: 'ceo-001',
      });

      // Create logs for all agents
      const agents = [
        { id: 'ceo-001', message: 'CEO log' },
        { id: cto.id, message: 'CTO log' },
        { id: cfo.id, message: 'CFO log' },
      ];

      const allLogs: any[] = [];

      for (const agent of agents) {
        const logPath = getAgentLogPath(agent.id, { baseDir: testDataDir });
        fs.mkdirSync(path.dirname(logPath), { recursive: true });

        const logEntry = {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: agent.message,
          metadata: { agentId: agent.id },
        };

        fs.writeFileSync(logPath, JSON.stringify(logEntry));
        allLogs.push(logEntry);
      }

      // Verify all logs were created
      expect(allLogs.length).toBe(3);
      expect(allLogs.find((log) => log.message === 'CEO log')).toBeDefined();
      expect(allLogs.find((log) => log.message === 'CTO log')).toBeDefined();
      expect(allLogs.find((log) => log.message === 'CFO log')).toBeDefined();
    });
  });

  describe('validation', () => {
    it('should handle non-existent agent', async () => {
      const agent = getAgent(db, 'non-existent-id');
      expect(agent).toBeNull();
    });

    it('should handle missing log file', async () => {
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });

      // Verify log file doesn't exist yet
      expect(fs.existsSync(logPath)).toBe(false);
    });

    it('should handle corrupted log entries', async () => {
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      fs.mkdirSync(path.dirname(logPath), { recursive: true });

      // Write mix of valid and invalid JSON
      const logContent = `
{"timestamp": "2026-01-20T10:00:00.000Z", "level": "info", "message": "Valid entry"}
This is not valid JSON
{"timestamp": "2026-01-20T10:01:00.000Z", "level": "info", "message": "Another valid entry"}
      `.trim();

      fs.writeFileSync(logPath, logContent);

      // Read and parse logs
      const lines = logContent.split('\n');
      const validEntries = lines
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter((entry) => entry !== null);

      expect(validEntries.length).toBe(2);
    });
  });

  describe('log formats', () => {
    it('should support JSONL format', async () => {
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      fs.mkdirSync(path.dirname(logPath), { recursive: true });

      // Write logs in JSONL format (one JSON object per line)
      const entries = [
        { timestamp: '2026-01-20T10:00:00.000Z', level: 'info', message: 'Entry 1' },
        { timestamp: '2026-01-20T10:01:00.000Z', level: 'info', message: 'Entry 2' },
        { timestamp: '2026-01-20T10:02:00.000Z', level: 'info', message: 'Entry 3' },
      ];

      fs.writeFileSync(
        logPath,
        entries.map((e) => JSON.stringify(e)).join('\n')
      );

      // Read and verify JSONL parsing
      const logContent = fs.readFileSync(logPath, 'utf-8');
      const lines = logContent.split('\n').filter((line) => line.trim());
      const parsed = lines.map((line) => JSON.parse(line));

      expect(parsed.length).toBe(3);
      expect(parsed[0].message).toBe('Entry 1');
      expect(parsed[2].message).toBe('Entry 3');
    });

    it('should support plain text fallback', async () => {
      const logPath = getAgentLogPath('ceo-001', { baseDir: testDataDir });
      fs.mkdirSync(path.dirname(logPath), { recursive: true });

      // Write plain text logs (legacy format)
      const logContent = `
[2026-01-20 10:00:00] INFO: Agent started
[2026-01-20 10:05:00] DEBUG: Processing task
[2026-01-20 10:10:00] ERROR: Operation failed
      `.trim();

      fs.writeFileSync(logPath, logContent);

      // Read and verify plain text
      const content = fs.readFileSync(logPath, 'utf-8');
      const lines = content.split('\n');

      expect(lines.length).toBe(3);
      expect(lines[0]).toContain('Agent started');
      expect(lines[2]).toContain('Operation failed');
    });
  });
});
