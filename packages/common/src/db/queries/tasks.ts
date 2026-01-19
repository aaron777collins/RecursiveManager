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
import { auditLog, AuditAction } from './audit';

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

  try {
    // Run the transaction
    transaction();

    // Retrieve and return the created task
    const task = getTask(db, input.id);
    if (!task) {
      throw new Error(`Failed to retrieve created task: ${input.id}`);
    }

    // Audit log successful task creation
    auditLog(db, {
      agentId: input.agentId,
      action: AuditAction.TASK_CREATE,
      targetAgentId: input.agentId,
      success: true,
      details: {
        taskId: input.id,
        title: input.title,
        priority: input.priority,
        parentTaskId: input.parentTaskId,
        depth,
      },
    });

    return task;
  } catch (error) {
    // Audit log failed task creation
    auditLog(db, {
      agentId: input.agentId,
      action: AuditAction.TASK_CREATE,
      targetAgentId: input.agentId,
      success: false,
      details: {
        taskId: input.id,
        title: input.title,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
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

  try {
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

    // Determine audit action based on status
    const auditAction = status === 'completed' ? AuditAction.TASK_COMPLETE : AuditAction.TASK_UPDATE;

    // Audit log successful task status update
    auditLog(db, {
      agentId: currentTask.agent_id,
      action: auditAction,
      targetAgentId: currentTask.agent_id,
      success: true,
      details: {
        taskId: id,
        title: currentTask.title,
        previousStatus: currentTask.status,
        newStatus: status,
        previousVersion: version,
        newVersion: updatedTask.version,
      },
    });

    return updatedTask;
  } catch (error) {
    // Audit log failed task status update
    auditLog(db, {
      agentId: currentTask.agent_id,
      action: AuditAction.TASK_UPDATE,
      targetAgentId: currentTask.agent_id,
      success: false,
      details: {
        taskId: id,
        title: currentTask.title,
        attemptedStatus: status,
        currentStatus: currentTask.status,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
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

/**
 * Detect task deadlock using DFS (Depth-First Search) algorithm
 *
 * A deadlock occurs when there is a circular dependency in the task blocking chain.
 * For example: Task A blocks on B, B blocks on C, C blocks on A.
 *
 * This function uses a DFS approach to traverse the dependency graph and detect cycles.
 * The algorithm maintains two data structures:
 * - `visited`: Set of all task IDs we've explored (prevents re-exploring subtrees)
 * - `path`: Current path of task IDs being explored (detects cycles)
 *
 * **Algorithm**:
 * 1. Start DFS from the given taskId
 * 2. For each task, check if it's already in the current path (cycle detected)
 * 3. If not in path, add to visited set and path stack
 * 4. Recursively explore all tasks that block this task
 * 5. If a cycle is found, return the path forming the cycle
 * 6. If no cycle found, return null
 *
 * **Example Deadlock**:
 * ```
 * Task A (blocked_by: ["B"])
 *   └─> Task B (blocked_by: ["C"])
 *         └─> Task C (blocked_by: ["A"])  // Cycle!
 * ```
 *
 * @param db - Database instance
 * @param taskId - The task ID to start deadlock detection from
 * @returns Array of task IDs forming the cycle if deadlock detected, null otherwise
 *
 * @example
 * ```typescript
 * // Check if a task is in a deadlock
 * const cycle = detectTaskDeadlock(db, 'task-001');
 * if (cycle) {
 *   console.log('Deadlock detected!');
 *   console.log('Cycle: ' + cycle.join(' -> ') + ' -> ' + cycle[0]);
 *   // Alert all agents in the cycle for human intervention
 * } else {
 *   console.log('No deadlock detected');
 * }
 * ```
 */
export function detectTaskDeadlock(db: Database.Database, taskId: string): string[] | null {
  // Track all visited nodes to avoid re-exploration
  const visited = new Set<string>();

  // Track the current path to detect cycles
  const path: string[] = [];

  /**
   * DFS helper function to explore the task dependency graph
   *
   * @param id - Current task ID being explored
   * @returns true if a cycle is detected, false otherwise
   */
  function dfs(id: string): boolean {
    // Cycle detected: current task is already in the path
    if (path.includes(id)) {
      // Add the task to path to complete the cycle visualization
      path.push(id);
      return true;
    }

    // Already explored this subtree, no need to explore again
    if (visited.has(id)) {
      return false;
    }

    // Mark as visited and add to current path
    visited.add(id);
    path.push(id);

    // Get the task to access its blocked_by field
    const task = getTask(db, id);
    if (!task) {
      // Task not found, can't explore further
      path.pop();
      return false;
    }

    // Parse the blocked_by JSON array
    let blockedBy: string[];
    try {
      blockedBy = JSON.parse(task.blocked_by) as string[];
    } catch (error) {
      // Invalid JSON, treat as no blockers
      blockedBy = [];
    }

    // Recursively explore all tasks that block this task
    for (const blockerId of blockedBy) {
      if (dfs(blockerId)) {
        // Cycle found in one of the dependencies
        return true;
      }
    }

    // No cycle found through this path, backtrack
    path.pop();
    return false;
  }

  // Start DFS from the given task
  if (dfs(taskId)) {
    // Cycle detected: extract the cycle from the path
    // The path will contain: [...prefix, cycleStart, ...cycle, cycleStart]
    // We need to return just the cycle portion
    const lastTaskId = path[path.length - 1];
    if (!lastTaskId) {
      // This should never happen if dfs returned true, but handle it for type safety
      return null;
    }
    const cycleStartIndex = path.indexOf(lastTaskId);
    return path.slice(cycleStartIndex, -1); // Exclude the duplicate at the end
  }

  // No cycle detected
  return null;
}

/**
 * Get all blocked tasks for an agent
 *
 * Returns all tasks assigned to the agent that have a 'blocked' status.
 * These are tasks that cannot proceed because they are waiting on other tasks to complete.
 *
 * The query uses the idx_tasks_agent_status index for efficient filtering.
 *
 * **Use Cases**:
 * - Identify tasks waiting on dependencies
 * - Check for potential deadlocks
 * - Prioritize unblocking critical tasks
 * - Monitor agent workload bottlenecks
 *
 * @param db - Database instance
 * @param agentId - Agent ID to query blocked tasks for
 * @returns Array of blocked task records, ordered by priority and creation date
 *
 * @example
 * ```typescript
 * const blockedTasks = getBlockedTasks(db, 'agent-001');
 * console.log(`Agent has ${blockedTasks.length} blocked tasks`);
 *
 * // Check each blocked task for deadlocks
 * blockedTasks.forEach(task => {
 *   const cycle = detectTaskDeadlock(db, task.id);
 *   if (cycle) {
 *     console.log(`Task ${task.title} is in a deadlock: ${cycle.join(' -> ')}`);
 *   } else {
 *     const blockers = JSON.parse(task.blocked_by);
 *     console.log(`Task ${task.title} is blocked by: ${blockers.join(', ')}`);
 *   }
 * });
 * ```
 */
export function getBlockedTasks(db: Database.Database, agentId: string): TaskRecord[] {
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
      AND status = 'blocked'
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

/**
 * Update task progress with optimistic locking
 *
 * This function updates a task's percent_complete field while preventing race conditions using
 * optimistic locking. The version field is used to detect concurrent modifications.
 *
 * **Optimistic Locking**:
 * - The function accepts the current version number
 * - The UPDATE only succeeds if the database version matches
 * - If no rows are updated, it means another process modified the task
 * - The version is automatically incremented on successful update
 *
 * **Progress Validation**:
 * - Progress must be between 0 and 100 (inclusive)
 * - Progress is clamped to valid range if needed
 *
 * @param db - Database instance
 * @param id - Task ID to update
 * @param percentComplete - New progress value (0-100)
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
 * // Update progress with optimistic locking
 * try {
 *   const updated = updateTaskProgress(db, task.id, 75, task.version);
 *   console.log(`Task progress updated to ${updated.percent_complete}%`);
 * } catch (error) {
 *   console.error('Concurrent modification detected');
 *   // Re-fetch task and retry if needed
 * }
 * ```
 */
export function updateTaskProgress(
  db: Database.Database,
  id: string,
  percentComplete: number,
  version: number
): TaskRecord {
  // First, verify the task exists
  const currentTask = getTask(db, id);
  if (!currentTask) {
    throw new Error(`Task not found: ${id}`);
  }

  // Validate and clamp progress to 0-100 range
  const clampedProgress = Math.max(0, Math.min(100, percentComplete));

  // Prepare the UPDATE statement with optimistic locking
  // Only update if the version matches (prevents race conditions)
  const updateStmt = db.prepare(`
    UPDATE tasks
    SET
      percent_complete = ?,
      version = version + 1
    WHERE id = ? AND version = ?
  `);

  try {
    // Execute the update
    const result = updateStmt.run(clampedProgress, id, version);

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

    // Audit log successful task progress update
    auditLog(db, {
      agentId: currentTask.agent_id,
      action: AuditAction.TASK_UPDATE,
      targetAgentId: currentTask.agent_id,
      success: true,
      details: {
        taskId: id,
        title: currentTask.title,
        previousProgress: currentTask.percent_complete,
        newProgress: clampedProgress,
        previousVersion: version,
        newVersion: updatedTask.version,
      },
    });

    return updatedTask;
  } catch (error) {
    // Audit log failed task progress update
    auditLog(db, {
      agentId: currentTask.agent_id,
      action: AuditAction.TASK_UPDATE,
      targetAgentId: currentTask.agent_id,
      success: false,
      details: {
        taskId: id,
        title: currentTask.title,
        attemptedProgress: clampedProgress,
        currentProgress: currentTask.percent_complete,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
