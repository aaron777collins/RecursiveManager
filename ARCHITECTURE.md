# RecursiveManager - Comprehensive Architectural Blueprint

## Executive Summary

RecursiveManager is a recursive agent hierarchy system that enables AI agents to operate like autonomous employees in an organization. Each agent has dual execution modes (continuous and reactive), manages tasks hierarchically, can hire/fire sub-agents, and maintains state through file-based persistence with zero memory between runs.

**Core Principles:**
- **Quality over cost**: Multi-perspective analysis for all decisions
- **Fresh state**: Zero memory context between runs
- **File-based persistence**: All state in files, not databases
- **Recursive delegation**: Agents hire sub-agents for non-trivial work
- **Dual responsibility**: Manager and worker both track delegated tasks
- **Smart spawning**: Only spawn continuous instances when work exists
- **Hierarchical tasks**: Nested task folders with archival
- **Modular design**: Core logic + framework adapters + messaging modules

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [File Structure](#file-structure)
3. [Process Architecture](#process-architecture)
4. [Agent Execution Model](#agent-execution-model)
5. [State Management](#state-management)
6. [Concurrency & Locking](#concurrency--locking)
7. [Framework Abstraction](#framework-abstraction)
8. [Inter-Agent Communication](#inter-agent-communication)
9. [Scheduler Design](#scheduler-design)
10. [Messaging Integration](#messaging-integration)
11. [Task Management](#task-management)
12. [Error Handling & Recovery](#error-handling--recovery)
13. [Edge Cases](#edge-cases)
14. [Security Considerations](#security-considerations)
15. [Implementation Phases](#implementation-phases)

---

## 1. System Architecture

### 1.1 High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     RecursiveManager System                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐ │
│  │   Central    │────▶│   Messaging  │────▶│   Agent      │ │
│  │   Scheduler  │     │   Relay      │     │   Instances  │ │
│  │   Daemon     │     │   System     │     │              │ │
│  └──────────────┘     └──────────────┘     └──────────────┘ │
│         │                    │                     │         │
│         │                    │                     │         │
│         ▼                    ▼                     ▼         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           File-Based Agent Hierarchy                  │   │
│  │                                                        │   │
│  │  agents/                                              │   │
│  │    ├─ CEO/                                            │   │
│  │    │   ├─ config.json                                 │   │
│  │    │   ├─ schedule.json                               │   │
│  │    │   ├─ tasks/active/                               │   │
│  │    │   ├─ tasks/archive/                              │   │
│  │    │   ├─ workspace/                                  │   │
│  │    │   └─ inbox/                                      │   │
│  │    ├─ CTO/                                            │   │
│  │    └─ ...                                             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

#### Central Scheduler Daemon
- Scans all `agents/*/schedule.json` files periodically
- Determines which agents need to be triggered (time-based, continuous)
- Spawns agent instances via framework adapter
- Only spawns continuous instances if pending work exists
- Maintains global process registry to prevent duplicate instances

#### Messaging Relay System
- Receives messages from external platforms (Slack, Telegram, Email)
- Routes messages to appropriate agent's inbox
- Triggers reactive agent instances immediately
- Provides standardized interface for all messaging platforms
- Modular architecture with platform-specific adapters

#### Agent Instances
- **Continuous Instances**: Pick one task, execute, update state, exit
- **Reactive Instances**: Process schedule events or messages, update state, exit
- Execute with fresh memory (no context from previous runs)
- Read all state from files on startup
- Write all state changes before exit

#### Framework Adapters
- Abstract interface for AI framework execution
- Primary: Claude Code adapter
- Secondary: OpenCode adapter
- Extensible for future frameworks

### 1.3 Data Flow Diagrams

#### Continuous Task Execution Flow
```
Scheduler Scan
    │
    ├─ Read agents/*/schedule.json
    ├─ Check for pending tasks (smart spawning)
    │
    ├─ IF pending work EXISTS
    │   │
    │   └─▶ Spawn Continuous Instance
    │       │
    │       ├─ Read config.json (identity, role, goal)
    │       ├─ Read tasks/active/* (pending tasks)
    │       ├─ Multi-perspective analysis
    │       ├─ Pick ONE task
    │       ├─ Execute task
    │       │   ├─ If non-trivial → hire sub-agent
    │       │   ├─ If blocked → escalate to manager
    │       │   └─ If complete → archive task
    │       ├─ Update progress files
    │       └─ Exit
    │
    └─ IF no pending work
        └─ Skip spawning (save cycles)
```

#### Reactive Message Flow
```
External Message (Slack/Telegram/Email)
    │
    ├─ Messaging Relay receives
    ├─ Parse and route to agent
    │
    └─▶ Spawn Reactive Instance
        │
        ├─ Read inbox/messages
        ├─ Multi-perspective analysis
        ├─ Determine action
        │   ├─ Add to continuous task list
        │   ├─ Prioritize (top of list if urgent)
        │   ├─ Update schedule if needed
        │   └─ Respond to sender
        ├─ Update state files
        └─ Exit
```

#### Hiring Flow
```
Agent decides to hire
    │
    ├─ Call CLI: recursive-manager hire \
    │              --role "Backend Developer" \
    │              --goal "Build REST API" \
    │              --manager "CTO"
    │
    └─▶ Hiring Process
        │
        ├─ Generate unique agent ID
        ├─ Create agent directory structure
        ├─ Spawn initialization instance
        │   │
        │   └─▶ New Agent Initialization
        │       ├─ Multi-perspective analysis of goal
        │       ├─ Determine optimal schedule
        │       ├─ Create initial task breakdown
        │       ├─ Write schedule.json
        │       ├─ Write tasks/active/*
        │       └─ Exit
        │
        ├─ Update manager's subordinates list
        └─ Register in scheduler
```

---

## 2. File Structure

### 2.1 Agent Directory Layout

```
agents/
├─ <agent-id>/
│  ├─ config.json              # Identity, role, goal, reporting structure
│  ├─ schedule.json            # Time-based triggers and cadence
│  ├─ subordinates.json        # List of hired agents (for managers)
│  ├─ tasks/
│  │  ├─ active/
│  │  │  ├─ continuous.md      # Main continuous task list (ordered by priority)
│  │  │  └─ <task-name>/       # Hierarchical task folders
│  │  │     ├─ plan.md         # Task breakdown and strategy
│  │  │     ├─ tasks.md        # Atomic sub-tasks
│  │  │     ├─ progress.md     # Current state and progress
│  │  │     └─ context.json    # Metadata (assignee, deadline, priority)
│  │  └─ archive/
│  │     └─ <completed-task>/  # Moved here when complete
│  ├─ workspace/
│  │  ├─ notes.md              # Long-term memory and observations
│  │  ├─ research/             # Background research, links, references
│  │  └─ drafts/               # Work in progress, scratch space
│  └─ inbox/
│     ├─ messages/
│     │  └─ <timestamp>-<sender>.md  # Incoming messages
│     └─ processed/            # Moved here after handling
```

### 2.2 File Format Specifications

#### config.json
```json
{
  "agent_id": "backend-dev-001",
  "role": "Backend Developer",
  "main_goal": "Build REST API for user authentication",
  "reporting_to": "CTO",
  "created_at": "2026-01-18T12:00:00Z",
  "status": "active",  // active, paused, terminated
  "capabilities": ["coding", "architecture", "testing"],
  "frameworks": ["claude-code"],  // Preferred execution framework
  "metadata": {
    "hire_reason": "Need specialized backend expertise",
    "expected_duration": "2 weeks"
  }
}
```

#### schedule.json
```json
{
  "continuous": {
    "enabled": true,
    "min_interval_seconds": 300,  // Don't spam, wait at least 5 min between runs
    "max_concurrent_instances": 1  // Prevent duplicate continuous instances
  },
  "time_based_triggers": [
    {
      "id": "daily-standup",
      "cron": "0 9 * * *",  // Every day at 9 AM
      "action": "check_subordinates_progress",
      "enabled": true
    },
    {
      "id": "weekly-review",
      "cron": "0 17 * * 5",  // Every Friday at 5 PM
      "action": "report_to_manager",
      "enabled": true
    }
  ],
  "reactive_triggers": {
    "slack": true,
    "telegram": true,
    "email": false
  }
}
```

#### tasks/active/continuous.md
```markdown
# Continuous Task List

Priority order (top = highest priority):

- [ ] **[URGENT]** Fix authentication bug reported by manager → `tasks/active/auth-bug/`
- [ ] Implement OAuth integration → `tasks/active/oauth/`
- [ ] Write API documentation → simple task (no folder)
- [ ] Code review for subordinate frontend-dev-003

---

## Task References

When a task has `→ path`, see that folder for detailed breakdown.
Simple tasks (no arrow) can be completed in one session.
```

#### tasks/active/oauth/plan.md
```markdown
# OAuth Integration Plan

## Goal
Implement OAuth 2.0 authentication flow for third-party login

## Analysis
(Multi-perspective analysis results from initialization)

**Security Perspective:**
- Use PKCE flow for security
- Store tokens in encrypted format
- Implement token rotation

**Architecture Perspective:**
- Separate OAuth service from main auth
- Use adapter pattern for multiple providers

**Simplicity Perspective:**
- Start with Google only, add more later
- Use battle-tested library (passport.js)

## Strategy
1. Research OAuth libraries (2 hours)
2. Set up Google OAuth app (30 min)
3. Implement backend routes (4 hours)
4. Test and debug (2 hours)

## Decision: Delegate?
**YES** - Non-trivial, hire OAuth specialist sub-agent
```

#### tasks/active/oauth/tasks.md
```markdown
# OAuth Implementation Tasks

- [x] Research OAuth 2.0 libraries
- [x] Hire oauth-specialist-042 to implement
- [ ] Review oauth-specialist-042's implementation
- [ ] Integrate with main auth system
- [ ] Write tests
- [ ] Deploy to staging
```

#### tasks/active/oauth/progress.md
```markdown
# OAuth Integration Progress

## Last Updated: 2026-01-18T14:30:00Z

## Current Status: IN_PROGRESS

## Completed:
- Researched libraries, chose passport.js
- Hired oauth-specialist-042 (2026-01-18T14:00:00Z)
- Specialist is currently implementing backend routes

## Next Steps:
- Wait for specialist to complete implementation
- Review code when ready
- Test integration

## Blockers:
None

## Notes:
Specialist estimated 6 hours for implementation. Expected completion: 2026-01-18T20:00:00Z
```

#### inbox/messages/20260118-143000-manager-CTO.md
```markdown
---
from: CTO
to: backend-dev-001
timestamp: 2026-01-18T14:30:00Z
priority: high
processed: false
---

# Message from CTO

Customer reported that login is broken. Please investigate ASAP and report back within 1 hour.

## Context
- User ID: user-12345
- Error: "Invalid credentials" even with correct password
- Started happening 30 minutes ago
```

#### workspace/notes.md
```markdown
# Backend Developer Notes

## Long-Term Observations

### 2026-01-18
- OAuth library research: passport.js seems most maintained
- Note: Authentication bugs often related to session expiry, check this first
- Reminder: Always test edge cases with expired tokens

### 2026-01-17
- CTO prefers detailed progress reports, not too brief
- When escalating, include error logs and steps tried
```

### 2.3 Global Files

```
RecursiveManager/
├─ agents/                    # All agent directories
├─ system/
│  ├─ scheduler_state.json    # Scheduler's internal state
│  ├─ process_registry.json   # Currently running instances
│  ├─ org_chart.json          # Agent hierarchy visualization
│  └─ audit_log.jsonl         # All actions (hiring, firing, escalations)
├─ config/
│  ├─ system_config.json      # Global settings
│  ├─ framework_adapters/     # Framework-specific configs
│  └─ messaging_modules/      # Messaging platform configs
└─ logs/
   ├─ scheduler.log
   ├─ messaging.log
   └─ agents/
      └─ <agent-id>/
         └─ <timestamp>.log
```

#### system/scheduler_state.json
```json
{
  "last_scan": "2026-01-18T14:35:00Z",
  "next_scan": "2026-01-18T14:36:00Z",
  "scan_interval_seconds": 60,
  "active_agents": 15,
  "paused_agents": 2,
  "total_spawns_today": 142
}
```

#### system/process_registry.json
```json
{
  "running_instances": [
    {
      "agent_id": "backend-dev-001",
      "instance_type": "continuous",
      "pid": 12345,
      "started_at": "2026-01-18T14:30:00Z",
      "task": "Fix authentication bug",
      "lock_file": "/tmp/rm-backend-dev-001-continuous.lock"
    },
    {
      "agent_id": "CEO",
      "instance_type": "reactive",
      "pid": 12346,
      "started_at": "2026-01-18T14:35:00Z",
      "trigger": "slack-message",
      "lock_file": "/tmp/rm-CEO-reactive.lock"
    }
  ]
}
```

#### system/org_chart.json
```json
{
  "root": "CEO",
  "hierarchy": {
    "CEO": {
      "subordinates": ["CTO", "CMO", "CFO"],
      "status": "active"
    },
    "CTO": {
      "reporting_to": "CEO",
      "subordinates": ["backend-dev-001", "frontend-dev-002"],
      "status": "active"
    },
    "backend-dev-001": {
      "reporting_to": "CTO",
      "subordinates": ["oauth-specialist-042"],
      "status": "active"
    }
  }
}
```

#### system/audit_log.jsonl
```json
{"timestamp": "2026-01-18T12:00:00Z", "action": "hire", "agent_id": "backend-dev-001", "hired_by": "CTO", "role": "Backend Developer"}
{"timestamp": "2026-01-18T14:00:00Z", "action": "hire", "agent_id": "oauth-specialist-042", "hired_by": "backend-dev-001", "role": "OAuth Specialist"}
{"timestamp": "2026-01-18T14:30:00Z", "action": "escalate", "agent_id": "backend-dev-001", "escalated_to": "CTO", "reason": "Critical bug reported"}
```

---

## 3. Process Architecture

### 3.1 Core Processes

#### Central Scheduler Daemon
**Purpose**: Orchestrates all time-based and continuous agent executions

**Responsibilities:**
1. Scan all `agents/*/schedule.json` every 60 seconds
2. Check cron expressions for time-based triggers
3. Check continuous tasks for pending work (smart spawning)
4. Spawn agent instances via framework adapter
5. Maintain process registry to prevent duplicates
6. Clean up stale locks and zombie processes
7. Log all spawn events

**Lifecycle:**
- Runs as systemd service or background daemon
- Graceful shutdown: wait for running instances to complete
- Crash recovery: rebuild process registry from lock files

**Pseudocode:**
```python
while True:
    # Scan all agents
    for agent_dir in glob('agents/*'):
        agent_id = basename(agent_dir)
        schedule = load_json(f'{agent_dir}/schedule.json')

        # Check time-based triggers
        for trigger in schedule['time_based_triggers']:
            if cron_match(trigger['cron']) and trigger['enabled']:
                if not is_running(agent_id, 'reactive'):
                    spawn_agent(agent_id, 'reactive', trigger['action'])

        # Check continuous tasks (smart spawning)
        if schedule['continuous']['enabled']:
            if not is_running(agent_id, 'continuous'):
                if has_pending_tasks(agent_id):
                    last_run = get_last_run_time(agent_id)
                    min_interval = schedule['continuous']['min_interval_seconds']
                    if time_since(last_run) >= min_interval:
                        spawn_agent(agent_id, 'continuous')

    sleep(60)
```

#### Messaging Relay System
**Purpose**: Bridge external messaging platforms to agent inboxes

**Architecture:**
```
┌─────────────────────────────────────────┐
│      Messaging Relay (Core)             │
│  ┌────────────────────────────────┐    │
│  │  Message Router                │    │
│  │  - Parse incoming messages      │    │
│  │  - Route to agent inbox         │    │
│  │  - Trigger reactive instance    │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
         ▲          ▲          ▲
         │          │          │
    ┌────┴───┐ ┌────┴───┐ ┌───┴────┐
    │ Slack  │ │Telegram│ │ Email  │
    │ Module │ │ Module │ │ Module │
    └────────┘ └────────┘ └────────┘
```

**Standardized Message Contract:**
```json
{
  "message_id": "unique-uuid",
  "platform": "slack",
  "from": {
    "user_id": "U12345",
    "user_name": "Alice",
    "channel": "C67890"
  },
  "to": "backend-dev-001",  // Agent ID or auto-routed
  "timestamp": "2026-01-18T14:30:00Z",
  "priority": "high",  // low, normal, high, urgent
  "content": "Customer login is broken, please fix ASAP",
  "metadata": {
    "thread_id": "optional",
    "attachments": []
  }
}
```

**Routing Logic:**
1. Direct mention: `@backend-dev-001 please investigate`
2. Channel mapping: Messages in `#engineering` route to `CTO`
3. Keyword routing: "urgent" → high priority
4. Fallback: Route to `CEO` if no match

**Module Interface:**
```python
class MessagingModule(ABC):
    @abstractmethod
    def listen(self) -> Iterator[Message]:
        """Continuously listen for incoming messages"""
        pass

    @abstractmethod
    def send(self, agent_id: str, message: str):
        """Send message from agent to platform"""
        pass

    @abstractmethod
    def update_status(self, agent_id: str, status: str):
        """Update agent's status on platform (e.g., Slack status)"""
        pass
```

#### Agent Instance Executor
**Purpose**: Spawn and monitor individual agent executions

**Responsibilities:**
1. Acquire lock before spawning (prevent duplicates)
2. Construct framework-specific prompt
3. Execute via framework adapter
4. Monitor execution (timeout, resource limits)
5. Handle crashes and partial state writes
6. Release lock after completion
7. Update process registry

**Lock Mechanism:**
```bash
# Before spawning
LOCK_FILE="/tmp/rm-${AGENT_ID}-${INSTANCE_TYPE}.lock"

if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p $PID > /dev/null; then
        echo "Instance already running (PID $PID)"
        exit 1
    else
        echo "Stale lock found, removing"
        rm "$LOCK_FILE"
    fi
fi

echo $$ > "$LOCK_FILE"

# Execute agent
trap "rm -f $LOCK_FILE" EXIT
execute_agent "$AGENT_ID" "$INSTANCE_TYPE"
```

### 3.2 Agent Instance Execution

#### Continuous Instance Execution
```
1. Startup
   ├─ Acquire lock: /tmp/rm-<agent-id>-continuous.lock
   ├─ Read config.json (who am I?)
   ├─ Read workspace/notes.md (long-term memory)
   └─ Read tasks/active/continuous.md (what to work on?)

2. Task Selection
   ├─ Parse continuous.md (top to bottom)
   ├─ Skip completed tasks
   ├─ Pick FIRST pending task
   └─ Load task details (if hierarchical)

3. Multi-Perspective Analysis
   ├─ Spawn sub-agents for analysis (parallel)
   │  ├─ Security perspective
   │  ├─ Architecture perspective
   │  ├─ Simplicity perspective
   │  ├─ UX perspective
   │  ├─ Cost perspective
   │  ├─ Time perspective
   │  ├─ Risk perspective
   │  └─ Quality perspective
   └─ Aggregate analysis results

4. Decision Making
   ├─ Should I delegate? (if non-trivial)
   │  ├─ YES → Hire sub-agent
   │  │      ├─ Call: recursive-manager hire ...
   │  │      ├─ Update tasks.md (delegated)
   │  │      └─ Exit
   │  └─ NO → Execute myself
   │
   ├─ Am I blocked?
   │  ├─ YES → Escalate to manager
   │  │      ├─ Write to manager's inbox
   │  │      └─ Pause task
   │  └─ NO → Continue
   │
   └─ Can I complete this?
      ├─ Execute task
      ├─ Update progress.md
      └─ If complete → Archive task folder

5. State Update
   ├─ Update tasks/active/continuous.md
   ├─ Update workspace/notes.md (learnings)
   ├─ If task complete → Move to tasks/archive/
   └─ Update schedule.json (if needed)

6. Cleanup
   ├─ Release lock
   └─ Exit
```

#### Reactive Instance Execution
```
1. Startup
   ├─ Acquire lock: /tmp/rm-<agent-id>-reactive.lock
   ├─ Read config.json
   ├─ Read workspace/notes.md
   └─ Determine trigger type (schedule | message)

2. Trigger Processing
   ├─ IF schedule trigger:
   │  ├─ Execute scheduled action (e.g., "check_subordinates_progress")
   │  └─ Update schedule.json (mark last run)
   │
   └─ IF message trigger:
      ├─ Read inbox/messages/*.md (unprocessed)
      ├─ Sort by priority (urgent → high → normal → low)
      └─ Process EACH message

3. Message Processing (per message)
   ├─ Multi-perspective analysis
   │  ├─ Is this urgent?
   │  ├─ What action is needed?
   │  └─ Should I delegate?
   │
   ├─ Take Action
   │  ├─ Add to continuous task list
   │  ├─ Prioritize (insert at top if urgent)
   │  ├─ Or respond immediately (if simple)
   │  └─ Or delegate (hire/message subordinate)
   │
   ├─ Update State
   │  ├─ Update tasks/active/continuous.md
   │  ├─ Move message to inbox/processed/
   │  └─ Log in workspace/notes.md
   │
   └─ Respond
      ├─ Send acknowledgment via messaging module
      └─ Set expectation (ETA, who's handling)

4. Cleanup
   ├─ Release lock
   └─ Exit
```

---

## 4. Agent Execution Model

### 4.1 Instance Types

#### Continuous Instance
- **Trigger**: Scheduler detects pending tasks
- **Purpose**: Make progress on ongoing work
- **Behavior**: Pick ONE task, work on it, exit
- **Frequency**: Dynamic (but respects min_interval_seconds)
- **Concurrency**: Max 1 per agent (enforced by lock)

#### Reactive Instance
- **Trigger**: External event (message, schedule)
- **Purpose**: Handle incoming requests or scheduled actions
- **Behavior**: Process trigger, update state, exit
- **Frequency**: On-demand (as events arrive)
- **Concurrency**: Can run while continuous instance is running (different lock)

### 4.2 Execution Context

Each instance starts with:
```python
context = {
    "agent_id": "backend-dev-001",
    "instance_type": "continuous",  # or "reactive"
    "trigger": {
        "type": "pending_tasks",  # or "message", "schedule"
        "details": "..."
    },
    "config": load_json("agents/backend-dev-001/config.json"),
    "workspace": load_directory("agents/backend-dev-001/workspace/"),
    "tasks": load_directory("agents/backend-dev-001/tasks/active/"),
    "inbox": load_directory("agents/backend-dev-001/inbox/messages/"),
    "subordinates": load_json("agents/backend-dev-001/subordinates.json")
}
```

### 4.3 State Transitions

```
Agent Lifecycle States (config.json status field):

CREATED → initialization instance spawns
    ├─ Multi-perspective analysis
    ├─ Set up schedule
    ├─ Create initial tasks
    └─ Transition to ACTIVE

ACTIVE → normal operation
    ├─ Continuous instances run as scheduled
    ├─ Reactive instances handle events
    ├─ Can hire subordinates
    └─ Can be PAUSED by manager

PAUSED → no new instances spawn
    ├─ Scheduler skips this agent
    ├─ Messages still queued to inbox
    └─ Can be RESUMED to ACTIVE

TERMINATED → agent fired
    ├─ All subordinates TERMINATED (recursive)
    ├─ Directory moved to agents/archive/
    └─ Removed from scheduler
```

---

## 5. State Management

### 5.1 Consistency Guarantees

**Problem**: Multiple instances (continuous + reactive) might try to modify state simultaneously.

**Solution**: File-level locking + atomic writes

#### Read-Modify-Write Pattern
```python
def update_task_list(agent_id, modifier_fn):
    """
    Safely update a task list with file locking
    """
    task_file = f"agents/{agent_id}/tasks/active/continuous.md"
    lock_file = f"{task_file}.lock"

    # Acquire lock with timeout
    lock = FileLock(lock_file, timeout=30)
    with lock:
        # Read current state
        content = read_file(task_file)

        # Modify
        new_content = modifier_fn(content)

        # Atomic write (write to temp, then rename)
        temp_file = f"{task_file}.tmp"
        write_file(temp_file, new_content)
        os.rename(temp_file, task_file)  # Atomic on POSIX systems
```

### 5.2 Crash Recovery

**Scenario**: Agent instance crashes mid-execution (power loss, OOM, timeout)

**Recovery Strategy**:

1. **Partial State Detection**
   - If `.tmp` files exist on startup → incomplete write
   - Discard `.tmp` files, use last valid state
   - Log crash event in audit log

2. **Lock File Cleanup**
   - Scheduler checks if PID in lock file is actually running
   - If not → remove stale lock, allow re-spawn

3. **Task Progress Recovery**
   - Each task folder has `progress.md` with timestamps
   - If last update > 2 hours ago and status=IN_PROGRESS → likely crashed
   - Next instance detects this, marks as "RECOVERY_NEEDED"

4. **Idempotency**
   - All operations designed to be repeatable
   - Re-running a completed task should detect completion and skip

### 5.3 Orphaned State

**Problem**: Manager gets fired but subordinates remain

**Solution**: Cascade deletion in `recursive-manager fire` command

```python
def fire_agent(agent_id, fired_by):
    """
    Fire an agent and all subordinates (recursive)
    """
    # Load subordinates
    subordinates = load_json(f"agents/{agent_id}/subordinates.json")

    # Recursively fire subordinates FIRST
    for sub_id in subordinates:
        fire_agent(sub_id, agent_id)

    # Terminate running instances
    kill_instances(agent_id)

    # Archive directory
    timestamp = now().isoformat()
    shutil.move(
        f"agents/{agent_id}",
        f"agents/archive/{agent_id}-{timestamp}"
    )

    # Update parent's subordinates list
    if fired_by:
        remove_from_subordinates(fired_by, agent_id)

    # Log
    audit_log(action="fire", agent_id=agent_id, fired_by=fired_by)
```

---

## 6. Concurrency & Locking

### 6.1 Lock Hierarchy

```
Global Locks (prevent system-wide conflicts):
    org_chart.json.lock        # Hiring/firing modifies hierarchy
    process_registry.json.lock # Spawning modifies registry

Agent-Level Locks (prevent duplicate instances):
    /tmp/rm-<agent-id>-continuous.lock
    /tmp/rm-<agent-id>-reactive.lock

File-Level Locks (prevent concurrent file writes):
    agents/<agent-id>/tasks/active/continuous.md.lock
    agents/<agent-id>/config.json.lock
    agents/<agent-id>/subordinates.json.lock
```

### 6.2 Deadlock Prevention

**Rule**: Always acquire locks in the same order:
1. Global locks
2. Agent-level locks (ordered by agent_id alphabetically)
3. File-level locks (ordered by path alphabetically)

**Example**:
```python
# BAD: Can deadlock if two agents hire each other's subordinates
acquire_lock("agents/A/subordinates.json.lock")
acquire_lock("org_chart.json.lock")

# GOOD: Global lock first
acquire_lock("org_chart.json.lock")
acquire_lock("agents/A/subordinates.json.lock")
```

### 6.3 Timeout and Retry

All locks use timeouts to prevent indefinite blocking:

```python
class FileLock:
    def __init__(self, lock_file, timeout=30):
        self.lock_file = lock_file
        self.timeout = timeout

    def __enter__(self):
        start = time.time()
        while os.path.exists(self.lock_file):
            if time.time() - start > self.timeout:
                raise TimeoutError(f"Could not acquire lock: {self.lock_file}")
            time.sleep(0.1)

        # Create lock file with PID
        with open(self.lock_file, 'w') as f:
            f.write(str(os.getpid()))
        return self

    def __exit__(self, *args):
        if os.path.exists(self.lock_file):
            os.remove(self.lock_file)
```

### 6.4 Race Conditions

#### Race: Two instances try to hire same subordinate

**Scenario**:
- Agent A (continuous) decides to hire "database-admin"
- Agent A (reactive) also decides to hire "database-admin"
- Both spawn simultaneously

**Solution**: Atomic agent ID generation

```python
def generate_agent_id(role):
    """
    Generate unique agent ID atomically
    """
    with FileLock("system/agent_id_counter.lock"):
        counter = load_json("system/agent_id_counter.json")
        role_slug = slugify(role)
        count = counter.get(role_slug, 0) + 1
        counter[role_slug] = count
        save_json("system/agent_id_counter.json", counter)
        return f"{role_slug}-{count:03d}"
```

#### Race: Task marked complete by two instances

**Scenario**:
- Continuous instance completes task, starts archiving
- Reactive instance sees task incomplete, tries to work on it

**Solution**: Optimistic locking with version field

```python
# progress.md includes version number
---
version: 5
status: IN_PROGRESS
---

# When updating:
def update_progress(task_path, updates):
    with FileLock(f"{task_path}/progress.md.lock"):
        progress = parse_progress(f"{task_path}/progress.md")

        # Check version hasn't changed
        if progress['version'] != updates['expected_version']:
            raise ConflictError("Task was modified by another instance")

        # Increment version
        progress['version'] += 1
        progress.update(updates)
        write_progress(f"{task_path}/progress.md", progress)
```

---

## 7. Framework Abstraction

### 7.1 Framework Adapter Interface

```python
class FrameworkAdapter(ABC):
    """
    Abstract interface for AI framework execution
    """

    @abstractmethod
    def execute(self, agent_id: str, instance_type: str, context: dict) -> dict:
        """
        Execute an agent instance

        Args:
            agent_id: Unique agent identifier
            instance_type: "continuous" or "reactive"
            context: Execution context (config, tasks, inbox, etc.)

        Returns:
            {
                "success": bool,
                "state_updates": dict,  # Files to write
                "actions": list,        # Actions taken (hire, fire, escalate)
                "logs": str
            }
        """
        pass

    @abstractmethod
    def validate_environment(self) -> bool:
        """Check if framework is available"""
        pass

    @abstractmethod
    def get_capabilities(self) -> dict:
        """Return framework capabilities (e.g., max context length)"""
        pass
```

### 7.2 Claude Code Adapter

```python
class ClaudeCodeAdapter(FrameworkAdapter):
    """
    Primary adapter for Claude Code framework
    """

    def execute(self, agent_id: str, instance_type: str, context: dict) -> dict:
        # Construct prompt
        prompt = self._build_prompt(agent_id, instance_type, context)

        # Execute via Claude Code CLI
        result = subprocess.run(
            ["claude", "--prompt", prompt],
            capture_output=True,
            text=True,
            timeout=3600  # 1 hour max
        )

        # Parse output
        state_updates = self._parse_state_updates(result.stdout)
        actions = self._parse_actions(result.stdout)

        return {
            "success": result.returncode == 0,
            "state_updates": state_updates,
            "actions": actions,
            "logs": result.stdout
        }

    def _build_prompt(self, agent_id: str, instance_type: str, context: dict) -> str:
        """
        Construct Claude Code prompt from context
        """
        if instance_type == "continuous":
            return f"""
You are {context['config']['role']} (ID: {agent_id}).

## Your Identity
{json.dumps(context['config'], indent=2)}

## Your Long-Term Memory
{context['workspace']['notes.md']}

## Your Current Tasks
{context['tasks']['active/continuous.md']}

## Your Mission
Pick ONE task from your continuous task list and work on it.

## Process
1. Multi-perspective analysis (spawn sub-agents for different viewpoints)
2. Decide: delegate (hire) vs execute yourself vs escalate
3. Execute
4. Update state files (progress.md, continuous.md, notes.md)

## Tools Available
- recursive-manager hire --role "X" --goal "Y" --manager "{agent_id}"
- recursive-manager message <agent-id> "message"
- recursive-manager fire <agent-id>

## Quality First
Always think from multiple perspectives before acting. Cost doesn't matter, quality does.
"""
        else:  # reactive
            return f"""
You are {context['config']['role']} (ID: {agent_id}).

## Your Identity
{json.dumps(context['config'], indent=2)}

## Your Inbox
{self._format_inbox(context['inbox'])}

## Your Mission
Process all unread messages. For each:
1. Multi-perspective analysis
2. Determine urgency and action needed
3. Update task list (prioritize if urgent)
4. Respond to sender

## State Updates
- Move processed messages to inbox/processed/
- Update tasks/active/continuous.md
- Update workspace/notes.md
"""

    def _format_inbox(self, inbox: dict) -> str:
        messages = []
        for filename in sorted(inbox['messages']):
            content = inbox['messages'][filename]
            messages.append(f"### {filename}\n{content}\n")
        return "\n".join(messages)
```

### 7.3 OpenCode Adapter

```python
class OpenCodeAdapter(FrameworkAdapter):
    """
    Secondary adapter for OpenCode framework (similar API to Claude Code)
    """

    def execute(self, agent_id: str, instance_type: str, context: dict) -> dict:
        # Very similar to ClaudeCodeAdapter
        # OpenCode uses same CLI pattern: opencode --prompt "..."
        prompt = self._build_prompt(agent_id, instance_type, context)

        result = subprocess.run(
            ["opencode", "--prompt", prompt],
            capture_output=True,
            text=True,
            timeout=3600
        )

        return {
            "success": result.returncode == 0,
            "state_updates": self._parse_state_updates(result.stdout),
            "actions": self._parse_actions(result.stdout),
            "logs": result.stdout
        }
```

### 7.4 Adapter Selection

```python
def get_framework_adapter(agent_id: str) -> FrameworkAdapter:
    """
    Select framework adapter based on agent config
    """
    config = load_json(f"agents/{agent_id}/config.json")
    preferred = config.get("frameworks", ["claude-code"])[0]

    adapters = {
        "claude-code": ClaudeCodeAdapter(),
        "opencode": OpenCodeAdapter()
    }

    adapter = adapters.get(preferred)
    if adapter and adapter.validate_environment():
        return adapter

    # Fallback to first available
    for name, adapter in adapters.items():
        if adapter.validate_environment():
            logger.warning(f"Preferred framework {preferred} unavailable, using {name}")
            return adapter

    raise RuntimeError("No framework adapters available")
```

---

## 8. Inter-Agent Communication

### 8.1 Communication Patterns

#### Pattern 1: Manager → Worker (Delegation)
```
Manager creates worker:
    recursive-manager hire --role "Backend Dev" --goal "Build API" --manager "CTO"

Manager sends task:
    recursive-manager message backend-dev-001 "Prioritize OAuth over other tasks"

Worker acknowledges:
    (Reactive instance processes message, updates task list, responds via messaging module)
```

#### Pattern 2: Worker → Manager (Reporting)
```
Worker reports progress:
    Write to: agents/CTO/inbox/messages/<timestamp>-backend-dev-001.md

Manager reviews (reactive instance):
    (Reads inbox, updates notes, responds if needed)
```

#### Pattern 3: Worker → Manager (Escalation)
```
Worker blocked:
    Write to: agents/CTO/inbox/messages/<timestamp>-backend-dev-001-ESCALATION.md
    Priority: high

Manager handles:
    (Reactive instance triggered, analyzes, takes action)
```

#### Pattern 4: Peer-to-Peer (Rare)
```
Backend → Frontend collaboration:
    recursive-manager message frontend-dev-002 "API endpoint /auth ready for integration"
```

### 8.2 Message Contract

All inter-agent messages follow this structure:

```markdown
---
from: backend-dev-001
to: CTO
timestamp: 2026-01-18T15:00:00Z
priority: normal  # low, normal, high, urgent
type: report  # report, escalation, question, notification
processed: false
---

# Subject Line

Message body here.

## Context (if needed)
- Relevant background
- Links to task folders

## Action Requested (if any)
- What I need from you
```

### 8.3 Inbox Processing

Reactive instance processes inbox:

```python
def process_inbox(agent_id):
    inbox_dir = f"agents/{agent_id}/inbox/messages"
    messages = sorted(glob(f"{inbox_dir}/*.md"))

    for msg_file in messages:
        msg = parse_message(msg_file)

        if msg['processed']:
            continue

        # Multi-perspective analysis
        analysis = analyze_message(msg)

        # Take action
        if msg['type'] == 'escalation':
            handle_escalation(agent_id, msg, analysis)
        elif msg['type'] == 'report':
            handle_report(agent_id, msg, analysis)
        elif msg['type'] == 'question':
            handle_question(agent_id, msg, analysis)

        # Mark processed
        msg['processed'] = True
        move_file(msg_file, f"agents/{agent_id}/inbox/processed/")
```

---

## 9. Scheduler Design

### 9.1 Scheduler Architecture

```python
class RecursiveManagerScheduler:
    """
    Central scheduler daemon
    """

    def __init__(self):
        self.state_file = "system/scheduler_state.json"
        self.process_registry = ProcessRegistry()
        self.scan_interval = 60  # seconds

    def run(self):
        logger.info("Scheduler starting")
        while True:
            try:
                self.scan_and_spawn()
            except Exception as e:
                logger.error(f"Scan error: {e}")
            time.sleep(self.scan_interval)

    def scan_and_spawn(self):
        """
        Main scheduler loop
        """
        agents = glob("agents/*/schedule.json")

        for schedule_file in agents:
            agent_id = schedule_file.split('/')[1]
            schedule = load_json(schedule_file)
            config = load_json(f"agents/{agent_id}/config.json")

            # Skip if paused or terminated
            if config['status'] != 'active':
                continue

            # Check time-based triggers
            self.check_time_triggers(agent_id, schedule)

            # Check continuous tasks
            self.check_continuous_tasks(agent_id, schedule)

    def check_time_triggers(self, agent_id, schedule):
        """
        Check if any cron triggers are due
        """
        for trigger in schedule['time_based_triggers']:
            if not trigger['enabled']:
                continue

            if self.cron_match(trigger['cron']):
                if not self.process_registry.is_running(agent_id, 'reactive'):
                    self.spawn_instance(agent_id, 'reactive', trigger)

    def check_continuous_tasks(self, agent_id, schedule):
        """
        Smart spawning: only if pending work exists
        """
        if not schedule['continuous']['enabled']:
            return

        if self.process_registry.is_running(agent_id, 'continuous'):
            return  # Already running

        # Check if enough time passed since last run
        last_run = self.get_last_run_time(agent_id, 'continuous')
        min_interval = schedule['continuous']['min_interval_seconds']
        if time.time() - last_run < min_interval:
            return

        # Smart spawning: check if pending work exists
        if self.has_pending_tasks(agent_id):
            self.spawn_instance(agent_id, 'continuous')

    def has_pending_tasks(self, agent_id):
        """
        Check if agent has uncompleted tasks
        """
        task_file = f"agents/{agent_id}/tasks/active/continuous.md"
        if not os.path.exists(task_file):
            return False

        content = read_file(task_file)
        # Check for unchecked checkboxes: "- [ ]"
        return "- [ ]" in content

    def spawn_instance(self, agent_id, instance_type, trigger=None):
        """
        Spawn an agent instance
        """
        logger.info(f"Spawning {instance_type} instance for {agent_id}")

        # Acquire lock
        lock_file = f"/tmp/rm-{agent_id}-{instance_type}.lock"
        if os.path.exists(lock_file):
            # Check if still running
            pid = int(read_file(lock_file))
            if psutil.pid_exists(pid):
                logger.warning(f"Instance already running: {agent_id} {instance_type}")
                return
            else:
                os.remove(lock_file)  # Stale lock

        # Get framework adapter
        adapter = get_framework_adapter(agent_id)

        # Load context
        context = self.load_context(agent_id, instance_type, trigger)

        # Spawn in background
        process = multiprocessing.Process(
            target=self.execute_instance,
            args=(agent_id, instance_type, adapter, context, lock_file)
        )
        process.start()

        # Register
        self.process_registry.register(agent_id, instance_type, process.pid, lock_file)

    def execute_instance(self, agent_id, instance_type, adapter, context, lock_file):
        """
        Execute instance (runs in subprocess)
        """
        # Write PID to lock file
        with open(lock_file, 'w') as f:
            f.write(str(os.getpid()))

        try:
            # Execute via framework
            result = adapter.execute(agent_id, instance_type, context)

            # Apply state updates
            if result['success']:
                self.apply_state_updates(agent_id, result['state_updates'])
                self.handle_actions(agent_id, result['actions'])

            # Log
            log_file = f"logs/agents/{agent_id}/{datetime.now().isoformat()}.log"
            write_file(log_file, result['logs'])

        except Exception as e:
            logger.error(f"Instance execution failed: {agent_id} {instance_type}: {e}")

        finally:
            # Release lock
            if os.path.exists(lock_file):
                os.remove(lock_file)

            # Unregister
            self.process_registry.unregister(agent_id, instance_type)
```

### 9.2 Process Registry

```python
class ProcessRegistry:
    """
    Track running instances
    """

    def __init__(self):
        self.registry_file = "system/process_registry.json"
        self.lock = FileLock(f"{self.registry_file}.lock")

    def register(self, agent_id, instance_type, pid, lock_file):
        with self.lock:
            registry = load_json(self.registry_file)
            registry['running_instances'].append({
                "agent_id": agent_id,
                "instance_type": instance_type,
                "pid": pid,
                "started_at": datetime.now().isoformat(),
                "lock_file": lock_file
            })
            save_json(self.registry_file, registry)

    def unregister(self, agent_id, instance_type):
        with self.lock:
            registry = load_json(self.registry_file)
            registry['running_instances'] = [
                x for x in registry['running_instances']
                if not (x['agent_id'] == agent_id and x['instance_type'] == instance_type)
            ]
            save_json(self.registry_file, registry)

    def is_running(self, agent_id, instance_type):
        registry = load_json(self.registry_file)
        for instance in registry['running_instances']:
            if instance['agent_id'] == agent_id and instance['instance_type'] == instance_type:
                # Verify PID still running
                if psutil.pid_exists(instance['pid']):
                    return True
                else:
                    # Stale entry, clean up
                    self.unregister(agent_id, instance_type)
        return False
```

---

## 10. Messaging Integration

### 10.1 Messaging Module Interface

```python
class MessagingModule(ABC):
    """
    Abstract interface for messaging platforms
    """

    @abstractmethod
    def start_listening(self):
        """
        Start listening for messages (blocking or background thread)
        """
        pass

    @abstractmethod
    def on_message(self, raw_message) -> StandardizedMessage:
        """
        Convert platform-specific message to standardized format
        """
        pass

    @abstractmethod
    def send_message(self, recipient, message):
        """
        Send message from agent to platform
        """
        pass

    @abstractmethod
    def update_status(self, agent_id, status):
        """
        Update agent status (e.g., "Working on OAuth", "Available")
        """
        pass
```

### 10.2 Slack Module

```python
class SlackMessagingModule(MessagingModule):
    """
    Slack integration
    """

    def __init__(self, config):
        self.token = config['slack_bot_token']
        self.client = WebClient(token=self.token)
        self.socket_client = SocketModeClient(
            app_token=config['slack_app_token'],
            web_client=self.client
        )

        # Map Slack channels to agent IDs
        self.channel_mapping = config.get('channel_mapping', {})

    def start_listening(self):
        @self.socket_client.on("message")
        def handle_message(client, req):
            msg = self.on_message(req.payload)
            self.route_message(msg)

        self.socket_client.connect()

    def on_message(self, raw_message):
        """
        Convert Slack message to standardized format
        """
        return StandardizedMessage(
            message_id=raw_message['client_msg_id'],
            platform='slack',
            from_user=raw_message['user'],
            channel=raw_message['channel'],
            timestamp=raw_message['ts'],
            content=raw_message['text'],
            priority=self.detect_priority(raw_message['text'])
        )

    def detect_priority(self, text):
        """
        Detect priority from message content
        """
        urgent_keywords = ['urgent', 'asap', 'emergency', 'critical', 'down', 'broken']
        high_keywords = ['important', 'soon', 'priority']

        text_lower = text.lower()
        if any(kw in text_lower for kw in urgent_keywords):
            return 'urgent'
        elif any(kw in text_lower for kw in high_keywords):
            return 'high'
        else:
            return 'normal'

    def route_message(self, msg):
        """
        Route message to appropriate agent
        """
        # Check for direct mentions: "@backend-dev-001"
        mention_match = re.search(r'@([\w-]+)', msg.content)
        if mention_match:
            agent_id = mention_match.group(1)
            if os.path.exists(f"agents/{agent_id}"):
                self.deliver_to_agent(agent_id, msg)
                return

        # Check channel mapping
        agent_id = self.channel_mapping.get(msg.channel)
        if agent_id:
            self.deliver_to_agent(agent_id, msg)
            return

        # Fallback to CEO
        self.deliver_to_agent('CEO', msg)

    def deliver_to_agent(self, agent_id, msg):
        """
        Write message to agent's inbox and trigger reactive instance
        """
        # Write to inbox
        inbox_file = f"agents/{agent_id}/inbox/messages/{msg.timestamp}-{msg.from_user}.md"
        content = f"""---
from: {msg.from_user}
platform: slack
channel: {msg.channel}
timestamp: {msg.timestamp}
priority: {msg.priority}
processed: false
---

{msg.content}
"""
        write_file(inbox_file, content)

        # Trigger reactive instance
        scheduler = get_scheduler()
        scheduler.spawn_instance(agent_id, 'reactive', trigger={
            'type': 'message',
            'platform': 'slack',
            'message_id': msg.message_id
        })

    def send_message(self, recipient, message):
        """
        Send message from agent to Slack
        """
        # recipient could be user ID or channel ID
        self.client.chat_postMessage(
            channel=recipient,
            text=message
        )

    def update_status(self, agent_id, status):
        """
        Update agent's Slack status
        """
        # Map agent to Slack user (from config)
        user_id = self.get_slack_user_for_agent(agent_id)
        if user_id:
            self.client.users_profile_set(
                user=user_id,
                profile={"status_text": status}
            )
```

### 10.3 Telegram Module

```python
class TelegramMessagingModule(MessagingModule):
    """
    Telegram integration (similar structure to Slack)
    """

    def __init__(self, config):
        self.token = config['telegram_bot_token']
        self.bot = telegram.Bot(token=self.token)
        self.updater = Updater(token=self.token)
        self.dispatcher = self.updater.dispatcher

    def start_listening(self):
        self.dispatcher.add_handler(MessageHandler(Filters.text, self.handle_message))
        self.updater.start_polling()

    def handle_message(self, update, context):
        msg = self.on_message(update.message)
        self.route_message(msg)

    def on_message(self, raw_message):
        return StandardizedMessage(
            message_id=str(raw_message.message_id),
            platform='telegram',
            from_user=raw_message.from_user.username,
            channel=str(raw_message.chat_id),
            timestamp=raw_message.date.isoformat(),
            content=raw_message.text,
            priority=self.detect_priority(raw_message.text)
        )
```

### 10.4 Messaging Relay Daemon

```python
class MessagingRelayDaemon:
    """
    Manages all messaging modules
    """

    def __init__(self):
        self.modules = []
        self.load_modules()

    def load_modules(self):
        """
        Load enabled messaging modules from config
        """
        config = load_json("config/messaging_modules/config.json")

        if config.get('slack', {}).get('enabled'):
            self.modules.append(SlackMessagingModule(config['slack']))

        if config.get('telegram', {}).get('enabled'):
            self.modules.append(TelegramMessagingModule(config['telegram']))

        # Add more modules as needed

    def start(self):
        """
        Start all modules (each in background thread)
        """
        for module in self.modules:
            thread = threading.Thread(target=module.start_listening, daemon=True)
            thread.start()

        logger.info(f"Messaging relay started with {len(self.modules)} modules")

        # Keep alive
        while True:
            time.sleep(60)
```

---

## 11. Task Management

### 11.1 Hierarchical Task Structure

Tasks can be simple (single line) or complex (nested folder):

```
tasks/active/
├─ continuous.md              # Top-level task list
├─ simple-task-1/             # Simple task (optional folder)
│  └─ progress.md
└─ complex-task-2/            # Complex hierarchical task
   ├─ plan.md
   ├─ tasks.md                # Sub-tasks
   ├─ progress.md
   ├─ context.json
   └─ subtask-2a/             # Nested sub-task
      ├─ plan.md
      ├─ tasks.md
      └─ progress.md
```

### 11.2 Task Lifecycle

```
1. Task Created
   ├─ Added to continuous.md
   ├─ If complex → create task folder
   └─ Initial status: PENDING

2. Task Picked Up
   ├─ Agent reads continuous.md
   ├─ Picks first uncompleted task
   ├─ Multi-perspective analysis
   └─ Decision: delegate or execute

3a. Task Delegated
   ├─ Hire sub-agent
   ├─ Sub-agent gets task as main goal
   ├─ Parent updates status: DELEGATED
   └─ Parent monitors progress

3b. Task Executed
   ├─ Agent works on task
   ├─ Updates progress.md regularly
   ├─ Status: IN_PROGRESS
   └─ If blocked → escalate

4. Task Completed
   ├─ Mark as complete in continuous.md
   ├─ Move task folder to tasks/archive/
   ├─ Update workspace/notes.md (learnings)
   └─ Notify manager (if delegated)
```

### 11.3 Task Archival

When task is complete:

```python
def archive_task(agent_id, task_name):
    """
    Move completed task to archive
    """
    active_path = f"agents/{agent_id}/tasks/active/{task_name}"
    archive_path = f"agents/{agent_id}/tasks/archive/{task_name}-{now().isoformat()}"

    if os.path.exists(active_path):
        shutil.move(active_path, archive_path)
        logger.info(f"Archived task: {task_name}")

        # Update continuous.md (remove task)
        update_continuous_md(agent_id, remove_task=task_name)
```

**Benefits of archival:**
- Keeps active task list clean
- Prevents agent from re-reading completed work
- Preserves history for auditing
- Reduces file I/O overhead

### 11.4 Task Prioritization

Tasks in `continuous.md` are ordered by priority:

```markdown
# Continuous Task List

## URGENT (handle first)
- [ ] **[URGENT]** Fix production bug → tasks/active/prod-bug/

## HIGH PRIORITY
- [ ] Implement OAuth → tasks/active/oauth/
- [ ] Code review for frontend-dev-002

## NORMAL
- [ ] Refactor authentication module
- [ ] Update API documentation

## LOW (backlog)
- [ ] Research new framework
```

When reactive instance adds urgent task:

```python
def add_urgent_task(agent_id, task_description, task_folder=None):
    """
    Add task to top of continuous list
    """
    task_file = f"agents/{agent_id}/tasks/active/continuous.md"

    with FileLock(f"{task_file}.lock"):
        content = read_file(task_file)

        # Insert at top of URGENT section
        urgent_marker = "## URGENT (handle first)"
        if urgent_marker in content:
            # Insert after marker
            parts = content.split(urgent_marker)
            new_task = f"- [ ] **[URGENT]** {task_description}"
            if task_folder:
                new_task += f" → {task_folder}"
            parts[1] = f"\n{new_task}\n{parts[1]}"
            new_content = urgent_marker.join(parts)
        else:
            # Create URGENT section
            new_content = f"# Continuous Task List\n\n## URGENT (handle first)\n- [ ] **[URGENT]** {task_description}\n\n{content}"

        write_file(task_file, new_content)
```

---

## 12. Error Handling & Recovery

### 12.1 Error Categories

#### 1. Framework Execution Errors
- **Cause**: AI framework crashes, timeout, API error
- **Detection**: Exit code != 0, exception in adapter
- **Recovery**:
  - Log error in `logs/agents/<agent-id>/`
  - Do NOT update state (keep last valid state)
  - Retry on next scheduler cycle
  - After 3 failures → escalate to manager

#### 2. State Corruption
- **Cause**: Partial file write, concurrent modification
- **Detection**: JSON parse error, missing required fields
- **Recovery**:
  - Restore from `.tmp` file if atomic write failed
  - If no recovery possible → load last valid state from backup
  - Log corruption event in audit log

#### 3. Lock Timeouts
- **Cause**: Long-running instance holds lock, deadlock
- **Detection**: FileLock timeout exception
- **Recovery**:
  - Check if lock holder PID is still running
  - If not → remove stale lock, retry
  - If yes → wait and retry (exponential backoff)
  - After 5 retries → alert and manual intervention

#### 4. Runaway Recursion
- **Cause**: Agent keeps hiring sub-agents infinitely
- **Detection**: Depth > max_depth, subordinate count > threshold
- **Recovery**:
  - Prevent hiring if depth >= 10
  - Alert manager when depth > 5
  - Force termination if subordinates > 100

#### 5. Orphaned Agents
- **Cause**: Manager fired but subordinates remain
- **Detection**: Agent's `reporting_to` points to non-existent agent
- **Recovery**:
  - Cascade delete on fire (handled in fire command)
  - Periodic orphan scan by scheduler
  - Re-assign to grandparent if manager missing

### 12.2 Error Recovery Strategies

#### Retry with Backoff
```python
def execute_with_retry(fn, max_retries=3, backoff_factor=2):
    """
    Retry function with exponential backoff
    """
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait_time = backoff_factor ** attempt
            logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying in {wait_time}s")
            time.sleep(wait_time)
```

#### State Validation
```python
def validate_state(agent_id):
    """
    Validate agent state files for corruption
    """
    errors = []

    # Validate config.json
    try:
        config = load_json(f"agents/{agent_id}/config.json")
        required_fields = ['agent_id', 'role', 'main_goal', 'status']
        for field in required_fields:
            if field not in config:
                errors.append(f"config.json missing field: {field}")
    except json.JSONDecodeError:
        errors.append("config.json is corrupted")

    # Validate schedule.json
    try:
        schedule = load_json(f"agents/{agent_id}/schedule.json")
        if 'continuous' not in schedule:
            errors.append("schedule.json missing 'continuous' field")
    except json.JSONDecodeError:
        errors.append("schedule.json is corrupted")

    # Validate task files
    task_file = f"agents/{agent_id}/tasks/active/continuous.md"
    if os.path.exists(task_file):
        content = read_file(task_file)
        if not content.strip():
            errors.append("continuous.md is empty")

    return errors
```

#### Crash Recovery
```python
def recover_from_crash(agent_id):
    """
    Recover agent state after crash
    """
    logger.info(f"Recovering agent {agent_id} from crash")

    # Check for temp files (incomplete writes)
    temp_files = glob(f"agents/{agent_id}/**/*.tmp", recursive=True)
    for temp_file in temp_files:
        logger.warning(f"Removing incomplete write: {temp_file}")
        os.remove(temp_file)

    # Validate state
    errors = validate_state(agent_id)
    if errors:
        logger.error(f"State validation failed: {errors}")
        # Restore from backup (if implemented)
        restore_from_backup(agent_id)

    # Check for tasks in progress
    task_dirs = glob(f"agents/{agent_id}/tasks/active/*/")
    for task_dir in task_dirs:
        progress_file = f"{task_dir}/progress.md"
        if os.path.exists(progress_file):
            progress = parse_progress(progress_file)
            if progress['status'] == 'IN_PROGRESS':
                last_update = datetime.fromisoformat(progress['last_updated'])
                if datetime.now() - last_update > timedelta(hours=2):
                    logger.warning(f"Task likely crashed: {task_dir}")
                    # Mark for recovery
                    progress['status'] = 'RECOVERY_NEEDED'
                    progress['notes'] = 'Instance crashed, needs review'
                    write_progress(progress_file, progress)
```

### 12.3 Logging and Auditing

All actions logged to audit log:

```python
def audit_log(action, agent_id, **kwargs):
    """
    Append to audit log
    """
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "action": action,  # hire, fire, escalate, message, task_complete, etc.
        "agent_id": agent_id,
        **kwargs
    }

    with FileLock("system/audit_log.jsonl.lock"):
        with open("system/audit_log.jsonl", 'a') as f:
            f.write(json.dumps(log_entry) + "\n")
```

Example audit events:
- Agent hired
- Agent fired
- Task started
- Task completed
- Task delegated
- Escalation occurred
- Error encountered
- Instance spawned
- Instance completed

---

## 13. Edge Cases

### 13.1 Circular Dependencies

**Problem**: Agent A hires Agent B, who hires Agent A

**Detection**:
```python
def detect_circular_dependency(agent_id, new_hire_id):
    """
    Check if hiring would create circular dependency
    """
    visited = set()

    def has_ancestor(current_id, target_id):
        if current_id == target_id:
            return True
        if current_id in visited:
            return False
        visited.add(current_id)

        config = load_json(f"agents/{current_id}/config.json")
        manager = config.get('reporting_to')
        if manager:
            return has_ancestor(manager, target_id)
        return False

    # Check if new hire is an ancestor of agent
    return has_ancestor(agent_id, new_hire_id)
```

**Prevention**:
```python
def hire_agent(manager_id, role, goal):
    # Generate new agent ID
    new_agent_id = generate_agent_id(role)

    # Check circular dependency (should never happen with new IDs, but safety check)
    if detect_circular_dependency(manager_id, new_agent_id):
        raise ValueError(f"Cannot hire {new_agent_id}: would create circular dependency")

    # Proceed with hiring
    ...
```

### 13.2 Duplicate Instance Prevention

**Problem**: Scheduler spawns instance, but previous instance hasn't released lock

**Solution**: Check PID in lock file

```python
def acquire_instance_lock(agent_id, instance_type):
    """
    Acquire lock, handling stale locks
    """
    lock_file = f"/tmp/rm-{agent_id}-{instance_type}.lock"

    if os.path.exists(lock_file):
        pid = int(read_file(lock_file))
        if psutil.pid_exists(pid):
            # Still running
            raise LockError(f"Instance already running (PID {pid})")
        else:
            # Stale lock
            logger.warning(f"Removing stale lock: {lock_file}")
            os.remove(lock_file)

    # Create lock
    with open(lock_file, 'w') as f:
        f.write(str(os.getpid()))

    # Register cleanup
    atexit.register(lambda: os.remove(lock_file) if os.path.exists(lock_file) else None)
```

### 13.3 Task Stuck in IN_PROGRESS

**Problem**: Agent crashes mid-task, task forever marked IN_PROGRESS

**Detection**: Scheduler periodic scan

```python
def detect_stuck_tasks():
    """
    Find tasks stuck in progress
    """
    agents = glob("agents/*/tasks/active/*/progress.md")
    stuck_tasks = []

    for progress_file in agents:
        progress = parse_progress(progress_file)
        if progress['status'] == 'IN_PROGRESS':
            last_update = datetime.fromisoformat(progress['last_updated'])
            if datetime.now() - last_update > timedelta(hours=2):
                stuck_tasks.append(progress_file)

    return stuck_tasks
```

**Recovery**: Mark as RECOVERY_NEEDED, notify manager

### 13.4 Manager Fired Before Subordinates Notified

**Problem**: Manager deleted, subordinates have invalid `reporting_to`

**Solution**: Cascade delete is atomic

```python
def fire_agent_atomic(agent_id):
    """
    Fire agent and subordinates atomically
    """
    with FileLock("system/org_chart.json.lock"):
        # Load subordinates
        subordinates = load_json(f"agents/{agent_id}/subordinates.json")

        # Fire subordinates recursively (while holding global lock)
        for sub_id in subordinates:
            fire_agent_atomic(sub_id)

        # Kill running instances
        kill_instances(agent_id)

        # Archive directory
        timestamp = now().isoformat()
        shutil.move(
            f"agents/{agent_id}",
            f"agents/archive/{agent_id}-{timestamp}"
        )

        # Update org chart
        update_org_chart(remove=agent_id)
```

### 13.5 Inbox Message Flood

**Problem**: 1000 Slack messages arrive in 1 minute

**Solution**: Rate limiting + batching

```python
def process_inbox_batched(agent_id, batch_size=10):
    """
    Process inbox in batches to prevent overload
    """
    messages = sorted(glob(f"agents/{agent_id}/inbox/messages/*.md"))

    # Take first batch
    batch = messages[:batch_size]

    for msg_file in batch:
        msg = parse_message(msg_file)
        if not msg['processed']:
            handle_message(agent_id, msg)
            msg['processed'] = True
            move_to_processed(msg_file)

    # If more remain, schedule another reactive instance
    if len(messages) > batch_size:
        schedule_reactive_instance(agent_id, delay=60)  # Wait 1 min before next batch
```

### 13.6 Agent Hires Too Many Subordinates

**Problem**: Agent creates 1000 sub-agents, exhausting resources

**Solution**: Enforce limits

```python
MAX_SUBORDINATES_PER_AGENT = 20
MAX_DEPTH = 10

def hire_agent(manager_id, role, goal):
    # Check subordinate limit
    subordinates = load_json(f"agents/{manager_id}/subordinates.json")
    if len(subordinates) >= MAX_SUBORDINATES_PER_AGENT:
        raise LimitExceededError(f"Agent {manager_id} has max subordinates ({MAX_SUBORDINATES_PER_AGENT})")

    # Check depth limit
    depth = get_agent_depth(manager_id)
    if depth >= MAX_DEPTH:
        raise LimitExceededError(f"Max hierarchy depth ({MAX_DEPTH}) reached")

    # Proceed with hiring
    ...
```

### 13.7 Two Agents Try to Hire Same Role Simultaneously

**Problem**: CTO and CFO both try to hire "database-admin" at same time

**Solution**: Unique IDs prevent conflict (each gets separate agent)

```python
# CTO hires: database-admin-001
# CFO hires: database-admin-002
# No conflict, they're different agents
```

If they want to SHARE an agent, explicit coordination needed:

```python
# CTO creates shared agent
cto_hires_shared("database-admin-shared", ...)

# CFO references existing agent
cfo_uses_existing("database-admin-shared")
```

---

## 14. Security Considerations

### 14.1 Access Control

**File System Permissions:**
- Agent directories: Only scheduler daemon and agent instances can write
- System files: Only scheduler and admin can write
- Logs: Read-only for agents, write-only for system

**Process Isolation:**
- Each agent instance runs as separate process
- No shared memory between instances
- File locks prevent race conditions

### 14.2 Input Validation

**Message Content:**
- Sanitize all incoming messages (prevent injection attacks)
- Validate message structure before processing
- Rate limit to prevent spam

**Agent Configuration:**
- Validate all JSON schemas on load
- Reject invalid configurations
- Sanitize file paths (prevent directory traversal)

### 14.3 Resource Limits

**Per-Instance Limits:**
- Execution timeout: 1 hour max
- Memory limit: 4GB (enforced by framework)
- Disk I/O limit: 100MB/s

**Global Limits:**
- Max agents: 1000
- Max depth: 10
- Max subordinates per agent: 20
- Max concurrent instances: 50

### 14.4 Audit and Compliance

**Audit Log:**
- All actions logged with timestamp and actor
- Immutable append-only log
- Periodic backups

**Data Retention:**
- Active agents: indefinite
- Archived agents: 90 days
- Logs: 30 days
- Audit log: 1 year

### 14.5 Secrets Management

**API Keys and Tokens:**
- Store in separate `config/secrets.json` (NOT in agent directories)
- Encrypt at rest
- Never log or expose in error messages
- Rotate regularly

**Framework API Keys:**
- Claude Code API key in system config
- OpenCode API key in system config
- Messaging platform tokens in messaging module config

---

## 15. Implementation Phases

### Phase 1: Core Foundation (MVP)

**Goal**: Basic agent execution and task management

**Features**:
- File structure implementation
- Agent config and state management
- CLI commands: `init`, `hire`, `fire`, `run`, `status`
- Single framework support (Claude Code only)
- Manual triggering (no scheduler yet)
- Basic task management (continuous.md)
- File locking and atomic writes

**Deliverables**:
- `recursive-manager` CLI tool
- Core file structure
- Claude Code adapter
- Manual agent execution
- Basic error handling

**Timeline**: 2 weeks

**Success Criteria**:
- Can manually hire/fire agents
- Can manually run continuous instance
- Agent picks task, executes, updates state
- No state corruption with manual runs

---

### Phase 2: Automation and Scheduling

**Goal**: Autonomous agent execution

**Features**:
- Central scheduler daemon
- Time-based triggers (cron)
- Continuous task spawning (smart spawning)
- Process registry and duplicate prevention
- Lock management and cleanup
- Crash recovery
- Audit logging

**Deliverables**:
- Scheduler daemon (systemd service)
- Process registry
- Lock management system
- Audit log
- Orphan detection and cleanup

**Timeline**: 2 weeks

**Success Criteria**:
- Scheduler runs autonomously
- Agents execute on schedule
- No duplicate instances
- Crash recovery works
- Audit log captures all actions

---

### Phase 3: Communication and Hierarchy

**Goal**: Inter-agent communication and delegation

**Features**:
- Reactive instances (message handling)
- Inbox processing
- Manager-worker communication
- Escalation mechanism
- Hierarchical task management (nested folders)
- Task archival
- Multi-perspective analysis (spawn sub-agents for analysis)

**Deliverables**:
- Reactive instance execution
- Inbox system
- Task folder structure
- Archival system
- Multi-perspective framework

**Timeline**: 2 weeks

**Success Criteria**:
- Agents can message each other
- Workers report to managers
- Escalation works
- Tasks archive when complete
- Multi-perspective analysis before decisions

---

### Phase 4: External Integrations

**Goal**: Connect to external messaging platforms

**Features**:
- Messaging relay daemon
- Slack integration module
- Telegram integration module
- Standardized message contract
- Platform-specific adapters
- Message routing and prioritization

**Deliverables**:
- Messaging relay daemon
- Slack module
- Telegram module
- Message router
- Platform adapter interface

**Timeline**: 2 weeks

**Success Criteria**:
- Slack messages route to agents
- Agents respond on Slack
- Telegram messages route to agents
- Agents respond on Telegram
- Message prioritization works

---

### Phase 5: Multi-Framework Support

**Goal**: Support multiple AI frameworks

**Features**:
- OpenCode adapter
- Framework abstraction refinement
- Framework selection logic
- Fallback mechanism
- Framework-specific optimization

**Deliverables**:
- OpenCode adapter
- Refined framework interface
- Framework selector
- Documentation for adding new frameworks

**Timeline**: 1 week

**Success Criteria**:
- Agents can execute via OpenCode
- Framework fallback works
- Can specify preferred framework per agent

---

### Phase 6: Polish and Optimization

**Goal**: Production-ready system

**Features**:
- Performance optimization
- Comprehensive error handling
- Edge case coverage
- Monitoring and observability
- Documentation
- Testing suite

**Deliverables**:
- Optimized scheduler (reduce CPU usage)
- Comprehensive error handling
- Edge case fixes
- Monitoring dashboard (optional)
- Full documentation
- Test suite (unit + integration)

**Timeline**: 2 weeks

**Success Criteria**:
- All edge cases handled
- Performance acceptable (< 5% CPU idle)
- Documentation complete
- Test coverage > 80%

---

## Total Timeline: 11 weeks (~3 months)

---

## Appendix A: CLI Reference

### recursive-manager init

Initialize a new RecursiveManager system.

```bash
recursive-manager init --root-agent "CEO" --goal "Build SaaS product"
```

Creates:
- `agents/CEO/` directory structure
- System directories (`system/`, `config/`, `logs/`)
- Spawns CEO initialization instance

---

### recursive-manager hire

Hire a new agent.

```bash
recursive-manager hire \
  --role "Backend Developer" \
  --goal "Build REST API for authentication" \
  --manager "CTO" \
  --cadence "continuous"
```

Creates:
- New agent directory with unique ID
- Spawns initialization instance
- Updates manager's subordinates list
- Registers in scheduler

---

### recursive-manager fire

Fire an agent (and all subordinates).

```bash
recursive-manager fire backend-dev-001
```

Effects:
- Recursively fires all subordinates
- Kills running instances
- Archives agent directory
- Updates org chart

---

### recursive-manager run

Manually run an agent instance (for debugging).

```bash
recursive-manager run backend-dev-001 --type continuous
recursive-manager run CEO --type reactive --trigger schedule
```

---

### recursive-manager message

Send message to agent.

```bash
recursive-manager message backend-dev-001 "Prioritize OAuth implementation"
```

Effects:
- Writes to agent's inbox
- Spawns reactive instance immediately

---

### recursive-manager status

Show system status.

```bash
recursive-manager status
recursive-manager status backend-dev-001  # Specific agent
```

Output:
- Running instances
- Agent hierarchy
- Task status
- Recent activity

---

### recursive-manager scheduler

Control scheduler daemon.

```bash
recursive-manager scheduler start
recursive-manager scheduler stop
recursive-manager scheduler restart
recursive-manager scheduler status
```

---

## Appendix B: Configuration Examples

### config/system_config.json

```json
{
  "max_agents": 1000,
  "max_depth": 10,
  "max_subordinates_per_agent": 20,
  "max_concurrent_instances": 50,
  "scheduler": {
    "scan_interval_seconds": 60,
    "cleanup_interval_seconds": 300,
    "stuck_task_threshold_hours": 2
  },
  "execution": {
    "default_timeout_seconds": 3600,
    "default_memory_limit_mb": 4096
  },
  "logging": {
    "level": "INFO",
    "retention_days": 30
  }
}
```

### config/framework_adapters/claude-code.json

```json
{
  "enabled": true,
  "executable": "claude",
  "api_key_env": "ANTHROPIC_API_KEY",
  "model": "claude-sonnet-4-5",
  "max_context_length": 200000,
  "timeout_seconds": 3600
}
```

### config/messaging_modules/slack.json

```json
{
  "enabled": true,
  "bot_token_env": "SLACK_BOT_TOKEN",
  "app_token_env": "SLACK_APP_TOKEN",
  "channel_mapping": {
    "C12345": "CTO",
    "C67890": "CEO"
  },
  "default_agent": "CEO"
}
```

---

## Appendix C: Example Scenarios

### Scenario 1: CEO Hires and Delegates

```
1. User initializes system:
   recursive-manager init --root-agent CEO --goal "Build SaaS product"

2. CEO initialization instance runs:
   - Multi-perspective analysis
   - Creates plan: need CTO, CMO, CFO
   - Sets schedule: daily standup at 9am

3. CEO continuous instance runs:
   - Picks task: "Hire CTO"
   - Executes: recursive-manager hire --role CTO --goal "Build application" --manager CEO
   - Updates continuous.md

4. CTO initialization instance runs:
   - Multi-perspective analysis
   - Creates plan: need backend and frontend devs
   - Sets schedule: continuous

5. CTO continuous instance runs:
   - Picks task: "Hire Backend Developer"
   - Executes: recursive-manager hire --role "Backend Developer" --goal "Build API" --manager CTO

... and so on
```

### Scenario 2: Customer Reports Bug via Slack

```
1. Customer posts in #support:
   "Login is broken! Can't access my account"

2. Slack module receives message:
   - Routes to CEO (default)
   - Writes to agents/CEO/inbox/messages/
   - Spawns CEO reactive instance

3. CEO reactive instance:
   - Reads message
   - Multi-perspective analysis: URGENT
   - Adds to continuous list (top priority)
   - Messages CTO: "Customer login broken, investigate ASAP"

4. CTO reactive instance:
   - Reads CEO's message
   - Analyzes: need backend dev to fix
   - Messages backend-dev-001: "Fix login bug urgently"

5. Backend-dev continuous instance:
   - Picks urgent task
   - Investigates
   - Finds bug, fixes it
   - Reports to CTO: "Bug fixed, deployed"

6. CTO reactive instance:
   - Reads backend dev's report
   - Verifies fix
   - Reports to CEO: "Login bug resolved"

7. CEO reactive instance:
   - Reads CTO's report
   - Responds to customer on Slack: "Bug fixed! Please try again"
```

### Scenario 3: Agent Gets Stuck and Escalates

```
1. Backend-dev continuous instance:
   - Picks task: "Implement OAuth"
   - Multi-perspective analysis: non-trivial
   - Hires oauth-specialist-042

2. oauth-specialist-042 continuous instance:
   - Works on OAuth implementation
   - Encounters blocker: need Google OAuth credentials
   - Escalates to backend-dev-001

3. Backend-dev reactive instance:
   - Reads escalation
   - Analyzes: can't solve, need CTO
   - Escalates to CTO

4. CTO reactive instance:
   - Reads escalation
   - Provides Google OAuth credentials
   - Messages oauth-specialist-042: "Here are the creds"

5. oauth-specialist-042 reactive instance:
   - Reads message
   - Resumes work on OAuth
   - Completes implementation
   - Reports to backend-dev-001: "OAuth implemented"

6. Backend-dev reactive instance:
   - Reads report
   - Reviews code
   - Marks task complete
   - Archives task folder
```

---

## Conclusion

This architectural blueprint provides a comprehensive design for the RecursiveManager system. All components, data flows, error handling strategies, and edge cases have been documented. The modular design ensures extensibility, while the file-based persistence and fresh state approach ensure reliability and consistency.

**Key Architectural Decisions:**
1. File-based state (no databases)
2. Fresh memory on every run (stateless instances)
3. Dual instance types (continuous + reactive)
4. Smart spawning (only when work exists)
5. Hierarchical tasks with archival
6. Multi-perspective analysis (quality over cost)
7. Modular framework adapters
8. Standardized messaging contracts
9. Global lock hierarchy (prevent deadlocks)
10. Cascade operations (fire, archive)

**Next Steps:**
1. Implement Phase 1 (Core Foundation)
2. Test with simple scenarios
3. Iterate based on real usage
4. Expand to Phase 2+ incrementally

This architecture is designed to handle complex, real-world scenarios while maintaining simplicity and reliability.
