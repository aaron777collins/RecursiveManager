# RecursiveManager

> Hierarchical AI agent system that mimics organizational structures for autonomous task management

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Planning](https://img.shields.io/badge/Status-Planning-blue.svg)](https://github.com/yourusername/RecursiveManager)

## Overview

RecursiveManager is a revolutionary AI agent orchestration system that models organizational hierarchies. Just as a CEO delegates to managers who delegate to workers, RecursiveManager enables AI agents to hire subordinates, manage tasks, escalate issues, and coordinate work across a recursive tree of specialized agents.

### Key Features

- **Recursive Agent Hierarchies**: Agents can hire and manage subordinates, creating organizational depth
- **Dual Instance Types**: Continuous execution for active work + reactive triggers for messages/events
- **File-Based Persistence**: Each agent has its own workspace with notes, tasks, and context
- **Multi-Framework Support**: Works with Claude Code, OpenCode, and other AI coding frameworks
- **Smart Scheduling**: Time-based triggers, continuous execution, and reactive messaging
- **Multi-Platform Integration**: Slack, Telegram, email, and internal messaging
- **Quality-First**: Multi-perspective analysis before all major decisions

### Philosophy

**Quality over cost.** RecursiveManager prioritizes correctness and thorough analysis over speed. Every major decision is analyzed from multiple perspectives (security, architecture, UX, etc.) to ensure robust outcomes.

**Stateless execution.** Every agent execution starts with a fresh memory context, reading all state from files. This prevents context window decay and enables truly long-running projects.

**Business-like structure.** Agents behave like employees in a company: they have roles, goals, managers, and subordinates. They hire, fire, escalate, and coordinate just like real organizations.

## Quick Example

```bash
# Initialize with a high-level goal
recursive-manager init "Build a SaaS product for task management"

# The CEO agent will:
# 1. Analyze the goal from multiple perspectives
# 2. Create a strategic plan
# 3. Hire necessary team members (CTO, CMO, CFO, etc.)
# 4. Each hired agent further delegates as needed

# Monitor progress
recursive-manager status

# Output:
# ┌─ Organization Chart ─────────────────────────┐
# │ CEO                                          │
# │  ├─ CTO (Build the application)             │
# │  │  ├─ Backend Dev (API development)        │
# │  │  └─ Frontend Dev (UI development)        │
# │  ├─ CMO (Market the product)                │
# │  └─ CFO (Manage finances)                   │
# └──────────────────────────────────────────────┘
```

## Documentation

### Planning Documents

- **[COMPREHENSIVE_PLAN.md](./COMPREHENSIVE_PLAN.md)** - Complete system architecture and design
- **[MULTI_PERSPECTIVE_ANALYSIS.md](./MULTI_PERSPECTIVE_ANALYSIS.md)** - Analysis from 8 expert perspectives
- **[FILE_STRUCTURE_SPEC.md](./FILE_STRUCTURE_SPEC.md)** - Detailed file structure and schemas
- **[EDGE_CASES_AND_CONTINGENCIES.md](./EDGE_CASES_AND_CONTINGENCIES.md)** - Edge case handling
- **[IMPLEMENTATION_PHASES.md](./IMPLEMENTATION_PHASES.md)** - Phased implementation plan

### Core Concepts

#### Agent Hierarchy

Each agent has:
- **Identity**: Role, goal, capabilities
- **Manager**: Reports to another agent (except CEO)
- **Subordinates**: Can hire agents to delegate work
- **Workspace**: Personal directory for notes, tasks, research

#### Execution Modes

1. **Continuous**: Picks up next pending task, executes it, updates progress
2. **Reactive**: Triggered by messages (Slack, Telegram, manager, etc.)
3. **Scheduled**: Time-based triggers (daily standup, weekly review, etc.)

#### Task Management

- **Hierarchical**: Tasks can nest indefinitely (with depth limits)
- **Delegatable**: Tasks can be assigned to subordinate agents
- **Traceable**: Full audit trail of all task changes
- **Archivable**: Completed tasks archived to prevent clutter

#### Multi-Perspective Analysis

Before major decisions (hiring, firing, strategic changes), agents spawn sub-agents to analyze from multiple perspectives:
- Security: What are the risks?
- Architecture: Is this scalable?
- Simplicity: Is this the simplest solution?
- Financial: What's the cost/benefit?
- UX: How does this affect user experience?

Results synthesized into a decision with confidence levels and reasoning.

## Architecture

```
┌─────────────────────────────────────────┐
│           CLI Tool                      │
│  (User-facing interface)                │
└───────────┬─────────────────────────────┘
            │
┌───────────▼─────────────────────────────┐
│      Scheduler Daemon                   │
│  (Time-based + event triggers)          │
└───────────┬─────────────────────────────┘
            │
┌───────────▼─────────────────────────────┐
│    Core Orchestrator                    │
│  (Framework-agnostic execution)         │
└─┬─────────┬─────────────┬───────────────┘
  │         │             │
┌─▼──────┐ ┌▼──────────┐ ┌▼─────────────┐
│ Claude │ │ OpenCode  │ │ Future       │
│ Code   │ │           │ │ Adapters     │
└────────┘ └───────────┘ └──────────────┘

┌─────────────────────────────────────────┐
│   Messaging Integration Layer           │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │ Slack  │ │Telegram│ │ Email  │      │
│  └────────┘ └────────┘ └────────┘      │
└─────────────────────────────────────────┘

            ▼

┌─────────────────────────────────────────┐
│     File-Based State Storage            │
│  agents/{shard}/{agent-id}/             │
│    ├── config.json                      │
│    ├── schedule.json                    │
│    ├── tasks/                           │
│    ├── inbox/                           │
│    └── workspace/                       │
└─────────────────────────────────────────┘
```

## Project Status

**Current Phase**: Planning & Design

This repository contains comprehensive planning documents for the RecursiveManager system. Implementation will begin once the plan is reviewed and approved.

### Implementation Phases

1. **Phase 1**: Foundation (file system, database, logging)
2. **Phase 2**: Core agent system (lifecycle, tasks)
3. **Phase 3**: Execution engine (framework adapters, orchestration)
4. **Phase 4**: Scheduling (time-based + continuous triggers)
5. **Phase 5**: Messaging (Slack, Telegram integrations)
6. **Phase 6**: CLI & UX (commands, wizard, debugging)
7. **Phase 7**: Observability (tracing, metrics, monitoring)
8. **Phase 8**: Security & resilience (sandboxing, circuit breakers)
9. **Phase 9**: Multi-framework support (OpenCode adapter)
10. **Phase 10**: Documentation & examples

See [IMPLEMENTATION_PHASES.md](./IMPLEMENTATION_PHASES.md) for details.

## Design Principles

### Complexity Management

RecursiveManager is inherently complex (recursive hierarchies, multi-framework support, distributed state). We manage this complexity through:

1. **Progressive Disclosure**: Simple by default, powerful when needed
2. **Clear Abstractions**: Hide implementation details behind clean interfaces
3. **Excellent Documentation**: Every feature explained with examples
4. **Smart Defaults**: Works out-of-box for common use cases
5. **Actionable Errors**: Error messages include suggested fixes
6. **Debugging Tools**: Single-command insights into system state

### Developer Experience

- **One-command start**: `recursive-manager init "goal"`
- **Convention over configuration**: Sensible defaults everywhere
- **Self-documenting**: Files include README.md and comments
- **Fail fast**: Validate early, fail with clear messages
- **Easy debugging**: `recursive-manager debug <agent-id>` shows everything

### Testing Strategy

- **Unit Tests**: 80%+ coverage, fast feedback
- **Integration Tests**: Component interactions validated
- **E2E Tests**: Full user journeys tested
- **Performance Tests**: Scalability to 1000+ agents
- **Edge Case Tests**: Every contingency tested

See [Edge Cases document](./EDGE_CASES_AND_CONTINGENCIES.md) for comprehensive edge case catalog.

## Use Cases

### Software Development

```bash
# CEO hires CTO
# CTO hires Backend Dev, Frontend Dev, DevOps
# Each dev implements their piece
# CTO coordinates integration
# CEO reviews final product
```

### Content Creation

```bash
# CEO hires Content Strategist
# Strategist hires Writers, Editors, SEO Specialist
# Writers create content
# Editors review
# SEO optimizes
# Strategist publishes
```

### Data Analysis

```bash
# CEO hires Data Scientist
# Data Scientist hires Data Engineer, ML Engineer
# Data Engineer builds pipeline
# ML Engineer trains models
# Data Scientist synthesizes insights
```

### Customer Support

```bash
# CEO hires Support Manager
# Support Manager monitors Slack/Email
# Escalates to specialists as needed
# Specialists resolve issues
# Support Manager follows up
```

## Contributing

We welcome contributions! This project is in the planning phase. Contributions to the planning documents are especially valuable:

1. Review the planning documents
2. Identify gaps or issues
3. Suggest improvements
4. Open an issue or PR

Once implementation begins, we'll need:
- Developers (TypeScript, Node.js)
- Technical writers (documentation)
- Testers (edge case hunters)
- DevOps engineers (CI/CD, deployment)

## License

MIT License - see [LICENSE](./LICENSE) for details

## Acknowledgments

This project is inspired by:
- **Ralph**: The autonomous development loop concept
- **AICEO**: The multi-agent analysis approach
- **Real organizations**: How businesses actually delegate and coordinate

## Contact

- **GitHub**: [RecursiveManager](https://github.com/yourusername/RecursiveManager)
- **Issues**: [Report bugs or request features](https://github.com/yourusername/RecursiveManager/issues)

---

**Status**: Planning phase - comprehensive documentation complete, implementation pending

**Philosophy**: Quality over cost. Multi-perspective analysis. Stateless execution. Business-like structure.

**Goal**: Enable AI agents to coordinate like real organizations, handling complex, long-running projects autonomously.
