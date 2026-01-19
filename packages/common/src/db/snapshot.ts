/**
 * Database Snapshot System
 *
 * This module provides snapshot management for the RecursiveManager database.
 * Snapshots enable rollback capability for agent hierarchy changes.
 *
 * Features:
 * - Create snapshots with metadata
 * - List snapshots with filtering
 * - Restore database from snapshots
 * - Delete old snapshots
 * - Validate snapshot integrity
 * - Automatic cleanup (keep N most recent)
 *
 * @module db/snapshot
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { checkDatabaseIntegrity } from './index';

/**
 * Snapshot metadata
 */
export interface Snapshot {
  /**
   * Unique snapshot ID (timestamp-based)
   */
  id: string;

  /**
   * Snapshot file path
   */
  path: string;

  /**
   * When the snapshot was created
   */
  createdAt: Date;

  /**
   * File size in bytes
   */
  size: number;

  /**
   * Reason for snapshot creation
   */
  reason: string;

  /**
   * Agent ID associated with the action (optional)
   */
  agentId?: string;

  /**
   * Schema version at time of snapshot
   */
  schemaVersion: number;
}

/**
 * Options for creating a snapshot
 */
export interface CreateSnapshotOptions {
  /**
   * Reason for creating the snapshot
   */
  reason: string;

  /**
   * Agent ID associated with the action (optional)
   */
  agentId?: string;

  /**
   * Custom snapshot ID (defaults to timestamp-based)
   */
  snapshotId?: string;
}

/**
 * Options for listing snapshots
 */
export interface ListSnapshotsOptions {
  /**
   * Filter by agent ID
   */
  agentId?: string;

  /**
   * Maximum number of snapshots to return
   */
  limit?: number;

  /**
   * Sort order (newest first by default)
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Options for restoring a snapshot
 */
export interface RestoreSnapshotOptions {
  /**
   * Whether to create a backup before restoring
   * @default true
   */
  createBackup?: boolean;

  /**
   * Whether to validate integrity before restoring
   * @default true
   */
  validateIntegrity?: boolean;
}

/**
 * Create a snapshot of the database
 *
 * @param db - Database instance
 * @param snapshotsDir - Directory to store snapshots
 * @param options - Snapshot creation options
 * @returns Snapshot metadata
 *
 * @example
 * ```typescript
 * const snapshot = await createSnapshot(db, '/data/snapshots', {
 *   reason: 'Before hiring new agent',
 *   agentId: 'manager-123'
 * });
 * console.log(`Snapshot created: ${snapshot.id}`);
 * ```
 */
export async function createSnapshot(
  db: Database.Database,
  snapshotsDir: string,
  options: CreateSnapshotOptions
): Promise<Snapshot> {
  const { reason, agentId, snapshotId } = options;

  // Generate snapshot ID if not provided
  const id = snapshotId || `snapshot-${Date.now()}`;

  // Ensure snapshots directory exists
  if (!fs.existsSync(snapshotsDir)) {
    fs.mkdirSync(snapshotsDir, { recursive: true, mode: 0o755 });
  }

  // Build snapshot file path
  const snapshotPath = path.join(snapshotsDir, `${id}.db`);
  const metadataPath = path.join(snapshotsDir, `${id}.json`);

  // Check if snapshot already exists
  if (fs.existsSync(snapshotPath)) {
    throw new Error(`Snapshot already exists: ${id}`);
  }

  // Get current schema version
  const schemaVersion = getSchemaVersion(db);

  // Create snapshot using better-sqlite3's backup API
  try {
    await db.backup(snapshotPath);
  } catch (error) {
    throw new Error(
      `Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Get snapshot file size
  const stats = fs.statSync(snapshotPath);
  const size = stats.size;

  // Create metadata
  const snapshot: Snapshot = {
    id,
    path: snapshotPath,
    createdAt: new Date(),
    size,
    reason,
    agentId,
    schemaVersion,
  };

  // Write metadata file
  fs.writeFileSync(metadataPath, JSON.stringify(snapshot, null, 2), { mode: 0o644 });

  return snapshot;
}

/**
 * List all snapshots in the snapshots directory
 *
 * @param snapshotsDir - Directory containing snapshots
 * @param options - Listing options
 * @returns Array of snapshot metadata
 *
 * @example
 * ```typescript
 * const snapshots = listSnapshots('/data/snapshots', {
 *   agentId: 'manager-123',
 *   limit: 10
 * });
 * console.log(`Found ${snapshots.length} snapshots`);
 * ```
 */
export function listSnapshots(
  snapshotsDir: string,
  options: ListSnapshotsOptions = {}
): Snapshot[] {
  const { agentId, limit, sortOrder = 'desc' } = options;

  // Check if snapshots directory exists
  if (!fs.existsSync(snapshotsDir)) {
    return [];
  }

  // Read all .json files (metadata files)
  const files = fs
    .readdirSync(snapshotsDir)
    .filter((file) => file.endsWith('.json') && file.startsWith('snapshot-'));

  // Load and parse metadata
  const snapshots: Snapshot[] = [];
  for (const file of files) {
    try {
      const metadataPath = path.join(snapshotsDir, file);
      const content = fs.readFileSync(metadataPath, 'utf-8');
      const snapshot = JSON.parse(content) as Snapshot;

      // Convert createdAt string to Date
      snapshot.createdAt = new Date(snapshot.createdAt);

      // Apply filters
      if (agentId && snapshot.agentId !== agentId) {
        continue;
      }

      snapshots.push(snapshot);
    } catch (error) {
      // Skip invalid metadata files
      console.warn(`Failed to load snapshot metadata from ${file}:`, error);
    }
  }

  // Sort snapshots
  snapshots.sort((a, b) => {
    const comparison = b.createdAt.getTime() - a.createdAt.getTime();
    return sortOrder === 'asc' ? -comparison : comparison;
  });

  // Apply limit
  if (limit && limit > 0) {
    return snapshots.slice(0, limit);
  }

  return snapshots;
}

/**
 * Get a specific snapshot by ID
 *
 * @param snapshotsDir - Directory containing snapshots
 * @param snapshotId - Snapshot ID
 * @returns Snapshot metadata or null if not found
 *
 * @example
 * ```typescript
 * const snapshot = getSnapshot('/data/snapshots', 'snapshot-1234567890');
 * if (snapshot) {
 *   console.log(`Snapshot size: ${snapshot.size} bytes`);
 * }
 * ```
 */
export function getSnapshot(snapshotsDir: string, snapshotId: string): Snapshot | null {
  const metadataPath = path.join(snapshotsDir, `${snapshotId}.json`);

  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(metadataPath, 'utf-8');
    const snapshot = JSON.parse(content) as Snapshot;
    snapshot.createdAt = new Date(snapshot.createdAt);
    return snapshot;
  } catch (error) {
    console.warn(`Failed to load snapshot metadata for ${snapshotId}:`, error);
    return null;
  }
}

/**
 * Restore database from a snapshot
 *
 * This function will:
 * 1. Optionally validate snapshot integrity
 * 2. Optionally create a backup of current database
 * 3. Close the current database connection
 * 4. Replace database file with snapshot
 * 5. Return a new database connection
 *
 * @param currentDbPath - Path to current database file
 * @param snapshotPath - Path to snapshot file
 * @param options - Restore options
 * @returns New database connection
 *
 * @example
 * ```typescript
 * db.close(); // Close existing connection
 * const newDb = await restoreSnapshot(
 *   '/data/rm.db',
 *   '/data/snapshots/snapshot-1234567890.db'
 * );
 * ```
 */
export async function restoreSnapshot(
  currentDbPath: string,
  snapshotPath: string,
  options: RestoreSnapshotOptions = {}
): Promise<Database.Database> {
  const { createBackup = true, validateIntegrity = true } = options;

  // Validate snapshot file exists
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Snapshot file not found: ${snapshotPath}`);
  }

  // Validate snapshot integrity if requested
  if (validateIntegrity) {
    const isValid = await validateSnapshot(snapshotPath);
    if (!isValid) {
      throw new Error(`Snapshot integrity check failed: ${snapshotPath}`);
    }
  }

  // Create backup of current database if requested
  if (createBackup && fs.existsSync(currentDbPath)) {
    const backupPath = `${currentDbPath}.before-restore-${Date.now()}.bak`;
    fs.copyFileSync(currentDbPath, backupPath);
  }

  // Copy snapshot to current database path
  // Note: The caller should have already closed the database connection
  try {
    fs.copyFileSync(snapshotPath, currentDbPath);
  } catch (error) {
    throw new Error(
      `Failed to restore snapshot: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Open and return new database connection
  const newDb = new Database(currentDbPath);

  // Configure the restored database
  newDb.pragma('journal_mode = WAL');
  newDb.pragma('synchronous = NORMAL');
  newDb.pragma('foreign_keys = ON');

  return newDb;
}

/**
 * Delete a snapshot and its metadata
 *
 * @param snapshotsDir - Directory containing snapshots
 * @param snapshotId - Snapshot ID to delete
 * @returns True if snapshot was deleted, false if not found
 *
 * @example
 * ```typescript
 * const deleted = deleteSnapshot('/data/snapshots', 'snapshot-1234567890');
 * if (deleted) {
 *   console.log('Snapshot deleted successfully');
 * }
 * ```
 */
export function deleteSnapshot(snapshotsDir: string, snapshotId: string): boolean {
  const snapshotPath = path.join(snapshotsDir, `${snapshotId}.db`);
  const metadataPath = path.join(snapshotsDir, `${snapshotId}.json`);

  let deleted = false;

  // Delete snapshot file
  if (fs.existsSync(snapshotPath)) {
    fs.unlinkSync(snapshotPath);
    deleted = true;
  }

  // Delete metadata file
  if (fs.existsSync(metadataPath)) {
    fs.unlinkSync(metadataPath);
    deleted = true;
  }

  return deleted;
}

/**
 * Validate snapshot integrity
 *
 * @param snapshotPath - Path to snapshot file
 * @returns True if snapshot is valid
 *
 * @example
 * ```typescript
 * const isValid = await validateSnapshot('/data/snapshots/snapshot-1234567890.db');
 * if (!isValid) {
 *   console.error('Snapshot is corrupted');
 * }
 * ```
 */
export async function validateSnapshot(snapshotPath: string): Promise<boolean> {
  if (!fs.existsSync(snapshotPath)) {
    return false;
  }

  try {
    // Open snapshot database in read-only mode
    const db = new Database(snapshotPath, { readonly: true });

    try {
      // Run integrity check
      const isValid = checkDatabaseIntegrity(db);
      return isValid;
    } finally {
      db.close();
    }
  } catch (error) {
    console.warn(`Snapshot validation failed for ${snapshotPath}:`, error);
    return false;
  }
}

/**
 * Clean up old snapshots, keeping only the N most recent
 *
 * @param snapshotsDir - Directory containing snapshots
 * @param keepCount - Number of snapshots to keep
 * @returns Number of snapshots deleted
 *
 * @example
 * ```typescript
 * const deleted = cleanupSnapshots('/data/snapshots', 10);
 * console.log(`Deleted ${deleted} old snapshots`);
 * ```
 */
export function cleanupSnapshots(snapshotsDir: string, keepCount: number): number {
  if (keepCount < 1) {
    throw new Error('keepCount must be at least 1');
  }

  // Get all snapshots sorted by date (newest first)
  const snapshots = listSnapshots(snapshotsDir, { sortOrder: 'desc' });

  // If we have fewer snapshots than keepCount, nothing to delete
  if (snapshots.length <= keepCount) {
    return 0;
  }

  // Delete old snapshots
  const toDelete = snapshots.slice(keepCount);
  let deleted = 0;

  for (const snapshot of toDelete) {
    const success = deleteSnapshot(snapshotsDir, snapshot.id);
    if (success) {
      deleted++;
    }
  }

  return deleted;
}

/**
 * Get schema version from a database
 *
 * @param db - Database instance
 * @returns Schema version number
 */
function getSchemaVersion(db: Database.Database): number {
  try {
    const result = db
      .prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1')
      .get() as { version: number } | undefined;

    return result?.version ?? 0;
  } catch (error) {
    // Table doesn't exist yet
    return 0;
  }
}

/**
 * Get the most recent snapshot
 *
 * @param snapshotsDir - Directory containing snapshots
 * @returns Most recent snapshot or null if none exist
 *
 * @example
 * ```typescript
 * const latest = getLatestSnapshot('/data/snapshots');
 * if (latest) {
 *   console.log(`Latest snapshot: ${latest.id} (${latest.reason})`);
 * }
 * ```
 */
export function getLatestSnapshot(snapshotsDir: string): Snapshot | null {
  const snapshots = listSnapshots(snapshotsDir, { limit: 1, sortOrder: 'desc' });
  return snapshots.length > 0 ? snapshots[0]! : null;
}
