/**
 * Task Directory Creation (Task 2.3.3)
 *
 * This module handles the creation of task directory structures
 * with all required files (plan.md, progress.md, subtasks.md, context.json).
 *
 * Each task gets its own directory with:
 * - plan.md: Task plan with YAML frontmatter
 * - progress.md: Current progress tracking
 * - subtasks.md: Subtasks checklist
 * - context.json: Task metadata
 */

import * as path from 'path';
import {
  atomicWrite,
  getTaskPath,
  type TaskRecord,
  type TaskStatus,
} from '@recursive-manager/common';

/**
 * Input for creating a task directory
 */
export interface CreateTaskDirectoryInput {
  /**
   * The agent ID that owns this task
   */
  agentId: string;

  /**
   * The task record from the database
   */
  task: TaskRecord;

  /**
   * Optional task description/plan content
   */
  description?: string;

  /**
   * Optional initial subtasks
   */
  subtasks?: string[];

  /**
   * Optional path options for directory resolution
   */
  options?: import('@recursive-manager/common').PathOptions;
}

/**
 * Context.json schema for task metadata
 */
export interface TaskContext {
  /** Task metadata */
  task: {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    priority: string;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };

  /** Hierarchy information */
  hierarchy: {
    parentTask: string | null;
    childTasks: string[];
    depth: number;
  };

  /** Delegation information */
  delegation: {
    delegatedTo: string | null;
    delegatedAt: string | null;
    supervisionLevel: 'hands-off' | 'check-ins' | 'close-supervision';
  };

  /** Progress tracking */
  progress: {
    percentComplete: number;
    subtasksCompleted: number;
    subtasksTotal: number;
    blockedBy: string[];
    blockedSince: string | null;
  };

  /** Context and dependencies */
  context: {
    relatedFiles: string[];
    dependencies: string[];
    notes: string[];
  };

  /** Execution statistics */
  execution: {
    lastExecutionId: string | null;
    executionCount: number;
    totalTimeSpent: number;
    failureCount: number;
  };
}

/**
 * Generate plan.md content with YAML frontmatter
 */
function generatePlanMd(task: TaskRecord, description?: string): string {
  return `---
id: ${task.id}
title: ${task.title}
status: ${task.status}
priority: ${task.priority}
created: ${task.created_at}
---

# Task: ${task.title}

## Description

${description || 'No description provided yet.'}

## Goals

- [ ] Define task goals
- [ ] Break down into subtasks if needed
- [ ] Identify dependencies
- [ ] Estimate complexity

## Approach

Document the planned approach here.

## Dependencies

- None identified yet

## Notes

Add any additional notes or considerations here.
`;
}

/**
 * Generate progress.md content
 */
function generateProgressMd(task: TaskRecord): string {
  return `# Progress: ${task.title}

## Status

${task.status.toUpperCase()}

## Current Progress

${task.percent_complete}% complete

## Updates

### ${new Date().toISOString().split('T')[0]}

- Task created
- Status: ${task.status}

## Blockers

${task.blocked_by && task.blocked_by !== '[]' ? `- Blocked by: ${JSON.parse(task.blocked_by).join(', ')}` : 'No blockers'}

## Next Steps

- Define next steps after planning phase
`;
}

/**
 * Generate subtasks.md content
 */
function generateSubtasksMd(task: TaskRecord, subtasks?: string[]): string {
  let content = `# Subtasks: ${task.title}

## Task Breakdown

`;

  if (subtasks && subtasks.length > 0) {
    subtasks.forEach((subtask) => {
      content += `- [ ] ${subtask}\n`;
    });
  } else {
    content += `- [ ] Break down this task into concrete subtasks

## Notes

Define specific, actionable subtasks here. Each subtask should be:
- Concrete and measurable
- Small enough to complete in one execution cycle
- Clear about success criteria
`;
  }

  return content;
}

/**
 * Generate context.json content
 */
function generateContextJson(task: TaskRecord, description?: string): TaskContext {
  return {
    task: {
      id: task.id,
      title: task.title,
      description: description || '',
      status: task.status,
      priority: task.priority,
      createdAt: task.created_at,
      startedAt: task.started_at,
      completedAt: task.completed_at,
    },
    hierarchy: {
      parentTask: task.parent_task_id,
      childTasks: [],
      depth: task.depth,
    },
    delegation: {
      delegatedTo: task.delegated_to,
      delegatedAt: task.delegated_at,
      supervisionLevel: 'check-ins',
    },
    progress: {
      percentComplete: task.percent_complete,
      subtasksCompleted: task.subtasks_completed,
      subtasksTotal: task.subtasks_total,
      blockedBy: JSON.parse(task.blocked_by || '[]'),
      blockedSince: task.blocked_since,
    },
    context: {
      relatedFiles: [],
      dependencies: [],
      notes: [],
    },
    execution: {
      lastExecutionId: null,
      executionCount: 0,
      totalTimeSpent: 0,
      failureCount: 0,
    },
  };
}

/**
 * Create task directory structure with all required files
 *
 * This function creates the complete directory structure for a task:
 * ```
 * tasks/active/task-001-example/
 * ├── plan.md
 * ├── progress.md
 * ├── subtasks.md
 * └── context.json
 * ```
 *
 * All files are written atomically to ensure consistency.
 *
 * @param input - Task directory creation input
 * @throws Error if task directory cannot be created
 *
 * @example
 * ```typescript
 * await createTaskDirectory({
 *   agentId: 'ceo-001',
 *   task: taskRecord,
 *   description: 'Build the authentication system',
 *   subtasks: ['Design schema', 'Implement login', 'Add tests']
 * });
 * ```
 */
export async function createTaskDirectory(input: CreateTaskDirectoryInput): Promise<void> {
  const { agentId, task, description, subtasks, options } = input;

  // Get the task directory path based on status
  const taskDir = getTaskPath(agentId, task.id, task.status, options);

  // Generate file contents
  const planMd = generatePlanMd(task, description);
  const progressMd = generateProgressMd(task);
  const subtasksMd = generateSubtasksMd(task, subtasks);
  const contextJson = generateContextJson(task, description);

  // Define file paths
  const planPath = path.join(taskDir, 'plan.md');
  const progressPath = path.join(taskDir, 'progress.md');
  const subtasksPath = path.join(taskDir, 'subtasks.md');
  const contextPath = path.join(taskDir, 'context.json');

  try {
    // Write all files atomically
    // atomicWrite will create directories as needed (createDirs: true by default)
    await Promise.all([
      atomicWrite(planPath, planMd),
      atomicWrite(progressPath, progressMd),
      atomicWrite(subtasksPath, subtasksMd),
      atomicWrite(contextPath, JSON.stringify(contextJson, null, 2)),
    ]);
  } catch (error) {
    throw new Error(
      `Failed to create task directory for ${task.id}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Update task directory when task status changes
 *
 * When a task status changes (e.g., pending -> in-progress -> completed),
 * the entire task directory needs to be moved to the appropriate status folder.
 *
 * @param agentId - Agent ID that owns the task
 * @param taskId - Task ID
 * @param oldStatus - Previous status
 * @param newStatus - New status
 * @param options - Path options for resolving agent directories
 */
export async function moveTaskDirectory(
  agentId: string,
  taskId: string,
  oldStatus: TaskStatus,
  newStatus: TaskStatus,
  options: import('@recursive-manager/common').PathOptions = {}
): Promise<void> {
  // Only move if status actually changed
  if (oldStatus === newStatus) {
    return;
  }

  const fs = await import('fs/promises');

  let oldPath = getTaskPath(agentId, taskId, oldStatus, options);
  const newPath = getTaskPath(agentId, taskId, newStatus, options);

  try {
    // Check if source directory exists at expected location
    const sourceExists = await fs
      .access(oldPath)
      .then(() => true)
      .catch(() => false);

    // If source doesn't exist at expected location, try to find it in other status folders
    if (!sourceExists) {
      const statusesToCheck: TaskStatus[] = ['pending', 'in-progress', 'blocked', 'completed', 'archived'];
      let found = false;

      for (const status of statusesToCheck) {
        if (status === oldStatus) continue; // Already checked
        const altPath = getTaskPath(agentId, taskId, status, options);
        const exists = await fs
          .access(altPath)
          .then(() => true)
          .catch(() => false);

        if (exists) {
          oldPath = altPath;
          found = true;
          break;
        }
      }

      if (!found) {
        // Directory doesn't exist anywhere, create it at the new location
        await fs.mkdir(newPath, { recursive: true });
        return;
      }
    }

    // Ensure parent directory of new path exists
    const newParentPath = path.dirname(newPath);
    await fs.mkdir(newParentPath, { recursive: true });

    // Check if target directory already exists
    const targetExists = await fs
      .access(newPath)
      .then(() => true)
      .catch(() => false);

    if (targetExists) {
      // If target exists, remove it first
      await fs.rm(newPath, { recursive: true, force: true });
    }

    // Move the entire task directory
    await fs.rename(oldPath, newPath);
  } catch (error) {
    throw new Error(
      `Failed to move task directory from ${oldStatus} to ${newStatus}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
