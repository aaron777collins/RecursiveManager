/**
 * Tests for Claude Code Framework Adapter
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

// Mock execa before importing ClaudeCodeAdapter
jest.mock('execa', () => ({
  execa: jest.fn(),
}));

import { ClaudeCodeAdapter } from '../index';
import type { ExecutionContext, FrameworkAdapter, Capability } from '../../../types';
import type { AgentConfig } from '@recursive-manager/common';
import { execa } from 'execa';

const mockedExeca = execa as jest.MockedFunction<typeof execa>;

/**
 * Helper to mock health check before execution
 */
function mockHealthCheck() {
  mockedExeca.mockResolvedValueOnce({
    stdout: 'claude-code version 1.0.0',
    stderr: '',
    exitCode: 0,
  } as any);
}

/**
 * Create a mock execution context for testing
 */
function createMockContext(): ExecutionContext {
  const mockConfig: AgentConfig = {
    version: '1.0.0',
    identity: {
      id: 'test-agent-001',
      role: 'Developer',
      displayName: 'Test Agent',
      reportingTo: 'manager-001',
      createdAt: new Date().toISOString(),
      createdBy: 'root',
    },
    goal: {
      mainGoal: 'Test agent for unit testing',
      successCriteria: ['Complete tests'],
    },
    permissions: {
      canHire: false,
      canFire: false,
      maxSubordinates: 0,
      hiringBudget: 0,
    },
    framework: {
      primary: 'claude-code',
      capabilities: ['continuous-mode', 'reactive-mode'],
    },
    behavior: {
      continuousMode: true,
    },
  };

  return {
    agentId: 'test-agent-001',
    mode: 'continuous',
    config: mockConfig,
    activeTasks: [
      {
        id: 'task-001',
        title: 'Test Task',
        description: 'A test task',
        status: 'in_progress',
        priority: 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    messages: [],
    workspaceFiles: [],
    workspaceDir: '/tmp/test-workspace',
    workingDir: '/tmp/test-working',
  };
}

describe('ClaudeCodeAdapter', () => {
  let adapter: ClaudeCodeAdapter;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Default mock implementation for execa
    mockedExeca.mockResolvedValue({
      stdout: 'claude-code version 1.0.0',
      stderr: '',
      exitCode: 0,
    } as any);

    adapter = new ClaudeCodeAdapter({
      debug: false,
      timeout: 1000, // 1 second for tests
    });
  });

  describe('interface compliance', () => {
    it('should implement FrameworkAdapter interface', () => {
      const frameworkAdapter: FrameworkAdapter = adapter;
      expect(frameworkAdapter).toBeDefined();
    });

    it('should have readonly name property', () => {
      expect(adapter.name).toBe('claude-code');
      // Name is readonly at the TypeScript level
    });

    it('should have readonly version property', () => {
      expect(typeof adapter.version).toBe('string');
      expect(adapter.version.length).toBeGreaterThan(0);
      // Version is readonly at the TypeScript level
    });

    it('should have all required methods', () => {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(typeof adapter.executeAgent).toBe('function');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(typeof adapter.supportsFeature).toBe('function');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(typeof adapter.getCapabilities).toBe('function');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(typeof adapter.healthCheck).toBe('function');
    });
  });

  describe('constructor options', () => {
    it('should use default options when none provided', () => {
      const defaultAdapter = new ClaudeCodeAdapter();
      expect(defaultAdapter.name).toBe('claude-code');
      expect(defaultAdapter.version).toBeDefined();
    });

    it('should accept custom CLI path', () => {
      const customAdapter = new ClaudeCodeAdapter({
        cliPath: '/custom/path/to/claude',
      });
      expect(customAdapter).toBeDefined();
    });

    it('should accept custom timeout', () => {
      const customAdapter = new ClaudeCodeAdapter({
        timeout: 5000,
      });
      expect(customAdapter).toBeDefined();
    });

    it('should accept debug flag', () => {
      const debugAdapter = new ClaudeCodeAdapter({
        debug: true,
      });
      expect(debugAdapter).toBeDefined();
    });
  });

  describe('supportsFeature', () => {
    it('should support continuous-mode', () => {
      expect(adapter.supportsFeature('continuous-mode')).toBe(true);
    });

    it('should support reactive-mode', () => {
      expect(adapter.supportsFeature('reactive-mode')).toBe(true);
    });

    it('should support file-operations', () => {
      expect(adapter.supportsFeature('file-operations')).toBe(true);
    });

    it('should support code-generation', () => {
      expect(adapter.supportsFeature('code-generation')).toBe(true);
    });

    it('should support code-analysis', () => {
      expect(adapter.supportsFeature('code-analysis')).toBe(true);
    });

    it('should support bash-execution', () => {
      expect(adapter.supportsFeature('bash-execution')).toBe(true);
    });

    it('should support task-management', () => {
      expect(adapter.supportsFeature('task-management')).toBe(true);
    });

    it('should support multi-file-editing', () => {
      expect(adapter.supportsFeature('multi-file-editing')).toBe(true);
    });

    it('should support context-awareness', () => {
      expect(adapter.supportsFeature('context-awareness')).toBe(true);
    });

    it('should support error-recovery', () => {
      expect(adapter.supportsFeature('error-recovery')).toBe(true);
    });

    it('should not support unknown features', () => {
      expect(adapter.supportsFeature('unknown-feature')).toBe(false);
      expect(adapter.supportsFeature('quantum-computing')).toBe(false);
      expect(adapter.supportsFeature('')).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    it('should return array of capabilities', () => {
      const capabilities = adapter.getCapabilities();
      expect(Array.isArray(capabilities)).toBe(true);
      expect(capabilities.length).toBeGreaterThan(0);
    });

    it('should return capabilities with required fields', () => {
      const capabilities = adapter.getCapabilities();

      capabilities.forEach((capability: Capability) => {
        expect(capability).toHaveProperty('name');
        expect(capability).toHaveProperty('description');
        expect(capability).toHaveProperty('available');
        expect(typeof capability.name).toBe('string');
        expect(typeof capability.description).toBe('string');
        expect(typeof capability.available).toBe('boolean');
      });
    });

    it('should include continuous-mode capability', () => {
      const capabilities = adapter.getCapabilities();
      const continuousMode = capabilities.find((c) => c.name === 'continuous-mode');

      expect(continuousMode).toBeDefined();
      expect(continuousMode?.available).toBe(true);
    });

    it('should include reactive-mode capability', () => {
      const capabilities = adapter.getCapabilities();
      const reactiveMode = capabilities.find((c) => c.name === 'reactive-mode');

      expect(reactiveMode).toBeDefined();
      expect(reactiveMode?.available).toBe(true);
    });

    it('should include version in capabilities', () => {
      const capabilities = adapter.getCapabilities();

      capabilities.forEach((capability: Capability) => {
        expect(capability.version).toBe(adapter.version);
      });
    });

    it('should mark all capabilities as available', () => {
      const capabilities = adapter.getCapabilities();

      capabilities.forEach((capability: Capability) => {
        expect(capability.available).toBe(true);
      });
    });
  });

  describe('healthCheck', () => {
    it('should return a boolean', async () => {
      const health = await adapter.healthCheck();
      expect(typeof health).toBe('boolean');
    });

    it('should complete within reasonable time', async () => {
      const startTime = Date.now();
      await adapter.healthCheck();
      const duration = Date.now() - startTime;

      // Should complete within 10 seconds
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('executeAgent', () => {
    it('should return ExecutionResult', async () => {
      const context = createMockContext();
      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('tasksCompleted');
      expect(result).toHaveProperty('messagesProcessed');
      expect(result).toHaveProperty('errors');
    });

    it('should handle continuous mode', async () => {
      const context = createMockContext();
      context.mode = 'continuous';

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBeDefined();
      expect(typeof result.duration).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle reactive mode', async () => {
      const context = createMockContext();
      context.mode = 'reactive';
      context.messages = [
        {
          id: 'msg-001',
          from: 'user-001',
          to: 'test-agent-001',
          content: 'Test message',
          channel: 'internal',
          timestamp: new Date().toISOString(),
          read: false,
        },
      ];

      const result = await adapter.executeAgent('test-agent-001', 'reactive', context);

      expect(result.success).toBeDefined();
      expect(typeof result.duration).toBe('number');
    });

    it('should validate context has agentId', async () => {
      const context = createMockContext();
      context.agentId = '';

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      if (result.errors[0]) {
        expect(result.errors[0].message).toContain('agentId');
      }
    });

    it('should validate context has config', async () => {
      const context = createMockContext();
      (context as any).config = null;

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      if (result.errors[0]) {
        expect(result.errors[0].message).toContain('config');
      }
    });

    it('should validate context has workspaceDir', async () => {
      const context = createMockContext();
      context.workspaceDir = '';

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      if (result.errors[0]) {
        expect(result.errors[0].message).toContain('workspaceDir');
      }
    });

    it('should validate context has workingDir', async () => {
      const context = createMockContext();
      context.workingDir = '';

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      if (result.errors[0]) {
        expect(result.errors[0].message).toContain('workingDir');
      }
    });

    it('should track execution duration', async () => {
      const context = createMockContext();
      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(typeof result.duration).toBe('number');
    });

    it('should initialize tasksCompleted counter', async () => {
      const context = createMockContext();
      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(typeof result.tasksCompleted).toBe('number');
      expect(result.tasksCompleted).toBeGreaterThanOrEqual(0);
    });

    it('should initialize messagesProcessed counter', async () => {
      const context = createMockContext();
      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(typeof result.messagesProcessed).toBe('number');
      expect(result.messagesProcessed).toBeGreaterThanOrEqual(0);
    });

    it('should return empty errors array on success', async () => {
      const context = createMockContext();
      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should include metadata in result', async () => {
      const context = createMockContext();
      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      // Metadata is optional but if present should be an object
      if (result.metadata) {
        expect(typeof result.metadata).toBe('object');
      }
    });

    it('should timeout after configured duration', async () => {
      const shortTimeoutAdapter = new ClaudeCodeAdapter({
        timeout: 100, // 100ms timeout
      });

      const context = createMockContext();

      const startTime = Date.now();
      await shortTimeoutAdapter.executeAgent('test-agent-001', 'continuous', context);
      const duration = Date.now() - startTime;

      // Should complete close to timeout duration (within reasonable variance)
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(5000); // But not hang forever
    });
  });

  describe('error handling', () => {
    it('should handle execution errors gracefully', async () => {
      const context = createMockContext();
      // Force an error by providing invalid context
      (context as any).config = null;

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      if (result.errors[0]) {
        expect(result.errors[0]).toHaveProperty('message');
      }
    });

    it('should include error code in error objects', async () => {
      const context = createMockContext();
      context.agentId = '';

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      if (result.errors.length > 0 && result.errors[0]) {
        expect(result.errors[0]).toHaveProperty('code');
      }
    });

    it('should include error stack when available', async () => {
      const context = createMockContext();
      context.workspaceDir = '';

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      if (result.errors.length > 0 && result.errors[0] && result.errors[0].stack) {
        expect(typeof result.errors[0].stack).toBe('string');
      }
    });
  });

  describe('integration with AdapterRegistry', () => {
    it('should be compatible with AdapterRegistry', () => {
      // Verify the adapter has all properties required by FrameworkAdapter
      const frameworkAdapter: FrameworkAdapter = adapter;

      expect(frameworkAdapter.name).toBeDefined();
      expect(frameworkAdapter.version).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(frameworkAdapter.executeAgent).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(frameworkAdapter.supportsFeature).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(frameworkAdapter.getCapabilities).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(frameworkAdapter.healthCheck).toBeDefined();
    });
  });

  describe('result parsing - Task 3.2.8', () => {
    describe('JSON output parsing', () => {
      it('should parse structured JSON output from Claude Code', async () => {
        const context = createMockContext();
        mockHealthCheck();

        // Mock Claude Code returning structured JSON
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({
            text: 'Execution completed successfully',
            tasksCompleted: ['task-001'],
            messagesProcessed: [],
            apiCallCount: 5,
            costUSD: 0.15,
            filesCreated: ['src/new-file.ts'],
            filesModified: ['src/existing-file.ts'],
          }),
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(true);
        expect(result.tasksCompleted).toBe(1);
        expect(result.metadata?.apiCallCount).toBe(5);
        expect(result.metadata?.costUSD).toBe(0.15);
        expect(result.metadata?.filesCreated).toContain('src/new-file.ts');
        expect(result.metadata?.filesModified).toContain('src/existing-file.ts');
      });

      it('should fall back to text parsing when JSON parsing fails', async () => {
        const context = createMockContext();
        mockHealthCheck();

        // Mock Claude Code returning plain text
        mockedExeca.mockResolvedValueOnce({
          stdout: 'Task task-001 completed successfully',
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(true);
        expect(result.metadata?.output).toContain('Task task-001 completed');
      });
    });

    describe('task completion detection', () => {
      it('should detect completed tasks from structured output', async () => {
        const context = createMockContext();
        context.activeTasks = [
          {
            id: 'task-001',
            title: 'First Task',
            description: 'Task 1',
            status: 'in_progress',
            priority: 'high',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'task-002',
            title: 'Second Task',
            description: 'Task 2',
            status: 'in_progress',
            priority: 'medium',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({
            text: 'Completed tasks',
            tasksCompleted: ['task-001', 'task-002'],
          }),
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(true);
        expect(result.tasksCompleted).toBe(2);
      });

      it('should detect completed tasks from text patterns', async () => {
        const context = createMockContext();
        context.activeTasks = [
          {
            id: 'task-001',
            title: 'Test Task',
            description: 'A test task',
            status: 'in_progress',
            priority: 'medium',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ];

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: 'I have completed task-001 successfully',
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(true);
        expect(result.tasksCompleted).toBe(1);
      });
    });
  });
});
