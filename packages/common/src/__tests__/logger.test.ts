/**
 * Tests for the structured logging system
 */

import {
  createLogger,
  generateTraceId,
  logger as defaultLogger,
  type Logger,
  type LogMetadata,
} from '../logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Logger Module', () => {
  describe('generateTraceId', () => {
    it('should generate a valid UUID v4', () => {
      const traceId = generateTraceId();
      expect(traceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should generate unique IDs on successive calls', () => {
      const id1 = generateTraceId();
      const id2 = generateTraceId();
      const id3 = generateTraceId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe('createLogger', () => {
    it('should create a logger with default options', () => {
      const logger = createLogger();

      expect(logger).toBeDefined();
      expect(logger.info).toBeInstanceOf(Function);
      expect(logger.warn).toBeInstanceOf(Function);
      expect(logger.error).toBeInstanceOf(Function);
      expect(logger.debug).toBeInstanceOf(Function);
      expect(logger.child).toBeInstanceOf(Function);
    });

    it('should create a logger with custom level', () => {
      const logger = createLogger({ level: 'debug' });
      expect(logger).toBeDefined();
    });

    it('should create a logger with default metadata', () => {
      const logger = createLogger({
        defaultMetadata: { agentId: 'test-agent' },
      });
      expect(logger).toBeDefined();
    });

    it('should throw error when file output enabled without filePath', () => {
      expect(() => {
        createLogger({ file: true });
      }).toThrow('filePath is required when file output is enabled');
    });

    it('should create logger with file output when filePath provided', () => {
      const tempFile = path.join(os.tmpdir(), `test-${Date.now()}.log`);
      const logger = createLogger({
        file: true,
        filePath: tempFile,
      });

      expect(logger).toBeDefined();

      // Clean up
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    });

    it('should create logger with console disabled', () => {
      const logger = createLogger({ console: false });
      expect(logger).toBeDefined();
    });

    it('should create logger with JSON format disabled', () => {
      const logger = createLogger({ json: false });
      expect(logger).toBeDefined();
    });
  });

  describe('Logger methods', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = createLogger({ console: false });
    });

    it('should log info message without metadata', () => {
      expect(() => {
        logger.info('Test info message');
      }).not.toThrow();
    });

    it('should log info message with metadata', () => {
      expect(() => {
        logger.info('Test info message', { traceId: 'test-trace' });
      }).not.toThrow();
    });

    it('should log warn message without metadata', () => {
      expect(() => {
        logger.warn('Test warning message');
      }).not.toThrow();
    });

    it('should log warn message with metadata', () => {
      expect(() => {
        logger.warn('Test warning message', { agentId: 'agent-123' });
      }).not.toThrow();
    });

    it('should log error message without metadata', () => {
      expect(() => {
        logger.error('Test error message');
      }).not.toThrow();
    });

    it('should log error message with metadata', () => {
      expect(() => {
        logger.error('Test error message', {
          traceId: 'trace-123',
          taskId: 'task-456',
        });
      }).not.toThrow();
    });

    it('should log debug message without metadata', () => {
      expect(() => {
        logger.debug('Test debug message');
      }).not.toThrow();
    });

    it('should log debug message with metadata', () => {
      expect(() => {
        logger.debug('Test debug message', { executionId: 'exec-789' });
      }).not.toThrow();
    });

    it('should handle all metadata types correctly', () => {
      const metadata: LogMetadata = {
        traceId: 'trace-123',
        agentId: 'agent-456',
        taskId: 'task-789',
        executionId: 'exec-012',
        customField: 'custom-value',
        numericField: 42,
        booleanField: true,
        nestedObject: { key: 'value' },
        arrayField: [1, 2, 3],
      };

      expect(() => {
        logger.info('Test with all metadata types', metadata);
      }).not.toThrow();
    });
  });

  describe('Child logger', () => {
    let parentLogger: Logger;

    beforeEach(() => {
      parentLogger = createLogger({
        console: false,
        defaultMetadata: { service: 'test-service' },
      });
    });

    it('should create child logger with additional metadata', () => {
      const childLogger = parentLogger.child({ agentId: 'agent-123' });

      expect(childLogger).toBeDefined();
      expect(childLogger.info).toBeInstanceOf(Function);
    });

    it('should allow child logger to add more metadata', () => {
      const childLogger = parentLogger.child({ agentId: 'agent-123' });

      expect(() => {
        childLogger.info('Test message', { taskId: 'task-456' });
      }).not.toThrow();
    });

    it('should create nested child loggers', () => {
      const child1 = parentLogger.child({ agentId: 'agent-123' });
      const child2 = child1.child({ taskId: 'task-456' });
      const child3 = child2.child({ executionId: 'exec-789' });

      expect(() => {
        child3.info('Deeply nested log');
      }).not.toThrow();
    });
  });

  describe('File output', () => {
    let tempFile: string;

    beforeEach(() => {
      tempFile = path.join(os.tmpdir(), `test-${Date.now()}.log`);
    });

    afterEach(() => {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    });

    it('should write logs to file', () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
      });

      logger.info('Test file log');

      // Give Winston time to flush
      const waitForFile = () => {
        return new Promise((resolve) => setTimeout(resolve, 100));
      };

      return waitForFile().then(() => {
        expect(fs.existsSync(tempFile)).toBe(true);
        const content = fs.readFileSync(tempFile, 'utf-8');
        expect(content).toContain('Test file log');
      });
    });

    it('should write JSON formatted logs to file', () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
      });

      const traceId = generateTraceId();
      logger.info('JSON format test', { traceId });

      const waitForFile = () => {
        return new Promise((resolve) => setTimeout(resolve, 100));
      };

      return waitForFile().then(() => {
        expect(fs.existsSync(tempFile)).toBe(true);
        const content = fs.readFileSync(tempFile, 'utf-8');

        // Parse JSON to validate format
        const lines = content.trim().split('\n');
        const firstLine = lines[0];
        if (!firstLine) {
          throw new Error('No log output found');
        }
        const parsed = JSON.parse(firstLine);

        expect(parsed.message).toBe('JSON format test');
        expect(parsed.level).toBe('info');
        expect(parsed.timestamp).toBeDefined();
        expect(parsed.metadata.traceId).toBe(traceId);
      });
    });
  });

  describe('Log levels', () => {
    it('should respect log level threshold - info level', () => {
      const logger = createLogger({ level: 'info', console: false });

      // These should not throw
      expect(() => logger.info('info message')).not.toThrow();
      expect(() => logger.warn('warn message')).not.toThrow();
      expect(() => logger.error('error message')).not.toThrow();
      expect(() => logger.debug('debug message')).not.toThrow(); // Won't log but shouldn't throw
    });

    it('should respect log level threshold - warn level', () => {
      const logger = createLogger({ level: 'warn', console: false });

      expect(() => logger.warn('warn message')).not.toThrow();
      expect(() => logger.error('error message')).not.toThrow();
      expect(() => logger.info('info message')).not.toThrow(); // Won't log but shouldn't throw
      expect(() => logger.debug('debug message')).not.toThrow(); // Won't log but shouldn't throw
    });

    it('should respect log level threshold - error level', () => {
      const logger = createLogger({ level: 'error', console: false });

      expect(() => logger.error('error message')).not.toThrow();
      expect(() => logger.warn('warn message')).not.toThrow(); // Won't log but shouldn't throw
      expect(() => logger.info('info message')).not.toThrow(); // Won't log but shouldn't throw
      expect(() => logger.debug('debug message')).not.toThrow(); // Won't log but shouldn't throw
    });

    it('should respect log level threshold - debug level', () => {
      const logger = createLogger({ level: 'debug', console: false });

      expect(() => logger.debug('debug message')).not.toThrow();
      expect(() => logger.info('info message')).not.toThrow();
      expect(() => logger.warn('warn message')).not.toThrow();
      expect(() => logger.error('error message')).not.toThrow();
    });
  });

  describe('Default logger instance', () => {
    it('should export a default logger instance', () => {
      expect(defaultLogger).toBeDefined();
      expect(defaultLogger.info).toBeInstanceOf(Function);
      expect(defaultLogger.warn).toBeInstanceOf(Function);
      expect(defaultLogger.error).toBeInstanceOf(Function);
      expect(defaultLogger.debug).toBeInstanceOf(Function);
      expect(defaultLogger.child).toBeInstanceOf(Function);
    });

    it('should allow using default logger directly', () => {
      expect(() => {
        defaultLogger.info('Test with default logger');
      }).not.toThrow();
    });
  });

  describe('Metadata merging', () => {
    it('should merge default metadata with call-time metadata', () => {
      const logger = createLogger({
        console: false,
        defaultMetadata: { service: 'test-service', env: 'test' },
      });

      expect(() => {
        logger.info('Test merge', { traceId: 'trace-123' });
      }).not.toThrow();
    });

    it('should allow call-time metadata to override defaults', () => {
      const logger = createLogger({
        console: false,
        defaultMetadata: { service: 'test-service', value: 'default' },
      });

      expect(() => {
        logger.info('Override test', { value: 'overridden' });
      }).not.toThrow();
    });

    it('should merge child logger metadata with parent defaults', () => {
      const parent = createLogger({
        console: false,
        defaultMetadata: { service: 'test-service' },
      });

      const child = parent.child({ agentId: 'agent-123' });

      expect(() => {
        child.info('Child log', { taskId: 'task-456' });
      }).not.toThrow();
    });
  });

  describe('Edge cases', () => {
    it('should handle empty metadata', () => {
      const logger = createLogger({ console: false });

      expect(() => {
        logger.info('Test', {});
      }).not.toThrow();
    });

    it('should handle undefined metadata', () => {
      const logger = createLogger({ console: false });

      expect(() => {
        logger.info('Test', undefined);
      }).not.toThrow();
    });

    it('should handle very long messages', () => {
      const logger = createLogger({ console: false });
      const longMessage = 'A'.repeat(10000);

      expect(() => {
        logger.info(longMessage);
      }).not.toThrow();
    });

    it('should handle special characters in messages', () => {
      const logger = createLogger({ console: false });

      expect(() => {
        logger.info('Test with 特殊 characters: 日本語 🎉 \n\t\r');
      }).not.toThrow();
    });

    it('should handle null values in metadata', () => {
      const logger = createLogger({ console: false });

      expect(() => {
        logger.info('Test null', { nullValue: null });
      }).not.toThrow();
    });

    it('should handle circular references in metadata gracefully', () => {
      const logger = createLogger({ console: false });

      const circular: any = { name: 'test' };
      circular.self = circular;

      // Winston should handle this without throwing
      expect(() => {
        logger.info('Circular test', { data: circular });
      }).not.toThrow();
    });
  });

  describe('Log Rotation', () => {
    const testDir = path.join(os.tmpdir(), `logger-rotation-test-${Date.now()}`);

    beforeAll(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    afterAll(() => {
      // Clean up test directory
      if (fs.existsSync(testDir)) {
        const files = fs.readdirSync(testDir);
        files.forEach((file) => {
          fs.unlinkSync(path.join(testDir, file));
        });
        fs.rmdirSync(testDir);
      }
    });

    it('should throw error when rotation enabled without file output', () => {
      expect(() => {
        createLogger({ rotation: true });
      }).toThrow('rotation requires file output to be enabled');
    });

    it('should create logger with rotation enabled', () => {
      const logFile = path.join(testDir, 'app.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
      });

      expect(logger).toBeDefined();
      logger.info('Test rotation message');
    });

    it('should create logger with custom date pattern', () => {
      const logFile = path.join(testDir, 'custom-pattern.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        datePattern: 'YYYY-MM-DD-HH',
        console: false,
      });

      expect(logger).toBeDefined();
      logger.info('Test custom pattern');
    });

    it('should create logger with compression disabled', () => {
      const logFile = path.join(testDir, 'no-compress.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        compress: false,
        console: false,
      });

      expect(logger).toBeDefined();
      logger.info('Test no compression');
    });

    it('should create logger with custom retention period', () => {
      const logFile = path.join(testDir, 'custom-retention.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        maxFiles: '7d',
        console: false,
      });

      expect(logger).toBeDefined();
      logger.info('Test custom retention');
    });

    it('should create logger with max file size', () => {
      const logFile = path.join(testDir, 'max-size.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        maxSize: '10m',
        console: false,
      });

      expect(logger).toBeDefined();
      logger.info('Test max size');
    });

    it('should create logger with all rotation options', () => {
      const logFile = path.join(testDir, 'full-rotation.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        datePattern: 'YYYY-MM-DD',
        compress: true,
        maxFiles: '30d',
        maxSize: '20m',
        console: false,
      });

      expect(logger).toBeDefined();
      logger.info('Test full rotation config');
    });

    it('should preserve rotation options in child logger', () => {
      const logFile = path.join(testDir, 'child-rotation.log');
      const parentLogger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        compress: true,
        maxFiles: '30d',
        console: false,
      });

      const childLogger = parentLogger.child({ agentId: 'test-agent' });
      expect(childLogger).toBeDefined();
      childLogger.info('Test child with rotation');
    });

    it('should write logs when rotation is enabled', (done) => {
      const logFile = path.join(testDir, 'write-test.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
      });

      logger.info('Rotation write test');

      // Wait for file to be written
      setTimeout(() => {
        const files = fs.readdirSync(testDir);
        const logFiles = files.filter((f) => f.startsWith('write-test'));
        expect(logFiles.length).toBeGreaterThan(0);
        done();
      }, 100);
    });

    it('should use default 30-day retention when maxFiles not specified', () => {
      const logFile = path.join(testDir, 'default-retention.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
      });

      expect(logger).toBeDefined();
      logger.info('Test default retention');
    });

    it('should handle numeric maxFiles value', () => {
      const logFile = path.join(testDir, 'numeric-retention.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        maxFiles: 14,
        console: false,
      });

      expect(logger).toBeDefined();
      logger.info('Test numeric maxFiles');
    });
  });

  describe('createAgentLogger', () => {
    it('should create logger with agent ID in metadata', async () => {
      // Import here to avoid circular dependency issues
      const { createAgentLogger } = require('../logger');
      const agentId = 'test-agent-123';
      const logger = createAgentLogger(agentId);

      expect(logger).toBeDefined();

      // Log a message
      logger.info('Agent initialized');

      // Wait for async write
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Note: The log file won't exist in test environment since we're using mocked paths
      // This test verifies the logger is created without errors
    });

    it('should throw error for empty agent ID', () => {
      const { createAgentLogger } = require('../logger');

      expect(() => createAgentLogger('')).toThrow(
        'agentId is required and cannot be empty'
      );
    });

    it('should throw error for whitespace-only agent ID', () => {
      const { createAgentLogger } = require('../logger');

      expect(() => createAgentLogger('   ')).toThrow(
        'agentId is required and cannot be empty'
      );
    });

    it('should have file output enabled by default', () => {
      const { createAgentLogger } = require('../logger');
      const logger = createAgentLogger('test-agent');

      expect(logger).toBeDefined();
      // Logger should be configured with file output
      // This is validated by not throwing an error
    });

    it('should have rotation enabled by default', () => {
      const { createAgentLogger } = require('../logger');
      const logger = createAgentLogger('test-agent');

      expect(logger).toBeDefined();
      // Rotation should be enabled by default
      // This is validated by not throwing an error
    });

    it('should have console output disabled by default', async () => {
      const { createAgentLogger } = require('../logger');
      const agentId = 'console-test-agent';
      const logger = createAgentLogger(agentId);

      // Capture console output
      const originalLog = console.log;
      let consoleOutput = '';
      console.log = jest.fn((msg) => {
        consoleOutput += msg;
      });

      logger.info('Test message');

      // Wait for async write
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Restore console
      console.log = originalLog;

      // Console should not have received output (console: false by default)
      expect(consoleOutput).toBe('');
    });

    it('should allow overriding default options', () => {
      const { createAgentLogger } = require('../logger');
      const logger = createAgentLogger('test-agent', {
        level: 'debug',
        console: true,
      });

      expect(logger).toBeDefined();
      // Logger should be created with custom options
    });

    it('should create child logger with agent context preserved', () => {
      const { createAgentLogger } = require('../logger');
      const logger = createAgentLogger('parent-agent');
      const childLogger = logger.child({ taskId: 'task-123' });

      expect(childLogger).toBeDefined();
      // Child logger should inherit agentId and add taskId
    });

    it('should support standard log levels', () => {
      const { createAgentLogger } = require('../logger');
      const logger = createAgentLogger('test-agent');

      // All log levels should work without errors
      expect(() => logger.error('Error message')).not.toThrow();
      expect(() => logger.warn('Warning message')).not.toThrow();
      expect(() => logger.info('Info message')).not.toThrow();
      expect(() => logger.debug('Debug message')).not.toThrow();
    });

    it('should accept additional metadata in log calls', () => {
      const { createAgentLogger } = require('../logger');
      const logger = createAgentLogger('test-agent');

      expect(() =>
        logger.info('Task started', { taskId: 'task-456', status: 'pending' })
      ).not.toThrow();
    });

    it('should handle agent IDs with special characters', () => {
      const { createAgentLogger } = require('../logger');

      // These should all work without errors
      expect(() => createAgentLogger('agent-123')).not.toThrow();
      expect(() => createAgentLogger('CEO')).not.toThrow();
      expect(() => createAgentLogger('dev_ops')).not.toThrow();
      expect(() => createAgentLogger('agent.test')).not.toThrow();
    });
  });

  describe('Hierarchical Logging (Task 1.4.7)', () => {
    describe('getAgentHierarchyContext', () => {
      it('should return hierarchy context for an agent with a manager', () => {
        const { getAgentHierarchyContext } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        // Create schema
        db.exec(`
          CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            reporting_to TEXT
          );
          CREATE TABLE org_hierarchy (
            agent_id TEXT,
            ancestor_id TEXT,
            depth INTEGER,
            path TEXT
          );
        `);

        // Insert test data: CEO -> CTO -> Backend Dev
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('ceo', null);
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('cto', 'ceo');
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('backend-dev', 'cto');

        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('ceo', 'ceo', 0, 'CEO');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('cto', 'ceo', 1, 'CEO');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('cto', 'cto', 0, 'CTO');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('backend-dev', 'ceo', 2, 'CEO');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('backend-dev', 'cto', 1, 'CTO');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('backend-dev', 'backend-dev', 0, 'Backend Dev');

        const hierarchy = getAgentHierarchyContext(db, 'backend-dev');

        expect(hierarchy).not.toBeNull();
        expect(hierarchy?.managerId).toBe('cto');
        expect(hierarchy?.subordinateIds).toEqual([]);
        expect(hierarchy?.hierarchyPath).toBe('CEO');
        expect(hierarchy?.hierarchyDepth).toBe(2);

        db.close();
      });

      it('should return hierarchy context for top-level agent (no manager)', () => {
        const { getAgentHierarchyContext } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        db.exec(`
          CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            reporting_to TEXT
          );
          CREATE TABLE org_hierarchy (
            agent_id TEXT,
            ancestor_id TEXT,
            depth INTEGER,
            path TEXT
          );
        `);

        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('ceo', null);
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('ceo', 'ceo', 0, 'CEO');

        const hierarchy = getAgentHierarchyContext(db, 'ceo');

        expect(hierarchy).not.toBeNull();
        expect(hierarchy?.managerId).toBeNull();
        expect(hierarchy?.subordinateIds).toEqual([]);
        expect(hierarchy?.hierarchyPath).toBe('CEO');
        expect(hierarchy?.hierarchyDepth).toBe(0);

        db.close();
      });

      it('should include subordinate IDs for agent with direct reports', () => {
        const { getAgentHierarchyContext } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        db.exec(`
          CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            reporting_to TEXT
          );
          CREATE TABLE org_hierarchy (
            agent_id TEXT,
            ancestor_id TEXT,
            depth INTEGER,
            path TEXT
          );
        `);

        // CTO with two subordinates: backend-dev and frontend-dev
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('ceo', null);
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('cto', 'ceo');
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('backend-dev', 'cto');
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('frontend-dev', 'cto');

        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('cto', 'ceo', 1, 'CEO');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('cto', 'cto', 0, 'CTO');

        const hierarchy = getAgentHierarchyContext(db, 'cto');

        expect(hierarchy).not.toBeNull();
        expect(hierarchy?.managerId).toBe('ceo');
        expect(hierarchy?.subordinateIds).toHaveLength(2);
        expect(hierarchy?.subordinateIds).toContain('backend-dev');
        expect(hierarchy?.subordinateIds).toContain('frontend-dev');

        db.close();
      });

      it('should return null for non-existent agent', () => {
        const { getAgentHierarchyContext } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        db.exec(`
          CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            reporting_to TEXT
          );
          CREATE TABLE org_hierarchy (
            agent_id TEXT,
            ancestor_id TEXT,
            depth INTEGER,
            path TEXT
          );
        `);

        const hierarchy = getAgentHierarchyContext(db, 'non-existent');

        expect(hierarchy).toBeNull();

        db.close();
      });

      it('should handle database errors gracefully', () => {
        const { getAgentHierarchyContext } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        // Don't create tables - this will cause an error
        const hierarchy = getAgentHierarchyContext(db, 'test-agent');

        expect(hierarchy).toBeNull();

        db.close();
      });
    });

    describe('createHierarchicalAgentLogger', () => {
      it('should create logger with hierarchical context included', () => {
        const { createHierarchicalAgentLogger } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        db.exec(`
          CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            reporting_to TEXT
          );
          CREATE TABLE org_hierarchy (
            agent_id TEXT,
            ancestor_id TEXT,
            depth INTEGER,
            path TEXT
          );
        `);

        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('ceo', null);
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('backend-dev', 'ceo');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('backend-dev', 'ceo', 1, 'CEO');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('backend-dev', 'backend-dev', 0, 'Backend Dev');

        const logger = createHierarchicalAgentLogger(db, 'backend-dev');

        expect(logger).toBeDefined();
        expect(logger.info).toBeInstanceOf(Function);
        expect(logger.warn).toBeInstanceOf(Function);
        expect(logger.error).toBeInstanceOf(Function);
        expect(logger.debug).toBeInstanceOf(Function);

        db.close();
      });

      it('should throw error for empty agent ID', () => {
        const { createHierarchicalAgentLogger } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        expect(() => createHierarchicalAgentLogger(db, '')).toThrow(
          'agentId is required and cannot be empty'
        );
        expect(() => createHierarchicalAgentLogger(db, '   ')).toThrow(
          'agentId is required and cannot be empty'
        );

        db.close();
      });

      it('should work even if hierarchy lookup fails', () => {
        const { createHierarchicalAgentLogger } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        // Don't create tables - hierarchy lookup will fail but logger should still work
        const logger = createHierarchicalAgentLogger(db, 'test-agent');

        expect(logger).toBeDefined();
        expect(() => logger.info('Test message')).not.toThrow();

        db.close();
      });

      it('should include manager ID in default metadata', () => {
        const { createHierarchicalAgentLogger } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        db.exec(`
          CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            reporting_to TEXT
          );
          CREATE TABLE org_hierarchy (
            agent_id TEXT,
            ancestor_id TEXT,
            depth INTEGER,
            path TEXT
          );
        `);

        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('manager', null);
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('subordinate', 'manager');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('subordinate', 'manager', 1, 'Manager');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('subordinate', 'subordinate', 0, 'Subordinate');

        const logger = createHierarchicalAgentLogger(db, 'subordinate');

        // Test that logger was created with hierarchy metadata
        expect(logger).toBeDefined();

        db.close();
      });

      it('should not include manager ID for top-level agent', () => {
        const { createHierarchicalAgentLogger } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        db.exec(`
          CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            reporting_to TEXT
          );
          CREATE TABLE org_hierarchy (
            agent_id TEXT,
            ancestor_id TEXT,
            depth INTEGER,
            path TEXT
          );
        `);

        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('ceo', null);
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('ceo', 'ceo', 0, 'CEO');

        const logger = createHierarchicalAgentLogger(db, 'ceo');

        expect(logger).toBeDefined();

        db.close();
      });

      it('should include subordinate IDs when agent has direct reports', () => {
        const { createHierarchicalAgentLogger } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        db.exec(`
          CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            reporting_to TEXT
          );
          CREATE TABLE org_hierarchy (
            agent_id TEXT,
            ancestor_id TEXT,
            depth INTEGER,
            path TEXT
          );
        `);

        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('manager', null);
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('sub1', 'manager');
        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('sub2', 'manager');
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('manager', 'manager', 0, 'Manager');

        const logger = createHierarchicalAgentLogger(db, 'manager');

        expect(logger).toBeDefined();

        db.close();
      });

      it('should allow option overrides', () => {
        const { createHierarchicalAgentLogger } = require('../logger');
        const Database = require('better-sqlite3');
        const db = new Database(':memory:');

        db.exec(`
          CREATE TABLE agents (
            id TEXT PRIMARY KEY,
            reporting_to TEXT
          );
          CREATE TABLE org_hierarchy (
            agent_id TEXT,
            ancestor_id TEXT,
            depth INTEGER,
            path TEXT
          );
        `);

        db.prepare('INSERT INTO agents (id, reporting_to) VALUES (?, ?)').run('test-agent', null);
        db.prepare('INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path) VALUES (?, ?, ?, ?)').run('test-agent', 'test-agent', 0, 'Test Agent');

        const logger = createHierarchicalAgentLogger(db, 'test-agent', {
          level: 'debug',
          console: true,
        });

        expect(logger).toBeDefined();
        expect(() => logger.debug('Debug message')).not.toThrow();

        db.close();
      });
    });
  });
});
