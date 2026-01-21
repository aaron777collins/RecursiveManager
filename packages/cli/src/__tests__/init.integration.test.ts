/**
 * Integration tests for init command
 *
 * This test suite validates the init command functionality:
 * 1. Creates proper directory structure (agents/, tasks/, logs/, snapshots/)
 * 2. Initializes database with all migrations
 * 3. Creates root CEO agent with provided goal
 * 4. Writes .recursivemanager marker file
 * 5. Writes config.json with proper configuration
 * 6. Handles force flag to overwrite existing initialization
 * 7. Handles custom data directory option
 * 8. Validates error handling for edge cases
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import { getAgent } from '@recursivemanager/common';

// Mock the interactive prompts and spinners to avoid CLI interaction during tests
jest.mock('../utils/prompts', () => ({
  confirm: jest.fn().mockResolvedValue(true),
}));

jest.mock('../utils/spinner', () => ({
  createSpinner: jest.fn(() => ({
    text: '',
    succeed: jest.fn(),
    fail: jest.fn(),
  })),
}));

// Import after mocks are set up
import { Command } from 'commander';
import { registerInitCommand } from '../commands/init';

describe('Init Command Integration Tests', () => {
  let testDataDir: string;
  let program: Command;
  let consoleLogs: jest.SpyInstance;

  beforeEach(() => {
    // Create a temporary directory for each test
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recursivemanager-test-'));

    // Mock console.log to suppress output during tests
    consoleLogs = jest.spyOn(console, 'log').mockImplementation();

    // Create fresh commander instance
    program = new Command();
    registerInitCommand(program);
  });

  afterEach(() => {
    // Restore console.log
    consoleLogs.mockRestore();

    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.removeSync(testDataDir);
    }
  });

  describe('Successful Initialization', () => {
    it('should create proper directory structure', async () => {
      // Execute init command
      await program.parseAsync(['node', 'test', 'init', 'Test goal', '--data-dir', testDataDir]);

      // Verify directory structure
      expect(fs.existsSync(path.join(testDataDir, 'agents'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'tasks'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'logs'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'snapshots'))).toBe(true);

      // Verify directories have correct permissions (Unix-like systems)
      if (process.platform !== 'win32') {
        const agentsStats = fs.statSync(path.join(testDataDir, 'agents'));
        // Mode 0o755 = 755 in octal = rwxr-xr-x
        expect((agentsStats.mode & 0o777).toString(8)).toBe('755');
      }
    });

    it('should initialize database with all migrations', async () => {
      await program.parseAsync(['node', 'test', 'init', 'Test goal', '--data-dir', testDataDir]);

      const dbPath = path.join(testDataDir, 'database.sqlite');
      expect(fs.existsSync(dbPath)).toBe(true);

      // Open database and verify schema
      const db = new Database(dbPath);

      // Check that all required tables exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as { name: string }[];

      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('agents');
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('messages');
      expect(tableNames).toContain('schedules');
      expect(tableNames).toContain('audit_log');
      expect(tableNames).toContain('org_hierarchy');

      db.close();
    });

    it('should create root CEO agent with provided goal', async () => {
      const testGoal = 'Automate all the things';
      await program.parseAsync(['node', 'test', 'init', testGoal, '--data-dir', testDataDir]);

      const dbPath = path.join(testDataDir, 'database.sqlite');
      const db = new Database(dbPath);

      // Read CEO agent from database
      const ceo = getAgent(db, 'ceo-001');

      expect(ceo).toBeDefined();
      expect(ceo?.id).toBe('ceo-001');
      expect(ceo?.role).toBe('CEO');
      expect(ceo?.display_name).toBe('CEO');
      expect(ceo?.main_goal).toBe(testGoal);
      expect(ceo?.reporting_to).toBeNull();
      expect(ceo?.created_by).toBeNull();

      db.close();
    });

    it('should write .recursivemanager marker file with metadata', async () => {
      await program.parseAsync(['node', 'test', 'init', 'Test goal', '--data-dir', testDataDir]);

      const markerPath = path.join(testDataDir, '.recursivemanager');
      expect(fs.existsSync(markerPath)).toBe(true);

      const markerData = JSON.parse(fs.readFileSync(markerPath, 'utf-8'));
      expect(markerData).toHaveProperty('initialized');
      expect(markerData).toHaveProperty('version');
      expect(markerData.version).toBe('0.2.0');

      // Verify initialized timestamp is valid
      const initDate = new Date(markerData.initialized);
      expect(initDate.getTime()).toBeGreaterThan(0);
      expect(initDate.getTime()).toBeLessThanOrEqual(Date.now());

      // Verify file permissions
      if (process.platform !== 'win32') {
        const stats = fs.statSync(markerPath);
        expect((stats.mode & 0o777).toString(8)).toBe('644');
      }
    });

    it('should write config.json with proper configuration', async () => {
      await program.parseAsync(['node', 'test', 'init', 'Test goal', '--data-dir', testDataDir]);

      const configPath = path.join(testDataDir, 'config.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      expect(config).toHaveProperty('dataDir');
      expect(config).toHaveProperty('dbPath');
      expect(config).toHaveProperty('rootAgentId');
      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('execution');

      expect(config.dataDir).toBe(testDataDir);
      expect(config.dbPath).toBe(path.join(testDataDir, 'database.sqlite'));
      expect(config.rootAgentId).toBe('ceo-001');
      expect(config.version).toBe('0.2.0');
      expect(config.execution.workerPoolSize).toBe(4);
      expect(config.execution.maxConcurrentTasks).toBe(10);

      // Verify file permissions
      if (process.platform !== 'win32') {
        const stats = fs.statSync(configPath);
        expect((stats.mode & 0o777).toString(8)).toBe('644');
      }
    });

    it('should close database connection after initialization', async () => {
      await program.parseAsync(['node', 'test', 'init', 'Test goal', '--data-dir', testDataDir]);

      const dbPath = path.join(testDataDir, 'database.sqlite');

      // Should be able to open the database (meaning previous connection was closed)
      expect(() => {
        const db = new Database(dbPath);
        db.close();
      }).not.toThrow();
    });
  });

  describe('Force Flag', () => {
    it('should skip confirmation prompt when --force is provided', async () => {
      const { confirm } = require('../utils/prompts');

      // First initialization
      await program.parseAsync(['node', 'test', 'init', 'First goal', '--data-dir', testDataDir]);

      // Reset and track confirm mock
      confirm.mockClear();

      // Second initialization with force flag in a different directory to avoid database conflicts
      const testDataDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'recursivemanager-test-force-'));

      // Create marker file to simulate existing init
      fs.mkdirSync(testDataDir2, { recursive: true });
      fs.writeFileSync(path.join(testDataDir2, '.recursivemanager'), JSON.stringify({ initialized: new Date().toISOString() }));

      try {
        const program2 = new Command();
        registerInitCommand(program2);
        await program2.parseAsync(['node', 'test', 'init', 'Second goal', '--data-dir', testDataDir2, '--force']);

        // Verify confirm was NOT called (force flag skips it)
        expect(confirm).not.toHaveBeenCalled();

        // Verify initialization completed
        expect(fs.existsSync(path.join(testDataDir2, 'database.sqlite'))).toBe(true);
      } finally {
        fs.removeSync(testDataDir2);
      }
    });

    it('should prompt for confirmation when already initialized without --force', async () => {
      const { confirm } = require('../utils/prompts');

      // First initialization
      await program.parseAsync(['node', 'test', 'init', 'First goal', '--data-dir', testDataDir]);

      // Reset mock
      confirm.mockClear();
      confirm.mockResolvedValue(false);

      // Second initialization without force
      const program2 = new Command();
      registerInitCommand(program2);
      await program2.parseAsync(['node', 'test', 'init', 'Second goal', '--data-dir', testDataDir]);

      // Verify prompt was called
      expect(confirm).toHaveBeenCalledWith(
        'RecursiveManager is already initialized. Overwrite?',
        false
      );
    });
  });

  describe('Custom Data Directory', () => {
    it('should use custom data directory when --data-dir is provided', async () => {
      const customDir = path.join(testDataDir, 'custom-location');

      await program.parseAsync(['node', 'test', 'init', 'Test goal', '--data-dir', customDir]);

      expect(fs.existsSync(customDir)).toBe(true);
      expect(fs.existsSync(path.join(customDir, 'agents'))).toBe(true);
      expect(fs.existsSync(path.join(customDir, 'database.sqlite'))).toBe(true);
      expect(fs.existsSync(path.join(customDir, 'config.json'))).toBe(true);

      const config = JSON.parse(fs.readFileSync(path.join(customDir, 'config.json'), 'utf-8'));
      expect(config.dataDir).toBe(customDir);
    });

    it('should use RECURSIVEMANAGER_DATA_DIR env var if --data-dir not provided', async () => {
      const envDir = path.join(testDataDir, 'env-location');
      process.env.RECURSIVEMANAGER_DATA_DIR = envDir;

      try {
        await program.parseAsync(['node', 'test', 'init', 'Test goal']);

        expect(fs.existsSync(envDir)).toBe(true);
        expect(fs.existsSync(path.join(envDir, 'database.sqlite'))).toBe(true);

        const config = JSON.parse(fs.readFileSync(path.join(envDir, 'config.json'), 'utf-8'));
        expect(config.dataDir).toBe(envDir);
      } finally {
        delete process.env.RECURSIVEMANAGER_DATA_DIR;
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database initialization errors gracefully', async () => {
      // Create a file where the database should be to cause an error
      const dbPath = path.join(testDataDir, 'database.sqlite');
      fs.mkdirSync(testDataDir, { recursive: true });
      fs.writeFileSync(dbPath, 'invalid database content');
      fs.chmodSync(dbPath, 0o444); // Read-only

      // Mock console.error to suppress error output in tests
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      const processExit = jest.spyOn(process, 'exit').mockImplementation(((code?: string | number | null | undefined) => {
        throw new Error(`process.exit(${code})`);
      }) as any);

      try {
        await expect(
          program.parseAsync(['node', 'test', 'init', 'Test goal', '--data-dir', testDataDir, '--force'])
        ).rejects.toThrow('process.exit(1)');

        expect(consoleError).toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
        processExit.mockRestore();

        // Clean up read-only file
        if (fs.existsSync(dbPath)) {
          fs.chmodSync(dbPath, 0o644);
        }
      }
    });

    it('should create parent directories if they do not exist', async () => {
      const nestedDir = path.join(testDataDir, 'deeply', 'nested', 'path');

      await program.parseAsync(['node', 'test', 'init', 'Test goal', '--data-dir', nestedDir]);

      expect(fs.existsSync(nestedDir)).toBe(true);
      expect(fs.existsSync(path.join(nestedDir, 'agents'))).toBe(true);
      expect(fs.existsSync(path.join(nestedDir, 'database.sqlite'))).toBe(true);
    });
  });

  describe('Goal Validation', () => {
    it('should accept goals with special characters', async () => {
      const specialGoal = 'Build a system with "quotes" and \'apostrophes\' & symbols!';

      await program.parseAsync(['node', 'test', 'init', specialGoal, '--data-dir', testDataDir]);

      const dbPath = path.join(testDataDir, 'database.sqlite');
      const db = new Database(dbPath);
      const ceo = getAgent(db, 'ceo-001');

      expect(ceo?.main_goal).toBe(specialGoal);
      db.close();
    });

    it('should accept very long goals', async () => {
      const longGoal = 'A'.repeat(1000);

      await program.parseAsync(['node', 'test', 'init', longGoal, '--data-dir', testDataDir]);

      const dbPath = path.join(testDataDir, 'database.sqlite');
      const db = new Database(dbPath);
      const ceo = getAgent(db, 'ceo-001');

      expect(ceo?.main_goal).toBe(longGoal);
      expect(ceo?.main_goal.length).toBe(1000);
      db.close();
    });

    it('should accept goals with unicode characters', async () => {
      const unicodeGoal = 'Automate 🚀 workflows with émojis and 中文字符';

      await program.parseAsync(['node', 'test', 'init', unicodeGoal, '--data-dir', testDataDir]);

      const dbPath = path.join(testDataDir, 'database.sqlite');
      const db = new Database(dbPath);
      const ceo = getAgent(db, 'ceo-001');

      expect(ceo?.main_goal).toBe(unicodeGoal);
      db.close();
    });
  });

  describe('Directory Creation', () => {
    it('should not fail when directories already exist', async () => {
      // Pre-create some directories
      fs.mkdirSync(path.join(testDataDir, 'agents'), { recursive: true });
      fs.mkdirSync(path.join(testDataDir, 'tasks'), { recursive: true });

      // Add a test file to verify existing content is preserved
      const testFile = path.join(testDataDir, 'agents', 'test.txt');
      fs.writeFileSync(testFile, 'test content');

      // Initialize (should not fail even though directories exist)
      await program.parseAsync(['node', 'test', 'init', 'Test goal', '--data-dir', testDataDir]);

      // Verify directory structure is complete
      expect(fs.existsSync(path.join(testDataDir, 'agents'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'tasks'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'logs'))).toBe(true);
      expect(fs.existsSync(path.join(testDataDir, 'snapshots'))).toBe(true);

      // Test file should still exist (not deleted by init)
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe('test content');
    });
  });
});
