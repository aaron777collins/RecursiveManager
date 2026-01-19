/**
 * Tests for migration 003: Create messages table
 *
 * This test suite validates that the messages table migration:
 * - Creates the messages table with correct schema
 * - Creates required indexes (to_unread, timestamp, channel)
 * - Can be rolled back cleanly
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { migration001 } from '../migrations/001_create_agents_table';
import { migration003 } from '../migrations/003_create_messages_table';
import { runMigrations, rollbackMigrations } from '../migrations';
import { initializeDatabase } from '../index';

describe('Migration 003: Messages Table', () => {
  let testDbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    // Create a temporary database file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-test-'));
    testDbPath = path.join(tempDir, 'test.db');

    // Initialize database
    const connection = initializeDatabase({ path: testDbPath });
    db = connection.db;
  });

  afterEach(() => {
    // Clean up
    if (db) {
      db.close();
    }

    // Remove test database file
    if (testDbPath && fs.existsSync(testDbPath)) {
      const testDir = path.dirname(testDbPath);
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Table Creation', () => {
    it('should create messages table with correct schema', () => {
      runMigrations(db, [migration001, migration003]);

      // Check table exists
      const tableExists = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='messages'`)
        .get();

      expect(tableExists).toBeDefined();
      expect(tableExists).toHaveProperty('name', 'messages');
    });

    it('should create all required columns', () => {
      runMigrations(db, [migration001, migration003]);

      const schema = db.prepare(`PRAGMA table_info(messages)`).all() as any[];

      const columnNames = schema.map((col) => col.name);

      // Required columns
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('from_agent_id');
      expect(columnNames).toContain('to_agent_id');
      expect(columnNames).toContain('timestamp');
      expect(columnNames).toContain('priority');
      expect(columnNames).toContain('channel');
      expect(columnNames).toContain('read');
      expect(columnNames).toContain('action_required');

      // Optional columns
      expect(columnNames).toContain('subject');
      expect(columnNames).toContain('thread_id');
      expect(columnNames).toContain('in_reply_to');
      expect(columnNames).toContain('external_id');
      expect(columnNames).toContain('read_at');
      expect(columnNames).toContain('archived_at');
      expect(columnNames).toContain('message_path');
      expect(columnNames).toContain('external_metadata');
      expect(columnNames).toContain('created_at');
    });

    it('should set correct column types', () => {
      runMigrations(db, [migration001, migration003]);

      const schema = db.prepare(`PRAGMA table_info(messages)`).all() as any[];
      const columnTypes = schema.reduce((acc: any, col: any) => {
        acc[col.name] = col.type;
        return acc;
      }, {});

      expect(columnTypes['id']).toBe('TEXT');
      expect(columnTypes['from_agent_id']).toBe('TEXT');
      expect(columnTypes['to_agent_id']).toBe('TEXT');
      expect(columnTypes['timestamp']).toBe('TIMESTAMP');
      expect(columnTypes['priority']).toBe('TEXT');
      expect(columnTypes['channel']).toBe('TEXT');
      expect(columnTypes['read']).toBe('INTEGER');
      expect(columnTypes['action_required']).toBe('INTEGER');
    });

    it('should have id as primary key', () => {
      runMigrations(db, [migration001, migration003]);

      const schema = db.prepare(`PRAGMA table_info(messages)`).all() as any[];
      const idColumn = schema.find((col: any) => col.name === 'id');

      expect(idColumn).toBeDefined();
      expect(idColumn.pk).toBe(1);
    });

    it('should have NOT NULL constraints on required fields', () => {
      runMigrations(db, [migration001, migration003]);

      const schema = db.prepare(`PRAGMA table_info(messages)`).all() as any[];
      const notNullColumns = schema
        .filter((col: any) => col.notnull === 1 || col.pk === 1) // pk columns are implicitly NOT NULL
        .map((col: any) => col.name);

      expect(notNullColumns).toContain('id'); // Primary key, implicitly NOT NULL
      expect(notNullColumns).toContain('from_agent_id');
      expect(notNullColumns).toContain('to_agent_id');
      expect(notNullColumns).toContain('timestamp');
      expect(notNullColumns).toContain('priority');
      expect(notNullColumns).toContain('channel');
      expect(notNullColumns).toContain('read');
      expect(notNullColumns).toContain('action_required');
      expect(notNullColumns).toContain('message_path');
    });

    it('should have default values for specific columns', () => {
      runMigrations(db, [migration001, migration003]);

      const schema = db.prepare(`PRAGMA table_info(messages)`).all() as any[];

      const priorityColumn = schema.find((col: any) => col.name === 'priority');
      const readColumn = schema.find((col: any) => col.name === 'read');
      const actionRequiredColumn = schema.find((col: any) => col.name === 'action_required');
      const createdAtColumn = schema.find((col: any) => col.name === 'created_at');

      expect(priorityColumn?.dflt_value).toBe("'normal'");
      expect(readColumn?.dflt_value).toBe('0');
      expect(actionRequiredColumn?.dflt_value).toBe('0');
      expect(createdAtColumn?.dflt_value).toBe('CURRENT_TIMESTAMP');
    });
  });

  describe('Indexes', () => {
    it('should create all required indexes', () => {
      runMigrations(db, [migration001, migration003]);

      const indexes = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='messages'`)
        .all() as any[];

      const indexNames = indexes.map((idx) => idx.name);

      expect(indexNames).toContain('idx_messages_to_unread');
      expect(indexNames).toContain('idx_messages_timestamp');
      expect(indexNames).toContain('idx_messages_channel');
    });

    it('should create composite index on to_agent_id and read', () => {
      runMigrations(db, [migration001, migration003]);

      const indexInfo = db.prepare(`PRAGMA index_info(idx_messages_to_unread)`).all() as any[];

      const columnNames = indexInfo.map((col) => col.name);

      expect(columnNames).toContain('to_agent_id');
      expect(columnNames).toContain('read');
      expect(indexInfo.length).toBe(2);
    });

    it('should create index on timestamp', () => {
      runMigrations(db, [migration001, migration003]);

      const indexInfo = db.prepare(`PRAGMA index_info(idx_messages_timestamp)`).all() as any[];

      const columnNames = indexInfo.map((col) => col.name);

      expect(columnNames).toContain('timestamp');
      expect(indexInfo.length).toBe(1);
    });

    it('should create index on channel', () => {
      runMigrations(db, [migration001, migration003]);

      const indexInfo = db.prepare(`PRAGMA index_info(idx_messages_channel)`).all() as any[];

      const columnNames = indexInfo.map((col) => col.name);

      expect(columnNames).toContain('channel');
      expect(indexInfo.length).toBe(1);
    });
  });

  describe('Data Operations', () => {
    beforeEach(() => {
      runMigrations(db, [migration001, migration003]);

      // Create test agents to satisfy foreign key constraints
      const agentStmt = db.prepare(`
        INSERT INTO agents (
          id, role, display_name, created_at, status, main_goal, config_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      agentStmt.run(
        'CTO',
        'CTO',
        'Chief Technology Officer',
        new Date().toISOString(),
        'active',
        'Lead tech strategy',
        '/agents/CTO/config.json'
      );
      agentStmt.run(
        'CEO',
        'CEO',
        'Chief Executive Officer',
        new Date().toISOString(),
        'active',
        'Lead company',
        '/agents/CEO/config.json'
      );
    });

    it('should allow inserting valid message records', () => {
      const stmt = db.prepare(`
        INSERT INTO messages (
          id, from_agent_id, to_agent_id, timestamp, priority,
          channel, read, action_required, message_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      expect(() => {
        stmt.run(
          'msg-001',
          'CEO',
          'CTO',
          new Date().toISOString(),
          'high',
          'internal',
          0,
          1,
          '/agents/CTO/inbox/msg-001.md'
        );
      }).not.toThrow();

      const message = db.prepare(`SELECT * FROM messages WHERE id = ?`).get('msg-001') as any;

      expect(message).toBeDefined();
      expect(message.id).toBe('msg-001');
      expect(message.from_agent_id).toBe('CEO');
      expect(message.to_agent_id).toBe('CTO');
      expect(message.priority).toBe('high');
      expect(message.channel).toBe('internal');
      expect(message.read).toBe(0);
      expect(message.action_required).toBe(1);
    });

    it('should enforce NOT NULL constraints', () => {
      const stmt = db.prepare(`
        INSERT INTO messages (id, from_agent_id, to_agent_id)
        VALUES (?, ?, ?)
      `);

      expect(() => {
        stmt.run('msg-002', 'CEO', 'CTO');
      }).toThrow(/NOT NULL/);
    });

    it('should enforce primary key uniqueness', () => {
      const stmt = db.prepare(`
        INSERT INTO messages (
          id, from_agent_id, to_agent_id, timestamp, priority,
          channel, read, action_required, message_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        'msg-003',
        'CEO',
        'CTO',
        new Date().toISOString(),
        'normal',
        'internal',
        0,
        0,
        '/agents/CTO/inbox/msg-003.md'
      );

      expect(() => {
        stmt.run(
          'msg-003',
          'CTO',
          'CEO',
          new Date().toISOString(),
          'normal',
          'internal',
          0,
          0,
          '/agents/CEO/inbox/msg-003.md'
        );
      }).toThrow(/UNIQUE constraint failed/);
    });

    it('should apply default values', () => {
      const stmt = db.prepare(`
        INSERT INTO messages (
          id, from_agent_id, to_agent_id, timestamp,
          channel, message_path
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        'msg-004',
        'CEO',
        'CTO',
        new Date().toISOString(),
        'slack',
        '/agents/CTO/inbox/msg-004.md'
      );

      const message = db.prepare(`SELECT * FROM messages WHERE id = ?`).get('msg-004') as any;

      expect(message.priority).toBe('normal');
      expect(message.read).toBe(0);
      expect(message.action_required).toBe(0);
      expect(message.created_at).toBeDefined();
    });

    it('should allow updating read status', () => {
      const insertStmt = db.prepare(`
        INSERT INTO messages (
          id, from_agent_id, to_agent_id, timestamp, priority,
          channel, read, action_required, message_path
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertStmt.run(
        'msg-005',
        'CEO',
        'CTO',
        new Date().toISOString(),
        'normal',
        'internal',
        0,
        0,
        '/agents/CTO/inbox/msg-005.md'
      );

      const updateStmt = db.prepare(`
        UPDATE messages SET read = ?, read_at = ? WHERE id = ?
      `);

      const readAt = new Date().toISOString();
      updateStmt.run(1, readAt, 'msg-005');

      const message = db.prepare(`SELECT * FROM messages WHERE id = ?`).get('msg-005') as any;

      expect(message.read).toBe(1);
      expect(message.read_at).toBe(readAt);
    });
  });

  describe('Rollback', () => {
    it('should successfully rollback migration', () => {
      runMigrations(db, [migration001, migration003]);

      // Verify table exists
      let tableExists = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='messages'`)
        .get();
      expect(tableExists).toBeDefined();

      // Rollback
      rollbackMigrations(db, [migration003], 1);

      // Verify table is gone
      tableExists = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='messages'`)
        .get();
      expect(tableExists).toBeUndefined();
    });

    it('should remove all indexes during rollback', () => {
      runMigrations(db, [migration001, migration003]);

      // Verify indexes exist
      let indexes = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='messages'`)
        .all() as any[];
      expect(indexes.length).toBeGreaterThan(0);

      // Rollback
      rollbackMigrations(db, [migration003], 1);

      // Verify indexes are gone
      indexes = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='messages'`)
        .all() as any[];
      expect(indexes.length).toBe(0);
    });
  });
});
