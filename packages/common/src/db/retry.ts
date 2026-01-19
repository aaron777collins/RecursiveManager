/**
 * Retry utilities with exponential backoff for database operations
 *
 * This module provides retry logic for handling SQLITE_BUSY errors
 * (error code 5) which occur when the database is locked.
 *
 * Features:
 * - Exponential backoff with configurable parameters
 * - Jitter to prevent thundering herd
 * - Specific handling for SQLITE_BUSY errors
 * - Configurable max retries and backoff limits
 *
 * @module db/retry
 */

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts
   * @default 5
   */
  maxRetries?: number;

  /**
   * Initial backoff delay in milliseconds
   * @default 100
   */
  initialBackoff?: number;

  /**
   * Maximum backoff delay in milliseconds
   * @default 5000
   */
  maxBackoff?: number;

  /**
   * Backoff multiplier for exponential growth
   * @default 2
   */
  backoffMultiplier?: number;

  /**
   * Whether to add jitter to prevent thundering herd
   * @default true
   */
  enableJitter?: boolean;

  /**
   * Callback invoked before each retry attempt
   */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxRetries: 5,
  initialBackoff: 100,
  maxBackoff: 5000,
  backoffMultiplier: 2,
  enableJitter: true,
};

/**
 * SQLite error codes
 */
export const SQLITE_ERROR_CODES = {
  BUSY: 5, // Database is locked
  LOCKED: 6, // A table in the database is locked
  IOERR: 10, // Disk I/O error
  CORRUPT: 11, // The database disk image is malformed
  FULL: 13, // Insertion failed because database is full
  CANTOPEN: 14, // Unable to open the database file
} as const;

/**
 * Check if an error is a SQLITE_BUSY error
 *
 * @param error - Error to check
 * @returns True if the error is SQLITE_BUSY
 */
export function isSQLiteBusyError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  // better-sqlite3 errors have a 'code' property
  const code = (error as { code?: string | number }).code;

  // Check for numeric error code 5 (SQLITE_BUSY)
  if (code === SQLITE_ERROR_CODES.BUSY || code === 'SQLITE_BUSY') {
    return true;
  }

  // Also check error message as fallback
  const message = (error as { message?: string }).message;
  if (message && message.includes('SQLITE_BUSY')) {
    return true;
  }

  return false;
}

/**
 * Check if an error is a SQLITE_LOCKED error
 *
 * @param error - Error to check
 * @returns True if the error is SQLITE_LOCKED
 */
export function isSQLiteLockedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const code = (error as { code?: string | number }).code;
  if (code === SQLITE_ERROR_CODES.LOCKED || code === 'SQLITE_LOCKED') {
    return true;
  }

  const message = (error as { message?: string }).message;
  if (message && message.includes('SQLITE_LOCKED')) {
    return true;
  }

  return false;
}

/**
 * Check if an error is retryable (BUSY or LOCKED)
 *
 * @param error - Error to check
 * @returns True if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return isSQLiteBusyError(error) || isSQLiteLockedError(error);
}

/**
 * Calculate the delay for the next retry attempt
 *
 * @param attempt - Current attempt number (0-based)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
function calculateBackoff(
  attempt: number,
  options: Required<Omit<RetryOptions, 'onRetry'>>
): number {
  const { initialBackoff, maxBackoff, backoffMultiplier, enableJitter } = options;

  // Calculate exponential backoff: initialBackoff * (multiplier ^ attempt)
  let delay = initialBackoff * Math.pow(backoffMultiplier, attempt);

  // Cap at maxBackoff
  delay = Math.min(delay, maxBackoff);

  // Add jitter if enabled (randomize between 50% and 100% of delay)
  if (enableJitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.floor(delay);
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a database operation with retry logic and exponential backoff
 *
 * This function wraps a database operation and retries it if it fails with
 * SQLITE_BUSY or SQLITE_LOCKED errors. It uses exponential backoff with
 * optional jitter to prevent thundering herd problems.
 *
 * @param operation - Function to execute (can be sync or async)
 * @param options - Retry configuration options
 * @returns Result of the operation
 * @throws Error if all retry attempts are exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => T | Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Execute the operation (handle both sync and async)
      return await operation();
    } catch (error) {
      // Convert to Error if it's not already
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // Check if this is a retryable error
      if (!isRetryableError(error)) {
        // Not a retryable error, throw immediately
        throw err;
      }

      // Check if we've exhausted retries
      if (attempt >= opts.maxRetries) {
        // No more retries, throw with context
        throw new Error(
          `Database operation failed after ${opts.maxRetries} retries: ${err.message}`,
          { cause: err }
        );
      }

      // Calculate backoff delay
      const delayMs = calculateBackoff(attempt, opts);

      // Invoke onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(err, attempt + 1, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError ?? new Error('Operation failed with unknown error');
}

/**
 * Execute a synchronous database operation with retry logic
 *
 * This is a convenience wrapper for synchronous operations that converts
 * the async retry logic to synchronous by using busy-waiting.
 *
 * Note: This uses setTimeout under the hood, so it's not truly synchronous.
 * For truly synchronous retries in better-sqlite3, use withRetrySync instead.
 *
 * @param operation - Synchronous function to execute
 * @param options - Retry configuration options
 * @returns Result of the operation
 * @throws Error if all retry attempts are exhausted
 *
 * @example
 * ```typescript
 * const result = withRetrySyncCompat(
 *   () => db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId),
 *   { maxRetries: 3 }
 * );
 * ```
 */
export function withRetrySyncCompat<T>(operation: () => T, options: RetryOptions = {}): T {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      if (!isRetryableError(error)) {
        throw err;
      }

      if (attempt >= opts.maxRetries) {
        throw new Error(
          `Database operation failed after ${opts.maxRetries} retries: ${err.message}`,
          { cause: err }
        );
      }

      const delayMs = calculateBackoff(attempt, opts);

      if (options.onRetry) {
        options.onRetry(err, attempt + 1, delayMs);
      }

      // Synchronous sleep (busy-wait) - not ideal but works for small delays
      // For better performance, use withRetry (async) instead
      const start = Date.now();
      while (Date.now() - start < delayMs) {
        // Busy wait
      }
    }
  }

  throw lastError ?? new Error('Operation failed with unknown error');
}

/**
 * Create a retry wrapper for a specific operation
 *
 * This is a higher-order function that creates a wrapped version of an
 * operation with retry logic built-in.
 *
 * @param operation - Function to wrap
 * @param options - Retry configuration options
 * @returns Wrapped function with retry logic
 *
 * @example
 * ```typescript
 * const getAgentWithRetry = createRetryWrapper(
 *   (id: string) => db.prepare('SELECT * FROM agents WHERE id = ?').get(id),
 *   { maxRetries: 3 }
 * );
 *
 * const agent = await getAgentWithRetry('agent-123');
 * ```
 */
export function createRetryWrapper<TArgs extends unknown[], TResult>(
  operation: (...args: TArgs) => TResult | Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    return withRetry(() => operation(...args), options);
  };
}
