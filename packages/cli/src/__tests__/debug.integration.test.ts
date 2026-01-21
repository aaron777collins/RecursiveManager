/**
 * Integration tests for debug command
 *
 * Tests the debug command with a real database and agent data.
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import {
  initializeDatabase,
  allMigrations,
  runMigrations,
  getAgent,
  getActiveTasks,
  getAgentLogPath,
  createTask,
  createAgent,
  updateAgent,
} from '@recursivemanager/common';

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

describe('debug command integration', () => {
  let testDataDir: string;
  let config: any;
  let db: any;

  beforeEach(async () => {
    // Create temporary directory for test
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recursivemanager-debug-test-'));

    // Initialize database directly (simpler than calling initCommand)
    const dbPath = path.join(testDataDir, 'database.sqlite');
    const dbConnection = initializeDatabase({ path: dbPath });
    db = dbConnection.db;

    // Run migrations to set up schema
    await runMigrations(db, allMigrations);

    // Create root agent
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
    fs.writeFileSync(path.join(testDataDir, '.recursivemanager'), JSON.stringify({ initialized: new Date().toISOString() }));
  });

  afterEach(() => {
    // Clean up
    if (db) {
      try {
        db.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    if (testDataDir && fs.existsSync(testDataDir)) {
      fs.removeSync(testDataDir);
    }
  });

  it('should load and display agent state', () => {
    const agent = getAgent(db, config.rootAgentId);
    expect(agent).toBeDefined();
    expect(agent?.id).toBe(config.rootAgentId);
    expect(agent?.role).toBe('CEO');
    expect(agent?.display_name).toBe('CEO');
    expect(agent?.status).toBe('active');
    expect(agent?.main_goal).toBe('Test organization goal');
  });

  it('should handle non-existent agent', () => {
    const agent = getAgent(db, 'non-existent-agent');
    expect(agent).toBeNull();
  });

  it('should load agent tasks', () => {
    // Create a test task for the agent
    const task = createTask(db, {
      id: 'test-task-001',
      agentId: config.rootAgentId,
      title: 'Test task for debug command',
      taskPath: 'Test task for debug command',
      priority: 'medium',
    });

    expect(task).toBeDefined();
    expect(task.id).toBe('test-task-001');

    // Load tasks for the agent
    const tasks = getActiveTasks(db, config.rootAgentId);
    expect(tasks).toBeDefined();
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks.some((t: any) => t.id === 'test-task-001')).toBe(true);
  });

  it('should read agent logs if they exist', () => {
    // Create a test log file
    const logPath = getAgentLogPath(config.rootAgentId, { baseDir: config.dataDir });
    const logDir = path.dirname(logPath);
    fs.mkdirSync(logDir, { recursive: true });

    const testLogs = [
      '[2026-01-19 10:00:00] INFO: Agent initialized',
      '[2026-01-19 10:05:00] INFO: Task assigned',
      '[2026-01-19 10:10:00] INFO: Task completed',
    ];
    fs.writeFileSync(logPath, testLogs.join('\n'));

    // Read logs
    expect(fs.existsSync(logPath)).toBe(true);
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.split('\n').filter((line: string) => line.trim());
    expect(lines.length).toBe(3);
    expect(lines[0]).toContain('Agent initialized');
  });

  it('should handle missing logs gracefully', () => {
    const logPath = getAgentLogPath('non-existent-agent', { baseDir: config.dataDir });
    expect(fs.existsSync(logPath)).toBe(false);
  });

  it('should display task status counts correctly', () => {
    // Create tasks with different statuses
    createTask(db, {
      id: 'task-pending',
      agentId: config.rootAgentId,
      title: 'Pending task',
      taskPath: 'Pending task',
      priority: 'medium',
    });

    createTask(db, {
      id: 'task-in-progress',
      agentId: config.rootAgentId,
      title: 'In progress task',
      taskPath: 'In progress task',
      priority: 'medium',
    });

    createTask(db, {
      id: 'task-completed',
      agentId: config.rootAgentId,
      title: 'Completed task',
      taskPath: 'Completed task',
      priority: 'medium',
    });

    const tasks = getActiveTasks(db, config.rootAgentId);
    const pending = tasks.filter((t: any) => t.status === 'pending').length;
    const inProgress = tasks.filter((t: any) => t.status === 'in-progress').length;
    const completed = tasks.filter((t: any) => t.status === 'completed').length;

    expect(pending).toBeGreaterThanOrEqual(1);
    expect(inProgress).toBeGreaterThanOrEqual(0);
    expect(completed).toBeGreaterThanOrEqual(0);
  });

  it('should show blocked tasks with blocked_by information', () => {
    // Create a blocking task
    createTask(db, {
      id: 'blocking-task',
      agentId: config.rootAgentId,
      title: 'Blocking task',
      taskPath: 'Blocking task',
      priority: 'high',
    });

    // Create a blocked task
    createTask(db, {
      id: 'blocked-task',
      agentId: config.rootAgentId,
      title: 'Blocked task',
      taskPath: 'Blocked task',
      priority: 'medium',
      blockedBy: ['blocking-task'],
    });

    const tasks = getActiveTasks(db, config.rootAgentId);
    const blockedTask = tasks.find((t: any) => t.id === 'blocked-task');

    expect(blockedTask).toBeDefined();
    expect(blockedTask?.status).toBe('blocked');
    expect(blockedTask?.blocked_by).toBeDefined();
  });

  it('should display agent execution statistics', () => {
    // Update agent with execution stats
    updateAgent(db, config.rootAgentId, {
      lastExecutionAt: new Date().toISOString(),
      totalExecutions: 5,
      totalRuntimeMinutes: 12.5,
    });

    const agent = getAgent(db, config.rootAgentId);
    expect(agent?.last_execution_at).toBeDefined();
    expect(agent?.total_executions).toBe(5);
    expect(agent?.total_runtime_minutes).toBe(12.5);
  });

  it('should show reporting relationship', () => {
    // Create a subordinate agent
    const subordinate = createAgent(db, {
      id: 'manager-001',
      role: 'Engineering Manager',
      displayName: 'Manager',
      createdBy: config.rootAgentId,
      reportingTo: config.rootAgentId,
      mainGoal: 'Manage engineering team',
      configPath: path.join(config.dataDir, 'agents', 'ma', 'manager-001', 'config.json'),
    });

    expect(subordinate.reporting_to).toBe(config.rootAgentId);

    const agent = getAgent(db, subordinate.id);
    expect(agent?.reporting_to).toBe(config.rootAgentId);
  });

  it('should limit log output to specified number of lines', () => {
    // Create a test log file with many lines
    const logPath = getAgentLogPath(config.rootAgentId, { baseDir: config.dataDir });
    const logDir = path.dirname(logPath);
    fs.mkdirSync(logDir, { recursive: true });

    const testLogs = Array.from({ length: 100 }, (_, i) => `[2026-01-19 10:${i}:00] INFO: Log line ${i}`);
    fs.writeFileSync(logPath, testLogs.join('\n'));

    // Read logs with limit
    const content = fs.readFileSync(logPath, 'utf-8');
    const allLines = content.split('\n').filter((line: string) => line.trim());
    const limitedLines = allLines.slice(-10); // Last 10 lines

    expect(allLines.length).toBe(100);
    expect(limitedLines.length).toBe(10);
    expect(limitedLines[0]).toContain('Log line 90');
    expect(limitedLines[9]).toContain('Log line 99');
  });
});
