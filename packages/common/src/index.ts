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
} from './file-io';
