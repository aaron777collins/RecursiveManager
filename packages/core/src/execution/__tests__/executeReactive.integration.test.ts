/**
 * Integration tests for reactive execution (Task 3.3.14)
 *
 * This test suite validates the complete reactive execution flow of the ExecutionOrchestrator.
 * Tests cover successful execution, trigger type handling, agent validation, message processing,
 * adapter fallback, concurrency control, error recovery, and audit logging.
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import {
  createAgent,
  createMessage,
  runMigrations,
  allMigrations,
  DatabasePool,
  queryAuditLog,
  type AuditEventRecord,
  type AgentConfig,
} from '@recursive-manager/common';
import { ExecutionOrchestrator } from '../index';
import { saveAgentConfig } from '../../config';

// Mock types for adapters (avoiding import issues)
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

describe('ExecutionOrchestrator - Reactive Execution Integration Tests', () => {
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

    // Create a mock DatabasePool that matches the interface
    dbPool = {
      getConnection: () => ({
        db,
        close: () => db.close(),
        healthCheck: () => true,
      }),
      close: () => db.close(),
      initialize: () => {},
      isInitialized: () => true,
      getPath: () => ':memory:',
      healthCheck: () => true,
    } as unknown as DatabasePool;

    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exec-reactive-test-'));
    process.env.RECURSIVE_MANAGER_DATA_DIR = testDir;

    mockAdapter = {
      name: 'mock-adapter',
      async executeAgent(
        _agentId: string,
        _mode: 'continuous' | 'reactive',
        context: any
      ): Promise<ExecutionResult> {
        return {
          success: true,
          tasksCompleted: 0,
          messagesProcessed: context.messages?.length || 0,
          duration: 1000,
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
    delete process.env.RECURSIVE_MANAGER_DATA_DIR;
  });

  describe('Successful Execution', () => {
    it('should execute agent with unread messages', async () => {
      const agentId = 'test-001';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: '/test/agents/test-001/config.json',
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      createMessage(db, {
        id: 'msg-001',
        from_agent_id: 'user-external',
        to_agent_id: agentId,
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'email',
        message_path: '/test/messages/msg-001.txt',
      });

      const trigger = {
        type: 'message' as const,
        messageId: 'msg-001',
        channel: 'email',
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);
      expect(result.messagesProcessed).toBe(1);

      const auditLogs = queryAuditLog(db, { agentId });
      expect(auditLogs.length).toBeGreaterThan(0);
      const executionLog = auditLogs.find((log) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();
    });

    it('should execute agent with no messages', async () => {
      const agentId = 'test-002';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      const trigger = {
        type: 'manual' as const,
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);
      expect(result.messagesProcessed).toBe(0);
    });

    it('should process multiple messages', async () => {
      const agentId = 'test-003';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      createMessage(db, {
        id: 'msg-001',
        from_agent_id: 'user-external',
        to_agent_id: agentId,
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'email',
        message_path: '/test/messages/msg-001.txt',
      });

      createMessage(db, {
        id: 'msg-002',
        from_agent_id: 'user-external',
        to_agent_id: agentId,
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'email',
        message_path: '/test/messages/msg-002.txt',
      });

      createMessage(db, {
        id: 'msg-003',
        from_agent_id: 'user-external',
        to_agent_id: agentId,
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'slack',
        message_path: '/test/messages/msg-003.txt',
      });

      const trigger = {
        type: 'message' as const,
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);
      expect(result.messagesProcessed).toBe(3);
    });
  });

  describe('Trigger Type Handling', () => {
    it('should handle message trigger', async () => {
      const agentId = 'test-004';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      const trigger = {
        type: 'message' as const,
        messageId: 'msg-001',
        channel: 'email',
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);

      const auditLogs = queryAuditLog(db, { agentId });
      const executionLog = auditLogs.find((log: AuditEventRecord) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();
      expect(executionLog?.details).toBeDefined();
      const metadata = JSON.parse(executionLog?.details || '{}');
      expect(metadata.trigger?.type).toBe('message');
      expect(metadata.trigger?.messageId).toBe('msg-001');
    });

    it('should handle webhook trigger', async () => {
      const agentId = 'test-005';
      createAgent(db, {
        id: agentId,
        role: 'Integration',
        displayName: 'Test Integration',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle webhooks',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Integration'));

      const trigger = {
        type: 'webhook' as const,
        context: { webhook: 'github-push', repo: 'test/repo' },
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);

      const auditLogs = queryAuditLog(db, { agentId });
      const executionLog = auditLogs.find((log: AuditEventRecord) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();
      const metadata = JSON.parse(executionLog?.details || '{}');
      expect(metadata.trigger?.type).toBe('webhook');
    });

    it('should handle manual trigger', async () => {
      const agentId = 'test-006';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      const trigger = {
        type: 'manual' as const,
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);

      const auditLogs = queryAuditLog(db, { agentId });
      const executionLog = auditLogs.find((log: AuditEventRecord) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();
      const metadata = JSON.parse(executionLog?.details || '{}');
      expect(metadata.trigger?.type).toBe('manual');
    });

    it('should include trigger context in execution', async () => {
      const agentId = 'test-007';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      const trigger = {
        type: 'webhook' as const,
        context: {
          source: 'github',
          event: 'push',
          ref: 'refs/heads/main',
        },
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);

      const auditLogs = queryAuditLog(db, { agentId });
      const executionLog = auditLogs.find((log: AuditEventRecord) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();
      const metadata = JSON.parse(executionLog?.details || '{}');
      expect(metadata.trigger?.context).toBeDefined();
      expect(metadata.trigger?.context?.source).toBe('github');
    });
  });

  describe('Agent Status Validation', () => {
    it('should reject non-existent agent', async () => {
      const trigger = {
        type: 'manual' as const,
        timestamp: new Date(),
      };

      await expect(orchestrator.executeReactive('non-existent', trigger)).rejects.toThrow(
        'Agent non-existent not found'
      );
    });

    it('should reject paused agent', async () => {
      const agentId = 'test-008';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      // Pause the agent
      db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('paused', agentId);

      const trigger = {
        type: 'manual' as const,
        timestamp: new Date(),
      };

      await expect(orchestrator.executeReactive(agentId, trigger)).rejects.toThrow(
        `Agent ${agentId} is not active (status: paused)`
      );
    });
  });

  describe('Message Processing', () => {
    it('should load unread messages correctly', async () => {
      const agentId = 'test-009';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      // Create unread and read messages
      createMessage(db, {
        id: 'msg-unread-1',
        from_agent_id: 'user-external',
        to_agent_id: agentId,
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'email',
        read: false,
        message_path: '/test/messages/msg-unread-1.txt',
      });

      createMessage(db, {
        id: 'msg-read-1',
        from_agent_id: 'user-external',
        to_agent_id: agentId,
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'email',
        read: true,
        message_path: '/test/messages/msg-read-1.txt',
      });

      createMessage(db, {
        id: 'msg-unread-2',
        from_agent_id: 'user-external',
        to_agent_id: agentId,
        timestamp: new Date().toISOString(),
        priority: 'normal',
        channel: 'slack',
        read: false,
        message_path: '/test/messages/msg-unread-2.txt',
      });

      const trigger = {
        type: 'message' as const,
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);
      // Should only process unread messages
      expect(result.messagesProcessed).toBe(2);
    });

    it('should handle messages from multiple channels', async () => {
      const agentId = 'test-010';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      const channels: Array<'email' | 'slack' | 'telegram'> = ['email', 'slack', 'telegram'];
      channels.forEach((channel, idx) => {
        createMessage(db, {
          id: `msg-${idx}`,
          from_agent_id: 'user-external',
          to_agent_id: agentId,
          timestamp: new Date().toISOString(),
          priority: 'normal',
          channel,
          message_path: `/test/messages/msg-${idx}.txt`,
        });
      });

      const trigger = {
        type: 'message' as const,
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);
      expect(result.messagesProcessed).toBe(4);
    });

    it('should include message metadata in context', async () => {
      const agentId = 'test-011';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      createMessage(db, {
        id: 'msg-001',
        from_agent_id: 'user-external',
        to_agent_id: agentId,
        timestamp: new Date().toISOString(),
        priority: 'urgent',
        channel: 'email',
        message_path: '/test/messages/msg-001.txt',
        external_metadata: JSON.stringify({ tags: ['urgent', 'vip'] }),
      });

      const trigger = {
        type: 'message' as const,
        messageId: 'msg-001',
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);
      expect(result.messagesProcessed).toBe(1);
    });
  });

  describe('Adapter Fallback', () => {
    it('should use fallback adapter when primary is unhealthy', async () => {
      const fallbackAdapter: FrameworkAdapter = {
        name: 'fallback-adapter',
        async executeAgent(
          _agentId: string,
          _mode: 'continuous' | 'reactive',
          context: any
        ): Promise<ExecutionResult> {
          return {
            success: true,
            tasksCompleted: 0,
            messagesProcessed: context.messages?.length || 0,
            duration: 1500,
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

      adapterRegistry.register(fallbackAdapter);

      // Make primary adapter unhealthy
      mockAdapter.checkHealth = async () => false;

      const agentId = 'test-012';
      const config = createValidConfig(agentId, 'Support', 'mock-adapter');
      config.framework.fallback = 'fallback-adapter';

      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, config);

      const trigger = {
        type: 'manual' as const,
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);

      const auditLogs = queryAuditLog(db, { agentId });
      const executionLog = auditLogs.find((log: AuditEventRecord) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();
      const metadata = JSON.parse(executionLog?.details || '{}');
      expect(metadata.usedFallback).toBe(true);
      expect(metadata.adapter).toBe('fallback-adapter');
    });

    it('should fail if no healthy adapter available', async () => {
      // Make primary adapter unhealthy
      mockAdapter.checkHealth = async () => false;

      const agentId = 'test-013';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      const trigger = {
        type: 'manual' as const,
        timestamp: new Date(),
      };

      await expect(orchestrator.executeReactive(agentId, trigger)).rejects.toThrow(
        'No healthy adapter available'
      );
    });
  });

  describe('Concurrent Execution Prevention', () => {
    it('should prevent concurrent reactive executions of same agent', async () => {
      const agentId = 'test-014';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      // Make execution slow to test concurrency
      const slowAdapter: FrameworkAdapter = {
        name: 'slow-adapter',
        async executeAgent(
          _agentId: string,
          _mode: 'continuous' | 'reactive',
          _context: any
        ): Promise<ExecutionResult> {
          await new Promise((resolve) => setTimeout(resolve, 500));
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
        supportsFeature(_feature: string): boolean {
          return true;
        },
        getCapabilities(): any[] {
          return [];
        },
      };

      adapterRegistry.register(slowAdapter);

      // Update agent to use slow adapter
      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support', 'slow-adapter'));

      const trigger1 = { type: 'manual' as const, timestamp: new Date() };
      const trigger2 = { type: 'manual' as const, timestamp: new Date() };

      // Start both executions concurrently
      const execution1 = orchestrator.executeReactive(agentId, trigger1);
      const execution2 = orchestrator.executeReactive(agentId, trigger2);

      const results = await Promise.allSettled([execution1, execution2]);

      // One should succeed, one should fail due to lock
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      expect(succeeded).toBe(1);
      expect(failed).toBe(1);

      const rejection = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejection.reason.message).toContain('is already executing');
    });

    it('should allow sequential reactive executions', async () => {
      const agentId = 'test-015';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      const trigger1 = { type: 'manual' as const, timestamp: new Date() };
      const trigger2 = { type: 'manual' as const, timestamp: new Date() };

      // Execute sequentially
      const result1 = await orchestrator.executeReactive(agentId, trigger1);
      const result2 = await orchestrator.executeReactive(agentId, trigger2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter errors gracefully', async () => {
      const errorAdapter: FrameworkAdapter = {
        name: 'error-adapter',
        async executeAgent(): Promise<ExecutionResult> {
          throw new Error('Adapter execution failed');
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

      adapterRegistry.register(errorAdapter);

      const agentId = 'test-016';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support', 'error-adapter'));

      const trigger = {
        type: 'manual' as const,
        timestamp: new Date(),
      };

      await expect(orchestrator.executeReactive(agentId, trigger)).rejects.toThrow(
        'Adapter execution failed'
      );

      const auditLogs = queryAuditLog(db, { agentId });
      const executionLog = auditLogs.find((log: AuditEventRecord) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();
      const metadata = JSON.parse(executionLog?.details || '{}');
      expect(metadata.error).toBeDefined();
    });

    it('should release lock on error', async () => {
      const errorAdapter: FrameworkAdapter = {
        name: 'error-adapter-2',
        async executeAgent(): Promise<ExecutionResult> {
          throw new Error('Execution error');
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

      adapterRegistry.register(errorAdapter);

      const agentId = 'test-017';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support', 'error-adapter-2'));

      const trigger = {
        type: 'manual' as const,
        timestamp: new Date(),
      };

      // First execution should fail
      await expect(orchestrator.executeReactive(agentId, trigger)).rejects.toThrow();

      // Second execution should not be blocked by unreleased lock
      // Change adapter to working one
      db.prepare('UPDATE agents SET framework = ? WHERE id = ?').run('mock-adapter', agentId);
      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support', 'mock-adapter'));

      const result = await orchestrator.executeReactive(agentId, trigger);
      expect(result.success).toBe(true);
    });

    it('should log errors in audit trail', async () => {
      const errorAdapter: FrameworkAdapter = {
        name: 'error-adapter-3',
        async executeAgent(): Promise<ExecutionResult> {
          throw new Error('Test error message');
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

      adapterRegistry.register(errorAdapter);

      const agentId = 'test-018';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support', 'error-adapter-3'));

      const trigger = {
        type: 'manual' as const,
        timestamp: new Date(),
      };

      await expect(orchestrator.executeReactive(agentId, trigger)).rejects.toThrow();

      const auditLogs = queryAuditLog(db, { agentId });
      const executionLog = auditLogs.find((log) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();
      expect(executionLog?.success).toBe(0); // SQLite stores booleans as 0/1
      const metadata = JSON.parse(executionLog?.details || '{}');
      expect(metadata.error).toContain('Test error message');
    });
  });

  describe('Audit Logging', () => {
    it('should create audit log for successful execution', async () => {
      const agentId = 'test-019';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      const trigger = {
        type: 'message' as const,
        messageId: 'msg-001',
        channel: 'email',
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);

      const auditLogs = queryAuditLog(db, { agentId });
      expect(auditLogs.length).toBeGreaterThan(0);

      const executionLog = auditLogs.find((log) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();
      expect(executionLog?.agent_id).toBe(agentId);
      expect(executionLog?.action).toBe('execute');
      expect(executionLog?.success).toBe(1); // SQLite stores booleans as 0/1

      const metadata = JSON.parse(executionLog?.details || '{}');
      expect(metadata.mode).toBe('reactive');
      expect(metadata.duration).toBeGreaterThan(0);
    });

    it('should include trigger information in audit log', async () => {
      const agentId = 'test-020';
      createAgent(db, {
        id: agentId,
        role: 'Support',
        displayName: 'Test Support',
        reportingTo: null,
        createdBy: 'test',
        mainGoal: 'Handle support requests',
        configPath: `/test/agents/${agentId}/config.json`,
      });

      await saveAgentConfig(agentId, createValidConfig(agentId, 'Support'));

      const trigger = {
        type: 'webhook' as const,
        context: {
          source: 'github',
          event: 'pull_request',
          action: 'opened',
        },
        timestamp: new Date(),
      };

      const result = await orchestrator.executeReactive(agentId, trigger);

      expect(result.success).toBe(true);

      const auditLogs = queryAuditLog(db, { agentId });
      const executionLog = auditLogs.find((log) => log.action === 'execute_end');
      expect(executionLog).toBeDefined();

      const metadata = JSON.parse(executionLog?.details || '{}');
      expect(metadata.trigger).toBeDefined();
      expect(metadata.trigger.type).toBe('webhook');
      expect(metadata.trigger.context).toBeDefined();
      expect(metadata.trigger.context.source).toBe('github');
      expect(metadata.trigger.context.event).toBe('pull_request');
    });
  });
});
