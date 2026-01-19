# File Structure & Schema Specifications

## Overview

RecursiveManager uses a hybrid approach:
- **File-based storage** for agent workspaces, notes, and human-readable state
- **Database (SQLite)** for metadata, task indexes, and fast queries

This gives us the best of both worlds: easy debugging and efficient querying.

---

## Directory Structure

### System Root

```
~/.recursive-manager/                 # System root (configurable)
├── agents/                            # All agent directories
│   ├── 00-0f/                        # Sharding (first hex digit of agent ID)
│   │   ├── CEO/                      # Agent directory
│   │   ├── backend-dev-001/
│   │   └── ...
│   ├── 10-1f/
│   └── ...
│
├── system/                            # System-level files
│   ├── scheduler.db                  # SQLite database for scheduler
│   ├── audit.log                     # System-wide audit log
│   ├── config.json                   # Global configuration
│   └── org-chart.json                # Full organizational hierarchy
│
├── messaging/                         # Message queue and integrations
│   ├── internal/                     # Internal message queue
│   ├── slack/                        # Slack integration state
│   ├── telegram/                     # Telegram integration state
│   └── email/                        # Email integration state
│
├── logs/                              # Execution logs
│   ├── agents/                       # Per-agent logs
│   │   ├── CEO.log
│   │   ├── backend-dev-001.log
│   │   └── ...
│   ├── scheduler.log                 # Scheduler daemon log
│   └── system.log                    # System-wide log
│
└── templates/                         # Agent templates
    ├── roles/                        # Predefined roles
    │   ├── ceo.json
    │   ├── cto.json
    │   ├── backend-developer.json
    │   └── ...
    └── workflows/                    # Workflow templates
        ├── web-app-development.json
        └── ...
```

### Agent Directory Structure

```
agents/{shard}/{agent-id}/
├── README.md                          # Auto-generated agent overview
│
├── config.json                        # Agent configuration
├── schedule.json                      # Time-based triggers
├── metadata.json                      # Runtime metadata (last run, stats, etc.)
│
├── tasks/                             # Task management
│   ├── active/                       # Currently active tasks
│   │   ├── task-001-build-api/       # Task folder (hierarchical)
│   │   │   ├── plan.md              # Task plan
│   │   │   ├── progress.md          # Current progress (like Ralph)
│   │   │   ├── subtasks.md          # Subtasks checklist
│   │   │   └── context.json         # Task metadata
│   │   └── ...
│   │
│   ├── completed/                    # Recently completed (last 7 days)
│   │   └── ...
│   │
│   └── archive/                      # Archived tasks (older than 7 days)
│       └── 2026-01/                  # Organized by month
│           └── ...
│
├── inbox/                             # Incoming messages
│   ├── unread/                       # Unread messages
│   │   ├── msg-001.md
│   │   └── ...
│   └── read/                         # Read messages
│       └── ...
│
├── outbox/                            # Outgoing messages (to manager/subordinates)
│   ├── pending/
│   └── sent/
│
├── subordinates/                      # Subordinate tracking
│   ├── registry.json                 # List of subordinates
│   └── reports/                      # Status reports from subordinates
│       ├── backend-dev-001-latest.md
│       └── ...
│
└── workspace/                         # Agent's scratch space
    ├── notes/                        # Persistent notes
    │   ├── long-term-memory.md      # Agent's memory across sessions
    │   ├── lessons-learned.md       # What worked/didn't work
    │   └── ...
    │
    ├── research/                     # Research materials
    │   └── ...
    │
    ├── drafts/                       # Work in progress
    │   └── ...
    │
    └── cache/                        # Temporary files (auto-cleaned)
        └── ...
```

---

## Schema Definitions

### 1. config.json

**Purpose**: Defines agent's identity, role, and capabilities

```json
{
  "$schema": "https://recursivemanager.dev/schemas/agent-config.schema.json",
  "version": "1.0.0",

  "identity": {
    "id": "backend-dev-001",
    "role": "Backend Developer",
    "displayName": "Backend Dev #1",
    "createdAt": "2026-01-18T10:00:00Z",
    "createdBy": "CTO",
    "reportingTo": "CTO"
  },

  "goal": {
    "mainGoal": "Build REST API for user management system",
    "subGoals": [
      "Design API endpoints",
      "Implement authentication",
      "Create database schema",
      "Write API documentation"
    ],
    "successCriteria": [
      "All endpoints functional",
      "100% test coverage",
      "API docs published"
    ]
  },

  "permissions": {
    "canHire": true,
    "maxSubordinates": 5,
    "hiringBudget": 3,
    "canFire": true,
    "canEscalate": true,
    "canAccessExternalAPIs": true,
    "allowedDomains": ["github.com", "api.anthropic.com"],
    "workspaceQuotaMB": 5120,
    "maxExecutionMinutes": 60
  },

  "framework": {
    "primary": "claude-code",
    "fallback": "opencode",
    "capabilities": ["code-generation", "file-operations", "bash-execution"]
  },

  "communication": {
    "preferredChannels": ["internal", "slack"],
    "slackChannel": "#backend-team",
    "notifyManager": {
      "onTaskComplete": true,
      "onError": true,
      "onHire": true,
      "onFire": true
    },
    "updateFrequency": "daily"
  },

  "behavior": {
    "multiPerspectiveAnalysis": {
      "enabled": true,
      "perspectives": ["security", "performance", "maintainability", "cost"],
      "triggerOn": ["hire", "fire", "major-decision", "task-planning"]
    },
    "escalationPolicy": {
      "autoEscalateAfterFailures": 3,
      "escalateOnBlockedTask": true,
      "escalateOnBudgetExceeded": true
    },
    "delegation": {
      "delegateThreshold": "non-trivial",
      "keepWhenDelegating": true,
      "supervisionLevel": "moderate"
    }
  },

  "metadata": {
    "tags": ["backend", "api", "nodejs"],
    "priority": "high",
    "estimatedCompletionDays": 14,
    "actualStartDate": "2026-01-18"
  }
}
```

### 2. schedule.json

**Purpose**: Defines when agent should be triggered

```json
{
  "$schema": "https://recursivemanager.dev/schemas/schedule.schema.json",
  "version": "1.0.0",

  "mode": "hybrid",

  "continuous": {
    "enabled": true,
    "conditions": {
      "onlyWhenTasksPending": true,
      "minimumInterval": "5m",
      "pauseBetweenRuns": "1m"
    }
  },

  "timeBased": {
    "enabled": true,
    "triggers": [
      {
        "id": "daily-standup",
        "description": "Daily status update to manager",
        "schedule": "0 9 * * *",
        "action": "send-status-report",
        "timezone": "America/Los_Angeles"
      },
      {
        "id": "weekly-review",
        "description": "Review progress and plan next week",
        "schedule": "0 17 * * 5",
        "action": "weekly-planning",
        "timezone": "America/Los_Angeles"
      }
    ]
  },

  "reactive": {
    "enabled": true,
    "triggers": [
      {
        "source": "slack",
        "channel": "#backend-team",
        "mentions": true,
        "directMessages": true,
        "debounce": "30s"
      },
      {
        "source": "internal",
        "fromAgents": ["CTO", "CEO"],
        "priority": "immediate"
      }
    ]
  },

  "pauseConditions": {
    "ifManagerPaused": true,
    "ifOutOfBudget": true,
    "ifSystemMaintenance": true,
    "manualPause": false
  }
}
```

### 3. Task Schema (task-*/context.json)

**Purpose**: Metadata for hierarchical tasks

```json
{
  "$schema": "https://recursivemanager.dev/schemas/task.schema.json",
  "version": "1.0.0",

  "task": {
    "id": "task-001-build-api",
    "title": "Build REST API",
    "description": "Implement user management REST API with authentication",
    "status": "in-progress",
    "priority": "high",
    "createdAt": "2026-01-18T10:00:00Z",
    "startedAt": "2026-01-18T10:05:00Z",
    "estimatedCompletionAt": "2026-02-01T17:00:00Z"
  },

  "hierarchy": {
    "parentTask": null,
    "childTasks": [
      "task-002-design-endpoints",
      "task-003-implement-auth"
    ],
    "depth": 0,
    "maxDepth": 5
  },

  "delegation": {
    "delegatedTo": null,
    "delegatedAt": null,
    "supervisionLevel": "moderate",
    "reportingFrequency": "daily"
  },

  "progress": {
    "percentComplete": 45,
    "subtasksCompleted": 3,
    "subtasksTotal": 7,
    "lastUpdate": "2026-01-18T14:30:00Z",
    "blockedBy": [],
    "blockedSince": null
  },

  "context": {
    "relatedFiles": [
      "/workspace/research/api-design.md",
      "/workspace/drafts/endpoints-spec.md"
    ],
    "externalDependencies": [
      "Database schema approval from DBA"
    ],
    "notes": "Using Express.js framework. Need to coordinate with frontend team on response formats."
  },

  "execution": {
    "lastExecutionId": "exec-abc123",
    "executionCount": 12,
    "totalTimeSpentMinutes": 145,
    "failureCount": 2,
    "lastFailureReason": null
  }
}
```

### 4. Message Schema (inbox/msg-*.md)

**Purpose**: Standardized message format

```markdown
---
id: msg-001
from: CTO
to: backend-dev-001
timestamp: 2026-01-18T14:00:00Z
priority: high
channel: internal
read: false
actionRequired: true
---

# Request: Add OAuth Support

Hey Backend Dev,

We need to add OAuth 2.0 support to the authentication system. Customer requirements changed.

**Priority**: High
**Deadline**: End of week

**Details**:
- Support Google and GitHub OAuth providers
- Use passport.js library
- Update API documentation

**Context**:
Customer demo on Friday depends on this. Please prioritize.

Let me know if you need any help or have questions.

---
**Action Items for You**:
- [ ] Research passport.js OAuth strategies
- [ ] Implement Google OAuth
- [ ] Implement GitHub OAuth
- [ ] Update tests
- [ ] Update docs

**Reply to this message when you have an estimate.**
```

### 5. metadata.json

**Purpose**: Runtime metadata and statistics

```json
{
  "$schema": "https://recursivemanager.dev/schemas/metadata.schema.json",
  "version": "1.0.0",

  "runtime": {
    "status": "active",
    "lastExecutionAt": "2026-01-18T14:30:00Z",
    "lastExecutionDuration": 125,
    "lastExecutionType": "continuous",
    "lastExecutionResult": "success",
    "nextScheduledExecution": null
  },

  "statistics": {
    "totalExecutions": 47,
    "successfulExecutions": 43,
    "failedExecutions": 4,
    "totalRuntimeMinutes": 892,
    "averageExecutionMinutes": 19,
    "tasksCompleted": 12,
    "tasksActive": 3,
    "messagesSent": 15,
    "messagesReceived": 23,
    "subordinatesHired": 2,
    "subordinatesFired": 0
  },

  "health": {
    "overallHealth": "healthy",
    "lastHealthCheck": "2026-01-18T14:30:00Z",
    "issues": [],
    "warnings": [
      "Workspace usage at 75% of quota"
    ]
  },

  "budget": {
    "hiringBudget": {
      "initial": 3,
      "remaining": 1,
      "used": 2
    },
    "executionBudget": {
      "maxExecutionsPerDay": 100,
      "usedToday": 47,
      "remainingToday": 53
    },
    "resourceUsage": {
      "workspaceMB": 3840,
      "quotaMB": 5120,
      "percentUsed": 75
    }
  }
}
```

### 6. subordinates/registry.json

**Purpose**: Track subordinate agents

```json
{
  "$schema": "https://recursivemanager.dev/schemas/subordinates.schema.json",
  "version": "1.0.0",

  "subordinates": [
    {
      "agentId": "database-admin-001",
      "role": "Database Administrator",
      "hiredAt": "2026-01-19T09:00:00Z",
      "hiredFor": "Manage database schema and migrations",
      "status": "active",
      "lastReportAt": "2026-01-20T09:00:00Z",
      "healthStatus": "healthy",
      "tasksAssigned": 5,
      "tasksCompleted": 3
    },
    {
      "agentId": "api-tester-001",
      "role": "API Tester",
      "hiredAt": "2026-01-19T14:00:00Z",
      "hiredFor": "Write and run API integration tests",
      "status": "active",
      "lastReportAt": "2026-01-20T09:15:00Z",
      "healthStatus": "healthy",
      "tasksAssigned": 8,
      "tasksCompleted": 6
    }
  ],

  "summary": {
    "totalSubordinates": 2,
    "activeSubordinates": 2,
    "pausedSubordinates": 0,
    "firedSubordinates": 0,
    "hiringBudgetRemaining": 1
  }
}
```

---

## Database Schema (SQLite)

### Purpose

While files are great for workspace and human-readable state, we need a database for:
- Fast queries (e.g., "find all blocked tasks")
- Relationships (e.g., "find all subordinates of CTO")
- Atomic operations
- Concurrent access

### Tables

#### agents

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_by TEXT,
  reporting_to TEXT REFERENCES agents(id),
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, fired
  main_goal TEXT NOT NULL,
  config_path TEXT NOT NULL,

  -- Metadata
  last_execution_at TIMESTAMP,
  total_executions INTEGER DEFAULT 0,
  total_runtime_minutes INTEGER DEFAULT 0,

  -- Indexes
  INDEX idx_status (status),
  INDEX idx_reporting_to (reporting_to),
  INDEX idx_created_at (created_at)
);
```

#### tasks

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in-progress, blocked, completed, archived
  priority TEXT NOT NULL DEFAULT 'medium', -- low, medium, high, urgent
  created_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,

  -- Hierarchy
  parent_task_id TEXT REFERENCES tasks(id),
  depth INTEGER NOT NULL DEFAULT 0,

  -- Progress
  percent_complete INTEGER DEFAULT 0,
  subtasks_completed INTEGER DEFAULT 0,
  subtasks_total INTEGER DEFAULT 0,

  -- Delegation
  delegated_to TEXT REFERENCES agents(id),
  delegated_at TIMESTAMP,

  -- Blocking
  blocked_by TEXT, -- JSON array of task IDs
  blocked_since TIMESTAMP,

  -- Paths
  task_path TEXT NOT NULL, -- Filesystem path

  INDEX idx_agent_status (agent_id, status),
  INDEX idx_status (status),
  INDEX idx_parent (parent_task_id),
  INDEX idx_delegated (delegated_to)
);
```

#### messages

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  from_agent_id TEXT REFERENCES agents(id),
  to_agent_id TEXT NOT NULL REFERENCES agents(id),
  timestamp TIMESTAMP NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal', -- low, normal, high, urgent
  channel TEXT NOT NULL, -- internal, slack, telegram, email
  subject TEXT,
  read BOOLEAN DEFAULT FALSE,
  action_required BOOLEAN DEFAULT FALSE,

  -- Content (stored in file, this is just metadata)
  message_path TEXT NOT NULL,

  INDEX idx_to_unread (to_agent_id, read),
  INDEX idx_timestamp (timestamp),
  INDEX idx_channel (channel)
);
```

#### schedules

```sql
CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  trigger_type TEXT NOT NULL, -- continuous, cron, reactive
  description TEXT,

  -- For cron triggers
  cron_expression TEXT,
  timezone TEXT DEFAULT 'UTC',
  next_execution_at TIMESTAMP,

  -- For continuous triggers
  minimum_interval_seconds INTEGER,
  only_when_tasks_pending BOOLEAN DEFAULT TRUE,

  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  last_triggered_at TIMESTAMP,

  INDEX idx_agent (agent_id),
  INDEX idx_next_execution (next_execution_at),
  INDEX idx_enabled (enabled)
);
```

#### audit_log

```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TIMESTAMP NOT NULL,
  agent_id TEXT REFERENCES agents(id),
  action TEXT NOT NULL, -- hire, fire, execute, message, etc.
  target_agent_id TEXT REFERENCES agents(id),
  success BOOLEAN NOT NULL,
  details TEXT, -- JSON

  INDEX idx_timestamp (timestamp),
  INDEX idx_agent (agent_id),
  INDEX idx_action (action)
);
```

#### org_hierarchy

**Materialized view for fast hierarchy queries**

```sql
CREATE TABLE org_hierarchy (
  agent_id TEXT NOT NULL REFERENCES agents(id),
  ancestor_id TEXT NOT NULL REFERENCES agents(id),
  depth INTEGER NOT NULL,
  path TEXT NOT NULL, -- e.g., "CEO/CTO/backend-dev-001"

  PRIMARY KEY (agent_id, ancestor_id),
  INDEX idx_ancestor (ancestor_id),
  INDEX idx_depth (depth)
);
```

---

## File Naming Conventions

### Agent IDs
- Format: `{role-slug}-{number}`
- Examples: `CEO`, `cto`, `backend-dev-001`, `database-admin-002`
- Rules:
  - Lowercase with hyphens
  - CEO is special (no number)
  - Numbers are zero-padded to 3 digits

### Task IDs
- Format: `task-{number}-{slug}`
- Examples: `task-001-build-api`, `task-042-fix-auth-bug`
- Rules:
  - Lowercase with hyphens
  - Numbers are zero-padded to 3 digits
  - Slug is derived from title

### Message IDs
- Format: `msg-{timestamp}-{random}`
- Examples: `msg-20260118143000-a7f3c9`, `msg-20260119090500-b2e4d1`
- Rules:
  - Timestamp: YYYYMMDDHHmmss
  - Random: 6 hex characters
  - Ensures uniqueness and sortability

---

## File Format Standards

### Markdown Files
- Use frontmatter for metadata (YAML)
- Use standard CommonMark
- Include last-updated timestamp
- Use checklists for tasks

### JSON Files
- Pretty-printed with 2-space indentation
- Include $schema reference
- Include version field
- Use ISO 8601 for timestamps

### Log Files
- One line per entry
- JSON format for structured logs
- Include timestamp, level, agent ID, message

Example:
```json
{"timestamp":"2026-01-18T14:30:00Z","level":"info","agentId":"backend-dev-001","event":"task_started","taskId":"task-001-build-api"}
```

---

## Backup & Archival Strategy

### Continuous Backups
- **What**: config.json, schedule.json, tasks/active/
- **When**: Before every execution
- **Where**: `~/.recursive-manager/backups/{agent-id}/{timestamp}/`
- **Retention**: 7 days

### Task Archival
- **What**: Completed tasks older than 7 days
- **When**: Daily at midnight
- **Where**: `tasks/archive/{YYYY-MM}/`
- **Retention**: 90 days, then compress to .tar.gz

### Message Archival
- **What**: Read messages older than 30 days
- **When**: Weekly
- **Where**: `inbox/archive/{YYYY-MM}/`
- **Retention**: 180 days

### Log Rotation
- **What**: All .log files
- **When**: Daily
- **Where**: `logs/archive/{YYYY-MM-DD}/`
- **Retention**: 30 days
- **Compression**: gzip after 7 days

