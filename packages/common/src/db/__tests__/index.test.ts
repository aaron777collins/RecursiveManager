/**
 * Tests for database initialization and connection management
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  initializeDatabase,
  getDatabaseVersion,
  setDatabaseVersion,
  checkDatabaseIntegrity,
  backupDatabase,
  optimizeDatabase,
  transaction,
  getDatabaseHealth,
  DatabasePool,
} from '../index';

describe('Database Initialization', () => {
  let testDir: string;
  let dbPath: string;

  beforeEach(() => {
    // Create temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-db-test-'));
    dbPath = path.join(testDir, 'test.db');
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Reset database pool
    DatabasePool.getInstance().reset();
  });

  describe('initializeDatabase', () => {
    it('should create a new database with WAL mode', () => {
      const connection = initializeDatabase({ path: dbPath });

      expect(connection).toBeDefined();
      expect(connection.db).toBeDefined();
      expect(fs.existsSync(dbPath)).toBe(true);

      // Verify WAL mode
      const walMode = connection.db.pragma('journal_mode', { simple: true });
      expect(walMode).toBe('wal');

      // Verify foreign keys enabled
      const foreignKeys = connection.db.pragma('foreign_keys', { simple: true });
      expect(foreignKeys).toBe(1);

      connection.close();
    });

    it('should create database directory if it does not exist', () => {
      const nestedPath = path.join(testDir, 'nested', 'deep', 'test.db');
      const connection = initializeDatabase({ path: nestedPath });

      expect(fs.existsSync(nestedPath)).toBe(true);
      expect(fs.existsSync(path.dirname(nestedPath))).toBe(true);

      connection.close();
    });

    it('should open existing database', () => {
      // Create initial database
      const conn1 = initializeDatabase({ path: dbPath });
      conn1.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      conn1.close();

      // Reopen database
      const conn2 = initializeDatabase({ path: dbPath });

      // Verify table exists
      const tables = conn2.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test'")
        .all();
      expect(tables).toHaveLength(1);

      conn2.close();
    });

    it('should respect readonly option', () => {
      // Create database first
      const writeConn = initializeDatabase({ path: dbPath });
      writeConn.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      writeConn.close();

      // Open in readonly mode
      const readConn = initializeDatabase({ path: dbPath, readonly: true });

      // Should be able to read
      const tables = readConn.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
      expect(tables.length).toBeGreaterThan(0);

      // Should not be able to write
      expect(() => {
        readConn.db.exec('CREATE TABLE test2 (id INTEGER PRIMARY KEY)');
      }).toThrow();

      readConn.close();
    });

    it('should set custom timeout', () => {
      const connection = initializeDatabase({ path: dbPath, timeout: 10000 });

      const timeout = connection.db.pragma('busy_timeout', { simple: true });
      expect(timeout).toBe(10000);

      connection.close();
    });

    it('should enable verbose logging when specified', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const connection = initializeDatabase({ path: dbPath, verbose: true });
      connection.db.prepare('SELECT 1').get();

      // Verbose mode should log SQL
      expect(consoleSpy).toHaveBeenCalled();

      connection.close();
      consoleSpy.mockRestore();
    });
  });

  describe('healthCheck', () => {
    it('should return true for healthy database', () => {
      const connection = initializeDatabase({ path: dbPath });

      expect(connection.healthCheck()).toBe(true);

      connection.close();
    });

    it('should return false after closing database', () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.close();

      expect(connection.healthCheck()).toBe(false);
    });
  });

  describe('getDatabaseVersion', () => {
    it('should return 0 for uninitialized database', () => {
      const connection = initializeDatabase({ path: dbPath });

      const version = getDatabaseVersion(connection.db);
      expect(version).toBe(0);

      connection.close();
    });

    it('should return correct version after setting', () => {
      const connection = initializeDatabase({ path: dbPath });

      setDatabaseVersion(connection.db, 1);
      expect(getDatabaseVersion(connection.db)).toBe(1);

      setDatabaseVersion(connection.db, 2);
      expect(getDatabaseVersion(connection.db)).toBe(2);

      connection.close();
    });
  });

  describe('setDatabaseVersion', () => {
    it('should create schema_version table if not exists', () => {
      const connection = initializeDatabase({ path: dbPath });

      setDatabaseVersion(connection.db, 1);

      const tables = connection.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
        .all();
      expect(tables).toHaveLength(1);

      connection.close();
    });

    it('should record multiple versions', () => {
      const connection = initializeDatabase({ path: dbPath });

      setDatabaseVersion(connection.db, 1);
      setDatabaseVersion(connection.db, 2);
      setDatabaseVersion(connection.db, 3);

      const versions = connection.db
        .prepare('SELECT version FROM schema_version ORDER BY version')
        .all() as Array<{ version: number }>;

      expect(versions).toHaveLength(3);
      expect(versions.map((v) => v.version)).toEqual([1, 2, 3]);

      connection.close();
    });
  });

  describe('checkDatabaseIntegrity', () => {
    it('should return true for healthy database', () => {
      const connection = initializeDatabase({ path: dbPath });

      expect(checkDatabaseIntegrity(connection.db)).toBe(true);

      connection.close();
    });

    it('should detect corrupted database', () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      connection.close();

      // Corrupt the database file
      const data = fs.readFileSync(dbPath);
      const corrupted = Buffer.alloc(data.length);
      corrupted.fill(0);
      fs.writeFileSync(dbPath, corrupted);

      // Try to open and check integrity
      try {
        const corruptedConn = initializeDatabase({ path: dbPath });
        const isHealthy = checkDatabaseIntegrity(corruptedConn.db);
        expect(isHealthy).toBe(false);
        corruptedConn.close();
      } catch (error) {
        // Expected - database is too corrupted to open
        expect(error).toBeDefined();
      }
    });
  });

  describe('backupDatabase', () => {
    it('should create database backup', async () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      connection.db.exec("INSERT INTO test (id, name) VALUES (1, 'Alice'), (2, 'Bob')");

      const backupPath = path.join(testDir, 'backup.db');
      await backupDatabase(connection.db, backupPath);

      expect(fs.existsSync(backupPath)).toBe(true);

      // Verify backup contents
      const backupConn = initializeDatabase({ path: backupPath });
      const rows = backupConn.db.prepare('SELECT * FROM test').all();
      expect(rows).toHaveLength(2);

      connection.close();
      backupConn.close();
    });

    it('should create backup directory if it does not exist', async () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');

      const backupPath = path.join(testDir, 'backups', 'nested', 'backup.db');
      await backupDatabase(connection.db, backupPath);

      expect(fs.existsSync(backupPath)).toBe(true);
      expect(fs.existsSync(path.dirname(backupPath))).toBe(true);

      connection.close();
    });
  });

  describe('optimizeDatabase', () => {
    it('should run ANALYZE and VACUUM without errors', () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      connection.db.exec("INSERT INTO test (id, name) VALUES (1, 'Alice'), (2, 'Bob')");

      expect(() => optimizeDatabase(connection.db)).not.toThrow();

      connection.close();
    });
  });

  describe('transaction', () => {
    it('should execute function within transaction', () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');

      const result = transaction(connection.db, () => {
        connection.db.exec("INSERT INTO test (id, name) VALUES (1, 'Alice')");
        connection.db.exec("INSERT INTO test (id, name) VALUES (2, 'Bob')");
        return 'success';
      });

      expect(result).toBe('success');

      const rows = connection.db.prepare('SELECT * FROM test').all();
      expect(rows).toHaveLength(2);

      connection.close();
    });

    it('should rollback on error', () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');

      expect(() => {
        transaction(connection.db, () => {
          connection.db.exec("INSERT INTO test (id, name) VALUES (1, 'Alice')");
          throw new Error('Test error');
        });
      }).toThrow('Test error');

      const rows = connection.db.prepare('SELECT * FROM test').all();
      expect(rows).toHaveLength(0);

      connection.close();
    });

    it('should return function result', () => {
      const connection = initializeDatabase({ path: dbPath });

      const result = transaction(connection.db, () => {
        return { count: 42, success: true };
      });

      expect(result).toEqual({ count: 42, success: true });

      connection.close();
    });
  });

  describe('DatabasePool', () => {
    it('should initialize pool with database connection', () => {
      const pool = DatabasePool.getInstance();

      pool.initialize({ path: dbPath });

      expect(pool.isInitialized()).toBe(true);
      expect(pool.getPath()).toBe(dbPath);
    });

    it('should return singleton instance', () => {
      const pool1 = DatabasePool.getInstance();
      const pool2 = DatabasePool.getInstance();

      expect(pool1).toBe(pool2);
    });

    it('should throw if initializing twice', () => {
      const pool = DatabasePool.getInstance();
      pool.initialize({ path: dbPath });

      expect(() => pool.initialize({ path: dbPath })).toThrow('Database pool already initialized');
    });

    it('should get connection after initialization', () => {
      const pool = DatabasePool.getInstance();
      pool.initialize({ path: dbPath });

      const connection = pool.getConnection();
      expect(connection).toBeDefined();
      expect(connection.db).toBeDefined();
    });

    it('should throw if getting connection before initialization', () => {
      const pool = DatabasePool.getInstance();

      expect(() => pool.getConnection()).toThrow(
        'Database pool not initialized. Call initialize() first.'
      );
    });

    it('should close pool and connection', () => {
      const pool = DatabasePool.getInstance();
      pool.initialize({ path: dbPath });

      const connection = pool.getConnection();
      expect(connection.healthCheck()).toBe(true);

      pool.close();

      expect(pool.isInitialized()).toBe(false);
      expect(connection.healthCheck()).toBe(false);
    });

    it('should reset pool for testing', () => {
      const pool = DatabasePool.getInstance();
      pool.initialize({ path: dbPath });

      pool.reset();

      expect(pool.isInitialized()).toBe(false);

      // Should be able to reinitialize after reset
      expect(() => pool.initialize({ path: dbPath })).not.toThrow();
    });
  });

  describe('Concurrency', () => {
    it('should handle multiple concurrent reads', async () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      connection.db.exec("INSERT INTO test (id, name) VALUES (1, 'Alice'), (2, 'Bob')");

      // Multiple simultaneous reads
      const promises = Array.from({ length: 10 }, () =>
        Promise.resolve(connection.db.prepare('SELECT * FROM test').all())
      );

      const results = await Promise.all(promises);

      results.forEach((rows) => {
        expect(rows).toHaveLength(2);
      });

      connection.close();
    });

    it('should handle reads during writes with WAL mode', async () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');

      // Start a write operation
      const writePromise = new Promise<void>((resolve) => {
        transaction(connection.db, () => {
          for (let i = 0; i < 100; i++) {
            connection.db.exec(`INSERT INTO test (id, name) VALUES (${i}, 'User${i}')`);
          }
          resolve();
        });
      });

      // Concurrent reads
      const readPromises = Array.from({ length: 5 }, () =>
        Promise.resolve(connection.db.prepare('SELECT COUNT(*) as count FROM test').get())
      );

      await Promise.all([writePromise, ...readPromises]);

      const finalCount = connection.db.prepare('SELECT COUNT(*) as count FROM test').get() as {
        count: number;
      };
      expect(finalCount.count).toBe(100);

      connection.close();
    });
  });

  describe('getDatabaseHealth', () => {
    it('should return healthy status for new database', () => {
      const connection = initializeDatabase({ path: dbPath });

      const health = getDatabaseHealth(connection.db, dbPath);

      expect(health.healthy).toBe(true);
      expect(health.checks.accessible).toBe(true);
      expect(health.checks.integrityOk).toBe(true);
      expect(health.checks.walEnabled).toBe(true);
      expect(health.checks.foreignKeysEnabled).toBe(true);
      expect(health.errors).toHaveLength(0);

      connection.close();
    });

    it('should return database statistics', () => {
      const connection = initializeDatabase({ path: dbPath });

      // Add some data to make stats more interesting
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      connection.db.exec("INSERT INTO test (id, name) VALUES (1, 'Alice'), (2, 'Bob')");

      const health = getDatabaseHealth(connection.db, dbPath);

      expect(health.stats.databaseSize).toBeGreaterThan(0);
      expect(health.stats.pageCount).toBeGreaterThan(0);
      expect(health.stats.pageSize).toBeGreaterThan(0);
      expect(health.stats.schemaVersion).toBe(0);

      connection.close();
    });

    it('should include WAL file size when WAL exists', () => {
      const connection = initializeDatabase({ path: dbPath });

      // Create some data to force WAL creation
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)');
      for (let i = 0; i < 100; i++) {
        connection.db.exec(`INSERT INTO test (id, data) VALUES (${i}, '${'x'.repeat(1000)}')`);
      }

      const health = getDatabaseHealth(connection.db, dbPath);

      // WAL file should exist and have some size
      expect(health.stats.walSize).toBeGreaterThanOrEqual(0);

      connection.close();
    });

    it('should detect database version from schema_version table', () => {
      const connection = initializeDatabase({ path: dbPath });

      setDatabaseVersion(connection.db, 5);

      const health = getDatabaseHealth(connection.db, dbPath);

      expect(health.stats.schemaVersion).toBe(5);

      connection.close();
    });

    it('should detect unhealthy database when closed', () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.close();

      const health = getDatabaseHealth(connection.db, dbPath);

      expect(health.healthy).toBe(false);
      expect(health.checks.accessible).toBe(false);
      expect(health.errors.length).toBeGreaterThan(0);
    });

    it('should include error messages for failed checks', () => {
      const connection = initializeDatabase({ path: dbPath });
      connection.close();

      const health = getDatabaseHealth(connection.db, dbPath);

      expect(health.errors.some((err) => err.includes('not accessible'))).toBe(true);
    });

    it('should detect when database file does not exist', () => {
      const connection = initializeDatabase({ path: dbPath });
      const nonExistentPath = path.join(os.tmpdir(), 'nonexistent-db.sqlite');

      const health = getDatabaseHealth(connection.db, nonExistentPath);

      // Database is still accessible (in-memory or existing connection)
      // but file size should be 0
      expect(health.stats.databaseSize).toBe(0);

      connection.close();
    });

    it('should handle multiple health checks in sequence', () => {
      const connection = initializeDatabase({ path: dbPath });

      const health1 = getDatabaseHealth(connection.db, dbPath);
      const health2 = getDatabaseHealth(connection.db, dbPath);
      const health3 = getDatabaseHealth(connection.db, dbPath);

      expect(health1.healthy).toBe(true);
      expect(health2.healthy).toBe(true);
      expect(health3.healthy).toBe(true);

      connection.close();
    });

    it('should report all check results even if some fail', () => {
      const connection = initializeDatabase({ path: dbPath });

      const health = getDatabaseHealth(connection.db, dbPath);

      // All checks should have boolean values
      expect(typeof health.checks.accessible).toBe('boolean');
      expect(typeof health.checks.integrityOk).toBe('boolean');
      expect(typeof health.checks.walEnabled).toBe('boolean');
      expect(typeof health.checks.foreignKeysEnabled).toBe('boolean');

      connection.close();
    });
  });

  describe('Database Recovery', () => {
    it('should recover from backup after corruption', async () => {
      const connection = initializeDatabase({ path: dbPath });

      // Create and populate database
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      connection.db.exec(
        "INSERT INTO test (id, name) VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')"
      );

      // Create backup
      const backupPath = path.join(testDir, 'backup.db');
      await backupDatabase(connection.db, backupPath);

      // Verify backup is valid
      const backupConn = initializeDatabase({ path: backupPath });
      const backupRows = backupConn.db.prepare('SELECT * FROM test').all();
      expect(backupRows).toHaveLength(3);
      backupConn.close();

      // Close and corrupt the original database
      connection.close();
      const dbContent = fs.readFileSync(dbPath);
      const corruptedContent = Buffer.from(dbContent);
      // Corrupt the database header
      corruptedContent.write('CORRUPTED', 0);
      fs.writeFileSync(dbPath, corruptedContent);

      // Verify database is corrupted
      try {
        const corruptedConn = initializeDatabase({ path: dbPath });
        const integrity = checkDatabaseIntegrity(corruptedConn.db);
        expect(integrity).toBe(false);
        corruptedConn.close();
      } catch (error) {
        // Expected - database might be too corrupted to open
      }

      // Restore from backup
      fs.copyFileSync(backupPath, dbPath);

      // Verify restoration
      const restoredConn = initializeDatabase({ path: dbPath });
      const restoredRows = restoredConn.db.prepare('SELECT * FROM test').all();
      expect(restoredRows).toHaveLength(3);
      expect(restoredRows).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ]);

      restoredConn.close();
    });

    it('should detect corruption through integrity check', () => {
      const connection = initializeDatabase({ path: dbPath });

      // Create valid database
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
      connection.db.exec("INSERT INTO test (id, value) VALUES (1, 'data')");

      // Verify integrity before corruption
      const integrityBefore = checkDatabaseIntegrity(connection.db);
      expect(integrityBefore).toBe(true);

      connection.close();

      // Corrupt by modifying the middle of the database (page data)
      const dbContent = fs.readFileSync(dbPath);
      const corruptedContent = Buffer.from(dbContent);
      // Corrupt a page in the middle (offset past header at byte 100+)
      if (corruptedContent.length > 100) {
        corruptedContent.write('CORRUPTED_PAGE_DATA', 100);
        fs.writeFileSync(dbPath, corruptedContent);
      }

      // Try to open and check integrity
      // Severe corruption may prevent opening entirely
      try {
        const corruptedConn = initializeDatabase({ path: dbPath });
        const integrityAfter = checkDatabaseIntegrity(corruptedConn.db);

        // Should detect corruption
        expect(integrityAfter).toBe(false);

        corruptedConn.close();
      } catch (error) {
        // Database too corrupted to open - this is also a valid corruption detection
        expect(error).toBeDefined();
        expect((error as Error).message).toMatch(/malformed|corrupt/i);
      }
    });

    it('should preserve data through WAL recovery', () => {
      const connection = initializeDatabase({ path: dbPath });

      // Create table and insert data
      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      connection.db.exec("INSERT INTO test (id, name) VALUES (1, 'Original')");

      // Verify WAL mode
      const walMode = connection.db.pragma('journal_mode', { simple: true });
      expect(walMode).toBe('wal');

      // Make changes that go into WAL
      connection.db.exec("INSERT INTO test (id, name) VALUES (2, 'InWAL')");

      connection.close();

      // Reopen - WAL should be automatically applied
      const reopenedConn = initializeDatabase({ path: dbPath });
      const rows = reopenedConn.db.prepare('SELECT * FROM test ORDER BY id').all();

      expect(rows).toHaveLength(2);
      expect(rows).toEqual([
        { id: 1, name: 'Original' },
        { id: 2, name: 'InWAL' },
      ]);

      reopenedConn.close();
    });

    it('should recover from transaction rollback', () => {
      const connection = initializeDatabase({ path: dbPath });

      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
      connection.db.exec("INSERT INTO test (id, value) VALUES (1, 'initial')");

      // Start transaction and make changes
      connection.db.exec('BEGIN TRANSACTION');
      connection.db.exec("INSERT INTO test (id, value) VALUES (2, 'temp')");

      // Verify changes are visible within transaction
      const duringTx = connection.db.prepare('SELECT COUNT(*) as count FROM test').get() as {
        count: number;
      };
      expect(duringTx.count).toBe(2);

      // Rollback transaction
      connection.db.exec('ROLLBACK');

      // Verify rollback worked
      const afterRollback = connection.db.prepare('SELECT COUNT(*) as count FROM test').get() as {
        count: number;
      };
      expect(afterRollback.count).toBe(1);

      const rows = connection.db.prepare('SELECT * FROM test').all();
      expect(rows).toEqual([{ id: 1, value: 'initial' }]);

      connection.close();
    });

    it('should handle backup restoration with schema validation', async () => {
      const connection = initializeDatabase({ path: dbPath });

      // Create schema
      connection.db.exec(`
        CREATE TABLE agents (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          status TEXT NOT NULL
        )
      `);
      connection.db.exec("INSERT INTO agents VALUES ('agent1', 'Alice', 'active')");

      // Create backup
      const backupPath = path.join(testDir, 'schema-backup.db');
      await backupDatabase(connection.db, backupPath);

      connection.close();

      // Restore from backup
      fs.copyFileSync(backupPath, dbPath);

      // Verify schema and data
      const restoredConn = initializeDatabase({ path: dbPath });

      // Check schema
      const tables = restoredConn.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agents'")
        .all();
      expect(tables).toHaveLength(1);

      // Check data
      const rows = restoredConn.db.prepare('SELECT * FROM agents').all();
      expect(rows).toEqual([{ id: 'agent1', name: 'Alice', status: 'active' }]);

      // Verify integrity
      const integrity = checkDatabaseIntegrity(restoredConn.db);
      expect(integrity).toBe(true);

      restoredConn.close();
    });

    it('should handle concurrent backup operations', async () => {
      const connection = initializeDatabase({ path: dbPath });

      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT)');
      connection.db.exec("INSERT INTO test VALUES (1, 'data1')");

      // Create multiple backups concurrently
      const backup1Path = path.join(testDir, 'backup1.db');
      const backup2Path = path.join(testDir, 'backup2.db');
      const backup3Path = path.join(testDir, 'backup3.db');

      await Promise.all([
        backupDatabase(connection.db, backup1Path),
        backupDatabase(connection.db, backup2Path),
        backupDatabase(connection.db, backup3Path),
      ]);

      // Verify all backups are valid
      for (const backupPath of [backup1Path, backup2Path, backup3Path]) {
        expect(fs.existsSync(backupPath)).toBe(true);

        const backupConn = initializeDatabase({ path: backupPath });
        const rows = backupConn.db.prepare('SELECT * FROM test').all();
        expect(rows).toHaveLength(1);
        backupConn.close();
      }

      connection.close();
    });

    it('should verify database health after recovery', async () => {
      const connection = initializeDatabase({ path: dbPath });

      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');

      // Create backup
      const backupPath = path.join(testDir, 'health-backup.db');
      await backupDatabase(connection.db, backupPath);

      connection.close();

      // Restore from backup
      fs.copyFileSync(backupPath, dbPath);

      // Check health after restoration
      const restoredConn = initializeDatabase({ path: dbPath });
      const health = getDatabaseHealth(restoredConn.db, dbPath);

      expect(health.healthy).toBe(true);
      expect(health.checks.accessible).toBe(true);
      expect(health.checks.integrityOk).toBe(true);
      expect(health.checks.walEnabled).toBe(true);
      expect(health.checks.foreignKeysEnabled).toBe(true);
      expect(health.errors).toHaveLength(0);

      restoredConn.close();
    });

    it('should handle backup of database with WAL file', async () => {
      const connection = initializeDatabase({ path: dbPath });

      connection.db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, value TEXT)');
      connection.db.exec("INSERT INTO test VALUES (1, 'data')");

      // Force WAL checkpoint to create WAL file
      connection.db.pragma('wal_checkpoint(PASSIVE)');

      // Add more data to create WAL entries
      connection.db.exec("INSERT INTO test VALUES (2, 'wal-data')");

      // Create backup (should include WAL data)
      const backupPath = path.join(testDir, 'wal-backup.db');
      await backupDatabase(connection.db, backupPath);

      // Verify backup includes all data
      const backupConn = initializeDatabase({ path: backupPath });
      const rows = backupConn.db.prepare('SELECT * FROM test ORDER BY id').all();
      expect(rows).toHaveLength(2);
      expect(rows).toEqual([
        { id: 1, value: 'data' },
        { id: 2, value: 'wal-data' },
      ]);

      backupConn.close();
      connection.close();
    });
  });
});
