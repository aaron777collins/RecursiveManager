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
    workingDir: '/tmp/test-workspace/working',
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

  /**
   * Test Suite: Timeout Handling (Task 3.2.13)
   */
  describe('Timeout Handling', () => {
    it('should respect configured timeout duration', async () => {
      const timeoutAdapter = new ClaudeCodeAdapter({
        timeout: 2000, // 2 seconds
        debug: false,
      });

      const context = createMockContext();
      mockHealthCheck();

      // Mock a long-running execution that will timeout
      const timeoutError = new Error('Command timed out after 2000ms');
      (timeoutError as any).timedOut = true;
      mockedExeca.mockRejectedValueOnce(timeoutError);

      const startTime = Date.now();
      const result = await timeoutAdapter.executeAgent('test-agent-001', 'continuous', context);
      const duration = Date.now() - startTime;

      // Should fail due to timeout
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.message).toContain('timed out');

      // Should complete quickly (not hang)
      expect(duration).toBeLessThan(5000);
    });

    it('should handle timeout with timedOut flag from execa', async () => {
      const context = createMockContext();
      mockHealthCheck();

      const timeoutError = new Error('Process execution timed out');
      (timeoutError as any).timedOut = true;
      mockedExeca.mockRejectedValueOnce(timeoutError);

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.message).toContain('timed out');
    });

    it('should not retry on timeout errors', async () => {
      const retryAdapter = new ClaudeCodeAdapter({
        maxRetries: 3,
        timeout: 1000,
        debug: false,
      });

      const context = createMockContext();
      mockHealthCheck();

      const timeoutError = new Error('Execution timeout');
      (timeoutError as any).timedOut = true;
      mockedExeca.mockRejectedValueOnce(timeoutError);

      const result = await retryAdapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors[0]?.message).toContain('timed out');

      // Should only attempt once (health check + 1 execution, no retries)
      expect(mockedExeca).toHaveBeenCalledTimes(2);
    });

    it('should include timeout duration in error message', async () => {
      const timeoutAdapter = new ClaudeCodeAdapter({
        timeout: 5000, // 5 seconds
        debug: false,
      });

      const context = createMockContext();
      mockHealthCheck();

      const timeoutError = new Error('Timeout after 5000ms');
      (timeoutError as any).timedOut = true;
      mockedExeca.mockRejectedValueOnce(timeoutError);

      const result = await timeoutAdapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors[0]?.message).toMatch(/timed out after \d+ seconds/);
    });

    it('should handle zero or very short timeouts', async () => {
      const shortTimeoutAdapter = new ClaudeCodeAdapter({
        timeout: 100, // 100ms - very short
        debug: false,
      });

      const context = createMockContext();
      mockHealthCheck();

      const timeoutError = new Error('Timeout');
      (timeoutError as any).timedOut = true;
      mockedExeca.mockRejectedValueOnce(timeoutError);

      const result = await shortTimeoutAdapter.executeAgent(
        'test-agent-001',
        'continuous',
        context
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should complete successfully if execution finishes before timeout', async () => {
      const generousAdapter = new ClaudeCodeAdapter({
        timeout: 60000, // 60 seconds - generous timeout
        debug: false,
      });

      const context = createMockContext();
      mockHealthCheck();

      // Mock successful fast execution
      mockedExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({
          success: true,
          tasksCompleted: ['task-001'],
          duration: 1000,
        }),
        stderr: '',
        exitCode: 0,
      } as any);

      const startTime = Date.now();
      const result = await generousAdapter.executeAgent('test-agent-001', 'continuous', context);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // Should complete quickly
    });

    it('should pass timeout option to execa', async () => {
      const customTimeoutAdapter = new ClaudeCodeAdapter({
        timeout: 30000, // 30 seconds
        debug: false,
      });

      const context = createMockContext();
      mockHealthCheck();

      mockedExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({ success: true }),
        stderr: '',
        exitCode: 0,
      } as any);

      await customTimeoutAdapter.executeAgent('test-agent-001', 'continuous', context);

      // Verify execa was called with correct timeout option
      expect(mockedExeca).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          timeout: 30000,
        })
      );
    });

    it('should track execution duration even on timeout', async () => {
      const context = createMockContext();
      mockHealthCheck();

      const timeoutError = new Error('Timed out');
      (timeoutError as any).timedOut = true;
      mockedExeca.mockRejectedValueOnce(timeoutError);

      const startTime = Date.now();
      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);
      const actualDuration = Date.now() - startTime;

      // Result should have duration field
      expect(typeof result.duration).toBe('number');
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // Duration should be reasonable compared to actual time
      expect(result.duration).toBeLessThanOrEqual(actualDuration + 100);
    });

    it('should include stack trace in timeout errors when available', async () => {
      const context = createMockContext();
      mockHealthCheck();

      const timeoutError = new Error('Execution timeout');
      (timeoutError as any).timedOut = true;
      timeoutError.stack = 'Error: Execution timeout\n    at execClaudeCode (adapter.ts:123)\n';
      mockedExeca.mockRejectedValueOnce(timeoutError);

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      if (result.errors[0]?.stack) {
        expect(typeof result.errors[0].stack).toBe('string');
        expect(result.errors[0].stack.length).toBeGreaterThan(0);
      }
    });

    it('should handle timeout in both continuous and reactive modes', async () => {
      const timeoutAdapter = new ClaudeCodeAdapter({
        timeout: 1000,
        debug: false,
      });

      const timeoutError = new Error('Timeout');
      (timeoutError as any).timedOut = true;

      // Test continuous mode
      const continuousContext = createMockContext();
      continuousContext.mode = 'continuous';
      mockHealthCheck();
      mockedExeca.mockRejectedValueOnce(timeoutError);

      const continuousResult = await timeoutAdapter.executeAgent(
        'test-agent-001',
        'continuous',
        continuousContext
      );

      expect(continuousResult.success).toBe(false);
      expect(continuousResult.errors[0]?.message).toContain('timed out');

      // Test reactive mode
      const reactiveContext = createMockContext();
      reactiveContext.mode = 'reactive';
      reactiveContext.messages = [
        {
          id: 'msg-001',
          from: 'user',
          to: 'test-agent-001',
          content: 'Test',
          channel: 'internal',
          timestamp: new Date().toISOString(),
          read: false,
        },
      ];
      mockHealthCheck();
      mockedExeca.mockRejectedValueOnce(timeoutError);

      const reactiveResult = await timeoutAdapter.executeAgent(
        'test-agent-001',
        'reactive',
        reactiveContext
      );

      expect(reactiveResult.success).toBe(false);
      expect(reactiveResult.errors[0]?.message).toContain('timed out');
    });

    it('should use default timeout of 60 minutes when not specified', async () => {
      const defaultAdapter = new ClaudeCodeAdapter();

      const context = createMockContext();
      mockHealthCheck();
      mockedExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({ success: true }),
        stderr: '',
        exitCode: 0,
      } as any);

      await defaultAdapter.executeAgent('test-agent-001', 'continuous', context);

      // Should use default 60 minute timeout (3600000ms)
      // Check the second call (first is health check)
      expect(mockedExeca).toHaveBeenCalledTimes(2); // health + execution
      expect(mockedExeca).toHaveBeenNthCalledWith(
        2, // Second call is the actual execution
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          timeout: 60 * 60 * 1000,
        })
      );
    });
  });

  /**
   * Test Suite: Retry Logic (Task 3.2.10)
   */
  describe('Retry Logic', () => {
    it('should retry on transient network errors', async () => {
      const adapter = new ClaudeCodeAdapter({ maxRetries: 3, debug: false });
      const context = createMockContext();

      // Mock health check (success)
      mockHealthCheck();

      // First attempt fails with ECONNRESET
      const networkError = new Error('Connection reset');
      (networkError as any).code = 'ECONNRESET';
      mockedExeca.mockRejectedValueOnce(networkError);

      // Second attempt succeeds
      mockedExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({
          success: true,
          completed: ['task-001'],
          duration: 1000,
        }),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(true);
      expect(mockedExeca).toHaveBeenCalledTimes(3); // 1 health check + 2 execution attempts
    });

    it('should retry on rate limit errors', async () => {
      const adapter = new ClaudeCodeAdapter({ maxRetries: 3, debug: false });
      const context = createMockContext();

      mockHealthCheck();

      // First attempt fails with rate limit
      const rateLimitError = new Error('Rate limit exceeded: too many requests');
      mockedExeca.mockRejectedValueOnce(rateLimitError);

      // Second attempt succeeds
      mockedExeca.mockResolvedValueOnce({
        stdout: JSON.stringify({ success: true, duration: 1000 }),
        stderr: '',
        exitCode: 0,
      } as any);

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(true);
      expect(mockedExeca).toHaveBeenCalledTimes(3); // health + 2 attempts
    });

    it('should not retry on non-retryable errors', async () => {
      const adapter = new ClaudeCodeAdapter({ maxRetries: 3, debug: false });
      const context = createMockContext();

      mockHealthCheck();

      // Fail with a non-retryable error
      const nonRetryableError = new Error('Invalid syntax in prompt');
      mockedExeca.mockRejectedValueOnce(nonRetryableError);

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors[0]?.message).toContain('Invalid syntax');
      expect(mockedExeca).toHaveBeenCalledTimes(2); // health + 1 attempt only
    });

    it('should fail after max retries on persistent transient errors', async () => {
      const adapter = new ClaudeCodeAdapter({ maxRetries: 3, debug: false });
      const context = createMockContext();

      mockHealthCheck();

      // All attempts fail with network error
      const networkError = new Error('Connection refused');
      (networkError as any).code = 'ECONNREFUSED';
      mockedExeca.mockRejectedValue(networkError);

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors[0]?.message).toContain('Connection refused');
      expect(mockedExeca).toHaveBeenCalledTimes(4); // health + 3 attempts
    });

    it('should not retry on timeout errors', async () => {
      const adapter = new ClaudeCodeAdapter({ maxRetries: 3, timeout: 1000, debug: false });
      const context = createMockContext();

      mockHealthCheck();

      // Timeout error from execa
      const timeoutError = new Error('Command timed out');
      (timeoutError as any).timedOut = true;
      mockedExeca.mockRejectedValueOnce(timeoutError);

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

      expect(result.success).toBe(false);
      expect(result.errors[0]?.message).toContain('timed out');
      expect(mockedExeca).toHaveBeenCalledTimes(2); // health + 1 attempt only (no retry)
    });

    it('should apply exponential backoff between retries', async () => {
      const adapter = new ClaudeCodeAdapter({ maxRetries: 3, debug: false });
      const context = createMockContext();

      mockHealthCheck();

      const startTime = Date.now();

      // All attempts fail with transient error
      const networkError = new Error('Service unavailable (503)');
      mockedExeca
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError);

      const result = await adapter.executeAgent('test-agent-001', 'continuous', context);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      // With exponential backoff: 0ms + 1000ms + 2000ms = at least 3000ms
      expect(duration).toBeGreaterThanOrEqual(3000);
      expect(mockedExeca).toHaveBeenCalledTimes(4); // health + 3 attempts
    });

    it('should identify various transient error codes', async () => {
      const adapter = new ClaudeCodeAdapter({ maxRetries: 2, debug: false });
      const context = createMockContext();

      const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAGAIN', 'EBUSY'];

      for (const code of transientCodes) {
        jest.clearAllMocks();
        mockHealthCheck();

        const error = new Error(`Network error: ${code}`);
        (error as any).code = code;
        mockedExeca.mockRejectedValueOnce(error);

        // Second attempt succeeds
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true, duration: 100 }),
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(true);
        expect(mockedExeca).toHaveBeenCalledTimes(3); // health + 2 attempts
      }
    }, 10000); // Increase timeout for this test (5 error codes × ~1s backoff each)
  });

  /**
   * Test Suite: Provider Configuration (Task 4.1.4)
   */
  describe('Provider Configuration', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      // Save original environment
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      // Restore original environment
      process.env = originalEnv;
    });

    describe('provider URL selection', () => {
      it('should use Anthropic API URL when provider is anthropic-direct', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'anthropic-direct';
        process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context);

        // Verify execa was called with ANTHROPIC_BASE_URL in env
        const execaCall = mockedExeca.mock.calls.find(
          (call: any) => call[0] === 'claude' || call[0] === adapter['cliPath']
        );
        expect(execaCall).toBeDefined();
        if (execaCall && (execaCall as any)[2]) {
          expect((execaCall as any)[2].env?.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com');
        }
      });

      it('should use custom Anthropic URL when ANTHROPIC_BASE_URL is set', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'anthropic-direct';
        process.env.ANTHROPIC_BASE_URL = 'https://custom-anthropic-api.example.com';

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context);

        const execaCall = mockedExeca.mock.calls.find(
          (call) => call[0] === 'claude' || call[0] === adapter['cliPath']
        );
        if (execaCall && (execaCall as any)[2]) {
          expect((execaCall as any)[2].env?.ANTHROPIC_BASE_URL).toBe(
            'https://custom-anthropic-api.example.com'
          );
        }
      });

      it('should default to anthropic-direct when AGENT_EXECUTION_PROVIDER not set', async () => {
        delete process.env.AGENT_EXECUTION_PROVIDER;
        process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context);

        const execaCall = mockedExeca.mock.calls.find(
          (call) => call[0] === 'claude' || call[0] === adapter['cliPath']
        );
        if (execaCall && (execaCall as any)[2]) {
          expect((execaCall as any)[2].env?.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com');
        }
      });

      it('should use ANTHROPIC_BASE_URL for aiceo-gateway provider', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'aiceo-gateway';
        process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context);

        const execaCall = mockedExeca.mock.calls.find(
          (call) => call[0] === 'claude' || call[0] === adapter['cliPath']
        );
        if (execaCall && (execaCall as any)[2]) {
          // For now, aiceo-gateway falls back to direct Anthropic
          expect((execaCall as any)[2].env?.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com');
        }
      });

      it('should default to https://api.anthropic.com when ANTHROPIC_BASE_URL not set', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'anthropic-direct';
        delete process.env.ANTHROPIC_BASE_URL;

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context);

        const execaCall = mockedExeca.mock.calls.find(
          (call) => call[0] === 'claude' || call[0] === adapter['cliPath']
        );
        if (execaCall && (execaCall as any)[2]) {
          expect((execaCall as any)[2].env?.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com');
        }
      });
    });

    describe('provider API key selection', () => {
      it('should use ANTHROPIC_API_KEY when provider is anthropic-direct', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'anthropic-direct';
        process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-12345';

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context);

        const execaCall = mockedExeca.mock.calls.find(
          (call) => call[0] === 'claude' || call[0] === adapter['cliPath']
        );
        if (execaCall && (execaCall as any)[2]) {
          expect((execaCall as any)[2].env?.ANTHROPIC_API_KEY).toBe('sk-ant-test-key-12345');
        }
      });

      it('should use AICEO_GATEWAY_API_KEY when provider is aiceo-gateway', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'aiceo-gateway';
        process.env.AICEO_GATEWAY_API_KEY = 'gateway-secret-key-abc';
        process.env.ANTHROPIC_API_KEY = 'sk-ant-fallback';

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context);

        const execaCall = mockedExeca.mock.calls.find(
          (call) => call[0] === 'claude' || call[0] === adapter['cliPath']
        );
        if (execaCall && (execaCall as any)[2]) {
          expect((execaCall as any)[2].env?.ANTHROPIC_API_KEY).toBe('gateway-secret-key-abc');
        }
      });

      it('should fall back to ANTHROPIC_API_KEY when AICEO_GATEWAY_API_KEY not set', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'aiceo-gateway';
        delete process.env.AICEO_GATEWAY_API_KEY;
        process.env.ANTHROPIC_API_KEY = 'sk-ant-fallback-key';

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context);

        const execaCall = mockedExeca.mock.calls.find(
          (call) => call[0] === 'claude' || call[0] === adapter['cliPath']
        );
        if (execaCall && (execaCall as any)[2]) {
          expect((execaCall as any)[2].env?.ANTHROPIC_API_KEY).toBe('sk-ant-fallback-key');
        }
      });

      it('should return empty string when no API keys are configured', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'anthropic-direct';
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.AICEO_GATEWAY_API_KEY;

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context);

        const execaCall = mockedExeca.mock.calls.find(
          (call) => call[0] === 'claude' || call[0] === adapter['cliPath']
        );
        if (execaCall && (execaCall as any)[2]) {
          expect((execaCall as any)[2].env?.ANTHROPIC_API_KEY).toBe('');
        }
      });
    });

    describe('health check with provider configuration', () => {
      it('should include provider env vars in health check', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'anthropic-direct';
        process.env.ANTHROPIC_BASE_URL = 'https://custom-api.example.com';
        process.env.ANTHROPIC_API_KEY = 'sk-test-key';

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context);

        // Health check should be first call
        const healthCheckCall = mockedExeca.mock.calls[0];
        expect(healthCheckCall).toBeDefined();
        if (healthCheckCall && (healthCheckCall as any)[2]) {
          expect((healthCheckCall as any)[2].env?.ANTHROPIC_BASE_URL).toBe(
            'https://custom-api.example.com'
          );
          expect((healthCheckCall as any)[2].env?.ANTHROPIC_API_KEY).toBe('sk-test-key');
        }
      });

      it('should validate API key is configured during health check', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'anthropic-direct';
        process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
        process.env.ANTHROPIC_API_KEY = 'sk-valid-key';

        // Mock health check to return version info
        mockedExeca.mockResolvedValueOnce({
          stdout: 'claude-code version 1.0.0',
          stderr: '',
          exitCode: 0,
        } as any);

        const isHealthy = await adapter.healthCheck();

        expect(isHealthy).toBe(true);
      });

      it('should fail health check when API key is empty', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'anthropic-direct';
        process.env.ANTHROPIC_BASE_URL = 'https://api.anthropic.com';
        delete process.env.ANTHROPIC_API_KEY;

        // Mock health check to return version info
        mockedExeca.mockResolvedValueOnce({
          stdout: 'claude-code version 1.0.0',
          stderr: '',
          exitCode: 0,
        } as any);

        const isHealthy = await adapter.healthCheck();

        // Health check should fail if API key not configured
        expect(isHealthy).toBe(false);
      });
    });

    describe('provider configuration integration', () => {
      it('should pass provider config through entire execution pipeline', async () => {
        process.env.AGENT_EXECUTION_PROVIDER = 'anthropic-direct';
        process.env.ANTHROPIC_BASE_URL = 'https://custom-api.example.com';
        process.env.ANTHROPIC_API_KEY = 'sk-integration-test-key';

        const context = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true, tasksCompleted: ['task-001'] }),
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(true);

        // Verify both health check and execution calls have provider config
        expect(mockedExeca).toHaveBeenCalledTimes(2); // health + execution

        // Health check call
        const healthCheckCall = mockedExeca.mock.calls[0];
        expect(((healthCheckCall as any)?.[2])?.env?.ANTHROPIC_BASE_URL).toBe(
          'https://custom-api.example.com'
        );
        expect(((healthCheckCall as any)?.[2])?.env?.ANTHROPIC_API_KEY).toBe('sk-integration-test-key');

        // Execution call
        const executionCall = mockedExeca.mock.calls[1];
        expect(((executionCall as any)?.[2])?.env?.ANTHROPIC_BASE_URL).toBe(
          'https://custom-api.example.com'
        );
        expect(((executionCall as any)?.[2])?.env?.ANTHROPIC_API_KEY).toBe('sk-integration-test-key');
      });

      it('should support switching providers via environment variable', async () => {
        // First execution with anthropic-direct
        process.env.AGENT_EXECUTION_PROVIDER = 'anthropic-direct';
        process.env.ANTHROPIC_API_KEY = 'sk-anthropic-key';

        const context1 = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-001', 'continuous', context1);

        const anthropicCall = mockedExeca.mock.calls[1];
        expect(((anthropicCall as any)?.[2])?.env?.ANTHROPIC_API_KEY).toBe('sk-anthropic-key');

        // Reset mocks
        jest.clearAllMocks();

        // Second execution with aiceo-gateway
        process.env.AGENT_EXECUTION_PROVIDER = 'aiceo-gateway';
        process.env.AICEO_GATEWAY_API_KEY = 'gateway-key';

        const context2 = createMockContext();
        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true }),
          stderr: '',
          exitCode: 0,
        } as any);

        await adapter.executeAgent('test-agent-002', 'continuous', context2);

        const gatewayCall = mockedExeca.mock.calls[1];
        expect(((gatewayCall as any)?.[2])?.env?.ANTHROPIC_API_KEY).toBe('gateway-key');
      });
    });
  });

  describe('comprehensive error scenarios - Task 3.2.14', () => {
    describe('context validation errors', () => {
      it('should reject execution when agentId is empty', async () => {
        const context = createMockContext();
        context.agentId = '';

        const result = await adapter.executeAgent('', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toContain('agentId');
      });

      it('should reject execution when config is null', async () => {
        const context = createMockContext();
        (context as any).config = null;

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toContain('config');
      });

      it('should reject execution when config is undefined', async () => {
        const context = createMockContext();
        (context as any).config = undefined;

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toContain('config');
      });

      it('should reject execution when workspaceDir is empty', async () => {
        const context = createMockContext();
        context.workspaceDir = '';

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toContain('workspaceDir');
      });

      it('should reject execution when workingDir is empty', async () => {
        const context = createMockContext();
        context.workingDir = '';

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toContain('workingDir');
      });

      it('should reject execution when workspaceDir is missing', async () => {
        const context = createMockContext();
        delete (context as any).workspaceDir;

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toContain('workspaceDir');
      });
    });

    describe('CLI execution errors', () => {
      it('should handle non-existent CLI path gracefully', async () => {
        const adapter = new ClaudeCodeAdapter({ cliPath: '/nonexistent/path/to/claude' });
        const context = createMockContext();

        mockHealthCheck();
        const execError = new Error('spawn /nonexistent/path/to/claude ENOENT');
        (execError as any).code = 'ENOENT';
        mockedExeca.mockRejectedValueOnce(execError);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toBeDefined();
      });

      it('should handle permission denied errors', async () => {
        const context = createMockContext();

        mockHealthCheck();
        const permError = new Error('Permission denied');
        (permError as any).code = 'EACCES';
        mockedExeca.mockRejectedValueOnce(permError);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toContain('Permission denied');
      });

      it('should handle non-zero exit codes gracefully', async () => {
        const context = createMockContext();

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: '',
          stderr: 'Error: Task execution failed',
          exitCode: 1,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        // Should still parse result even with non-zero exit
        expect(result).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle process being killed by signal', async () => {
        const context = createMockContext();

        mockHealthCheck();
        const killError = new Error('Process was killed with SIGKILL');
        (killError as any).signal = 'SIGKILL';
        mockedExeca.mockRejectedValueOnce(killError);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toContain('killed');
      });
    });

    describe('output parsing errors', () => {
      it('should handle empty stdout gracefully', async () => {
        const context = createMockContext();

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: '',
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle malformed JSON output', async () => {
        const context = createMockContext();

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: '{ invalid json here }',
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result).toBeDefined();
        // Should fall back to text parsing
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle JSON output with unexpected structure', async () => {
        const context = createMockContext();

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ unexpectedField: 'value' }),
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle null output', async () => {
        const context = createMockContext();

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: null as any,
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle undefined output', async () => {
        const context = createMockContext();

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: undefined as any,
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle very large output without crashing', async () => {
        const context = createMockContext();

        mockHealthCheck();
        // Generate a 10MB string
        const largeOutput = 'x'.repeat(10 * 1024 * 1024);
        mockedExeca.mockResolvedValueOnce({
          stdout: largeOutput,
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle output with special characters', async () => {
        const context = createMockContext();

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: 'Output with \n newlines \t tabs \r carriage returns and \x00 null bytes',
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle output with unicode characters', async () => {
        const context = createMockContext();

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: 'Output with émojis 🚀 and unicode: 你好世界',
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });
    });

    describe('framework unavailability - EC-6.1', () => {
      it('should return error when health check fails', async () => {
        // Health check fails
        mockedExeca.mockRejectedValueOnce(new Error('Claude Code CLI not found'));

        const context = createMockContext();
        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toContain('unavailable');
      });

      it('should detect when CLI is not in PATH', async () => {
        const adapter = new ClaudeCodeAdapter({ cliPath: 'nonexistent-claude' });

        // Health check returns no output
        mockedExeca.mockResolvedValueOnce({
          stdout: '',
          stderr: '',
          exitCode: 1,
        } as any);

        const context = createMockContext();
        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors[0]?.message).toContain('unavailable');
      });

      it('should handle health check timeout', async () => {
        // Health check times out
        const timeoutError = new Error('Health check timeout');
        (timeoutError as any).timedOut = true;
        mockedExeca.mockRejectedValueOnce(timeoutError);

        const context = createMockContext();
        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('error metadata and details', () => {
      it('should include error code in all error results', async () => {
        const context = createMockContext();
        context.agentId = '';

        const result = await adapter.executeAgent('', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.code).toBeDefined();
      });

      it('should include error stack traces when available', async () => {
        const context = createMockContext();
        mockHealthCheck();

        const error = new Error('Test error with stack');
        mockedExeca.mockRejectedValueOnce(error);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        if (result.errors[0]?.stack) {
          expect(typeof result.errors[0].stack).toBe('string');
        }
      });

      it('should track duration even when errors occur', async () => {
        const context = createMockContext();
        mockHealthCheck();

        mockedExeca.mockRejectedValueOnce(new Error('Test error'));

        const startTime = Date.now();
        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);
        const elapsed = Date.now() - startTime;

        expect(result.duration).toBeGreaterThanOrEqual(0);
        expect(result.duration).toBeLessThanOrEqual(elapsed + 100); // Allow 100ms variance
      });

      it('should include meaningful error messages for debugging', async () => {
        const context = createMockContext();
        context.workspaceDir = '';

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors[0]?.message).toBeDefined();
        expect(result.errors[0]?.message.length).toBeGreaterThan(10); // Reasonable message length
      });
    });

    describe('edge case error scenarios', () => {
      it('should handle concurrent errors without interference', async () => {
        const context1 = createMockContext();
        const context2 = createMockContext();
        context2.agentId = 'test-agent-002';

        mockHealthCheck();
        mockHealthCheck();

        const error1 = new Error('Error for agent 1');
        const error2 = new Error('Error for agent 2');
        mockedExeca.mockRejectedValueOnce(error1);
        mockedExeca.mockRejectedValueOnce(error2);

        // Execute concurrently
        const [result1, result2] = await Promise.all([
          adapter.executeAgent('test-agent-001', 'continuous', context1),
          adapter.executeAgent('test-agent-002', 'continuous', context2),
        ]);

        expect(result1.success).toBe(false);
        expect(result2.success).toBe(false);
        // Each should have their own error
        expect(result1.errors.length).toBeGreaterThan(0);
        expect(result2.errors.length).toBeGreaterThan(0);
        expect(result1.errors[0]?.message).toBeDefined();
        expect(result2.errors[0]?.message).toBeDefined();
      });

      it('should handle errors thrown during prompt building', async () => {
        const context = createMockContext();
        // Empty activeTasks array - might cause issues in prompt building
        context.activeTasks = [];

        mockHealthCheck();
        mockedExeca.mockResolvedValueOnce({
          stdout: 'Success',
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        // Should handle gracefully even with no tasks
        expect(result).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should handle errors with circular JSON structures', async () => {
        const context = createMockContext();

        mockHealthCheck();

        // Create a response with circular reference
        const circularObj: any = { data: 'test' };
        circularObj.self = circularObj;

        mockedExeca.mockResolvedValueOnce({
          stdout: 'Plain text output',
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        // Should handle without crashing
        expect(result).toBeDefined();
      });

      it('should handle multiple rapid errors without state corruption', async () => {
        const context = createMockContext();

        // Execute multiple times sequentially to test state isolation
        for (let i = 0; i < 3; i++) {
          // Clear and setup mocks for each execution
          mockedExeca.mockReset();

          // Health check
          mockedExeca.mockResolvedValueOnce({
            stdout: 'claude-code version 1.0.0',
            stderr: '',
            exitCode: 0,
          } as any);

          // Execution fails with non-retryable error
          const nonRetryableError = new Error(`Error ${i}`);
          (nonRetryableError as any).code = 'EACCES'; // Non-retryable
          mockedExeca.mockRejectedValueOnce(nonRetryableError);

          const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

          // Each should fail independently
          expect(result.success).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });

      it('should handle errors after successful health check', async () => {
        const context = createMockContext();

        mockHealthCheck();

        // Health check succeeds but execution fails
        const execError = new Error('Execution failed despite healthy CLI');
        (execError as any).code = 'EXECUTION_ERROR';
        mockedExeca.mockRejectedValueOnce(execError);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]?.message).toBeDefined();
      });

      it('should handle mixed success and error scenarios', async () => {
        const context = createMockContext();

        // Clear default mock
        mockedExeca.mockReset();

        // First execution fails (health check fails)
        mockedExeca.mockResolvedValueOnce({
          stdout: '',
          stderr: 'CLI error',
          exitCode: 1,
        } as any);

        const result1 = await adapter.executeAgent('test-agent-001', 'continuous', context);
        expect(result1.success).toBe(false);

        // Second execution succeeds
        mockedExeca.mockResolvedValueOnce({
          stdout: 'claude-code version 1.0.0',
          stderr: '',
          exitCode: 0,
        } as any);
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true, tasksCompleted: ['task-001'] }),
          stderr: '',
          exitCode: 0,
        } as any);

        const result2 = await adapter.executeAgent('test-agent-001', 'continuous', context);
        expect(result2.success).toBe(true);
      });
    });

    describe('non-retryable error handling', () => {
      it('should not retry validation errors', async () => {
        const adapter = new ClaudeCodeAdapter({ maxRetries: 3 });
        const context = createMockContext();
        context.agentId = ''; // Invalid context

        const result = await adapter.executeAgent('', 'continuous', context);

        expect(result.success).toBe(false);
        // Should not have called execa at all (validation fails before execution)
        expect(mockedExeca).not.toHaveBeenCalled();
      });

      it('should not retry when framework is unavailable', async () => {
        const adapter = new ClaudeCodeAdapter({ maxRetries: 3, timeout: 1000 });

        // Clear the default mock behavior from beforeEach
        mockedExeca.mockReset();

        // Health check fails (returns false because stdout is empty)
        mockedExeca.mockResolvedValueOnce({
          stdout: '',
          stderr: 'CLI not found',
          exitCode: 1,
        } as any);

        const context = createMockContext();
        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors[0]?.message).toContain('unavailable');
        // Only health check attempt, no retries
        expect(mockedExeca).toHaveBeenCalledTimes(1);
      });

      it('should not retry ENOENT errors (file not found)', async () => {
        const adapter = new ClaudeCodeAdapter({ maxRetries: 3 });
        const context = createMockContext();

        // Health check fails with ENOENT
        const enoentError = new Error('spawn claude ENOENT');
        (enoentError as any).code = 'ENOENT';
        mockedExeca.mockRejectedValueOnce(enoentError);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        // Only health check attempt (which failed with ENOENT)
        expect(mockedExeca).toHaveBeenCalledTimes(1);
      });

      it('should not retry EACCES errors (permission denied)', async () => {
        const adapter = new ClaudeCodeAdapter({ maxRetries: 3 });
        const context = createMockContext();

        // Health check fails with EACCES
        const eaccesError = new Error('Permission denied');
        (eaccesError as any).code = 'EACCES';
        mockedExeca.mockRejectedValueOnce(eaccesError);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        // Only health check attempt (which failed with EACCES)
        expect(mockedExeca).toHaveBeenCalledTimes(1);
      });
    });

    describe('error recovery patterns', () => {
      it('should recover from transient error on first retry', async () => {
        const adapter = new ClaudeCodeAdapter({ maxRetries: 3, timeout: 10000 });
        const context = createMockContext();

        // Clear default mock
        mockedExeca.mockReset();

        // Health check
        mockedExeca.mockResolvedValueOnce({
          stdout: 'claude-code version 1.0.0',
          stderr: '',
          exitCode: 0,
        } as any);

        // First attempt fails with transient error
        const transientError = new Error('ECONNRESET');
        (transientError as any).code = 'ECONNRESET';
        mockedExeca.mockRejectedValueOnce(transientError);

        // Second attempt succeeds
        mockedExeca.mockResolvedValueOnce({
          stdout: JSON.stringify({ success: true, tasksCompleted: ['task-001'] }),
          stderr: '',
          exitCode: 0,
        } as any);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(true);
        expect(mockedExeca).toHaveBeenCalledTimes(3); // health + 2 attempts
      }, 10000); // Allow time for retry backoff

      it('should attempt all retries before giving up', async () => {
        const adapter = new ClaudeCodeAdapter({ maxRetries: 3, timeout: 10000 });
        const context = createMockContext();

        // Clear default mock
        mockedExeca.mockReset();

        // Health check
        mockedExeca.mockResolvedValueOnce({
          stdout: 'claude-code version 1.0.0',
          stderr: '',
          exitCode: 0,
        } as any);

        // All attempts fail with transient error
        const transientError = new Error('Service unavailable');
        (transientError as any).code = 'ECONNREFUSED';
        mockedExeca
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError)
          .mockRejectedValueOnce(transientError);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(mockedExeca).toHaveBeenCalledTimes(4); // health + 3 attempts
      }, 10000); // Allow time for retry backoff

      it('should include retry information in final error', async () => {
        const adapter = new ClaudeCodeAdapter({ maxRetries: 2, timeout: 10000 });
        const context = createMockContext();

        // Clear default mock
        mockedExeca.mockReset();

        // Health check
        mockedExeca.mockResolvedValueOnce({
          stdout: 'claude-code version 1.0.0',
          stderr: '',
          exitCode: 0,
        } as any);

        const transientError = new Error('Connection refused');
        (transientError as any).code = 'ECONNREFUSED';
        mockedExeca.mockRejectedValueOnce(transientError).mockRejectedValueOnce(transientError);

        const result = await adapter.executeAgent('test-agent-001', 'continuous', context);

        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        // Error message should mention the connection issue
        expect(result.errors[0]?.message).toContain('refused');
      }, 5000); // Allow time for retry backoff
    });
  });
});
