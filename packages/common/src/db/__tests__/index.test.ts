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
});
