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
