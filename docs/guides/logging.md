# Logging Configuration Guide

RecursiveManager uses Winston-based structured logging with support for multiple log levels, file rotation, and JSON formatting.

## Log Levels

RecursiveManager supports four log levels, configured via the `LOG_LEVEL` environment variable:

| Level | Description | Use Case |
|-------|-------------|----------|
| `debug` | Maximum verbosity, includes all log messages | Development, troubleshooting |
| `info` | Standard verbosity (default) | Production monitoring |
| `warn` | Only warnings and errors | Production (quiet mode) |
| `error` | Only errors | Critical errors only |

## Configuration

### Environment Variable

Set the log level globally for all loggers:

```bash
export LOG_LEVEL=debug
```

Or add to your `.env` file:

```env
LOG_LEVEL=debug
```

### Default Behavior

If `LOG_LEVEL` is not set, all loggers default to `info` level.

## Logger Types

RecursiveManager provides three types of loggers, all of which respect the `LOG_LEVEL` environment variable:

### 1. Default Logger

The default application logger for general use:

```typescript
import { logger } from '@recursivemanager/common';

logger.info('Application started');
logger.error('Database connection failed', { error: err.message });
```

**Configuration**: Reads `LOG_LEVEL` from environment

### 2. Agent Logger

Per-agent loggers with file output:

```typescript
import { createAgentLogger } from '@recursivemanager/common';

const agentLogger = createAgentLogger('CEO');
agentLogger.info('Task started', { taskId: 'task-123' });
```

**Features**:
- Logs to `~/.recursivemanager/logs/agents/{agentId}.log`
- Daily log rotation
- JSON format for structured parsing
- Respects `LOG_LEVEL` environment variable

**Override**: You can override the log level per agent:

```typescript
const debugAgentLogger = createAgentLogger('DevOps', { level: 'debug' });
```

### 3. Hierarchical Agent Logger

Agent logger with organizational hierarchy context:

```typescript
import { createHierarchicalAgentLogger } from '@recursivemanager/common';

const logger = createHierarchicalAgentLogger(db, 'backend-dev-001');
logger.info('Processing task');
// Automatically includes: agentId, managerId, subordinateIds, hierarchyPath
```

**Features**:
- All features of Agent Logger
- Automatic hierarchy metadata injection
- Respects `LOG_LEVEL` environment variable

## Examples

### Development Mode (Verbose)

```bash
export LOG_LEVEL=debug
recursivemanager run continuous
```

All debug messages will appear in logs and console.

### Production Mode (Standard)

```bash
export LOG_LEVEL=info
recursivemanager run continuous
```

Only info, warn, and error messages appear.

### Production Mode (Quiet)

```bash
export LOG_LEVEL=warn
recursivemanager run continuous
```

Only warnings and errors appear.

### Critical Errors Only

```bash
export LOG_LEVEL=error
recursivemanager run continuous
```

Only error messages appear.

## Log Output

### Console Output

Default logger and console-enabled loggers output to stdout/stderr:

```json
{"level":"info","message":"Agent hired successfully","agentId":"CEO","timestamp":"2026-01-20T18:30:00.000Z"}
```

### File Output

Agent loggers output to individual files:

```
~/.recursivemanager/logs/agents/CEO.log
~/.recursivemanager/logs/agents/CTO.log
~/.recursivemanager/logs/agents/backend-dev-001.log
```

### Log Rotation

Agent logs rotate daily:

```
CEO.log              # Current log
CEO-2026-01-19.log   # Previous day (compressed)
CEO-2026-01-18.log   # 2 days ago (compressed)
```

Logs are retained for 30 days by default.

## Correlation IDs (Trace IDs)

All loggers support automatic trace ID injection for distributed tracing:

```typescript
import { withTraceId, logger } from '@recursivemanager/common';

await withTraceId(async () => {
  logger.info('Starting execution');  // Automatically includes traceId
  await doWork();
  logger.info('Execution complete');  // Same traceId
});
```

Trace IDs are automatically generated and propagated through async execution chains.

## Best Practices

1. **Use `info` level in production** - Provides good visibility without excessive verbosity
2. **Use `debug` level during development** - Helps troubleshoot issues
3. **Use `warn` level for critical production systems** - Reduces log volume
4. **Use trace IDs for request correlation** - Helps debug distributed workflows
5. **Monitor log files for rotation** - Ensure disk space is adequate
6. **Parse JSON logs programmatically** - Easy integration with log aggregation tools

## Troubleshooting

### Logs Not Appearing

1. Check `LOG_LEVEL` environment variable:
   ```bash
   echo $LOG_LEVEL
   ```

2. Verify the log level is not filtering your messages:
   - `error` level: Only errors appear
   - `warn` level: Only warnings and errors appear
   - `info` level: info, warn, error appear (debug filtered)
   - `debug` level: All messages appear

### Changing Log Level at Runtime

Currently, log level is read at startup. To change it:

1. Update `.env` file or environment variable
2. Restart the application

### Log Files Growing Too Large

Agent logs rotate daily and compress automatically. To reduce log volume:

1. Increase log level (e.g., `info` → `warn`)
2. Reduce retention period (default: 30 days)

## Integration with Monitoring

RecursiveManager logs are JSON-formatted and ready for integration with:

- **Prometheus**: Use log-based metrics exporters
- **Grafana Loki**: Direct JSON log ingestion
- **ELK Stack**: Elasticsearch, Logstash, Kibana
- **Datadog**: Log forwarding and analysis
- **CloudWatch**: AWS log streaming

See [Monitoring Guide](./monitoring.md) for integration examples.
