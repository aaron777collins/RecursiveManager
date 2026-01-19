# Installation

::: warning Development Status
RecursiveManager is currently in active development. This installation guide describes the intended final product. See [Contributing](/contributing/getting-started) to help build it!
:::

## Prerequisites

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **Operating System**: Linux, macOS, or Windows (with WSL recommended)
- **Disk Space**: 500 MB minimum
- **RAM**: 2 GB minimum (4 GB recommended)

### AI Framework (Choose One)

RecursiveManager requires an AI coding framework to execute agents:

- **Claude Code** (recommended) - Anthropic's AI coding assistant
- **OpenCode** (experimental) - Alternative framework
- Custom adapter (advanced users)

## Installation Methods

### Method 1: Global Installation (Recommended)

```bash
# Install RecursiveManager globally
npm install -g recursive-manager

# Verify installation
recursive-manager --version

# Initialize the system
recursive-manager init
```

### Method 2: Local Installation

```bash
# Create a project directory
mkdir my-agents
cd my-agents

# Initialize npm project
npm init -y

# Install RecursiveManager locally
npm install recursive-manager

# Use with npx
npx recursive-manager --version
npx recursive-manager init
```

### Method 3: From Source (Developers)

```bash
# Clone the repository
git clone https://github.com/aaron777collins/RecursiveManager.git
cd RecursiveManager

# Install dependencies
npm install

# Build all packages
npm run build

# Link globally
npm link

# Verify
recursive-manager --version
```

## Initial Setup

### 1. Initialize the System

```bash
recursive-manager init
```

This will:
- Create the `agents/` directory structure
- Initialize the SQLite database
- Create configuration files
- Set up logging directories

Interactive prompts will ask for:
- **Data directory**: Where to store agent files (default: `./data`)
- **Framework**: Which AI framework to use (Claude Code, OpenCode, etc.)
- **Framework path**: Path to framework CLI (auto-detected if possible)

### 2. Verify Installation

```bash
# Check system status
recursive-manager status

# Should show:
# ✓ Database initialized
# ✓ Framework detected: Claude Code v1.x.x
# ✓ Agents: 0
# ✓ Ready to use
```

### 3. Configure Framework

#### Claude Code Setup

```bash
# Ensure Claude Code is installed
claude-code --version

# RecursiveManager will auto-detect it
# Or manually configure:
recursive-manager config set framework.type claude-code
recursive-manager config set framework.path /path/to/claude-code
```

#### OpenCode Setup

```bash
# Install OpenCode
npm install -g opencode

# Configure RecursiveManager
recursive-manager config set framework.type opencode
recursive-manager config set framework.path $(which opencode)
```

## Configuration

### Configuration File Location

RecursiveManager stores configuration in:
- **Linux/macOS**: `~/.config/recursive-manager/config.json`
- **Windows**: `%APPDATA%/recursive-manager/config.json`

### Key Configuration Options

```json
{
  "dataDirectory": "./data",
  "framework": {
    "type": "claude-code",
    "path": "/usr/local/bin/claude-code",
    "timeout": 3600000
  },
  "execution": {
    "maxConcurrent": 5,
    "defaultTimeout": 3600000
  },
  "logging": {
    "level": "info",
    "directory": "./logs"
  },
  "database": {
    "path": "./data/recursive-manager.db"
  }
}
```

### Modify Configuration

```bash
# View all config
recursive-manager config list

# Get specific value
recursive-manager config get framework.type

# Set value
recursive-manager config set framework.timeout 7200000

# Reset to defaults
recursive-manager config reset
```

## Verify Setup

Run the verification script:

```bash
recursive-manager doctor
```

This will check:
- ✓ Node.js version
- ✓ Framework availability
- ✓ Database connectivity
- ✓ File permissions
- ✓ Disk space
- ✓ Configuration validity

## Troubleshooting

### Framework Not Found

```bash
# Error: Claude Code CLI not found

# Solution: Install or configure path
recursive-manager config set framework.path /path/to/claude-code
```

### Permission Errors

```bash
# Error: EACCES: permission denied

# Solution: Fix directory permissions
chmod -R 755 ./data
```

### Database Locked

```bash
# Error: database is locked

# Solution: Stop any running processes
recursive-manager scheduler stop
# Remove lock files
rm ./data/recursive-manager.db-shm ./data/recursive-manager.db-wal
```

### Port Already in Use (Scheduler)

```bash
# Error: Port 3000 already in use

# Solution: Change scheduler port
recursive-manager config set scheduler.port 3001
```

## Next Steps

- [Quick Start](/guide/quick-start) - Create your first agent
- [Core Concepts](/guide/core-concepts) - Understand how it works
- [CLI Reference](/api/cli-commands) - All available commands
- [Troubleshooting](/guide/troubleshooting) - Common issues
