/**
 * Agent Configuration Management (Phase 2.1)
 *
 * This module handles loading, saving, and validating agent configuration files.
 * Implements atomic writes, backup recovery, and schema validation.
 */

import * as fs from 'fs/promises';
import {
  getConfigPath,
  validateAgentConfigStrict,
  safeLoad,
  createAgentLogger,
  atomicWrite,
  createBackup,
  type AgentConfig,
  type PathOptions,
} from '@recursive-manager/common';

/**
 * Error thrown when agent configuration cannot be loaded
 */
export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly agentId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ConfigLoadError';
    Error.captureStackTrace(this, ConfigLoadError);
  }
}

/**
 * Error thrown when agent configuration cannot be saved
 */
export class ConfigSaveError extends Error {
  constructor(
    message: string,
    public readonly agentId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ConfigSaveError';
    Error.captureStackTrace(this, ConfigSaveError);
  }
}

/**
 * Load agent configuration from file with validation and error recovery
 *
 * This function:
 * 1. Resolves the path to the agent's config.json file
 * 2. Loads the file using safeLoad (handles corruption via backup recovery)
 * 3. Parses the JSON content
 * 4. Validates against the agent-config.schema.json schema
 * 5. Returns the typed configuration object
 *
 * Error Handling:
 * - If file doesn't exist: throws ConfigLoadError
 * - If file is corrupted: attempts recovery from backup (via safeLoad)
 * - If JSON is invalid: throws ConfigLoadError
 * - If schema validation fails: throws SchemaValidationError (from validateAgentConfigStrict)
 *
 * @param agentId - The unique identifier of the agent
 * @param options - Optional path resolution options
 * @returns Promise resolving to the validated agent configuration
 * @throws {ConfigLoadError} If the configuration cannot be loaded
 * @throws {SchemaValidationError} If the configuration fails schema validation
 *
 * @example
 * ```typescript
 * const config = await loadAgentConfig('CEO');
 * console.log(config.identity.role); // "Chief Executive Officer"
 * ```
 */
export async function loadAgentConfig(
  agentId: string,
  options: PathOptions = {}
): Promise<AgentConfig> {
  const logger = createAgentLogger(agentId);

  try {
    // 1. Resolve the configuration file path
    const configPath = getConfigPath(agentId, options);

    logger.debug('Loading agent configuration', {
      agentId,
      configPath,
    });

    // 2. Check if file exists
    try {
      await fs.access(configPath);
    } catch (err) {
      throw new ConfigLoadError(
        `Agent configuration file not found: ${configPath}`,
        agentId,
        err as Error
      );
    }

    // 3. Load file content with corruption recovery
    const content = await safeLoad(configPath, {
      validator: (data: string) => {
        // Validate that it's parseable JSON
        try {
          JSON.parse(data);
          return true;
        } catch {
          return false;
        }
      },
    });

    // 4. Parse JSON
    let config: unknown;
    try {
      config = JSON.parse(content);
    } catch (err) {
      throw new ConfigLoadError(
        `Invalid JSON in agent configuration: ${(err as Error).message}`,
        agentId,
        err as Error
      );
    }

    // 5. Validate against schema (throws SchemaValidationError if invalid)
    validateAgentConfigStrict(config);

    logger.info('Agent configuration loaded successfully', {
      agentId,
      role: (config as AgentConfig).identity.role,
      version: (config as AgentConfig).version,
    });

    // 6. Return typed configuration
    return config as AgentConfig;
  } catch (err) {
    // Re-throw ConfigLoadError and SchemaValidationError as-is
    if (
      err instanceof ConfigLoadError ||
      (err instanceof Error && err.name === 'SchemaValidationError')
    ) {
      logger.error('Failed to load agent configuration', {
        agentId,
        error: err.message,
      });
      throw err;
    }

    // Wrap unexpected errors
    const error = err instanceof Error ? err : new Error(String(err));
    throw new ConfigLoadError(
      `Unexpected error loading agent configuration: ${error.message}`,
      agentId,
      error
    );
  }
}

/**
 * Save agent configuration to file with validation, atomic write, and backup
 *
 * This function:
 * 1. Validates the configuration against the agent-config.schema.json schema
 * 2. Creates a backup of the existing configuration (if it exists)
 * 3. Serializes the configuration to JSON with proper formatting
 * 4. Writes the configuration using atomic write (temp file + rename pattern)
 * 5. Ensures the directory structure exists
 *
 * Error Handling:
 * - If schema validation fails: throws SchemaValidationError
 * - If backup creation fails: throws ConfigSaveError
 * - If atomic write fails: throws ConfigSaveError
 * - If JSON serialization fails: throws ConfigSaveError
 *
 * @param agentId - The unique identifier of the agent
 * @param config - The agent configuration to save
 * @param options - Optional path resolution options
 * @returns Promise that resolves when the configuration is saved successfully
 * @throws {SchemaValidationError} If the configuration fails schema validation
 * @throws {ConfigSaveError} If the configuration cannot be saved
 *
 * @example
 * ```typescript
 * const config: AgentConfig = {
 *   version: '1.0.0',
 *   identity: {
 *     id: 'CEO',
 *     role: 'Chief Executive Officer',
 *     displayName: 'CEO',
 *     createdAt: new Date().toISOString(),
 *     createdBy: 'user',
 *   },
 *   goal: {
 *     mainGoal: 'Manage the organization',
 *   },
 *   permissions: {
 *     canHire: true,
 *     maxSubordinates: 10,
 *     hiringBudget: 1000,
 *   },
 *   framework: {
 *     primary: 'claude-code',
 *   },
 * };
 * await saveAgentConfig('CEO', config);
 * ```
 */
export async function saveAgentConfig(
  agentId: string,
  config: AgentConfig,
  options: PathOptions = {}
): Promise<void> {
  const logger = createAgentLogger(agentId);

  try {
    // 1. Validate configuration against schema (throws SchemaValidationError if invalid)
    logger.debug('Validating agent configuration', { agentId });
    validateAgentConfigStrict(config);

    // 2. Resolve the configuration file path
    const configPath = getConfigPath(agentId, options);

    logger.debug('Saving agent configuration', {
      agentId,
      configPath,
      version: config.version,
    });

    // 3. Create backup of existing configuration (if it exists)
    try {
      const backupPath = await createBackup(configPath, {
        createDirs: true,
      });
      if (backupPath) {
        logger.debug('Created backup before saving', {
          agentId,
          backupPath,
        });
      }
    } catch (err) {
      // Backup creation is not critical - log warning but continue
      logger.warn('Failed to create backup before saving', {
        agentId,
        error: (err as Error).message,
      });
    }

    // 4. Serialize configuration to JSON with proper formatting
    let jsonContent: string;
    try {
      jsonContent = JSON.stringify(config, null, 2);
    } catch (err) {
      throw new ConfigSaveError(
        `Failed to serialize configuration to JSON: ${(err as Error).message}`,
        agentId,
        err as Error
      );
    }

    // 5. Write configuration using atomic write (temp file + rename)
    try {
      await atomicWrite(configPath, jsonContent, {
        createDirs: true,
        encoding: 'utf8',
        mode: 0o644, // Read/write for owner, read for group and others
      });
    } catch (err) {
      throw new ConfigSaveError(
        `Failed to write configuration file: ${(err as Error).message}`,
        agentId,
        err as Error
      );
    }

    logger.info('Agent configuration saved successfully', {
      agentId,
      configPath,
      role: config.identity.role,
      version: config.version,
    });
  } catch (err) {
    // Re-throw ConfigSaveError and SchemaValidationError as-is
    if (
      err instanceof ConfigSaveError ||
      (err instanceof Error && err.name === 'SchemaValidationError')
    ) {
      logger.error('Failed to save agent configuration', {
        agentId,
        error: err.message,
      });
      throw err;
    }

    // Wrap unexpected errors
    const error = err instanceof Error ? err : new Error(String(err));
    throw new ConfigSaveError(
      `Unexpected error saving agent configuration: ${error.message}`,
      agentId,
      error
    );
  }
}
