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
import { auditLog, AuditAction } from './audit';

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
  // Validate agent ID format to prevent injection and path traversal
  const agentIdPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
  if (!agentIdPattern.test(input.id)) {
    throw new Error(
      `Invalid agent ID format: '${input.id}'. ` +
        `Agent IDs must contain only lowercase letters, numbers, and hyphens, ` +
        `and cannot start or end with a hyphen.`
    );
  }

  // Additional length check
  if (input.id.length < 2 || input.id.length > 64) {
    throw new Error(`Agent ID length must be between 2 and 64 characters, got ${input.id.length}`);
  }

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

  try {
    // Run the transaction
    transaction();

    // Retrieve and return the created agent
    const agent = getAgent(db, input.id);
    if (!agent) {
      throw new Error(`Failed to retrieve created agent: ${input.id}`);
    }

    // Audit log successful agent creation
    // Note: agent_id must be either null or a valid agent ID due to foreign key constraint
    // For system-created agents (createdBy='system'), we use null since 'system' is not an agent
    auditLog(db, {
      agentId: input.createdBy && input.createdBy !== 'system' ? input.createdBy : null,
      action: AuditAction.HIRE,
      targetAgentId: input.id,
      success: true,
      details: {
        role: input.role,
        displayName: input.displayName,
        reportingTo: input.reportingTo,
        mainGoal: input.mainGoal,
        createdBy: input.createdBy, // Store the original createdBy in details for reference
      },
    });

    return agent;
  } catch (error) {
    // Audit log failed agent creation
    // Note: agent_id must be either null or a valid agent ID due to foreign key constraint
    auditLog(db, {
      agentId: input.createdBy && input.createdBy !== 'system' ? input.createdBy : null,
      action: AuditAction.HIRE,
      targetAgentId: input.id,
      success: false,
      details: {
        role: input.role,
        displayName: input.displayName,
        createdBy: input.createdBy, // Store the original createdBy in details for reference
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
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
 * Update org_hierarchy for an agent and all their descendants when reporting structure changes
 *
 * This function performs the following operations:
 * 1. Deletes all existing hierarchy entries for the agent (except self-reference)
 * 2. Rebuilds the agent's hierarchy based on new manager
 * 3. Recursively updates all descendants' hierarchies
 *
 * This ensures the org_hierarchy materialized view stays consistent when agents
 * are reassigned to new managers (e.g., during fire operations with orphan reassignment).
 *
 * @param db - Database instance (must be within a transaction)
 * @param agentId - Agent whose hierarchy needs updating
 * @param newManagerId - New manager agent ID (null for root-level agents)
 * @param agentRole - Agent's role (used for path construction)
 *
 * @example
 * ```typescript
 * db.transaction(() => {
 *   updateAgent(db, 'dev-001', { reportingTo: 'cto-002' });
 *   updateOrgHierarchyForAgent(db, 'dev-001', 'cto-002', 'Developer');
 * })();
 * ```
 */
function updateOrgHierarchyForAgent(
  db: Database.Database,
  agentId: string,
  newManagerId: string | null,
  agentRole: string
): void {
  // Prepare statements
  const deleteNonSelfHierarchy = db.prepare(`
    DELETE FROM org_hierarchy
    WHERE agent_id = ?
      AND ancestor_id != agent_id
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

  const getDirectSubordinates = db.prepare(`
    SELECT id, role
    FROM agents
    WHERE reporting_to = ?
      AND id != ?
  `);

  // Step 1: Delete all existing hierarchy entries except self-reference
  deleteNonSelfHierarchy.run(agentId);

  // Step 2: Rebuild hierarchy based on new manager
  if (newManagerId) {
    const managerHierarchy = getManagerHierarchy.all(newManagerId) as OrgHierarchyRecord[];

    for (const entry of managerHierarchy) {
      // Add each of the manager's ancestors as this agent's ancestors
      // with depth+1 (one level further from the root)
      const newDepth = entry.depth + 1;
      const newPath = `${entry.path}/${agentRole}`;

      insertOrgHierarchy.run(agentId, entry.ancestor_id, newDepth, newPath);
    }
  }

  // Step 3: Recursively update all direct subordinates
  // Their hierarchy needs to be rebuilt based on this agent's new hierarchy
  const subordinates = getDirectSubordinates.all(agentId, agentId) as Array<{
    id: string;
    role: string;
  }>;

  for (const subordinate of subordinates) {
    updateOrgHierarchyForAgent(db, subordinate.id, agentId, subordinate.role);
  }
}

/**
 * Update an agent's information
 *
 * When reportingTo changes, this function automatically updates the org_hierarchy
 * materialized view to reflect the new reporting structure for both the agent
 * and all their descendants.
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
  // Get current agent for audit logging comparison
  const currentAgent = getAgent(db, id);
  if (!currentAgent) {
    return null;
  }

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
    return currentAgent;
  }

  // Add ID to values for WHERE clause
  values.push(id);

  // Build and execute query
  const query = db.prepare(`
    UPDATE agents
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  // Check if we need to update org_hierarchy (reportingTo changed)
  const needsOrgHierarchyUpdate =
    updates.reportingTo !== undefined && updates.reportingTo !== currentAgent.reporting_to;

  try {
    // If org_hierarchy needs updating, use a transaction
    if (needsOrgHierarchyUpdate) {
      const transaction = db.transaction(() => {
        const result = query.run(...values);

        // If no rows were updated, agent doesn't exist
        if (result.changes === 0) {
          throw new Error(`Agent ${id} not found`);
        }

        // Update org_hierarchy for this agent and all descendants
        updateOrgHierarchyForAgent(db, id, updates.reportingTo!, currentAgent.role);
      });

      transaction();
    } else {
      // Simple update without org_hierarchy changes
      const result = query.run(...values);

      // If no rows were updated, agent doesn't exist
      if (result.changes === 0) {
        return null;
      }
    }

    // Determine audit action based on status change
    let auditAction: string = AuditAction.CONFIG_UPDATE;
    if (updates.status !== undefined && updates.status !== currentAgent.status) {
      switch (updates.status) {
        case 'paused':
          auditAction = AuditAction.PAUSE;
          break;
        case 'active':
          auditAction = AuditAction.RESUME;
          break;
        case 'fired':
          auditAction = AuditAction.FIRE;
          break;
        default:
          auditAction = AuditAction.CONFIG_UPDATE;
      }
    }

    // Audit log successful agent update
    auditLog(db, {
      agentId: null, // TODO: Pass acting agent ID when available
      action: auditAction,
      targetAgentId: id,
      success: true,
      details: {
        updates,
        previousStatus: currentAgent.status,
      },
    });

    // Return updated agent
    return getAgent(db, id);
  } catch (error) {
    // Audit log failed agent update
    auditLog(db, {
      agentId: null, // TODO: Pass acting agent ID when available
      action: AuditAction.CONFIG_UPDATE,
      targetAgentId: id,
      success: false,
      details: {
        updates,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
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
