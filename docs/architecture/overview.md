# Architecture Overview

RecursiveManager is a hierarchical AI agent system that mimics organizational structures, enabling recursive delegation, autonomous task management, and multi-framework support. Each agent operates as a "person" in a company - hiring subordinates, managing tasks, escalating issues, and maintaining its own workspace with file-based persistence and fresh memory on each execution.

**Core Philosophy**: Quality over cost. Multi-perspective analysis before all decisions. Stateless execution with rich file-based state.

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

### 1. CLI Tool (`cli/`)

**Purpose**: User-facing interface for all agent operations

**Commands**:
- `recursive-manager init` - Initialize system
- `recursive-manager hire` - Create new agent
- `recursive-manager fire` - Delete agent
- `recursive-manager message` - Send message to agent
- `recursive-manager run` - Manually trigger agent
- `recursive-manager status` - View org chart
- `recursive-manager logs` - View agent logs

### 2. Scheduler Daemon (`scheduler/`)

**Purpose**: Time-based and event-based agent execution

**Responsibilities**:
- Scan all `agents/*/schedule.json` files
- Spawn agents at scheduled times
- Handle reactive triggers (Slack, Telegram, etc.)
- Manage continuous task execution (only when work available)
- Monitor agent health

### 3. Core Orchestrator (`core/`)

**Purpose**: Framework-agnostic agent execution logic

**Responsibilities**:
- Load agent configuration
- Prepare execution context
- Invoke framework adapter
- Handle execution results
- Update file-based state
- Multi-perspective analysis coordination

### 4. Framework Adapters (`adapters/`)

**Purpose**: Interface with different AI coding frameworks

**Initial Support**:
- Claude Code (primary)
- OpenCode (secondary)

**Interface Contract**: All adapters must implement:
```typescript
interface FrameworkAdapter {
  executeAgent(agentId: string, mode: 'continuous' | 'reactive', context: ExecutionContext): Promise<ExecutionResult>
  supportsFeature(feature: string): boolean
  getCapabilities(): Capability[]
}
```

### 5. Messaging Layer (`messaging/`)

**Purpose**: Standardized message handling across platforms

**Modules**:
- Slack integration
- Telegram integration
- Email integration
- Internal message queue

**Interface Contract**:
```typescript
interface MessagingAdapter {
  pollMessages(): Promise<Message[]>
  sendMessage(agentId: string, message: string): Promise<void>
  markAsRead(messageId: string): Promise<void>
}
```

## Architectural Principles

### 1. Modularity

Each component must be independently:
- **Testable**: Unit tests without full system
- **Replaceable**: Swap implementations without breaking others
- **Scalable**: Handle increased load independently

### 2. Separation of Concerns

```
┌─ Presentation Layer ──────────────────────┐
│  CLI, Web UI, API                          │
└────────────────┬───────────────────────────┘
                 │
┌─ Application Layer ───────────────────────┐
│  Business logic, orchestration             │
└────────────────┬───────────────────────────┘
                 │
┌─ Domain Layer ────────────────────────────┐
│  Agent entities, task management           │
└────────────────┬───────────────────────────┘
                 │
┌─ Infrastructure Layer ────────────────────┐
│  File system, messaging, framework adapters│
└────────────────────────────────────────────┘
```

### 3. Dependency Injection

```typescript
// Bad: Hard-coded dependencies
class AgentOrchestrator {
  constructor() {
    this.adapter = new ClaudeCodeAdapter(); // Tight coupling!
  }
}

// Good: Injected dependencies
class AgentOrchestrator {
  constructor(
    private adapter: FrameworkAdapter,
    private messaging: MessagingAdapter,
    private storage: StorageAdapter
  ) {}
}
```

## Scalability Considerations

### File System Limits

**Problem**: 10,000 agents = 10,000 directories

**Solution**: Sharding
```
agents/
  00-0f/  # First 16 agents
    agent-001/
    agent-002/
  10-1f/  # Next 16 agents
    agent-016/
    agent-017/
```

### Concurrent Execution

**Problem**: 100 agents running simultaneously

**Solution**: Worker pool pattern
```typescript
class ExecutionPool {
  private maxConcurrent: number = 10;
  private queue: AgentTask[] = [];
  private active: Set<string> = new Set();

  async execute(task: AgentTask): Promise<void> {
    if (this.active.size >= this.maxConcurrent) {
      await this.waitForSlot();
    }

    this.active.add(task.agentId);
    try {
      await this.runAgent(task);
    } finally {
      this.active.delete(task.agentId);
    }
  }
}
```

### Scheduler Performance

**Problem**: Scanning 10,000 schedule files every 5 seconds

**Solution**: Event-driven scheduling
```typescript
// Instead of polling:
setInterval(() => scanAllSchedules(), 5000); // O(n) every 5s

// Use priority queue:
class SchedulerQueue {
  private heap: MinHeap<ScheduledEvent>;

  nextExecution(): ScheduledEvent {
    return this.heap.peek(); // O(1)
  }

  async processNext(): Promise<void> {
    const next = this.heap.pop(); // O(log n)
    await this.executeAgent(next.agentId);
    this.heap.push(next.reschedule()); // O(log n)
  }
}
```

## Key Architectural Decisions

### Decision 1: File-Based vs Database State

**File-Based Pros**:
- Simple to understand
- Easy to inspect/debug
- No external dependencies
- Git-compatible

**File-Based Cons**:
- Slow for large-scale queries
- No ACID guarantees
- Hard to implement complex relationships

**Hybrid Approach**:
```
Filesystem: Workspace, notes, drafts (agent-owned data)
Database: Metadata, relationships, task indexes (queryable data)

This gives us:
✓ Simple workspace management
✓ Fast queries
✓ ACID compliance where needed
✓ Easy debugging (files + SQL)
```

### Decision 2: Monorepo vs Multi-Repo

**Recommendation**: Monorepo with clear module boundaries

```
RecursiveManager/
  packages/
    cli/                  # CLI tool
    core/                 # Core orchestrator
    scheduler/            # Scheduler daemon
    adapters/
      claude-code/        # Claude Code adapter
      opencode/           # OpenCode adapter
    messaging/
      slack/              # Slack integration
      telegram/           # Telegram integration
    common/               # Shared utilities
  docs/                   # Documentation
  examples/               # Example configurations
```

**Benefits**:
- Shared tooling (TypeScript, linting, testing)
- Easier refactoring across modules
- Single version number
- Atomic changes across boundaries

### Decision 3: Synchronous vs Asynchronous Execution

**Recommendation**: Async-first with sync facades

```typescript
// Core is async
async function executeAgent(id: string): Promise<Result> {
  const agent = await loadAgent(id);
  const context = await prepareContext(agent);
  const result = await runFramework(context);
  await saveState(agent, result);
  return result;
}

// CLI provides sync-looking interface
function cliRun(id: string): void {
  executeAgent(id)
    .then(result => console.log('Success:', result))
    .catch(err => console.error('Failed:', err));
}
```

## Resilience Patterns

### Pattern 1: Circuit Breaker

```typescript
class FrameworkAdapter {
  private failureCount: number = 0;
  private lastFailure: Date | null = null;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  async execute(agent: Agent): Promise<Result> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailure!.getTime() > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker OPEN - framework unavailable');
      }
    }

    try {
      const result = await this.actualExecute(agent);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailure = new Date();
    if (this.failureCount >= 5) {
      this.state = 'OPEN';
      console.error('Circuit breaker opened - too many failures');
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
}
```

### Pattern 2: Retry with Exponential Backoff

```typescript
async function executeWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;

      const backoff = Math.min(1000 * Math.pow(2, attempt), 30000);
      await sleep(backoff);
    }
  }
  throw new Error('Should never reach here');
}
```

### Pattern 3: Graceful Degradation

```typescript
class MessagingLayer {
  async pollMessages(agentId: string): Promise<Message[]> {
    const messages: Message[] = [];

    // Try Slack (preferred)
    try {
      messages.push(...await this.slack.poll(agentId));
    } catch (err) {
      console.warn('Slack unavailable, skipping:', err);
    }

    // Try Telegram (fallback)
    try {
      messages.push(...await this.telegram.poll(agentId));
    } catch (err) {
      console.warn('Telegram unavailable, skipping:', err);
    }

    // Internal messages always work (local)
    messages.push(...await this.internal.poll(agentId));

    return messages;
  }
}
```

## Multi-Perspective Analysis

RecursiveManager uses multi-perspective analysis to evaluate decisions from 8 perspectives:

1. **Simplicity & Developer Experience**: Making complexity approachable
2. **Architecture & Scalability**: Building for 1-1000+ agents
3. **Security & Trust**: Preventing malicious/buggy agents
4. **Testing & Quality Assurance**: Ensuring reliability
5. **Observability & Debugging**: Understanding recursive hierarchies
6. **Documentation & Onboarding**: Learning curve management
7. **DevOps & Operations**: Deployment and maintenance
8. **User Experience**: From beginner to power user

See [Multi-Perspective Analysis](../concepts/multi-perspective-analysis.md) for detailed analysis.

### Key Insights Summary

#### From Simplicity Perspective
- **Progressive Disclosure**: Simple commands for basics, advanced flags for power users
- **Sensible Defaults**: Works out of box for 80% of use cases
- **Clear Error Messages**: Actionable feedback with suggested fixes
- **Pit of Success**: Convention over configuration

#### From Architecture Perspective
- **Hybrid Storage**: Files for workspaces, database for queries
- **Modularity**: Framework-agnostic core, pluggable adapters
- **Scalability**: Worker pool pattern, event-driven scheduling
- **Resilience**: Circuit breakers, retries, graceful degradation

#### From Security Perspective
- **Sandboxing**: Containers with resource limits
- **Permission Model**: Role-based with explicit grants
- **Audit Logging**: Immutable audit trail
- **Threat Mitigation**: Defense against recursion explosion, privilege escalation

#### From Testing Perspective
- **Unit Tests**: 80%+ coverage on all modules
- **Integration Tests**: Key workflows validated
- **E2E Tests**: Full user journeys
- **Performance Tests**: 1000+ agent scalability

#### From Observability Perspective
- **Execution Tracing**: Full trace of recursive execution paths
- **Metrics**: Health scores, success rates, resource usage
- **Debug Tools**: Single command to understand agent state
- **Visualization**: Org chart, task dependencies, execution flow

#### From Documentation Perspective
- **Quickstart**: Running in 5 minutes
- **Tutorials**: Common workflows step-by-step
- **Reference**: Complete CLI/API docs
- **Troubleshooting**: Edge case solutions

#### From DevOps Perspective
- **CI/CD**: Automated testing and releases
- **Deployment**: Single binary, no dependencies
- **Monitoring**: Health checks, alerts
- **Backup/Recovery**: Automated backups, disaster recovery

#### From UX Perspective
- **Guided Setup**: Interactive wizard
- **Intelligent Defaults**: Smart configuration
- **Rich Feedback**: Progress indicators, status updates
- **Powerful When Needed**: Advanced features available but hidden

## Design Recommendations

1. **Start Small, Design Big**: Build for 1-10 agents, but architect for 1000+
2. **Horizontal Scalability**: Use worker pool pattern, not vertical scaling
3. **Hybrid Storage**: Database for queries, files for workspaces
4. **Event-Driven**: Use events for cross-component communication
5. **Resilient by Default**: Circuit breakers, retries, graceful degradation

## Related Documentation

- [File Structure Specification](file-structure.md) - Detailed file and database schemas
- [Multi-Perspective Analysis](../concepts/multi-perspective-analysis.md) - Complete analysis methodology
- [Database Schema](database.md) - Database tables and relationships
- [Development Guide](../development/contributing.md) - Implementation phases and practices
