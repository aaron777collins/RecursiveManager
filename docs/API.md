# RecursiveManager API Reference

**Version:** 1.0.0
**Last Updated:** January 2026

Complete API reference for RecursiveManager's five core packages: `@recursive-manager/core`, `@recursive-manager/cli`, `@recursive-manager/adapters`, `@recursive-manager/scheduler`, and `@recursive-manager/common`.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Package API](#core-package-api)
   - [Configuration Management](#configuration-management)
   - [Business Validation](#business-validation)
   - [Agent Lifecycle](#agent-lifecycle)
   - [Task Management](#task-management)
   - [Execution Orchestrator](#execution-orchestrator)
   - [Metrics & Monitoring](#metrics--monitoring)
   - [Execution State](#execution-state)
   - [Messaging](#messaging)
3. [CLI Package API](#cli-package-api)
   - [Org Chart Visualization](#org-chart-visualization)
4. [Adapters Package API](#adapters-package-api)
   - [Framework Adapter Types](#framework-adapter-types)
   - [Adapter Registry](#adapter-registry)
   - [Claude Code Adapter](#claude-code-adapter)
   - [Execution Context](#execution-context)
   - [Prompt Templates](#prompt-templates)
5. [Scheduler Package API](#scheduler-package-api)
   - [Schedule Manager](#schedule-manager)
6. [Common Package API](#common-package-api)
   - [Version Information](#version-information)
   - [File I/O Operations](#file-io-operations)
   - [Directory Permissions](#directory-permissions)
   - [Disk Space Management](#disk-space-management)
   - [Path Utilities](#path-utilities)
   - [Schema Validation](#schema-validation)
   - [File Recovery](#file-recovery)
   - [Database Management](#database-management)
   - [Database Migrations](#database-migrations)
   - [Database Queries](#database-queries)
   - [Logging](#logging)
   - [PID Manager](#pid-manager)
   - [Security](#security)
7. [Type Definitions](#type-definitions)
8. [Error Handling](#error-handling)

---

## Overview

RecursiveManager is a production-ready hierarchical AI agent management system. It provides five core packages with distinct responsibilities:

- **core**: Agent lifecycle, execution orchestration, multi-perspective analysis
- **cli**: Command-line interface and visualization
- **adapters**: Framework integration (Claude Code, etc.)
- **scheduler**: Cron-based scheduling and task dependencies
- **common**: Shared utilities, database, logging, file I/O, security

All APIs use TypeScript with full type safety and comprehensive error handling.

---

## Core Package API

**Package:** `@recursive-manager/core`
**Version:** 0.1.0

### Configuration Management

Load, save, and manage agent configurations with validation.

#### `loadAgentConfig()`

Load an agent's configuration file with JSON schema validation.

```typescript
async function loadAgentConfig(
  agentId: string,
  options?: PathOptions
): Promise<AgentConfig>
```

**Parameters:**
- `agentId` - Agent identifier (e.g., `'ceo-001'`)
- `options.baseDir` - Base directory (default: `~/.recursive-manager`)

**Returns:** `Promise<AgentConfig>` - Validated agent configuration

**Throws:**
- `ConfigLoadError` - Configuration file not found or invalid

**Example:**
```typescript
import { loadAgentConfig } from '@recursive-manager/core';

const config = await loadAgentConfig('ceo-001');
console.log(config.identity.role); // 'CEO'
```

---

#### `loadAgentConfigWithBusinessValidation()`

Load configuration with both schema and business logic validation.

```typescript
async function loadAgentConfigWithBusinessValidation(
  agentId: string,
  options?: PathOptions
): Promise<AgentConfig>
```

**Parameters:**
- `agentId` - Agent identifier
- `options.baseDir` - Base directory

**Returns:** `Promise<AgentConfig>` - Validated configuration

**Throws:**
- `ConfigLoadError` - Configuration load failed
- `SchemaValidationError` - Schema validation failed
- `BusinessValidationFailure` - Business logic validation failed

**Business Validation Rules:**
- `maxSubordinates` must be ≥ 0
- `hiringBudget` must be ≥ 0
- `workspaceQuotaMB` must be > 0
- `maxExecutionMinutes` must be > 0
- Cannot hire if `canHire` is false
- Cannot hire if at max subordinates
- Cannot fire if `canFire` is false

**Example:**
```typescript
const config = await loadAgentConfigWithBusinessValidation('cto-002');
// Throws BusinessValidationFailure if config.permissions.hiringBudget < 0
```

---

#### `saveAgentConfig()`

Save agent configuration with validation, atomic writes, and automatic backup.

```typescript
async function saveAgentConfig(
  agentId: string,
  config: AgentConfig,
  options?: PathOptions
): Promise<void>
```

**Parameters:**
- `agentId` - Agent identifier
- `config` - Agent configuration to save
- `options.baseDir` - Base directory

**Throws:**
- `ConfigSaveError` - Save operation failed
- `SchemaValidationError` - Schema validation failed
- `BusinessValidationFailure` - Business logic validation failed

**Features:**
- Creates backup before overwrite (`.config.json.backup`)
- Uses atomic write (write to temp, rename)
- Validates schema and business logic before save
- Creates directory structure if missing

**Example:**
```typescript
import { saveAgentConfig, loadAgentConfig } from '@recursive-manager/core';

const config = await loadAgentConfig('dev-003');
config.permissions.maxSubordinates = 5;
await saveAgentConfig('dev-003', config);
```

---

#### `generateDefaultConfig()`

Generate a default agent configuration with sensible defaults.

```typescript
function generateDefaultConfig(
  role: string,
  goal: string,
  createdBy: string,
  options?: {
    id?: string;
    displayName?: string;
    reportingTo?: string | null;
    canHire?: boolean;
    maxSubordinates?: number;
    hiringBudget?: number;
    primaryFramework?: 'claude-code' | 'opencode';
    workspaceQuotaMB?: number;
    maxExecutionMinutes?: number;
  }
): AgentConfig
```

**Parameters:**
- `role` - Agent role (e.g., `'Software Engineer'`)
- `goal` - Main goal description
- `createdBy` - Creator identifier
- `options` - Optional overrides

**Returns:** `AgentConfig` - Complete configuration with defaults

**Defaults:**
- `canHire`: `false`
- `maxSubordinates`: `0`
- `hiringBudget`: `0`
- `primaryFramework`: `'claude-code'`
- `workspaceQuotaMB`: `500`
- `maxExecutionMinutes`: `60`

**Example:**
```typescript
import { generateDefaultConfig } from '@recursive-manager/core';

const config = generateDefaultConfig(
  'QA Engineer',
  'Maintain test coverage above 80%',
  'cto-002',
  {
    id: 'qa-001',
    displayName: 'QA Lead',
    canHire: true,
    maxSubordinates: 3
  }
);
```

---

#### `mergeConfigs()`

Deep merge two configurations with override precedence.

```typescript
function mergeConfigs(
  base: AgentConfig,
  override: DeepPartial<AgentConfig>
): AgentConfig
```

**Parameters:**
- `base` - Base configuration
- `override` - Partial configuration to merge

**Returns:** `AgentConfig` - Merged configuration

**Merge Strategy:**
- Objects: Deep merge recursively
- Arrays: Replace (not concatenate)
- Primitives: Override wins

**Example:**
```typescript
import { mergeConfigs, generateDefaultConfig } from '@recursive-manager/core';

const base = generateDefaultConfig('Developer', 'Write code', 'cto-001');
const override = {
  permissions: { canHire: true, maxSubordinates: 5 }
};
const merged = mergeConfigs(base, override);

console.log(merged.permissions.canHire); // true
console.log(merged.permissions.hiringBudget); // 0 (from base)
```

---

### Business Validation

Validate agent configurations against business logic rules.

#### `validateAgentConfigBusinessLogic()`

Validate configuration (non-strict, returns result object).

```typescript
function validateAgentConfigBusinessLogic(
  config: AgentConfig
): BusinessValidationResult
```

**Parameters:**
- `config` - Configuration to validate

**Returns:** `BusinessValidationResult`
```typescript
interface BusinessValidationResult {
  valid: boolean;
  errors: BusinessValidationError[];
}

interface BusinessValidationError {
  field: string;
  message: string;
  code: string;
}
```

**Example:**
```typescript
import { validateAgentConfigBusinessLogic } from '@recursive-manager/core';

const result = validateAgentConfigBusinessLogic(config);
if (!result.valid) {
  result.errors.forEach(err => {
    console.error(`${err.field}: ${err.message}`);
  });
}
```

---

#### `validateAgentConfigBusinessLogicStrict()`

Validate configuration (strict, throws on first error).

```typescript
function validateAgentConfigBusinessLogicStrict(
  config: AgentConfig
): void
```

**Parameters:**
- `config` - Configuration to validate

**Throws:**
- `BusinessValidationFailure` - Validation failed

**Example:**
```typescript
import { validateAgentConfigBusinessLogicStrict } from '@recursive-manager/core';

try {
  validateAgentConfigBusinessLogicStrict(config);
  // Validation passed
} catch (error) {
  if (error instanceof BusinessValidationFailure) {
    console.error(error.message);
  }
}
```

---

### Agent Lifecycle

Hire, fire, pause, and resume agents with full lifecycle management.

#### `hireAgent()`

Hire a new agent under a manager.

```typescript
async function hireAgent(
  managerId: string | null,
  config: AgentConfig,
  options?: PathOptions
): Promise<HireResult>
```

**Parameters:**
- `managerId` - Parent manager ID (null for root agents)
- `config` - Agent configuration
- `options.baseDir` - Base directory

**Returns:** `Promise<HireResult>`
```typescript
interface HireResult {
  agentId: string;
  success: boolean;
  message: string;
  validationWarnings?: string[];
}
```

**Throws:**
- `HireAgentError` - Hire operation failed
- `HireValidationError` - Validation failed

**Validation Checks:**
- Manager exists and is active
- Manager has hiring permissions
- Manager not at max subordinates
- Manager has available hiring budget
- No circular reporting relationships
- Rate limits not exceeded

**Example:**
```typescript
import { hireAgent, generateDefaultConfig } from '@recursive-manager/core';

const config = generateDefaultConfig(
  'Backend Developer',
  'Build REST APIs',
  'cto-001',
  { id: 'dev-004' }
);

const result = await hireAgent('cto-001', config);
console.log(result.success); // true
console.log(result.agentId); // 'dev-004'
```

---

#### `fireAgent()`

Fire an agent with subordinate handling strategy.

```typescript
async function fireAgent(
  agentId: string,
  strategy: FireStrategy,
  options?: PathOptions
): Promise<FireAgentResult>
```

**Parameters:**
- `agentId` - Agent to fire
- `strategy` - Subordinate handling strategy
  - `'reassign'`: Move subordinates to parent manager
  - `'promote'`: Promote subordinates to same level as fired agent
  - `'cascade'`: Fire all subordinates recursively
- `options.baseDir` - Base directory

**Returns:** `Promise<FireAgentResult>`
```typescript
interface FireAgentResult {
  success: boolean;
  agentId: string;
  subordinatesAffected: number;
  strategy: FireStrategy;
  message: string;
}

type FireStrategy = 'reassign' | 'promote' | 'cascade';
```

**Throws:**
- `FireAgentError` - Fire operation failed

**Example:**
```typescript
import { fireAgent } from '@recursive-manager/core';

// Fire agent, move subordinates to parent
const result = await fireAgent('dev-004', 'reassign');
console.log(`Fired ${result.agentId}, affected ${result.subordinatesAffected} subordinates`);

// Fire agent and all subordinates
await fireAgent('team-lead-001', 'cascade');
```

---

#### `pauseAgent()`

Pause an agent (blocks all task execution).

```typescript
async function pauseAgent(
  agentId: string,
  options?: PauseAgentOptions
): Promise<PauseAgentResult>
```

**Parameters:**
- `agentId` - Agent to pause
- `options.performedBy` - Who initiated the pause
- `options.baseDir` - Base directory

**Returns:** `Promise<PauseAgentResult>`
```typescript
interface PauseAgentResult {
  success: boolean;
  agentId: string;
  tasksBlocked: number;
  message: string;
}

interface PauseAgentOptions {
  performedBy?: string;
  baseDir?: string;
}
```

**Throws:**
- `PauseAgentError` - Pause operation failed

**Side Effects:**
- Blocks all pending and in-progress tasks
- Stops continuous execution
- Prevents new task assignments

**Example:**
```typescript
import { pauseAgent } from '@recursive-manager/core';

const result = await pauseAgent('dev-005', {
  performedBy: 'cto-001'
});

console.log(`Paused ${result.agentId}, blocked ${result.tasksBlocked} tasks`);
```

---

#### `resumeAgent()`

Resume a paused agent.

```typescript
async function resumeAgent(
  agentId: string,
  options?: ResumeAgentOptions
): Promise<ResumeAgentResult>
```

**Parameters:**
- `agentId` - Agent to resume
- `options.performedBy` - Who initiated the resume
- `options.baseDir` - Base directory

**Returns:** `Promise<ResumeAgentResult>`
```typescript
interface ResumeAgentResult {
  success: boolean;
  agentId: string;
  tasksUnblocked: number;
  message: string;
}

interface ResumeAgentOptions {
  performedBy?: string;
  baseDir?: string;
}
```

**Throws:**
- `ResumeAgentError` - Resume operation failed

**Side Effects:**
- Unblocks all tasks
- Restarts continuous execution if scheduled
- Allows new task assignments

**Example:**
```typescript
import { resumeAgent } from '@recursive-manager/core';

const result = await resumeAgent('dev-005', {
  performedBy: 'cto-001'
});

console.log(`Resumed ${result.agentId}, unblocked ${result.tasksUnblocked} tasks`);
```

---

#### `validateHire()` / `validateHireStrict()`

Validate if an agent can be hired.

```typescript
function validateHire(config: AgentConfig): HireValidationResult
function validateHireStrict(config: AgentConfig): void
```

**Parameters:**
- `config` - Agent configuration to validate

**Returns:** `HireValidationResult` (non-strict only)
```typescript
interface HireValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

**Throws:** (strict only)
- `HireValidationError` - Validation failed

**Example:**
```typescript
import { validateHire, validateHireStrict } from '@recursive-manager/core';

// Non-strict: Returns result
const result = validateHire(config);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Strict: Throws error
try {
  validateHireStrict(config);
} catch (error) {
  console.error('Hire validation failed:', error.message);
}
```

---

#### Helper Functions

**Cycle Detection:**
```typescript
function detectCycle(): boolean
```
Returns `true` if circular reporting relationships detected.

**Budget Checks:**
```typescript
function checkHiringBudget(managerId: string): boolean
```
Returns `true` if manager has available hiring budget.

**Rate Limiting:**
```typescript
function checkRateLimit(managerId: string): boolean
```
Returns `true` if manager within hiring rate limits.

**Task Blocking:**
```typescript
async function blockTasksForPausedAgent(agentId: string): Promise<BlockTasksResult>
async function unblockTasksForResumedAgent(agentId: string): Promise<UnblockTasksResult>
```

---

### Task Management

Manage task lifecycle, archival, delegation, and deadlock monitoring.

#### `archiveOldTasks()`

Archive completed tasks older than specified days.

```typescript
async function archiveOldTasks(
  daysOld?: number,
  options?: { baseDir?: string }
): Promise<void>
```

**Parameters:**
- `daysOld` - Age threshold in days (default: 7)
- `options.baseDir` - Base directory

**Side Effects:**
- Moves task files to `archives/` subdirectory
- Creates compressed tarball of old archives

**Example:**
```typescript
import { archiveOldTasks } from '@recursive-manager/core';

// Archive tasks older than 30 days
await archiveOldTasks(30);
```

---

#### `compressOldArchives()`

Compress archived task files.

```typescript
async function compressOldArchives(
  daysOld?: number,
  options?: { baseDir?: string }
): Promise<void>
```

**Parameters:**
- `daysOld` - Age threshold in days (default: 7)
- `options.baseDir` - Base directory

---

#### `getCompletedTasks()`

Retrieve completed tasks with optional filtering.

```typescript
async function getCompletedTasks(
  filter?: {
    agentId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }
): Promise<TaskRecord[]>
```

**Parameters:**
- `filter.agentId` - Filter by agent
- `filter.startDate` - Filter by completion date (start)
- `filter.endDate` - Filter by completion date (end)
- `filter.limit` - Maximum results (default: 100)

**Returns:** `Promise<TaskRecord[]>`

---

#### `notifyTaskDelegation()`

Send notification about task delegation.

```typescript
async function notifyTaskDelegation(
  taskId: string,
  delegatedTo: string,
  options?: NotifyDelegationOptions
): Promise<void>
```

**Parameters:**
- `taskId` - Task identifier
- `delegatedTo` - Agent receiving the task
- `options.channel` - Notification channel (Slack, Discord, etc.)
- `options.message` - Custom message

---

#### `notifyTaskCompletion()`

Send notification about task completion.

```typescript
async function notifyTaskCompletion(
  taskId: string,
  options?: NotifyCompletionOptions
): Promise<void>
```

**Parameters:**
- `taskId` - Task identifier
- `options.channel` - Notification channel
- `options.notifyManager` - Also notify manager (default: true)

---

#### `completeTaskWithFiles()`

Mark task complete and attach output files.

```typescript
async function completeTaskWithFiles(
  taskId: string,
  files: string[],
  options?: { baseDir?: string }
): Promise<void>
```

**Parameters:**
- `taskId` - Task identifier
- `files` - Array of file paths to attach
- `options.baseDir` - Base directory

---

#### `monitorDeadlocks()`

Monitor for task deadlocks (circular dependencies).

```typescript
async function monitorDeadlocks(
  options?: MonitorDeadlocksOptions
): Promise<MonitorDeadlocksResult>
```

**Parameters:**
- `options.interval` - Check interval in milliseconds
- `options.notifyOnDetection` - Send notifications (default: true)

**Returns:** `Promise<MonitorDeadlocksResult>`
```typescript
interface MonitorDeadlocksResult {
  deadlocksDetected: number;
  affectedTasks: string[];
  affectedAgents: string[];
}
```

---

#### `notifyDeadlock()`

Send deadlock alert notification.

```typescript
async function notifyDeadlock(
  options?: NotifyDeadlockOptions
): Promise<void>
```

**Parameters:**
- `options.taskIds` - Tasks involved in deadlock
- `options.channel` - Notification channel

---

### Execution Orchestrator

Central orchestrator for agent execution, analysis, and lifecycle operations with analysis.

#### `ExecutionOrchestrator`

Main orchestration class for agent execution and decision analysis.

```typescript
class ExecutionOrchestrator {
  constructor(options: ExecutionOrchestratorOptions);

  // Execution methods
  executeContinuous(agentId: string): Promise<ExecutionResult>;
  executeReactive(agentId: string, trigger: ReactiveTrigger): Promise<ExecutionResult>;

  // Analysis methods
  runMultiPerspectiveAnalysis(question: string, perspectives: string[]): Promise<Decision>;
  analyzeDecision(context: string): Promise<MultiPerspectiveResult>;

  // Lifecycle with analysis
  hireAgentWithAnalysis(
    managerId: string | null,
    config: AgentConfig,
    options?: { analyzeBeforeHire?: boolean }
  ): Promise<{ hireResult: HireResult; analysis?: MultiPerspectiveResult }>;

  fireAgentWithAnalysis(
    agentId: string,
    strategy: FireStrategy,
    options?: { analyzeBeforeFire?: boolean }
  ): Promise<{ fireResult: FireAgentResult; analysis?: MultiPerspectiveResult }>;

  pauseAgentWithAnalysis(
    agentId: string,
    options?: { analyzeBeforePause?: boolean }
  ): Promise<{ pauseResult: PauseAgentResult; analysis?: MultiPerspectiveResult }>;

  resumeAgentWithAnalysis(
    agentId: string,
    options?: { analyzeBeforeResume?: boolean }
  ): Promise<{ resumeResult: ResumeAgentResult; analysis?: MultiPerspectiveResult }>;

  // Status methods
  isExecuting(agentId: string): boolean;
  getActiveExecutions(): string[];
  getQueueDepth(): number;
  getPoolStatistics(): PoolStatistics;
}
```

**Constructor Options:**
```typescript
interface ExecutionOrchestratorOptions {
  adapterRegistry: AdapterRegistry;
  database: DatabasePool;
  maxExecutionTime?: number;    // Default: 5 minutes
  maxAnalysisTime?: number;     // Default: 2 minutes
  maxConcurrent?: number;       // Default: 10
}
```

---

#### `executeContinuous()`

Execute agent in continuous mode (autonomous task processing).

```typescript
async executeContinuous(agentId: string): Promise<ExecutionResult>
```

**Parameters:**
- `agentId` - Agent to execute

**Returns:** `Promise<ExecutionResult>`
```typescript
interface ExecutionResult {
  success: boolean;
  duration: number;              // milliseconds
  tasksCompleted: number;
  messagesProcessed: number;
  errors: Array<{
    message: string;
    stack?: string;
    code?: string;
  }>;
  nextExecution?: Date;
  metadata?: {
    filesCreated?: string[];
    filesModified?: string[];
    apiCallCount?: number;
    costUSD?: number;
    output?: string;
  };
}
```

**Throws:**
- `ExecutionError` - Execution failed

**Example:**
```typescript
import { ExecutionOrchestrator } from '@recursive-manager/core';
import { AdapterRegistry } from '@recursive-manager/adapters';
import { getDatabase } from '@recursive-manager/common';

const orchestrator = new ExecutionOrchestrator({
  adapterRegistry: new AdapterRegistry(),
  database: getDatabase()
});

const result = await orchestrator.executeContinuous('dev-001');
console.log(`Completed ${result.tasksCompleted} tasks in ${result.duration}ms`);
```

---

#### `executeReactive()`

Execute agent in reactive mode (message-driven).

```typescript
async executeReactive(
  agentId: string,
  trigger: ReactiveTrigger
): Promise<ExecutionResult>
```

**Parameters:**
- `agentId` - Agent to execute
- `trigger` - Reactive trigger

**Trigger Types:**
```typescript
interface ReactiveTrigger {
  type: 'message' | 'webhook' | 'manual';
  messageId?: string;
  channel?: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}
```

**Example:**
```typescript
const result = await orchestrator.executeReactive('support-001', {
  type: 'message',
  messageId: 'msg-123',
  channel: 'slack',
  timestamp: new Date()
});
```

---

#### `analyzeDecision()`

Run multi-perspective analysis on a decision.

```typescript
async analyzeDecision(context: string): Promise<MultiPerspectiveResult>
```

**Parameters:**
- `context` - Decision context/description

**Returns:** `Promise<MultiPerspectiveResult>`
```typescript
interface MultiPerspectiveResult {
  summary: string;
  overallConfidence: number;      // 0-100
  perspectives: Array<{
    name: string;                 // 'security', 'architecture', etc.
    analysis: string;
    confidence: number;           // 0-100
  }>;
  executionTime: number;          // milliseconds
  conflicts?: Array<{
    perspective1: string;
    perspective2: string;
    conflictReason: string;
  }>;
}
```

**8 Perspectives:**
1. Security (OWASP, compliance, risk)
2. Architecture (SOLID, scalability, technical debt)
3. Simplicity (YAGNI, KISS, complexity)
4. Financial (ROI, TCO, cost-benefit)
5. Marketing (positioning, competitive advantage)
6. UX (WCAG, usability, accessibility)
7. Growth (AARRR, virality, scaling)
8. Emotional (morale, DX, psychological safety)

**Example:**
```typescript
const analysis = await orchestrator.analyzeDecision(
  'Should we migrate from REST to GraphQL?'
);

console.log(analysis.summary);
console.log(`Overall confidence: ${analysis.overallConfidence}%`);

analysis.perspectives.forEach(p => {
  console.log(`${p.name}: ${p.analysis} (${p.confidence}%)`);
});
```

---

#### `runMultiPerspectiveAnalysis()`

Run analysis with specific perspectives.

```typescript
async runMultiPerspectiveAnalysis(
  question: string,
  perspectives: string[]
): Promise<Decision>
```

**Parameters:**
- `question` - Question to analyze
- `perspectives` - Array of perspective names (subset of 8)

**Returns:** `Promise<Decision>`
```typescript
interface Decision {
  recommendation: string;
  confidence: number;             // 0-1
  perspectives: string[];
  perspectiveResults: Array<{
    perspective: string;
    response: string;
    confidence: number;
  }>;
  rationale: string;
  warnings?: string[];
}
```

**Example:**
```typescript
const decision = await orchestrator.runMultiPerspectiveAnalysis(
  'Should we open-source our core library?',
  ['security', 'financial', 'marketing', 'growth']
);

console.log(decision.recommendation);
console.log(decision.rationale);
```

---

#### `hireAgentWithAnalysis()`

Hire agent with optional pre-hire analysis.

```typescript
async hireAgentWithAnalysis(
  managerId: string | null,
  config: AgentConfig,
  options?: { analyzeBeforeHire?: boolean }
): Promise<{
  hireResult: HireResult;
  analysis?: MultiPerspectiveResult;
}>
```

**Parameters:**
- `managerId` - Parent manager
- `config` - Agent configuration
- `options.analyzeBeforeHire` - Run analysis first (default: false)

**Example:**
```typescript
const { hireResult, analysis } = await orchestrator.hireAgentWithAnalysis(
  'cto-001',
  config,
  { analyzeBeforeHire: true }
);

if (analysis) {
  console.log('Analysis:', analysis.summary);
}
console.log('Hired:', hireResult.agentId);
```

---

#### Status Methods

**Check if agent is executing:**
```typescript
isExecuting(agentId: string): boolean
```

**Get all active execution IDs:**
```typescript
getActiveExecutions(): string[]
```

**Get current queue depth:**
```typescript
getQueueDepth(): number
```

**Get pool statistics:**
```typescript
getPoolStatistics(): PoolStatistics

interface PoolStatistics {
  activeExecutions: number;
  queuedExecutions: number;
  maxConcurrent: number;
  totalExecuted: number;
}
```

---

### Metrics & Monitoring

Prometheus metrics collection and HTTP server for monitoring.

#### Metrics Registry

Export Prometheus metrics registry and collectors.

```typescript
import { metricsRegistry } from '@recursive-manager/core';

// Get metrics in Prometheus format
const metrics = await metricsRegistry.metrics();
console.log(metrics);
```

---

#### Metrics Collectors

**Execution Metrics:**
```typescript
import {
  executionCounter,
  executionDuration,
  activeExecutionsGauge
} from '@recursive-manager/core';

// Counters
executionCounter.inc({ mode: 'continuous', agentId: 'dev-001', status: 'success' });

// Histograms
executionDuration.observe({ mode: 'continuous' }, 1500); // 1500ms

// Gauges
activeExecutionsGauge.set(3);
```

**Available Metrics:**
- `executionCounter` - Total executions (labels: mode, agentId, status)
- `executionDuration` - Execution duration histogram (labels: mode)
- `tasksCompletedCounter` - Tasks completed (labels: agentId)
- `messagesProcessedCounter` - Messages processed (labels: agentId)
- `activeExecutionsGauge` - Active executions gauge
- `queueDepthGauge` - Queue depth gauge
- `queueWaitTime` - Queue wait time histogram
- `quotaViolationsCounter` - Quota violations (labels: type, agentId)
- `agentHealthGauge` - Agent health score (labels: agentId)
- `analysisCounter` - Analyses performed (labels: agentId, status)
- `analysisDuration` - Analysis duration histogram
- `memoryUsageGauge` - Memory usage in bytes
- `cpuUsageGauge` - CPU usage percentage

---

#### Recording Functions

Convenience functions for recording metrics.

```typescript
import { recordExecution, recordAnalysis, updatePoolMetrics } from '@recursive-manager/core';

// Record execution
recordExecution({
  mode: 'continuous',
  agentId: 'dev-001',
  durationMs: 1500,
  success: true,
  tasksCompleted: 3,
  messagesProcessed: 2
});

// Record analysis
recordAnalysis({
  agentId: 'cto-001',
  durationMs: 800,
  success: true,
  perspectiveCount: 8
});

// Update pool metrics
updatePoolMetrics({
  activeCount: 5,
  queueDepth: 10
});
```

**All Recording Functions:**
- `recordExecution(params)` - Record execution metrics
- `recordAnalysis(params)` - Record analysis metrics
- `updatePoolMetrics(params)` - Update pool gauges
- `recordQueueWaitTime(waitTimeMs)` - Record queue wait time
- `recordQuotaViolation(type, agentId)` - Record quota violation
- `updateAgentHealth(agentId, healthScore)` - Update agent health
- `updateMemoryUsage()` - Update memory usage gauge
- `updateCpuUsage()` - Update CPU usage gauge
- `updateSystemMetrics()` - Update all system metrics
- `getMetrics()` - Get Prometheus metrics string
- `resetMetrics()` - Reset all metrics

---

#### Metrics HTTP Server

HTTP server for Prometheus scraping.

```typescript
import { MetricsServer, startMetricsServer } from '@recursive-manager/core';

// Start server
const server = await startMetricsServer({
  port: 9090,
  path: '/metrics',
  host: 'localhost'
});

// Server is now running at http://localhost:9090/metrics

// Stop server
await server.stop();
```

**MetricsServer Class:**
```typescript
class MetricsServer {
  constructor(config: MetricsServerConfig);
  async start(): Promise<void>;
  async stop(): Promise<void>;
  isRunning(): boolean;
}

interface MetricsServerConfig {
  port?: number;              // Default: 9090
  path?: string;              // Default: '/metrics'
  host?: string;              // Default: 'localhost'
}
```

**Endpoints:**
- `GET /metrics` - Prometheus metrics
- `GET /health` - Health check

---

### Execution State

Save and load execution results and metadata.

#### `saveExecutionResult()`

Save execution result with metadata to database.

```typescript
async function saveExecutionResult(
  agentId: string,
  result: ExecutionResult,
  metadata: AgentMetadata
): Promise<void>
```

**Parameters:**
- `agentId` - Agent identifier
- `result` - Execution result
- `metadata` - Agent metadata

**Throws:**
- `SaveExecutionResultError` - Save failed

---

### Messaging

Write and manage agent messages.

#### `writeMessageToInbox()`

Write a message to an agent's inbox.

```typescript
async function writeMessageToInbox(
  agentId: string,
  message: MessageData
): Promise<void>
```

**Parameters:**
- `agentId` - Recipient agent
- `message` - Message data

**Message Format:**
```typescript
interface MessageData {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: string;
  channel: string;
  [key: string]: unknown;
}
```

---

#### Helper Functions

**Generate message ID:**
```typescript
function generateMessageId(): string
```
Returns unique message ID (e.g., `'msg-1704067200000-abc123'`).

**Format message file:**
```typescript
function formatMessageFile(message: MessageData): string
```
Returns formatted message string for file storage.

---

## CLI Package API

**Package:** `@recursive-manager/cli`
**Version:** 0.1.0

### Org Chart Visualization

Format and display agent organization charts with multiple output formats.

#### `formatOrgChart()`

Format organization chart in specified format.

```typescript
function formatOrgChart(
  orgChart: OrgChartEntry[],
  format: 'tree' | 'indented' | 'table' | 'json' = 'tree',
  options?: FormatOptions
): string
```

**Parameters:**
- `orgChart` - Array of org chart entries
- `format` - Output format
  - `'tree'`: ASCII tree with box-drawing characters
  - `'indented'`: Indented list with depth markers
  - `'table'`: Formatted table with columns
  - `'json'`: JSON string
- `options` - Formatting options

**Options:**
```typescript
interface FormatOptions {
  showStatus?: boolean;        // Show agent status (active/paused/fired)
  showCreatedAt?: boolean;     // Show agent creation date
  showStats?: boolean;         // Show execution statistics
  useColor?: boolean;          // Use ANSI color codes
  maxDepth?: number;           // Maximum depth to display (0 = all)
}
```

**Returns:** Formatted string

**Example:**
```typescript
import { formatOrgChart } from '@recursive-manager/cli';
import { getOrgChart } from '@recursive-manager/common';

const db = getDatabase();
const orgChart = db.prepare('SELECT * FROM org_hierarchy').all();

// Tree format
console.log(formatOrgChart(orgChart, 'tree', { useColor: true }));

// Table format with stats
console.log(formatOrgChart(orgChart, 'table', {
  showStats: true,
  showStatus: true
}));
```

**Tree Output Example:**
```
CEO (ceo-001) [active]
├── CTO (cto-001) [active]
│   ├── Senior Dev (dev-001) [active]
│   └── Junior Dev (dev-002) [paused]
└── CFO (cfo-001) [active]
    └── Accountant (acc-001) [active]
```

---

#### Format-Specific Functions

```typescript
function formatAsTree(orgChart: OrgChartEntry[], options?: FormatOptions): string
function formatAsIndented(orgChart: OrgChartEntry[], options?: FormatOptions): string
function formatAsTable(orgChart: OrgChartEntry[], options?: FormatOptions): string
function formatAsJSON(orgChart: OrgChartEntry[], options?: FormatOptions): string
```

---

#### `displayOrgChart()`

Display organization chart directly to console.

```typescript
function displayOrgChart(
  orgChart: OrgChartEntry[],
  format?: 'tree' | 'indented' | 'table' | 'json',
  options?: FormatOptions
): void
```

**Example:**
```typescript
import { displayOrgChart } from '@recursive-manager/cli';

displayOrgChart(orgChart, 'tree', { useColor: true, showStats: true });
```

---

#### Types

```typescript
interface OrgChartEntry {
  agent: AgentRecord;
  depth: number;
  path: string;
}

interface AgentRecord {
  id: string;
  role: string;
  display_name: string;
  reporting_to: string | null;
  status: 'active' | 'paused' | 'fired';
  total_executions: number;
  total_runtime_minutes: number;
  created_at: string;
  updated_at: string;
}
```

---

## Adapters Package API

**Package:** `@recursive-manager/adapters`
**Version:** 0.1.0

### Framework Adapter Types

Core types for framework integration.

#### `FrameworkAdapter` Interface

```typescript
interface FrameworkAdapter {
  readonly name: string;
  readonly version: string;

  executeAgent(
    agentId: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  supportsFeature(feature: string): boolean;
  getCapabilities(): Capability[];
  healthCheck(): Promise<boolean>;
}
```

---

#### `ExecutionMode`

```typescript
type ExecutionMode = 'continuous' | 'reactive';
```

---

#### `ExecutionContext`

```typescript
interface ExecutionContext {
  agentId: string;
  mode: ExecutionMode;
  config: AgentConfig;
  activeTasks: TaskSchema[];
  messages: Message[];
  workspaceFiles: string[];
  workspaceDir: string;
  workingDir: string;
}
```

---

#### `ExecutionResult`

```typescript
interface ExecutionResult {
  success: boolean;
  duration: number;                  // milliseconds
  tasksCompleted: number;
  messagesProcessed: number;
  errors: Array<{
    message: string;
    stack?: string;
    code?: string;
  }>;
  nextExecution?: Date;
  metadata?: {
    filesCreated?: string[];
    filesModified?: string[];
    apiCallCount?: number;
    costUSD?: number;
    output?: string;
  };
}
```

---

#### `TaskSchema`

```typescript
interface TaskSchema {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'completed' | 'failed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  parentTaskId?: string;
  delegatedTo?: string;
  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
}
```

---

#### `Message`

```typescript
interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  channel: string;
  timestamp: string;                 // ISO 8601
  read: boolean;
}
```

---

#### `Capability`

```typescript
interface Capability {
  name: string;                      // e.g., "file-operations"
  description: string;
  available: boolean;
  version?: string;
}
```

---

### Adapter Registry

Manage multiple framework adapters with health checking and fallback support.

#### `AdapterRegistry` Class

```typescript
class AdapterRegistry {
  constructor(config?: AdapterRegistryConfig);

  // Registration
  register(adapter: FrameworkAdapter): void;
  unregister(name: string): boolean;

  // Lookup
  get(name: string): FrameworkAdapter | undefined;
  getDefault(): FrameworkAdapter;
  getOrDefault(name?: string): FrameworkAdapter;
  has(name: string): boolean;

  // Listing
  list(): string[];
  listAll(): Array<{ name: string; info: AdapterInfo }>;
  size(): number;
  isEmpty(): boolean;

  // Configuration
  getDefaultName(): string | undefined;
  setDefault(name: string): void;

  // Capabilities
  getVersion(name: string): string | undefined;
  getCapabilities(name: string): Capability[] | undefined;
  supportsFeature(name: string, feature: string): boolean;
  findByFeature(feature: string): FrameworkAdapter[];
  findByCapability(capabilityName: string): FrameworkAdapter[];

  // Health checks
  healthCheck(name: string): Promise<boolean>;
  healthCheckAll(): Promise<Map<string, boolean>>;
  getHealthStatus(name: string): { healthy?: boolean; lastCheck?: Date };
  getHealthStatusAll(): Map<string, { healthy?: boolean; lastCheck?: Date }>;
  enableAutoHealthCheck(interval?: number): void;
  disableAutoHealthCheck(): void;

  // Fallback support
  getHealthyAdapter(
    primaryName: string,
    fallbackName?: string
  ): Promise<{ adapter: FrameworkAdapter; usedFallback: boolean } | undefined>;

  findHealthyAdapter(): Promise<FrameworkAdapter | undefined>;

  // Cleanup
  clear(): void;
}
```

**Configuration:**
```typescript
interface AdapterRegistryConfig {
  defaultAdapter?: string;
  autoHealthCheck?: boolean;
  healthCheckInterval?: number;       // milliseconds
}

interface AdapterInfo {
  adapter: FrameworkAdapter;
  registeredAt: Date;
  lastHealthCheck?: Date;
  healthy?: boolean;
}
```

**Example:**
```typescript
import { AdapterRegistry, ClaudeCodeAdapter } from '@recursive-manager/adapters';

const registry = new AdapterRegistry({
  defaultAdapter: 'claude-code',
  autoHealthCheck: true,
  healthCheckInterval: 60000  // 1 minute
});

// Register adapter
const claudeAdapter = new ClaudeCodeAdapter();
registry.register(claudeAdapter);

// Get adapter
const adapter = registry.get('claude-code');

// Check health
const healthy = await registry.healthCheck('claude-code');
console.log('Claude Code adapter healthy:', healthy);

// Get with fallback
const { adapter: healthyAdapter, usedFallback } = await registry.getHealthyAdapter(
  'claude-code',
  'opencode'
);
```

---

### Claude Code Adapter

Official adapter for Claude Code framework.

#### `ClaudeCodeAdapter` Class

```typescript
class ClaudeCodeAdapter implements FrameworkAdapter {
  readonly name: string = 'claude-code';
  readonly version: string;

  constructor(options?: ClaudeCodeAdapterOptions);

  executeAgent(
    agentId: string,
    mode: ExecutionMode,
    context: ExecutionContext
  ): Promise<ExecutionResult>;

  supportsFeature(feature: string): boolean;
  getCapabilities(): Capability[];
  healthCheck(): Promise<boolean>;
}
```

**Options:**
```typescript
interface ClaudeCodeAdapterOptions {
  cliPath?: string;                   // Path to claude CLI (default: 'claude')
  timeout?: number;                   // milliseconds (default: 60 min)
  debug?: boolean;
  maxRetries?: number;                // (default: 3)
}
```

**Supported Features:**
- `continuous-mode`
- `reactive-mode`
- `file-operations`
- `code-generation`
- `code-analysis`
- `bash-execution`
- `task-management`
- `multi-file-editing`
- `context-awareness`
- `error-recovery`

**Example:**
```typescript
import { ClaudeCodeAdapter } from '@recursive-manager/adapters';

const adapter = new ClaudeCodeAdapter({
  cliPath: '/usr/local/bin/claude',
  timeout: 120000,  // 2 minutes
  debug: true
});

const result = await adapter.executeAgent('dev-001', 'continuous', context);
console.log(`Completed ${result.tasksCompleted} tasks`);
```

---

### Execution Context

Load execution context for agents.

#### `loadExecutionContext()`

Load complete execution context from database and filesystem.

```typescript
async function loadExecutionContext(
  db: Database,
  agentId: string,
  mode: ExecutionMode,
  options?: LoadContextOptions
): Promise<ExecutionContext>
```

**Parameters:**
- `db` - Database connection
- `agentId` - Agent identifier
- `mode` - Execution mode
- `options` - Loading options

**Options:**
```typescript
interface LoadContextOptions extends PathOptions {
  maxWorkspaceFiles?: number;         // Default: 100
  maxWorkspaceDepth?: number;         // Default: 3
  maxMessages?: number;               // Default: 50
}
```

**Throws:**
- `ContextLoadError` - Context loading failed

**Example:**
```typescript
import { loadExecutionContext } from '@recursive-manager/adapters';
import { getDatabase } from '@recursive-manager/common';

const db = getDatabase();
const context = await loadExecutionContext(db, 'dev-001', 'continuous', {
  maxWorkspaceFiles: 200,
  maxMessages: 100
});

console.log(`Loaded ${context.activeTasks.length} tasks`);
console.log(`Loaded ${context.messages.length} messages`);
console.log(`Loaded ${context.workspaceFiles.length} files`);
```

---

#### Helper Functions

```typescript
async function loadConfig(agentId: string, options?: LoadContextOptions): Promise<AgentConfig>
async function loadTasks(db: Database, agentId: string): Promise<TaskSchema[]>
async function loadMessages(db: Database, agentId: string, options?: LoadContextOptions): Promise<Message[]>
async function loadWorkspaceFiles(agentId: string, options?: LoadContextOptions): Promise<string[]>

function validateExecutionContext(context: ExecutionContext): void
```

---

### Prompt Templates

Build execution prompts for different modes.

#### `buildContinuousPrompt()`

Build prompt for continuous mode execution.

```typescript
function buildContinuousPrompt(
  agent: AgentConfig,
  tasks: TaskSchema[],
  context: ExecutionContext
): string
```

**Parameters:**
- `agent` - Agent configuration
- `tasks` - Active tasks
- `context` - Execution context

**Returns:** Formatted prompt string

---

#### `buildReactivePrompt()`

Build prompt for reactive mode execution.

```typescript
function buildReactivePrompt(
  agent: AgentConfig,
  messages: Message[],
  context: ExecutionContext
): string
```

**Parameters:**
- `agent` - Agent configuration
- `messages` - Unread messages
- `context` - Execution context

**Returns:** Formatted prompt string

---

#### `buildMultiPerspectivePrompt()`

Build prompt for multi-perspective analysis.

```typescript
function buildMultiPerspectivePrompt(
  context: string,
  perspectives: string[]
): string
```

**Parameters:**
- `context` - Decision context
- `perspectives` - Array of perspective names

**Returns:** Formatted analysis prompt

---

## Scheduler Package API

**Package:** `@recursive-manager/scheduler`
**Version:** 0.1.0

### Schedule Manager

Manage cron-based schedules with dependencies and execution pool integration.

#### `ScheduleManager` Class

```typescript
class ScheduleManager {
  constructor(db: Database, executionPool?: ExecutionPool);

  // Schedule management
  createCronSchedule(input: CreateCronScheduleInput): string;
  getScheduleById(scheduleId: string): ScheduleRecord | undefined;
  getSchedulesByAgentId(agentId: string): ScheduleRecord[];
  deleteSchedule(scheduleId: string): void;

  // Execution control
  enableSchedule(scheduleId: string): void;
  disableSchedule(scheduleId: string): void;
  updateScheduleAfterExecution(scheduleId: string): void;

  // Dependencies
  getScheduleDependencies(scheduleId: string): string[];
  getCompletedScheduleIds(): string[];

  // Readiness
  getSchedulesReadyToExecute(): ScheduleRecord[];
  getSchedulesReadyWithDependencies(): ScheduleRecord[];

  // Pool integration
  setExecutionId(scheduleId: string, executionId: string | null): void;
  submitScheduleToPool<T>(
    scheduleId: string,
    executionFn: () => Promise<T>,
    priority?: 'low' | 'medium' | 'high'
  ): Promise<boolean>;

  // Built-in schedules
  registerDailyArchivalJob(agentId?: string): string;
  registerDeadlockMonitoringJob(agentId?: string): string;
}
```

---

#### `createCronSchedule()`

Create a cron-based schedule.

```typescript
createCronSchedule(input: CreateCronScheduleInput): string
```

**Parameters:**
```typescript
interface CreateCronScheduleInput {
  agentId: string;
  description: string;
  cronExpression: string;           // e.g., '0 9 * * 1-5' (9 AM weekdays)
  timezone?: string;                // Default: 'UTC'
  enabled?: boolean;                // Default: true
  dependencies?: string[];          // Schedule IDs that must complete first
}
```

**Returns:** Schedule ID (string)

**Example:**
```typescript
import { ScheduleManager } from '@recursive-manager/scheduler';
import { getDatabase } from '@recursive-manager/common';

const db = getDatabase();
const scheduler = new ScheduleManager(db);

// Daily backup at 2 AM UTC
const scheduleId = scheduler.createCronSchedule({
  agentId: 'backup-agent',
  description: 'Daily database backup',
  cronExpression: '0 2 * * *',
  timezone: 'UTC'
});

console.log('Created schedule:', scheduleId);
```

---

#### `getScheduleById()`

Get schedule by ID.

```typescript
getScheduleById(scheduleId: string): ScheduleRecord | undefined
```

**Returns:**
```typescript
interface ScheduleRecord {
  id: string;
  agent_id: string;
  trigger_type: ScheduleTriggerType;
  description: string | null;
  cron_expression: string | null;
  timezone: string;
  next_execution_at: string | null;
  minimum_interval_seconds: number | null;
  only_when_tasks_pending: number;
  enabled: number;
  last_triggered_at: string | null;
  dependencies: string;              // JSON array
  execution_id: string | null;
  created_at: string;
  updated_at: string;
}

type ScheduleTriggerType = 'continuous' | 'cron' | 'reactive';
```

---

#### `getSchedulesReadyToExecute()`

Get all schedules ready to execute (ignoring dependencies).

```typescript
getSchedulesReadyToExecute(): ScheduleRecord[]
```

---

#### `getSchedulesReadyWithDependencies()`

Get all schedules ready to execute (respecting dependencies).

```typescript
getSchedulesReadyWithDependencies(): ScheduleRecord[]
```

**Example:**
```typescript
const readySchedules = scheduler.getSchedulesReadyWithDependencies();
console.log(`${readySchedules.length} schedules ready to execute`);

for (const schedule of readySchedules) {
  await scheduler.submitScheduleToPool(
    schedule.id,
    async () => {
      // Execute agent
      await orchestrator.executeContinuous(schedule.agent_id);
    },
    'medium'
  );
}
```

---

#### `submitScheduleToPool()`

Submit schedule to execution pool.

```typescript
async submitScheduleToPool<T>(
  scheduleId: string,
  executionFn: () => Promise<T>,
  priority?: 'low' | 'medium' | 'high'
): Promise<boolean>
```

**Parameters:**
- `scheduleId` - Schedule identifier
- `executionFn` - Async function to execute
- `priority` - Task priority (default: 'medium')

**Returns:** `true` if submitted successfully

---

#### Built-in Schedules

**Daily archival job:**
```typescript
registerDailyArchivalJob(agentId?: string): string
```

Creates schedule to archive old tasks daily at 2 AM UTC.

**Deadlock monitoring job:**
```typescript
registerDeadlockMonitoringJob(agentId?: string): string
```

Creates schedule to monitor for deadlocks every 15 minutes.

---

## Common Package API

**Package:** `@recursive-manager/common`
**Version:** 0.1.0

### Version Information

Get version and release information.

#### Constants

```typescript
export const VERSION: string;
export const RELEASE_DATE: string;
export const RELEASE_URL: string;
```

#### `getVersionInfo()`

```typescript
function getVersionInfo(): VersionInfo

interface VersionInfo {
  version: string;
  releaseDate: string;
  releaseUrl: string;
}
```

**Example:**
```typescript
import { VERSION, getVersionInfo } from '@recursive-manager/common';

console.log('Version:', VERSION);

const info = getVersionInfo();
console.log('Released:', info.releaseDate);
```

---

### File I/O Operations

Atomic file operations with backup and recovery.

#### `atomicWrite()`

Write file atomically (write to temp, rename).

```typescript
async function atomicWrite(
  filePath: string,
  content: string,
  options?: AtomicWriteOptions
): Promise<void>

function atomicWriteSync(
  filePath: string,
  content: string,
  options?: AtomicWriteOptions
): void
```

**Options:**
```typescript
interface AtomicWriteOptions {
  createDirs?: boolean;               // Create parent directories
  encoding?: BufferEncoding;          // Default: 'utf8'
  mode?: number;                      // File permissions
}
```

**Throws:**
- `AtomicWriteError` - Write failed

**Example:**
```typescript
import { atomicWrite } from '@recursive-manager/common';

await atomicWrite('/path/to/file.json', JSON.stringify(data, null, 2), {
  createDirs: true,
  mode: 0o644
});
```

---

#### `createBackup()`

Create backup copy of file.

```typescript
async function createBackup(
  filePath: string,
  options?: BackupOptions
): Promise<string | null>

function createBackupSync(
  filePath: string,
  options?: BackupOptions
): string | null
```

**Options:**
```typescript
interface BackupOptions {
  createDirs?: boolean;
  backupExtension?: string;           // Default: '.backup'
  compressionLevel?: number;          // 0-9, 0 = no compression
}
```

**Returns:** Backup file path or null if file doesn't exist

**Throws:**
- `BackupError` - Backup failed

**Example:**
```typescript
import { createBackup } from '@recursive-manager/common';

const backupPath = await createBackup('/path/to/config.json', {
  backupExtension: '.bak',
  compressionLevel: 6
});

console.log('Backup created:', backupPath);
// Output: /path/to/config.json.bak
```

---

#### `cleanupBackups()`

Delete old backup files matching pattern.

```typescript
async function cleanupBackups(
  pattern: string,
  options?: CleanupBackupsOptions
): Promise<CleanupResult>

function cleanupBackupsSync(
  pattern: string,
  options?: CleanupBackupsOptions
): CleanupResult
```

**Options:**
```typescript
interface CleanupBackupsOptions {
  retentionDays?: number;             // Default: 7
  keepCount?: number;                 // Minimum backups to keep
  dryRun?: boolean;                   // Don't delete, just report
}
```

**Returns:**
```typescript
interface CleanupResult {
  filesDeleted: number;
  bytesFreed: number;
  errors: string[];
}
```

**Example:**
```typescript
import { cleanupBackups } from '@recursive-manager/common';

const result = await cleanupBackups('/path/to/*.backup', {
  retentionDays: 30,
  keepCount: 5
});

console.log(`Deleted ${result.filesDeleted} files, freed ${result.bytesFreed} bytes`);
```

---

#### Constants

```typescript
export const DEFAULT_RETENTION_DAYS: number;   // 7
export const DEFAULT_RETENTION_MS: number;     // 604800000 (7 days)
```

---

### Directory Permissions

Check and manage directory permissions.

#### `checkDirectoryPermissions()`

Check directory permissions.

```typescript
async function checkDirectoryPermissions(
  dirPath: string,
  options?: DirectoryPermissionOptions
): Promise<PermissionCheckResult>

function checkDirectoryPermissionsSync(
  dirPath: string,
  options?: DirectoryPermissionOptions
): PermissionCheckResult
```

**Options:**
```typescript
interface DirectoryPermissionOptions {
  requiredPermissions?: number;       // Default: 0o755
  ownerOnly?: boolean;                // Default: false
}
```

**Returns:**
```typescript
interface PermissionCheckResult {
  readable: boolean;
  writable: boolean;
  executable: boolean;
  mode: number;
  ownerOnly: boolean;
}
```

**Example:**
```typescript
import { checkDirectoryPermissions } from '@recursive-manager/common';

const result = await checkDirectoryPermissions('/path/to/dir', {
  requiredPermissions: 0o755,
  ownerOnly: false
});

console.log('Readable:', result.readable);
console.log('Writable:', result.writable);
console.log('Mode:', result.mode.toString(8)); // Octal
```

---

#### `ensureDirectoryPermissions()`

Ensure directory has correct permissions (sets if needed).

```typescript
async function ensureDirectoryPermissions(
  dirPath: string,
  options?: DirectoryPermissionOptions
): Promise<void>

function ensureDirectoryPermissionsSync(
  dirPath: string,
  options?: DirectoryPermissionOptions
): void
```

**Throws:**
- `PermissionError` - Permission check/set failed

---

#### `setDirectoryPermissions()`

Set directory permissions.

```typescript
async function setDirectoryPermissions(dirPath: string, mode: number): Promise<void>
function setDirectoryPermissionsSync(dirPath: string, mode: number): void
```

---

#### `getDirectoryPermissions()`

Get directory permissions as number.

```typescript
async function getDirectoryPermissions(dirPath: string): Promise<number>
function getDirectoryPermissionsSync(dirPath: string): number
```

---

#### Constants

```typescript
export const DEFAULT_DIRECTORY_MODE: number;   // 0o755
```

---

### Disk Space Management

Check and manage disk space.

#### `getDiskSpace()`

Get disk space information for path.

```typescript
async function getDiskSpace(filePath: string): Promise<DiskSpaceInfo>
function getDiskSpaceSync(filePath: string): DiskSpaceInfo
```

**Returns:**
```typescript
interface DiskSpaceInfo {
  total: number;                      // Total bytes
  available: number;                  // Available bytes
  free: number;                       // Free bytes
  used: number;                       // Used bytes
  capacity: number;                   // Usage percentage (0-100)
}
```

**Example:**
```typescript
import { getDiskSpace, formatBytes } from '@recursive-manager/common';

const info = await getDiskSpace('/home/user');
console.log('Total:', formatBytes(info.total));
console.log('Available:', formatBytes(info.available));
console.log('Capacity:', info.capacity + '%');
```

---

#### `checkDiskSpace()`

Check if sufficient disk space available.

```typescript
async function checkDiskSpace(
  filePath: string,
  options?: CheckDiskSpaceOptions
): Promise<DiskSpaceSufficiencyResult>

function checkDiskSpaceSync(
  filePath: string,
  options?: CheckDiskSpaceOptions
): DiskSpaceSufficiencyResult
```

**Options:**
```typescript
interface CheckDiskSpaceOptions {
  minFreeBytes?: number;              // Default: 100 MB
  minFreePercent?: number;            // Default: 5%
}
```

**Returns:**
```typescript
interface DiskSpaceSufficiencyResult {
  sufficient: boolean;
  available: number;
  required: number;
  message: string;
}
```

**Example:**
```typescript
import { checkDiskSpace } from '@recursive-manager/common';

const result = await checkDiskSpace('/var/lib/recursive-manager', {
  minFreeBytes: 1024 * 1024 * 1024,  // 1 GB
  minFreePercent: 10
});

if (!result.sufficient) {
  console.error('Insufficient disk space:', result.message);
}
```

---

#### `ensureSufficientDiskSpace()`

Ensure sufficient disk space (throws if not).

```typescript
async function ensureSufficientDiskSpace(
  filePath: string,
  options?: CheckDiskSpaceOptions
): Promise<void>

function ensureSufficientDiskSpaceSync(
  filePath: string,
  options?: CheckDiskSpaceOptions
): void
```

**Throws:**
- `DiskSpaceError` - Insufficient disk space

---

#### `formatBytes()`

Format bytes as human-readable string.

```typescript
function formatBytes(bytes: number, decimals?: number): string
```

**Example:**
```typescript
import { formatBytes } from '@recursive-manager/common';

console.log(formatBytes(1024));              // "1.00 KB"
console.log(formatBytes(1536, 0));           // "2 KB"
console.log(formatBytes(1073741824));        // "1.00 GB"
```

---

#### Constants

```typescript
export const DEFAULT_MIN_FREE_SPACE_BYTES: number;   // 104857600 (100 MB)
export const DEFAULT_MIN_FREE_PERCENT: number;       // 5
```

---

### Path Utilities

Path construction and validation utilities.

#### Path Constants

```typescript
export const DEFAULT_BASE_DIR: string;   // ~/.recursive-manager
```

---

#### Path Construction

```typescript
function getAgentShard(agentId: string): string
function getAgentDirectory(agentId: string, options?: PathOptions): string
function getTaskPath(agentId: string, taskId: string, options?: PathOptions): string
function getInboxPath(agentId: string, options?: PathOptions): string
function getOutboxPath(agentId: string, options?: PathOptions): string
function getWorkspacePath(agentId: string, options?: PathOptions): string
function getSubordinatesPath(agentId: string, options?: PathOptions): string
function getConfigPath(agentId: string, options?: PathOptions): string
function getSchedulePath(agentId: string, options?: PathOptions): string
function getMetadataPath(agentId: string, options?: PathOptions): string
function getLogsDirectory(options?: PathOptions): string
function getAgentLogPath(agentId: string, options?: PathOptions): string
function getDatabasePath(options?: PathOptions): string
function getBackupsDirectory(options?: PathOptions): string
```

**Path Options:**
```typescript
interface PathOptions {
  baseDir?: string;                   // Default: DEFAULT_BASE_DIR
}
```

**Example:**
```typescript
import {
  getAgentDirectory,
  getConfigPath,
  getWorkspacePath
} from '@recursive-manager/common';

const agentDir = getAgentDirectory('ceo-001');
// /home/user/.recursive-manager/agents/ce/ceo-001

const configPath = getConfigPath('ceo-001');
// /home/user/.recursive-manager/agents/ce/ceo-001/config.json

const workspace = getWorkspacePath('ceo-001');
// /home/user/.recursive-manager/agents/ce/ceo-001/workspace
```

---

#### Path Validation

```typescript
function validateAgentId(agentId: string): boolean
function validateTaskId(taskId: string): boolean
function validatePathContainment(path: string, baseDir: string): boolean
function validateAgentPath(agentId: string, path: string, options?: PathOptions): boolean
function validateTaskPath(agentId: string, taskId: string, path: string, options?: PathOptions): boolean
function sanitizePathComponent(component: string): string
```

**Example:**
```typescript
import { validateAgentId, validatePathContainment, sanitizePathComponent } from '@recursive-manager/common';

// Validate agent ID
if (!validateAgentId('ceo-001')) {
  throw new Error('Invalid agent ID');
}

// Prevent path traversal
const safe = validatePathContainment(
  '/home/user/.recursive-manager/agents/ce/ceo-001/workspace/file.txt',
  '/home/user/.recursive-manager'
);

// Sanitize path component
const sanitized = sanitizePathComponent('../../../etc/passwd');
// Result: 'etc_passwd' (no path traversal)
```

---

### Schema Validation

JSON Schema validation for all RecursiveManager types.

#### Validation Functions

```typescript
function validateAgentConfig(config: unknown): ValidationResult
function validateAgentConfigStrict(config: unknown): void

function validateSchedule(schedule: unknown): ValidationResult
function validateScheduleStrict(schedule: unknown): void

function validateTask(task: unknown): ValidationResult
function validateTaskStrict(task: unknown): void

function validateMessage(message: unknown): ValidationResult
function validateMessageStrict(message: unknown): void

function validateMetadata(metadata: unknown): ValidationResult
function validateMetadataStrict(metadata: unknown): void

function validateSubordinates(subordinates: unknown): ValidationResult
function validateSubordinatesStrict(subordinates: unknown): void
```

**Validation Result:**
```typescript
type ValidationResult = {
  valid: boolean;
  errors?: string[];
}
```

**Example:**
```typescript
import { validateAgentConfig, validateAgentConfigStrict } from '@recursive-manager/common';

// Non-strict: Returns result
const result = validateAgentConfig(config);
if (!result.valid) {
  console.error('Validation errors:', result.errors);
}

// Strict: Throws on error
try {
  validateAgentConfigStrict(config);
} catch (error) {
  if (error instanceof SchemaValidationError) {
    console.error('Schema validation failed:', error.message);
  }
}
```

---

#### `clearValidatorCache()`

Clear AJV validator cache.

```typescript
function clearValidatorCache(): void
```

---

### File Recovery

Detect file corruption and recover from backups.

#### `detectCorruption()`

Detect file corruption.

```typescript
async function detectCorruption(filePath: string): Promise<CorruptionInfo | null>
function detectCorruptionSync(filePath: string): CorruptionInfo | null
```

**Returns:**
```typescript
interface CorruptionInfo {
  corrupted: boolean;
  reason: string;
  severity: 'low' | 'medium' | 'high';
  bytesAffected?: number;
}
```

**Returns `null`** if file doesn't exist.

**Example:**
```typescript
import { detectCorruption } from '@recursive-manager/common';

const corruption = await detectCorruption('/path/to/file.json');
if (corruption?.corrupted) {
  console.error(`Corruption detected: ${corruption.reason}`);
  console.error(`Severity: ${corruption.severity}`);
}
```

---

#### `findLatestBackup()`

Find most recent backup file.

```typescript
async function findLatestBackup(filePath: string): Promise<string | null>
function findLatestBackupSync(filePath: string): string | null
```

**Returns:** Backup file path or `null` if no backups exist.

---

#### `attemptRecovery()`

Attempt to recover corrupted file from backup.

```typescript
async function attemptRecovery(
  filePath: string,
  options?: RecoveryOptions
): Promise<RecoveryResult>

function attemptRecoverySync(
  filePath: string,
  options?: RecoveryOptions
): RecoveryResult
```

**Options:**
```typescript
interface RecoveryOptions {
  maxAttempts?: number;               // Default: 3
  preferBackup?: boolean;             // Default: true
}
```

**Returns:**
```typescript
interface RecoveryResult {
  recovered: boolean;
  source: 'backup' | 'cache' | 'partial' | 'none';
  bytesRecovered?: number;
  message: string;
}
```

**Throws:**
- `CorruptionError` - Recovery failed

**Example:**
```typescript
import { attemptRecovery } from '@recursive-manager/common';

const result = await attemptRecovery('/path/to/corrupted.json', {
  maxAttempts: 5,
  preferBackup: true
});

if (result.recovered) {
  console.log(`Recovered from ${result.source}`);
} else {
  console.error('Recovery failed:', result.message);
}
```

---

#### `safeLoad()`

Safely load file with automatic corruption detection and recovery.

```typescript
async function safeLoad(
  filePath: string,
  parser?: (content: string) => unknown
): Promise<unknown>

function safeLoadSync(
  filePath: string,
  parser?: (content: string) => unknown
): unknown
```

**Parameters:**
- `filePath` - File to load
- `parser` - Custom parser (default: JSON.parse)

**Throws:**
- `CorruptionError` - Load failed, recovery failed

**Example:**
```typescript
import { safeLoad } from '@recursive-manager/common';

const config = await safeLoad('/path/to/config.json');
// Automatically detects corruption and recovers from backup if needed
```

---

### Database Management

SQLite database initialization, health, and operations.

#### `initializeDatabase()`

Initialize database connection.

```typescript
async function initializeDatabase(
  options?: DatabaseOptions
): Promise<DatabaseConnection>
```

**Options:**
```typescript
interface DatabaseOptions {
  path?: string;                      // Default: ~/.recursive-manager/data.db
  readonly?: boolean;                 // Default: false
  timeout?: number;                   // Default: 5000ms
}
```

**Returns:**
```typescript
interface DatabaseConnection {
  db: Database;                       // better-sqlite3 Database
  release(): void;
}
```

**Example:**
```typescript
import { initializeDatabase } from '@recursive-manager/common';

const connection = await initializeDatabase({
  path: '/path/to/database.db',
  timeout: 10000
});

// Use database
const agents = connection.db.prepare('SELECT * FROM agents').all();

// Release connection
connection.release();
```

---

#### `getDatabase()`

Get singleton database pool.

```typescript
function getDatabase(): DatabasePool
```

**Example:**
```typescript
import { getDatabase } from '@recursive-manager/common';

const db = getDatabase();
const connection = db.getConnection();

// Use connection
const result = connection.db.prepare('SELECT * FROM agents WHERE id = ?').get('ceo-001');

// Release connection
connection.release();
```

---

#### Database Health

```typescript
async function getDatabaseHealth(): Promise<DatabaseHealthStatus>

interface DatabaseHealthStatus {
  healthy: boolean;
  uptime: number;
  queryCount: number;
  lastError?: string;
}
```

---

#### Database Utilities

```typescript
async function getDatabaseVersion(): Promise<string>
async function setDatabaseVersion(version: string): Promise<void>
async function checkDatabaseIntegrity(): Promise<boolean>
async function backupDatabase(): Promise<string>
async function optimizeDatabase(): Promise<void>
```

---

#### `transaction()`

Execute function in transaction.

```typescript
async function transaction<T>(fn: (db: Database) => T): Promise<T>
```

**Example:**
```typescript
import { transaction } from '@recursive-manager/common';

await transaction(async (db) => {
  db.prepare('INSERT INTO agents (id, role) VALUES (?, ?)').run('dev-001', 'Developer');
  db.prepare('UPDATE managers SET subordinate_count = subordinate_count + 1 WHERE id = ?').run('cto-001');
});
```

---

#### Constants

```typescript
export const TASK_MAX_DEPTH: number;                // 10
export const AGENT_MAX_HIERARCHY_DEPTH: number;     // 10
```

---

### Database Migrations

Database schema migration system.

#### `runMigrations()`

Run all pending migrations.

```typescript
async function runMigrations(): Promise<void>
```

---

#### `getMigrationStatus()`

Get migration status.

```typescript
async function getMigrationStatus(): Promise<MigrationStatus>

interface MigrationStatus {
  currentVersion: string;
  appliedMigrations: string[];
  pendingMigrations: string[];
}
```

**Example:**
```typescript
import { getMigrationStatus, runMigrations } from '@recursive-manager/common';

const status = await getMigrationStatus();
console.log('Current version:', status.currentVersion);
console.log('Pending migrations:', status.pendingMigrations);

if (status.pendingMigrations.length > 0) {
  await runMigrations();
  console.log('Migrations complete');
}
```

---

#### Other Migration Functions

```typescript
async function initializeMigrationTracking(): Promise<void>
async function getPendingMigrations(): Promise<Migration[]>
async function rollbackMigrations(count?: number): Promise<void>
async function validateMigrations(): Promise<boolean>
async function migrateToVersion(version: string): Promise<void>
```

---

### Database Queries

Pre-built queries for agents, tasks, messages, and audit logs.

#### Agent Queries

```typescript
function createAgent(db: Database, input: CreateAgentInput): AgentRecord
function getAgent(db: Database, agentId: string): AgentRecord | undefined
function updateAgent(db: Database, agentId: string, input: UpdateAgentInput): void
function getSubordinates(db: Database, agentId: string): AgentRecord[]
function getOrgChart(db: Database, rootAgentId?: string): OrgHierarchyRecord[]
```

**Types:**
```typescript
interface CreateAgentInput {
  id: string;
  role: string;
  display_name: string;
  reporting_to: string | null;
  status: AgentStatus;
  total_executions?: number;
  total_runtime_minutes?: number;
  created_at?: string;
}

interface UpdateAgentInput {
  role?: string;
  display_name?: string;
  status?: AgentStatus;
  reporting_to?: string | null;
}

type AgentStatus = 'active' | 'paused' | 'fired';

interface AgentRecord {
  id: string;
  role: string;
  display_name: string;
  reporting_to: string | null;
  status: AgentStatus;
  total_executions: number;
  total_runtime_minutes: number;
  created_at: string;
  updated_at: string;
}

interface OrgHierarchyRecord {
  agent_id: string;
  manager_id: string | null;
  depth: number;
}
```

**Example:**
```typescript
import { createAgent, getAgent, getOrgChart } from '@recursive-manager/common';
import { getDatabase } from '@recursive-manager/common';

const db = getDatabase().getConnection().db;

// Create agent
const agent = createAgent(db, {
  id: 'dev-001',
  role: 'Developer',
  display_name: 'Alice',
  reporting_to: 'cto-001',
  status: 'active'
});

// Get agent
const retrieved = getAgent(db, 'dev-001');

// Get org chart
const orgChart = getOrgChart(db, 'ceo-001');
```

---

#### Task Queries

```typescript
function createTask(db: Database, input: CreateTaskInput): TaskRecord
function getTask(db: Database, taskId: string): TaskRecord | undefined
function updateTaskStatus(db: Database, taskId: string, status: TaskStatus): void
function completeTask(db: Database, taskId: string): void
function updateParentTaskProgress(db: Database, parentTaskId: string): void
function getActiveTasks(db: Database, agentId: string): TaskRecord[]
function delegateTask(db: Database, taskId: string, delegatedTo: string): void
function detectTaskDeadlock(db: Database, taskId: string): boolean
function getBlockedTasks(db: Database, agentId: string): TaskRecord[]
```

**Types:**
```typescript
interface CreateTaskInput {
  id: string;
  agent_id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  parent_task_id?: string;
  delegated_to?: string;
}

type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'failed';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

interface TaskRecord {
  id: string;
  agent_id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  parent_task_id?: string;
  delegated_to?: string;
  created_at: string;
  last_updated: string;
}
```

---

#### Message Queries

```typescript
function createMessage(db: Database, input: MessageInput): MessageRecord
function getMessage(db: Database, messageId: string): MessageRecord | undefined
function getMessages(db: Database, filter: MessageFilter): MessageRecord[]
function markMessageAsRead(db: Database, messageId: string): void
function markMessageAsArchived(db: Database, messageId: string): void
function getUnreadMessageCount(db: Database, agentId: string): number
function deleteMessage(db: Database, messageId: string): void
```

**Types:**
```typescript
interface MessageInput {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  channel: string;
  content: string;
}

interface MessageFilter {
  agentId?: string;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}

interface MessageRecord {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  channel: string;
  content: string;
  timestamp: string;
  read: boolean;
}
```

---

#### Audit Queries

```typescript
function auditLog(db: Database, input: AuditEventInput): void
function queryAuditLog(db: Database, filter: AuditQueryFilter): AuditEventRecord[]
function getRecentAuditEvents(db: Database, agentId: string, limit?: number): AuditEventRecord[]
function getAuditStats(db: Database, filter?: AuditQueryFilter): { [key: string]: number }
```

**Audit Actions:**
```typescript
const AuditAction = {
  EXECUTE_START: 'execute_start',
  EXECUTE_END: 'execute_end',
  HIRE: 'hire',
  FIRE: 'fire',
  PAUSE: 'pause',
  RESUME: 'resume',
  // ... more actions
};
```

**Types:**
```typescript
interface AuditEventInput {
  agentId: string;
  action: AuditActionType;
  success: boolean;
  details?: Record<string, unknown>;
}

type AuditActionType = string;

interface AuditEventRecord {
  id: string;
  agent_id: string;
  action: string;
  success: boolean;
  details: string;            // JSON
  timestamp: string;
}

interface AuditQueryFilter {
  agentId?: string;
  action?: string;
  startTime?: Date;
  endTime?: Date;
  successOnly?: boolean;
  limit?: number;
}
```

**Example:**
```typescript
import { auditLog, queryAuditLog, AuditAction } from '@recursive-manager/common';

// Log audit event
auditLog(db, {
  agentId: 'ceo-001',
  action: AuditAction.HIRE,
  success: true,
  details: { hiredAgentId: 'dev-001' }
});

// Query audit log
const events = queryAuditLog(db, {
  agentId: 'ceo-001',
  action: AuditAction.HIRE,
  startTime: new Date('2026-01-01'),
  limit: 100
});
```

---

### Logging

Winston-based logging with hierarchy context and correlation IDs.

#### `createLogger()`

Create a logger instance.

```typescript
function createLogger(options?: LoggerOptions): Logger
```

**Options:**
```typescript
interface LoggerOptions {
  level?: LogLevel;                   // Default: 'info'
  console?: boolean;                  // Default: true
  file?: boolean;                     // Default: true
  filePath?: string;
  json?: boolean;                     // Default: false
  defaultMetadata?: LogMetadata;
  rotation?: boolean;                 // Default: true
  datePattern?: string;               // Default: 'YYYY-MM-DD'
  compress?: boolean;                 // Default: true
  maxFiles?: number | string;         // Default: '14d'
  maxSize?: string;                   // Default: '20m'
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug';
```

---

#### `Logger` Interface

```typescript
interface Logger {
  error(message: string, metadata?: LogMetadata): void;
  warn(message: string, metadata?: LogMetadata): void;
  info(message: string, metadata?: LogMetadata): void;
  debug(message: string, metadata?: LogMetadata): void;
  child(defaultMetadata: LogMetadata): Logger;
}

interface LogMetadata {
  traceId?: string;
  agentId?: string;
  taskId?: string;
  executionId?: string;
  managerId?: string;
  subordinateIds?: string[];
  hierarchyPath?: string;
  hierarchyDepth?: number;
  [key: string]: unknown;
}
```

**Example:**
```typescript
import { createLogger } from '@recursive-manager/common';

const logger = createLogger({
  level: 'debug',
  console: true,
  file: true,
  filePath: '/var/log/recursive-manager.log',
  rotation: true
});

logger.info('Agent hired', {
  agentId: 'dev-001',
  managerId: 'cto-001'
});

logger.error('Execution failed', {
  agentId: 'dev-001',
  executionId: 'exec-123',
  error: 'Timeout'
});
```

---

#### `createAgentLogger()`

Create logger for specific agent.

```typescript
function createAgentLogger(agentId: string): Logger
```

**Example:**
```typescript
import { createAgentLogger } from '@recursive-manager/common';

const logger = createAgentLogger('dev-001');
logger.info('Task started', { taskId: 'task-456' });
```

---

#### `createHierarchicalAgentLogger()`

Create logger with agent hierarchy context.

```typescript
function createHierarchicalAgentLogger(
  agentId: string,
  hierarchyContext: AgentHierarchyContext
): Logger

interface AgentHierarchyContext {
  agentId: string;
  managerId?: string;
  subordinateIds: string[];
  hierarchyPath: string;
  hierarchyDepth: number;
}
```

---

#### `getAgentHierarchyContext()`

Get agent's hierarchy context from database.

```typescript
async function getAgentHierarchyContext(
  db: Database,
  agentId: string
): Promise<AgentHierarchyContext>
```

**Example:**
```typescript
import {
  getAgentHierarchyContext,
  createHierarchicalAgentLogger,
  getDatabase
} from '@recursive-manager/common';

const db = getDatabase().getConnection().db;
const context = await getAgentHierarchyContext(db, 'dev-001');

const logger = createHierarchicalAgentLogger('dev-001', context);
logger.info('Execution started');
// Includes hierarchyPath, hierarchyDepth, managerId, subordinateIds in metadata
```

---

#### Correlation IDs

**Generate trace ID:**
```typescript
function generateTraceId(): string
```

**Request context management:**
```typescript
async function withTraceId<T>(fn: () => Promise<T>): Promise<T>
function getCurrentTraceId(): string | undefined
function setRequestContext(context: Record<string, unknown>): void
function getRequestContext(): Record<string, unknown> | undefined
```

**Example:**
```typescript
import { withTraceId, getCurrentTraceId, logger } from '@recursive-manager/common';

await withTraceId(async () => {
  const traceId = getCurrentTraceId();
  logger.info('Request started', { traceId });

  // All logs in this scope automatically include traceId
  await processRequest();

  logger.info('Request complete', { traceId });
});
```

---

#### Default Logger

```typescript
import { logger } from '@recursive-manager/common';

logger.info('Application started');
logger.error('Critical error', { error: err });
```

---

### PID Manager

Process ID lock management for daemon processes.

#### `acquirePidLock()`

Acquire PID lock for agent (prevents concurrent execution).

```typescript
async function acquirePidLock(
  agentId: string,
  options?: PidOptions
): Promise<() => Promise<void>>
```

**Parameters:**
- `agentId` - Agent identifier
- `options.baseDir` - Base directory

**Returns:** Release function

**Throws:**
- `PidError` - Lock acquisition failed (already locked)

**Example:**
```typescript
import { acquirePidLock } from '@recursive-manager/common';

const release = await acquirePidLock('dev-001');

try {
  // Execute agent (exclusive lock held)
  await executeAgent('dev-001');
} finally {
  // Release lock
  await release();
}
```

---

#### PID Utilities

```typescript
function removePidFileSync(agentId: string, options?: PidOptions): void
function isProcessRunningByPid(pid: number): boolean
async function isProcessRunning(agentId: string, options?: PidOptions): Promise<boolean>
async function readPidFile(agentId: string, options?: PidOptions): Promise<number | null>
async function writePidFile(agentId: string, pid: number, options?: PidOptions): Promise<void>
async function removePidFile(agentId: string, options?: PidOptions): Promise<void>
async function listActivePids(): Promise<PidInfo[]>
function getPidDirectory(options?: PidOptions): string
function getPidFilePath(agentId: string, options?: PidOptions): string
```

**Types:**
```typescript
interface PidInfo {
  agentId: string;
  pid: number;
  acquiredAt: Date;
}

interface PidOptions {
  baseDir?: string;
}
```

---

### Security

Database encryption and secret management.

#### `DatabaseEncryption`

Encrypt/decrypt database fields.

```typescript
class DatabaseEncryption {
  async encrypt(data: unknown): Promise<EncryptedData>;
  async decrypt(encrypted: EncryptedData): Promise<unknown>;
  async rotateKey(): Promise<void>;
}

interface EncryptedData {
  ciphertext: string;
  iv: string;
  salt: string;
  algorithm: string;
}
```

**Example:**
```typescript
import { DatabaseEncryption } from '@recursive-manager/common';

const encryption = new DatabaseEncryption();

const encrypted = await encryption.encrypt({ apiKey: 'secret-123' });
// Store encrypted.ciphertext, encrypted.iv, encrypted.salt

const decrypted = await encryption.decrypt(encrypted);
// { apiKey: 'secret-123' }
```

---

#### `APIKeyManager`

Manage API keys and secrets.

```typescript
class APIKeyManager {
  async storeSecret(name: string, value: string, metadata?: SecretMetadata): Promise<void>;
  async retrieveSecret(name: string): Promise<string | null>;
  async deleteSecret(name: string): Promise<void>;
  async listSecrets(): Promise<string[]>;
  async rotateSecret(name: string, newValue: string): Promise<void>;
}

interface SecretMetadata {
  description?: string;
  expiresAt?: Date;
  rotationRequired?: boolean;
  [key: string]: unknown;
}
```

**Example:**
```typescript
import { APIKeyManager } from '@recursive-manager/common';

const keyManager = new APIKeyManager();

// Store secret
await keyManager.storeSecret('anthropic_api_key', 'sk-ant-...', {
  description: 'Anthropic API key for multi-perspective analysis',
  rotationRequired: true
});

// Retrieve secret
const apiKey = await keyManager.retrieveSecret('anthropic_api_key');

// Rotate secret
await keyManager.rotateSecret('anthropic_api_key', 'sk-ant-new-...');
```

---

#### `SecretAuditLogger`

Audit log for secret access.

```typescript
class SecretAuditLogger {
  logAccess(action: string, secretName: string, details?: Record<string, unknown>): void;
  getAccessLog(secretName: string): AuditLogEntry[];
  clearAccessLog(secretName: string): void;
}

interface AuditLogEntry {
  timestamp: Date;
  action: string;
  secretName: string;
  success: boolean;
  details?: Record<string, unknown>;
}
```

---

## Type Definitions

Common type definitions used across packages.

### Agent Configuration

```typescript
interface AgentConfig {
  version: string;
  identity: AgentIdentity;
  goal: AgentGoal;
  permissions: AgentPermissions;
  framework: AgentFramework;
  communication?: CommunicationChannels;
  behavior?: AgentBehavior;
  metadata?: AgentMetadata;
}

interface AgentIdentity {
  id: string;
  role: string;
  displayName: string;
  createdAt: string;
  createdBy: string;
  reportingTo: string | null;
}

interface AgentGoal {
  mainGoal: string;
  subGoals?: string[];
  successCriteria?: string[];
}

interface AgentPermissions {
  canHire: boolean;
  maxSubordinates: number;
  hiringBudget: number;
  canFire?: boolean;
  canEscalate?: boolean;
  canAccessExternalAPIs?: boolean;
  allowedDomains?: string[];
  workspaceQuotaMB?: number;
  maxExecutionMinutes?: number;
}

interface AgentFramework {
  primary: 'claude-code' | 'opencode';
  fallback?: string;
  capabilities?: string[];
}

interface CommunicationChannels {
  preferredChannels?: string[];
  notifyManager?: {
    onTaskComplete?: boolean;
    onError?: boolean;
    onHire?: boolean;
    onFire?: boolean;
  };
  updateFrequency?: string;
}

interface AgentBehavior {
  multiPerspectiveAnalysis?: {
    enabled: boolean;
    perspectives?: string[];
    triggerOn?: string[];
  };
  escalationPolicy?: {
    autoEscalateAfterFailures?: number;
    escalateOnBlockedTask?: boolean;
    escalateOnBudgetExceeded?: boolean;
  };
  delegation?: {
    delegateThreshold?: string;
    keepWhenDelegating?: boolean;
    supervisionLevel?: string;
  };
}
```

---

## Error Handling

RecursiveManager uses typed errors for all error cases.

### Core Errors

```typescript
class ConfigLoadError extends Error {
  constructor(message: string, agentId: string, cause?: Error);
}

class ConfigSaveError extends Error {
  constructor(message: string, agentId: string, cause?: Error);
}

class SchemaValidationError extends Error {
  constructor(message: string, errors: string[]);
}

class BusinessValidationFailure extends Error {
  constructor(message: string, errors: BusinessValidationError[]);
}

class HireValidationError extends Error {
  constructor(message: string, errors: ValidationError[]);
}

class HireAgentError extends Error {
  constructor(message: string, agentId: string, cause?: Error);
}

class FireAgentError extends Error {
  constructor(message: string, agentId: string, cause?: Error);
}

class PauseAgentError extends Error {
  constructor(message: string, agentId: string, cause?: Error);
}

class ResumeAgentError extends Error {
  constructor(message: string, agentId: string, cause?: Error);
}

class ExecutionError extends Error {
  constructor(message: string, agentId: string, cause?: Error);
}

class AnalysisError extends Error {
  constructor(message: string, context: string, cause?: Error);
}

class SaveExecutionResultError extends Error {
  constructor(message: string, agentId: string, cause?: Error);
}
```

---

### Common Errors

```typescript
class AtomicWriteError extends Error {
  constructor(message: string, filePath: string, cause?: Error);
}

class BackupError extends Error {
  constructor(message: string, filePath: string, cause?: Error);
}

class PermissionError extends Error {
  constructor(message: string, dirPath: string, cause?: Error);
}

class DiskSpaceError extends Error {
  constructor(message: string, filePath: string, cause?: Error);
}

class PathError extends Error {
  constructor(message: string, path: string);
}

class CorruptionError extends Error {
  constructor(message: string, filePath: string, cause?: Error);
}

class PidError extends Error {
  constructor(message: string, agentId: string, cause?: Error);
}
```

---

### Adapters Errors

```typescript
class ContextLoadError extends Error {
  constructor(message: string, agentId: string, cause?: Error);
}
```

---

### Error Handling Example

```typescript
import {
  hireAgent,
  HireAgentError,
  HireValidationError,
  logger
} from '@recursive-manager/core';

try {
  const result = await hireAgent('cto-001', config);
  logger.info('Agent hired successfully', { agentId: result.agentId });
} catch (error) {
  if (error instanceof HireValidationError) {
    logger.error('Hire validation failed', {
      agentId: config.identity.id,
      validationErrors: error.errors
    });
  } else if (error instanceof HireAgentError) {
    logger.error('Hire operation failed', {
      agentId: error.agentId,
      error: error.message,
      cause: error.cause
    });
  } else {
    logger.error('Unexpected error', { error });
  }
}
```

---

## Related Documentation

- [CLI Reference](cli-reference.md) - All CLI commands
- [Configuration Guide](CONFIGURATION.md) - Environment variables and config files
- [Installation Guide](INSTALLATION.md) - Setup and installation
- [Monitoring Guide](MONITORING.md) - Prometheus metrics and Grafana dashboards
- [Docker Guide](DOCKER.md) - Docker deployment
- [Architecture Overview](ARCHITECTURE.md) - System design
- [Development Guide](DEVELOPMENT.md) - Contributing and development setup

---

**RecursiveManager** v1.0.0 - Production-Ready Hierarchical AI Agent Management
Documentation: https://github.com/user/RecursiveManager
Support: https://github.com/user/RecursiveManager/issues
