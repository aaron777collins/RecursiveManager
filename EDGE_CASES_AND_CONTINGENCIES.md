# Edge Cases & Contingencies

## Overview

This document catalogs all edge cases, failure scenarios, and contingency plans for the RecursiveManager system. Each edge case includes detection, handling, and prevention strategies.

---

## Category 1: Agent Lifecycle Edge Cases

### EC-1.1: Agent Tries to Hire Itself

**Scenario**: Agent's goal analysis determines it should hire an agent with identical role/goal

**Detection**:
```typescript
if (newAgent.role === currentAgent.role &&
    newAgent.goal === currentAgent.goal) {
  throw new Error('Cannot hire duplicate of self');
}
```

**Handling**:
1. Reject hire request
2. Log warning to agent's execution log
3. Suggest alternative: delegate to existing subordinate

**Prevention**:
- Multi-perspective analysis should catch this
- Add "uniqueness check" to hire validation

---

### EC-1.2: Orphaned Agents (Manager Fired)

**Scenario**: Manager is fired, leaving subordinates without supervision

**Detection**:
```sql
SELECT * FROM agents
WHERE reporting_to NOT IN (SELECT id FROM agents WHERE status = 'active')
```

**Handling**:
```typescript
async function handleOrphanedAgents(firedManagerId: string): Promise<void> {
  const orphans = await getSubordinates(firedManagerId);
  const grandparent = await getManager(firedManagerId);

  for (const orphan of orphans) {
    if (grandparent) {
      // Promote to grandparent
      await reassignAgent(orphan.id, grandparent.id);
      await sendMessage(grandparent.id, `Inherited agent ${orphan.id} from ${firedManagerId}`);
    } else {
      // Orphan becomes top-level
      await makeTopLevel(orphan.id);
      await sendMessage(orphan.id, `You are now a top-level agent`);
    }
  }
}
```

**Prevention**:
- Require "fire strategy" when firing manager
- Options: reassign, promote, pause, fire-cascade

---

### EC-1.3: Circular Reporting Structure

**Scenario**: Agent A reports to B, B reports to C, C reports to A

**Detection**:
```typescript
function detectCycle(agentId: string, visited: Set<string> = new Set()): boolean {
  if (visited.has(agentId)) return true;
  visited.add(agentId);

  const manager = getManager(agentId);
  if (!manager) return false;

  return detectCycle(manager.id, visited);
}
```

**Handling**:
1. Reject reassignment that would create cycle
2. Alert user with diagram of attempted cycle
3. Suggest valid alternative

**Prevention**:
- Check for cycles on every reassignment
- Maintain org_hierarchy materialized view

---

### EC-1.4: Agent Hiring Spree (Runaway Recursion)

**Scenario**: Buggy agent hires 50 subordinates in 10 minutes

**Detection**:
```typescript
const recentHires = await getHiresInLastHour(agentId);
if (recentHires.length > 5) {
  throw new Error('Rate limit exceeded: max 5 hires per hour');
}
```

**Handling**:
1. Pause agent immediately
2. Alert user
3. Require manual review of hires
4. Option to rollback (fire all recent hires)

**Prevention**:
- Strict rate limiting (5 hires/hour)
- Hiring budget (default: 3)
- Multi-perspective analysis before hire

---

## Category 2: Task Management Edge Cases

### EC-2.1: Task Deadlock (Circular Dependencies)

**Scenario**: Task A blocks on B, B blocks on C, C blocks on A

**Detection**:
```typescript
function detectTaskDeadlock(taskId: string): string[] | null {
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(id: string): boolean {
    if (path.includes(id)) {
      return true; // Cycle found
    }
    if (visited.has(id)) {
      return false; // Already explored
    }

    visited.add(id);
    path.push(id);

    const blockedBy = getTaskBlockedBy(id);
    for (const blockerId of blockedBy) {
      if (dfs(blockerId)) {
        return true;
      }
    }

    path.pop();
    return false;
  }

  if (dfs(taskId)) {
    return path; // Return cycle
  }
  return null;
}
```

**Handling**:
1. Alert all agents in cycle
2. Require human intervention to break cycle
3. Suggest: which task to unblock

**Prevention**:
- Check for cycles when adding blockers
- Visualize dependency graph
- Auto-detect stale blockers

---

### EC-2.2: Infinite Task Nesting

**Scenario**: Task breaks into subtasks, subtasks break into sub-subtasks, 20 levels deep

**Detection**:
```typescript
const MAX_TASK_DEPTH = 10;

function validateTaskDepth(taskId: string): void {
  const depth = getTaskDepth(taskId);
  if (depth >= MAX_TASK_DEPTH) {
    throw new Error(`Task nesting too deep: ${depth} (max: ${MAX_TASK_DEPTH})`);
  }
}
```

**Handling**:
1. Reject task creation beyond depth 10
2. Suggest: delegate to new agent instead
3. Alert manager about deep nesting

**Prevention**:
- Enforce depth limit
- Multi-perspective analysis should catch over-decomposition
- Guidance: "delegate instead of nest beyond depth 5"

---

### EC-2.3: Abandoned Tasks (Agent Paused)

**Scenario**: Agent paused mid-task, task never resumed

**Detection**:
```sql
SELECT * FROM tasks
WHERE status = 'in-progress'
  AND agent_id IN (SELECT id FROM agents WHERE status != 'active')
```

**Handling**:
```typescript
async function handleAbandonedTasks(): Promise<void> {
  const abandoned = await getAbandonedTasks();

  for (const task of abandoned) {
    const agent = await getAgent(task.agentId);

    if (agent.status === 'paused') {
      // Keep task, will resume when agent resumes
      await updateTaskStatus(task.id, 'blocked', 'Waiting for agent to resume');
    } else if (agent.status === 'fired') {
      // Reassign to manager
      const manager = await getManager(agent.reportingTo);
      await reassignTask(task.id, manager.id);
      await sendMessage(manager.id, `Task ${task.id} reassigned from fired agent`);
    }
  }
}
```

**Prevention**:
- Run abandoned task check daily
- Alert managers of blocked tasks

---

### EC-2.4: Task Completion Race Condition

**Scenario**: Two agents try to complete the same task simultaneously

**Detection**: Database unique constraint

```sql
-- Add optimistic locking
ALTER TABLE tasks ADD COLUMN version INTEGER DEFAULT 0;

UPDATE tasks
SET status = 'completed', version = version + 1
WHERE id = ? AND version = ? -- Must match expected version
```

**Handling**:
```typescript
async function completeTask(taskId: string, expectedVersion: number): Promise<void> {
  const result = await db.run(`
    UPDATE tasks
    SET status = 'completed',
        completed_at = ?,
        version = version + 1
    WHERE id = ? AND version = ?
  `, [new Date(), taskId, expectedVersion]);

  if (result.changes === 0) {
    throw new Error('Task was modified by another agent');
  }
}
```

**Prevention**:
- Optimistic locking on all task updates
- Clear task ownership (one agent at a time)

---

## Category 3: Messaging Edge Cases

### EC-3.1: Message Flood

**Scenario**: Slack user sends 100 messages in 1 minute

**Detection**:
```typescript
const messagesInLastMinute = await getMessagesFromUser(userId, '1m');
if (messagesInLastMinute.length > 10) {
  return { error: 'Rate limit exceeded', retryAfter: 60 };
}
```

**Handling**:
1. Queue excess messages
2. Send auto-reply: "High message volume detected. Processing..."
3. Batch process messages

**Prevention**:
- Rate limiting per user (10 messages/minute)
- Debouncing (wait 30s for more messages)
- Smart batching (combine related messages)

---

### EC-3.2: Message to Non-Existent Agent

**Scenario**: User sends message to agent that was fired

**Detection**:
```typescript
const agent = await getAgent(targetAgentId);
if (!agent || agent.status === 'fired') {
  throw new Error(`Agent ${targetAgentId} not found or inactive`);
}
```

**Handling**:
1. Send error response to user
2. Suggest: message agent's former manager
3. Log attempt in audit log

**Prevention**:
- Validate agent existence before queuing message
- Provide "did you mean?" suggestions

---

### EC-3.3: Duplicate Messages (Platform Glitch)

**Scenario**: Slack sends same message twice due to webhook retry

**Detection**:
```typescript
interface MessageDeduplication {
  messageId: string; // Platform's message ID
  receivedAt: Date;
  hash: string; // Hash of content
}

async function isDuplicate(msg: IncomingMessage): Promise<boolean> {
  const hash = sha256(msg.content);
  const existing = await db.get(`
    SELECT 1 FROM messages
    WHERE channel = ? AND hash = ? AND timestamp > ?
  `, [msg.channel, hash, Date.now() - 60000]); // 1 minute window

  return !!existing;
}
```

**Handling**:
1. Discard duplicate silently
2. Log deduplication event
3. Don't notify agent

**Prevention**:
- Message deduplication layer
- Store platform message IDs
- Content hashing for cross-platform duplicates

---

## Category 4: Scheduling Edge Cases

### EC-4.1: Clock Skew (Daylight Saving Time)

**Scenario**: Cron schedule "9am daily" shifts during DST transition

**Detection**: Store timezone explicitly

```json
{
  "schedule": "0 9 * * *",
  "timezone": "America/Los_Angeles", // Not UTC!
  "dstAware": true
}
```

**Handling**:
```typescript
import { zonedTimeToUtc } from 'date-fns-tz';

function getNextExecution(schedule: Schedule): Date {
  const tz = schedule.timezone;
  const cron = parseCron(schedule.schedule);
  const nextLocal = cron.next(); // Next execution in local time
  const nextUTC = zonedTimeToUtc(nextLocal, tz);
  return nextUTC;
}
```

**Prevention**:
- Always store timezone with cron expressions
- Use timezone-aware libraries
- Test across DST boundaries

---

### EC-4.2: Scheduler Daemon Crash

**Scenario**: Scheduler process killed, misses scheduled executions

**Detection**: Health check

```typescript
// Watchdog process
setInterval(async () => {
  const lastHeartbeat = await getSchedulerHeartbeat();
  if (Date.now() - lastHeartbeat > 60000) {
    console.error('Scheduler dead! Restarting...');
    await restartScheduler();
  }
}, 30000);
```

**Handling on Restart**:
```typescript
async function recoverMissedExecutions(): Promise<void> {
  const now = Date.now();
  const missedSchedules = await db.all(`
    SELECT * FROM schedules
    WHERE enabled = TRUE
      AND next_execution_at < ?
      AND next_execution_at > ?
  `, [now, now - 3600000]); // Last hour

  for (const schedule of missedSchedules) {
    console.log(`Missed execution for ${schedule.agentId}, running now`);
    await executeAgent(schedule.agentId, 'scheduled');
    await updateNextExecution(schedule.id);
  }
}
```

**Prevention**:
- Systemd/PM2 auto-restart
- Health check watchdog
- Missed execution recovery

---

### EC-4.3: Thundering Herd (Many Agents Scheduled Simultaneously)

**Scenario**: 50 agents all scheduled for "9am", scheduler overwhelmed

**Detection**:
```typescript
const schedulesAt9am = await db.all(`
  SELECT COUNT(*) FROM schedules
  WHERE next_execution_at BETWEEN ? AND ?
`, ['2026-01-18T09:00:00Z', '2026-01-18T09:00:59Z']);

if (schedulesAt9am > 20) {
  console.warn('Thundering herd detected at 9am');
}
```

**Handling**: Jitter

```typescript
function addJitter(scheduledTime: Date, maxJitterSec: number = 300): Date {
  const jitterMs = Math.random() * maxJitterSec * 1000;
  return new Date(scheduledTime.getTime() + jitterMs);
}

// Instead of 9:00:00 for all agents:
// Agent 1: 9:00:23
// Agent 2: 9:01:47
// Agent 3: 9:03:12
// ...
```

**Prevention**:
- Default jitter for all cron schedules
- User can disable jitter if needed
- Warn if >20 agents at same time

---

## Category 5: File System Edge Cases

### EC-5.1: Disk Full

**Scenario**: Agent workspace fills disk

**Detection**:
```typescript
import { statfs } from 'fs/promises';

async function checkDiskSpace(): Promise<void> {
  const stats = await statfs('/');
  const availableGB = stats.bavail * stats.bsize / (1024**3);

  if (availableGB < 5) {
    throw new Error('Disk space critically low: ${availableGB}GB remaining');
  }
}
```

**Handling**:
1. Pause all agents
2. Alert user
3. Trigger emergency cleanup:
   - Delete cache/ directories
   - Archive old tasks
   - Compress logs
4. Resume agents when space recovered

**Prevention**:
- Workspace quotas per agent
- Daily cleanup of old archives
- Monitoring dashboard shows disk usage

---

### EC-5.2: File Corruption

**Scenario**: config.json becomes invalid JSON

**Detection**:
```typescript
async function loadConfig(agentId: string): Promise<AgentConfig> {
  const path = getConfigPath(agentId);
  const content = await fs.readFile(path, 'utf-8');

  try {
    const config = JSON.parse(content);
    validateAgentConfig(config); // JSON Schema validation
    return config;
  } catch (err) {
    console.error(`Corrupt config for ${agentId}:`, err);
    await attemptRecovery(agentId);
    throw new Error('Config file corrupted');
  }
}

async function attemptRecovery(agentId: string): Promise<void> {
  // Try backup
  const backup = await getLatestBackup(agentId);
  if (backup) {
    console.log(`Restoring ${agentId} config from backup`);
    await fs.copyFile(backup, getConfigPath(agentId));
    return;
  }

  // Try database
  const dbConfig = await db.get('SELECT config_path FROM agents WHERE id = ?', agentId);
  if (dbConfig) {
    console.log(`Rebuilding ${agentId} config from database`);
    await rebuildConfigFromDatabase(agentId);
    return;
  }

  throw new Error('Recovery failed: no backups available');
}
```

**Prevention**:
- Atomic writes (write to temp, then rename)
- Backups before every modification
- JSON Schema validation before write
- File integrity checksums

---

### EC-5.3: Permission Errors

**Scenario**: Process can't write to agent directory (wrong permissions)

**Detection**:
```typescript
async function checkDirectoryPermissions(path: string): Promise<void> {
  try {
    await fs.access(path, fs.constants.W_OK | fs.constants.R_OK);
  } catch (err) {
    throw new Error(`Insufficient permissions for ${path}`);
  }
}
```

**Handling**:
```typescript
async function initializeAgentDirectory(agentId: string): Promise<void> {
  const dir = getAgentDirectory(agentId);

  try {
    await fs.mkdir(dir, { recursive: true, mode: 0o755 });
    await fs.chown(dir, process.getuid()!, process.getgid()!);
  } catch (err) {
    console.error(`Failed to create directory ${dir}:`, err);
    throw new Error('Permission error during agent initialization');
  }
}
```

**Prevention**:
- Check permissions during init
- Run as non-root user
- Clear documentation on required permissions

---

## Category 6: Framework Adapter Edge Cases

### EC-6.1: Framework Not Available

**Scenario**: Claude Code not installed, fallback to OpenCode

**Detection**:
```typescript
async function checkFrameworkAvailability(framework: string): Promise<boolean> {
  try {
    if (framework === 'claude-code') {
      await exec('which claude');
      return true;
    } else if (framework === 'opencode') {
      await exec('which opencode');
      return true;
    }
  } catch (err) {
    return false;
  }
  return false;
}
```

**Handling**:
```typescript
async function getAdapter(config: AgentConfig): Promise<FrameworkAdapter> {
  const primary = config.framework.primary;
  const fallback = config.framework.fallback;

  if (await checkFrameworkAvailability(primary)) {
    return createAdapter(primary);
  }

  console.warn(`${primary} not available, using ${fallback}`);
  if (await checkFrameworkAvailability(fallback)) {
    return createAdapter(fallback);
  }

  throw new Error('No framework available');
}
```

**Prevention**:
- Check framework availability during system init
- Clear error message with installation instructions
- Support multiple frameworks

---

### EC-6.2: Framework Timeout

**Scenario**: Claude Code hangs for 2 hours

**Detection**: Execution timeout

```typescript
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Execution timeout')), timeoutMs)
    )
  ]);
}
```

**Handling**:
1. Kill framework process
2. Mark execution as failed
3. Retry with shorter timeout
4. If repeated timeouts, escalate to user

**Prevention**:
- Set reasonable timeouts (default: 60 minutes)
- Monitor framework health
- Circuit breaker pattern

---

### EC-6.3: Framework API Change

**Scenario**: Claude Code v2.0 changes CLI interface

**Detection**: Adapter tests

```typescript
describe('ClaudeCodeAdapter', () => {
  it('should handle CLI interface', async () => {
    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.execute({
      agentId: 'test',
      mode: 'continuous',
      context: mockContext
    });

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('output');
  });
});
```

**Handling**:
- Version-specific adapters
- Detect framework version at runtime
- Use appropriate adapter

```typescript
async function createAdapter(framework: string): Promise<FrameworkAdapter> {
  const version = await getFrameworkVersion(framework);

  if (framework === 'claude-code') {
    if (version.startsWith('1.')) {
      return new ClaudeCodeAdapterV1();
    } else if (version.startsWith('2.')) {
      return new ClaudeCodeAdapterV2();
    }
  }

  throw new Error(`Unsupported ${framework} version: ${version}`);
}
```

**Prevention**:
- Integration tests with real frameworks
- Version detection
- Deprecation warnings

---

## Category 7: Concurrency Edge Cases

### EC-7.1: Two Continuous Instances Running

**Scenario**: Scheduler spawns continuous instance while previous one still running

**Detection**: Process lock

```typescript
import { Mutex } from 'async-mutex';

class AgentExecutor {
  private locks: Map<string, Mutex> = new Map();

  async execute(agentId: string): Promise<void> {
    if (!this.locks.has(agentId)) {
      this.locks.set(agentId, new Mutex());
    }

    const lock = this.locks.get(agentId)!;

    if (lock.isLocked()) {
      console.log(`Agent ${agentId} already running, skipping`);
      return;
    }

    await lock.runExclusive(async () => {
      await this.actualExecute(agentId);
    });
  }
}
```

**Prevention**:
- Per-agent mutex
- Check last execution time before spawning
- Process tracking (PID file)

---

### EC-7.2: Database Deadlock

**Scenario**: Agent A updates task 1, agent B updates task 2, both try to update org_hierarchy

**Detection**: SQLite reports SQLITE_BUSY

**Handling**: Retry with exponential backoff

```typescript
async function executeQuery(sql: string, params: any[]): Promise<any> {
  const maxRetries = 5;
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await db.run(sql, params);
    } catch (err: any) {
      if (err.code === 'SQLITE_BUSY') {
        const backoff = Math.min(100 * Math.pow(2, attempt), 1000);
        await sleep(backoff);
        lastError = err;
      } else {
        throw err;
      }
    }
  }

  throw lastError;
}
```

**Prevention**:
- Short transactions
- Write-ahead logging (WAL mode)
- Connection pooling

---

## Category 8: Multi-Perspective Analysis Edge Cases

### EC-8.1: Analysis Sub-Agents Disagree

**Scenario**: Security says "don't hire", Architecture says "hire"

**Detection**: Built into analysis process

**Handling**:
```typescript
interface PerspectiveResult {
  perspective: string;
  recommendation: 'approve' | 'reject' | 'conditional';
  confidence: number;
  reasoning: string;
  conditions?: string[];
}

async function synthesizeDecision(results: PerspectiveResult[]): Promise<Decision> {
  const approvals = results.filter(r => r.recommendation === 'approve');
  const rejections = results.filter(r => r.recommendation === 'reject');
  const conditionals = results.filter(r => r.recommendation === 'conditional');

  // Any strong rejection (confidence > 0.8) => reject
  const strongRejection = rejections.find(r => r.confidence > 0.8);
  if (strongRejection) {
    return {
      decision: 'reject',
      reason: strongRejection.reasoning
    };
  }

  // Majority approve => approve
  if (approvals.length > results.length / 2) {
    return {
      decision: 'approve',
      reason: 'Majority approval'
    };
  }

  // Conditionals => approve with conditions
  if (conditionals.length > 0) {
    const allConditions = conditionals.flatMap(c => c.conditions || []);
    return {
      decision: 'conditional',
      reason: 'Approved with conditions',
      conditions: allConditions
    };
  }

  // No clear consensus => escalate to human
  return {
    decision: 'escalate',
    reason: 'No clear consensus from analysis',
    perspectives: results
  };
}
```

**Prevention**:
- Clear decision synthesis rules
- Confidence thresholds
- Human escalation path

---

### EC-8.2: Analysis Timeout

**Scenario**: One perspective sub-agent hangs

**Detection**: Per-perspective timeout

```typescript
async function runMultiPerspectiveAnalysis(
  question: string,
  perspectives: string[]
): Promise<PerspectiveResult[]> {
  const timeoutMs = 300000; // 5 minutes per perspective

  const promises = perspectives.map(async (perspective) => {
    try {
      return await executeWithTimeout(
        () => analyzeFromPerspective(question, perspective),
        timeoutMs
      );
    } catch (err) {
      console.error(`${perspective} analysis timed out`);
      return {
        perspective,
        recommendation: 'reject',
        confidence: 0,
        reasoning: 'Analysis timed out - defaulting to safe rejection'
      };
    }
  });

  return Promise.all(promises);
}
```

**Prevention**:
- Timeout per perspective
- Default to safe decision (reject) on timeout
- Retry failed perspectives once

---

## Contingency Plans

### Contingency 1: Complete System Failure

**Triggers**:
- Database corruption
- File system full
- Critical bug in core

**Plan**:
1. **Stop all agents**: `recursive-manager emergency-stop`
2. **Backup everything**: `recursive-manager backup --full`
3. **Run diagnostics**: `recursive-manager diagnose --verbose`
4. **Attempt repair**: `recursive-manager repair --auto`
5. **Manual recovery**: Restore from backups, rebuild database
6. **Resume**: `recursive-manager resume --safe-mode`

### Contingency 2: Runaway Costs (API Usage Explosion)

**Triggers**:
- Daily API cost > $100
- >1000 agents running
- >10,000 executions/hour

**Plan**:
1. **Immediate pause**: Stop all agents
2. **Audit**: `recursive-manager audit --costs --last-24h`
3. **Identify culprits**: Which agents consumed most tokens?
4. **Fix**: Fire runaway agents, fix bugs
5. **Set limits**: Configure stricter budgets
6. **Resume gradually**: Resume agents one-by-one

### Contingency 3: Security Breach

**Triggers**:
- Unauthorized agent creation
- Unusual file access patterns
- External API calls to suspicious domains

**Plan**:
1. **Isolate**: Disconnect messaging integrations
2. **Audit**: Review audit logs for compromise
3. **Quarantine**: Pause suspicious agents
4. **Investigate**: What was accessed/modified?
5. **Remediate**: Fire compromised agents, patch vulnerability
6. **Monitor**: Enhanced logging for 7 days

