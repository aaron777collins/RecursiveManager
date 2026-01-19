# Execution Modes

RecursiveManager supports multiple execution modes to suit different use cases.

## Sequential Mode

In sequential mode, agents execute one at a time in a predetermined order.

**Use Cases:**
- Tasks with strict dependencies
- Limited computational resources
- Debugging and development

**Example:**
```typescript
await manager.execute({ mode: 'sequential' });
```

## Parallel Mode

In parallel mode, multiple agents execute simultaneously.

**Use Cases:**
- Independent tasks
- Maximum throughput
- Production deployments

**Example:**
```typescript
await manager.execute({ mode: 'parallel', workers: 5 });
```

## Continuous Mode

In continuous mode, RecursiveManager runs indefinitely, processing new tasks as they arrive.

**Use Cases:**
- Long-running services
- Background processing
- Event-driven workflows

**Example:**
```typescript
await manager.execute({
  mode: 'continuous',
  interval: 5000 // Check every 5 seconds
});
```

## Batch Mode

In batch mode, tasks are grouped and processed together.

**Use Cases:**
- Scheduled jobs
- Bulk operations
- Resource optimization

**Example:**
```typescript
await manager.execute({
  mode: 'batch',
  batchSize: 10,
  schedule: '0 0 * * *' // Daily at midnight
});
```

## Hybrid Mode

Hybrid mode combines multiple execution strategies.

**Example:**
```typescript
await manager.execute({
  mode: 'hybrid',
  parallel: {
    workers: 3,
    tasks: ['research', 'development']
  },
  sequential: {
    tasks: ['testing', 'deployment']
  }
});
```

## Configuration

Execution modes can be configured via environment variables:

```bash
# Worker pool size for parallel mode
WORKER_POOL_SIZE=5

# Continuous mode interval (ms)
CONTINUOUS_EXECUTION_INTERVAL_MS=5000

# Default execution mode
DEFAULT_EXECUTION_MODE=parallel
```

## Worker Pool

In parallel and continuous modes, RecursiveManager uses a worker pool:

- Fixed number of concurrent workers
- Task queue management
- Load balancing
- Resource limits

## Execution Strategy

RecursiveManager automatically selects the best execution strategy based on:

- Task dependencies
- Available resources
- Agent hierarchy depth
- Historical performance

## Monitoring

Monitor execution in real-time:

```bash
# View active agents
recursive-manager status --filter working

# View execution metrics
recursive-manager debug --metrics
```

## Error Handling

Different execution modes handle errors differently:

### Sequential Mode
- Stops on first error
- Allows for immediate debugging
- Easy error tracing

### Parallel Mode
- Continues other tasks on error
- Collects all errors
- Retry failed tasks

### Continuous Mode
- Logs errors
- Continues processing
- Alerts on repeated failures

## Performance Considerations

### Sequential Mode
- **Pros**: Predictable, easy to debug
- **Cons**: Slowest throughput

### Parallel Mode
- **Pros**: Maximum throughput
- **Cons**: Higher resource usage

### Continuous Mode
- **Pros**: Always available
- **Cons**: Requires monitoring

## Best Practices

1. **Development**: Use sequential mode for debugging
2. **Production**: Use parallel mode for performance
3. **Services**: Use continuous mode for always-on
4. **Scheduled Tasks**: Use batch mode
5. **Complex Workflows**: Use hybrid mode

## Examples

### Web Scraping Project

```typescript
// Sequential for research (order matters)
await manager.execute({
  mode: 'sequential',
  tasks: ['requirements', 'competitor-analysis']
});

// Parallel for implementation (independent)
await manager.execute({
  mode: 'parallel',
  workers: 3,
  tasks: ['scraper', 'parser', 'storage']
});

// Sequential for deployment (order matters)
await manager.execute({
  mode: 'sequential',
  tasks: ['testing', 'deployment']
});
```

### Continuous Service

```typescript
// Run forever, checking every 10 seconds
await manager.execute({
  mode: 'continuous',
  interval: 10000,
  maxConcurrent: 5
});
```
