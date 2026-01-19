/**
 * Tests for org_hierarchy updates when reporting structure changes
 *
 * This test file verifies that Task 2.2.21 is correctly implemented:
 * "Implement real-time org chart updates on hire/fire"
 */

import Database from 'better-sqlite3';
import { createAgent, updateAgent, getAgent, getSubordinates, getOrgChart } from '../agents';

describe('Org Hierarchy Updates on Reporting Changes', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec('PRAGMA foreign_keys = ON');

    // Create tables
    db.exec(`
      CREATE TABLE agents (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT,
        reporting_to TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        main_goal TEXT NOT NULL,
        config_path TEXT NOT NULL,
        last_execution_at TEXT,
        total_executions INTEGER NOT NULL DEFAULT 0,
        total_runtime_minutes REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (reporting_to) REFERENCES agents(id)
      );

      CREATE TABLE org_hierarchy (
        agent_id TEXT NOT NULL,
        ancestor_id TEXT NOT NULL,
        depth INTEGER NOT NULL,
        path TEXT NOT NULL,
        PRIMARY KEY (agent_id, ancestor_id),
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (ancestor_id) REFERENCES agents(id)
      );

      CREATE INDEX idx_org_hierarchy_ancestor ON org_hierarchy(ancestor_id);
      CREATE INDEX idx_org_hierarchy_ancestor_depth ON org_hierarchy(ancestor_id, depth);

      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        agent_id TEXT,
        action TEXT NOT NULL,
        target_agent_id TEXT,
        success INTEGER NOT NULL,
        details TEXT
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  test('updating reportingTo updates org_hierarchy for agent', () => {
    // Create a simple hierarchy: CEO -> CTO -> Developer
    const ceo = createAgent(db, {
      id: 'ceo-001',
      role: 'CEO',
      displayName: 'Alice CEO',
      createdBy: null,
      reportingTo: null,
      mainGoal: 'Lead company',
      configPath: '/agents/ceo-001/config.json',
    });

    const cto = createAgent(db, {
      id: 'cto-001',
      role: 'CTO',
      displayName: 'Bob CTO',
      createdBy: ceo.id,
      reportingTo: ceo.id,
      mainGoal: 'Lead tech',
      configPath: '/agents/cto-001/config.json',
    });

    const dev = createAgent(db, {
      id: 'dev-001',
      role: 'Developer',
      displayName: 'Charlie Dev',
      createdBy: cto.id,
      reportingTo: cto.id,
      mainGoal: 'Write code',
      configPath: '/agents/dev-001/config.json',
    });

    // Verify initial hierarchy for developer
    let devHierarchy = db
      .prepare('SELECT * FROM org_hierarchy WHERE agent_id = ? ORDER BY depth')
      .all(dev.id) as any[];

    expect(devHierarchy).toHaveLength(3); // Self, CTO, CEO
    expect(devHierarchy[0].ancestor_id).toBe(dev.id);
    expect(devHierarchy[0].depth).toBe(0);
    expect(devHierarchy[1].ancestor_id).toBe(cto.id);
    expect(devHierarchy[1].depth).toBe(1);
    expect(devHierarchy[2].ancestor_id).toBe(ceo.id);
    expect(devHierarchy[2].depth).toBe(2);

    // Now reassign developer directly to CEO (skip CTO)
    updateAgent(db, dev.id, { reportingTo: ceo.id });

    // Verify updated hierarchy
    devHierarchy = db
      .prepare('SELECT * FROM org_hierarchy WHERE agent_id = ? ORDER BY depth')
      .all(dev.id) as any[];

    expect(devHierarchy).toHaveLength(2); // Self, CEO (no CTO anymore)
    expect(devHierarchy[0].ancestor_id).toBe(dev.id);
    expect(devHierarchy[0].depth).toBe(0);
    expect(devHierarchy[1].ancestor_id).toBe(ceo.id);
    expect(devHierarchy[1].depth).toBe(1);

    // Verify agent record was updated
    const updatedDev = getAgent(db, dev.id);
    expect(updatedDev?.reporting_to).toBe(ceo.id);
  });

  test('updating reportingTo updates org_hierarchy for all descendants', () => {
    // Create hierarchy: CEO -> CTO -> Dev -> Junior Dev
    const ceo = createAgent(db, {
      id: 'ceo-001',
      role: 'CEO',
      displayName: 'Alice CEO',
      createdBy: null,
      reportingTo: null,
      mainGoal: 'Lead company',
      configPath: '/agents/ceo-001/config.json',
    });

    const cto = createAgent(db, {
      id: 'cto-001',
      role: 'CTO',
      displayName: 'Bob CTO',
      createdBy: ceo.id,
      reportingTo: ceo.id,
      mainGoal: 'Lead tech',
      configPath: '/agents/cto-001/config.json',
    });

    const cfo = createAgent(db, {
      id: 'cfo-001',
      role: 'CFO',
      displayName: 'Diana CFO',
      createdBy: ceo.id,
      reportingTo: ceo.id,
      mainGoal: 'Lead finance',
      configPath: '/agents/cfo-001/config.json',
    });

    const dev = createAgent(db, {
      id: 'dev-001',
      role: 'Developer',
      displayName: 'Charlie Dev',
      createdBy: cto.id,
      reportingTo: cto.id,
      mainGoal: 'Write code',
      configPath: '/agents/dev-001/config.json',
    });

    const juniorDev = createAgent(db, {
      id: 'dev-002',
      role: 'Junior Developer',
      displayName: 'Eve Junior',
      createdBy: dev.id,
      reportingTo: dev.id,
      mainGoal: 'Learn to code',
      configPath: '/agents/dev-002/config.json',
    });

    // Initial state: Junior Dev hierarchy is [self, Dev, CTO, CEO]
    let juniorHierarchy = db
      .prepare('SELECT * FROM org_hierarchy WHERE agent_id = ? ORDER BY depth')
      .all(juniorDev.id) as any[];

    expect(juniorHierarchy).toHaveLength(4);
    expect(juniorHierarchy[0].ancestor_id).toBe(juniorDev.id);
    expect(juniorHierarchy[1].ancestor_id).toBe(dev.id);
    expect(juniorHierarchy[2].ancestor_id).toBe(cto.id);
    expect(juniorHierarchy[3].ancestor_id).toBe(ceo.id);

    // Reassign Dev from CTO to CFO
    // This should cascade: Junior Dev's hierarchy should now be [self, Dev, CFO, CEO]
    updateAgent(db, dev.id, { reportingTo: cfo.id });

    // Verify Dev's hierarchy updated
    const devHierarchy = db
      .prepare('SELECT * FROM org_hierarchy WHERE agent_id = ? ORDER BY depth')
      .all(dev.id) as any[];

    expect(devHierarchy).toHaveLength(3); // Self, CFO, CEO
    expect(devHierarchy[0].ancestor_id).toBe(dev.id);
    expect(devHierarchy[1].ancestor_id).toBe(cfo.id);
    expect(devHierarchy[2].ancestor_id).toBe(ceo.id);

    // Verify Junior Dev's hierarchy ALSO updated (cascade)
    juniorHierarchy = db
      .prepare('SELECT * FROM org_hierarchy WHERE agent_id = ? ORDER BY depth')
      .all(juniorDev.id) as any[];

    expect(juniorHierarchy).toHaveLength(4); // Self, Dev, CFO, CEO
    expect(juniorHierarchy[0].ancestor_id).toBe(juniorDev.id);
    expect(juniorHierarchy[1].ancestor_id).toBe(dev.id);
    expect(juniorHierarchy[2].ancestor_id).toBe(cfo.id);
    expect(juniorHierarchy[3].ancestor_id).toBe(ceo.id);
  });

  test('reassigning to null makes agent root-level', () => {
    // Create hierarchy: CEO -> CTO
    const ceo = createAgent(db, {
      id: 'ceo-001',
      role: 'CEO',
      displayName: 'Alice CEO',
      createdBy: null,
      reportingTo: null,
      mainGoal: 'Lead company',
      configPath: '/agents/ceo-001/config.json',
    });

    const cto = createAgent(db, {
      id: 'cto-001',
      role: 'CTO',
      displayName: 'Bob CTO',
      createdBy: ceo.id,
      reportingTo: ceo.id,
      mainGoal: 'Lead tech',
      configPath: '/agents/cto-001/config.json',
    });

    // Verify CTO has CEO as ancestor
    let ctoHierarchy = db
      .prepare('SELECT * FROM org_hierarchy WHERE agent_id = ? ORDER BY depth')
      .all(cto.id) as any[];

    expect(ctoHierarchy).toHaveLength(2); // Self, CEO

    // Make CTO root-level by setting reportingTo to null
    updateAgent(db, cto.id, { reportingTo: null });

    // Verify CTO now only has self-reference
    ctoHierarchy = db
      .prepare('SELECT * FROM org_hierarchy WHERE agent_id = ? ORDER BY depth')
      .all(cto.id) as any[];

    expect(ctoHierarchy).toHaveLength(1); // Only self
    expect(ctoHierarchy[0].ancestor_id).toBe(cto.id);
    expect(ctoHierarchy[0].depth).toBe(0);

    // Verify agent record updated
    const updatedCto = getAgent(db, cto.id);
    expect(updatedCto?.reporting_to).toBeNull();
  });

  test('getSubordinates returns correct results after reassignment', () => {
    // Create hierarchy: CEO -> CTO -> Dev
    const ceo = createAgent(db, {
      id: 'ceo-001',
      role: 'CEO',
      displayName: 'Alice CEO',
      createdBy: null,
      reportingTo: null,
      mainGoal: 'Lead company',
      configPath: '/agents/ceo-001/config.json',
    });

    const cto = createAgent(db, {
      id: 'cto-001',
      role: 'CTO',
      displayName: 'Bob CTO',
      createdBy: ceo.id,
      reportingTo: ceo.id,
      mainGoal: 'Lead tech',
      configPath: '/agents/cto-001/config.json',
    });

    const dev = createAgent(db, {
      id: 'dev-001',
      role: 'Developer',
      displayName: 'Charlie Dev',
      createdBy: cto.id,
      reportingTo: cto.id,
      mainGoal: 'Write code',
      configPath: '/agents/dev-001/config.json',
    });

    // Initially: CEO has 2 subordinates (CTO and Dev), CTO has 1 (Dev)
    expect(getSubordinates(db, ceo.id)).toHaveLength(2);
    expect(getSubordinates(db, cto.id)).toHaveLength(1);

    // Reassign Dev to CEO
    updateAgent(db, dev.id, { reportingTo: ceo.id });

    // Now: CEO has 2 subordinates (CTO and Dev), CTO has 0
    expect(getSubordinates(db, ceo.id)).toHaveLength(2);
    expect(getSubordinates(db, cto.id)).toHaveLength(0);
  });

  test('getOrgChart returns correct hierarchy after reassignment', () => {
    // Create hierarchy: CEO -> CTO -> Dev
    const ceo = createAgent(db, {
      id: 'ceo-001',
      role: 'CEO',
      displayName: 'Alice CEO',
      createdBy: null,
      reportingTo: null,
      mainGoal: 'Lead company',
      configPath: '/agents/ceo-001/config.json',
    });

    const cto = createAgent(db, {
      id: 'cto-001',
      role: 'CTO',
      displayName: 'Bob CTO',
      createdBy: ceo.id,
      reportingTo: ceo.id,
      mainGoal: 'Lead tech',
      configPath: '/agents/cto-001/config.json',
    });

    const dev = createAgent(db, {
      id: 'dev-001',
      role: 'Developer',
      displayName: 'Charlie Dev',
      createdBy: cto.id,
      reportingTo: cto.id,
      mainGoal: 'Write code',
      configPath: '/agents/dev-001/config.json',
    });

    // Get org chart before reassignment
    const orgChartBefore = getOrgChart(db);
    const devBefore = orgChartBefore.find((entry) => entry.agent.id === dev.id);
    expect(devBefore?.depth).toBe(0); // Self-reference depth
    expect(devBefore?.path).toBe('Developer');

    // Reassign Dev to CEO
    updateAgent(db, dev.id, { reportingTo: ceo.id });

    // Get org chart after reassignment
    const orgChartAfter = getOrgChart(db);
    const devAfter = orgChartAfter.find((entry) => entry.agent.id === dev.id);
    expect(devAfter?.depth).toBe(0); // Still self-reference depth
    expect(devAfter?.path).toBe('Developer');

    // Verify reporting_to changed
    expect(devAfter?.agent.reporting_to).toBe(ceo.id);
  });
});
