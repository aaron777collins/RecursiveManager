/**
 * Integration tests for config command
 *
 * This test suite validates the config command functionality:
 * 1. Get configuration value using dot-notation paths
 * 2. Set configuration value with validation
 * 3. List all configuration
 * 4. Handle nested configuration paths
 * 5. Validate configuration changes
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';

// Mock the interactive prompts and spinners to avoid CLI interaction during tests
jest.mock('../utils/prompts', () => ({
  confirm: jest.fn().mockResolvedValue(true),
  number: jest.fn().mockResolvedValue(10),
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
import { registerConfigCommand } from '../commands/config';
import { loadConfig } from '../utils/config';

describe('Config Command Integration Tests', () => {
  let testDataDir: string;
  let program: Command;
  let consoleLogs: jest.SpyInstance;
  let consoleErrors: jest.SpyInstance;
  let processExit: jest.SpyInstance;

  beforeEach(async () => {
    // Create a temporary directory for each test
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'recursive-manager-test-'));

    // Mock console.log and console.error to suppress output during tests
    consoleLogs = jest.spyOn(console, 'log').mockImplementation();
    consoleErrors = jest.spyOn(console, 'error').mockImplementation();
    processExit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('Process.exit() called');
    }) as any);

    // Create fresh commander instance and initialize
    program = new Command();
    registerInitCommand(program);
    registerConfigCommand(program);

    // Initialize a test instance first
    await program.parseAsync(['node', 'test', 'init', 'Test goal', '--data-dir', testDataDir]);
  });

  afterEach(() => {
    // Restore mocks
    consoleLogs.mockRestore();
    consoleErrors.mockRestore();
    processExit.mockRestore();

    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.removeSync(testDataDir);
    }
  });

  describe('Config Get', () => {
    it('should get a simple configuration value', async () => {
      // Execute config get command
      await program.parseAsync(['node', 'test', 'config', '--get', 'dataDir', '--data-dir', testDataDir]);

      // Verify the value was logged
      const logCalls = consoleLogs.mock.calls.flat().join('');
      expect(logCalls).toContain('dataDir:');
      expect(logCalls).toContain(testDataDir);
    });

    it('should get a nested configuration value', async () => {
      // Execute config get command for nested value
      await program.parseAsync([
        'node',
        'test',
        'config',
        '--get',
        'execution.workerPoolSize',
        '--data-dir',
        testDataDir,
      ]);

      // Verify the value was logged
      const logCalls = consoleLogs.mock.calls.flat().join('');
      expect(logCalls).toContain('execution.workerPoolSize:');
      expect(logCalls).toContain('4'); // Default value
    });

    it('should handle non-existent configuration key', async () => {
      // Execute config get command for non-existent key
      await expect(
        program.parseAsync([
          'node',
          'test',
          'config',
          '--get',
          'nonExistent.key',
          '--data-dir',
          testDataDir,
        ])
      ).rejects.toThrow('Process.exit() called');

      // Verify error message
      const errorCalls = consoleErrors.mock.calls.flat().join('');
      expect(errorCalls).toContain('not found');
    });
  });

  describe('Config Set', () => {
    it('should set a nested configuration value', async () => {
      // Execute config set command
      await program.parseAsync([
        'node',
        'test',
        'config',
        '--set',
        'execution.workerPoolSize=10',
        '--data-dir',
        testDataDir,
      ]);

      // Load config and verify the value was changed
      process.env.RECURSIVE_MANAGER_DATA_DIR = testDataDir;
      const config = loadConfig(testDataDir);
      expect(config.execution.workerPoolSize).toBe(10);
    });

    it('should parse numeric values correctly', async () => {
      // Set a numeric value
      await program.parseAsync([
        'node',
        'test',
        'config',
        '--set',
        'execution.maxConcurrentTasks=20',
        '--data-dir',
        testDataDir,
      ]);

      // Verify it's stored as a number, not a string
      const config = loadConfig(testDataDir);
      expect(config.execution.maxConcurrentTasks).toBe(20);
      expect(typeof config.execution.maxConcurrentTasks).toBe('number');
    });

    it('should validate configuration changes', async () => {
      // Try to set an invalid value (too small)
      await expect(
        program.parseAsync([
          'node',
          'test',
          'config',
          '--set',
          'execution.workerPoolSize=0',
          '--data-dir',
          testDataDir,
        ])
      ).rejects.toThrow('Process.exit() called');

      // Verify error message
      const errorCalls = consoleErrors.mock.calls.flat().join('');
      expect(errorCalls).toContain('validation failed');
    });

    it('should validate configuration changes for max values', async () => {
      // Try to set an invalid value (too large)
      await expect(
        program.parseAsync([
          'node',
          'test',
          'config',
          '--set',
          'execution.workerPoolSize=1000',
          '--data-dir',
          testDataDir,
        ])
      ).rejects.toThrow('Process.exit() called');

      // Verify error message
      const errorCalls = consoleErrors.mock.calls.flat().join('');
      expect(errorCalls).toContain('validation failed');
    });

    it('should handle invalid set format', async () => {
      // Try to set without equals sign
      await expect(
        program.parseAsync([
          'node',
          'test',
          'config',
          '--set',
          'execution.workerPoolSize',
          '--data-dir',
          testDataDir,
        ])
      ).rejects.toThrow('Process.exit() called');

      // Verify error message
      const errorCalls = consoleErrors.mock.calls.flat().join('');
      expect(errorCalls).toContain('Invalid format');
    });

    it('should create nested paths that do not exist', async () => {
      // Set a value in a new nested path
      await program.parseAsync([
        'node',
        'test',
        'config',
        '--set',
        'newSection.newKey=testValue',
        '--data-dir',
        testDataDir,
      ]);

      // Verify the nested structure was created
      const config = loadConfig(testDataDir);
      expect((config as any).newSection).toBeDefined();
      expect((config as any).newSection.newKey).toBe('testValue');
    });
  });

  describe('Config List', () => {
    it('should list all configuration', async () => {
      // Execute config list command
      await program.parseAsync(['node', 'test', 'config', '--list', '--data-dir', testDataDir]);

      // Verify configuration was logged
      const logCalls = consoleLogs.mock.calls.flat().join('');
      expect(logCalls).toContain('dataDir');
      expect(logCalls).toContain('dbPath');
      expect(logCalls).toContain('rootAgentId');
      expect(logCalls).toContain('execution');
    });
  });

  describe('Config Validation', () => {
    it('should validate workerPoolSize range', async () => {
      // Valid values should work
      await program.parseAsync([
        'node',
        'test',
        'config',
        '--set',
        'execution.workerPoolSize=50',
        '--data-dir',
        testDataDir,
      ]);

      const config = loadConfig(testDataDir);
      expect(config.execution.workerPoolSize).toBe(50);
    });

    it('should validate maxConcurrentTasks range', async () => {
      // Valid values should work
      await program.parseAsync([
        'node',
        'test',
        'config',
        '--set',
        'execution.maxConcurrentTasks=500',
        '--data-dir',
        testDataDir,
      ]);

      const config = loadConfig(testDataDir);
      expect(config.execution.maxConcurrentTasks).toBe(500);
    });
  });

  describe('Type Conversion', () => {
    it('should parse boolean values', async () => {
      // Set a boolean value
      await program.parseAsync([
        'node',
        'test',
        'config',
        '--set',
        'testSection.enabled=true',
        '--data-dir',
        testDataDir,
      ]);

      const config = loadConfig(testDataDir);
      expect((config as any).testSection.enabled).toBe(true);
      expect(typeof (config as any).testSection.enabled).toBe('boolean');
    });

    it('should parse float values', async () => {
      // Set a float value
      await program.parseAsync([
        'node',
        'test',
        'config',
        '--set',
        'testSection.ratio=0.75',
        '--data-dir',
        testDataDir,
      ]);

      const config = loadConfig(testDataDir);
      expect((config as any).testSection.ratio).toBe(0.75);
      expect(typeof (config as any).testSection.ratio).toBe('number');
    });

    it('should keep string values as strings', async () => {
      // Set a string value
      await program.parseAsync([
        'node',
        'test',
        'config',
        '--set',
        'testSection.name=TestName',
        '--data-dir',
        testDataDir,
      ]);

      const config = loadConfig(testDataDir);
      expect((config as any).testSection.name).toBe('TestName');
      expect(typeof (config as any).testSection.name).toBe('string');
    });
  });
});
