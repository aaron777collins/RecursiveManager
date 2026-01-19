/**
 * Tests for Migration 001: Create agents table
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { migration001 } from '../migrations/001_create_agents_table';
import { runMigrations, rollbackMigrations } from '../migrations';
import { initializeDatabase } from '../index';

describe('Migration 001: Create agents table', () => {
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
    if (testDbPath && fs.existsSync(testDbPath)) {
      const dir = path.dirname(testDbPath);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  describe('Migration Up', () => {
    it('should create agents table with correct schema', () => {
      // Run migration
      const applied = runMigrations(db, [migration001]);
      expect(applied).toBe(1);

      // Verify table exists
      const tableInfo = db.pragma('table_info(agents)');
      expect(tableInfo).toHaveLength(12);

      // Verify columns
      const columnNames = (tableInfo as any[]).map((col: any) => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('role');
      expect(columnNames).toContain('display_name');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('created_by');
      expect(columnNames).toContain('reporting_to');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('main_goal');
      expect(columnNames).toContain('config_path');
      expect(columnNames).toContain('last_execution_at');
      expect(columnNames).toContain('total_executions');
      expect(columnNames).toContain('total_runtime_minutes');
    });

    it('should create idx_status index', () => {
      // Run migration
      runMigrations(db, [migration001]);

      // Verify index exists
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='agents'")
        .all() as any[];

      const indexNames = indexes.map((idx) => idx.name);
      expect(indexNames).toContain('idx_status');
    });

    it('should create idx_reporting_to index', () => {
      // Run migration
      runMigrations(db, [migration001]);

      // Verify index exists
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='agents'")
        .all() as any[];

      const indexNames = indexes.map((idx) => idx.name);
      expect(indexNames).toContain('idx_reporting_to');
    });

    it('should create idx_created_at index', () => {
      // Run migration
      runMigrations(db, [migration001]);

      // Verify index exists
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='agents'")
        .all() as any[];

      const indexNames = indexes.map((idx) => idx.name);
      expect(indexNames).toContain('idx_created_at');
    });

    it('should allow inserting valid agent data', () => {
      // Run migration
      runMigrations(db, [migration001]);

      // Insert test data
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-001',
        'CEO',
        'Chief Executive Officer',
        now,
        'active',
        'Manage organization',
        '/agents/agent-001/config.json'
      );

      // Verify data was inserted
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get('agent-001') as any;
      expect(agent).toBeDefined();
      expect(agent.id).toBe('agent-001');
      expect(agent.role).toBe('CEO');
      expect(agent.display_name).toBe('Chief Executive Officer');
      expect(agent.status).toBe('active');
      expect(agent.main_goal).toBe('Manage organization');
      expect(agent.config_path).toBe('/agents/agent-001/config.json');
      expect(agent.total_executions).toBe(0);
      expect(agent.total_runtime_minutes).toBe(0);
    });

    it('should enforce NOT NULL constraints', () => {
      // Run migration
      runMigrations(db, [migration001]);

      // Try to insert without required fields
      expect(() => {
        db.prepare(
          `
          INSERT INTO agents (id, status, config_path)
          VALUES (?, ?, ?)
        `
        ).run('agent-002', 'active', '/agents/agent-002/config.json');
      }).toThrow();
    });

    it('should enforce PRIMARY KEY constraint', () => {
      // Run migration
      runMigrations(db, [migration001]);

      const now = new Date().toISOString();

      // Insert first agent
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-001',
        'CEO',
        'Chief Executive Officer',
        now,
        'active',
        'Manage',
        '/agents/agent-001/config.json'
      );

      // Try to insert duplicate ID
      expect(() => {
        db.prepare(
          `
          INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          'agent-001',
          'CTO',
          'Chief Tech Officer',
          now,
          'active',
          'Manage tech',
          '/agents/agent-001/config.json'
        );
      }).toThrow();
    });

    it('should allow foreign key reference to self (reporting_to)', () => {
      // Run migration
      runMigrations(db, [migration001]);

      const now = new Date().toISOString();

      // Insert manager
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-001',
        'CEO',
        'Chief Executive Officer',
        now,
        'active',
        'Manage',
        '/agents/agent-001/config.json'
      );

      // Insert subordinate
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, reporting_to, status, main_goal, config_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-002',
        'CTO',
        'Chief Tech Officer',
        now,
        'agent-001',
        'active',
        'Manage tech',
        '/agents/agent-002/config.json'
      );

      // Verify relationship
      const subordinate = db.prepare('SELECT * FROM agents WHERE id = ?').get('agent-002') as any;
      expect(subordinate.reporting_to).toBe('agent-001');
    });

    it('should be idempotent (safe to run multiple times)', () => {
      // Run migration twice
      const applied1 = runMigrations(db, [migration001]);
      expect(applied1).toBe(1);

      const applied2 = runMigrations(db, [migration001]);
      expect(applied2).toBe(0); // Should not apply again

      // Verify table still exists and works
      const tableInfo = db.pragma('table_info(agents)');
      expect(tableInfo).toHaveLength(12);
    });
  });

  describe('Migration Down', () => {
    it('should drop agents table', () => {
      // Run migration up
      runMigrations(db, [migration001]);

      // Verify table exists
      const tableInfo = db.pragma('table_info(agents)') as any[];
      expect(tableInfo.length).toBeGreaterThan(0);

      // Run migration down
      const rolled = rollbackMigrations(db, [migration001]);
      expect(rolled).toBe(1);

      // Verify table no longer exists
      expect(() => {
        db.pragma('table_info(agents)');
      }).not.toThrow();

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agents'")
        .all();
      expect(tables).toHaveLength(0);
    });

    it('should drop all indexes', () => {
      // Run migration up
      runMigrations(db, [migration001]);

      // Verify indexes exist
      const indexesBefore = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='agents'")
        .all() as any[];
      expect(indexesBefore.length).toBeGreaterThan(0);

      // Run migration down
      rollbackMigrations(db, [migration001]);

      // Verify indexes no longer exist
      const indexesAfter = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='agents'")
        .all();
      expect(indexesAfter).toHaveLength(0);
    });
  });

  describe('Index Performance', () => {
    it('should use idx_status for status queries', () => {
      // Run migration
      runMigrations(db, [migration001]);

      const now = new Date().toISOString();

      // Insert test data
      for (let i = 0; i < 100; i++) {
        const status = i % 3 === 0 ? 'active' : i % 3 === 1 ? 'paused' : 'fired';
        db.prepare(
          `
          INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          `agent-${i}`,
          `Role${i}`,
          `Agent ${i}`,
          now,
          status,
          `Goal ${i}`,
          `/agents/agent-${i}/config.json`
        );
      }

      // Query with index
      const plan = db
        .prepare("EXPLAIN QUERY PLAN SELECT * FROM agents WHERE status = 'active'")
        .all();
      const planText = JSON.stringify(plan);

      // Should use index (contains 'idx_status' in query plan)
      expect(planText.toLowerCase()).toContain('idx_status');
    });

    it('should use idx_reporting_to for hierarchy queries', () => {
      // Run migration
      runMigrations(db, [migration001]);

      const now = new Date().toISOString();

      // Insert manager
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'manager',
        'Manager',
        'Manager',
        now,
        'active',
        'Manage',
        '/agents/manager/config.json'
      );

      // Insert subordinates
      for (let i = 0; i < 50; i++) {
        db.prepare(
          `
          INSERT INTO agents (id, role, display_name, created_at, reporting_to, status, main_goal, config_path)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          `agent-${i}`,
          `Role${i}`,
          `Agent ${i}`,
          now,
          'manager',
          'active',
          `Goal ${i}`,
          `/agents/agent-${i}/config.json`
        );
      }

      // Query with index
      const plan = db
        .prepare("EXPLAIN QUERY PLAN SELECT * FROM agents WHERE reporting_to = 'manager'")
        .all();
      const planText = JSON.stringify(plan);

      // Should use index (contains 'idx_reporting_to' in query plan)
      expect(planText.toLowerCase()).toContain('idx_reporting_to');
    });
  });
});
