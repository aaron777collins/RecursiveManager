# API Overview

RecursiveManager provides both a CLI and programmatic API for managing agents.

::: warning Development Status
RecursiveManager is currently in development. This API documentation describes the intended interface. APIs may change before the v1.0 release.
:::

## CLI API

The primary interface is the command-line tool `recursive-manager`.

### Quick Reference

```bash
# System
recursive-manager init                    # Initialize system
recursive-manager status                  # View org chart
recursive-manager config <get|set|list>   # Manage configuration

# Agents
recursive-manager hire [options]          # Create agent
recursive-manager fire <agent-id>         # Delete agent
recursive-manager message <agent-id> <text>  # Send message
recursive-manager run <agent-id>          # Manually trigger

# Scheduling
recursive-manager scheduler start         # Start scheduler daemon
recursive-manager scheduler stop          # Stop scheduler daemon
recursive-manager scheduler status        # Check scheduler status

# Debugging
recursive-manager logs <agent-id>         # View agent logs
recursive-manager inspect <agent-id>      # Inspect agent state
recursive-manager doctor                  # System health check
```

See [CLI Commands](/api/cli-commands) for detailed command reference.

## Programmatic API

For advanced use cases, you can use RecursiveManager programmatically.

### Installation

```bash
npm install @recursive-manager/core
```

### Basic Usage

```typescript
import { AgentManager, Orchestrator } from '@recursive-manager/core';

// Initialize the system
const manager = new AgentManager({
  dataDirectory: './data',
  framework: { type: 'claude-code' }
});

await manager.initialize();

// Create an agent
const ceoId = await manager.hireAgent({
  role: 'CEO',
  goal: 'Manage the organization',
  framework: 'claude-code'
});

// Send a message
await manager.sendMessage(ceoId, 'Start working on project X');

// Execute agent
const orchestrator = new Orchestrator(manager);
await orchestrator.executeAgent(ceoId, 'continuous');

// Get org chart
const orgChart = await manager.getOrgChart();
console.log(orgChart);
```

## Package Structure

RecursiveManager is organized as a monorepo with 5 packages:

### @recursive-manager/common

Shared utilities and types used across all packages.

**Exports**:
- Type definitions
- JSON schema validators
- Utility functions

```typescript
import { AgentConfig, TaskSchema, validateConfig } from '@recursive-manager/common';
```

### @recursive-manager/core

Core business logic for agent management.

**Exports**:
- `AgentManager` - Agent lifecycle management
- `TaskManager` - Task creation and tracking
- `Orchestrator` - Agent execution
- Database and file system layers

```typescript
import { AgentManager, TaskManager, Orchestrator } from '@recursive-manager/core';
```

### @recursive-manager/cli

Command-line interface tool.

**Exports**:
- CLI commands
- Interactive prompts

```bash
# Use as installed binary
recursive-manager <command>
```

### @recursive-manager/scheduler

Scheduler daemon for automatic agent execution.

**Exports**:
- `Scheduler` - Schedule management
- `Daemon` - Background execution service

```typescript
import { Scheduler, Daemon } from '@recursive-manager/scheduler';
```

### @recursive-manager/adapters

Framework adapters for different AI coding frameworks.

**Exports**:
- `ClaudeCodeAdapter` - Claude Code integration
- `OpenCodeAdapter` - OpenCode integration
- `FrameworkAdapter` - Base interface

```typescript
import { ClaudeCodeAdapter, FrameworkAdapter } from '@recursive-manager/adapters';
```

## Core Interfaces

### AgentConfig

```typescript
interface AgentConfig {
  identity: {
    id: string;
    role: string;
    reportingTo: string | null;
  };
  goal: {
    primary: string;
    constraints: string[];
  };
  permissions: {
    canHire: boolean;
    maxSubordinates: number;
    canDelegateUp: boolean;
  };
  framework: {
    type: 'claude-code' | 'opencode' | string;
    timeout: number;
  };
  // ... more fields
}
```

### TaskSchema

```typescript
interface TaskSchema {
  task: {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'failed';
  };
  hierarchy: {
    parentTaskId: string | null;
    depth: number;
  };
  delegation: {
    assignedTo: string;
    delegatedBy: string | null;
  };
  // ... more fields
}
```

### ExecutionContext

```typescript
interface ExecutionContext {
  agentId: string;
  mode: 'continuous' | 'reactive';
  config: AgentConfig;
  activeTasks: TaskSchema[];
  messages: Message[];
  workspaceFiles: string[];
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  success: boolean;
  duration: number;
  tasksCompleted: number;
  messagesProcessed: number;
  errors: Error[];
  nextExecution?: Date;
}
```

## Error Handling

All API methods throw typed errors:

```typescript
import { AgentNotFoundError, ValidationError } from '@recursive-manager/core';

try {
  await manager.hireAgent(config);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid config:', error.details);
  } else if (error instanceof AgentNotFoundError) {
    console.error('Agent not found:', error.agentId);
  } else {
    throw error;
  }
}
```

## Events

The `AgentManager` emits events for monitoring:

```typescript
manager.on('agent:hired', (agentId) => {
  console.log(`Agent hired: ${agentId}`);
});

manager.on('agent:fired', (agentId) => {
  console.log(`Agent fired: ${agentId}`);
});

manager.on('task:completed', (taskId, agentId) => {
  console.log(`Task ${taskId} completed by ${agentId}`);
});

manager.on('execution:started', (agentId) => {
  console.log(`Execution started: ${agentId}`);
});

manager.on('execution:completed', (agentId, result) => {
  console.log(`Execution completed: ${agentId}`, result);
});
```

## Next Steps

- [CLI Commands](/api/cli-commands) - Full CLI reference
- [Core API](/api/core) - Detailed API documentation
- [File Schemas](/api/schemas) - JSON schema specifications
- [Adapters](/api/adapters) - Framework adapter interface
