/**
 * Agent Configuration Loading (Phase 2.1 - Moved from core to resolve circular dependency)
 *
 * This module handles loading agent configuration files with validation and error recovery.
 * It was moved from @recursivemanager/core to @recursivemanager/common to break the
 * circular dependency between core and adapters packages.
 *
 * Circular dependency issue:
 * - core/execution imports loadExecutionContext from adapters
 * - adapters/context imports loadAgentConfig from core
 *
 * Solution: Move loadAgentConfig to common, which both core and adapters depend on.
 */

import * as fs from 'fs/promises';
import { getConfigPath } from './path-utils';
import { validateAgentConfigStrict } from './schema-validation';
import { safeLoad } from './file-recovery';
import { createAgentLogger } from './logger';
import type { AgentConfig } from './types/agent-config';
import type { PathOptions } from './path-utils';

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
 * Load agent configuration from file with validation and error recovery
 *
 * This function:
 * 1. Resolves the path to the agent's config.json file
 * 2. Loads the file using safeLoad (handles corruption via backup recovery)
 * 3. Parses the JSON content
 * 4. Validates against the agent-config.schema.json schema
 * 5. Returns the typed configuration object
 *
 * Note: This function performs schema validation but NOT business logic validation,
 * as business validation may depend on core package functionality. Business validation
 * should be performed by the caller if needed.
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

    // 2. Check if file exists and is a file (not a directory)
    try {
      const stats = await fs.stat(configPath);
      if (stats.isDirectory()) {
        const error = new ConfigLoadError(
          `Agent configuration path is a directory, not a file: ${configPath}. Expected a config.json file.`,
          agentId
        );
        logger.error('Config path is a directory', {
          agentId,
          configPath,
        });
        throw error;
      }
    } catch (err) {
      if (err instanceof ConfigLoadError) {
        throw err;
      }
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
