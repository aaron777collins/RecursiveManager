# Quick Start

This guide will help you get started with RecursiveManager in minutes.

## Installation

First, install RecursiveManager:

```bash
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/main/scripts/install.sh | bash
```

## Your First Agent Hierarchy

Initialize a new RecursiveManager project with a goal:

```bash
recursivemanager init "Build a web scraper for product prices"
```

This will:
1. Create a workspace directory
2. Set up the agent hierarchy
3. Initialize the database
4. Create the root manager agent

## Checking Status

View your agent organization chart:

```bash
recursivemanager status
```

View detailed information about a specific agent:

```bash
recursivemanager status --agent-id <agent-id>
```

## Configuration

Run the interactive configuration wizard:

```bash
recursivemanager config
```

Or manually edit the configuration file at `~/.recursivemanager/.env`

## Debugging

View detailed debugging information for an agent:

```bash
recursivemanager debug <agent-id>
```

## Updating

Keep RecursiveManager up to date:

```bash
recursivemanager update
```

Check for available updates:

```bash
recursivemanager update --check
```

## Next Steps

- Learn about [Agent Hierarchy](concepts/agent-hierarchy.md)
- Explore [Execution Modes](concepts/execution-modes.md)
- Read the [CLI Reference](cli-reference.md)
- Understand [Multi-Perspective Analysis](concepts/multi-perspective-analysis.md)
