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
 * Internal state for tracking pending tryAcquire operations
 */
interface MutexState {
  mutex: Mutex;
  /** Flag to prevent TOCTOU race in tryAcquire - set synchronously before await */
  tryAcquirePending: boolean;
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
  /** Map of agent ID to mutex state */
  private readonly mutexStates: Map<string, MutexState> = new Map();

  /**
   * Get or create mutex state for an agent
   */
  private getOrCreateMutexState(agentId: string): MutexState {
    let state = this.mutexStates.get(agentId);
    if (!state) {
      state = {
        mutex: new Mutex(),
        tryAcquirePending: false,
      };
      this.mutexStates.set(agentId, state);
    }
    return state;
  }

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

    // Get or create mutex state for this agent
    const state = this.getOrCreateMutexState(agentId);

    // Acquire the mutex (will queue if already locked)
    const release = await state.mutex.acquire();

    // Return wrapped release function
    return () => {
      release();
    };
  }

  /**
   * Try to acquire lock without waiting (non-blocking)
   *
   * Returns release function if lock is available, null if locked.
   * Does not queue the request - returns immediately.
   *
   * IMPORTANT: This method uses an atomic check-and-set pattern to prevent
   * TOCTOU (time-of-check-to-time-of-use) race conditions. The pattern works
   * because JavaScript is single-threaded:
   *
   * 1. We synchronously check both isLocked() AND tryAcquirePending flag
   * 2. If both are false, we synchronously set tryAcquirePending = true
   * 3. Only then do we await the actual acquire()
   * 4. Any concurrent tryAcquire calls will see tryAcquirePending = true
   *    and return null immediately
   *
   * This ensures that between checking the lock state and acquiring the lock,
   * no other tryAcquire call can slip through.
   *
   * Note: Regular acquire() calls can still queue up and will wait their turn.
   * This is the intended behavior - tryAcquire is for non-blocking attempts,
   * while acquire() is for guaranteed acquisition (with waiting).
   *
   * @param agentId - Agent identifier to lock
   * @returns Promise resolving to release function if acquired, null if locked
   * @throws AgentLockError if agentId is invalid
   */
  async tryAcquire(agentId: string): Promise<(() => void) | null> {
    if (!agentId || typeof agentId !== 'string') {
      throw new AgentLockError('Invalid agent ID provided');
    }

    // Get or create mutex state for this agent
    const state = this.getOrCreateMutexState(agentId);

    // ATOMIC CHECK: In JavaScript's single-threaded model, this synchronous
    // block cannot be interrupted. We check BOTH conditions and set the flag
    // before any await, preventing TOCTOU races between concurrent tryAcquire calls.
    if (state.mutex.isLocked() || state.tryAcquirePending) {
      return null;
    }

    // Mark that we have a pending tryAcquire - this is still synchronous
    // Any concurrent tryAcquire will now see this flag and return null
    state.tryAcquirePending = true;

    try {
      // Now we can safely await - we've already "reserved" our spot
      const release = await state.mutex.acquire();

      // Return wrapped release function
      return () => {
        release();
      };
    } finally {
      // Clear the pending flag whether we succeed or fail
      state.tryAcquirePending = false;
    }
  }

  /**
   * Check if an agent is currently locked
   *
   * @param agentId - Agent identifier to check
   * @returns True if agent is currently locked
   */
  isLocked(agentId: string): boolean {
    const state = this.mutexStates.get(agentId);
    return state ? state.mutex.isLocked() : false;
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
    this.mutexStates.delete(agentId);
  }

  /**
   * Get total number of tracked mutexes
   *
   * @returns Number of agent mutexes currently tracked
   */
  getMutexCount(): number {
    return this.mutexStates.size;
  }

  /**
   * Clear all mutexes
   *
   * Warning: This should only be used in testing or shutdown scenarios.
   * Will not check if mutexes are currently locked.
   */
  clearAll(): void {
    this.mutexStates.clear();
  }
}
