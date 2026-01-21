# RecursiveManager Architecture

**Version**: 1.0.0
**Last Updated**: 2026-01-20

## Table of Contents

- [Overview](#overview)
- [System Design Philosophy](#system-design-philosophy)
- [High-Level Architecture](#high-level-architecture)
- [Package Structure](#package-structure)
- [Core Components](#core-components)
- [Data Architecture](#data-architecture)
- [Execution Flows](#execution-flows)
- [Multi-Perspective AI Analysis](#multi-perspective-ai-analysis)
- [Agent Adapter System](#agent-adapter-system)
- [Scheduler and Execution](#scheduler-and-execution)
- [Snapshot and Rollback](#snapshot-and-rollback)
- [Configuration Management](#configuration-management)
- [Design Patterns](#design-patterns)
- [Security Architecture](#security-architecture)
- [Monitoring and Observability](#monitoring-and-observability)
- [Extension Points](#extension-points)

---

## Overview

RecursiveManager is a **hierarchical AI agent orchestration system** that models organizational structures in software. It enables AI agents to operate as autonomous employees with roles, goals, and the ability to hire subordinates, creating organizational depth and delegation chains.

### Key Capabilities

- **Organizational Hierarchy**: Agents can hire/fire subordinates to build teams
- **Dual Execution Modes**: Continuous (ongoing work) and Reactive (event-driven)
- **Multi-Perspective Analysis**: 8 AI perspectives analyze major decisions in parallel
- **Complete State Persistence**: SQLite database + file system for full auditability
- **Snapshot & Rollback**: Point-in-time recovery for any organizational state
- **Framework Agnostic**: Adapter pattern supports multiple AI frameworks (Claude Code, OpenCode, etc.)

---

## System Design Philosophy

### 1. Quality Over Cost
RecursiveManager prioritizes decision quality through multi-perspective analysis. Every major action (hiring, firing, delegation) is analyzed by 8 specialized AI agents before execution.

### 2. Fresh State Execution
Each agent execution starts with a clean slate:
- No in-memory context carried between runs
- State loaded from files and database on each execution
- Prevents context window decay
- Enables truly long-running projects (months/years)

### 3. Hierarchical Delegation
Agents model business organizational structures:
- CEO → VPs → Directors → Managers → Individual Contributors
- Each level can delegate to subordinates
- Budget and permission propagation through hierarchy
- Audit trail of all organizational changes

### 4. File-Based + Database Persistence
Dual persistence strategy:
- **Files**: Configuration, tasks, workspace, messages (human-readable)
- **Database**: Relationships, schedules, audit log (queryable)
- Enables both direct file inspection and SQL queries

### 5. Framework Agnostic
Adapter pattern abstracts AI framework details:
- Supports multiple backends (Claude Code, AgentOS, custom)
- Health checking and automatic fallback
- Dynamic capability negotiation

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLI Interface                             │
│  (init, hire, fire, status, run, message, analyze, config...)  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                   Core Orchestrator                              │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         ExecutionOrchestrator                            │   │
│  │  - Continuous & Reactive Execution                       │   │
│  │  - Lock Management (AgentLock)                           │   │
│  │  - Concurrency Control (ExecutionPool)                   │   │
│  │  - Multi-Perspective Decision Analysis                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │    Multi-Perspective Analysis (8 Parallel Agents)        │   │
│  │  Security │ Architecture │ Simplicity │ Financial        │   │
│  │  Marketing │ UX │ Growth │ Emotional                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │         Lifecycle Operations                             │   │
│  │  - hireAgent (with validation)                           │   │
│  │  - fireAgent (reassign/promote/cascade)                  │   │
│  │  - pauseAgent / resumeAgent                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└───────────────┬───────────────────────┬──────────────────────────┘
                │                       │
       ┌────────▼────────┐     ┌───────▼──────────┐
       │  Adapter Layer   │     │   Scheduler      │
       │                  │     │                  │
       │ ┌──────────────┐│     │ ┌──────────────┐│
       │ │ ClaudeCode   ││     │ │ Daemon       ││
       │ └──────────────┘│     │ │ (60s poll)   ││
       │ ┌──────────────┐│     │ └──────────────┘│
       │ │ AgentOS      ││     │ ┌──────────────┐│
       │ └──────────────┘│     │ │ ScheduleMgr  ││
       │ ┌──────────────┐│     │ └──────────────┘│
       │ │ Custom       ││     └──────────────────┘
       │ └──────────────┘│
       └──────────────────┘
                │
       ┌────────▼────────────────────────────────┐
       │         Data Layer                       │
       │                                          │
       │  ┌──────────────┐   ┌────────────────┐ │
       │  │   SQLite DB   │   │  File System   │ │
       │  │  - agents     │   │  - config/     │ │
       │  │  - tasks      │   │  - tasks/      │ │
       │  │  - messages   │   │  - workspace/  │ │
       │  │  - schedules  │   │  - inbox/      │ │
       │  │  - audit_log  │   │  - snapshots/  │ │
       │  └──────────────┘   └────────────────┘ │
       └──────────────────────────────────────────┘
                │
       ┌────────▼────────────────────────────────┐
       │    Observability Layer                   │
       │                                          │
       │  ┌──────────────┐   ┌────────────────┐ │
       │  │  Prometheus   │   │  Winston       │ │
       │  │  Metrics      │   │  Logging       │ │
       │  │  (port 9090)  │   │  (trace IDs)   │ │
       │  └──────────────┘   └────────────────┘ │
       └──────────────────────────────────────────┘
```

---

## Package Structure

RecursiveManager uses a **Turbo monorepo** with 5 main packages:

### Directory Structure

```
packages/
├── core/              # Core orchestration and execution engine
│   └── src/
│       ├── ai-analysis/          # Multi-perspective analysis system
│       │   ├── agents/           # 8 perspective agents
│       │   ├── providers/        # AI provider implementations
│       │   └── multi-perspective.ts
│       ├── execution/            # ExecutionOrchestrator, Pool, Lock
│       ├── lifecycle/            # Agent hire/fire/pause/resume
│       ├── tasks/                # Task management, archival
│       ├── messaging/            # Message routing
│       ├── server/               # Metrics HTTP server
│       ├── config/               # Configuration management
│       └── validation/           # Business logic validation
│
├── adapters/          # Framework adapter implementations
│   └── src/
│       ├── AdapterRegistry.ts    # Adapter registration
│       ├── types.ts              # FrameworkAdapter interface
│       ├── adapters/
│       │   └── claude-code/      # Claude Code CLI adapter
│       ├── context/              # Context loading
│       └── prompts/              # Prompt templates
│
├── scheduler/         # Central scheduler daemon
│   └── src/
│       ├── daemon.ts             # Main scheduler loop
│       └── ScheduleManager.ts    # Cron management
│
├── cli/               # Command-line interface
│   └── src/
│       ├── cli.ts                # Commander.js entry
│       └── commands/             # Command implementations
│
└── common/            # Shared utilities and data layer
    └── src/
        ├── db/                   # SQLite database layer
        ├── logger.ts             # Unified logging
        ├── config/               # Configuration loading
        ├── file-io.ts            # File operations
        └── schema-validation.ts  # JSON schema validation
```

### Package Dependencies

```
     ┌─────────┐
     │   CLI   │
     └────┬────┘
          │
    ┌─────▼─────┐
    │   Core    │
    └─┬───────┬─┘
      │       │
┌─────▼──┐  ┌▼────────┐
│Adapters│  │Scheduler│
└────┬───┘  └─────┬───┘
     │            │
     └──────┬─────┘
            │
       ┌────▼────┐
       │ Common  │
       └─────────┘
```

All packages depend on `common` for shared utilities.

---

## Core Components

### 1. ExecutionOrchestrator

**Location**: `packages/core/src/execution/index.ts`

The central coordinator for all agent execution operations.

#### Responsibilities

- **Execution Management**: Coordinates both continuous and reactive execution modes
- **Lock Management**: Prevents concurrent execution of the same agent
- **Concurrency Control**: Enforces system-wide execution limits
- **Decision Analysis**: Integrates multi-perspective analysis for major decisions
- **Timeout Protection**: Prevents runaway executions
- **Audit Integration**: Records all execution events

#### Key Methods

```typescript
class ExecutionOrchestrator {
  // Execute agent in continuous mode (scheduled work)
  async executeContinuous(agentId: string): Promise<ExecutionResult>

  // Execute agent in reactive mode (message-driven)
  async executeReactive(agentId: string, triggerId: string): Promise<ExecutionResult>

  // Analyze a decision with 8 perspectives
  async analyzeDecision(context: DecisionContext): Promise<MultiPerspectiveResult>

  // Hire agent with analysis
  async hireAgentWithAnalysis(params: HireParams): Promise<HireResult>

  // Fire agent with analysis
  async fireAgentWithAnalysis(params: FireParams): Promise<FireResult>
}
```

#### Integration Points

- **AgentLock**: Acquires locks before execution
- **ExecutionPool**: Queues executions respecting limits
- **FrameworkAdapter**: Delegates to appropriate adapter
- **MultiPerspectiveAnalysis**: Calls for major decisions
- **MetricsRecorder**: Records execution metrics

### 2. Multi-Perspective Analysis System

**Location**: `packages/core/src/ai-analysis/`

Implements 8-agent parallel analysis for decision quality.

#### Architecture

```
MultiPerspectiveAnalysis
  │
  ├─ ProviderFactory (creates AI providers)
  │   ├─ AICEOGatewayProvider
  │   ├─ AnthropicDirectProvider
  │   ├─ OpenAIDirectProvider
  │   └─ CustomProvider
  │
  └─ 8 Perspective Agents (execute in parallel)
      ├─ SecurityAgent        (identifies risks)
      ├─ ArchitectureAgent    (evaluates design)
      ├─ SimplicityAgent      (assesses complexity)
      ├─ FinancialAgent       (analyzes costs)
      ├─ MarketingAgent       (considers market)
      ├─ UXAgent              (evaluates experience)
      ├─ GrowthAgent          (projects scalability)
      └─ EmotionalAgent       (considers human factors)
```

#### Workflow

1. **Context Preparation**: Prepare decision context with relevant data
2. **Cache Check**: Check if identical analysis already exists
3. **Provider Selection**: Get healthy provider (with fallback)
4. **Parallel Execution**: Execute all 8 agents simultaneously
5. **Confidence Scoring**: Calculate confidence based on variance
6. **Executive Summary**: Synthesize findings into actionable summary
7. **Decision Synthesis**: Apply decision rules (approve/reject/conditional/review)
8. **Caching**: Store result for future identical contexts
9. **History Persistence**: Save to disk for learning

#### Decision Synthesis Rules

| Condition | Action | Confidence |
|-----------|--------|-----------|
| Any agent strongly rejects (confidence > 0.8) | **REJECT** | Original |
| Majority approve | **APPROVE** | Capped at 0.95 |
| Conditionals present | **CONDITIONAL** | 0.9x original |
| No consensus | **REVIEW** | Flagged for human |
| More rejections than approvals | **REJECT** | Original |

### 3. ExecutionPool

**Location**: `packages/core/src/execution/ExecutionPool.ts`

Worker pool pattern for concurrent agent execution.

#### Features

- **Task Queue**: Priority-based queue (low, medium, high, urgent)
- **Concurrency Limit**: Max concurrent executions (default: 10)
- **Dependency Management**: Task dependency graph with cycle detection
- **Resource Quotas**: CPU, memory, execution time limits
- **Queue Statistics**: Real-time metrics on queue depth and wait times

#### Priority Levels

```typescript
enum Priority {
  LOW = 1,      // Scheduled maintenance, archival
  MEDIUM = 5,   // Normal continuous execution
  HIGH = 10,    // Important scheduled work
  URGENT = 20   // Reactive execution (external messages)
}
```

#### Dependency Graph

Tasks can declare dependencies on other tasks:

```typescript
// Task B depends on Task A
pool.addDependency(taskB, taskA);

// Execution order guaranteed: A completes before B starts
```

Cycle detection prevents deadlocks:

```
A → B → C → A (REJECTED: cycle detected)
```

### 4. AgentLock

**Location**: `packages/core/src/execution/AgentLock.ts`

Mutex-based locking system to prevent concurrent agent execution.

#### Features

- **Per-Agent Isolation**: Each agent has independent lock
- **Async Mutex**: Non-blocking lock acquisition
- **Queuing Support**: Multiple requests queue automatically
- **Fail-Fast**: `tryAcquire()` for non-blocking checks

#### Usage Pattern

```typescript
const lock = new AgentLock();

// Acquire lock (waits if locked)
const release = await lock.acquire(agentId);
try {
  // Execute agent
  await executeAgent(agentId);
} finally {
  // Always release
  release();
}
```

### 5. Framework Adapters

**Location**: `packages/adapters/src/`

Adapter pattern abstracts AI framework implementations.

#### FrameworkAdapter Interface

```typescript
interface FrameworkAdapter {
  name: string;
  version: string;

  // Execute agent with given context
  executeAgent(
    agentId: string,
    mode: 'continuous' | 'reactive',
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  // Check feature support
  supportsFeature(feature: string): boolean;

  // List capabilities
  getCapabilities(): Capability[];

  // Health check
  healthCheck(): Promise<boolean>;
}
```

#### ClaudeCodeAdapter

Primary adapter implementation for Claude Code CLI.

**Features:**
- Wraps Claude Code CLI execution
- Supports continuous and reactive modes
- Dynamic prompt building based on execution mode
- Timeout protection (default: 60 minutes)
- Retry logic for transient errors
- Environment variable injection (ANTHROPIC_BASE_URL for provider routing)

**Execution Flow:**
```
ClaudeCodeAdapter.executeAgent()
  │
  ├─ Build prompt based on mode
  ├─ Set environment variables
  ├─ Spawn child process (claude-code CLI)
  ├─ Monitor with timeout
  ├─ Capture stdout/stderr
  ├─ Parse execution result
  └─ Return ExecutionResult
```

#### AdapterRegistry

Manages adapter lifecycle:
- Registration of framework adapters
- Lookup by name
- Health checking
- Fallback selection

---

## Data Architecture

### Database Architecture (SQLite)

**Location**: `packages/common/src/db/`

#### Database Features

- **WAL Mode**: Write-Ahead Logging for better concurrency
- **Encryption**: AES-256-GCM for sensitive fields (optional)
- **Transactions**: ACID compliance
- **Integrity Checks**: Built-in validation and crash recovery
- **Foreign Keys**: Enabled for referential integrity

#### Schema Overview

```sql
-- Core Tables
agents              -- Agent metadata and hierarchy
tasks               -- Task management with hierarchy
messages            -- Inter-agent messaging
schedules           -- Schedule configuration
org_hierarchy       -- Organizational structure
audit_log           -- Immutable audit trail
schema_version      -- Migration tracking

-- Indexes
idx_status          -- Filter agents by status
idx_reporting_to    -- Hierarchical queries
idx_tasks_agent     -- Agent task lookups
idx_messages_unread -- Unread message queries
idx_schedules_next  -- Ready-to-run schedules
```

#### Key Tables

##### agents

Stores agent metadata and organizational hierarchy.

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  display_name TEXT NOT NULL,
  reporting_to TEXT,  -- FK to agents.id
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  hired_by TEXT,
  FOREIGN KEY (reporting_to) REFERENCES agents(id)
);
```

**Fields:**
- `id`: Unique agent identifier (slug format: ceo, vp-engineering)
- `role`: Job title (CEO, VP of Engineering, Senior Developer)
- `display_name`: Human-friendly name
- `reporting_to`: Manager's agent ID (null for CEO)
- `status`: active, paused, terminated
- `hired_by`: ID of agent that performed the hire

##### tasks

Task management with hierarchical support.

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 5,
  parent_task_id TEXT,      -- Subtask support
  delegated_to TEXT,        -- FK to agents.id
  blocked_by TEXT,          -- Comma-separated task IDs
  version INTEGER DEFAULT 1, -- Optimistic locking
  created_at INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
  FOREIGN KEY (delegated_to) REFERENCES agents(id)
);
```

**Features:**
- Parent-child task relationships (subtasks)
- Delegation to subordinates
- Blocking dependencies
- Optimistic locking for concurrent updates

##### messages

Inter-agent and external messaging.

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  from_agent_id TEXT,
  to_agent_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  channel TEXT NOT NULL DEFAULT 'internal',
  read INTEGER DEFAULT 0,
  priority INTEGER DEFAULT 5,
  FOREIGN KEY (from_agent_id) REFERENCES agents(id),
  FOREIGN KEY (to_agent_id) REFERENCES agents(id)
);
```

**Channels:**
- `internal`: Agent-to-agent communication
- `slack`: External Slack messages
- `telegram`: Telegram notifications
- `email`: Email messages

##### schedules

Schedule configuration and tracking.

```sql
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  cron_expression TEXT,
  next_execution_at INTEGER,
  last_triggered_at INTEGER,
  enabled INTEGER DEFAULT 1,
  dependencies TEXT,  -- Comma-separated schedule IDs
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);
```

**Trigger Types:**
- `continuous`: Run when tasks pending (configurable min interval)
- `cron`: Time-based with cron expression
- `reactive`: Event-driven from external sources

##### audit_log

Immutable audit trail for compliance.

```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT,
  action TEXT NOT NULL,
  success INTEGER NOT NULL,
  details TEXT,
  timestamp INTEGER NOT NULL,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);
```

**Logged Actions:**
- `hire_agent`: Agent hiring with parameters
- `fire_agent`: Agent termination with strategy
- `pause_agent`: Agent pause with reason
- `resume_agent`: Agent resume
- `execute_continuous`: Continuous execution
- `execute_reactive`: Reactive execution
- `analyze_decision`: Multi-perspective analysis

### File System Architecture

Each agent has a dedicated directory structure:

```
data/agents/{agent_id}/
├── config.json           # Agent configuration
├── schedule.json         # Schedule configuration
├── metadata.json         # Runtime metadata
├── tasks/
│   ├── active/          # Active task files
│   │   ├── TASK-001.md
│   │   └── TASK-002.md
│   └── archive/         # Completed/cancelled tasks
│       └── TASK-000.md
├── workspace/           # Agent workspace and notes
│   ├── research/
│   └── drafts/
└── inbox/              # Incoming messages
    ├── MSG-001.yml
    └── MSG-002.yml
```

#### File Formats

##### config.json

```json
{
  "id": "vp-engineering",
  "display_name": "VP of Engineering",
  "role": "Vice President of Engineering",
  "main_goal": "Build and scale engineering organization",
  "capabilities": {
    "canHire": true,
    "canFire": true,
    "canDelegate": true
  },
  "framework": {
    "primary": "claude-code",
    "fallback": "agentOS"
  },
  "reporting_to": "ceo",
  "subordinates": ["director-backend", "director-frontend"]
}
```

##### schedule.json

```json
{
  "continuous": {
    "enabled": true,
    "min_interval_minutes": 60,
    "max_concurrent_tasks": 5
  },
  "time_based": [
    {
      "name": "daily_standup",
      "cron": "0 9 * * MON-FRI",
      "timezone": "America/New_York",
      "task": "Review team progress and blockers"
    }
  ],
  "reactive": {
    "slack": true,
    "telegram": false,
    "email": true
  },
  "pause_conditions": {
    "manager_paused": true,
    "out_of_budget": true,
    "maintenance": false
  }
}
```

##### Task File (TASK-001.md)

```markdown
---
id: TASK-001
title: Implement authentication system
status: in_progress
priority: 10
created: 2026-01-15T10:00:00Z
assigned_to: director-backend
parent_task: null
blocked_by: []
---

# Implementation Plan

1. Research OAuth 2.0 providers
2. Design token refresh strategy
3. Implement login/logout endpoints

# Progress

- [x] Researched Auth0 vs. Clerk
- [ ] Implement OAuth flow
- [ ] Add refresh token logic
```

##### Message File (MSG-001.yml)

```yaml
id: MSG-001
from: ceo
to: vp-engineering
timestamp: 2026-01-20T14:30:00Z
channel: internal
priority: 10
read: false
thread_id: THREAD-123
in_reply_to: MSG-000

subject: Q1 Planning
body: |
  Let's schedule a planning session for Q1 roadmap.
  Please prepare capacity estimates for your team.
```

---

## Execution Flows

### Continuous Task Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      Scheduler Daemon                            │
│                   (60-second poll loop)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   Query schedules table             │
        │   WHERE next_execution_at <= NOW    │
        │   AND enabled = 1                   │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   For each schedule:                │
        │   Check if tasks pending            │
        │   (smart spawning)                  │
        └────────────────┬───────────────────┘
                         │
                 ┌───────┴────────┐
                 │                │
                YES              NO
                 │                │
                 ▼                ▼
    ┌────────────────────┐   ┌──────────────┐
    │ Spawn Continuous    │   │ Skip         │
    │ Instance            │   │ (save cycles)│
    └─────────┬──────────┘   └──────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  ExecutionOrchestrator.executeContinuous│
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  AgentLock.acquire(agentId)              │
    │  (wait if already running)               │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  ExecutionPool.submit(task)              │
    │  (respects priority and concurrency)     │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  Load Execution Context:                 │
    │  - config.json                           │
    │  - tasks/active/*.md                     │
    │  - messages (unread)                     │
    │  - workspace/                            │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  AdapterRegistry.get(primary)            │
    │  .healthCheck() → fallback if needed     │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  FrameworkAdapter.executeAgent()         │
    │  (with timeout protection)               │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  Agent Execution:                        │
    │  - Process tasks                         │
    │  - Update workspace                      │
    │  - Write messages                        │
    │  - Make decisions (hire/fire/delegate)   │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  Record Metrics:                         │
    │  - Execution duration                    │
    │  - Tasks completed                       │
    │  - Messages processed                    │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  Audit Log:                              │
    │  - action: execute_continuous            │
    │  - success: true/false                   │
    │  - details: {...}                        │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  AgentLock.release(agentId)              │
    └─────────┬───────────────────────────────┘
              │
              ▼
        ┌────────────┐
        │   Exit     │
        │ (fresh)    │
        └────────────┘
```

### Reactive Message Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   External Message Source                        │
│              (Slack, Telegram, Email, Webhook)                   │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   Messaging Relay System            │
        │   - Parse message                   │
        │   - Identify recipient agent        │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   Write to agent inbox/             │
        │   - Create MSG-XXX.yml              │
        │   - Insert into messages table      │
        └────────────────┬───────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   Spawn Reactive Instance           │
        │   (higher priority than continuous) │
        └────────────────┬───────────────────┘
                         │
                         ▼
    ┌─────────────────────────────────────────┐
    │  ExecutionOrchestrator.executeReactive  │
    │  (triggerId = message ID)               │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  AgentLock.acquire(agentId)              │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  Load Context:                           │
    │  - config.json                           │
    │  - THIS message (high priority)          │
    │  - Recent task context                   │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  Multi-Perspective Analysis (optional)   │
    │  if message suggests major action        │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  Agent Execution:                        │
    │  - Read and analyze message              │
    │  - Determine action needed               │
    │  - Create task / Respond / Escalate      │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  Update State:                           │
    │  - Mark message as read                  │
    │  - Create tasks if needed                │
    │  - Write response messages               │
    │  - Update schedule if priority changed   │
    └─────────┬───────────────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────┐
    │  AgentLock.release(agentId)              │
    └─────────┬───────────────────────────────┘
              │
              ▼
        ┌────────────┐
        │   Exit     │
        └────────────┘
```

### Agent Hiring Flow

```
┌─────────────────────────────────────────────────────────────────┐
│             Agent Decision to Hire Subordinate                   │
│     (continuous execution or reactive to hiring request)         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   Multi-Perspective Analysis        │
        │   analyzeDecision(hireContext)      │
        └────────────────┬───────────────────┘
                         │
                ┌────────┴────────┐
                │                 │
            APPROVE          REJECT/REVIEW
                │                 │
                ▼                 ▼
    ┌──────────────────────┐  ┌───────────────┐
    │ Proceed with hire    │  │ Abort hire    │
    └────────┬─────────────┘  │ Log analysis  │
             │                └───────────────┘
             ▼
    ┌─────────────────────────────────────────┐
    │  validateHireStrict()                    │
    │  - Check role/goal format                │
    │  - Verify hiring budget                  │
    │  - Detect hiring cycles                  │
    │  - Check rate limits                     │
    └────────┬────────────────────────────────┘
             │
        ┌────┴─────┐
        │          │
      VALID    INVALID
        │          │
        ▼          ▼
    ┌──────┐  ┌─────────────────┐
    │      │  │ Throw error     │
    │      │  │ Log validation  │
    │      │  └─────────────────┘
    │      │
    │      ▼
    │  ┌─────────────────────────────────────────┐
    │  │  Create Snapshot (for rollback)          │
    │  └────────┬────────────────────────────────┘
    │           │
    │           ▼
    │  ┌─────────────────────────────────────────┐
    │  │  Filesystem Operations:                  │
    │  │  - Create data/agents/{agent_id}/        │
    │  │  - Write config.json                     │
    │  │  - Write schedule.json                   │
    │  │  - Write metadata.json                   │
    │  │  - Create subdirectories:                │
    │  │    - tasks/active/                       │
    │  │    - tasks/archive/                      │
    │  │    - workspace/                          │
    │  │    - inbox/                              │
    │  └────────┬────────────────────────────────┘
    │           │
    │           ▼
    │  ┌─────────────────────────────────────────┐
    │  │  Database Operations (transaction):      │
    │  │  - INSERT INTO agents                    │
    │  │  - INSERT INTO org_hierarchy             │
    │  │  - INSERT INTO schedules (initial)       │
    │  │  - UPDATE parent's subordinates list     │
    │  │  - INSERT INTO audit_log                 │
    │  └────────┬────────────────────────────────┘
    │           │
    │           ▼
    │  ┌─────────────────────────────────────────┐
    │  │  Return HireResult:                      │
    │  │  - agent_id                              │
    │  │  - analysis summary                      │
    │  │  - snapshot_id (for rollback)            │
    │  └─────────────────────────────────────────┘
    │
    └──────────────────────────────────────────────────────────────┘
```

### Agent Firing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│             Agent Decision to Fire Subordinate                   │
│              (with strategy: reassign/promote/cascade)           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │   Multi-Perspective Analysis        │
        │   analyzeDecision(fireContext)      │
        └────────────────┬───────────────────┘
                         │
                ┌────────┴────────┐
                │                 │
            APPROVE          REJECT/REVIEW
                │                 │
                ▼                 ▼
    ┌──────────────────────┐  ┌───────────────┐
    │ Proceed with fire    │  │ Abort fire    │
    └────────┬─────────────┘  │ Log analysis  │
             │                └───────────────┘
             ▼
    ┌─────────────────────────────────────────┐
    │  validateFireStrict()                    │
    │  - Verify agent exists and active        │
    │  - Check firing permissions              │
    │  - Validate strategy                     │
    └────────┬────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  Create Snapshot (for rollback)          │
    └────────┬────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  Pause Agent (prevent concurrent exec)   │
    └────────┬────────────────────────────────┘
             │
    ┌────────┴────────────────────────────────┐
    │                                          │
    │  Handle Strategy:                        │
    │                                          │
    │  ┌──────────────────────────────────┐  │
    │  │ REASSIGN:                         │  │
    │  │ - Move all tasks to manager       │  │
    │  │ - Move all subordinates to manager│  │
    │  └──────────────────────────────────┘  │
    │                                          │
    │  ┌──────────────────────────────────┐  │
    │  │ PROMOTE:                          │  │
    │  │ - Choose best subordinate         │  │
    │  │ - Transfer tasks to promoted agent│  │
    │  │ - Move other subordinates to them │  │
    │  └──────────────────────────────────┘  │
    │                                          │
    │  ┌──────────────────────────────────┐  │
    │  │ CASCADE:                          │  │
    │  │ - Recursively fire all subs       │  │
    │  │ - Archive all tasks               │  │
    │  │ - Clean up hierarchy              │  │
    │  └──────────────────────────────────┘  │
    │                                          │
    └────────┬─────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  Database Operations (transaction):      │
    │  - UPDATE agents SET status='terminated' │
    │  - UPDATE org_hierarchy (restructure)    │
    │  - UPDATE tasks (reassign/archive)       │
    │  - UPDATE schedules SET enabled=0        │
    │  - INSERT INTO audit_log                 │
    └────────┬────────────────────────────────┘
             │
             ▼
    ┌─────────────────────────────────────────┐
    │  Filesystem Operations:                  │
    │  - Archive agent directory               │
    │  - Move to data/agents/terminated/       │
    └─────────────────────────────────────────┘
```

---

## Multi-Perspective AI Analysis

### Architecture

The multi-perspective analysis system implements 8 specialized AI agents that analyze decisions from different viewpoints in parallel.

```
                    ┌──────────────────────┐
                    │ Decision Context     │
                    │ (hire/fire/major op) │
                    └──────────┬───────────┘
                               │
                               ▼
                ┌──────────────────────────────────┐
                │   MultiPerspectiveAnalysis       │
                │   .analyze(context)              │
                └──────────────┬───────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
                    ▼                     ▼
        ┌───────────────────────┐  ┌──────────────┐
        │ Check Analysis Cache  │  │              │
        └───────────┬───────────┘  │              │
                    │               │              │
            ┌───────┴────────┐     │              │
            │                │     │              │
          CACHE            MISS    │              │
           HIT              │      │              │
            │               ▼      │              │
            │     ┌────────────────▼──────────┐  │
            │     │ ProviderFactory            │  │
            │     │ .createWithHealthCheck()   │  │
            │     └────────┬───────────────────┘  │
            │              │                       │
            │     ┌────────┴───────────┐          │
            │     │                    │          │
            │  PRIMARY              FALLBACK      │
            │     │                    │          │
            │     ▼                    ▼          │
            │  ┌─────────┐      ┌──────────┐     │
            │  │Healthy? │      │ Healthy? │     │
            │  └────┬────┘      └─────┬────┘     │
            │       │                 │          │
            │      YES               YES         │
            │       │                 │          │
            │       └────────┬────────┘          │
            │                │                   │
            │                ▼                   │
            │     ┌──────────────────────┐      │
            │     │ Execute 8 Agents in  │      │
            │     │ Parallel (Promise.all)│     │
            │     └──────────┬───────────┘      │
            │                │                   │
            │       ┌────────┴────────┐          │
            │       │                 │          │
            │       ▼                 ▼          │
            │  ┌──────────┐     ┌──────────┐    │
            │  │Security  │     │Financial │    │
            │  │Agent     │ ... │Agent     │    │
            │  └──────┬───┘     └─────┬────┘    │
            │         │               │          │
            │         └───────┬───────┘          │
            │                 │                  │
            │                 ▼                  │
            │      ┌──────────────────────┐     │
            │      │ Aggregate Results:    │     │
            │      │ - Calculate variance  │     │
            │      │ - Compute confidence  │     │
            │      │ - Synthesize summary  │     │
            │      │ - Apply decision rules│     │
            │      └──────────┬───────────┘     │
            │                 │                  │
            │                 ▼                  │
            │      ┌──────────────────────┐     │
            │      │ Store in Cache       │     │
            │      └──────────┬───────────┘     │
            │                 │                  │
            └─────────────────┼──────────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │ MultiPerspectiveResult│
                   │ - decision: approve   │
                   │ - confidence: 0.87    │
                   │ - perspectives: [8]   │
                   │ - summary: "..."      │
                   └──────────────────────┘
```

### 8 Perspective Agents

#### 1. Security Agent

**Focus**: Identifies security risks, attack vectors, and vulnerabilities.

**Analysis Includes:**
- OWASP Top 10 vulnerabilities
- Authentication/authorization risks
- Data exposure risks
- Compliance implications (GDPR, SOC 2, HIPAA)
- Encryption requirements
- Audit trail adequacy

**Example Output:**
```
Recommendation: CONDITIONAL_APPROVE
Confidence: 0.85

Risks Identified:
- New agent will handle PII without encryption at rest
- No audit logging for data access
- Missing rate limiting on API endpoints

Recommendations:
- Enable database encryption before deployment
- Implement audit logging for all PII access
- Add rate limiting (100 req/min per IP)

If conditions met: APPROVE
```

#### 2. Architecture Agent

**Focus**: Evaluates system design, scalability, and maintainability.

**Analysis Includes:**
- SOLID principles adherence
- Scalability implications
- Technical debt assessment
- Coupling and cohesion
- Performance impact
- Maintenance burden

**Example Output:**
```
Recommendation: APPROVE
Confidence: 0.92

Architecture Assessment:
+ Clean separation of concerns
+ Well-defined interfaces
+ Testable design
- Potential N+1 query issue in task loading
- High cyclomatic complexity in validation logic

Suggestions:
- Add database indexes for task queries
- Refactor validation into smaller functions
```

#### 3. Simplicity Agent

**Focus**: Assesses complexity and suggests simplification.

**Analysis Includes:**
- YAGNI (You Aren't Gonna Need It) violations
- KISS (Keep It Simple, Stupid) principle
- Cognitive load
- Over-engineering detection
- Abstraction levels
- Code duplication

**Example Output:**
```
Recommendation: CONDITIONAL_APPROVE
Confidence: 0.78

Complexity Concerns:
- Introducing 3 new abstraction layers for simple CRUD
- Configuration has 47 options, only 5 are commonly used
- Can be simplified by 40% without losing functionality

Simplification Opportunities:
- Collapse AbstractFactory + ConcreteFactory into single factory
- Remove configuration options with <1% usage
- Use convention over configuration for defaults
```

#### 4. Financial Agent

**Focus**: Analyzes cost implications and ROI.

**Analysis Includes:**
- Direct costs (compute, storage, API calls)
- Opportunity costs
- TCO (Total Cost of Ownership)
- ROI projections
- Cost-benefit analysis
- Resource efficiency

**Example Output:**
```
Recommendation: APPROVE
Confidence: 0.90

Financial Analysis:
+ Expected ROI: 320% over 6 months
+ Reduces manual work by 15 hours/week
+ One-time cost: $5,000 (development)
+ Ongoing cost: $200/month (infrastructure)

Cost Breakdown:
- AI API calls: $150/month (Claude)
- Database hosting: $30/month (Supabase)
- Monitoring: $20/month (Datadog)

Break-even: 2.1 months
```

#### 5. Marketing Agent

**Focus**: Considers market impact and positioning.

**Analysis Includes:**
- Competitive positioning
- Market differentiation
- User value proposition
- GTM (Go-To-Market) implications
- Messaging clarity
- Market timing

**Example Output:**
```
Recommendation: APPROVE
Confidence: 0.88

Market Assessment:
+ First-mover advantage in AI org management
+ Clear differentiation from competitors
+ Strong value proposition for enterprises
- Market education required (new category)

Positioning Strategy:
- Target: Engineering leaders at 100-1000 person companies
- Message: "Automate your engineering organization"
- Competitive moat: Multi-perspective decision quality
```

#### 6. UX Agent

**Focus**: Evaluates user experience and usability.

**Analysis Includes:**
- WCAG accessibility compliance
- User journey friction points
- Cognitive load on users
- Error handling and messaging
- Onboarding flow
- Documentation clarity

**Example Output:**
```
Recommendation: CONDITIONAL_APPROVE
Confidence: 0.82

UX Concerns:
- 7-step onboarding flow (recommended: 3 steps)
- Error messages use technical jargon
- No visual feedback for async operations
+ Clear navigation hierarchy
+ Consistent design patterns

Improvement Recommendations:
- Simplify onboarding to: Sign up → Set goal → Hire first agent
- Rewrite errors in plain language
- Add loading spinners and progress indicators
```

#### 7. Growth Agent

**Focus**: Projects scalability and viral potential.

**Analysis Includes:**
- AARRR metrics (Acquisition, Activation, Retention, Revenue, Referral)
- Viral coefficient potential
- PLG (Product-Led Growth) opportunities
- Network effects
- Scaling bottlenecks
- Adoption barriers

**Example Output:**
```
Recommendation: APPROVE
Confidence: 0.86

Growth Projections:
+ Viral loop: Users hire agents → agents produce value → users invite team
+ Estimated viral coefficient: 1.4 (sustainable growth)
+ Low friction activation (< 5 minutes to first value)
- Scaling bottleneck: Database at 10K+ concurrent agents

Growth Strategies:
- Add team invitation flow with pre-configured templates
- Implement usage-based pricing (aligns incentives)
- Build public agent marketplace (network effects)
```

#### 8. Emotional Agent

**Focus**: Considers human factors and team morale.

**Analysis Includes:**
- Developer experience (DX)
- Team morale impact
- Burnout risks
- Psychological safety
- Work-life balance
- Cognitive load on team

**Example Output:**
```
Recommendation: APPROVE
Confidence: 0.91

Emotional Impact Assessment:
+ Reduces toil and repetitive work (high morale boost)
+ Clear ownership and accountability (reduces stress)
+ Autonomy for agents (psychological safety)
- Initial learning curve may cause frustration
- Concern about job replacement (address proactively)

Recommendations:
- Frame as "augmentation" not "replacement"
- Provide comprehensive training and support
- Celebrate early wins to build confidence
```

### Decision Synthesis

After all 8 agents complete, the system synthesizes their recommendations:

#### Synthesis Rules

1. **Strong Rejection Rule**
   - If ANY agent has confidence > 0.8 and recommends REJECT
   - → **REJECT** (veto power for high-confidence risks)

2. **Majority Approval Rule**
   - If >50% of agents recommend APPROVE
   - → **APPROVE** (cap confidence at 0.95 to maintain caution)

3. **Conditional Approval Rule**
   - If any agent recommends CONDITIONAL_APPROVE
   - → **CONDITIONAL_APPROVE** (multiply confidence by 0.9)
   - Include all conditions in executive summary

4. **No Consensus Rule**
   - If no clear majority (ties, mixed recommendations)
   - → **REVIEW_REQUIRED** (flag for human decision)

5. **Rejection Rule**
   - If more REJECT than APPROVE
   - → **REJECT**

#### Confidence Calculation

```typescript
// Calculate variance across agent confidence scores
const variance = calculateVariance(agentConfidences);

// Confidence inversely related to variance
// Low variance = high agreement = high confidence
const overallConfidence = 1 - Math.sqrt(variance);

// Cap at 0.95 to maintain healthy skepticism
return Math.min(overallConfidence, 0.95);
```

#### Executive Summary

The system generates a concise executive summary:

```markdown
## Executive Summary

**Decision**: CONDITIONAL_APPROVE
**Overall Confidence**: 0.84

### Key Insights

**Support (6/8 agents approve):**
- Strong business case (ROI: 320%, break-even: 2.1 months)
- Clean architecture with good separation of concerns
- Positive user experience with clear value proposition
- High growth potential (viral coefficient: 1.4)

**Concerns (2/8 agents conditional):**
- Security: PII encryption required before deployment
- Simplicity: 3 abstraction layers can be reduced to 1

**Conditions for Approval:**
1. Enable database encryption for PII (Security)
2. Simplify factory pattern (Simplicity)
3. Add audit logging for data access (Security)

**Recommendation**: Proceed with implementation after addressing security and simplicity conditions.
```

### Caching and History

#### Analysis Cache

Identical decision contexts return cached results:

```typescript
const cacheKey = hashContext(context);
const cached = analysisCache.get(cacheKey);

if (cached && !isStale(cached)) {
  return cached.result;
}
```

**Cache Invalidation:**
- Time-based: 24 hours
- Event-based: Config changes, provider changes
- Manual: Clear cache command

#### Analysis History

All analyses are persisted to disk:

```
data/analysis_history/
├── 2026-01-20/
│   ├── hire_vp-engineering.json
│   ├── fire_director-backend.json
│   └── delegate_task-123.json
└── 2026-01-19/
    └── hire_senior-dev.json
```

**Use Cases:**
- Learning from past decisions
- Audit trail for compliance
- Training data for improving analysis

---

## Agent Adapter System

### Adapter Interface

All framework adapters implement the `FrameworkAdapter` interface:

```typescript
interface FrameworkAdapter {
  // Metadata
  name: string;
  version: string;

  // Core execution
  executeAgent(
    agentId: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  // Capabilities
  supportsFeature(feature: string): boolean;
  getCapabilities(): Capability[];

  // Health
  healthCheck(): Promise<boolean>;
}

interface ExecutionContext {
  agentId: string;
  config: AgentConfig;
  tasks: Task[];
  messages: Message[];
  workspace: WorkspaceFiles;
  triggerId?: string;  // For reactive mode
}

interface ExecutionResult {
  success: boolean;
  duration: number;
  tasksCompleted: number;
  messagesProcessed: number;
  decisions: Decision[];  // Hire/fire/delegate actions
  error?: string;
}
```

### ClaudeCodeAdapter Implementation

Primary adapter for Claude Code CLI.

#### Features

- **CLI Wrapping**: Spawns Claude Code CLI as child process
- **Prompt Building**: Constructs dynamic prompts based on execution mode
- **Timeout Protection**: Kills runaway executions (default: 60 minutes)
- **Retry Logic**: Retries transient errors (network, rate limits)
- **Environment Injection**: Sets ANTHROPIC_BASE_URL for provider routing

#### Prompt Templates

##### Continuous Mode Prompt

```typescript
const continuousPrompt = `
You are ${config.display_name}, ${config.role}.

Your main goal: ${config.main_goal}

You report to: ${config.reporting_to || 'none (CEO)'}
Your subordinates: ${config.subordinates.join(', ') || 'none'}

Current Tasks (${tasks.length}):
${tasks.map(t => `- [${t.status}] ${t.title}`).join('\n')}

Unread Messages (${messages.length}):
${messages.map(m => `- From ${m.from}: ${m.subject}`).join('\n')}

Instructions:
1. Review all tasks and prioritize
2. Make progress on high-priority tasks
3. Respond to urgent messages
4. Delegate tasks to subordinates if appropriate
5. Hire new subordinates if needed to achieve goals
6. Update task status and workspace

Your workspace is at: ${workspacePath}
Write all notes and research to workspace/

Available commands:
- hire <role> <goal>
- delegate <task_id> <subordinate_id>
- complete <task_id>
- respond <message_id> <response>

Work autonomously. Make decisions. Update state.
`;
```

##### Reactive Mode Prompt

```typescript
const reactivePrompt = `
You are ${config.display_name}, ${config.role}.

You received an urgent message:

From: ${message.from}
Channel: ${message.channel}
Priority: ${message.priority}
Subject: ${message.subject}

Message:
${message.body}

Context:
- Your role: ${config.role}
- Your goal: ${config.main_goal}
- Current tasks: ${tasks.length}
- Team size: ${config.subordinates.length}

Instructions:
1. Analyze the message and determine appropriate action
2. If it requires a task, create it
3. If it requires a response, write it
4. If it requires escalation, message your manager
5. If it's a major decision, analyze carefully before acting

Respond promptly and appropriately.
`;
```

#### Execution Flow

```typescript
async executeAgent(
  agentId: string,
  mode: ExecutionMode,
  context: ExecutionContext
): Promise<ExecutionResult> {
  // 1. Build prompt based on mode
  const prompt = this.buildPrompt(mode, context);

  // 2. Set environment variables
  const env = {
    ...process.env,
    ANTHROPIC_BASE_URL: this.config.aiProviderEndpoint,
    ANTHROPIC_API_KEY: this.config.aiProviderApiKey,
  };

  // 3. Spawn child process
  const child = spawn('claude-code', ['--prompt', prompt], {
    env,
    cwd: context.workspace,
    timeout: this.config.executionTimeout,
  });

  // 4. Monitor execution
  const result = await this.monitorExecution(child);

  // 5. Parse and return result
  return this.parseResult(result);
}
```

### AdapterRegistry

Manages adapter lifecycle and selection.

#### Features

- **Registration**: Register adapters at runtime
- **Lookup**: Find adapter by name
- **Health Checking**: Verify adapter availability
- **Fallback Selection**: Automatic failover to backup adapter

#### Usage

```typescript
// Register adapters
AdapterRegistry.register(new ClaudeCodeAdapter());
AdapterRegistry.register(new AgentOSAdapter());

// Get healthy adapter (with fallback)
const adapter = await AdapterRegistry.getHealthyAdapter(
  primaryName: 'claude-code',
  fallbackName: 'agentOS'
);

// Execute
const result = await adapter.executeAgent(agentId, mode, context);
```

---

## Scheduler and Execution

### Scheduler Daemon

**Location**: `packages/scheduler/src/daemon.ts`

Central polling loop that executes agents based on schedules.

#### Main Loop

```typescript
async function schedulerLoop() {
  while (true) {
    try {
      // 1. Query ready schedules
      const readySchedules = await db.query(`
        SELECT * FROM schedules
        WHERE next_execution_at <= ?
        AND enabled = 1
      `, [Date.now()]);

      // 2. For each schedule, spawn execution
      for (const schedule of readySchedules) {
        await spawnExecution(schedule);
      }

      // 3. Run maintenance jobs
      await runMaintenanceJobs();

      // 4. Sleep 60 seconds
      await sleep(60000);

    } catch (error) {
      logger.error('Scheduler error', { error });
      await sleep(60000);  // Continue despite errors
    }
  }
}
```

#### Smart Spawning

Continuous schedules only spawn if work is pending:

```typescript
async function shouldSpawnContinuous(agentId: string): Promise<boolean> {
  // Check if tasks pending
  const pendingTasks = await db.query(`
    SELECT COUNT(*) as count
    FROM tasks
    WHERE agent_id = ?
    AND status IN ('pending', 'in_progress')
  `, [agentId]);

  // Check if unread messages
  const unreadMessages = await db.query(`
    SELECT COUNT(*) as count
    FROM messages
    WHERE to_agent_id = ?
    AND read = 0
  `, [agentId]);

  // Spawn if work exists
  return pendingTasks.count > 0 || unreadMessages.count > 0;
}
```

**Benefits:**
- Saves compute cycles when idle
- Reduces unnecessary AI API calls
- Maintains responsiveness when needed

### Schedule Types

#### 1. Continuous

Runs when work is pending, with minimum interval.

```json
{
  "type": "continuous",
  "min_interval_minutes": 60,
  "smart_spawning": true
}
```

#### 2. Cron

Time-based scheduling with cron expressions.

```json
{
  "type": "cron",
  "cron_expression": "0 9 * * MON-FRI",
  "timezone": "America/New_York",
  "task": "Daily standup review"
}
```

#### 3. Reactive

Event-driven from external sources.

```json
{
  "type": "reactive",
  "channels": ["slack", "email"],
  "priority": 20
}
```

### Maintenance Jobs

Automated cleanup and monitoring tasks.

#### 1. Task Archival

Archives completed tasks older than 7 days.

```typescript
async function archiveOldTasks() {
  const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);

  const oldTasks = await db.query(`
    SELECT * FROM tasks
    WHERE status IN ('completed', 'cancelled')
    AND updated_at < ?
  `, [cutoff]);

  for (const task of oldTasks) {
    await moveToArchive(task);
  }
}
```

#### 2. Archive Compression

Compresses archives older than 90 days.

```typescript
async function compressOldArchives() {
  const cutoff = Date.now() - (90 * 24 * 60 * 60 * 1000);

  const archiveDirs = await findArchives(cutoff);

  for (const dir of archiveDirs) {
    await compressDirectory(dir, `${dir}.tar.gz`);
    await deleteDirectory(dir);
  }
}
```

#### 3. Deadlock Monitoring

Detects and alerts on task deadlocks.

```typescript
async function detectDeadlocks() {
  // Find tasks blocked by other tasks
  const blockedTasks = await db.query(`
    SELECT * FROM tasks
    WHERE blocked_by IS NOT NULL
    AND status = 'blocked'
  `);

  // Build dependency graph
  const graph = buildDependencyGraph(blockedTasks);

  // Detect cycles
  const cycles = detectCycles(graph);

  if (cycles.length > 0) {
    await alertDeadlock(cycles);
  }
}
```

---

## Snapshot and Rollback

### Snapshot System

**Location**: `packages/common/src/db/snapshot.ts`

Point-in-time database backups with metadata.

#### Features

- **Atomic Snapshots**: Full database copy with transaction safety
- **Metadata Tracking**: Reason, timestamp, schema version
- **Validation**: Integrity checks before and after snapshot
- **Automatic Cleanup**: Keep N most recent snapshots
- **Compression**: Optional gzip compression for storage efficiency

#### Snapshot Structure

```
data/snapshots/
├── snapshot_2026-01-20T14-30-00_hire-vp-eng.db
├── snapshot_2026-01-20T10-15-00_init.db
└── snapshot_2026-01-19T16-45-00_fire-director.db
```

#### Snapshot Metadata

Stored in `snapshot_metadata` table:

```sql
CREATE TABLE snapshot_metadata (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  reason TEXT,
  file_size INTEGER,
  schema_version INTEGER,
  agent_id TEXT,
  compressed INTEGER DEFAULT 0
);
```

### Creating Snapshots

#### Automatic Snapshots

Snapshots are automatically created before:
- Agent hiring
- Agent firing
- Major configuration changes
- Critical operations

```typescript
// Before hiring
const snapshotId = await createSnapshot({
  reason: `before_hire_${agentId}`,
  agentId: parentId
});

// Perform hire
await hireAgent(params);

// Keep snapshot for rollback
```

#### Manual Snapshots

Via CLI:

```bash
# Create snapshot
recursivemanager snapshot create --reason "before_refactor"

# List snapshots
recursivemanager snapshot list

# Restore from snapshot
recursivemanager snapshot restore <snapshot_id>
```

### Rollback System

**Location**: `packages/cli/src/commands/rollback.ts`

Restore system to previous state.

#### Interactive Rollback

```bash
recursivemanager rollback
```

Displays interactive menu:
```
? Select snapshot to restore:
  > 2026-01-20 14:30 - Before hiring VP of Engineering
    2026-01-20 10:15 - System initialization
    2026-01-19 16:45 - Before firing Director of Backend
```

#### Direct Rollback

```bash
recursivemanager rollback <snapshot_id>
```

#### Rollback Flow

```
1. Select snapshot to restore
   ↓
2. Validate snapshot integrity
   ↓
3. Create backup of current state
   ↓
4. Stop scheduler daemon
   ↓
5. Close all database connections
   ↓
6. Replace database file
   ↓
7. Verify restore success
   ↓
8. Restart scheduler daemon
   ↓
9. Confirm agents in expected state
```

#### Rollback Safety

- **Pre-Restore Backup**: Always backup current state first
- **Validation**: Verify snapshot integrity before restore
- **Transaction Safety**: Stop all writes during restore
- **Verification**: Confirm success before resuming operations
- **Fallback**: Keep backup if restore fails

---

## Configuration Management

### Configuration Layers

RecursiveManager uses a layered configuration approach:

```
┌─────────────────────────────────────────────┐
│         1. Environment Variables             │
│      (highest priority - .env file)          │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         2. Agent Configuration               │
│           (config.json per agent)            │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         3. Schedule Configuration            │
│          (schedule.json per agent)           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│         4. Runtime Metadata                  │
│          (metadata.json per agent)           │
└─────────────────────────────────────────────┘
```

### 1. Environment Variables

**Location**: `.env` file in project root

#### AI Provider Configuration

```bash
# Primary AI provider
AI_PROVIDER=aiceo-gateway              # aiceo-gateway | anthropic-direct | openai-direct | custom
AI_FALLBACK_PROVIDER=anthropic-direct  # Fallback if primary fails

# AICEO Gateway (preferred)
AICEO_GATEWAY_ENDPOINT=http://localhost:4000/api/glm/proxy
AICEO_GATEWAY_API_KEY=your-key-here

# Anthropic Direct (fallback)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_BASE_URL=https://api.anthropic.com

# OpenAI Direct (optional)
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com

# Custom Provider (optional)
CUSTOM_PROVIDER_ENDPOINT=https://your-api.com
CUSTOM_PROVIDER_API_KEY=your-key
```

#### Database Configuration

```bash
DATABASE_URL=data/recursive_manager.db
DATABASE_ENCRYPTION_KEY=your-32-byte-key-here
DATABASE_WAL_MODE=true
```

#### Logging Configuration

```bash
LOG_LEVEL=info                    # debug | info | warn | error
LOG_FILE=logs/recursive_manager.log
LOG_JSON=false                    # JSON format for structured logging
```

#### Execution Configuration

```bash
EXECUTION_TIMEOUT=3600000         # 60 minutes (milliseconds)
MAX_CONCURRENT_EXECUTIONS=10
EXECUTION_RETRY_ATTEMPTS=3
EXECUTION_RETRY_DELAY=5000        # 5 seconds
```

#### Scheduler Configuration

```bash
SCHEDULER_POLL_INTERVAL=60000     # 60 seconds
SCHEDULER_SMART_SPAWNING=true
SCHEDULER_MIN_INTERVAL=3600000    # 1 hour
```

#### Metrics Configuration

```bash
METRICS_ENABLED=true
METRICS_PORT=9090
METRICS_PATH=/metrics
```

### 2. Agent Configuration

**Location**: `data/agents/{agent_id}/config.json`

#### Structure

```json
{
  "id": "vp-engineering",
  "display_name": "VP of Engineering",
  "role": "Vice President of Engineering",
  "main_goal": "Build and scale a world-class engineering organization",

  "capabilities": {
    "canHire": true,
    "canFire": true,
    "canDelegate": true,
    "canApproveHiring": true,
    "maxSubordinates": 10
  },

  "framework": {
    "primary": "claude-code",
    "fallback": "agentOS"
  },

  "hierarchy": {
    "reporting_to": "ceo",
    "subordinates": [
      "director-backend",
      "director-frontend",
      "director-infra"
    ]
  },

  "budget": {
    "monthly_limit": 10000,
    "current_spend": 3421,
    "hiring_budget": 5000
  },

  "constraints": {
    "max_hiring_per_day": 3,
    "require_analysis": true,
    "auto_approve_threshold": 0.9
  }
}
```

### 3. Schedule Configuration

**Location**: `data/agents/{agent_id}/schedule.json`

#### Structure

```json
{
  "continuous": {
    "enabled": true,
    "min_interval_minutes": 60,
    "max_concurrent_tasks": 5,
    "smart_spawning": true
  },

  "time_based": [
    {
      "name": "daily_standup",
      "cron": "0 9 * * MON-FRI",
      "timezone": "America/New_York",
      "task": "Review team progress and identify blockers"
    },
    {
      "name": "weekly_review",
      "cron": "0 16 * * FRI",
      "timezone": "America/New_York",
      "task": "Compile weekly progress report for CEO"
    }
  ],

  "reactive": {
    "slack": {
      "enabled": true,
      "channels": ["#engineering", "#executive"],
      "priority": 20
    },
    "telegram": {
      "enabled": false
    },
    "email": {
      "enabled": true,
      "addresses": ["engineering@company.com"],
      "priority": 10
    }
  },

  "pause_conditions": {
    "manager_paused": true,
    "out_of_budget": true,
    "maintenance_window": false
  },

  "dependencies": [
    "ceo"  // Don't run if CEO schedule hasn't run
  ]
}
```

### 4. Runtime Metadata

**Location**: `data/agents/{agent_id}/metadata.json`

#### Structure

```json
{
  "status": "active",
  "created_at": "2026-01-15T10:00:00Z",
  "hired_by": "ceo",

  "execution_stats": {
    "total_executions": 127,
    "successful_executions": 124,
    "failed_executions": 3,
    "average_duration_seconds": 145,
    "last_execution": "2026-01-20T14:30:00Z",
    "last_success": "2026-01-20T14:30:00Z"
  },

  "task_stats": {
    "total_created": 89,
    "completed": 76,
    "in_progress": 8,
    "pending": 5,
    "cancelled": 0
  },

  "hiring_stats": {
    "agents_hired": 3,
    "agents_fired": 0,
    "hiring_budget_used": 3500
  },

  "spending": {
    "total_spend": 3421,
    "monthly_spend": 1242,
    "ai_api_calls": 4521,
    "average_cost_per_execution": 27
  },

  "health": {
    "status": "healthy",
    "last_health_check": "2026-01-20T14:35:00Z",
    "issues": []
  }
}
```

### Configuration Validation

All configuration files are validated against JSON schemas:

**Location**: `packages/common/src/schema-validation.ts`

#### Validation Process

```typescript
// Load schema
const schema = loadSchema('agent-config.schema.json');

// Validate config
const result = validateConfig(config, schema);

if (!result.valid) {
  throw new ValidationError(result.errors);
}
```

#### Business Logic Validation

Beyond JSON schema, business rules are enforced:

- **Hiring Budget**: Cannot exceed monthly limit
- **Hiring Cycles**: Detect A hires B hires A
- **Subordinate Limits**: Enforce maxSubordinates
- **Permission Checks**: Verify canHire, canFire capabilities
- **Rate Limiting**: Max hiring per day

---

## Design Patterns

### 1. Adapter Pattern

**Used In**: Framework adapters (ClaudeCodeAdapter, AgentOSAdapter)

**Benefits:**
- Abstracts AI framework implementation details
- Enables framework switching without core changes
- Facilitates testing with mock adapters

### 2. Factory Pattern

**Used In**: ProviderFactory (AI provider creation)

**Benefits:**
- Centralizes provider instantiation logic
- Enables health checking and fallback
- Simplifies provider configuration

### 3. Worker Pool Pattern

**Used In**: ExecutionPool (concurrent agent execution)

**Benefits:**
- Controls concurrency limits
- Implements task queuing with priorities
- Enforces resource quotas

### 4. Mutex/Lock Pattern

**Used In**: AgentLock (prevent concurrent execution)

**Benefits:**
- Prevents race conditions
- Ensures agent state consistency
- Enables fail-fast detection

### 5. Dependency Graph Pattern

**Used In**: DependencyGraph (task dependencies)

**Benefits:**
- Guarantees execution order
- Detects circular dependencies
- Prevents deadlocks

### 6. Snapshot Pattern

**Used In**: Database snapshots (rollback capability)

**Benefits:**
- Enables point-in-time recovery
- Provides audit trail
- Facilitates experimentation (rollback failed experiments)

### 7. Observer Pattern

**Used In**: Metrics recording (Prometheus), Audit logging

**Benefits:**
- Decouples monitoring from business logic
- Enables multiple observers (metrics + logs)
- Facilitates testing (mock observers)

### 8. Strategy Pattern

**Used In**: Fire strategies (reassign/promote/cascade), Multi-perspective agents

**Benefits:**
- Encapsulates algorithms
- Enables runtime strategy selection
- Simplifies testing individual strategies

### 9. Repository Pattern

**Used In**: Database access layer

**Benefits:**
- Abstracts database implementation
- Centralizes query logic
- Enables database switching

### 10. Event-Driven Pattern

**Used In**: Reactive execution (external messages)

**Benefits:**
- Decouples message sources from processing
- Enables async processing
- Supports multiple event sources

---

## Security Architecture

### Defense in Depth

RecursiveManager implements multiple security layers:

```
┌─────────────────────────────────────────────────────────┐
│         1. Input Validation (JSON Schema + AJV)          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│         2. Path Traversal Protection                     │
│         (resolve paths, check for ../)                   │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│         3. SQL Injection Prevention                      │
│         (prepared statements, parameterized queries)     │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│         4. Encryption at Rest (AES-256-GCM)             │
│         (sensitive database fields)                      │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│         5. Audit Logging (immutable, append-only)       │
│         (all critical operations)                        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│         6. Permission-Based Access Control               │
│         (canHire, canFire, canDelegate)                  │
└─────────────────────────────────────────────────────────┘
```

### Input Validation

**JSON Schema Validation:**

All input validated against strict schemas:

```typescript
// Agent config schema
const agentConfigSchema = {
  type: 'object',
  required: ['id', 'role', 'main_goal'],
  properties: {
    id: {
      type: 'string',
      pattern: '^[a-z0-9-]+$',  // Slug format only
      maxLength: 50
    },
    role: {
      type: 'string',
      minLength: 3,
      maxLength: 100
    },
    // ... more fields
  },
  additionalProperties: false  // Reject unknown fields
};
```

### Path Traversal Protection

All file operations validate paths:

```typescript
function validatePath(userPath: string): string {
  const resolved = path.resolve(basePath, userPath);

  // Ensure path is within base directory
  if (!resolved.startsWith(basePath)) {
    throw new SecurityError('Path traversal detected');
  }

  // Reject ../ in path
  if (userPath.includes('../')) {
    throw new SecurityError('Invalid path');
  }

  return resolved;
}
```

### SQL Injection Prevention

All queries use prepared statements:

```typescript
// SAFE: Parameterized query
const agent = await db.query(
  'SELECT * FROM agents WHERE id = ?',
  [agentId]
);

// UNSAFE: String concatenation (NEVER USE)
// const agent = await db.query(
//   `SELECT * FROM agents WHERE id = '${agentId}'`
// );
```

### Encryption at Rest

Sensitive fields encrypted with AES-256-GCM:

```typescript
// Encrypt before storing
const encrypted = encrypt(sensitiveData, encryptionKey);
await db.insert('secrets', { data: encrypted });

// Decrypt when reading
const row = await db.query('SELECT data FROM secrets WHERE id = ?', [id]);
const decrypted = decrypt(row.data, encryptionKey);
```

**Encrypted Fields:**
- API keys
- Passwords
- Tokens
- PII (if configured)

### Audit Logging

Immutable audit trail for all critical operations:

```typescript
await auditLog.record({
  agent_id: 'vp-engineering',
  action: 'hire_agent',
  success: true,
  details: {
    hired_agent_id: 'director-backend',
    role: 'Director of Backend Engineering',
    analysis_confidence: 0.87
  },
  timestamp: Date.now()
});
```

**Logged Actions:**
- Agent hire/fire/pause/resume
- Configuration changes
- Executions (continuous/reactive)
- Decision analysis
- Permission violations

### Permission-Based Access Control

Capabilities enforced at execution time:

```typescript
async function validateHirePermission(agentId: string) {
  const agent = await getAgent(agentId);

  if (!agent.capabilities.canHire) {
    throw new PermissionError(`Agent ${agentId} cannot hire`);
  }

  if (agent.subordinates.length >= agent.capabilities.maxSubordinates) {
    throw new PermissionError(`Agent ${agentId} at max subordinates`);
  }
}
```

---

## Monitoring and Observability

### Metrics System

**Location**: `packages/core/src/execution/metrics.ts`

Prometheus metrics for system observability.

#### Metrics Server

HTTP server exposes metrics on port 9090:

```typescript
const metricsServer = new MetricsServer({
  port: 9090,
  path: '/metrics'
});

await metricsServer.start();
```

Access metrics:
```bash
curl http://localhost:9090/metrics
```

#### Tracked Metrics

##### Counters

```typescript
// Execution counter (labels: agent_id, mode, status)
executionCounter.inc({
  agent_id: 'vp-engineering',
  mode: 'continuous',
  status: 'success'
});

// Task counter (labels: agent_id, status)
tasksCompletedCounter.inc({
  agent_id: 'vp-engineering',
  status: 'completed'
});

// Message counter (labels: agent_id, channel)
messagesProcessedCounter.inc({
  agent_id: 'vp-engineering',
  channel: 'slack'
});
```

##### Gauges

```typescript
// Active executions
activeExecutionsGauge.set(5);

// Queue depth
queueDepthGauge.set(12);

// Agent count (labels: status)
agentCountGauge.set({ status: 'active' }, 47);

// Memory usage
memoryUsageGauge.set(process.memoryUsage().heapUsed);

// CPU usage
cpuUsageGauge.set(process.cpuUsage().user / 1000000);
```

##### Histograms

```typescript
// Execution duration (labels: agent_id, mode)
executionDurationHistogram.observe({
  agent_id: 'vp-engineering',
  mode: 'continuous'
}, durationSeconds);

// Task completion time
taskCompletionHistogram.observe(completionTimeSeconds);
```

#### Example Prometheus Queries

```promql
# Execution success rate
rate(execution_counter{status="success"}[5m]) /
rate(execution_counter[5m])

# Average execution duration
rate(execution_duration_seconds_sum[5m]) /
rate(execution_duration_seconds_count[5m])

# Queue depth alert (>50 pending tasks)
queue_depth_gauge > 50

# Agent error rate
rate(execution_counter{status="failure"}[5m])
```

### Logging System

**Location**: `packages/common/src/logger.ts`

Structured logging with trace ID correlation.

#### Log Levels

```typescript
logger.debug('Detailed debug info', { data });
logger.info('General information', { data });
logger.warn('Warning condition', { data });
logger.error('Error occurred', { error, data });
```

#### Trace ID Correlation

All logs include trace ID for request correlation:

```typescript
const traceId = generateTraceId();

logger.info('Starting execution', {
  traceId,
  agent_id: 'vp-engineering'
});

// ... execution ...

logger.info('Execution complete', {
  traceId,
  agent_id: 'vp-engineering',
  duration: 145
});
```

**Search logs by trace ID:**
```bash
grep "traceId:abc123" recursive_manager.log
```

#### Structured Logging

JSON format for machine parsing:

```json
{
  "timestamp": "2026-01-20T14:30:15.123Z",
  "level": "info",
  "message": "Execution complete",
  "traceId": "abc123",
  "agent_id": "vp-engineering",
  "duration": 145,
  "tasksCompleted": 3
}
```

---

## Extension Points

RecursiveManager is designed for extensibility:

### 1. Custom Framework Adapters

Implement `FrameworkAdapter` interface:

```typescript
class CustomAdapter implements FrameworkAdapter {
  name = 'custom-framework';
  version = '1.0.0';

  async executeAgent(agentId, mode, context) {
    // Custom execution logic
  }

  supportsFeature(feature: string): boolean {
    // Feature support checks
  }

  getCapabilities(): Capability[] {
    // List capabilities
  }

  async healthCheck(): Promise<boolean> {
    // Health check logic
  }
}

// Register
AdapterRegistry.register(new CustomAdapter());
```

### 2. Custom AI Providers

Implement `AIProvider` interface:

```typescript
class CustomProvider implements AIProvider {
  async analyze(prompt: string, agentType: string): Promise<string> {
    // Custom LLM call
  }

  async healthCheck(): Promise<boolean> {
    // Provider health check
  }
}

// Register in ProviderFactory
```

### 3. Custom Perspective Agents

Add new analysis perspectives:

```typescript
class PrivacyAgent implements PerspectiveAgent {
  name = 'privacy';

  async analyze(context: DecisionContext): Promise<PerspectiveResult> {
    // Privacy-focused analysis
    return {
      recommendation: 'CONDITIONAL_APPROVE',
      confidence: 0.85,
      reasoning: '...',
      conditions: ['Add GDPR consent flow']
    };
  }
}

// Register in MultiPerspectiveAnalysis
```

### 4. Custom Maintenance Jobs

Add new scheduler jobs:

```typescript
class CustomJob implements MaintenanceJob {
  name = 'custom-cleanup';
  schedule = '0 2 * * *';  // 2 AM daily

  async execute(): Promise<void> {
    // Custom cleanup logic
  }
}

// Register in Scheduler
```

### 5. Custom Metrics

Add application-specific metrics:

```typescript
const customMetric = new promClient.Counter({
  name: 'custom_operation_total',
  help: 'Total custom operations',
  labelNames: ['operation_type']
});

customMetric.inc({ operation_type: 'special' });
```

---

## Conclusion

RecursiveManager's architecture prioritizes:

1. **Decision Quality**: Multi-perspective analysis ensures high-quality decisions
2. **Scalability**: Worker pool and dependency management enable large organizations
3. **Reliability**: Snapshots, rollback, and audit trails provide safety nets
4. **Observability**: Comprehensive metrics and logging enable debugging and optimization
5. **Extensibility**: Adapter pattern and clear interfaces enable customization

The system models real organizational structures in software, enabling AI agents to work autonomously while maintaining quality, accountability, and recoverability.

---

**For Implementation Details**, see:
- [API Reference](API.md)
- [CLI Guide](CLI.md)
- [Configuration Guide](CONFIGURATION.md)
- [Development Guide](DEVELOPMENT.md)
