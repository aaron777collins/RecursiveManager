/**
 * Tests for Database Migration System
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  initializeMigrationTracking,
  getMigrationStatus,
  getPendingMigrations,
  runMigrations,
  rollbackMigrations,
  validateMigrations,
  migrateToVersion,
  type Migration,
} from '../migrations';
import { getDatabaseVersion, initializeDatabase } from '../index';

describe('Migration System', () => {
  let testDir: string;
  let dbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    // Create temporary directory for test databases
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    dbPath = path.join(testDir, 'test.db');
    const conn = initializeDatabase({ path: dbPath });
    db = conn.db;
  });

  afterEach(() => {
    // Clean up
    if (db) {
      db.close();
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initializeMigrationTracking', () => {
    it('should create schema_version table', () => {
      initializeMigrationTracking(db);

      // Verify table exists
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
        .get();

      expect(result).toBeDefined();
    });

    it('should be idempotent', () => {
      initializeMigrationTracking(db);
      initializeMigrationTracking(db);
      initializeMigrationTracking(db);

      // Should not throw and table should exist
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'")
        .get();

      expect(result).toBeDefined();
    });

    it('should create table with correct schema', () => {
      initializeMigrationTracking(db);

      // Check columns
      const columns = db.prepare('PRAGMA table_info(schema_version)').all() as Array<{
        name: string;
        type: string;
        pk: number;
      }>;

      expect(columns).toHaveLength(3);
      expect(columns[0]).toMatchObject({ name: 'version', type: 'INTEGER', pk: 1 });
      expect(columns[1]).toMatchObject({ name: 'applied_at', type: 'TIMESTAMP' });
      expect(columns[2]).toMatchObject({ name: 'description', type: 'TEXT' });
    });
  });

  describe('validateMigrations', () => {
    it('should accept valid migrations', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Create users table',
          up: ['CREATE TABLE users (id INTEGER PRIMARY KEY)'],
        },
        {
          version: 2,
          description: 'Create posts table',
          up: ['CREATE TABLE posts (id INTEGER PRIMARY KEY)'],
        },
      ];

      expect(() => validateMigrations(migrations)).not.toThrow();
    });

    it('should reject duplicate versions', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'First',
          up: ['SELECT 1'],
        },
        {
          version: 1,
          description: 'Duplicate',
          up: ['SELECT 2'],
        },
      ];

      expect(() => validateMigrations(migrations)).toThrow('Duplicate migration version: 1');
    });

    it('should reject negative versions', () => {
      const migrations: Migration[] = [
        {
          version: -1,
          description: 'Negative',
          up: ['SELECT 1'],
        },
      ];

      expect(() => validateMigrations(migrations)).toThrow(
        'Migration version must be a positive integer'
      );
    });

    it('should reject zero version', () => {
      const migrations: Migration[] = [
        {
          version: 0,
          description: 'Zero',
          up: ['SELECT 1'],
        },
      ];

      expect(() => validateMigrations(migrations)).toThrow(
        'Migration version must be a positive integer'
      );
    });

    it('should reject non-integer versions', () => {
      const migrations: Migration[] = [
        {
          version: 1.5,
          description: 'Float',
          up: ['SELECT 1'],
        },
      ];

      expect(() => validateMigrations(migrations)).toThrow(
        'Migration version must be a positive integer'
      );
    });

    it('should reject missing description', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: '',
          up: ['SELECT 1'],
        },
      ];

      expect(() => validateMigrations(migrations)).toThrow('Migration 1 missing description');
    });

    it('should reject empty up statements', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Test',
          up: [],
        },
      ];

      expect(() => validateMigrations(migrations)).toThrow('Migration 1 has no up statements');
    });

    it('should reject migrations with empty up statement strings', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Test',
          up: ['SELECT 1', '', 'SELECT 2'],
        },
      ];

      expect(() => validateMigrations(migrations)).toThrow(
        'Migration 1 has empty up statement at index 1'
      );
    });

    it('should reject migrations with empty down statement strings', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Test',
          up: ['CREATE TABLE test (id INTEGER)'],
          down: ['DROP TABLE test', ''],
        },
      ];

      expect(() => validateMigrations(migrations)).toThrow(
        'Migration 1 has empty down statement at index 1'
      );
    });
  });

  describe('getMigrationStatus', () => {
    it('should return all migrations as not applied for fresh database', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'First',
          up: ['SELECT 1'],
        },
        {
          version: 2,
          description: 'Second',
          up: ['SELECT 2'],
        },
      ];

      const status = getMigrationStatus(db, migrations);

      expect(status).toHaveLength(2);
      expect(status[0]).toMatchObject({
        version: 1,
        description: 'First',
        applied: false,
      });
      expect(status[1]).toMatchObject({
        version: 2,
        description: 'Second',
        applied: false,
      });
    });

    it('should mark applied migrations correctly', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Create users',
          up: ['CREATE TABLE users (id INTEGER PRIMARY KEY)'],
        },
        {
          version: 2,
          description: 'Create posts',
          up: ['CREATE TABLE posts (id INTEGER PRIMARY KEY)'],
        },
      ];

      // Apply first migration
      runMigrations(db, [migrations[0]!]);

      const status = getMigrationStatus(db, migrations);

      expect(status).toHaveLength(2);
      expect(status[0]!.applied).toBe(true);
      expect(status[0]!.appliedAt).toBeInstanceOf(Date);
      expect(status[1]!.applied).toBe(false);
      expect(status[1]!.appliedAt).toBeUndefined();
    });
  });

  describe('getPendingMigrations', () => {
    it('should return all migrations for fresh database', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'First',
          up: ['CREATE TABLE test1 (id INTEGER)'],
        },
        {
          version: 2,
          description: 'Second',
          up: ['CREATE TABLE test2 (id INTEGER)'],
        },
      ];

      const pending = getPendingMigrations(db, migrations);

      expect(pending).toHaveLength(2);
      expect(pending[0]!.version).toBe(1);
      expect(pending[1]!.version).toBe(2);
    });

    it('should return only unapplied migrations', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'First',
          up: ['CREATE TABLE test1 (id INTEGER)'],
        },
        {
          version: 2,
          description: 'Second',
          up: ['CREATE TABLE test2 (id INTEGER)'],
        },
        {
          version: 3,
          description: 'Third',
          up: ['CREATE TABLE test3 (id INTEGER)'],
        },
      ];

      // Apply first two migrations
      runMigrations(db, [migrations[0]!, migrations[1]!]);

      const pending = getPendingMigrations(db, migrations);

      expect(pending).toHaveLength(1);
      expect(pending[0]!.version).toBe(3);
    });

    it('should return empty array when all migrations applied', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'First',
          up: ['CREATE TABLE test1 (id INTEGER)'],
        },
      ];

      runMigrations(db, migrations);

      const pending = getPendingMigrations(db, migrations);

      expect(pending).toHaveLength(0);
    });

    it('should sort pending migrations by version', () => {
      const migrations: Migration[] = [
        {
          version: 3,
          description: 'Third',
          up: ['CREATE TABLE test3 (id INTEGER)'],
        },
        {
          version: 1,
          description: 'First',
          up: ['CREATE TABLE test1 (id INTEGER)'],
        },
        {
          version: 2,
          description: 'Second',
          up: ['CREATE TABLE test2 (id INTEGER)'],
        },
      ];

      const pending = getPendingMigrations(db, migrations);

      expect(pending).toHaveLength(3);
      expect(pending[0]!.version).toBe(1);
      expect(pending[1]!.version).toBe(2);
      expect(pending[2]!.version).toBe(3);
    });
  });

  describe('runMigrations', () => {
    it('should apply a single migration', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Create users table',
          up: ['CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)'],
        },
      ];

      const applied = runMigrations(db, migrations);

      expect(applied).toBe(1);
      expect(getDatabaseVersion(db)).toBe(1);

      // Verify table was created
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        .get();
      expect(result).toBeDefined();
    });

    it('should apply multiple migrations in order', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Create users table',
          up: ['CREATE TABLE users (id INTEGER PRIMARY KEY)'],
        },
        {
          version: 2,
          description: 'Create posts table',
          up: ['CREATE TABLE posts (id INTEGER PRIMARY KEY, user_id INTEGER)'],
        },
        {
          version: 3,
          description: 'Add foreign key',
          up: [
            'CREATE TABLE posts_new (id INTEGER PRIMARY KEY, user_id INTEGER, FOREIGN KEY(user_id) REFERENCES users(id))',
            'INSERT INTO posts_new SELECT * FROM posts',
            'DROP TABLE posts',
            'ALTER TABLE posts_new RENAME TO posts',
          ],
        },
      ];

      const applied = runMigrations(db, migrations);

      expect(applied).toBe(3);
      expect(getDatabaseVersion(db)).toBe(3);
    });

    it('should be idempotent', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Create table',
          up: ['CREATE TABLE test (id INTEGER PRIMARY KEY)'],
        },
      ];

      const applied1 = runMigrations(db, migrations);
      const applied2 = runMigrations(db, migrations);
      const applied3 = runMigrations(db, migrations);

      expect(applied1).toBe(1);
      expect(applied2).toBe(0);
      expect(applied3).toBe(0);
      expect(getDatabaseVersion(db)).toBe(1);
    });

    it('should only apply pending migrations', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'First',
          up: ['CREATE TABLE test1 (id INTEGER)'],
        },
        {
          version: 2,
          description: 'Second',
          up: ['CREATE TABLE test2 (id INTEGER)'],
        },
        {
          version: 3,
          description: 'Third',
          up: ['CREATE TABLE test3 (id INTEGER)'],
        },
      ];

      // Apply first migration
      const applied1 = runMigrations(db, [migrations[0]!]);
      expect(applied1).toBe(1);

      // Apply all migrations (should only apply 2 and 3)
      const applied2 = runMigrations(db, migrations);
      expect(applied2).toBe(2);
      expect(getDatabaseVersion(db)).toBe(3);
    });

    it('should rollback on failure', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Valid migration',
          up: ['CREATE TABLE test1 (id INTEGER)'],
        },
        {
          version: 2,
          description: 'Invalid migration',
          up: ['CREATE TABLE test2 (id INTEGER)', 'INVALID SQL STATEMENT'],
        },
      ];

      // Apply first migration
      runMigrations(db, [migrations[0]!]);

      // Try to apply second migration (should fail)
      expect(() => runMigrations(db, migrations)).toThrow();

      // Version should still be 1
      expect(getDatabaseVersion(db)).toBe(1);

      // test2 table should not exist
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test2'")
        .get();
      expect(result).toBeUndefined();
    });

    it('should handle migrations with multiple statements', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Create multiple tables',
          up: [
            'CREATE TABLE users (id INTEGER PRIMARY KEY)',
            'CREATE TABLE posts (id INTEGER PRIMARY KEY)',
            'CREATE TABLE comments (id INTEGER PRIMARY KEY)',
          ],
        },
      ];

      const applied = runMigrations(db, migrations);

      expect(applied).toBe(1);

      // Verify all tables were created
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'posts', 'comments') ORDER BY name"
        )
        .all() as Array<{ name: string }>;

      expect(tables).toHaveLength(3);
    });
  });

  describe('rollbackMigrations', () => {
    it('should rollback a single migration', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Create users table',
          up: ['CREATE TABLE users (id INTEGER PRIMARY KEY)'],
          down: ['DROP TABLE users'],
        },
      ];

      runMigrations(db, migrations);
      expect(getDatabaseVersion(db)).toBe(1);

      const rolled = rollbackMigrations(db, migrations);

      expect(rolled).toBe(1);
      expect(getDatabaseVersion(db)).toBe(0);

      // Verify table was dropped
      const result = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        .get();
      expect(result).toBeUndefined();
    });

    it('should rollback multiple migrations', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Create users',
          up: ['CREATE TABLE users (id INTEGER PRIMARY KEY)'],
          down: ['DROP TABLE users'],
        },
        {
          version: 2,
          description: 'Create posts',
          up: ['CREATE TABLE posts (id INTEGER PRIMARY KEY)'],
          down: ['DROP TABLE posts'],
        },
        {
          version: 3,
          description: 'Create comments',
          up: ['CREATE TABLE comments (id INTEGER PRIMARY KEY)'],
          down: ['DROP TABLE comments'],
        },
      ];

      runMigrations(db, migrations);
      expect(getDatabaseVersion(db)).toBe(3);

      const rolled = rollbackMigrations(db, migrations, 2);

      expect(rolled).toBe(2);
      expect(getDatabaseVersion(db)).toBe(1);
    });

    it('should fail if migration does not support rollback', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'No rollback',
          up: ['CREATE TABLE test (id INTEGER)'],
          // No down statements
        },
      ];

      runMigrations(db, migrations);

      expect(() => rollbackMigrations(db, migrations)).toThrow(
        'Migration 1 does not support rollback'
      );
    });

    it('should return 0 when database is at version 0', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Test',
          up: ['CREATE TABLE test (id INTEGER)'],
          down: ['DROP TABLE test'],
        },
      ];

      const rolled = rollbackMigrations(db, migrations);

      expect(rolled).toBe(0);
      expect(getDatabaseVersion(db)).toBe(0);
    });

    it('should handle rollback with multiple statements', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Create multiple tables',
          up: [
            'CREATE TABLE users (id INTEGER PRIMARY KEY)',
            'CREATE TABLE posts (id INTEGER PRIMARY KEY)',
          ],
          down: ['DROP TABLE posts', 'DROP TABLE users'],
        },
      ];

      runMigrations(db, migrations);
      const rolled = rollbackMigrations(db, migrations);

      expect(rolled).toBe(1);

      // Verify both tables were dropped
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'posts')")
        .all();
      expect(tables).toHaveLength(0);
    });
  });

  describe('migrateToVersion', () => {
    const migrations: Migration[] = [
      {
        version: 1,
        description: 'Create users',
        up: ['CREATE TABLE users (id INTEGER PRIMARY KEY)'],
        down: ['DROP TABLE users'],
      },
      {
        version: 2,
        description: 'Create posts',
        up: ['CREATE TABLE posts (id INTEGER PRIMARY KEY)'],
        down: ['DROP TABLE posts'],
      },
      {
        version: 3,
        description: 'Create comments',
        up: ['CREATE TABLE comments (id INTEGER PRIMARY KEY)'],
        down: ['DROP TABLE comments'],
      },
    ];

    it('should migrate from 0 to specific version', () => {
      const count = migrateToVersion(db, migrations, 2);

      expect(count).toBe(2);
      expect(getDatabaseVersion(db)).toBe(2);

      // Verify tables
      const users = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        .get();
      const posts = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='posts'")
        .get();
      const comments = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='comments'")
        .get();

      expect(users).toBeDefined();
      expect(posts).toBeDefined();
      expect(comments).toBeUndefined();
    });

    it('should migrate forward from current version', () => {
      migrateToVersion(db, migrations, 1);
      expect(getDatabaseVersion(db)).toBe(1);

      const count = migrateToVersion(db, migrations, 3);

      expect(count).toBe(2);
      expect(getDatabaseVersion(db)).toBe(3);
    });

    it('should migrate backward from current version', () => {
      migrateToVersion(db, migrations, 3);
      expect(getDatabaseVersion(db)).toBe(3);

      const count = migrateToVersion(db, migrations, 1);

      expect(count).toBe(2);
      expect(getDatabaseVersion(db)).toBe(1);
    });

    it('should return 0 when already at target version', () => {
      migrateToVersion(db, migrations, 2);

      const count = migrateToVersion(db, migrations, 2);

      expect(count).toBe(0);
      expect(getDatabaseVersion(db)).toBe(2);
    });

    it('should migrate to version 0 (empty database)', () => {
      migrateToVersion(db, migrations, 3);

      const count = migrateToVersion(db, migrations, 0);

      expect(count).toBe(3);
      expect(getDatabaseVersion(db)).toBe(0);

      // Verify all tables are gone
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'posts', 'comments')"
        )
        .all();
      expect(tables).toHaveLength(0);
    });
  });

  describe('Integration tests', () => {
    it('should handle a complete migration lifecycle', () => {
      const migrations: Migration[] = [
        {
          version: 1,
          description: 'Initial schema',
          up: [
            'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)',
            'CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)',
          ],
          down: ['DROP TABLE posts', 'DROP TABLE users'],
        },
        {
          version: 2,
          description: 'Add email to users',
          up: ['ALTER TABLE users ADD COLUMN email TEXT'],
          down: [
            // SQLite doesn't support DROP COLUMN directly, need to recreate table
            'CREATE TABLE users_backup (id INTEGER PRIMARY KEY, name TEXT)',
            'INSERT INTO users_backup SELECT id, name FROM users',
            'DROP TABLE users',
            'ALTER TABLE users_backup RENAME TO users',
          ],
        },
        {
          version: 3,
          description: 'Add user_id to posts',
          up: [
            'CREATE TABLE posts_new (id INTEGER PRIMARY KEY, title TEXT, user_id INTEGER)',
            'INSERT INTO posts_new (id, title) SELECT id, title FROM posts',
            'DROP TABLE posts',
            'ALTER TABLE posts_new RENAME TO posts',
          ],
          down: [
            'CREATE TABLE posts_backup (id INTEGER PRIMARY KEY, title TEXT)',
            'INSERT INTO posts_backup SELECT id, title FROM posts',
            'DROP TABLE posts',
            'ALTER TABLE posts_backup RENAME TO posts',
          ],
        },
      ];

      // Apply all migrations
      const applied = runMigrations(db, migrations);
      expect(applied).toBe(3);
      expect(getDatabaseVersion(db)).toBe(3);

      // Insert test data
      db.prepare('INSERT INTO users (name, email) VALUES (?, ?)').run('Alice', 'alice@example.com');
      db.prepare('INSERT INTO posts (title, user_id) VALUES (?, ?)').run('First Post', 1);

      // Verify data
      const user = db.prepare('SELECT * FROM users WHERE name = ?').get('Alice') as {
        id: number;
        name: string;
        email: string;
      };
      expect(user.email).toBe('alice@example.com');

      // Rollback to version 1
      rollbackMigrations(db, migrations, 2);
      expect(getDatabaseVersion(db)).toBe(1);

      // Verify users table doesn't have email column anymore
      const columns = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
      expect(columns.find((c) => c.name === 'email')).toBeUndefined();
    });
  });
});
