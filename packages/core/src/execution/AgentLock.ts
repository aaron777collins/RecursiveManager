/**
 * AgentLock - Async mutex-based locking for agent execution
 *
 * This module provides a mutex-based locking mechanism to prevent concurrent
 * executions of the same agent. It uses the async-mutex library to provide
 * async lock acquisition with queuing support.
 *
 * @module AgentLock
 */

import { Mutex } from 'async-mutex';

/**
 * Error thrown when agent lock operations fail
 */
export class AgentLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AgentLockError';
    Object.setPrototypeOf(this, AgentLockError.prototype);
  }
}

/**
 * AgentLock class
 *
 * Provides per-agent mutex locking to prevent concurrent executions.
 * Uses async-mutex library for proper async lock acquisition and queuing.
 *
 * Features:
 * - Per-agent mutex isolation
 * - Async lock acquisition with queuing
 * - Automatic lock release via try-finally pattern
 * - Lock status checking
 * - Graceful error handling
 *
 * Usage:
 * ```typescript
 * const lock = new AgentLock();
 * const release = await lock.acquire('agent-123');
 * try {
 *   // Execute agent
 * } finally {
 *   release();
 * }
 * ```
 */
export class AgentLock {
  /** Map of agent ID to mutex */
  private readonly mutexes: Map<string, Mutex> = new Map();

  /**
   * Acquire lock for an agent
   *
   * Returns a release function that must be called when execution completes.
   * If the agent is already locked, this will queue the request and wait.
   *
   * @param agentId - Agent identifier to lock
   * @returns Promise resolving to release function
   * @throws AgentLockError if agentId is invalid
   */
  async acquire(agentId: string): Promise<() => void> {
    if (!agentId || typeof agentId !== 'string') {
      throw new AgentLockError('Invalid agent ID provided');
    }

    // Get or create mutex for this agent
    let mutex = this.mutexes.get(agentId);
    if (!mutex) {
      mutex = new Mutex();
      this.mutexes.set(agentId, mutex);
    }

    // Acquire the mutex (will queue if already locked)
    const release = await mutex.acquire();

    // Return wrapped release function
    return () => {
      release();
    };
  }

  /**
   * Try to acquire lock without waiting (async version)
   *
   * Returns release function if lock is available, null if locked.
   * Does not queue the request - checks immediately and returns.
   *
   * Note: Since async-mutex doesn't support synchronous tryAcquire,
   * this method checks if the lock is available and returns null if locked.
   * For a proper non-blocking acquire, use this method with await.
   *
   * @param agentId - Agent identifier to lock
   * @returns Promise resolving to release function if acquired, null if locked
   * @throws AgentLockError if agentId is invalid
   */
  async tryAcquire(agentId: string): Promise<(() => void) | null> {
    if (!agentId || typeof agentId !== 'string') {
      throw new AgentLockError('Invalid agent ID provided');
    }

    // Get or create mutex for this agent
    let mutex = this.mutexes.get(agentId);
    if (!mutex) {
      mutex = new Mutex();
      this.mutexes.set(agentId, mutex);
    }

    // Check if mutex is already locked
    if (mutex.isLocked()) {
      return null;
    }

    // Mutex appears unlocked, try to acquire
    // Note: Small race condition possible, but acceptable for tryAcquire semantics
    const release = await mutex.acquire();

    // Return wrapped release function
    return () => {
      release();
    };
  }

  /**
   * Check if an agent is currently locked
   *
   * @param agentId - Agent identifier to check
   * @returns True if agent is currently locked
   */
  isLocked(agentId: string): boolean {
    const mutex = this.mutexes.get(agentId);
    return mutex ? mutex.isLocked() : false;
  }

  /**
   * Get number of waiters for an agent lock
   *
   * Returns the number of pending lock requests waiting for this agent.
   *
   * @param agentId - Agent identifier to check
   * @returns Number of pending lock requests
   */
  getWaiterCount(_agentId: string): number {
    // async-mutex doesn't expose waiter count, so we can't implement this
    // Return 0 for now (future enhancement)
    return 0;
  }

  /**
   * Clean up mutex for an agent
   *
   * Removes the mutex from the internal map. Should only be called
   * when the agent is no longer needed (e.g., agent deleted).
   *
   * Warning: Will not prevent cleanup if mutex is currently locked.
   *
   * @param agentId - Agent identifier to clean up
   */
  cleanup(agentId: string): void {
    this.mutexes.delete(agentId);
  }

  /**
   * Get total number of tracked mutexes
   *
   * @returns Number of agent mutexes currently tracked
   */
  getMutexCount(): number {
    return this.mutexes.size;
  }

  /**
   * Clear all mutexes
   *
   * Warning: This should only be used in testing or shutdown scenarios.
   * Will not check if mutexes are currently locked.
   */
  clearAll(): void {
    this.mutexes.clear();
  }
}
