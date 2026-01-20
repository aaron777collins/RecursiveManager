/**
 * Unit tests for ExecutionPool
 *
 * Tests the worker pool pattern for agent execution with queue management.
 * Ensures proper concurrency control, FIFO ordering, and statistics tracking.
 */

import { ExecutionPool } from '../ExecutionPool';

/**
 * Helper to create a task that resolves after a delay
 */
const createDelayedTask = <T>(value: T, delayMs: number): (() => Promise<T>) => {
  return () =>
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(value), delayMs);
    });
};

/**
 * Helper to create a task that rejects after a delay
 */
const createFailingTask = (error: Error, delayMs: number): (() => Promise<never>) => {
  return () =>
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(error), delayMs);
    });
};

/**
 * Helper to wait for a condition with timeout
 */
const waitFor = async (
  condition: () => boolean,
  timeoutMs = 1000,
  checkIntervalMs = 10
): Promise<void> => {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('waitFor timeout exceeded');
    }
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
  }
};

describe('ExecutionPool', () => {
  let pool: ExecutionPool;

  beforeEach(() => {
    pool = new ExecutionPool();
  });

  describe('constructor', () => {
    it('should use default maxConcurrent of 10', () => {
      const p = new ExecutionPool();
      expect(p.getMaxConcurrent()).toBe(10);
    });

    it('should accept custom maxConcurrent', () => {
      const p = new ExecutionPool({ maxConcurrent: 5 });
      expect(p.getMaxConcurrent()).toBe(5);
    });

    it('should initialize with empty state', () => {
      const stats = pool.getStatistics();
      expect(stats.activeCount).toBe(0);
      expect(stats.queueDepth).toBe(0);
      expect(stats.totalProcessed).toBe(0);
      expect(stats.totalFailed).toBe(0);
      expect(stats.avgQueueWaitTime).toBe(0);
      expect(stats.activeAgents).toEqual([]);
    });
  });

  describe('execute()', () => {
    describe('basic execution', () => {
      it('should execute task immediately when pool not at capacity', async () => {
        const result = await pool.execute('agent-1', async () => 'success');
        expect(result).toBe('success');
      });

      it('should return task result', async () => {
        const result = await pool.execute('agent-1', async () => 42);
        expect(result).toBe(42);
      });

      it('should throw if task fails', async () => {
        const error = new Error('Task failed');
        await expect(
          pool.execute('agent-1', async () => {
            throw error;
          })
        ).rejects.toThrow('Task failed');
      });

      it('should handle tasks that return complex objects', async () => {
        const obj = { foo: 'bar', baz: [1, 2, 3] };
        const result = await pool.execute('agent-1', async () => obj);
        expect(result).toEqual(obj);
      });

      it('should handle async task execution', async () => {
        const result = await pool.execute('agent-1', createDelayedTask('delayed-result', 50));
        expect(result).toBe('delayed-result');
      });
    });

    describe('queue management', () => {
      it('should queue task when pool at capacity', async () => {
        const p = new ExecutionPool({ maxConcurrent: 1 });

        // Start first task (will occupy the only slot)
        const promise1 = p.execute('agent-1', createDelayedTask('first', 100));

        // Wait for first task to start
        await waitFor(() => p.isExecuting('agent-1'));

        // Start second task (should queue)
        const promise2 = p.execute('agent-2', createDelayedTask('second', 10));

        // Verify second task is queued
        expect(p.getQueueDepth()).toBe(1);
        expect(p.isQueued('agent-2')).toBe(true);

        // Wait for both to complete
        const result1 = await promise1;
        const result2 = await promise2;

        expect(result1).toBe('first');
        expect(result2).toBe('second');
        expect(p.getQueueDepth()).toBe(0);
      });

      it('should execute queued task when slot becomes available', async () => {
        const p = new ExecutionPool({ maxConcurrent: 1 });

        // Execute first task
        await p.execute('agent-1', createDelayedTask('first', 10));

        // Now queue and execute second task
        const result = await p.execute('agent-2', createDelayedTask('second', 10));
        expect(result).toBe('second');
      });

      it('should process queued tasks in FIFO order', async () => {
        const p = new ExecutionPool({ maxConcurrent: 1 });
        const executionOrder: string[] = [];

        // Start first task
        const promise1 = p.execute('agent-1', async () => {
          executionOrder.push('first');
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'first';
        });

        // Wait for first to start
        await waitFor(() => p.isExecuting('agent-1'));

        // Queue three more tasks
        const promise2 = p.execute('agent-2', async () => {
          executionOrder.push('second');
          return 'second';
        });

        const promise3 = p.execute('agent-3', async () => {
          executionOrder.push('third');
          return 'third';
        });

        const promise4 = p.execute('agent-4', async () => {
          executionOrder.push('fourth');
          return 'fourth';
        });

        // Verify all queued
        expect(p.getQueueDepth()).toBe(3);

        // Wait for all to complete
        await Promise.all([promise1, promise2, promise3, promise4]);

        // Verify FIFO order
        expect(executionOrder).toEqual(['first', 'second', 'third', 'fourth']);
      });

      it('should queue processes correctly as slots become available', async () => {
        const p = new ExecutionPool({ maxConcurrent: 2 });
        const executionOrder: string[] = [];

        // Fill the pool
        const promise1 = p.execute('agent-1', async () => {
          executionOrder.push('first');
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'first';
        });

        const promise2 = p.execute('agent-2', async () => {
          executionOrder.push('second');
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'second';
        });

        // Wait for both to start
        await waitFor(() => p.getStatistics().activeCount === 2);

        // Queue two more
        const promise3 = p.execute('agent-3', async () => {
          executionOrder.push('third');
          return 'third';
        });

        const promise4 = p.execute('agent-4', async () => {
          executionOrder.push('fourth');
          return 'fourth';
        });

        // Verify queue depth
        expect(p.getQueueDepth()).toBe(2);

        // Wait for all
        await Promise.all([promise1, promise2, promise3, promise4]);

        // First two should start together, then third and fourth
        expect(executionOrder).toEqual(['first', 'second', 'third', 'fourth']);
      });
    });

    describe('concurrency control', () => {
      it('should enforce max concurrent limit', async () => {
        const p = new ExecutionPool({ maxConcurrent: 3 });
        let maxActive = 0;

        const createTask = (id: string) => async () => {
          const currentActive = p.getStatistics().activeCount;
          maxActive = Math.max(maxActive, currentActive);
          await new Promise((resolve) => setTimeout(resolve, 50));
          return id;
        };

        // Start 10 tasks
        const promises = Array.from({ length: 10 }, (_, i) =>
          p.execute(`agent-${i}`, createTask(`task-${i}`))
        );

        await Promise.all(promises);

        // Max active should never exceed 3
        expect(maxActive).toBeLessThanOrEqual(3);
      });

      it('should allow multiple agents to execute concurrently up to limit', async () => {
        const p = new ExecutionPool({ maxConcurrent: 5 });

        // Start 5 tasks simultaneously
        const promises = Array.from({ length: 5 }, (_, i) =>
          p.execute(`agent-${i}`, createDelayedTask(`result-${i}`, 50))
        );

        // Wait for all to start
        await waitFor(() => p.getStatistics().activeCount === 5);

        // All 5 should be active
        expect(p.getStatistics().activeCount).toBe(5);

        await Promise.all(promises);
      });

      it('should not exceed max concurrent even with rapid submissions', async () => {
        const p = new ExecutionPool({ maxConcurrent: 2 });
        const maxActiveTracked: number[] = [];

        const createTask = () => async () => {
          maxActiveTracked.push(p.getStatistics().activeCount);
          await new Promise((resolve) => setTimeout(resolve, 20));
          return 'done';
        };

        // Submit 20 tasks rapidly
        const promises = Array.from({ length: 20 }, (_, i) =>
          p.execute(`agent-${i}`, createTask())
        );

        await Promise.all(promises);

        // No recorded active count should exceed 2
        expect(Math.max(...maxActiveTracked)).toBeLessThanOrEqual(2);
      });

      it('should handle single agent using one slot', async () => {
        const p = new ExecutionPool({ maxConcurrent: 5 });

        const promise = p.execute('agent-1', createDelayedTask('result', 50));

        await waitFor(() => p.isExecuting('agent-1'));

        expect(p.getStatistics().activeCount).toBe(1);
        expect(p.getActiveExecutions()).toEqual(['agent-1']);

        await promise;
      });
    });

    describe('statistics tracking', () => {
      it('should track activeCount correctly', async () => {
        const p = new ExecutionPool({ maxConcurrent: 3 });

        expect(p.getStatistics().activeCount).toBe(0);

        const promise1 = p.execute('agent-1', createDelayedTask('r1', 50));
        await waitFor(() => p.getStatistics().activeCount === 1);
        expect(p.getStatistics().activeCount).toBe(1);

        const promise2 = p.execute('agent-2', createDelayedTask('r2', 50));
        await waitFor(() => p.getStatistics().activeCount === 2);
        expect(p.getStatistics().activeCount).toBe(2);

        await Promise.all([promise1, promise2]);
        expect(p.getStatistics().activeCount).toBe(0);
      });

      it('should track queueDepth correctly', async () => {
        const p = new ExecutionPool({ maxConcurrent: 1 });

        // Start first task
        const promise1 = p.execute('agent-1', createDelayedTask('r1', 100));
        await waitFor(() => p.isExecuting('agent-1'));

        expect(p.getStatistics().queueDepth).toBe(0);

        // Queue second and third
        const promise2 = p.execute('agent-2', createDelayedTask('r2', 10));
        const promise3 = p.execute('agent-3', createDelayedTask('r3', 10));

        expect(p.getStatistics().queueDepth).toBe(2);

        await Promise.all([promise1, promise2, promise3]);
        expect(p.getStatistics().queueDepth).toBe(0);
      });

      it('should increment totalProcessed on success', async () => {
        expect(pool.getStatistics().totalProcessed).toBe(0);

        await pool.execute('agent-1', async () => 'success');
        expect(pool.getStatistics().totalProcessed).toBe(1);

        await pool.execute('agent-2', async () => 'success');
        expect(pool.getStatistics().totalProcessed).toBe(2);
      });

      it('should increment totalFailed on error', async () => {
        expect(pool.getStatistics().totalFailed).toBe(0);

        await expect(
          pool.execute('agent-1', async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();
        expect(pool.getStatistics().totalFailed).toBe(1);

        await expect(
          pool.execute('agent-2', async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();
        expect(pool.getStatistics().totalFailed).toBe(2);
      });

      it('should calculate avgQueueWaitTime correctly', async () => {
        const p = new ExecutionPool({ maxConcurrent: 1 });

        // First task executes immediately (no wait)
        await p.execute('agent-1', async () => 'first');

        // Start blocking task
        const blockingPromise = p.execute('agent-2', createDelayedTask('blocking', 100));
        await waitFor(() => p.isExecuting('agent-2'));

        // Queue a task
        const queuedPromise = p.execute('agent-3', async () => 'queued');

        await Promise.all([blockingPromise, queuedPromise]);

        const stats = p.getStatistics();
        // avgQueueWaitTime should be > 0 since one task was queued
        // We processed 3 tasks, only 1 was queued, so average should be less than full wait
        expect(stats.avgQueueWaitTime).toBeGreaterThan(0);
      });

      it('should track activeAgents correctly', async () => {
        const p = new ExecutionPool({ maxConcurrent: 3 });

        expect(p.getStatistics().activeAgents).toEqual([]);

        const promise1 = p.execute('agent-1', createDelayedTask('r1', 50));
        await waitFor(() => p.isExecuting('agent-1'));

        const promise2 = p.execute('agent-2', createDelayedTask('r2', 50));
        await waitFor(() => p.isExecuting('agent-2'));

        const activeAgents = p.getStatistics().activeAgents;
        expect(activeAgents).toContain('agent-1');
        expect(activeAgents).toContain('agent-2');
        expect(activeAgents.length).toBe(2);

        await Promise.all([promise1, promise2]);
        expect(p.getStatistics().activeAgents).toEqual([]);
      });
    });

    describe('error handling', () => {
      it('should propagate task errors to caller', async () => {
        const error = new Error('Custom error');
        await expect(
          pool.execute('agent-1', async () => {
            throw error;
          })
        ).rejects.toThrow('Custom error');
      });

      it('should increment totalFailed on error', async () => {
        const initialFailed = pool.getStatistics().totalFailed;

        await expect(
          pool.execute('agent-1', async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();

        expect(pool.getStatistics().totalFailed).toBe(initialFailed + 1);
      });

      it('should not affect other tasks on error', async () => {
        const p = new ExecutionPool({ maxConcurrent: 2 });

        const promise1 = p.execute('agent-1', createDelayedTask('success', 50));
        const promise2 = p.execute('agent-2', createFailingTask(new Error('fail'), 30));

        await expect(promise2).rejects.toThrow('fail');

        const result1 = await promise1;
        expect(result1).toBe('success');
      });

      it('should decrement activeCount even on error', async () => {
        expect(pool.getStatistics().activeCount).toBe(0);

        await expect(
          pool.execute('agent-1', async () => {
            throw new Error('fail');
          })
        ).rejects.toThrow();

        expect(pool.getStatistics().activeCount).toBe(0);
      });

      it('should continue processing queue after task error', async () => {
        const p = new ExecutionPool({ maxConcurrent: 1 });
        const results: string[] = [];

        // First task fails
        const promise1 = p.execute('agent-1', createFailingTask(new Error('fail'), 20));

        // Queue successful tasks
        await waitFor(() => p.isExecuting('agent-1'));
        const promise2 = p.execute('agent-2', async () => {
          results.push('second');
          return 'second';
        });
        const promise3 = p.execute('agent-3', async () => {
          results.push('third');
          return 'third';
        });

        await expect(promise1).rejects.toThrow();
        await promise2;
        await promise3;

        expect(results).toEqual(['second', 'third']);
      });
    });
  });

  describe('getActiveExecutions()', () => {
    it('should return empty array initially', () => {
      expect(pool.getActiveExecutions()).toEqual([]);
    });

    it('should return list of executing agent IDs', async () => {
      const p = new ExecutionPool({ maxConcurrent: 3 });

      const promise1 = p.execute('agent-1', createDelayedTask('r1', 50));
      await waitFor(() => p.isExecuting('agent-1'));

      const promise2 = p.execute('agent-2', createDelayedTask('r2', 50));
      await waitFor(() => p.isExecuting('agent-2'));

      const active = p.getActiveExecutions();
      expect(active).toContain('agent-1');
      expect(active).toContain('agent-2');
      expect(active.length).toBe(2);

      await Promise.all([promise1, promise2]);
      expect(p.getActiveExecutions()).toEqual([]);
    });
  });

  describe('getQueueDepth()', () => {
    it('should return 0 initially', () => {
      expect(pool.getQueueDepth()).toBe(0);
    });

    it('should return number of queued tasks', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });

      const promise1 = p.execute('agent-1', createDelayedTask('r1', 100));
      await waitFor(() => p.isExecuting('agent-1'));

      expect(p.getQueueDepth()).toBe(0);

      const promise2 = p.execute('agent-2', createDelayedTask('r2', 10));
      expect(p.getQueueDepth()).toBe(1);

      const promise3 = p.execute('agent-3', createDelayedTask('r3', 10));
      expect(p.getQueueDepth()).toBe(2);

      await Promise.all([promise1, promise2, promise3]);
      expect(p.getQueueDepth()).toBe(0);
    });
  });

  describe('isExecuting()', () => {
    it('should return false initially', () => {
      expect(pool.isExecuting('agent-1')).toBe(false);
    });

    it('should return true when agent is executing', async () => {
      const promise = pool.execute('agent-1', createDelayedTask('result', 50));
      await waitFor(() => pool.isExecuting('agent-1'));

      expect(pool.isExecuting('agent-1')).toBe(true);

      await promise;
      expect(pool.isExecuting('agent-1')).toBe(false);
    });

    it('should return false for different agent', async () => {
      const promise = pool.execute('agent-1', createDelayedTask('result', 50));
      await waitFor(() => pool.isExecuting('agent-1'));

      expect(pool.isExecuting('agent-2')).toBe(false);

      await promise;
    });
  });

  describe('isQueued()', () => {
    it('should return false initially', () => {
      expect(pool.isQueued('agent-1')).toBe(false);
    });

    it('should return true when agent is queued', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });

      const promise1 = p.execute('agent-1', createDelayedTask('r1', 100));
      await waitFor(() => p.isExecuting('agent-1'));

      const promise2 = p.execute('agent-2', createDelayedTask('r2', 10));

      expect(p.isQueued('agent-2')).toBe(true);
      expect(p.isQueued('agent-1')).toBe(false);

      await Promise.all([promise1, promise2]);
      expect(p.isQueued('agent-2')).toBe(false);
    });

    it('should return false for different agent', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });

      const promise1 = p.execute('agent-1', createDelayedTask('r1', 100));
      await waitFor(() => p.isExecuting('agent-1'));

      const promise2 = p.execute('agent-2', createDelayedTask('r2', 10));

      expect(p.isQueued('agent-3')).toBe(false);

      await Promise.all([promise1, promise2]);
    });
  });

  describe('clearQueue()', () => {
    it('should reject all queued tasks', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });

      const promise1 = p.execute('agent-1', createDelayedTask('r1', 100));
      await waitFor(() => p.isExecuting('agent-1'));

      const promise2 = p.execute('agent-2', createDelayedTask('r2', 10));
      const promise3 = p.execute('agent-3', createDelayedTask('r3', 10));

      expect(p.getQueueDepth()).toBe(2);

      p.clearQueue();

      expect(p.getQueueDepth()).toBe(0);

      await expect(promise2).rejects.toThrow('Task cancelled');
      await expect(promise3).rejects.toThrow('Task cancelled');

      await promise1;
    });

    it('should not affect active tasks', async () => {
      const p = new ExecutionPool({ maxConcurrent: 2 });

      const promise1 = p.execute('agent-1', createDelayedTask('r1', 50));
      const promise2 = p.execute('agent-2', createDelayedTask('r2', 50));
      await waitFor(() => p.getStatistics().activeCount === 2);

      const promise3 = p.execute('agent-3', createDelayedTask('r3', 10));
      expect(p.getQueueDepth()).toBe(1);

      p.clearQueue();

      // Queued task should be rejected
      await expect(promise3).rejects.toThrow('Task cancelled');

      // Active tasks should complete successfully
      const result1 = await promise1;
      const result2 = await promise2;
      expect(result1).toBe('r1');
      expect(result2).toBe('r2');
    });

    it('should work on empty queue', () => {
      expect(() => pool.clearQueue()).not.toThrow();
      expect(pool.getQueueDepth()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle maxConcurrent = 1 (serial queue)', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });
      const executionOrder: number[] = [];

      const createTask = (id: number) => async () => {
        executionOrder.push(id);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return id;
      };

      await Promise.all([
        p.execute('agent-1', createTask(1)),
        p.execute('agent-2', createTask(2)),
        p.execute('agent-3', createTask(3)),
        p.execute('agent-4', createTask(4)),
      ]);

      expect(executionOrder).toEqual([1, 2, 3, 4]);
    });

    it('should handle very fast tasks executing quickly through pool', async () => {
      const p = new ExecutionPool({ maxConcurrent: 5 });
      const results: number[] = [];

      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          p.execute(`agent-${i}`, async () => {
            results.push(i);
            return i;
          })
        )
      );

      expect(results.length).toBe(100);
    });

    it('should handle same agent multiple times using multiple slots', async () => {
      const p = new ExecutionPool({ maxConcurrent: 3 });

      // Same agent can use multiple slots if submitted multiple times
      const promise1 = p.execute('agent-1', createDelayedTask('r1', 50));
      await waitFor(() => p.isExecuting('agent-1'));

      const promise2 = p.execute('agent-1', createDelayedTask('r2', 50));
      await waitFor(() => p.getStatistics().activeCount === 2);

      expect(p.getStatistics().activeCount).toBe(2);

      await Promise.all([promise1, promise2]);
    });

    it('should handle rapid task completions', async () => {
      const p = new ExecutionPool({ maxConcurrent: 2 });
      const results: number[] = [];

      // Submit many tasks that complete very quickly
      await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          p.execute(`agent-${i}`, async () => {
            results.push(i);
            return i;
          })
        )
      );

      expect(results.length).toBe(50);
      expect(p.getStatistics().totalProcessed).toBe(50);
    });

    it('should maintain accurate state with mixed success and failure', async () => {
      const p = new ExecutionPool({ maxConcurrent: 2 });

      const promises = [
        p.execute('agent-1', async () => 'success'),
        p.execute('agent-2', async () => {
          throw new Error('fail');
        }),
        p.execute('agent-3', async () => 'success'),
        p.execute('agent-4', async () => {
          throw new Error('fail');
        }),
      ];

      const results = await Promise.allSettled(promises);

      const successes = results.filter((r) => r.status === 'fulfilled').length;
      const failures = results.filter((r) => r.status === 'rejected').length;

      expect(successes).toBe(2);
      expect(failures).toBe(2);
      expect(p.getStatistics().totalProcessed).toBe(2);
      expect(p.getStatistics().totalFailed).toBe(2);
    });
  });

  describe('priority queue', () => {
    it('should execute urgent priority tasks before high priority', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });
      const executionOrder: string[] = [];

      // Start first task to block the pool
      const promise1 = p.execute('agent-1', async () => {
        executionOrder.push('first');
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'first';
      });

      await waitFor(() => p.isExecuting('agent-1'));

      // Queue tasks with different priorities
      const promise2 = p.execute(
        'agent-2',
        async () => {
          executionOrder.push('high');
          return 'high';
        },
        'high'
      );

      const promise3 = p.execute(
        'agent-3',
        async () => {
          executionOrder.push('urgent');
          return 'urgent';
        },
        'urgent'
      );

      expect(p.getQueueDepth()).toBe(2);

      await Promise.all([promise1, promise2, promise3]);

      // Urgent should execute before high
      expect(executionOrder).toEqual(['first', 'urgent', 'high']);
    });

    it('should execute tasks in priority order: urgent > high > medium > low', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });
      const executionOrder: string[] = [];

      // Start first task to block pool
      const promise1 = p.execute('agent-1', async () => {
        executionOrder.push('blocker');
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'blocker';
      });

      await waitFor(() => p.isExecuting('agent-1'));

      // Queue tasks with all priority levels
      const promiseLow = p.execute(
        'agent-low',
        async () => {
          executionOrder.push('low');
          return 'low';
        },
        'low'
      );

      const promiseMedium = p.execute(
        'agent-medium',
        async () => {
          executionOrder.push('medium');
          return 'medium';
        },
        'medium'
      );

      const promiseHigh = p.execute(
        'agent-high',
        async () => {
          executionOrder.push('high');
          return 'high';
        },
        'high'
      );

      const promiseUrgent = p.execute(
        'agent-urgent',
        async () => {
          executionOrder.push('urgent');
          return 'urgent';
        },
        'urgent'
      );

      expect(p.getQueueDepth()).toBe(4);

      await Promise.all([promise1, promiseLow, promiseMedium, promiseHigh, promiseUrgent]);

      // Should execute in priority order
      expect(executionOrder).toEqual(['blocker', 'urgent', 'high', 'medium', 'low']);
    });

    it('should maintain FIFO order for same-priority tasks', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });
      const executionOrder: string[] = [];

      // Start blocker
      const promise1 = p.execute('agent-1', async () => {
        executionOrder.push('blocker');
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'blocker';
      });

      await waitFor(() => p.isExecuting('agent-1'));

      // Queue multiple high-priority tasks - should maintain FIFO
      const promise2 = p.execute(
        'agent-2',
        async () => {
          executionOrder.push('high-1');
          return 'high-1';
        },
        'high'
      );

      const promise3 = p.execute(
        'agent-3',
        async () => {
          executionOrder.push('high-2');
          return 'high-2';
        },
        'high'
      );

      const promise4 = p.execute(
        'agent-4',
        async () => {
          executionOrder.push('high-3');
          return 'high-3';
        },
        'high'
      );

      await Promise.all([promise1, promise2, promise3, promise4]);

      // Same priority should maintain FIFO order
      expect(executionOrder).toEqual(['blocker', 'high-1', 'high-2', 'high-3']);
    });

    it('should use medium priority by default', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });
      const executionOrder: string[] = [];

      // Start blocker
      const promise1 = p.execute('agent-1', async () => {
        executionOrder.push('blocker');
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'blocker';
      });

      await waitFor(() => p.isExecuting('agent-1'));

      // Queue low priority task
      const promiseLow = p.execute(
        'agent-low',
        async () => {
          executionOrder.push('low');
          return 'low';
        },
        'low'
      );

      // Queue task without priority (default medium)
      const promiseDefault = p.execute('agent-default', async () => {
        executionOrder.push('default');
        return 'default';
      });

      await Promise.all([promise1, promiseLow, promiseDefault]);

      // Default (medium) should execute before low
      expect(executionOrder).toEqual(['blocker', 'default', 'low']);
    });

    it('should handle complex priority interleaving', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });
      const executionOrder: string[] = [];

      // Start blocker
      const promise1 = p.execute('agent-1', async () => {
        executionOrder.push('blocker');
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'blocker';
      });

      await waitFor(() => p.isExecuting('agent-1'));

      // Queue in mixed order
      const promises = [
        p.execute(
          'agent-2',
          async () => {
            executionOrder.push('low');
            return 'low';
          },
          'low'
        ),
        p.execute(
          'agent-3',
          async () => {
            executionOrder.push('high-1');
            return 'high-1';
          },
          'high'
        ),
        p.execute(
          'agent-4',
          async () => {
            executionOrder.push('medium');
            return 'medium';
          },
          'medium'
        ),
        p.execute(
          'agent-5',
          async () => {
            executionOrder.push('urgent');
            return 'urgent';
          },
          'urgent'
        ),
        p.execute(
          'agent-6',
          async () => {
            executionOrder.push('high-2');
            return 'high-2';
          },
          'high'
        ),
      ];

      await Promise.all([promise1, ...promises]);

      // Should sort by priority, then FIFO within same priority
      expect(executionOrder).toEqual(['blocker', 'urgent', 'high-1', 'high-2', 'medium', 'low']);
    });

    it('should update queue with priorities correctly', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });

      const promise1 = p.execute('agent-1', createDelayedTask('r1', 50));
      await waitFor(() => p.isExecuting('agent-1'));

      p.execute('agent-2', createDelayedTask('r2', 10), 'low');
      p.execute('agent-3', createDelayedTask('r3', 10), 'urgent');
      p.execute('agent-4', createDelayedTask('r4', 10), 'medium');

      expect(p.getQueueDepth()).toBe(3);

      await promise1;

      // All tasks should eventually complete
      await waitFor(() => p.getQueueDepth() === 0);
    });

    it('should handle priority with concurrent executions', async () => {
      const p = new ExecutionPool({ maxConcurrent: 2 });
      const executionOrder: string[] = [];

      // Fill pool with 2 tasks
      const promise1 = p.execute('agent-1', async () => {
        executionOrder.push('concurrent-1');
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'c1';
      });

      const promise2 = p.execute('agent-2', async () => {
        executionOrder.push('concurrent-2');
        await new Promise((resolve) => setTimeout(resolve, 50));
        return 'c2';
      });

      await waitFor(() => p.getActiveExecutions().length === 2);

      // Queue tasks with priorities
      const promise3 = p.execute(
        'agent-3',
        async () => {
          executionOrder.push('low');
          return 'low';
        },
        'low'
      );

      const promise4 = p.execute(
        'agent-4',
        async () => {
          executionOrder.push('urgent');
          return 'urgent';
        },
        'urgent'
      );

      await Promise.all([promise1, promise2, promise3, promise4]);

      // Urgent should execute before low
      expect(executionOrder.slice(2)).toEqual(['urgent', 'low']);
    });
  });

  describe('dependency handling', () => {
    it('should execute task with satisfied dependencies immediately', async () => {
      // Execute first task
      await pool.execute('agent-1', async () => 'task1');

      // Get the execution ID of the completed task
      const execId1 = pool.getCompletedExecutions()[0]!;
      expect(execId1).toBe('exec-1');

      // Task 2 depends on task 1 (already completed)
      const result = await pool.execute('agent-2', async () => 'task2', 'medium', [execId1]);
      expect(result).toBe('task2');
    });

    it('should queue task with unsatisfied dependencies', async () => {
      const p = new ExecutionPool({ maxConcurrent: 10 });

      const executionOrder: string[] = [];

      // Start a slow task
      const promise1 = p.execute('agent-1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push('task1');
        return 'task1';
      });

      // Wait a bit to ensure task1 is running
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Get the execution ID of the running task
      const activeExecs = p.getActiveExecutions();
      expect(activeExecs.length).toBe(1);

      // Task 2 depends on task 1 (not yet completed) - should queue
      const promise2 = p.execute(
        'agent-2',
        async () => {
          executionOrder.push('task2');
          return 'task2';
        },
        'medium',
        ['exec-1'] // First execution ID
      );

      // task2 should be queued
      await waitFor(() => p.getQueueDepth() === 1);
      expect(executionOrder).toEqual([]); // task1 still running, task2 queued

      // Wait for both to complete
      await Promise.all([promise1, promise2]);

      // task1 should complete before task2
      expect(executionOrder).toEqual(['task1', 'task2']);
    });

    it('should handle multiple dependencies', async () => {
      const p = new ExecutionPool({ maxConcurrent: 10 });

      const executionOrder: string[] = [];

      // Start two slow tasks
      const promise1 = p.execute('agent-1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        executionOrder.push('task1');
        return 'task1';
      });

      const promise2 = p.execute('agent-2', async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        executionOrder.push('task2');
        return 'task2';
      });

      // Wait for both to start
      await waitFor(() => p.getActiveExecutions().length === 2);

      // Task 3 depends on both task1 and task2
      const promise3 = p.execute(
        'agent-3',
        async () => {
          executionOrder.push('task3');
          return 'task3';
        },
        'medium',
        ['exec-1', 'exec-2']
      );

      // task3 should be queued
      await waitFor(() => p.getQueueDepth() === 1);

      await Promise.all([promise1, promise2, promise3]);

      // task1 and task2 should complete before task3
      expect(executionOrder[2]).toBe('task3');
      expect(executionOrder.slice(0, 2)).toContain('task1');
      expect(executionOrder.slice(0, 2)).toContain('task2');
    });

    it('should handle dependency chain (A -> B -> C)', async () => {
      const p = new ExecutionPool({ maxConcurrent: 10 });

      const executionOrder: string[] = [];

      // Start task A
      const promiseA = p.execute('agent-1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        executionOrder.push('taskA');
        return 'taskA';
      });

      await waitFor(() => p.getActiveExecutions().length === 1);

      // Task B depends on A
      const promiseB = p.execute(
        'agent-2',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
          executionOrder.push('taskB');
          return 'taskB';
        },
        'medium',
        ['exec-1']
      );

      // Task C depends on B
      const promiseC = p.execute(
        'agent-3',
        async () => {
          executionOrder.push('taskC');
          return 'taskC';
        },
        'medium',
        ['exec-2']
      );

      await Promise.all([promiseA, promiseB, promiseC]);

      // Tasks should execute in order: A -> B -> C
      expect(executionOrder).toEqual(['taskA', 'taskB', 'taskC']);
    });

    it('should respect priority with dependencies', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });

      const executionOrder: string[] = [];

      // Task A - runs first (fills pool)
      const promiseA = p.execute('agent-1', async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        executionOrder.push('taskA');
        return 'taskA';
      });

      await waitFor(() => p.getActiveExecutions().length === 1);

      // Task B - low priority, no dependencies
      const promiseB = p.execute(
        'agent-2',
        async () => {
          executionOrder.push('taskB-low');
          return 'taskB';
        },
        'low'
      );

      // Task C - urgent priority, depends on A (satisfied when A completes)
      const promiseC = p.execute(
        'agent-3',
        async () => {
          executionOrder.push('taskC-urgent');
          return 'taskC';
        },
        'urgent',
        ['exec-1']
      );

      await waitFor(() => p.getQueueDepth() === 2);

      await Promise.all([promiseA, promiseB, promiseC]);

      // After A completes, C (urgent) should run before B (low)
      expect(executionOrder).toEqual(['taskA', 'taskC-urgent', 'taskB-low']);
    });

    it('should track completed executions', async () => {
      expect(pool.getCompletedExecutions()).toEqual([]);

      await pool.execute('agent-1', async () => 'task1');
      expect(pool.getCompletedExecutions()).toEqual(['exec-1']);

      await pool.execute('agent-2', async () => 'task2');
      expect(pool.getCompletedExecutions()).toEqual(['exec-1', 'exec-2']);

      await pool.execute('agent-3', async () => 'task3');
      expect(pool.getCompletedExecutions()).toEqual(['exec-1', 'exec-2', 'exec-3']);
    });

    it('should allow checking if dependencies are complete', async () => {
      expect(pool.areDependenciesComplete(['exec-1'])).toBe(false);

      await pool.execute('agent-1', async () => 'task1');

      expect(pool.areDependenciesComplete(['exec-1'])).toBe(true);
      expect(pool.areDependenciesComplete(['exec-1', 'exec-2'])).toBe(false);

      await pool.execute('agent-2', async () => 'task2');

      expect(pool.areDependenciesComplete(['exec-1', 'exec-2'])).toBe(true);
    });

    it('should not execute task if dependency never completes', async () => {
      const p = new ExecutionPool({ maxConcurrent: 10 });

      const executionOrder: string[] = [];

      // Task with non-existent dependency (exec-999) - intentionally not awaited
      void p.execute(
        'agent-1',
        async () => {
          executionOrder.push('should-not-run');
          return 'task1';
        },
        'medium',
        ['exec-999']
      );

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Task should still be queued
      expect(p.getQueueDepth()).toBe(1);
      expect(executionOrder).toEqual([]);

      // Task should never have executed
      expect(executionOrder).not.toContain('should-not-run');
    });

    it('should handle empty dependencies array', async () => {
      const result = await pool.execute('agent-1', async () => 'task1', 'medium', []);
      expect(result).toBe('task1');
    });

    it('should handle undefined dependencies', async () => {
      const result = await pool.execute('agent-1', async () => 'task1', 'medium', undefined);
      expect(result).toBe('task1');
    });
  });

  describe('cancelQueuedTasksForAgent()', () => {
    it('should cancel queued tasks for specific agent', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });

      // Execute a long-running task to fill the pool
      const task1 = p.execute('agent-1', createDelayedTask('task1', 100));

      // Queue tasks for agent-2 and agent-3
      const task2Promise = p.execute('agent-2', createDelayedTask('task2', 10));
      const task3Promise = p.execute('agent-3', createDelayedTask('task3', 10));
      const task4Promise = p.execute('agent-2', createDelayedTask('task4', 10));

      // Verify tasks are queued
      await waitFor(() => p.getQueueDepth() === 3);

      // Cancel tasks for agent-2
      const cancelled = p.cancelQueuedTasksForAgent('agent-2');

      expect(cancelled).toBe(2);
      expect(p.getQueueDepth()).toBe(1);

      // Verify agent-2 tasks were rejected
      await expect(task2Promise).rejects.toThrow('Task cancelled: agent agent-2 was paused');
      await expect(task4Promise).rejects.toThrow('Task cancelled: agent agent-2 was paused');

      // Verify agent-3 task still completes
      await task1; // Wait for first task to complete
      const result3 = await task3Promise;
      expect(result3).toBe('task3');
    });

    it('should return 0 when no tasks queued for agent', () => {
      const cancelled = pool.cancelQueuedTasksForAgent('agent-1');
      expect(cancelled).toBe(0);
    });

    it('should not cancel active executions', async () => {
      const p = new ExecutionPool({ maxConcurrent: 2 });

      // Start active executions for agent-1
      const task1Promise = p.execute('agent-1', createDelayedTask('task1', 100));
      const task2Promise = p.execute('agent-1', createDelayedTask('task2', 100));

      // Wait for tasks to become active
      await waitFor(() => p.getStatistics().activeCount === 2);

      // Try to cancel - should return 0 since tasks are active, not queued
      const cancelled = p.cancelQueuedTasksForAgent('agent-1');
      expect(cancelled).toBe(0);

      // Active tasks should still complete
      const [result1, result2] = await Promise.all([task1Promise, task2Promise]);
      expect(result1).toBe('task1');
      expect(result2).toBe('task2');
    });

    it('should preserve queue order for other agents', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });

      // Fill pool with long-running task
      const task1 = p.execute('agent-1', createDelayedTask('task1', 100));

      // Queue tasks in specific order
      const task2Promise = p.execute('agent-2', createDelayedTask('task2', 10));
      const task3Promise = p.execute('agent-3', createDelayedTask('task3', 10));
      const task4Promise = p.execute('agent-2', createDelayedTask('task4', 10));
      const task5Promise = p.execute('agent-4', createDelayedTask('task5', 10));

      await waitFor(() => p.getQueueDepth() === 4);

      // Cancel agent-2 tasks - these will be rejected immediately
      // Catch them to avoid unhandled promise rejections
      const task2Rejection = task2Promise.catch((err) => err);
      const task4Rejection = task4Promise.catch((err) => err);

      p.cancelQueuedTasksForAgent('agent-2');

      // Wait for first task to complete
      await task1;

      // Remaining tasks should execute in FIFO order (agent-3, then agent-4)
      const result3 = await task3Promise;
      const result5 = await task5Promise;

      expect(result3).toBe('task3');
      expect(result5).toBe('task5');

      // Agent-2 tasks should be rejected
      const error2 = await task2Rejection;
      const error4 = await task4Rejection;
      expect(error2).toBeInstanceOf(Error);
      expect(error2.message).toBe('Task cancelled: agent agent-2 was paused');
      expect(error4).toBeInstanceOf(Error);
      expect(error4.message).toBe('Task cancelled: agent agent-2 was paused');
    });
  });

  describe('getExecutionIdsForAgent()', () => {
    it('should return empty arrays when agent has no executions', () => {
      const result = pool.getExecutionIdsForAgent('agent-1');
      expect(result.active).toEqual([]);
      expect(result.queued).toEqual([]);
    });

    it('should track active executions for agent', async () => {
      const p = new ExecutionPool({ maxConcurrent: 2 });

      // Start active executions
      const task1Promise = p.execute('agent-1', createDelayedTask('task1', 100));
      const task2Promise = p.execute('agent-1', createDelayedTask('task2', 100));

      await waitFor(() => p.getStatistics().activeCount === 2);

      const result = p.getExecutionIdsForAgent('agent-1');
      expect(result.active).toHaveLength(2);
      expect(result.queued).toHaveLength(0);

      // Verify execution IDs format
      expect(result.active[0]).toMatch(/^exec-\d+$/);
      expect(result.active[1]).toMatch(/^exec-\d+$/);

      // Wait for completion
      await Promise.all([task1Promise, task2Promise]);
    });

    it('should track queued executions for agent', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });

      // Fill pool
      const task1 = p.execute('agent-1', createDelayedTask('task1', 100));

      // Queue more tasks
      void p.execute('agent-2', createDelayedTask('task2', 10));
      void p.execute('agent-2', createDelayedTask('task3', 10));
      void p.execute('agent-2', createDelayedTask('task4', 10));

      await waitFor(() => p.getQueueDepth() === 3);

      const result = p.getExecutionIdsForAgent('agent-2');
      expect(result.active).toHaveLength(0);
      expect(result.queued).toHaveLength(3);

      // Verify execution IDs format
      expect(result.queued[0]).toMatch(/^exec-\d+$/);
      expect(result.queued[1]).toMatch(/^exec-\d+$/);
      expect(result.queued[2]).toMatch(/^exec-\d+$/);

      await task1;
    });

    it('should track both active and queued executions', async () => {
      const p = new ExecutionPool({ maxConcurrent: 2 });

      // Start active executions
      void p.execute('agent-1', createDelayedTask('task1', 100));
      void p.execute('agent-1', createDelayedTask('task2', 100));

      // Queue more tasks
      void p.execute('agent-1', createDelayedTask('task3', 10));
      void p.execute('agent-1', createDelayedTask('task4', 10));

      await waitFor(() => p.getStatistics().activeCount === 2);
      await waitFor(() => p.getQueueDepth() === 2);

      const result = p.getExecutionIdsForAgent('agent-1');
      expect(result.active).toHaveLength(2);
      expect(result.queued).toHaveLength(2);
    });

    it('should only return executions for specified agent', async () => {
      const p = new ExecutionPool({ maxConcurrent: 1 });

      // Fill pool with agent-1
      const task1 = p.execute('agent-1', createDelayedTask('task1', 100));

      // Queue tasks for different agents
      void p.execute('agent-2', createDelayedTask('task2', 10));
      void p.execute('agent-3', createDelayedTask('task3', 10));
      void p.execute('agent-2', createDelayedTask('task4', 10));

      await waitFor(() => p.getQueueDepth() === 3);

      const result = p.getExecutionIdsForAgent('agent-2');
      expect(result.active).toHaveLength(0);
      expect(result.queued).toHaveLength(2);

      await task1;
    });
  });
});
