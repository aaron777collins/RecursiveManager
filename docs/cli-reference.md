# CLI Reference

Complete reference for all RecursiveManager CLI commands.

## Global Options

- `--version` - Show version information
- `--help` - Show help information

## Commands

### init

Initialize RecursiveManager with a goal.

```bash
recursive-manager init <goal>
```

**Arguments:**
- `<goal>` - The goal for the agent hierarchy to achieve

**Options:**
- `--workspace <path>` - Custom workspace directory
- `--depth <number>` - Maximum agent hierarchy depth (default: 5)
- `--framework <name>` - AI framework to use (default: claude-code)

**Examples:**

```bash
# Initialize with a simple goal
recursive-manager init "Analyze competitor pricing"

# Initialize with custom workspace
recursive-manager init "Build API scraper" --workspace ./my-project

# Initialize with custom depth
recursive-manager init "Complex task" --depth 10
```

### status

Show the agent organization chart or details about a specific agent.

```bash
recursive-manager status [options]
```

**Options:**
- `--agent-id <id>` - Show details for specific agent
- `--format <type>` - Output format: `tree`, `json`, `table` (default: tree)
- `--depth <number>` - Maximum depth to display
- `--filter <status>` - Filter by status: `idle`, `working`, `completed`, `failed`

**Examples:**

```bash
# Show organization chart
recursive-manager status

# Show specific agent details
recursive-manager status --agent-id agent-123

# Show as JSON
recursive-manager status --format json

# Filter by status
recursive-manager status --filter working
```

### update

Update RecursiveManager to the latest version.

```bash
recursive-manager update [version] [options]
```

**Arguments:**
- `[version]` - Optional specific version to install

**Options:**
- `--check` - Check for available updates without installing
- `--list` - List all available versions
- `--history` - Show version history
- `--prerelease` - Include pre-release versions
- `--force` - Force update even if already up to date

**Examples:**

```bash
# Update to latest version
recursive-manager update

# Check for updates
recursive-manager update --check

# List available versions
recursive-manager update --list

# Install specific version
recursive-manager update 0.2.0
```

### rollback

Rollback to the previous version.

```bash
recursive-manager rollback
```

This command will restore the previous version from the backup created during the last update.

### config

Interactive configuration wizard.

```bash
recursive-manager config [options]
```

**Options:**
- `--show` - Show current configuration
- `--edit` - Open configuration file in editor
- `--reset` - Reset to default configuration

**Examples:**

```bash
# Run configuration wizard
recursive-manager config

# Show current configuration
recursive-manager config --show

# Edit configuration file
recursive-manager config --edit
```

### debug

Debug an agent with detailed information.

```bash
recursive-manager debug <agent-id> [options]
```

**Arguments:**
- `<agent-id>` - ID of the agent to debug

**Options:**
- `--logs` - Show agent logs
- `--state` - Show agent state
- `--tasks` - Show agent tasks
- `--all` - Show all debugging information

**Examples:**

```bash
# Debug agent with all information
recursive-manager debug agent-123 --all

# Show only agent logs
recursive-manager debug agent-123 --logs

# Show agent state
recursive-manager debug agent-123 --state
```

### analyze

Run multi-perspective AI analysis on a decision or question.

```bash
recursive-manager analyze <question> [options]
```

**Arguments:**
- `<question>` - The question or decision to analyze

**Options:**
- `--format <format>` - Output format: `text`, `json`, `markdown` (default: text)
- `--data-dir <dir>` - Custom data directory
- `--timeout <seconds>` - Analysis timeout in seconds (default: 120)

**Examples:**

```bash
# Analyze a technical decision
recursive-manager analyze "Should we use microservices or monolith?"

# Output as markdown
recursive-manager analyze "Best database for real-time analytics?" --format markdown

# Output as JSON
recursive-manager analyze "Security implications of public API?" --format json
```

This command runs 8 specialized AI agents in parallel to analyze decisions from multiple perspectives: Security, Architecture, Simplicity, Financial, Marketing, UX, Growth, and Emotional. Each agent provides recommendations with confidence scores.

### hire

Hire a new agent and add to organizational hierarchy.

```bash
recursive-manager hire <agent-id> [options]
```

**Arguments:**
- `<agent-id>` - Unique identifier for the new agent

**Options:**
- `-d, --data-dir <dir>` - Custom data directory
- `-m, --manager-id <id>` - Manager agent ID (defaults to CEO)
- `-r, --role <role>` - Agent role (e.g., CTO, Engineer)
- `-g, --goal <goal>` - Agent main goal
- `-n, --display-name <name>` - Agent display name
- `--can-hire` - Agent can hire subordinates
- `--max-subordinates <n>` - Maximum subordinates
- `--hiring-budget <n>` - Hiring budget for subordinates
- `--can-fire` - Agent can fire subordinates
- `--can-escalate` - Agent can escalate to manager
- `-f, --framework <framework>` - Execution framework (claude-code, opencode)
- `--json` - Output result as JSON

**Examples:**

```bash
# Hire a CTO agent
recursive-manager hire cto-001 --role "Chief Technology Officer" --goal "Lead technical strategy" --can-hire --max-subordinates 5

# Hire a backend engineer under the CTO
recursive-manager hire backend-001 --manager-id cto-001 --role "Backend Engineer" --goal "Build REST API"

# Hire with full configuration
recursive-manager hire frontend-001 -m cto-001 -r "Frontend Engineer" -g "Build React UI" --can-escalate --framework claude-code
```

### fire

Fire an agent and handle their subordinates.

```bash
recursive-manager fire <agent-id> [options]
```

**Arguments:**
- `<agent-id>` - ID of the agent to fire

**Options:**
- `-d, --data-dir <dir>` - Custom data directory
- `-s, --strategy <strategy>` - Subordinate handling strategy: `reassign`, `promote`, `cascade` (default: interactive prompt)
- `--json` - Output result as JSON
- `-y, --yes` - Skip confirmation prompt

**Strategies:**
- `reassign` - Reassign subordinates to the fired agent's manager
- `promote` - Promote one subordinate to replace the fired agent
- `cascade` - Fire all subordinates recursively

**Examples:**

```bash
# Fire an agent (interactive mode)
recursive-manager fire backend-001

# Fire and reassign subordinates
recursive-manager fire manager-001 --strategy reassign

# Fire without confirmation
recursive-manager fire temp-worker-001 -y

# Cascade fire (fire agent and all subordinates)
recursive-manager fire failed-team-lead-001 --strategy cascade --yes
```

### message

Send a message to an agent for reactive execution.

```bash
recursive-manager message <agent-id> [options]
```

**Arguments:**
- `<agent-id>` - ID of the agent to send message to

**Options:**
- `-d, --data-dir <dir>` - Custom data directory
- `-f, --from <agent-id>` - Sender agent ID (defaults to "system")
- `-s, --subject <subject>` - Message subject
- `-c, --content <content>` - Message content (or use editor if not provided)
- `-p, --priority <level>` - Priority level: `low`, `normal`, `high`, `urgent` (default: normal)
- `--channel <channel>` - Communication channel: `internal`, `slack`, `telegram`, `email` (default: internal)
- `-a, --action-required` - Mark message as requiring action
- `--json` - Output result as JSON

**Examples:**

```bash
# Send a message (opens editor for content)
recursive-manager message cto-001 --subject "API performance issue"

# Send with inline content
recursive-manager message backend-001 -s "Deploy to staging" -c "Please deploy branch feature/auth to staging environment"

# Send urgent message
recursive-manager message ops-001 -s "Production alert" -p urgent -a

# Send from another agent
recursive-manager message frontend-001 -f cto-001 -s "Code review needed" --channel slack
```

### run

Manually trigger agent execution.

```bash
recursive-manager run <agent-id> [options]
```

**Arguments:**
- `<agent-id>` - ID of the agent to execute

**Options:**
- `-d, --data-dir <dir>` - Custom data directory
- `-m, --mode <mode>` - Execution mode: `continuous`, `reactive` (default: continuous)
- `--json` - Output result as JSON
- `-y, --yes` - Skip confirmation prompt

**Execution Modes:**
- `continuous` - Process pending tasks from the task list
- `reactive` - Process inbox messages

**Examples:**

```bash
# Run agent in continuous mode (process tasks)
recursive-manager run backend-001

# Run in reactive mode (process messages)
recursive-manager run support-agent-001 --mode reactive

# Run without confirmation
recursive-manager run worker-001 -y

# Run and output as JSON
recursive-manager run cto-001 --json
```

### logs

View and filter agent logs.

```bash
recursive-manager logs [agent-id] [options]
```

**Arguments:**
- `[agent-id]` - ID of the agent (optional if using --all)

**Options:**
- `-n, --lines <n>` - Show last N lines (default: 50, use 0 for all)
- `-l, --level <level>` - Filter by log level: `debug`, `info`, `warn`, `error`
- `--since <time>` - Show logs since timestamp (YYYY-MM-DD HH:mm:ss)
- `--until <time>` - Show logs until timestamp (YYYY-MM-DD HH:mm:ss)
- `-f, --follow` - Follow log output (tail -f mode)
- `-g, --grep <pattern>` - Filter logs by pattern (case-insensitive regex)
- `--all` - Show logs from all agents
- `--json` - Output as JSON
- `--data-dir <dir>` - Custom data directory

**Examples:**

```bash
# View last 50 lines from agent
recursive-manager logs ceo-001

# View last 100 lines with error level filter
recursive-manager logs cto-002 -n 100 --level error

# View logs since timestamp
recursive-manager logs backend-003 --since "2026-01-20 10:00:00"

# Search logs for pattern
recursive-manager logs frontend-004 --grep "execution failed"

# View all agent logs combined
recursive-manager logs --all

# Follow logs in real-time
recursive-manager logs worker-005 -f

# Output as JSON
recursive-manager logs manager-006 --json
```

### version

Show RecursiveManager version information.

```bash
recursive-manager version
```

Shows the current version, release date, and release URL.

### help

Show help information.

```bash
recursive-manager help [command]
```

**Arguments:**
- `[command]` - Optional command name to get help for

**Examples:**

```bash
# Show general help
recursive-manager help

# Show help for specific command
recursive-manager help init
```
