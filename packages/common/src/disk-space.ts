/**
 * Disk Space Utilities (Phase 1.2.5)
 *
 * Provides utilities for checking available disk space to prevent
 * disk full errors (EC-5.1: Disk Full from edge case documentation).
 *
 * Key features:
 * - Check available disk space for a given path
 * - Verify sufficient space before operations
 * - Both async and sync variants
 * - Cross-platform support (Linux, macOS, Windows)
 * - Configurable minimum space thresholds
 */

import { statfs, statfsSync } from 'fs';
import { promisify } from 'util';
import * as path from 'path';

const statfsAsync = promisify(statfs);

// Default minimum free space: 100MB
export const DEFAULT_MIN_FREE_SPACE_BYTES = 100 * 1024 * 1024;

// Default minimum free percentage: 5%
export const DEFAULT_MIN_FREE_PERCENT = 5;

/**
 * Custom error class for disk space errors
 */
export class DiskSpaceError extends Error {
  constructor(
    message: string,
    public readonly path: string,
    public readonly availableBytes: number,
    public readonly totalBytes: number,
    public readonly requiredBytes?: number,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'DiskSpaceError';
    Object.setPrototypeOf(this, DiskSpaceError.prototype);
  }
}

/**
 * Disk space information for a given path
 */
export interface DiskSpaceInfo {
  /** Absolute path that was checked */
  path: string;
  /** Total bytes on the filesystem */
  totalBytes: number;
  /** Free bytes available to all users */
  freeBytes: number;
  /** Available bytes for current user (may be less than freeBytes due to reserved space) */
  availableBytes: number;
  /** Used bytes */
  usedBytes: number;
  /** Percentage of disk used (0-100) */
  usedPercent: number;
  /** Percentage of disk available (0-100) */
  availablePercent: number;
}

/**
 * Options for disk space checking
 */
export interface CheckDiskSpaceOptions {
  /** Minimum required free space in bytes */
  minFreeBytes?: number;
  /** Minimum required free space as percentage (0-100) */
  minFreePercent?: number;
}

/**
 * Result of a disk space sufficiency check
 */
export interface DiskSpaceSufficiencyResult {
  /** Whether there is sufficient disk space */
  sufficient: boolean;
  /** Disk space information */
  info: DiskSpaceInfo;
  /** Reason if insufficient (undefined if sufficient) */
  reason?: string;
  /** Missing bytes if insufficient (undefined if sufficient) */
  missingBytes?: number;
}

/**
 * Get disk space information for a given path (async)
 *
 * @param targetPath - Path to check (file or directory)
 * @returns Disk space information
 * @throws {DiskSpaceError} If unable to get disk space information
 *
 * @example
 * ```typescript
 * const info = await getDiskSpace('/var/data');
 * console.log(`Available: ${info.availableBytes} bytes`);
 * console.log(`Used: ${info.usedPercent}%`);
 * ```
 */
export async function getDiskSpace(targetPath: string): Promise<DiskSpaceInfo> {
  const absolutePath = path.resolve(targetPath);

  try {
    const stats = await statfsAsync(absolutePath);

    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    const availableBytes = stats.bavail * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
    const availablePercent = totalBytes > 0 ? (availableBytes / totalBytes) * 100 : 0;

    return {
      path: absolutePath,
      totalBytes,
      freeBytes,
      availableBytes,
      usedBytes,
      usedPercent,
      availablePercent,
    };
  } catch (error) {
    throw new DiskSpaceError(
      `Failed to get disk space for path: ${absolutePath}`,
      absolutePath,
      0,
      0,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Get disk space information for a given path (sync)
 *
 * @param targetPath - Path to check (file or directory)
 * @returns Disk space information
 * @throws {DiskSpaceError} If unable to get disk space information
 *
 * @example
 * ```typescript
 * const info = getDiskSpaceSync('/var/data');
 * console.log(`Available: ${info.availableBytes} bytes`);
 * ```
 */
export function getDiskSpaceSync(targetPath: string): DiskSpaceInfo {
  const absolutePath = path.resolve(targetPath);

  try {
    const stats = statfsSync(absolutePath);

    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bfree * stats.bsize;
    const availableBytes = stats.bavail * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    const usedPercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0;
    const availablePercent = totalBytes > 0 ? (availableBytes / totalBytes) * 100 : 0;

    return {
      path: absolutePath,
      totalBytes,
      freeBytes,
      availableBytes,
      usedBytes,
      usedPercent,
      availablePercent,
    };
  } catch (error) {
    throw new DiskSpaceError(
      `Failed to get disk space for path: ${absolutePath}`,
      absolutePath,
      0,
      0,
      undefined,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if there is sufficient disk space at a given path (async)
 *
 * @param targetPath - Path to check (file or directory)
 * @param requiredBytes - Number of bytes required for the operation
 * @param options - Additional space requirements
 * @returns Result indicating if space is sufficient
 *
 * @example
 * ```typescript
 * // Check if we have 50MB available
 * const result = await checkDiskSpace('/var/data', 50 * 1024 * 1024);
 * if (!result.sufficient) {
 *   console.error(result.reason);
 * }
 * ```
 */
export async function checkDiskSpace(
  targetPath: string,
  requiredBytes: number = 0,
  options: CheckDiskSpaceOptions = {}
): Promise<DiskSpaceSufficiencyResult> {
  const { minFreeBytes = DEFAULT_MIN_FREE_SPACE_BYTES, minFreePercent = DEFAULT_MIN_FREE_PERCENT } =
    options;

  const info = await getDiskSpace(targetPath);

  // Check if we have enough space for the operation
  if (info.availableBytes < requiredBytes) {
    const missingBytes = requiredBytes - info.availableBytes;
    return {
      sufficient: false,
      info,
      reason: `Insufficient disk space: need ${formatBytes(requiredBytes)}, have ${formatBytes(
        info.availableBytes
      )}`,
      missingBytes,
    };
  }

  // Check if we'll have minimum free bytes after the operation
  const bytesAfterOperation = info.availableBytes - requiredBytes;
  if (bytesAfterOperation < minFreeBytes) {
    const missingBytes = minFreeBytes - bytesAfterOperation;
    return {
      sufficient: false,
      info,
      reason: `Operation would leave only ${formatBytes(
        bytesAfterOperation
      )} free (minimum: ${formatBytes(minFreeBytes)})`,
      missingBytes,
    };
  }

  // Check if we'll have minimum free percentage after the operation
  const percentAfterOperation = (bytesAfterOperation / info.totalBytes) * 100;
  if (percentAfterOperation < minFreePercent) {
    const missingBytes = Math.ceil((minFreePercent / 100) * info.totalBytes - bytesAfterOperation);
    return {
      sufficient: false,
      info,
      reason: `Operation would leave only ${percentAfterOperation.toFixed(
        1
      )}% free (minimum: ${minFreePercent}%)`,
      missingBytes,
    };
  }

  return {
    sufficient: true,
    info,
  };
}

/**
 * Check if there is sufficient disk space at a given path (sync)
 *
 * @param targetPath - Path to check (file or directory)
 * @param requiredBytes - Number of bytes required for the operation
 * @param options - Additional space requirements
 * @returns Result indicating if space is sufficient
 *
 * @example
 * ```typescript
 * const result = checkDiskSpaceSync('/var/data', 50 * 1024 * 1024);
 * if (!result.sufficient) {
 *   throw new Error(result.reason);
 * }
 * ```
 */
export function checkDiskSpaceSync(
  targetPath: string,
  requiredBytes: number = 0,
  options: CheckDiskSpaceOptions = {}
): DiskSpaceSufficiencyResult {
  const { minFreeBytes = DEFAULT_MIN_FREE_SPACE_BYTES, minFreePercent = DEFAULT_MIN_FREE_PERCENT } =
    options;

  const info = getDiskSpaceSync(targetPath);

  // Check if we have enough space for the operation
  if (info.availableBytes < requiredBytes) {
    const missingBytes = requiredBytes - info.availableBytes;
    return {
      sufficient: false,
      info,
      reason: `Insufficient disk space: need ${formatBytes(requiredBytes)}, have ${formatBytes(
        info.availableBytes
      )}`,
      missingBytes,
    };
  }

  // Check if we'll have minimum free bytes after the operation
  const bytesAfterOperation = info.availableBytes - requiredBytes;
  if (bytesAfterOperation < minFreeBytes) {
    const missingBytes = minFreeBytes - bytesAfterOperation;
    return {
      sufficient: false,
      info,
      reason: `Operation would leave only ${formatBytes(
        bytesAfterOperation
      )} free (minimum: ${formatBytes(minFreeBytes)})`,
      missingBytes,
    };
  }

  // Check if we'll have minimum free percentage after the operation
  const percentAfterOperation = (bytesAfterOperation / info.totalBytes) * 100;
  if (percentAfterOperation < minFreePercent) {
    const missingBytes = Math.ceil((minFreePercent / 100) * info.totalBytes - bytesAfterOperation);
    return {
      sufficient: false,
      info,
      reason: `Operation would leave only ${percentAfterOperation.toFixed(
        1
      )}% free (minimum: ${minFreePercent}%)`,
      missingBytes,
    };
  }

  return {
    sufficient: true,
    info,
  };
}

/**
 * Ensure sufficient disk space or throw an error (async)
 *
 * @param targetPath - Path to check
 * @param requiredBytes - Number of bytes required
 * @param options - Additional space requirements
 * @throws {DiskSpaceError} If insufficient disk space
 *
 * @example
 * ```typescript
 * await ensureSufficientDiskSpace('/var/data', 50 * 1024 * 1024);
 * // Proceeds if sufficient space, throws otherwise
 * ```
 */
export async function ensureSufficientDiskSpace(
  targetPath: string,
  requiredBytes: number = 0,
  options: CheckDiskSpaceOptions = {}
): Promise<void> {
  const result = await checkDiskSpace(targetPath, requiredBytes, options);

  if (!result.sufficient) {
    throw new DiskSpaceError(
      result.reason ?? 'Insufficient disk space',
      result.info.path,
      result.info.availableBytes,
      result.info.totalBytes,
      requiredBytes
    );
  }
}

/**
 * Ensure sufficient disk space or throw an error (sync)
 *
 * @param targetPath - Path to check
 * @param requiredBytes - Number of bytes required
 * @param options - Additional space requirements
 * @throws {DiskSpaceError} If insufficient disk space
 *
 * @example
 * ```typescript
 * ensureSufficientDiskSpaceSync('/var/data', 50 * 1024 * 1024);
 * // Proceeds if sufficient space, throws otherwise
 * ```
 */
export function ensureSufficientDiskSpaceSync(
  targetPath: string,
  requiredBytes: number = 0,
  options: CheckDiskSpaceOptions = {}
): void {
  const result = checkDiskSpaceSync(targetPath, requiredBytes, options);

  if (!result.sufficient) {
    throw new DiskSpaceError(
      result.reason ?? 'Insufficient disk space',
      result.info.path,
      result.info.availableBytes,
      result.info.totalBytes,
      requiredBytes
    );
  }
}

/**
 * Format bytes as human-readable string
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 GB")
 *
 * @example
 * ```typescript
 * formatBytes(1536000000); // "1.43 GB"
 * formatBytes(1024); // "1.00 KB"
 * ```
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}
