/**
 * Database Migration System
 *
 * This module provides a migration framework for managing database schema changes.
 *
 * Features:
 * - Version-based migration tracking
 * - Idempotent migration execution (safe to run multiple times)
 * - Up/down migration support
 * - Transaction-wrapped migrations
 * - Migration status tracking
 *
 * @module db/migrations
 */

import Database from 'better-sqlite3';
import { getDatabaseVersion, setDatabaseVersion } from './index';

/**
 * Represents a database migration
 */
export interface Migration {
  /**
   * Migration version number (must be unique and sequential)
   */
  version: number;

  /**
   * Human-readable description of the migration
   */
  description: string;

  /**
   * SQL statements to apply the migration (upgrade)
   */
  up: string[];

  /**
   * SQL statements to rollback the migration (downgrade)
   * Optional - if not provided, migration cannot be rolled back
   */
  down?: string[];
}

/**
 * Status of a migration
 */
export interface MigrationStatus {
  /**
   * Migration version
   */
  version: number;

  /**
   * Migration description
   */
  description: string;

  /**
   * Whether the migration has been applied
   */
  applied: boolean;

  /**
   * When the migration was applied (if applied)
   */
  appliedAt?: Date;
}

/**
 * Initialize the migrations tracking table
 *
 * This creates the schema_version table if it doesn't exist.
 * This function is idempotent - safe to call multiple times.
 *
 * @param db - Database instance
 */
export function initializeMigrationTracking(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      description TEXT
    )
  `);
}

/**
 * Get the status of all migrations
 *
 * @param db - Database instance
 * @param migrations - Array of available migrations
 * @returns Array of migration statuses
 */
export function getMigrationStatus(
  db: Database.Database,
  migrations: Migration[]
): MigrationStatus[] {
  // Ensure tracking table exists
  initializeMigrationTracking(db);

  // Get all applied versions
  const appliedVersions = db
    .prepare('SELECT version, applied_at, description FROM schema_version ORDER BY version')
    .all() as Array<{ version: number; applied_at: string; description: string }>;

  const appliedMap = new Map(
    appliedVersions.map((v) => [
      v.version,
      { appliedAt: new Date(v.applied_at), description: v.description },
    ])
  );

  // Build status for all migrations
  return migrations.map((migration) => {
    const applied = appliedMap.get(migration.version);
    return {
      version: migration.version,
      description: migration.description,
      applied: applied !== undefined,
      appliedAt: applied?.appliedAt,
    };
  });
}

/**
 * Get pending migrations (not yet applied)
 *
 * @param db - Database instance
 * @param migrations - Array of available migrations
 * @returns Array of migrations that haven't been applied
 */
export function getPendingMigrations(db: Database.Database, migrations: Migration[]): Migration[] {
  const currentVersion = getDatabaseVersion(db);
  return migrations.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);
}

/**
 * Run a single migration within a transaction
 *
 * @param db - Database instance
 * @param migration - Migration to run
 * @throws Error if migration fails
 */
function runMigration(db: Database.Database, migration: Migration): void {
  // Use a transaction to ensure atomicity
  const txn = db.transaction(() => {
    // Execute all up statements
    for (const statement of migration.up) {
      db.exec(statement);
    }

    // Record the migration
    setDatabaseVersion(db, migration.version);
  });

  txn();
}

/**
 * Run all pending migrations
 *
 * This function is idempotent - it will only apply migrations that haven't
 * been applied yet. Safe to call on every application startup.
 *
 * @param db - Database instance
 * @param migrations - Array of all available migrations (must be in order)
 * @returns Number of migrations applied
 *
 * @throws Error if any migration fails
 *
 * @example
 * ```typescript
 * const migrations: Migration[] = [
 *   {
 *     version: 1,
 *     description: 'Create users table',
 *     up: ['CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'],
 *     down: ['DROP TABLE users']
 *   },
 *   {
 *     version: 2,
 *     description: 'Add email column',
 *     up: ['ALTER TABLE users ADD COLUMN email TEXT'],
 *   }
 * ];
 *
 * const applied = runMigrations(db, migrations);
 * console.log(`Applied ${applied} migrations`);
 * ```
 */
export function runMigrations(db: Database.Database, migrations: Migration[]): number {
  // Ensure tracking table exists
  initializeMigrationTracking(db);

  // Validate migrations
  validateMigrations(migrations);

  // Get pending migrations
  const pending = getPendingMigrations(db, migrations);

  if (pending.length === 0) {
    return 0;
  }

  // Run each pending migration
  let applied = 0;
  for (const migration of pending) {
    try {
      runMigration(db, migration);
      applied++;
    } catch (error) {
      throw new Error(
        `Migration ${migration.version} (${migration.description}) failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return applied;
}

/**
 * Rollback a single migration
 *
 * @param db - Database instance
 * @param migration - Migration to rollback
 * @throws Error if migration doesn't support rollback or rollback fails
 */
function rollbackMigration(db: Database.Database, migration: Migration): void {
  if (!migration.down || migration.down.length === 0) {
    throw new Error(`Migration ${migration.version} does not support rollback`);
  }

  // Use a transaction to ensure atomicity
  const txn = db.transaction(() => {
    // Execute all down statements
    for (const statement of migration.down!) {
      db.exec(statement);
    }

    // Remove the migration record
    db.prepare('DELETE FROM schema_version WHERE version = ?').run(migration.version);
  });

  txn();
}

/**
 * Rollback the last N migrations
 *
 * @param db - Database instance
 * @param migrations - Array of all available migrations
 * @param count - Number of migrations to rollback (default: 1)
 * @returns Number of migrations rolled back
 *
 * @throws Error if any migration doesn't support rollback or rollback fails
 *
 * @example
 * ```typescript
 * // Rollback the last migration
 * const rolled = rollbackMigrations(db, migrations);
 *
 * // Rollback the last 3 migrations
 * const rolled = rollbackMigrations(db, migrations, 3);
 * ```
 */
export function rollbackMigrations(
  db: Database.Database,
  migrations: Migration[],
  count: number = 1
): number {
  if (count < 1) {
    throw new Error('Rollback count must be at least 1');
  }

  const currentVersion = getDatabaseVersion(db);
  if (currentVersion === 0) {
    return 0;
  }

  // Get migrations to rollback (in reverse order)
  const toRollback = migrations
    .filter((m) => m.version <= currentVersion)
    .sort((a, b) => b.version - a.version)
    .slice(0, count);

  if (toRollback.length === 0) {
    return 0;
  }

  // Rollback each migration
  let rolled = 0;
  for (const migration of toRollback) {
    try {
      rollbackMigration(db, migration);
      rolled++;
    } catch (error) {
      throw new Error(
        `Rollback of migration ${migration.version} (${migration.description}) failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return rolled;
}

/**
 * Validate migration array
 *
 * Ensures:
 * - Versions are unique
 * - Versions are positive integers
 * - Migrations have descriptions
 * - Migrations have at least one up statement
 *
 * @param migrations - Array of migrations to validate
 * @throws Error if validation fails
 */
export function validateMigrations(migrations: Migration[]): void {
  const versions = new Set<number>();

  for (const migration of migrations) {
    // Check version is a positive integer
    if (!Number.isInteger(migration.version) || migration.version < 1) {
      throw new Error(`Migration version must be a positive integer, got: ${migration.version}`);
    }

    // Check version is unique
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate migration version: ${migration.version}`);
    }
    versions.add(migration.version);

    // Check description exists
    if (!migration.description || migration.description.trim() === '') {
      throw new Error(`Migration ${migration.version} missing description`);
    }

    // Check has at least one up statement
    if (!migration.up || migration.up.length === 0) {
      throw new Error(`Migration ${migration.version} has no up statements`);
    }

    // Validate up statements are non-empty
    for (let i = 0; i < migration.up.length; i++) {
      const stmt = migration.up[i];
      if (!stmt || stmt.trim() === '') {
        throw new Error(`Migration ${migration.version} has empty up statement at index ${i}`);
      }
    }

    // Validate down statements if present
    if (migration.down) {
      for (let i = 0; i < migration.down.length; i++) {
        const stmt = migration.down[i];
        if (!stmt || stmt.trim() === '') {
          throw new Error(`Migration ${migration.version} has empty down statement at index ${i}`);
        }
      }
    }
  }
}

/**
 * Reset database to a specific version
 *
 * This will rollback or apply migrations as needed to reach the target version.
 *
 * @param db - Database instance
 * @param migrations - Array of all available migrations
 * @param targetVersion - Version to migrate to (0 = empty database)
 * @returns Number of migrations applied or rolled back
 *
 * @throws Error if any migration fails
 */
export function migrateToVersion(
  db: Database.Database,
  migrations: Migration[],
  targetVersion: number
): number {
  const currentVersion = getDatabaseVersion(db);

  if (currentVersion === targetVersion) {
    return 0;
  }

  if (targetVersion > currentVersion) {
    // Apply migrations up to target version
    const toApply = migrations
      .filter((m) => m.version > currentVersion && m.version <= targetVersion)
      .sort((a, b) => a.version - b.version);

    let applied = 0;
    for (const migration of toApply) {
      runMigration(db, migration);
      applied++;
    }
    return applied;
  } else {
    // Rollback migrations down to target version
    const toRollback = migrations
      .filter((m) => m.version > targetVersion && m.version <= currentVersion)
      .sort((a, b) => b.version - a.version);

    let rolled = 0;
    for (const migration of toRollback) {
      rollbackMigration(db, migration);
      rolled++;
    }
    return rolled;
  }
}
