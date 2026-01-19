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

// Default Migrations
export { allMigrations, getMigrations } from './db/migrations/index';

// Database Queries (Phase 1.3)
export {
  // Agent queries
  createAgent,
  getAgent,
  updateAgent,
  getSubordinates,
  getOrgChart,
  // Task queries
  createTask,
  getTask,
  updateTaskStatus,
  completeTask,
  getActiveTasks,
  detectTaskDeadlock,
  getBlockedTasks,
  // Message queries
  createMessage,
  getMessage,
  getMessages,
  markMessageAsRead,
  markMessageAsArchived,
  getUnreadMessageCount,
  deleteMessage,
  // Audit queries (Phase 1.4)
  auditLog,
  queryAuditLog,
  getRecentAuditEvents,
  getAuditStats,
  AuditAction,
  // Types
  type AgentStatus,
  type AgentRecord,
  type CreateAgentInput,
  type UpdateAgentInput,
  type OrgHierarchyRecord,
  type CreateOrgHierarchyInput,
  type TaskStatus,
  type TaskPriority,
  type TaskRecord,
  type CreateTaskInput,
  type MessageRecord,
  type MessageInput,
  type MessageFilter,
  type AuditActionType,
  type AuditEventInput,
  type AuditEventRecord,
  type AuditQueryFilter,
} from './db/queries';

// Logging (Phase 1.4)
export {
  createLogger,
  createAgentLogger,
  createHierarchicalAgentLogger,
  getAgentHierarchyContext,
  generateTraceId,
  logger,
  type Logger,
  type LogLevel,
  type LogMetadata,
  type LoggerOptions,
  type AgentHierarchyContext,
} from './logger';

// Types (Phase 2.1)
export {
  type AgentConfig,
  type AgentIdentity,
  type AgentGoal,
  type AgentPermissions,
  type AgentFramework,
  type CommunicationChannels,
  type AgentBehavior,
  type AgentMetadata,
} from './types/agent-config';
