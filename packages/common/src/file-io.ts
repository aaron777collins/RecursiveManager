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
