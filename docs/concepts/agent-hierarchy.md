# Agent Hierarchy

RecursiveManager uses a hierarchical agent structure that mimics real organizational hierarchies.

## Overview

The agent hierarchy is the core concept of RecursiveManager. Just like in real organizations where managers delegate to subordinates, RecursiveManager creates a tree of AI agents where:

- **Root agents** are top-level managers that receive the initial goal
- **Manager agents** delegate tasks to subordinate agents
- **Worker agents** execute specific tasks

## Hierarchy Structure

```
Root Manager (CEO)
├── Manager A (VP Engineering)
│   ├── Worker 1 (Frontend Dev)
│   ├── Worker 2 (Backend Dev)
│   └── Worker 3 (DevOps)
├── Manager B (VP Product)
│   ├── Worker 4 (Product Manager)
│   └── Worker 5 (UX Designer)
└── Manager C (VP Marketing)
    ├── Worker 6 (Content Writer)
    └── Worker 7 (Social Media)
```

## Agent Roles

Each agent in the hierarchy has a specific role:

### Root Agent
- Receives the overall goal
- Breaks down the goal into major sub-goals
- Delegates to manager agents
- Synthesizes results

### Manager Agent
- Receives sub-goals from parent
- Further breaks down goals into tasks
- Delegates to worker agents or sub-managers
- Coordinates subordinate work
- Reports progress to parent

### Worker Agent
- Receives specific tasks
- Executes tasks independently
- Reports results to manager
- Does not delegate to others

## Depth Limits

To prevent infinite recursion, RecursiveManager enforces a maximum depth limit (default: 5 levels). This can be configured:

```bash
MAX_AGENT_DEPTH=10
```

## Agent Creation

Agents are created dynamically based on the goal:

1. User provides a goal
2. Root agent analyzes the goal
3. Root agent determines needed sub-agents
4. Each sub-agent is assigned a role and sub-goal
5. Process repeats recursively

## Agent Communication

Agents communicate through a structured protocol:

- **Delegation**: Parent sends task to child
- **Progress Updates**: Child reports status to parent
- **Completion**: Child returns results to parent
- **Questions**: Child can request clarification from parent

## Persistence

The agent hierarchy is persisted to disk, allowing:

- Resuming interrupted work
- Auditing agent decisions
- Debugging agent behavior
- Version control of agent states

## Example Hierarchy

For the goal "Build a web scraper for product prices":

```
Root Manager: Project Coordinator
├── Requirements Manager
│   ├── Research Worker (competitor analysis)
│   └── Specification Worker (technical requirements)
├── Development Manager
│   ├── Scraper Worker (web scraping logic)
│   ├── Parser Worker (data extraction)
│   └── Storage Worker (database design)
└── Testing Manager
    ├── Unit Test Worker
    └── Integration Test Worker
```

## Benefits

The hierarchical approach provides:

- **Scalability**: Complex goals are broken down automatically
- **Parallelization**: Multiple agents work concurrently
- **Specialization**: Each agent focuses on specific tasks
- **Fault Tolerance**: Failed agents can be restarted
- **Clarity**: Clear ownership and responsibility
