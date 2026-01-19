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

// JSON Schemas (Phase 1.2)
// Export schemas as importable JSON for validation
import agentConfigSchema from './schemas/agent-config.schema.json';
import scheduleSchema from './schemas/schedule.schema.json';

export { agentConfigSchema, scheduleSchema };

// Schema Validation (Phase 1.2)
export {
  validateAgentConfig,
  validateAgentConfigStrict,
  validateSchedule,
  validateScheduleStrict,
  validateTask,
  validateTaskStrict,
  validateMessage,
  validateMessageStrict,
  validateMetadata,
  validateMetadataStrict,
  validateSubordinates,
  validateSubordinatesStrict,
  SchemaValidationError,
  clearValidatorCache,
  type ValidationResult,
  type ValidationError,
} from './schema-validation';

// File Recovery (Phase 1.2)
export {
  detectCorruption,
  detectCorruptionSync,
  findLatestBackup,
  findLatestBackupSync,
  attemptRecovery,
  attemptRecoverySync,
  safeLoad,
  safeLoadSync,
  CorruptionError,
  type CorruptionInfo,
  type RecoveryResult,
  type RecoveryOptions,
} from './file-recovery';

// Database (Phase 1.3)
export {
  initializeDatabase,
  getDatabaseVersion,
  setDatabaseVersion,
  checkDatabaseIntegrity,
  backupDatabase,
  optimizeDatabase,
  transaction,
  getDatabaseHealth,
  DatabasePool,
  type DatabaseOptions,
  type DatabaseConnection,
  type DatabaseHealthStatus,
} from './db';

// Database Migrations (Phase 1.3)
export {
  initializeMigrationTracking,
  getMigrationStatus,
  getPendingMigrations,
  runMigrations,
  rollbackMigrations,
  validateMigrations,
  migrateToVersion,
  type Migration,
  type MigrationStatus,
} from './db/migrations';

// Logging (Phase 1.4)
export {
  createLogger,
  createAgentLogger,
  generateTraceId,
  logger,
  type Logger,
  type LogLevel,
  type LogMetadata,
  type LoggerOptions,
} from './logger';
