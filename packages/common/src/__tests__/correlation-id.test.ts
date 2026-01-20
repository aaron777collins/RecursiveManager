/**
 * Tests for correlation ID propagation (Task 9.9)
 *
 * Verifies that trace IDs are automatically propagated through
 * AsyncLocalStorage and included in all log messages.
 */

import {
  createLogger,
  withTraceId,
  getCurrentTraceId,
  generateTraceId,
  setRequestContext,
  getRequestContext,
} from '../logger';

describe('Correlation ID Propagation', () => {
  describe('withTraceId', () => {
    it('should automatically generate trace ID if not provided', async () => {
      await withTraceId(async () => {
        const traceId = getCurrentTraceId();
        expect(traceId).toBeDefined();
        expect(typeof traceId).toBe('string');
        expect(traceId!.length).toBeGreaterThan(0);
      });
    });

    it('should use provided trace ID', async () => {
      const expectedTraceId = 'test-trace-123';
      await withTraceId(expectedTraceId, async () => {
        const traceId = getCurrentTraceId();
        expect(traceId).toBe(expectedTraceId);
      });
    });

    it('should propagate trace ID through nested async calls', async () => {
      const expectedTraceId = generateTraceId();

      await withTraceId(expectedTraceId, async () => {
        const traceId1 = getCurrentTraceId();
        expect(traceId1).toBe(expectedTraceId);

        // Simulate nested async operation
        await new Promise((resolve) => setTimeout(resolve, 10));

        const traceId2 = getCurrentTraceId();
        expect(traceId2).toBe(expectedTraceId);

        // Simulate another nested call
        await (async () => {
          const traceId3 = getCurrentTraceId();
          expect(traceId3).toBe(expectedTraceId);
        })();
      });
    });

    it('should isolate trace IDs between concurrent executions', async () => {
      const traceId1 = 'trace-1';
      const traceId2 = 'trace-2';

      const results = await Promise.all([
        withTraceId(traceId1, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return getCurrentTraceId();
        }),
        withTraceId(traceId2, async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return getCurrentTraceId();
        }),
      ]);

      expect(results[0]).toBe(traceId1);
      expect(results[1]).toBe(traceId2);
    });

    it('should return undefined when not in trace context', () => {
      const traceId = getCurrentTraceId();
      expect(traceId).toBeUndefined();
    });
  });

  describe('Request Context Management', () => {
    it('should set and get request context', async () => {
      await withTraceId(async () => {
        setRequestContext('userId', 'user-123');
        setRequestContext('operation', 'hire-agent');

        expect(getRequestContext('userId')).toBe('user-123');
        expect(getRequestContext('operation')).toBe('hire-agent');
      });
    });

    it('should return undefined for missing context keys', async () => {
      await withTraceId(async () => {
        expect(getRequestContext('nonexistent')).toBeUndefined();
      });
    });

    it('should isolate context between concurrent executions', async () => {
      const results = await Promise.all([
        withTraceId(async () => {
          setRequestContext('key', 'value1');
          await new Promise((resolve) => setTimeout(resolve, 50));
          return getRequestContext('key');
        }),
        withTraceId(async () => {
          setRequestContext('key', 'value2');
          await new Promise((resolve) => setTimeout(resolve, 50));
          return getRequestContext('key');
        }),
      ]);

      expect(results[0]).toBe('value1');
      expect(results[1]).toBe('value2');
    });

    it('should handle context outside of trace context gracefully', () => {
      setRequestContext('key', 'value'); // Should not throw
      const value = getRequestContext('key');
      expect(value).toBeUndefined();
    });
  });

  describe('Logger Trace ID Integration', () => {
    it('should include trace ID in log metadata automatically', async () => {
      const logs: any[] = [];
      const logger = createLogger({
        level: 'info',
        console: false,
      });

      // Mock the underlying Winston logger to capture logs
      const winstonLogger = (logger as any).logger;
      winstonLogger.on('data', (log: any) => {
        logs.push(log);
      });

      const expectedTraceId = generateTraceId();

      await withTraceId(expectedTraceId, async () => {
        logger.info('Test message', { key: 'value' });
      });

      // Wait for log to be processed
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(logs.length).toBeGreaterThan(0);
      const lastLog = logs[logs.length - 1];
      expect(lastLog.metadata?.traceId).toBe(expectedTraceId);
    });

    it('should allow explicit trace ID to override context trace ID', async () => {
      const logs: any[] = [];
      const logger = createLogger({
        level: 'info',
        console: false,
      });

      const winstonLogger = (logger as any).logger;
      winstonLogger.on('data', (log: any) => {
        logs.push(log);
      });

      const contextTraceId = generateTraceId();
      const explicitTraceId = generateTraceId();

      await withTraceId(contextTraceId, async () => {
        logger.info('Test message', { traceId: explicitTraceId });
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(logs.length).toBeGreaterThan(0);
      const lastLog = logs[logs.length - 1];
      // Explicit metadata should override context
      expect(lastLog.metadata?.traceId).toBe(explicitTraceId);
    });

    it('should work with child loggers', async () => {
      const logs: any[] = [];
      const logger = createLogger({
        level: 'info',
        console: false,
      });

      const winstonLogger = (logger as any).logger;
      winstonLogger.on('data', (log: any) => {
        logs.push(log);
      });

      const childLogger = logger.child({ agentId: 'agent-123' });
      const expectedTraceId = generateTraceId();

      await withTraceId(expectedTraceId, async () => {
        childLogger.info('Child log message');
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(logs.length).toBeGreaterThan(0);
      const lastLog = logs[logs.length - 1];
      expect(lastLog.metadata?.traceId).toBe(expectedTraceId);
      expect(lastLog.metadata?.agentId).toBe('agent-123');
    });
  });

  describe('Trace ID Generation', () => {
    it('should generate unique trace IDs', () => {
      const traceId1 = generateTraceId();
      const traceId2 = generateTraceId();
      const traceId3 = generateTraceId();

      expect(traceId1).not.toBe(traceId2);
      expect(traceId2).not.toBe(traceId3);
      expect(traceId1).not.toBe(traceId3);
    });

    it('should generate valid UUID v4 format', () => {
      const traceId = generateTraceId();
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(traceId).toMatch(uuidRegex);
    });
  });
});
