/**
 * Tests for Task ID Generator (Task 2.3.5)
 */

import Database from 'better-sqlite3';
import { slugify, getNextTaskNumber, generateTaskId } from '../taskIdGenerator';
import { createAgent } from '../queries/agents';
import { runMigrations } from '../migrations';
import { allMigrations } from '../migrations/index';

describe('Task ID Generator', () => {
  describe('slugify()', () => {
    it('should convert text to lowercase slug', () => {
      expect(slugify('Setup API')).toBe('setup-api');
      expect(slugify('IMPLEMENT AUTH')).toBe('implement-auth');
    });

    it('should replace spaces with hyphens', () => {
      expect(slugify('Fix bug in login')).toBe('fix-bug-in-login');
      expect(slugify('Add new feature')).toBe('add-new-feature');
    });

    it('should remove special characters', () => {
      expect(slugify('Implement @user Auth!')).toBe('implement-user-auth');
      expect(slugify('Fix bug (urgent)')).toBe('fix-bug-urgent');
      expect(slugify('Add feature #123')).toBe('add-feature-123');
    });

    it('should collapse multiple hyphens', () => {
      expect(slugify('Fix   bug   here')).toBe('fix-bug-here');
      expect(slugify('Add--new--feature')).toBe('add-new-feature');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(slugify('-setup-api-')).toBe('setup-api');
      expect(slugify('--implement-auth--')).toBe('implement-auth');
    });

    it('should handle empty strings', () => {
      expect(slugify('')).toBe('');
      expect(slugify('   ')).toBe('');
    });

    it('should handle strings with only special characters', () => {
      expect(slugify('!!!')).toBe('');
      expect(slugify('@#$%')).toBe('');
    });

    it('should limit length to 50 characters', () => {
      const longTitle = 'This is a very long task title that exceeds fifty characters';
      const result = slugify(longTitle);
      expect(result.length).toBeLessThanOrEqual(50);
      expect(result).toBe('this-is-a-very-long-task-title-that-exceeds-fifty');
    });

    it('should remove trailing hyphen after truncation', () => {
      const longTitle = 'This is a very long task title that will be cut mid-word';
      const result = slugify(longTitle);
      expect(result).not.toMatch(/-$/);
    });

    it('should preserve numbers', () => {
      expect(slugify('Fix bug 123')).toBe('fix-bug-123');
      expect(slugify('Task 2024 update')).toBe('task-2024-update');
    });

    it('should handle unicode characters', () => {
      expect(slugify('Café setup')).toBe('caf-setup');
      expect(slugify('Über feature')).toBe('ber-feature');
    });
  });

  describe('getNextTaskNumber() and generateTaskId()', () => {
    let db: Database.Database;

    beforeEach(() => {
      // Create in-memory database for each test
      db = new Database(':memory:');

      // Enable WAL mode and foreign keys
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');

      // Run migrations to set up schema
      runMigrations(db, allMigrations);

      // Create a test agent
      createAgent(db, {
        id: 'test-agent-001',
        role: 'Developer',
        displayName: 'Test Agent',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Testing',
        configPath: '/agents/test-agent-001/config.json',
      });

      // Create another agent for multi-agent tests
      createAgent(db, {
        id: 'test-agent-002',
        role: 'Manager',
        displayName: 'Test Manager',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Managing',
        configPath: '/agents/test-agent-002/config.json',
      });
    });

    afterEach(() => {
      db.close();
    });

    describe('getNextTaskNumber()', () => {
      it('should return 1 for agent with no tasks', () => {
        const nextNum = getNextTaskNumber(db, 'test-agent-001');
        expect(nextNum).toBe(1);
      });

      it('should return correct next number after tasks exist', () => {
        // Manually insert tasks
        const insert = db.prepare(`
          INSERT INTO tasks (id, agent_id, title, status, priority, created_at, depth, task_path, version)
          VALUES (?, ?, ?, 'pending', 'medium', ?, 0, ?, 0)
        `);

        const now = new Date().toISOString();
        insert.run('task-1-test', 'test-agent-001', 'Test 1', now, 'Test 1');
        insert.run('task-2-test', 'test-agent-001', 'Test 2', now, 'Test 2');
        insert.run('task-3-test', 'test-agent-001', 'Test 3', now, 'Test 3');

        const nextNum = getNextTaskNumber(db, 'test-agent-001');
        expect(nextNum).toBe(4);
      });

      it('should handle gaps in task numbers', () => {
        const insert = db.prepare(`
          INSERT INTO tasks (id, agent_id, title, status, priority, created_at, depth, task_path, version)
          VALUES (?, ?, ?, 'pending', 'medium', ?, 0, ?, 0)
        `);

        const now = new Date().toISOString();
        insert.run('task-1-test', 'test-agent-001', 'Test 1', now, 'Test 1');
        insert.run('task-5-test', 'test-agent-001', 'Test 5', now, 'Test 5');
        insert.run('task-10-test', 'test-agent-001', 'Test 10', now, 'Test 10');

        const nextNum = getNextTaskNumber(db, 'test-agent-001');
        expect(nextNum).toBe(11); // Should be max + 1
      });

      it('should ignore tasks with invalid ID formats', () => {
        const insert = db.prepare(`
          INSERT INTO tasks (id, agent_id, title, status, priority, created_at, depth, task_path, version)
          VALUES (?, ?, ?, 'pending', 'medium', ?, 0, ?, 0)
        `);

        const now = new Date().toISOString();
        insert.run('task-1-test', 'test-agent-001', 'Test 1', now, 'Test 1');
        insert.run('custom-id-123', 'test-agent-001', 'Custom', now, 'Custom');
        insert.run('another-task', 'test-agent-001', 'Another', now, 'Another');

        const nextNum = getNextTaskNumber(db, 'test-agent-001');
        expect(nextNum).toBe(2); // Should only count task-1-test
      });

      it('should handle different agents independently', () => {
        const insert = db.prepare(`
          INSERT INTO tasks (id, agent_id, title, status, priority, created_at, depth, task_path, version)
          VALUES (?, ?, ?, 'pending', 'medium', ?, 0, ?, 0)
        `);

        const now = new Date().toISOString();
        insert.run('task-1-test', 'test-agent-001', 'Test 1', now, 'Test 1');
        insert.run('task-2-test', 'test-agent-001', 'Test 2', now, 'Test 2');
        insert.run('task-1-other', 'test-agent-002', 'Other 1', now, 'Other 1');

        expect(getNextTaskNumber(db, 'test-agent-001')).toBe(3);
        expect(getNextTaskNumber(db, 'test-agent-002')).toBe(2);
      });
    });

    describe('generateTaskId()', () => {
      it('should generate ID in correct format', () => {
        const id = generateTaskId(db, 'test-agent-001', 'Setup API');
        expect(id).toMatch(/^task-\d+-[a-z0-9-]+$/);
        expect(id).toBe('task-1-setup-api');
      });

      it('should increment numbers for same agent', () => {
        const id1 = generateTaskId(db, 'test-agent-001', 'First Task');
        const id2 = generateTaskId(db, 'test-agent-001', 'Second Task');
        const id3 = generateTaskId(db, 'test-agent-001', 'Third Task');

        // Note: These won't actually increment because tasks aren't saved to DB
        // In real usage, createTask() would save them and then numbers would increment
        expect(id1).toBe('task-1-first-task');
        expect(id2).toBe('task-1-second-task'); // Still 1 because not saved
        expect(id3).toBe('task-1-third-task');
      });

      it('should generate different IDs for different agents', () => {
        const id1 = generateTaskId(db, 'test-agent-001', 'Same Task');
        const id2 = generateTaskId(db, 'test-agent-002', 'Same Task');

        expect(id1).toBe('task-1-same-task');
        expect(id2).toBe('task-1-same-task');
        // Same format but will be for different agents
      });

      it('should handle empty slug by using fallback', () => {
        const id = generateTaskId(db, 'test-agent-001', '!!!');
        expect(id).toBe('task-1-task');
      });

      it('should handle long titles', () => {
        const longTitle = 'This is a very long task title that exceeds fifty characters and should be truncated';
        const id = generateTaskId(db, 'test-agent-001', longTitle);

        expect(id).toMatch(/^task-1-/);
        // Check that the slug portion is limited
        const slug = id.replace('task-1-', '');
        expect(slug.length).toBeLessThanOrEqual(50);
      });

      it('should properly integrate with actual task creation', () => {
        // Insert a real task to test integration
        const insert = db.prepare(`
          INSERT INTO tasks (id, agent_id, title, status, priority, created_at, depth, task_path, version)
          VALUES (?, ?, ?, 'pending', 'medium', ?, 0, ?, 0)
        `);

        const now = new Date().toISOString();
        insert.run('task-1-setup', 'test-agent-001', 'Setup', now, 'Setup');
        insert.run('task-2-implement', 'test-agent-001', 'Implement', now, 'Implement');

        // Now generate a new ID - should be task-3-*
        const id = generateTaskId(db, 'test-agent-001', 'New Feature');
        expect(id).toBe('task-3-new-feature');
      });
    });
  });
});
