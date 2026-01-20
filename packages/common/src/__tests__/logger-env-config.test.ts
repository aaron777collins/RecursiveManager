/**
 * Tests for logger environment variable configuration
 *
 * Tests that log levels are properly configured via LOG_LEVEL environment variable
 */

import { createLogger, createAgentLogger, logger } from '../logger';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

describe('Logger Environment Configuration', () => {
  const originalLogLevel = process.env.LOG_LEVEL;
  let testDir: string;

  beforeAll(() => {
    // Create temp directory for test logs
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-env-test-'));
  });

  afterAll(() => {
    // Restore original LOG_LEVEL
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('LOG_LEVEL environment variable', () => {
    it('should respect LOG_LEVEL=debug for default logger', () => {
      process.env.LOG_LEVEL = 'debug';

      // Clear module cache to reload config
      jest.resetModules();
      const { logger: testLogger } = require('../logger');
      const winstonLogger = (testLogger as any).getWinstonLogger();

      expect(winstonLogger.level).toBe('debug');
    });

    it('should respect LOG_LEVEL=warn for default logger', () => {
      process.env.LOG_LEVEL = 'warn';

      // Clear module cache to reload config
      jest.resetModules();
      const { logger: testLogger } = require('../logger');
      const winstonLogger = (testLogger as any).getWinstonLogger();

      expect(winstonLogger.level).toBe('warn');
    });

    it('should respect LOG_LEVEL=error for default logger', () => {
      process.env.LOG_LEVEL = 'error';

      // Clear module cache to reload config
      jest.resetModules();
      const { logger: testLogger } = require('../logger');
      const winstonLogger = (testLogger as any).getWinstonLogger();

      expect(winstonLogger.level).toBe('error');
    });

    it('should default to info when LOG_LEVEL is not set', () => {
      delete process.env.LOG_LEVEL;

      // Clear module cache to reload config
      jest.resetModules();
      const { logger: testLogger } = require('../logger');
      const winstonLogger = (testLogger as any).getWinstonLogger();

      expect(winstonLogger.level).toBe('info');
    });
  });

  describe('createAgentLogger with environment config', () => {
    beforeEach(() => {
      // Set up test environment directory
      process.env.RECURSIVE_MANAGER_HOME = testDir;
    });

    it('should use LOG_LEVEL=debug for agent logger when env var is set', () => {
      process.env.LOG_LEVEL = 'debug';

      // Clear module cache to reload config
      jest.resetModules();
      const { createAgentLogger: testCreateAgentLogger } = require('../logger');

      const agentLogger = testCreateAgentLogger('test-agent-001');
      const winstonLogger = (agentLogger as any).getWinstonLogger();

      expect(winstonLogger.level).toBe('debug');
    });

    it('should use LOG_LEVEL=warn for agent logger when env var is set', () => {
      process.env.LOG_LEVEL = 'warn';

      // Clear module cache to reload config
      jest.resetModules();
      const { createAgentLogger: testCreateAgentLogger } = require('../logger');

      const agentLogger = testCreateAgentLogger('test-agent-002');
      const winstonLogger = (agentLogger as any).getWinstonLogger();

      expect(winstonLogger.level).toBe('warn');
    });

    it('should use LOG_LEVEL=error for agent logger when env var is set', () => {
      process.env.LOG_LEVEL = 'error';

      // Clear module cache to reload config
      jest.resetModules();
      const { createAgentLogger: testCreateAgentLogger } = require('../logger');

      const agentLogger = testCreateAgentLogger('test-agent-003');
      const winstonLogger = (agentLogger as any).getWinstonLogger();

      expect(winstonLogger.level).toBe('error');
    });

    it('should default to info for agent logger when LOG_LEVEL is not set', () => {
      delete process.env.LOG_LEVEL;

      // Clear module cache to reload config
      jest.resetModules();
      const { createAgentLogger: testCreateAgentLogger } = require('../logger');

      const agentLogger = testCreateAgentLogger('test-agent-004');
      const winstonLogger = (agentLogger as any).getWinstonLogger();

      expect(winstonLogger.level).toBe('info');
    });

    it('should allow explicit level override even when LOG_LEVEL is set', () => {
      process.env.LOG_LEVEL = 'warn';

      // Clear module cache to reload config
      jest.resetModules();
      const { createAgentLogger: testCreateAgentLogger } = require('../logger');

      // Explicitly override with debug level
      const agentLogger = testCreateAgentLogger('test-agent-005', { level: 'debug' });
      const winstonLogger = (agentLogger as any).getWinstonLogger();

      expect(winstonLogger.level).toBe('debug');
    });
  });

  describe('createLogger with environment config', () => {
    it('should use explicit level over LOG_LEVEL when provided', () => {
      process.env.LOG_LEVEL = 'error';

      const customLogger = createLogger({ level: 'debug' });
      const winstonLogger = (customLogger as any).getWinstonLogger();

      expect(winstonLogger.level).toBe('debug');
    });

    it('should use default level (info) when no LOG_LEVEL and no explicit level', () => {
      delete process.env.LOG_LEVEL;

      const customLogger = createLogger();
      const winstonLogger = (customLogger as any).getWinstonLogger();

      // When no level is specified, Winston defaults to 'info'
      expect(winstonLogger.level).toBe('info');
    });
  });

  describe('log level filtering', () => {
    let logOutput: string[];

    beforeEach(() => {
      logOutput = [];
    });

    it('should filter debug logs when LOG_LEVEL=info', () => {
      process.env.LOG_LEVEL = 'info';

      // Clear module cache to reload config
      jest.resetModules();
      const { createLogger: testCreateLogger } = require('../logger');

      const testLogger = testCreateLogger({
        console: false,
        json: false,
      });

      // Mock Winston logger's write method
      const winstonLogger = (testLogger as any).getWinstonLogger();
      const originalWrite = winstonLogger.write;
      winstonLogger.write = jest.fn((info: any) => {
        logOutput.push(`${info.level}: ${info.message}`);
        return originalWrite.call(winstonLogger, info);
      });

      testLogger.debug('This should not appear');
      testLogger.info('This should appear');
      testLogger.warn('This should also appear');
      testLogger.error('This should also appear');

      // Debug should be filtered out
      expect(logOutput.some(log => log.includes('This should not appear'))).toBe(false);
      expect(logOutput.some(log => log.includes('This should appear'))).toBe(true);
    });

    it('should show debug logs when LOG_LEVEL=debug', () => {
      process.env.LOG_LEVEL = 'debug';

      // Clear module cache to reload config
      jest.resetModules();
      const { createLogger: testCreateLogger } = require('../logger');

      const testLogger = testCreateLogger({
        console: false,
        json: false,
      });

      // Mock Winston logger's write method
      const winstonLogger = (testLogger as any).getWinstonLogger();
      const originalWrite = winstonLogger.write;
      winstonLogger.write = jest.fn((info: any) => {
        logOutput.push(`${info.level}: ${info.message}`);
        return originalWrite.call(winstonLogger, info);
      });

      testLogger.debug('Debug message');
      testLogger.info('Info message');

      // Debug should appear
      expect(logOutput.some(log => log.includes('Debug message'))).toBe(true);
      expect(logOutput.some(log => log.includes('Info message'))).toBe(true);
    });

    it('should only show errors when LOG_LEVEL=error', () => {
      process.env.LOG_LEVEL = 'error';

      // Clear module cache to reload config
      jest.resetModules();
      const { createLogger: testCreateLogger } = require('../logger');

      const testLogger = testCreateLogger({
        console: false,
        json: false,
      });

      // Mock Winston logger's write method
      const winstonLogger = (testLogger as any).getWinstonLogger();
      const originalWrite = winstonLogger.write;
      winstonLogger.write = jest.fn((info: any) => {
        logOutput.push(`${info.level}: ${info.message}`);
        return originalWrite.call(winstonLogger, info);
      });

      testLogger.debug('Debug message');
      testLogger.info('Info message');
      testLogger.warn('Warn message');
      testLogger.error('Error message');

      // Only error should appear
      expect(logOutput.some(log => log.includes('Debug message'))).toBe(false);
      expect(logOutput.some(log => log.includes('Info message'))).toBe(false);
      expect(logOutput.some(log => log.includes('Warn message'))).toBe(false);
      expect(logOutput.some(log => log.includes('Error message'))).toBe(true);
    });
  });

  describe('documentation and examples', () => {
    it('should have valid log level values documented', () => {
      const validLevels = ['debug', 'info', 'warn', 'error'];

      validLevels.forEach(level => {
        process.env.LOG_LEVEL = level;

        // Clear module cache to reload config
        jest.resetModules();
        const { logger: testLogger } = require('../logger');
        const winstonLogger = (testLogger as any).getWinstonLogger();

        expect(winstonLogger.level).toBe(level);
      });
    });
  });
});
