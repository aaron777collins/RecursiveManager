/**
 * Tests for Audit Query API (Tasks 1.4.8 - 1.4.11)
 *
 * These tests verify the audit logging functionality including:
 * - Recording audit events
 * - Querying with various filters
 * - Getting statistics
 * - Handling edge cases (null agent_id, empty details, etc.)
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  auditLog,
  queryAuditLog,
  getRecentAuditEvents,
  getAuditStats,
  AuditAction,
  type AuditEventInput,
} from '../audit';
import { migration001 } from '../../migrations/001_create_agents_table';
import { migration005 } from '../../migrations/005_create_audit_log_table';
import { runMigrations } from '../../migrations';

describe('Audit Query API', () => {
  let testDbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    // Create a temporary database file
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rm-test-audit-'));
    testDbPath = path.join(tempDir, 'test.db');

    // Initialize database and run migrations
    db = new Database(testDbPath);
    db.pragma('journal_mode = WAL');
    runMigrations(db, [migration001, migration005]);
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

  describe('auditLog()', () => {
    it('should record a basic audit event', () => {
      const eventId = auditLog(db, {
        agentId: 'ceo-001',
        action: AuditAction.HIRE,
        targetAgentId: 'cto-001',
        success: true,
        details: { role: 'CTO', reportingTo: 'ceo-001' },
      });

      expect(eventId).toBeGreaterThan(0);

      // Verify the event was recorded
      const events = queryAuditLog(db, { agentId: 'ceo-001' });
      expect(events).toHaveLength(1);
      expect(events[0].agent_id).toBe('ceo-001');
      expect(events[0].action).toBe(AuditAction.HIRE);
      expect(events[0].target_agent_id).toBe('cto-001');
      expect(events[0].success).toBe(1);
      expect(JSON.parse(events[0].details || '{}')).toEqual({
        role: 'CTO',
        reportingTo: 'ceo-001',
      });
    });

    it('should record a system event with null agent_id', () => {
      const eventId = auditLog(db, {
        agentId: null,
        action: AuditAction.SYSTEM_STARTUP,
        success: true,
        details: { version: '1.0.0' },
      });

      expect(eventId).toBeGreaterThan(0);

      const events = queryAuditLog(db);
      expect(events).toHaveLength(1);
      expect(events[0].agent_id).toBeNull();
      expect(events[0].action).toBe(AuditAction.SYSTEM_STARTUP);
    });

    it('should record a failed operation', () => {
      const eventId = auditLog(db, {
        agentId: 'worker-005',
        action: AuditAction.EXECUTE_END,
        success: false,
        details: {
          error: 'Timeout after 60 minutes',
          taskId: 'task-123',
        },
      });

      expect(eventId).toBeGreaterThan(0);

      const events = queryAuditLog(db, { success: false });
      expect(events).toHaveLength(1);
      expect(events[0].success).toBe(0);
      const details = JSON.parse(events[0].details || '{}');
      expect(details.error).toBe('Timeout after 60 minutes');
    });

    it('should handle string details', () => {
      const eventId = auditLog(db, {
        agentId: 'agent-001',
        action: AuditAction.MESSAGE_SEND,
        success: true,
        details: 'Simple string message',
      });

      expect(eventId).toBeGreaterThan(0);

      const events = queryAuditLog(db, { agentId: 'agent-001' });
      expect(events[0].details).toBe('Simple string message');
    });

    it('should handle null details', () => {
      const eventId = auditLog(db, {
        agentId: 'agent-001',
        action: AuditAction.PAUSE,
        success: true,
        details: null,
      });

      expect(eventId).toBeGreaterThan(0);

      const events = queryAuditLog(db, { agentId: 'agent-001' });
      expect(events[0].details).toBeNull();
    });

    it('should handle undefined details', () => {
      const eventId = auditLog(db, {
        agentId: 'agent-001',
        action: AuditAction.RESUME,
        success: true,
      });

      expect(eventId).toBeGreaterThan(0);

      const events = queryAuditLog(db, { agentId: 'agent-001' });
      expect(events[0].details).toBeNull();
    });

    it('should use provided timestamp', () => {
      const customTimestamp = '2026-01-01T12:00:00.000Z';
      const eventId = auditLog(db, {
        agentId: 'agent-001',
        action: AuditAction.HIRE,
        success: true,
        timestamp: customTimestamp,
      });

      expect(eventId).toBeGreaterThan(0);

      const events = queryAuditLog(db, { agentId: 'agent-001' });
      expect(events[0].timestamp).toBe(customTimestamp);
    });

    it('should auto-generate timestamp if not provided', () => {
      const beforeTime = new Date().toISOString();

      const eventId = auditLog(db, {
        agentId: 'agent-001',
        action: AuditAction.HIRE,
        success: true,
      });

      const afterTime = new Date().toISOString();

      expect(eventId).toBeGreaterThan(0);

      const events = queryAuditLog(db, { agentId: 'agent-001' });
      expect(events[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(events[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should support all standard action types', () => {
      const actions = [
        AuditAction.HIRE,
        AuditAction.FIRE,
        AuditAction.PAUSE,
        AuditAction.RESUME,
        AuditAction.TASK_CREATE,
        AuditAction.TASK_UPDATE,
        AuditAction.TASK_DELEGATE,
        AuditAction.TASK_COMPLETE,
        AuditAction.EXECUTE_START,
        AuditAction.EXECUTE_END,
        AuditAction.MESSAGE_SEND,
        AuditAction.MESSAGE_RECEIVE,
        AuditAction.CONFIG_UPDATE,
        AuditAction.SYSTEM_STARTUP,
        AuditAction.SYSTEM_SHUTDOWN,
      ];

      for (const action of actions) {
        auditLog(db, {
          agentId: 'test-agent',
          action,
          success: true,
        });
      }

      const events = queryAuditLog(db);
      expect(events).toHaveLength(actions.length);
    });

    it('should support custom action types', () => {
      const eventId = auditLog(db, {
        agentId: 'agent-001',
        action: 'custom_action_type',
        success: true,
      });

      expect(eventId).toBeGreaterThan(0);

      const events = queryAuditLog(db, { action: 'custom_action_type' });
      expect(events).toHaveLength(1);
    });
  });

  describe('queryAuditLog()', () => {
    beforeEach(() => {
      // Create sample audit events for testing
      auditLog(db, {
        agentId: 'ceo-001',
        action: AuditAction.HIRE,
        targetAgentId: 'cto-001',
        success: true,
        timestamp: '2026-01-01T10:00:00.000Z',
      });

      auditLog(db, {
        agentId: 'ceo-001',
        action: AuditAction.FIRE,
        targetAgentId: 'worker-001',
        success: true,
        timestamp: '2026-01-01T11:00:00.000Z',
      });

      auditLog(db, {
        agentId: 'cto-001',
        action: AuditAction.EXECUTE_START,
        success: true,
        timestamp: '2026-01-01T12:00:00.000Z',
      });

      auditLog(db, {
        agentId: 'cto-001',
        action: AuditAction.EXECUTE_END,
        success: false,
        timestamp: '2026-01-01T13:00:00.000Z',
        details: { error: 'Timeout' },
      });

      auditLog(db, {
        agentId: null,
        action: AuditAction.SYSTEM_STARTUP,
        success: true,
        timestamp: '2026-01-01T09:00:00.000Z',
      });
    });

    it('should return all events with no filter', () => {
      const events = queryAuditLog(db);
      expect(events).toHaveLength(5);
    });

    it('should filter by agentId', () => {
      const events = queryAuditLog(db, { agentId: 'ceo-001' });
      expect(events).toHaveLength(2);
      expect(events.every((e) => e.agent_id === 'ceo-001')).toBe(true);
    });

    it('should filter by action', () => {
      const events = queryAuditLog(db, { action: AuditAction.HIRE });
      expect(events).toHaveLength(1);
      expect(events[0].action).toBe(AuditAction.HIRE);
    });

    it('should filter by targetAgentId', () => {
      const events = queryAuditLog(db, { targetAgentId: 'cto-001' });
      expect(events).toHaveLength(1);
      expect(events[0].target_agent_id).toBe('cto-001');
    });

    it('should filter by success', () => {
      const successEvents = queryAuditLog(db, { success: true });
      expect(successEvents).toHaveLength(4);

      const failureEvents = queryAuditLog(db, { success: false });
      expect(failureEvents).toHaveLength(1);
      expect(failureEvents[0].success).toBe(0);
    });

    it('should filter by startTime', () => {
      const events = queryAuditLog(db, {
        startTime: '2026-01-01T11:00:00.000Z',
      });
      expect(events).toHaveLength(3); // Events at 11:00, 12:00, 13:00
    });

    it('should filter by endTime', () => {
      const events = queryAuditLog(db, {
        endTime: '2026-01-01T11:00:00.000Z',
      });
      expect(events).toHaveLength(3); // Events at 09:00, 10:00, 11:00
    });

    it('should filter by time range', () => {
      const events = queryAuditLog(db, {
        startTime: '2026-01-01T10:30:00.000Z',
        endTime: '2026-01-01T12:30:00.000Z',
      });
      expect(events).toHaveLength(2); // Events at 11:00, 12:00
    });

    it('should combine multiple filters', () => {
      const events = queryAuditLog(db, {
        agentId: 'ceo-001',
        success: true,
        startTime: '2026-01-01T10:00:00.000Z',
      });
      expect(events).toHaveLength(2); // Both CEO events
    });

    it('should respect limit', () => {
      const events = queryAuditLog(db, { limit: 2 });
      expect(events).toHaveLength(2);
    });

    it('should respect offset', () => {
      const allEvents = queryAuditLog(db);
      const offsetEvents = queryAuditLog(db, { offset: 2 });

      expect(offsetEvents).toHaveLength(3);
      expect(offsetEvents[0].id).toBe(allEvents[2].id);
    });

    it('should respect limit and offset together', () => {
      const events = queryAuditLog(db, { limit: 2, offset: 1 });
      expect(events).toHaveLength(2);
    });

    it('should order by timestamp descending (most recent first)', () => {
      const events = queryAuditLog(db);
      expect(events).toHaveLength(5);

      // Verify timestamps are in descending order
      for (let i = 0; i < events.length - 1; i++) {
        expect(events[i]?.timestamp! >= events[i + 1]?.timestamp!).toBe(true);
      }

      // First event should be the latest (13:00)
      expect(events[0]?.timestamp).toBe('2026-01-01T13:00:00.000Z');
      // Last event should be the earliest (09:00)
      expect(events[events.length - 1]?.timestamp).toBe('2026-01-01T09:00:00.000Z');
    });

    it('should return empty array when no events match filter', () => {
      const events = queryAuditLog(db, { agentId: 'nonexistent-agent' });
      expect(events).toHaveLength(0);
      expect(Array.isArray(events)).toBe(true);
    });
  });

  describe('getRecentAuditEvents()', () => {
    beforeEach(() => {
      // Create sample audit events
      for (let i = 0; i < 100; i++) {
        auditLog(db, {
          agentId: 'agent-001',
          action: AuditAction.EXECUTE_START,
          success: true,
          timestamp: new Date(Date.now() - i * 1000).toISOString(),
        });
      }
    });

    it('should return default 50 most recent events', () => {
      const events = getRecentAuditEvents(db, 'agent-001');
      expect(events).toHaveLength(50);
    });

    it('should respect custom limit', () => {
      const events = getRecentAuditEvents(db, 'agent-001', 20);
      expect(events).toHaveLength(20);
    });

    it('should return events in descending timestamp order', () => {
      const events = getRecentAuditEvents(db, 'agent-001', 10);

      for (let i = 0; i < events.length - 1; i++) {
        expect(events[i]?.timestamp! >= events[i + 1]?.timestamp!).toBe(true);
      }
    });

    it('should only return events for specified agent', () => {
      // Add some events for a different agent
      auditLog(db, {
        agentId: 'agent-002',
        action: AuditAction.EXECUTE_START,
        success: true,
      });

      const events = getRecentAuditEvents(db, 'agent-001', 200);
      expect(events).toHaveLength(100);
      expect(events.every((e) => e.agent_id === 'agent-001')).toBe(true);
    });
  });

  describe('getAuditStats()', () => {
    beforeEach(() => {
      // Create a mix of successful and failed events
      auditLog(db, {
        agentId: 'agent-001',
        action: AuditAction.HIRE,
        success: true,
        timestamp: '2026-01-01T10:00:00.000Z',
      });

      auditLog(db, {
        agentId: 'agent-001',
        action: AuditAction.HIRE,
        success: true,
        timestamp: '2026-01-01T11:00:00.000Z',
      });

      auditLog(db, {
        agentId: 'agent-001',
        action: AuditAction.EXECUTE_END,
        success: false,
        timestamp: '2026-01-01T12:00:00.000Z',
      });

      auditLog(db, {
        agentId: 'agent-002',
        action: AuditAction.FIRE,
        success: true,
        timestamp: '2026-01-01T13:00:00.000Z',
      });

      auditLog(db, {
        agentId: 'agent-002',
        action: AuditAction.EXECUTE_END,
        success: false,
        timestamp: '2026-01-01T14:00:00.000Z',
      });
    });

    it('should return correct overall statistics', () => {
      const stats = getAuditStats(db);

      expect(stats.totalEvents).toBe(5);
      expect(stats.successCount).toBe(3);
      expect(stats.failureCount).toBe(2);
      expect(stats.successRate).toBe(60); // 3/5 = 60%
    });

    it('should return correct action counts', () => {
      const stats = getAuditStats(db);

      expect(stats.actionCounts[AuditAction.HIRE]).toBe(2);
      expect(stats.actionCounts[AuditAction.FIRE]).toBe(1);
      expect(stats.actionCounts[AuditAction.EXECUTE_END]).toBe(2);
    });

    it('should filter by startTime', () => {
      const stats = getAuditStats(db, {
        startTime: '2026-01-01T12:00:00.000Z',
      });

      expect(stats.totalEvents).toBe(3);
      expect(stats.successCount).toBe(1);
      expect(stats.failureCount).toBe(2);
    });

    it('should filter by endTime', () => {
      const stats = getAuditStats(db, {
        endTime: '2026-01-01T12:00:00.000Z',
      });

      expect(stats.totalEvents).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(1);
    });

    it('should filter by time range', () => {
      const stats = getAuditStats(db, {
        startTime: '2026-01-01T11:00:00.000Z',
        endTime: '2026-01-01T13:00:00.000Z',
      });

      expect(stats.totalEvents).toBe(3);
      expect(stats.actionCounts[AuditAction.HIRE]).toBe(1);
      expect(stats.actionCounts[AuditAction.FIRE]).toBe(1);
      expect(stats.actionCounts[AuditAction.EXECUTE_END]).toBe(1);
    });

    it('should handle empty result set', () => {
      const stats = getAuditStats(db, {
        startTime: '2026-01-02T00:00:00.000Z',
      });

      expect(stats.totalEvents).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.failureCount).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(Object.keys(stats.actionCounts)).toHaveLength(0);
    });

    it('should handle 100% success rate', () => {
      // Clear existing events
      db.prepare('DELETE FROM audit_log').run();

      // Add only successful events
      auditLog(db, { agentId: 'agent-001', action: AuditAction.HIRE, success: true });
      auditLog(db, { agentId: 'agent-001', action: AuditAction.HIRE, success: true });

      const stats = getAuditStats(db);
      expect(stats.successRate).toBe(100);
    });

    it('should handle 0% success rate', () => {
      // Clear existing events
      db.prepare('DELETE FROM audit_log').run();

      // Add only failed events
      auditLog(db, { agentId: 'agent-001', action: AuditAction.EXECUTE_END, success: false });
      auditLog(db, { agentId: 'agent-001', action: AuditAction.EXECUTE_END, success: false });

      const stats = getAuditStats(db);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should support a complete audit workflow', () => {
      // Record various events
      auditLog(db, {
        agentId: 'ceo-001',
        action: AuditAction.HIRE,
        targetAgentId: 'cto-001',
        success: true,
        details: { role: 'CTO' },
      });

      auditLog(db, {
        agentId: 'cto-001',
        action: AuditAction.TASK_CREATE,
        success: true,
        details: { taskId: 'task-001', title: 'Build feature' },
      });

      auditLog(db, {
        agentId: 'cto-001',
        action: AuditAction.EXECUTE_START,
        success: true,
      });

      auditLog(db, {
        agentId: 'cto-001',
        action: AuditAction.EXECUTE_END,
        success: false,
        details: { error: 'Timeout' },
      });

      // Query and verify
      const allEvents = queryAuditLog(db);
      expect(allEvents).toHaveLength(4);

      const ctoEvents = queryAuditLog(db, { agentId: 'cto-001' });
      expect(ctoEvents).toHaveLength(3);

      const failures = queryAuditLog(db, { success: false });
      expect(failures).toHaveLength(1);

      const stats = getAuditStats(db);
      expect(stats.totalEvents).toBe(4);
      expect(stats.successCount).toBe(3);
      expect(stats.failureCount).toBe(1);
      expect(stats.successRate).toBe(75);
    });

    it('should maintain immutability of audit log', () => {
      // Record an event
      const eventId = auditLog(db, {
        agentId: 'agent-001',
        action: AuditAction.HIRE,
        success: true,
        details: { original: 'data' },
      });

      // Get the event
      const events = queryAuditLog(db, { agentId: 'agent-001' });
      expect(events).toHaveLength(1);

      // Attempt to update (should fail - audit log is append-only)
      expect(() => {
        db.prepare('UPDATE audit_log SET success = 0 WHERE id = ?').run(eventId);
      }).toThrow();
    });
  });
});
