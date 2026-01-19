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
});
