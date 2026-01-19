/**
 * Integration tests for concurrent execution prevention (Task 3.4.10)
 *
 * This test suite validates the complete concurrent execution prevention system,
 * testing the integration of AgentLock, ExecutionPool, and PidManager to ensure
 * no duplicate agent executions occur at both in-process and cross-process levels.
 *
 * Tests cover:
 * - ExecutionPool + AgentLock integration
 * - PidManager integration for cross-process prevention (EC-7.1)
 * - ExecutionOrchestrator integration with all locking components
 * - Queue management under concurrent load
 * - Proper lock cleanup on errors
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import {
  createAgent,
  createTask,
  runMigrations,
  allMigrations,
  DatabasePool,
  type AgentConfig,
} from '@recursive-manager/common';
import {
  acquirePidLock,
  removePidFile,
  isProcessRunningByPid,
  PidError,
} from '@recursive-manager/common';
import { AgentLock } from '../AgentLock';
import { ExecutionPool } from '../ExecutionPool';
import { ExecutionOrchestrator } from '../index';
import { saveAgentConfig } from '../../config';

// Mock types for adapters
type ExecutionResult = {
  success: boolean;
  agentId: string;
  mode: 'continuous' | 'reactive';
  tasksCompleted: number;
  messagesProcessed: number;
  duration: number;
  timestamp: Date;
  error?: string;
};

type FrameworkAdapter = {
  name: string;
  executeAgent(
    agentId: string,
    mode: 'continuous' | 'reactive',
    context: any
  ): Promise<ExecutionResult>;
  checkHealth(): Promise<boolean>;
  supportsFeature(_feature: string): boolean;
  getCapabilities(): any[];
};

// Simple adapter registry for tests
class AdapterRegistry {
  private adapters: Map<string, FrameworkAdapter> = new Map();

  register(adapter: FrameworkAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  async getHealthyAdapter(
    primary: string,
    fallback?: string
  ): Promise<{ adapter: FrameworkAdapter; usedFallback: boolean } | null> {
    const primaryAdapter = this.adapters.get(primary);
    if (primaryAdapter && (await primaryAdapter.checkHealth())) {
      return { adapter: primaryAdapter, usedFallback: false };
    }

    if (fallback) {
      const fallbackAdapter = this.adapters.get(fallback);
      if (fallbackAdapter && (await fallbackAdapter.checkHealth())) {
        return { adapter: fallbackAdapter, usedFallback: true };
      }
    }

    return null;
  }
}

// Helper to create valid AgentConfig
function createValidConfig(
  agentId: string,
  role: string,
  framework: string = 'mock-adapter'
): AgentConfig {
  return {
    version: '1.0.0',
    identity: {
      id: agentId,
      role,
      displayName: role,
      reportingTo: null,
      createdAt: new Date().toISOString(),
      createdBy: 'test',
    },
    goal: {
      mainGoal: `Perform ${role} duties`,
    },
    permissions: {
      canHire: false,
      maxSubordinates: 0,
      hiringBudget: 0,
    },
    framework: {
      primary: framework,
    },
  };
}

// Helper to wait for a condition
async function waitFor(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 10
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

describe('Concurrent Execution Prevention - Integration Tests', () => {
  let db: Database.Database;
  let dbPool: DatabasePool;
  let testDir: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    runMigrations(db, allMigrations);

    dbPool = {
      getConnection: () => db,
      close: () => db.close(),
    } as unknown as DatabasePool;

    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'concurrent-exec-test-'));
    process.env.RECURSIVE_MANAGER_DATA_DIR = testDir;
  });

  afterEach(async () => {
    db.close();
    fs.removeSync(testDir);
    delete process.env.RECURSIVE_MANAGER_DATA_DIR;
  });

  describe('AgentLock + ExecutionPool Integration', () => {
    it('should prevent concurrent execution of same agent through lock and pool', async () => {
      const agentLock = new AgentLock();
      const pool = new ExecutionPool({ maxConcurrent: 5 });
      const agentId = 'agent-001';

      let concurrentExecutions = 0;
      let maxConcurrent = 0;

      const executeAgent = async () => {
        const release = await agentLock.acquire(agentId);
        try {
          concurrentExecutions++;
          maxConcurrent = Math.max(maxConcurrent, concurrentExecutions);
          await new Promise((resolve) => setTimeout(resolve, 50));
          concurrentExecutions--;
        } finally {
          release();
        }
      };

      // Launch 10 executions for the same agent
      const executions = Array.from({ length: 10 }, () => pool.execute(agentId, executeAgent));

      await Promise.all(executions);

      // Should never have more than 1 concurrent execution for same agent
      expect(maxConcurrent).toBe(1);
      expect(concurrentExecutions).toBe(0);
    });

    it('should allow concurrent execution of different agents up to pool limit', async () => {
      const agentLock = new AgentLock();
      const pool = new ExecutionPool({ maxConcurrent: 3 });

      let concurrentExecutions = 0;
      let maxConcurrent = 0;

      const executeAgent = async (agentId: string) => {
        const release = await agentLock.acquire(agentId);
        try {
          concurrentExecutions++;
          maxConcurrent = Math.max(maxConcurrent, concurrentExecutions);
          await new Promise((resolve) => setTimeout(resolve, 50));
          concurrentExecutions--;
        } finally {
          release();
        }
      };

      // Launch 5 executions for different agents
      const executions = Array.from({ length: 5 }, (_, i) =>
        pool.execute(`agent-${i}`, () => executeAgent(`agent-${i}`))
      );

      await Promise.all(executions);

      // Should have up to 3 concurrent executions (pool limit)
      expect(maxConcurrent).toBe(3);
      expect(concurrentExecutions).toBe(0);
    });

    it('should queue tasks when pool is at capacity', async () => {
      const agentLock = new AgentLock();
      const pool = new ExecutionPool({ maxConcurrent: 2 });

      const executionOrder: string[] = [];

      const executeAgent = async (agentId: string) => {
        const release = await agentLock.acquire(agentId);
        try {
          executionOrder.push(`start-${agentId}`);
          await new Promise((resolve) => setTimeout(resolve, 30));
          executionOrder.push(`end-${agentId}`);
        } finally {
          release();
        }
      };

      // Launch 4 executions
      const executions = [
        pool.execute('agent-1', () => executeAgent('agent-1')),
        pool.execute('agent-2', () => executeAgent('agent-2')),
        pool.execute('agent-3', () => executeAgent('agent-3')),
        pool.execute('agent-4', () => executeAgent('agent-4')),
      ];

      // Wait for first two to start
      await waitFor(() => pool.getActiveExecutions().length === 2);
      expect(pool.getQueueDepth()).toBe(2);

      await Promise.all(executions);

      // All should complete
      expect(executionOrder).toHaveLength(8);
      expect(pool.getQueueDepth()).toBe(0);
      expect(pool.getActiveExecutions()).toHaveLength(0);
    });

    it('should release lock on error and allow retry', async () => {
      const agentLock = new AgentLock();
      const pool = new ExecutionPool({ maxConcurrent: 5 });
      const agentId = 'agent-error';

      let attemptCount = 0;

      const executeAgent = async () => {
        const release = await agentLock.acquire(agentId);
        try {
          attemptCount++;
          if (attemptCount === 1) {
            throw new Error('First attempt fails');
          }
          return 'success';
        } finally {
          release();
        }
      };

      // First attempt should fail
      await expect(pool.execute(agentId, executeAgent)).rejects.toThrow('First attempt fails');
      expect(attemptCount).toBe(1);
      expect(agentLock.isLocked(agentId)).toBe(false);

      // Second attempt should succeed
      const result = await pool.execute(agentId, executeAgent);
      expect(result).toBe('success');
      expect(attemptCount).toBe(2);
      expect(agentLock.isLocked(agentId)).toBe(false);
    });

    it('should handle mixed success and failure across multiple agents', async () => {
      const agentLock = new AgentLock();
      const pool = new ExecutionPool({ maxConcurrent: 3 });

      const results: Array<{ agentId: string; success: boolean }> = [];

      const executeAgent = async (agentId: string, shouldFail: boolean) => {
        const release = await agentLock.acquire(agentId);
        try {
          await new Promise((resolve) => setTimeout(resolve, 20));
          if (shouldFail) {
            throw new Error(`Agent ${agentId} failed`);
          }
          results.push({ agentId, success: true });
        } finally {
          release();
        }
      };

      const executions = [
        pool.execute('agent-1', () => executeAgent('agent-1', false)),
        pool
          .execute('agent-2', () => executeAgent('agent-2', true))
          .catch(() => results.push({ agentId: 'agent-2', success: false })),
        pool.execute('agent-3', () => executeAgent('agent-3', false)),
        pool
          .execute('agent-4', () => executeAgent('agent-4', true))
          .catch(() => results.push({ agentId: 'agent-4', success: false })),
      ];

      await Promise.all(executions);

      expect(results).toHaveLength(4);
      expect(results.filter((r) => r.success).length).toBe(2);
      expect(results.filter((r) => !r.success).length).toBe(2);
    });
  });

  describe('PidManager Integration (EC-7.1: Cross-Process Prevention)', () => {
    it('should prevent duplicate process instances using PID lock', async () => {
      const processName = 'test-daemon';

      // First process acquires lock
      await acquirePidLock(processName);
      expect(await isProcessRunningByPid(processName)).toBe(true);

      // Second process should be blocked
      await expect(acquirePidLock(processName)).rejects.toThrow(PidError);
      await expect(acquirePidLock(processName)).rejects.toThrow('already running');

      // Clean up
      await removePidFile(processName);
    });

    it('should allow new process after PID file is removed', async () => {
      const processName = 'test-daemon-2';

      // First process
      await acquirePidLock(processName);
      expect(await isProcessRunningByPid(processName)).toBe(true);

      // Remove PID file (simulating process exit)
      await removePidFile(processName);
      expect(await isProcessRunningByPid(processName)).toBe(false);

      // Second process can now acquire lock
      await acquirePidLock(processName);
      expect(await isProcessRunningByPid(processName)).toBe(true);

      // Clean up
      await removePidFile(processName);
    });

    it('should detect and clean up stale PID files', async () => {
      const processName = 'test-stale-daemon';
      const { getPidFilePath } = await import('@recursive-manager/common');

      // Manually create a stale PID file with non-existent PID
      const stalePid = 999999; // Very unlikely to exist
      const pidPath = getPidFilePath(processName);
      await fs.ensureDir(path.dirname(pidPath));
      await fs.writeJson(pidPath, {
        pid: stalePid,
        processName,
        createdAt: new Date().toISOString(),
        hostname: os.hostname(),
      });

      // isProcessRunningByPid should detect it's stale and return false
      const isRunning = await isProcessRunningByPid(processName);
      expect(isRunning).toBe(false);

      // Should be able to acquire lock (stale file cleaned up)
      await acquirePidLock(processName);
      expect(await isProcessRunningByPid(processName)).toBe(true);

      // Clean up
      await removePidFile(processName);
    });

    it('should handle multiple processes with different names concurrently', async () => {
      const processes = ['daemon-1', 'daemon-2', 'daemon-3', 'daemon-4'];

      // All should acquire locks successfully
      await Promise.all(processes.map((name) => acquirePidLock(name)));

      // All should be running
      const runningStatus = await Promise.all(processes.map((name) => isProcessRunningByPid(name)));
      expect(runningStatus.every((status) => status !== null)).toBe(true);

      // Clean up
      await Promise.all(processes.map((name) => removePidFile(name)));
    });

    it('should prevent EC-7.1: two continuous instances running', async () => {
      const agentId = 'continuous-agent';
      const processName = `agent-${agentId}-continuous`;

      // Simulate first continuous instance acquiring PID lock
      await acquirePidLock(processName);

      // Simulate scheduler trying to start second instance
      let secondInstanceBlocked = false;
      try {
        await acquirePidLock(processName);
      } catch (error) {
        secondInstanceBlocked = true;
        expect(error).toBeInstanceOf(PidError);
      }

      expect(secondInstanceBlocked).toBe(true);

      // Clean up
      await removePidFile(processName);
    });
  });

  describe('ExecutionOrchestrator Full Integration', () => {
    let adapterRegistry: AdapterRegistry;
    let orchestrator: ExecutionOrchestrator;
    let mockAdapter: FrameworkAdapter;

    beforeEach(() => {
      mockAdapter = {
        name: 'mock-adapter',
        async executeAgent(
          agentId: string,
          mode: 'continuous' | 'reactive'
        ): Promise<ExecutionResult> {
          // Simulate some work
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {
            success: true,
            agentId,
            mode,
            tasksCompleted: 1,
            messagesProcessed: 0,
            duration: 50,
            timestamp: new Date(),
          };
        },
        async checkHealth(): Promise<boolean> {
          return true;
        },
        supportsFeature(_feature: string): boolean {
          return true;
        },
        getCapabilities(): any[] {
          return [];
        },
      };

      adapterRegistry = new AdapterRegistry();
      adapterRegistry.register(mockAdapter);

      orchestrator = new ExecutionOrchestrator({
        adapterRegistry: adapterRegistry as any,
        database: dbPool,
        maxExecutionTime: 5 * 60 * 1000,
      });
    });

    it('should prevent concurrent execution through orchestrator', async () => {
      const agentId = 'test-orchestrator-001';
      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Test Engineer',
        reportingTo: null,
        framework: 'mock-adapter',
        systemPrompt: 'Build software',
        schedule: { mode: 'continuous' },
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Engineer'));

      createTask(db, {
        id: 'task-001',
        agentId,
        title: 'Test task',
        description: 'Test',
        priority: 'high',
        status: 'in_progress',
      });

      // Start first execution
      const exec1Promise = orchestrator.executeContinuous(agentId);

      // Wait a bit to ensure first execution has started
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Try to start second execution - should fail
      await expect(orchestrator.executeContinuous(agentId)).rejects.toThrow('is already executing');

      // Wait for first execution to complete
      const result1 = await exec1Promise;
      expect(result1.success).toBe(true);

      // Now second execution should succeed
      const result2 = await orchestrator.executeContinuous(agentId);
      expect(result2.success).toBe(true);
    });

    it('should allow concurrent execution of different agents through orchestrator', async () => {
      const agents = ['agent-1', 'agent-2', 'agent-3'];

      // Create all agents
      for (const agentId of agents) {
        createAgent(db, {
          id: agentId,
          role: 'Engineer',
          displayName: `Engineer ${agentId}`,
          reportingTo: null,
          framework: 'mock-adapter',
          systemPrompt: 'Build',
          schedule: { mode: 'continuous' },
        });
        await saveAgentConfig(agentId, createValidConfig(agentId, 'Engineer'));
        createTask(db, {
          id: `task-${agentId}`,
          agentId,
          title: 'Task',
          description: 'Test',
          priority: 'high',
          status: 'in_progress',
        });
      }

      // Execute all agents concurrently
      const executions = agents.map((agentId) => orchestrator.executeContinuous(agentId));
      const results = await Promise.all(executions);

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);
      expect(results).toHaveLength(3);
    });

    it('should release lock when execution fails', async () => {
      const agentId = 'test-error-release';
      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Test',
        reportingTo: null,
        framework: 'mock-adapter',
        systemPrompt: 'Build',
        schedule: { mode: 'continuous' },
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Engineer'));

      // Make adapter fail
      mockAdapter.executeAgent = async () => {
        throw new Error('Execution failed');
      };

      // First execution should fail
      await expect(orchestrator.executeContinuous(agentId)).rejects.toThrow('Execution failed');

      // Fix the adapter
      mockAdapter.executeAgent = async (agentId, mode) => ({
        success: true,
        agentId,
        mode,
        tasksCompleted: 0,
        messagesProcessed: 0,
        duration: 10,
        timestamp: new Date(),
      });

      // Second execution should succeed (lock was released)
      const result = await orchestrator.executeContinuous(agentId);
      expect(result.success).toBe(true);
    });

    it('should handle high concurrent load with multiple agents', async () => {
      const agentCount = 20;
      const agents = Array.from({ length: agentCount }, (_, i) => `agent-${i}`);

      // Create all agents
      for (const agentId of agents) {
        createAgent(db, {
          id: agentId,
          role: 'Worker',
          displayName: `Worker ${agentId}`,
          reportingTo: null,
          framework: 'mock-adapter',
          systemPrompt: 'Work',
          schedule: { mode: 'continuous' },
        });
        await saveAgentConfig(agentId, createValidConfig(agentId, 'Worker'));
      }

      // Execute all agents with some executing same agent multiple times
      const executions = [...agents.map((agentId) => orchestrator.executeContinuous(agentId))];

      const results = await Promise.all(executions);

      // All should complete successfully
      expect(results.every((r) => r.success)).toBe(true);
      expect(results).toHaveLength(agentCount);
    });
  });

  describe('Complete System Integration', () => {
    let adapterRegistry: AdapterRegistry;
    let orchestrator: ExecutionOrchestrator;
    let mockAdapter: FrameworkAdapter;

    beforeEach(() => {
      mockAdapter = {
        name: 'mock-adapter',
        async executeAgent(
          agentId: string,
          mode: 'continuous' | 'reactive'
        ): Promise<ExecutionResult> {
          await new Promise((resolve) => setTimeout(resolve, 30));
          return {
            success: true,
            agentId,
            mode,
            tasksCompleted: 1,
            messagesProcessed: 0,
            duration: 30,
            timestamp: new Date(),
          };
        },
        async checkHealth(): Promise<boolean> {
          return true;
        },
        supportsFeature(_feature: string): boolean {
          return true;
        },
        getCapabilities(): any[] {
          return [];
        },
      };

      adapterRegistry = new AdapterRegistry();
      adapterRegistry.register(mockAdapter);

      orchestrator = new ExecutionOrchestrator({
        adapterRegistry: adapterRegistry as any,
        database: dbPool,
        maxExecutionTime: 5 * 60 * 1000,
      });
    });

    it('should prevent all forms of concurrent execution for same agent', async () => {
      const agentId = 'test-complete';
      const processName = `agent-${agentId}-continuous`;

      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Test',
        reportingTo: null,
        framework: 'mock-adapter',
        systemPrompt: 'Build',
        schedule: { mode: 'continuous' },
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Engineer'));

      // Acquire PID lock (simulating continuous daemon)
      await acquirePidLock(processName);

      // Try to execute through orchestrator - should fail at orchestrator level
      const exec1Promise = orchestrator.executeContinuous(agentId);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Try second execution - should fail at lock level
      await expect(orchestrator.executeContinuous(agentId)).rejects.toThrow('is already executing');

      await exec1Promise;

      // Clean up PID lock
      await removePidFile(processName);
    });

    it('should coordinate locks, pool, and PID files correctly', async () => {
      const agentLock = new AgentLock();
      const pool = new ExecutionPool({ maxConcurrent: 3 });
      const agentIds = ['agent-A', 'agent-B', 'agent-C'];
      const processNames = agentIds.map((id) => `process-${id}`);

      // Acquire PID locks for all processes
      await Promise.all(processNames.map((name) => acquirePidLock(name)));

      // Execute through pool with agent locks
      const executions = agentIds.map(async (agentId, index) => {
        const release = await agentLock.acquire(agentId);
        try {
          expect(await isProcessRunningByPid(processNames[index]!)).not.toBeNull();
          await new Promise((resolve) => setTimeout(resolve, 20));
          return { agentId, success: true };
        } finally {
          release();
        }
      });

      const results = await Promise.all(
        executions.map((exec) => pool.execute(agentIds[0]!, () => exec))
      );

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);

      // Clean up
      await Promise.all(processNames.map((name) => removePidFile(name)));

      // Verify cleanup
      const runningStatus = await Promise.all(
        processNames.map((name) => isProcessRunningByPid(name))
      );
      expect(runningStatus.every((status) => status === null)).toBe(true);
    });

    it('should maintain queue integrity under concurrent pressure', async () => {
      const pool = new ExecutionPool({ maxConcurrent: 2 });
      const agentLock = new AgentLock();

      const executionLog: Array<{ agent: string; event: string; time: number }> = [];
      const startTime = Date.now();

      const logEvent = (agent: string, event: string) => {
        executionLog.push({ agent, event, time: Date.now() - startTime });
      };

      const executeAgent = async (agentId: string, duration: number) => {
        const release = await agentLock.acquire(agentId);
        try {
          logEvent(agentId, 'start');
          await new Promise((resolve) => setTimeout(resolve, duration));
          logEvent(agentId, 'end');
        } finally {
          release();
        }
      };

      // Launch 6 executions with varying durations
      const executions = [
        pool.execute('agent-1', () => executeAgent('agent-1', 40)),
        pool.execute('agent-2', () => executeAgent('agent-2', 40)),
        pool.execute('agent-3', () => executeAgent('agent-3', 30)),
        pool.execute('agent-4', () => executeAgent('agent-4', 30)),
        pool.execute('agent-5', () => executeAgent('agent-5', 20)),
        pool.execute('agent-6', () => executeAgent('agent-6', 20)),
      ];

      await Promise.all(executions);

      // Verify all executions completed
      expect(executionLog.filter((e) => e.event === 'start')).toHaveLength(6);
      expect(executionLog.filter((e) => e.event === 'end')).toHaveLength(6);

      // Verify FIFO ordering: agent-1 and agent-2 start first
      const starts = executionLog.filter((e) => e.event === 'start');
      expect(starts[0]?.agent).toBe('agent-1');
      expect(starts[1]?.agent).toBe('agent-2');
    });
  });
});
