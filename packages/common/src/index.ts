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

// Disk space utilities (Phase 1.2)
export {
  getDiskSpace,
  getDiskSpaceSync,
  checkDiskSpace,
  checkDiskSpaceSync,
  ensureSufficientDiskSpace,
  ensureSufficientDiskSpaceSync,
  formatBytes,
  DiskSpaceError,
  DEFAULT_MIN_FREE_SPACE_BYTES,
  DEFAULT_MIN_FREE_PERCENT,
  type DiskSpaceInfo,
  type CheckDiskSpaceOptions,
  type DiskSpaceSufficiencyResult,
} from './disk-space';

// Path utilities (Phase 1.2)
export {
  DEFAULT_BASE_DIR,
  PathError,
  getAgentShard,
  getAgentDirectory,
  getTaskPath,
  getInboxPath,
  getOutboxPath,
  getWorkspacePath,
  getSubordinatesPath,
  getConfigPath,
  getSchedulePath,
  getMetadataPath,
  getLogsDirectory,
  getAgentLogPath,
  getDatabasePath,
  getBackupsDirectory,
  validateAgentId,
  validateTaskId,
  validatePathContainment,
  validateAgentPath,
  validateTaskPath,
  sanitizePathComponent,
  type PathOptions,
  type PathValidationOptions,
  type PathValidationResult,
} from './path-utils';
