/**
 * Tests for Framework Adapter types
 * Validates that the TypeScript interfaces are correctly defined
 */

import type {
  ExecutionMode,
  ExecutionContext,
  ExecutionResult,
  Capability,
  FrameworkAdapter,
  TaskSchema,
  Message,
} from '../types';

describe('Framework Adapter Types', () => {
  describe('ExecutionMode', () => {
    it('should accept valid execution modes', () => {
      const continuousMode: ExecutionMode = 'continuous';
      const reactiveMode: ExecutionMode = 'reactive';

      expect(continuousMode).toBe('continuous');
      expect(reactiveMode).toBe('reactive');
    });
  });

  describe('TaskSchema', () => {
    it('should allow valid task objects', () => {
      const task: TaskSchema = {
        id: 'task-1',
        title: 'Test Task',
        description: 'A test task',
        status: 'pending',
        priority: 'medium',
        createdAt: '2026-01-19T00:00:00Z',
        updatedAt: '2026-01-19T00:00:00Z',
      };

      expect(task.id).toBe('task-1');
      expect(task.status).toBe('pending');
    });

    it('should allow optional fields', () => {
      const subtask: TaskSchema = {
        id: 'task-2',
        title: 'Subtask',
        description: 'A subtask',
        status: 'in_progress',
        priority: 'high',
        parentTaskId: 'task-1',
        delegatedTo: 'agent-123',
        createdAt: '2026-01-19T00:00:00Z',
        updatedAt: '2026-01-19T00:00:00Z',
      };

      expect(subtask.parentTaskId).toBe('task-1');
      expect(subtask.delegatedTo).toBe('agent-123');
    });
  });

  describe('Message', () => {
    it('should allow valid message objects', () => {
      const message: Message = {
        id: 'msg-1',
        from: 'agent-1',
        to: 'agent-2',
        content: 'Hello',
        channel: 'internal',
        timestamp: '2026-01-19T00:00:00Z',
        read: false,
      };

      expect(message.from).toBe('agent-1');
      expect(message.read).toBe(false);
    });
  });

  describe('ExecutionContext', () => {
    it('should allow valid execution context objects', () => {
      const context: ExecutionContext = {
        agentId: 'agent-123',
        mode: 'continuous',
        config: {
          version: '1.0.0',
          identity: {
            id: 'agent-123',
            role: 'developer',
            displayName: 'Dev Agent',
            createdAt: '2026-01-19T00:00:00Z',
            createdBy: 'system',
            reportingTo: null,
          },
          goal: {
            mainGoal: 'Build features',
          },
          permissions: {
            canHire: true,
            maxSubordinates: 5,
            hiringBudget: 2,
          },
          framework: {
            primary: 'claude-code',
          },
        },
        activeTasks: [],
        messages: [],
        workspaceFiles: [],
        workspaceDir: '/agents/agent-123/workspace',
        workingDir: '/agents/agent-123',
      };

      expect(context.agentId).toBe('agent-123');
      expect(context.mode).toBe('continuous');
    });
  });

  describe('ExecutionResult', () => {
    it('should allow valid execution result objects', () => {
      const result: ExecutionResult = {
        success: true,
        duration: 5000,
        tasksCompleted: 2,
        messagesProcessed: 1,
        errors: [],
      };

      expect(result.success).toBe(true);
      expect(result.duration).toBe(5000);
    });

    it('should allow results with errors', () => {
      const result: ExecutionResult = {
        success: false,
        duration: 1000,
        tasksCompleted: 0,
        messagesProcessed: 0,
        errors: [
          {
            message: 'Task failed',
            code: 'TASK_FAILURE',
            stack: 'Error: Task failed\n  at ...',
          },
        ],
      };

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toBe('Task failed');
    });

    it('should allow optional metadata', () => {
      const result: ExecutionResult = {
        success: true,
        duration: 3000,
        tasksCompleted: 1,
        messagesProcessed: 0,
        errors: [],
        nextExecution: new Date('2026-01-20T00:00:00Z'),
        metadata: {
          filesCreated: ['file1.ts'],
          filesModified: ['file2.ts'],
          apiCallCount: 5,
          costUSD: 0.05,
          output: 'Task completed successfully',
        },
      };

      expect(result.metadata?.filesCreated).toHaveLength(1);
      expect(result.metadata?.costUSD).toBe(0.05);
    });
  });

  describe('Capability', () => {
    it('should allow valid capability objects', () => {
      const capability: Capability = {
        name: 'file-operations',
        description: 'Can read and write files',
        available: true,
        version: '1.0.0',
      };

      expect(capability.name).toBe('file-operations');
      expect(capability.available).toBe(true);
    });
  });

  describe('FrameworkAdapter', () => {
    it('should allow classes that implement the interface', () => {
      class MockAdapter implements FrameworkAdapter {
        readonly name = 'mock-adapter';
        readonly version = '1.0.0';

        executeAgent(
          _agentId: string,
          _mode: ExecutionMode,
          _context: ExecutionContext
        ): Promise<ExecutionResult> {
          return Promise.resolve({
            success: true,
            duration: 1000,
            tasksCompleted: 0,
            messagesProcessed: 0,
            errors: [],
          });
        }

        supportsFeature(feature: string): boolean {
          return feature === 'basic';
        }

        getCapabilities(): Capability[] {
          return [
            {
              name: 'basic',
              description: 'Basic operations',
              available: true,
            },
          ];
        }

        healthCheck(): Promise<boolean> {
          return Promise.resolve(true);
        }
      }

      const adapter = new MockAdapter();
      expect(adapter.name).toBe('mock-adapter');
      expect(adapter.supportsFeature('basic')).toBe(true);
      expect(adapter.getCapabilities()).toHaveLength(1);
    });

    it('should enforce interface contract', async () => {
      const mockAdapter: FrameworkAdapter = {
        name: 'test-adapter',
        version: '0.1.0',
        executeAgent: () =>
          Promise.resolve({
            success: true,
            duration: 500,
            tasksCompleted: 0,
            messagesProcessed: 0,
            errors: [],
          }),
        supportsFeature: () => false,
        getCapabilities: () => [],
        healthCheck: () => Promise.resolve(true),
      };

      const result = await mockAdapter.executeAgent('agent-1', 'reactive', {} as ExecutionContext);
      expect(result.success).toBe(true);

      const isHealthy = await mockAdapter.healthCheck();
      expect(isHealthy).toBe(true);
    });
  });
});
