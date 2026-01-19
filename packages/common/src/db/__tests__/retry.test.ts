/**
 * Tests for retry utilities with exponential backoff
 *
 * @group unit
 */

import {
  withRetry,
  withRetrySyncCompat,
  createRetryWrapper,
  isSQLiteBusyError,
  isSQLiteLockedError,
  isRetryableError,
  SQLITE_ERROR_CODES,
} from '../retry';

// Mock error types
class SQLiteBusyError extends Error {
  code: number;
  constructor(message = 'database is locked') {
    super(message);
    this.name = 'SqliteError';
    this.code = SQLITE_ERROR_CODES.BUSY;
  }
}

class SQLiteLockedError extends Error {
  code: number;
  constructor(message = 'table is locked') {
    super(message);
    this.name = 'SqliteError';
    this.code = SQLITE_ERROR_CODES.LOCKED;
  }
}

class SQLiteGenericError extends Error {
  code: number;
  constructor(message = 'generic SQLite error', code = 1) {
    super(message);
    this.name = 'SqliteError';
    this.code = code;
  }
}

describe('Retry Utilities', () => {
  describe('isSQLiteBusyError', () => {
    it('should detect SQLITE_BUSY error by code', () => {
      const error = new SQLiteBusyError();
      expect(isSQLiteBusyError(error)).toBe(true);
    });

    it('should detect SQLITE_BUSY error by string code', () => {
      const error = { code: 'SQLITE_BUSY', message: 'database is locked' };
      expect(isSQLiteBusyError(error)).toBe(true);
    });

    it('should detect SQLITE_BUSY error by message', () => {
      const error = new Error('Error: SQLITE_BUSY - database is locked');
      expect(isSQLiteBusyError(error)).toBe(true);
    });

    it('should return false for non-busy errors', () => {
      expect(isSQLiteBusyError(new Error('generic error'))).toBe(false);
      expect(isSQLiteBusyError(new SQLiteGenericError())).toBe(false);
      expect(isSQLiteBusyError(null)).toBe(false);
      expect(isSQLiteBusyError(undefined)).toBe(false);
      expect(isSQLiteBusyError('string')).toBe(false);
    });
  });

  describe('isSQLiteLockedError', () => {
    it('should detect SQLITE_LOCKED error by code', () => {
      const error = new SQLiteLockedError();
      expect(isSQLiteLockedError(error)).toBe(true);
    });

    it('should detect SQLITE_LOCKED error by string code', () => {
      const error = { code: 'SQLITE_LOCKED', message: 'table is locked' };
      expect(isSQLiteLockedError(error)).toBe(true);
    });

    it('should detect SQLITE_LOCKED error by message', () => {
      const error = new Error('Error: SQLITE_LOCKED - table is locked');
      expect(isSQLiteLockedError(error)).toBe(true);
    });

    it('should return false for non-locked errors', () => {
      expect(isSQLiteLockedError(new Error('generic error'))).toBe(false);
      expect(isSQLiteLockedError(new SQLiteGenericError())).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for SQLITE_BUSY errors', () => {
      expect(isRetryableError(new SQLiteBusyError())).toBe(true);
    });

    it('should return true for SQLITE_LOCKED errors', () => {
      expect(isRetryableError(new SQLiteLockedError())).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isRetryableError(new Error('generic error'))).toBe(false);
      expect(isRetryableError(new SQLiteGenericError('corrupt', SQLITE_ERROR_CODES.CORRUPT))).toBe(
        false
      );
    });
  });

  describe('withRetry', () => {
    beforeEach(() => {
      jest.clearAllTimers();
    });

    it('should succeed on first attempt if no error', async () => {
      const operation = jest.fn().mockReturnValue('success');
      const result = await withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should succeed with async operations', async () => {
      const operation = jest.fn().mockResolvedValue('async success');
      const result = await withRetry(operation);

      expect(result).toBe('async success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on SQLITE_BUSY error', async () => {
      jest.useFakeTimers();

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new SQLiteBusyError())
        .mockRejectedValueOnce(new SQLiteBusyError())
        .mockResolvedValue('success after retries');

      const promise = withRetry(operation, { maxRetries: 3, initialBackoff: 100 });

      // Fast-forward through retries
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result).toBe('success after retries');
      expect(operation).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });

    it('should retry on SQLITE_LOCKED error', async () => {
      jest.useFakeTimers();

      const operation = jest
        .fn()
        .mockRejectedValueOnce(new SQLiteLockedError())
        .mockResolvedValue('success');

      const promise = withRetry(operation, { maxRetries: 3 });

      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should not retry on non-retryable errors', async () => {
      const error = new SQLiteGenericError('constraint violation', SQLITE_ERROR_CODES.CORRUPT);
      const operation = jest.fn().mockRejectedValue(error);

      await expect(withRetry(operation, { maxRetries: 3 })).rejects.toThrow('constraint violation');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exhausted', async () => {
      jest.useFakeTimers();

      const operation = jest.fn().mockRejectedValue(new SQLiteBusyError('persistent lock'));

      const promise = withRetry(operation, { maxRetries: 2 });

      // Advance timers and wait for rejection
      const advanceTimers = jest.runAllTimersAsync();
      await Promise.all([advanceTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow('Database operation failed after 2 retries');
      expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries

      jest.useRealTimers();
    });

    it('should use exponential backoff', async () => {
      jest.useFakeTimers();

      const delays: number[] = [];
      const operation = jest.fn().mockRejectedValue(new SQLiteBusyError());

      const promise = withRetry(operation, {
        maxRetries: 3,
        initialBackoff: 100,
        backoffMultiplier: 2,
        enableJitter: false,
        onRetry: (_error, _attempt, delayMs) => {
          delays.push(delayMs);
        },
      });

      const advanceTimers = jest.runAllTimersAsync();
      await Promise.all([advanceTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow();

      // Verify exponential growth: 100ms, 200ms, 400ms
      expect(delays).toEqual([100, 200, 400]);

      jest.useRealTimers();
    });

    it('should respect max backoff limit', async () => {
      jest.useFakeTimers();

      const delays: number[] = [];
      const operation = jest.fn().mockRejectedValue(new SQLiteBusyError());

      const promise = withRetry(operation, {
        maxRetries: 5,
        initialBackoff: 100,
        backoffMultiplier: 2,
        maxBackoff: 300,
        enableJitter: false,
        onRetry: (_error, _attempt, delayMs) => {
          delays.push(delayMs);
        },
      });

      const advanceTimers = jest.runAllTimersAsync();
      await Promise.all([advanceTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow();

      // Delays should cap at maxBackoff: 100, 200, 300, 300, 300
      expect(delays).toEqual([100, 200, 300, 300, 300]);

      jest.useRealTimers();
    });

    it('should add jitter when enabled', async () => {
      jest.useFakeTimers();

      const delays: number[] = [];
      const operation = jest.fn().mockRejectedValue(new SQLiteBusyError());

      const promise = withRetry(operation, {
        maxRetries: 3,
        initialBackoff: 100,
        backoffMultiplier: 2,
        enableJitter: true,
        onRetry: (_error, _attempt, delayMs) => {
          delays.push(delayMs);
        },
      });

      const advanceTimers = jest.runAllTimersAsync();
      await Promise.all([advanceTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow();

      // With jitter, delays should be randomized between 50% and 100% of base
      // Base delays: 100ms, 200ms, 400ms
      // Jittered range: [50-100], [100-200], [200-400]
      expect(delays[0]).toBeGreaterThanOrEqual(50);
      expect(delays[0]).toBeLessThanOrEqual(100);
      expect(delays[1]).toBeGreaterThanOrEqual(100);
      expect(delays[1]).toBeLessThanOrEqual(200);
      expect(delays[2]).toBeGreaterThanOrEqual(200);
      expect(delays[2]).toBeLessThanOrEqual(400);

      jest.useRealTimers();
    });

    it('should invoke onRetry callback with correct parameters', async () => {
      jest.useFakeTimers();

      const onRetry = jest.fn();
      const error = new SQLiteBusyError('test lock');
      const operation = jest.fn().mockRejectedValue(error);

      const promise = withRetry(operation, {
        maxRetries: 2,
        initialBackoff: 100,
        enableJitter: false,
        onRetry,
      });

      const advanceTimers = jest.runAllTimersAsync();
      await Promise.all([advanceTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow();

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(SQLiteBusyError), 1, 100);
      expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(SQLiteBusyError), 2, 200);

      jest.useRealTimers();
    });
  });

  describe('withRetrySyncCompat', () => {
    it('should succeed on first attempt', () => {
      const operation = jest.fn().mockReturnValue('sync success');
      const result = withRetrySyncCompat(operation);

      expect(result).toBe('sync success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on SQLITE_BUSY error', () => {
      const operation = jest
        .fn()
        .mockImplementationOnce(() => {
          throw new SQLiteBusyError();
        })
        .mockReturnValue('success');

      const result = withRetrySyncCompat(operation, {
        maxRetries: 2,
        initialBackoff: 10, // Small delay for test performance
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable errors', () => {
      const error = new SQLiteGenericError('constraint violation');
      const operation = jest.fn().mockImplementation(() => {
        throw error;
      });

      expect(() => withRetrySyncCompat(operation)).toThrow('constraint violation');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exhausted', () => {
      const operation = jest.fn().mockImplementation(() => {
        throw new SQLiteBusyError();
      });

      expect(() =>
        withRetrySyncCompat(operation, {
          maxRetries: 1,
          initialBackoff: 10,
        })
      ).toThrow('Database operation failed after 1 retries');

      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('createRetryWrapper', () => {
    it('should create a wrapped function with retry logic', async () => {
      jest.useFakeTimers();

      const baseOperation = jest
        .fn()
        .mockRejectedValueOnce(new SQLiteBusyError())
        .mockResolvedValue('wrapped success');

      const wrappedOperation = createRetryWrapper(baseOperation, { maxRetries: 2 });

      const promise = wrappedOperation();

      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('wrapped success');
      expect(baseOperation).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    it('should preserve function arguments', async () => {
      jest.useFakeTimers();

      const baseOperation = jest.fn((a: number, b: string) => `${a}-${b}`);
      const wrappedOperation = createRetryWrapper(baseOperation);

      const promise = wrappedOperation(42, 'test');

      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('42-test');
      expect(baseOperation).toHaveBeenCalledWith(42, 'test');

      jest.useRealTimers();
    });

    it('should work with multiple invocations', async () => {
      jest.useFakeTimers();

      const baseOperation = jest.fn((x: number) => x * 2);
      const wrappedOperation = createRetryWrapper(baseOperation);

      const promise1 = wrappedOperation(5);
      const promise2 = wrappedOperation(10);

      await jest.runAllTimersAsync();

      expect(await promise1).toBe(10);
      expect(await promise2).toBe(20);

      jest.useRealTimers();
    });
  });

  describe('Error edge cases', () => {
    it('should handle non-Error objects thrown', async () => {
      const operation = jest.fn().mockRejectedValue('string error');

      await expect(withRetry(operation)).rejects.toThrow('string error');
    });

    it('should handle null/undefined errors', async () => {
      const operation = jest.fn().mockRejectedValue(null);

      await expect(withRetry(operation)).rejects.toThrow();
    });

    it('should include cause in error chain', async () => {
      jest.useFakeTimers();

      const originalError = new SQLiteBusyError('original');
      const operation = jest.fn().mockRejectedValue(originalError);

      const promise = withRetry(operation, { maxRetries: 1 });

      const advanceTimers = jest.runAllTimersAsync();
      await Promise.all([advanceTimers, promise.catch(() => {})]);

      try {
        await promise;
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Database operation failed after 1 retries');
        expect((error as Error).cause).toBe(originalError);
      }

      jest.useRealTimers();
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle maxRetries of 0', async () => {
      const operation = jest.fn().mockRejectedValue(new SQLiteBusyError());

      await expect(withRetry(operation, { maxRetries: 0 })).rejects.toThrow();
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle very large backoff values', async () => {
      jest.useFakeTimers();

      const delays: number[] = [];
      const operation = jest.fn().mockRejectedValue(new SQLiteBusyError());

      const promise = withRetry(operation, {
        maxRetries: 1,
        initialBackoff: 1000000,
        maxBackoff: 10000,
        enableJitter: false,
        onRetry: (_error, _attempt, delayMs) => {
          delays.push(delayMs);
        },
      });

      const advanceTimers = jest.runAllTimersAsync();
      await Promise.all([advanceTimers, promise.catch(() => {})]);

      await expect(promise).rejects.toThrow();

      // Should be capped at maxBackoff
      expect(delays[0]).toBe(10000);

      jest.useRealTimers();
    });
  });
});
