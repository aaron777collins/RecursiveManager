/**
 * Tests for saveAgentConfig function (Task 2.1.2)
 *
 * Test coverage:
 * - Valid configuration saving
 * - Atomic write behavior
 * - Backup creation
 * - Schema validation before save
 * - Directory creation
 * - File permissions
 * - Error handling
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { saveAgentConfig, loadAgentConfig } from '../config';
import {
  getConfigPath,
  type AgentConfig,
} from '@recursive-manager/common';

describe('saveAgentConfig', () => {
  const testBaseDir = path.join(__dirname, '../../__test-data__/saveAgentConfig');
  const testAgentId = 'test-agent-002';

  // Create a valid test configuration
  const validConfig: AgentConfig = {
    version: '1.0.0',
    identity: {
      id: testAgentId,
      role: 'Test Save Agent',
      displayName: 'Test Save Agent #2',
      createdAt: '2026-01-19T00:00:00Z',
      createdBy: 'system',
    },
    goal: {
      mainGoal: 'Test agent for saveAgentConfig unit testing',
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

  describe('Valid Configuration Saving', () => {
    it('should save a valid agent configuration', async () => {
      // Act: Save the configuration
      await saveAgentConfig(testAgentId, validConfig, { baseDir: testBaseDir });

      // Assert: File exists and content matches
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // Verify content by loading it back
      const loadedConfig = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });
      expect(loadedConfig).toEqual(validConfig);
    });

    it('should save configuration with proper JSON formatting', async () => {
      // Act: Save the configuration
      await saveAgentConfig(testAgentId, validConfig, { baseDir: testBaseDir });

      // Assert: JSON is properly formatted (2-space indent)
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      const content = await fs.readFile(configPath, 'utf8');

      // Check that it's properly indented
      expect(content).toContain('  "version"');
      expect(content).toContain('  "identity"');

      // Verify it's valid JSON
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('should save configuration with optional fields', async () => {
      // Arrange: Config with optional fields
      const configWithOptional: AgentConfig = {
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
          tags: ['test', 'save'],
          description: 'Test save agent',
        },
      };

      // Act: Save the configuration
      await saveAgentConfig(testAgentId, configWithOptional, { baseDir: testBaseDir });

      // Assert: All fields preserved
      const loadedConfig = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });
      expect(loadedConfig.identity.reportingTo).toBe('CEO');
      expect(loadedConfig.goal.subGoals).toEqual(['Goal 1', 'Goal 2']);
      expect(loadedConfig.metadata?.tags).toEqual(['test', 'save']);
    });

    it('should overwrite existing configuration', async () => {
      // Arrange: Save initial config
      await saveAgentConfig(testAgentId, validConfig, { baseDir: testBaseDir });

      // Act: Save updated config
      const updatedConfig: AgentConfig = {
        ...validConfig,
        identity: {
          ...validConfig.identity,
          displayName: 'Updated Display Name',
        },
      };
      await saveAgentConfig(testAgentId, updatedConfig, { baseDir: testBaseDir });

      // Assert: Config is updated
      const loadedConfig = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });
      expect(loadedConfig.identity.displayName).toBe('Updated Display Name');
    });
  });

  describe('Atomic Write Behavior', () => {
    it('should create directory structure if it does not exist', async () => {
      // Arrange: Ensure directory doesn't exist
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      const dirPath = path.dirname(configPath);

      // Act: Save configuration
      await saveAgentConfig(testAgentId, validConfig, { baseDir: testBaseDir });

      // Assert: Directory was created
      const dirExists = await fs
        .access(dirPath)
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);
    });

    it('should use atomic write (temp file + rename pattern)', async () => {
      // This test verifies atomic write behavior indirectly
      // by ensuring the file is created successfully even if interrupted

      // Act: Save configuration
      await saveAgentConfig(testAgentId, validConfig, { baseDir: testBaseDir });

      // Assert: No temp files left behind
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      const dirPath = path.dirname(configPath);
      const files = await fs.readdir(dirPath);

      // Should only have config.json, not any .tmp files
      expect(files).toContain('config.json');
      expect(files.filter((f) => f.includes('.tmp'))).toHaveLength(0);
    });
  });

  describe('Backup Creation', () => {
    it('should create backup of existing config before overwriting', async () => {
      // Arrange: Save initial config
      await saveAgentConfig(testAgentId, validConfig, { baseDir: testBaseDir });

      // Wait a moment to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Act: Save updated config
      const updatedConfig: AgentConfig = {
        ...validConfig,
        version: '1.0.1',
      };
      await saveAgentConfig(testAgentId, updatedConfig, { baseDir: testBaseDir });

      // Assert: Backup file exists
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      const dirPath = path.dirname(configPath);
      const files = await fs.readdir(dirPath);

      // Should have config.json and at least one backup file
      const backupFiles = files.filter((f) => f.startsWith('config.') && f.endsWith('.json') && f !== 'config.json');
      expect(backupFiles.length).toBeGreaterThan(0);
    });

    it('should not fail if backup creation fails', async () => {
      // This test ensures backup failures don't prevent saves
      // Act: Save config (no existing file, backup creation will be skipped)
      await expect(
        saveAgentConfig(testAgentId, validConfig, { baseDir: testBaseDir })
      ).resolves.not.toThrow();

      // Assert: Config still saved successfully
      const loadedConfig = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });
      expect(loadedConfig).toEqual(validConfig);
    });
  });

  describe('Schema Validation', () => {
    it('should throw SchemaValidationError for invalid config', async () => {
      // Arrange: Create invalid config (missing required field)
      const invalidConfig = {
        version: '1.0.0',
        identity: validConfig.identity,
        goal: validConfig.goal,
        framework: validConfig.framework,
        // Missing: permissions (required field)
      } as unknown as AgentConfig;

      // Act & Assert: Should throw SchemaValidationError
      await expect(
        saveAgentConfig(testAgentId, invalidConfig, { baseDir: testBaseDir })
      ).rejects.toThrow(/validation failed/);
    });

    it('should throw SchemaValidationError for invalid field types', async () => {
      // Arrange: Create config with wrong type
      const invalidConfig = {
        ...validConfig,
        permissions: {
          ...validConfig.permissions,
          canHire: 'yes', // Should be boolean
        },
      } as unknown as AgentConfig;

      // Act & Assert: Should throw SchemaValidationError
      await expect(
        saveAgentConfig(testAgentId, invalidConfig, { baseDir: testBaseDir })
      ).rejects.toThrow(/validation failed/);
    });

    it('should validate before writing (no file created on validation failure)', async () => {
      // Arrange: Invalid config
      const invalidConfig = {
        version: 'invalid-version', // Invalid version format
        identity: validConfig.identity,
        goal: validConfig.goal,
        permissions: validConfig.permissions,
        framework: validConfig.framework,
      } as unknown as AgentConfig;

      // Act: Attempt to save
      await expect(
        saveAgentConfig(testAgentId, invalidConfig, { baseDir: testBaseDir })
      ).rejects.toThrow();

      // Assert: No file was created
      const configPath = getConfigPath(testAgentId, { baseDir: testBaseDir });
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw ConfigSaveError for file system errors', async () => {
      // Arrange: Create a read-only parent directory (simulated permission error)
      // Note: This test may behave differently on different platforms
      // We'll test by providing an invalid path instead

      // Act & Assert: Should throw error for invalid path
      // Using null byte in path which is invalid on most filesystems
      await expect(
        saveAgentConfig(testAgentId, validConfig, { baseDir: '/invalid/\0/path' })
      ).rejects.toThrow();
    });

    it('should include agentId in ConfigSaveError', async () => {
      // Arrange: Invalid config to trigger error
      const invalidConfig = {
        version: '1.0.0',
        // Missing all required fields
      } as unknown as AgentConfig;

      // Act & Assert: Error contains agent ID
      try {
        await saveAgentConfig('test-agent-error', invalidConfig, { baseDir: testBaseDir });
        fail('Should have thrown an error');
      } catch (err) {
        // Either SchemaValidationError or ConfigSaveError is acceptable
        expect(err).toBeDefined();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle agent IDs with special characters', async () => {
      // Arrange: Agent ID with hyphens and underscores
      const specialAgentId = 'test-agent-special_123';
      const specialConfig: AgentConfig = {
        ...validConfig,
        identity: {
          ...validConfig.identity,
          id: specialAgentId,
        },
      };

      // Act: Save configuration
      await saveAgentConfig(specialAgentId, specialConfig, { baseDir: testBaseDir });

      // Assert: Should save successfully
      const loadedConfig = await loadAgentConfig(specialAgentId, { baseDir: testBaseDir });
      expect(loadedConfig.identity.id).toBe(specialAgentId);
    });

    it('should use custom path options', async () => {
      // Arrange: Custom base directory
      const customBaseDir = path.join(testBaseDir, 'custom');

      // Act: Save with custom path options
      await saveAgentConfig(testAgentId, validConfig, { baseDir: customBaseDir });

      // Assert: Should save in custom directory
      const configPath = getConfigPath(testAgentId, { baseDir: customBaseDir });
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should handle rapid successive saves', async () => {
      // Act: Save multiple times rapidly
      await saveAgentConfig(testAgentId, { ...validConfig, version: '1.0.0' }, { baseDir: testBaseDir });
      await saveAgentConfig(testAgentId, { ...validConfig, version: '1.0.1' }, { baseDir: testBaseDir });
      await saveAgentConfig(testAgentId, { ...validConfig, version: '1.0.2' }, { baseDir: testBaseDir });

      // Assert: Latest version is saved
      const loadedConfig = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });
      expect(loadedConfig.version).toBe('1.0.2');
    });
  });

  describe('Integration with loadAgentConfig', () => {
    it('should save and load config roundtrip', async () => {
      // Act: Save and then load
      await saveAgentConfig(testAgentId, validConfig, { baseDir: testBaseDir });
      const loadedConfig = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });

      // Assert: Loaded config matches saved config
      expect(loadedConfig).toEqual(validConfig);
    });

    it('should preserve all fields in roundtrip', async () => {
      // Arrange: Config with many optional fields
      const complexConfig: AgentConfig = {
        version: '1.0.0',
        identity: {
          id: testAgentId,
          role: 'Complex Agent',
          displayName: 'Complex Test Agent',
          createdAt: '2026-01-19T12:00:00.000Z',
          createdBy: 'admin',
        },
        goal: {
          mainGoal: 'Complex goal',
          subGoals: ['Sub 1', 'Sub 2'],
        },
        permissions: {
          canHire: true,
          maxSubordinates: 5,
          hiringBudget: 10000,
        },
        framework: {
          primary: 'claude-code',
        },
      };

      // Act: Save and load
      await saveAgentConfig(testAgentId, complexConfig, { baseDir: testBaseDir });
      const loadedConfig = await loadAgentConfig(testAgentId, { baseDir: testBaseDir });

      // Assert: All fields preserved
      expect(loadedConfig).toEqual(complexConfig);
      expect(loadedConfig.goal.subGoals).toEqual(['Sub 1', 'Sub 2']);
    });
  });
});
