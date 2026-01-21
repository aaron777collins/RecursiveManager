# API Reference

This page documents the public API for RecursiveManager.

## Core Classes

### RecursiveManager

Main class for managing the agent hierarchy.

```typescript
import { RecursiveManager } from '@recursivemanager/core';

const manager = new RecursiveManager(config);
```

**Methods:**

- `initialize(goal: string): Promise<void>` - Initialize with a goal
- `getStatus(): AgentStatus[]` - Get status of all agents
- `getAgent(agentId: string): Agent | null` - Get specific agent
- `shutdown(): Promise<void>` - Shutdown the manager

### Agent

Represents an agent in the hierarchy.

```typescript
interface Agent {
  id: string;
  role: string;
  managerId?: string;
  status: AgentStatus;
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Task

Represents a task assigned to an agent.

```typescript
interface Task {
  id: string;
  agentId: string;
  description: string;
  status: TaskStatus;
  priority: number;
  createdAt: Date;
  completedAt?: Date;
}
```

## Database

### DatabaseConnection

Interface for database operations.

```typescript
import { getDatabase } from '@recursivemanager/common';

const db = await getDatabase();
```

**Methods:**

- `getAgent(agentId: string): Promise<Agent | null>`
- `saveAgent(agent: Agent): Promise<void>`
- `listAgents(): Promise<Agent[]>`
- `deleteAgent(agentId: string): Promise<void>`

## Configuration

### Config

Configuration interface and loader.

```typescript
import { loadConfig, config } from '@recursivemanager/common';

const currentConfig = config;
const newConfig = loadConfig();
```

## Execution

### ExecutionPool

Worker pool for parallel task execution.

```typescript
import { ExecutionPool } from '@recursivemanager/core';

const pool = new ExecutionPool(workerCount);
await pool.execute(task);
```

## Perspectives

### PerspectiveAnalysis

Multi-perspective analysis framework.

```typescript
import { PerspectiveAnalysis } from '@recursivemanager/core';

const analysis = new PerspectiveAnalysis();
const result = await analysis.analyze(decision);
```

**Available Perspectives:**

- Security
- Architecture
- Simplicity
- Financial
- Marketing
- UX
- Growth
- Emotional

## Framework Adapters

### ClaudeCodeAdapter

Adapter for Claude Code integration.

```typescript
import { ClaudeCodeAdapter } from '@recursivemanager/adapters';

const adapter = new ClaudeCodeAdapter(config);
await adapter.execute(prompt);
```

## Utilities

### Version

Version information utilities.

```typescript
import { VERSION, getVersionInfo } from '@recursivemanager/common';

console.log(VERSION); // "0.1.0"
console.log(getVersionInfo());
```

### AgentLock

Locking mechanism for agent synchronization.

```typescript
import { AgentLock } from '@recursivemanager/core';

const lock = new AgentLock();
await lock.acquire('agent-123');
// ... perform work ...
await lock.release('agent-123');
```

## Events

RecursiveManager emits events that you can listen to:

```typescript
manager.on('agent:created', (agent) => {
  console.log(`Agent created: ${agent.id}`);
});

manager.on('task:completed', (task) => {
  console.log(`Task completed: ${task.id}`);
});

manager.on('error', (error) => {
  console.error('Error:', error);
});
```

## TypeScript Support

RecursiveManager is written in TypeScript and provides full type definitions.

```typescript
import type {
  Agent,
  Task,
  AgentStatus,
  TaskStatus,
  RecursiveManagerConfig,
} from '@recursivemanager/common';
```
