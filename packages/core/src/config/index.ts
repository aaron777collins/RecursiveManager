/**
 * Agent Configuration Management (Phase 2.1)
 *
 * This module handles loading, saving, and validating agent configuration files.
 * Implements atomic writes, backup recovery, and schema validation.
 *
 * Note: loadAgentConfig and ConfigLoadError have been moved to @recursive-manager/common
 * to resolve circular dependency between core and adapters packages. They are re-exported
 * here for backward compatibility.
 */

import {
  getConfigPath,
  validateAgentConfigStrict,
  createAgentLogger,
  atomicWrite,
  createBackup,
  type AgentConfig,
  type PathOptions,
  // Re-export from common for backward compatibility
  loadAgentConfig as loadAgentConfigFromCommon,
  ConfigLoadError as ConfigLoadErrorFromCommon,
} from '@recursive-manager/common';
import { validateAgentConfigBusinessLogicStrict } from '../validation/business-validation';

/**
 * Re-export loadAgentConfig from common for backward compatibility
 */
export const loadAgentConfig = loadAgentConfigFromCommon;

/**
 * Re-export ConfigLoadError from common for backward compatibility
 * Export both the class (value) and the type
 */
export const ConfigLoadError = ConfigLoadErrorFromCommon;
export type ConfigLoadError = ConfigLoadErrorFromCommon;

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
 * Load agent configuration with business logic validation
 *
 * This is a wrapper around loadAgentConfig from @recursive-manager/common that
 * additionally performs business logic validation (which requires core package).
 *
 * For basic config loading without business validation, use the loadAgentConfig
 * from @recursive-manager/common directly.
 *
 * @param agentId - The unique identifier of the agent
 * @param options - Optional path resolution options
 * @returns Promise resolving to the validated agent configuration
 * @throws {ConfigLoadError} If the configuration cannot be loaded
 * @throws {SchemaValidationError} If the configuration fails schema validation
 * @throws {BusinessValidationFailure} If business logic validation fails
 */
export async function loadAgentConfigWithBusinessValidation(
  agentId: string,
  options: PathOptions = {}
): Promise<AgentConfig> {
  const logger = createAgentLogger(agentId);

  try {
    // Load config with schema validation (from common package)
    const config = await loadAgentConfig(agentId, options);

    // Perform business logic validation (core-specific)
    validateAgentConfigBusinessLogicStrict(config);

    logger.info('Agent configuration loaded and validated successfully', {
      agentId,
      role: config.identity.role,
      version: config.version,
    });

    return config;
  } catch (err) {
    logger.error('Failed to load agent configuration with business validation', {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
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
    logger.debug('Validating agent configuration schema', { agentId });
    validateAgentConfigStrict(config);

    // 2. Validate business logic (throws BusinessValidationFailure if invalid)
    logger.debug('Validating agent configuration business logic', { agentId });
    validateAgentConfigBusinessLogicStrict(config);

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
    // Re-throw ConfigSaveError, SchemaValidationError, and BusinessValidationFailure as-is
    if (
      err instanceof ConfigSaveError ||
      (err instanceof Error && err.name === 'SchemaValidationError') ||
      (err instanceof Error && err.name === 'BusinessValidationFailure')
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

/**
 * Generate a default agent configuration with sensible defaults
 *
 * This function creates a complete agent configuration object with:
 * 1. All required fields populated
 * 2. Sensible defaults based on the agent's role
 * 3. Optional fields populated with schema defaults
 * 4. Ready to be validated and saved
 *
 * The generated configuration follows the agent-config.schema.json schema
 * and can be customized by the caller before saving.
 *
 * @param role - The role/job title of the agent (e.g., "Developer", "QA Engineer")
 * @param goal - The main goal the agent should achieve
 * @param createdBy - The ID of the agent or user creating this agent
 * @param options - Optional configuration overrides
 * @returns A complete agent configuration object with all defaults
 *
 * @example
 * ```typescript
 * const config = generateDefaultConfig(
 *   "Senior Developer",
 *   "Implement new authentication system",
 *   "CEO"
 * );
 * await saveAgentConfig(config.identity.id, config);
 * ```
 */
export function generateDefaultConfig(
  role: string,
  goal: string,
  createdBy: string,
  options: {
    id?: string;
    displayName?: string;
    reportingTo?: string | null;
    canHire?: boolean;
    maxSubordinates?: number;
    hiringBudget?: number;
    primaryFramework?: 'claude-code' | 'opencode';
    workspaceQuotaMB?: number;
    maxExecutionMinutes?: number;
  } = {}
): AgentConfig {
  // Generate a unique ID if not provided
  // Use role slug + timestamp + random suffix for uniqueness
  const roleSlug = role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 6);

  const agentId =
    options.id ||
    (roleSlug ? `${roleSlug}-${timestamp}-${randomSuffix}` : `agent-${timestamp}-${randomSuffix}`);

  // Generate display name if not provided
  const displayName = options.displayName || role;

  // Create the configuration with all defaults
  const config: AgentConfig = {
    version: '1.0.0',
    identity: {
      id: agentId,
      role,
      displayName,
      createdAt: new Date().toISOString(),
      createdBy,
      reportingTo: options.reportingTo ?? null,
    },
    goal: {
      mainGoal: goal,
      subGoals: [],
      successCriteria: [],
    },
    permissions: {
      canHire: options.canHire ?? false,
      maxSubordinates: options.maxSubordinates ?? 0,
      hiringBudget: options.hiringBudget ?? 0,
      canFire: false,
      canEscalate: true,
      canAccessExternalAPIs: false,
      allowedDomains: [],
      workspaceQuotaMB: options.workspaceQuotaMB ?? 1024,
      maxExecutionMinutes: options.maxExecutionMinutes ?? 60,
    },
    framework: {
      primary: options.primaryFramework ?? 'claude-code',
      capabilities: ['code-generation', 'file-operations'],
    },
    communication: {
      preferredChannels: ['internal'],
      notifyManager: {
        onTaskComplete: true,
        onError: true,
        onHire: true,
        onFire: true,
      },
      updateFrequency: 'daily',
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
        delegateThreshold: 'non-trivial',
        keepWhenDelegating: true,
        supervisionLevel: 'moderate',
      },
    },
    metadata: {
      tags: [],
      priority: 'medium',
    },
  };

  return config;
}

/**
 * Deep partial type that makes all nested properties optional recursively
 */
export type DeepPartial<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [P in keyof T]?: T[P] extends Array<any>
    ? T[P] // Arrays are not made partial
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
};

/**
 * Merge two agent configurations with proper precedence
 *
 * This function performs a deep merge of two agent configurations, where:
 * 1. The override config takes precedence over the base config
 * 2. Nested objects are merged recursively (not replaced entirely)
 * 3. Arrays in override replace arrays in base (no array merging)
 * 4. Primitive values in override replace those in base
 * 5. Undefined values in override don't replace defined values in base
 * 6. Null values in override DO replace values in base
 *
 * Use cases:
 * - Applying custom configuration overrides to default configs
 * - Updating agent configs while preserving existing values
 * - Templating configs with partial overrides
 *
 * @param base - The base configuration (defaults)
 * @param override - The override configuration (custom values)
 * @returns A new configuration object with override applied to base
 *
 * @example
 * ```typescript
 * const base = generateDefaultConfig("Developer", "Build features", "CEO");
 * const override = {
 *   permissions: {
 *     canHire: true,
 *     maxSubordinates: 5,
 *   },
 *   behavior: {
 *     verbosity: 3,
 *   },
 * };
 * const merged = mergeConfigs(base, override);
 * // merged.permissions.canHire = true (from override)
 * // merged.permissions.workspaceQuotaMB = 1024 (from base)
 * // merged.behavior.verbosity = 3 (from override)
 * // merged.behavior.continuousMode = undefined (from base)
 * ```
 */
export function mergeConfigs(base: AgentConfig, override: DeepPartial<AgentConfig>): AgentConfig {
  // Helper function to check if a value is a plain object
  const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      Object.prototype.toString.call(value) === '[object Object]'
    );
  };

  // Helper function to deep merge two objects
  const deepMerge = <T extends Record<string, unknown>>(target: T, source: Partial<T>): T => {
    const result = { ...target };

    for (const key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        continue;
      }

      const sourceValue = source[key];
      const targetValue = target[key];

      // If source value is undefined, keep target value
      if (sourceValue === undefined) {
        continue;
      }

      // If source value is null, use it (null is an explicit override)
      if (sourceValue === null) {
        result[key] = sourceValue as T[Extract<keyof T, string>];
        continue;
      }

      // If both are plain objects, recursively merge them
      if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
        continue;
      }

      // Otherwise, source value replaces target value
      // This includes:
      // - Arrays (replace, don't merge)
      // - Primitives (string, number, boolean)
      // - Functions
      // - Any other type
      result[key] = sourceValue as T[Extract<keyof T, string>];
    }

    return result;
  };

  // Perform the merge
  // We need to cast through unknown because TypeScript can't infer the complex generic types
  return deepMerge(
    base as unknown as Record<string, unknown>,
    override as Record<string, unknown>
  ) as unknown as AgentConfig;
}
