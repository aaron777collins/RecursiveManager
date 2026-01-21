# API Overview

RecursiveManager provides both a CLI and programmatic API for managing agents.

::: warning Development Status
RecursiveManager is currently in development. This API documentation describes the intended interface. APIs may change before the v1.0 release.
:::

## CLI API

The primary interface is the command-line tool `recursivemanager`.

### Quick Reference

```bash
# System
recursivemanager init                    # Initialize system
recursivemanager status                  # View org chart
recursivemanager config <get|set|list>   # Manage configuration

# Agents
recursivemanager hire [options]          # Create agent
recursivemanager fire <agent-id>         # Delete agent
recursivemanager message <agent-id> <text>  # Send message
recursivemanager run <agent-id>          # Manually trigger

# Scheduling
recursivemanager scheduler start         # Start scheduler daemon
recursivemanager scheduler stop          # Stop scheduler daemon
recursivemanager scheduler status        # Check scheduler status

# Debugging
recursivemanager logs <agent-id>         # View agent logs
recursivemanager inspect <agent-id>      # Inspect agent state
recursivemanager doctor                  # System health check
```

See [CLI Commands](/api/cli-commands) for detailed command reference.

## Programmatic API

For advanced use cases, you can use RecursiveManager programmatically.

### Installation

```bash
npm install @recursivemanager/core
```

### Basic Usage

```typescript
import { AgentManager, Orchestrator } from '@recursivemanager/core';

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

### @recursivemanager/common

Shared utilities and types used across all packages.

**Exports**:
- Type definitions
- JSON schema validators
- Utility functions

```typescript
import { AgentConfig, TaskSchema, validateConfig } from '@recursivemanager/common';
```

### @recursivemanager/core

Core business logic for agent management.

**Exports**:
- `AgentManager` - Agent lifecycle management
- `TaskManager` - Task creation and tracking
- `Orchestrator` - Agent execution
- Database and file system layers

```typescript
import { AgentManager, TaskManager, Orchestrator } from '@recursivemanager/core';
```

### @recursivemanager/cli

Command-line interface tool.

**Exports**:
- CLI commands
- Interactive prompts

```bash
# Use as installed binary
recursivemanager <command>
```

### @recursivemanager/scheduler

Scheduler daemon for automatic agent execution.

**Exports**:
- `Scheduler` - Schedule management
- `Daemon` - Background execution service

```typescript
import { Scheduler, Daemon } from '@recursivemanager/scheduler';
```

### @recursivemanager/adapters

Framework adapters for different AI coding frameworks.

**Exports**:
- `ClaudeCodeAdapter` - Claude Code integration
- `OpenCodeAdapter` - OpenCode integration
- `FrameworkAdapter` - Base interface

```typescript
import { ClaudeCodeAdapter, FrameworkAdapter } from '@recursivemanager/adapters';
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
import { AgentNotFoundError, ValidationError } from '@recursivemanager/core';

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
