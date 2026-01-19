/**
 * Tests for Execution Context Preparation (Task 3.2.7)
 */

import * as fs from 'fs/promises';
import { Database } from 'better-sqlite3';
import { jest } from '@jest/globals';
import {
  loadExecutionContext,
  loadConfig,
  loadTasks,
  loadMessages,
  loadWorkspaceFiles,
  validateExecutionContext,
  ContextLoadError,
} from '../index';
import type { ExecutionContext } from '../../types';

// Mock dependencies
jest.mock('@recursive-manager/common', () => ({
  loadAgentConfig: jest.fn(),
  getActiveTasks: jest.fn(),
  getMessages: jest.fn(),
  getWorkspacePath: jest.fn(),
  getAgentDirectory: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readdir: jest.fn(),
}));

import {
  loadAgentConfig,
  getActiveTasks,
  getMessages,
  getWorkspacePath,
  getAgentDirectory,
} from '@recursive-manager/common';

// Typed mocks
const mockLoadAgentConfig = loadAgentConfig as jest.MockedFunction<typeof loadAgentConfig>;
const mockGetActiveTasks = getActiveTasks as jest.MockedFunction<typeof getActiveTasks>;
const mockGetMessages = getMessages as jest.MockedFunction<typeof getMessages>;
const mockGetWorkspacePath = getWorkspacePath as jest.MockedFunction<typeof getWorkspacePath>;
const mockGetAgentDirectory = getAgentDirectory as jest.MockedFunction<typeof getAgentDirectory>;
const mockFsAccess = fs.access as jest.MockedFunction<typeof fs.access>;
const mockFsReaddir = fs.readdir as jest.MockedFunction<typeof fs.readdir>;

describe('Execution Context Preparation', () => {
  let mockDb: Database;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.restoreAllMocks();

    // Create mock database
    mockDb = {} as Database;
  });

  describe('loadConfig', () => {
    it('should load agent configuration successfully', async () => {
      const mockConfig = {
        version: '1.0.0',
        identity: {
          id: 'test-agent',
          role: 'Developer',
          displayName: 'Test Agent',
          createdAt: '2025-01-19T00:00:00Z',
          createdBy: 'user',
          reportingTo: null,
        },
        goal: {
          mainGoal: 'Test goal',
          subGoals: [],
          successCriteria: [],
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          canFire: false,
          canEscalate: true,
          canAccessExternalAPIs: false,
          allowedDomains: [],
          workspaceQuotaMB: 1024,
          maxExecutionMinutes: 60,
        },
        framework: {
          primary: 'claude-code' as const,
          capabilities: ['code-generation'],
        },
        communication: {
          preferredChannels: ['internal' as const],
          notifyManager: {
            onTaskComplete: true,
            onError: true,
            onHire: true,
            onFire: true,
          },
          updateFrequency: 'daily' as const,
        },
        behavior: {
          multiPerspectiveAnalysis: {
            enabled: false,
            perspectives: [],
            triggerOn: [],
          },
          escalationPolicy: {
            autoEscalateAfterFailures: 3,
            escalateOnBlockedTask: true,
            escalateOnBudgetExceeded: true,
          },
          delegation: {
            delegateThreshold: 'non-trivial' as const,
            keepWhenDelegating: true,
            supervisionLevel: 'moderate' as const,
          },
        },
        metadata: {
          tags: [],
          priority: 'medium' as const,
        },
      };

      mockLoadAgentConfig.mockResolvedValue(mockConfig);

      const config = await loadConfig('test-agent');

      expect(config).toEqual(mockConfig);
      expect(loadAgentConfig).toHaveBeenCalledWith('test-agent', {});
    });

    it('should throw ContextLoadError on failure', async () => {
      mockLoadAgentConfig.mockRejectedValue(new Error('Config not found'));

      await expect(loadConfig('test-agent')).rejects.toThrow(ContextLoadError);
      await expect(loadConfig('test-agent')).rejects.toThrow('Failed to load agent configuration');
    });

    it('should pass options to loadAgentConfig', async () => {
      const mockConfig = {} as any;
      mockLoadAgentConfig.mockResolvedValue(mockConfig);

      await loadConfig('test-agent', { baseDir: '/custom/path' } as any);

      expect(loadAgentConfig).toHaveBeenCalledWith('test-agent', {
        baseDir: '/custom/path',
      });
    });
  });

  describe('loadTasks', () => {
    it('should load active tasks successfully', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          agent_id: 'test-agent',
          title: 'Test Task 1',
          status: 'in_progress' as const,
          priority: 'high' as const,
          created_at: '2025-01-19T00:00:00Z',
          started_at: '2025-01-19T01:00:00Z',
          completed_at: null,
          parent_task_id: null,
          depth: 0,
          percent_complete: 50,
          subtasks_completed: 0,
          subtasks_total: 0,
          delegated_to: null,
          delegated_at: null,
          blocked_by: null,
          blocked_since: null,
          task_path: 'Test Task 1',
          version: 1,
          last_updated: '2025-01-19T02:00:00Z',
          last_executed: null,
          execution_count: 0,
        },
        {
          id: 'task-2',
          agent_id: 'test-agent',
          title: 'Test Task 2',
          status: 'pending' as const,
          priority: 'medium' as const,
          created_at: '2025-01-19T00:00:00Z',
          started_at: null,
          completed_at: null,
          parent_task_id: 'task-1',
          depth: 1,
          percent_complete: 0,
          subtasks_completed: 0,
          subtasks_total: 0,
          delegated_to: 'subordinate-1',
          delegated_at: '2025-01-19T01:30:00Z',
          blocked_by: null,
          blocked_since: null,
          task_path: 'Test Task 1 / Test Task 2',
          version: 1,
          last_updated: '2025-01-19T01:30:00Z',
          last_executed: null,
          execution_count: 0,
        },
      ];

      mockGetActiveTasks.mockReturnValue(mockTasks);

      const tasks = await loadTasks(mockDb, 'test-agent');

      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toEqual({
        id: 'task-1',
        title: 'Test Task 1',
        description: '',
        status: 'in_progress',
        priority: 'high',
        parentTaskId: undefined,
        delegatedTo: undefined,
        createdAt: '2025-01-19T00:00:00Z',
        updatedAt: '2025-01-19T02:00:00Z',
      });
      expect(tasks[1]).toEqual({
        id: 'task-2',
        title: 'Test Task 2',
        description: '',
        status: 'pending',
        priority: 'medium',
        parentTaskId: 'task-1',
        delegatedTo: 'subordinate-1',
        createdAt: '2025-01-19T00:00:00Z',
        updatedAt: '2025-01-19T01:30:00Z',
      });
    });

    it('should throw ContextLoadError on failure', async () => {
      mockGetActiveTasks.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(loadTasks(mockDb, 'test-agent')).rejects.toThrow(ContextLoadError);
      await expect(loadTasks(mockDb, 'test-agent')).rejects.toThrow('Failed to load active tasks');
    });

    it('should handle empty task list', async () => {
      mockGetActiveTasks.mockReturnValue([]);

      const tasks = await loadTasks(mockDb, 'test-agent');

      expect(tasks).toEqual([]);
    });
  });

  describe('loadMessages', () => {
    it('should load unread messages successfully', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          from_agent_id: 'manager',
          to_agent_id: 'test-agent',
          timestamp: '2025-01-19T00:00:00Z',
          priority: 'normal',
          channel: 'internal',
          read: false,
          action_required: true,
          subject: 'Test Message 1',
          thread_id: null,
          in_reply_to: null,
          external_id: null,
          external_metadata: null,
          read_at: null,
          archived_at: null,
          message_path: '/path/to/msg-1.md',
          created_at: '2025-01-19T00:00:00Z',
        },
        {
          id: 'msg-2',
          from_agent_id: 'peer',
          to_agent_id: 'test-agent',
          timestamp: '2025-01-19T01:00:00Z',
          priority: 'high',
          channel: 'slack',
          read: false,
          action_required: false,
          subject: 'Test Message 2',
          thread_id: 'thread-1',
          in_reply_to: null,
          external_id: 'slack-123',
          external_metadata: '{"channel":"#dev"}',
          read_at: null,
          archived_at: null,
          message_path: '/path/to/msg-2.md',
          created_at: '2025-01-19T01:00:00Z',
        },
      ];

      mockGetMessages.mockReturnValue(mockMessages);

      const messages = await loadMessages(mockDb, 'test-agent');

      expect(messages).toHaveLength(2);
      expect(messages[0]).toEqual({
        id: 'msg-1',
        from: 'manager',
        to: 'test-agent',
        content: '',
        channel: 'internal',
        timestamp: '2025-01-19T00:00:00Z',
        read: false,
      });
      expect(getMessages).toHaveBeenCalledWith(mockDb, {
        agentId: 'test-agent',
        unreadOnly: true,
        limit: 50,
      });
    });

    it('should respect maxMessages option', async () => {
      mockGetMessages.mockReturnValue([]);

      await loadMessages(mockDb, 'test-agent', { maxMessages: 10 });

      expect(getMessages).toHaveBeenCalledWith(mockDb, {
        agentId: 'test-agent',
        unreadOnly: true,
        limit: 10,
      });
    });

    it('should throw ContextLoadError on failure', async () => {
      mockGetMessages.mockImplementation(() => {
        throw new Error('Database error');
      });

      await expect(loadMessages(mockDb, 'test-agent')).rejects.toThrow(ContextLoadError);
      await expect(loadMessages(mockDb, 'test-agent')).rejects.toThrow('Failed to load messages');
    });

    it('should handle empty message list', async () => {
      mockGetMessages.mockReturnValue([]);

      const messages = await loadMessages(mockDb, 'test-agent');

      expect(messages).toEqual([]);
    });
  });

  describe('loadWorkspaceFiles', () => {
    it('should enumerate workspace files successfully', async () => {
      const workspaceDir = '/test/workspace';
      mockGetWorkspacePath.mockReturnValue(workspaceDir);

      // Mock fs.access to succeed
      mockFsAccess.mockResolvedValue(undefined);

      // Mock fs.readdir to return test files
      mockFsReaddir.mockResolvedValue([
        { name: 'file1.ts', isFile: () => true, isDirectory: () => false },
        { name: 'file2.md', isFile: () => true, isDirectory: () => false },
        { name: 'subdir', isFile: () => false, isDirectory: () => true },
      ] as any);

      const files = await loadWorkspaceFiles('test-agent');

      expect(files.length).toBeGreaterThanOrEqual(0);
      expect(getWorkspacePath).toHaveBeenCalledWith('test-agent', {});
    });

    it('should handle missing workspace directory', async () => {
      mockGetWorkspacePath.mockReturnValue('/missing/workspace');
      mockFsAccess.mockRejectedValue(new Error('ENOENT'));

      const files = await loadWorkspaceFiles('test-agent');

      expect(files).toEqual([]);
    });

    it('should respect maxWorkspaceFiles option', async () => {
      const workspaceDir = '/test/workspace';
      mockGetWorkspacePath.mockReturnValue(workspaceDir);
      mockFsAccess.mockResolvedValue(undefined);

      // Create many files
      const manyFiles = Array.from({ length: 200 }, (_, i) => ({
        name: `file${i}.ts`,
        isFile: () => true,
        isDirectory: () => false,
      }));
      mockFsReaddir.mockResolvedValue(manyFiles as any);

      const files = await loadWorkspaceFiles('test-agent', {
        maxWorkspaceFiles: 10,
      });

      expect(files.length).toBeLessThanOrEqual(10);
    });

    it('should throw ContextLoadError on unexpected error', async () => {
      mockGetWorkspacePath.mockImplementation(() => {
        throw new Error('Path error');
      });

      await expect(loadWorkspaceFiles('test-agent')).rejects.toThrow(ContextLoadError);
    });
  });

  describe('loadExecutionContext', () => {
    beforeEach(() => {
      // Setup common mocks
      mockLoadAgentConfig.mockResolvedValue({
        version: '1.0.0',
        identity: { id: 'test-agent' },
      } as any);

      mockGetActiveTasks.mockReturnValue([]);
      mockGetMessages.mockReturnValue([]);
      mockGetWorkspacePath.mockReturnValue('/test/workspace');
      mockGetAgentDirectory.mockReturnValue('/test/agent');

      mockFsAccess.mockResolvedValue(undefined);
      mockFsReaddir.mockResolvedValue([]);
    });

    it('should load complete execution context successfully', async () => {
      const context = await loadExecutionContext(mockDb, 'test-agent', 'continuous');

      expect(context).toMatchObject({
        agentId: 'test-agent',
        mode: 'continuous',
        config: expect.any(Object),
        activeTasks: expect.any(Array),
        messages: expect.any(Array),
        workspaceFiles: expect.any(Array),
        workspaceDir: '/test/workspace',
        workingDir: '/test/agent',
      });
    });

    it('should load context for reactive mode', async () => {
      const context = await loadExecutionContext(mockDb, 'test-agent', 'reactive');

      expect(context.mode).toBe('reactive');
    });

    it('should load all data in parallel', async () => {
      const mockConfig = { identity: { id: 'test-agent' } } as any;
      const mockTasks = [{ id: 'task-1' }] as any;
      const mockMessages = [{ id: 'msg-1' }] as any;

      mockLoadAgentConfig.mockResolvedValue(mockConfig);
      mockGetActiveTasks.mockReturnValue(mockTasks);
      mockGetMessages.mockReturnValue(mockMessages);

      const context = await loadExecutionContext(mockDb, 'test-agent', 'continuous');

      expect(context.config).toBeDefined();
      expect(context.activeTasks).toHaveLength(1);
      expect(context.messages).toHaveLength(1);
    });

    it('should throw ContextLoadError if config loading fails', async () => {
      mockLoadAgentConfig.mockRejectedValue(new Error('Config error'));

      await expect(loadExecutionContext(mockDb, 'test-agent', 'continuous')).rejects.toThrow(
        ContextLoadError
      );
    });

    it('should throw ContextLoadError if task loading fails', async () => {
      mockGetActiveTasks.mockImplementation(() => {
        throw new Error('Task error');
      });

      await expect(loadExecutionContext(mockDb, 'test-agent', 'continuous')).rejects.toThrow(
        ContextLoadError
      );
    });

    it('should pass options to all loaders', async () => {
      const options = {
        baseDir: '/custom',
        maxWorkspaceFiles: 20,
        maxMessages: 10,
      };

      await loadExecutionContext(mockDb, 'test-agent', 'continuous', options);

      expect(loadAgentConfig).toHaveBeenCalledWith('test-agent', options);
      expect(getWorkspacePath).toHaveBeenCalledWith('test-agent', options);
      expect(getAgentDirectory).toHaveBeenCalledWith('test-agent', options);
    });
  });

  describe('validateExecutionContext', () => {
    it('should validate complete context successfully', () => {
      const context: ExecutionContext = {
        agentId: 'test-agent',
        mode: 'continuous',
        config: {} as any,
        activeTasks: [],
        messages: [],
        workspaceFiles: [],
        workspaceDir: '/workspace',
        workingDir: '/working',
      };

      expect(() => validateExecutionContext(context)).not.toThrow();
    });

    it('should throw error for missing agentId', () => {
      const context = {
        mode: 'continuous',
        config: {},
        activeTasks: [],
        messages: [],
        workspaceFiles: [],
        workspaceDir: '/workspace',
        workingDir: '/working',
      } as any;

      expect(() => validateExecutionContext(context)).toThrow(
        'ExecutionContext missing required field: agentId'
      );
    });

    it('should throw error for missing mode', () => {
      const context = {
        agentId: 'test-agent',
        config: {},
        activeTasks: [],
        messages: [],
        workspaceFiles: [],
        workspaceDir: '/workspace',
        workingDir: '/working',
      } as any;

      expect(() => validateExecutionContext(context)).toThrow(
        'ExecutionContext missing required field: mode'
      );
    });

    it('should throw error for null values', () => {
      const context = {
        agentId: 'test-agent',
        mode: 'continuous',
        config: null,
        activeTasks: [],
        messages: [],
        workspaceFiles: [],
        workspaceDir: '/workspace',
        workingDir: '/working',
      } as any;

      expect(() => validateExecutionContext(context)).toThrow(
        'ExecutionContext missing required field: config'
      );
    });
  });
});
