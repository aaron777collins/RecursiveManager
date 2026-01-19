/**
 * Tests for loadAgentConfig function (Task 2.1.1)
 *
 * Test coverage:
 * - Valid configuration loading
 * - Missing file handling
 * - Corrupted file recovery
 * - Invalid JSON handling
 * - Schema validation failures
 * - Edge cases
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { loadAgentConfig, ConfigLoadError } from '../config';
import {
  getConfigPath,
  atomicWrite,
  createBackup,
  type AgentConfig,
} from '@recursive-manager/common';

describe('loadAgentConfig', () => {
  const testBaseDir = path.join(__dirname, '../../__test-data__/loadAgentConfig');
  const testAgentId = 'test-agent-001';

  // Create a valid test configuration
  const validConfig: AgentConfig = {
    version: '1.0.0',
    identity: {
      id: testAgentId,
      role: 'Test Agent',
      displayName: 'Test Agent #1',
      createdAt: '2026-01-19T00:00:00Z',
      createdBy: 'system',
    },
    goal: {
      mainGoal: 'Test agent for unit testing',
    },
    permissions: {
      canHire: false,
      maxSubordinates: 0,
      hiringBudget: 0,
    },
    framework: {
      primary: 'claude-code',
    },
  };

  beforeEach(async () => {
    // Clean up test directory
    await fs.rm(testBaseDir, { recursive: true, force: true });
    await fs.mkdir(testBaseDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up after tests
    await fs.rm(testBaseDir, { recursive: true, force: true });
  });

  describe('Valid Configuration Loading', () => {
    it('should load a valid agent configuration', async () => {
      // Arrange: Create a valid config file
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(validConfig, null, 2));

      // Act: Load the configuration
      const config = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });

      // Assert: Configuration matches expected values
      expect(config).toEqual(validConfig);
      expect(config.identity.id).toBe(testAgentId);
      expect(config.identity.role).toBe('Test Agent');
      expect(config.version).toBe('1.0.0');
    });

    it('should load configuration with optional fields', async () => {
      // Arrange: Create a config with some optional fields
      const configWithOptional = {
        ...validConfig,
        identity: {
          ...validConfig.identity,
          reportingTo: 'CEO',
        },
        goal: {
          mainGoal: 'Complete test goal',
          subGoals: ['Goal 1', 'Goal 2'],
          successCriteria: ['Criterion 1'],
        },
        metadata: {
          tags: ['test', 'development'],
          description: 'Test agent',
        },
      };

      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(configWithOptional, null, 2));

      // Act: Load the configuration
      const config = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });

      // Assert: Fields preserved
      expect(config.identity.reportingTo).toBe('CEO');
      expect(config.goal.subGoals).toEqual(['Goal 1', 'Goal 2']);
      expect(config.metadata?.tags).toEqual(['test', 'development']);
    });
  });

  describe('Error Handling - Missing File', () => {
    it('should throw ConfigLoadError when config file does not exist', async () => {
      // Act & Assert: Attempt to load non-existent config
      await expect(
        loadAgentConfig('non-existent-agent', { baseDir: testBaseDir })
      ).rejects.toThrow(ConfigLoadError);

      await expect(
        loadAgentConfig('non-existent-agent', { baseDir: testBaseDir })
      ).rejects.toThrow(/configuration file not found/i);
    });

    it('should include agentId in ConfigLoadError', async () => {
      // Act & Assert: Error contains agent ID
      try {
        await loadAgentConfig('missing-agent', { baseDir: testBaseDir });
        fail('Should have thrown ConfigLoadError');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigLoadError);
        expect((err as ConfigLoadError).agentId).toBe('missing-agent');
      }
    });
  });

  describe('Error Handling - Corrupted Files', () => {
    it('should recover from corrupted file using backup', async () => {
      // Arrange: Create a valid config and backup
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(validConfig, null, 2));
      await createBackup(configPath);

      // Corrupt the main file
      await fs.writeFile(configPath, 'corrupted json {[}');

      // Act: Load configuration (should recover from backup)
      const config = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });

      // Assert: Configuration recovered successfully
      expect(config).toEqual(validConfig);
    });

    it('should throw ConfigLoadError when no backup available', async () => {
      // Arrange: Create corrupted config without backup
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, 'corrupted json {[}');

      // Act & Assert: Should fail to load
      await expect(
        loadAgentConfig(testAgentId, { baseDir: testBaseDir })
      ).rejects.toThrow();
    });
  });

  describe('Error Handling - Invalid JSON', () => {
    it('should throw error for invalid JSON syntax (treated as corruption)', async () => {
      // Arrange: Create file with invalid JSON (no backup to recover from)
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, '{ invalid json }');

      // Act & Assert: Should throw error (treated as corruption with no recovery)
      await expect(
        loadAgentConfig(testAgentId, { baseDir: testBaseDir })
      ).rejects.toThrow();
    });

    it('should throw ConfigLoadError for empty file', async () => {
      // Arrange: Create empty file
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, '');

      // Act & Assert: Should throw error
      await expect(
        loadAgentConfig(testAgentId, { baseDir: testBaseDir })
      ).rejects.toThrow();
    });
  });

  describe('Schema Validation', () => {
    it('should throw SchemaValidationError for missing required fields', async () => {
      // Arrange: Create config missing required 'permissions' field
      const invalidConfig = {
        version: '1.0.0',
        identity: validConfig.identity,
        goal: validConfig.goal,
        framework: validConfig.framework,
        // Missing: permissions
      };

      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(invalidConfig, null, 2));

      // Act & Assert: Should throw SchemaValidationError
      await expect(
        loadAgentConfig(testAgentId, { baseDir: testBaseDir })
      ).rejects.toThrow(/validation failed/);
    });

    it('should throw SchemaValidationError for invalid field types', async () => {
      // Arrange: Create config with wrong type for canHire
      const invalidConfig = {
        ...validConfig,
        permissions: {
          ...validConfig.permissions,
          canHire: 'yes', // Should be boolean
        },
      };

      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(invalidConfig, null, 2));

      // Act & Assert: Should throw SchemaValidationError
      await expect(
        loadAgentConfig(testAgentId, { baseDir: testBaseDir })
      ).rejects.toThrow(/validation failed/);
    });

    it('should throw SchemaValidationError for invalid version format', async () => {
      // Arrange: Create config with invalid version
      const invalidConfig = {
        ...validConfig,
        version: 'invalid-version',
      };

      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(invalidConfig, null, 2));

      // Act & Assert: Should throw SchemaValidationError
      await expect(
        loadAgentConfig(testAgentId, { baseDir: testBaseDir })
      ).rejects.toThrow(/validation failed/);
    });

    it('should throw SchemaValidationError for invalid agentId pattern', async () => {
      // Arrange: Create config with invalid agentId (contains spaces)
      const invalidConfig = {
        ...validConfig,
        identity: {
          ...validConfig.identity,
          id: 'invalid agent id',
        },
      };

      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(invalidConfig, null, 2));

      // Act & Assert: Should throw SchemaValidationError
      await expect(
        loadAgentConfig(testAgentId, { baseDir: testBaseDir })
      ).rejects.toThrow(/validation failed/);
    });
  });

  describe('Edge Cases', () => {
    it('should reject config with extra unknown fields', async () => {
      // Arrange: Create config with extra fields (schema has additionalProperties: false)
      const configWithExtra = {
        ...validConfig,
        unknownField: 'should be rejected',
      };

      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(configWithExtra, null, 2));

      // Act & Assert: Should reject due to unknown field
      await expect(
        loadAgentConfig(testAgentId, { baseDir: testBaseDir })
      ).rejects.toThrow(/validation failed/);
    });

    it('should handle config with null optional fields', async () => {
      // Arrange: Create config with explicit null values
      const configWithNulls: AgentConfig = {
        ...validConfig,
        communication: undefined,
        behavior: undefined,
        metadata: undefined,
      };

      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(configWithNulls, null, 2));

      // Act: Load configuration
      const config = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });

      // Assert: Should load successfully
      expect(config.identity.id).toBe(testAgentId);
      expect(config.communication).toBeUndefined();
    });

    it('should handle agent IDs with special characters', async () => {
      // Arrange: Create config with hyphenated agent ID
      const specialAgentId = 'test-agent-with-hyphens_123';
      const specialConfig = {
        ...validConfig,
        identity: {
          ...validConfig.identity,
          id: specialAgentId,
        },
      };

      const configPath = getConfigPath(specialAgentId, { baseDir: testBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(specialConfig, null, 2));

      // Act: Load configuration
      const config = await loadAgentConfig(specialAgentId, { baseDir: testBaseDir });

      // Assert: Should load successfully
      expect(config.identity.id).toBe(specialAgentId);
    });

    it('should use custom path options', async () => {
      // Arrange: Create config in custom directory
      const customBaseDir = path.join(testBaseDir, 'custom');
      const configPath = getConfigPath(testAgentId, { baseDir: customBaseDir });
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await atomicWrite(configPath, JSON.stringify(validConfig, null, 2));

      // Act: Load with custom path options
      const config = await loadAgentConfig(testAgentId, { baseDir: customBaseDir });

      // Assert: Should load from custom directory
      expect(config).toEqual(validConfig);
    });
  });
});
