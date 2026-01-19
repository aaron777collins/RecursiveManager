/**
 * Migration 006: Create org_hierarchy materialized view with indexes
 *
 * This migration creates the org_hierarchy table (implemented as a materialized view)
 * that provides fast hierarchical queries for the agent organization structure.
 * It stores the transitive closure of the reporting relationships, enabling
 * efficient queries for:
 * - Finding all subordinates of an agent (at any depth)
 * - Finding all ancestors of an agent
 * - Computing org chart visualizations
 * - Detecting circular hierarchies
 *
 * The table maintains denormalized hierarchy data with:
 * - agent_id: The agent being described
 * - ancestor_id: An ancestor in the hierarchy (direct manager or higher)
 * - depth: How many levels up the ancestor is (0 = self, 1 = direct manager, etc.)
 * - path: Human-readable path from root to agent (e.g., "CEO/CTO/backend-dev-001")
 *
 * This materialized view needs to be updated whenever:
 * - An agent is hired (reporting_to is set)
 * - An agent's reporting relationship changes
 * - An agent is fired
 *
 * Indexes:
 * - Primary key on (agent_id, ancestor_id): Ensures uniqueness
 * - idx_org_hierarchy_ancestor: For finding all descendants of an agent
 * - idx_org_hierarchy_depth: For filtering by hierarchy level
 */

import { Migration } from '../migrations';

export const migration006: Migration = {
  version: 6,
  description: 'Create org_hierarchy materialized view with indexes',

  up: [
    // Create org_hierarchy table (materialized view)
    `
    CREATE TABLE org_hierarchy (
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      ancestor_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      depth INTEGER NOT NULL,
      path TEXT NOT NULL,

      PRIMARY KEY (agent_id, ancestor_id)
    )
    `,

    // Create index on ancestor_id for finding all descendants of an agent
    // Common query: "Show me everyone who reports to this agent (directly or indirectly)"
    `
    CREATE INDEX idx_org_hierarchy_ancestor ON org_hierarchy(ancestor_id)
    `,

    // Create index on depth for filtering by hierarchy level
    // Common query: "Show me all agents at level 3 in the organization"
    `
    CREATE INDEX idx_org_hierarchy_depth ON org_hierarchy(depth)
    `,

    // Create composite index on (ancestor_id, depth) for common queries
    // Common query: "Show me all direct reports of this agent" (ancestor_id + depth=1)
    `
    CREATE INDEX idx_org_hierarchy_ancestor_depth ON org_hierarchy(ancestor_id, depth)
    `,
  ],

  down: [
    // Drop indexes first
    'DROP INDEX IF EXISTS idx_org_hierarchy_ancestor_depth',
    'DROP INDEX IF EXISTS idx_org_hierarchy_depth',
    'DROP INDEX IF EXISTS idx_org_hierarchy_ancestor',

    // Drop table
    'DROP TABLE IF EXISTS org_hierarchy',
  ],
};
