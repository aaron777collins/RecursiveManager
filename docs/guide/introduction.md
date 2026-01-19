# Introduction

Welcome to **RecursiveManager** - a hierarchical AI agent system that mimics organizational structures to enable recursive delegation, autonomous task management, and multi-framework support.

## What is RecursiveManager?

RecursiveManager is a system where AI agents operate like people in a company:

- **Agents hire subordinates** to delegate work
- **Tasks flow down** the hierarchy and results flow up
- **Fresh context every run** from file-based state (no context decay)
- **Multi-perspective analysis** ensures quality decisions
- **Framework-agnostic** design supports multiple AI coding frameworks

## Core Concepts

### Hierarchical Organization

```
CEO Agent
├── CTO Agent
│   ├── Backend Dev Agent
│   └── Frontend Dev Agent
└── CFO Agent
    └── Accounting Agent
```

Each agent:
- Has a clear role and goal
- Reports to a manager (except the root)
- Can hire and manage subordinates
- Maintains its own workspace and tasks
- Operates independently with file-based state

### Dual Execution Modes

1. **Continuous Mode**: Agent actively works on tasks
   - Picks next task from queue
   - Works until completion or pause condition
   - Runs on schedule (e.g., "every 30 minutes while tasks exist")

2. **Reactive Mode**: Agent responds to messages
   - Triggered by Slack, Telegram, email, or internal messages
   - Processes inbox and responds
   - Can create tasks or delegate work

### File-Based State

All agent state is stored in files:

```
agents/
  CEO/
    config.json          # Agent configuration
    schedule.json        # Execution schedule
    metadata.json        # Runtime stats
    tasks/
      active/            # Current tasks
      completed/         # Finished tasks
    inbox/               # Incoming messages
    workspace/           # Work files
    subordinates/        # Subordinate registry
```

Benefits:
- **Transparent** - You can inspect any agent's state
- **Debuggable** - Files show exactly what happened
- **Stateless execution** - Fresh context prevents decay
- **Version controllable** - Track changes over time

### Multi-Perspective Analysis

Before major decisions (hiring, firing, architecture changes), RecursiveManager can analyze from multiple perspectives:

1. **Simplicity & Developer Experience**
2. **Architecture & Scalability**
3. **Security & Trust**
4. **Testing & Quality Assurance**
5. **Observability & Debugging**
6. **Documentation & Onboarding**
7. **DevOps & Operations**
8. **User Experience**

This ensures comprehensive consideration of trade-offs.

## Use Cases

### Software Development Teams

```bash
# Create a development organization
recursive-manager hire --role "CTO" --goal "Manage engineering"
recursive-manager message CTO "Hire backend and frontend developers"
recursive-manager message CTO "Implement feature X with tests"
```

The CTO agent:
1. Hires Backend and Frontend developer agents
2. Delegates implementation tasks
3. Reviews progress and coordinates work
4. Reports back when complete

### Task Automation

```bash
# Create a task automation hierarchy
recursive-manager hire --role "Automation Manager" --goal "Handle scheduled tasks"
recursive-manager message "Automation Manager" "Run daily backups and send reports"
```

### Customer Support

```bash
# Create a support organization
recursive-manager hire --role "Support Lead" --goal "Handle customer inquiries"
# Connect to Slack/Telegram
recursive-manager message "Support Lead" "Monitor #support channel and respond"
```

## Key Features

### ✅ Quality Over Cost

- Multi-perspective analysis before major decisions
- Comprehensive edge case handling
- Defensive programming with validation
- Full audit trail of all actions

### ✅ Scalability

- Supports 1 to 1000+ agents
- Hybrid storage (files + database)
- Agent directory sharding for performance
- Worker pool for concurrent execution

### ✅ Resilience

- Circuit breakers for failing operations
- Deadlock detection for task dependencies
- Orphan handling when agents are fired
- Backup and recovery for all state

### ✅ Developer Experience

- Simple CLI commands
- Clear error messages with suggested fixes
- Rich debugging tools
- Comprehensive documentation

## Philosophy

RecursiveManager is built on these principles:

1. **Transparency**: All state visible in files
2. **Quality**: Multi-perspective analysis over speed
3. **Simplicity**: Convention over configuration
4. **Resilience**: Graceful degradation, never crash
5. **Modularity**: Framework-agnostic core, pluggable adapters

## Next Steps

- [Installation](/guide/installation) - Get RecursiveManager running
- [Quick Start](/guide/quick-start) - Create your first agent in 5 minutes
- [Core Concepts](/guide/core-concepts) - Deeper dive into the system
- [Architecture](/architecture/overview) - Understand the design
