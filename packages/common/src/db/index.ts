/**
 * Database Layer - SQLite with WAL mode
 *
 * This module provides database initialization and connection management
 * for the RecursiveManager system.
 *
 * Features:
 * - WAL (Write-Ahead Logging) mode for better concurrency
 * - Connection pooling (single connection in better-sqlite3)
 * - Automatic initialization and migration
 * - Crash recovery
 *
 * @module db
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

export interface DatabaseOptions {
  /**
   * Path to the SQLite database file
   */
  path: string;

  /**
   * Whether to enable verbose logging
   * @default false
   */
  verbose?: boolean;

  /**
   * Whether to run in read-only mode
   * @default false
   */
  readonly?: boolean;

  /**
   * Timeout for acquiring locks (milliseconds)
   * @default 5000
   */
  timeout?: number;
}

export interface DatabaseHealthStatus {
  /**
   * Whether the database is healthy overall
   */
  healthy: boolean;

  /**
   * Individual check results
   */
  checks: {
    /**
     * Database is accessible and can execute queries
     */
    accessible: boolean;

    /**
     * Database integrity check passes (PRAGMA integrity_check)
     */
    integrityOk: boolean;

    /**
     * WAL mode is enabled
     */
    walEnabled: boolean;

    /**
     * Foreign keys are enabled
     */
    foreignKeysEnabled: boolean;
  };

  /**
   * Database statistics and metrics
   */
  stats: {
    /**
     * Database file size in bytes
     */
    databaseSize: number;

    /**
     * WAL file size in bytes (0 if not exists)
     */
    walSize: number;

    /**
     * Number of pages in the database
     */
    pageCount: number;

    /**
     * Database page size in bytes
     */
    pageSize: number;

    /**
     * Current schema version
     */
    schemaVersion: number;
  };

  /**
   * Any errors encountered during health checks
   */
  errors: string[];
}

export interface DatabaseConnection {
  /**
   * The underlying better-sqlite3 database instance
   */
  db: Database.Database;

  /**
   * Close the database connection
   */
  close: () => void;

  /**
   * Run a health check on the database
   */
  healthCheck: () => boolean;
}

/**
 * Initialize a SQLite database with WAL mode and optimal settings
 *
 * @param options - Database configuration options
 * @returns Database connection wrapper
 *
 * @example
 * ```typescript
 * const db = await initializeDatabase({ path: './data/rm.db' });
 * // Use db.db for queries
 * db.close();
 * ```
 */
export function initializeDatabase(options: DatabaseOptions): DatabaseConnection {
  const { path: dbPath, verbose = false, readonly = false, timeout = 5000 } = options;

  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  }

  // Open database connection
  const db = new Database(dbPath, {
    readonly,
    // eslint-disable-next-line no-console
    verbose: verbose ? console.log : undefined,
    timeout,
  });

  // Configure WAL mode for better concurrency
  // WAL mode allows multiple readers and one writer simultaneously
  if (!readonly) {
    db.pragma('journal_mode = WAL');
  }

  // Set synchronous mode to NORMAL for better performance with WAL
  // NORMAL is safe with WAL and much faster than FULL
  db.pragma('synchronous = NORMAL');

  // Enable foreign key constraints
  db.pragma('foreign_keys = ON');

  // Set a reasonable cache size (10MB in pages, assuming 4KB page size)
  db.pragma('cache_size = -10000');

  // Set temp_store to memory for better performance
  db.pragma('temp_store = MEMORY');

  // Set busy timeout for handling concurrent access
  db.pragma(`busy_timeout = ${timeout}`);

  // Verify configuration
  const walMode = db.pragma('journal_mode', { simple: true });
  const foreignKeys = db.pragma('foreign_keys', { simple: true });

  if (!readonly && walMode !== 'wal') {
    throw new Error(`Failed to enable WAL mode. Current mode: ${String(walMode)}`);
  }

  if (foreignKeys !== 1) {
    throw new Error('Failed to enable foreign key constraints');
  }

  // Create connection wrapper
  const connection: DatabaseConnection = {
    db,
    close: () => {
      db.close();
    },
    healthCheck: () => {
      try {
        // Simple query to verify database is accessible
        db.prepare('SELECT 1').get();
        return true;
      } catch {
        // Database is closed or inaccessible
        return false;
      }
    },
  };

  return connection;
}

/**
 * Get current database version from the schema_version table
 *
 * @param db - Database instance
 * @returns Current version number, or 0 if not initialized
 */
export function getDatabaseVersion(db: Database.Database): number {
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
 * Set database version in the schema_version table
 *
 * @param db - Database instance
 * @param version - Version number to set
 */
export function setDatabaseVersion(db: Database.Database, version: number): void {
  // Create schema_version table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      description TEXT
    )
  `);

  // Insert new version
  db.prepare(
    `
    INSERT INTO schema_version (version, description)
    VALUES (?, ?)
  `
  ).run(version, `Schema version ${version}`);
}

/**
 * Verify database integrity
 *
 * @param db - Database instance
 * @returns True if integrity check passes
 */
export function checkDatabaseIntegrity(db: Database.Database): boolean {
  try {
    const result = db.pragma('integrity_check', { simple: true });
    return result === 'ok';
  } catch (error) {
    console.error('Database integrity check failed:', error);
    return false;
  }
}

/**
 * Create a database backup
 *
 * @param db - Database instance
 * @param backupPath - Path for the backup file
 */
export async function backupDatabase(db: Database.Database, backupPath: string): Promise<void> {
  // Ensure backup directory exists
  const dir = path.dirname(backupPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  }

  // Use better-sqlite3's backup API
  await db.backup(backupPath);
}

/**
 * Optimize database by running VACUUM and ANALYZE
 *
 * @param db - Database instance
 */
export function optimizeDatabase(db: Database.Database): void {
  // ANALYZE updates statistics for query optimization
  db.exec('ANALYZE');

  // VACUUM reclaims unused space (only safe outside transactions)
  try {
    db.exec('VACUUM');
  } catch (error) {
    console.warn('VACUUM failed (may be in transaction):', error);
  }
}

/**
 * Execute a function within a transaction
 *
 * @param db - Database instance
 * @param fn - Function to execute
 * @returns Result of the function
 */
export function transaction<T>(db: Database.Database, fn: () => T): T {
  const txn = db.transaction(fn);
  return txn();
}

/**
 * Perform comprehensive database health check
 *
 * This function performs multiple checks to ensure the database is healthy:
 * - Accessibility (can execute queries)
 * - Integrity check (PRAGMA integrity_check)
 * - Configuration verification (WAL mode, foreign keys)
 * - Statistics collection (file size, page count, schema version)
 *
 * @param db - Database instance
 * @param dbPath - Path to the database file (for file size checks)
 * @returns Comprehensive health status
 */
export function getDatabaseHealth(db: Database.Database, dbPath: string): DatabaseHealthStatus {
  const errors: string[] = [];
  const checks = {
    accessible: false,
    integrityOk: false,
    walEnabled: false,
    foreignKeysEnabled: false,
  };
  const stats = {
    databaseSize: 0,
    walSize: 0,
    pageCount: 0,
    pageSize: 0,
    schemaVersion: 0,
  };

  // Check 1: Database accessibility
  try {
    db.prepare('SELECT 1').get();
    checks.accessible = true;
  } catch (error) {
    errors.push(
      `Database not accessible: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Check 2: Database integrity
  try {
    const result = db.pragma('integrity_check', { simple: true });
    checks.integrityOk = result === 'ok';
    if (!checks.integrityOk) {
      errors.push(`Database integrity check failed: ${result}`);
    }
  } catch (error) {
    errors.push(
      `Integrity check failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Check 3: WAL mode verification
  try {
    const journalMode = db.pragma('journal_mode', { simple: true }) as string;
    checks.walEnabled = journalMode.toLowerCase() === 'wal';
    if (!checks.walEnabled) {
      errors.push(`WAL mode not enabled (current: ${journalMode})`);
    }
  } catch (error) {
    errors.push(
      `Failed to check WAL mode: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Check 4: Foreign keys verification
  try {
    const foreignKeys = db.pragma('foreign_keys', { simple: true }) as number;
    checks.foreignKeysEnabled = foreignKeys === 1;
    if (!checks.foreignKeysEnabled) {
      errors.push('Foreign keys are not enabled');
    }
  } catch (error) {
    errors.push(
      `Failed to check foreign keys: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Stats 1: Database file size
  try {
    if (fs.existsSync(dbPath)) {
      const stat = fs.statSync(dbPath);
      stats.databaseSize = stat.size;
    }
  } catch (error) {
    errors.push(
      `Failed to get database size: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Stats 2: WAL file size
  try {
    const walPath = `${dbPath}-wal`;
    if (fs.existsSync(walPath)) {
      const stat = fs.statSync(walPath);
      stats.walSize = stat.size;
    }
  } catch (error) {
    // WAL file may not exist, this is not an error
  }

  // Stats 3: Page count and page size
  try {
    stats.pageCount = db.pragma('page_count', { simple: true }) as number;
    stats.pageSize = db.pragma('page_size', { simple: true }) as number;
  } catch (error) {
    errors.push(
      `Failed to get page stats: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Stats 4: Schema version
  try {
    stats.schemaVersion = getDatabaseVersion(db);
  } catch (error) {
    errors.push(
      `Failed to get schema version: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Overall health is true if all critical checks pass
  const healthy =
    checks.accessible && checks.integrityOk && checks.walEnabled && checks.foreignKeysEnabled;

  return {
    healthy,
    checks,
    stats,
    errors,
  };
}

/**
 * Connection pool manager (simple singleton pattern)
 * Note: better-sqlite3 doesn't need connection pooling like async databases
 * because it's synchronous and uses a single connection efficiently.
 * However, we provide this for API consistency and future extensibility.
 */
export class DatabasePool {
  private static instance: DatabasePool | null = null;
  private connection: DatabaseConnection | null = null;
  private dbPath: string = '';

  private constructor() {}

  /**
   * Get the singleton pool instance
   */
  public static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  /**
   * Initialize the pool with a database connection
   */
  public initialize(options: DatabaseOptions): void {
    if (this.connection) {
      throw new Error('Database pool already initialized');
    }

    this.dbPath = options.path;
    this.connection = initializeDatabase(options);
  }

  /**
   * Get the database connection
   */
  public getConnection(): DatabaseConnection {
    if (!this.connection) {
      throw new Error('Database pool not initialized. Call initialize() first.');
    }
    return this.connection;
  }

  /**
   * Close the pool and all connections
   */
  public close(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
  }

  /**
   * Check if pool is initialized
   */
  public isInitialized(): boolean {
    return this.connection !== null;
  }

  /**
   * Get the database path
   */
  public getPath(): string {
    return this.dbPath;
  }

  /**
   * Reset the pool (for testing)
   */
  public reset(): void {
    this.close();
    DatabasePool.instance = null;
  }
}

/**
 * Convenience function to get the database connection from the singleton pool
 * This is a shortcut for DatabasePool.getInstance().getConnection()
 *
 * @returns Database connection
 * @throws Error if pool is not initialized
 */
export function getDatabase(): DatabaseConnection {
  return DatabasePool.getInstance().getConnection();
}

// Export constants
export * from './constants';

// Export query APIs
export * from './queries';

// Export task ID generator utilities
export * from './taskIdGenerator';

// Export retry utilities
export * from './retry';
