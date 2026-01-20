# Configuration Guide

> **RecursiveManager v1.0.0** - Complete configuration reference for all deployment scenarios

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Configuration Files](#configuration-files)
3. [Environment Variables Reference](#environment-variables-reference)
   - [Installation & Paths](#installation--paths)
   - [Logging](#logging)
   - [Agent Configuration](#agent-configuration)
   - [Execution Settings](#execution-settings)
   - [Framework Adapters](#framework-adapters)
4. [Database Configuration](#database-configuration)
5. [Database Encryption](#database-encryption)
6. [Secret Management](#secret-management)
7. [AI Provider Configuration](#ai-provider-configuration)
8. [Scheduler Configuration](#scheduler-configuration)
9. [Monitoring Configuration](#monitoring-configuration)
10. [Notification Configuration](#notification-configuration)
11. [GitHub Integration](#github-integration)
12. [Docker Configuration](#docker-configuration)
13. [Agent-Specific Configuration](#agent-specific-configuration)
14. [CLI Configuration Commands](#cli-configuration-commands)
15. [Security Best Practices](#security-best-practices)
16. [Configuration Loading Priority](#configuration-loading-priority)
17. [Example Configurations](#example-configurations)
18. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Interactive Configuration

The fastest way to configure RecursiveManager:

```bash
# Initialize with interactive wizard
recursive-manager init

# Or use the configuration command
recursive-manager config
```

### Manual Configuration

Create a `.env` file in your installation directory:

```bash
# Create config directory
mkdir -p ~/.recursive-manager

# Create configuration file
cat > ~/.recursive-manager/.env << 'EOF'
# RecursiveManager Configuration v1.0.0

# AI Provider (recommended: aiceo-gateway)
AI_PROVIDER=aiceo-gateway
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-api-key-here

# Logging
LOG_LEVEL=info

# Execution
WORKER_POOL_SIZE=5
EOF
```

---

## Configuration Files

### File Locations

RecursiveManager looks for configuration files in this order:

1. **Installation Directory**: `~/.recursive-manager/.env` (recommended)
2. **Current Directory**: `./.env` (project-specific overrides)
3. **Environment Variables**: Process environment (highest priority)

### Template Files

- **`.env.example`** - Complete template with all options documented
- **`.env.docker`** - Docker-specific configuration template
- **`config.json`** - Per-agent configuration (auto-generated)

### Creating Your Configuration

```bash
# Copy the example template
cp .env.example ~/.recursive-manager/.env

# Edit with your settings
nano ~/.recursive-manager/.env
```

---

## Environment Variables Reference

### Installation & Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `RECURSIVE_MANAGER_HOME` | `~/.recursive-manager` | Root installation directory containing all data, logs, and configuration |
| `RECURSIVE_MANAGER_DATA_DIR` | `~/.recursive-manager/data` | Data storage directory for databases, snapshots, and agent workspaces |

**Example:**
```bash
# Custom installation location
RECURSIVE_MANAGER_HOME=/opt/recursive-manager
RECURSIVE_MANAGER_DATA_DIR=/var/lib/recursive-manager
```

---

### Logging

| Variable | Default | Valid Values | Description |
|----------|---------|--------------|-------------|
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` | Minimum log level for all loggers |
| `LOG_FILE` | `~/.recursive-manager/logs/recursive-manager.log` | File path | Log output file location |

**Log Level Details:**

- **`debug`**: Maximum verbosity - shows all operations, SQL queries, internal state changes. Use for development and troubleshooting.
- **`info`**: Standard verbosity - shows important events, agent actions, task completions. Recommended for production.
- **`warn`**: Quiet mode - only warnings and errors. Use for production when log volume is a concern.
- **`error`**: Minimal - only critical errors that require immediate attention.

**Example:**
```bash
# Development environment
LOG_LEVEL=debug
LOG_FILE=/var/log/recursive-manager/debug.log

# Production environment
LOG_LEVEL=info
LOG_FILE=/var/log/recursive-manager/production.log
```

**Log Features:**
- JSON format support for structured logging
- Correlation IDs for request tracing
- Hierarchical agent context (organizational path)
- Log rotation with compression
- Retention policies (default: 30 days)

---

### Agent Configuration

| Variable | Default | Range | Description |
|----------|---------|-------|-------------|
| `MAX_AGENT_DEPTH` | `5` | 1-100 | Maximum organizational hierarchy depth (CEO → Manager → Developer → ...) |
| `MAX_AGENTS_PER_MANAGER` | `10` | 1-1000 | Maximum subordinate agents per manager |
| `AGENT_TIMEOUT_MS` | `300000` (5 min) | 1000+ | Single agent execution timeout in milliseconds |

**Hierarchy Examples:**

```
Depth 1: CEO
Depth 2: CEO → CTO
Depth 3: CEO → CTO → Backend Lead
Depth 4: CEO → CTO → Backend Lead → Senior Developer
Depth 5: CEO → CTO → Backend Lead → Senior Developer → Junior Developer
```

**Example:**
```bash
# Large organization (up to 7 levels)
MAX_AGENT_DEPTH=7

# Flat organization (max 20 direct reports)
MAX_AGENTS_PER_MANAGER=20

# Long-running tasks (30 minute timeout)
AGENT_TIMEOUT_MS=1800000
```

---

### Execution Settings

| Variable | Default | Range | Description |
|----------|---------|-------|-------------|
| `WORKER_POOL_SIZE` | `5` | 1-100 | Number of concurrent worker threads for task execution |
| `CONTINUOUS_EXECUTION_INTERVAL_MS` | `5000` | 1000+ | Polling interval for continuous execution mode |

**Worker Pool Sizing:**

- **Low Load (1-3 workers)**: Single-user development, low-priority background tasks
- **Medium Load (5-10 workers)**: Typical production deployment, balanced performance
- **High Load (15-50 workers)**: High-throughput scenarios, many concurrent agents
- **Very High Load (50-100 workers)**: Enterprise deployments with significant workloads

**Resource Impact:**
- Each worker consumes ~50-100MB RAM
- CPU usage scales linearly with worker count
- Consider system resources when setting pool size

**Example:**
```bash
# High-throughput production environment
WORKER_POOL_SIZE=20
CONTINUOUS_EXECUTION_INTERVAL_MS=2000

# Resource-constrained environment
WORKER_POOL_SIZE=2
CONTINUOUS_EXECUTION_INTERVAL_MS=10000
```

---

### Framework Adapters

| Variable | Default | Valid Values | Description |
|----------|---------|--------------|-------------|
| `DEFAULT_FRAMEWORK` | `claude-code` | `claude-code` | Default AI code generation framework for agent execution |
| `CLAUDE_CODE_PATH` | `claude` | File path | Path to Claude Code CLI executable |

**Example:**
```bash
# Custom Claude Code installation
DEFAULT_FRAMEWORK=claude-code
CLAUDE_CODE_PATH=/usr/local/bin/claude

# Development environment with custom build
CLAUDE_CODE_PATH=/home/user/dev/claude-code/bin/claude
```

---

## Database Configuration

### Basic Database Settings

| Variable | Default | Valid Values | Description |
|----------|---------|--------------|-------------|
| `DATABASE_TYPE` | `file` | `file`, `sqlite` | Database backend type (both use SQLite under the hood) |
| `DATABASE_PATH` | `~/.recursive-manager/data/recursive-manager.db` | File path | SQLite database file location |

**Database Features (Enabled by Default):**

- **WAL Mode**: Write-Ahead Logging for concurrent reads and crash recovery
- **Foreign Keys**: Referential integrity enforcement
- **Cache Size**: 10MB (10,000 pages × 4KB page size)
- **Temp Store**: In-memory temporary tables
- **Timeout**: 5 seconds for lock acquisition
- **Synchronous**: Full durability (PRAGMA synchronous=FULL)

**Example:**
```bash
# Production database on persistent volume
DATABASE_TYPE=sqlite
DATABASE_PATH=/var/lib/recursive-manager/production.db

# Development database with ephemeral data
DATABASE_TYPE=file
DATABASE_PATH=/tmp/recursive-manager-dev.db
```

### Database Maintenance

```bash
# Backup database
sqlite3 ~/.recursive-manager/data/recursive-manager.db ".backup backup.db"

# Check database integrity
sqlite3 ~/.recursive-manager/data/recursive-manager.db "PRAGMA integrity_check;"

# Vacuum (compact) database
sqlite3 ~/.recursive-manager/data/recursive-manager.db "VACUUM;"
```

---

## Database Encryption

**Encryption Algorithm**: AES-256-GCM with authenticated encryption

### Encryption Configuration

| Variable | Format | Description |
|----------|--------|-------------|
| `DATABASE_ENCRYPTION_KEY` | Password or 64-char hex | Encryption key for sensitive database fields |
| `DATABASE_ENCRYPTION_USE_KDF` | `true` or `false` | Enable PBKDF2 key derivation (recommended for passwords) |

### Encryption Parameters

- **Algorithm**: AES-256-GCM
- **IV Length**: 16 bytes (128 bits)
- **Salt Length**: 32 bytes (256 bits)
- **PBKDF2 Iterations**: 100,000
- **Tag Length**: 16 bytes (authentication tag)

### Encrypted Fields

The following database fields are encrypted when `DATABASE_ENCRYPTION_KEY` is set:

- Agent API keys
- Secret values
- External API credentials
- Sensitive agent configuration
- Custom metadata marked as sensitive

### Setup Examples

**Option 1: Password-Based Key (Recommended for Simplicity)**

```bash
# Use a strong passphrase (PBKDF2 derives the key)
DATABASE_ENCRYPTION_KEY="MyStr0ng!Passphrase#2024"
DATABASE_ENCRYPTION_USE_KDF=true
```

**Option 2: Raw Cryptographic Key (Recommended for Maximum Security)**

```bash
# Generate a secure 32-byte (64-char hex) key
openssl rand -hex 32  # Copy output to env var

# Use the raw key directly (no KDF needed)
DATABASE_ENCRYPTION_KEY="a1b2c3d4e5f6...64-character-hex-string...xyz890"
DATABASE_ENCRYPTION_USE_KDF=false
```

**Option 3: No Encryption (Development Only)**

```bash
# Omit encryption variables
# DATABASE_ENCRYPTION_KEY not set
# DATABASE_ENCRYPTION_USE_KDF not set
```

### Key Rotation

⚠️ **Important**: Changing the encryption key requires database re-encryption:

```bash
# 1. Backup current database
recursive-manager snapshot create backup-before-rotation

# 2. Export data (decrypted)
sqlite3 ~/.recursive-manager/data/recursive-manager.db ".dump" > dump.sql

# 3. Update DATABASE_ENCRYPTION_KEY in .env

# 4. Recreate database
rm ~/.recursive-manager/data/recursive-manager.db
recursive-manager init

# 5. Import data (will be re-encrypted with new key)
sqlite3 ~/.recursive-manager/data/recursive-manager.db < dump.sql
```

---

## Secret Management

Centralized management for API keys, tokens, and sensitive configuration.

### Secret Configuration

| Variable | Format | Default | Description |
|----------|--------|---------|-------------|
| `SECRET_ENCRYPTION_KEY` | 64-char hex or password | Optional | Master key for encrypting all secrets |
| `SECRET_ENCRYPTION_USE_KDF` | `true`/`false` | `false` | Use password-based key derivation (PBKDF2) |
| `SECRET_CACHE_EXPIRY_MS` | Integer | `300000` (5 min) | In-memory cache expiration time for decrypted secrets |

### Features

- **Encryption**: AES-256-GCM for all stored secrets
- **Audit Logging**: Immutable audit trail for all secret operations (create, access, rotate, delete)
- **Metadata Tracking**: Creation time, last access, expiration dates
- **Rotation Policies**: `manual`, `auto`, `none`
- **Access Control**: Failed access tracking and rate limiting

### Secret Management Examples

**Store a Secret:**

```bash
# Via environment variable
export MY_API_KEY="sk-1234567890abcdef"
SECRET_ENCRYPTION_KEY="your-master-key-here"

# The secret is automatically encrypted before storage
```

**Secret Rotation:**

```typescript
// Programmatic rotation
const secretManager = new SecretManager();
await secretManager.rotateSecret('api-key-name', 'new-secret-value');
```

**Audit Trail:**

All secret operations are logged:
```
[2024-01-19 10:30:00] SECRET_ACCESS: api-key-name by agent-123
[2024-01-19 11:45:00] SECRET_ROTATE: api-key-name by admin
[2024-01-19 15:20:00] SECRET_DELETE: old-key by admin
```

---

## AI Provider Configuration

RecursiveManager supports multiple AI providers with automatic failover.

### Provider Selection

| Variable | Valid Values | Default | Description |
|----------|--------------|---------|-------------|
| `AI_PROVIDER` | `aiceo-gateway`, `anthropic-direct`, `openai-direct`, `custom` | `aiceo-gateway` | Primary AI provider for multi-perspective analysis |
| `AI_FALLBACK_PROVIDER` | Same as above | Optional | Fallback provider if primary is unavailable |
| `AGENT_EXECUTION_PROVIDER` | `aiceo-gateway`, `anthropic-direct` | `aiceo-gateway` | Provider for agent task execution |

### AICEO Gateway Configuration (Recommended)

**Why AICEO Gateway?**
- Centralized rate limiting across all agents
- Quota management and cost control
- Automatic failover to multiple LLM backends
- Request prioritization
- Shared authentication

| Variable | Format | Default | Description |
|----------|--------|---------|-------------|
| `AICEO_GATEWAY_URL` | URL | `http://localhost:4000/api/glm/submit` | Gateway submission endpoint |
| `AICEO_GATEWAY_API_KEY` | String | Required | Shared secret for gateway authentication |
| `AICEO_GATEWAY_PROVIDER` | `glm`, `anthropic`, `openai` | `glm` | Which LLM backend the gateway should route to |
| `AICEO_GATEWAY_MODEL` | String | `glm-4.7` | Model identifier for gateway requests |
| `AICEO_GATEWAY_PRIORITY` | `high`, `normal`, `low` | `high` | Request priority in gateway queue |

**Example:**
```bash
AI_PROVIDER=aiceo-gateway
AICEO_GATEWAY_URL=https://aiceo.example.com/api/glm/submit
AICEO_GATEWAY_API_KEY=your-gateway-key-here
AICEO_GATEWAY_PROVIDER=glm
AICEO_GATEWAY_MODEL=glm-4.7
AICEO_GATEWAY_PRIORITY=high
```

### Direct Anthropic Configuration

| Variable | Format | Default | Description |
|----------|--------|---------|-------------|
| `ANTHROPIC_API_KEY` | String | Optional | Anthropic API authentication key |
| `ANTHROPIC_API_URL` | URL | `https://api.anthropic.com/v1/messages` | Anthropic API endpoint |
| `ANTHROPIC_BASE_URL` | URL | `https://api.anthropic.com` | Base URL for Anthropic API |
| `ANTHROPIC_MODEL` | String | `claude-sonnet-4-5` | Claude model to use |

**Example:**
```bash
AI_PROVIDER=anthropic-direct
ANTHROPIC_API_KEY=sk-ant-api03-...your-key-here
ANTHROPIC_MODEL=claude-sonnet-4-5
```

**Available Models:**
- `claude-sonnet-4-5` - Latest Sonnet (recommended)
- `claude-opus-4-5` - Most capable, higher cost
- `claude-haiku-4-5` - Fastest, lower cost

### Direct GLM Configuration

| Variable | Format | Default | Description |
|----------|--------|---------|-------------|
| `GLM_API_KEY` | String | Optional | GLM API authentication key |
| `GLM_API_URL` | URL | `https://open.bigmodel.cn/api/paas/v4/chat/completions` | GLM API endpoint |
| `GLM_MODEL` | String | `glm-4.7` | GLM model identifier |

**Example:**
```bash
AI_PROVIDER=glm-direct
GLM_API_KEY=your-glm-key.here
GLM_MODEL=glm-4.7
```

### Direct OpenAI Configuration

| Variable | Format | Default | Description |
|----------|--------|---------|-------------|
| `OPENAI_API_KEY` | String | Optional | OpenAI API authentication key |
| `OPENAI_API_URL` | URL | `https://api.openai.com/v1/chat/completions` | OpenAI API endpoint |
| `OPENAI_MODEL` | String | `gpt-4-turbo` | OpenAI model identifier |

**Example:**
```bash
AI_PROVIDER=openai-direct
OPENAI_API_KEY=sk-proj-...your-key-here
OPENAI_MODEL=gpt-4-turbo
```

**Available Models:**
- `gpt-4-turbo` - Latest GPT-4 with vision
- `gpt-4` - Standard GPT-4
- `gpt-3.5-turbo` - Faster, lower cost

### Custom Provider Configuration

| Variable | Format | Description |
|----------|--------|-------------|
| `CUSTOM_PROVIDER_URL` | URL | Custom API endpoint |
| `CUSTOM_PROVIDER_API_KEY` | String | Custom provider API key |
| `CUSTOM_PROVIDER_FORMAT` | `openai`, `anthropic`, `custom` | Request format template |

**Example:**
```bash
AI_PROVIDER=custom
CUSTOM_PROVIDER_URL=https://my-llm.example.com/v1/chat
CUSTOM_PROVIDER_API_KEY=my-custom-key
CUSTOM_PROVIDER_FORMAT=openai
```

### Multi-Perspective Analysis Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ANALYSIS_CACHE_TTL_MS` | Integer | `3600000` (1 hour) | Cache duration for analysis results |

**Analysis Agents (8 Perspectives):**

1. **Security Agent** - Vulnerability analysis, OWASP compliance, risk assessment
2. **Architecture Agent** - SOLID principles, scalability, technical debt
3. **Simplicity Agent** - YAGNI, KISS, complexity reduction
4. **Financial Agent** - ROI, TCO, cost-benefit analysis
5. **Marketing Agent** - Positioning, competitive advantage, GTM strategy
6. **UX Agent** - WCAG compliance, usability, user journey
7. **Growth Agent** - AARRR metrics, virality, PLG strategies
8. **Emotional Agent** - Developer morale, DX, burnout prevention

**Example:**
```bash
# Enable analysis caching for 2 hours
ANALYSIS_CACHE_TTL_MS=7200000

# Use AICEO Gateway for analysis
AI_PROVIDER=aiceo-gateway
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-key
```

### Provider Health Checks

```bash
# Verify AI provider configuration
recursive-manager config --get ai.provider

# Test provider connectivity (future feature)
recursive-manager debug provider-health
```

---

## Scheduler Configuration

The scheduler manages when and how agents execute tasks.

### Schedule Types

- **Continuous**: Run constantly until no tasks remain
- **Cron**: Time-based scheduling (e.g., "every day at 2 AM")
- **Reactive**: Event-driven execution

### Schedule Database Schema

Schedules are stored in the `schedules` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique schedule identifier |
| `agent_id` | String | Associated agent identifier |
| `trigger_type` | Enum | `continuous`, `cron`, or `reactive` |
| `cron_expression` | String | Cron format (e.g., `0 2 * * *` = 2 AM daily) |
| `timezone` | String | Timezone for cron evaluation (default: `UTC`) |
| `next_execution_at` | Timestamp | When the schedule should next execute |
| `minimum_interval_seconds` | Integer | Minimum gap between executions |
| `only_when_tasks_pending` | Boolean | Only execute if tasks are waiting |
| `enabled` | Boolean | Whether schedule is active |
| `dependencies` | JSON Array | Schedule IDs that must complete first |
| `execution_id` | String | Current execution ID in ExecutionPool |
| `last_triggered_at` | Timestamp | Last execution timestamp |

### Schedule Examples

**Daily Backup (Cron):**
```json
{
  "agent_id": "backup-agent",
  "trigger_type": "cron",
  "cron_expression": "0 2 * * *",
  "timezone": "America/New_York",
  "enabled": true
}
```

**Continuous Processing:**
```json
{
  "agent_id": "task-processor",
  "trigger_type": "continuous",
  "minimum_interval_seconds": 60,
  "only_when_tasks_pending": true,
  "enabled": true
}
```

**Dependent Execution:**
```json
{
  "agent_id": "report-generator",
  "trigger_type": "cron",
  "cron_expression": "0 3 * * *",
  "dependencies": ["backup-agent-schedule-id"],
  "enabled": true
}
```

### Scheduler Features

- **Cron Expression Validation**: Validates syntax before saving
- **Timezone Support**: Per-schedule timezone configuration
- **Dependency Resolution**: Waits for dependent schedules to complete
- **ExecutionPool Integration**: Respects worker pool limits and resource quotas
- **Deadlock Detection**: Identifies circular dependencies

### Managing Schedules

```bash
# View all schedules (future CLI feature)
recursive-manager scheduler list

# Enable/disable a schedule
recursive-manager scheduler enable <schedule-id>
recursive-manager scheduler disable <schedule-id>

# Create a cron schedule
recursive-manager scheduler create \
  --agent backup-agent \
  --cron "0 2 * * *" \
  --timezone "UTC"
```

---

## Monitoring Configuration

RecursiveManager provides comprehensive monitoring through Prometheus, Grafana, and Winston logging.

### Prometheus Configuration

**Configuration File**: `monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s       # Scrape targets every 15 seconds
  evaluation_interval: 15s   # Evaluate rules every 15 seconds

scrape_configs:
  - job_name: 'recursive-manager'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['recursive-manager:3000']
```

**Access**: http://localhost:9090 (default Prometheus port)

### Grafana Configuration

**Configuration File**: `monitoring/grafana/provisioning/datasources/prometheus.yml`

```yaml
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    jsonData:
      timeInterval: 15s
      queryTimeout: 60s
```

**Access**: http://localhost:3001 (default Grafana port)
**Default Credentials**: `admin` / `admin` (change on first login)

### Metrics Server Configuration

Start the metrics HTTP server:

```bash
# Start metrics server on default port 3000
recursive-manager metrics

# Custom port
recursive-manager metrics --port 3100
```

**Endpoints:**
- `GET /` - Server info and available endpoints
- `GET /health` - Health check with uptime
- `GET /metrics` - Prometheus-format metrics

### Available Metrics

| Metric Name | Type | Description |
|-------------|------|-------------|
| `recursive_manager_executions_total` | Counter | Total agent executions (labels: `agent_id`, `status`) |
| `recursive_manager_execution_duration_ms` | Histogram | Task execution time distribution |
| `recursive_manager_active_executions` | Gauge | Currently running executions |
| `recursive_manager_queue_depth` | Gauge | Tasks waiting in queue |
| `recursive_manager_queue_wait_time_ms` | Histogram | Time tasks spend in queue |
| `recursive_manager_tasks_completed_total` | Counter | Completed tasks by agent |
| `recursive_manager_messages_processed_total` | Counter | Inter-agent messages |
| `recursive_manager_agent_health_score` | Gauge | Per-agent health score (0-100) |
| `recursive_manager_quota_violations_total` | Counter | Resource limit violations |
| `recursive_manager_memory_usage_bytes` | Gauge | Heap memory usage |
| `recursive_manager_cpu_usage_percent` | Gauge | CPU utilization percentage |
| `recursive_manager_analysis_executions_total` | Counter | Multi-perspective analyses run |
| `recursive_manager_analysis_duration_ms` | Histogram | Analysis execution time |

### Alert Rules

**Configuration File**: `monitoring/prometheus-alerts.yml`

Critical alerts configured:
- `HighErrorRate` - Execution failure rate > 10%
- `QueueBacklog` - Queue depth > 100 tasks
- `HighMemoryUsage` - Heap usage > 1GB
- `LowAgentHealth` - Health score < 30
- `HighCPUUsage` - CPU > 90%
- `AnalysisTimeout` - Analysis > 60s
- `ResourceQuotaViolations` - Quota violations detected
- `MemoryLeakSuspected` - Memory growth > 50% in 1 hour

### Grafana Dashboards

Three pre-built dashboards included:

1. **RecursiveManager Overview** - System-wide metrics, execution rates, queue depth
2. **Agent Performance** - Per-agent analytics, health scores, completion rates
3. **System Metrics** - CPU/memory/resource monitoring

**Import Dashboards:**
```bash
# Dashboards auto-loaded from monitoring/grafana/dashboards/
# Access via Grafana UI → Dashboards → Browse
```

### Monitoring Best Practices

1. **Retention**: Default 15 days for Prometheus data
2. **Scrape Interval**: 15s for production, 5s for debugging
3. **Alert Channels**: Configure Slack/Email for critical alerts
4. **Dashboard Customization**: Clone and customize pre-built dashboards
5. **Resource Planning**:
   - Prometheus: ~50MB RAM + 1GB storage per day
   - Grafana: ~200MB RAM
   - Metrics endpoint: Minimal overhead (~5MB)

---

## Notification Configuration

Optional integrations for alerts and status updates.

| Variable | Format | Description |
|----------|--------|-------------|
| `SLACK_WEBHOOK_URL` | URL | Slack incoming webhook for notifications |
| `DISCORD_WEBHOOK_URL` | URL | Discord webhook for alerts |
| `TELEGRAM_BOT_TOKEN` | String | Telegram bot token |
| `TELEGRAM_CHAT_ID` | String | Telegram chat/group identifier |

### Slack Integration

```bash
# Configure Slack webhook
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX

# Test notification (future feature)
recursive-manager notify --slack "Test notification"
```

### Discord Integration

```bash
# Configure Discord webhook
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/123456789/abcdefghijklmnopqrstuvwxyz

# Test notification (future feature)
recursive-manager notify --discord "Test notification"
```

### Telegram Integration

```bash
# Configure Telegram bot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=-1001234567890

# Test notification (future feature)
recursive-manager notify --telegram "Test notification"
```

---

## GitHub Integration

Optional integration for issue tracking and version control.

| Variable | Format | Description |
|----------|--------|-------------|
| `GITHUB_TOKEN` | String | GitHub personal access token (requires `repo` scope) |
| `GITHUB_REPO` | String | Repository in `owner/repo` format |

### Setup

1. **Create Personal Access Token**: https://github.com/settings/tokens
2. **Required Scopes**: `repo` (full repository access)
3. **Configure Environment**:

```bash
GITHUB_TOKEN=ghp_your_token_here
GITHUB_REPO=yourusername/recursive-manager
```

### Features (Future)

- Create issues from agent errors
- Link commits to task execution
- Automated PR creation for agent-generated code

---

## Docker Configuration

RecursiveManager includes production-ready Docker support.

### Docker Environment Variables

| Variable | Default (Container) | Description |
|----------|---------------------|-------------|
| `NODE_ENV` | `production` | Node.js environment mode |
| `RECURSIVE_MANAGER_HOME` | `/app/data` | Container data directory |
| `RECURSIVE_MANAGER_DATA_DIR` | `/app/data` | Container data directory |
| `LOG_FILE` | `/app/logs/recursive-manager.log` | Container log file path |
| `METRICS_PORT` | `3000` | Metrics HTTP server port |

### Docker Compose Configuration

**File**: `docker-compose.yml`

```yaml
services:
  recursive-manager:
    build: .
    container_name: recursive-manager
    ports:
      - "3000:3000"  # Metrics endpoint
    volumes:
      - recursive-manager-data:/app/data
      - recursive-manager-logs:/app/logs
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - AI_PROVIDER=aiceo-gateway
      - AICEO_GATEWAY_URL=http://host.docker.internal:4000/api/glm/submit
      - AICEO_GATEWAY_API_KEY=${AICEO_GATEWAY_API_KEY}
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
    restart: unless-stopped
```

### Volume Management

```bash
# Inspect volumes
docker volume inspect recursive-manager-data
docker volume inspect recursive-manager-logs

# Backup volumes
docker run --rm \
  -v recursive-manager-data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/data-backup.tar.gz /data

# Restore volumes
docker run --rm \
  -v recursive-manager-data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar xzf /backup/data-backup.tar.gz -C /
```

### Docker Networking

```bash
# Access host services from container
# Use: host.docker.internal:<port>
# Example: AICEO_GATEWAY_URL=http://host.docker.internal:4000/api/glm/submit

# Custom network
docker network create recursive-manager-network
```

---

## Agent-Specific Configuration

Each agent has its own configuration file auto-generated during creation.

### Configuration File Location

```
{RECURSIVE_MANAGER_DATA_DIR}/agents/{agentId}/config.json
```

Example: `~/.recursive-manager/data/agents/ceo-001/config.json`

### Configuration Structure

```json
{
  "identity": {
    "id": "ceo-001",
    "role": "CEO",
    "displayName": "Chief Executive Officer",
    "createdAt": "2024-01-19T10:30:00Z",
    "createdBy": "system",
    "reportingTo": null
  },
  "goal": {
    "mainGoal": "Manage the organization and delegate work to subordinates",
    "subGoals": [
      "Hire managers for key departments",
      "Review and approve strategic decisions",
      "Monitor organizational health"
    ],
    "successCriteria": [
      "All departments have active managers",
      "No critical blockers escalated",
      "Organizational health score > 80"
    ]
  },
  "permissions": {
    "canHire": true,
    "maxSubordinates": 10,
    "hiringBudget": 5,
    "canFire": true,
    "canEscalate": false,
    "canAccessExternalAPIs": true,
    "allowedDomains": ["api.github.com", "api.slack.com"],
    "maxDelegationDepth": 3,
    "canSelfModify": false,
    "workspaceQuotaMB": 1000,
    "maxExecutionMinutes": 30
  },
  "framework": {
    "primary": "claude-code",
    "fallback": null,
    "capabilities": ["code-generation", "analysis", "refactoring"]
  },
  "behavior": {
    "verbosity": 3,
    "maxExecutionTime": 30,
    "maxCostPerExecution": 1.0,
    "requireApprovalForExecution": false,
    "autoEscalateBlockedTasks": true,
    "escalationTimeoutMinutes": 60,
    "continuousMode": false,
    "customInstructions": "Be proactive and delegate work effectively."
  },
  "multiPerspectiveAnalysis": {
    "enabled": true,
    "perspectives": ["security", "architecture", "financial", "ux"],
    "triggerOn": ["hire", "fire", "major-decision"]
  },
  "escalationPolicy": {
    "autoEscalateAfterFailures": 3,
    "escalateOnBlockedTask": true,
    "escalateOnBudgetExceeded": true
  },
  "delegation": {
    "delegateThreshold": 0.7,
    "keepWhenDelegating": true,
    "supervisionLevel": "moderate"
  },
  "communicationChannels": {
    "preferredChannels": ["internal", "slack"],
    "slackChannel": "#engineering",
    "telegramChatId": null,
    "emailAddress": "ceo@example.com",
    "notifyManager": {
      "onTaskCompletion": true,
      "onError": true,
      "onEscalation": true,
      "onDeadlock": true
    },
    "updateFrequency": "daily",
    "notifyOnDelegation": true,
    "notifyOnEscalation": true,
    "notifyOnCompletion": true,
    "notifyOnDeadlock": true
  },
  "metadata": {
    "tags": ["leadership", "executive"],
    "description": "Top-level executive managing the organization",
    "notes": "First agent created during initialization",
    "priority": "critical",
    "customData": {}
  }
}
```

### Modifying Agent Configuration

**Via CLI (Future Feature):**
```bash
# Update agent configuration
recursive-manager agent config <agent-id> \
  --set permissions.maxSubordinates=20 \
  --set behavior.verbosity=4
```

**Manual Editing:**
```bash
# Edit agent config directly
nano ~/.recursive-manager/data/agents/ceo-001/config.json

# Validate configuration (future feature)
recursive-manager agent validate ceo-001
```

---

## CLI Configuration Commands

The `config` command provides interactive and programmatic configuration management.

### Usage

```bash
recursive-manager config [options]
```

### Options

| Option | Description |
|--------|-------------|
| `--get <key>` | Retrieve a configuration value |
| `--set <key=value>` | Set a configuration value |
| `--list` | Display all configuration |
| `--data-dir <dir>` | Use custom data directory |

### Examples

```bash
# List all configuration
recursive-manager config --list

# Get worker pool size
recursive-manager config --get execution.workerPoolSize

# Set worker pool size
recursive-manager config --set execution.workerPoolSize=10

# Get max concurrent tasks
recursive-manager config --get execution.maxConcurrentTasks

# Set max concurrent tasks
recursive-manager config --set execution.maxConcurrentTasks=50

# Use custom data directory
recursive-manager config --data-dir /var/lib/recursive-manager --list
```

### Configurable Keys

| Key | Type | Range | Description |
|-----|------|-------|-------------|
| `execution.workerPoolSize` | Integer | 1-100 | Number of concurrent workers |
| `execution.maxConcurrentTasks` | Integer | 1-1000 | Maximum concurrent tasks across all agents |

---

## Security Best Practices

### Encryption Keys

✅ **Do:**
- Use strong passwords (20+ characters, mixed case, symbols)
- Generate cryptographic keys with `openssl rand -hex 32`
- Store keys in secure secrets management (Vault, AWS Secrets Manager)
- Rotate keys periodically (quarterly recommended)

❌ **Don't:**
- Use weak passwords or dictionary words
- Commit `.env` files with keys to version control
- Share keys via insecure channels (email, chat)
- Reuse keys across environments

### Key Derivation Function (KDF)

Always use `DATABASE_ENCRYPTION_USE_KDF=true` for password-based keys:

```bash
# Good: Password with KDF
DATABASE_ENCRYPTION_KEY="MyStr0ng!Passphrase#2024"
DATABASE_ENCRYPTION_USE_KDF=true

# Also Good: Raw key without KDF
DATABASE_ENCRYPTION_KEY="a1b2c3...64-char-hex...xyz890"
DATABASE_ENCRYPTION_USE_KDF=false

# Bad: Password without KDF (weak)
DATABASE_ENCRYPTION_KEY="weak"
DATABASE_ENCRYPTION_USE_KDF=false
```

### Secret Management

✅ **Do:**
- Use `SECRET_ENCRYPTION_KEY` for API keys and tokens
- Configure rotation policies for sensitive secrets
- Monitor audit logs for unauthorized access
- Set cache expiry to minimize memory exposure

❌ **Don't:**
- Store API keys in code or configuration files
- Use the same key for database and secret encryption
- Disable audit logging

### AI Provider Security

✅ **Do:**
- Use AICEO Gateway for centralized authentication
- Rotate API keys regularly
- Monitor API usage for anomalies
- Use HTTPS for all provider endpoints

❌ **Don't:**
- Embed API keys in agent configurations
- Use HTTP endpoints in production
- Share API keys across environments

### Network Security

✅ **Do:**
- Run Prometheus/Grafana in private network
- Use firewall rules to restrict metrics endpoint access
- Enable HTTPS for web interfaces (reverse proxy)
- Use strong Grafana admin password

❌ **Don't:**
- Expose metrics endpoint to public internet
- Use default passwords (Grafana: admin/admin)
- Allow unauthenticated access to monitoring

### Database Security

✅ **Do:**
- Enable WAL mode (enabled by default)
- Use database encryption for sensitive data
- Implement regular backup procedures
- Set appropriate file permissions (600 for `.db` files)

❌ **Don't:**
- Store database in world-readable directory
- Disable foreign key constraints
- Skip database integrity checks

---

## Configuration Loading Priority

Configuration is loaded in this order (later sources override earlier):

1. **Default Values** (hardcoded in source)
2. **`~/.recursive-manager/.env`** (user home directory)
3. **`./.env`** (current working directory)
4. **Process Environment Variables** (highest priority)

### Example Override Behavior

```bash
# Default: LOG_LEVEL=info

# ~/.recursive-manager/.env
LOG_LEVEL=warn

# ./.env (current directory)
LOG_LEVEL=debug

# Process environment
export LOG_LEVEL=error

# Effective value: error (process env wins)
```

### Troubleshooting Configuration

```bash
# Check effective configuration
recursive-manager config --list

# Verify environment variables
env | grep RECURSIVE_MANAGER
env | grep LOG_LEVEL
env | grep AI_PROVIDER

# Test configuration loading
recursive-manager debug config-test
```

---

## Example Configurations

### Development Environment

```bash
# .env - Development Configuration
NODE_ENV=development

# Logging
LOG_LEVEL=debug
LOG_FILE=./logs/dev.log

# Execution
WORKER_POOL_SIZE=2
CONTINUOUS_EXECUTION_INTERVAL_MS=10000

# AI Provider (local gateway)
AI_PROVIDER=aiceo-gateway
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=dev-key

# Database
DATABASE_PATH=./dev-data/recursive-manager.db

# No encryption in dev (optional - use if testing encryption)
# DATABASE_ENCRYPTION_KEY=dev-only-key
# DATABASE_ENCRYPTION_USE_KDF=true

# Monitoring
METRICS_PORT=3000
```

### Production Environment

```bash
# .env - Production Configuration
NODE_ENV=production

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/recursive-manager/production.log

# Execution
WORKER_POOL_SIZE=20
CONTINUOUS_EXECUTION_INTERVAL_MS=5000
AGENT_TIMEOUT_MS=600000

# AI Provider (production gateway)
AI_PROVIDER=aiceo-gateway
AI_FALLBACK_PROVIDER=anthropic-direct
AICEO_GATEWAY_URL=https://aiceo.example.com/api/glm/submit
AICEO_GATEWAY_API_KEY=${AICEO_API_KEY}  # From secrets manager
AICEO_GATEWAY_PRIORITY=high

# Anthropic fallback
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}  # From secrets manager
ANTHROPIC_MODEL=claude-sonnet-4-5

# Database
DATABASE_PATH=/var/lib/recursive-manager/production.db
DATABASE_ENCRYPTION_KEY=${DB_ENCRYPTION_KEY}  # From secrets manager
DATABASE_ENCRYPTION_USE_KDF=false  # Using raw key

# Secret Management
SECRET_ENCRYPTION_KEY=${SECRET_MASTER_KEY}  # From secrets manager
SECRET_ENCRYPTION_USE_KDF=false
SECRET_CACHE_EXPIRY_MS=300000

# Monitoring
METRICS_PORT=3000

# Notifications
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK}  # From secrets manager

# GitHub Integration
GITHUB_TOKEN=${GITHUB_PAT}  # From secrets manager
GITHUB_REPO=company/recursive-manager
```

### Docker Compose Environment

```bash
# .env.docker - Docker Configuration
NODE_ENV=production

# Container paths
RECURSIVE_MANAGER_HOME=/app/data
RECURSIVE_MANAGER_DATA_DIR=/app/data
LOG_FILE=/app/logs/recursive-manager.log

# Logging
LOG_LEVEL=info

# Execution
WORKER_POOL_SIZE=10

# AI Provider (host.docker.internal for gateway on host)
AI_PROVIDER=aiceo-gateway
AICEO_GATEWAY_URL=http://host.docker.internal:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=${AICEO_GATEWAY_API_KEY}

# Database (in Docker volume)
DATABASE_PATH=/app/data/recursive-manager.db
DATABASE_ENCRYPTION_KEY=${DATABASE_ENCRYPTION_KEY}
DATABASE_ENCRYPTION_USE_KDF=false

# Monitoring
METRICS_PORT=3000
```

### CI/CD Environment

```bash
# .env.ci - CI/CD Configuration
NODE_ENV=test

# Logging (minimal in CI)
LOG_LEVEL=warn
LOG_FILE=/tmp/ci-logs/recursive-manager.log

# Execution (limited resources)
WORKER_POOL_SIZE=2
AGENT_TIMEOUT_MS=120000

# AI Provider (mock or test endpoint)
AI_PROVIDER=aiceo-gateway
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=ci-test-key

# Database (ephemeral)
DATABASE_PATH=/tmp/recursive-manager-ci.db

# No encryption in CI (faster tests)
# DATABASE_ENCRYPTION_KEY not set
```

---

## Troubleshooting

### Configuration Not Loading

**Problem**: Environment variables not taking effect

**Solutions**:
```bash
# Verify .env file location
ls -la ~/.recursive-manager/.env

# Check file permissions
chmod 600 ~/.recursive-manager/.env

# Verify syntax (no spaces around =)
# Good: LOG_LEVEL=info
# Bad:  LOG_LEVEL = info

# Test configuration loading
recursive-manager config --list
```

### Database Encryption Errors

**Problem**: `Error: Invalid encryption key` or `Error: Decryption failed`

**Solutions**:
```bash
# Verify key length (must be 64 hex chars or password with KDF)
echo -n "$DATABASE_ENCRYPTION_KEY" | wc -c  # Should be 64 for hex

# Check KDF setting matches key type
# Password: DATABASE_ENCRYPTION_USE_KDF=true
# Hex key: DATABASE_ENCRYPTION_USE_KDF=false

# Re-generate key if corrupted
openssl rand -hex 32  # New 64-char hex key
```

### AI Provider Connection Failures

**Problem**: `Error: Provider unavailable` or `Error: Authentication failed`

**Solutions**:
```bash
# Verify provider URL is accessible
curl -I $AICEO_GATEWAY_URL

# Check API key format
echo "$AICEO_GATEWAY_API_KEY" | wc -c  # Verify length

# Test with fallback provider
AI_FALLBACK_PROVIDER=anthropic-direct

# Enable debug logging
LOG_LEVEL=debug
recursive-manager analyze "test"
```

### Metrics Endpoint Issues

**Problem**: `Error: Cannot start metrics server` or port conflicts

**Solutions**:
```bash
# Check if port is in use
lsof -i :3000

# Use custom port
recursive-manager metrics --port 3100

# Verify firewall rules
sudo ufw status
sudo ufw allow 3000/tcp
```

### Docker Volume Permission Issues

**Problem**: `Error: EACCES: permission denied` in Docker

**Solutions**:
```bash
# Fix volume permissions
docker run --rm \
  -v recursive-manager-data:/data \
  alpine chown -R 1000:1000 /data

# Rebuild with correct user
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Configuration Validation

```bash
# Validate all configuration (future feature)
recursive-manager config --validate

# Check specific settings
recursive-manager config --get execution.workerPoolSize
recursive-manager config --get ai.provider
```

---

## Related Documentation

- **[Installation Guide](./INSTALLATION.md)** - Complete installation instructions
- **[CLI Reference](./cli-reference.md)** - All CLI commands
- **[Docker Guide](./DOCKER.md)** - Docker deployment
- **[Monitoring Guide](./MONITORING.md)** - Prometheus and Grafana setup
- **[Security Guide](./SECURITY.md)** - Security best practices
- **[Architecture Guide](./ARCHITECTURE.md)** - System design and architecture

---

## Version

**RecursiveManager v1.0.0** - Production Release

Last Updated: 2024-01-19

For issues or questions, see [Troubleshooting Guide](./TROUBLESHOOTING.md) or open an issue on GitHub.
