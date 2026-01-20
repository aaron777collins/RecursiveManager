/**
 * Tests for Agent Query API (Task 1.3.11 - 1.3.15)
 *
 * This test suite verifies:
 * - createAgent() creates agent and updates org_hierarchy
 * - getAgent() retrieves agent by ID
 * - updateAgent() updates agent fields
 * - getSubordinates() returns hierarchical subordinates
 * - getOrgChart() returns complete org structure
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { initializeDatabase } from '../index';
import { runMigrations } from '../migrations';
import { allMigrations } from '../migrations/index';
import {
  createAgent,
  getAgent,
  updateAgent,
  getSubordinates,
  getOrgChart,
  CreateAgentInput,
} from '../queries';
import { queryAuditLog, AuditAction } from '../queries/audit';

describe('Agent Query API', () => {
  let dbPath: string;
  let db: Database.Database;

  beforeEach(() => {
    // Create temporary database
    dbPath = path.join(__dirname, `test-queries-${Date.now()}.db`);
    const connection = initializeDatabase({ path: dbPath });
    db = connection.db;

    // Run migrations to create tables
    runMigrations(db, allMigrations);
  });

  afterEach(() => {
    // Clean up
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Clean up WAL and SHM files
    ['-wal', '-shm'].forEach((ext) => {
      const file = dbPath + ext;
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  describe('createAgent()', () => {
    it('should create a root agent (no manager)', () => {
      const input: CreateAgentInput = {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      };

      const agent = createAgent(db, input);

      expect(agent).toBeDefined();
      expect(agent.id).toBe('ceo-001');
      expect(agent.role).toBe('CEO');
      expect(agent.display_name).toBe('Alice CEO');
      expect(agent.created_by).toBeNull();
      expect(agent.reporting_to).toBeNull();
      expect(agent.status).toBe('active');
      expect(agent.main_goal).toBe('Lead the organization');
      expect(agent.config_path).toBe('/data/agents/ce/ceo-001/config.json');
      expect(agent.total_executions).toBe(0);
      expect(agent.total_runtime_minutes).toBe(0);
      expect(agent.last_execution_at).toBeNull();
      expect(agent.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO 8601
    });

    it('should create a subordinate agent with manager', () => {
      // Create manager first
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      // Create subordinate
      const subordinate = createAgent(db, {
        id: 'cto-001',
        role: 'CTO',
        displayName: 'Bob CTO',
        createdBy: 'ceo-001',
        reportingTo: 'ceo-001',
        mainGoal: 'Manage technology',
        configPath: '/data/agents/ct/cto-001/config.json',
      });

      expect(subordinate).toBeDefined();
      expect(subordinate.id).toBe('cto-001');
      expect(subordinate.reporting_to).toBe('ceo-001');
      expect(subordinate.created_by).toBe('ceo-001');
    });

    it('should update org_hierarchy with self-reference', () => {
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      // Check org_hierarchy has self-reference
      const hierarchy = db
        .prepare(
          `
        SELECT * FROM org_hierarchy
        WHERE agent_id = ? AND ancestor_id = ?
      `
        )
        .get('ceo-001', 'ceo-001') as
        | {
            agent_id: string;
            ancestor_id: string;
            depth: number;
            path: string;
          }
        | undefined;

      expect(hierarchy).toBeDefined();
      expect(hierarchy?.depth).toBe(0);
      expect(hierarchy?.path).toBe('CEO');
    });

    it('should inherit manager hierarchy in org_hierarchy', () => {
      // Create 3-level hierarchy: CEO -> CTO -> Developer
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      createAgent(db, {
        id: 'cto-001',
        role: 'CTO',
        displayName: 'Bob CTO',
        createdBy: 'ceo-001',
        reportingTo: 'ceo-001',
        mainGoal: 'Manage technology',
        configPath: '/data/agents/ct/cto-001/config.json',
      });

      createAgent(db, {
        id: 'dev-001',
        role: 'Developer',
        displayName: 'Charlie Dev',
        createdBy: 'cto-001',
        reportingTo: 'cto-001',
        mainGoal: 'Write code',
        configPath: '/data/agents/de/dev-001/config.json',
      });

      // Developer should have 3 entries in org_hierarchy:
      // 1. Self-reference (depth=0)
      // 2. CTO (depth=1)
      // 3. CEO (depth=2)
      const hierarchy = db
        .prepare(
          `
        SELECT * FROM org_hierarchy
        WHERE agent_id = ?
        ORDER BY depth
      `
        )
        .all('dev-001') as Array<{
        agent_id: string;
        ancestor_id: string;
        depth: number;
        path: string;
      }>;

      expect(hierarchy).toHaveLength(3);
      expect(hierarchy[0]).toBeDefined();
      expect(hierarchy[1]).toBeDefined();
      expect(hierarchy[2]).toBeDefined();

      // Self-reference
      expect(hierarchy[0]!.ancestor_id).toBe('dev-001');
      expect(hierarchy[0]!.depth).toBe(0);
      expect(hierarchy[0]!.path).toBe('Developer');

      // CTO
      expect(hierarchy[1]!.ancestor_id).toBe('cto-001');
      expect(hierarchy[1]!.depth).toBe(1);
      expect(hierarchy[1]!.path).toBe('CTO/Developer');

      // CEO
      expect(hierarchy[2]!.ancestor_id).toBe('ceo-001');
      expect(hierarchy[2]!.depth).toBe(2);
      expect(hierarchy[2]!.path).toBe('CEO/CTO/Developer');
    });
  });

  describe('getAgent()', () => {
    it('should retrieve an existing agent', () => {
      const input: CreateAgentInput = {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      };

      createAgent(db, input);
      const agent = getAgent(db, 'ceo-001');

      expect(agent).toBeDefined();
      expect(agent?.id).toBe('ceo-001');
      expect(agent?.role).toBe('CEO');
    });

    it('should return null for non-existent agent', () => {
      const agent = getAgent(db, 'non-existent');
      expect(agent).toBeNull();
    });
  });

  describe('updateAgent()', () => {
    it('should update agent fields', () => {
      // Create agent
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      // Update agent
      const updated = updateAgent(db, 'ceo-001', {
        status: 'paused',
        totalExecutions: 42,
        totalRuntimeMinutes: 120,
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe('paused');
      expect(updated?.total_executions).toBe(42);
      expect(updated?.total_runtime_minutes).toBe(120);

      // Verify other fields unchanged
      expect(updated?.role).toBe('CEO');
      expect(updated?.display_name).toBe('Alice CEO');
    });

    it('should return null for non-existent agent', () => {
      const updated = updateAgent(db, 'non-existent', { status: 'paused' });
      expect(updated).toBeNull();
    });

    it('should handle partial updates', () => {
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      // Update only one field
      const updated = updateAgent(db, 'ceo-001', { displayName: 'Alice Smith' });

      expect(updated?.display_name).toBe('Alice Smith');
      expect(updated?.role).toBe('CEO'); // Unchanged
    });

    it('should return unchanged agent if no updates provided', () => {
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      const updated = updateAgent(db, 'ceo-001', {});
      expect(updated?.display_name).toBe('Alice CEO');
    });
  });

  describe('getSubordinates()', () => {
    it('should return all direct and indirect subordinates', () => {
      // Create hierarchy: CEO -> CTO -> [Dev1, Dev2]
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      createAgent(db, {
        id: 'cto-001',
        role: 'CTO',
        displayName: 'Bob CTO',
        createdBy: 'ceo-001',
        reportingTo: 'ceo-001',
        mainGoal: 'Manage technology',
        configPath: '/data/agents/ct/cto-001/config.json',
      });

      createAgent(db, {
        id: 'dev-001',
        role: 'Developer',
        displayName: 'Charlie Dev',
        createdBy: 'cto-001',
        reportingTo: 'cto-001',
        mainGoal: 'Write code',
        configPath: '/data/agents/de/dev-001/config.json',
      });

      createAgent(db, {
        id: 'dev-002',
        role: 'Developer',
        displayName: 'Diana Dev',
        createdBy: 'cto-001',
        reportingTo: 'cto-001',
        mainGoal: 'Write tests',
        configPath: '/data/agents/de/dev-002/config.json',
      });

      // CEO should have 3 subordinates (CTO + 2 Developers)
      const ceoSubordinates = getSubordinates(db, 'ceo-001');
      expect(ceoSubordinates).toHaveLength(3);
      expect(ceoSubordinates.map((s) => s.id).sort()).toEqual(['cto-001', 'dev-001', 'dev-002']);

      // CTO should have 2 subordinates (2 Developers)
      const ctoSubordinates = getSubordinates(db, 'cto-001');
      expect(ctoSubordinates).toHaveLength(2);
      expect(ctoSubordinates.map((s) => s.id).sort()).toEqual(['dev-001', 'dev-002']);

      // Developer should have no subordinates
      const devSubordinates = getSubordinates(db, 'dev-001');
      expect(devSubordinates).toHaveLength(0);
    });

    it('should return empty array for agent with no subordinates', () => {
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      const subordinates = getSubordinates(db, 'ceo-001');
      expect(subordinates).toHaveLength(0);
    });

    it('should return empty array for non-existent agent', () => {
      const subordinates = getSubordinates(db, 'non-existent');
      expect(subordinates).toHaveLength(0);
    });
  });

  describe('getOrgChart()', () => {
    it('should return complete org chart with hierarchy info', () => {
      // Create hierarchy
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      createAgent(db, {
        id: 'cto-001',
        role: 'CTO',
        displayName: 'Bob CTO',
        createdBy: 'ceo-001',
        reportingTo: 'ceo-001',
        mainGoal: 'Manage technology',
        configPath: '/data/agents/ct/cto-001/config.json',
      });

      const orgChart = getOrgChart(db);

      expect(orgChart).toHaveLength(2);

      // Find CEO entry
      const ceoEntry = orgChart.find((e) => e.agent.id === 'ceo-001');
      expect(ceoEntry).toBeDefined();
      expect(ceoEntry?.depth).toBe(0);
      expect(ceoEntry?.path).toBe('CEO');

      // Find CTO entry
      const ctoEntry = orgChart.find((e) => e.agent.id === 'cto-001');
      expect(ctoEntry).toBeDefined();
      expect(ctoEntry?.depth).toBe(0);
      expect(ctoEntry?.path).toBe('CTO');
    });

    it('should return empty array for empty database', () => {
      const orgChart = getOrgChart(db);
      expect(orgChart).toHaveLength(0);
    });
  });

  describe('Audit Logging Integration', () => {
    it('should log HIRE action when creating an agent', () => {
      const input: CreateAgentInput = {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      };

      createAgent(db, input);

      // Query audit log for HIRE action
      const auditEvents = queryAuditLog(db, {
        action: AuditAction.HIRE,
        targetAgentId: 'ceo-001',
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]!.action).toBe(AuditAction.HIRE);
      expect(auditEvents[0]!.target_agent_id).toBe('ceo-001');
      expect(auditEvents[0]!.success).toBe(1); // SQLite boolean as 1
      expect(auditEvents[0]!.agent_id).toBeNull(); // No creator for CEO

      // Verify details
      const details = JSON.parse(auditEvents[0]!.details!);
      expect(details.role).toBe('CEO');
      expect(details.displayName).toBe('Alice CEO');
    });

    it('should log HIRE action with creator when creating subordinate', () => {
      // Create CEO first
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      // Create CTO under CEO
      createAgent(db, {
        id: 'cto-001',
        role: 'CTO',
        displayName: 'Bob CTO',
        createdBy: 'ceo-001',
        reportingTo: 'ceo-001',
        mainGoal: 'Manage technology',
        configPath: '/data/agents/ct/cto-001/config.json',
      });

      // Query audit log for CTO hire
      const auditEvents = queryAuditLog(db, {
        action: AuditAction.HIRE,
        targetAgentId: 'cto-001',
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]!.agent_id).toBe('ceo-001'); // Created by CEO
      expect(auditEvents[0]!.target_agent_id).toBe('cto-001');
      expect(auditEvents[0]!.success).toBe(1);
    });

    it('should log PAUSE action when agent is paused', () => {
      // Create agent
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      // Pause the agent
      updateAgent(db, 'ceo-001', { status: 'paused' });

      // Query audit log for PAUSE action
      const auditEvents = queryAuditLog(db, {
        action: AuditAction.PAUSE,
        targetAgentId: 'ceo-001',
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]!.action).toBe(AuditAction.PAUSE);
      expect(auditEvents[0]!.success).toBe(1);

      // Verify details
      const details = JSON.parse(auditEvents[0]!.details!);
      expect(details.previousStatus).toBe('active');
      expect(details.updates.status).toBe('paused');
    });

    it('should log RESUME action when agent is resumed', () => {
      // Create and pause agent
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });
      updateAgent(db, 'ceo-001', { status: 'paused' });

      // Resume the agent
      updateAgent(db, 'ceo-001', { status: 'active' });

      // Query audit log for RESUME action
      const auditEvents = queryAuditLog(db, {
        action: AuditAction.RESUME,
        targetAgentId: 'ceo-001',
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]!.action).toBe(AuditAction.RESUME);
      expect(auditEvents[0]!.success).toBe(1);

      // Verify details
      const details = JSON.parse(auditEvents[0]!.details!);
      expect(details.previousStatus).toBe('paused');
      expect(details.updates.status).toBe('active');
    });

    it('should log CONFIG_UPDATE action for non-status updates', () => {
      // Create agent
      createAgent(db, {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      });

      // Update non-status field
      updateAgent(db, 'ceo-001', { displayName: 'Alice CEO Updated' });

      // Query audit log for CONFIG_UPDATE action
      const auditEvents = queryAuditLog(db, {
        action: AuditAction.CONFIG_UPDATE,
        targetAgentId: 'ceo-001',
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]!.action).toBe(AuditAction.CONFIG_UPDATE);
      expect(auditEvents[0]!.success).toBe(1);

      // Verify details
      const details = JSON.parse(auditEvents[0]!.details!);
      expect(details.updates.displayName).toBe('Alice CEO Updated');
    });

    it('should log failed HIRE action on error', () => {
      // Try to create duplicate agent - this will cause a UNIQUE constraint violation
      const input: CreateAgentInput = {
        id: 'ceo-001',
        role: 'CEO',
        displayName: 'Alice CEO',
        createdBy: null,
        reportingTo: null,
        mainGoal: 'Lead the organization',
        configPath: '/data/agents/ce/ceo-001/config.json',
      };

      // Create first time - should succeed
      createAgent(db, input);

      // Try to create again with same ID - should fail
      try {
        createAgent(db, input);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected to fail
        expect(error).toBeDefined();
      }

      // Query audit log for failed HIRE
      // Note: Failed HIRE actions have targetAgentId=null since the agent doesn't exist yet
      // The attempted agent ID is stored in the details field instead
      const auditEvents = queryAuditLog(db, {
        action: AuditAction.HIRE,
        success: false,
      });

      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]!.success).toBe(0); // SQLite boolean as 0
      expect(auditEvents[0]!.details).toContain('ceo-001'); // Attempted agent ID in details
      expect(auditEvents[0]!.details).toContain('error');
    });
  });
});
