/**
 * Process ID (PID) Management
 *
 * Provides PID file management to prevent duplicate daemon/process instances
 * from running concurrently. Implements EC-7.1 prevention mechanism.
 *
 * @module pid-manager
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { DEFAULT_BASE_DIR } from './path-utils';
import { atomicWrite } from './file-io';

/**
 * Custom error class for PID-related errors
 */
export class PidError extends Error {
  constructor(
    message: string,
    public readonly processName?: string,
    public readonly pidPath?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PidError';
    Error.captureStackTrace(this, PidError);
  }
}

/**
 * PID file information
 */
export interface PidInfo {
  /**
   * Process ID
   */
  pid: number;

  /**
   * Process name/identifier
   */
  processName: string;

  /**
   * Timestamp when PID file was created (ISO 8601)
   */
  createdAt: string;

  /**
   * Hostname where process is running
   */
  hostname?: string;
}

/**
 * Options for PID management
 */
export interface PidOptions {
  /**
   * Base directory for PID files
   * @default ~/.recursive-manager/pids
   */
  baseDir?: string;

  /**
   * Whether to check if process is actually running
   * @default true
   */
  checkProcess?: boolean;

  /**
   * Whether to remove stale PID files automatically
   * @default true
   */
  removeStale?: boolean;
}

/**
 * Get the PID directory path
 *
 * @param options - PID options
 * @returns Absolute path to the PID directory
 */
export function getPidDirectory(options: PidOptions = {}): string {
  const baseDir = options.baseDir ?? DEFAULT_BASE_DIR;
  return path.resolve(baseDir, 'pids');
}

/**
 * Get the PID file path for a process
 *
 * @param processName - Name/identifier of the process
 * @param options - PID options
 * @returns Absolute path to the PID file
 */
export function getPidFilePath(processName: string, options: PidOptions = {}): string {
  if (!processName || processName.trim().length === 0) {
    throw new PidError('Process name cannot be empty', processName);
  }

  // Sanitize process name for use in filename
  const sanitized = processName.replace(/[^a-zA-Z0-9-_]/g, '-');
  const pidDir = getPidDirectory(options);
  return path.join(pidDir, `${sanitized}.pid`);
}

/**
 * Check if a process with the given PID is running
 *
 * Uses process.kill(pid, 0) which doesn't actually kill the process,
 * but checks if we can send a signal to it (i.e., if it exists)
 *
 * @param pid - Process ID to check
 * @returns true if process is running, false otherwise
 */
export function isProcessRunning(pid: number): boolean {
  if (!pid || pid <= 0) {
    return false;
  }

  try {
    // Signal 0 doesn't kill the process, just checks if it exists
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH means process doesn't exist
    // EPERM means process exists but we don't have permission (still running)
    if (error && typeof error === 'object' && 'code' in error) {
      return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
    return false;
  }
}

/**
 * Read PID information from a PID file
 *
 * @param processName - Name/identifier of the process
 * @param options - PID options
 * @returns PID information or null if file doesn't exist
 * @throws {PidError} If PID file is malformed
 */
export async function readPidFile(
  processName: string,
  options: PidOptions = {}
): Promise<PidInfo | null> {
  const pidPath = getPidFilePath(processName, options);

  try {
    const content = await fs.readFile(pidPath, 'utf-8');
    const pidInfo: PidInfo = JSON.parse(content);

    // Validate required fields
    if (!pidInfo.pid || !pidInfo.processName || !pidInfo.createdAt) {
      throw new PidError(
        'PID file is malformed: missing required fields',
        processName,
        pidPath
      );
    }

    return pidInfo;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return null;
      }
    }

    // Re-throw PidError as-is
    if (error instanceof PidError) {
      throw error;
    }

    // Wrap other errors
    throw new PidError(
      `Failed to read PID file: ${error instanceof Error ? error.message : String(error)}`,
      processName,
      pidPath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Write PID information to a PID file
 *
 * Uses atomic write to ensure file integrity
 *
 * @param processName - Name/identifier of the process
 * @param pid - Process ID (defaults to current process)
 * @param options - PID options
 * @throws {PidError} If write fails
 */
export async function writePidFile(
  processName: string,
  pid: number = process.pid,
  options: PidOptions = {}
): Promise<void> {
  const pidPath = getPidFilePath(processName, options);
  const pidDir = getPidDirectory(options);

  try {
    // Ensure PID directory exists
    await fs.mkdir(pidDir, { recursive: true, mode: 0o755 });

    // Create PID info
    const pidInfo: PidInfo = {
      pid,
      processName,
      createdAt: new Date().toISOString(),
      hostname: require('os').hostname(),
    };

    // Write atomically
    await atomicWrite(pidPath, JSON.stringify(pidInfo, null, 2), {
      mode: 0o644,
      createDirs: true,
    });
  } catch (error) {
    throw new PidError(
      `Failed to write PID file: ${error instanceof Error ? error.message : String(error)}`,
      processName,
      pidPath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Remove a PID file
 *
 * @param processName - Name/identifier of the process
 * @param options - PID options
 * @throws {PidError} If removal fails (except ENOENT)
 */
export async function removePidFile(
  processName: string,
  options: PidOptions = {}
): Promise<void> {
  const pidPath = getPidFilePath(processName, options);

  try {
    await fs.unlink(pidPath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException;
      // Ignore ENOENT (file doesn't exist)
      if (nodeError.code === 'ENOENT') {
        return;
      }
    }

    throw new PidError(
      `Failed to remove PID file: ${error instanceof Error ? error.message : String(error)}`,
      processName,
      pidPath,
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if a process is currently running based on PID file
 *
 * This checks:
 * 1. If PID file exists
 * 2. If PID file is valid (parseable)
 * 3. If the process with that PID is actually running (if checkProcess option is true)
 * 4. Optionally removes stale PID files
 *
 * @param processName - Name/identifier of the process
 * @param options - PID options
 * @returns PidInfo if process is running, null otherwise
 */
export async function isProcessRunningByPid(
  processName: string,
  options: PidOptions = {}
): Promise<PidInfo | null> {
  const { checkProcess = true, removeStale = true } = options;

  try {
    const pidInfo = await readPidFile(processName, options);

    if (!pidInfo) {
      return null;
    }

    // If we're not checking the process, just return the PID info
    if (!checkProcess) {
      return pidInfo;
    }

    // Check if process is actually running
    const running = isProcessRunning(pidInfo.pid);

    if (!running && removeStale) {
      // Remove stale PID file
      await removePidFile(processName, options);
      return null;
    }

    return running ? pidInfo : null;
  } catch (error) {
    // If we can't read the PID file, assume process is not running
    return null;
  }
}

/**
 * Acquire a PID lock for a process
 *
 * This creates a PID file and ensures no other instance is running.
 * Returns a cleanup function that removes the PID file.
 *
 * @param processName - Name/identifier of the process
 * @param options - PID options
 * @returns Cleanup function to remove the PID file
 * @throws {PidError} If another instance is already running
 */
export async function acquirePidLock(
  processName: string,
  options: PidOptions = {}
): Promise<() => Promise<void>> {
  // Check if another instance is running
  const existingPid = await isProcessRunningByPid(processName, options);

  if (existingPid) {
    throw new PidError(
      `Process '${processName}' is already running (PID: ${existingPid.pid})`,
      processName,
      getPidFilePath(processName, options)
    );
  }

  // Write our PID file
  await writePidFile(processName, process.pid, options);

  // Return cleanup function
  return async () => {
    await removePidFile(processName, options);
  };
}

/**
 * Synchronous version of acquirePidLock for use in process exit handlers
 *
 * @param processName - Name/identifier of the process
 * @param options - PID options
 */
export function removePidFileSync(processName: string, options: PidOptions = {}): void {
  const pidPath = getPidFilePath(processName, options);

  try {
    fsSync.unlinkSync(pidPath);
  } catch (error) {
    // Ignore ENOENT
    if (error && typeof error === 'object' && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return;
      }
    }
    // Log but don't throw in cleanup
    console.error(`Failed to remove PID file ${pidPath}:`, error);
  }
}

/**
 * List all active PID files
 *
 * @param options - PID options
 * @returns Array of PID information for all active processes
 */
export async function listActivePids(options: PidOptions = {}): Promise<PidInfo[]> {
  const pidDir = getPidDirectory(options);
  const activePids: PidInfo[] = [];

  try {
    // Ensure directory exists
    await fs.mkdir(pidDir, { recursive: true, mode: 0o755 });

    // Read all .pid files
    const files = await fs.readdir(pidDir);
    const pidFiles = files.filter((f) => f.endsWith('.pid'));

    // Read each PID file
    for (const file of pidFiles) {
      const processName = path.basename(file, '.pid');
      const pidInfo = await isProcessRunningByPid(processName, options);

      if (pidInfo) {
        activePids.push(pidInfo);
      }
    }

    return activePids;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return [];
      }
    }

    throw new PidError(
      `Failed to list PID files: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      pidDir,
      error instanceof Error ? error : undefined
    );
  }
}
