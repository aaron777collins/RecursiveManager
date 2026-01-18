# RecursiveManager

**Recursive AI agent management system - hierarchical, autonomous, and adaptive**

RecursiveManager is a CLI tool that enables AI agents to operate like employees in an organization. Each agent can hire, fire, delegate, and escalate - creating a recursive hierarchy that adapts to complex tasks.

## Core Concept

Think of it like a company structure, but with AI agents:

- **CEO Agent**: Given a main goal (e.g., "Build a SaaS product")
- **Hiring**: CEO analyzes goal, decides to hire CTO, CMO, CFO
- **Delegation**: CTO receives goal "Build the product", hires Backend & Frontend developers
- **Recursion**: Each agent can hire their own team when tasks become complex
- **Fresh Memory**: Every execution starts fresh - agents read all context from files
- **Dual Modes**: Proactive (time-based + continuous work) and Reactive (messages, events)

## Why RecursiveManager?

**Problem**: Single AI sessions get dumber as context grows. Complex projects need structure.

**Solution**: Recursive delegation with fresh memory every run.

**Benefits**:
- ✅ **Quality over cost**: Multi-perspective analysis (8+ viewpoints) for every decision
- ✅ **Scalable**: 1 agent or 1000 agents, the system adapts
- ✅ **Autonomous**: Agents manage their own schedules, tasks, and team
- ✅ **Transparent**: All state in files (Markdown, JSON), fully auditable
- ✅ **Adaptive**: Agents respond to messages, changes in priority, blockers

## Architecture Highlights

### File-Based State
```
agents/<agent-id>/
  config.json              # Identity, role, goal
  schedule.json            # Proactive triggers (continuous + time-based)
  tasks/active/            # Current work (hierarchical)
  tasks/archive/           # Completed work (keeps workspace clean)
  workspace/notes.md       # Long-term memory
  inbox/messages/          # Reactive triggers (Slack, email, etc.)
```

### Dual Execution Modes

**Continuous Instance**:
- Picks ONE task from list
- Multi-perspective analysis (security, architecture, UX, etc.)
- Executes OR delegates (hires sub-agent) OR escalates
- Updates progress, exits

**Reactive Instance**:
- Triggered by schedule (daily standup) OR message (Slack alert)
- Processes events, updates task list
- Exits (continuous instance picks up new tasks)

### Smart Spawning

Agents only run when there's work:
- **Continuous**: Only if pending tasks exist + interval elapsed
- **Reactive**: Only if time-based trigger fires OR message arrives
- **Result**: No wasted cycles saying "nothing to do"

### Multi-Perspective Analysis

Every major decision analyzed from 8+ perspectives:
1. **Security**: Threats, vulnerabilities, access control
2. **Architecture**: Scalability, modularity, technical debt
3. **Simplicity**: Developer experience, maintainability
4. **UX**: User experience, error messages
5. **Financial**: Cost, ROI, resource efficiency
6. **Operational**: Reliability, monitoring, debugging
7. **Emotional**: Team morale, communication, trust
8. **Growth**: Future-proofing, competitive advantage

**Synthesis**: Meta-analysis combines perspectives into actionable decision with trade-offs explicit.

## Quick Start

### Installation

```bash
# Via npm (when published)
npm install -g recursivemanager

# Via pip (when published)
pip install recursivemanager

# From source
git clone https://github.com/aaron777collins/RecursiveManager.git
cd RecursiveManager
make install
```

### Initialize

```bash
# Create CEO agent with your goal
rm init "Build a SaaS product for project management"

# CEO analyzes from 8 perspectives, creates initial plan
# CEO hires CTO, CMO, CFO (automatically)
# Each hired agent initializes themselves

# Start scheduler to enable proactive execution
rm scheduler start
```

### View Progress

```bash
# See all agents
rm status

# Visualize hierarchy
rm org-chart

# Check specific agent
rm debug CTO
```

### Interact

```bash
# Send message to agent
rm message product-manager-001 "Customer X is unhappy, investigate"

# Agent processes message, adds urgent task, responds
```

## Example Workflow

```bash
# 1. Initialize system
$ rm init "Build a mobile app"
CEO agent created. Analyzing goal from 8 perspectives...
CEO hired: CTO (goal: "Build the app"), CMO (goal: "Market the app")

# 2. CTO automatically starts working
$ rm logs CTO --follow
[09:00:00] Continuous instance started
[09:00:05] Task: "Build the app" - complex, delegating
[09:00:10] Multi-perspective analysis:
  - Architecture: Mobile-first, React Native recommended
  - Security: Auth required, API security critical
  - Simplicity: Start with MVP, iterate
[09:00:30] Decision: Hire specialized developers
[09:00:35] Hiring: Mobile Developer (goal: "Build React Native app")
[09:00:40] Hiring: Backend Developer (goal: "Build API")

# 3. Developers work autonomously
$ rm status
AGENT                 ROLE                STATUS    TASKS    LAST RUN
CEO                   CEO                 active    2        1min ago
CTO                   CTO                 active    1        30sec ago
mobile-dev-001        Mobile Developer    active    3        10sec ago
backend-dev-001       Backend Developer   active    2        5sec ago

# 4. Customer escalation via Slack
@ProductManager: "Customer Y says app crashes on login!"

# Product manager receives message, adds urgent task
$ rm inbox product-manager-001
UNREAD (1):
- [URGENT] from slack-user-jane: "Customer Y says app crashes..."

# Product manager delegates to mobile-dev-001
$ rm tasks mobile-dev-001
- [ ] **URGENT:** Fix crash on login (DELEGATED from product-manager-001)
- [ ] Implement home screen
- [ ] Add push notifications
```

## Key Features

### Hierarchical Task Management
- Tasks can be simple (checkbox) or complex (nested folder with plan + subtasks)
- Completed tasks auto-archived (keeps workspace clean)
- Tasks can reference other tasks (hierarchical)

### Self-Scheduling
- Agents set their own schedules based on task needs
- Continuous (work when tasks pending) + Time-based (daily standup, weekly report)
- Dynamically adjustable (agent can change its own schedule)

### Manager-Worker Duality
- Manager delegates task, keeps high-level tracking
- Worker executes task, reports back with "just right" context
- Both responsible for task completion

### Messaging Integration
- Slack, Telegram, Email (modular)
- Standardized message format
- Priority detection (urgent keywords)
- Routing: Direct mention > Channel mapping > Keyword > CEO

### Framework Agnostic
- Primary: Claude Code
- Secondary: OpenCode (fallback)
- Extensible: Add new frameworks via adapter interface

## Implementation Status

🚧 **Currently in planning phase**

See [COMPREHENSIVE_PLAN.md](./COMPREHENSIVE_PLAN.md) for full implementation roadmap.

**Planned Phases** (18 weeks):
1. Foundation (file structure, CLI, manual execution)
2. Execution Engine (framework adapters, orchestration)
3. Scheduling (daemon, smart spawning)
4. Messaging (Slack, Telegram, Email modules)
5. Task Management (hierarchical, archival)
6. Multi-Perspective Analysis (8 perspectives, synthesis)
7. OpenCode Adapter (secondary framework)
8. CLI UX (visualization, help system)
9. Edge Cases & Resilience (30+ cases handled)
10. Documentation & Examples
11. Security Hardening
12. Performance Optimization

## Design Principles

1. **Quality over cost**: Multi-perspective analysis always, even if slow/expensive
2. **Fresh memory**: Zero context between runs, all state from files
3. **Smart defaults**: Works out-of-box, advanced options available
4. **Recursive delegation**: Non-trivial tasks spawn sub-agents
5. **Adaptive**: Agents respond to events, adjust schedules, change goals
6. **Transparent**: All state in human-readable files (Markdown, JSON)
7. **Fault-tolerant**: Handles crashes, corruption, timeouts gracefully
8. **Security-conscious**: Sandboxing, input validation, audit logging

## Architecture Overview

```
User (CLI, Slack, Email)
    ↓
RecursiveManager Core
  ├─ Centralized Scheduler (scans agents every 60s, smart spawning)
  ├─ Messaging Relay (Slack, Telegram, Email → standardized format)
  ├─ Agent Orchestrator (load context, execute, update state)
  └─ Framework Adapters (Claude Code, OpenCode)
    ↓
File System State
  ├─ agents/<agent-id>/ (config, tasks, inbox, workspace)
  └─ system/ (org_chart, process_registry, audit_log)
```

## Contributing

See [COMPREHENSIVE_PLAN.md](./COMPREHENSIVE_PLAN.md) for architecture details.

**Areas needing help**:
- Framework adapters (OpenCode, others)
- Messaging modules (Telegram, Email)
- Testing (edge cases, performance)
- Documentation (tutorials, examples)

## License

MIT (to be added)

## Credits

Created by Aaron Collins (@aaron777collins)

Inspired by:
- [Ralph](https://github.com/aaron777collins/ralph) - Autonomous coding agent
- [AICEO](https://github.com/aaron777collins/AICEO) - Multi-agent development system
- Organizational management theory (delegation, span of control)

Co-designed with Claude Sonnet 4.5 via multi-perspective analysis.

## Links

- [GitHub](https://github.com/aaron777collins/RecursiveManager)
- [Comprehensive Plan](./COMPREHENSIVE_PLAN.md)
- [Roadmap](https://github.com/aaron777collins/RecursiveManager/issues)

---

**Status**: 📋 Planning Complete | 🚧 Implementation Pending | 🎯 Target: Q2 2026

*RecursiveManager: Where AI agents work like people, and complex tasks become manageable.*
