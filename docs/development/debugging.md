# Debugging

Guide to debugging RecursiveManager during development and production.

## CLI Debugging

### View Agent Information

```bash
# Show organization chart
recursive-manager status

# View specific agent details
recursive-manager status --agent-id <agent-id>

# View in JSON format
recursive-manager status --format json
```

### Debug Command

```bash
# Full agent debug info
recursive-manager debug <agent-id> --all

# View agent logs
recursive-manager debug <agent-id> --logs

# View agent state
recursive-manager debug <agent-id> --state

# View agent tasks
recursive-manager debug <agent-id> --tasks
```

## Log Files

### Location

Logs are stored at:
```
~/.recursive-manager/logs/recursive-manager.log
```

### Log Levels

Configure log level:
```bash
LOG_LEVEL=debug  # debug, info, warn, error
```

### Viewing Logs

```bash
# Tail logs in real-time
tail -f ~/.recursive-manager/logs/recursive-manager.log

# Filter by level
grep "ERROR" ~/.recursive-manager/logs/recursive-manager.log

# Show last 100 lines
tail -n 100 ~/.recursive-manager/logs/recursive-manager.log
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
import { logger } from '@recursive-manager/common';

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
import { getDatabase, logger } from '@recursive-manager/common';

const db = await getDatabase();

// Log all queries
db.on('query', (sql) => {
  logger.debug('SQL:', sql);
});
```

### Lock Contention

Debug locking issues:

```typescript
import { AgentLock } from '@recursive-manager/core';

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
import { Agent } from '@recursive-manager/common'; // ✓
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
ps aux | grep recursive-manager

# Kill all instances
pkill -f recursive-manager

# Or use different database per process
DATABASE_PATH=~/.recursive-manager/data/test.db
```

### Issue: "Agent not responding"

**Cause**: Agent timeout or deadlock

**Solution**:
```bash
# Check agent status
recursive-manager debug <agent-id> --state

# View agent logs
recursive-manager debug <agent-id> --logs

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
  recursive-manager:
    command: node --inspect=0.0.0.0:9229 packages/cli/dist/cli.js
    ports:
      - "9229:9229"
```

## Error Tracking

### Structured Logging

```typescript
import { logger } from '@recursive-manager/common';

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
LOG_LEVEL=debug recursive-manager <command>
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
