/**
 * Tests for path-utils module
 *
 * Tests agent directory sharding logic, path resolution, and error handling.
 */

import * as path from 'path';
import * as os from 'os';
import {
  DEFAULT_BASE_DIR,
  PathError,
  getAgentShard,
  getAgentDirectory,
  getTaskPath,
  getInboxPath,
  getOutboxPath,
  getWorkspacePath,
  getSubordinatesPath,
  getConfigPath,
  getSchedulePath,
  getMetadataPath,
  getLogsDirectory,
  getAgentLogPath,
  getDatabasePath,
  getBackupsDirectory,
} from '../path-utils';

describe('path-utils', () => {
  describe('DEFAULT_BASE_DIR', () => {
    it('should be set to ~/.recursivemanager', () => {
      const expected = path.join(os.homedir(), '.recursivemanager');
      expect(DEFAULT_BASE_DIR).toBe(expected);
    });
  });

  describe('PathError', () => {
    it('should create error with message and agentId', () => {
      const error = new PathError('Test error', 'agent-123');
      expect(error.message).toBe('Test error');
      expect(error.agentId).toBe('agent-123');
      expect(error.name).toBe('PathError');
    });

    it('should include taskId and cause if provided', () => {
      const cause = new Error('Original error');
      const error = new PathError('Test error', 'agent-123', 'task-456', cause);
      expect(error.agentId).toBe('agent-123');
      expect(error.taskId).toBe('task-456');
      expect(error.cause).toBe(cause);
    });
  });

  describe('getAgentShard', () => {
    it('should shard numeric agent IDs (0-9)', () => {
      expect(getAgentShard('0-agent')).toBe('00-0f');
      expect(getAgentShard('1-agent')).toBe('10-1f');
      expect(getAgentShard('2-agent')).toBe('20-2f');
      expect(getAgentShard('3-agent')).toBe('30-3f');
      expect(getAgentShard('4-agent')).toBe('40-4f');
      expect(getAgentShard('5-agent')).toBe('50-5f');
      expect(getAgentShard('6-agent')).toBe('60-6f');
      expect(getAgentShard('7-agent')).toBe('70-7f');
      expect(getAgentShard('8-agent')).toBe('80-8f');
      expect(getAgentShard('9-agent')).toBe('90-9f');
    });

    it('should shard hex letter agent IDs (a-f)', () => {
      expect(getAgentShard('alice')).toBe('a0-af');
      expect(getAgentShard('backend-dev')).toBe('b0-bf');
      expect(getAgentShard('CEO')).toBe('c0-cf');
      expect(getAgentShard('database-admin')).toBe('d0-df');
      expect(getAgentShard('engineer')).toBe('e0-ef');
      expect(getAgentShard('frontend-dev')).toBe('f0-ff');
    });

    it('should handle other characters by hashing to shard bucket', () => {
      // Characters outside 0-9, a-f should hash to a shard bucket
      const shard1 = getAgentShard('github-bot');
      const shard2 = getAgentShard('hr-manager');
      const shard3 = getAgentShard('qa-tester');

      // Should be valid shard format
      expect(shard1).toMatch(/^[0-9a-f]0-[0-9a-f]f$/);
      expect(shard2).toMatch(/^[0-9a-f]0-[0-9a-f]f$/);
      expect(shard3).toMatch(/^[0-9a-f]0-[0-9a-f]f$/);
    });

    it('should be case-insensitive', () => {
      expect(getAgentShard('CEO')).toBe(getAgentShard('ceo'));
      expect(getAgentShard('Alice')).toBe(getAgentShard('alice'));
      expect(getAgentShard('BACKEND')).toBe(getAgentShard('backend'));
    });

    it('should consistently shard the same agent ID', () => {
      const agentId = 'test-agent-123';
      const shard1 = getAgentShard(agentId);
      const shard2 = getAgentShard(agentId);
      const shard3 = getAgentShard(agentId);

      expect(shard1).toBe(shard2);
      expect(shard2).toBe(shard3);
    });

    it('should throw PathError for empty agent ID', () => {
      expect(() => getAgentShard('')).toThrow(PathError);
      expect(() => getAgentShard('   ')).toThrow(PathError);
    });

    it('should throw PathError with descriptive message for empty ID', () => {
      try {
        getAgentShard('');
      } catch (error) {
        expect(error).toBeInstanceOf(PathError);
        expect((error as PathError).message).toContain('Agent ID cannot be empty');
      }
    });
  });

  describe('getAgentDirectory', () => {
    it('should return correct sharded path for agent', () => {
      const result = getAgentDirectory('CEO');
      const expected = path.resolve(DEFAULT_BASE_DIR, 'agents', 'c0-cf', 'CEO');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getAgentDirectory('CEO', { baseDir: '/opt/rm' });
      const expected = path.resolve('/opt/rm', 'agents', 'c0-cf', 'CEO');
      expect(result).toBe(expected);
    });

    it('should return absolute path', () => {
      const result = getAgentDirectory('backend-dev');
      expect(path.isAbsolute(result)).toBe(true);
    });

    it('should include shard in path', () => {
      const result = getAgentDirectory('alice');
      expect(result).toContain('a0-af');
      expect(result).toContain('alice');
    });

    it('should throw PathError for empty agent ID', () => {
      expect(() => getAgentDirectory('')).toThrow(PathError);
      expect(() => getAgentDirectory('   ')).toThrow(PathError);
    });
  });

  describe('getTaskPath', () => {
    it('should return path for active task by default', () => {
      const result = getTaskPath('CEO', 'task-1-implement-feature');
      const expected = path.join(
        DEFAULT_BASE_DIR,
        'agents',
        'c0-cf',
        'CEO',
        'tasks',
        'active',
        'task-1-implement-feature'
      );
      expect(result).toBe(expected);
    });

    it('should handle completed status', () => {
      const result = getTaskPath('CEO', 'task-2-review', 'completed');
      expect(result).toContain('tasks/completed/task-2-review');
    });

    it('should handle archive status with date', () => {
      const result = getTaskPath('CEO', 'task-3-old', 'archive/2024-01');
      expect(result).toContain('tasks/archive/2024-01/task-3-old');
    });

    it('should handle custom base directory', () => {
      const result = getTaskPath('CEO', 'task-1', 'active', { baseDir: '/opt/rm' });
      expect(result).toContain('/opt/rm/agents');
    });

    it('should throw PathError for empty agent ID', () => {
      expect(() => getTaskPath('', 'task-1')).toThrow(PathError);
    });

    it('should throw PathError for empty task ID', () => {
      expect(() => getTaskPath('CEO', '')).toThrow(PathError);
    });

    it('should include both agentId and taskId in error', () => {
      try {
        getTaskPath('CEO', '');
      } catch (error) {
        expect(error).toBeInstanceOf(PathError);
        expect((error as PathError).agentId).toBe('CEO');
        expect((error as PathError).taskId).toBe('');
      }
    });
  });

  describe('getInboxPath', () => {
    it('should return path to agent inbox', () => {
      const result = getInboxPath('CEO');
      const expected = path.join(DEFAULT_BASE_DIR, 'agents', 'c0-cf', 'CEO', 'inbox');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getInboxPath('CEO', { baseDir: '/opt/rm' });
      expect(result).toContain('/opt/rm/agents');
      expect(result).toContain('inbox');
    });
  });

  describe('getOutboxPath', () => {
    it('should return path to agent outbox', () => {
      const result = getOutboxPath('CEO');
      const expected = path.join(DEFAULT_BASE_DIR, 'agents', 'c0-cf', 'CEO', 'outbox');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getOutboxPath('CEO', { baseDir: '/opt/rm' });
      expect(result).toContain('/opt/rm/agents');
      expect(result).toContain('outbox');
    });
  });

  describe('getWorkspacePath', () => {
    it('should return path to agent workspace', () => {
      const result = getWorkspacePath('CEO');
      const expected = path.join(DEFAULT_BASE_DIR, 'agents', 'c0-cf', 'CEO', 'workspace');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getWorkspacePath('CEO', { baseDir: '/opt/rm' });
      expect(result).toContain('/opt/rm/agents');
      expect(result).toContain('workspace');
    });
  });

  describe('getSubordinatesPath', () => {
    it('should return path to agent subordinates directory', () => {
      const result = getSubordinatesPath('CEO');
      const expected = path.join(DEFAULT_BASE_DIR, 'agents', 'c0-cf', 'CEO', 'subordinates');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getSubordinatesPath('CEO', { baseDir: '/opt/rm' });
      expect(result).toContain('/opt/rm/agents');
      expect(result).toContain('subordinates');
    });
  });

  describe('getConfigPath', () => {
    it('should return path to agent config file', () => {
      const result = getConfigPath('CEO');
      const expected = path.join(DEFAULT_BASE_DIR, 'agents', 'c0-cf', 'CEO', 'config.json');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getConfigPath('CEO', { baseDir: '/opt/rm' });
      expect(result).toContain('/opt/rm/agents');
      expect(result).toContain('config.json');
    });
  });

  describe('getSchedulePath', () => {
    it('should return path to agent schedule file', () => {
      const result = getSchedulePath('CEO');
      const expected = path.join(DEFAULT_BASE_DIR, 'agents', 'c0-cf', 'CEO', 'schedule.json');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getSchedulePath('CEO', { baseDir: '/opt/rm' });
      expect(result).toContain('/opt/rm/agents');
      expect(result).toContain('schedule.json');
    });
  });

  describe('getMetadataPath', () => {
    it('should return path to agent metadata file', () => {
      const result = getMetadataPath('CEO');
      const expected = path.join(DEFAULT_BASE_DIR, 'agents', 'c0-cf', 'CEO', 'metadata.json');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getMetadataPath('CEO', { baseDir: '/opt/rm' });
      expect(result).toContain('/opt/rm/agents');
      expect(result).toContain('metadata.json');
    });
  });

  describe('getLogsDirectory', () => {
    it('should return path to logs directory', () => {
      const result = getLogsDirectory();
      const expected = path.resolve(DEFAULT_BASE_DIR, 'logs');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getLogsDirectory({ baseDir: '/opt/rm' });
      const expected = path.resolve('/opt/rm', 'logs');
      expect(result).toBe(expected);
    });
  });

  describe('getAgentLogPath', () => {
    it('should return path to agent log file', () => {
      const result = getAgentLogPath('CEO');
      const expected = path.join(DEFAULT_BASE_DIR, 'logs', 'agents', 'CEO.log');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getAgentLogPath('CEO', { baseDir: '/opt/rm' });
      expect(result).toContain('/opt/rm/logs');
      expect(result).toContain('CEO.log');
    });

    it('should throw PathError for empty agent ID', () => {
      expect(() => getAgentLogPath('')).toThrow(PathError);
    });
  });

  describe('getDatabasePath', () => {
    it('should return path to database file', () => {
      const result = getDatabasePath();
      const expected = path.resolve(DEFAULT_BASE_DIR, 'recursivemanager.db');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getDatabasePath({ baseDir: '/opt/rm' });
      const expected = path.resolve('/opt/rm', 'recursivemanager.db');
      expect(result).toBe(expected);
    });
  });

  describe('getBackupsDirectory', () => {
    it('should return path to backups directory', () => {
      const result = getBackupsDirectory();
      const expected = path.resolve(DEFAULT_BASE_DIR, 'backups');
      expect(result).toBe(expected);
    });

    it('should handle custom base directory', () => {
      const result = getBackupsDirectory({ baseDir: '/opt/rm' });
      const expected = path.resolve('/opt/rm', 'backups');
      expect(result).toBe(expected);
    });
  });

  describe('Integration: Complete agent path structure', () => {
    const agentId = 'backend-dev-001';
    const baseDir = '/opt/recursivemanager';

    it('should provide consistent base path across all functions', () => {
      const agentDir = getAgentDirectory(agentId, { baseDir });
      const configPath = getConfigPath(agentId, { baseDir });
      const schedulePath = getSchedulePath(agentId, { baseDir });
      const metadataPath = getMetadataPath(agentId, { baseDir });
      const inboxPath = getInboxPath(agentId, { baseDir });
      const outboxPath = getOutboxPath(agentId, { baseDir });
      const workspacePath = getWorkspacePath(agentId, { baseDir });
      const subordinatesPath = getSubordinatesPath(agentId, { baseDir });

      // All paths should start with the agent directory
      expect(configPath).toContain(agentDir);
      expect(schedulePath).toContain(agentDir);
      expect(metadataPath).toContain(agentDir);
      expect(inboxPath).toContain(agentDir);
      expect(outboxPath).toContain(agentDir);
      expect(workspacePath).toContain(agentDir);
      expect(subordinatesPath).toContain(agentDir);
    });

    it('should create expected directory structure', () => {
      const agentDir = getAgentDirectory(agentId, { baseDir });
      const expectedBase = path.resolve(baseDir, 'agents', 'b0-bf', agentId);
      expect(agentDir).toBe(expectedBase);

      // Verify subdirectories
      expect(getInboxPath(agentId, { baseDir })).toBe(path.join(expectedBase, 'inbox'));
      expect(getOutboxPath(agentId, { baseDir })).toBe(path.join(expectedBase, 'outbox'));
      expect(getWorkspacePath(agentId, { baseDir })).toBe(path.join(expectedBase, 'workspace'));
      expect(getSubordinatesPath(agentId, { baseDir })).toBe(
        path.join(expectedBase, 'subordinates')
      );

      // Verify config files
      expect(getConfigPath(agentId, { baseDir })).toBe(path.join(expectedBase, 'config.json'));
      expect(getSchedulePath(agentId, { baseDir })).toBe(path.join(expectedBase, 'schedule.json'));
      expect(getMetadataPath(agentId, { baseDir })).toBe(path.join(expectedBase, 'metadata.json'));
    });
  });

  describe('Sharding distribution', () => {
    it('should distribute agents across all 16 shards', () => {
      const shards = new Set<string>();

      // Test agents starting with 0-9
      for (let i = 0; i < 10; i++) {
        shards.add(getAgentShard(`${i}-agent`));
      }

      // Test agents starting with a-f
      for (const char of ['a', 'b', 'c', 'd', 'e', 'f']) {
        shards.add(getAgentShard(`${char}-agent`));
      }

      // Should have 16 unique shards (0-9, a-f)
      expect(shards.size).toBe(16);

      // Verify all shards are in correct format
      for (const shard of shards) {
        expect(shard).toMatch(/^[0-9a-f]0-[0-9a-f]f$/);
      }
    });

    it('should prevent filesystem bottlenecks with many agents', () => {
      const agents = [
        'CEO',
        'CTO',
        'CFO',
        'backend-dev-001',
        'backend-dev-002',
        'frontend-dev-001',
        'database-admin',
        'qa-tester-001',
        'devops-engineer',
        'security-specialist',
      ];

      const shardCounts = new Map<string, number>();

      for (const agentId of agents) {
        const shard = getAgentShard(agentId);
        shardCounts.set(shard, (shardCounts.get(shard) ?? 0) + 1);
      }

      // Verify agents are distributed across multiple shards
      expect(shardCounts.size).toBeGreaterThan(1);

      // No single shard should have all agents
      for (const count of shardCounts.values()) {
        expect(count).toBeLessThan(agents.length);
      }
    });
  });
});
