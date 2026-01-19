# Configuration

RecursiveManager can be configured through environment variables or a `.env` file.

## Configuration File Location

The primary configuration file is located at:

```
~/.recursive-manager/.env
```

You can also use a `.env` file in your project directory.

## Environment Variables

### Installation Paths

- `RECURSIVE_MANAGER_HOME` - Installation directory (default: `~/.recursive-manager`)
- `RECURSIVE_MANAGER_DATA_DIR` - Data directory (default: `~/.recursive-manager/data`)

### Logging

- `LOG_LEVEL` - Logging level: `debug`, `info`, `warn`, `error` (default: `info`)
- `LOG_FILE` - Log file path (default: `~/.recursive-manager/logs/recursive-manager.log`)

### Agent Configuration

- `MAX_AGENT_DEPTH` - Maximum depth of agent hierarchy (default: `5`)
- `MAX_AGENTS_PER_MANAGER` - Maximum number of agents per manager (default: `10`)
- `AGENT_TIMEOUT_MS` - Agent execution timeout in milliseconds (default: `300000`)

### Execution

- `WORKER_POOL_SIZE` - Number of concurrent workers (default: `5`)
- `CONTINUOUS_EXECUTION_INTERVAL_MS` - Interval for continuous execution mode (default: `5000`)

### Framework Adapters

- `DEFAULT_FRAMEWORK` - Default AI framework to use (default: `claude-code`)
- `CLAUDE_CODE_PATH` - Path to Claude Code executable (default: `claude`)

### Database (Optional)

- `DATABASE_TYPE` - Database type: `sqlite` or `file` (default: `file`)
- `DATABASE_PATH` - Database file path (default: `~/.recursive-manager/data/recursive-manager.db`)

### Notifications (Optional)

- `SLACK_WEBHOOK_URL` - Slack webhook URL for notifications
- `DISCORD_WEBHOOK_URL` - Discord webhook URL for notifications
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `TELEGRAM_CHAT_ID` - Telegram chat ID

### GitHub Integration (Optional)

- `GITHUB_TOKEN` - GitHub personal access token
- `GITHUB_REPO` - GitHub repository (format: `owner/repo`)

## Example Configuration

```bash
# RecursiveManager Configuration

# Installation
RECURSIVE_MANAGER_HOME=~/.recursive-manager
RECURSIVE_MANAGER_DATA_DIR=~/.recursive-manager/data

# Logging
LOG_LEVEL=info
LOG_FILE=~/.recursive-manager/logs/recursive-manager.log

# Agent Configuration
MAX_AGENT_DEPTH=5
MAX_AGENTS_PER_MANAGER=10
AGENT_TIMEOUT_MS=300000

# Execution
WORKER_POOL_SIZE=5
CONTINUOUS_EXECUTION_INTERVAL_MS=5000

# Framework Adapters
DEFAULT_FRAMEWORK=claude-code
CLAUDE_CODE_PATH=claude
```

## Configuration Wizard

For an interactive configuration experience, use:

```bash
recursive-manager config
```

This will guide you through setting up all configuration options.
