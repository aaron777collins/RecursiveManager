# Implementation Phases

## Overview

This document breaks down the RecursiveManager implementation into manageable phases with clear dependencies, milestones, and testing requirements. Each phase builds on the previous one and delivers working functionality.

---

## Phase 1: Foundation & Core Infrastructure

**Goal**: Build the foundational components that all other features depend on

**Duration**: 2-3 weeks

**Team Size**: 1-2 developers

### Phase 1.1: Project Setup & Tooling

**Deliverables**:
- [x] GitHub repository created
- [ ] Monorepo structure with Lerna/Turborepo
- [ ] TypeScript configuration
- [ ] ESLint + Prettier
- [ ] Jest testing framework
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Documentation site setup (VitePress/Docusaurus)

**File Structure**:
```
RecursiveManager/
├── packages/
│   ├── common/           # Shared utilities
│   ├── core/             # Core orchestrator
│   ├── cli/              # CLI tool
│   ├── scheduler/        # Scheduler daemon
│   └── adapters/         # Framework adapters
├── docs/                 # Documentation
├── examples/             # Example configurations
├── scripts/              # Build/deployment scripts
├── package.json
├── tsconfig.json
├── .github/workflows/
└── README.md
```

**Dependencies**: None

**Tests**:
- Linter passes
- TypeScript compiles
- CI pipeline runs

---

### Phase 1.2: File System Layer

**Deliverables**:
- [ ] Directory structure creation
- [ ] File I/O utilities (atomic writes, backups)
- [ ] Path resolution (sharding logic)
- [ ] JSON Schema definitions
- [ ] Schema validation utilities

**Key Files**:
```typescript
// packages/common/src/fs/index.ts
export async function atomicWrite(path: string, content: string): Promise<void>
export async function createBackup(path: string): Promise<string>
export function getAgentDirectory(agentId: string): string
export function getTaskPath(agentId: string, taskId: string): string

// packages/common/src/schemas/index.ts
export const agentConfigSchema: JSONSchema
export const scheduleSchema: JSONSchema
export const taskSchema: JSONSchema
export function validateAgentConfig(config: any): AgentConfig
```

**Dependencies**: None

**Tests**:
- [ ] Atomic writes don't lose data on crash
- [ ] Backups created before every write
- [ ] Directory creation with proper permissions
- [ ] Schema validation catches all invalid configs
- [ ] Sharding distributes agents evenly

**Edge Cases Handled**:
- EC-5.1: Disk full
- EC-5.2: File corruption
- EC-5.3: Permission errors

---

### Phase 1.3: Database Layer

**Deliverables**:
- [ ] SQLite database schema
- [ ] Database connection pool
- [ ] Migration system
- [ ] Query utilities
- [ ] Optimistic locking

**Key Files**:
```typescript
// packages/common/src/db/index.ts
export async function initializeDatabase(path: string): Promise<Database>
export async function runMigrations(db: Database): Promise<void>

// packages/common/src/db/queries/agents.ts
export async function createAgent(config: AgentConfig): Promise<string>
export async function getAgent(id: string): Promise<Agent | null>
export async function updateAgent(id: string, updates: Partial<Agent>): Promise<void>
export async function getSubordinates(managerId: string): Promise<Agent[]>

// packages/common/src/db/queries/tasks.ts
export async function createTask(task: Task): Promise<string>
export async function updateTaskStatus(id: string, status: string, version: number): Promise<void>
export async function getActiveTasks(agentId: string): Promise<Task[]>
export async function detectTaskDeadlock(taskId: string): Promise<string[] | null>
```

**Dependencies**: Phase 1.2 (File System Layer)

**Tests**:
- [ ] Migrations run idempotently
- [ ] Optimistic locking prevents race conditions
- [ ] Queries return correct results
- [ ] Connection pool handles concurrency
- [ ] Database recovers from crashes

**Edge Cases Handled**:
- EC-2.4: Task completion race condition
- EC-7.2: Database deadlock

---

### Phase 1.4: Logging & Audit System

**Deliverables**:
- [ ] Structured logging (Winston/Pino)
- [ ] Log rotation
- [ ] Audit log table
- [ ] Audit event recording
- [ ] Log querying utilities

**Key Files**:
```typescript
// packages/common/src/logging/index.ts
export const logger: Logger
export function createAgentLogger(agentId: string): Logger
export async function auditLog(event: AuditEvent): Promise<void>
export async function queryAuditLog(filter: AuditFilter): Promise<AuditEvent[]>
```

**Dependencies**: Phase 1.3 (Database Layer)

**Tests**:
- [ ] Logs are structured and parseable
- [ ] Log rotation works correctly
- [ ] Audit events captured for all operations
- [ ] Query API returns correct events

**Edge Cases Handled**:
- N/A (logging is best-effort)

---

## Phase 2: Core Agent System

**Goal**: Implement basic agent creation, configuration, and lifecycle management

**Duration**: 3-4 weeks

**Team Size**: 2-3 developers

### Phase 2.1: Agent Configuration & Validation

**Deliverables**:
- [ ] Agent config loading
- [ ] Config validation (JSON Schema)
- [ ] Default config generation
- [ ] Config merging (defaults + user overrides)

**Key Files**:
```typescript
// packages/core/src/config/index.ts
export async function loadAgentConfig(agentId: string): Promise<AgentConfig>
export async function saveAgentConfig(agentId: string, config: AgentConfig): Promise<void>
export function generateDefaultConfig(role: string, goal: string): AgentConfig
export function mergeConfigs(base: Partial<AgentConfig>, override: Partial<AgentConfig>): AgentConfig
```

**Dependencies**: Phase 1 (all)

**Tests**:
- [ ] Invalid configs rejected
- [ ] Defaults filled in correctly
- [ ] Config merging prioritizes overrides
- [ ] Recovery from corrupt config files

**Edge Cases Handled**:
- EC-5.2: File corruption (with backup recovery)

---

### Phase 2.2: Agent Lifecycle Management

**Deliverables**:
- [ ] Agent creation (hire)
- [ ] Agent deletion (fire)
- [ ] Agent pause/resume
- [ ] Agent status tracking
- [ ] Org chart maintenance

**Key Files**:
```typescript
// packages/core/src/lifecycle/index.ts
export async function hireAgent(config: HireConfig): Promise<string>
export async function fireAgent(agentId: string, strategy: FireStrategy): Promise<void>
export async function pauseAgent(agentId: string): Promise<void>
export async function resumeAgent(agentId: string): Promise<void>
export async function getOrgChart(): Promise<OrgChart>

// packages/core/src/lifecycle/validation.ts
export async function validateHire(config: HireConfig): Promise<ValidationResult>
export async function detectCycle(agentId: string, newManagerId: string): Promise<boolean>
export async function checkHiringBudget(managerId: string): Promise<boolean>
export async function checkRateLimit(managerId: string): Promise<boolean>
```

**Dependencies**: Phase 2.1

**Tests**:
- [ ] Hire creates all required files/DB entries
- [ ] Fire handles orphaned subordinates correctly
- [ ] Pause stops agent execution
- [ ] Resume restarts agent
- [ ] Org chart reflects current hierarchy
- [ ] Cycle detection prevents circular reporting
- [ ] Rate limiting prevents hiring sprees

**Edge Cases Handled**:
- EC-1.1: Agent tries to hire itself
- EC-1.2: Orphaned agents
- EC-1.3: Circular reporting structure
- EC-1.4: Agent hiring spree

---

### Phase 2.3: Task Management System

**Deliverables**:
- [ ] Task creation
- [ ] Hierarchical task nesting
- [ ] Task status tracking
- [ ] Task delegation
- [ ] Task archival

**Key Files**:
```typescript
// packages/core/src/tasks/index.ts
export async function createTask(agentId: string, task: TaskInput): Promise<string>
export async function updateTaskProgress(taskId: string, progress: number): Promise<void>
export async function delegateTask(taskId: string, toAgentId: string): Promise<void>
export async function completeTask(taskId: string): Promise<void>
export async function archiveOldTasks(olderThan: number): Promise<number>

// packages/core/src/tasks/validation.ts
export async function validateTaskDepth(parentTaskId: string | null): Promise<void>
export async function detectDeadlock(taskId: string): Promise<string[] | null>
export async function getBlockedTasks(agentId: string): Promise<Task[]>
```

**Dependencies**: Phase 2.2

**Tests**:
- [ ] Tasks created with correct hierarchy
- [ ] Depth limit enforced
- [ ] Delegation updates DB correctly
- [ ] Archival moves files to archive/
- [ ] Deadlock detection works
- [ ] Progress tracking accurate

**Edge Cases Handled**:
- EC-2.1: Task deadlock
- EC-2.2: Infinite task nesting
- EC-2.3: Abandoned tasks
- EC-2.4: Task completion race condition

---

## Phase 3: Execution Engine

**Goal**: Enable agents to actually run and execute tasks

**Duration**: 4-5 weeks

**Team Size**: 2-3 developers

### Phase 3.1: Framework Adapter Interface

**Deliverables**:
- [ ] FrameworkAdapter interface
- [ ] Adapter registry
- [ ] Version detection
- [ ] Capability negotiation

**Key Files**:
```typescript
// packages/adapters/common/src/index.ts
export interface FrameworkAdapter {
  name: string;
  version: string;
  executeAgent(agentId: string, mode: ExecutionMode, context: ExecutionContext): Promise<ExecutionResult>;
  supportsFeature(feature: string): boolean;
  getCapabilities(): Capability[];
  healthCheck(): Promise<boolean>;
}

export class AdapterRegistry {
  register(adapter: FrameworkAdapter): void;
  getAdapter(name: string): FrameworkAdapter | null;
  getAvailableAdapters(): FrameworkAdapter[];
}
```

**Dependencies**: Phase 2 (all)

**Tests**:
- [ ] Adapter registration works
- [ ] Version detection accurate
- [ ] Health check detects availability

**Edge Cases Handled**:
- EC-6.1: Framework not available

---

### Phase 3.2: Claude Code Adapter (Primary)

**Deliverables**:
- [ ] Claude Code CLI wrapper
- [ ] Prompt template system
- [ ] Context preparation
- [ ] Result parsing
- [ ] Error handling

**Key Files**:
```typescript
// packages/adapters/claude-code/src/index.ts
export class ClaudeCodeAdapter implements FrameworkAdapter {
  async executeAgent(agentId: string, mode: ExecutionMode, context: ExecutionContext): Promise<ExecutionResult>;
}

// packages/adapters/claude-code/src/prompts/index.ts
export function buildContinuousPrompt(agent: Agent, task: Task): string;
export function buildReactivePrompt(agent: Agent, messages: Message[]): string;
export function buildMultiPerspectivePrompt(question: string, perspectives: string[]): string;
```

**Dependencies**: Phase 3.1

**Tests**:
- [ ] Can invoke Claude Code CLI
- [ ] Prompts generate correct output
- [ ] Results parsed correctly
- [ ] Errors handled gracefully
- [ ] Timeout protection works

**Edge Cases Handled**:
- EC-6.2: Framework timeout
- EC-6.3: Framework API change

---

### Phase 3.3: Execution Orchestrator

**Deliverables**:
- [ ] Agent execution loop
- [ ] State loading/saving
- [ ] Multi-perspective analysis
- [ ] Decision synthesis
- [ ] Execution tracking

**Key Files**:
```typescript
// packages/core/src/execution/index.ts
export class ExecutionOrchestrator {
  async executeContinuous(agentId: string): Promise<ExecutionResult>;
  async executeReactive(agentId: string, trigger: ReactiveTrigger): Promise<ExecutionResult>;
  async runMultiPerspectiveAnalysis(question: string, perspectives: string[]): Promise<Decision>;
}

// packages/core/src/execution/state.ts
export async function loadExecutionContext(agentId: string): Promise<ExecutionContext>;
export async function saveExecutionResult(agentId: string, result: ExecutionResult): Promise<void>;
```

**Dependencies**: Phase 3.1, 3.2

**Tests**:
- [ ] Continuous execution picks correct task
- [ ] Reactive execution handles messages
- [ ] Multi-perspective analysis synthesizes decisions
- [ ] State saved after every execution
- [ ] Concurrent executions prevented

**Edge Cases Handled**:
- EC-7.1: Two continuous instances running
- EC-8.1: Analysis sub-agents disagree
- EC-8.2: Analysis timeout

---

### Phase 3.4: Concurrency Control

**Deliverables**:
- [ ] Per-agent mutex
- [ ] Execution queue
- [ ] Worker pool
- [ ] Process tracking

**Key Files**:
```typescript
// packages/core/src/execution/concurrency.ts
export class ExecutionPool {
  async execute(agentId: string, mode: ExecutionMode): Promise<ExecutionResult>;
  getActiveExecutions(): string[];
  getQueueDepth(): number;
}

// packages/core/src/execution/locks.ts
export class AgentLock {
  async acquire(agentId: string): Promise<void>;
  release(agentId: string): void;
  isLocked(agentId: string): boolean;
}
```

**Dependencies**: Phase 3.3

**Tests**:
- [ ] Concurrent executions blocked
- [ ] Queue processes in order
- [ ] Worker pool respects max concurrent
- [ ] Locks released on error

**Edge Cases Handled**:
- EC-7.1: Two continuous instances running

---

## Phase 4: Scheduling & Triggers

**Goal**: Enable time-based and event-based agent execution

**Duration**: 3-4 weeks

**Team Size**: 2 developers

### Phase 4.1: Schedule Parser & Manager

**Deliverables**:
- [ ] Cron expression parsing
- [ ] Timezone handling
- [ ] Next execution calculation
- [ ] Schedule validation

**Key Files**:
```typescript
// packages/scheduler/src/schedule/index.ts
export function parseSchedule(config: ScheduleConfig): ParsedSchedule;
export function getNextExecution(schedule: ParsedSchedule): Date;
export function validateSchedule(config: ScheduleConfig): ValidationResult;

// packages/scheduler/src/schedule/timezone.ts
export function handleDST(schedule: ParsedSchedule, timezone: string): Date;
```

**Dependencies**: Phase 2.1

**Tests**:
- [ ] Cron expressions parsed correctly
- [ ] Timezone conversions accurate
- [ ] DST transitions handled
- [ ] Next execution calculated correctly

**Edge Cases Handled**:
- EC-4.1: Clock skew (DST)

---

### Phase 4.2: Scheduler Daemon

**Deliverables**:
- [ ] Event loop
- [ ] Schedule scanning
- [ ] Agent triggering
- [ ] Health monitoring
- [ ] Crash recovery

**Key Files**:
```typescript
// packages/scheduler/src/daemon/index.ts
export class SchedulerDaemon {
  async start(): Promise<void>;
  async stop(): Promise<void>;
  async processNextExecution(): Promise<void>;
}

// packages/scheduler/src/daemon/recovery.ts
export async function recoverMissedExecutions(): Promise<void>;
export async function rebuildScheduleIndex(): Promise<void>;
```

**Dependencies**: Phase 4.1, Phase 3.3

**Tests**:
- [ ] Daemon starts and stops cleanly
- [ ] Schedules processed correctly
- [ ] Missed executions recovered on restart
- [ ] Health check reports status

**Edge Cases Handled**:
- EC-4.2: Scheduler daemon crash
- EC-4.3: Thundering herd

---

### Phase 4.3: Continuous Task Execution

**Deliverables**:
- [ ] Continuous mode logic
- [ ] Smart spawning (only when work available)
- [ ] Backoff between runs
- [ ] Stop conditions

**Key Files**:
```typescript
// packages/scheduler/src/continuous/index.ts
export async function shouldRunContinuous(agentId: string): Promise<boolean>;
export async function scheduleContinuousExecution(agentId: string): Promise<void>;
```

**Dependencies**: Phase 4.2

**Tests**:
- [ ] Continuous runs only when tasks pending
- [ ] Backoff prevents tight loops
- [ ] Stops when all work done

**Edge Cases Handled**:
- Smart spawning (no wasted cycles)

---

## Phase 5: Messaging Integration

**Goal**: Enable external communication via Slack, Telegram, etc.

**Duration**: 3-4 weeks

**Team Size**: 2 developers

### Phase 5.1: Messaging Abstraction Layer

**Deliverables**:
- [ ] MessagingAdapter interface
- [ ] Message queue (internal)
- [ ] Message routing
- [ ] Deduplication

**Key Files**:
```typescript
// packages/messaging/common/src/index.ts
export interface MessagingAdapter {
  pollMessages(): Promise<Message[]>;
  sendMessage(agentId: string, content: string): Promise<void>;
  markAsRead(messageId: string): Promise<void>;
}

// packages/messaging/common/src/queue.ts
export class MessageQueue {
  async enqueue(msg: Message): Promise<void>;
  async dequeue(agentId: string): Promise<Message[]>;
  async deduplicate(msg: Message): Promise<boolean>;
}
```

**Dependencies**: Phase 2.3

**Tests**:
- [ ] Messages routed to correct agent
- [ ] Deduplication prevents duplicates
- [ ] Queue handles high volume

**Edge Cases Handled**:
- EC-3.3: Duplicate messages

---

### Phase 5.2: Slack Integration

**Deliverables**:
- [ ] Slack webhook listener
- [ ] Message parsing
- [ ] Reply posting
- [ ] Rate limiting

**Key Files**:
```typescript
// packages/messaging/slack/src/index.ts
export class SlackAdapter implements MessagingAdapter {
  async pollMessages(): Promise<Message[]>;
  async sendMessage(channel: string, content: string): Promise<void>;
}

// packages/messaging/slack/src/parser.ts
export function parseSlackMessage(payload: any): Message;
export function formatReply(content: string): string;
```

**Dependencies**: Phase 5.1

**Tests**:
- [ ] Mentions parsed correctly
- [ ] DMs received
- [ ] Replies posted to correct channel
- [ ] Rate limiting prevents flood

**Edge Cases Handled**:
- EC-3.1: Message flood

---

### Phase 5.3: Telegram Integration

**Deliverables**:
- [ ] Telegram bot API wrapper
- [ ] Command parsing
- [ ] Reply posting

**Key Files**:
```typescript
// packages/messaging/telegram/src/index.ts
export class TelegramAdapter implements MessagingAdapter {
  async pollMessages(): Promise<Message[]>;
  async sendMessage(chatId: string, content: string): Promise<void>;
}
```

**Dependencies**: Phase 5.1

**Tests**:
- [ ] Bot receives messages
- [ ] Commands parsed
- [ ] Replies sent

**Edge Cases Handled**:
- Similar to Slack (EC-3.1, EC-3.3)

---

## Phase 6: CLI & User Experience

**Goal**: Provide excellent developer experience via CLI

**Duration**: 2-3 weeks

**Team Size**: 1-2 developers

### Phase 6.1: Core CLI Commands

**Deliverables**:
- [ ] `recursivemanager init`
- [ ] `recursivemanager hire`
- [ ] `recursivemanager fire`
- [ ] `recursivemanager status`
- [ ] `recursivemanager message`
- [ ] `recursivemanager run`

**Key Files**:
```typescript
// packages/cli/src/commands/init.ts
export async function initCommand(goal: string, options: InitOptions): Promise<void>;

// packages/cli/src/commands/hire.ts
export async function hireCommand(role: string, options: HireOptions): Promise<void>;

// packages/cli/src/commands/status.ts
export async function statusCommand(options: StatusOptions): Promise<void>;
```

**Dependencies**: Phase 2, 3, 4, 5 (all)

**Tests**:
- [ ] Commands execute successfully
- [ ] Error messages are clear
- [ ] Help text is comprehensive

**Edge Cases Handled**:
- EC-3.2: Message to non-existent agent

---

### Phase 6.2: Advanced CLI Features

**Deliverables**:
- [ ] `recursivemanager debug`
- [ ] `recursivemanager logs`
- [ ] `recursivemanager audit`
- [ ] `recursivemanager backup`
- [ ] `recursivemanager emergency-stop`

**Key Files**:
```typescript
// packages/cli/src/commands/debug.ts
export async function debugCommand(agentId: string): Promise<void>;

// packages/cli/src/commands/emergency.ts
export async function emergencyStopCommand(): Promise<void>;
```

**Dependencies**: Phase 6.1

**Tests**:
- [ ] Debug shows comprehensive info
- [ ] Emergency stop halts all agents
- [ ] Backup creates complete snapshot

---

### Phase 6.3: Interactive Setup Wizard

**Deliverables**:
- [ ] Interactive prompts (inquirer)
- [ ] Goal validation
- [ ] Integration setup
- [ ] Initial config generation

**Key Files**:
```typescript
// packages/cli/src/wizard/index.ts
export async function runSetupWizard(): Promise<void>;
```

**Dependencies**: Phase 6.1

**Tests**:
- [ ] Wizard completes successfully
- [ ] Generated config is valid
- [ ] Integrations configured correctly

---

## Phase 7: Observability & Debugging

**Goal**: Make the system understandable and debuggable

**Duration**: 2-3 weeks

**Team Size**: 1-2 developers

### Phase 7.1: Execution Tracing

**Deliverables**:
- [ ] Trace ID generation
- [ ] Span tracking (parent/child)
- [ ] Trace aggregation
- [ ] Trace visualization

**Key Files**:
```typescript
// packages/common/src/tracing/index.ts
export function startTrace(name: string): Trace;
export function createSpan(trace: Trace, name: string): Span;
export function endSpan(span: Span, result: any): void;
```

**Dependencies**: Phase 1.4

**Tests**:
- [ ] Traces capture execution flow
- [ ] Parent-child relationships correct
- [ ] Visualization shows hierarchy

---

### Phase 7.2: Metrics & Monitoring

**Deliverables**:
- [ ] Execution metrics (count, duration, success rate)
- [ ] Resource metrics (disk, memory, CPU)
- [ ] Agent health scores
- [ ] Dashboard (optional: Grafana)

**Key Files**:
```typescript
// packages/common/src/metrics/index.ts
export function recordExecutionMetric(agentId: string, duration: number, success: boolean): void;
export function getAgentMetrics(agentId: string, timeRange: TimeRange): Metrics;
export function calculateHealthScore(agentId: string): number;
```

**Dependencies**: Phase 1.4

**Tests**:
- [ ] Metrics recorded accurately
- [ ] Health score correlates with performance

---

## Phase 8: Security & Resilience

**Goal**: Harden the system against attacks and failures

**Duration**: 2-3 weeks

**Team Size**: 1-2 developers

### Phase 8.1: Security Hardening

**Deliverables**:
- [ ] Sandboxing (containers)
- [ ] Permission validation
- [ ] Resource limits
- [ ] Secret scanning

**Key Files**:
```typescript
// packages/core/src/security/index.ts
export function validatePermissions(agent: Agent, operation: Operation): boolean;
export function applySandbox(agent: Agent): SandboxConfig;
export function scanForSecrets(content: string): SecretMatch[];
```

**Dependencies**: Phase 2, 3

**Tests**:
- [ ] Agents cannot escape sandbox
- [ ] Permission checks enforced
- [ ] Secrets detected and blocked

**Edge Cases Handled**:
- Threat model (see Multi-Perspective Analysis)

---

### Phase 8.2: Resilience Patterns

**Deliverables**:
- [ ] Circuit breakers
- [ ] Retry with backoff
- [ ] Graceful degradation
- [ ] Health checks

**Key Files**:
```typescript
// packages/common/src/resilience/index.ts
export class CircuitBreaker {
  async execute<T>(fn: () => Promise<T>): Promise<T>;
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number): Promise<T>;
```

**Dependencies**: Phase 3

**Tests**:
- [ ] Circuit breaker opens on failures
- [ ] Retries with exponential backoff
- [ ] Degradation maintains partial functionality

**Edge Cases Handled**:
- EC-6.2: Framework timeout
- EC-7.2: Database deadlock

---

## Phase 9: OpenCode Adapter (Multi-Framework Support)

**Goal**: Support alternative framework

**Duration**: 2-3 weeks

**Team Size**: 1 developer

### Phase 9.1: OpenCode Adapter

**Deliverables**:
- [ ] OpenCode CLI wrapper
- [ ] Prompt templates
- [ ] Result parsing
- [ ] Error handling

**Key Files**:
```typescript
// packages/adapters/opencode/src/index.ts
export class OpenCodeAdapter implements FrameworkAdapter {
  async executeAgent(agentId: string, mode: ExecutionMode, context: ExecutionContext): Promise<ExecutionResult>;
}
```

**Dependencies**: Phase 3.1

**Tests**:
- [ ] Can invoke OpenCode
- [ ] Results compatible with Claude Code adapter
- [ ] Fallback works seamlessly

---

## Phase 10: Documentation & Examples

**Goal**: Comprehensive documentation for users and developers

**Duration**: 2 weeks

**Team Size**: 1 developer + 1 technical writer

### Phase 10.1: User Documentation

**Deliverables**:
- [ ] Quickstart guide
- [ ] CLI reference
- [ ] Tutorials (common workflows)
- [ ] Troubleshooting guide
- [ ] FAQ

**Dependencies**: All phases

---

### Phase 10.2: Developer Documentation

**Deliverables**:
- [ ] Architecture overview
- [ ] API reference
- [ ] Adapter development guide
- [ ] Contributing guide
- [ ] Code style guide

**Dependencies**: All phases

---

### Phase 10.3: Example Configurations

**Deliverables**:
- [ ] Example roles (CEO, CTO, Developer, etc.)
- [ ] Example workflows (web app, data pipeline, etc.)
- [ ] Integration examples (Slack, Telegram)
- [ ] Advanced patterns (custom adapters, plugins)

**Dependencies**: All phases

---

## Testing Strategy

### Unit Tests
- **Coverage**: 80%+
- **Framework**: Jest
- **Run**: On every commit (pre-commit hook)
- **Focus**: Individual functions, edge cases

### Integration Tests
- **Coverage**: Key workflows
- **Framework**: Jest + testcontainers
- **Run**: On pull request
- **Focus**: Component interactions

### End-to-End Tests
- **Coverage**: User journeys
- **Framework**: Jest + real CLI
- **Run**: Before release
- **Focus**: Full system behavior

### Performance Tests
- **Coverage**: Scalability limits
- **Framework**: k6 / Artillery
- **Run**: Weekly (scheduled)
- **Focus**: 1000+ agents, high concurrency

---

## Deployment Strategy

### Development
- **Environment**: Local machine
- **Database**: SQLite file
- **Messaging**: Mock adapters

### Staging
- **Environment**: CI server
- **Database**: SQLite file
- **Messaging**: Real Slack/Telegram (test accounts)

### Production
- **Environment**: User's machine / server
- **Database**: SQLite file (user-specified path)
- **Messaging**: User's Slack/Telegram accounts

---

## Release Plan

### Alpha (End of Phase 3)
- **Features**: Core agent system, basic execution
- **Audience**: Internal testing
- **Goal**: Validate architecture

### Beta (End of Phase 6)
- **Features**: Full CLI, scheduling, messaging
- **Audience**: Early adopters
- **Goal**: Gather feedback

### v1.0 (End of Phase 10)
- **Features**: All phases complete
- **Audience**: Public release
- **Goal**: Production-ready

---

## Dependencies Graph

```
Phase 1.1 (Setup)
    ↓
Phase 1.2 (File System) → Phase 1.3 (Database) → Phase 1.4 (Logging)
                              ↓
Phase 2.1 (Config) → Phase 2.2 (Lifecycle) → Phase 2.3 (Tasks)
                         ↓
Phase 3.1 (Adapter Interface) → Phase 3.2 (Claude Code) → Phase 3.3 (Orchestrator) → Phase 3.4 (Concurrency)
                                                                  ↓
Phase 4.1 (Schedule Parser) → Phase 4.2 (Scheduler) → Phase 4.3 (Continuous)
                                   ↓
Phase 5.1 (Messaging Abstraction) → Phase 5.2 (Slack) → Phase 5.3 (Telegram)
                                        ↓
Phase 6.1 (Core CLI) → Phase 6.2 (Advanced CLI) → Phase 6.3 (Wizard)
                          ↓
Phase 7.1 (Tracing) → Phase 7.2 (Metrics)
                          ↓
Phase 8.1 (Security) → Phase 8.2 (Resilience)
                          ↓
Phase 9.1 (OpenCode)
                          ↓
Phase 10.1 (User Docs) → Phase 10.2 (Dev Docs) → Phase 10.3 (Examples)
```

---

## Risk Mitigation

### Technical Risks
1. **Framework API changes**: Version detection + multiple adapter versions
2. **Performance issues**: Early load testing, scalability from day 1
3. **Data corruption**: Atomic writes, backups, recovery mechanisms

### Schedule Risks
1. **Scope creep**: Strict phase boundaries, defer features to future versions
2. **Dependencies**: Parallel work where possible, clear interfaces
3. **Unknowns**: 20% buffer in estimates

### Resource Risks
1. **Developer availability**: Phases designed for 1-3 devs
2. **Testing coverage**: Automated tests from day 1
3. **Documentation lag**: Docs written alongside code

