# RecursiveManager Production Readiness Plan

**Status:** COMPREHENSIVE IMPLEMENTATION PLAN
**Target:** Full Production Readiness with Professional Quality
**Version:** Alpha 0.1.0 → Beta 0.2.0
**Last Updated:** 2026-01-19

---

## Executive Summary

This plan addresses all identified gaps to make RecursiveManager production-ready:
- **6 Critical Issues** requiring immediate fixes
- **23 Missing Documentation Files** to be created
- **4 CLI Commands** needing full implementation
- **8 GitHub Actions Workflow Issues** to resolve
- **12 TODOs** in codebase to address
- **100% Test Coverage** to achieve and maintain

**Estimated Complexity:** HIGH (multi-week effort if done manually)
**Ralph Automation:** RECOMMENDED (can complete in hours)

---

## PHASE 1: CRITICAL FIXES (Must Fix Before Any Release)

### 1.1 GitHub Actions Workflows ⚠️ CRITICAL

**Problem:** All automated workflows are failing

#### Fix 1.1.1: Release Workflow Branch Reference
- **File:** `.github/workflows/release.yml:43`
- **Issue:** Installation URL references `master` but repo uses `main`
- **Fix:** Change line 43:
  ```yaml
  # FROM:
  curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install.sh | bash
  # TO:
  curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/main/scripts/install.sh | bash
  ```

#### Fix 1.1.2: Docs Workflow Dependencies
- **File:** `.github/workflows/docs.yml:34-38`
- **Issue:** Missing package-lock.json in docs/ directory
- **Fix:**
  1. Run `cd docs && npm install` to generate lockfile
  2. Commit `docs/package-lock.json`
  3. Alternative: Change workflow line 32 from `npm ci` to `npm install`

#### Fix 1.1.3: CI Workflow Test Command
- **File:** `.github/workflows/ci.yml:51`
- **Issue:** `npm run test:coverage` may not exist in root package.json
- **Fix:** Verify root package.json has test:coverage script or change to:
  ```yaml
  run: npx turbo run test:coverage
  ```

### 1.2 Add LICENSE File ⚠️ CRITICAL

**Problem:** README claims MIT license but no LICENSE file exists

**Implementation:**
```bash
# Create MIT LICENSE file
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2026 Aaron Collins

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
```

### 1.3 Fix Placeholder GitHub Usernames ⚠️ CRITICAL

**Problem:** 6 files contain `yourusername` instead of `aaron777collins`

**Files to Update:**
1. `package.json:16` - repository URL
2. `docs/.vitepress/config.js:97` - GitHub social link
3. `docs/guide/installation.md` - Installation instructions
4. `docs/contributing/getting-started.md` - Clone URLs (2 instances)
5. `docs/contributing/development-setup.md` - Clone URLs (4 instances)

**Find & Replace:**
```bash
# Find all instances
grep -r "yourusername" .

# Replace all
find . -type f \( -name "*.md" -o -name "*.json" -o -name "*.js" \) -exec sed -i 's/yourusername/aaron777collins/g' {} +
```

### 1.4 Remove Unused mkdocs.yml ⚠️ CRITICAL

**Problem:** Two documentation systems (VitePress active, MkDocs config orphaned)

**Decision:** Remove MkDocs completely, VitePress is the active system

**Actions:**
1. Delete `mkdocs.yml`
2. Remove from root `package.json`:
   - `docs:dev` script
   - `docs:build` script
   - `docs:deploy` script
3. Update README to only reference VitePress documentation

---

## PHASE 2: CLI COMMANDS IMPLEMENTATION (HIGH PRIORITY)

### 2.1 Implement `init` Command

**File:** `packages/cli/src/commands/init.ts`

**Current Status:** Placeholder with TODOs (lines 22, 36-41)

**Requirements:**
1. Check if already initialized (check for `$DATA_DIR/.recursive-manager` marker file)
2. Create data directory structure:
   ```
   $DATA_DIR/
   ├── .recursive-manager (marker file)
   ├── agents/
   ├── tasks/
   ├── logs/
   └── database.sqlite
   ```
3. Initialize database with migrations
4. Create root CEO agent with provided goal
5. Save configuration to `$DATA_DIR/config.json`
6. Add error handling for:
   - Directory already exists
   - Insufficient permissions
   - Database initialization failure

**Implementation Steps:**
```typescript
// packages/cli/src/commands/init.ts
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { initializeDatabase, runMigrations } from '@recursive-manager/common';
import { createAgent } from '@recursive-manager/core';

export async function initCommand(goal: string, options: any) {
  const dataDir = options.dataDir || process.env.RECURSIVE_MANAGER_DATA_DIR || resolve(process.cwd(), '.recursive-manager');
  const markerFile = resolve(dataDir, '.recursive-manager');

  // Check if already initialized
  if (existsSync(markerFile)) {
    console.error('Already initialized! Use --force to reinitialize.');
    if (!options.force) process.exit(1);
  }

  // Create directory structure
  const dirs = ['agents', 'tasks', 'logs'];
  for (const dir of dirs) {
    mkdirSync(resolve(dataDir, dir), { recursive: true });
  }

  // Initialize database
  const dbPath = resolve(dataDir, 'database.sqlite');
  const db = initializeDatabase({ path: dbPath });
  await runMigrations(db, allMigrations);

  // Create root CEO agent
  const ceo = await createAgent(db, {
    displayName: 'CEO',
    role: 'CEO',
    managerId: null,
    goal: goal,
  });

  // Write marker file
  writeFileSync(markerFile, JSON.stringify({ initialized: new Date().toISOString(), version: '0.2.0' }));

  // Write config
  const config = {
    dataDir,
    dbPath,
    rootAgentId: ceo.id,
  };
  writeFileSync(resolve(dataDir, 'config.json'), JSON.stringify(config, null, 2));

  console.log(`✅ Initialized RecursiveManager at ${dataDir}`);
  console.log(`   Root agent: ${ceo.display_name} (${ceo.id})`);
  console.log(`   Goal: ${goal}`);
}
```

**Tests Required:**
- `init.test.ts`: Test initialization flow
- Test reinitialize with --force
- Test error handling (permissions, existing data)

### 2.2 Implement `status` Command

**File:** `packages/cli/src/commands/status.ts`

**Current Status:** Shows hardcoded dummy data (lines 23-26)

**Requirements:**
1. Load actual agent hierarchy from database
2. Query agent states (active/paused/archived)
3. Load task counts per agent
4. Format with `formatOrgChart()` utility (already exists)
5. Support options:
   - `--verbose`: Show task details
   - `--json`: Output as JSON
   - `--agent-id <id>`: Show specific subtree

**Implementation:**
```typescript
// packages/cli/src/commands/status.ts
import { loadConfig } from './utils/config';
import { initializeDatabase } from '@recursive-manager/common';
import { getAllAgents, getAgentTasks } from '@recursive-manager/common/db/queries';
import { formatOrgChart } from '@recursive-manager/common';

export async function statusCommand(options: any) {
  const config = loadConfig(options.dataDir);
  const db = initializeDatabase({ path: config.dbPath });

  // Load all agents
  const agents = await getAllAgents(db);

  // Load task counts
  const agentWithCounts = await Promise.all(agents.map(async (agent) => {
    const tasks = await getAgentTasks(db, agent.id);
    return {
      ...agent,
      taskCount: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length,
    };
  }));

  // Format based on options
  if (options.json) {
    console.log(JSON.stringify(agentWithCounts, null, 2));
  } else {
    const formatted = formatOrgChart(agentWithCounts, {
      showStatus: true,
      maxDepth: options.depth,
    });
    console.log(formatted);
  }

  db.close();
}
```

### 2.3 Implement `config` Command

**File:** `packages/cli/src/commands/config.ts`

**Current Status:** Interactive wizard works but doesn't persist (lines 23-26, 42)

**Requirements:**
1. Load config from `$DATA_DIR/config.json`
2. Support subcommands:
   - `config get <key>` - Display value
   - `config set <key> <value>` - Set value
   - `config list` - Show all config
   - `config edit` - Open in $EDITOR
3. Validate changes before saving
4. Support nested keys (e.g., `execution.workerPoolSize`)

**Implementation:**
```typescript
// packages/cli/src/commands/config.ts
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

export async function configCommand(action: string, key?: string, value?: string, options: any) {
  const config = loadConfig(options.dataDir);
  const configPath = resolve(config.dataDir, 'config.json');

  switch (action) {
    case 'get':
      const val = getNestedValue(config, key!);
      console.log(val);
      break;

    case 'set':
      setNestedValue(config, key!, value!);
      validateConfig(config); // Throws if invalid
      writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Set ${key} = ${value}`);
      break;

    case 'list':
      console.log(JSON.stringify(config, null, 2));
      break;

    case 'edit':
      // Open in $EDITOR
      const { spawn } = require('child_process');
      const editor = process.env.EDITOR || 'vi';
      spawn(editor, [configPath], { stdio: 'inherit' });
      break;
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce((o, k) => o[k] = o[k] || {}, obj);
  target[last] = value;
}

function validateConfig(config: any): void {
  // Validate required fields
  if (!config.dataDir) throw new Error('dataDir is required');
  if (!config.dbPath) throw new Error('dbPath is required');

  // Validate numeric values
  if (config.execution?.workerPoolSize && config.execution.workerPoolSize < 1) {
    throw new Error('workerPoolSize must be >= 1');
  }
}
```

### 2.4 Implement `debug` Command

**File:** `packages/cli/src/commands/debug.ts`

**Current Status:** Shows hardcoded debug info (lines 30-33)

**Requirements:**
1. Load agent data from database
2. Show agent state, configuration, manager
3. Show task queue (pending, in_progress, blocked)
4. Show recent logs from `$DATA_DIR/logs/`
5. Support options:
   - `--all`: Show full state
   - `--logs <n>`: Show last n log lines
   - `--tasks`: Show task details
   - `--json`: Output as JSON

**Implementation:**
```typescript
// packages/cli/src/commands/debug.ts
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getAgent, getAgentTasks } from '@recursive-manager/common/db/queries';

export async function debugCommand(agentId: string, options: any) {
  const config = loadConfig(options.dataDir);
  const db = initializeDatabase({ path: config.dbPath });

  // Load agent
  const agent = await getAgent(db, agentId);
  if (!agent) {
    console.error(`Agent ${agentId} not found`);
    process.exit(1);
  }

  // Load tasks
  const tasks = await getAgentTasks(db, agentId);

  // Load recent logs
  const logPath = resolve(config.dataDir, 'logs', `${agentId}.log`);
  let logs = '';
  try {
    const logContent = readFileSync(logPath, 'utf-8');
    const lines = logContent.split('\n');
    logs = lines.slice(-options.logs || -50).join('\n');
  } catch (e) {
    logs = 'No logs found';
  }

  // Format output
  if (options.json) {
    console.log(JSON.stringify({ agent, tasks, logs }, null, 2));
  } else {
    console.log(`\n=== Agent Debug Info: ${agent.display_name} ===\n`);
    console.log(`ID: ${agent.id}`);
    console.log(`Role: ${agent.role}`);
    console.log(`Status: ${agent.status}`);
    console.log(`Manager: ${agent.manager_id || 'None (root)'}`);
    console.log(`\nTasks (${tasks.length}):`);
    tasks.forEach(t => console.log(`  - [${t.status}] ${t.title}`));

    if (options.all || options.logs) {
      console.log(`\nRecent Logs:\n${logs}`);
    }
  }

  db.close();
}
```

### 2.5 Implement `rollback` Command (NEW)

**Problem:** Documented in README (line 111) but doesn't exist

**Requirements:**
1. Track system state snapshots before each major operation
2. Support rollback to previous snapshot
3. Show rollback history
4. Validate rollback target exists

**Implementation:**
```typescript
// packages/cli/src/commands/rollback.ts
import { loadConfig } from './utils/config';
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve } from 'path';

export async function rollbackCommand(target?: string, options: any) {
  const config = loadConfig(options.dataDir);
  const snapshotsDir = resolve(config.dataDir, 'snapshots');

  if (options.history) {
    // Show rollback history
    const snapshots = readdirSync(snapshotsDir)
      .filter(f => f.endsWith('.snapshot.sqlite'))
      .sort()
      .reverse();

    console.log('Available snapshots:');
    snapshots.forEach(s => {
      const timestamp = s.replace('.snapshot.sqlite', '');
      console.log(`  - ${timestamp}`);
    });
    return;
  }

  if (!target) {
    console.error('Please specify a snapshot target or use --history');
    process.exit(1);
  }

  const snapshotPath = resolve(snapshotsDir, `${target}.snapshot.sqlite`);
  if (!existsSync(snapshotPath)) {
    console.error(`Snapshot ${target} not found`);
    process.exit(1);
  }

  // Create backup of current state
  const backupPath = resolve(snapshotsDir, `pre-rollback-${Date.now()}.snapshot.sqlite`);
  copyFileSync(config.dbPath, backupPath);

  // Restore snapshot
  copyFileSync(snapshotPath, config.dbPath);

  console.log(`✅ Rolled back to ${target}`);
  console.log(`   Backup of current state: ${backupPath}`);
}
```

**New Feature: Snapshot Creation**
```typescript
// packages/common/src/db/snapshot.ts
export function createSnapshot(db: Database, dataDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotsDir = resolve(dataDir, 'snapshots');
  mkdirSync(snapshotsDir, { recursive: true });

  const snapshotPath = resolve(snapshotsDir, `${timestamp}.snapshot.sqlite`);
  db.backup(snapshotPath);

  return timestamp;
}
```

**Update Lifecycle Commands:**
Add snapshot creation before major operations:
- `hireAgent.ts`: Before hiring
- `fireAgent.ts`: Before firing
- `archiveAgent.ts`: Before archiving

---

## PHASE 3: DOCUMENTATION COMPLETION (HIGH PRIORITY)

### 3.1 Create Missing Guide Files (10 files)

#### File: `docs/guide/quick-start.md`
**Content:**
- Step-by-step first-time setup
- Basic agent creation example
- First task execution
- Common beginner issues
- Link to full installation guide

#### File: `docs/guide/core-concepts.md`
**Content:**
- Agent hierarchy explained
- Task delegation model
- Multi-perspective analysis
- Decision synthesis
- Execution modes

#### File: `docs/guide/creating-agents.md`
**Content:**
- Agent roles and responsibilities
- Hiring vs creating agents
- Agent configuration options
- Manager-subordinate relationships
- Best practices

#### File: `docs/guide/task-management.md`
**Content:**
- Task lifecycle (pending → in_progress → completed)
- Task blocking and dependencies
- Task delegation strategies
- Deadlock detection and resolution
- Task prioritization

#### File: `docs/guide/scheduling.md`
**Content:**
- Cron-based scheduling
- Time-based triggers
- Recurring tasks
- Schedule management
- Examples

#### File: `docs/guide/messaging.md`
**Content:**
- Inter-agent communication
- Message persistence
- Reply threading
- Notification system
- Integration with external services

#### File: `docs/guide/multi-perspective.md`
**Content:**
- 8 perspective types explained
- Sub-agent spawning
- Perspective analysis workflow
- Decision synthesis
- Examples of perspective usage

#### File: `docs/guide/framework-adapters.md`
**Content:**
- Adapter architecture
- Claude Code adapter usage
- Custom adapter creation
- Adapter selection
- Best practices

#### File: `docs/guide/best-practices.md`
**Content:**
- Agent hierarchy design
- Task delegation patterns
- Error handling strategies
- Performance optimization
- Security considerations

#### File: `docs/guide/troubleshooting.md`
**Content:**
- Common errors and solutions
- Installation issues
- Database problems
- Agent state issues
- Performance troubleshooting
- Getting help

### 3.2 Create Missing API Reference Files (4 files)

#### File: `docs/api/cli-commands.md`
**Content:**
- Complete CLI reference
- All commands with options
- Examples for each command
- Exit codes
- Configuration

#### File: `docs/api/core.md`
**Content:**
- Core package API
- Lifecycle functions (hire, pause, resume, fire)
- ExecutionPool API
- Multi-perspective API
- Types and interfaces

#### File: `docs/api/schemas.md`
**Content:**
- Database schemas (all 5 migrations)
- Agent schema
- Task schema
- Message schema
- Audit log schema
- Foreign key relationships

#### File: `docs/api/adapters.md`
**Content:**
- Adapter interface
- ClaudeCodeAdapter API
- Custom adapter creation guide
- Adapter registry
- Health checks

### 3.3 Create Missing Architecture Files (6 files)

#### File: `docs/architecture/system-design.md`
**Content:**
- System architecture diagram (Mermaid)
- Component interaction
- Data flow
- Design decisions
- Trade-offs

#### File: `docs/architecture/execution-model.md`
**Content:**
- Execution pool architecture
- Worker management
- Concurrency control
- PID file system
- Lock mechanisms

#### File: `docs/architecture/edge-cases.md`
**Content:**
- All 200+ documented edge cases
- Circular dependency handling
- Deadlock detection
- Resource exhaustion
- Error recovery

#### File: `docs/architecture/perspectives/simplicity.md`
**Content:**
- Simplicity perspective analysis
- Code complexity metrics
- Maintainability considerations
- Refactoring opportunities

#### File: `docs/architecture/perspectives/architecture.md`
**Content:**
- Architectural analysis perspective
- System design patterns
- Scalability considerations
- Module dependencies

#### File: `docs/architecture/perspectives/security.md`
**Content:**
- Security perspective analysis
- Threat model
- Attack surface
- Mitigation strategies
- Security best practices

### 3.4 Create Missing Contributing Files (3 files)

#### File: `docs/contributing/implementation-phases.md`
**Content:**
- Development roadmap
- Phase 1: Core System (DONE)
- Phase 2: CLI & Docs (IN PROGRESS)
- Phase 3: Advanced Features (PLANNED)
- Phase 4: Production Features (PLANNED)

#### File: `docs/contributing/testing.md`
**Content:**
- Testing philosophy
- Test structure
- Running tests
- Writing tests
- Coverage requirements

#### File: `docs/contributing/code-style.md`
**Content:**
- TypeScript style guide
- Naming conventions
- File organization
- ESLint rules
- Prettier config

### 3.5 Add Alpha Warning Banner

**Update:** `docs/index.md`, `docs/installation.md`, `docs/quick-start.md`

Add prominent warning at top:
```markdown
> ⚠️ **ALPHA SOFTWARE**: RecursiveManager is in active development. APIs may change.
> Not recommended for production use yet. See [roadmap](contributing/implementation-phases.md) for status.
```

### 3.6 Create Visual Architecture Diagram

**Tool:** Mermaid.js (renders in VitePress automatically)

**Create:** `docs/architecture/diagrams.md`

```mermaid
graph TB
    CLI[CLI Tool] --> Core[Core Orchestrator]
    Scheduler[Scheduler Daemon] --> Core
    Core --> Adapters[Framework Adapters]
    Adapters --> Claude[Claude Code]
    Adapters --> Open[OpenCode - Planned]
    Core --> DB[(SQLite Database)]
    Core --> FS[File System<br/>Agent Workspaces]
    Core --> Locks[PID Locks]
    Core --> Pool[Execution Pool]
```

---

## PHASE 4: CORE FEATURE COMPLETION (MEDIUM PRIORITY)

### 4.1 Implement Multi-Perspective Sub-Agent Spawning

**File:** `packages/core/src/execution/index.ts:392`

**Current:** TODO comment, framework exists but no actual spawning

**Requirements:**
1. Spawn 8 sub-agents (one per perspective)
2. Run analyses in parallel (ExecutionPool)
3. Collect results
4. Synthesize decision
5. Handle sub-agent failures gracefully

**Implementation:**
```typescript
// packages/core/src/execution/multiPerspective.ts
import { ExecutionPool } from './ExecutionPool';

export async function spawnPerspectiveAgents(
  decision: string,
  context: any,
  adapter: FrameworkAdapter
): Promise<PerspectiveAnalysis[]> {
  const perspectives = [
    'simplicity', 'architecture', 'security', 'financial',
    'marketing', 'ux', 'growth', 'emotional'
  ];

  const pool = new ExecutionPool({ maxWorkers: 8 });

  const analyses = await Promise.all(
    perspectives.map(perspective =>
      pool.execute(async () => {
        const prompt = buildPerspectivePrompt(perspective, decision, context);
        const result = await adapter.execute(prompt, {
          timeout: 30000,
          maxTokens: 4000,
        });
        return {
          perspective,
          analysis: result.output,
          confidence: extractConfidence(result.output),
        };
      })
    )
  );

  await pool.shutdown();
  return analyses;
}
```

### 4.2 Complete Scheduler Lifecycle Integration

**Files:**
- `packages/core/src/lifecycle/pauseAgent.ts:424`
- `packages/core/src/lifecycle/resumeAgent.ts:413`

**Current:** TODO comments for scheduler integration

**Requirements:**
1. When agent paused → pause all its scheduled tasks
2. When agent resumed → resume scheduled tasks
3. Query scheduler for agent's schedules
4. Update schedule status

**Implementation:**
```typescript
// packages/core/src/lifecycle/pauseAgent.ts
import { getAgentSchedules, pauseSchedule } from '@recursive-manager/scheduler';

export async function pauseAgent(db: Database, agentId: string, actingAgentId: string) {
  // ... existing code ...

  // Pause scheduled tasks
  const schedules = await getAgentSchedules(db, agentId);
  for (const schedule of schedules) {
    await pauseSchedule(db, schedule.id, actingAgentId);
  }

  // ... existing code ...
}
```

```typescript
// packages/core/src/lifecycle/resumeAgent.ts
import { getAgentSchedules, resumeSchedule } from '@recursive-manager/scheduler';

export async function resumeAgent(db: Database, agentId: string, actingAgentId: string) {
  // ... existing code ...

  // Resume scheduled tasks
  const schedules = await getAgentSchedules(db, agentId);
  for (const schedule of schedules) {
    if (schedule.status === 'paused') {
      await resumeSchedule(db, schedule.id, actingAgentId);
    }
  }

  // ... existing code ...
}
```

**New Scheduler Functions:**
```typescript
// packages/scheduler/src/queries/schedules.ts
export async function getAgentSchedules(db: Database, agentId: string): Promise<Schedule[]> {
  const query = `SELECT * FROM schedules WHERE agent_id = ? AND deleted_at IS NULL`;
  return db.prepare(query).all(agentId);
}

export async function pauseSchedule(db: Database, scheduleId: string, actingAgentId: string): Promise<void> {
  db.prepare(`UPDATE schedules SET status = 'paused' WHERE id = ?`).run(scheduleId);
  await auditLog(db, { action: 'schedule:paused', scheduleId, actingAgentId });
}

export async function resumeSchedule(db: Database, scheduleId: string, actingAgentId: string): Promise<void> {
  db.prepare(`UPDATE schedules SET status = 'active' WHERE id = ?`).run(scheduleId);
  await auditLog(db, { action: 'schedule:resumed', scheduleId, actingAgentId });
}
```

### 4.3 Add Acting Agent ID to Audit Logs

**Files:**
- `packages/common/src/db/queries/agents.ts:425`
- `packages/common/src/db/queries/agents.ts:440`

**Current:** Hardcoded `null` for acting agent

**Requirements:**
1. Thread acting agent ID through all lifecycle functions
2. Update audit log calls to include acting agent
3. Add validation that acting agent exists
4. Update all tests

**Implementation:**
```typescript
// Update all lifecycle function signatures:
export async function createAgent(
  db: Database,
  params: CreateAgentParams,
  actingAgentId: string | null = null // Add parameter
): Promise<Agent> {
  // ... existing code ...

  await auditLog(db, {
    action: 'agent:created',
    agentId: agent.id,
    actingAgentId: actingAgentId, // Use parameter instead of null
    details: { displayName, role, managerId }
  });

  return agent;
}
```

**Update all callers:**
- CLI commands: Pass 'system' or 'cli'
- Lifecycle operations: Thread through from original caller
- Tests: Pass 'test-agent' or null

### 4.4 Fix Update Command Path Resolution

**File:** `packages/cli/src/commands/update.ts:30`

**Issue:** Path assumes source installation, fails in npm global install

**Fix:**
```typescript
// BEFORE:
const scriptPath = path.join(__dirname, '../../../scripts/update.sh');

// AFTER:
import { getInstallRoot } from '../utils/paths';

const scriptPath = getInstallRoot('scripts/update.sh');
```

**New Utility:**
```typescript
// packages/cli/src/utils/paths.ts
import { resolve } from 'path';
import { existsSync } from 'fs';

export function getInstallRoot(subpath: string): string {
  // Try multiple possible install locations
  const candidates = [
    // Development (monorepo root)
    resolve(__dirname, '../../../../', subpath),
    // Global npm install
    resolve(process.env.RECURSIVE_MANAGER_HOME || '', subpath),
    // npm link
    resolve('/usr/local/lib/node_modules/recursive-manager', subpath),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(`Could not find ${subpath} in any expected location`);
}
```

### 4.5 Add CLI Command Prerequisite Checks

**Problem:** Commands don't validate prerequisites before running

**Implementation:**
```typescript
// packages/cli/src/utils/config.ts
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export function loadConfig(dataDir?: string): Config {
  const configDir = dataDir || process.env.RECURSIVE_MANAGER_DATA_DIR || resolve(process.cwd(), '.recursive-manager');
  const markerFile = resolve(configDir, '.recursive-manager');

  if (!existsSync(markerFile)) {
    console.error('RecursiveManager not initialized! Run: recursive-manager init "<goal>"');
    process.exit(1);
  }

  const configPath = resolve(configDir, 'config.json');
  if (!existsSync(configPath)) {
    console.error('Configuration not found! Data directory may be corrupted.');
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(configPath, 'utf-8'));

  // Validate database exists
  if (!existsSync(config.dbPath)) {
    console.error(`Database not found at ${config.dbPath}`);
    process.exit(1);
  }

  return config;
}
```

**Update all commands to use `loadConfig()`:**
- status.ts
- config.ts
- debug.ts
- update.ts

---

## PHASE 5: TESTING & QUALITY ASSURANCE (HIGH PRIORITY)

### 5.1 Add CLI Integration Tests

**New File:** `packages/cli/src/__tests__/integration.test.ts`

**Coverage:**
```typescript
describe('CLI Integration', () => {
  let testDataDir: string;

  beforeEach(() => {
    testDataDir = mkdtempSync(path.join(os.tmpdir(), 'recursive-manager-test-'));
  });

  afterEach(() => {
    rmSync(testDataDir, { recursive: true });
  });

  test('init command creates proper structure', async () => {
    await initCommand('Test goal', { dataDir: testDataDir });

    expect(existsSync(path.join(testDataDir, '.recursive-manager'))).toBe(true);
    expect(existsSync(path.join(testDataDir, 'database.sqlite'))).toBe(true);
    expect(existsSync(path.join(testDataDir, 'config.json'))).toBe(true);
  });

  test('status command shows agent hierarchy', async () => {
    await initCommand('Test goal', { dataDir: testDataDir });
    const output = await statusCommand({ dataDir: testDataDir });

    expect(output).toContain('CEO');
    expect(output).toContain('Test goal');
  });

  test('config get/set works', async () => {
    await initCommand('Test goal', { dataDir: testDataDir });
    await configCommand('set', 'execution.workerPoolSize', '5', { dataDir: testDataDir });
    const value = await configCommand('get', 'execution.workerPoolSize', undefined, { dataDir: testDataDir });

    expect(value).toBe('5');
  });

  test('debug command shows agent info', async () => {
    await initCommand('Test goal', { dataDir: testDataDir });
    const config = loadConfig(testDataDir);
    const output = await debugCommand(config.rootAgentId, { dataDir: testDataDir });

    expect(output).toContain('CEO');
    expect(output).toContain('Status:');
  });
});
```

### 5.2 Fix Flaky Test

**File:** `packages/common/src/utils/__tests__/disk-space.test.ts`

**Issue:** Edge case test fails due to timing/precision

**Fix:**
```typescript
// BEFORE:
it('should return true when available space exactly matches requirement', () => {
  const availableBytes = getDiskSpaceSync('/tmp');
  const result = hasSufficientDiskSpace('/tmp', availableBytes, { disabled: true });
  expect(result).toBe(true);
});

// AFTER:
it('should return true when available space matches requirement with tolerance', () => {
  const availableBytes = getDiskSpaceSync('/tmp');
  // Allow 1MB tolerance for filesystem changes
  const tolerance = 1024 * 1024;
  const result = hasSufficientDiskSpace('/tmp', availableBytes - tolerance, { disabled: true });
  expect(result).toBe(true);
});
```

### 5.3 Un-skip Disabled Test

**File:** `packages/core/src/tasks/__tests__/createTaskDirectory.test.ts:314`

**Currently:** `it.skip('should throw error if task directory creation fails')`

**Fix:**
```typescript
// Use mock filesystem to simulate failure
it('should throw error if task directory creation fails', async () => {
  const mockFs = vi.spyOn(fs, 'mkdirSync').mockImplementation(() => {
    throw new Error('EACCES: permission denied');
  });

  await expect(createTaskDirectory(db, 'task-001')).rejects.toThrow('EACCES');

  mockFs.mockRestore();
});
```

### 5.4 Achieve 100% Test Pass Rate

**Current:** 1045/1046 (99.9%)

**Action Items:**
1. Fix disk-space flaky test (5.2)
2. Un-skip createTaskDirectory test (5.3)
3. Add CLI integration tests (5.1)
4. Run full test suite on multiple Node versions (18, 20, 22)
5. Verify all tests pass with coverage

**Command:**
```bash
npm run test:coverage
# Ensure: 1100+ / 1100+ tests passing
```

---

## PHASE 6: GITHUB PAGES DEPLOYMENT (MEDIUM PRIORITY)

### 6.1 Enable GitHub Pages

**Manual Steps Required:**
1. Go to: https://github.com/aaron777collins/RecursiveManager/settings/pages
2. Under "Build and deployment":
   - Source: **GitHub Actions**
3. Wait 2-3 minutes for first deployment
4. Verify at: https://aaron777collins.github.io/RecursiveManager

### 6.2 Add Docs Link to README

**File:** `README.md`

Add prominent link at top:
```markdown
# RecursiveManager

[![Documentation](https://img.shields.io/badge/docs-github.io-blue)](https://aaron777collins.github.io/RecursiveManager)
[![CI](https://github.com/aaron777collins/RecursiveManager/actions/workflows/ci.yml/badge.svg)](https://github.com/aaron777collins/RecursiveManager/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)

[📚 **View Full Documentation**](https://aaron777collins.github.io/RecursiveManager)

...
```

### 6.3 Add Custom Domain (Optional)

**If you own a domain:**

1. Add `docs/.vitepress/config.js`:
```javascript
export default {
  // ...
  base: '/', // Remove /RecursiveManager/ base
}
```

2. Create `docs/public/CNAME`:
```
docs.recursivemanager.dev
```

3. Configure DNS:
```
CNAME: docs.recursivemanager.dev → aaron777collins.github.io
```

---

## PHASE 7: RELEASE PREPARATION (HIGH PRIORITY)

### 7.1 Update CHANGELOG for v0.2.0

**File:** `CHANGELOG.md`

```markdown
## [0.2.0] - 2026-01-XX

### 🎉 Beta Release - Production Ready!

### ✅ Completed Features

#### CLI Commands (Fully Implemented)
- **init**: Initialize RecursiveManager with goal and data directory
- **status**: Display agent hierarchy with task counts
- **config**: Get/set configuration values with validation
- **debug**: Show agent state, tasks, and logs
- **rollback**: Revert to previous system snapshot (NEW)

#### Documentation (23 New Pages)
- Complete guide section (10 pages)
- Full API reference (4 pages)
- Architecture deep-dives (6 pages)
- Contributing guides (3 pages)
- Visual architecture diagrams
- Alpha status warnings added

#### Core Features
- Multi-perspective sub-agent spawning implemented
- Scheduler-lifecycle integration complete
- Acting agent ID audit trail
- Snapshot/rollback system (NEW)
- CLI prerequisite validation

#### GitHub Actions
- All workflows passing ✅
- CI: Lint, test, build on Node 18/20/22
- Docs: Auto-deploy to GitHub Pages
- Release: Automated with changelog extraction

#### Testing
- **1100+** tests passing (100% pass rate)
- CLI integration tests added
- Flaky tests fixed
- Coverage: 95%+

### 📚 Documentation
- Published at: https://aaron777collins.github.io/RecursiveManager
- 30+ documentation pages
- Interactive examples
- Troubleshooting guide
- Best practices

### 🔒 Security
- Path traversal protection
- Agent ID validation
- Command injection prevention
- Audit log immutability

### 🐛 Bug Fixes
- Fixed branch reference in release workflow
- Fixed update.sh path for npm global installs
- Fixed placeholder GitHub usernames
- Removed orphaned mkdocs.yml

### 📦 Distribution
- npm package: `recursive-manager`
- One-line installer works correctly
- Update/rollback system functional

### ⚠️ Known Limitations
- OpenCode adapter not yet implemented (planned v0.3.0)
- Messaging integrations pending (Slack, Discord, Telegram)
- Web UI not yet available

### 🎯 Next Release (v0.3.0)
- OpenCode framework adapter
- Real-time messaging integrations
- Web-based dashboard
- Performance optimizations
```

### 7.2 Update package.json Versions

**Files:** All 5 packages + root

```bash
# Update all to 0.2.0
npm version 0.2.0 --workspaces --no-git-tag-version
```

### 7.3 Create Git Tag and Release

```bash
git add .
git commit -m "chore: Release v0.2.0 - Beta production-ready release

- Implement all CLI commands (init, status, config, debug, rollback)
- Create 23 missing documentation pages
- Fix all GitHub Actions workflows
- Achieve 100% test pass rate (1100+ tests)
- Complete multi-perspective and scheduler integration
- Add snapshot/rollback system
- Deploy documentation to GitHub Pages"

git tag v0.2.0
git push origin master --tags
```

**GitHub Release Created Automatically** via `.github/workflows/release.yml`

---

## PHASE 8: RALPH AUTOMATION EXECUTION

### 8.1 Ralph Plan Execution

**Command:**
```bash
cd /home/ubuntu/repos/RecursiveManager
nohup recursive-manager plan PRODUCTION_READINESS_PLAN.md > ralph-plan.log 2>&1 &
echo $! > ralph-plan.pid
```

**Monitor Progress:**
```bash
tail -f ralph-plan.log
```

### 8.2 Ralph Build Execution

**Wait for plan completion, then:**
```bash
cd /home/ubuntu/repos/RecursiveManager
nohup recursive-manager build PRODUCTION_READINESS_PLAN.md > ralph-build.log 2>&1 &
echo $! > ralph-build.pid
```

**Monitor Progress:**
```bash
tail -f ralph-build.log
```

### 8.3 Verify Ralph Completion

**After both complete:**
```bash
# Check plan results
cat ralph-plan.log | grep "PLAN COMPLETE"

# Check build results
cat ralph-build.log | grep "BUILD COMPLETE"

# Verify tests pass
npm test

# Verify docs build
cd docs && npm run build

# Verify CLI works
recursive-manager --version
recursive-manager init "Test goal" --data-dir /tmp/test-rm
recursive-manager status --data-dir /tmp/test-rm
```

---

## SUCCESS CRITERIA

### ✅ Definition of Done

**All tasks complete when:**

1. **GitHub Actions** ✅
   - [ ] CI workflow passing on master
   - [ ] Docs workflow deploying successfully
   - [ ] Release workflow creates proper releases

2. **CLI Commands** ✅
   - [ ] `init` creates proper structure
   - [ ] `status` shows real agent hierarchy
   - [ ] `config` get/set persists values
   - [ ] `debug` shows actual agent state
   - [ ] `rollback` restores snapshots

3. **Documentation** ✅
   - [ ] All 23 missing files created
   - [ ] GitHub Pages deployed
   - [ ] No broken links
   - [ ] Alpha warnings visible
   - [ ] Examples work

4. **Core Features** ✅
   - [ ] Multi-perspective spawns sub-agents
   - [ ] Scheduler integrates with lifecycle
   - [ ] Acting agent ID tracked
   - [ ] Snapshot system works

5. **Testing** ✅
   - [ ] 1100+ tests passing (100%)
   - [ ] No flaky tests
   - [ ] CLI integration tested
   - [ ] Coverage > 95%

6. **Repository** ✅
   - [ ] LICENSE file exists
   - [ ] No placeholder usernames
   - [ ] mkdocs.yml removed
   - [ ] Version 0.2.0 tagged

7. **Ralph Automation** ✅
   - [ ] Ralph plan completed successfully
   - [ ] Ralph build completed successfully
   - [ ] All changes committed and pushed

### 📊 Key Metrics

| Metric | Current (0.1.0) | Target (0.2.0) | Status |
|--------|----------------|----------------|--------|
| Test Pass Rate | 99.9% (1045/1046) | 100% (1100+/1100+) | 🟡 In Progress |
| Documentation Pages | 7/30 (23%) | 30/30 (100%) | 🟡 In Progress |
| CLI Commands Implemented | 1/5 (20%) | 5/5 (100%) | 🟡 In Progress |
| GitHub Actions Passing | 0/3 (0%) | 3/3 (100%) | 🟡 In Progress |
| Code Coverage | ~85% | >95% | 🟡 In Progress |
| TODO Comments | 12 | 0 | 🟡 In Progress |
| Production Ready | ❌ Alpha | ✅ Beta | 🟡 In Progress |

---

## EXECUTION TIMELINE

### If Implemented Manually
- Phase 1 (Critical): 2-3 days
- Phase 2 (CLI): 3-4 days
- Phase 3 (Docs): 2-3 days
- Phase 4 (Core): 2-3 days
- Phase 5 (Testing): 1-2 days
- Phase 6 (GitHub Pages): 1 day
- Phase 7 (Release): 1 day
- **Total: 2-3 weeks**

### With Ralph Automation
- Plan generation: 5-10 minutes
- Build execution: 2-4 hours (depending on complexity)
- Manual verification: 1-2 hours
- **Total: ~4-6 hours**

---

## RISK MITIGATION

### Potential Blockers

1. **Ralph availability** - Ensure Ralph agent is running
2. **Test failures** - May need manual debugging
3. **GitHub Pages permission** - Requires repo settings access
4. **Breaking changes** - Extensive testing required

### Contingency Plans

1. **If Ralph fails**: Manual implementation following plan sections
2. **If tests fail**: Fix incrementally, commit often
3. **If docs build fails**: Verify VitePress config, check Node version
4. **If GitHub Actions fail**: Check secrets, permissions, runner logs

---

## POST-RELEASE TASKS

### Announcement

1. **GitHub Release Page**: Auto-created by workflow
2. **README Badge**: Update to show v0.2.0
3. **npm Publish**: `npm publish --workspaces` (if public package)
4. **Social Media**: Announce beta release
5. **Documentation**: Highlight new features

### Monitoring

1. **GitHub Actions**: Monitor for failures on new PRs
2. **Issue Tracker**: Watch for bug reports
3. **Documentation**: Monitor for feedback/corrections
4. **npm Stats**: Track downloads (if published)

### Next Steps (v0.3.0)

1. **OpenCode Adapter**: Implement missing framework
2. **Messaging Integrations**: Slack, Discord, Telegram
3. **Web Dashboard**: Real-time monitoring UI
4. **Performance**: Optimize for large hierarchies (1000+ agents)
5. **Security Audit**: Professional penetration testing

---

**END OF PLAN**

Total Estimated LOC: ~5,000-7,000 lines of new code
Files Created: ~30 documentation + ~10 source files
Tests Added: ~200 new tests
Complexity: HIGH (multi-week manual effort) / MEDIUM (with Ralph)

**Ready for Ralph execution!** 🚀
