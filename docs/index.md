# RecursiveManager

<div class="hero" markdown>
<h2 class="hero-subtitle">Hierarchical AI agent system for autonomous task management</h2>
<p class="hero-description">Mimics organizational structures with recursive delegation, multi-perspective analysis, and file-based persistence</p>

<div class="hero-buttons" markdown>
[Get Started](installation.md){ .md-button .md-button--primary }
[View on GitHub](https://github.com/aaron777collins/RecursiveManager){ .md-button }
</div>
</div>

---

## Features

<div class="grid cards" markdown>

-   :rocket:{ .lg .middle } **Quick Start**

    ---

    Get up and running in minutes with our one-liner installer and CLI.

    [:octicons-arrow-right-24: Installation](installation.md)

-   :books:{ .lg .middle } **Core Concepts**

    ---

    Learn about agent hierarchies, delegation, and multi-perspective analysis.

    [:octicons-arrow-right-24: Agent Hierarchy](concepts/agent-hierarchy.md)

-   :gear:{ .lg .middle } **Architecture**

    ---

    Deep dive into the system design, file structure, and database schema.

    [:octicons-arrow-right-24: Overview](architecture/overview.md)

-   :material-console:{ .lg .middle } **CLI Reference**

    ---

    Complete command reference for managing agents and tasks.

    [:octicons-arrow-right-24: Commands](cli-reference.md)

</div>

---

## Installation

Get started with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/main/scripts/install.sh | bash
```

For CI/CD environments, use headless mode:

```bash
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/main/scripts/install.sh | bash -s -- --headless --install-dir /opt/recursivemanager
```

Or install manually:

```bash
git clone https://github.com/aaron777collins/RecursiveManager.git
cd RecursiveManager
npm install
npm run build
npm link
```

---

## Organizational Hierarchy

RecursiveManager creates AI agents that operate like people in a company:

```
                    ┌─────────────┐
                    │     CEO     │
                    │  (Agent-1)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         ┌────▼────┐  ┌───▼────┐  ┌───▼────┐
         │  VP Eng │  │ VP Ops │  │VP Sales│
         │(Agent-2)│  │(Agent-3)│  │(Agent-4)│
         └────┬────┘  └───┬────┘  └────────┘
              │           │
       ┌──────┴──────┐    │
       │             │    │
  ┌────▼────┐   ┌───▼────▼───┐
  │ Backend │   │  Frontend  │
  │(Agent-5)│   │  (Agent-6) │
  └─────────┘   └────────────┘
```

Each agent can:
- **Hire subordinates** for specialized tasks
- **Delegate work** down the hierarchy
- **Report status** up to managers
- **Execute autonomously** in continuous or reactive mode

---

## How It Works

<div class="grid" markdown>

:material-account-tree:{ .lg } **Recursive Hierarchies** - Agents delegate to subordinates who can create their own sub-agents, mimicking real organizational structures
{ .card }

:material-eye-multiple:{ .lg } **Multi-Perspective Analysis** - Critical decisions analyzed from 8 perspectives (Security, Architecture, Simplicity, Financial, Marketing, UX, Growth, Emotional)
{ .card }

:material-file-document:{ .lg } **File-Based Persistence** - All state stored in files for transparency, debugging, and fresh context on each execution
{ .card }

:material-calendar-clock:{ .lg } **Smart Scheduling** - Dual execution modes (continuous/reactive) with intelligent scheduling via ExecutionPool and worker pools
{ .card }

</div>

---

## Use Cases

### 1. **Large-Scale Code Refactoring**
Break down a monolithic refactoring into hierarchical tasks, with specialized agents handling different modules.

```bash
recursivemanager init "Refactor monolith to microservices"
recursivemanager status
# CEO creates VPs for: Auth, Payments, Inventory, Shipping
# Each VP creates subordinates for: Database, API, Tests, Docs
```

### 2. **Multi-Perspective Decision Making**
Use the 8-perspective analysis framework for critical architectural decisions.

```bash
recursivemanager init "Choose database: SQL vs NoSQL"
# System analyzes from Security, Architecture, Simplicity,
# Financial, Marketing, UX, Growth, Emotional perspectives
# Generates comprehensive decision report
```

### 3. **Autonomous Task Management**
Let the system manage long-running tasks without manual intervention.

```bash
recursivemanager init "Implement OAuth2 login system"
# Continuous mode: agents work autonomously, reporting progress
# Reactive mode: agents respond to external events (PRs, issues)
```

### 4. **CI/CD Integration**
Integrate with CI/CD pipelines for automated code quality checks and deployments.

```bash
# In your GitHub Actions workflow
recursivemanager init "Review PR #123 for security issues" --headless
recursivemanager status --format json > report.json
```

---

## Key Features

### :shield: **Built-in Safety**
- **Recursion limits** prevent infinite delegation
- **Circular reporting detection** stops organizational loops
- **Deadlock prevention** with timeout mechanisms
- **Resource exhaustion protection** via worker pools

### :zap: **Performance**
- **Parallel execution** with ExecutionPool
- **Efficient scheduling** with idle worker detection
- **Minimal overhead** with stateless execution
- **Scalable architecture** supporting 100+ agents

### :dart: **Quality Over Cost**
- **Multi-perspective analysis** for major decisions
- **Comprehensive error handling** for 28+ edge cases
- **Fresh context** on each execution (no decay)
- **Transparent state** via file-based persistence

### :electric_plug: **Multi-Framework Support**
- **Claude Code** adapter (primary)
- **OpenCode** adapter (planned)
- **Custom adapters** via pluggable interface
- **Framework-agnostic** core architecture

---

## Core Philosophy

RecursiveManager prioritizes **correctness and reliability** over speed and cost:

1. **Quality First** - Multi-perspective analysis prevents tunnel vision
2. **Stateless Execution** - Fresh context from files prevents decay
3. **Defensive Programming** - Validation, locking, and atomic operations
4. **Transparent State** - All state visible in files for debugging
5. **Comprehensive Edge Cases** - 28+ documented scenarios handled

Unlike traditional automation tools, RecursiveManager:

- **Thinks hierarchically** like a real organization
- **Maintains fresh context** without long-running processes
- **Prioritizes quality** through multi-perspective analysis
- **Framework agnostic** with pluggable adapters
- **Fully debuggable** with file-based state

---

## Project Status

🚀 **Alpha Release (v0.1.0)** - Core features implemented and tested

Current capabilities:
- ✅ Recursive agent hierarchy system
- ✅ File-based persistence with agent workspaces
- ✅ Multi-perspective analysis (8 perspectives)
- ✅ Decision synthesis framework
- ✅ Agent locking mechanisms (async-mutex)
- ✅ ExecutionPool with worker pool pattern
- ✅ PID file management
- ✅ Comprehensive unit and integration tests
- ✅ Monorepo structure (Turborepo)
- ✅ CLI with interactive commands

See the [CHANGELOG](https://github.com/aaron777collins/RecursiveManager/blob/main/CHANGELOG.md) for detailed release notes.

---

## Getting Started

Ready to dive in? Follow these guides:

<div class="grid cards" markdown>

-   :material-clock-fast:{ .lg } **5-Minute Quick Start**

    Get up and running with your first agent hierarchy

    [:octicons-arrow-right-24: Quick Start](quick-start.md)

-   :material-cog:{ .lg } **Configuration**

    Customize RecursiveManager for your needs

    [:octicons-arrow-right-24: Configuration](configuration.md)

-   :material-code-tags:{ .lg } **API Reference**

    Deep dive into the core classes and methods

    [:octicons-arrow-right-24: API Reference](api-reference.md)

-   :material-heart:{ .lg } **Contributing**

    Join the development and help improve the project

    [:octicons-arrow-right-24: Contributing](development/contributing.md)

</div>

---

## Community & Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/aaron777collins/RecursiveManager/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/aaron777collins/RecursiveManager/discussions)
- **Documentation**: [Comprehensive guides and references](https://aaron777collins.github.io/RecursiveManager/)

---

<div class="cta-section" markdown>

## Ready to Get Started?

<div class="cta-buttons" markdown>
[Install Now](installation.md){ .md-button .md-button--primary .md-button--large }
[Read the Docs](quick-start.md){ .md-button .md-button--large }
[View on GitHub](https://github.com/aaron777collins/RecursiveManager){ .md-button .md-button--large }
</div>

</div>
