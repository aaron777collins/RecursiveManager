# Quick Start

::: warning Development Status
RecursiveManager is currently in active development (Alpha). This guide describes the current functionality with some features still being refined.
:::

Get up and running with RecursiveManager in just a few minutes. This guide walks you through installing the system, creating your first agent hierarchy, and managing tasks.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18.0.0 or higher ([Download](https://nodejs.org/))
- **npm** 8.0.0 or higher (comes with Node.js)
- **500 MB** of free disk space
- **2 GB** of RAM (4 GB recommended)

Check your versions:

```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 8.0.0 or higher
```

## Step 1: Install RecursiveManager

Choose one of the following installation methods:

### Quick Installation (Recommended)

Use the one-liner installer:

```bash
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/main/scripts/install.sh | bash
```

This will:
- Download and install RecursiveManager
- Set up PATH configuration
- Verify the installation
- Display the version number

### Manual Installation

If you prefer manual control:

```bash
# Clone the repository
git clone https://github.com/aaron777collins/RecursiveManager.git
cd RecursiveManager

# Install dependencies
npm install

# Build all packages
npm run build

# Link CLI globally
npm link

# Verify installation
recursive-manager --version
```

## Step 2: Initialize Your First Project

Create a new RecursiveManager project with a high-level goal:

```bash
recursive-manager init "Build a task management application"
```

This command will:
1. Create a data directory (`.recursive-manager/` by default)
2. Initialize a SQLite database
3. Set up directory structure:
   - `agents/` - Agent workspaces
   - `tasks/` - Task definitions
   - `logs/` - Execution logs
   - `snapshots/` - Database backups
4. Create a root CEO agent
5. Write configuration files

### Custom Data Directory

To use a different location:

```bash
recursive-manager init "Your goal" --data-dir ~/my-agents
```

Or set the environment variable:

```bash
export RECURSIVE_MANAGER_DATA_DIR=~/my-agents
recursive-manager init "Your goal"
```

### Force Reinitialization

If you need to start over:

```bash
recursive-manager init "New goal" --force
```

::: warning Data Loss
The `--force` flag will overwrite existing data. Make sure to back up important data first.
:::

## Step 3: Check System Status

View your agent hierarchy:

```bash
recursive-manager status
```

Expected output:

```
┌─ Organization Chart ─────────────────────────────────────┐
│                                                           │
│  CEO (root-agent-1)                                      │
│  Role: CEO                                               │
│  Status: IDLE                                            │
│  Goal: Build a task management application               │
│                                                           │
│  Summary:                                                │
│  • Total Agents: 1                                       │
│  • Active: 1                                             │
│  • Paused: 0                                             │
│  • Max Depth: 1                                          │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### View Agent Details

Show information about a specific agent:

```bash
recursive-manager status --agent-id root-agent-1
```

### Different Output Formats

RecursiveManager supports multiple output formats:

```bash
# Tree format (default)
recursive-manager status --format tree

# Table format
recursive-manager status --format table

# JSON format (for scripts/automation)
recursive-manager status --format json
```

## Step 4: Manage Configuration

View and modify system settings:

```bash
# List all configuration
recursive-manager config --list

# Get a specific value
recursive-manager config --get execution.workerPoolSize

# Set a value
recursive-manager config --set execution.workerPoolSize=10

# Set nested values (dot notation)
recursive-manager config --set execution.maxConcurrentTasks=20
```

### Common Configuration Options

```json
{
  "dataDir": "./.recursive-manager",
  "dbPath": "./.recursive-manager/recursive-manager.db",
  "rootAgentId": "root-agent-1",
  "execution": {
    "workerPoolSize": 5,
    "maxConcurrentTasks": 10
  }
}
```

## Step 5: Debug Agent Information

Get detailed information about an agent:

```bash
recursive-manager debug root-agent-1
```

This shows:
- Agent state (role, status, reporting relationship)
- Execution statistics
- Task list with status
- Recent logs

### Debug Options

```bash
# Show only agent state
recursive-manager debug root-agent-1 --state

# Show only tasks
recursive-manager debug root-agent-1 --tasks

# Show all information
recursive-manager debug root-agent-1 --all

# Show last 100 lines of logs
recursive-manager debug root-agent-1 --logs 100

# JSON output
recursive-manager debug root-agent-1 --json
```

## Step 6: Create Database Snapshots

RecursiveManager automatically creates snapshots during major operations (hiring, firing). You can also manage them manually:

```bash
# List available snapshots
recursive-manager rollback --history

# Restore from a specific snapshot
recursive-manager rollback snapshot-2026-01-19-14-30-00

# Interactive selection (choose from list)
recursive-manager rollback
```

### Rollback Options

```bash
# Skip validation (faster but risky)
recursive-manager rollback snapshot-id --no-validate

# Skip pre-rollback backup
recursive-manager rollback snapshot-id --no-backup

# Filter snapshots by agent
recursive-manager rollback --history --agent-id root-agent-1

# Limit number of snapshots shown
recursive-manager rollback --history --limit 5
```

::: tip Automatic Backups
RecursiveManager creates automatic backups before each rollback operation. You can disable this with `--no-backup`.
:::

## Understanding Agent Hierarchies

RecursiveManager models organizational structures. Here's how it works:

### The CEO Pattern

Every project starts with a **CEO agent** (root agent):

```
CEO (root-agent-1)
Goal: Build a task management application
Status: IDLE
```

The CEO:
- Receives the high-level goal
- Creates a strategic plan
- Hires subordinate agents for specialized work
- Monitors overall progress

### Delegation Flow

As work progresses, agents delegate to subordinates:

```
CEO
 ├─ VP Engineering (agent-2)
 │   ├─ Backend Dev (agent-5)
 │   └─ Frontend Dev (agent-6)
 ├─ VP Operations (agent-3)
 └─ VP Sales (agent-4)
```

Each agent:
- Has a specific role and responsibilities
- Reports to their manager
- Can hire their own subordinates
- Executes tasks autonomously

### Task Flow

Tasks flow through the hierarchy:

1. **CEO** creates high-level tasks
2. **VPs** break down tasks and assign to teams
3. **Individual agents** execute specific work
4. **Results** propagate back up the chain

## Next Steps

Now that you have RecursiveManager running, explore advanced features:

### Learn Core Concepts

- [Core Concepts](/guide/core-concepts) - Understand hierarchies and delegation
- [Creating Agents](/guide/creating-agents) - Hiring and managing agents
- [Task Management](/guide/task-management) - Task lifecycle and dependencies

### Advanced Features

- [Multi-Perspective Analysis](/guide/multi-perspective) - Decision-making with 8 perspectives
- [Scheduling](/guide/scheduling) - Time-based and event-driven execution
- [Messaging](/guide/messaging) - Inter-agent communication

### Reference Documentation

- [CLI Commands](/api/cli-commands) - Complete command reference
- [Configuration](/api/schemas) - All configuration options
- [Architecture](/architecture/system-design) - How it works internally

## Common Tasks

### Starting a New Project

```bash
# Create a new directory
mkdir my-agent-project
cd my-agent-project

# Initialize
recursive-manager init "Project goal"

# Verify setup
recursive-manager status
```

### Monitoring Progress

```bash
# Check overall status
recursive-manager status

# View specific agent
recursive-manager status --agent-id agent-2

# Check agent logs
recursive-manager debug agent-2 --logs 50
```

### Troubleshooting

```bash
# View configuration
recursive-manager config --list

# Check agent state
recursive-manager debug agent-id --state

# View recent logs
recursive-manager debug agent-id --logs 100

# Rollback to previous state
recursive-manager rollback --history
```

## Tips and Best Practices

### 1. Clear Goals

Start with specific, actionable goals:

```bash
# ✅ Good
recursive-manager init "Build REST API for user authentication"

# ❌ Too vague
recursive-manager init "Make something cool"
```

### 2. Monitor Regularly

Check status frequently to track progress:

```bash
# Set up an alias for quick access
alias rms="recursive-manager status"
rms  # Quick status check
```

### 3. Use JSON Output for Automation

Integrate with scripts and CI/CD:

```bash
# Get status as JSON
recursive-manager status --format json > status.json

# Process with jq
recursive-manager status --format json | jq '.agents | length'
```

### 4. Regular Snapshots

While automatic snapshots are created during hiring/firing, consider creating manual snapshots before major changes:

```bash
# View current snapshots
recursive-manager rollback --history

# After manual database operations, check you can rollback
recursive-manager rollback --history --limit 5
```

### 5. Custom Data Directories

For multiple projects, use separate data directories:

```bash
# Project 1
export RECURSIVE_MANAGER_DATA_DIR=~/project1
recursive-manager init "Project 1 goal"

# Project 2
export RECURSIVE_MANAGER_DATA_DIR=~/project2
recursive-manager init "Project 2 goal"
```

## Troubleshooting

### Command Not Found

```bash
# Error: recursive-manager: command not found

# Solution 1: Reload shell configuration
source ~/.bashrc  # or ~/.zshrc

# Solution 2: Use full path
~/.recursive-manager/dist/cli.js

# Solution 3: Reinstall
npm link
```

### Database Locked

```bash
# Error: database is locked

# Solution: Close other RecursiveManager processes
pkill -f recursive-manager

# Remove lock files if needed
rm .recursive-manager/recursive-manager.db-shm
rm .recursive-manager/recursive-manager.db-wal
```

### Permission Errors

```bash
# Error: EACCES: permission denied

# Solution: Fix directory permissions
chmod -R 755 .recursive-manager
```

### Out of Disk Space

```bash
# Check disk space
df -h

# Clean up old snapshots
recursive-manager rollback --history
# Manually delete old snapshots from .recursive-manager/snapshots/
```

## Getting Help

Need assistance? Here are your options:

- **Documentation**: [https://aaron777collins.github.io/RecursiveManager/](https://aaron777collins.github.io/RecursiveManager/)
- **GitHub Issues**: [Report bugs](https://github.com/aaron777collins/RecursiveManager/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/aaron777collins/RecursiveManager/discussions)
- **Command Help**: `recursive-manager --help`

### Command-Specific Help

```bash
# Get help for a specific command
recursive-manager init --help
recursive-manager status --help
recursive-manager config --help
recursive-manager debug --help
recursive-manager rollback --help
```

## What's Next?

You've successfully set up RecursiveManager! Here's what to explore next:

1. **Understand the System**: Read [Core Concepts](/guide/core-concepts) to learn how agents, tasks, and hierarchies work together

2. **Create Agents**: Learn [Creating Agents](/guide/creating-agents) to build your first organizational structure

3. **Manage Tasks**: Explore [Task Management](/guide/task-management) to understand task lifecycle and dependencies

4. **Advanced Features**: Dive into [Multi-Perspective Analysis](/guide/multi-perspective) for sophisticated decision-making

5. **Customize**: Check out [Best Practices](/guide/best-practices) for tips on hierarchy design and error handling

Happy building!
