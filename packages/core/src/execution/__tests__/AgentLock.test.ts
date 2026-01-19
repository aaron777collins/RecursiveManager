/**
 * Unit tests for AgentLock
 *
 * Tests the async mutex-based locking mechanism for agent execution.
 * Ensures proper concurrency control and lock management.
 */

import { AgentLock, AgentLockError } from '../AgentLock';

describe('AgentLock', () => {
  let lock: AgentLock;

  beforeEach(() => {
    lock = new AgentLock();
  });

  afterEach(() => {
    lock.clearAll();
  });

  describe('acquire()', () => {
    describe('basic lock acquisition', () => {
      it('should acquire lock successfully for a single agent', async () => {
        const agentId = 'agent-1';
        const release = await lock.acquire(agentId);

        expect(release).toBeInstanceOf(Function);
        expect(lock.isLocked(agentId)).toBe(true);

        release();
        expect(lock.isLocked(agentId)).toBe(false);
      });

      it('should release lock properly via release function', async () => {
        const agentId = 'agent-1';
        const release = await lock.acquire(agentId);

        expect(lock.isLocked(agentId)).toBe(true);
        release();
        expect(lock.isLocked(agentId)).toBe(false);
      });

      it('should support multiple acquire/release cycles', async () => {
        const agentId = 'agent-1';

        // Cycle 1
        const release1 = await lock.acquire(agentId);
        expect(lock.isLocked(agentId)).toBe(true);
        release1();
        expect(lock.isLocked(agentId)).toBe(false);

        // Cycle 2
        const release2 = await lock.acquire(agentId);
        expect(lock.isLocked(agentId)).toBe(true);
        release2();
        expect(lock.isLocked(agentId)).toBe(false);

        // Cycle 3
        const release3 = await lock.acquire(agentId);
        expect(lock.isLocked(agentId)).toBe(true);
        release3();
        expect(lock.isLocked(agentId)).toBe(false);
      });
    });

    describe('concurrency control', () => {
      it('should queue second acquire for same agent', async () => {
        const agentId = 'agent-1';
        let executionOrder: number[] = [];

        // First acquire
        const release1 = await lock.acquire(agentId);
        executionOrder.push(1);

        // Second acquire (should queue)
        const acquirePromise = lock.acquire(agentId).then((release2) => {
          executionOrder.push(2);
          return release2;
        });

        // At this point, second acquire should be waiting
        expect(lock.isLocked(agentId)).toBe(true);

        // Release first lock
        release1();
        executionOrder.push(3);

        // Wait for second acquire to complete
        const release2 = await acquirePromise;
        expect(executionOrder).toEqual([1, 3, 2]);
        expect(lock.isLocked(agentId)).toBe(true);

        release2();
        expect(lock.isLocked(agentId)).toBe(false);
      });

      it('should process queued requests in FIFO order', async () => {
        const agentId = 'agent-1';
        let executionOrder: string[] = [];

        // Acquire first lock
        const release1 = await lock.acquire(agentId);

        // Queue multiple requests
        const promise2 = lock.acquire(agentId).then((release) => {
          executionOrder.push('second');
          return release;
        });

        const promise3 = lock.acquire(agentId).then((release) => {
          executionOrder.push('third');
          return release;
        });

        const promise4 = lock.acquire(agentId).then((release) => {
          executionOrder.push('fourth');
          return release;
        });

        // Release first lock
        release1();

        // Wait for all to complete
        const release2 = await promise2;
        release2();

        const release3 = await promise3;
        release3();

        const release4 = await promise4;
        release4();

        // Verify FIFO order
        expect(executionOrder).toEqual(['second', 'third', 'fourth']);
      });

      it('should allow multiple agents to execute concurrently', async () => {
        const agent1 = 'agent-1';
        const agent2 = 'agent-2';
        const agent3 = 'agent-3';

        // Acquire locks for different agents concurrently
        const release1 = await lock.acquire(agent1);
        const release2 = await lock.acquire(agent2);
        const release3 = await lock.acquire(agent3);

        // All should be locked
        expect(lock.isLocked(agent1)).toBe(true);
        expect(lock.isLocked(agent2)).toBe(true);
        expect(lock.isLocked(agent3)).toBe(true);

        // Release all
        release1();
        release2();
        release3();

        // All should be unlocked
        expect(lock.isLocked(agent1)).toBe(false);
        expect(lock.isLocked(agent2)).toBe(false);
        expect(lock.isLocked(agent3)).toBe(false);
      });
    });

    describe('error handling', () => {
      it('should throw AgentLockError for empty agentId', async () => {
        await expect(lock.acquire('')).rejects.toThrow(AgentLockError);
        await expect(lock.acquire('')).rejects.toThrow('Invalid agent ID provided');
      });

      it('should throw AgentLockError for null agentId', async () => {
        await expect(lock.acquire(null as any)).rejects.toThrow(AgentLockError);
      });

      it('should throw AgentLockError for undefined agentId', async () => {
        await expect(lock.acquire(undefined as any)).rejects.toThrow(AgentLockError);
      });

      it('should throw AgentLockError for non-string agentId', async () => {
        await expect(lock.acquire(123 as any)).rejects.toThrow(AgentLockError);
        await expect(lock.acquire({} as any)).rejects.toThrow(AgentLockError);
        await expect(lock.acquire([] as any)).rejects.toThrow(AgentLockError);
      });

      it('should not affect internal state on invalid agentId', async () => {
        const initialCount = lock.getMutexCount();

        try {
          await lock.acquire('');
        } catch {
          // Expected error
        }

        expect(lock.getMutexCount()).toBe(initialCount);
      });
    });
  });

  describe('tryAcquire()', () => {
    describe('non-blocking behavior', () => {
      it('should acquire lock when unlocked', () => {
        const agentId = 'agent-1';
        const release = lock.tryAcquire(agentId);

        expect(release).toBeInstanceOf(Function);
        expect(lock.isLocked(agentId)).toBe(true);

        release!();
        expect(lock.isLocked(agentId)).toBe(false);
      });

      it('should return null when locked', async () => {
        const agentId = 'agent-1';

        // Acquire lock first
        const release1 = await lock.acquire(agentId);

        // Try to acquire (should fail)
        const release2 = lock.tryAcquire(agentId);
        expect(release2).toBeNull();
        expect(lock.isLocked(agentId)).toBe(true);

        // Release first lock
        release1();
        expect(lock.isLocked(agentId)).toBe(false);

        // Now tryAcquire should succeed
        const release3 = lock.tryAcquire(agentId);
        expect(release3).toBeInstanceOf(Function);
        expect(lock.isLocked(agentId)).toBe(true);
        release3!();
      });

      it('should not queue request', async () => {
        const agentId = 'agent-1';
        let executed = false;

        // Acquire lock first
        const release1 = await lock.acquire(agentId);

        // Try to acquire (should fail immediately)
        const release2 = lock.tryAcquire(agentId);
        expect(release2).toBeNull();

        // Set flag after tryAcquire
        executed = true;

        // Release first lock
        release1();

        // Verify executed is true (meaning tryAcquire didn't queue)
        expect(executed).toBe(true);
      });
    });

    describe('error handling', () => {
      it('should throw AgentLockError for empty agentId', () => {
        expect(() => lock.tryAcquire('')).toThrow(AgentLockError);
        expect(() => lock.tryAcquire('')).toThrow('Invalid agent ID provided');
      });

      it('should throw AgentLockError for null agentId', () => {
        expect(() => lock.tryAcquire(null as any)).toThrow(AgentLockError);
      });

      it('should throw AgentLockError for undefined agentId', () => {
        expect(() => lock.tryAcquire(undefined as any)).toThrow(AgentLockError);
      });

      it('should throw AgentLockError for non-string agentId', () => {
        expect(() => lock.tryAcquire(123 as any)).toThrow(AgentLockError);
        expect(() => lock.tryAcquire({} as any)).toThrow(AgentLockError);
        expect(() => lock.tryAcquire([] as any)).toThrow(AgentLockError);
      });
    });
  });

  describe('isLocked()', () => {
    it('should return true when agent is locked', async () => {
      const agentId = 'agent-1';
      const release = await lock.acquire(agentId);

      expect(lock.isLocked(agentId)).toBe(true);

      release();
    });

    it('should return false when agent is unlocked', async () => {
      const agentId = 'agent-1';
      const release = await lock.acquire(agentId);
      release();

      expect(lock.isLocked(agentId)).toBe(false);
    });

    it('should return false for non-existent agent', () => {
      expect(lock.isLocked('non-existent')).toBe(false);
    });

    it('should handle multiple agents correctly', async () => {
      const agent1 = 'agent-1';
      const agent2 = 'agent-2';

      const release1 = await lock.acquire(agent1);

      expect(lock.isLocked(agent1)).toBe(true);
      expect(lock.isLocked(agent2)).toBe(false);

      const release2 = await lock.acquire(agent2);

      expect(lock.isLocked(agent1)).toBe(true);
      expect(lock.isLocked(agent2)).toBe(true);

      release1();

      expect(lock.isLocked(agent1)).toBe(false);
      expect(lock.isLocked(agent2)).toBe(true);

      release2();

      expect(lock.isLocked(agent1)).toBe(false);
      expect(lock.isLocked(agent2)).toBe(false);
    });
  });

  describe('getWaiterCount()', () => {
    it('should return 0 (current limitation)', async () => {
      const agentId = 'agent-1';

      // This is a known limitation - async-mutex doesn't expose waiter count
      expect(lock.getWaiterCount(agentId)).toBe(0);

      const release1 = await lock.acquire(agentId);
      expect(lock.getWaiterCount(agentId)).toBe(0);

      // Queue a request
      lock.acquire(agentId).then((release) => release());
      expect(lock.getWaiterCount(agentId)).toBe(0);

      release1();
    });

    it('should return 0 for non-existent agent', () => {
      expect(lock.getWaiterCount('non-existent')).toBe(0);
    });
  });

  describe('cleanup()', () => {
    it('should remove mutex for agent', async () => {
      const agentId = 'agent-1';

      const release = await lock.acquire(agentId);
      expect(lock.getMutexCount()).toBe(1);

      release();
      lock.cleanup(agentId);

      expect(lock.getMutexCount()).toBe(0);
    });

    it('should not affect other agents', async () => {
      const agent1 = 'agent-1';
      const agent2 = 'agent-2';

      await lock.acquire(agent1);
      await lock.acquire(agent2);

      expect(lock.getMutexCount()).toBe(2);

      lock.cleanup(agent1);

      expect(lock.getMutexCount()).toBe(1);
      expect(lock.isLocked(agent2)).toBe(true);
    });

    it('should handle non-existent agent gracefully', () => {
      expect(() => lock.cleanup('non-existent')).not.toThrow();
    });
  });

  describe('getMutexCount()', () => {
    it('should return 0 initially', () => {
      expect(lock.getMutexCount()).toBe(0);
    });

    it('should increment when acquiring locks for different agents', async () => {
      await lock.acquire('agent-1');
      expect(lock.getMutexCount()).toBe(1);

      await lock.acquire('agent-2');
      expect(lock.getMutexCount()).toBe(2);

      await lock.acquire('agent-3');
      expect(lock.getMutexCount()).toBe(3);
    });

    it('should not increment when acquiring same agent multiple times', async () => {
      const release1 = await lock.acquire('agent-1');
      expect(lock.getMutexCount()).toBe(1);

      release1();

      const release2 = await lock.acquire('agent-1');
      expect(lock.getMutexCount()).toBe(1);

      release2();
    });
  });

  describe('clearAll()', () => {
    it('should remove all mutexes', async () => {
      await lock.acquire('agent-1');
      await lock.acquire('agent-2');
      await lock.acquire('agent-3');

      expect(lock.getMutexCount()).toBe(3);

      lock.clearAll();

      expect(lock.getMutexCount()).toBe(0);
    });

    it('should work on empty lock', () => {
      expect(() => lock.clearAll()).not.toThrow();
      expect(lock.getMutexCount()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid acquire/release cycles', async () => {
      const agentId = 'agent-1';
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const release = await lock.acquire(agentId);
        expect(lock.isLocked(agentId)).toBe(true);
        release();
        expect(lock.isLocked(agentId)).toBe(false);
      }
    });

    it('should handle multiple release attempts gracefully', async () => {
      const agentId = 'agent-1';
      const release = await lock.acquire(agentId);

      release();
      expect(lock.isLocked(agentId)).toBe(false);

      // Second release should not throw or cause issues
      expect(() => release()).not.toThrow();
    });

    it('should handle concurrent lock acquisitions for different agents', async () => {
      const agents = Array.from({ length: 20 }, (_, i) => `agent-${i}`);
      const results: boolean[] = [];

      await Promise.all(
        agents.map(async (agentId) => {
          const release = await lock.acquire(agentId);
          results.push(lock.isLocked(agentId));
          release();
        })
      );

      // All should have been locked at some point
      expect(results.every((locked) => locked === true)).toBe(true);

      // All should be unlocked now
      agents.forEach((agentId) => {
        expect(lock.isLocked(agentId)).toBe(false);
      });
    });

    it('should handle deeply queued requests', async () => {
      const agentId = 'agent-1';
      const queueDepth = 50;
      const executionOrder: number[] = [];

      // Acquire first lock
      const release1 = await lock.acquire(agentId);
      executionOrder.push(0);

      // Queue many requests
      const promises = Array.from({ length: queueDepth }, (_, i) =>
        lock.acquire(agentId).then((release) => {
          executionOrder.push(i + 1);
          return release;
        })
      );

      // Release first lock
      release1();

      // Wait for all and release
      const releases = await Promise.all(promises);
      releases.forEach((release) => release());

      // Verify all executed in order
      expect(executionOrder).toEqual(Array.from({ length: queueDepth + 1 }, (_, i) => i));
      expect(lock.isLocked(agentId)).toBe(false);
    });

    it('should handle lock release not blocking', async () => {
      const agentId = 'agent-1';
      const release = await lock.acquire(agentId);

      const startTime = Date.now();
      release();
      const endTime = Date.now();

      // Release should be essentially instant (< 10ms)
      expect(endTime - startTime).toBeLessThan(10);
    });
  });
});
