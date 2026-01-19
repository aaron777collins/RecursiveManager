/**
 * File recovery utilities for handling corrupted configuration files
 *
 * This module provides error recovery mechanisms for corrupt files:
 * - Corruption detection via JSON parsing and schema validation
 * - Backup restoration
 * - Recovery status tracking
 *
 * Recovery priority:
 * 1. Restore from latest valid backup
 * 2. Database rebuild (future: Phase 1.3+)
 * 3. Throw error if all recovery methods fail
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

/**
 * Information about detected file corruption
 */
export interface CorruptionInfo {
  /**
   * Path to the corrupted file
   */
  filePath: string;

  /**
   * Type of corruption detected
   */
  corruptionType: 'parse_error' | 'validation_error' | 'missing_file' | 'read_error';

  /**
   * Original error that triggered corruption detection
   */
  originalError: Error;

  /**
   * Timestamp when corruption was detected
   */
  detectedAt: Date;
}

/**
 * Result of a recovery attempt
 */
export interface RecoveryResult {
  /**
   * Whether recovery was successful
   */
  success: boolean;

  /**
   * Recovery method that succeeded (if successful)
   */
  method?: 'backup' | 'database' | 'none';

  /**
   * Path to the backup file used (if backup recovery)
   */
  backupPath?: string;

  /**
   * Error message if recovery failed
   */
  error?: string;

  /**
   * Timestamp when recovery was attempted
   */
  attemptedAt: Date;
}

/**
 * Options for recovery attempts
 */
export interface RecoveryOptions {
  /**
   * Directory where backups are stored (default: same directory as file with .backup suffix)
   */
  backupDir?: string;

  /**
   * Whether to validate the recovered file before accepting it (default: true)
   */
  validate?: boolean;

  /**
   * Validation function to check if recovered content is valid
   */
  validator?: (content: string) => Promise<boolean> | boolean;

  /**
   * Whether to create a backup of the corrupt file before recovery (default: true)
   */
  backupCorruptFile?: boolean;
}

/**
 * Custom error class for file corruption
 */
export class CorruptionError extends Error {
  constructor(
    message: string,
    public readonly corruptionInfo: CorruptionInfo,
    public readonly recoveryResult?: RecoveryResult
  ) {
    super(message);
    this.name = 'CorruptionError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CorruptionError);
    }
  }
}

/**
 * Detects if a file is corrupted by attempting to read and parse it
 *
 * @param filePath - Path to the file to check
 * @param validator - Optional validation function to check content validity
 * @returns CorruptionInfo if file is corrupted, null if file is valid
 *
 * @example
 * ```typescript
 * const corruption = await detectCorruption('/path/to/config.json');
 * if (corruption) {
 *   console.error(`File corrupted: ${corruption.corruptionType}`);
 * }
 * ```
 */
export async function detectCorruption(
  filePath: string,
  validator?: (content: string) => Promise<boolean> | boolean
): Promise<CorruptionInfo | null> {
  try {
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return {
        filePath,
        corruptionType: 'missing_file',
        originalError: err as Error,
        detectedAt: new Date(),
      };
    }

    // Try to read file
    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf-8');
    } catch (err) {
      return {
        filePath,
        corruptionType: 'read_error',
        originalError: err as Error,
        detectedAt: new Date(),
      };
    }

    // Try to parse as JSON (most config files are JSON)
    try {
      JSON.parse(content);
    } catch (err) {
      return {
        filePath,
        corruptionType: 'parse_error',
        originalError: err as Error,
        detectedAt: new Date(),
      };
    }

    // Run custom validator if provided
    if (validator) {
      try {
        const isValid = await validator(content);
        if (!isValid) {
          return {
            filePath,
            corruptionType: 'validation_error',
            originalError: new Error('Custom validation failed'),
            detectedAt: new Date(),
          };
        }
      } catch (err) {
        return {
          filePath,
          corruptionType: 'validation_error',
          originalError: err as Error,
          detectedAt: new Date(),
        };
      }
    }

    // File is valid
    return null;
  } catch (err) {
    // Unexpected error during detection
    return {
      filePath,
      corruptionType: 'read_error',
      originalError: err as Error,
      detectedAt: new Date(),
    };
  }
}

/**
 * Synchronous version of detectCorruption
 */
export function detectCorruptionSync(
  filePath: string,
  validator?: (content: string) => boolean
): CorruptionInfo | null {
  try {
    // Check if file exists
    try {
      fsSync.accessSync(filePath);
    } catch (err) {
      return {
        filePath,
        corruptionType: 'missing_file',
        originalError: err as Error,
        detectedAt: new Date(),
      };
    }

    // Try to read file
    let content: string;
    try {
      content = fsSync.readFileSync(filePath, 'utf-8');
    } catch (err) {
      return {
        filePath,
        corruptionType: 'read_error',
        originalError: err as Error,
        detectedAt: new Date(),
      };
    }

    // Try to parse as JSON
    try {
      JSON.parse(content);
    } catch (err) {
      return {
        filePath,
        corruptionType: 'parse_error',
        originalError: err as Error,
        detectedAt: new Date(),
      };
    }

    // Run custom validator if provided
    if (validator) {
      try {
        const isValid = validator(content);
        if (!isValid) {
          return {
            filePath,
            corruptionType: 'validation_error',
            originalError: new Error('Custom validation failed'),
            detectedAt: new Date(),
          };
        }
      } catch (err) {
        return {
          filePath,
          corruptionType: 'validation_error',
          originalError: err as Error,
          detectedAt: new Date(),
        };
      }
    }

    return null;
  } catch (err) {
    return {
      filePath,
      corruptionType: 'read_error',
      originalError: err as Error,
      detectedAt: new Date(),
    };
  }
}

/**
 * Finds the latest valid backup file for a given file path
 *
 * Searches for backup files with pattern: filename.YYYY-MM-DD_HH-mm-ss.backup
 *
 * @param filePath - Path to the original file
 * @param options - Recovery options
 * @returns Path to the latest valid backup, or null if none found
 */
export async function findLatestBackup(
  filePath: string,
  options: RecoveryOptions = {}
): Promise<string | null> {
  const { backupDir, validator } = options;

  // Determine backup directory
  const dir = backupDir || path.dirname(filePath);
  const ext = path.extname(filePath);
  const basename = path.basename(filePath, ext);

  try {
    // Read all files in backup directory
    const files = await fs.readdir(dir);

    // Filter for backup files matching the pattern created by createBackup():
    // basename.YYYY-MM-DDTHH-MM-SS-mmm.ext
    // Example: config.2026-01-18T12-34-56-789.json
    const escapedBasename = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedExt = ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const backupPattern = new RegExp(
      `^${escapedBasename}\\.\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}${escapedExt}$`
    );

    const backupFiles = files
      .filter((f) => backupPattern.test(f))
      .map((f) => path.join(dir, f))
      .sort()
      .reverse(); // Most recent first

    // Find first valid backup
    for (const backupPath of backupFiles) {
      const corruption = await detectCorruption(backupPath, validator);
      if (!corruption) {
        return backupPath;
      }
    }

    return null;
  } catch (err) {
    // Directory doesn't exist or can't be read
    return null;
  }
}

/**
 * Synchronous version of findLatestBackup
 */
export function findLatestBackupSync(
  filePath: string,
  options: RecoveryOptions = {}
): string | null {
  const { backupDir, validator } = options;

  const dir = backupDir || path.dirname(filePath);
  const ext = path.extname(filePath);
  const basename = path.basename(filePath, ext);

  try {
    const files = fsSync.readdirSync(dir);

    // Filter for backup files matching the pattern created by createBackup():
    // basename.YYYY-MM-DDTHH-MM-SS-mmm.ext
    const escapedBasename = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedExt = ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const backupPattern = new RegExp(
      `^${escapedBasename}\\.\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}${escapedExt}$`
    );

    const backupFiles = files
      .filter((f) => backupPattern.test(f))
      .map((f) => path.join(dir, f))
      .sort()
      .reverse();

    for (const backupPath of backupFiles) {
      const syncValidator = validator
        ? (content: string) => {
            const result = validator(content);
            return result instanceof Promise ? false : result;
          }
        : undefined;

      const corruption = detectCorruptionSync(backupPath, syncValidator);
      if (!corruption) {
        return backupPath;
      }
    }

    return null;
  } catch (err) {
    return null;
  }
}

/**
 * Attempts to recover a corrupted file using available recovery methods
 *
 * Recovery priority:
 * 1. Restore from latest valid backup
 * 2. Database rebuild (not yet implemented - placeholder for Phase 1.3+)
 * 3. Fail with error
 *
 * @param filePath - Path to the corrupted file
 * @param options - Recovery options
 * @returns RecoveryResult with success status and method used
 * @throws CorruptionError if recovery fails
 *
 * @example
 * ```typescript
 * try {
 *   const result = await attemptRecovery('/path/to/corrupt.json');
 *   console.log(`Recovered using ${result.method}`);
 * } catch (err) {
 *   console.error('Recovery failed:', err);
 * }
 * ```
 */
export async function attemptRecovery(
  filePath: string,
  options: RecoveryOptions = {}
): Promise<RecoveryResult> {
  const { backupCorruptFile = true, validator } = options;

  const result: RecoveryResult = {
    success: false,
    attemptedAt: new Date(),
  };

  try {
    // Backup the corrupt file before attempting recovery
    if (backupCorruptFile) {
      try {
        const corruptBackupPath = `${filePath}.corrupt.${Date.now()}`;
        await fs.copyFile(filePath, corruptBackupPath);
      } catch (err) {
        // Not critical if this fails
      }
    }

    // Method 1: Try to restore from backup
    const backupPath = await findLatestBackup(filePath, options);
    if (backupPath) {
      await fs.copyFile(backupPath, filePath);

      // Verify the restored file is valid
      const corruption = await detectCorruption(filePath, validator);
      if (!corruption) {
        result.success = true;
        result.method = 'backup';
        result.backupPath = backupPath;
        return result;
      }
    }

    // Method 2: Database rebuild (placeholder for Phase 1.3+)
    // This will be implemented when the database layer is available
    // For now, we skip this step

    // All recovery methods failed
    result.success = false;
    result.error = 'No valid recovery method found';
    return result;
  } catch (err) {
    result.success = false;
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

/**
 * Synchronous version of attemptRecovery
 */
export function attemptRecoverySync(
  filePath: string,
  options: RecoveryOptions = {}
): RecoveryResult {
  const { backupCorruptFile = true, validator } = options;

  const result: RecoveryResult = {
    success: false,
    attemptedAt: new Date(),
  };

  try {
    // Backup the corrupt file
    if (backupCorruptFile) {
      try {
        const corruptBackupPath = `${filePath}.corrupt.${Date.now()}`;
        fsSync.copyFileSync(filePath, corruptBackupPath);
      } catch (err) {
        // Not critical
      }
    }

    // Try to restore from backup
    const syncValidator = validator
      ? (content: string) => {
          const validatorResult = validator(content);
          return validatorResult instanceof Promise ? false : validatorResult;
        }
      : undefined;

    const backupPath = findLatestBackupSync(filePath, {
      ...options,
      validator: syncValidator,
    });

    if (backupPath) {
      fsSync.copyFileSync(backupPath, filePath);

      const corruption = detectCorruptionSync(filePath, syncValidator);
      if (!corruption) {
        result.success = true;
        result.method = 'backup';
        result.backupPath = backupPath;
        return result;
      }
    }

    result.success = false;
    result.error = 'No valid recovery method found';
    return result;
  } catch (err) {
    result.success = false;
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

/**
 * Safely loads a file with automatic corruption detection and recovery
 *
 * This is a high-level convenience function that combines detection and recovery.
 *
 * @param filePath - Path to the file to load
 * @param options - Recovery options
 * @returns File content as string
 * @throws CorruptionError if file is corrupt and cannot be recovered
 *
 * @example
 * ```typescript
 * try {
 *   const content = await safeLoad('/path/to/config.json', {
 *     validator: (content) => {
 *       const data = JSON.parse(content);
 *       return validateAgentConfig(data);
 *     }
 *   });
 *   const config = JSON.parse(content);
 * } catch (err) {
 *   if (err instanceof CorruptionError) {
 *     console.error('File corrupted and recovery failed');
 *   }
 * }
 * ```
 */
export async function safeLoad(filePath: string, options: RecoveryOptions = {}): Promise<string> {
  const { validator } = options;

  // Detect corruption
  const corruption = await detectCorruption(filePath, validator);

  if (corruption) {
    // File is corrupted, attempt recovery
    const recoveryResult = await attemptRecovery(filePath, options);

    if (!recoveryResult.success) {
      throw new CorruptionError(
        `File corrupted and recovery failed: ${filePath}`,
        corruption,
        recoveryResult
      );
    }

    // Recovery succeeded, read the recovered file
    return await fs.readFile(filePath, 'utf-8');
  }

  // File is valid, read normally
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * Synchronous version of safeLoad
 */
export function safeLoadSync(filePath: string, options: RecoveryOptions = {}): string {
  const { validator } = options;

  const syncValidator = validator
    ? (content: string) => {
        const result = validator(content);
        return result instanceof Promise ? false : result;
      }
    : undefined;

  const corruption = detectCorruptionSync(filePath, syncValidator);

  if (corruption) {
    const recoveryResult = attemptRecoverySync(filePath, {
      ...options,
      validator: syncValidator,
    });

    if (!recoveryResult.success) {
      throw new CorruptionError(
        `File corrupted and recovery failed: ${filePath}`,
        corruption,
        recoveryResult
      );
    }

    return fsSync.readFileSync(filePath, 'utf-8');
  }

  return fsSync.readFileSync(filePath, 'utf-8');
}
