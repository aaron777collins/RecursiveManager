# Task Management

RecursiveManager provides a comprehensive task management system for organizing agent work.

## Task Lifecycle

Tasks flow through the following states:

1. **Created** - Task is created and queued
2. **Assigned** - Task is assigned to an agent
3. **In Progress** - Agent is actively working on the task
4. **Completed** - Task is successfully finished
5. **Failed** - Task failed and may need retry
6. **Cancelled** - Task was cancelled before completion

## Task Structure

Each task contains:

```typescript
interface Task {
  id: string;                    // Unique identifier
  agentId: string;              // Assigned agent
  description: string;          // What needs to be done
  status: TaskStatus;           // Current state
  priority: number;             // 1 (highest) to 10 (lowest)
  dependencies: string[];       // Task IDs that must complete first
  createdAt: Date;              // Creation timestamp
  startedAt?: Date;             // When work began
  completedAt?: Date;           // When finished
  result?: any;                 // Task output
  error?: string;               // Error message if failed
  metadata: Record<string, any>; // Additional data
}
```

## Task Priority

Tasks are prioritized on a scale of 1-10:

- **1-3**: Critical (blocking, urgent)
- **4-6**: High (important, timely)
- **7-9**: Normal (routine work)
- **10**: Low (nice-to-have, backlog)

The task scheduler uses priority to determine execution order.

## Task Dependencies

Tasks can depend on other tasks:

```typescript
const taskB = {
  id: 'task-b',
  description: 'Deploy to production',
  dependencies: ['task-a'] // Must wait for task-a
};
```

RecursiveManager automatically:
- Detects dependency cycles
- Waits for dependencies to complete
- Fails tasks if dependencies fail

## Task Assignment

Tasks are assigned to agents based on:

1. **Agent Role**: Match task to agent specialty
2. **Agent Load**: Distribute work evenly
3. **Agent Performance**: Prefer faster agents
4. **Task Priority**: Urgent tasks get priority

## Task Queuing

RecursiveManager maintains multiple task queues:

- **High Priority Queue**: Critical tasks
- **Normal Queue**: Regular work
- **Low Priority Queue**: Background tasks
- **Retry Queue**: Failed tasks awaiting retry

## Task Scheduling

The scheduler determines task execution order:

```typescript
scheduler
  .prioritize(task => task.priority)
  .then(task => task.dependencies.length === 0)
  .then(task => task.createdAt);
```

## Task Delegation

Managers can delegate tasks to subordinates:

```typescript
// Manager breaks down task
const subtasks = manager.breakdown(parentTask);

// Delegate to workers
for (const subtask of subtasks) {
  await manager.delegate(subtask, worker);
}

// Wait for completion
const results = await manager.waitForSubtasks(subtasks);

// Synthesize results
const finalResult = manager.synthesize(results);
```

## Task Retry

Failed tasks can be automatically retried:

```typescript
const retryPolicy = {
  maxRetries: 3,
  backoff: 'exponential', // 1s, 2s, 4s
  retryOn: ['timeout', 'network-error']
};
```

## Task Monitoring

Monitor tasks in real-time:

```bash
# View all tasks
recursivemanager tasks

# View tasks for specific agent
recursivemanager tasks --agent-id agent-123

# View tasks by status
recursivemanager tasks --status in-progress

# View high-priority tasks
recursivemanager tasks --priority 1-3
```

## Task Metrics

Track task performance:

- **Completion Time**: How long tasks take
- **Success Rate**: Percentage of successful tasks
- **Retry Rate**: How often tasks need retry
- **Queue Time**: Time waiting before execution

## Task Cancellation

Cancel tasks that are no longer needed:

```bash
# Cancel specific task
recursivemanager cancel-task task-123

# Cancel all tasks for agent
recursivemanager cancel-task --agent-id agent-123
```

## Task Results

Task results are stored and can be retrieved:

```typescript
const result = await manager.getTaskResult('task-123');
console.log(result.data);
console.log(result.duration);
console.log(result.metrics);
```

## Best Practices

### Priority Assignment
- Reserve priority 1-2 for truly critical tasks
- Use priority 5 for most tasks
- Set low priority for maintenance tasks

### Task Decomposition
- Break large tasks into smaller subtasks
- Keep tasks focused on single responsibility
- Aim for tasks that complete in minutes, not hours

### Dependency Management
- Minimize dependencies when possible
- Use explicit dependencies over implicit timing
- Check for circular dependencies

### Error Handling
- Set appropriate retry policies
- Log failures for debugging
- Implement graceful degradation

## Examples

### Simple Task

```typescript
const task = {
  id: 'task-1',
  description: 'Fetch product data from API',
  priority: 5,
  agentId: 'worker-1'
};

await manager.createTask(task);
```

### Task with Dependencies

```typescript
const tasks = [
  {
    id: 'fetch',
    description: 'Fetch data',
    priority: 5
  },
  {
    id: 'parse',
    description: 'Parse data',
    priority: 5,
    dependencies: ['fetch']
  },
  {
    id: 'store',
    description: 'Store data',
    priority: 5,
    dependencies: ['parse']
  }
];

await manager.createTasks(tasks);
```

### High Priority Task

```typescript
const urgentTask = {
  id: 'hotfix',
  description: 'Fix critical bug',
  priority: 1,
  agentId: 'senior-dev'
};

await manager.createTask(urgentTask);
```
