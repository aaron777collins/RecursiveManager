---
layout: home

hero:
  name: RecursiveManager
  text: Hierarchical AI Agent System
  tagline: Recursive delegation, autonomous task management, and multi-framework support
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/yourusername/RecursiveManager

features:
  - icon: 🏢
    title: Organizational Structure
    details: Agents operate like people in a company - hiring subordinates, managing tasks, and escalating issues through a clear hierarchy.

  - icon: 🔄
    title: Dual Execution Modes
    details: Continuous mode for active work and reactive mode for message-driven execution, with intelligent scheduling.

  - icon: 📁
    title: File-Based Persistence
    details: All state stored in files for transparency and debugging. Fresh memory on each execution prevents context decay.

  - icon: 🎯
    title: Multi-Perspective Analysis
    details: Quality over cost - analyze decisions from multiple perspectives before critical actions.

  - icon: 🔌
    title: Multi-Framework Support
    details: Start with Claude Code, expand to OpenCode and future frameworks via pluggable adapters.

  - icon: 🛡️
    title: Resilient & Secure
    details: Built-in safeguards against recursion explosion, circular reporting, deadlocks, and resource exhaustion.
---

## Quick Start

```bash
# Install RecursiveManager
npm install -g recursive-manager

# Initialize the system
recursive-manager init

# Create your first agent
recursive-manager hire --role "CEO" --goal "Manage the organization"

# Check the org chart
recursive-manager status

# Send a message to an agent
recursive-manager message CEO "Start working on project X"
```

## Core Philosophy

**Quality over cost.** RecursiveManager prioritizes correctness and reliability through:

- **Multi-perspective analysis** before all major decisions
- **Stateless execution** with fresh context from files each run
- **Comprehensive edge case handling** for 28+ documented scenarios
- **Transparent state** via file-based persistence
- **Defensive programming** with validation, locking, and atomic operations

## What Makes It Different?

Unlike traditional task automation tools, RecursiveManager:

1. **Thinks hierarchically** - Agents delegate to subordinates like a real organization
2. **Maintains fresh context** - No context decay from long-running processes
3. **Quality-first** - Multi-perspective analysis prevents tunnel vision
4. **Framework agnostic** - Adapters allow switching between AI coding frameworks
5. **Debuggable** - All state visible in files, full audit trail

## Status

🚧 **Currently in development** - See [Implementation Phases](/contributing/implementation-phases) for progress.

The architecture is fully designed with 209 detailed tasks across 10 implementation phases. We're currently in **Phase 1: Foundation & Core Infrastructure**.

## Learn More

- [Introduction](/guide/introduction) - Understand the core concepts
- [Quick Start Guide](/guide/quick-start) - Get running in 5 minutes
- [Architecture Overview](/architecture/overview) - Deep dive into the design
- [Contributing Guide](/contributing/getting-started) - Join the development
