/**
 * @recursive-manager/common
 *
 * Common utilities, types, and schemas for RecursiveManager.
 * This package provides shared functionality used across all other packages.
 */

export const VERSION = '0.1.0';

// File I/O utilities (Phase 1.2)
export {
  atomicWrite,
  atomicWriteSync,
  AtomicWriteError,
  type AtomicWriteOptions,
  createBackup,
  createBackupSync,
  BackupError,
  type BackupOptions,
  cleanupBackups,
  cleanupBackupsSync,
  type CleanupBackupsOptions,
  type CleanupResult,
  DEFAULT_RETENTION_DAYS,
  DEFAULT_RETENTION_MS,
} from './file-io';

// Directory permission utilities (Phase 1.2)
export {
  checkDirectoryPermissions,
  checkDirectoryPermissionsSync,
  ensureDirectoryPermissions,
  ensureDirectoryPermissionsSync,
  setDirectoryPermissions,
  setDirectoryPermissionsSync,
  getDirectoryPermissions,
  getDirectoryPermissionsSync,
  validateDirectoryPermissions,
  validateDirectoryPermissionsSync,
  PermissionError,
  DEFAULT_DIRECTORY_MODE,
  type DirectoryPermissionOptions,
  type PermissionCheckResult,
} from './directory-permissions';
