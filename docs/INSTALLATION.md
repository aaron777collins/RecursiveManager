# Installation Guide

Complete installation guide for RecursiveManager v1.0.0 - a production-ready hierarchical AI agent orchestration system.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
  - [Quick Install (Recommended)](#quick-install-recommended)
  - [Binary Installation](#binary-installation)
  - [From Source](#from-source)
  - [Docker Installation](#docker-installation)
  - [CI/CD Installation](#cicd-installation)
- [Initial Configuration](#initial-configuration)
- [AI Provider Setup](#ai-provider-setup)
- [Database Configuration](#database-configuration)
- [Post-Installation](#post-installation)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

---

## Prerequisites

### System Requirements

- **Operating System**: Linux, macOS, or Windows (WSL2 recommended for Windows)
- **Node.js**: 18.0.0 or higher (LTS recommended)
- **Package Manager**: npm 8.0.0+, yarn 1.22.0+, or pnpm 7.0.0+
- **Disk Space**: 500 MB minimum (1 GB recommended)
- **RAM**: 2 GB minimum (4 GB recommended for production)
- **CPU**: 2 cores minimum (4 cores recommended for production)

### Required System Tools

- **curl** or **wget** - For downloading installation scripts
- **tar** - For extracting binary archives
- **git** - For source installation and version control
- **sha256sum** or **shasum** - For binary verification (recommended)

### Check Prerequisites

```bash
# Check Node.js version (must be 18+)
node --version

# Check npm version
npm --version

# Check system tools
curl --version
tar --version
git --version
```

### Installing Prerequisites

**Ubuntu/Debian:**
```bash
# Install Node.js 18+ (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install system tools
sudo apt-get install -y curl tar git
```

**macOS:**
```bash
# Install Node.js using Homebrew
brew install node@18

# System tools are pre-installed on macOS
```

**Windows (WSL2):**
```bash
# Install Node.js using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install system tools
sudo apt-get update
sudo apt-get install -y curl tar git
```

---

## Installation Methods

### Quick Install (Recommended)

The fastest way to install RecursiveManager with pre-built binaries:

```bash
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install-binary.sh | bash
```

This script will:
1. ✅ Detect your platform (Linux, macOS, Windows)
2. ✅ Download the appropriate pre-built binary
3. ✅ Verify checksums for security
4. ✅ Install to `~/.recursivemanager`
5. ✅ Add to your PATH automatically
6. ✅ Run post-install verification

**Interactive Mode:**
- Prompts for installation directory
- Asks for shell configuration
- Displays progress in color

**Verify Installation:**
```bash
recursivemanager --version
# Output: RecursiveManager v1.0.0
```

---

### Binary Installation

Download and install pre-built binaries manually.

#### Step 1: Download Binary

Visit the [Releases Page](https://github.com/aaron777collins/RecursiveManager/releases) and download the appropriate binary for your platform:

- **Linux (x64)**: `recursivemanager-v1.0.0-linux-x64.tar.gz`
- **macOS (ARM64)**: `recursivemanager-v1.0.0-macos-arm64.tar.gz`
- **macOS (x64)**: `recursivemanager-v1.0.0-macos-x64.tar.gz`
- **Windows (x64)**: `recursivemanager-v1.0.0-win-x64.zip`

#### Step 2: Verify Checksum (Recommended)

```bash
# Download checksum file
curl -LO https://github.com/aaron777collins/RecursiveManager/releases/download/v1.0.0/checksums.txt

# Verify the binary (Linux/macOS)
sha256sum -c checksums.txt --ignore-missing

# Verify the binary (macOS alternative)
shasum -a 256 -c checksums.txt
```

#### Step 3: Extract and Install

**Linux/macOS:**
```bash
# Create installation directory
mkdir -p ~/.recursivemanager

# Extract binary
tar xzf recursivemanager-v1.0.0-*.tar.gz -C ~/.recursivemanager

# Make executable
chmod +x ~/.recursivemanager/bin/recursivemanager

# Add to PATH
echo 'export PATH="$HOME/.recursivemanager/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Or for zsh
echo 'export PATH="$HOME/.recursivemanager/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Windows (WSL2):**
```bash
# Use same commands as Linux
mkdir -p ~/.recursivemanager
tar xzf recursivemanager-v1.0.0-win-x64.zip -C ~/.recursivemanager
chmod +x ~/.recursivemanager/bin/recursivemanager.exe
echo 'export PATH="$HOME/.recursivemanager/bin:$PATH"' >> ~/.bashrc
```

#### Step 4: Verify Installation

```bash
recursivemanager --version
recursivemanager --help
```

---

### From Source

Build and install RecursiveManager from source code.

#### Step 1: Clone Repository

```bash
git clone https://github.com/aaron777collins/RecursiveManager.git
cd RecursiveManager
```

#### Step 2: Install Dependencies

```bash
# Using npm
npm install

# Using yarn
yarn install

# Using pnpm
pnpm install
```

#### Step 3: Build All Packages

RecursiveManager is a monorepo with multiple packages. Build all packages using Turbo:

```bash
npm run build

# Or for verbose output
npm run build -- --verbose
```

This builds:
- `@recursivemanager/common` - Shared utilities and types
- `@recursivemanager/core` - Core orchestration engine
- `@recursivemanager/cli` - Command-line interface
- `@recursivemanager/adapters` - Framework adapters (Claude Code, etc.)
- `@recursivemanager/scheduler` - Task scheduling system

#### Step 4: Link Globally (Optional)

```bash
# Link the CLI globally
npm link

# Or create symlink manually
ln -s $(pwd)/packages/cli/dist/cli.js /usr/local/bin/recursivemanager
chmod +x /usr/local/bin/recursivemanager
```

#### Step 5: Verify Installation

```bash
recursivemanager --version
npm test  # Run all tests to verify build
```

---

### Docker Installation

Run RecursiveManager in an isolated Docker container.

#### Quick Start with Docker Compose

```bash
# Clone repository
git clone https://github.com/aaron777collins/RecursiveManager.git
cd RecursiveManager

# Copy environment template
cp .env.example .env.docker

# Edit .env.docker with your configuration
nano .env.docker

# Start all services
docker-compose up -d

# Verify containers are running
docker-compose ps

# View logs
docker-compose logs -f recursivemanager
```

#### Manual Docker Build

```bash
# Build the Docker image
docker build -t recursivemanager:1.0.0 .

# Run the container
docker run -d \
  --name recursivemanager \
  -v ~/.recursivemanager:/app/data \
  -e AI_PROVIDER=aiceo-gateway \
  -e AICEO_GATEWAY_URL=http://gateway:4000/api/glm/submit \
  -p 3000:3000 \
  recursivemanager:1.0.0

# Execute commands inside the container
docker exec -it recursivemanager recursivemanager status

# View logs
docker logs -f recursivemanager
```

#### Docker Compose Stack

The full Docker Compose stack includes:
- **RecursiveManager**: Main orchestration service
- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Monitoring dashboards (port 3001)
- **SQLite**: Persistent database (volume mounted)

**Access Services:**
- RecursiveManager Metrics: http://localhost:3000/metrics
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin)

**See [DOCKER.md](./DOCKER.md) for complete Docker documentation.**

---

### CI/CD Installation

Headless installation for automated deployments.

#### Basic Headless Install

```bash
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install-binary.sh | \
  VERSION=1.0.0 INSTALL_DIR=/opt/recursivemanager bash
```

#### Advanced Headless Options

```bash
# Install specific version to custom directory
VERSION=1.0.0 \
INSTALL_DIR=/opt/recursivemanager \
SKIP_SHELL_CONFIG=true \
  curl -fsSL https://install.recursivemanager.com | bash

# GitHub Actions example
- name: Install RecursiveManager
  run: |
    curl -fsSL https://install.recursivemanager.com | bash
    echo "$HOME/.recursivemanager/bin" >> $GITHUB_PATH

# Jenkins pipeline example
pipeline {
  agent any
  stages {
    stage('Install') {
      steps {
        sh '''
          VERSION=1.0.0 INSTALL_DIR=/opt/rm \
          curl -fsSL https://install.recursivemanager.com | bash
        '''
      }
    }
  }
}
```

#### Environment Variables

Customize installation with these variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `VERSION` | Version to install | `latest` |
| `INSTALL_DIR` | Installation directory | `~/.recursivemanager` |
| `SKIP_SHELL_CONFIG` | Don't modify shell configs | `false` |
| `SKIP_VERIFICATION` | Skip post-install checks | `false` |
| `PACKAGE_MANAGER` | Force npm/yarn/pnpm | auto-detect |

---

## Initial Configuration

### Initialize RecursiveManager

After installation, initialize the system:

```bash
# Interactive initialization
recursivemanager init

# Headless initialization
recursivemanager init --headless --data-dir ~/.recursivemanager/data
```

This creates:
- **Data directory**: `~/.recursivemanager/data/`
- **Database**: `recursivemanager.db` (SQLite)
- **Logs directory**: `~/.recursivemanager/logs/`
- **Agent workspaces**: `~/.recursivemanager/data/agents/`
- **Configuration**: `~/.recursivemanager/config.json`

### Configuration File

RecursiveManager stores configuration in `~/.recursivemanager/config.json`:

```json
{
  "version": "1.0.0",
  "dataDirectory": "~/.recursivemanager/data",
  "logDirectory": "~/.recursivemanager/logs",
  "logLevel": "info",
  "database": {
    "type": "sqlite",
    "path": "~/.recursivemanager/data/recursivemanager.db",
    "encryption": {
      "enabled": true,
      "useKDF": true
    }
  },
  "execution": {
    "workerPoolSize": 5,
    "maxAgentDepth": 5,
    "maxAgentsPerManager": 10,
    "agentTimeoutMs": 300000
  },
  "scheduler": {
    "enabled": true,
    "pollIntervalMs": 60000,
    "maxConcurrentTasks": 10
  }
}
```

### View and Modify Configuration

```bash
# View all configuration
recursivemanager config list

# Get specific value
recursivemanager config get database.path

# Set value
recursivemanager config set execution.workerPoolSize 10

# Reset to defaults
recursivemanager config reset
```

---

## AI Provider Setup

RecursiveManager requires an AI provider for agent execution and multi-perspective analysis.

### Supported Providers

1. **AICEO Gateway** (Recommended) - Centralized rate-limited access
2. **Direct Anthropic** - Direct Claude API calls
3. **Direct OpenAI** - Direct GPT API calls
4. **GLM Direct** - Direct GLM model access
5. **Custom Provider** - Custom LLM endpoints

### Quick Setup: AICEO Gateway

**Step 1: Create `.env` file**

```bash
cd ~/.recursivemanager
cp .env.example .env
```

**Step 2: Configure AI Provider**

Edit `.env`:

```bash
# Primary AI Provider
AI_PROVIDER=aiceo-gateway
AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
AICEO_GATEWAY_API_KEY=your-shared-secret
AICEO_GATEWAY_PROVIDER=glm
AICEO_GATEWAY_MODEL=glm-4.7
AICEO_GATEWAY_PRIORITY=high

# Fallback Provider (if AICEO Gateway is down)
AI_FALLBACK_PROVIDER=glm-direct
GLM_API_KEY=your-glm-api-key
GLM_MODEL=glm-4.7
```

**Step 3: Verify Provider**

```bash
# Test AI provider connection
recursivemanager debug providers

# Should show:
# ✓ Primary Provider: aiceo-gateway (healthy)
# ✓ Fallback Provider: glm-direct (healthy)
```

### Alternative: Direct Anthropic

```bash
# .env configuration
AI_PROVIDER=anthropic-direct
ANTHROPIC_API_KEY=sk-ant-api03-...
ANTHROPIC_MODEL=claude-sonnet-4-5
```

### Alternative: Direct OpenAI

```bash
# .env configuration
AI_PROVIDER=openai-direct
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo
```

### Multi-Perspective Analysis

RecursiveManager uses 8 specialized AI agents for decision analysis:
- Security Agent (OWASP, vulnerabilities)
- Architecture Agent (SOLID, scalability)
- Simplicity Agent (KISS, YAGNI)
- Financial Agent (ROI, TCO)
- Marketing Agent (positioning, GTM)
- UX Agent (WCAG, usability)
- Growth Agent (virality, PLG)
- Emotional Agent (morale, DX)

All agents route through your configured AI provider.

**See [AI_PROVIDER_GUIDE.md](./AI_PROVIDER_GUIDE.md) for complete AI provider documentation.**

---

## Database Configuration

### SQLite (Default)

RecursiveManager uses SQLite by default for simplicity and portability.

**Location:** `~/.recursivemanager/data/recursivemanager.db`

**Configuration:**
```bash
# .env
DATABASE_TYPE=sqlite
DATABASE_PATH=~/.recursivemanager/data/recursivemanager.db
```

### Database Encryption

Encrypt sensitive data fields at rest using AES-256-GCM:

```bash
# .env
DATABASE_ENCRYPTION_KEY=your-secure-password-or-32-byte-hex-key
DATABASE_ENCRYPTION_USE_KDF=true  # true = password, false = raw hex key
```

**What gets encrypted:**
- Agent configurations
- API keys in database
- Execution logs (if they contain secrets)
- Snapshot metadata

**Generate a secure key:**
```bash
# Generate 32-byte hex key
openssl rand -hex 32

# Or use a strong password (with KDF)
echo "my-super-secret-password-here"
```

### Secret Management

Centralized API key encryption with audit logging:

```bash
# .env
SECRET_ENCRYPTION_KEY=your-64-char-hex-key
SECRET_ENCRYPTION_USE_KDF=false
SECRET_CACHE_EXPIRY_MS=300000  # 5 minutes
```

**Features:**
- Encrypted storage of API keys
- Audit logging of secret access
- Automatic cache expiry
- Secret rotation support
- Backup and restore

**See [SECURITY.md](./SECURITY.md) for security best practices.**

---

## Post-Installation

### Verify Installation

Run the health check:

```bash
recursivemanager debug health

# Expected output:
# ✓ RecursiveManager v1.0.0
# ✓ Node.js v18.x.x
# ✓ Database: Connected (SQLite)
# ✓ AI Provider: aiceo-gateway (healthy)
# ✓ Encryption: Enabled (AES-256-GCM)
# ✓ Disk Space: 50 GB available
# ✓ Memory: 8 GB available
# ✓ Configuration: Valid
```

### Run Test Suite

Verify the installation by running tests:

```bash
# Run all tests (from source install)
cd RecursiveManager
npm test

# Expected: 2337/2337 tests passing
```

### Initialize First Agent

```bash
# Initialize with a high-level goal
recursivemanager init "Build a task management SaaS"

# The CEO agent will:
# 1. Analyze the goal from 8 perspectives
# 2. Create a strategic plan
# 3. Hire team members (CTO, CMO, CFO)
# 4. Delegate tasks recursively
```

### Check System Status

```bash
recursivemanager status

# Output:
# RecursiveManager Status
# ========================
# Version: 1.0.0
# Agents: 4 active, 2 paused
# Tasks: 12 queued, 3 running
# Database: 15 MB (encrypted)
# Uptime: 2 hours 34 minutes
#
# Organization Chart:
# ┌─ CEO ─────────────────────────────┐
# │  ├─ CTO (Building the product)   │
# │  ├─ CMO (Marketing strategy)     │
# │  └─ CFO (Financial planning)     │
# └───────────────────────────────────┘
```

### Enable Monitoring (Optional)

Start the Prometheus metrics server:

```bash
# Start metrics endpoint
recursivemanager metrics --port 3000

# Access metrics
curl http://localhost:3000/metrics

# Or use Docker Compose for full monitoring stack
docker-compose up -d prometheus grafana
```

**Access Grafana dashboards:**
- URL: http://localhost:3001
- Username: `admin`
- Password: `admin` (change on first login)

**See [MONITORING.md](./MONITORING.md) for complete monitoring setup.**

---

## Troubleshooting

### Installation Issues

#### Node.js Version Too Old

```bash
# Error: Node.js 18+ required. Current: v16.x.x

# Solution: Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
```

#### Permission Denied

```bash
# Error: EACCES: permission denied

# Solution 1: Use user directory (recommended)
INSTALL_DIR=$HOME/.recursivemanager curl -fsSL https://install.recursivemanager.com | bash

# Solution 2: Fix permissions
sudo chown -R $USER:$USER ~/.recursivemanager

# Solution 3: Use sudo (not recommended)
sudo curl -fsSL https://install.recursivemanager.com | bash
```

#### Command Not Found

```bash
# Error: recursivemanager: command not found

# Solution: Add to PATH
echo 'export PATH="$HOME/.recursivemanager/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Or create symlink
sudo ln -s ~/.recursivemanager/bin/recursivemanager /usr/local/bin/
```

### Runtime Issues

#### Database Locked

```bash
# Error: database is locked

# Solution: Stop conflicting processes
recursivemanager scheduler stop
pkill -f recursivemanager

# Remove lock files
rm ~/.recursivemanager/data/recursivemanager.db-shm
rm ~/.recursivemanager/data/recursivemanager.db-wal

# Restart
recursivemanager scheduler start
```

#### AI Provider Connection Failed

```bash
# Error: Failed to connect to AI provider

# Solution 1: Check provider configuration
recursivemanager debug providers

# Solution 2: Test network connectivity
curl -I $AICEO_GATEWAY_URL

# Solution 3: Check API key
echo $AICEO_GATEWAY_API_KEY

# Solution 4: Use fallback provider
AI_FALLBACK_PROVIDER=glm-direct recursivemanager status
```

#### Out of Memory

```bash
# Error: JavaScript heap out of memory

# Solution: Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
recursivemanager status

# Or set in .env
echo "NODE_OPTIONS=--max-old-space-size=4096" >> ~/.recursivemanager/.env
```

#### Port Already in Use

```bash
# Error: Port 3000 already in use

# Solution 1: Change port
recursivemanager metrics --port 3001

# Solution 2: Kill process using port
lsof -ti:3000 | xargs kill -9
```

### Build Issues (Source Install)

#### TypeScript Compilation Errors

```bash
# Error: TS errors in packages/

# Solution: Clean and rebuild
npm run clean
npm install
npm run build
```

#### Turbo Cache Issues

```bash
# Error: Turbo cache corruption

# Solution: Clear Turbo cache
npx turbo clean
rm -rf node_modules/.cache
npm run build
```

### Docker Issues

#### Container Won't Start

```bash
# Check container logs
docker logs recursivemanager

# Restart container
docker-compose restart recursivemanager

# Rebuild image
docker-compose build --no-cache
docker-compose up -d
```

#### Volume Permission Issues

```bash
# Error: Permission denied in /app/data

# Solution: Fix volume permissions
docker-compose down
sudo chown -R 1000:1000 ~/.recursivemanager/data
docker-compose up -d
```

---

## Next Steps

After successful installation:

1. **[Quick Start Guide](./docs/QUICK_START.md)** - Create your first agent in 5 minutes
2. **[Configuration Guide](./docs/CONFIGURATION.md)** - Customize RecursiveManager settings
3. **[CLI Reference](./docs/CLI.md)** - Learn all available commands
4. **[AI Provider Guide](./docs/AI_PROVIDER_GUIDE.md)** - Configure AI providers
5. **[Architecture Overview](./docs/ARCHITECTURE.md)** - Understand system design
6. **[Monitoring Setup](./docs/MONITORING.md)** - Set up Prometheus and Grafana
7. **[Security Hardening](./docs/SECURITY.md)** - Production security best practices
8. **[Docker Deployment](./docs/DOCKER.md)** - Deploy with Docker Compose
9. **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
10. **[Contributing](./CONTRIBUTING.md)** - Help improve RecursiveManager

---

## Support

- **Documentation**: https://aaron777collins.github.io/RecursiveManager/
- **Issues**: https://github.com/aaron777collins/RecursiveManager/issues
- **Discussions**: https://github.com/aaron777collins/RecursiveManager/discussions

---

**Version**: 1.0.0 (Production)
**Last Updated**: January 2026
**Status**: Production Ready ✅
