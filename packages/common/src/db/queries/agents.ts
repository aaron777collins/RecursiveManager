/**
 * Agent Query API (Task 1.3.11 - 1.3.15)
 *
 * This module provides database query functions for agent management.
 * All functions use prepared statements for security and performance.
 *
 * Responsibilities:
 * - Create, read, update agents in the database
 * - Maintain org_hierarchy materialized view
 * - Handle agent relationships and hierarchies
 */

import Database from 'better-sqlite3';
import { AgentRecord, CreateAgentInput, UpdateAgentInput, OrgHierarchyRecord } from './types';

/**
 * Create a new agent in the database and update org_hierarchy
 *
 * This function performs the following operations in a transaction:
 * 1. Insert the agent into the agents table
 * 2. Create a self-reference in org_hierarchy (depth=0)
 * 3. If the agent has a manager, copy all manager's ancestors and add them
 *    to this agent's hierarchy with depth+1
 *
 * @param db - Database instance
 * @param input - Agent creation input
 * @returns The created agent record
 *
 * @example
 * ```typescript
 * const agent = createAgent(db, {
 *   id: 'ceo-001',
 *   role: 'CEO',
 *   displayName: 'Alice CEO',
 *   createdBy: null,
 *   reportingTo: null,
 *   mainGoal: 'Lead the organization',
 *   configPath: '/data/agents/ce/ceo-001/config.json'
 * });
 * ```
 */
export function createAgent(db: Database.Database, input: CreateAgentInput): AgentRecord {
  // Prepare statements
  const insertAgent = db.prepare(`
    INSERT INTO agents (
      id,
      role,
      display_name,
      created_at,
      created_by,
      reporting_to,
      status,
      main_goal,
      config_path,
      last_execution_at,
      total_executions,
      total_runtime_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0)
  `);

  const insertOrgHierarchy = db.prepare(`
    INSERT INTO org_hierarchy (agent_id, ancestor_id, depth, path)
    VALUES (?, ?, ?, ?)
  `);

  const getManagerHierarchy = db.prepare(`
    SELECT agent_id, ancestor_id, depth, path
    FROM org_hierarchy
    WHERE agent_id = ?
  `);

  // Execute in a transaction to ensure atomicity
  const transaction = db.transaction(() => {
    const now = new Date().toISOString();

    // Insert agent record
    insertAgent.run(
      input.id,
      input.role,
      input.displayName,
      now,
      input.createdBy,
      input.reportingTo,
      'active',
      input.mainGoal,
      input.configPath
    );

    // Add self-reference to org_hierarchy (depth=0)
    insertOrgHierarchy.run(input.id, input.id, 0, input.role);

    // If agent has a manager, inherit manager's hierarchy
    if (input.reportingTo) {
      const managerHierarchy = getManagerHierarchy.all(input.reportingTo) as OrgHierarchyRecord[];

      for (const entry of managerHierarchy) {
        // Add each of the manager's ancestors as this agent's ancestors
        // with depth+1 (one level further from the root)
        const newDepth = entry.depth + 1;
        const newPath = `${entry.path}/${input.role}`;

        insertOrgHierarchy.run(input.id, entry.ancestor_id, newDepth, newPath);
      }
    }
  });

  // Run the transaction
  transaction();

  // Retrieve and return the created agent
  const agent = getAgent(db, input.id);
  if (!agent) {
    throw new Error(`Failed to retrieve created agent: ${input.id}`);
  }

  return agent;
}

/**
 * Get an agent by ID
 *
 * @param db - Database instance
 * @param id - Agent ID
 * @returns Agent record or null if not found
 *
 * @example
 * ```typescript
 * const agent = getAgent(db, 'ceo-001');
 * if (agent) {
 *   console.log(`Found agent: ${agent.display_name}`);
 * }
 * ```
 */
export function getAgent(db: Database.Database, id: string): AgentRecord | null {
  const query = db.prepare(`
    SELECT
      id,
      role,
      display_name,
      created_at,
      created_by,
      reporting_to,
      status,
      main_goal,
      config_path,
      last_execution_at,
      total_executions,
      total_runtime_minutes
    FROM agents
    WHERE id = ?
  `);

  const result = query.get(id) as AgentRecord | undefined;
  return result ?? null;
}

/**
 * Update an agent's information
 *
 * Note: Updating reportingTo requires updating org_hierarchy, which is
 * currently not implemented. This will be added in a future task when
 * agent reorganization is needed.
 *
 * @param db - Database instance
 * @param id - Agent ID
 * @param updates - Fields to update
 * @returns Updated agent record or null if not found
 *
 * @example
 * ```typescript
 * const updated = updateAgent(db, 'ceo-001', {
 *   status: 'paused',
 *   totalExecutions: 42
 * });
 * ```
 */
export function updateAgent(
  db: Database.Database,
  id: string,
  updates: UpdateAgentInput
): AgentRecord | null {
  // Build dynamic UPDATE query based on provided fields
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.role !== undefined) {
    fields.push('role = ?');
    values.push(updates.role);
  }
  if (updates.displayName !== undefined) {
    fields.push('display_name = ?');
    values.push(updates.displayName);
  }
  if (updates.reportingTo !== undefined) {
    // TODO: When reportingTo changes, we need to update org_hierarchy
    // This is complex and will be implemented when agent reorganization is needed
    fields.push('reporting_to = ?');
    values.push(updates.reportingTo);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.mainGoal !== undefined) {
    fields.push('main_goal = ?');
    values.push(updates.mainGoal);
  }
  if (updates.lastExecutionAt !== undefined) {
    fields.push('last_execution_at = ?');
    values.push(updates.lastExecutionAt);
  }
  if (updates.totalExecutions !== undefined) {
    fields.push('total_executions = ?');
    values.push(updates.totalExecutions);
  }
  if (updates.totalRuntimeMinutes !== undefined) {
    fields.push('total_runtime_minutes = ?');
    values.push(updates.totalRuntimeMinutes);
  }

  // If no fields to update, return current agent
  if (fields.length === 0) {
    return getAgent(db, id);
  }

  // Add ID to values for WHERE clause
  values.push(id);

  // Build and execute query
  const query = db.prepare(`
    UPDATE agents
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  const result = query.run(...values);

  // If no rows were updated, agent doesn't exist
  if (result.changes === 0) {
    return null;
  }

  // Return updated agent
  return getAgent(db, id);
}

/**
 * Get all direct and indirect subordinates of an agent
 *
 * Uses the org_hierarchy materialized view for efficient querying.
 *
 * @param db - Database instance
 * @param managerId - Manager agent ID
 * @returns Array of subordinate agent records
 *
 * @example
 * ```typescript
 * const subordinates = getSubordinates(db, 'ceo-001');
 * console.log(`CEO has ${subordinates.length} subordinates`);
 * ```
 */
export function getSubordinates(db: Database.Database, managerId: string): AgentRecord[] {
  const query = db.prepare(`
    SELECT
      a.id,
      a.role,
      a.display_name,
      a.created_at,
      a.created_by,
      a.reporting_to,
      a.status,
      a.main_goal,
      a.config_path,
      a.last_execution_at,
      a.total_executions,
      a.total_runtime_minutes
    FROM agents a
    INNER JOIN org_hierarchy oh ON a.id = oh.agent_id
    WHERE oh.ancestor_id = ?
      AND oh.depth > 0
    ORDER BY oh.depth, a.display_name
  `);

  return query.all(managerId) as AgentRecord[];
}

/**
 * Get the complete organizational chart
 *
 * Returns all agents organized by hierarchy. The result includes
 * each agent's depth in the organization and their path from the root.
 *
 * @param db - Database instance
 * @returns Array of agents with hierarchy information
 *
 * @example
 * ```typescript
 * const orgChart = getOrgChart(db);
 * for (const entry of orgChart) {
 *   console.log(`${'  '.repeat(entry.depth)}${entry.agent.display_name}`);
 * }
 * ```
 */
export function getOrgChart(
  db: Database.Database
): Array<{ agent: AgentRecord; depth: number; path: string }> {
  const query = db.prepare(`
    SELECT
      a.id,
      a.role,
      a.display_name,
      a.created_at,
      a.created_by,
      a.reporting_to,
      a.status,
      a.main_goal,
      a.config_path,
      a.last_execution_at,
      a.total_executions,
      a.total_runtime_minutes,
      oh.depth,
      oh.path
    FROM agents a
    LEFT JOIN org_hierarchy oh ON a.id = oh.agent_id AND oh.agent_id = oh.ancestor_id
    ORDER BY oh.path, a.display_name
  `);

  const results = query.all() as Array<AgentRecord & { depth: number; path: string }>;

  return results.map((row) => {
    const { depth, path, ...agent } = row;
    return {
      agent,
      depth: depth ?? 0,
      path: path ?? agent.role,
    };
  });
}
