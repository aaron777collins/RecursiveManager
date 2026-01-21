/**
 * Integration tests for continuous execution (Task 3.3.13)
 *
 * This test suite validates the complete continuous execution flow of the ExecutionOrchestrator.
 * Tests cover successful execution, agent validation, adapter fallback, concurrency control,
 * timeout handling, error recovery, and audit logging.
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
  queryAuditLog,
  type AuditEventRecord,
  type AgentConfig,
} from '@recursivemanager/common';
import { ExecutionOrchestrator } from '../index';
import { saveAgentConfig } from '../../config';

// Mock types for adapters (matching real ExecutionResult from @recursivemanager/adapters)
type ExecutionResult = {
  success: boolean;
  duration: number;
  tasksCompleted: number;
  messagesProcessed: number;
  errors: Array<{
    message: string;
    stack?: string;
    code?: string;
  }>;
  nextExecution?: Date;
  metadata?: {
    filesCreated?: string[];
    filesModified?: string[];
    apiCallCount?: number;
    costUSD?: number;
    output?: string;
  };
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
  ): Promise<{ adapter: FrameworkAdapter; usedFallback: boolean } | undefined> {
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

    return undefined;
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
      workspaceQuotaMB: 500,
    },
    framework: {
      primary: framework,
    },
  };
}

describe('ExecutionOrchestrator - Continuous Execution Integration Tests', () => {
  let db: Database.Database;
  let dbPool: DatabasePool;
  let testDir: string;
  let adapterRegistry: AdapterRegistry;
  let orchestrator: ExecutionOrchestrator;
  let mockAdapter: FrameworkAdapter;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    runMigrations(db, allMigrations);

    dbPool = {
      getConnection: () => ({ db, close: () => {/* no-op */}, healthCheck: () => true }),
      close: () => db.close(),
      isInitialized: () => true,
    } as any as DatabasePool;

    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-continuous-test-'));
    process.env.RECURSIVEMANAGER_DATA_DIR = testDir;

    mockAdapter = {
      name: 'mock-adapter',
      async executeAgent(
        _agentId: string,
        _mode: 'continuous' | 'reactive',
        context: any
      ): Promise<ExecutionResult> {
        return {
          success: true,
          duration: 1000,
          tasksCompleted: context.activeTasks?.length || 0,
          messagesProcessed: 0,
          errors: [],
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

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
    delete process.env.RECURSIVEMANAGER_DATA_DIR;
  });

  describe('Successful Execution', () => {
    it('should execute agent with active tasks', async () => {
      const agentId = 'test-001';
      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Test Engineer',
        reportingTo: null,
        createdBy: 'system',
        mainGoal: 'Build software',
        configPath: `/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Engineer'));

      createTask(db, {
        id: 'task-001',
        agentId,
        title: 'Test task',
        priority: 'high',
        taskPath: 'Test task',
      });

      const result = await orchestrator.executeContinuous(agentId);

      expect(result.success).toBe(true);
      expect(result.tasksCompleted).toBe(1);
      expect(result.errors).toEqual([]);

      const auditLogs = queryAuditLog(db, { agentId });
      expect(auditLogs.length).toBeGreaterThan(0);
      const executionLog = auditLogs.find((log: AuditEventRecord) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();
    });

    it('should execute agent with no tasks', async () => {
      const agentId = 'test-002';
      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Test Engineer',
        reportingTo: null,
        createdBy: 'system',
        mainGoal: 'Build software',
        configPath: `/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Engineer'));

      const result = await orchestrator.executeContinuous(agentId);

      expect(result.success).toBe(true);
      expect(result.tasksCompleted).toBe(0);
    });
  });

  describe('Agent Status Validation', () => {
    it('should reject non-existent agent', async () => {
      await expect(orchestrator.executeContinuous('non-existent')).rejects.toThrow(
        'Agent not found: non-existent'
      );
    });

    it('should reject paused agent', async () => {
      const agentId = 'test-paused';
      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Paused',
        reportingTo: null,
        createdBy: 'system',
        mainGoal: 'Build',
        configPath: `/agents/${agentId}/config.json`,
      });

      db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('paused', agentId);

      await expect(orchestrator.executeContinuous(agentId)).rejects.toThrow(
        'Agent test-paused is not active (status: paused)'
      );
    });
  });

  describe('Adapter Fallback', () => {
    it('should use fallback when primary unhealthy', async () => {
      const unhealthyAdapter: FrameworkAdapter = {
        name: 'unhealthy',
        async executeAgent(): Promise<ExecutionResult> {
          throw new Error('Unavailable');
        },
        async checkHealth(): Promise<boolean> {
          return false;
        },
        supportsFeature: () => false,
        getCapabilities: () => [],
      };

      let fallbackUsed = false;
      const fallbackAdapter: FrameworkAdapter = {
        name: 'fallback',
        async executeAgent(_agentId, _mode): Promise<ExecutionResult> {
          fallbackUsed = true;
          return {
            success: true,
            tasksCompleted: 0,
            messagesProcessed: 0,
            duration: 500,
            errors: [],
          };
        },
        async checkHealth(): Promise<boolean> {
          return true;
        },
        supportsFeature: () => true,
        getCapabilities: () => [],
      };

      adapterRegistry.register(unhealthyAdapter);
      adapterRegistry.register(fallbackAdapter);

      const agentId = 'test-fallback';
      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Test',
        reportingTo: null,
        createdBy: 'system',
        mainGoal: 'Build',
        configPath: `/agents/${agentId}/config.json`,
      });

      // Update the config to include fallback
      await saveAgentConfig(agentId, {
        ...createValidConfig(agentId, 'Engineer', 'unhealthy'),
        framework: {
          primary: 'unhealthy',
          fallback: 'fallback',
        },
      });

      const result = await orchestrator.executeContinuous(agentId);

      expect(result.success).toBe(true);
      expect(fallbackUsed).toBe(true);
    });
  });

  describe('Concurrent Execution Prevention', () => {
    it('should prevent concurrent executions', async () => {
      const agentId = 'test-concurrent';
      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Test',
        reportingTo: null,
        createdBy: 'system',
        mainGoal: 'Build',
        configPath: `/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Engineer'));

      let execution1Started = false;
      mockAdapter.executeAgent = async (_agentId, _mode) => {
        execution1Started = true;
        await new Promise((resolve) => setTimeout(resolve, 100));
        return {
          success: true,
          tasksCompleted: 0,
          messagesProcessed: 0,
          duration: 100,
          errors: [],
        };
      };

      const execution1Promise = orchestrator.executeContinuous(agentId);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(execution1Started).toBe(true);

      await expect(orchestrator.executeContinuous(agentId)).rejects.toThrow('is already executing');

      await execution1Promise;
    });

    it('should allow sequential executions', async () => {
      const agentId = 'test-sequential';
      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Test',
        reportingTo: null,
        createdBy: 'system',
        mainGoal: 'Build',
        configPath: `/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Engineer'));

      const result1 = await orchestrator.executeContinuous(agentId);
      expect(result1.success).toBe(true);

      const result2 = await orchestrator.executeContinuous(agentId);
      expect(result2.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter errors gracefully', async () => {
      const agentId = 'test-error';
      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Test',
        reportingTo: null,
        createdBy: 'system',
        mainGoal: 'Build',
        configPath: `/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Engineer'));

      mockAdapter.executeAgent = async () => {
        throw new Error('Execution failed');
      };

      await expect(orchestrator.executeContinuous(agentId)).rejects.toThrow('Execution failed');

      const auditLogs = queryAuditLog(db, { agentId });
      const failureLog = auditLogs.find(
        (log: AuditEventRecord) => log.action === 'execute_end' && log.success === 0
      );
      expect(failureLog).toBeDefined();
    });

    it('should release lock on error', async () => {
      const agentId = 'test-lock-release';
      createAgent(db, {
        id: agentId,
        role: 'Engineer',
        displayName: 'Test',
        reportingTo: null,
        createdBy: 'system',
        mainGoal: 'Build',
        configPath: `/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Engineer'));

      mockAdapter.executeAgent = async () => {
        throw new Error('Fail');
      };

      await expect(orchestrator.executeContinuous(agentId)).rejects.toThrow();

      mockAdapter.executeAgent = async (_agentId, _mode) => ({
        success: true,
        tasksCompleted: 0,
        messagesProcessed: 0,
        duration: 10,
        errors: [],
      });

      const result = await orchestrator.executeContinuous(agentId);
      expect(result.success).toBe(true);
    });
  });
});
