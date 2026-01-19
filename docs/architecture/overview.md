# Architecture Overview

RecursiveManager is designed as a hierarchical AI agent system that mimics organizational structures. This document provides a high-level overview of the system architecture.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RecursiveManager System                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐                     │
│  │   CLI Tool   │◄─────┤  Scheduler   │                     │
│  │              │      │   Daemon     │                     │
│  └──────┬───────┘      └──────┬───────┘                     │
│         │                     │                              │
│         │                     │                              │
│  ┌──────▼──────────────────────▼───────┐                    │
│  │     Core Agent Orchestrator         │                    │
│  │  (Framework-agnostic execution)     │                    │
│  └──────┬──────────────────────────────┘                    │
│         │                                                    │
│         │                                                    │
│  ┌──────▼──────────────────────────────┐                    │
│  │    Framework Adapters               │                    │
│  │  ┌────────┐  ┌────────┐  ┌────────┐│                    │
│  │  │ Claude │  │OpenCode│  │ Future ││                    │
│  │  │  Code  │  │        │  │Adapters││                    │
│  │  └────────┘  └────────┘  └────────┘│                    │
│  └─────────────────────────────────────┘                    │
│                                                               │
│  ┌─────────────────────────────────────┐                    │
│  │   Messaging Integration Layer       │                    │
│  │  ┌────────┐  ┌────────┐  ┌────────┐│                    │
│  │  │ Slack  │  │Telegram│  │ Email  ││                    │
│  │  │ Module │  │ Module │  │ Module ││                    │
│  │  └────────┘  └────────┘  └────────┘│                    │
│  └─────────────────────────────────────┘                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘

                          ▼

┌─────────────────────────────────────────────────────────────┐
│                  File-Based State Storage                    │
│                                                               │
│  agents/                                                      │
│    ├── CEO/                                                   │
│    │   ├── config.json                                       │
│    │   ├── schedule.json                                     │
│    │   ├── tasks/                                            │
│    │   │   ├── active/                                       │
│    │   │   └── archive/                                      │
│    │   ├── inbox/                                            │
│    │   └── workspace/                                        │
│    │                                                          │
│    ├── CTO/                                                   │
│    └── ...                                                    │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. CLI Tool

**Purpose**: User-facing interface for all agent operations

**Key Commands**:
- `init` - Initialize the system
- `hire` - Create a new agent
- `fire` - Delete an agent
- `message` - Send a message to an agent
- `run` - Manually trigger agent execution
- `status` - View organizational chart
- `logs` - View agent logs

**Package**: `@recursive-manager/cli`

### 2. Scheduler Daemon

**Purpose**: Time-based and event-based agent execution

**Responsibilities**:
- Scan agent schedules periodically
- Spawn agents at scheduled times
- Handle reactive triggers (messages from Slack, Telegram, etc.)
- Manage continuous task execution
- Monitor agent health

**Package**: `@recursive-manager/scheduler`

### 3. Core Orchestrator

**Purpose**: Framework-agnostic agent execution logic

**Responsibilities**:
- Load agent configuration and context
- Prepare execution environment
- Invoke framework adapter
- Process execution results
- Update file-based state
- Coordinate multi-perspective analysis

**Package**: `@recursive-manager/core`

### 4. Framework Adapters

**Purpose**: Interface with different AI coding frameworks

**Initial Support**:
- Claude Code (primary)
- OpenCode (secondary)

**Interface Contract**:
```typescript
interface FrameworkAdapter {
  executeAgent(
    agentId: string,
    mode: 'continuous' | 'reactive',
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  supportsFeature(feature: string): boolean;
  getCapabilities(): Capability[];
}
```

**Package**: `@recursive-manager/adapters`

### 5. Messaging Layer

**Purpose**: Standardized message handling across platforms

**Modules**:
- Slack integration
- Telegram integration
- Email integration
- Internal message queue

**Interface Contract**:
```typescript
interface MessagingAdapter {
  pollMessages(): Promise<Message[]>;
  sendMessage(agentId: string, message: string): Promise<void>;
  markAsRead(messageId: string): Promise<void>;
}
```

**Package**: `@recursive-manager/core` (messaging module)

## Data Flow

### Agent Execution Flow

```
1. Trigger (schedule/message/manual)
   ↓
2. Scheduler identifies agent to run
   ↓
3. Core Orchestrator loads agent context
   ↓
4. Framework Adapter executes agent
   ↓
5. Agent performs work (tasks/messages)
   ↓
6. Results written to file system
   ↓
7. Database updated with metadata
   ↓
8. Next execution scheduled
```

### Task Delegation Flow

```
1. Manager agent creates task
   ↓
2. Manager delegates to subordinate
   ↓
3. Subordinate's task queue updated
   ↓
4. Subordinate executes on next run
   ↓
5. Progress updates flow back to manager
   ↓
6. Manager monitors and coordinates
```

## Storage Model

### Hybrid Storage Strategy

**Files** (for transparency and debugging):
- Agent configurations
- Task details and progress
- Workspace files
- Message history
- Logs and execution traces

**Database** (for queries and relationships):
- Agent hierarchy
- Task dependencies
- Message metadata
- Execution history
- Audit logs

### File System Structure

See [File Structure](/architecture/file-structure) for detailed schemas.

```
data/
├── agents/
│   ├── 00-0f/          # Sharded by hex prefix
│   │   └── agent-001/
│   ├── 10-1f/
│   └── ...
├── backups/
│   └── YYYY-MM-DD/
├── logs/
│   ├── system/
│   └── agents/
└── recursive-manager.db
```

## Design Principles

### 1. Quality Over Cost

- Multi-perspective analysis before major decisions
- Comprehensive edge case handling
- Defensive programming with validation

### 2. Stateless Execution

- Fresh context from files each run
- No long-running process memory
- Prevents context decay over time

### 3. Transparency

- All state visible in files
- Full audit trail
- Debuggable at every step

### 4. Modularity

- Framework-agnostic core
- Pluggable adapters
- Clear interface contracts

### 5. Resilience

- Circuit breakers for failures
- Graceful degradation
- Automatic recovery mechanisms

## Key Features

### Multi-Perspective Analysis

Before major decisions, analyze from 8 perspectives:
1. Simplicity & Developer Experience
2. Architecture & Scalability
3. Security & Trust
4. Testing & Quality Assurance
5. Observability & Debugging
6. Documentation & Onboarding
7. DevOps & Operations
8. User Experience

### Edge Case Handling

Comprehensive handling of 28+ documented edge cases:
- Recursion explosion
- Circular reporting structures
- Task deadlocks
- Resource exhaustion
- Framework failures
- And more...

See [Edge Cases](/architecture/edge-cases) for details.

### Scalability

Designed to scale from 1 to 1000+ agents:
- Agent directory sharding
- Database indexes on critical queries
- Worker pool for concurrent execution
- Efficient file I/O with atomic writes

## Next Steps

- [System Design](/architecture/system-design) - Detailed design decisions
- [File Structure](/architecture/file-structure) - File schemas and organization
- [Execution Model](/architecture/execution-model) - How agents execute
- [Edge Cases](/architecture/edge-cases) - Comprehensive edge case catalog

## Related Reading

For implementation details, see:
- [COMPREHENSIVE_PLAN.md](https://github.com/yourusername/RecursiveManager/blob/main/COMPREHENSIVE_PLAN.md)
- [MULTI_PERSPECTIVE_ANALYSIS.md](https://github.com/yourusername/RecursiveManager/blob/main/MULTI_PERSPECTIVE_ANALYSIS.md)
- [IMPLEMENTATION_PHASES.md](https://github.com/yourusername/RecursiveManager/blob/main/IMPLEMENTATION_PHASES.md)
