/**
 * Tests for Migration 005: Create audit_log table
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { migration001 } from '../migrations/001_create_agents_table';
import { migration005 } from '../migrations/005_create_audit_log_table';
import { runMigrations, rollbackMigrations } from '../migrations';
import { initializeDatabase } from '../index';

describe('Migration 005: Create audit_log table', () => {
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
    it('should create audit_log table with correct schema', () => {
      // Run migration (with dependency on agents table)
      const applied = runMigrations(db, [migration001, migration005]);
      expect(applied).toBe(2);

      // Verify table exists
      const tableInfo = db.pragma('table_info(audit_log)');
      expect(tableInfo).toHaveLength(8);

      // Verify columns
      const columnNames = (tableInfo as any[]).map((col: any) => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('timestamp');
      expect(columnNames).toContain('agent_id');
      expect(columnNames).toContain('action');
      expect(columnNames).toContain('target_agent_id');
      expect(columnNames).toContain('success');
      expect(columnNames).toContain('details');
      expect(columnNames).toContain('created_at');
    });

    it('should create all required indexes', () => {
      // Run migration (with dependency on agents table)
      runMigrations(db, [migration001, migration005]);

      // Verify indexes exist
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='audit_log'")
        .all() as any[];

      const indexNames = indexes.map((idx) => idx.name);

      expect(indexNames).toContain('idx_audit_log_timestamp');
      expect(indexNames).toContain('idx_audit_log_agent');
      expect(indexNames).toContain('idx_audit_log_action');
    });

    it('should allow inserting audit log entries', () => {
      // Run migration (with dependency on agents table)
      runMigrations(db, [migration001, migration005]);

      // Create test agents first (for foreign key constraints)
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-1',
        'Manager',
        'Test Agent 1',
        new Date().toISOString(),
        'Test goal 1',
        '/agents/agent-1/config.json',
        'active',
        null
      );

      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-2',
        'Worker',
        'Test Agent 2',
        new Date().toISOString(),
        'Test goal 2',
        '/agents/agent-2/config.json',
        'active',
        'agent-1'
      );

      // Insert test data
      const stmt = db.prepare(`
        INSERT INTO audit_log (timestamp, agent_id, action, target_agent_id, success, details)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(new Date().toISOString(), 'agent-1', 'hire', 'agent-2', 1, '{"reason": "test"}');

      // Verify data was inserted
      const logs = db.prepare('SELECT * FROM audit_log').all();
      expect(logs).toHaveLength(1);

      const log = logs[0] as any;
      expect(log.agent_id).toBe('agent-1');
      expect(log.action).toBe('hire');
      expect(log.target_agent_id).toBe('agent-2');
      expect(log.success).toBe(1);
      expect(log.details).toBe('{"reason": "test"}');
    });

    it('should set timestamp default value', () => {
      // Run migration (with dependency on agents table)
      runMigrations(db, [migration001, migration005]);

      // Create test agent
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-1',
        'Manager',
        'Test Agent',
        new Date().toISOString(),
        'Test goal',
        '/agents/agent-1/config.json',
        'active',
        null
      );

      // Insert without explicit timestamp
      const stmt = db.prepare(`
        INSERT INTO audit_log (agent_id, action, target_agent_id, success, details)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run('agent-1', 'execute', null, 1, null);

      // Verify timestamp was set
      const log = db.prepare('SELECT * FROM audit_log WHERE agent_id = ?').get('agent-1') as any;
      expect(log.timestamp).toBeTruthy();
      expect(log.created_at).toBeTruthy();
    });

    it('should allow null agent_id for system events', () => {
      // Run migration (with dependency on agents table)
      runMigrations(db, [migration001, migration005]);

      // Insert system event (no agent_id)
      const stmt = db.prepare(`
        INSERT INTO audit_log (agent_id, action, success, details)
        VALUES (?, ?, ?, ?)
      `);

      stmt.run(null, 'system_startup', 1, '{"version": "1.0.0"}');

      // Verify data was inserted
      const logs = db.prepare('SELECT * FROM audit_log WHERE action = ?').all('system_startup');
      expect(logs).toHaveLength(1);
    });

    it('should allow querying by timestamp', () => {
      // Run migration (with dependency on agents table)
      runMigrations(db, [migration001, migration005]);

      // Create test agents
      const createdAt = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-1',
        'Manager',
        'Test Agent 1',
        createdAt,
        'Test goal 1',
        '/agents/agent-1/config.json',
        'active',
        null
      );

      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-2',
        'Worker',
        'Test Agent 2',
        createdAt,
        'Test goal 2',
        '/agents/agent-2/config.json',
        'active',
        'agent-1'
      );

      // Insert test data with different timestamps
      const stmt = db.prepare(`
        INSERT INTO audit_log (timestamp, agent_id, action, success)
        VALUES (?, ?, ?, ?)
      `);

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      stmt.run(yesterday.toISOString(), 'agent-1', 'hire', 1);
      stmt.run(now.toISOString(), 'agent-2', 'execute', 1);

      // Query recent events
      const recentLogs = db
        .prepare('SELECT * FROM audit_log WHERE timestamp > ? ORDER BY timestamp')
        .all(yesterday.toISOString());

      expect(recentLogs.length).toBeGreaterThanOrEqual(1);
    });

    it('should allow querying by agent_id', () => {
      // Run migration (with dependency on agents table)
      runMigrations(db, [migration001, migration005]);

      // Create test agents
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-1',
        'Manager',
        'Test Agent 1',
        now,
        'Test goal 1',
        '/agents/agent-1/config.json',
        'active',
        null
      );

      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-2',
        'Worker',
        'Test Agent 2',
        now,
        'Test goal 2',
        '/agents/agent-2/config.json',
        'active',
        'agent-1'
      );

      // Insert test data
      const stmt = db.prepare(`
        INSERT INTO audit_log (agent_id, action, success)
        VALUES (?, ?, ?)
      `);

      stmt.run('agent-1', 'hire', 1);
      stmt.run('agent-1', 'execute', 1);
      stmt.run('agent-2', 'fire', 1);

      // Query by agent
      const agent1Logs = db.prepare('SELECT * FROM audit_log WHERE agent_id = ?').all('agent-1');

      expect(agent1Logs).toHaveLength(2);
    });

    it('should allow querying by action', () => {
      // Run migration (with dependency on agents table)
      runMigrations(db, [migration001, migration005]);

      // Create test agents
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-1',
        'Manager',
        'Test Agent 1',
        now,
        'Test goal 1',
        '/agents/agent-1/config.json',
        'active',
        null
      );

      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-2',
        'Worker',
        'Test Agent 2',
        now,
        'Test goal 2',
        '/agents/agent-2/config.json',
        'active',
        'agent-1'
      );

      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-3',
        'Worker',
        'Test Agent 3',
        now,
        'Test goal 3',
        '/agents/agent-3/config.json',
        'active',
        'agent-1'
      );

      // Insert test data
      const stmt = db.prepare(`
        INSERT INTO audit_log (agent_id, action, success)
        VALUES (?, ?, ?)
      `);

      stmt.run('agent-1', 'hire', 1);
      stmt.run('agent-2', 'hire', 1);
      stmt.run('agent-3', 'fire', 1);

      // Query by action
      const hireLogs = db.prepare('SELECT * FROM audit_log WHERE action = ?').all('hire');

      expect(hireLogs).toHaveLength(2);
    });
  });

  describe('Migration Down', () => {
    it('should drop audit_log table and indexes', () => {
      // Run migration up
      runMigrations(db, [migration005]);

      // Verify table exists
      let tableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")
        .get();
      expect(tableExists).toBeTruthy();

      // Run migration down
      const rolledBack = rollbackMigrations(db, [migration005], 1);
      expect(rolledBack).toBe(1);

      // Verify table was dropped
      tableExists = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")
        .get();
      expect(tableExists).toBeUndefined();

      // Verify indexes were dropped
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='audit_log'")
        .all();
      expect(indexes).toHaveLength(0);
    });
  });

  describe('Idempotency', () => {
    it('should not fail if run multiple times', () => {
      // Run migration twice
      const applied1 = runMigrations(db, [migration001, migration005]);
      const applied2 = runMigrations(db, [migration001, migration005]);

      expect(applied1).toBe(2);
      expect(applied2).toBe(0); // Already applied

      // Create test agent
      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, main_goal, config_path, status, reporting_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-1',
        'Manager',
        'Test Agent',
        new Date().toISOString(),
        'Test goal',
        '/agents/agent-1/config.json',
        'active',
        null
      );

      // Verify table still exists and works
      const stmt = db.prepare(`
        INSERT INTO audit_log (agent_id, action, success)
        VALUES (?, ?, ?)
      `);

      stmt.run('agent-1', 'test', 1);

      const logs = db.prepare('SELECT * FROM audit_log').all();
      expect(logs).toHaveLength(1);
    });
  });
});
