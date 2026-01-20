# RecursiveManager Monitoring

This directory contains the monitoring configuration for RecursiveManager using Prometheus and Grafana.

## Overview

The monitoring stack consists of:
- **Prometheus**: Time-series database for metrics collection
- **Grafana**: Visualization and dashboard platform

## Quick Start

### 1. Start the Monitoring Stack

```bash
# Start RecursiveManager with monitoring
docker compose up -d

# Or start only monitoring services
docker compose up -d prometheus grafana
```

### 2. Access the Services

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (default credentials: admin/admin)
- **RecursiveManager Metrics**: http://localhost:3000/metrics

### 3. View Dashboards

Grafana will automatically load three pre-configured dashboards:

1. **RecursiveManager Overview** - Key metrics and execution statistics
2. **Agent Performance** - Per-agent metrics and health scores
3. **System Metrics** - Memory, CPU, and resource usage

## Configuration Files

### Prometheus Configuration

`prometheus.yml` - Prometheus scrape configuration:
- Scrapes RecursiveManager metrics every 15 seconds
- Target: `recursive-manager:3000/metrics`

### Grafana Configuration

#### Datasources
`grafana/provisioning/datasources/prometheus.yml` - Prometheus datasource configuration:
- Connects to Prometheus at `http://prometheus:9090`
- Set as default datasource

#### Dashboards
`grafana/provisioning/dashboards/` - Dashboard definitions:
- `dashboards.yml` - Dashboard provisioning configuration
- `overview.json` - RecursiveManager Overview dashboard
- `agent-performance.json` - Agent Performance dashboard
- `system-metrics.json` - System Metrics dashboard

## Available Metrics

### Execution Metrics
- `recursive_manager_executions_total` - Total execution count (by status, mode, agentId)
- `recursive_manager_execution_duration_ms` - Execution duration histogram
- `recursive_manager_active_executions` - Current active executions

### Queue Metrics
- `recursive_manager_queue_depth` - Current queue depth
- `recursive_manager_queue_wait_time_ms` - Queue wait time histogram

### Agent Metrics
- `recursive_manager_tasks_completed_total` - Tasks completed per agent
- `recursive_manager_messages_processed_total` - Messages processed per agent
- `recursive_manager_agent_health_score` - Agent health score (0-100)

### Resource Metrics
- `recursive_manager_quota_violations_total` - Quota violations (by type)
- `recursive_manager_memory_usage_bytes` - Memory usage (heapUsed, heapTotal, rss, external)
- `recursive_manager_cpu_usage_percent` - CPU usage percentage

### Analysis Metrics
- `recursive_manager_analysis_executions_total` - Analysis execution count
- `recursive_manager_analysis_duration_ms` - Analysis duration histogram

## Dashboard Descriptions

### RecursiveManager Overview
Provides a high-level view of system performance:
- Execution rate (per second)
- Active executions gauge
- Queue depth
- Execution status breakdown
- Duration percentiles (p50, p95, p99)
- Queue wait time analysis
- Quota violations

### Agent Performance
Focuses on individual agent metrics:
- Executions per agent (time series)
- Agent health scores
- Tasks completed per agent
- Messages processed per agent
- Duration percentiles per agent
- Success rates table
- Status breakdown (stacked)

### System Metrics
System-level resource monitoring:
- CPU usage over time
- Memory usage (heap, RSS, external)
- Current resource gauges
- Quota violations by type
- Memory growth rate
- Overall execution duration percentiles

## Customization

### Adding Custom Dashboards

1. Create a new dashboard JSON file in `grafana/provisioning/dashboards/`
2. Set the datasource to "Prometheus"
3. Use metrics from the Available Metrics list above
4. Restart Grafana: `docker compose restart grafana`

### Modifying Scrape Interval

Edit `prometheus.yml`:
```yaml
global:
  scrape_interval: 15s  # Change this value
```

### Configuring Alerts

1. Create alerting rules in `monitoring/prometheus-alerts.yml`
2. Update `prometheus.yml` to include the rules file
3. Configure alert manager in Grafana

## Troubleshooting

### Prometheus Not Scraping Metrics

1. Check RecursiveManager is running: `docker ps | grep recursive-manager`
2. Verify metrics endpoint: `curl http://localhost:3000/metrics`
3. Check Prometheus targets: http://localhost:9090/targets
4. Review Prometheus logs: `docker logs recursive-manager-prometheus`

### Grafana Dashboards Not Loading

1. Check dashboard files exist: `ls -la monitoring/grafana/provisioning/dashboards/`
2. Verify volume mount: `docker inspect recursive-manager-grafana | grep Mounts -A 20`
3. Check Grafana logs: `docker logs recursive-manager-grafana`
4. Manually import dashboards via Grafana UI

### No Data in Dashboards

1. Ensure RecursiveManager is processing executions
2. Check Prometheus is scraping: http://localhost:9090/targets
3. Query Prometheus directly: http://localhost:9090/graph
4. Verify time range in Grafana dashboards (default: last 1 hour)

## Best Practices

1. **Retention**: Prometheus retains data for 15 days by default. Adjust with `--storage.tsdb.retention.time` flag.
2. **Backup**: Regularly backup Prometheus and Grafana data volumes
3. **Security**: Change default Grafana password (`GRAFANA_ADMIN_PASSWORD` env var)
4. **Resources**: Monitor Prometheus memory usage, especially with high cardinality metrics
5. **Alerts**: Configure alerting for critical metrics (high error rate, resource exhaustion)

## Data Persistence

Both Prometheus and Grafana use Docker volumes for data persistence:
- `prometheus-data` - Stores Prometheus time-series data
- `grafana-data` - Stores Grafana dashboards and settings

To backup:
```bash
# Backup Prometheus data
docker run --rm -v recursive-manager_prometheus-data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-backup.tar.gz -C /data .

# Backup Grafana data
docker run --rm -v recursive-manager_grafana-data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-backup.tar.gz -C /data .
```

## Metrics Server CLI

Start the metrics server manually:
```bash
# Default (port 3000)
recursive-manager metrics

# Custom port
recursive-manager metrics --port 9090

# Custom host
recursive-manager metrics --host 127.0.0.1
```

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [prom-client Node.js Library](https://github.com/siimon/prom-client)
