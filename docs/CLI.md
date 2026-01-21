# RecursiveManager CLI Guide

**Version:** 1.0.0
**Last Updated:** January 2026

Complete command-line interface guide for RecursiveManager. Learn how to manage hierarchical AI agent organizations through the `recursivemanager` CLI.

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Quick Start](#quick-start)
4. [Command Reference](#command-reference)
   - [init](#init)
   - [status](#status)
   - [hire](#hire)
   - [fire](#fire)
   - [message](#message)
   - [run](#run)
   - [logs](#logs)
   - [analyze](#analyze)
   - [config](#config)
   - [debug](#debug)
   - [update](#update)
   - [rollback](#rollback)
   - [version](#version)
   - [help](#help)
5. [Common Workflows](#common-workflows)
6. [Advanced Usage](#advanced-usage)
7. [Configuration](#configuration)
8. [Troubleshooting](#troubleshooting)
9. [Shell Integration](#shell-integration)

---

## Overview

RecursiveManager provides a powerful command-line interface for managing hierarchical AI agent organizations. The CLI supports:

- **Agent Management**: Hire, fire, pause, resume agents
- **Organization Visualization**: View agent hierarchies and relationships
- **Task Execution**: Trigger continuous and reactive execution modes
- **Multi-Perspective Analysis**: Run 8-agent analysis on decisions
- **Messaging**: Send messages between agents for reactive workflows
- **Debugging**: Inspect agent state, logs, and tasks
- **Configuration**: Interactive and file-based configuration
- **Updates**: Version management with rollback support

All commands support:
- **JSON output** for scripting and automation
- **Colored terminal output** for human readability
- **Interactive prompts** for guided workflows
- **Custom data directories** for multi-environment support

---

## Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **Git** (for development)

### Install from NPM (Recommended)

```bash
npm install -g recursivemanager
```

### Install from Source

```bash
git clone https://github.com/yourusername/RecursiveManager.git
cd RecursiveManager
npm install
npm run build
npm link
```

### Verify Installation

```bash
recursivemanager --version
# Output: RecursiveManager v1.0.0
```

### Shell Completion (Optional)

Enable command completion for your shell:

**Bash:**
```bash
recursivemanager completion bash >> ~/.bashrc
source ~/.bashrc
```

**Zsh:**
```bash
recursivemanager completion zsh >> ~/.zshrc
source ~/.zshrc
```

**Fish:**
```bash
recursivemanager completion fish > ~/.config/fish/completions/recursivemanager.fish
```

---

## Quick Start

### 1. Initialize with a Goal

```bash
recursivemanager init "Build a REST API for user authentication"
```

This creates a CEO agent with the specified goal and initializes the workspace.

### 2. Check Organization Status

```bash
recursivemanager status
```

View the agent organization chart as a tree structure.

### 3. Hire Additional Agents

```bash
# Hire a CTO
recursivemanager hire cto-001 \
  --role "Chief Technology Officer" \
  --goal "Design and implement technical architecture" \
  --can-hire \
  --max-subordinates 10

# Hire a Backend Engineer under the CTO
recursivemanager hire backend-001 \
  --manager-id cto-001 \
  --role "Backend Engineer" \
  --goal "Implement REST API endpoints"
```

### 4. Send Messages to Agents

```bash
recursivemanager message backend-001 \
  --subject "Implement login endpoint" \
  --content "Create POST /api/auth/login with email/password validation"
```

### 5. View Logs

```bash
# View agent logs
recursivemanager logs backend-001

# Follow logs in real-time
recursivemanager logs backend-001 --follow

# Filter by level
recursivemanager logs backend-001 --level error
```

---

## Command Reference

### init

Initialize RecursiveManager with a top-level goal.

**Syntax:**
```bash
recursivemanager init <goal> [options]
```

**Arguments:**
- `<goal>` - The primary goal for the agent hierarchy to achieve

**Options:**
- `--workspace <path>` - Custom workspace directory (default: current directory)
- `--depth <number>` - Maximum hierarchy depth (default: 5, max: 20)
- `--framework <name>` - AI framework to use (default: `claude-code`)
  - Supported: `claude-code`, `opencode`
- `--data-dir <path>` - Custom data directory (default: `~/.recursivemanager`)

**Examples:**

```bash
# Simple initialization
recursivemanager init "Analyze competitor pricing strategies"

# Initialize with custom workspace
recursivemanager init "Build e-commerce API" --workspace ./my-api-project

# Initialize with deeper hierarchy
recursivemanager init "Complex multi-phase project" --depth 10

# Initialize with specific framework
recursivemanager init "Refactor legacy codebase" --framework opencode

# Initialize with custom data directory (multi-environment)
recursivemanager init "Development task" --data-dir ~/.recursivemanager-dev
```

**What Happens:**
1. Creates a CEO agent with the specified goal
2. Initializes workspace directories (`agents/`, `tasks/`, `inbox/`, `snapshots/`)
3. Creates default configuration
4. Sets up logging infrastructure
5. Generates initial task list for CEO

**Output:**
```
✓ Initialized RecursiveManager
✓ Created CEO agent (ceo-001)
✓ Workspace: /path/to/workspace
✓ Data directory: ~/.recursivemanager

CEO Goal: Build e-commerce API

Next steps:
  1. View status: recursivemanager status
  2. Hire agents: recursivemanager hire --help
  3. Run CEO: recursivemanager run ceo-001
```

---

### status

Show agent organization chart or details for a specific agent.

**Syntax:**
```bash
recursivemanager status [options]
```

**Options:**
- `--agent-id <id>` - Show details for specific agent
- `--format <type>` - Output format: `tree`, `json`, `table`, `indented` (default: `tree`)
- `--depth <number>` - Maximum depth to display (default: unlimited)
- `--filter <status>` - Filter by status: `idle`, `working`, `completed`, `failed`, `paused`
- `--data-dir <path>` - Custom data directory

**Examples:**

```bash
# Show full organization chart (tree view)
recursivemanager status

# Show specific agent details
recursivemanager status --agent-id backend-001

# Show as JSON (for scripting)
recursivemanager status --format json

# Show as table
recursivemanager status --format table

# Show only first 3 levels
recursivemanager status --depth 3

# Filter by working agents
recursivemanager status --filter working

# Filter by paused agents
recursivemanager status --filter paused
```

**Output (Tree Format):**
```
RecursiveManager Organization Chart

ceo-001 (CEO) - Active
└── cto-001 (Chief Technology Officer) - Active
    ├── backend-001 (Backend Engineer) - Working
    │   └── db-specialist-001 (Database Specialist) - Idle
    ├── frontend-001 (Frontend Engineer) - Working
    └── devops-001 (DevOps Engineer) - Paused

Agents: 6 total (2 working, 1 paused, 2 idle, 1 active)
```

**Output (JSON Format):**
```json
{
  "rootAgent": "ceo-001",
  "agents": [
    {
      "id": "ceo-001",
      "role": "CEO",
      "status": "active",
      "subordinates": ["cto-001"],
      "manager": null,
      "createdAt": "2026-01-20T10:00:00Z"
    }
  ],
  "statistics": {
    "total": 6,
    "working": 2,
    "paused": 1,
    "idle": 2,
    "active": 1
  }
}
```

**Agent Details View:**
```bash
recursivemanager status --agent-id backend-001
```

```
Agent: backend-001
Role: Backend Engineer
Status: Working
Manager: cto-001 (Chief Technology Officer)
Subordinates: 1 (db-specialist-001)
Framework: claude-code

Goal: Implement REST API endpoints

Permissions:
  ✓ Can hire (budget: 5 agents)
  ✓ Can escalate to manager
  ✗ Cannot fire

Current Tasks: 3 pending, 7 completed
Last Active: 2 minutes ago
Created: 2026-01-20 10:30:00
```

---

### hire

Hire a new agent and add to the organizational hierarchy.

**Syntax:**
```bash
recursivemanager hire <agent-id> [options]
```

**Arguments:**
- `<agent-id>` - Unique identifier for the new agent (lowercase, alphanumeric, hyphens)

**Options:**
- `-d, --data-dir <dir>` - Custom data directory
- `-m, --manager-id <id>` - Manager agent ID (defaults to CEO if omitted)
- `-r, --role <role>` - Agent role/title (required)
- `-g, --goal <goal>` - Agent's primary goal (required)
- `-n, --display-name <name>` - Agent display name (defaults to role)
- `--can-hire` - Allow agent to hire subordinates (default: false)
- `--max-subordinates <n>` - Maximum subordinates (default: 0, requires --can-hire)
- `--hiring-budget <n>` - Hiring budget for subordinates (default: 0)
- `--can-fire` - Allow agent to fire subordinates (default: false)
- `--can-escalate` - Allow agent to escalate to manager (default: true)
- `-f, --framework <framework>` - Execution framework: `claude-code`, `opencode` (default: `claude-code`)
- `--json` - Output result as JSON

**Examples:**

```bash
# Hire a CTO with hiring permissions
recursivemanager hire cto-001 \
  --role "Chief Technology Officer" \
  --goal "Design and implement technical architecture" \
  --can-hire \
  --max-subordinates 10 \
  --hiring-budget 20 \
  --can-fire

# Hire a backend engineer under the CTO
recursivemanager hire backend-001 \
  --manager-id cto-001 \
  --role "Backend Engineer" \
  --goal "Implement REST API endpoints with PostgreSQL" \
  --can-escalate

# Hire a senior engineer with subordinate management
recursivemanager hire senior-eng-001 \
  --manager-id cto-001 \
  --role "Senior Backend Engineer" \
  --goal "Lead API development team" \
  --can-hire \
  --max-subordinates 5 \
  --hiring-budget 5 \
  --can-fire

# Hire with custom framework
recursivemanager hire qa-001 \
  --manager-id cto-001 \
  --role "QA Engineer" \
  --goal "Implement automated testing suite" \
  --framework opencode

# Hire and output as JSON (for automation)
recursivemanager hire worker-001 \
  --manager-id senior-eng-001 \
  --role "Junior Engineer" \
  --goal "Implement user authentication" \
  --json
```

**Validation Rules:**
1. **Agent ID**: Must be unique, lowercase, alphanumeric with hyphens
2. **Manager**: Manager must exist and have hiring permissions
3. **Hiring Budget**: Manager must have available hiring budget
4. **Max Subordinates**: Manager must not exceed max subordinates limit
5. **Cycle Detection**: Cannot create circular reporting relationships

**Output:**
```
✓ Hired agent: backend-001
  Role: Backend Engineer
  Manager: cto-001 (Chief Technology Officer)
  Goal: Implement REST API endpoints

Agent configuration saved to:
  ~/.recursivemanager/agents/backend-001/config.json

Next steps:
  1. Send a message: recursivemanager message backend-001 --subject "First task"
  2. Run agent: recursivemanager run backend-001
  3. View logs: recursivemanager logs backend-001
```

**JSON Output:**
```json
{
  "success": true,
  "agent": {
    "id": "backend-001",
    "role": "Backend Engineer",
    "managerId": "cto-001",
    "goal": "Implement REST API endpoints",
    "framework": "claude-code",
    "permissions": {
      "canHire": false,
      "canFire": false,
      "canEscalate": true
    },
    "createdAt": "2026-01-20T10:45:00Z"
  }
}
```

---

### fire

Fire an agent and handle their subordinates according to a specified strategy.

**Syntax:**
```bash
recursivemanager fire <agent-id> [options]
```

**Arguments:**
- `<agent-id>` - ID of the agent to fire

**Options:**
- `-d, --data-dir <dir>` - Custom data directory
- `-s, --strategy <strategy>` - Subordinate handling strategy (default: interactive prompt)
  - `reassign` - Reassign all subordinates to fired agent's manager
  - `promote` - Promote one subordinate to replace the fired agent
  - `cascade` - Fire all subordinates recursively (dangerous!)
- `--json` - Output result as JSON
- `-y, --yes` - Skip confirmation prompt (use with caution)

**Examples:**

```bash
# Fire an agent (interactive mode)
recursivemanager fire backend-001

# Fire and reassign subordinates to manager
recursivemanager fire manager-001 --strategy reassign

# Fire with cascade (fires all subordinates too)
recursivemanager fire failed-team-001 --strategy cascade --yes

# Fire and promote a subordinate
recursivemanager fire cto-001 --strategy promote

# Fire without confirmation (automation)
recursivemanager fire temp-worker-001 -y --strategy reassign --json
```

**Interactive Mode:**
```
Are you sure you want to fire backend-001 (Backend Engineer)? (y/N): y

This agent has 3 subordinates:
  - junior-001 (Junior Engineer)
  - junior-002 (Junior Engineer)
  - intern-001 (Intern)

How should we handle subordinates?
  1. Reassign to backend-001's manager (cto-001)
  2. Promote one subordinate to replace backend-001
  3. Fire all subordinates (cascade)

Choose an option (1-3): 1

✓ Fired agent: backend-001
✓ Reassigned 3 subordinates to cto-001

Snapshot created: snapshot-fire-backend-001-20260120-104500
```

**Validation:**
- Cannot fire CEO (root agent)
- Cannot fire agent that doesn't exist
- Requires confirmation unless `--yes` flag is used
- Creates automatic snapshot before firing (for rollback)

**Output:**
```
✓ Fired agent: backend-001
  Role: Backend Engineer
  Subordinates reassigned: 3
  Snapshot: snapshot-fire-backend-001-20260120-104500

You can rollback this action with:
  recursivemanager rollback --snapshot snapshot-fire-backend-001-20260120-104500
```

---

### message

Send a message to an agent for reactive execution.

**Syntax:**
```bash
recursivemanager message <agent-id> [options]
```

**Arguments:**
- `<agent-id>` - ID of the agent to send message to

**Options:**
- `-d, --data-dir <dir>` - Custom data directory
- `-f, --from <agent-id>` - Sender agent ID (default: `"system"`)
- `-s, --subject <subject>` - Message subject (required)
- `-c, --content <content>` - Message content (opens editor if not provided)
- `-p, --priority <level>` - Priority level (default: `normal`)
  - `low` - Low priority (process when idle)
  - `normal` - Normal priority
  - `high` - High priority (process soon)
  - `urgent` - Urgent (process immediately)
- `--channel <channel>` - Communication channel (default: `internal`)
  - `internal` - Internal messaging system
  - `slack` - Slack integration
  - `telegram` - Telegram integration
  - `email` - Email integration
- `-a, --action-required` - Mark message as requiring action/response
- `--json` - Output result as JSON

**Examples:**

```bash
# Send a message (opens editor for content)
recursivemanager message cto-001 --subject "API performance issue"

# Send with inline content
recursivemanager message backend-001 \
  --subject "Deploy to staging" \
  --content "Please deploy branch feature/auth to staging environment"

# Send urgent message
recursivemanager message ops-001 \
  --subject "Production alert: API down" \
  --priority urgent \
  --action-required

# Send from another agent (inter-agent communication)
recursivemanager message frontend-001 \
  --from cto-001 \
  --subject "Code review needed" \
  --content "Please review PR #123 for authentication changes"

# Send via Slack
recursivemanager message team-lead-001 \
  --subject "Daily standup reminder" \
  --content "Team standup in 15 minutes" \
  --channel slack

# Send and output as JSON
recursivemanager message worker-001 \
  --subject "Task assignment" \
  --content "Implement user profile API endpoint" \
  --priority high \
  --json
```

**Message File Format:**

Messages are stored in the agent's inbox as markdown files:

```
~/.recursivemanager/inbox/backend-001/msg-20260120-104500-abc123.md
```

**Message Structure:**
```markdown
---
messageId: msg-20260120-104500-abc123
from: system
to: backend-001
subject: Deploy to staging
priority: normal
channel: internal
actionRequired: false
timestamp: 2026-01-20T10:45:00Z
---

Please deploy branch feature/auth to staging environment.

Checklist:
- [ ] Run tests
- [ ] Deploy to staging
- [ ] Verify functionality
- [ ] Notify team
```

**Editor Mode:**

If `--content` is omitted, the default editor opens with a template:

```bash
recursivemanager message backend-001 --subject "New task"
```

Opens editor with:
```markdown
# Message to backend-001

## Subject
New task

## Content
[Write your message here...]
```

**Output:**
```
✓ Message sent to backend-001
  Subject: Deploy to staging
  Priority: normal
  Message ID: msg-20260120-104500-abc123

Agent will process this message on next reactive execution:
  recursivemanager run backend-001 --mode reactive
```

---

### run

Manually trigger agent execution in continuous or reactive mode.

**Syntax:**
```bash
recursivemanager run <agent-id> [options]
```

**Arguments:**
- `<agent-id>` - ID of the agent to execute

**Options:**
- `-d, --data-dir <dir>` - Custom data directory
- `-m, --mode <mode>` - Execution mode (default: `continuous`)
  - `continuous` - Process pending tasks from task list
  - `reactive` - Process inbox messages
- `--json` - Output result as JSON
- `-y, --yes` - Skip confirmation prompt

**Examples:**

```bash
# Run agent in continuous mode (process tasks)
recursivemanager run backend-001

# Run in reactive mode (process messages)
recursivemanager run support-agent-001 --mode reactive

# Run without confirmation (automation)
recursivemanager run worker-001 -y

# Run and output as JSON
recursivemanager run cto-001 --json
```

**Continuous Mode:**

Processes pending tasks from the agent's task list.

```bash
recursivemanager run backend-001 --mode continuous
```

**What Happens:**
1. Loads agent configuration
2. Reads pending tasks from `~/.recursivemanager/tasks/backend-001/`
3. Spawns AI agent with task context
4. Agent works on tasks
5. Updates task status (completed/failed)
6. Logs execution results

**Output:**
```
Running backend-001 in continuous mode...

Tasks pending: 5
  - Implement login endpoint
  - Add password validation
  - Create user registration
  - Set up JWT authentication
  - Write API tests

Executing...
[Agent output streams here in real-time]

✓ Execution completed
  Duration: 3m 45s
  Tasks completed: 3
  Tasks remaining: 2
  Status: Success

View logs:
  recursivemanager logs backend-001
```

**Reactive Mode:**

Processes messages from the agent's inbox.

```bash
recursivemanager run support-agent-001 --mode reactive
```

**What Happens:**
1. Loads agent configuration
2. Reads unread messages from `~/.recursivemanager/inbox/support-agent-001/`
3. Spawns AI agent with message context
4. Agent processes messages and responds
5. Marks messages as read
6. Logs execution results

**Output:**
```
Running support-agent-001 in reactive mode...

Messages pending: 3
  - [URGENT] Production API down
  - [HIGH] Performance degradation
  - [NORMAL] Feature request

Executing...
[Agent output streams here in real-time]

✓ Execution completed
  Duration: 2m 15s
  Messages processed: 3
  Status: Success

View logs:
  recursivemanager logs support-agent-001
```

---

### logs

View and filter agent logs with advanced filtering options.

**Syntax:**
```bash
recursivemanager logs [agent-id] [options]
```

**Arguments:**
- `[agent-id]` - ID of the agent (optional if using `--all`)

**Options:**
- `-n, --lines <n>` - Show last N lines (default: 50, use 0 for all)
- `-l, --level <level>` - Filter by log level: `debug`, `info`, `warn`, `error`
- `--since <time>` - Show logs since timestamp (format: `YYYY-MM-DD HH:mm:ss`)
- `--until <time>` - Show logs until timestamp
- `-f, --follow` - Follow log output in real-time (like `tail -f`)
- `-g, --grep <pattern>` - Filter logs by regex pattern (case-insensitive)
- `--all` - Show logs from all agents combined
- `--json` - Output as JSON
- `--data-dir <dir>` - Custom data directory

**Examples:**

```bash
# View last 50 lines from agent
recursivemanager logs ceo-001

# View last 100 lines
recursivemanager logs backend-001 -n 100

# View all logs (no limit)
recursivemanager logs backend-001 -n 0

# Filter by log level
recursivemanager logs cto-002 --level error
recursivemanager logs frontend-001 --level warn

# View logs since timestamp
recursivemanager logs backend-003 --since "2026-01-20 10:00:00"

# View logs in time range
recursivemanager logs worker-004 --since "2026-01-20 09:00:00" --until "2026-01-20 10:00:00"

# Search logs for pattern
recursivemanager logs frontend-004 --grep "execution failed"
recursivemanager logs backend-001 -g "error|exception|failed"

# View all agent logs combined
recursivemanager logs --all

# Follow logs in real-time
recursivemanager logs worker-005 -f

# Combine filters
recursivemanager logs backend-001 \
  --level error \
  --since "2026-01-20 08:00:00" \
  --grep "database" \
  -n 100

# Output as JSON for processing
recursivemanager logs manager-006 --json | jq '.[] | select(.level == "error")'
```

**Log Output Format (Text):**
```
2026-01-20 10:45:30 [INFO] backend-001: Starting execution
2026-01-20 10:45:31 [DEBUG] backend-001: Loading configuration from ~/.recursivemanager/agents/backend-001/config.json
2026-01-20 10:45:32 [INFO] backend-001: Found 3 pending tasks
2026-01-20 10:45:35 [INFO] backend-001: Completed task: Implement login endpoint
2026-01-20 10:45:40 [WARN] backend-001: Task execution took longer than expected (5s)
2026-01-20 10:45:45 [ERROR] backend-001: Failed to connect to database
2026-01-20 10:45:46 [INFO] backend-001: Execution completed with errors
```

**Log Output Format (JSON):**
```json
[
  {
    "timestamp": "2026-01-20T10:45:30Z",
    "level": "info",
    "agentId": "backend-001",
    "message": "Starting execution",
    "metadata": {
      "executionId": "exec-123",
      "mode": "continuous"
    }
  },
  {
    "timestamp": "2026-01-20T10:45:45Z",
    "level": "error",
    "agentId": "backend-001",
    "message": "Failed to connect to database",
    "error": {
      "code": "ECONNREFUSED",
      "stack": "..."
    }
  }
]
```

**Following Logs (Real-time):**
```bash
recursivemanager logs backend-001 --follow
```

```
2026-01-20 10:45:30 [INFO] backend-001: Starting execution
2026-01-20 10:45:31 [DEBUG] backend-001: Loading configuration
[Blocks here and shows new logs as they appear...]
```

**All Agent Logs:**
```bash
recursivemanager logs --all
```

```
2026-01-20 10:45:30 [INFO] ceo-001: Delegating task to cto-001
2026-01-20 10:45:31 [INFO] cto-001: Received delegation from ceo-001
2026-01-20 10:45:32 [INFO] backend-001: Starting execution
2026-01-20 10:45:33 [INFO] frontend-001: Starting execution
```

---

### analyze

Run multi-perspective AI analysis on a decision or question using 8 specialized agents.

**Syntax:**
```bash
recursivemanager analyze <question> [options]
```

**Arguments:**
- `<question>` - The question or decision to analyze

**Options:**
- `--format <format>` - Output format: `text`, `json`, `markdown` (default: `text`)
- `--data-dir <dir>` - Custom data directory
- `--timeout <seconds>` - Analysis timeout in seconds (default: 120)

**Examples:**

```bash
# Analyze a technical decision
recursivemanager analyze "Should we use microservices or monolith architecture?"

# Analyze with markdown output
recursivemanager analyze "Best database for real-time analytics?" --format markdown

# Analyze with JSON output (for processing)
recursivemanager analyze "Security implications of public API?" --format json

# Analyze with custom timeout
recursivemanager analyze "Complex architectural decision about distributed systems" --timeout 300
```

**How It Works:**

The `analyze` command runs 8 specialized AI agents in parallel, each analyzing the question from a different perspective:

1. **Security Agent** - Security vulnerabilities, attack vectors, compliance risks
2. **Architecture Agent** - Scalability, maintainability, technical debt, SOLID principles
3. **Simplicity Agent** - Complexity analysis, YAGNI, KISS, simplification opportunities
4. **Financial Agent** - ROI, TCO, cost-benefit analysis, resource optimization
5. **Marketing Agent** - Market positioning, competitive advantage, messaging, GTM strategy
6. **UX Agent** - User experience, accessibility (WCAG), usability, user journey
7. **Growth Agent** - Adoption metrics (AARRR), virality, PLG, scaling strategies
8. **Emotional Agent** - Team morale, developer experience, burnout risks, psychological safety

**Output (Text Format):**
```
Multi-Perspective Analysis: Should we use microservices or monolith?
================================================================================

Overall Confidence: 78%
Analysis Time: 45 seconds

┌─────────────────────────────────────────────────────────────────────────────┐
│ Security Perspective                                       Confidence: 85%  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Microservices introduce more attack surface (API boundaries, service-to-   │
│ service auth, network segmentation). However, they provide better isolation│
│ and blast radius containment. Recommendation: Start with monolith, add     │
│ service mesh later for security.                                           │
│                                                                             │
│ Key Risks:                                                                  │
│ - Increased API attack surface                                             │
│ - Service-to-service authentication complexity                             │
│ - Distributed tracing for security events                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Architecture Perspective                                   Confidence: 92%  │
├─────────────────────────────────────────────────────────────────────────────┤
│ For early-stage products, monolith provides faster iteration, simpler      │
│ deployment, and easier debugging. Microservices make sense when:           │
│ 1. Team size > 20 engineers                                                 │
│ 2. Clear bounded contexts exist                                             │
│ 3. Independent scaling is critical                                          │
│                                                                             │
│ Recommendation: Monolith with modular architecture (vertical slices).      │
│ Migrate to microservices when pain points emerge.                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Simplicity Perspective                                     Confidence: 95%  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Monolith is dramatically simpler:                                          │
│ - Single codebase                                                           │
│ - Single deployment                                                         │
│ - Simple debugging (no distributed tracing)                                 │
│ - No service discovery, load balancing, circuit breakers                    │
│                                                                             │
│ Microservices add: API gateways, service mesh, distributed tracing,        │
│ orchestration, multiple repos, complex CI/CD. Only choose if benefits      │
│ outweigh this complexity cost.                                              │
│                                                                             │
│ Strong recommendation: Start simple (monolith).                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Financial Perspective                                      Confidence: 88%  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Cost Analysis:                                                              │
│ - Monolith: Lower initial cost, single server, simple ops                  │
│ - Microservices: Higher infrastructure cost (multiple services), higher    │
│   engineering cost (distributed systems expertise), higher ops cost        │
│                                                                             │
│ TCO (3 years, 5-person team):                                               │
│ - Monolith: ~$300K (eng) + $20K (infra) = $320K                             │
│ - Microservices: ~$450K (eng) + $60K (infra) = $510K                        │
│                                                                             │
│ Recommendation: Monolith saves ~$190K over 3 years for small teams.        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Marketing Perspective                                      Confidence: 65%  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Architecture choice has minimal direct marketing impact. However:          │
│ - Faster iteration (monolith) → faster feature delivery → better market fit│
│ - "Built on microservices" is rarely a selling point to customers          │
│ - Time-to-market matters more than architecture                            │
│                                                                             │
│ Recommendation: Prioritize speed to market (favors monolith).              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ UX Perspective                                             Confidence: 70%  │
├─────────────────────────────────────────────────────────────────────────────┤
│ End-user UX is architecture-agnostic. However:                             │
│ - Monolith: Simpler deployments → less downtime → better reliability       │
│ - Microservices: Potential for partial outages → degraded UX               │
│                                                                             │
│ For user-facing products, reliability matters more than architecture.      │
│ Monolith with good testing provides better UX initially.                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Growth Perspective                                         Confidence: 82%  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Growth strategy impacts architecture choice:                               │
│ - PLG (product-led growth): Monolith enables faster iteration on product   │
│ - Enterprise sales: Microservices may be expected (compliance, security)   │
│                                                                             │
│ For early-stage growth (0 → 1000 users), monolith enables:                 │
│ - Faster A/B testing                                                        │
│ - Quicker feature launches                                                  │
│ - Better developer velocity                                                 │
│                                                                             │
│ Recommendation: Monolith for early growth phase.                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ Emotional Perspective                                      Confidence: 90%  │
├─────────────────────────────────────────────────────────────────────────────┤
│ Developer morale and burnout risks:                                        │
│ - Monolith: Simpler, less cognitive load, easier onboarding, lower stress  │
│ - Microservices: Higher complexity → more incidents → more on-call → burnout│
│                                                                             │
│ For small teams (<10 engineers), microservices can cause:                  │
│ - Overwhelming operational burden                                           │
│ - Analysis paralysis ("which service owns this?")                           │
│ - Context switching fatigue                                                 │
│                                                                             │
│ Recommendation: Monolith protects team health and productivity.            │
└─────────────────────────────────────────────────────────────────────────────┘

================================================================================
Executive Summary
================================================================================

Based on 8-agent analysis, the consensus is clear: START WITH MONOLITH.

Confidence Score: 78% (High)

Key Recommendations:
  1. Build a well-structured modular monolith (vertical slices, DDD)
  2. Use feature flags for gradual rollouts
  3. Monitor for pain points (deployment bottlenecks, scaling issues)
  4. Migrate to microservices only when specific pain points justify the cost

When to reconsider:
  • Team size exceeds 20 engineers
  • Clear bounded contexts emerge with different scaling needs
  • Deployment coupling becomes a bottleneck
  • Independent team velocity is critical

Current recommendation: Monolith saves time, money, and team sanity.

Analysis saved to: ~/.recursivemanager/analysis/analysis-20260120-104500.md
```

**Output (Markdown Format):**

Saves a markdown file with the full analysis:

```bash
recursivemanager analyze "Should we use Redis for caching?" --format markdown
```

Creates: `~/.recursivemanager/analysis/analysis-20260120-104500.md`

**Output (JSON Format):**

```bash
recursivemanager analyze "Best database for time-series data?" --format json
```

```json
{
  "question": "Best database for time-series data?",
  "timestamp": "2026-01-20T10:45:00Z",
  "analysisId": "analysis-20260120-104500",
  "overallConfidence": 85,
  "analysisTime": 38,
  "perspectives": [
    {
      "perspective": "Security",
      "confidence": 88,
      "analysis": "Time-series databases vary in security features...",
      "keyRisks": ["Data retention policies", "Access control"],
      "recommendations": ["Use InfluxDB with RBAC", "Enable encryption at rest"]
    },
    {
      "perspective": "Architecture",
      "confidence": 92,
      "analysis": "For time-series workloads, specialized databases outperform...",
      "recommendations": ["InfluxDB for metrics", "TimescaleDB for relational compatibility"]
    }
  ],
  "executiveSummary": "For time-series data, use InfluxDB (metrics) or TimescaleDB (relational compatibility).",
  "consensusRecommendation": "InfluxDB for pure metrics, TimescaleDB if SQL compatibility needed"
}
```

**Use Cases:**

1. **Technical Decisions**: Architecture choices, technology selection
2. **Product Decisions**: Feature prioritization, UX trade-offs
3. **Business Decisions**: Pricing models, market strategy
4. **Security Reviews**: Attack surface analysis, compliance evaluation
5. **Refactoring Decisions**: Complexity reduction, technical debt prioritization

---

### config

Interactive configuration wizard for RecursiveManager.

**Syntax:**
```bash
recursivemanager config [options]
```

**Options:**
- `--show` - Show current configuration
- `--edit` - Open configuration file in editor
- `--reset` - Reset to default configuration
- `--validate` - Validate configuration file
- `--data-dir <dir>` - Custom data directory

**Examples:**

```bash
# Run interactive configuration wizard
recursivemanager config

# Show current configuration
recursivemanager config --show

# Edit configuration file in default editor
recursivemanager config --edit

# Reset to defaults
recursivemanager config --reset

# Validate configuration
recursivemanager config --validate
```

**Interactive Configuration:**

```bash
recursivemanager config
```

```
RecursiveManager Configuration Wizard
================================================================================

1. Data Directory
   Current: ~/.recursivemanager
   Change? (y/N): y
   New path: ~/.recursivemanager-prod

2. Maximum Hierarchy Depth
   Current: 5
   Change? (y/N): y
   New depth (1-20): 10

3. Default AI Framework
   Current: claude-code
   Change? (y/N): n

4. AI Provider Configuration
   Current: anthropic
   Change? (y/N): y

   Select provider:
   1. Anthropic (Claude)
   2. OpenAI (GPT)
   3. GLM Gateway
   4. Custom endpoint

   Choice (1-4): 3

   GLM Gateway Endpoint: http://localhost:4000/api/glm/proxy
   API Key: [hidden]

5. Logging Configuration
   Log Level (debug/info/warn/error): info
   Log Format (text/json): json
   Max Log File Size (MB): 100
   Max Log Files: 10

6. Execution Configuration
   Max Concurrent Executions: 10
   Execution Timeout (seconds): 3600
   Enable Auto-Snapshots: yes

7. Security Configuration
   Enable Encryption at Rest: yes
   Encryption Password: [hidden]
   Enable Audit Logging: yes

Configuration saved to: ~/.recursivemanager/config.json

Test configuration with:
  recursivemanager config --validate
```

**Show Configuration:**

```bash
recursivemanager config --show
```

```json
{
  "dataDir": "~/.recursivemanager",
  "maxDepth": 5,
  "defaultFramework": "claude-code",
  "aiProvider": {
    "type": "anthropic",
    "endpoint": "https://api.anthropic.com/v1/messages",
    "model": "claude-sonnet-4-5",
    "timeout": 60000
  },
  "logging": {
    "level": "info",
    "format": "json",
    "maxFileSize": 104857600,
    "maxFiles": 10
  },
  "execution": {
    "maxConcurrent": 10,
    "timeout": 3600,
    "autoSnapshots": true
  },
  "security": {
    "encryptionEnabled": true,
    "auditLogging": true
  }
}
```

**Edit Configuration:**

```bash
recursivemanager config --edit
```

Opens `~/.recursivemanager/config.json` in the default editor (respects `$EDITOR`).

**Reset Configuration:**

```bash
recursivemanager config --reset
```

```
WARNING: This will reset all configuration to defaults.
         Existing config will be backed up to config.json.backup

Continue? (y/N): y

✓ Configuration reset to defaults
✓ Backup saved to: ~/.recursivemanager/config.json.backup
```

**Validate Configuration:**

```bash
recursivemanager config --validate
```

```
Validating configuration...

✓ Schema validation passed
✓ Data directory exists and is writable
✓ AI provider endpoint is reachable
✓ Logging configuration is valid
✓ Execution limits are within bounds
✗ Encryption password not set (required when encryption is enabled)

Validation failed: 1 error found

Fix and re-run:
  recursivemanager config --edit
```

---

### debug

Debug an agent with detailed diagnostics and state inspection.

**Syntax:**
```bash
recursivemanager debug <agent-id> [options]
```

**Arguments:**
- `<agent-id>` - ID of the agent to debug

**Options:**
- `--logs` - Show agent logs (last 100 lines)
- `--state` - Show agent state (config, status, permissions)
- `--tasks` - Show agent tasks (pending, completed, failed)
- `--messages` - Show inbox messages
- `--metrics` - Show execution metrics
- `--all` - Show all debugging information (default if no options specified)
- `--json` - Output as JSON
- `--data-dir <dir>` - Custom data directory

**Examples:**

```bash
# Debug agent with all information
recursivemanager debug backend-001 --all

# Show only agent logs
recursivemanager debug backend-001 --logs

# Show agent state
recursivemanager debug backend-001 --state

# Show pending tasks
recursivemanager debug backend-001 --tasks

# Show inbox messages
recursivemanager debug backend-001 --messages

# Show execution metrics
recursivemanager debug backend-001 --metrics

# Combine multiple options
recursivemanager debug backend-001 --state --tasks --logs

# Output as JSON for processing
recursivemanager debug backend-001 --all --json
```

**Debug Output (--all):**

```
================================================================================
Agent Debug Information: backend-001
================================================================================

┌─ State ──────────────────────────────────────────────────────────────────────┐
│ ID: backend-001                                                              │
│ Role: Backend Engineer                                                       │
│ Status: Working                                                              │
│ Manager: cto-001 (Chief Technology Officer)                                  │
│ Subordinates: 2 (junior-001, intern-001)                                     │
│ Framework: claude-code                                                       │
│ Created: 2026-01-20 09:00:00                                                 │
│ Last Active: 2 minutes ago                                                   │
│                                                                              │
│ Permissions:                                                                 │
│   ✓ Can hire (budget: 3/5 remaining)                                         │
│   ✓ Can escalate to manager                                                  │
│   ✗ Cannot fire                                                              │
│                                                                              │
│ Goal: Implement REST API endpoints with PostgreSQL backend                   │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ Tasks (5 pending, 12 completed, 1 failed) ──────────────────────────────────┐
│ Pending:                                                                     │
│   1. [HIGH] Implement user authentication endpoint                           │
│   2. [NORMAL] Add password validation                                        │
│   3. [NORMAL] Create JWT token generation                                    │
│   4. [LOW] Write API documentation                                           │
│   5. [LOW] Add rate limiting                                                 │
│                                                                              │
│ Recently Completed:                                                          │
│   ✓ Implement login endpoint (completed 1 hour ago)                          │
│   ✓ Add database migrations (completed 2 hours ago)                          │
│   ✓ Set up PostgreSQL connection (completed 3 hours ago)                     │
│                                                                              │
│ Failed:                                                                      │
│   ✗ Deploy to production (failed 30 minutes ago)                             │
│     Error: Database connection timeout                                       │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ Messages (3 unread) ────────────────────────────────────────────────────────┐
│ 1. [URGENT] from cto-001 (5 minutes ago)                                     │
│    Subject: Production API down                                              │
│    Action required: Yes                                                      │
│                                                                              │
│ 2. [HIGH] from system (1 hour ago)                                           │
│    Subject: Security audit found vulnerability                               │
│    Action required: Yes                                                      │
│                                                                              │
│ 3. [NORMAL] from frontend-001 (2 hours ago)                                  │
│    Subject: API contract change request                                      │
│    Action required: No                                                       │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ Execution Metrics ──────────────────────────────────────────────────────────┐
│ Total Executions: 47                                                         │
│ Successful: 43 (91.5%)                                                       │
│ Failed: 4 (8.5%)                                                             │
│                                                                              │
│ Execution Time:                                                              │
│   Average: 3m 24s                                                            │
│   Min: 45s                                                                   │
│   Max: 12m 30s                                                               │
│                                                                              │
│ Last 7 Days:                                                                 │
│   Executions: 15                                                             │
│   Success Rate: 93.3%                                                        │
│   Avg Duration: 3m 10s                                                       │
└──────────────────────────────────────────────────────────────────────────────┘

┌─ Recent Logs (last 20 lines) ────────────────────────────────────────────────┐
│ 2026-01-20 10:43:15 [INFO] Starting execution in continuous mode             │
│ 2026-01-20 10:43:16 [DEBUG] Loading configuration                            │
│ 2026-01-20 10:43:17 [INFO] Found 5 pending tasks                             │
│ 2026-01-20 10:43:18 [INFO] Processing: Implement login endpoint              │
│ 2026-01-20 10:43:45 [INFO] Completed: Implement login endpoint               │
│ 2026-01-20 10:43:46 [INFO] Processing: Add database migrations               │
│ 2026-01-20 10:45:12 [INFO] Completed: Add database migrations                │
│ 2026-01-20 10:45:13 [INFO] Processing: Deploy to production                  │
│ 2026-01-20 10:45:30 [ERROR] Database connection timeout                      │
│ 2026-01-20 10:45:30 [ERROR] Failed: Deploy to production                     │
│ 2026-01-20 10:45:31 [WARN] Execution completed with errors                   │
│ 2026-01-20 10:45:32 [INFO] Execution finished (duration: 2m 17s)             │
└──────────────────────────────────────────────────────────────────────────────┘

View full logs:
  recursivemanager logs backend-001

Run agent:
  recursivemanager run backend-001
```

**JSON Output:**

```bash
recursivemanager debug backend-001 --all --json
```

```json
{
  "agentId": "backend-001",
  "timestamp": "2026-01-20T10:45:00Z",
  "state": {
    "id": "backend-001",
    "role": "Backend Engineer",
    "status": "working",
    "managerId": "cto-001",
    "subordinates": ["junior-001", "intern-001"],
    "framework": "claude-code",
    "createdAt": "2026-01-20T09:00:00Z",
    "lastActiveAt": "2026-01-20T10:43:00Z",
    "permissions": {
      "canHire": true,
      "hiringBudget": { "used": 2, "remaining": 3, "total": 5 },
      "canFire": false,
      "canEscalate": true
    },
    "goal": "Implement REST API endpoints with PostgreSQL backend"
  },
  "tasks": {
    "pending": 5,
    "completed": 12,
    "failed": 1,
    "pendingList": [
      {
        "id": "task-001",
        "title": "Implement user authentication endpoint",
        "priority": "high",
        "createdAt": "2026-01-20T09:30:00Z"
      }
    ]
  },
  "messages": {
    "unread": 3,
    "total": 25,
    "unreadList": [
      {
        "id": "msg-001",
        "from": "cto-001",
        "subject": "Production API down",
        "priority": "urgent",
        "actionRequired": true,
        "receivedAt": "2026-01-20T10:40:00Z"
      }
    ]
  },
  "metrics": {
    "totalExecutions": 47,
    "successful": 43,
    "failed": 4,
    "successRate": 0.915,
    "avgDuration": 204,
    "minDuration": 45,
    "maxDuration": 750
  },
  "recentLogs": [
    {
      "timestamp": "2026-01-20T10:45:30Z",
      "level": "error",
      "message": "Database connection timeout"
    }
  ]
}
```

---

### update

Update RecursiveManager to the latest version or a specific version.

**Syntax:**
```bash
recursivemanager update [version] [options]
```

**Arguments:**
- `[version]` - Optional specific version to install (e.g., `1.2.0`)

**Options:**
- `--check` - Check for available updates without installing
- `--list` - List all available versions
- `--history` - Show version history of installed versions
- `--prerelease` - Include pre-release versions
- `--force` - Force update even if already up to date
- `--yes` - Skip confirmation prompt

**Examples:**

```bash
# Update to latest stable version
recursivemanager update

# Check for updates
recursivemanager update --check

# List available versions
recursivemanager update --list

# Install specific version
recursivemanager update 1.2.0

# Install latest pre-release
recursivemanager update --prerelease

# Force reinstall current version (repair)
recursivemanager update --force

# Show version history
recursivemanager update --history
```

**Check for Updates:**

```bash
recursivemanager update --check
```

```
Current version: 1.0.0
Latest version: 1.2.0

New features in 1.2.0:
  • Multi-perspective analysis improvements
  • New agent scheduling options
  • Performance optimizations
  • Bug fixes

Update available! Run:
  recursivemanager update
```

**List Available Versions:**

```bash
recursivemanager update --list
```

```
Available versions:

Latest stable:
  1.2.0 (released 2026-01-15)
  1.1.0 (released 2026-01-10)
  1.0.0 (released 2026-01-01)

Pre-release:
  1.3.0-beta.1 (released 2026-01-18)
  1.2.1-rc.2 (released 2026-01-14)

Install with:
  recursivemanager update <version>
```

**Update to Latest:**

```bash
recursivemanager update
```

```
Checking for updates...

Current version: 1.0.0
Latest version: 1.2.0

Changelog:
  Version 1.2.0 (2026-01-15)
    • Added enhanced multi-perspective analysis
    • Improved agent scheduling with priority queues
    • Performance optimizations for large hierarchies
    • Fixed issue with message delivery in reactive mode
    • Updated dependencies

  Version 1.1.0 (2026-01-10)
    • Added analyze command
    • Improved logging with filtering
    • Bug fixes

Download size: 15.2 MB
Install size: 42.8 MB

Proceed with update? (Y/n): y

Creating backup...
✓ Backup created: ~/.recursivemanager/backups/v1.0.0

Downloading version 1.2.0...
█████████████████████████████████████████ 100% (15.2 MB / 15.2 MB)

Installing...
✓ Installation complete

Verifying installation...
✓ Version 1.2.0 installed successfully

Update complete! Run:
  recursivemanager --version

Rollback if needed:
  recursivemanager rollback
```

**Install Specific Version:**

```bash
recursivemanager update 1.1.0
```

```
Installing version 1.1.0 (downgrade from 1.2.0)

WARNING: This is a downgrade. Some features may not work.

Proceed? (y/N): y

Creating backup...
✓ Backup created: ~/.recursivemanager/backups/v1.2.0

Installing version 1.1.0...
✓ Installation complete
✓ Version 1.1.0 installed successfully

Rollback to 1.2.0:
  recursivemanager rollback
```

**Version History:**

```bash
recursivemanager update --history
```

```
Version History:

2026-01-20 10:00:00  1.2.0 → 1.1.0 (downgrade)
2026-01-15 14:30:00  1.1.0 → 1.2.0 (update)
2026-01-10 09:00:00  1.0.0 → 1.1.0 (update)
2026-01-01 12:00:00  Initial installation (1.0.0)

Backups available:
  ~/.recursivemanager/backups/v1.2.0 (5.2 GB)
  ~/.recursivemanager/backups/v1.1.0 (5.1 GB)
  ~/.recursivemanager/backups/v1.0.0 (5.0 GB)
```

---

### rollback

Rollback to the previous version from backup.

**Syntax:**
```bash
recursivemanager rollback [options]
```

**Options:**
- `--list` - List available backups
- `--version <version>` - Rollback to specific version
- `--yes` - Skip confirmation prompt

**Examples:**

```bash
# Rollback to previous version
recursivemanager rollback

# List available backups
recursivemanager rollback --list

# Rollback to specific version
recursivemanager rollback --version 1.0.0

# Rollback without confirmation
recursivemanager rollback --yes
```

**List Available Backups:**

```bash
recursivemanager rollback --list
```

```
Available backups:

1. Version 1.1.0
   Created: 2026-01-20 10:00:00
   Size: 5.1 GB
   Status: Complete

2. Version 1.0.0
   Created: 2026-01-15 14:30:00
   Size: 5.0 GB
   Status: Complete

Rollback to a backup:
  recursivemanager rollback --version <version>
```

**Rollback to Previous:**

```bash
recursivemanager rollback
```

```
Current version: 1.2.0
Previous version: 1.1.0

Backup found: ~/.recursivemanager/backups/v1.1.0
Backup size: 5.1 GB
Backup date: 2026-01-20 10:00:00

This will restore:
  • Binary: recursivemanager v1.1.0
  • Configuration: config.json
  • Data directory: ~/.recursivemanager

Current data will be backed up first.

Proceed with rollback? (y/N): y

Creating backup of current version...
✓ Backup created: ~/.recursivemanager/backups/v1.2.0

Restoring version 1.1.0...
✓ Binary restored
✓ Configuration restored
✓ Data directory restored

Verifying installation...
✓ Version 1.1.0 restored successfully

Rollback complete! Run:
  recursivemanager --version
```

**Rollback to Specific Version:**

```bash
recursivemanager rollback --version 1.0.0
```

```
Current version: 1.2.0
Target version: 1.0.0

WARNING: This is a rollback to a version 2 releases behind.
         Some data may be incompatible.

Proceed? (y/N): y

Restoring version 1.0.0...
✓ Rollback complete
```

---

### version

Show RecursiveManager version information.

**Syntax:**
```bash
recursivemanager version
```

Or use the shorthand:
```bash
recursivemanager --version
```

**Output:**

```
RecursiveManager v1.0.0

Release Date: 2026-01-01
Release URL: https://github.com/yourusername/RecursiveManager/releases/tag/v1.0.0

Components:
  @recursivemanager/core: 0.1.0
  @recursivemanager/cli: 0.1.0
  @recursivemanager/adapters: 0.1.0
  @recursivemanager/scheduler: 0.1.0
  @recursivemanager/common: 0.1.0

Platform: linux-x64
Node.js: v20.10.0
```

---

### help

Show help information for RecursiveManager or a specific command.

**Syntax:**
```bash
recursivemanager help [command]
```

Or use the shorthand:
```bash
recursivemanager --help
recursivemanager <command> --help
```

**Examples:**

```bash
# Show general help
recursivemanager help

# Show help for specific command
recursivemanager help init
recursivemanager help hire

# Using --help flag
recursivemanager init --help
```

**General Help Output:**

```
RecursiveManager v1.0.0 - Hierarchical AI Agent Management System

Usage: recursivemanager <command> [options]

Commands:
  init <goal>          Initialize RecursiveManager with a goal
  status              Show agent organization chart
  hire <agent-id>     Hire a new agent
  fire <agent-id>     Fire an agent
  message <agent-id>  Send a message to an agent
  run <agent-id>      Manually trigger agent execution
  logs [agent-id]     View and filter agent logs
  analyze <question>  Run multi-perspective AI analysis
  config              Interactive configuration wizard
  debug <agent-id>    Debug an agent with detailed diagnostics
  update [version]    Update RecursiveManager to latest or specific version
  rollback            Rollback to the previous version
  version             Show version information
  help [command]      Show help for a command

Global Options:
  --version           Show version information
  --help              Show help information

Examples:
  recursivemanager init "Build REST API"
  recursivemanager hire cto-001 --role "CTO" --goal "Technical leadership"
  recursivemanager status --format json
  recursivemanager message backend-001 --subject "Deploy to staging"
  recursivemanager logs backend-001 --follow
  recursivemanager analyze "Should we use Redis for caching?"

Documentation:
  https://github.com/yourusername/RecursiveManager/tree/main/docs

Report issues:
  https://github.com/yourusername/RecursiveManager/issues
```

**Command-Specific Help:**

```bash
recursivemanager help hire
```

```
recursivemanager hire - Hire a new agent

Usage: recursivemanager hire <agent-id> [options]

Arguments:
  <agent-id>          Unique identifier for the new agent

Options:
  -d, --data-dir <dir>         Custom data directory
  -m, --manager-id <id>        Manager agent ID (defaults to CEO)
  -r, --role <role>            Agent role/title (required)
  -g, --goal <goal>            Agent's primary goal (required)
  -n, --display-name <name>    Agent display name
  --can-hire                   Allow agent to hire subordinates
  --max-subordinates <n>       Maximum subordinates
  --hiring-budget <n>          Hiring budget for subordinates
  --can-fire                   Allow agent to fire subordinates
  --can-escalate               Allow agent to escalate to manager
  -f, --framework <framework>  Execution framework (claude-code, opencode)
  --json                       Output result as JSON

Examples:
  # Hire a CTO with hiring permissions
  recursivemanager hire cto-001 \
    --role "Chief Technology Officer" \
    --goal "Design technical architecture" \
    --can-hire \
    --max-subordinates 10

  # Hire a backend engineer
  recursivemanager hire backend-001 \
    --manager-id cto-001 \
    --role "Backend Engineer" \
    --goal "Implement REST API"

Documentation:
  docs/CLI.md#hire
```

---

## Common Workflows

### Workflow 1: Initialize and Build a Team

```bash
# 1. Initialize with a goal
recursivemanager init "Build a SaaS analytics platform"

# 2. View the org chart (just CEO initially)
recursivemanager status

# 3. Hire a CTO
recursivemanager hire cto-001 \
  --role "Chief Technology Officer" \
  --goal "Design and implement technical architecture" \
  --can-hire \
  --max-subordinates 15 \
  --hiring-budget 30 \
  --can-fire

# 4. Hire key engineers under the CTO
recursivemanager hire backend-001 \
  --manager-id cto-001 \
  --role "Senior Backend Engineer" \
  --goal "Build API and database layer" \
  --can-hire \
  --max-subordinates 5

recursivemanager hire frontend-001 \
  --manager-id cto-001 \
  --role "Senior Frontend Engineer" \
  --goal "Build React dashboard and components" \
  --can-hire \
  --max-subordinates 3

recursivemanager hire devops-001 \
  --manager-id cto-001 \
  --role "DevOps Engineer" \
  --goal "Set up CI/CD and infrastructure"

# 5. View updated org chart
recursivemanager status

# 6. Send initial messages
recursivemanager message backend-001 \
  --subject "First sprint goals" \
  --content "Implement user auth, data ingestion pipeline, and analytics queries"

recursivemanager message frontend-001 \
  --subject "First sprint goals" \
  --content "Build dashboard layout, charts, and user management UI"

# 7. Run agents
recursivemanager run backend-001
recursivemanager run frontend-001
```

### Workflow 2: Reactive Message-Based Execution

```bash
# 1. Send a message to an agent
recursivemanager message support-agent-001 \
  --subject "Customer reported bug" \
  --priority urgent \
  --content "Customer reports login fails with Google OAuth"

# 2. Run agent in reactive mode
recursivemanager run support-agent-001 --mode reactive

# 3. Check logs to see what the agent did
recursivemanager logs support-agent-001 -n 100

# 4. Debug if needed
recursivemanager debug support-agent-001 --tasks --messages
```

### Workflow 3: Multi-Perspective Analysis

```bash
# 1. Analyze a technical decision
recursivemanager analyze "Should we use GraphQL or REST for our API?" \
  --format markdown

# 2. Review the analysis
cat ~/.recursivemanager/analysis/analysis-*.md

# 3. Make a decision and communicate to team
recursivemanager message cto-001 \
  --subject "API architecture decision" \
  --content "Based on multi-perspective analysis, recommending REST for v1.0"
```

### Workflow 4: Monitor and Debug

```bash
# 1. View org chart to see agent status
recursivemanager status

# 2. Check logs for errors
recursivemanager logs --all --level error -n 200

# 3. Debug a specific agent
recursivemanager debug backend-001 --all

# 4. View agent-specific logs
recursivemanager logs backend-001 --follow

# 5. Search for specific issues
recursivemanager logs backend-001 --grep "timeout|error|failed"
```

### Workflow 5: Update and Rollback

```bash
# 1. Check for updates
recursivemanager update --check

# 2. Update to latest version
recursivemanager update

# 3. If something breaks, rollback
recursivemanager rollback

# 4. Or update to specific stable version
recursivemanager update 1.1.0
```

### Workflow 6: Team Restructuring

```bash
# 1. View current org chart
recursivemanager status

# 2. Fire an underperforming agent
recursivemanager fire backend-002 \
  --strategy reassign

# 3. Hire a replacement
recursivemanager hire backend-003 \
  --manager-id cto-001 \
  --role "Backend Engineer" \
  --goal "Implement payment processing"

# 4. Verify org chart
recursivemanager status
```

---

## Advanced Usage

### JSON Output for Scripting

All commands support `--json` output for automation:

```bash
# Get org chart as JSON
ORG_JSON=$(recursivemanager status --format json)

# Parse with jq
echo $ORG_JSON | jq '.agents[] | select(.status == "working")'

# Get working agents count
WORKING_COUNT=$(echo $ORG_JSON | jq '[.agents[] | select(.status == "working")] | length')

# Automate hiring based on conditions
if [ $WORKING_COUNT -lt 5 ]; then
  recursivemanager hire worker-new-001 \
    --manager-id cto-001 \
    --role "Worker" \
    --goal "Handle overflow tasks" \
    --json
fi
```

### Multi-Environment Setup

Use `--data-dir` for multiple environments:

```bash
# Development environment
recursivemanager init "Dev project" --data-dir ~/.rm-dev

# Staging environment
recursivemanager init "Staging project" --data-dir ~/.rm-staging

# Production environment
recursivemanager init "Prod project" --data-dir ~/.rm-prod

# Set environment variable for convenience
export RM_DATA_DIR=~/.rm-dev
recursivemanager status --data-dir $RM_DATA_DIR
```

### Batch Operations with Shell Scripts

```bash
#!/bin/bash
# hire-team.sh - Batch hire engineering team

MANAGER_ID="cto-001"
ENGINEERS=(
  "backend-001:Backend Engineer:Build API"
  "backend-002:Backend Engineer:Build database layer"
  "frontend-001:Frontend Engineer:Build dashboard"
  "frontend-002:Frontend Engineer:Build components"
  "qa-001:QA Engineer:Test automation"
)

for engineer in "${ENGINEERS[@]}"; do
  IFS=':' read -r id role goal <<< "$engineer"
  recursivemanager hire "$id" \
    --manager-id "$MANAGER_ID" \
    --role "$role" \
    --goal "$goal" \
    --can-escalate
  echo "Hired: $id"
done

echo "Team hiring complete!"
recursivemanager status
```

### Log Analysis with grep and jq

```bash
# Find all errors in the last hour
recursivemanager logs --all \
  --since "$(date -d '1 hour ago' '+%Y-%m-%d %H:%M:%S')" \
  --level error

# Export logs as JSON and analyze
recursivemanager logs backend-001 --json -n 1000 > logs.json

# Count errors by type
jq -r '.[] | select(.level == "error") | .message' logs.json | sort | uniq -c | sort -rn

# Find longest-running executions
jq -r '.[] | select(.message | contains("Execution finished")) | .metadata.duration' logs.json | sort -rn | head -10
```

### Monitoring with Watch

```bash
# Real-time org chart monitoring
watch -n 5 'recursivemanager status --format tree'

# Monitor working agents count
watch -n 10 'recursivemanager status --format json | jq "[.agents[] | select(.status == \"working\")] | length"'

# Monitor error logs
watch -n 5 'recursivemanager logs --all --level error -n 10'
```

---

## Configuration

### Configuration File

Location: `~/.recursivemanager/config.json`

```json
{
  "dataDir": "~/.recursivemanager",
  "maxDepth": 5,
  "defaultFramework": "claude-code",
  "aiProvider": {
    "type": "anthropic",
    "endpoint": "https://api.anthropic.com/v1/messages",
    "model": "claude-sonnet-4-5",
    "timeout": 60000,
    "apiKey": "${ANTHROPIC_API_KEY}"
  },
  "logging": {
    "level": "info",
    "format": "json",
    "maxFileSize": 104857600,
    "maxFiles": 10,
    "directory": "~/.recursivemanager/logs"
  },
  "execution": {
    "maxConcurrent": 10,
    "timeout": 3600,
    "autoSnapshots": true,
    "snapshotInterval": 3600
  },
  "security": {
    "encryptionEnabled": true,
    "auditLogging": true,
    "maxInputSize": 10485760
  },
  "scheduler": {
    "enabled": true,
    "pollInterval": 60,
    "maxQueueSize": 1000
  }
}
```

### Environment Variables

RecursiveManager supports environment variables for configuration:

```bash
# Data directory
export RM_DATA_DIR=~/.recursivemanager

# AI provider
export AI_PROVIDER=anthropic
export ANTHROPIC_API_KEY=sk-ant-...
export AI_PROVIDER_ENDPOINT=https://api.anthropic.com/v1/messages

# Logging
export LOG_LEVEL=info
export LOG_FORMAT=json

# Execution
export MAX_CONCURRENT_EXECUTIONS=10
export EXECUTION_TIMEOUT=3600

# Security
export ENABLE_ENCRYPTION=true
export ENCRYPTION_PASSWORD=secret
```

Load from `.env` file:

```bash
# .env
RM_DATA_DIR=~/.recursivemanager
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
LOG_LEVEL=info
```

---

## Troubleshooting

### Common Issues

#### 1. Command Not Found

```
bash: recursivemanager: command not found
```

**Solution:**
```bash
# Check if installed globally
npm list -g recursivemanager

# If not installed
npm install -g recursivemanager

# Or link from source
cd /path/to/RecursiveManager
npm link
```

#### 2. Permission Denied

```
Error: EACCES: permission denied, open '~/.recursivemanager/config.json'
```

**Solution:**
```bash
# Fix permissions
chmod -R 755 ~/.recursivemanager

# Or run with sudo (not recommended)
sudo recursivemanager <command>
```

#### 3. Agent Hire Fails

```
Error: Manager 'cto-001' does not have hiring budget
```

**Solution:**
```bash
# Check manager's hiring budget
recursivemanager debug cto-001 --state

# Increase hiring budget by updating config
recursivemanager config --edit
# Edit: permissions.hiringBudget.total
```

#### 4. Database Lock Error

```
Error: Database is locked
```

**Solution:**
```bash
# Check for running processes
ps aux | grep recursivemanager

# Kill stale processes
pkill -f recursivemanager

# Remove lock file
rm ~/.recursivemanager/.lock
```

#### 5. API Provider Timeout

```
Error: AI provider request timeout after 60s
```

**Solution:**
```bash
# Increase timeout in config
recursivemanager config
# Set: aiProvider.timeout = 120000

# Or use environment variable
export AI_PROVIDER_TIMEOUT=120000
```

### Debug Mode

Enable verbose logging:

```bash
# Set log level to debug
export LOG_LEVEL=debug

# Run command
recursivemanager status

# View debug logs
recursivemanager logs --all --level debug -n 500
```

### Health Check

```bash
# Verify installation
recursivemanager --version

# Validate configuration
recursivemanager config --validate

# Check data directory
ls -la ~/.recursivemanager

# Test agent hire (dry run)
recursivemanager hire test-001 \
  --role "Test Agent" \
  --goal "Test hiring" \
  --json
```

---

## Shell Integration

### Bash Completion

Add to `~/.bashrc`:

```bash
# RecursiveManager completion
eval "$(recursivemanager completion bash)"
```

### Zsh Completion

Add to `~/.zshrc`:

```bash
# RecursiveManager completion
eval "$(recursivemanager completion zsh)"
```

### Fish Completion

```bash
recursivemanager completion fish > ~/.config/fish/completions/recursivemanager.fish
```

### Aliases

Add useful aliases to your shell config:

```bash
# ~/.bashrc or ~/.zshrc

# Short aliases
alias rm='recursivemanager'
alias rms='recursivemanager status'
alias rml='recursivemanager logs'
alias rmh='recursivemanager hire'
alias rmf='recursivemanager fire'
alias rmr='recursivemanager run'
alias rma='recursivemanager analyze'

# JSON output aliases
alias rmsj='recursivemanager status --format json'
alias rmlj='recursivemanager logs --json'

# Multi-environment aliases
alias rm-dev='recursivemanager --data-dir ~/.rm-dev'
alias rm-staging='recursivemanager --data-dir ~/.rm-staging'
alias rm-prod='recursivemanager --data-dir ~/.rm-prod'
```

---

## Next Steps

- **API Documentation**: See [docs/API.md](./API.md) for programmatic API reference
- **Architecture Guide**: See [docs/ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- **Development Guide**: See [docs/DEVELOPMENT.md](./DEVELOPMENT.md) for contributing
- **Troubleshooting**: See [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed debugging

---

**Last Updated:** January 2026
**Version:** 1.0.0
