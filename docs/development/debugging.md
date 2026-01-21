# Debugging

Guide to debugging RecursiveManager during development and production.

## CLI Debugging

### View Agent Information

```bash
# Show organization chart
recursivemanager status

# View specific agent details
recursivemanager status --agent-id <agent-id>

# View in JSON format
recursivemanager status --format json
```

### Debug Command

```bash
# Full agent debug info
recursivemanager debug <agent-id> --all

# View agent logs
recursivemanager debug <agent-id> --logs

# View agent state
recursivemanager debug <agent-id> --state

# View agent tasks
recursivemanager debug <agent-id> --tasks
```

## Log Files

### Location

Logs are stored at:
```
~/.recursivemanager/logs/recursivemanager.log
```

### Log Levels

Configure log level:
```bash
LOG_LEVEL=debug  # debug, info, warn, error
```

### Viewing Logs

```bash
# Tail logs in real-time
tail -f ~/.recursivemanager/logs/recursivemanager.log

# Filter by level
grep "ERROR" ~/.recursivemanager/logs/recursivemanager.log

# Show last 100 lines
tail -n 100 ~/.recursivemanager/logs/recursivemanager.log
```

## Node.js Debugging

### Using VS Code

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug RecursiveManager",
      "program": "${workspaceFolder}/packages/cli/dist/cli.js",
      "args": ["init", "test goal"],
      "outFiles": ["${workspaceFolder}/packages/*/dist/**/*.js"],
      "sourceMaps": true
    }
  ]
}
```

### Using Chrome DevTools

```bash
# Start with inspector
node --inspect-brk packages/cli/dist/cli.js init "test goal"

# Then open chrome://inspect in Chrome
```

### Using Node Inspector

```bash
# Install Node Inspector
npm install -g node-inspector

# Start debugging
node-inspector &
node --debug-brk packages/cli/dist/cli.js
```

## TypeScript Source Maps

Ensure source maps are enabled in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "sourceMap": true
  }
}
```

Rebuild with source maps:
```bash
npm run build
```

## Debugging Specific Components

### Agent Execution

Add logging to agent code:

```typescript
import { logger } from '@recursivemanager/common';

class Agent {
  async execute(task: Task) {
    logger.debug(`Agent ${this.id} starting task ${task.id}`);

    try {
      const result = await this.performTask(task);
      logger.info(`Agent ${this.id} completed task ${task.id}`);
      return result;
    } catch (error) {
      logger.error(`Agent ${this.id} failed task ${task.id}:`, error);
      throw error;
    }
  }
}
```

### Database Operations

Enable database logging:

```bash
DATABASE_LOG_QUERIES=true
```

Or add logging in code:

```typescript
import { getDatabase, logger } from '@recursivemanager/common';

const db = await getDatabase();

// Log all queries
db.on('query', (sql) => {
  logger.debug('SQL:', sql);
});
```

### Lock Contention

Debug locking issues:

```typescript
import { AgentLock } from '@recursivemanager/core';

const lock = new AgentLock({ debug: true });

lock.on('acquire', (resourceId) => {
  console.log(`Lock acquired: ${resourceId}`);
});

lock.on('release', (resourceId) => {
  console.log(`Lock released: ${resourceId}`);
});

lock.on('contention', (resourceId, waitTime) => {
  console.warn(`Lock contention on ${resourceId}: ${waitTime}ms`);
});
```

## Common Issues

### Issue: "Cannot find module"

**Cause**: Packages not built or incorrect import paths

**Solution**:
```bash
# Rebuild packages
npm run build

# Check imports use package aliases
import { Agent } from '@recursivemanager/common'; // ✓
import { Agent } from '../../common/src/types/agent'; // ✗
```

### Issue: "Port already in use"

**Cause**: Previous process still running

**Solution**:
```bash
# Find process
lsof -i :PORT

# Kill process
kill -9 PID
```

### Issue: "Database locked"

**Cause**: Multiple processes accessing SQLite

**Solution**:
```bash
# Check for running instances
ps aux | grep recursivemanager

# Kill all instances
pkill -f recursivemanager

# Or use different database per process
DATABASE_PATH=~/.recursivemanager/data/test.db
```

### Issue: "Agent not responding"

**Cause**: Agent timeout or deadlock

**Solution**:
```bash
# Check agent status
recursivemanager debug <agent-id> --state

# View agent logs
recursivemanager debug <agent-id> --logs

# Increase timeout
AGENT_TIMEOUT_MS=600000
```

### Issue: "High memory usage"

**Cause**: Memory leaks or too many agents

**Solution**:
```bash
# Monitor memory
node --max-old-space-size=4096 packages/cli/dist/cli.js

# Profile memory
node --inspect packages/cli/dist/cli.js

# Reduce worker pool size
WORKER_POOL_SIZE=2
```

## Performance Profiling

### CPU Profiling

```bash
# Start with profiling
node --prof packages/cli/dist/cli.js

# Process profile
node --prof-process isolate-*.log > profile.txt
```

### Memory Profiling

```bash
# Take heap snapshot
node --inspect packages/cli/dist/cli.js

# In Chrome DevTools:
# 1. Open chrome://inspect
# 2. Click "inspect"
# 3. Go to "Memory" tab
# 4. Take snapshot
```

### Performance Monitoring

```typescript
import { performance } from 'perf_hooks';

function measurePerformance<T>(fn: () => T, label: string): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;

  console.log(`${label}: ${duration.toFixed(2)}ms`);

  return result;
}

// Usage
const result = measurePerformance(
  () => expensiveOperation(),
  'Expensive operation'
);
```

## Debugging Tests

### Run Single Test

```bash
# Add .only to test
it.only('should do something', () => {
  // Test code
});

# Or use --testNamePattern
npm test -- --testNamePattern="should do something"
```

### Debug Test in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Verbose Test Output

```bash
# Verbose mode
npm test -- --verbose

# Show console.log output
npm test -- --silent=false
```

## Remote Debugging

### SSH Tunneling

```bash
# On remote server
node --inspect=0.0.0.0:9229 packages/cli/dist/cli.js

# On local machine
ssh -L 9229:localhost:9229 user@remote-server

# Open chrome://inspect locally
```

### Docker Debugging

Add to `docker-compose.yml`:

```yaml
services:
  recursivemanager:
    command: node --inspect=0.0.0.0:9229 packages/cli/dist/cli.js
    ports:
      - "9229:9229"
```

## Error Tracking

### Structured Logging

```typescript
import { logger } from '@recursivemanager/common';

logger.error('Operation failed', {
  agentId: 'agent-123',
  taskId: 'task-456',
  error: error.message,
  stack: error.stack,
  context: {
    // Additional context
  }
});
```

### Error Aggregation

Integrate with error tracking services:

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

// Capture errors
try {
  await operation();
} catch (error) {
  Sentry.captureException(error);
  throw error;
}
```

## Debugging Best Practices

### 1. Enable Debug Logging

```bash
LOG_LEVEL=debug recursivemanager <command>
```

### 2. Use Descriptive Log Messages

```typescript
// Good
logger.debug(`Agent ${agentId} delegating task ${taskId} to worker ${workerId}`);

// Bad
logger.debug('Delegating task');
```

### 3. Add Context to Errors

```typescript
// Good
throw new Error(`Agent ${agentId} failed to acquire lock for resource ${resourceId}`);

// Bad
throw new Error('Lock acquisition failed');
```

### 4. Use Breakpoints Effectively

- Set breakpoints before suspected issues
- Use conditional breakpoints for specific cases
- Use logpoints for non-intrusive debugging

### 5. Isolate Problems

- Reproduce with minimal setup
- Eliminate variables one by one
- Create minimal test case

## Tools

### Debugging Tools

- **VS Code Debugger** - Built-in debugging
- **Chrome DevTools** - Node.js debugging
- **Node Inspector** - Legacy Node.js debugging

### Monitoring Tools

- **PM2** - Process monitoring
- **New Relic** - Application monitoring
- **DataDog** - Infrastructure monitoring

### Profiling Tools

- **Clinic.js** - Performance profiling
- **0x** - Flamegraph profiling
- **autocannon** - Load testing

## Edge Cases & Contingencies

This section documents common edge cases, failure scenarios, and their handling strategies. For complete edge case catalog, see [EDGE_CASES_AND_CONTINGENCIES.md](https://github.com/aaron777collins/RecursiveManager/blob/main/EDGE_CASES_AND_CONTINGENCIES.md).

### Agent Lifecycle Edge Cases

#### Orphaned Agents (Manager Fired)

**Detection**:
```sql
SELECT * FROM agents
WHERE reporting_to NOT IN (SELECT id FROM agents WHERE status = 'active')
```

**Handling**:
- Reassign to grandparent manager if available
- Promote to top-level if no grandparent exists
- Notify new manager about inherited agent

#### Circular Reporting Structure

**Detection**: Run cycle detection on every reassignment
```typescript
function detectCycle(agentId: string, visited: Set<string> = new Set()): boolean {
  if (visited.has(agentId)) return true;
  visited.add(agentId);

  const manager = getManager(agentId);
  if (!manager) return false;

  return detectCycle(manager.id, visited);
}
```

**Handling**: Reject reassignment that would create cycle

#### Agent Hiring Spree (Runaway Recursion)

**Detection**: Rate limiting (5 hires/hour per agent)
```typescript
const recentHires = await getHiresInLastHour(agentId);
if (recentHires.length > 5) {
  throw new Error('Rate limit exceeded: max 5 hires per hour');
}
```

**Handling**:
1. Pause agent immediately
2. Alert user
3. Option to rollback (fire all recent hires)

### Task Management Edge Cases

#### Task Deadlock (Circular Dependencies)

**Detection**:
```typescript
function detectTaskDeadlock(taskId: string): string[] | null {
  const visited = new Set<string>();
  const path: string[] = [];

  function dfs(id: string): boolean {
    if (path.includes(id)) return true; // Cycle found
    if (visited.has(id)) return false;

    visited.add(id);
    path.push(id);

    const blockedBy = getTaskBlockedBy(id);
    for (const blockerId of blockedBy) {
      if (dfs(blockerId)) return true;
    }

    path.pop();
    return false;
  }

  if (dfs(taskId)) return path; // Return cycle
  return null;
}
```

**Handling**:
1. Alert all agents in cycle
2. Require human intervention to break cycle
3. Visualize dependency graph

#### Infinite Task Nesting

**Detection**: Enforce MAX_TASK_DEPTH = 10
```typescript
const depth = getTaskDepth(taskId);
if (depth >= MAX_TASK_DEPTH) {
  throw new Error(`Task nesting too deep: ${depth} (max: ${MAX_TASK_DEPTH})`);
}
```

**Handling**: Suggest delegating to new agent instead of deeper nesting

#### Abandoned Tasks (Agent Paused)

**Detection**: Daily check for tasks with inactive agents
```sql
SELECT * FROM tasks
WHERE status = 'in-progress'
  AND agent_id IN (SELECT id FROM agents WHERE status != 'active')
```

**Handling**:
- If agent paused: Mark task as blocked
- If agent fired: Reassign to manager

### Messaging Edge Cases

#### Message Flood

**Detection**: Rate limiting (10 messages/minute per user)

**Handling**:
1. Queue excess messages
2. Send auto-reply about high volume
3. Batch process messages

#### Duplicate Messages (Platform Glitch)

**Detection**: Message deduplication using hash
```typescript
async function isDuplicate(msg: IncomingMessage): Promise<boolean> {
  const hash = sha256(msg.content);
  const existing = await db.get(`
    SELECT 1 FROM messages
    WHERE channel = ? AND hash = ? AND timestamp > ?
  `, [msg.channel, hash, Date.now() - 60000]);

  return !!existing;
}
```

**Handling**: Discard duplicate silently

### Scheduling Edge Cases

#### Clock Skew (Daylight Saving Time)

**Detection**: Store timezone explicitly with schedule

**Handling**: Use timezone-aware libraries (date-fns-tz)
```typescript
import { zonedTimeToUtc } from 'date-fns-tz';

function getNextExecution(schedule: Schedule): Date {
  const tz = schedule.timezone;
  const cron = parseCron(schedule.schedule);
  const nextLocal = cron.next();
  return zonedTimeToUtc(nextLocal, tz);
}
```

#### Scheduler Daemon Crash

**Detection**: Watchdog health check

**Handling on Restart**: Recover missed executions from last hour
```typescript
async function recoverMissedExecutions(): Promise<void> {
  const now = Date.now();
  const missedSchedules = await db.all(`
    SELECT * FROM schedules
    WHERE enabled = TRUE
      AND next_execution_at < ?
      AND next_execution_at > ?
  `, [now, now - 3600000]);

  for (const schedule of missedSchedules) {
    console.log(`Missed execution for ${schedule.agentId}, running now`);
    await executeAgent(schedule.agentId, 'scheduled');
  }
}
```

#### Thundering Herd

**Detection**: Check for many agents scheduled at same time

**Handling**: Add jitter (random 0-5 minute offset)
```typescript
function addJitter(scheduledTime: Date, maxJitterSec: number = 300): Date {
  const jitterMs = Math.random() * maxJitterSec * 1000;
  return new Date(scheduledTime.getTime() + jitterMs);
}
```

### File System Edge Cases

#### Disk Full

**Detection**: Check available disk space
```typescript
import { statfs } from 'fs/promises';

const stats = await statfs('/');
const availableGB = stats.bavail * stats.bsize / (1024**3);

if (availableGB < 5) {
  throw new Error(`Disk space critically low: ${availableGB}GB remaining`);
}
```

**Handling**:
1. Pause all agents
2. Trigger emergency cleanup (delete cache, archive old tasks, compress logs)
3. Resume when space recovered

#### File Corruption

**Detection**: JSON parse errors + schema validation

**Handling**: Attempt recovery from backup
```typescript
async function attemptRecovery(agentId: string): Promise<void> {
  const backup = await getLatestBackup(agentId);
  if (backup) {
    console.log(`Restoring ${agentId} config from backup`);
    await fs.copyFile(backup, getConfigPath(agentId));
    return;
  }

  throw new Error('Recovery failed: no backups available');
}
```

### Concurrency Edge Cases

#### Two Continuous Instances Running

**Detection**: Per-agent mutex using async-mutex
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

#### Database Deadlock

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

## Contingency Plans

### Complete System Failure

**Triggers**: Database corruption, file system full, critical bug

**Plan**:
1. Stop all agents: `recursivemanager emergency-stop`
2. Backup everything: `recursivemanager backup --full`
3. Run diagnostics: `recursivemanager diagnose --verbose`
4. Attempt repair: `recursivemanager repair --auto`
5. Manual recovery: Restore from backups
6. Resume: `recursivemanager resume --safe-mode`

### Runaway Costs (API Usage Explosion)

**Triggers**: Daily API cost > $100, >1000 agents running

**Plan**:
1. Immediate pause: Stop all agents
2. Audit: `recursivemanager audit --costs --last-24h`
3. Identify culprits: Which agents consumed most?
4. Fix: Fire runaway agents, fix bugs
5. Set limits: Configure stricter budgets
6. Resume gradually: One-by-one resumption

### Security Breach

**Triggers**: Unauthorized agent creation, unusual file access

**Plan**:
1. Isolate: Disconnect messaging integrations
2. Audit: Review audit logs
3. Quarantine: Pause suspicious agents
4. Investigate: What was accessed/modified?
5. Remediate: Fire compromised agents, patch vulnerability
6. Monitor: Enhanced logging for 7 days

## Getting Help

If you're stuck:

1. Check existing GitHub issues
2. Search documentation
3. Ask in GitHub Discussions
4. Create detailed bug report with:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment details
   - Logs and error messages

## Related Documentation

- [Edge Cases & Contingencies](https://github.com/aaron777collins/RecursiveManager/blob/main/EDGE_CASES_AND_CONTINGENCIES.md) - Complete edge case catalog
- [Architecture Overview](../architecture/overview.md) - System architecture
- [File Structure](../architecture/file-structure.md) - File and database schemas
