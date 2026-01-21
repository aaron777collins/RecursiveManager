# Task Management

## Overview

RecursiveManager provides a comprehensive task management system that supports hierarchical task delegation, dependency tracking, blocking/unblocking, deadlock detection, and automatic archival. This guide covers everything you need to know about managing tasks in your agent hierarchy.

::: warning ALPHA SOFTWARE
RecursiveManager is currently in alpha development. The task management API is functional but may change in future versions.
:::

## Table of Contents

1. [Task Lifecycle](#task-lifecycle)
2. [Task Data Structure](#task-data-structure)
3. [Creating Tasks](#creating-tasks)
4. [Task Status and Progress](#task-status-and-progress)
5. [Task Blocking and Dependencies](#task-blocking-and-dependencies)
6. [Deadlock Detection](#deadlock-detection)
7. [Task Delegation](#task-delegation)
8. [Task Completion](#task-completion)
9. [Task Archival](#task-archival)
10. [Best Practices](#best-practices)
11. [Common Patterns](#common-patterns)
12. [Troubleshooting](#troubleshooting)

## Task Lifecycle

Tasks in RecursiveManager progress through a well-defined lifecycle with five states:

### Task States

```
pending → in-progress → completed → archived
            ↓
          blocked
```

**State Descriptions:**

- **pending**: Initial state when a task is created
- **in-progress**: Agent is actively working on the task
- **blocked**: Task cannot proceed due to dependencies or agent pause
- **completed**: Task is finished successfully
- **archived**: Completed task moved to long-term storage

### Lifecycle Flow

#### 1. Creation (pending)

```typescript
import { createTask } from '@recursivemanager/common';

const task = await createTask(db, {
  id: 'task-001',
  agent_id: 'agent-ceo',
  title: 'Analyze Q4 revenue trends',
  status: 'pending',
  priority: 'high',
  parent_task_id: null,
  depth: 0,
  blocked_by: [] // No blockers initially
});
```

**What happens:**
- Task created with status `pending`
- Depth validated (must be ≤ `TASK_MAX_DEPTH`)
- Blocking dependencies validated (no circular references)
- Initial workspace directory created
- Audit log entry recorded

#### 2. Execution (in-progress)

```typescript
import { updateTaskStatus } from '@recursivemanager/common';

await updateTaskStatus(db, 'task-001', 'in-progress', 1); // version 1
```

**What happens:**
- Status transitions from `pending` → `in-progress`
- `started_at` timestamp recorded
- `last_updated` timestamp updated
- Version number incremented (optimistic locking)

#### 3. Blocking (blocked)

Tasks can become blocked by:
- **Dependencies**: Other tasks that must complete first
- **Agent pause**: When the owning agent is paused

```typescript
// Task blocked by dependencies
const task = await createTask(db, {
  id: 'task-002',
  agent_id: 'agent-ceo',
  title: 'Generate revenue report',
  blocked_by: ['task-001'] // Must wait for task-001
});

// Status is automatically set to 'blocked'
```

#### 4. Completion (completed)

```typescript
import { completeTaskWithFiles } from '@recursivemanager/core';

await completeTaskWithFiles(db, 'task-001', 'agent-ceo', {
  baseDir: '/path/to/data'
});
```

**What happens:**
- Status set to `completed`
- `completed_at` timestamp recorded
- Task directory moved from `active/` → `completed/`
- Parent task progress updated recursively
- Completion notification sent to manager

#### 5. Archival (archived)

```typescript
import { archiveOldTasks } from '@recursivemanager/core';

const archived = await archiveOldTasks(db, 'agent-ceo', {
  baseDir: '/path/to/data',
  olderThanDays: 7 // Archive tasks completed >7 days ago
});
```

**What happens:**
- Tasks moved from `completed/` → `archive/{YYYY-MM}/`
- Status set to `archived`
- Optionally compressed to `.tar.gz` after 90 days
- Database record updated

## Task Data Structure

### Database Schema

Tasks are stored in the `tasks` table with the following structure:

```sql
CREATE TABLE tasks (
  -- Identity
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',

  -- Timestamps
  created_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Hierarchy
  parent_task_id TEXT REFERENCES tasks(id),
  depth INTEGER NOT NULL DEFAULT 0,

  -- Progress
  percent_complete INTEGER DEFAULT 0,
  subtasks_completed INTEGER DEFAULT 0,
  subtasks_total INTEGER DEFAULT 0,

  -- Delegation
  delegated_to TEXT REFERENCES agents(id),
  delegated_at TIMESTAMP,

  -- Blocking/Dependencies
  blocked_by TEXT,  -- JSON array
  blocked_since TIMESTAMP,

  -- Organization
  task_path TEXT NOT NULL,

  -- Concurrency Control
  version INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  last_updated TIMESTAMP,
  last_executed TIMESTAMP,
  execution_count INTEGER DEFAULT 0
);
```

### TypeScript Interface

```typescript
interface TaskRecord {
  // Identity
  id: string;
  agent_id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'blocked' | 'completed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';

  // Timestamps
  created_at: string;
  started_at: string | null;
  completed_at: string | null;

  // Hierarchy
  parent_task_id: string | null;
  depth: number;

  // Progress
  percent_complete: number;
  subtasks_completed: number;
  subtasks_total: number;

  // Delegation
  delegated_to: string | null;
  delegated_at: string | null;

  // Blocking/Dependencies
  blocked_by: string; // JSON array stored as text
  blocked_since: string | null;

  // Organization
  task_path: string;

  // Concurrency Control
  version: number;

  // Metadata
  last_updated: string | null;
  last_executed: string | null;
  execution_count: number;
}
```

### Indexes

The following indexes optimize task queries:

- `idx_tasks_agent_status` (agent_id, status): Agent's tasks by status
- `idx_tasks_status` (status): All tasks by status
- `idx_tasks_parent` (parent_task_id): Hierarchical queries
- `idx_tasks_delegated` (delegated_to): Delegation queries
- `idx_tasks_last_updated` (last_updated): Recent updates
- `idx_tasks_last_executed` (last_executed): Execution monitoring

## Creating Tasks

### Basic Task Creation

```typescript
import { createTask } from '@recursivemanager/common';

const task = await createTask(db, {
  id: 'task-analytics-001',
  agent_id: 'agent-ceo',
  title: 'Q4 Revenue Analysis',
  status: 'pending',
  priority: 'high',
  parent_task_id: null,
  depth: 0
});

console.log(`Task created: ${task.id}`);
```

### Creating Subtasks

```typescript
// Create parent task first
const parentTask = await createTask(db, {
  id: 'task-parent-001',
  agent_id: 'agent-ceo',
  title: 'Complete Product Launch',
  depth: 0
});

// Create subtask
const subtask = await createTask(db, {
  id: 'task-child-001',
  agent_id: 'agent-ceo',
  title: 'Design marketing materials',
  parent_task_id: 'task-parent-001',
  depth: 1 // Must be parent.depth + 1
});

// Parent automatically updates subtasks_total
const updated = await getTask(db, 'task-parent-001');
console.log(updated.subtasks_total); // 1
```

### Depth Limits

Tasks support nesting up to **depth 5** (enforced by `TASK_MAX_DEPTH` constant):

```typescript
import { TASK_MAX_DEPTH } from '@recursivemanager/common';

// Depth hierarchy:
// Depth 0: Root tasks (no parent)
// Depth 1-4: Nested subtasks
// Depth 5: Maximum nesting level

// This will fail:
try {
  const deepTask = await createTask(db, {
    id: 'task-too-deep',
    agent_id: 'agent-ceo',
    title: 'Too deeply nested',
    parent_task_id: 'task-at-depth-5',
    depth: 6
  });
} catch (error) {
  console.error('Cannot exceed max depth:', TASK_MAX_DEPTH);
}
```

### Creating Tasks with Dependencies

```typescript
// Create blocker tasks first
const task1 = await createTask(db, {
  id: 'task-data-collection',
  agent_id: 'agent-analyst',
  title: 'Collect sales data'
});

const task2 = await createTask(db, {
  id: 'task-data-cleaning',
  agent_id: 'agent-analyst',
  title: 'Clean and validate data'
});

// Create dependent task
const task3 = await createTask(db, {
  id: 'task-analysis',
  agent_id: 'agent-analyst',
  title: 'Perform statistical analysis',
  blocked_by: ['task-data-collection', 'task-data-cleaning']
});

// task3 will start as 'blocked' until both blockers complete
console.log(task3.status); // 'blocked'
```

### Task Workspace

When a task is created, a workspace directory is automatically generated:

```
agents/{agentId}/tasks/active/{taskId}/
├── plan.md          # Task plan with YAML frontmatter
├── progress.md      # Progress updates
├── subtasks.md      # Subtask breakdown
└── context.json     # Task context and metadata
```

**plan.md structure:**

```markdown
---
task_id: task-001
agent_id: agent-ceo
title: Q4 Revenue Analysis
status: pending
created_at: 2026-01-19T14:30:00Z
---

# Task Plan

## Objective
Analyze Q4 revenue trends and identify growth opportunities.

## Approach
1. Collect revenue data from all regions
2. Perform trend analysis
3. Generate insights and recommendations

## Success Criteria
- Complete analysis by end of week
- Identify at least 3 actionable insights
```

## Task Status and Progress

### Updating Task Status

```typescript
import { updateTaskStatus } from '@recursivemanager/common';

// Start working on a task
await updateTaskStatus(db, 'task-001', 'in-progress', currentVersion);

// Complete a task
await updateTaskStatus(db, 'task-001', 'completed', currentVersion);
```

### Optimistic Locking

All status updates use **optimistic locking** to prevent race conditions:

```typescript
const task = await getTask(db, 'task-001');
console.log(task.version); // e.g., 3

try {
  await updateTaskStatus(db, 'task-001', 'in-progress', task.version);
  // Success! Version is now 4
} catch (error) {
  // Version mismatch - someone else modified the task
  console.error('Concurrent modification detected');
  // Re-fetch and retry
  const fresh = await getTask(db, 'task-001');
  await updateTaskStatus(db, 'task-001', 'in-progress', fresh.version);
}
```

### Updating Progress

```typescript
import { updateTaskProgress } from '@recursivemanager/common';

// Manually set progress percentage
await updateTaskProgress(db, 'task-001', {
  percent_complete: 75
});

// Progress is clamped to 0-100
await updateTaskProgress(db, 'task-001', {
  percent_complete: 150 // Will be set to 100
});
```

### Parent Progress Cascade

When a subtask completes, parent progress is automatically updated:

```typescript
// Parent has 3 subtasks
const parent = await getTask(db, 'task-parent');
console.log(parent.subtasks_total); // 3
console.log(parent.subtasks_completed); // 0

// Complete first subtask
await completeTask(db, 'task-child-1', currentVersion);

// Parent automatically updated
const updated = await getTask(db, 'task-parent');
console.log(updated.subtasks_completed); // 1
console.log(updated.percent_complete); // 33 (1/3 * 100)

// Complete remaining subtasks
await completeTask(db, 'task-child-2', currentVersion);
await completeTask(db, 'task-child-3', currentVersion);

// Parent now complete
const final = await getTask(db, 'task-parent');
console.log(final.subtasks_completed); // 3
console.log(final.percent_complete); // 100
```

### Execution Metadata

Tasks track execution attempts:

```typescript
import { updateTaskMetadata } from '@recursivemanager/common';

// Update execution counters
await updateTaskMetadata(db, 'task-001', {
  last_executed: new Date().toISOString(),
  execution_count: task.execution_count + 1
});

// Query stale tasks (not executed recently)
const staleTasks = await getActiveTasks(db, 'agent-ceo');
const stale = staleTasks.filter(t => {
  if (!t.last_executed) return true;
  const hoursSince = (Date.now() - Date.parse(t.last_executed)) / 3600000;
  return hoursSince > 24;
});
```

## Task Blocking and Dependencies

### Creating Blocked Tasks

Tasks can be blocked by other tasks that must complete first:

```typescript
// Task A must complete before Task B
const taskB = await createTask(db, {
  id: 'task-b',
  agent_id: 'agent-001',
  title: 'Task B depends on Task A',
  blocked_by: ['task-a']
});

console.log(taskB.status); // 'blocked'
console.log(taskB.blocked_since); // Timestamp when blocking started
```

### Dependency Validation

RecursiveManager validates dependencies on task creation:

#### Self-Reference Prevention

```typescript
// This will fail:
try {
  await createTask(db, {
    id: 'task-001',
    agent_id: 'agent-001',
    title: 'Cannot block itself',
    blocked_by: ['task-001'] // ERROR: Self-reference
  });
} catch (error) {
  console.error('Task cannot be blocked by itself');
}
```

#### Circular Dependency Detection

```typescript
// Task A blocks Task B
await createTask(db, {
  id: 'task-a',
  agent_id: 'agent-001',
  title: 'Task A',
  blocked_by: ['task-b']
});

// This will fail - creates circular dependency:
try {
  await createTask(db, {
    id: 'task-b',
    agent_id: 'agent-001',
    title: 'Task B',
    blocked_by: ['task-a'] // ERROR: Circular dependency
  });
} catch (error) {
  console.error('Circular dependency detected');
}
```

#### Blocker Existence Validation

```typescript
// This will fail - blocker doesn't exist:
try {
  await createTask(db, {
    id: 'task-001',
    agent_id: 'agent-001',
    title: 'Task with invalid blocker',
    blocked_by: ['non-existent-task'] // ERROR: Task not found
  });
} catch (error) {
  console.error('Blocker task does not exist');
}
```

#### Completed Blocker Validation

```typescript
// Complete a task
await completeTask(db, 'task-a', currentVersion);

// This will fail - cannot block on completed task:
try {
  await createTask(db, {
    id: 'task-b',
    agent_id: 'agent-001',
    title: 'Task blocked by completed task',
    blocked_by: ['task-a'] // ERROR: Already completed
  });
} catch (error) {
  console.error('Cannot block on completed or archived task');
}
```

### Agent Pause Blocking

When an agent is paused, all its tasks are automatically blocked:

```typescript
import { pauseAgent } from '@recursivemanager/core';

// Pause the agent
await pauseAgent(db, 'agent-001', 'Taking a break', {
  baseDir: '/path/to/data'
});

// All agent's tasks are now blocked with special PAUSE_BLOCKER
const tasks = await getActiveTasks(db, 'agent-001');
tasks.forEach(task => {
  console.log(task.status); // 'blocked'
  const blockers = JSON.parse(task.blocked_by);
  console.log(blockers.includes('PAUSE_BLOCKER')); // true
});
```

### Resuming from Pause

When an agent resumes, pause blocking is removed:

```typescript
import { resumeAgent } from '@recursivemanager/core';

// Resume the agent
await resumeAgent(db, 'agent-001', {
  baseDir: '/path/to/data'
});

// PAUSE_BLOCKER removed from all tasks
const tasks = await getActiveTasks(db, 'agent-001');
tasks.forEach(task => {
  const blockers = JSON.parse(task.blocked_by);
  console.log(blockers.includes('PAUSE_BLOCKER')); // false

  // If no other blockers, task returns to 'pending'
  if (blockers.length === 0) {
    console.log(task.status); // 'pending'
  } else {
    console.log(task.status); // 'blocked' (other dependencies remain)
  }
});
```

### Querying Blocked Tasks

```typescript
import { getBlockedTasks } from '@recursivemanager/common';

// Get all blocked tasks for an agent
const blocked = await getBlockedTasks(db, 'agent-001');

blocked.forEach(task => {
  console.log(`Task: ${task.title}`);
  console.log(`Blocked by: ${JSON.parse(task.blocked_by).join(', ')}`);
  console.log(`Since: ${task.blocked_since}`);
});
```

## Deadlock Detection

### What is a Deadlock?

A deadlock occurs when tasks form a circular dependency chain where no task can proceed:

```
Task A (blocked_by: ["task-b"])
  └─> Task B (blocked_by: ["task-c"])
        └─> Task C (blocked_by: ["task-a"])  // Cycle!
```

### Manual Deadlock Detection

```typescript
import { detectTaskDeadlock } from '@recursivemanager/common';

// Check if a task is part of a deadlock
const cycle = await detectTaskDeadlock(db, 'task-a');

if (cycle) {
  console.error('Deadlock detected!');
  console.error('Cycle:', cycle.join(' → '));
  // Example output: ['task-a', 'task-b', 'task-c', 'task-a']
} else {
  console.log('No deadlock found');
}
```

### Automatic Deadlock Monitoring

```typescript
import { monitorDeadlocks } from '@recursivemanager/core';

// Run deadlock detection on all blocked tasks
const result = await monitorDeadlocks(db, {
  baseDir: '/path/to/data'
});

console.log(`Scanned: ${result.scannedTasks} tasks`);
console.log(`Deadlocks: ${result.cyclesDetected}`);
console.log(`Notifications: ${result.notificationsSent}`);
```

**What happens:**
1. Queries all tasks with status `blocked`
2. Runs DFS deadlock detection on each task
3. Deduplicates cycles using canonical form
4. Sends urgent notifications to all involved agents
5. Returns statistics on detected deadlocks

### Deadlock Notifications

When a deadlock is detected, all involved agents receive urgent notifications:

```typescript
// Notification structure
{
  from_agent_id: 'SYSTEM',
  to_agent_id: 'agent-001',
  subject: 'DEADLOCK DETECTED',
  body: `Task deadlock detected involving your tasks:

Deadlock Chain:
task-a (Your task) →
task-b (agent-002) →
task-c (agent-003) →
task-a (Cycle!)

Resolution Options:
1. Remove a blocking dependency
2. Reorder task execution
3. Escalate to your manager for manual resolution

Please address this immediately to unblock the workflow.`,
  priority: 'urgent',
  action_required: true
}
```

### Deadlock Resolution Strategies

**1. Remove a dependency:**

```typescript
// Break the cycle by removing one blocking relationship
const taskB = await getTask(db, 'task-b');
const blockers = JSON.parse(taskB.blocked_by);

// Remove task-c from blockers
const newBlockers = blockers.filter(id => id !== 'task-c');

// Update task (implementation depends on your update logic)
await db.prepare(`
  UPDATE tasks
  SET blocked_by = ?,
      status = CASE WHEN ? = '[]' THEN 'pending' ELSE 'blocked' END,
      version = version + 1
  WHERE id = ?
`).run(JSON.stringify(newBlockers), JSON.stringify(newBlockers), 'task-b');
```

**2. Reorder execution:**

Complete one task manually to break the cycle:

```typescript
// Mark one task as completed to break the cycle
await completeTask(db, 'task-a', currentVersion);

// Now task-b can proceed
const taskB = await getTask(db, 'task-b');
console.log(taskB.status); // 'pending' (unblocked)
```

**3. Escalate to manager:**

Send a message to the manager agent to handle the deadlock:

```typescript
import { createMessage } from '@recursivemanager/common';

await createMessage(db, {
  from_agent_id: 'agent-001',
  to_agent_id: 'agent-manager',
  subject: 'Deadlock Resolution Needed',
  body: 'Tasks A, B, C are in deadlock. Manual intervention required.',
  priority: 'urgent'
});
```

### DFS Algorithm

The deadlock detection algorithm uses **Depth-First Search (DFS)** with cycle detection:

```typescript
// Simplified algorithm
function detectCycle(taskId: string, visited: Set<string>, path: string[]): string[] | null {
  // Add to current path
  path.push(taskId);

  // If we've seen this task in current path, we found a cycle
  if (visited.has(taskId)) {
    return path.slice(path.indexOf(taskId)); // Return cycle
  }

  visited.add(taskId);

  // Get task's blockers
  const task = getTask(taskId);
  const blockers = JSON.parse(task.blocked_by);

  // Recursively check each blocker
  for (const blockerId of blockers) {
    const cycle = detectCycle(blockerId, visited, [...path]);
    if (cycle) return cycle;
  }

  return null; // No cycle found
}
```

## Task Delegation

### Delegating to Subordinates

Tasks can be delegated from a manager to subordinate agents:

```typescript
import { delegateTask } from '@recursivemanager/common';

// Delegate task to a subordinate
await delegateTask(db, 'task-001', 'subordinate-agent-id');

const task = await getTask(db, 'task-001');
console.log(task.delegated_to); // 'subordinate-agent-id'
console.log(task.delegated_at); // Timestamp
```

### Delegation Validation

Delegation is validated against the organizational hierarchy:

```typescript
// This will fail if target is not a subordinate:
try {
  await delegateTask(db, 'task-001', 'non-subordinate-agent');
} catch (error) {
  console.error('Can only delegate to subordinates');
}
```

### Delegation Notifications

When a task is delegated, the subordinate receives a notification:

```typescript
import { notifyTaskDelegation } from '@recursivemanager/core';

// Send delegation notification
await notifyTaskDelegation(db, 'task-001', 'subordinate-agent-id', {
  baseDir: '/path/to/data'
});

// Notification includes:
// - Task details (title, priority, deadline)
// - Manager's context and expectations
// - Link to task workspace
```

### Example: Complete Delegation Flow

```typescript
import {
  delegateTask,
  notifyTaskDelegation
} from '@recursivemanager/core';

// Manager creates task
const task = await createTask(db, {
  id: 'task-marketing-campaign',
  agent_id: 'agent-manager',
  title: 'Design Q2 marketing campaign',
  priority: 'high'
});

// Manager delegates to Marketing agent
await delegateTask(db, 'task-marketing-campaign', 'agent-marketing');

// Send notification
await notifyTaskDelegation(
  db,
  'task-marketing-campaign',
  'agent-marketing',
  { baseDir: '/path/to/data' }
);

console.log('Task delegated successfully');
```

## Task Completion

### Basic Completion

```typescript
import { completeTask } from '@recursivemanager/common';

const task = await getTask(db, 'task-001');
await completeTask(db, 'task-001', task.version);

const completed = await getTask(db, 'task-001');
console.log(completed.status); // 'completed'
console.log(completed.completed_at); // Timestamp
```

### Completion with Files

```typescript
import { completeTaskWithFiles } from '@recursivemanager/core';

// Complete task and move workspace files
await completeTaskWithFiles(db, 'task-001', 'agent-ceo', {
  baseDir: '/path/to/data'
});

// Task directory moved:
// FROM: agents/agent-ceo/tasks/active/task-001/
// TO:   agents/agent-ceo/tasks/completed/task-001/
```

### Completion Notifications

```typescript
import { notifyTaskCompletion } from '@recursivemanager/core';

// Notify manager that task is complete
await notifyTaskCompletion(db, 'task-001', 'agent-ceo', {
  baseDir: '/path/to/data'
});

// Manager receives notification with:
// - Task details
// - Completion summary
// - Link to completed workspace
```

### Parent Task Updates

When a subtask completes, the parent is automatically updated:

```typescript
// Parent has 3 subtasks
const parent = await getTask(db, 'task-parent');
console.log(parent.subtasks_total); // 3
console.log(parent.subtasks_completed); // 1 (one already done)

// Complete another subtask
await completeTask(db, 'task-child-2', currentVersion);

// Parent progress cascades up
const updated = await getTask(db, 'task-parent');
console.log(updated.subtasks_completed); // 2
console.log(updated.percent_complete); // 67 (2/3 * 100)
```

### Example: Complete Task Workflow

```typescript
import {
  getTask,
  completeTaskWithFiles,
  notifyTaskCompletion
} from '@recursivemanager/core';

// Load task
const task = await getTask(db, 'task-001');

// Perform work...
console.log(`Working on: ${task.title}`);

// Complete task (moves files, updates DB)
await completeTaskWithFiles(db, task.id, task.agent_id, {
  baseDir: '/path/to/data'
});

// Notify manager
if (task.delegated_to === task.agent_id) {
  // This task was delegated to us, notify the delegating manager
  await notifyTaskCompletion(db, task.id, task.agent_id, {
    baseDir: '/path/to/data'
  });
}

console.log('Task completed successfully');
```

## Task Archival

### Automatic Archival

Completed tasks are automatically archived after a retention period:

```typescript
import { archiveOldTasks } from '@recursivemanager/core';

// Archive tasks completed more than 7 days ago
const result = await archiveOldTasks(db, 'agent-ceo', {
  baseDir: '/path/to/data',
  olderThanDays: 7
});

console.log(`Archived: ${result.archivedCount} tasks`);
console.log(`Failed: ${result.failedCount} tasks`);
```

### Archive Structure

Archived tasks are organized by year-month:

```
agents/agent-ceo/tasks/archive/
├── 2026-01/
│   ├── task-001/
│   │   ├── plan.md
│   │   ├── progress.md
│   │   └── context.json
│   └── task-002/
│       └── ...
└── 2025-12/
    └── task-003/
        └── ...
```

### Archive Compression

Old archives can be compressed to save disk space:

```typescript
import { compressOldArchives } from '@recursivemanager/core';

// Compress archives older than 90 days
const result = await compressOldArchives(db, 'agent-ceo', {
  baseDir: '/path/to/data',
  olderThanDays: 90
});

console.log(`Compressed: ${result.compressedCount} archives`);

// Result structure:
// agents/agent-ceo/tasks/archive/2025-10/task-001.tar.gz
```

### Querying Archived Tasks

```typescript
import { getCompletedTasks } from '@recursivemanager/core';

// Get all completed tasks for an agent (including archived)
const completed = await getCompletedTasks(db, 'agent-ceo', {
  includeArchived: true
});

console.log(`Total completed tasks: ${completed.length}`);

completed.forEach(task => {
  console.log(`${task.id}: ${task.title}`);
  console.log(`  Status: ${task.status}`);
  console.log(`  Completed: ${task.completed_at}`);
});
```

### Example: Maintenance Script

```typescript
import {
  archiveOldTasks,
  compressOldArchives
} from '@recursivemanager/core';

async function performMaintenance(db: Database, agentId: string) {
  const baseDir = '/path/to/data';

  // Archive completed tasks older than 7 days
  console.log('Archiving old tasks...');
  const archived = await archiveOldTasks(db, agentId, {
    baseDir,
    olderThanDays: 7
  });
  console.log(`Archived ${archived.archivedCount} tasks`);

  // Compress archives older than 90 days
  console.log('Compressing old archives...');
  const compressed = await compressOldArchives(db, agentId, {
    baseDir,
    olderThanDays: 90
  });
  console.log(`Compressed ${compressed.compressedCount} archives`);

  console.log('Maintenance complete');
}

// Run maintenance weekly
setInterval(() => {
  performMaintenance(db, 'agent-ceo').catch(console.error);
}, 7 * 24 * 60 * 60 * 1000); // 7 days
```

## Best Practices

### 1. Keep Task Hierarchies Shallow

**Recommended depth: 0-3 levels**

```typescript
// Good: Shallow hierarchy
- Root Task (depth 0)
  └─ Subtask A (depth 1)
  └─ Subtask B (depth 1)

// Avoid: Deep nesting
- Root Task (depth 0)
  └─ Level 1 (depth 1)
    └─ Level 2 (depth 2)
      └─ Level 3 (depth 3)
        └─ Level 4 (depth 4)
          └─ Level 5 (depth 5) ❌ Max depth reached
```

### 2. Use Clear Task Titles

```typescript
// Good: Clear and specific
await createTask(db, {
  title: 'Analyze Q4 2025 revenue trends by region'
});

// Avoid: Vague titles
await createTask(db, {
  title: 'Do analysis' // Too vague
});
```

### 3. Set Appropriate Priorities

```typescript
// Use priority levels consistently
const priorities = {
  urgent: 'Critical business issues, outages',
  high: 'Important features, blocking issues',
  medium: 'Regular tasks, enhancements',
  low: 'Nice-to-haves, technical debt'
};

await createTask(db, {
  title: 'Fix production outage',
  priority: 'urgent' // Appropriate for critical issue
});
```

### 4. Minimize Dependencies

```typescript
// Good: Minimal necessary dependencies
await createTask(db, {
  id: 'task-report',
  title: 'Generate report',
  blocked_by: ['task-data-collection'] // Only essential blocker
});

// Avoid: Over-constraining
await createTask(db, {
  id: 'task-report',
  title: 'Generate report',
  blocked_by: [
    'task-data-collection',
    'task-approval',
    'task-review',
    'task-formatting',
    'task-setup'
  ] // Too many blockers, creates tight coupling
});
```

### 5. Monitor for Deadlocks

```typescript
// Run periodic deadlock monitoring
import { monitorDeadlocks } from '@recursivemanager/core';

// Check for deadlocks hourly
setInterval(async () => {
  const result = await monitorDeadlocks(db, {
    baseDir: '/path/to/data'
  });

  if (result.cyclesDetected > 0) {
    console.error(`Deadlocks detected: ${result.cyclesDetected}`);
    // Alert operations team
  }
}, 60 * 60 * 1000); // 1 hour
```

### 6. Use Progress Updates

```typescript
import { updateTaskProgress } from '@recursivemanager/common';

// Update progress as work proceeds
async function performWork(taskId: string) {
  await updateTaskProgress(db, taskId, { percent_complete: 25 });
  // ... do first quarter of work ...

  await updateTaskProgress(db, taskId, { percent_complete: 50 });
  // ... do second quarter of work ...

  await updateTaskProgress(db, taskId, { percent_complete: 75 });
  // ... do third quarter of work ...

  await completeTask(db, taskId, currentVersion);
}
```

### 7. Clean Up Completed Tasks

```typescript
// Archive completed tasks regularly
import { archiveOldTasks } from '@recursivemanager/core';

// Daily cleanup job
async function dailyCleanup() {
  const agents = await getAllAgents(db);

  for (const agent of agents) {
    await archiveOldTasks(db, agent.id, {
      baseDir: '/path/to/data',
      olderThanDays: 7
    });
  }
}

// Run at midnight
schedule('0 0 * * *', dailyCleanup);
```

### 8. Handle Optimistic Locking

```typescript
// Always handle version conflicts
async function updateTaskWithRetry(
  taskId: string,
  status: string,
  maxRetries: number = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    const task = await getTask(db, taskId);

    try {
      await updateTaskStatus(db, taskId, status, task.version);
      return; // Success
    } catch (error) {
      if (error.message.includes('version') && i < maxRetries - 1) {
        console.log(`Retry ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
}
```

## Common Patterns

### Pattern 1: Task Pipeline

Create a linear sequence of dependent tasks:

```typescript
async function createTaskPipeline(agentId: string, tasks: string[]) {
  const taskIds: string[] = [];

  for (let i = 0; i < tasks.length; i++) {
    const taskId = `pipeline-${i}`;
    const previousTask = i > 0 ? [taskIds[i - 1]] : [];

    await createTask(db, {
      id: taskId,
      agent_id: agentId,
      title: tasks[i],
      blocked_by: previousTask
    });

    taskIds.push(taskId);
  }

  return taskIds;
}

// Usage
await createTaskPipeline('agent-001', [
  'Collect data',
  'Clean data',
  'Analyze data',
  'Generate report'
]);
```

### Pattern 2: Parallel Tasks with Convergence

Create tasks that run in parallel, then converge to a final task:

```typescript
async function createParallelWithMerge(
  agentId: string,
  parallelTasks: string[],
  mergeTask: string
) {
  const parallelIds: string[] = [];

  // Create parallel tasks
  for (let i = 0; i < parallelTasks.length; i++) {
    const taskId = `parallel-${i}`;
    await createTask(db, {
      id: taskId,
      agent_id: agentId,
      title: parallelTasks[i],
      blocked_by: [] // No dependencies
    });
    parallelIds.push(taskId);
  }

  // Create merge task that depends on all parallel tasks
  await createTask(db, {
    id: 'merge-task',
    agent_id: agentId,
    title: mergeTask,
    blocked_by: parallelIds // Wait for all parallel tasks
  });

  return parallelIds;
}

// Usage
await createParallelWithMerge('agent-001', [
  'Research competitor A',
  'Research competitor B',
  'Research competitor C'
], 'Synthesize competitive analysis');
```

### Pattern 3: Hierarchical Task Breakdown

Break down a complex task into a hierarchy:

```typescript
async function createHierarchicalTask(
  agentId: string,
  rootTitle: string,
  subtasks: { title: string; children?: string[] }[]
) {
  // Create root task
  const rootTask = await createTask(db, {
    id: 'root',
    agent_id: agentId,
    title: rootTitle,
    depth: 0
  });

  // Create level 1 subtasks
  for (let i = 0; i < subtasks.length; i++) {
    const l1TaskId = `l1-${i}`;
    await createTask(db, {
      id: l1TaskId,
      agent_id: agentId,
      title: subtasks[i].title,
      parent_task_id: 'root',
      depth: 1
    });

    // Create level 2 subtasks if provided
    if (subtasks[i].children) {
      for (let j = 0; j < subtasks[i].children!.length; j++) {
        await createTask(db, {
          id: `l2-${i}-${j}`,
          agent_id: agentId,
          title: subtasks[i].children![j],
          parent_task_id: l1TaskId,
          depth: 2
        });
      }
    }
  }

  return rootTask;
}

// Usage
await createHierarchicalTask('agent-001', 'Launch Product', [
  {
    title: 'Development',
    children: ['Design UI', 'Implement backend', 'Write tests']
  },
  {
    title: 'Marketing',
    children: ['Create landing page', 'Design campaign', 'Schedule posts']
  },
  {
    title: 'Operations',
    children: ['Set up infrastructure', 'Configure monitoring']
  }
]);
```

### Pattern 4: Task with Auto-Retry

Automatically retry failed tasks:

```typescript
async function createTaskWithRetry(
  taskId: string,
  agentId: string,
  title: string,
  maxRetries: number = 3
) {
  const task = await createTask(db, {
    id: taskId,
    agent_id: agentId,
    title
  });

  // Store retry count in context
  const contextPath = path.join(
    '/path/to/data',
    'agents',
    agentId,
    'tasks',
    'active',
    taskId,
    'context.json'
  );

  await fs.writeFile(contextPath, JSON.stringify({
    retries: 0,
    maxRetries
  }));

  return task;
}

async function executeWithRetry(taskId: string, agentId: string) {
  const contextPath = path.join(
    '/path/to/data',
    'agents',
    agentId,
    'tasks',
    'active',
    taskId,
    'context.json'
  );

  const context = JSON.parse(await fs.readFile(contextPath, 'utf-8'));

  try {
    // Attempt work
    await performWork(taskId);
    await completeTask(db, taskId, (await getTask(db, taskId)).version);
  } catch (error) {
    if (context.retries < context.maxRetries) {
      context.retries++;
      await fs.writeFile(contextPath, JSON.stringify(context));

      // Schedule retry
      setTimeout(() => executeWithRetry(taskId, agentId), 5000);
    } else {
      console.error(`Task ${taskId} failed after ${context.maxRetries} retries`);
      // Escalate to manager
    }
  }
}
```

## Troubleshooting

### Issue: Task Stuck in "blocked" Status

**Symptoms:**
- Task remains blocked even though blockers are complete
- Task doesn't transition to pending

**Diagnosis:**

```typescript
const task = await getTask(db, 'stuck-task');
console.log('Status:', task.status);
console.log('Blocked by:', JSON.parse(task.blocked_by));

// Check if blockers are complete
const blockers = JSON.parse(task.blocked_by);
for (const blockerId of blockers) {
  const blocker = await getTask(db, blockerId);
  console.log(`${blockerId}: ${blocker.status}`);
}
```

**Solutions:**

1. **Remove completed blockers:**

```typescript
const blockers = JSON.parse(task.blocked_by);
const remaining = [];

for (const blockerId of blockers) {
  const blocker = await getTask(db, blockerId);
  if (blocker.status !== 'completed' && blocker.status !== 'archived') {
    remaining.push(blockerId);
  }
}

// Update task with only remaining blockers
if (remaining.length === 0) {
  await updateTaskStatus(db, 'stuck-task', 'pending', task.version);
} else {
  // Update blocked_by field (custom query)
  await db.prepare(`
    UPDATE tasks
    SET blocked_by = ?, version = version + 1
    WHERE id = ?
  `).run(JSON.stringify(remaining), 'stuck-task');
}
```

2. **Check for PAUSE_BLOCKER:**

```typescript
const blockers = JSON.parse(task.blocked_by);
if (blockers.includes('PAUSE_BLOCKER')) {
  console.log('Agent is paused. Resume agent to unblock task.');
  await resumeAgent(db, task.agent_id, { baseDir: '/path/to/data' });
}
```

### Issue: Deadlock Not Detected

**Symptoms:**
- Tasks are clearly in a cycle
- `detectTaskDeadlock()` returns null

**Diagnosis:**

```typescript
// Manually trace the dependency chain
async function traceDependencies(taskId: string, visited = new Set()) {
  if (visited.has(taskId)) {
    console.log('CYCLE DETECTED:', Array.from(visited), '->', taskId);
    return;
  }

  visited.add(taskId);
  const task = await getTask(db, taskId);
  const blockers = JSON.parse(task.blocked_by);

  console.log(`${taskId} blocked by:`, blockers);

  for (const blockerId of blockers) {
    await traceDependencies(blockerId, new Set(visited));
  }
}

await traceDependencies('task-a');
```

**Solutions:**

1. **Check blocker status:**

Deadlock detection skips completed/archived tasks. Ensure blockers are active:

```typescript
const task = await getTask(db, 'task-a');
const blockers = JSON.parse(task.blocked_by);

for (const blockerId of blockers) {
  const blocker = await getTask(db, blockerId);
  if (blocker.status === 'completed') {
    console.log(`Blocker ${blockerId} is complete - not a deadlock`);
  }
}
```

2. **Run monitoring:**

```typescript
import { monitorDeadlocks } from '@recursivemanager/core';

const result = await monitorDeadlocks(db, {
  baseDir: '/path/to/data'
});

console.log('Cycles detected:', result.cyclesDetected);
```

### Issue: Parent Progress Not Updating

**Symptoms:**
- Subtasks complete but parent shows 0% progress
- `subtasks_completed` doesn't increment

**Diagnosis:**

```typescript
const parent = await getTask(db, 'parent-task');
console.log('Subtasks total:', parent.subtasks_total);
console.log('Subtasks completed:', parent.subtasks_completed);
console.log('Progress:', parent.percent_complete);

// Check subtasks
const subtasks = await db.prepare(`
  SELECT id, title, status
  FROM tasks
  WHERE parent_task_id = ?
`).all('parent-task');

console.log('Actual subtasks:', subtasks);
```

**Solutions:**

1. **Manually trigger update:**

```typescript
import { updateParentTaskProgress } from '@recursivemanager/common';

// Force parent progress recalculation
await updateParentTaskProgress(db, 'child-task-id');

// Verify update
const parent = await getTask(db, 'parent-task');
console.log('Updated progress:', parent.percent_complete);
```

2. **Check subtask creation:**

Ensure subtasks were created with correct `parent_task_id`:

```typescript
// Wrong - parent won't track this
await createTask(db, {
  id: 'child-1',
  agent_id: 'agent-001',
  title: 'Subtask',
  depth: 1
  // Missing parent_task_id!
});

// Correct
await createTask(db, {
  id: 'child-1',
  agent_id: 'agent-001',
  title: 'Subtask',
  parent_task_id: 'parent-task', // ✓
  depth: 1
});
```

### Issue: Version Mismatch Errors

**Symptoms:**
- Concurrent modification errors
- Updates fail with version mismatch

**Solutions:**

1. **Implement retry logic:**

```typescript
async function updateWithRetry(taskId, newStatus, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const task = await getTask(db, taskId);

    try {
      await updateTaskStatus(db, taskId, newStatus, task.version);
      return; // Success
    } catch (error) {
      if (error.message.includes('version') && attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      throw error;
    }
  }
}
```

2. **Use database transactions:**

```typescript
const updateTask = db.transaction((taskId, newStatus) => {
  const task = db.prepare('SELECT version FROM tasks WHERE id = ?').get(taskId);

  db.prepare(`
    UPDATE tasks
    SET status = ?, version = version + 1, last_updated = ?
    WHERE id = ? AND version = ?
  `).run(newStatus, new Date().toISOString(), taskId, task.version);
});

// Atomic update
updateTask('task-001', 'completed');
```

### Issue: Task Files Not Found

**Symptoms:**
- Task exists in database but files missing
- `completeTaskWithFiles()` fails

**Diagnosis:**

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';

const task = await getTask(db, 'task-001');
const taskDir = path.join(
  '/path/to/data',
  'agents',
  task.agent_id,
  'tasks',
  'active',
  task.id
);

try {
  const files = await fs.readdir(taskDir);
  console.log('Files found:', files);
} catch (error) {
  console.error('Task directory missing:', taskDir);
}
```

**Solutions:**

1. **Recreate task directory:**

```typescript
import { createTaskDirectory } from '@recursivemanager/core';

// Recreate missing workspace
await createTaskDirectory('task-001', 'agent-001', {
  baseDir: '/path/to/data'
});

console.log('Task directory recreated');
```

2. **Complete task without files:**

```typescript
// Skip file operations if directory is missing
await completeTask(db, 'task-001', task.version);

console.log('Task completed (files skipped)');
```

## Related Documentation

- [Core Concepts](./core-concepts.md) - Understanding tasks in the agent system
- [Creating Agents](./creating-agents.md) - Agent creation and hierarchy
- [Messaging](./messaging.md) - Inter-agent communication for task delegation
- [Scheduling](./scheduling.md) - Time-based task execution
- [Multi-Perspective Analysis](./multi-perspective.md) - Using perspectives in task execution
- [Best Practices](./best-practices.md) - Task management strategies
- [CLI Commands](../api/cli-commands.md) - `ralph status` for task monitoring
- [API Reference: Core](../api/core.md) - Complete task API documentation
