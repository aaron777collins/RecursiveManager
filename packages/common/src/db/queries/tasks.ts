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
import { generateTaskId } from '../taskIdGenerator';

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
      version,
      last_updated,
      last_executed,
      execution_count
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
 * // Create a root task with auto-generated ID
 * const rootTask = createTask(db, {
 *   agentId: 'ceo-001',
 *   title: 'Launch new product',
 *   priority: 'high',
 *   taskPath: 'Launch new product'
 * });
 * // Generated ID will be like: 'task-1-launch-new-product'
 *
 * // Create a subtask with custom ID
 * const subtask = createTask(db, {
 *   id: 'task-002-design',
 *   agentId: 'ceo-001',
 *   title: 'Design product',
 *   priority: 'high',
 *   parentTaskId: rootTask.id,
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

  // Step 1.5: Generate task ID if not provided
  const taskId = input.id ?? generateTaskId(db, input.agentId, input.title);

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

  // Step 2.5: Validate blocked_by dependencies and prevent circular dependencies (Task 2.3.23)
  const blockedBy = input.blockedBy ?? [];
  if (blockedBy.length > 0) {
    // Check for self-reference first (before checking if task exists)
    if (blockedBy.includes(taskId)) {
      throw new Error(
        `Cannot create task: circular dependency detected. ` +
          `Task "${input.title}" (${taskId}) cannot be blocked by itself.`
      );
    }

    // Validate all blocker tasks exist
    for (const blockerTaskId of blockedBy) {
      const blockerTask = getTask(db, blockerTaskId);
      if (!blockerTask) {
        throw new Error(`Blocker task not found: ${blockerTaskId}`);
      }

      // Check if the blocker task is already completed or archived
      // (If so, it's not actually blocking anything)
      if (blockerTask.status === 'completed' || blockerTask.status === 'archived') {
        throw new Error(
          `Cannot block on task "${blockerTask.title}" (${blockerTaskId}): task is already ${blockerTask.status}. ` +
            `Remove this task from the blockedBy list.`
        );
      }
    }

    // Check for circular dependencies by simulating the addition of this task
    // We need to check if any of the blocker tasks are (transitively) blocked by this task
    // Since the task doesn't exist yet, we check if adding this dependency would create a cycle
    for (const blockerTaskId of blockedBy) {
      // Get the blocker task
      const blockerTask = getTask(db, blockerTaskId)!; // We know it exists from validation above

      // Check if the blocker task has any dependencies
      let blockerDeps: string[] = [];
      try {
        blockerDeps = JSON.parse(blockerTask.blocked_by) as string[];
      } catch {
        blockerDeps = [];
      }

      // If the blocker is blocked by this task (which we're creating), that would be a direct cycle
      if (blockerDeps.includes(taskId)) {
        throw new Error(
          `Cannot create task: circular dependency detected. ` +
            `Task "${input.title}" would be blocked by "${blockerTask.title}" (${blockerTaskId}), ` +
            `but "${blockerTask.title}" is already blocked by task ID "${taskId}".`
        );
      }

      // Check for indirect cycles: if the blocker is blocked by something that's transitively blocked by taskId
      // We use DFS to detect cycles in the would-be dependency graph
      const visited = new Set<string>();

      function hasCycle(currentTaskId: string): boolean {
        // Only flag as cycle if we've found our way back to the NEW task being created
        if (currentTaskId === taskId) {
          // Found a cycle that involves the new task!
          return true;
        }

        if (visited.has(currentTaskId)) {
          // Already explored this path, no cycle involving the new task
          return false;
        }

        visited.add(currentTaskId);

        // Get the task's dependencies
        const currentTask = getTask(db, currentTaskId);
        if (!currentTask) {
          // Task doesn't exist, can't have dependencies
          return false;
        }

        let deps: string[] = [];
        try {
          deps = JSON.parse(currentTask.blocked_by) as string[];
        } catch {
          deps = [];
        }

        // Check each dependency for cycles
        for (const depId of deps) {
          if (hasCycle(depId)) {
            return true;
          }
        }

        return false;
      }

      // Check if this blocker task (or its transitive dependencies) would create a cycle
      if (hasCycle(blockerTaskId)) {
        throw new Error(
          `Cannot create task: circular dependency detected. ` +
            `Creating task "${input.title}" (${taskId}) with blocker "${blockerTask.title}" (${blockerTaskId}) ` +
            `would create a circular dependency chain.`
        );
      }
    }
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
      version,
      last_updated,
      last_executed,
      execution_count
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 0, 0, 0, ?, NULL, ?, ?, ?, 1, ?, NULL, 0)
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

    // Determine initial status and blocked_by based on dependencies (Task 2.3.23)
    const initialStatus = blockedBy.length > 0 ? 'blocked' : 'pending';
    const blockedByJson = JSON.stringify(blockedBy);
    const blockedSince = blockedBy.length > 0 ? now : null;

    // Insert task record
    insertTask.run(
      taskId,
      input.agentId,
      input.title,
      initialStatus,
      priority,
      now,
      input.parentTaskId ?? null,
      depth,
      input.delegatedTo ?? null,
      blockedByJson,
      blockedSince,
      input.taskPath,
      now // last_updated (Task 2.3.8)
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
    const task = getTask(db, taskId);
    if (!task) {
      throw new Error(`Failed to retrieve created task: ${taskId}`);
    }

    // Audit log successful task creation
    auditLog(db, {
      agentId: input.agentId,
      action: AuditAction.TASK_CREATE,
      targetAgentId: input.agentId,
      success: true,
      details: {
        taskId: taskId,
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
        taskId: taskId,
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
  // Also update last_updated timestamp (Task 2.3.8)
  const updateStmt = db.prepare(`
    UPDATE tasks
    SET
      status = ?,
      version = version + 1,
      last_updated = ?,
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
      now, // for last_updated (Task 2.3.8)
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
    const auditAction =
      status === 'completed' ? AuditAction.TASK_COMPLETE : AuditAction.TASK_UPDATE;

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

    // Update parent task progress if this task has a parent and status changed to completed (Task 2.3.14)
    if (status === 'completed' && currentTask.parent_task_id) {
      updateParentTaskProgress(db, currentTask.parent_task_id);
    }

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
 * Update parent task progress recursively (Task 2.3.14)
 *
 * This function walks up the task hierarchy and updates the progress of all parent tasks
 * based on the completion status of their subtasks. It calculates the percentage complete
 * by counting completed subtasks vs total subtasks.
 *
 * **Recursive Behavior**:
 * - Updates the parent task's subtasks_completed count
 * - Recalculates the parent's percent_complete based on subtask completion
 * - If the parent has a parent, recursively updates that parent as well
 * - Continues until reaching a root task (no parent)
 *
 * **Progress Calculation**:
 * - percent_complete = (subtasks_completed / subtasks_total) * 100
 * - Rounded to nearest integer
 * - Only calculated if subtasks_total > 0 (to avoid division by zero)
 *
 * **Concurrency**:
 * - Does NOT use optimistic locking (designed to be eventually consistent)
 * - Multiple children completing simultaneously is acceptable
 * - Progress is recalculated based on current database state
 *
 * @param db - Database instance
 * @param parentTaskId - ID of the parent task to update
 *
 * @example
 * ```typescript
 * // After completing a subtask, update parent progress
 * const completedTask = updateTaskStatus(db, 'task-002', 'completed', version);
 * if (completedTask.parent_task_id) {
 *   updateParentTaskProgress(db, completedTask.parent_task_id);
 * }
 * ```
 */
export function updateParentTaskProgress(db: Database.Database, parentTaskId: string): void {
  // Get the parent task
  const parentTask = getTask(db, parentTaskId);
  if (!parentTask) {
    // Parent task not found - this can happen if the parent was deleted
    // Not an error condition, just return
    return;
  }

  // Count completed subtasks
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM tasks
    WHERE parent_task_id = ? AND status = 'completed'
  `);

  const result = countStmt.get(parentTaskId) as { count: number } | undefined;
  const completedCount = result?.count ?? 0;

  // Calculate new percent_complete
  let percentComplete = 0;
  if (parentTask.subtasks_total > 0) {
    percentComplete = Math.round((completedCount / parentTask.subtasks_total) * 100);
  }

  // Update the parent task
  const now = new Date().toISOString();
  const updateStmt = db.prepare(`
    UPDATE tasks
    SET
      subtasks_completed = ?,
      percent_complete = ?,
      last_updated = ?
    WHERE id = ?
  `);

  updateStmt.run(completedCount, percentComplete, now, parentTaskId);

  // Audit log the parent task progress update
  auditLog(db, {
    agentId: parentTask.agent_id,
    action: AuditAction.TASK_UPDATE,
    targetAgentId: parentTask.agent_id,
    success: true,
    details: {
      taskId: parentTaskId,
      title: parentTask.title,
      action: 'parent_progress_update',
      previousSubtasksCompleted: parentTask.subtasks_completed,
      newSubtasksCompleted: completedCount,
      subtasksTotal: parentTask.subtasks_total,
      previousPercentComplete: parentTask.percent_complete,
      newPercentComplete: percentComplete,
    },
  });

  // Recursively update the grandparent (if exists)
  if (parentTask.parent_task_id) {
    updateParentTaskProgress(db, parentTask.parent_task_id);
  }
}

/**
 * Complete a task (Task 2.3.13)
 *
 * Marks a task as completed with optimistic locking to prevent race conditions (EC-2.4).
 * This is a convenience wrapper around updateTaskStatus() that:
 * - Sets status to 'completed'
 * - Sets completed_at timestamp
 * - Increments version number
 * - Uses optimistic locking to prevent concurrent modifications
 * - Updates parent task progress recursively (Task 2.3.14)
 *
 * @param db - Database instance
 * @param id - Task ID to complete
 * @param version - Current version number (for optimistic locking)
 * @returns Updated task record with status='completed'
 * @throws Error if task not found or version mismatch (concurrent modification)
 *
 * @example
 * ```typescript
 * const task = getTask(db, 'task-001');
 * if (task && task.status !== 'completed') {
 *   try {
 *     const completed = completeTask(db, task.id, task.version);
 *     console.log(`Task completed at: ${completed.completed_at}`);
 *   } catch (error) {
 *     if (error.message.includes('version mismatch')) {
 *       console.log('Concurrent modification detected, retrying...');
 *       // Re-fetch and retry
 *     }
 *   }
 * }
 * ```
 */
export function completeTask(db: Database.Database, id: string, version: number): TaskRecord {
  // First check if task is already archived
  const currentTask = getTask(db, id);
  if (!currentTask) {
    throw new Error(`Task not found: ${id}`);
  }
  if (currentTask.status === 'archived') {
    throw new Error(`Cannot complete archived task: ${id}`);
  }

  const completedTask = updateTaskStatus(db, id, 'completed', version);

  // Update parent task progress recursively (Task 2.3.14)
  if (completedTask.parent_task_id) {
    updateParentTaskProgress(db, completedTask.parent_task_id);
  }

  return completedTask;
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
      version,
      last_updated,
      last_executed,
      execution_count
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
      version,
      last_updated,
      last_executed,
      execution_count
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

  // Get current timestamp for last_updated
  const now = new Date().toISOString();

  // Prepare the UPDATE statement with optimistic locking
  // Only update if the version matches (prevents race conditions)
  // Also update last_updated timestamp (Task 2.3.8)
  const updateStmt = db.prepare(`
    UPDATE tasks
    SET
      percent_complete = ?,
      last_updated = ?,
      version = version + 1
    WHERE id = ? AND version = ?
  `);

  try {
    // Execute the update
    const result = updateStmt.run(clampedProgress, now, id, version);

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

/**
 * Update task metadata (timestamps and execution count)
 *
 * Task 2.3.8: Update task metadata (last update timestamp, execution counts)
 *
 * This function updates metadata tracking fields for a task:
 * - last_updated: Current timestamp when any task field changes
 * - last_executed: Timestamp when an agent executed/attempted the task
 * - execution_count: Incremented each time the task is executed
 *
 * @param db - Database connection
 * @param id - Task ID
 * @param options - Metadata update options
 * @param options.updateExecutionCount - If true, increments execution_count
 * @param options.updateLastExecuted - If true, sets last_executed to now
 * @param options.updateLastUpdated - If true, sets last_updated to now
 * @returns Updated task record
 * @throws Error if task not found
 *
 * @example
 * // Update last_updated when modifying task
 * updateTaskMetadata(db, taskId, { updateLastUpdated: true });
 *
 * @example
 * // Record execution attempt
 * updateTaskMetadata(db, taskId, {
 *   updateExecutionCount: true,
 *   updateLastExecuted: true,
 *   updateLastUpdated: true
 * });
 */
export function updateTaskMetadata(
  db: Database.Database,
  id: string,
  options: {
    updateExecutionCount?: boolean;
    updateLastExecuted?: boolean;
    updateLastUpdated?: boolean;
  }
): TaskRecord {
  // First, verify the task exists
  const currentTask = getTask(db, id);
  if (!currentTask) {
    throw new Error(`Task not found: ${id}`);
  }

  // Build the SET clause dynamically based on options
  const updates: string[] = [];
  const params: any[] = [];

  if (options.updateLastUpdated) {
    updates.push('last_updated = ?');
    params.push(new Date().toISOString());
  }

  if (options.updateLastExecuted) {
    updates.push('last_executed = ?');
    params.push(new Date().toISOString());
  }

  if (options.updateExecutionCount) {
    updates.push('execution_count = execution_count + 1');
  }

  // If no updates requested, return current task
  if (updates.length === 0) {
    return currentTask;
  }

  // Add the task ID to params
  params.push(id);

  // Prepare the UPDATE statement
  const updateStmt = db.prepare(`
    UPDATE tasks
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  try {
    // Execute the update
    const result = updateStmt.run(...params);

    // Check if any rows were updated
    if (result.changes === 0) {
      throw new Error(`Failed to update task metadata for task ${id}`);
    }

    // Retrieve and return the updated task
    const updatedTask = getTask(db, id);
    if (!updatedTask) {
      throw new Error(`Failed to retrieve updated task: ${id}`);
    }

    // Audit log successful metadata update
    auditLog(db, {
      agentId: currentTask.agent_id,
      action: AuditAction.TASK_UPDATE,
      targetAgentId: currentTask.agent_id,
      success: true,
      details: {
        taskId: id,
        title: currentTask.title,
        metadataUpdate: {
          updateLastUpdated: options.updateLastUpdated || false,
          updateLastExecuted: options.updateLastExecuted || false,
          updateExecutionCount: options.updateExecutionCount || false,
          previousExecutionCount: currentTask.execution_count,
          newExecutionCount: updatedTask.execution_count,
        },
      },
    });

    return updatedTask;
  } catch (error) {
    // Audit log failed metadata update
    auditLog(db, {
      agentId: currentTask.agent_id,
      action: AuditAction.TASK_UPDATE,
      targetAgentId: currentTask.agent_id,
      success: false,
      details: {
        taskId: id,
        title: currentTask.title,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

/**
 * Delegate a task to another agent
 *
 * Task 2.3.9: Implement delegateTask(taskId, toAgentId) with validation
 * Task 2.3.10: Verify delegation target exists and is subordinate
 *
 * This function delegates a task to another agent with proper validation:
 * - Verifies the task exists
 * - Verifies the target agent exists
 * - Verifies the target agent is a subordinate of the task owner
 * - Updates the delegated_to and delegated_at fields
 * - Uses optimistic locking if version is provided
 *
 * **Validation Checks**:
 * - Task must exist
 * - Target agent must exist
 * - Target agent must be a subordinate of the task owner (checked via org_hierarchy)
 * - Optional: Can check if task is already delegated to same agent
 *
 * @param db - Database connection
 * @param taskId - Task ID to delegate
 * @param toAgentId - Agent ID to delegate the task to (must be subordinate of task owner)
 * @param version - Optional version number for optimistic locking
 * @returns Updated task record
 * @throws Error if task not found, agent not found, not a subordinate, or version mismatch
 *
 * @example
 * // Simple delegation
 * const delegatedTask = delegateTask(db, 'task-001', 'agent-002');
 *
 * @example
 * // Delegation with optimistic locking
 * const task = getTask(db, 'task-001');
 * if (task) {
 *   const delegatedTask = delegateTask(db, task.id, 'agent-002', task.version);
 * }
 */
export function delegateTask(
  db: Database.Database,
  taskId: string,
  toAgentId: string,
  version?: number
): TaskRecord {
  // Step 1: Verify the task exists
  const currentTask = getTask(db, taskId);
  if (!currentTask) {
    throw new Error(`Task not found: ${taskId}`);
  }

  try {
    // Step 2: Verify the target agent exists
    const targetAgent = getAgent(db, toAgentId);
    if (!targetAgent) {
      throw new Error(`Agent not found: ${toAgentId}`);
    }

    // Step 2b: Verify the target agent is a subordinate of the task owner
    // Task 2.3.10: Verify delegation target exists and is subordinate
    const hierarchyCheck = db
      .prepare(
        `
      SELECT * FROM org_hierarchy
      WHERE agent_id = ? AND ancestor_id = ?
    `
      )
      .get(toAgentId, currentTask.agent_id);

    if (!hierarchyCheck) {
      throw new Error(
        `Cannot delegate task ${taskId} to agent ${toAgentId}: ` +
          `agent ${toAgentId} is not a subordinate of task owner ${currentTask.agent_id}`
      );
    }

    // Step 3: Check if task is already delegated to the same agent (optional optimization)
    if (currentTask.delegated_to === toAgentId) {
      // Task is already delegated to this agent, no need to update
      return currentTask;
    }

    const now = new Date().toISOString();

    // Step 4: Prepare UPDATE statement
    let updateStmt;
    let params: any[];

    if (version !== undefined) {
      // With optimistic locking
      updateStmt = db.prepare(`
        UPDATE tasks
        SET
          delegated_to = ?,
          delegated_at = ?,
          last_updated = ?,
          version = version + 1
        WHERE id = ? AND version = ?
      `);
      params = [toAgentId, now, now, taskId, version];
    } else {
      // Without optimistic locking
      updateStmt = db.prepare(`
        UPDATE tasks
        SET
          delegated_to = ?,
          delegated_at = ?,
          last_updated = ?
        WHERE id = ?
      `);
      params = [toAgentId, now, now, taskId];
    }

    // Execute the update
    const result = updateStmt.run(...params);

    // Check if any rows were updated
    if (result.changes === 0) {
      if (version !== undefined) {
        // Version mismatch - concurrent modification
        throw new Error(
          `Failed to delegate task ${taskId}: version mismatch. ` +
            `Expected version ${version}, but task was modified by another process. ` +
            `Please re-fetch the task and retry the operation.`
        );
      } else {
        // Task not found (shouldn't happen since we checked above)
        throw new Error(`Failed to delegate task ${taskId}: task not found during update`);
      }
    }

    // Retrieve and return the updated task
    const updatedTask = getTask(db, taskId);
    if (!updatedTask) {
      throw new Error(`Failed to retrieve updated task: ${taskId}`);
    }

    // Audit log successful delegation
    auditLog(db, {
      agentId: currentTask.agent_id,
      action: AuditAction.TASK_UPDATE,
      targetAgentId: toAgentId,
      success: true,
      details: {
        taskId: taskId,
        title: currentTask.title,
        action: 'delegate',
        fromAgent: currentTask.agent_id,
        toAgent: toAgentId,
        previousDelegation: currentTask.delegated_to,
        newDelegation: toAgentId,
        ...(version !== undefined && {
          previousVersion: version,
          newVersion: updatedTask.version,
        }),
      },
    });

    return updatedTask;
  } catch (error) {
    // Audit log failed delegation
    // Note: We don't use toAgentId as targetAgentId here because it might not exist
    // (that's often the reason for failure). Instead, we include it in details.
    auditLog(db, {
      agentId: currentTask.agent_id,
      action: AuditAction.TASK_UPDATE,
      targetAgentId: currentTask.agent_id, // Use task owner instead of toAgentId
      success: false,
      details: {
        taskId: taskId,
        title: currentTask.title,
        action: 'delegate',
        toAgent: toAgentId,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}
