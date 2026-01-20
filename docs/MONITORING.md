# Monitoring and Metrics Guide

**Version**: 1.0
**Last Updated**: 2026-01-20

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Metrics Reference](#metrics-reference)
4. [Prometheus Configuration](#prometheus-configuration)
5. [Grafana Dashboards](#grafana-dashboards)
6. [CLI Metrics Server](#cli-metrics-server)
7. [Logging System](#logging-system)
8. [Alerting and Notifications](#alerting-and-notifications)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### What is RecursiveManager Monitoring?

RecursiveManager includes a comprehensive monitoring and observability stack built on industry-standard tools:

- **Prometheus**: Time-series metrics collection and storage
- **Grafana**: Rich visualization and dashboarding
- **Winston**: Structured JSON logging with correlation IDs
- **prom-client**: Node.js Prometheus client library

### Key Features

- **Real-time Metrics**: Live performance and health monitoring
- **Pre-built Dashboards**: 3 Grafana dashboards ready to use
- **Distributed Tracing**: Automatic correlation IDs across all logs
- **Resource Monitoring**: CPU, memory, and system metrics
- **Agent Analytics**: Per-agent execution statistics and health scores
- **Queue Monitoring**: Execution queue depth and wait times
- **Analysis Tracking**: Multi-perspective AI analysis metrics
- **Production-Ready**: Docker-based deployment with persistence

### Why Use Monitoring?

1. **Performance Insights**: Understand system behavior and bottlenecks
2. **Proactive Alerting**: Catch issues before they impact users
3. **Capacity Planning**: Track resource usage and growth trends
4. **Debugging**: Correlation IDs link logs to specific executions
5. **Optimization**: Identify slow agents and optimize execution
6. **Compliance**: Audit logs for security and compliance requirements

---

## Quick Start

Get monitoring up and running in 5 minutes.

### Prerequisites

- Docker and Docker Compose installed
- RecursiveManager installed and configured
- Ports 3000, 3001, and 9090 available

### Step 1: Start Monitoring Stack

```bash
# Start RecursiveManager with full monitoring stack
docker compose up -d

# Or start only monitoring services
docker compose up -d prometheus grafana
```

### Step 2: Access Services

Open your browser and navigate to:

- **Grafana**: http://localhost:3001
  - Default credentials: `admin` / `admin`
  - Change password on first login
- **Prometheus**: http://localhost:9090
  - Direct metrics queries and exploration
- **Metrics Endpoint**: http://localhost:3000/metrics
  - Raw Prometheus metrics from RecursiveManager

### Step 3: View Dashboards

In Grafana, navigate to **Dashboards** → **RecursiveManager** folder:

1. **Overview** - System-wide metrics and execution statistics
2. **Agent Performance** - Per-agent metrics and health
3. **System Metrics** - CPU, memory, and resource usage

### Step 4: Run Test Execution

Generate some metrics data:

```bash
# Hire an agent to generate execution metrics
recursive-manager hire cto "Build a new feature"

# Run multi-perspective analysis to generate analysis metrics
recursive-manager analyze "Should we implement feature X?"

# Check metrics are flowing
curl http://localhost:3000/metrics | grep recursive_manager
```

You should now see data appearing in the Grafana dashboards!

---

## Metrics Reference

RecursiveManager exposes comprehensive metrics in Prometheus format.

### Execution Metrics

#### `recursive_manager_executions_total` (Counter)
Total number of agent executions.

**Labels**:
- `mode`: Execution mode (`continuous` or `reactive`)
- `status`: Execution outcome (`success` or `failure`)
- `agent_id`: Unique agent identifier

**Example queries**:
```promql
# Total executions across all agents
sum(recursive_manager_executions_total)

# Success rate for reactive mode
sum(rate(recursive_manager_executions_total{mode="reactive",status="success"}[5m]))
/ sum(rate(recursive_manager_executions_total{mode="reactive"}[5m]))

# Executions per agent (last 5 minutes)
sum by (agent_id) (rate(recursive_manager_executions_total[5m]))
```

#### `recursive_manager_execution_duration_ms` (Histogram)
Execution duration in milliseconds.

**Labels**:
- `mode`: Execution mode (`continuous` or `reactive`)
- `agent_id`: Unique agent identifier

**Buckets**: 100ms, 500ms, 1s, 5s, 10s, 30s, 60s, 120s, 300s

**Example queries**:
```promql
# p95 execution duration for all agents
histogram_quantile(0.95, sum(rate(recursive_manager_execution_duration_ms_bucket[5m])) by (le))

# Average execution time per agent
sum by (agent_id) (rate(recursive_manager_execution_duration_ms_sum[5m]))
/ sum by (agent_id) (rate(recursive_manager_execution_duration_ms_count[5m]))

# Slowest agents (p99 duration)
topk(5, histogram_quantile(0.99, sum by (agent_id, le) (rate(recursive_manager_execution_duration_ms_bucket[5m]))))
```

#### `recursive_manager_active_executions` (Gauge)
Current number of active/running executions.

**Example queries**:
```promql
# Current active executions
recursive_manager_active_executions

# Alert when too many concurrent executions
recursive_manager_active_executions > 100
```

### Queue Metrics

#### `recursive_manager_queue_depth` (Gauge)
Current number of tasks waiting in execution queue.

**Example queries**:
```promql
# Current queue depth
recursive_manager_queue_depth

# Alert on queue backlog
recursive_manager_queue_depth > 50
```

#### `recursive_manager_queue_wait_time_ms` (Histogram)
Time tasks spend waiting in queue before execution.

**Buckets**: 10ms, 50ms, 100ms, 500ms, 1s, 5s, 10s, 30s

**Example queries**:
```promql
# p95 queue wait time
histogram_quantile(0.95, rate(recursive_manager_queue_wait_time_ms_bucket[5m]))

# Average wait time
rate(recursive_manager_queue_wait_time_ms_sum[5m])
/ rate(recursive_manager_queue_wait_time_ms_count[5m])
```

### Agent Metrics

#### `recursive_manager_tasks_completed_total` (Counter)
Total number of tasks completed by agents.

**Labels**:
- `agent_id`: Unique agent identifier

**Example queries**:
```promql
# Tasks completed per agent
sum by (agent_id) (recursive_manager_tasks_completed_total)

# Task completion rate (tasks/second)
sum by (agent_id) (rate(recursive_manager_tasks_completed_total[5m]))
```

#### `recursive_manager_messages_processed_total` (Counter)
Total number of messages processed by agents.

**Labels**:
- `agent_id`: Unique agent identifier

#### `recursive_manager_agent_health_score` (Gauge)
Agent health score (0-100, higher is better).

**Labels**:
- `agent_id`: Unique agent identifier

**Example queries**:
```promql
# Agents with low health scores
recursive_manager_agent_health_score < 50

# Average health across all agents
avg(recursive_manager_agent_health_score)
```

### Resource Metrics

#### `recursive_manager_quota_violations_total` (Counter)
Total number of resource quota violations.

**Labels**:
- `violation_type`: Type of violation (`memory`, `cpu`, or `time`)
- `agent_id`: Agent that violated quota

**Example queries**:
```promql
# Total violations by type
sum by (violation_type) (recursive_manager_quota_violations_total)

# Agents with most violations
topk(5, sum by (agent_id) (recursive_manager_quota_violations_total))
```

#### `recursive_manager_memory_usage_bytes` (Gauge)
Current memory usage in bytes.

**Labels**:
- `type`: Memory type (`heapUsed`, `heapTotal`, `rss`, `external`)

**Example queries**:
```promql
# Heap memory used (MB)
recursive_manager_memory_usage_bytes{type="heapUsed"} / 1024 / 1024

# Memory growth rate (MB/hour)
rate(recursive_manager_memory_usage_bytes{type="rss"}[1h]) * 3600 / 1024 / 1024

# Alert on high memory usage (>1GB heap)
recursive_manager_memory_usage_bytes{type="heapUsed"} > 1e9
```

#### `recursive_manager_cpu_usage_percent` (Gauge)
CPU usage percentage (0-100).

**Example queries**:
```promql
# Current CPU usage
recursive_manager_cpu_usage_percent

# Alert on sustained high CPU (>80% for 5 minutes)
avg_over_time(recursive_manager_cpu_usage_percent[5m]) > 80
```

### Analysis Metrics

#### `recursive_manager_analysis_executions_total` (Counter)
Total number of multi-perspective AI analysis executions.

**Labels**:
- `status`: Analysis outcome (`success` or `failure`)

#### `recursive_manager_analysis_duration_ms` (Histogram)
Multi-perspective analysis duration in milliseconds.

**Buckets**: 500ms, 1s, 5s, 10s, 30s, 60s, 120s

**Example queries**:
```promql
# p95 analysis duration
histogram_quantile(0.95, rate(recursive_manager_analysis_duration_ms_bucket[5m]))

# Analysis success rate
sum(rate(recursive_manager_analysis_executions_total{status="success"}[5m]))
/ sum(rate(recursive_manager_analysis_executions_total[5m]))
```

---

## Prometheus Configuration

### Scrape Configuration

The default Prometheus configuration scrapes RecursiveManager every 15 seconds:

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'recursive-manager'
    static_configs:
      - targets: ['recursive-manager:3000']
```

### Customizing Scrape Interval

Edit `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 30s  # Scrape less frequently
  # OR
  scrape_interval: 5s   # Scrape more frequently (higher load)
```

Restart Prometheus:
```bash
docker compose restart prometheus
```

### Data Retention

Prometheus retains data for 15 days by default. To change:

```yaml
# docker-compose.yml
services:
  prometheus:
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'  # Keep for 30 days
```

### Storage Considerations

- **Default retention**: 15 days
- **Disk usage**: ~1-2GB per 15 days (depends on metric cardinality)
- **Recommendation**: Monitor `prometheus-data` volume size regularly

---

## Grafana Dashboards

RecursiveManager includes 3 pre-configured Grafana dashboards.

### Dashboard 1: RecursiveManager Overview

**Purpose**: High-level system health and performance.

**Panels**:
- **Execution Rate**: Executions per second (success vs. failure)
- **Active Executions**: Current running executions (gauge)
- **Queue Depth**: Tasks waiting in queue (gauge)
- **Execution Status**: Success/failure breakdown (pie chart)
- **Duration Percentiles**: p50, p95, p99 execution times
- **Queue Wait Time**: p50, p95, p99 wait times
- **Quota Violations**: Resource limit violations by type

**Use cases**:
- Daily health checks
- Capacity planning
- Performance monitoring

### Dashboard 2: Agent Performance

**Purpose**: Per-agent execution analytics.

**Panels**:
- **Executions by Agent**: Time series showing executions per agent
- **Agent Health Scores**: Health gauge for each agent (0-100)
- **Tasks Completed**: Total tasks per agent
- **Messages Processed**: Total messages per agent
- **Duration p95**: 95th percentile execution time per agent
- **Success Rate Table**: Sortable table with success rates
- **Status Breakdown**: Stacked area chart (success/failure by agent)

**Use cases**:
- Identifying slow agents
- Agent health monitoring
- Comparing agent performance

### Dashboard 3: System Metrics

**Purpose**: System resource monitoring.

**Panels**:
- **CPU Usage**: CPU percentage over time
- **Memory Usage**: Heap, RSS, and external memory
- **Current CPU Gauge**: Real-time CPU usage with thresholds
- **Current Memory Gauge**: Real-time memory with thresholds
- **Quota Violations by Type**: Memory, CPU, and time violations
- **Memory Growth Rate**: Rate of memory increase
- **Execution Duration**: Overall p50, p95, p99 percentiles

**Use cases**:
- Resource capacity planning
- Memory leak detection
- Performance optimization

### Customizing Dashboards

#### Method 1: UI Customization

1. Open Grafana: http://localhost:3001
2. Navigate to dashboard
3. Click **Edit** (pencil icon) on any panel
4. Modify query, visualization, or settings
5. Click **Save** (top-right)

Note: Changes made via UI will persist in Grafana's database but won't update the JSON files.

#### Method 2: JSON Export/Import

1. Edit dashboard JSON files in `monitoring/grafana/provisioning/dashboards/`
2. Modify panels, queries, or settings
3. Restart Grafana: `docker compose restart grafana`

Example panel modification:
```json
{
  "title": "My Custom Panel",
  "targets": [
    {
      "expr": "sum(rate(recursive_manager_executions_total[5m]))",
      "legendFormat": "Execution Rate"
    }
  ]
}
```

### Creating New Dashboards

1. Create dashboard JSON file in `monitoring/grafana/provisioning/dashboards/`
2. Set datasource to `"datasource": "Prometheus"`
3. Use metrics from [Metrics Reference](#metrics-reference)
4. Restart Grafana: `docker compose restart grafana`

---

## CLI Metrics Server

### Starting Metrics Server

```bash
# Default (port 3000)
recursive-manager metrics

# Custom port
recursive-manager metrics --port 9090

# Custom host (bind to specific interface)
recursive-manager metrics --host 127.0.0.1

# Bind to all interfaces (default)
recursive-manager metrics --host 0.0.0.0
```

### Available Endpoints

| Endpoint | Description | Content-Type |
|----------|-------------|--------------|
| `/` | Server information | `application/json` |
| `/health` | Health check | `application/json` |
| `/metrics` | Prometheus metrics | `text/plain` |

### Health Check Response

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "healthy",
  "timestamp": "2026-01-20T12:34:56.789Z",
  "uptime": 12345.67
}
```

### Metrics Response

```bash
curl http://localhost:3000/metrics
```

```
# HELP recursive_manager_executions_total Total number of feature executions
# TYPE recursive_manager_executions_total counter
recursive_manager_executions_total{mode="continuous",status="success",agent_id="cto"} 42
recursive_manager_executions_total{mode="reactive",status="success",agent_id="ceo"} 18

# HELP recursive_manager_execution_duration_ms Feature execution duration in milliseconds
# TYPE recursive_manager_execution_duration_ms histogram
recursive_manager_execution_duration_ms_bucket{le="100",mode="continuous",agent_id="cto"} 5
recursive_manager_execution_duration_ms_bucket{le="500",mode="continuous",agent_id="cto"} 20
...
```

### Graceful Shutdown

The metrics server handles graceful shutdown:

```bash
# Press Ctrl+C or send SIGTERM
^C
Received SIGINT, shutting down gracefully...
✓ Server stopped
```

---

## Logging System

RecursiveManager uses Winston for structured logging with automatic correlation IDs.

### Log Levels

Configure log level via environment variable:

```bash
# .env or environment
LOG_LEVEL=debug  # debug, info, warn, error
```

**Available levels**:
- `debug`: Maximum verbosity (development/troubleshooting)
- `info`: Standard verbosity (production default)
- `warn`: Warnings and errors only (quiet production)
- `error`: Critical errors only

### Correlation IDs (Trace IDs)

All logs automatically include correlation IDs for distributed tracing:

```javascript
// Logs within this scope automatically get the same trace ID
withTraceId(async () => {
  logger.info('Starting execution');  // [trace: abc-123-def]
  await doWork();
  logger.info('Execution complete');  // [trace: abc-123-def]
});
```

**Benefits**:
- Track requests across multiple operations
- Link related log entries
- Debug complex execution flows
- Isolate concurrent executions

### Log Format

**Console output** (development):
```
2026-01-20T12:34:56.789Z [info] Starting execution {"traceId":"abc-123-def","agentId":"cto"}
```

**JSON output** (production):
```json
{
  "level": "info",
  "message": "Starting execution",
  "timestamp": "2026-01-20T12:34:56.789Z",
  "traceId": "abc-123-def",
  "agentId": "cto"
}
```

### Log File Rotation

Logs are automatically rotated:
- **Max file size**: 10MB
- **Max files**: 10 files
- **Location**: `~/.recursive-manager/logs/`
- **Compression**: Old logs are gzipped

### Searching Logs

```bash
# Search logs by trace ID
grep "abc-123-def" ~/.recursive-manager/logs/combined.log

# Search error logs only
grep '"level":"error"' ~/.recursive-manager/logs/error.log

# Follow live logs
tail -f ~/.recursive-manager/logs/combined.log
```

### Integration with Monitoring Tools

See `docs/guides/logging.md` for integration with:
- Prometheus (log-based metrics)
- Grafana Loki (log aggregation)
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Datadog (APM and logging)

---

## Alerting and Notifications

### Prometheus Alerting Rules

Create alert rules in `monitoring/prometheus-alerts.yml`:

```yaml
groups:
  - name: recursive_manager_alerts
    interval: 30s
    rules:
      # High error rate alert
      - alert: HighErrorRate
        expr: |
          sum(rate(recursive_manager_executions_total{status="failure"}[5m]))
          / sum(rate(recursive_manager_executions_total[5m])) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High execution error rate"
          description: "Error rate is {{ $value | humanizePercentage }}"

      # Queue backlog alert
      - alert: QueueBacklog
        expr: recursive_manager_queue_depth > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Execution queue is backed up"
          description: "Queue depth is {{ $value }} tasks"

      # High memory usage alert
      - alert: HighMemoryUsage
        expr: recursive_manager_memory_usage_bytes{type="heapUsed"} > 1e9
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High memory usage detected"
          description: "Heap usage is {{ $value | humanize }}B"

      # Agent health alert
      - alert: LowAgentHealth
        expr: recursive_manager_agent_health_score < 30
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Agent {{ $labels.agent_id }} has low health"
          description: "Health score is {{ $value }}"

      # CPU saturation alert
      - alert: HighCPUUsage
        expr: avg_over_time(recursive_manager_cpu_usage_percent[5m]) > 90
        for: 10m
        labels:
          severity: critical
        annotations:
          summary: "CPU usage is critically high"
          description: "Average CPU usage is {{ $value | humanize }}%"
```

### Configuring Alert Manager

Update `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

rule_files:
  - /etc/prometheus/prometheus-alerts.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

### Grafana Alerts

1. Open Grafana dashboard
2. Edit panel → **Alert** tab
3. Configure alert condition
4. Set notification channel (email, Slack, PagerDuty, etc.)

Example: Alert when queue depth > 50
```
Condition: WHEN avg() OF query(A, 5m, now) IS ABOVE 50
Evaluate every: 1m
For: 5m
```

---

## Best Practices

### Metrics Collection

1. **Scrape Interval**: 15-30 seconds for most use cases
   - Higher frequency = more data points but higher load
   - Lower frequency = less overhead but less granularity

2. **Cardinality**: Avoid high-cardinality labels
   - Good: `agent_id` (dozens of unique values)
   - Bad: `task_id` (thousands/millions of unique values)

3. **Metric Naming**: Follow Prometheus conventions
   - Suffix with units: `_bytes`, `_seconds`, `_total`
   - Use base units: bytes (not KB), seconds (not ms)

### Dashboard Design

1. **Overview First**: Create high-level dashboards before detailed ones
2. **Use Percentiles**: p95/p99 better than averages for latency
3. **Color Coding**: Green (good), Yellow (warning), Red (critical)
4. **Appropriate Graphs**: Time series for trends, gauges for current state
5. **Template Variables**: Use for filtering by agent, mode, etc.

### Data Retention

1. **Prometheus**: 15-30 days for recent data
2. **Long-term Storage**: Export to external TSDB if needed
3. **Grafana**: Regular backups of dashboard JSON files
4. **Logs**: Rotate and compress old logs

### Security

1. **Change Default Passwords**: Update Grafana admin password
2. **Network Security**: Don't expose metrics publicly
3. **Access Control**: Use Grafana authentication/authorization
4. **Encrypt Transit**: Use HTTPS/TLS in production
5. **Secret Management**: Use environment variables for API keys

### Performance

1. **Monitor the Monitor**: Watch Prometheus memory usage
2. **Query Optimization**: Use recording rules for complex queries
3. **Dashboard Refresh**: Don't auto-refresh faster than scrape interval
4. **Resource Limits**: Set memory/CPU limits in Docker Compose

### Alerting

1. **Start Simple**: Begin with basic alerts (error rate, memory)
2. **Avoid Alert Fatigue**: Set appropriate thresholds and durations
3. **Actionable Alerts**: Include runbooks and context
4. **Test Alerts**: Trigger test alerts to verify notification flow
5. **On-Call Rotation**: Document who responds to alerts

---

## Troubleshooting

### Metrics Not Appearing in Prometheus

**Symptom**: Prometheus shows "no data" or empty graphs.

**Checks**:
1. Verify RecursiveManager is running:
   ```bash
   docker ps | grep recursive-manager
   ```

2. Test metrics endpoint directly:
   ```bash
   curl http://localhost:3000/metrics
   ```

3. Check Prometheus targets (should be "UP"):
   ```
   http://localhost:9090/targets
   ```

4. Review Prometheus logs:
   ```bash
   docker logs recursive-manager-prometheus
   ```

**Solutions**:
- Ensure RecursiveManager metrics server is started
- Verify network connectivity between services
- Check Prometheus scrape configuration

### Grafana Dashboards Not Loading

**Symptom**: Dashboards don't appear in Grafana.

**Checks**:
1. Verify dashboard files exist:
   ```bash
   ls -la monitoring/grafana/provisioning/dashboards/
   ```

2. Check Docker volume mounts:
   ```bash
   docker inspect recursive-manager-grafana | grep Mounts -A 20
   ```

3. Review Grafana logs:
   ```bash
   docker logs recursive-manager-grafana
   ```

**Solutions**:
- Ensure volume paths are correct in `docker-compose.yml`
- Restart Grafana: `docker compose restart grafana`
- Manually import dashboards via Grafana UI

### No Data in Grafana Dashboards

**Symptom**: Dashboards load but show no data.

**Checks**:
1. Verify Prometheus datasource is configured:
   - Grafana → Configuration → Data sources → Prometheus

2. Test Prometheus queries directly:
   ```
   http://localhost:9090/graph
   ```

3. Check time range in Grafana (default: last 1 hour)

4. Ensure RecursiveManager has processed executions:
   ```bash
   recursive-manager hire cto "Test task"
   ```

**Solutions**:
- Adjust time range to include data
- Generate test metrics
- Verify Prometheus is scraping successfully

### High Memory Usage

**Symptom**: Prometheus or Grafana consuming excessive memory.

**Checks**:
```bash
docker stats recursive-manager-prometheus
docker stats recursive-manager-grafana
```

**Solutions**:
1. Reduce retention period
2. Increase resource limits in `docker-compose.yml`
3. Use recording rules to pre-compute complex queries
4. Reduce scrape frequency

### Port Already in Use

**Symptom**: `Error: Port 3000 is already in use`

**Solutions**:
```bash
# Find process using port
lsof -i :3000

# Use different port
recursive-manager metrics --port 9090

# Or stop conflicting process
kill <PID>
```

### Logs Not Including Trace IDs

**Symptom**: Correlation IDs missing from logs.

**Checks**:
- Ensure execution is wrapped in `withTraceId()`
- Check AsyncLocalStorage is supported (Node.js >= 16)

**Solutions**:
```javascript
// Wrap execution with trace context
import { withTraceId } from '@recursive-manager/common';

await withTraceId(async () => {
  // All logs here will have trace ID
  logger.info('Execution started');
});
```

### Dashboard Query Errors

**Symptom**: "No data" or "Error" in dashboard panels.

**Checks**:
1. Open panel → Edit → Query inspector
2. Review error message
3. Test query in Prometheus UI

**Common fixes**:
- Fix metric name typos
- Adjust label matchers
- Check time range
- Simplify complex queries

---

## Related Documentation

- [Logging Guide](./guides/logging.md) - Comprehensive logging configuration
- [Docker Guide](./DOCKER.md) - Docker deployment details
- [Configuration Guide](./configuration.md) - Environment variables
- [CLI Reference](./cli-reference.md) - All CLI commands

---

## Support and Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Winston Logging](https://github.com/winstonjs/winston)
- [prom-client](https://github.com/siimon/prom-client)

For RecursiveManager-specific issues, see [Troubleshooting](#troubleshooting) or check the project repository.
