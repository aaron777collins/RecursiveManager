/**
 * Directory permission handling utilities
 *
 * This module provides utilities for managing directory permissions in the RecursiveManager system.
 * All agent directories, workspace directories, and system directories require proper permissions
 * to ensure the system can function correctly.
 *
 * Default directory permissions: 0o755 (drwxr-xr-x)
 * - Owner: read, write, execute
 * - Group: read, execute
 * - Others: read, execute
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

/**
 * Default directory permissions (0o755)
 */
export const DEFAULT_DIRECTORY_MODE = 0o755;

/**
 * Options for directory permission operations
 */
export interface DirectoryPermissionOptions {
  /**
   * File permissions mode (default: 0o755)
   */
  mode?: number;

  /**
   * Create parent directories recursively (default: true)
   */
  recursive?: boolean;

  /**
   * Set ownership to current process user (default: false)
   * Note: Requires appropriate system permissions
   */
  setOwnership?: boolean;
}

/**
 * Result of a permission check operation
 */
export interface PermissionCheckResult {
  /**
   * Whether the directory is readable
   */
  readable: boolean;

  /**
   * Whether the directory is writable
   */
  writable: boolean;

  /**
   * Whether the directory is executable (for directories, this means "searchable")
   */
  executable: boolean;

  /**
   * File mode in octal format (e.g., 0o755)
   */
  mode: number;

  /**
   * Owner user ID (UID)
   */
  owner?: number;

  /**
   * Group ID (GID)
   */
  group?: number;
}

/**
 * Error thrown when directory permission operations fail
 */
export class PermissionError extends Error {
  constructor(
    message: string,
    public readonly dirPath?: string,
    public readonly requiredMode?: number,
    public readonly actualMode?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'PermissionError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PermissionError);
    }
  }
}

/**
 * Check if a directory has read and write permissions
 *
 * This function verifies that the current process can read from and write to
 * the specified directory. It throws an error if permissions are insufficient.
 *
 * @param dirPath - Path to the directory to check
 * @throws PermissionError if directory doesn't exist or permissions are insufficient
 *
 * @example
 * ```typescript
 * await checkDirectoryPermissions('/path/to/agent/workspace');
 * ```
 */
export async function checkDirectoryPermissions(dirPath: string): Promise<void> {
  const absolutePath = path.resolve(dirPath);

  try {
    // Check both read and write access
    await fs.access(absolutePath, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    // Check if directory exists
    try {
      await fs.stat(absolutePath);
      // Directory exists but we don't have permissions
      throw new PermissionError(
        `Insufficient permissions for directory ${absolutePath}: Cannot read or write`,
        absolutePath,
        undefined,
        undefined,
        err
      );
    } catch (statError) {
      // Directory doesn't exist
      throw new PermissionError(
        `Directory does not exist: ${absolutePath}`,
        absolutePath,
        undefined,
        undefined,
        err
      );
    }
  }
}

/**
 * Synchronous version of checkDirectoryPermissions
 *
 * @param dirPath - Path to the directory to check
 * @throws PermissionError if directory doesn't exist or permissions are insufficient
 */
export function checkDirectoryPermissionsSync(dirPath: string): void {
  const absolutePath = path.resolve(dirPath);

  try {
    fsSync.accessSync(absolutePath, fs.constants.R_OK | fs.constants.W_OK);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    // Check if directory exists
    try {
      fsSync.statSync(absolutePath);
      // Directory exists but we don't have permissions
      throw new PermissionError(
        `Insufficient permissions for directory ${absolutePath}: Cannot read or write`,
        absolutePath,
        undefined,
        undefined,
        err
      );
    } catch {
      // Directory doesn't exist
      throw new PermissionError(
        `Directory does not exist: ${absolutePath}`,
        absolutePath,
        undefined,
        undefined,
        err
      );
    }
  }
}

/**
 * Ensure a directory exists with proper permissions
 *
 * This function creates the directory if it doesn't exist, or updates its permissions
 * if it does. By default, it creates parent directories recursively with 0o755 permissions.
 *
 * @param dirPath - Path to the directory to create/ensure
 * @param options - Options for directory creation and permissions
 * @throws PermissionError if the operation fails
 *
 * @example
 * ```typescript
 * // Create directory with default permissions (0o755)
 * await ensureDirectoryPermissions('/path/to/agent/workspace');
 *
 * // Create with custom permissions
 * await ensureDirectoryPermissions('/path/to/logs', { mode: 0o770 });
 *
 * // Create and set ownership to current user
 * await ensureDirectoryPermissions('/path/to/agent', { setOwnership: true });
 * ```
 */
export async function ensureDirectoryPermissions(
  dirPath: string,
  options: DirectoryPermissionOptions = {}
): Promise<void> {
  const { mode = DEFAULT_DIRECTORY_MODE, recursive = true, setOwnership = false } = options;

  const absolutePath = path.resolve(dirPath);

  try {
    // Create directory if it doesn't exist
    await fs.mkdir(absolutePath, { recursive, mode });

    // Set ownership if requested and possible
    if (setOwnership) {
      try {
        const uid = process.getuid?.();
        const gid = process.getgid?.();

        if (uid !== undefined && gid !== undefined) {
          await fs.chown(absolutePath, uid, gid);
        }
      } catch (chownError) {
        // Log warning but don't fail - ownership setting is best-effort
        // (may not have permissions, or running on Windows)
        const err = chownError as Error;
        console.warn(`Warning: Could not set ownership for ${absolutePath}: ${err.message}`);
      }
    }

    // Ensure permissions are set correctly (mkdir might not set exact mode on all systems)
    await fs.chmod(absolutePath, mode);
  } catch (error) {
    const err = error as Error;
    throw new PermissionError(
      `Failed to ensure directory permissions for ${absolutePath}: ${err.message}`,
      absolutePath,
      mode,
      undefined,
      err
    );
  }
}

/**
 * Synchronous version of ensureDirectoryPermissions
 *
 * @param dirPath - Path to the directory to create/ensure
 * @param options - Options for directory creation and permissions
 * @throws PermissionError if the operation fails
 */
export function ensureDirectoryPermissionsSync(
  dirPath: string,
  options: DirectoryPermissionOptions = {}
): void {
  const { mode = DEFAULT_DIRECTORY_MODE, recursive = true, setOwnership = false } = options;

  const absolutePath = path.resolve(dirPath);

  try {
    // Create directory if it doesn't exist
    fsSync.mkdirSync(absolutePath, { recursive, mode });

    // Set ownership if requested and possible
    if (setOwnership) {
      try {
        const uid = process.getuid?.();
        const gid = process.getgid?.();

        if (uid !== undefined && gid !== undefined) {
          fsSync.chownSync(absolutePath, uid, gid);
        }
      } catch (chownError) {
        const err = chownError as Error;
        console.warn(`Warning: Could not set ownership for ${absolutePath}: ${err.message}`);
      }
    }

    // Ensure permissions are set correctly
    fsSync.chmodSync(absolutePath, mode);
  } catch (error) {
    const err = error as Error;
    throw new PermissionError(
      `Failed to ensure directory permissions for ${absolutePath}: ${err.message}`,
      absolutePath,
      mode,
      undefined,
      err
    );
  }
}

/**
 * Set permissions on an existing directory
 *
 * This function updates the permissions of an existing directory. It does not
 * create the directory if it doesn't exist.
 *
 * @param dirPath - Path to the directory
 * @param mode - New permissions mode (e.g., 0o755)
 * @throws PermissionError if directory doesn't exist or operation fails
 *
 * @example
 * ```typescript
 * await setDirectoryPermissions('/path/to/agent', 0o755);
 * ```
 */
export async function setDirectoryPermissions(dirPath: string, mode: number): Promise<void> {
  const absolutePath = path.resolve(dirPath);

  try {
    // Verify directory exists
    const stats = await fs.stat(absolutePath);

    if (!stats.isDirectory()) {
      throw new PermissionError(`Path is not a directory: ${absolutePath}`, absolutePath, mode);
    }

    // Set permissions
    await fs.chmod(absolutePath, mode);
  } catch (error) {
    const err = error as Error;

    // If it's already a PermissionError, re-throw it
    if (err instanceof PermissionError) {
      throw err;
    }

    throw new PermissionError(
      `Failed to set permissions for directory ${absolutePath}: ${err.message}`,
      absolutePath,
      mode,
      undefined,
      err
    );
  }
}

/**
 * Synchronous version of setDirectoryPermissions
 *
 * @param dirPath - Path to the directory
 * @param mode - New permissions mode (e.g., 0o755)
 * @throws PermissionError if directory doesn't exist or operation fails
 */
export function setDirectoryPermissionsSync(dirPath: string, mode: number): void {
  const absolutePath = path.resolve(dirPath);

  try {
    // Verify directory exists
    const stats = fsSync.statSync(absolutePath);

    if (!stats.isDirectory()) {
      throw new PermissionError(`Path is not a directory: ${absolutePath}`, absolutePath, mode);
    }

    // Set permissions
    fsSync.chmodSync(absolutePath, mode);
  } catch (error) {
    const err = error as Error;

    if (err instanceof PermissionError) {
      throw err;
    }

    throw new PermissionError(
      `Failed to set permissions for directory ${absolutePath}: ${err.message}`,
      absolutePath,
      mode,
      undefined,
      err
    );
  }
}

/**
 * Get the current permissions of a directory
 *
 * This function retrieves the permission mode and ownership information
 * for a directory.
 *
 * @param dirPath - Path to the directory
 * @returns Permission check result with mode and ownership info
 * @throws PermissionError if directory doesn't exist
 *
 * @example
 * ```typescript
 * const result = await getDirectoryPermissions('/path/to/agent');
 * console.log(`Mode: ${result.mode.toString(8)}`); // e.g., "755"
 * console.log(`Readable: ${result.readable}`);
 * ```
 */
export async function getDirectoryPermissions(dirPath: string): Promise<PermissionCheckResult> {
  const absolutePath = path.resolve(dirPath);

  try {
    // Get directory stats
    const stats = await fs.stat(absolutePath);

    if (!stats.isDirectory()) {
      throw new PermissionError(`Path is not a directory: ${absolutePath}`, absolutePath);
    }

    // Extract permission bits (mask out file type bits)
    const mode = stats.mode & 0o777;

    // Check read, write, and execute permissions
    let readable = false;
    let writable = false;
    let executable = false;

    try {
      await fs.access(absolutePath, fs.constants.R_OK);
      readable = true;
    } catch {
      // Not readable
    }

    try {
      await fs.access(absolutePath, fs.constants.W_OK);
      writable = true;
    } catch {
      // Not writable
    }

    try {
      await fs.access(absolutePath, fs.constants.X_OK);
      executable = true;
    } catch {
      // Not executable
    }

    return {
      readable,
      writable,
      executable,
      mode,
      owner: stats.uid,
      group: stats.gid,
    };
  } catch (error) {
    const err = error as Error;

    if (err instanceof PermissionError) {
      throw err;
    }

    throw new PermissionError(
      `Failed to get permissions for directory ${absolutePath}: ${err.message}`,
      absolutePath,
      undefined,
      undefined,
      err
    );
  }
}

/**
 * Synchronous version of getDirectoryPermissions
 *
 * @param dirPath - Path to the directory
 * @returns Permission check result with mode and ownership info
 * @throws PermissionError if directory doesn't exist
 */
export function getDirectoryPermissionsSync(dirPath: string): PermissionCheckResult {
  const absolutePath = path.resolve(dirPath);

  try {
    // Get directory stats
    const stats = fsSync.statSync(absolutePath);

    if (!stats.isDirectory()) {
      throw new PermissionError(`Path is not a directory: ${absolutePath}`, absolutePath);
    }

    // Extract permission bits
    const mode = stats.mode & 0o777;

    // Check permissions
    let readable = false;
    let writable = false;
    let executable = false;

    try {
      fsSync.accessSync(absolutePath, fs.constants.R_OK);
      readable = true;
    } catch {
      // Not readable
    }

    try {
      fsSync.accessSync(absolutePath, fs.constants.W_OK);
      writable = true;
    } catch {
      // Not writable
    }

    try {
      fsSync.accessSync(absolutePath, fs.constants.X_OK);
      executable = true;
    } catch {
      // Not executable
    }

    return {
      readable,
      writable,
      executable,
      mode,
      owner: stats.uid,
      group: stats.gid,
    };
  } catch (error) {
    const err = error as Error;

    if (err instanceof PermissionError) {
      throw err;
    }

    throw new PermissionError(
      `Failed to get permissions for directory ${absolutePath}: ${err.message}`,
      absolutePath,
      undefined,
      undefined,
      err
    );
  }
}

/**
 * Validate that a directory has sufficient permissions
 *
 * This function checks if a directory exists and has at least the specified
 * permissions. By default, it checks for read and write access.
 *
 * @param dirPath - Path to the directory
 * @param requiredMode - Required permission mode (optional, for validation against specific mode)
 * @returns true if permissions are sufficient, false otherwise
 *
 * @example
 * ```typescript
 * // Check if directory is readable and writable
 * const isValid = await validateDirectoryPermissions('/path/to/agent');
 *
 * // Check if directory has specific mode
 * const hasMode = await validateDirectoryPermissions('/path/to/agent', 0o755);
 * ```
 */
export async function validateDirectoryPermissions(
  dirPath: string,
  requiredMode?: number
): Promise<boolean> {
  try {
    const result = await getDirectoryPermissions(dirPath);

    // If no specific mode required, just check read/write access
    if (requiredMode === undefined) {
      return result.readable && result.writable;
    }

    // Check if mode matches exactly
    return result.mode === requiredMode;
  } catch {
    // Directory doesn't exist or we can't read permissions
    return false;
  }
}

/**
 * Synchronous version of validateDirectoryPermissions
 *
 * @param dirPath - Path to the directory
 * @param requiredMode - Required permission mode (optional)
 * @returns true if permissions are sufficient, false otherwise
 */
export function validateDirectoryPermissionsSync(dirPath: string, requiredMode?: number): boolean {
  try {
    const result = getDirectoryPermissionsSync(dirPath);

    if (requiredMode === undefined) {
      return result.readable && result.writable;
    }

    return result.mode === requiredMode;
  } catch {
    return false;
  }
}
