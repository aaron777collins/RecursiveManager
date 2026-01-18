# RecursiveManager: Comprehensive Implementation Plan

## Executive Summary

RecursiveManager is a **recursive agent hierarchy system** that models organizational structures using AI agents. Each agent operates as an autonomous employee with the ability to hire, fire, delegate, and escalate - all while maintaining fresh, stateless execution through file-based persistence.

**Core Philosophy:**
- **Quality over cost**: Multi-perspective analysis for all decisions (8+ perspectives)
- **Fresh memory**: Zero context between runs - all state read from files
- **Recursive delegation**: Non-trivial tasks spawn specialized sub-agents
- **Manager-worker duality**: Both manager and worker track delegated tasks
- **Adaptive scheduling**: Agents set their own proactive triggers based on task needs

**Technology Stack:**
- **Primary Framework**: Claude Code (OpenCode secondary support)
- **Architecture**: CLI tool with centralized scheduler daemon
- **State Management**: File-based (Markdown, JSON) + SQLite index
- **Messaging**: Modular (Slack, Telegram, Email)

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [File Structure Specification](#2-file-structure-specification)
3. [Agent Lifecycle](#3-agent-lifecycle)
4. [Task Management](#4-task-management)
5. [Execution Models](#5-execution-models)
6. [Scheduler System](#6-scheduler-system)
7. [Messaging Infrastructure](#7-messaging-infrastructure)
8. [Multi-Perspective Analysis](#8-multi-perspective-analysis)
9. [Framework Abstraction](#9-framework-abstraction)
10. [Edge Cases & Contingencies](#10-edge-cases--contingencies)
11. [Security & Safety](#11-security--safety)
12. [Implementation Phases](#12-implementation-phases)
13. [CLI Design](#13-cli-design)
14. [Testing Strategy](#14-testing-strategy)
15. [Deployment & Operations](#15-deployment--operations)

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER INTERACTIONS                        │
│  - CLI commands (rm hire, rm status, rm message)               │
│  - Slack/Telegram messages                                      │
│  - Email triggers                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    RECURSIVEMANAGER CORE                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Centralized Scheduler Daemon                             │  │
│  │  - Scans all agents/*/schedule.json (every 60s)          │  │
│  │  - Time-based triggers → reactive instances               │  │
│  │  - Smart spawning → continuous instances (only if work)  │  │
│  │  - Process registry (prevents duplicates)                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Messaging Relay                                          │  │
│  │  - Slack Module → Standardized Message Format            │  │
│  │  - Telegram Module → Standardized Message Format         │  │
│  │  - Email Module → Standardized Message Format            │  │
│  │  - Routes to correct agent, spawns reactive instance     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              ↓                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Agent Instance Orchestrator                              │  │
│  │  - Acquires locks (prevents duplicate instances)         │  │
│  │  - Loads context (config, tasks, inbox, workspace)       │  │
│  │  - Selects framework (Claude Code, OpenCode)             │  │
│  │  - Executes via framework adapter                        │  │
│  │  - Monitors (timeout, resource limits)                   │  │
│  │  - Updates state (tasks, progress, archive)              │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     FRAMEWORK ADAPTERS                          │
│  ┌─────────────────┐        ┌─────────────────┐               │
│  │  Claude Code    │        │  OpenCode       │               │
│  │  Adapter        │        │  Adapter        │               │
│  │  (Primary)      │        │  (Fallback)     │               │
│  └─────────────────┘        └─────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       FILE SYSTEM STATE                         │
│  agents/<agent-id>/                                             │
│    config.json, schedule.json, subordinates.json                │
│    tasks/active/, tasks/archive/                                │
│    workspace/notes.md, workspace/research/                      │
│    inbox/messages/                                              │
│                                                                  │
│  system/                                                         │
│    scheduler_state.json, process_registry.json                  │
│    org_chart.json, audit_log.jsonl                              │
│    database.sqlite (index for queries)                          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

**Scheduler Daemon:**
- Continuously scans `agents/*/schedule.json` (every 60s)
- Triggers reactive instances for time-based events
- Smart spawning: Only spawn continuous instances if pending work exists
- Maintains process registry to prevent duplicate instances
- Monitors and cleans stale locks

**Messaging Relay:**
- Receives messages from external platforms (Slack, Telegram, Email)
- Converts to standardized message format
- Routes to appropriate agent (mention → channel → keyword → CEO)
- Spawns reactive instance immediately
- Handles priority detection (urgent keywords)

**Agent Instance Orchestrator:**
- Acquires PID-based locks to prevent concurrent instances
- Loads agent context from files (config, tasks, inbox, workspace)
- Selects appropriate framework (Claude Code primary, OpenCode fallback)
- Constructs prompt from context and instance type
- Executes via framework adapter with timeout/resource limits
- Parses agent output for actions (hire, fire, update tasks, escalate)
- Updates state files atomically
- Releases locks and cleans up

**Framework Adapters:**
- Abstract interface for AI code generation frameworks
- Implements `execute(agent_id, instance_type, context) → result`
- Constructs framework-specific prompts
- Handles framework-specific error cases
- Logs execution details

**File System State:**
- All agent state persisted in files (Markdown for human-readable, JSON for structured)
- SQLite database for efficient queries (indexed view of file state)
- Hierarchical structure supports nested tasks and archival
- Agent workspace for long-term notes and research

### 1.3 Data Flow Examples

**Example 1: User hires a new agent**

```
User: rm hire --role "Backend Developer" --goal "Build REST API" --manager CTO

1. CLI validates input, generates agent ID (backend-dev-001)
2. Checks limits (max depth, max subordinates)
3. Creates directory: agents/backend-dev-001/
4. Writes initial config.json:
   {
     "id": "backend-dev-001",
     "role": "Backend Developer",
     "mainGoal": "Build REST API for user authentication",
     "reportingTo": "CTO",
     "createdAt": "2026-01-18T12:00:00Z",
     "status": "initializing"
   }
5. Spawns initialization instance (reactive):
   - Agent analyzes goal from 8 perspectives (spawns sub-agents)
   - Determines optimal schedule (continuous + daily standup at 9am)
   - Creates initial task breakdown in tasks/active/continuous.md
   - Writes schedule.json:
     {
       "continuous": { "enabled": true, "minInterval": 3600 },
       "timeBased": [
         { "cron": "0 9 * * *", "description": "Daily standup check-in" }
       ]
     }
6. Updates manager's subordinates.json, org_chart.json
7. Registers with scheduler (writes to scheduler_state.json)
8. Returns success: "Agent backend-dev-001 hired successfully. First run scheduled."
```

**Example 2: Time-based trigger fires**

```
Scheduler loop (every 60s):

1. Scans agents/*/schedule.json
2. Finds CTO has timeBased trigger: "0 9 * * *" (9am daily)
3. Current time: 09:00:05 (within 60s window)
4. Checks process_registry.json: CTO reactive instance not running
5. Acquires lock: /tmp/rm-CTO-reactive.lock with PID
6. Spawns reactive instance:
   - Loads config, tasks, inbox, workspace
   - Executes via Claude Code adapter
   - Agent reads schedule: "Daily standup check-in"
   - Agent checks tasks, inbox, subordinates
   - Agent generates status report, messages manager (CEO)
   - Agent updates workspace/notes.md with insights
7. Updates process_registry.json (mark complete)
8. Releases lock
```

**Example 3: Slack message arrives**

```
User messages in Slack: "@ProductManager Customer X is angry about feature Y"

1. Slack module receives webhook
2. Parses message:
   - Detects mention: @ProductManager → routes to product-manager-001
   - Detects urgency: "angry" → priority = high
3. Converts to standardized format:
   ---
   from: slack-user-john
   to: product-manager-001
   timestamp: 2026-01-18T14:30:00Z
   priority: high
   type: escalation
   ---
   # Customer Escalation
   Customer X is angry about feature Y
4. Writes to agents/product-manager-001/inbox/messages/20260118-143000-slack-user-john.md
5. Spawns reactive instance immediately (high priority)
6. Agent reads inbox, processes message:
   - Multi-perspective analysis (customer success, technical, emotional perspectives)
   - Adds urgent task to top of continuous list:
     - [ ] **URGENT:** Investigate Customer X issue with feature Y
   - Responds to Slack: "Acknowledged. Investigating now. Will update in 30min."
7. Marks message as processed, moves to inbox/processed/
8. Exits (continuous instance will pick up urgent task next)
```

**Example 4: Continuous instance picks up task**

```
Scheduler detects backend-dev-001 has pending tasks:

1. Reads tasks/active/continuous.md:
   - [ ] Implement user authentication endpoints
   - [ ] Write unit tests for auth
   - [ ] Deploy to staging
2. Checks minInterval (3600s = 1 hour): Last run 2 hours ago → OK to spawn
3. Acquires lock: /tmp/rm-backend-dev-001-continuous.lock
4. Spawns continuous instance:
   - Loads context (config, tasks, workspace)
   - Agent reads first uncompleted task: "Implement user authentication endpoints"
   - Multi-perspective analysis:
     - Security: Use bcrypt, JWT, HTTPS only, rate limiting
     - Simplicity: Start with email+password, OAuth later
     - Architecture: RESTful endpoints, middleware pattern
     - UX: Clear error messages, forgot password flow
     - Operational: Logging, metrics, health checks
   - Agent decides: Task is complex → hire sub-agent
   - Calls: rm hire --role "Auth Engineer" --goal "Implement secure email+password auth" --manager backend-dev-001
   - Updates task:
     - [x] Implement user authentication endpoints → DELEGATED to auth-engineer-001
     - [ ] Monitor auth-engineer-001 progress
     - [ ] Write unit tests for auth (BLOCKED by above)
   - Updates workspace/notes.md: "Delegated auth to auth-engineer-001. Rationale: Security-critical, needs focused attention."
5. Exits (auth-engineer-001 will now work on it)
```

---

## 2. File Structure Specification

### 2.1 Global Directory Layout

```
recursivemanager/                    # Installation directory
├── bin/
│   ├── rm                           # CLI entry point (symlinked to PATH)
│   ├── rm-scheduler                 # Scheduler daemon
│   └── rm-messaging-relay           # Messaging relay daemon
├── lib/
│   ├── core/                        # Core logic
│   ├── adapters/                    # Framework adapters
│   ├── messaging/                   # Messaging modules
│   └── utils/                       # Utilities
├── config/
│   ├── default.json                 # Default configuration
│   └── secrets.json                 # API keys (encrypted)
└── templates/
    ├── agent-prompts/               # Prompt templates
    └── reports/                     # Report templates

~/.recursivemanager/                 # User workspace (or /var/lib/recursivemanager for system-wide)
├── agents/                          # All agent directories
│   ├── CEO/
│   ├── CTO/
│   ├── backend-dev-001/
│   └── ...
├── system/                          # System state
│   ├── scheduler_state.json
│   ├── process_registry.json
│   ├── org_chart.json
│   ├── audit_log.jsonl
│   └── database.sqlite              # SQLite index for queries
└── logs/                            # System logs
    ├── scheduler.log
    ├── messaging-relay.log
    └── agents/                      # Per-agent execution logs
        ├── CEO.log
        └── backend-dev-001.log
```

### 2.2 Agent Directory Structure

```
agents/<agent-id>/
├── config.json                      # Agent identity and configuration
├── schedule.json                    # Timing configuration
├── subordinates.json                # List of hired agents
├── tasks/
│   ├── active/
│   │   ├── continuous.md            # Priority-ordered task list
│   │   └── <task-name>/             # Hierarchical task folders
│   │       ├── plan.md              # High-level plan
│   │       ├── tasks.md             # Atomic subtasks
│   │       ├── progress.md          # Current progress
│   │       └── context.json         # Metadata (created, updated, status)
│   └── archive/                     # Completed/cancelled tasks
│       └── <task-name>-<timestamp>/ # Timestamped archive
├── workspace/
│   ├── notes.md                     # Agent's long-term memory
│   ├── research/                    # Research documents
│   ├── drafts/                      # Work in progress
│   └── templates/                   # Reusable templates
├── inbox/
│   ├── messages/                    # Unprocessed messages
│   │   └── <timestamp>-<sender>.md
│   └── processed/                   # Processed messages (archive)
└── .metadata/
    ├── last_run.json                # Last execution timestamp
    ├── execution_history.jsonl      # Append-only execution log
    └── metrics.json                 # Performance metrics
```

### 2.3 File Schemas

**config.json**
```json
{
  "id": "backend-dev-001",
  "role": "Backend Developer",
  "mainGoal": "Build REST API for user authentication",
  "reportingTo": "CTO",
  "framework": "claude-code",
  "createdAt": "2026-01-18T12:00:00Z",
  "status": "active",
  "limits": {
    "maxSubordinates": 10,
    "hiringBudget": 5,
    "maxDepth": 3
  },
  "autonomy": {
    "canHire": true,
    "canFire": true,
    "canChangeGoal": false,
    "requiresApproval": ["hire", "fire"]
  }
}
```

**schedule.json**
```json
{
  "continuous": {
    "enabled": true,
    "minInterval": 3600,
    "maxConcurrent": 1
  },
  "timeBased": [
    {
      "cron": "0 9 * * *",
      "description": "Daily standup check-in",
      "type": "reactive"
    },
    {
      "cron": "0 17 * * 5",
      "description": "Weekly status report",
      "type": "reactive"
    }
  ],
  "lastRun": {
    "continuous": "2026-01-18T14:00:00Z",
    "reactive": "2026-01-18T09:00:05Z"
  }
}
```

**tasks/active/continuous.md**
```markdown
# Active Tasks for backend-dev-001

Priority order (top = next to work on):

- [ ] **URGENT:** Fix authentication bug in production
  - Location: tasks/fix-auth-bug/
  - Created: 2026-01-18 14:30
  - Reported by: product-manager-001

- [x] Implement user registration endpoint
  - Status: DELEGATED to auth-engineer-001
  - Delegated: 2026-01-18 12:00

- [ ] Write integration tests for auth flow
  - Status: BLOCKED (waiting for auth-engineer-001)

- [ ] Deploy authentication service to staging
  - Dependencies: All tests passing

## Archived (completed this session)
- [x] Set up development environment
  - Completed: 2026-01-18 10:00
```

**inbox/messages/20260118-143000-slack-user-john.md**
```markdown
---
from: slack-user-john
to: product-manager-001
timestamp: 2026-01-18T14:30:00Z
priority: high
type: escalation
platform: slack
channel: #product-feedback
processed: false
---

# Customer Escalation

Customer X is extremely frustrated with feature Y. They're threatening to cancel their subscription.

## Details
- Customer: Acme Corp (Enterprise tier)
- Issue: Feature Y not working as expected
- Impact: Unable to complete critical workflow
- Timeline: Issue started 2 days ago

## Context
This is their 3rd support ticket this week. Customer success team is requesting urgent attention.

## Action Requested
Investigate immediately and provide status update within 1 hour.
```

**workspace/notes.md**
```markdown
# Backend Developer Notes

## Long-Term Strategy
- Migration to microservices architecture planned for Q2 2026
- Need to design auth service as standalone from start

## Key Decisions
- 2026-01-18: Chose JWT over sessions for scalability
- 2026-01-17: Decided to use bcrypt with cost factor 12

## Lessons Learned
- Always consider rate limiting for auth endpoints
- Customer-facing errors should be generic (security)

## Team Communication Patterns
- CTO prefers daily updates via inbox messages
- Product Manager needs weekly demos

## Resources
- Auth RFC: workspace/drafts/auth-rfc.md
- Security checklist: workspace/templates/security-checklist.md
```

**system/process_registry.json**
```json
{
  "processes": [
    {
      "agentId": "backend-dev-001",
      "instanceType": "continuous",
      "pid": 12345,
      "startedAt": "2026-01-18T14:00:00Z",
      "lockFile": "/tmp/rm-backend-dev-001-continuous.lock",
      "status": "running",
      "heartbeat": "2026-01-18T14:05:30Z"
    },
    {
      "agentId": "CTO",
      "instanceType": "reactive",
      "pid": 12346,
      "startedAt": "2026-01-18T09:00:05Z",
      "lockFile": "/tmp/rm-CTO-reactive.lock",
      "status": "completed",
      "heartbeat": "2026-01-18T09:02:15Z",
      "completedAt": "2026-01-18T09:02:30Z"
    }
  ],
  "lastCleanup": "2026-01-18T14:00:00Z"
}
```

**system/org_chart.json**
```json
{
  "version": 15,
  "updatedAt": "2026-01-18T12:00:00Z",
  "agents": [
    {
      "id": "CEO",
      "role": "Chief Executive Officer",
      "reportingTo": null,
      "subordinates": ["CTO", "CFO", "CMO"],
      "depth": 0,
      "status": "active"
    },
    {
      "id": "CTO",
      "role": "Chief Technology Officer",
      "reportingTo": "CEO",
      "subordinates": ["backend-dev-001", "frontend-dev-001"],
      "depth": 1,
      "status": "active"
    },
    {
      "id": "backend-dev-001",
      "role": "Backend Developer",
      "reportingTo": "CTO",
      "subordinates": ["auth-engineer-001"],
      "depth": 2,
      "status": "active"
    }
  ]
}
```

**system/audit_log.jsonl** (append-only)
```jsonl
{"timestamp":"2026-01-18T12:00:00Z","action":"agent.hired","agentId":"backend-dev-001","by":"CTO","details":{"role":"Backend Developer","goal":"Build REST API"}}
{"timestamp":"2026-01-18T14:30:00Z","action":"message.received","agentId":"product-manager-001","from":"slack-user-john","priority":"high"}
{"timestamp":"2026-01-18T14:30:05Z","action":"instance.spawned","agentId":"product-manager-001","instanceType":"reactive","pid":12347}
{"timestamp":"2026-01-18T14:32:00Z","action":"task.created","agentId":"product-manager-001","task":"Investigate Customer X issue","priority":"urgent"}
```

---

## 3. Agent Lifecycle

### 3.1 Lifecycle States

```
INITIALIZING → ACTIVE → PAUSED → ACTIVE → TERMINATED
                 ↓
              ARCHIVED (soft delete)
```

**State Definitions:**

- **INITIALIZING**: Just hired, running initialization instance to set up schedule and tasks
- **ACTIVE**: Normal operation, can be triggered by scheduler or messages
- **PAUSED**: User-requested pause, no instances will spawn
- **TERMINATED**: Fired, subordinates cascade-terminated, moved to archive
- **ARCHIVED**: Historical record, read-only

### 3.2 Hiring Process

**Command:** `rm hire --role "Backend Developer" --goal "Build API" --manager CTO`

**Steps:**

1. **Validation:**
   - Check manager exists and is ACTIVE
   - Check limits: manager's subordinate count < maxSubordinates
   - Check depth: manager's depth + 1 <= maxDepth (default: 10)
   - Check hiring budget: manager's hiringBudget > 0 (if enforced)

2. **ID Generation:**
   - Slug from role: "Backend Developer" → "backend-developer"
   - Append counter: Query existing agents, find max counter, increment
   - Result: "backend-developer-001"

3. **Directory Creation:**
   ```bash
   mkdir -p agents/backend-developer-001/{tasks/{active,archive},workspace/{research,drafts,templates},inbox/{messages,processed},.metadata}
   ```

4. **Initial Config:**
   - Write `config.json` with status = "initializing"
   - Write empty `schedule.json` (to be populated by init instance)
   - Write empty `subordinates.json`
   - Create empty `workspace/notes.md`

5. **Org Chart Update:**
   - Acquire lock on `system/org_chart.json`
   - Add agent entry
   - Update manager's subordinates list
   - Increment version
   - Release lock

6. **Audit Log:**
   - Append to `system/audit_log.jsonl`:
     ```json
     {"timestamp":"...","action":"agent.hired","agentId":"backend-developer-001","by":"CTO","details":{...}}
     ```

7. **Spawn Initialization Instance:**
   - Set instanceType = "initialization"
   - Orchestrator loads minimal context (just config.json)
   - Constructs prompt: "You are a newly hired {role}. Your main goal: {mainGoal}. Analyze this from 8 perspectives and set up your work environment."
   - Executes via framework adapter
   - Agent outputs:
     - Recommended schedule (continuous enabled, cron expressions for time-based)
     - Initial task breakdown
     - Setup notes in workspace
   - Orchestrator parses output, writes `schedule.json`, `tasks/active/continuous.md`
   - Updates config.json: status = "active"

8. **Register with Scheduler:**
   - Scheduler detects new `schedule.json` on next scan
   - Adds to monitoring list

9. **Return Success:**
   - CLI outputs: "Agent backend-developer-001 hired successfully. Status: active. Next run: continuous instance when tasks pending."

### 3.3 Firing Process

**Command:** `rm fire backend-developer-001 [--reason "Performance issues"]`

**Steps:**

1. **Validation:**
   - Check agent exists and is not already TERMINATED
   - Check permissions: Can current user/agent fire this agent?

2. **Cascade Termination (Recursive):**
   - Load `subordinates.json`
   - For each subordinate:
     - Recursively call `fire(subordinate_id)`
     - Wait for completion (depth-first)

3. **Kill Running Instances:**
   - Load `system/process_registry.json`
   - Find all processes for agentId
   - Send SIGTERM to each PID
   - Wait 10s
   - If still running, send SIGKILL

4. **Remove from Scheduler:**
   - Scheduler detects missing `schedule.json` on next scan (or delete explicitly)

5. **Archive Directory:**
   - Timestamp: `YYYYMMDD_HHMMSS`
   - Move: `agents/backend-developer-001` → `agents/archive/backend-developer-001-20260118_143000`
   - Preserve all files (config, tasks, workspace, inbox)

6. **Update Manager:**
   - Remove from manager's `subordinates.json`
   - Optionally send message to manager: "Your subordinate {id} was terminated. Reason: {reason}."

7. **Update Org Chart:**
   - Mark agent status = "terminated"
   - Update timestamp

8. **Audit Log:**
   ```json
   {"timestamp":"...","action":"agent.fired","agentId":"backend-developer-001","by":"CTO","reason":"Performance issues","subordinatesFired":["auth-engineer-001"]}
   ```

9. **Return Success:**
   - CLI outputs: "Agent backend-developer-001 and 1 subordinate terminated. Archived to agents/archive/backend-developer-001-20260118_143000"

### 3.4 State Transitions

**ACTIVE → PAUSED:**
- Command: `rm pause backend-developer-001`
- Update config.json: `status = "paused"`
- Scheduler skips paused agents

**PAUSED → ACTIVE:**
- Command: `rm resume backend-developer-001`
- Update config.json: `status = "active"`
- Scheduler resumes triggering

**Goal Change (while ACTIVE):**
- Command: `rm configure backend-developer-001 --goal "New goal"`
- Checks: `config.autonomy.canChangeGoal` or requires approval
- Spawns reactive instance with prompt: "Your goal has changed. Old: {old}. New: {new}. Analyze implications and update your tasks."

---

## 4. Task Management

### 4.1 Task Structure

**Three-Level Hierarchy:**

1. **Continuous Task List** (`tasks/active/continuous.md`):
   - Linear, priority-ordered markdown checklist
   - Each task is either:
     - Simple (checkbox with description)
     - Complex (checkbox with reference to task folder)

2. **Task Folders** (`tasks/active/<task-name>/`):
   - For non-trivial tasks requiring breakdown
   - Contains: `plan.md`, `tasks.md`, `progress.md`, `context.json`

3. **Subtasks** (within task folder `tasks.md`):
   - Atomic, actionable items
   - Marked complete as work progresses

**Example:**

```
tasks/active/continuous.md:
- [ ] **URGENT:** Fix production auth bug → tasks/fix-auth-bug/
- [x] Implement registration → DELEGATED to auth-engineer-001
- [ ] Write tests → BLOCKED

tasks/active/fix-auth-bug/
  plan.md: Overall approach to fix
  tasks.md: Step-by-step tasks
  progress.md: Current status, blockers
  context.json: Metadata (created, priority, etc.)
```

### 4.2 Task Lifecycle

**Creation:**
1. Agent decides task is needed (from goal analysis, message, or delegation)
2. If simple: Add checkbox to `continuous.md`
3. If complex: Create task folder, write plan, break into subtasks

**Execution:**
1. Continuous instance picks first unchecked task
2. Reads task details (folder if complex)
3. Decides: Execute directly OR delegate (hire sub-agent)
4. If execute: Works on task, updates progress
5. If delegate: Hires sub-agent with task as goal, marks task "DELEGATED"

**Completion:**
1. Agent marks task complete in `continuous.md`: `- [x] ...`
2. If task folder exists: Move to `archive/` with timestamp
3. Updates metrics: task duration, completion rate

**Archival:**
- Scheduler periodically (daily) scans `continuous.md`
- All completed tasks → move to `tasks/archive/completed-YYYYMMDD.md`
- Task folders → move to `tasks/archive/<task-name>-YYYYMMDD/`
- Keeps workspace clean (only active tasks visible)

### 4.3 Task Statuses

- **TODO**: Unchecked checkbox `- [ ]`
- **IN_PROGRESS**: Agent currently working (tracked in process_registry)
- **DELEGATED**: Assigned to subordinate `- [x] ... DELEGATED to <agent-id>`
- **BLOCKED**: Waiting on dependency `- [ ] ... BLOCKED (reason)`
- **COMPLETED**: Checked checkbox `- [x] ...`
- **CANCELLED**: Checked with strikethrough `- [x] ~~...~~ CANCELLED`

### 4.4 Hierarchical Task Example

**Scenario:** CEO delegates "Build SaaS Product"

```
agents/CEO/tasks/active/continuous.md:
- [ ] Build SaaS Product → tasks/build-saas-product/
- [ ] Hire marketing team
- [ ] Secure funding

agents/CEO/tasks/active/build-saas-product/
  plan.md:
    # Plan: Build SaaS Product
    1. Hire CTO to lead engineering
    2. CTO builds core product
    3. Launch MVP to beta users

  tasks.md:
    - [ ] Hire CTO
    - [ ] CTO builds product (DELEGATED)
    - [ ] Launch MVP

  progress.md:
    ## 2026-01-18
    - Hired CTO (cto-001)
    - CTO analyzing product requirements

  context.json:
    {"created":"2026-01-18T08:00:00Z","priority":"high","deadline":"2026-03-01"}

After CEO hires CTO:
agents/CEO/tasks/active/continuous.md:
- [ ] Build SaaS Product → DELEGATED to CTO
- [ ] Monitor CTO progress
- [ ] Hire marketing team

agents/CTO/tasks/active/continuous.md:
- [ ] Build core product → tasks/build-core-product/

agents/CTO/tasks/active/build-core-product/
  plan.md:
    # Plan: Build Core Product
    1. Hire backend developer
    2. Hire frontend developer
    3. Integrate and deploy

  tasks.md:
    - [ ] Hire backend developer
    - [ ] Hire frontend developer
    - [ ] Integrate components
    - [ ] Deploy to production
```

**Result:** Recursive delegation creates a tree of agents, each with their own tasks, all tracked hierarchically.

---

## 5. Execution Models

### 5.1 Dual Instance Types

**Continuous Instance:**
- **Trigger:** Scheduler detects pending tasks AND minInterval elapsed
- **Purpose:** Pick ONE task from continuous list, work on it
- **Execution:**
  1. Load context (config, tasks, workspace)
  2. Read `continuous.md`, find first unchecked task
  3. Multi-perspective analysis
  4. Decide: Execute OR Delegate OR Escalate
  5. Update task status, progress
  6. Exit (next instance picks up next task)

**Reactive Instance:**
- **Trigger:** Time-based schedule OR external message
- **Purpose:** Handle events (schedule, inbox), update task list
- **Execution:**
  1. Load context (config, schedule, inbox, workspace)
  2. If time-based: Execute scheduled action (e.g., "daily standup")
  3. If message: Process all unread messages, sort by priority
  4. For each message: Analyze, add to continuous list (top if urgent)
  5. Update workspace notes with insights
  6. Exit (continuous instance will execute added tasks)

**Key Difference:**
- **Continuous**: Task execution (actual work)
- **Reactive**: Event handling (planning, prioritizing)

### 5.2 Smart Spawning Logic

**Scheduler Algorithm (every 60s):**

```python
for agent in all_agents():
    # Check status
    if agent.status != 'active':
        continue

    # CONTINUOUS INSTANCE LOGIC
    if agent.schedule.continuous.enabled:
        # Smart spawning: Only if work exists
        if has_pending_tasks(agent):
            last_run = agent.schedule.lastRun.continuous
            min_interval = agent.schedule.continuous.minInterval

            if time_since(last_run) >= min_interval:
                if not is_running(agent, 'continuous'):
                    spawn_instance(agent, 'continuous')

    # TIME-BASED INSTANCE LOGIC
    for trigger in agent.schedule.timeBased:
        if cron_matches(trigger.cron, current_time):
            if not is_running(agent, 'reactive'):
                spawn_instance(agent, 'reactive', context={'trigger': trigger})
```

**has_pending_tasks():**
```python
def has_pending_tasks(agent):
    continuous_md = read_file(f"agents/{agent.id}/tasks/active/continuous.md")
    unchecked_tasks = count_pattern(continuous_md, r"^- \[ \]")
    return unchecked_tasks > 0
```

**Benefits:**
- No wasted cycles (continuous instances only when work exists)
- Prevents "nothing to do" loops
- Resource-efficient

### 5.3 Lock-Based Concurrency Control

**Lock Hierarchy (to prevent deadlocks):**
1. Global locks (org_chart, process_registry)
2. Agent-level locks (per agent + instance type)
3. File-level locks (per file)

**Rule:** Always acquire in this order, alphabetically within levels.

**Lock Acquisition:**

```python
def spawn_instance(agent_id, instance_type):
    lock_file = f"/tmp/rm-{agent_id}-{instance_type}.lock"

    # Try to acquire lock
    try:
        with timeout(30):  # 30s timeout
            fd = os.open(lock_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
    except FileExistsError:
        # Lock exists, check if stale
        pid = read_lock_pid(lock_file)
        if not process_exists(pid):
            # Stale lock, remove and retry
            os.remove(lock_file)
            return spawn_instance(agent_id, instance_type)
        else:
            # Another instance running, skip
            return

    try:
        # Execute instance
        execute_agent_instance(agent_id, instance_type)
    finally:
        # Always release lock
        os.remove(lock_file)
```

**Lock Types:**

- **Instance Lock:** `/tmp/rm-{agent_id}-{instance_type}.lock`
  - Prevents duplicate continuous or reactive instances
  - Separate locks allow 1 continuous + 1 reactive simultaneously

- **File Lock:** `{file_path}.lock`
  - Used for atomic file updates
  - Prevents concurrent writes to same file

- **Global Lock:** `/tmp/rm-global-{resource}.lock`
  - For org_chart, process_registry
  - Short-lived (acquire, update, release immediately)

### 5.4 Timeout and Resource Limits

**Per-Instance Limits:**
- **Execution Timeout:** 1 hour (configurable)
- **Memory Limit:** 4GB (enforced via ulimit or cgroup)
- **Disk I/O:** No limit (file-based system needs writes)
- **Network:** No limit (AI APIs, messaging)

**Timeout Handling:**
```python
def execute_agent_instance(agent_id, instance_type):
    process = spawn_framework_adapter(agent_id, instance_type)

    try:
        # Wait with timeout
        result = process.wait(timeout=3600)  # 1 hour
        return result
    except subprocess.TimeoutExpired:
        # Timeout, kill process
        process.terminate()
        time.sleep(10)
        if process.is_alive():
            process.kill()

        # Log failure
        log_error(f"Agent {agent_id} {instance_type} instance timed out after 1 hour")

        # Mark task as TIMEOUT, escalate to manager
        escalate_to_manager(agent_id, "Instance timeout", details={...})
```

---

## 6. Scheduler System

### 6.1 Scheduler Daemon Architecture

**Process Model:**
- Long-running daemon process
- Runs as systemd service (Linux) or launchd (macOS)
- PID file: `/tmp/rm-scheduler.pid`
- Logs: `~/.recursivemanager/logs/scheduler.log`

**Main Loop:**

```python
def scheduler_main_loop():
    while True:
        try:
            # 1. Scan all agent schedules
            agents = scan_agent_schedules()

            # 2. Process continuous instances
            for agent in agents:
                process_continuous(agent)

            # 3. Process time-based instances
            for agent in agents:
                process_time_based(agent)

            # 4. Cleanup stale locks and processes
            cleanup_stale_locks()
            cleanup_completed_processes()

            # 5. Update scheduler state
            update_scheduler_state()

        except Exception as e:
            log_error(f"Scheduler error: {e}")

        # Sleep for 60s before next iteration
        time.sleep(60)
```

### 6.2 Schedule Configuration

**schedule.json Schema:**

```json
{
  "continuous": {
    "enabled": true,
    "minInterval": 3600,         // Min seconds between runs
    "maxConcurrent": 1           // Max simultaneous continuous instances
  },
  "timeBased": [
    {
      "cron": "0 9 * * *",       // Cron expression (daily 9am)
      "description": "Daily standup",
      "type": "reactive",
      "enabled": true
    },
    {
      "cron": "0 17 * * 5",      // Fridays 5pm
      "description": "Weekly status report",
      "type": "reactive",
      "enabled": true
    }
  ],
  "lastRun": {
    "continuous": "2026-01-18T14:00:00Z",
    "reactive": "2026-01-18T09:00:05Z"
  }
}
```

**Cron Expression Support:**
- Standard 5-field cron: `minute hour day month weekday`
- Special: `@hourly`, `@daily`, `@weekly`, `@monthly`
- Human-readable aliases: `every hour`, `every day at 9am`, `every Monday`

**Agent Self-Scheduling:**

Agents can update their own `schedule.json` during execution:

```python
# Agent decides it needs more frequent check-ins
update_schedule({
  "continuous": {"enabled": True, "minInterval": 1800},  # Every 30min instead of 1hr
  "timeBased": [
    {"cron": "*/30 * * * *", "description": "Every 30min check"}  # Add new trigger
  ]
})
```

### 6.3 Process Registry

**Purpose:** Track all running instances to prevent duplicates and enable monitoring.

**Schema:**

```json
{
  "processes": [
    {
      "id": "uuid-...",
      "agentId": "backend-dev-001",
      "instanceType": "continuous",
      "pid": 12345,
      "startedAt": "2026-01-18T14:00:00Z",
      "lockFile": "/tmp/rm-backend-dev-001-continuous.lock",
      "status": "running",           // running | completed | failed | timeout
      "heartbeat": "2026-01-18T14:05:30Z",
      "framework": "claude-code",
      "completedAt": null,
      "exitCode": null,
      "error": null
    }
  ],
  "lastCleanup": "2026-01-18T14:00:00Z"
}
```

**Operations:**

- **Register:** When instance spawns, add entry with status = "running"
- **Heartbeat:** Periodically update heartbeat (every 30s)
- **Complete:** When instance exits, update status, completedAt, exitCode
- **Cleanup:** Every 5min, remove completed processes older than 1 hour

**Stale Detection:**

```python
def detect_stale_processes():
    for process in registry.processes:
        if process.status == 'running':
            if time_since(process.heartbeat) > 300:  # 5min
                # Check if PID exists
                if not process_exists(process.pid):
                    # Process died without cleanup
                    process.status = 'failed'
                    process.error = 'Process died unexpectedly'
                    remove_lock_file(process.lockFile)
```

---

## 7. Messaging Infrastructure

### 7.1 Messaging Relay Architecture

**Purpose:** Centralize all external message sources into a standardized format and route to agents.

**Components:**

```
External Platforms → Platform Modules → Message Relay → Standardized Format → Agent Inbox
```

**Platform Modules:**
- **Slack Module:** Receives webhooks, parses mentions/keywords, authenticates
- **Telegram Module:** Bot API, handles commands and DMs
- **Email Module:** IMAP polling, parses emails, extracts sender/subject
- **Custom Module:** API for integrations

### 7.2 Standardized Message Format

**All messages converted to this format:**

```markdown
---
from: <sender-id>
to: <agent-id>
timestamp: <ISO8601>
priority: low | normal | high | urgent
type: report | question | escalation | notification | command
platform: slack | telegram | email | cli | custom
channel: <platform-specific channel/thread>
processed: false
---

# Subject Line

Message body in markdown format.

## Context (optional)
- Relevant links
- Attachments (stored separately, referenced here)

## Action Requested (optional)
- What sender expects
```

**Example (Slack):**

```markdown
---
from: slack-user-john-doe
to: product-manager-001
timestamp: 2026-01-18T14:30:00Z
priority: high
type: escalation
platform: slack
channel: #product-feedback
messageUrl: https://slack.com/archives/C123/p1234567890
processed: false
---

# Customer Escalation: Acme Corp

@ProductManager Customer X (Acme Corp) is very unhappy with feature Y. They're threatening to cancel.

## Context
- Customer tier: Enterprise ($50k/year)
- Issue: Feature Y broke in last release
- Impact: Blocking their critical workflow
- Support tickets: 3 this week

## Action Requested
Investigate ASAP and provide update within 1 hour.
```

### 7.3 Message Routing

**Routing Logic (priority order):**

1. **Direct Mention:** `@AgentName` in message → route to that agent
2. **Channel Mapping:** Platform channel mapped to agent (e.g., `#engineering` → CTO)
3. **Keyword Routing:** Keywords in message (e.g., "customer", "bug") → route to relevant agent
4. **Fallback:** Route to CEO (top-level agent)

**Routing Configuration** (`config/routing.json`):

```json
{
  "slack": {
    "channels": {
      "#engineering": "CTO",
      "#product": "product-manager-001",
      "#customer-success": "customer-success-lead"
    },
    "keywords": {
      "bug": "CTO",
      "feature request": "product-manager-001",
      "customer angry": "customer-success-lead",
      "urgent": "CEO"
    }
  },
  "fallback": "CEO"
}
```

**Priority Detection:**

```python
def detect_priority(message_text):
    urgent_keywords = ["urgent", "asap", "emergency", "critical", "production down", "customer angry"]
    high_keywords = ["important", "blocking", "broken", "not working"]

    text_lower = message_text.lower()

    if any(kw in text_lower for kw in urgent_keywords):
        return "urgent"
    elif any(kw in text_lower for kw in high_keywords):
        return "high"
    else:
        return "normal"
```

### 7.4 Platform Modules

**Slack Module:**

- **Authentication:** Verifies Slack signature on webhooks
- **Event Types:** `message`, `app_mention`, `reaction_added`
- **Parsing:** Extracts mentions, channel, sender, thread
- **Response:** Posts replies via Slack API

**Example Integration:**

```python
@slack_app.event("app_mention")
def handle_mention(event, say):
    # Parse message
    message = event['text']
    sender = event['user']
    channel = event['channel']

    # Detect mentioned agent
    mention_match = re.search(r'@(\w+)', message)
    agent_name = mention_match.group(1) if mention_match else None

    # Route to agent
    agent_id = find_agent_by_name(agent_name) or route_by_channel(channel)

    # Convert to standard format
    standardized_msg = create_message(
        from_id=f"slack-{sender}",
        to_id=agent_id,
        priority=detect_priority(message),
        type="question",
        platform="slack",
        channel=channel,
        body=message
    )

    # Write to agent inbox
    write_to_inbox(agent_id, standardized_msg)

    # Spawn reactive instance
    spawn_instance(agent_id, 'reactive')

    # Acknowledge in Slack
    say(f"Acknowledged. {agent_id} will respond shortly.")
```

**Telegram Module:**

- **Bot API:** Long polling or webhooks
- **Commands:** `/hire`, `/status`, `/message`
- **Inline Keyboards:** For interactive responses

**Email Module:**

- **IMAP:** Polls inbox every 5min
- **Parsing:** Extracts sender, subject, body (plaintext + HTML)
- **Routing:** Email address → agent mapping (e.g., `cto@company.com` → CTO)

---

## 8. Multi-Perspective Analysis

### 8.1 Why Multi-Perspective?

**User Requirement:** "Quality over cost. I don't care if it's expensive, I care about quality."

**Rationale:**
- Single-perspective analysis misses edge cases, trade-offs, unintended consequences
- Different stakeholders value different aspects (security, UX, simplicity, cost, etc.)
- Parallel analysis from 8+ perspectives ensures robust decisions

**When to Use:**
- **Major Decisions:** Hiring, firing, goal changes, architecture choices
- **Complex Tasks:** Non-trivial tasks requiring breakdown
- **Strategic Planning:** Agent initialization, quarterly planning
- **Reactive Events:** Handling escalations, critical bugs

### 8.2 Eight Core Perspectives

1. **Security:** Threat modeling, vulnerabilities, access control, secrets management
2. **Architecture:** Scalability, modularity, dependencies, technical debt
3. **Simplicity:** Developer experience, code readability, maintainability, KISS principle
4. **UX:** User experience, intuitiveness, error messages, onboarding
5. **Financial:** Cost analysis, ROI, resource efficiency, budget impact
6. **Operational:** Reliability, monitoring, debugging, deployment, maintenance
7. **Emotional/Cultural:** Team morale, communication, psychological safety, user trust
8. **Growth:** Future-proofing, extensibility, market fit, competitive advantage

### 8.3 Implementation

**Parallel Sub-Agent Spawning:**

When an agent needs multi-perspective analysis:

```python
def analyze_from_multiple_perspectives(question, context):
    perspectives = [
        "security", "architecture", "simplicity", "ux",
        "financial", "operational", "emotional", "growth"
    ]

    # Spawn 8 sub-agents in parallel
    sub_agents = []
    for perspective in perspectives:
        prompt = f"""
        You are a {perspective} expert analyzing the following question:

        Question: {question}

        Context: {context}

        Provide your analysis from a {perspective} perspective:
        - Key considerations
        - Risks and trade-offs
        - Recommendations
        """

        sub_agent = spawn_analysis_agent(perspective, prompt)
        sub_agents.append(sub_agent)

    # Wait for all to complete (parallel execution)
    results = wait_all(sub_agents, timeout=300)  # 5min timeout

    # Synthesize results
    synthesis = synthesize_perspectives(results)

    return synthesis

def synthesize_perspectives(results):
    """
    Combines all perspective analyses into actionable decision.

    Identifies:
    - Consensus recommendations (all perspectives agree)
    - Conflicting views (trade-offs to consider)
    - Critical risks (any perspective flags major issue)
    - Optimal balance (best path considering all views)
    """
    consensus = find_common_recommendations(results)
    conflicts = find_conflicting_views(results)
    critical_risks = find_critical_flags(results)

    # Use meta-analysis agent to synthesize
    synthesis_prompt = f"""
    You have received analysis from 8 perspectives:

    {format_results(results)}

    Synthesize this into:
    1. Recommended action (clear, actionable)
    2. Key trade-offs to be aware of
    3. Critical risks to mitigate
    4. Alternative options (if consensus is weak)
    """

    return execute_synthesis_agent(synthesis_prompt)
```

**Example: Hiring Decision**

Agent (CTO) needs to decide: "Should I hire a backend developer or a full-stack developer?"

```
Security Perspective:
- Backend specialist better for security-critical auth work
- Risk: Full-stack may have surface-level security knowledge
- Recommendation: Backend developer with security training

Architecture Perspective:
- Full-stack allows flexibility in small teams
- Backend specialist better for microservices architecture
- Recommendation: Depends on current architecture (evaluate: are we monolith or microservices?)

Simplicity Perspective:
- Full-stack reduces communication overhead
- Backend specialist requires coordination with frontend team
- Recommendation: Full-stack for early-stage, backend for scale

UX Perspective:
- Full-stack understands end-to-end user flow
- Backend specialist needs product manager to translate UX needs
- Recommendation: Full-stack for product-focused work

Financial Perspective:
- Full-stack may cost 10-20% more (higher demand)
- Backend specialist more cost-effective long-term (specialization efficiency)
- Recommendation: Backend developer for budget-conscious teams

Operational Perspective:
- Backend specialist easier to replace (narrower skill set)
- Full-stack more versatile for on-call rotations
- Recommendation: Full-stack for operational flexibility

Emotional/Cultural Perspective:
- Backend specialist may feel isolated without backend peers
- Full-stack fits better in collaborative culture
- Recommendation: Consider team composition (do we have backend peers?)

Growth Perspective:
- Backend specialist better for scaling engineering team (depth)
- Full-stack better for rapid prototyping and pivots
- Recommendation: Backend for scaling, full-stack for exploration

SYNTHESIS:
Recommended Action: Hire Backend Developer with full-stack awareness
- Rationale: Security and architecture perspectives flag auth work as critical. Financial perspective favors cost-efficiency.
- Trade-off: Less UX fluency, but can be mitigated by strong product management.
- Critical Risk: Isolation if no backend peers → mitigate by hiring 2 backend developers or pairing with senior full-stack mentor.
- Alternative: If budget allows, hire 1 backend + 1 frontend (vs. 1 full-stack), better specialization.
```

**Result:** CTO makes informed decision with full awareness of trade-offs.

### 8.4 Handling Disagreements

**Scenario:** Perspectives conflict (e.g., Security says "encrypt everything", Simplicity says "encryption adds complexity")

**Resolution Strategy:**

1. **Identify Trade-offs:** Make conflicts explicit
2. **Weight by Context:** Some perspectives more critical for certain decisions (security critical for auth, simplicity critical for internal tools)
3. **Seek Compromise:** Find middle ground (e.g., "encrypt sensitive data only, not all data")
4. **Escalate if Needed:** If irreconcilable, escalate to manager or user for final decision

**Meta-Analysis Agent:**

```python
def resolve_conflicts(perspectives_results):
    conflicts = detect_conflicts(perspectives_results)

    for conflict in conflicts:
        # Example: Security vs. Simplicity
        security_rec = conflict['security']['recommendation']
        simplicity_rec = conflict['simplicity']['recommendation']

        # Find compromise
        compromise_prompt = f"""
        Security recommends: {security_rec}
        Simplicity recommends: {simplicity_rec}

        These are in conflict. Find a balanced approach that:
        - Maintains acceptable security posture
        - Doesn't sacrifice too much simplicity
        - Is pragmatic and actionable
        """

        compromise = execute_meta_analysis(compromise_prompt)
        conflict['resolution'] = compromise

    return conflicts
```

---

## 9. Framework Abstraction

### 9.1 Adapter Interface

**Goal:** Support multiple AI code generation frameworks (Claude Code, OpenCode) with minimal code changes.

**Abstract Interface:**

```python
class FrameworkAdapter(ABC):
    @abstractmethod
    def validate_environment(self) -> bool:
        """Check if framework is available and properly configured."""
        pass

    @abstractmethod
    def execute(self, agent_id: str, instance_type: str, context: dict) -> dict:
        """
        Execute agent instance via framework.

        Args:
            agent_id: Agent identifier
            instance_type: 'continuous', 'reactive', or 'initialization'
            context: Agent context (config, tasks, inbox, workspace)

        Returns:
            {
                'success': bool,
                'output': str,
                'actions': [{'type': 'hire', 'params': {...}}, ...],
                'updates': {'tasks': ..., 'workspace': ...},
                'errors': [...]
            }
        """
        pass

    @abstractmethod
    def get_capabilities(self) -> dict:
        """Return framework capabilities (max tokens, models, features)."""
        pass

    @abstractmethod
    def estimate_cost(self, prompt: str) -> float:
        """Estimate execution cost in USD."""
        pass
```

### 9.2 Claude Code Adapter

**Implementation:**

```python
class ClaudeCodeAdapter(FrameworkAdapter):
    def validate_environment(self) -> bool:
        # Check if `claude` CLI is available
        result = subprocess.run(['which', 'claude'], capture_output=True)
        if result.returncode != 0:
            return False

        # Check API key
        api_key = os.getenv('ANTHROPIC_API_KEY')
        return api_key is not None

    def execute(self, agent_id, instance_type, context):
        # Construct prompt from context
        prompt = self._build_prompt(agent_id, instance_type, context)

        # Write prompt to temp file (Claude Code reads from file)
        prompt_file = f"/tmp/rm-{agent_id}-{instance_type}-prompt.md"
        with open(prompt_file, 'w') as f:
            f.write(prompt)

        # Execute Claude CLI
        cmd = ['claude', 'code', '--prompt', prompt_file, '--json-output']
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        try:
            stdout, stderr = process.communicate(timeout=3600)  # 1 hour
        except subprocess.TimeoutExpired:
            process.kill()
            return {'success': False, 'errors': ['Timeout after 1 hour']}

        if process.returncode != 0:
            return {'success': False, 'errors': [stderr]}

        # Parse output
        result = self._parse_output(stdout)
        return result

    def _build_prompt(self, agent_id, instance_type, context):
        config = context['config']
        tasks = context.get('tasks', '')
        inbox = context.get('inbox', [])
        workspace_notes = context.get('workspace_notes', '')

        if instance_type == 'continuous':
            prompt = f"""
# RecursiveManager Agent Execution: {agent_id}

You are a {config['role']} in a recursive agent hierarchy.

## Your Identity
- Agent ID: {agent_id}
- Role: {config['role']}
- Main Goal: {config['mainGoal']}
- Reporting To: {config['reportingTo']}

## Current Tasks
{tasks}

## Your Workspace Notes
{workspace_notes}

## Instructions
1. Pick the FIRST unchecked task from your task list
2. Analyze it from 8 perspectives: security, architecture, simplicity, UX, financial, operational, emotional, growth
3. Decide: Execute OR Delegate OR Escalate
   - Execute: If task is simple and you can do it directly
   - Delegate: If task is complex, hire a sub-agent (use `rm hire` command)
   - Escalate: If blocked or need manager help, message manager
4. Update task status and progress
5. Exit (next instance will pick up next task)

## Available Commands
- `rm hire --role "Role" --goal "Goal" --manager {agent_id}` - Hire sub-agent
- `rm message <agent-id> "Message"` - Send message to another agent
- `rm fire <agent-id>` - Fire subordinate (if needed)
- `rm configure {agent_id} --schedule "..."` - Update your own schedule

## Output Format
Provide your output in JSON:
{{
  "analysis": "Multi-perspective analysis summary",
  "decision": "execute | delegate | escalate",
  "actions": [
    {{"type": "hire", "role": "...", "goal": "..."}},
    {{"type": "message", "to": "...", "content": "..."}},
    {{"type": "update_task", "task": "...", "status": "completed"}}
  ],
  "updates": {{
    "tasks": "Updated task list markdown",
    "workspace_notes": "Updated notes"
  }}
}}
"""
        elif instance_type == 'reactive':
            messages_text = '\n\n'.join([f"## Message from {msg['from']}\n{msg['body']}" for msg in inbox])
            prompt = f"""
# RecursiveManager Agent Execution: {agent_id} (Reactive)

You are a {config['role']} in a recursive agent hierarchy.

## Your Identity
- Agent ID: {agent_id}
- Role: {config['role']}
- Main Goal: {config['mainGoal']}

## Inbox Messages
{messages_text}

## Your Workspace Notes
{workspace_notes}

## Instructions
1. Process ALL inbox messages
2. For each message, analyze from 8 perspectives
3. Determine priority and required action
4. Add new tasks to your continuous task list (urgent tasks at top)
5. Respond to senders if needed
6. Update workspace notes with insights
7. Exit (continuous instance will execute added tasks)

## Output Format
{{
  "messages_processed": [
    {{
      "message_id": "...",
      "analysis": "...",
      "priority": "urgent | high | normal | low",
      "action_taken": "added task | escalated | responded"
    }}
  ],
  "actions": [...],
  "updates": {{
    "tasks": "Updated continuous task list",
    "workspace_notes": "Updated notes"
  }}
}}
"""
        else:  # initialization
            prompt = f"""
# RecursiveManager Agent Initialization: {agent_id}

You are a newly hired {config['role']}.

## Your Goal
{config['mainGoal']}

## Manager
{config['reportingTo']}

## Instructions
You've just been hired. Set up your work environment:

1. Analyze your goal from 8 perspectives
2. Determine optimal schedule:
   - Should you run continuously (always picking up tasks)?
   - Do you need time-based check-ins (daily standup, weekly report)?
3. Create initial task breakdown (what are the main tasks to achieve your goal?)
4. Set up workspace notes (key decisions, strategy, resources)

## Output Format
{{
  "analysis": "Multi-perspective analysis of your goal",
  "schedule": {{
    "continuous": {{"enabled": true, "minInterval": 3600}},
    "timeBased": [
      {{"cron": "0 9 * * *", "description": "Daily standup"}}
    ]
  }},
  "initial_tasks": "Markdown task list",
  "workspace_notes": "Initial notes and strategy"
}}
"""

        return prompt

    def _parse_output(self, stdout):
        try:
            output_json = json.loads(stdout)
            return {
                'success': True,
                'output': stdout,
                'actions': output_json.get('actions', []),
                'updates': output_json.get('updates', {}),
                'errors': []
            }
        except json.JSONDecodeError:
            # Claude Code didn't return valid JSON, treat as raw output
            return {
                'success': True,
                'output': stdout,
                'actions': self._extract_actions_from_text(stdout),
                'updates': {},
                'errors': []
            }

    def _extract_actions_from_text(self, text):
        """
        Fallback: Parse actions from natural language output.
        Look for patterns like "I will hire..." or "rm hire ..."
        """
        actions = []

        # Look for hire commands
        hire_pattern = r'rm hire --role "([^"]+)" --goal "([^"]+)"'
        for match in re.finditer(hire_pattern, text):
            actions.append({
                'type': 'hire',
                'role': match.group(1),
                'goal': match.group(2)
            })

        # Look for message commands
        message_pattern = r'rm message (\S+) "([^"]+)"'
        for match in re.finditer(message_pattern, text):
            actions.append({
                'type': 'message',
                'to': match.group(1),
                'content': match.group(2)
            })

        return actions

    def get_capabilities(self):
        return {
            'max_tokens': 200000,
            'models': ['claude-sonnet-4.5', 'claude-opus-4.5'],
            'supports_tools': True,
            'supports_vision': True
        }

    def estimate_cost(self, prompt):
        # Rough estimate: $3 per million input tokens, $15 per million output tokens
        input_tokens = len(prompt) / 4  # Rough estimate
        output_tokens = 2000  # Average output

        input_cost = (input_tokens / 1_000_000) * 3
        output_cost = (output_tokens / 1_000_000) * 15

        return input_cost + output_cost
```

### 9.3 OpenCode Adapter

**Implementation (similar structure):**

```python
class OpenCodeAdapter(FrameworkAdapter):
    # Similar to Claude Code but uses `opencode` CLI
    # Differences:
    # - Different prompt format (OpenCode specific)
    # - Different CLI flags
    # - Different cost model
    pass
```

### 9.4 Adapter Selection

**Selection Logic:**

```python
def select_framework_adapter(agent_config):
    preferred = agent_config.get('framework', 'claude-code')

    # Try preferred framework
    adapter = get_adapter(preferred)
    if adapter.validate_environment():
        return adapter

    # Fallback to available frameworks
    fallback_order = ['claude-code', 'opencode']
    for framework in fallback_order:
        if framework == preferred:
            continue
        adapter = get_adapter(framework)
        if adapter.validate_environment():
            log_warning(f"Preferred framework {preferred} unavailable, using {framework}")
            return adapter

    raise RuntimeError("No framework adapters available")

def get_adapter(framework_name):
    adapters = {
        'claude-code': ClaudeCodeAdapter(),
        'opencode': OpenCodeAdapter()
    }
    return adapters[framework_name]
```

---

## 10. Edge Cases & Contingencies

### 10.1 Agent Lifecycle Edge Cases

**Edge Case 1: Agent tries to hire itself**
- **Detection:** Check if new agent role + goal matches current agent
- **Prevention:** Reject hire command with error message
- **Error:** "Cannot hire duplicate of self. Did you mean to delegate the task instead?"

**Edge Case 2: Orphaned agents (manager fired, subordinates remain)**
- **Prevention:** Cascade deletion (fire all subordinates when manager fired)
- **Detection:** Periodic orphan scan (agent's reportingTo points to non-existent agent)
- **Recovery:** Re-assign to grandparent or terminate

**Edge Case 3: Circular reporting (A reports to B, B reports to A)**
- **Detection:** Before hiring, traverse reportingTo chain, detect cycles
- **Prevention:** Reject hire if cycle detected
- **Error:** "Would create circular reporting: A → B → A"

**Edge Case 4: Hiring spree (agent hires 100 sub-agents in 1 minute)**
- **Prevention:** Rate limiting (max 5 hires per hour per agent)
- **Detection:** Count recent hires in audit log
- **Response:** Reject hire command, alert manager

**Edge Case 5: Agent depth exceeds limit (10 levels deep)**
- **Prevention:** Check depth before hiring, reject if depth + 1 > maxDepth
- **Error:** "Max hierarchy depth (10) reached. Cannot hire deeper."

### 10.2 Task Management Edge Cases

**Edge Case 6: Circular task dependencies (Task A depends on B, B depends on A)**
- **Detection:** Build dependency graph, detect cycles
- **Prevention:** Reject task creation if cycle detected
- **Recovery:** Manual intervention, break cycle

**Edge Case 7: Infinite task nesting (task folder references another task folder indefinitely)**
- **Detection:** Limit nesting depth (max 5 levels)
- **Prevention:** Reject task creation if depth > 5
- **Recovery:** Flatten task hierarchy

**Edge Case 8: Task abandoned (agent fired, task left in progress)**
- **Detection:** Check task ownership on agent termination
- **Recovery:** Re-assign task to manager or sibling agent

**Edge Case 9: Conflicting task updates (two instances update same task simultaneously)**
- **Prevention:** File-level locking on task files
- **Resolution:** Optimistic locking with version field, retry on conflict

**Edge Case 10: All tasks completed, continuous instance keeps spawning**
- **Prevention:** Smart spawning (only spawn if pending tasks exist)
- **Detection:** `has_pending_tasks()` returns false → skip spawn

### 10.3 Messaging Edge Cases

**Edge Case 11: Message flood (1000 messages in 1 minute)**
- **Prevention:** Rate limiting (max 100 messages per agent per hour)
- **Mitigation:** Batch processing (process 10 messages per reactive instance, queue rest)
- **Alerting:** Notify manager of message flood

**Edge Case 12: Message to non-existent agent**
- **Detection:** Check agent exists before writing to inbox
- **Recovery:** Route to CEO (fallback) with note "intended for {non-existent-agent}"

**Edge Case 13: Duplicate messages (same message sent twice)**
- **Detection:** Hash message content, check for duplicate in last 5 minutes
- **Prevention:** Skip duplicate, log event

**Edge Case 14: Malicious message (code injection attempt)**
- **Prevention:** Sanitize message content, escape special characters
- **Detection:** Pattern matching for common injection attacks
- **Response:** Quarantine message, alert security team

### 10.4 Scheduling Edge Cases

**Edge Case 15: Daylight Saving Time (DST) transition**
- **Solution:** Use UTC internally, convert to local time for display only
- **Cron expressions:** Evaluated in UTC to avoid ambiguity

**Edge Case 16: Scheduler daemon crashes**
- **Recovery:** Systemd auto-restart (within 5 seconds)
- **State:** Scheduler state persisted in `scheduler_state.json`, resume on restart
- **Missed triggers:** Catch-up logic (run missed time-based triggers on restart)

**Edge Case 17: Clock skew (system time incorrect)**
- **Detection:** Compare system time to NTP server
- **Prevention:** Warn if skew > 60 seconds
- **Mitigation:** Use relative intervals where possible (not absolute timestamps)

**Edge Case 18: Thundering herd (100 agents all scheduled for same time)**
- **Mitigation:** Jitter (randomize spawn time ±30 seconds)
- **Prevention:** Warn users about scheduling many agents at same time

### 10.5 Concurrency Edge Cases

**Edge Case 19: Duplicate instances (lock fails to prevent)**
- **Detection:** Multiple entries in process_registry for same agent + instance type
- **Recovery:** Kill all but most recent instance
- **Prevention:** Robust PID validation in lock acquisition

**Edge Case 20: Deadlock (Agent A waits for B, B waits for A)**
- **Prevention:** Lock hierarchy (always acquire locks in same order)
- **Detection:** Timeout on lock acquisition (30 seconds)
- **Recovery:** Release locks, retry with exponential backoff

**Edge Case 21: Stale lock (process crashed, lock file remains)**
- **Detection:** Check if PID in lock file exists
- **Recovery:** Remove stale lock, allow new instance to spawn

### 10.6 File System Edge Cases

**Edge Case 22: Disk full (cannot write task files)**
- **Detection:** Catch `OSError: No space left on device`
- **Recovery:** Archive old tasks, clean up logs, alert user
- **Prevention:** Monitor disk usage, warn at 80%

**Edge Case 23: File corruption (JSON parse error)**
- **Detection:** Exception during file read
- **Recovery:** Restore from `.tmp` file (atomic write intermediate) or last backup
- **Logging:** Log corruption event in audit log

**Edge Case 24: Permission denied (cannot write to agent directory)**
- **Detection:** `OSError: Permission denied`
- **Recovery:** Fix permissions (`chmod`), retry operation
- **Prevention:** Check permissions on directory creation

### 10.7 Framework Adapter Edge Cases

**Edge Case 25: Framework unavailable (Claude CLI not installed)**
- **Detection:** `validate_environment()` returns false
- **Recovery:** Fall back to alternative framework (OpenCode)
- **Error (if all frameworks unavailable):** "No framework adapters available. Please install Claude Code or OpenCode."

**Edge Case 26: Framework timeout (no response for 1 hour)**
- **Detection:** Timeout exception in `execute()`
- **Recovery:** Kill process, mark task as TIMEOUT, escalate to manager
- **Logging:** Log timeout event with agent ID and task details

**Edge Case 27: Framework API rate limit exceeded**
- **Detection:** 429 error from framework
- **Recovery:** Exponential backoff retry (1min, 2min, 4min, 8min)
- **Prevention:** Track API usage, warn at 80% of quota

### 10.8 Multi-Perspective Analysis Edge Cases

**Edge Case 28: Sub-agent analysis timeout (no response after 5 minutes)**
- **Detection:** Timeout waiting for perspective result
- **Recovery:** Use partial results (skip timed-out perspective)
- **Logging:** Log which perspective timed out

**Edge Case 29: Contradictory perspectives (all disagree)**
- **Resolution:** Meta-analysis agent synthesizes trade-offs
- **Escalation:** If irreconcilable, escalate to manager or user

**Edge Case 30: Sub-agent analysis fails (exception)**
- **Recovery:** Retry once, then skip that perspective
- **Logging:** Log failure with error details

---

## 11. Security & Safety

### 11.1 Threat Model

**Attacker Profiles:**
1. **Malicious User:** Gains access to CLI, tries to hire agents to execute malicious tasks
2. **External Attacker:** Sends malicious messages via Slack/Telegram
3. **Compromised Agent:** Agent behavior manipulated to harm system
4. **Insider Threat:** Authorized user abuses system

**Attack Vectors:**
- Command injection via agent goals or task descriptions
- Path traversal via file operations
- Privilege escalation (worker agent modifying manager files)
- Resource exhaustion (spawn bomb, disk fill)
- Data exfiltration (agents copying sensitive data to external services)

### 11.2 Security Controls

**1. Input Validation:**
- Sanitize all user inputs (goals, task descriptions, messages)
- Validate file paths (no `..`, absolute paths only within allowed directories)
- Escape shell metacharacters in commands

**2. Access Control:**
- File permissions: Agent directories writable only by system user
- Lock files: Validate PID ownership
- Hierarchical permissions: Agents can only modify their own files + subordinates

**3. Resource Limits:**
- Max agents: 1000 total
- Max depth: 10 levels
- Max subordinates: 20 per agent
- Max concurrent instances: 50 system-wide
- Disk quota: 10GB per agent
- Memory limit: 4GB per instance
- Execution timeout: 1 hour per instance

**4. Secrets Management:**
- API keys stored in `config/secrets.json` (encrypted at rest)
- Never log secrets or include in prompts
- Secrets injected at runtime via environment variables

**5. Audit Logging:**
- All actions logged to `system/audit_log.jsonl` (immutable, append-only)
- Logs include: timestamp, actor, action, target, details
- Retention: 1 year minimum

**6. Sandboxing:**
- Framework adapters run in restricted environment
- File system access limited to agent directories + `/tmp`
- Network access: Only to AI APIs (whitelist)

### 11.3 Safety Mechanisms

**1. Agent Limits:**
- Prevent runaway recursion (max depth 10)
- Prevent hiring spree (rate limiting)
- Prevent resource exhaustion (quotas)

**2. Task Validation:**
- Check for malicious task descriptions (pattern matching)
- Require explicit approval for sensitive operations (e.g., firing agents, changing goals)

**3. Message Quarantine:**
- Suspicious messages flagged for review before delivery
- Patterns: SQL injection, shell commands, URLs to unknown domains

**4. Emergency Controls:**
- `rm pause <agent-id>` - Immediately pause agent
- `rm pause --all` - Pause entire system
- `rm kill <agent-id>` - Forcefully terminate agent (SIGKILL)

### 11.4 Privacy Considerations

**Data Retention:**
- Agent data retained until fired + 90 days
- Archived agents auto-deleted after 1 year (configurable)
- Audit logs retained for 1 year minimum

**PII Handling:**
- Agents may process sensitive data (customer info, etc.)
- No automatic redaction (agents responsible for handling PII appropriately)
- User can configure data retention policies

**Compliance:**
- GDPR: Right to erasure (delete agent + all subordinates)
- Audit trail for all data access

---

## 12. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Core file system structure, basic CLI, manual agent execution

**Deliverables:**
- [ ] File structure creation (agents, system directories)
- [ ] JSON schemas for config, schedule, subordinates
- [ ] SQLite database schema for indexing
- [ ] Basic CLI commands: `init`, `hire`, `fire`, `status`, `message`
- [ ] Manual agent execution: `rm run <agent-id> <instance-type>`
- [ ] File-based state management (atomic writes)
- [ ] Audit logging (append-only JSONL)

**Testing:**
- Unit tests for file operations
- Manual testing of hire/fire workflows

---

### Phase 2: Execution Engine (Weeks 3-4)

**Goal:** Framework adapters, agent instance orchestration

**Deliverables:**
- [ ] Framework adapter interface
- [ ] Claude Code adapter implementation
- [ ] Agent instance orchestrator (load context, execute, update state)
- [ ] Lock-based concurrency control
- [ ] Process registry
- [ ] Timeout and resource limits
- [ ] Error handling and recovery

**Testing:**
- Integration tests: spawn agent, execute, verify state updates
- Concurrency tests: duplicate instance prevention

---

### Phase 3: Scheduling (Weeks 5-6)

**Goal:** Centralized scheduler daemon, smart spawning

**Deliverables:**
- [ ] Scheduler daemon (long-running process)
- [ ] Schedule configuration (continuous + time-based)
- [ ] Cron expression parsing
- [ ] Smart spawning logic (only if pending tasks)
- [ ] Process cleanup (stale locks, completed processes)
- [ ] Systemd service configuration (Linux)
- [ ] Launchd configuration (macOS)

**Testing:**
- Integration tests: scheduler spawns instances at correct times
- Edge case tests: DST, clock skew, missed triggers

---

### Phase 4: Messaging (Weeks 7-8)

**Goal:** Messaging relay, platform modules (Slack, Telegram)

**Deliverables:**
- [ ] Messaging relay architecture
- [ ] Standardized message format
- [ ] Routing logic (mention, channel, keyword, fallback)
- [ ] Slack module (webhook, events API)
- [ ] Telegram module (bot API)
- [ ] Email module (IMAP polling)
- [ ] Message priority detection
- [ ] Inbox processing in reactive instances

**Testing:**
- End-to-end tests: send Slack message, verify agent response
- Platform-specific tests (Slack, Telegram, Email)

---

### Phase 5: Task Management (Weeks 9-10)

**Goal:** Hierarchical tasks, archival, task lifecycle

**Deliverables:**
- [ ] Markdown task list parsing
- [ ] Task folder creation (plan, tasks, progress, context)
- [ ] Task status transitions (TODO, IN_PROGRESS, DELEGATED, BLOCKED, COMPLETED)
- [ ] Task archival (completed → archive)
- [ ] Task dependency tracking (blocked by)
- [ ] Nested task support (task folders reference other task folders)

**Testing:**
- Unit tests: task parsing, status transitions
- Integration tests: agent creates task, delegates, completes

---

### Phase 6: Multi-Perspective Analysis (Weeks 11-12)

**Goal:** Parallel sub-agent spawning for 8 perspectives

**Deliverables:**
- [ ] Perspective definitions (security, architecture, simplicity, UX, financial, operational, emotional, growth)
- [ ] Parallel sub-agent spawning
- [ ] Perspective synthesis (meta-analysis)
- [ ] Conflict resolution (trade-off identification)
- [ ] Timeout handling (partial results if sub-agent times out)

**Testing:**
- Integration tests: spawn 8 sub-agents, verify synthesis
- Performance tests: parallel execution time

---

### Phase 7: OpenCode Adapter (Week 13)

**Goal:** Secondary framework support

**Deliverables:**
- [ ] OpenCode adapter implementation
- [ ] Framework selection logic (preferred + fallback)
- [ ] Framework-specific prompt templates

**Testing:**
- Integration tests: execute agent via OpenCode
- Fallback tests: Claude unavailable → use OpenCode

---

### Phase 8: CLI UX (Week 14)

**Goal:** Polished CLI experience, help system, visualization

**Deliverables:**
- [ ] Rich CLI output (colors, tables, progress bars)
- [ ] Help system (`rm --help`, `rm <command> --help`)
- [ ] Interactive mode (`rm interactive`)
- [ ] Org chart visualization (`rm org-chart`)
- [ ] Task tree visualization (`rm tasks <agent-id> --tree`)
- [ ] Agent status dashboard (`rm status --watch`)

**Testing:**
- Manual UX testing
- Accessibility testing (screen readers, color-blind mode)

---

### Phase 9: Edge Cases & Resilience (Week 15)

**Goal:** Handle all 30+ edge cases, robust error recovery

**Deliverables:**
- [ ] Edge case handling (see section 10)
- [ ] Stale lock cleanup
- [ ] Orphan detection and recovery
- [ ] Circular dependency detection
- [ ] Rate limiting (hiring, messaging)
- [ ] Disk usage monitoring and cleanup
- [ ] Crash recovery (restore from backups)

**Testing:**
- Edge case test suite (all 30+ cases)
- Chaos testing (kill scheduler, corrupt files, etc.)

---

### Phase 10: Documentation & Examples (Week 16)

**Goal:** Complete user and developer documentation

**Deliverables:**
- [ ] README with quickstart
- [ ] User guide (tutorials, recipes, best practices)
- [ ] Developer guide (architecture, contributing, extending)
- [ ] API reference (CLI commands, config schemas)
- [ ] Example use cases (build app, manage team, automate workflows)
- [ ] Video tutorials (optional)

**Testing:**
- Documentation review by external users
- Example use case walkthrough

---

### Phase 11: Security Hardening (Week 17)

**Goal:** Production-ready security

**Deliverables:**
- [ ] Input sanitization (all user inputs)
- [ ] Secrets encryption at rest
- [ ] File permission hardening
- [ ] Sandboxing (chroot, Docker, or VM)
- [ ] Security audit (external review)
- [ ] Penetration testing

**Testing:**
- Security test suite (injection, privilege escalation, etc.)
- External security audit

---

### Phase 12: Performance Optimization (Week 18)

**Goal:** Optimize for scale (1000+ agents, 10k+ tasks)

**Deliverables:**
- [ ] SQLite indexing optimization (query performance)
- [ ] File I/O optimization (batching, caching)
- [ ] Scheduler optimization (efficient scanning)
- [ ] Memory profiling and leak detection
- [ ] Benchmark suite (measure performance)

**Testing:**
- Load tests (1000 agents, high message volume)
- Profiling (CPU, memory, disk I/O)

---

## 13. CLI Design

### 13.1 Command Structure

**Global Commands:**
- `rm init <goal>` - Initialize RecursiveManager with CEO agent
- `rm status [agent-id]` - Show agent status (all agents if no ID)
- `rm org-chart` - Visualize agent hierarchy
- `rm logs <agent-id>` - View agent execution logs
- `rm pause [agent-id] [--all]` - Pause agent(s)
- `rm resume [agent-id] [--all]` - Resume agent(s)
- `rm health` - System health check

**Agent Lifecycle:**
- `rm hire --role <role> --goal <goal> --manager <manager-id>` - Hire agent
- `rm fire <agent-id> [--reason <reason>]` - Fire agent
- `rm configure <agent-id> [--goal <goal>] [--schedule <schedule>]` - Update agent config

**Task Management:**
- `rm tasks <agent-id> [--tree]` - View agent tasks
- `rm task add <agent-id> --description <desc>` - Add task to agent
- `rm task complete <agent-id> <task-id>` - Mark task complete

**Messaging:**
- `rm message <agent-id> <message>` - Send message to agent
- `rm inbox <agent-id>` - View agent inbox

**Debugging:**
- `rm debug <agent-id>` - Show detailed agent state (config, tasks, inbox, workspace)
- `rm recover <agent-id>` - Attempt recovery from stuck state

**Scheduler:**
- `rm scheduler status` - Scheduler daemon status
- `rm scheduler start` - Start scheduler daemon
- `rm scheduler stop` - Stop scheduler daemon
- `rm scheduler restart` - Restart scheduler daemon

### 13.2 Example Workflows

**Workflow 1: Initialize system and hire team**

```bash
# Initialize with CEO
rm init "Build a SaaS product for project management"
# Output: CEO agent created. Status: active. Analyzing goal from 8 perspectives...

# CEO hires CTO
rm hire --role "CTO" --goal "Lead engineering team" --manager CEO
# Output: Agent CTO hired by CEO. Running initialization...

# CTO hires developers
rm hire --role "Backend Developer" --goal "Build REST API" --manager CTO
rm hire --role "Frontend Developer" --goal "Build React UI" --manager CTO

# View org chart
rm org-chart
# Output:
# CEO
# ├── CTO
# │   ├── backend-developer-001
# │   └── frontend-developer-001

# Check status
rm status
# Output:
# AGENT              ROLE                 STATUS    TASKS    LAST RUN
# CEO                CEO                  active    3        2min ago
# CTO                CTO                  active    2        5min ago
# backend-dev-001    Backend Developer    active    1        10min ago
# frontend-dev-001   Frontend Developer   active    1        15min ago
```

**Workflow 2: Send message to agent**

```bash
# Send urgent message
rm message product-manager-001 "Customer X is angry, investigate ASAP"
# Output: Message sent to product-manager-001. Reactive instance spawned.

# Check inbox
rm inbox product-manager-001
# Output:
# UNREAD MESSAGES (1):
# - 2026-01-18 14:30 [URGENT] from cli-user: "Customer X is angry..."

# View agent logs to see how it responded
rm logs product-manager-001
# Output:
# [14:30:05] Reactive instance started
# [14:30:10] Processing message from cli-user
# [14:30:15] Multi-perspective analysis: security, ux, emotional...
# [14:30:30] Added urgent task: "Investigate Customer X issue"
# [14:30:35] Messaging customer-success-lead for context
# [14:30:40] Reactive instance complete
```

**Workflow 3: Debug stuck agent**

```bash
# Agent stuck, check status
rm status backend-dev-001
# Output: Status: active, Last run: 3 hours ago, Tasks: 1 in progress

# Debug detailed state
rm debug backend-dev-001
# Output:
# AGENT: backend-dev-001
# CONFIG:
#   Role: Backend Developer
#   Goal: Build REST API
#   Manager: CTO
#   Status: active
#
# CURRENT TASK:
#   - [ ] Implement authentication endpoints (IN_PROGRESS for 3 hours)
#
# RUNNING INSTANCES:
#   - PID 12345, continuous, started 3h ago, no output for 1h
#
# RECENT LOGS:
#   [11:00:00] Started working on auth endpoints
#   [11:05:00] Multi-perspective analysis complete
#   [11:10:00] Decided to implement JWT auth
#   [12:00:00] [No output since]
#
# DIAGNOSIS: Instance likely stuck. Recommendation: rm recover backend-dev-001

# Attempt recovery
rm recover backend-dev-001
# Output: Killing stuck instance (PID 12345)... Done.
#         Marking task as RECOVERY_NEEDED.
#         Notifying manager (CTO).
#         Recovery complete. Next continuous instance will retry task.
```

### 13.3 Output Formatting

**Default: Human-Readable**
- Tables for status/list views
- Colors: green (active), yellow (paused), red (error)
- Progress bars for long-running operations

**JSON Mode: Machine-Readable**
- `rm status --json` - JSON output for scripting
- All commands support `--json` flag

**Verbose Mode:**
- `rm status -v` - Show more details (last 5 logs, task breakdown)
- `rm status -vv` - Full details (all logs, all tasks, workspace notes)

---

## 14. Testing Strategy

### 14.1 Test Pyramid

```
      /\
     /  \       E2E Tests (10%)
    /____\      - Full workflows (init, hire, execute, complete)
   /      \     - Multi-agent scenarios
  /________\    Integration Tests (30%)
 /          \   - Scheduler + agents
/__________\  - Messaging + agents
Unit Tests (60%) - File operations, task parsing, lock acquisition
```

### 14.2 Unit Tests

**Modules to Test:**
- File operations (create, read, update, delete with atomic writes)
- Task parsing (Markdown to task objects)
- Lock acquisition (PID validation, stale lock detection)
- Message formatting (platform-specific → standardized)
- Cron expression parsing
- Org chart operations (add, remove, detect cycles)

**Example:**

```python
def test_atomic_file_write():
    # Write to file atomically
    write_atomic('/tmp/test.json', {'key': 'value'})

    # Verify .tmp file removed
    assert not os.path.exists('/tmp/test.json.tmp')

    # Verify content
    content = read_file('/tmp/test.json')
    assert content == {'key': 'value'}

def test_detect_circular_reporting():
    org_chart = {
        'A': {'reportingTo': 'B'},
        'B': {'reportingTo': 'C'},
        'C': {'reportingTo': 'A'}
    }

    assert detect_cycle(org_chart, 'A') == ['A', 'B', 'C', 'A']
```

### 14.3 Integration Tests

**Scenarios to Test:**
- Hire agent → initialization instance runs → config created
- Scheduler detects time-based trigger → spawns reactive instance
- Message arrives → routing → inbox write → reactive instance spawns
- Agent delegates task → hire sub-agent → sub-agent executes → reports back
- Agent fires subordinate → cascade deletion → org chart updated

**Example:**

```python
def test_hire_and_execute():
    # Initialize system
    run_cli(['rm', 'init', 'Build app'])

    # Hire CTO
    result = run_cli(['rm', 'hire', '--role', 'CTO', '--goal', 'Lead eng', '--manager', 'CEO'])
    assert 'CTO hired' in result.stdout

    # Verify config created
    config = read_json('agents/CTO/config.json')
    assert config['role'] == 'CTO'
    assert config['status'] == 'active'

    # Verify schedule created (by initialization instance)
    schedule = read_json('agents/CTO/schedule.json')
    assert schedule['continuous']['enabled'] == True

    # Verify tasks created
    tasks = read_file('agents/CTO/tasks/active/continuous.md')
    assert len(tasks.split('- [ ]')) > 1  # At least 1 task
```

### 14.4 End-to-End Tests

**Full User Scenarios:**

**Scenario 1: Build a SaaS product (3-level hierarchy)**

```python
def test_build_saas_product_workflow():
    # 1. Initialize
    run_cli(['rm', 'init', 'Build a SaaS product'])

    # 2. CEO hires CTO, CMO, CFO
    # (Assumes CEO's initialization instance automatically hires team)
    wait_for_agents(['CEO', 'CTO', 'CMO', 'CFO'], timeout=300)

    # 3. CTO hires developers
    # (Assumes CTO's initialization creates task to hire team, continuous instance executes)
    wait_for_agents(['backend-developer-001', 'frontend-developer-001'], timeout=600)

    # 4. Developers build features
    # (Continuous instances pick up tasks)
    wait_for_tasks_complete(['backend-developer-001'], timeout=3600)

    # 5. Verify product built
    # (Check task status, workspace notes, artifacts)
    backend_tasks = get_tasks('backend-developer-001')
    assert all(task['status'] == 'completed' for task in backend_tasks)

    # 6. Org chart final state
    org_chart = get_org_chart()
    assert len(org_chart['agents']) >= 6  # CEO, CTO, CMO, CFO, 2 devs
```

**Scenario 2: Slack escalation handling**

```python
def test_slack_escalation_workflow():
    # Setup: Product manager agent exists
    run_cli(['rm', 'hire', '--role', 'Product Manager', '--goal', 'Manage product', '--manager', 'CEO'])

    # 1. Send Slack message (simulated)
    send_slack_message(
        channel='#product',
        text='@ProductManager Customer X is furious, feature Y is broken!'
    )

    # 2. Verify message routed to product-manager-001
    wait_for_file('agents/product-manager-001/inbox/messages/*.md', timeout=10)

    # 3. Verify reactive instance spawned
    wait_for_process('product-manager-001', 'reactive', timeout=30)

    # 4. Verify task created
    tasks = get_tasks('product-manager-001')
    urgent_tasks = [t for t in tasks if t['priority'] == 'urgent']
    assert len(urgent_tasks) >= 1

    # 5. Verify response sent to Slack
    responses = get_slack_messages(channel='#product')
    assert any('Acknowledged' in r for r in responses)
```

### 14.5 Performance Tests

**Metrics to Measure:**
- Agent spawn time (target: < 5 seconds)
- Task execution time (varies, but measure average)
- Scheduler iteration time (target: < 10 seconds for 1000 agents)
- File I/O latency (target: < 100ms per operation)
- Memory usage per agent (target: < 500MB average)

**Load Tests:**
- 1000 agents, mixed continuous and reactive
- High message volume (100 messages/minute)
- Concurrent task execution (50 agents working simultaneously)

**Example:**

```python
def test_scheduler_performance_1000_agents():
    # Create 1000 agents
    for i in range(1000):
        create_agent(f'agent-{i}')

    # Measure scheduler iteration time
    start = time.time()
    run_scheduler_iteration()
    duration = time.time() - start

    assert duration < 10  # Less than 10 seconds
```

### 14.6 Chaos Testing

**Inject Failures:**
- Kill scheduler daemon mid-execution
- Corrupt config files (invalid JSON)
- Delete lock files during instance execution
- Fill disk to 100%
- Network partition (framework API unavailable)

**Verify Recovery:**
- Scheduler restarts, resumes from last state
- Agents detect corruption, restore from backups
- Stale locks cleaned up, new instances spawn
- Disk cleanup triggered, agents continue
- Framework fallback to alternative adapter

**Example:**

```python
def test_scheduler_crash_recovery():
    # 1. Start scheduler
    scheduler_pid = start_scheduler()

    # 2. Wait for agents to spawn
    wait_for_agents(['agent-1', 'agent-2'], timeout=60)

    # 3. Kill scheduler
    os.kill(scheduler_pid, signal.SIGKILL)

    # 4. Verify scheduler restarts (systemd)
    wait_for_process('rm-scheduler', timeout=10)

    # 5. Verify agents continue execution
    wait_for_tasks_complete(['agent-1'], timeout=300)
```

---

## 15. Deployment & Operations

### 15.1 Installation

**Prerequisites:**
- Linux (Ubuntu 20.04+) or macOS (10.15+)
- Python 3.9+ or Node.js 18+
- Claude CLI (for Claude Code adapter) or OpenCode CLI
- Systemd (Linux) or Launchd (macOS) for daemon management

**Install via pip/npm:**

```bash
# Python
pip install recursivemanager

# Node.js
npm install -g recursivemanager
```

**Manual Install:**

```bash
git clone https://github.com/aaron777collins/RecursiveManager.git
cd RecursiveManager
make install  # or python setup.py install
```

**Verify Installation:**

```bash
rm --version
# Output: RecursiveManager v1.0.0

rm health
# Output: System healthy. No scheduler running. Run `rm scheduler start` to begin.
```

### 15.2 Configuration

**Global Config** (`~/.recursivemanager/config/default.json`):

```json
{
  "dataDirectory": "~/.recursivemanager",
  "maxAgents": 1000,
  "maxDepth": 10,
  "maxSubordinates": 20,
  "maxConcurrentInstances": 50,
  "frameworks": {
    "preferred": "claude-code",
    "fallbackOrder": ["claude-code", "opencode"]
  },
  "scheduler": {
    "scanInterval": 60,
    "cleanupInterval": 300
  },
  "messaging": {
    "enabled": true,
    "platforms": ["slack", "telegram", "email"]
  },
  "logging": {
    "level": "info",
    "retention": 30
  }
}
```

**Secrets** (`~/.recursivemanager/config/secrets.json`):

```json
{
  "anthropic_api_key": "sk-...",
  "slack_bot_token": "xoxb-...",
  "slack_app_token": "xapp-...",
  "telegram_bot_token": "...",
  "email_imap_password": "..."
}
```

**First-Time Setup:**

```bash
# Initialize data directory
rm init "Build a SaaS product"
# Prompts for:
# - Data directory location (default: ~/.recursivemanager)
# - Framework preference (claude-code or opencode)
# - Messaging platforms to enable
# - API keys (interactive or from file)

# Start scheduler
rm scheduler start
# Output: Scheduler daemon started (PID 12345). Scanning every 60s.
```

### 15.3 Monitoring

**Built-In Health Checks:**

```bash
# System health
rm health
# Output:
# System Status: HEALTHY
# Scheduler: Running (PID 12345, uptime 3h 25m)
# Active Agents: 15
# Running Instances: 5
# Disk Usage: 2.3GB / 100GB (2.3%)
# SQLite DB: Healthy

# Agent-specific health
rm status backend-dev-001
# Output:
# Agent: backend-dev-001
# Status: ACTIVE
# Last Run: 2 minutes ago (continuous)
# Tasks: 3 active, 5 completed
# Instances: 1 running (PID 12346)
# Health: HEALTHY
```

**Logs:**

```bash
# Scheduler logs
tail -f ~/.recursivemanager/logs/scheduler.log

# Agent logs
rm logs backend-dev-001 --follow

# System-wide logs (systemd)
journalctl -u recursivemanager-scheduler -f
```

**Metrics (optional Prometheus integration):**

```bash
# Expose metrics endpoint
rm metrics --enable --port 9090

# Metrics available:
# - rm_agents_total
# - rm_agents_by_status{status="active|paused|terminated"}
# - rm_instances_total{type="continuous|reactive"}
# - rm_tasks_total{status="todo|in_progress|completed"}
# - rm_messages_total{platform="slack|telegram|email"}
# - rm_scheduler_iteration_duration_seconds
```

### 15.4 Maintenance

**Daily:**
- Check scheduler health: `rm health`
- Review critical agent logs: `rm logs <critical-agents> | grep ERROR`

**Weekly:**
- Archive completed agents: `rm archive --older-than 90d`
- Clean up logs: `rm logs --cleanup --older-than 30d`
- Check disk usage: `rm health --verbose`

**Monthly:**
- Backup data directory: `tar -czf rm-backup-$(date +%Y%m%d).tar.gz ~/.recursivemanager`
- Review agent performance: `rm metrics --report`
- Update dependencies: `rm update`

**Quarterly:**
- Security audit: Review audit logs for suspicious activity
- Disaster recovery drill: Restore from backup, verify system
- Performance tuning: Analyze slow queries, optimize

### 15.5 Troubleshooting

**Problem: Scheduler not spawning instances**

```bash
# Check scheduler status
rm scheduler status
# If stopped, start it
rm scheduler start

# Check agent schedules
rm debug <agent-id>
# Verify schedule.json exists and is valid

# Check logs
tail -f ~/.recursivemanager/logs/scheduler.log | grep ERROR
```

**Problem: Agent stuck in "in_progress" for hours**

```bash
# Debug agent
rm debug <agent-id>
# Check running instances, last logs

# Attempt recovery
rm recover <agent-id>

# If recovery fails, manually fire and rehire
rm fire <agent-id>
rm hire --role <role> --goal <goal> --manager <manager>
```

**Problem: Disk usage high**

```bash
# Check usage
rm health --verbose

# Archive old agents
rm archive --older-than 90d --dry-run  # Preview
rm archive --older-than 90d            # Execute

# Clean logs
rm logs --cleanup --older-than 30d

# Compress workspace files
find ~/.recursivemanager/agents/*/workspace -name "*.md" -exec gzip {} \;
```

---

## Summary

This comprehensive plan provides a complete blueprint for implementing RecursiveManager, a recursive agent hierarchy system. The plan covers:

- **Architecture**: File-based state, dual instance types, framework abstraction
- **Core Features**: Hiring/firing, task management, scheduling, messaging, multi-perspective analysis
- **Edge Cases**: 30+ edge cases identified with prevention/detection/recovery strategies
- **Security**: Threat model, access control, sandboxing, audit logging
- **Implementation**: 12 phased deliverables over 18 weeks
- **Testing**: Unit, integration, E2E, performance, chaos testing
- **Operations**: Installation, configuration, monitoring, maintenance, troubleshooting

**Key Design Decisions:**
1. File-based state (no databases for primary storage, SQLite for indexing)
2. Fresh memory (zero context between runs)
3. Dual instances (continuous for work, reactive for events)
4. Multi-perspective analysis (8+ perspectives for quality)
5. Framework abstraction (Claude Code primary, extensible)
6. Modular messaging (platform-agnostic contracts)
7. Smart spawning (resource-efficient)
8. Hierarchical tasks (nested folders, archival)

**Next Steps:**
1. Review this plan for gaps or clarifications
2. Create GitHub repository structure
3. Begin Phase 1 implementation (Foundation)
4. Iterate based on user feedback

**Total Estimated Effort:** 18 weeks (4.5 months) for full implementation with 1 developer.

---

*This plan will be committed to the RecursiveManager repository as the canonical implementation guide.*
