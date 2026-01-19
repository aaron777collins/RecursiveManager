/**
 * Tests for Migration 002: Create tasks table
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { migration001 } from '../migrations/001_create_agents_table';
import { migration002 } from '../migrations/002_create_tasks_table';
import { runMigrations, rollbackMigrations } from '../migrations';
import { initializeDatabase } from '../index';

describe('Migration 002: Create tasks table', () => {
  let testDbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    // Create a temporary database file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-test-'));
    testDbPath = path.join(tempDir, 'test.db');

    // Initialize database
    const connection = initializeDatabase({ path: testDbPath });
    db = connection.db;

    // Run migration 001 first (agents table required for foreign keys)
    runMigrations(db, [migration001]);
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
    it('should create tasks table with correct schema', () => {
      // Run migration
      const applied = runMigrations(db, [migration002]);
      expect(applied).toBe(1);

      // Verify table exists
      const tableInfo = db.pragma('table_info(tasks)');
      expect(tableInfo).toHaveLength(19);

      // Verify columns
      const columnNames = (tableInfo as any[]).map((col: any) => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('agent_id');
      expect(columnNames).toContain('title');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('priority');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('started_at');
      expect(columnNames).toContain('completed_at');
      expect(columnNames).toContain('parent_task_id');
      expect(columnNames).toContain('depth');
      expect(columnNames).toContain('percent_complete');
      expect(columnNames).toContain('subtasks_completed');
      expect(columnNames).toContain('subtasks_total');
      expect(columnNames).toContain('delegated_to');
      expect(columnNames).toContain('delegated_at');
      expect(columnNames).toContain('blocked_by');
      expect(columnNames).toContain('blocked_since');
      expect(columnNames).toContain('task_path');
      expect(columnNames).toContain('version');
    });

    it('should create idx_agent_status composite index', () => {
      // Run migration
      runMigrations(db, [migration002]);

      // Verify index exists
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'")
        .all() as any[];

      const indexNames = indexes.map((idx) => idx.name);
      expect(indexNames).toContain('idx_tasks_agent_status');
    });

    it('should create idx_status index', () => {
      // Run migration
      runMigrations(db, [migration002]);

      // Verify index exists
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'")
        .all() as any[];

      const indexNames = indexes.map((idx) => idx.name);
      expect(indexNames).toContain('idx_tasks_status');
    });

    it('should create idx_parent index', () => {
      // Run migration
      runMigrations(db, [migration002]);

      // Verify index exists
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'")
        .all() as any[];

      const indexNames = indexes.map((idx) => idx.name);
      expect(indexNames).toContain('idx_tasks_parent');
    });

    it('should create idx_delegated index', () => {
      // Run migration
      runMigrations(db, [migration002]);

      // Verify index exists
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'")
        .all() as any[];

      const indexNames = indexes.map((idx) => idx.name);
      expect(indexNames).toContain('idx_tasks_delegated');
    });

    it('should allow inserting valid task data', () => {
      // Run migration
      runMigrations(db, [migration002]);

      // Insert a test agent first
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

      // Insert test task
      db.prepare(
        `
        INSERT INTO tasks (id, agent_id, title, status, priority, created_at, task_path, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'task-001',
        'agent-001',
        'Complete project',
        'pending',
        'high',
        now,
        '/agents/agent-001/tasks/active/task-001.md',
        0
      );

      // Verify data was inserted
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('task-001') as any;
      expect(task).toBeDefined();
      expect(task.id).toBe('task-001');
      expect(task.agent_id).toBe('agent-001');
      expect(task.title).toBe('Complete project');
      expect(task.status).toBe('pending');
      expect(task.priority).toBe('high');
      expect(task.task_path).toBe('/agents/agent-001/tasks/active/task-001.md');
      expect(task.version).toBe(0);
      expect(task.depth).toBe(0);
      expect(task.percent_complete).toBe(0);
      expect(task.subtasks_completed).toBe(0);
      expect(task.subtasks_total).toBe(0);
    });

    it('should enforce NOT NULL constraints', () => {
      // Run migration
      runMigrations(db, [migration002]);

      // Try to insert without required fields
      expect(() => {
        db.prepare(
          `
          INSERT INTO tasks (id, agent_id, task_path)
          VALUES (?, ?, ?)
        `
        ).run('task-002', 'agent-001', '/path/to/task');
      }).toThrow();
    });

    it('should enforce PRIMARY KEY constraint', () => {
      // Run migration
      runMigrations(db, [migration002]);

      const now = new Date().toISOString();

      // Insert agent
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

      // Insert first task
      db.prepare(
        `
        INSERT INTO tasks (id, agent_id, title, created_at, task_path, version)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run('task-001', 'agent-001', 'Task One', now, '/path/one', 0);

      // Try to insert duplicate ID
      expect(() => {
        db.prepare(
          `
          INSERT INTO tasks (id, agent_id, title, created_at, task_path, version)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run('task-001', 'agent-001', 'Task Two', now, '/path/two', 0);
      }).toThrow();
    });

    it('should enforce foreign key constraint on agent_id', () => {
      // Run migration
      runMigrations(db, [migration002]);

      const now = new Date().toISOString();

      // Try to insert task with non-existent agent
      expect(() => {
        db.prepare(
          `
          INSERT INTO tasks (id, agent_id, title, created_at, task_path, version)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run('task-001', 'nonexistent-agent', 'Task', now, '/path/to/task', 0);
      }).toThrow();
    });

    it('should allow foreign key reference to self (parent_task_id)', () => {
      // Run migration
      runMigrations(db, [migration002]);

      const now = new Date().toISOString();

      // Insert agent
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

      // Insert parent task
      db.prepare(
        `
        INSERT INTO tasks (id, agent_id, title, created_at, task_path, version)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run('task-001', 'agent-001', 'Parent Task', now, '/path/parent', 0);

      // Insert subtask
      db.prepare(
        `
        INSERT INTO tasks (id, agent_id, title, created_at, parent_task_id, depth, task_path, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run('task-002', 'agent-001', 'Subtask', now, 'task-001', 1, '/path/subtask', 0);

      // Verify relationship
      const subtask = db.prepare('SELECT * FROM tasks WHERE id = ?').get('task-002') as any;
      expect(subtask.parent_task_id).toBe('task-001');
      expect(subtask.depth).toBe(1);
    });

    it('should allow foreign key reference to agents (delegated_to)', () => {
      // Run migration
      runMigrations(db, [migration002]);

      const now = new Date().toISOString();

      // Insert two agents
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

      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-002',
        'CTO',
        'Chief Tech Officer',
        now,
        'active',
        'Tech',
        '/agents/agent-002/config.json'
      );

      // Insert task delegated to agent-002
      db.prepare(
        `
        INSERT INTO tasks (id, agent_id, title, created_at, delegated_to, delegated_at, task_path, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run('task-001', 'agent-001', 'Delegated Task', now, 'agent-002', now, '/path/task', 0);

      // Verify delegation
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('task-001') as any;
      expect(task.delegated_to).toBe('agent-002');
      expect(task.delegated_at).toBe(now);
    });

    it('should support version field for optimistic locking', () => {
      // Run migration
      runMigrations(db, [migration002]);

      const now = new Date().toISOString();

      // Insert agent
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

      // Insert task with version 0
      db.prepare(
        `
        INSERT INTO tasks (id, agent_id, title, created_at, task_path, version)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run('task-001', 'agent-001', 'Task', now, '/path/task', 0);

      // Update with optimistic locking (version check)
      const updated = db
        .prepare(
          `
        UPDATE tasks SET status = ?, version = version + 1
        WHERE id = ? AND version = ?
      `
        )
        .run('in-progress', 'task-001', 0);

      expect(updated.changes).toBe(1);

      // Verify version was incremented
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('task-001') as any;
      expect(task.version).toBe(1);

      // Try to update with old version (should fail)
      const failedUpdate = db
        .prepare(
          `
        UPDATE tasks SET status = ?, version = version + 1
        WHERE id = ? AND version = ?
      `
        )
        .run('completed', 'task-001', 0);

      expect(failedUpdate.changes).toBe(0); // No rows updated
    });

    it('should store blocked_by as JSON text', () => {
      // Run migration
      runMigrations(db, [migration002]);

      const now = new Date().toISOString();

      // Insert agent
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

      // Insert task with blocked_by array
      const blockedBy = JSON.stringify(['task-002', 'task-003']);
      db.prepare(
        `
        INSERT INTO tasks (id, agent_id, title, created_at, blocked_by, blocked_since, task_path, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run('task-001', 'agent-001', 'Blocked Task', now, blockedBy, now, '/path/task', 0);

      // Verify blocked_by is stored and retrieved correctly
      const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('task-001') as any;
      expect(task.blocked_by).toBe(blockedBy);
      expect(JSON.parse(task.blocked_by)).toEqual(['task-002', 'task-003']);
      expect(task.blocked_since).toBe(now);
    });

    it('should be idempotent (safe to run multiple times)', () => {
      // Run migration twice
      const applied1 = runMigrations(db, [migration002]);
      expect(applied1).toBe(1);

      const applied2 = runMigrations(db, [migration002]);
      expect(applied2).toBe(0); // Should not apply again

      // Verify table still exists and works
      const tableInfo = db.pragma('table_info(tasks)');
      expect(tableInfo).toHaveLength(19);
    });
  });

  describe('Migration Down', () => {
    it('should drop tasks table', () => {
      // Run migration up
      runMigrations(db, [migration002]);

      // Verify table exists
      const tableInfo = db.pragma('table_info(tasks)') as any[];
      expect(tableInfo.length).toBeGreaterThan(0);

      // Run migration down
      const rolled = rollbackMigrations(db, [migration002]);
      expect(rolled).toBe(1);

      // Verify table no longer exists
      expect(() => {
        db.pragma('table_info(tasks)');
      }).not.toThrow();

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
        .all();
      expect(tables).toHaveLength(0);
    });

    it('should drop all indexes', () => {
      // Run migration up
      runMigrations(db, [migration002]);

      // Verify indexes exist
      const indexesBefore = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'")
        .all() as any[];
      expect(indexesBefore.length).toBeGreaterThan(0);

      // Run migration down
      rollbackMigrations(db, [migration002]);

      // Verify indexes no longer exist
      const indexesAfter = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'")
        .all();
      expect(indexesAfter).toHaveLength(0);
    });
  });

  describe('Index Performance', () => {
    it('should use idx_agent_status for composite queries', () => {
      // Run migration
      runMigrations(db, [migration002]);

      const now = new Date().toISOString();

      // Insert agent
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

      // Insert test data
      for (let i = 0; i < 100; i++) {
        const status = i % 3 === 0 ? 'pending' : i % 3 === 1 ? 'in-progress' : 'completed';
        db.prepare(
          `
          INSERT INTO tasks (id, agent_id, title, status, created_at, task_path, version)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        ).run(`task-${i}`, 'agent-001', `Task ${i}`, status, now, `/path/task-${i}`, 0);
      }

      // Query with composite index
      const plan = db
        .prepare(
          "EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE agent_id = 'agent-001' AND status = 'pending'"
        )
        .all();
      const planText = JSON.stringify(plan);

      // Should use composite index
      expect(planText.toLowerCase()).toContain('idx_tasks_agent_status');
    });

    it('should use idx_parent for hierarchy queries', () => {
      // Run migration
      runMigrations(db, [migration002]);

      const now = new Date().toISOString();

      // Insert agent
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

      // Insert parent task
      db.prepare(
        `
        INSERT INTO tasks (id, agent_id, title, created_at, task_path, version)
        VALUES (?, ?, ?, ?, ?, ?)
      `
      ).run('parent', 'agent-001', 'Parent', now, '/path/parent', 0);

      // Insert subtasks
      for (let i = 0; i < 50; i++) {
        db.prepare(
          `
          INSERT INTO tasks (id, agent_id, title, created_at, parent_task_id, depth, task_path, version)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(`task-${i}`, 'agent-001', `Subtask ${i}`, now, 'parent', 1, `/path/task-${i}`, 0);
      }

      // Query with index
      const plan = db
        .prepare("EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE parent_task_id = 'parent'")
        .all();
      const planText = JSON.stringify(plan);

      // Should use index
      expect(planText.toLowerCase()).toContain('idx_tasks_parent');
    });

    it('should use idx_delegated for delegation queries', () => {
      // Run migration
      runMigrations(db, [migration002]);

      const now = new Date().toISOString();

      // Insert two agents
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

      db.prepare(
        `
        INSERT INTO agents (id, role, display_name, created_at, status, main_goal, config_path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        'agent-002',
        'CTO',
        'Chief Tech Officer',
        now,
        'active',
        'Tech',
        '/agents/agent-002/config.json'
      );

      // Insert delegated tasks
      for (let i = 0; i < 50; i++) {
        db.prepare(
          `
          INSERT INTO tasks (id, agent_id, title, created_at, delegated_to, task_path, version)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        ).run(`task-${i}`, 'agent-001', `Task ${i}`, now, 'agent-002', `/path/task-${i}`, 0);
      }

      // Query with index
      const plan = db
        .prepare("EXPLAIN QUERY PLAN SELECT * FROM tasks WHERE delegated_to = 'agent-002'")
        .all();
      const planText = JSON.stringify(plan);

      // Should use index
      expect(planText.toLowerCase()).toContain('idx_tasks_delegated');
    });
  });
});
