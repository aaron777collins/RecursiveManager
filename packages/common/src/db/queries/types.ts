/**
 * Type definitions for database queries
 *
 * These types represent database records and query parameters.
 */

/**
 * Agent status enum
 */
export type AgentStatus = 'active' | 'paused' | 'fired';

/**
 * Agent record from the database
 */
export interface AgentRecord {
  id: string;
  role: string;
  display_name: string;
  created_at: string; // ISO 8601 timestamp
  created_by: string | null;
  reporting_to: string | null;
  status: AgentStatus;
  main_goal: string;
  config_path: string;
  last_execution_at: string | null;
  total_executions: number;
  total_runtime_minutes: number;
}

/**
 * Input for creating a new agent
 */
export interface CreateAgentInput {
  id: string;
  role: string;
  displayName: string;
  createdBy: string | null;
  reportingTo: string | null;
  mainGoal: string;
  configPath: string;
}

/**
 * Input for updating an agent
 */
export interface UpdateAgentInput {
  role?: string;
  displayName?: string;
  reportingTo?: string | null;
  status?: AgentStatus;
  mainGoal?: string;
  lastExecutionAt?: string;
  totalExecutions?: number;
  totalRuntimeMinutes?: number;
}

/**
 * Org hierarchy record
 */
export interface OrgHierarchyRecord {
  agent_id: string;
  ancestor_id: string;
  depth: number;
  path: string;
}

/**
 * Input for creating org hierarchy entry
 */
export interface CreateOrgHierarchyInput {
  agentId: string;
  ancestorId: string;
  depth: number;
  path: string;
}

/**
 * Task status enum
 */
export type TaskStatus = 'pending' | 'in-progress' | 'blocked' | 'completed' | 'archived';

/**
 * Task priority enum
 */
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Task record from the database
 */
export interface TaskRecord {
  id: string;
  agent_id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string; // ISO 8601 timestamp
  started_at: string | null;
  completed_at: string | null;
  parent_task_id: string | null;
  depth: number;
  percent_complete: number;
  subtasks_completed: number;
  subtasks_total: number;
  delegated_to: string | null;
  delegated_at: string | null;
  blocked_by: string; // JSON array as text
  blocked_since: string | null;
  task_path: string;
  version: number;
  // Metadata tracking (Task 2.3.8)
  last_updated: string | null; // ISO 8601 timestamp
  last_executed: string | null; // ISO 8601 timestamp
  execution_count: number;
}

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  id?: string; // Optional - will be auto-generated if not provided
  agentId: string;
  title: string;
  priority?: TaskPriority;
  parentTaskId?: string | null;
  delegatedTo?: string | null;
  taskPath: string;
  blockedBy?: string[]; // Task IDs that must be completed before this task can start (Task 2.3.23)
}
