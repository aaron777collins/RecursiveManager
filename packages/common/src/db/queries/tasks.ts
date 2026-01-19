/**
 * Task Query API (Task 1.3.16 - 1.3.20)
 *
 * This module provides database query functions for task management.
 * All functions use prepared statements for security and performance.
 *
 * Responsibilities:
 * - Create, read, update tasks in the database
 * - Enforce task depth validation
 * - Handle task hierarchies and dependencies
 * - Detect deadlocks in task dependencies
 */

import Database from 'better-sqlite3';
import { TaskRecord, CreateTaskInput, TaskStatus } from './types';
import { TASK_MAX_DEPTH } from '../constants';
import { getAgent } from './agents';

/**
 * Get a task by ID
 *
 * @param db - Database instance
 * @param id - Task ID
 * @returns Task record or null if not found
 *
 * @example
 * ```typescript
 * const task = getTask(db, 'task-001');
 * if (task) {
 *   console.log(`Found task: ${task.title}`);
 * }
 * ```
 */
export function getTask(db: Database.Database, id: string): TaskRecord | null {
  const query = db.prepare(`
    SELECT
      id,
      agent_id,
      title,
      status,
      priority,
      created_at,
      started_at,
      completed_at,
      parent_task_id,
      depth,
      percent_complete,
      subtasks_completed,
      subtasks_total,
      delegated_to,
      delegated_at,
      blocked_by,
      blocked_since,
      task_path,
      version
    FROM tasks
    WHERE id = ?
  `);

  const result = query.get(id) as TaskRecord | undefined;
  return result ?? null;
}

/**
 * Create a new task in the database with depth validation
 *
 * This function performs the following operations in a transaction:
 * 1. Validate that the agent exists
 * 2. If parentTaskId is provided, validate parent exists and depth constraint
 * 3. Insert the task with correct depth value
 * 4. Update parent's subtasks_total count if applicable
 *
 * **Depth Validation**:
 * - Root tasks (no parent) have depth = 0
 * - Subtasks have depth = parent.depth + 1
 * - Maximum depth is enforced (TASK_MAX_DEPTH = 5)
 * - Attempting to create a task beyond max depth throws an error
 *
 * @param db - Database instance
 * @param input - Task creation input
 * @returns The created task record
 * @throws Error if agent not found, parent not found, or depth exceeds maximum
 *
 * @example
 * ```typescript
 * // Create a root task
 * const rootTask = createTask(db, {
 *   id: 'task-001',
 *   agentId: 'ceo-001',
 *   title: 'Launch new product',
 *   priority: 'high',
 *   taskPath: 'Launch new product'
 * });
 *
 * // Create a subtask
 * const subtask = createTask(db, {
 *   id: 'task-002',
 *   agentId: 'ceo-001',
 *   title: 'Design product',
 *   priority: 'high',
 *   parentTaskId: 'task-001',
 *   taskPath: 'Launch new product / Design product'
 * });
 * ```
 */
export function createTask(db: Database.Database, input: CreateTaskInput): TaskRecord {
  // Step 1: Validate agent exists
  const agent = getAgent(db, input.agentId);
  if (!agent) {
    throw new Error(`Agent not found: ${input.agentId}`);
  }

  // Step 2: Depth validation
  let depth = 0;
  let parentTask: TaskRecord | null = null;

  if (input.parentTaskId) {
    parentTask = getTask(db, input.parentTaskId);
    if (!parentTask) {
      throw new Error(`Parent task not found: ${input.parentTaskId}`);
    }

    // Check depth constraint
    if (parentTask.depth >= TASK_MAX_DEPTH) {
      throw new Error(
        `Cannot create subtask: parent task is at maximum depth (${TASK_MAX_DEPTH}). ` +
          `Parent task "${parentTask.title}" (${parentTask.id}) has depth ${parentTask.depth}.`
      );
    }

    depth = parentTask.depth + 1;
  }

  // Step 3: Prepare statements
  const insertTask = db.prepare(`
    INSERT INTO tasks (
      id,
      agent_id,
      title,
      status,
      priority,
      created_at,
      started_at,
      completed_at,
      parent_task_id,
      depth,
      percent_complete,
      subtasks_completed,
      subtasks_total,
      delegated_to,
      delegated_at,
      blocked_by,
      blocked_since,
      task_path,
      version
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 0, 0, 0, ?, NULL, '[]', NULL, ?, 0)
  `);

  const updateParentSubtaskCount = db.prepare(`
    UPDATE tasks
    SET subtasks_total = subtasks_total + 1
    WHERE id = ?
  `);

  // Step 4: Execute in a transaction to ensure atomicity
  const transaction = db.transaction(() => {
    const now = new Date().toISOString();
    const priority = input.priority ?? 'medium';

    // Insert task record
    insertTask.run(
      input.id,
      input.agentId,
      input.title,
      'pending', // default status
      priority,
      now,
      input.parentTaskId ?? null,
      depth,
      input.delegatedTo ?? null,
      input.taskPath
    );

    // If this is a subtask, increment parent's subtask count
    if (parentTask) {
      updateParentSubtaskCount.run(parentTask.id);
    }
  });

  // Run the transaction
  transaction();

  // Retrieve and return the created task
  const task = getTask(db, input.id);
  if (!task) {
    throw new Error(`Failed to retrieve created task: ${input.id}`);
  }

  return task;
}

/**
 * Update task status with optimistic locking
 *
 * This function updates a task's status while preventing race conditions using
 * optimistic locking. The version field is used to detect concurrent modifications.
 *
 * **Optimistic Locking**:
 * - The function accepts the current version number
 * - The UPDATE only succeeds if the database version matches
 * - If no rows are updated, it means another process modified the task
 * - The version is automatically incremented on successful update
 *
 * **Status Transitions**:
 * - Sets `started_at` timestamp when transitioning to 'in-progress' (if not already set)
 * - Sets `completed_at` timestamp when transitioning to 'completed'
 * - Clears `completed_at` if moving away from 'completed' status
 *
 * @param db - Database instance
 * @param id - Task ID to update
 * @param status - New status value
 * @param version - Current version number (for optimistic locking)
 * @returns The updated task record
 * @throws Error if task not found or version mismatch (concurrent modification)
 *
 * @example
 * ```typescript
 * // Fetch task with current version
 * const task = getTask(db, 'task-001');
 * if (!task) throw new Error('Task not found');
 *
 * // Update status with optimistic locking
 * try {
 *   const updated = updateTaskStatus(db, task.id, 'in-progress', task.version);
 *   console.log(`Task updated to version ${updated.version}`);
 * } catch (error) {
 *   console.error('Concurrent modification detected');
 *   // Re-fetch task and retry if needed
 * }
 * ```
 */
export function updateTaskStatus(
  db: Database.Database,
  id: string,
  status: TaskStatus,
  version: number
): TaskRecord {
  // First, verify the task exists
  const currentTask = getTask(db, id);
  if (!currentTask) {
    throw new Error(`Task not found: ${id}`);
  }

  const now = new Date().toISOString();

  // Prepare the UPDATE statement with optimistic locking
  // Only update if the version matches (prevents race conditions)
  const updateStmt = db.prepare(`
    UPDATE tasks
    SET
      status = ?,
      version = version + 1,
      started_at = CASE
        WHEN ? = 'in-progress' AND started_at IS NULL THEN ?
        ELSE started_at
      END,
      completed_at = CASE
        WHEN ? = 'completed' THEN ?
        WHEN ? != 'completed' THEN NULL
        ELSE completed_at
      END
    WHERE id = ? AND version = ?
  `);

  // Execute the update
  const result = updateStmt.run(
    status,
    status, // for started_at CASE
    now, // for started_at value
    status, // for completed_at CASE (completed)
    now, // for completed_at value
    status, // for completed_at CASE (not completed)
    id,
    version
  );

  // Check if any rows were updated
  if (result.changes === 0) {
    // No rows updated means either:
    // 1. Task doesn't exist (but we checked this above)
    // 2. Version mismatch (concurrent modification)
    throw new Error(
      `Failed to update task ${id}: version mismatch. ` +
        `Expected version ${version}, but task was modified by another process. ` +
        `Please re-fetch the task and retry the operation.`
    );
  }

  // Retrieve and return the updated task
  const updatedTask = getTask(db, id);
  if (!updatedTask) {
    throw new Error(`Failed to retrieve updated task: ${id}`);
  }

  return updatedTask;
}

/**
 * Get all active tasks for an agent
 *
 * Returns all tasks assigned to the agent that are not completed or archived.
 * Active tasks include those with status: 'pending', 'in-progress', or 'blocked'.
 *
 * The query uses the idx_tasks_agent_status index for efficient filtering.
 *
 * @param db - Database instance
 * @param agentId - Agent ID to query tasks for
 * @returns Array of active task records, ordered by priority (urgent->high->medium->low) and creation date
 *
 * @example
 * ```typescript
 * const activeTasks = getActiveTasks(db, 'agent-001');
 * console.log(`Agent has ${activeTasks.length} active tasks`);
 *
 * activeTasks.forEach(task => {
 *   console.log(`- [${task.status}] ${task.title}`);
 * });
 * ```
 */
export function getActiveTasks(db: Database.Database, agentId: string): TaskRecord[] {
  const query = db.prepare(`
    SELECT
      id,
      agent_id,
      title,
      status,
      priority,
      created_at,
      started_at,
      completed_at,
      parent_task_id,
      depth,
      percent_complete,
      subtasks_completed,
      subtasks_total,
      delegated_to,
      delegated_at,
      blocked_by,
      blocked_since,
      task_path,
      version
    FROM tasks
    WHERE agent_id = ?
      AND status IN ('pending', 'in-progress', 'blocked')
    ORDER BY
      CASE priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
      END,
      created_at ASC
  `);

  const results = query.all(agentId) as TaskRecord[];
  return results;
}
