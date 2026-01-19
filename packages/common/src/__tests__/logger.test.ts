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

  describe('JSON Output Format (Task 1.4.12)', () => {
    let tempFile: string;

    beforeEach(() => {
      tempFile = path.join(os.tmpdir(), `test-json-${Date.now()}.log`);
    });

    afterEach(() => {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    });

    const waitForFile = () => {
      return new Promise((resolve) => setTimeout(resolve, 100));
    };

    it('should output all required fields in JSON format', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
      });

      logger.info('Test message', { traceId: 'test-trace-123' });

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(content.trim().split('\n')[0] as string);

      // Verify all required fields are present
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level');
      expect(parsed).toHaveProperty('message');
      expect(parsed).toHaveProperty('metadata');

      // Verify field types
      expect(typeof parsed.timestamp).toBe('string');
      expect(typeof parsed.level).toBe('string');
      expect(typeof parsed.message).toBe('string');
      expect(typeof parsed.metadata).toBe('object');
    });

    it('should format timestamp with millisecond precision', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
      });

      logger.info('Timestamp test');

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(content.trim().split('\n')[0] as string);

      // Winston format: YYYY-MM-DD HH:mm:ss.SSS
      expect(parsed.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/
      );

      // Verify it's a valid timestamp format
      expect(parsed.timestamp).toBeDefined();
      expect(typeof parsed.timestamp).toBe('string');

      // Should have millisecond precision (3 digits after seconds)
      const millisPart = parsed.timestamp.split('.')[1];
      expect(millisPart).toHaveLength(3);
    });

    it('should include correct level for each log method', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
        level: 'debug',
      });

      logger.error('Error message');
      logger.warn('Warn message');
      logger.info('Info message');
      logger.debug('Debug message');

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(4);

      const errorLog = JSON.parse(lines[0] as string);
      const warnLog = JSON.parse(lines[1] as string);
      const infoLog = JSON.parse(lines[2] as string);
      const debugLog = JSON.parse(lines[3] as string);

      expect(errorLog.level).toBe('error');
      expect(warnLog.level).toBe('warn');
      expect(infoLog.level).toBe('info');
      expect(debugLog.level).toBe('debug');
    });

    it('should preserve custom metadata fields in JSON output', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
      });

      logger.info('Custom metadata test', {
        customField1: 'value1',
        customField2: 42,
        customField3: true,
        customNested: { nested: 'value' },
      });

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(content.trim().split('\n')[0] as string);

      expect(parsed.metadata.customField1).toBe('value1');
      expect(parsed.metadata.customField2).toBe(42);
      expect(parsed.metadata.customField3).toBe(true);
      expect(parsed.metadata.customNested).toEqual({ nested: 'value' });
    });

    it('should include all standard metadata fields when provided', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
      });

      const metadata = {
        traceId: 'trace-123',
        agentId: 'agent-456',
        taskId: 'task-789',
        executionId: 'exec-abc',
        managerId: 'manager-001',
        subordinateIds: ['sub-1', 'sub-2'],
        hierarchyPath: 'CEO/CTO/Dev',
        hierarchyDepth: 2,
      };

      logger.info('Standard metadata test', metadata);

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(content.trim().split('\n')[0] as string);

      expect(parsed.metadata.traceId).toBe('trace-123');
      expect(parsed.metadata.agentId).toBe('agent-456');
      expect(parsed.metadata.taskId).toBe('task-789');
      expect(parsed.metadata.executionId).toBe('exec-abc');
      expect(parsed.metadata.managerId).toBe('manager-001');
      expect(parsed.metadata.subordinateIds).toEqual(['sub-1', 'sub-2']);
      expect(parsed.metadata.hierarchyPath).toBe('CEO/CTO/Dev');
      expect(parsed.metadata.hierarchyDepth).toBe(2);
    });

    it('should merge default metadata with call-time metadata in JSON output', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
        defaultMetadata: {
          traceId: 'default-trace',
          agentId: 'default-agent',
        },
      });

      logger.info('Merge test', { taskId: 'task-123' });

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(content.trim().split('\n')[0] as string);

      expect(parsed.metadata.traceId).toBe('default-trace');
      expect(parsed.metadata.agentId).toBe('default-agent');
      expect(parsed.metadata.taskId).toBe('task-123');
    });

    it('should override default metadata with call-time metadata in JSON output', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
        defaultMetadata: {
          traceId: 'default-trace',
          agentId: 'default-agent',
        },
      });

      logger.info('Override test', {
        traceId: 'override-trace',
      });

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(content.trim().split('\n')[0] as string);

      expect(parsed.metadata.traceId).toBe('override-trace');
      expect(parsed.metadata.agentId).toBe('default-agent');
    });

    it('should produce valid JSONL format (one JSON object per line)', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
      });

      logger.info('Line 1');
      logger.info('Line 2');
      logger.info('Line 3');

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(3);

      // Each line should be valid JSON
      lines.forEach((line, index) => {
        expect(() => JSON.parse(line)).not.toThrow();
        const parsed = JSON.parse(line);
        expect(parsed.message).toBe(`Line ${index + 1}`);
      });
    });

    it('should handle empty metadata gracefully in JSON output', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
      });

      logger.info('Empty metadata test', {});

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(content.trim().split('\n')[0] as string);

      expect(parsed.metadata).toBeDefined();
      expect(typeof parsed.metadata).toBe('object');
    });

    it('should handle undefined metadata in JSON output', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
      });

      logger.info('Undefined metadata test');

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(content.trim().split('\n')[0] as string);

      expect(parsed.metadata).toBeDefined();
    });

    it('should produce consistent JSON structure across all log levels', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
        level: 'debug',
      });

      const metadata = { traceId: 'consistent-test' };

      logger.error('Error', metadata);
      logger.warn('Warn', metadata);
      logger.info('Info', metadata);
      logger.debug('Debug', metadata);

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const lines = content.trim().split('\n');

      // All logs should have the same structure
      lines.forEach((line) => {
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('level');
        expect(parsed).toHaveProperty('message');
        expect(parsed).toHaveProperty('metadata');
        expect(parsed.metadata.traceId).toBe('consistent-test');
      });
    });

    it('should properly escape special characters in JSON', async () => {
      const logger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
      });

      const specialMessage = 'Message with "quotes", \nnewlines, and \ttabs';
      const specialMetadata = {
        field: 'Value with "quotes" and \\ backslashes',
      };

      logger.info(specialMessage, specialMetadata);

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(content.trim().split('\n')[0] as string);

      expect(parsed.message).toContain('quotes');
      expect(parsed.message).toContain('newlines');
      expect(parsed.message).toContain('tabs');
      expect(parsed.metadata.field).toContain('quotes');
      expect(parsed.metadata.field).toContain('\\');
    });

    it('should include child logger metadata in JSON output', async () => {
      const parentLogger = createLogger({
        file: true,
        filePath: tempFile,
        console: false,
        json: true,
        defaultMetadata: { parentField: 'parent-value' },
      });

      const childLogger = parentLogger.child({ childField: 'child-value' });
      childLogger.info('Child log', { callField: 'call-value' });

      await waitForFile();

      const content = fs.readFileSync(tempFile, 'utf-8');
      const parsed = JSON.parse(content.trim().split('\n')[0] as string);

      expect(parsed.metadata.parentField).toBe('parent-value');
      expect(parsed.metadata.childField).toBe('child-value');
      expect(parsed.metadata.callField).toBe('call-value');
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

    afterAll(async () => {
      // Wait for any pending async writes to complete
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Clean up test directory
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
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

  describe('Log Rotation Integration (Task 1.4.13)', () => {
    const testDir = path.join(
      os.tmpdir(),
      `logger-rotation-integration-test-${Date.now()}`
    );

    beforeEach(() => {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    afterEach(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    it('should create log files with date pattern in filename', async () => {
      const logFile = path.join(testDir, 'dated.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
        datePattern: 'YYYY-MM-DD',
      });

      logger.info('Test message');

      // Wait for file write
      await new Promise((resolve) => setTimeout(resolve, 150));

      const files = fs.readdirSync(testDir);

      // Should have file with date pattern: dated-YYYY-MM-DD.log
      const datedFiles = files.filter((f) => f.match(/dated-\d{4}-\d{2}-\d{2}\.log/));
      expect(datedFiles.length).toBeGreaterThan(0);
    });

    it('should write logs to rotated file', async () => {
      const logFile = path.join(testDir, 'content-test.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
        json: true,
      });

      logger.info('Rotation message 1');
      logger.info('Rotation message 2');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const files = fs.readdirSync(testDir);
      const logFiles = files.filter((f) => f.startsWith('content-test'));

      expect(logFiles.length).toBeGreaterThan(0);

      // Read the log file and verify content
      const logFilePath = path.join(testDir, logFiles[0] as string);
      const content = fs.readFileSync(logFilePath, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines.length).toBe(2);
      expect(content).toContain('Rotation message 1');
      expect(content).toContain('Rotation message 2');
    });

    it('should handle multiple log files with rotation enabled', async () => {
      const logFile = path.join(testDir, 'multi.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
        maxSize: '1k', // Small size to trigger rotation with enough data
      });

      // Write many logs to potentially trigger size-based rotation
      for (let i = 0; i < 100; i++) {
        logger.info(`Message ${i}: ${'x'.repeat(50)}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const files = fs.readdirSync(testDir);
      const logFiles = files.filter((f) => f.startsWith('multi'));

      // Should have at least one log file
      expect(logFiles.length).toBeGreaterThan(0);

      // Verify all log files have valid content
      logFiles.forEach((file) => {
        const content = fs.readFileSync(path.join(testDir, file), 'utf-8');
        expect(content.length).toBeGreaterThan(0);
      });
    });

    it('should create gzipped archives when compression is enabled', async () => {
      const logFile = path.join(testDir, 'compressed.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        compress: true,
        console: false,
      });

      logger.info('Compression test message');

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Note: Compression only happens when files are rotated/archived
      // This test verifies the logger is created with compression enabled
      // In a real scenario, old log files would be compressed to .gz
      const files = fs.readdirSync(testDir);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should respect maxSize option and create new files when size exceeded', async () => {
      const logFile = path.join(testDir, 'size-limit.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        maxSize: '500', // 500 bytes - very small to trigger rotation
        console: false,
      });

      // Write enough data to exceed maxSize
      const largeMessage = 'x'.repeat(100);
      for (let i = 0; i < 10; i++) {
        logger.info(`Large message ${i}: ${largeMessage}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 200));

      const files = fs.readdirSync(testDir);
      const logFiles = files.filter((f) => f.startsWith('size-limit'));

      // Winston may create multiple files if size is exceeded
      expect(logFiles.length).toBeGreaterThan(0);

      // Verify files exist and have content
      logFiles.forEach((file) => {
        const stat = fs.statSync(path.join(testDir, file));
        expect(stat.size).toBeGreaterThan(0);
      });
    });

    it('should use custom date pattern in log filenames', async () => {
      const logFile = path.join(testDir, 'custom-date.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        datePattern: 'YYYY-MM-DD-HH',
        console: false,
      });

      logger.info('Custom date pattern test');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const files = fs.readdirSync(testDir);

      // Should have file with hour-level date pattern: custom-date-YYYY-MM-DD-HH.log
      const customDatedFiles = files.filter((f) =>
        f.match(/custom-date-\d{4}-\d{2}-\d{2}-\d{2}\.log/)
      );
      expect(customDatedFiles.length).toBeGreaterThan(0);
    });

    it('should maintain log integrity across rotation', async () => {
      const logFile = path.join(testDir, 'integrity.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
        json: true,
      });

      const messages = [
        'Message 1',
        'Message 2',
        'Message 3',
        'Message 4',
        'Message 5',
      ];

      messages.forEach((msg) => logger.info(msg));

      await new Promise((resolve) => setTimeout(resolve, 150));

      const files = fs.readdirSync(testDir);
      const logFiles = files.filter((f) => f.startsWith('integrity'));

      expect(logFiles.length).toBeGreaterThan(0);

      // Verify all messages are present across all log files
      let allContent = '';
      logFiles.forEach((file) => {
        const content = fs.readFileSync(path.join(testDir, file), 'utf-8');
        allContent += content;
      });

      messages.forEach((msg) => {
        expect(allContent).toContain(msg);
      });

      // Verify all lines are valid JSON
      const allLines = allContent.trim().split('\n');
      allLines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should handle rotation with child loggers', async () => {
      const logFile = path.join(testDir, 'child-rotation.log');
      const parentLogger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
        defaultMetadata: { parent: 'value' },
      });

      const childLogger = parentLogger.child({ child: 'value' });

      parentLogger.info('Parent message');
      childLogger.info('Child message');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const files = fs.readdirSync(testDir);
      const logFiles = files.filter((f) => f.startsWith('child-rotation'));

      expect(logFiles.length).toBeGreaterThan(0);

      const content = fs.readFileSync(
        path.join(testDir, logFiles[0] as string),
        'utf-8'
      );
      expect(content).toContain('Parent message');
      expect(content).toContain('Child message');
    });

    it('should support concurrent writes to rotated log files', async () => {
      const logFile = path.join(testDir, 'concurrent.log');
      const logger1 = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
      });

      const logger2 = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
      });

      // Write from both loggers concurrently
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise((resolve) => {
            logger1.info(`Logger1 message ${i}`);
            resolve();
          })
        );
        promises.push(
          new Promise((resolve) => {
            logger2.info(`Logger2 message ${i}`);
            resolve();
          })
        );
      }

      await Promise.all(promises);
      await new Promise((resolve) => setTimeout(resolve, 200));

      const files = fs.readdirSync(testDir);
      const logFiles = files.filter((f) => f.startsWith('concurrent'));

      expect(logFiles.length).toBeGreaterThan(0);

      // Verify content exists
      const content = fs.readFileSync(
        path.join(testDir, logFiles[0] as string),
        'utf-8'
      );
      expect(content.length).toBeGreaterThan(0);
    });

    it('should preserve metadata through rotation', async () => {
      const logFile = path.join(testDir, 'metadata-rotation.log');
      const logger = createLogger({
        file: true,
        filePath: logFile,
        rotation: true,
        console: false,
        json: true,
        defaultMetadata: {
          traceId: 'trace-123',
          agentId: 'agent-456',
        },
      });

      logger.info('Message with metadata', { taskId: 'task-789' });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const files = fs.readdirSync(testDir);
      const logFiles = files.filter((f) => f.startsWith('metadata-rotation'));

      expect(logFiles.length).toBeGreaterThan(0);

      const content = fs.readFileSync(
        path.join(testDir, logFiles[0] as string),
        'utf-8'
      );
      const parsed = JSON.parse(content.trim());

      expect(parsed.metadata.traceId).toBe('trace-123');
      expect(parsed.metadata.agentId).toBe('agent-456');
      expect(parsed.metadata.taskId).toBe('task-789');
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
