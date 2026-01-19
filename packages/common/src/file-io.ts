/**
 * File I/O utilities with atomic operations and error handling
 *
 * This module provides safe file operations using:
 * - Atomic writes (temp file + rename pattern)
 * - Pre-write backups
 * - Proper error handling
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

/**
 * Options for atomic write operations
 */
export interface AtomicWriteOptions {
  /**
   * File encoding (default: 'utf-8')
   */
  encoding?: BufferEncoding;

  /**
   * File permissions mode (default: 0o644)
   */
  mode?: number;

  /**
   * Create parent directories if they don't exist (default: true)
   */
  createDirs?: boolean;
}

/**
 * Error thrown when atomic write operations fail
 */
export class AtomicWriteError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
    public readonly filePath?: string,
    public readonly tempPath?: string
  ) {
    super(message);
    this.name = 'AtomicWriteError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AtomicWriteError);
    }
  }
}

/**
 * Atomically write content to a file using temp file + rename pattern
 *
 * This implementation ensures that:
 * 1. The target file is never left in a partially written state
 * 2. If the operation fails, the original file remains untouched
 * 3. The write is atomic at the filesystem level (via rename)
 *
 * Algorithm:
 * 1. Create parent directories if needed
 * 2. Write content to a temporary file in the same directory
 * 3. Set proper permissions on the temp file
 * 4. Atomically rename temp file to target path
 * 5. Clean up temp file on any error
 *
 * @param filePath - Target file path to write to
 * @param content - Content to write (string or Buffer)
 * @param options - Write options (encoding, mode, createDirs)
 * @returns Promise that resolves when write is complete
 * @throws AtomicWriteError if the operation fails
 *
 * @example
 * ```typescript
 * await atomicWrite('/path/to/config.json', JSON.stringify(data, null, 2));
 * ```
 */
export async function atomicWrite(
  filePath: string,
  content: string | Buffer,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const { encoding = 'utf-8', mode = 0o644, createDirs = true } = options;

  // Resolve to absolute path
  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);
  const filename = path.basename(absolutePath);

  // Generate temporary file path in the same directory
  // Using same directory ensures rename is atomic (same filesystem)
  const tempPath = path.join(
    dir,
    `.${filename}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`
  );

  try {
    // Step 1: Create parent directories if needed
    if (createDirs) {
      await fs.mkdir(dir, { recursive: true, mode: 0o755 });
    }

    // Step 2: Write content to temporary file
    const writeContent = typeof content === 'string' ? Buffer.from(content, encoding) : content;

    await fs.writeFile(tempPath, writeContent, { mode });

    // Step 3: Atomically rename temp file to target
    // This is atomic at the filesystem level - either fully succeeds or fully fails
    await fs.rename(tempPath, absolutePath);
  } catch (error) {
    // Clean up temp file on any error
    try {
      // Check if temp file exists before trying to delete
      const tempExists = await fs.stat(tempPath).then(
        () => true,
        () => false
      );
      if (tempExists) {
        await fs.unlink(tempPath);
      }
    } catch {
      // Ignore cleanup errors - main error is more important
    }

    // Throw descriptive error
    const err = error as Error;
    throw new AtomicWriteError(
      `Failed to atomically write to ${absolutePath}: ${err.message}`,
      err,
      absolutePath,
      tempPath
    );
  }
}

/**
 * Synchronous version of atomicWrite for cases where async is not possible
 *
 * Note: Prefer the async version when possible. This is provided for edge cases
 * where synchronous I/O is required (e.g., process exit handlers).
 *
 * @param filePath - Target file path to write to
 * @param content - Content to write (string or Buffer)
 * @param options - Write options (encoding, mode, createDirs)
 * @throws AtomicWriteError if the operation fails
 */
export function atomicWriteSync(
  filePath: string,
  content: string | Buffer,
  options: AtomicWriteOptions = {}
): void {
  const { encoding = 'utf-8', mode = 0o644, createDirs = true } = options;

  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);
  const filename = path.basename(absolutePath);

  const tempPath = path.join(
    dir,
    `.${filename}.tmp.${Date.now()}.${Math.random().toString(36).substring(7)}`
  );

  try {
    if (createDirs) {
      fsSync.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }

    const writeContent = typeof content === 'string' ? Buffer.from(content, encoding) : content;

    fsSync.writeFileSync(tempPath, writeContent, { mode });
    fsSync.renameSync(tempPath, absolutePath);
  } catch (error) {
    try {
      if (fsSync.existsSync(tempPath)) {
        fsSync.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }

    const err = error as Error;
    throw new AtomicWriteError(
      `Failed to atomically write to ${absolutePath}: ${err.message}`,
      err,
      absolutePath,
      tempPath
    );
  }
}

/**
 * Options for backup operations
 */
export interface BackupOptions {
  /**
   * Directory to store backups (default: same directory as original file)
   */
  backupDir?: string;

  /**
   * Whether to create backup directory if it doesn't exist (default: true)
   */
  createDirs?: boolean;

  /**
   * Custom timestamp format (default: ISO 8601 format YYYY-MM-DDTHH-mm-ss-SSS)
   */
  timestampFormat?: (date: Date) => string;

  /**
   * File permissions for the backup file (default: same as original)
   */
  mode?: number;
}

/**
 * Error thrown when backup operations fail
 */
export class BackupError extends Error {
  constructor(
    message: string,
    public readonly originalError?: Error,
    public readonly sourcePath?: string,
    public readonly backupPath?: string
  ) {
    super(message);
    this.name = 'BackupError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BackupError);
    }
  }
}

/**
 * Default timestamp format for backups: YYYY-MM-DDTHH-mm-ss-SSS
 * Uses ISO 8601 format with hyphens instead of colons (filesystem-safe)
 *
 * @param date - Date to format
 * @returns Formatted timestamp string
 */
function defaultTimestampFormat(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hours}-${minutes}-${seconds}-${milliseconds}`;
}

/**
 * Create a timestamped backup of a file
 *
 * This function creates a copy of the file with a timestamp appended to its name.
 * If the file doesn't exist, the function returns null without error.
 *
 * Backup naming pattern:
 * - Original: /path/to/config.json
 * - Backup: /path/to/backups/config.2026-01-18T14-30-45-123.json
 *
 * @param filePath - Path to the file to backup
 * @param options - Backup options
 * @returns Path to the created backup, or null if source file doesn't exist
 * @throws BackupError if the backup operation fails
 *
 * @example
 * ```typescript
 * // Create backup in default location (same directory)
 * const backupPath = await createBackup('/path/to/config.json');
 *
 * // Create backup in specific directory
 * const backupPath = await createBackup('/path/to/config.json', {
 *   backupDir: '/path/to/backups'
 * });
 * ```
 */
export async function createBackup(
  filePath: string,
  options: BackupOptions = {}
): Promise<string | null> {
  const { createDirs = true, timestampFormat = defaultTimestampFormat } = options;

  const absolutePath = path.resolve(filePath);

  // Check if source file exists
  try {
    await fs.access(absolutePath);
  } catch {
    // File doesn't exist - return null without error
    return null;
  }

  const dir = path.dirname(absolutePath);
  const ext = path.extname(absolutePath);
  const basename = path.basename(absolutePath, ext);

  // Determine backup directory
  const backupDir = options.backupDir ? path.resolve(options.backupDir) : dir;

  // Generate timestamped backup filename
  const timestamp = timestampFormat(new Date());
  const backupFilename = `${basename}.${timestamp}${ext}`;
  const backupPath = path.join(backupDir, backupFilename);

  try {
    // Create backup directory if needed
    if (createDirs) {
      await fs.mkdir(backupDir, { recursive: true, mode: 0o755 });
    }

    // Get original file stats to preserve permissions
    const stats = await fs.stat(absolutePath);
    const mode = options.mode ?? stats.mode;

    // Copy file to backup location
    await fs.copyFile(absolutePath, backupPath);

    // Set permissions on backup file
    await fs.chmod(backupPath, mode);

    return backupPath;
  } catch (error) {
    const err = error as Error;
    throw new BackupError(
      `Failed to create backup of ${absolutePath}: ${err.message}`,
      err,
      absolutePath,
      backupPath
    );
  }
}

/**
 * Synchronous version of createBackup for cases where async is not possible
 *
 * @param filePath - Path to the file to backup
 * @param options - Backup options
 * @returns Path to the created backup, or null if source file doesn't exist
 * @throws BackupError if the backup operation fails
 */
export function createBackupSync(filePath: string, options: BackupOptions = {}): string | null {
  const { createDirs = true, timestampFormat = defaultTimestampFormat } = options;

  const absolutePath = path.resolve(filePath);

  // Check if source file exists
  if (!fsSync.existsSync(absolutePath)) {
    return null;
  }

  const dir = path.dirname(absolutePath);
  const ext = path.extname(absolutePath);
  const basename = path.basename(absolutePath, ext);

  // Determine backup directory
  const backupDir = options.backupDir ? path.resolve(options.backupDir) : dir;

  // Generate timestamped backup filename
  const timestamp = timestampFormat(new Date());
  const backupFilename = `${basename}.${timestamp}${ext}`;
  const backupPath = path.join(backupDir, backupFilename);

  try {
    // Create backup directory if needed
    if (createDirs) {
      fsSync.mkdirSync(backupDir, { recursive: true, mode: 0o755 });
    }

    // Get original file stats to preserve permissions
    const stats = fsSync.statSync(absolutePath);
    const mode = options.mode ?? stats.mode;

    // Copy file to backup location
    fsSync.copyFileSync(absolutePath, backupPath);

    // Set permissions on backup file
    fsSync.chmodSync(backupPath, mode);

    return backupPath;
  } catch (error) {
    const err = error as Error;
    throw new BackupError(
      `Failed to create backup of ${absolutePath}: ${err.message}`,
      err,
      absolutePath,
      backupPath
    );
  }
}

/**
 * Options for backup cleanup operations
 */
export interface CleanupBackupsOptions {
  /**
   * Maximum age of backups in milliseconds (default: 7 days)
   */
  maxAge?: number;

  /**
   * Backup directory to clean (default: same directory as original file)
   */
  backupDir?: string;

  /**
   * Whether to perform a dry run without actually deleting files (default: false)
   */
  dryRun?: boolean;
}

/**
 * Result of a backup cleanup operation
 */
export interface CleanupResult {
  /**
   * Number of backups found
   */
  totalFound: number;

  /**
   * Number of backups deleted
   */
  deleted: number;

  /**
   * Paths of deleted backups
   */
  deletedPaths: string[];

  /**
   * Number of backups that failed to delete
   */
  errors: number;

  /**
   * Error details for failed deletions
   */
  errorDetails: Array<{ path: string; error: string }>;
}

/**
 * Default retention period: 7 days in milliseconds
 */
export const DEFAULT_RETENTION_DAYS = 7;
export const DEFAULT_RETENTION_MS = DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Clean up old backup files based on retention policy
 *
 * This function finds and deletes backup files older than the specified retention period.
 * Backups are identified by the timestamped naming pattern created by createBackup().
 *
 * Pattern: filename.YYYY-MM-DDTHH-mm-ss-SSS.ext
 *
 * @param filePath - Path to the original file (backups will be found based on this)
 * @param options - Cleanup options (maxAge, backupDir, dryRun)
 * @returns CleanupResult with details about the cleanup operation
 * @throws BackupError if the cleanup operation fails critically
 *
 * @example
 * ```typescript
 * // Clean up backups older than 7 days (default)
 * const result = await cleanupBackups('/path/to/config.json');
 * console.log(`Deleted ${result.deleted} old backups`);
 *
 * // Clean up backups older than 3 days
 * const result = await cleanupBackups('/path/to/config.json', {
 *   maxAge: 3 * 24 * 60 * 60 * 1000
 * });
 *
 * // Dry run to see what would be deleted
 * const result = await cleanupBackups('/path/to/config.json', {
 *   dryRun: true
 * });
 * ```
 */
export async function cleanupBackups(
  filePath: string,
  options: CleanupBackupsOptions = {}
): Promise<CleanupResult> {
  const { maxAge = DEFAULT_RETENTION_MS, dryRun = false } = options;

  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);
  const ext = path.extname(absolutePath);
  const basename = path.basename(absolutePath, ext);

  // Determine backup directory
  const backupDir = options.backupDir ? path.resolve(options.backupDir) : dir;

  const result: CleanupResult = {
    totalFound: 0,
    deleted: 0,
    deletedPaths: [],
    errors: 0,
    errorDetails: [],
  };

  try {
    // Check if backup directory exists
    try {
      await fs.access(backupDir);
    } catch {
      // Directory doesn't exist - nothing to clean up
      return result;
    }

    // Read all files in backup directory
    const files = await fs.readdir(backupDir);

    // Pattern: basename.YYYY-MM-DDTHH-mm-ss-SSS.ext
    // Create regex to match backup files for this specific file
    const timestampPattern = '\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}';
    const backupPattern = new RegExp(
      `^${escapeRegex(basename)}\\.(${timestampPattern})${escapeRegex(ext)}$`
    );

    const now = Date.now();

    // Find and process backup files
    for (const file of files) {
      const match = backupPattern.exec(file);
      if (!match) {
        continue; // Not a backup file for this original file
      }

      result.totalFound++;

      const backupPath = path.join(backupDir, file);

      try {
        // Get file stats to check age
        const stats = await fs.stat(backupPath);
        const fileAge = now - stats.mtimeMs;

        // Check if file is older than retention period
        if (fileAge >= maxAge) {
          if (!dryRun) {
            await fs.unlink(backupPath);
          }
          result.deleted++;
          result.deletedPaths.push(backupPath);
        }
      } catch (error) {
        // Track individual file errors but continue processing
        result.errors++;
        const err = error as Error;
        result.errorDetails.push({
          path: backupPath,
          error: err.message,
        });
      }
    }

    return result;
  } catch (error) {
    const err = error as Error;
    throw new BackupError(
      `Failed to clean up backups for ${absolutePath}: ${err.message}`,
      err,
      absolutePath
    );
  }
}

/**
 * Synchronous version of cleanupBackups for cases where async is not possible
 *
 * @param filePath - Path to the original file
 * @param options - Cleanup options
 * @returns CleanupResult with details about the cleanup operation
 * @throws BackupError if the cleanup operation fails critically
 */
export function cleanupBackupsSync(
  filePath: string,
  options: CleanupBackupsOptions = {}
): CleanupResult {
  const { maxAge = DEFAULT_RETENTION_MS, dryRun = false } = options;

  const absolutePath = path.resolve(filePath);
  const dir = path.dirname(absolutePath);
  const ext = path.extname(absolutePath);
  const basename = path.basename(absolutePath, ext);

  // Determine backup directory
  const backupDir = options.backupDir ? path.resolve(options.backupDir) : dir;

  const result: CleanupResult = {
    totalFound: 0,
    deleted: 0,
    deletedPaths: [],
    errors: 0,
    errorDetails: [],
  };

  try {
    // Check if backup directory exists
    if (!fsSync.existsSync(backupDir)) {
      return result;
    }

    // Read all files in backup directory
    const files = fsSync.readdirSync(backupDir);

    // Pattern: basename.YYYY-MM-DDTHH-mm-ss-SSS.ext
    const timestampPattern = '\\d{4}-\\d{2}-\\d{2}T\\d{2}-\\d{2}-\\d{2}-\\d{3}';
    const backupPattern = new RegExp(
      `^${escapeRegex(basename)}\\.(${timestampPattern})${escapeRegex(ext)}$`
    );

    const now = Date.now();

    // Find and process backup files
    for (const file of files) {
      const match = backupPattern.exec(file);
      if (!match) {
        continue;
      }

      result.totalFound++;

      const backupPath = path.join(backupDir, file);

      try {
        // Get file stats to check age
        const stats = fsSync.statSync(backupPath);
        const fileAge = now - stats.mtimeMs;

        // Check if file is older than retention period
        if (fileAge >= maxAge) {
          if (!dryRun) {
            fsSync.unlinkSync(backupPath);
          }
          result.deleted++;
          result.deletedPaths.push(backupPath);
        }
      } catch (error) {
        result.errors++;
        const err = error as Error;
        result.errorDetails.push({
          path: backupPath,
          error: err.message,
        });
      }
    }

    return result;
  } catch (error) {
    const err = error as Error;
    throw new BackupError(
      `Failed to clean up backups for ${absolutePath}: ${err.message}`,
      err,
      absolutePath
    );
  }
}

/**
 * Escape special regex characters in a string
 *
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
