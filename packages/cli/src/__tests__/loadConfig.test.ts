/**
 * Unit tests for loadConfig prerequisite checks
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { loadConfig } from '../utils/config';

describe('loadConfig prerequisite checks', () => {
  let testDataDir: string;
  let processExit: jest.SpyInstance;
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    // Create a temporary directory for each test
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loadconfig-test-'));

    // Mock process.exit and console.error
    processExit = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('Process.exit() called');
    }) as any);
    consoleError = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    processExit.mockRestore();
    consoleError.mockRestore();

    // Clean up test directory
    if (fs.existsSync(testDataDir)) {
      fs.removeSync(testDataDir);
    }
  });

  it('should fail when data directory does not exist', () => {
    const nonExistentDir = path.join(testDataDir, 'does-not-exist');

    expect(() => loadConfig(nonExistentDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('not initialized')
    );
  });

  it('should fail when marker file does not exist', () => {
    // Create directory but no marker file
    fs.ensureDirSync(testDataDir);

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('not initialized')
    );
  });

  it('should fail when marker file is a directory', () => {
    // Create directory and marker as a directory
    fs.ensureDirSync(testDataDir);
    fs.ensureDirSync(path.join(testDataDir, '.recursivemanager'));

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('not a file')
    );
  });

  it('should fail when marker file has invalid content', () => {
    // Create marker file with invalid JSON
    fs.ensureDirSync(testDataDir);
    fs.writeFileSync(path.join(testDataDir, '.recursivemanager'), 'invalid json');

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse marker file')
    );
  });

  it('should fail when marker file missing required fields', () => {
    // Create marker file without initialized field
    fs.ensureDirSync(testDataDir);
    fs.writeFileSync(
      path.join(testDataDir, '.recursivemanager'),
      JSON.stringify({ someField: 'value' })
    );

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Marker file is invalid')
    );
  });

  it('should fail when config.json does not exist', () => {
    // Create valid marker but no config
    fs.ensureDirSync(testDataDir);
    fs.writeFileSync(
      path.join(testDataDir, '.recursivemanager'),
      JSON.stringify({ initialized: true, version: '0.1.0' })
    );

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Configuration not found')
    );
  });

  it('should fail when config.json is a directory', () => {
    // Create valid marker and config as directory
    fs.ensureDirSync(testDataDir);
    fs.writeFileSync(
      path.join(testDataDir, '.recursivemanager'),
      JSON.stringify({ initialized: true, version: '0.1.0' })
    );
    fs.ensureDirSync(path.join(testDataDir, 'config.json'));

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('not a file')
    );
  });

  it('should fail when config.json has invalid JSON', () => {
    // Create valid marker and invalid config
    fs.ensureDirSync(testDataDir);
    fs.writeFileSync(
      path.join(testDataDir, '.recursivemanager'),
      JSON.stringify({ initialized: true, version: '0.1.0' })
    );
    fs.writeFileSync(path.join(testDataDir, 'config.json'), 'invalid json');

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to parse configuration')
    );
  });

  it('should fail when config is missing required fields', () => {
    // Create valid marker and config without required fields
    fs.ensureDirSync(testDataDir);
    fs.writeFileSync(
      path.join(testDataDir, '.recursivemanager'),
      JSON.stringify({ initialized: true, version: '0.1.0' })
    );
    fs.writeFileSync(
      path.join(testDataDir, 'config.json'),
      JSON.stringify({ someField: 'value' })
    );

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('validation failed')
    );
  });

  it('should fail when database file does not exist', () => {
    // Create valid marker and config but no database
    const dbPath = path.join(testDataDir, 'database.sqlite');
    fs.ensureDirSync(testDataDir);
    fs.writeFileSync(
      path.join(testDataDir, '.recursivemanager'),
      JSON.stringify({ initialized: true, version: '0.1.0' })
    );
    fs.writeFileSync(
      path.join(testDataDir, 'config.json'),
      JSON.stringify({
        dataDir: testDataDir,
        dbPath: dbPath,
        rootAgentId: 'test-agent',
        version: '0.1.0',
        execution: { workerPoolSize: 4, maxConcurrentTasks: 10 }
      })
    );

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Database not found')
    );
  });

  it('should fail when database is a directory', () => {
    // Create valid setup but database is a directory
    const dbPath = path.join(testDataDir, 'database.sqlite');
    fs.ensureDirSync(testDataDir);
    fs.writeFileSync(
      path.join(testDataDir, '.recursivemanager'),
      JSON.stringify({ initialized: true, version: '0.1.0' })
    );
    fs.writeFileSync(
      path.join(testDataDir, 'config.json'),
      JSON.stringify({
        dataDir: testDataDir,
        dbPath: dbPath,
        rootAgentId: 'test-agent',
        version: '0.1.0',
        execution: { workerPoolSize: 4, maxConcurrentTasks: 10 }
      })
    );
    fs.ensureDirSync(dbPath);

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('not a file')
    );
  });

  it('should fail when required subdirectory is missing', () => {
    // Create valid setup but missing a required subdirectory
    const dbPath = path.join(testDataDir, 'database.sqlite');
    fs.ensureDirSync(testDataDir);
    fs.writeFileSync(
      path.join(testDataDir, '.recursivemanager'),
      JSON.stringify({ initialized: true, version: '0.1.0' })
    );
    fs.writeFileSync(
      path.join(testDataDir, 'config.json'),
      JSON.stringify({
        dataDir: testDataDir,
        dbPath: dbPath,
        rootAgentId: 'test-agent',
        version: '0.1.0',
        execution: { workerPoolSize: 4, maxConcurrentTasks: 10 }
      })
    );
    fs.writeFileSync(dbPath, 'fake db');
    // Create only some subdirectories
    fs.ensureDirSync(path.join(testDataDir, 'agents'));
    fs.ensureDirSync(path.join(testDataDir, 'tasks'));
    // Missing: logs, snapshots

    expect(() => loadConfig(testDataDir)).toThrow('Process.exit() called');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Required directory missing')
    );
  });

  it('should succeed when all prerequisites are met', () => {
    // Create complete valid setup
    const dbPath = path.join(testDataDir, 'database.sqlite');
    fs.ensureDirSync(testDataDir);
    fs.writeFileSync(
      path.join(testDataDir, '.recursivemanager'),
      JSON.stringify({ initialized: true, version: '0.1.0' })
    );
    fs.writeFileSync(
      path.join(testDataDir, 'config.json'),
      JSON.stringify({
        dataDir: testDataDir,
        dbPath: dbPath,
        rootAgentId: 'test-agent',
        version: '0.1.0',
        execution: { workerPoolSize: 4, maxConcurrentTasks: 10 }
      })
    );
    fs.writeFileSync(dbPath, 'fake db');
    fs.ensureDirSync(path.join(testDataDir, 'agents'));
    fs.ensureDirSync(path.join(testDataDir, 'tasks'));
    fs.ensureDirSync(path.join(testDataDir, 'logs'));
    fs.ensureDirSync(path.join(testDataDir, 'snapshots'));

    const config = loadConfig(testDataDir);
    expect(config).toBeDefined();
    expect(config.dataDir).toBe(testDataDir);
    expect(config.dbPath).toBe(dbPath);
    expect(config.rootAgentId).toBe('test-agent');
  });
});
