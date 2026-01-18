# Development Environment Setup Guide

**Last Updated**: 2026-01-18
**Version**: 1.0.0
**For**: RecursiveManager Implementation

---

## Overview

This guide provides step-by-step instructions for setting up a development environment for RecursiveManager. Follow these instructions before beginning implementation work on any phase.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [System Requirements](#system-requirements)
3. [Required Tools](#required-tools)
4. [Environment Setup](#environment-setup)
5. [IDE Configuration](#ide-configuration)
6. [Verification Steps](#verification-steps)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Knowledge Requirements

Before contributing to RecursiveManager, you should be familiar with:

- **TypeScript** (strict mode, advanced types)
- **Node.js** ecosystem (npm/yarn, monorepos)
- **SQLite** database basics
- **Git** version control
- **Testing frameworks** (Jest)
- **AI coding frameworks** (Claude Code or OpenCode)

### Required Reading

Before setting up your environment, read these planning documents:

1. `COMPREHENSIVE_PLAN.md` - System architecture overview
2. `FILE_STRUCTURE_SPEC.md` - File organization and schemas
3. `IMPLEMENTATION_PHASES.md` - Development roadmap

---

## System Requirements

### Operating System

RecursiveManager development is supported on:

- **Linux** (Ubuntu 20.04+ recommended)
- **macOS** (11.0+ recommended)
- **Windows** (WSL2 required for Linux compatibility)

### Hardware Requirements

**Minimum**:
- CPU: 4 cores
- RAM: 8 GB
- Disk: 20 GB free space

**Recommended** (for AI agent execution):
- CPU: 8+ cores
- RAM: 16+ GB
- Disk: 50+ GB free space (for agent workspaces)
- SSD storage (for SQLite performance)

---

## Required Tools

### 1. Node.js and npm

**Version**: Node.js 18.x or higher (LTS recommended)

**Installation**:

```bash
# Using nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Verify installation
node --version  # Should be v18.x.x or higher
npm --version   # Should be 9.x.x or higher
```

### 2. TypeScript

**Version**: 5.0 or higher

```bash
# Will be installed as project dependency
# But useful to have globally for CLI access
npm install -g typescript@latest
tsc --version  # Should be 5.x.x or higher
```

### 3. Git

**Version**: 2.30 or higher

```bash
# Verify installation
git --version

# Configure git (if not already done)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 4. Monorepo Tool (Lerna or Turborepo)

**Choice**: Will be determined during Phase 1.1.1 implementation

**Why**: Manages multiple packages (common, core, cli, scheduler, adapters)

**Note**: Do not install globally yet - will be installed as project dependency

### 5. SQLite3

**Version**: 3.35 or higher (for WAL mode support)

```bash
# Linux (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install sqlite3 libsqlite3-dev

# macOS
brew install sqlite3

# Verify installation
sqlite3 --version  # Should be 3.35 or higher
```

### 6. AI Coding Framework

**Primary**: Claude Code
**Secondary**: OpenCode (optional, for Phase 9)

**Claude Code Installation**:

Follow the official installation guide at: https://github.com/anthropics/claude-code

**Verification**:

```bash
# Verify Claude Code is accessible
claude-code --version
```

**Note**: Framework adapters will wrap these tools - direct usage is for development/testing only.

### 7. Code Editor / IDE

**Recommended**: Visual Studio Code with extensions (see IDE Configuration section)

**Alternatives**: WebStorm, IntelliJ IDEA, or any editor with TypeScript support

---

## Environment Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone <repository-url> RecursiveManager
cd RecursiveManager

# Verify you're on main branch
git branch
git status
```

### 2. Install Dependencies

**Note**: During Phase 0 (current state), there are no dependencies yet. This step becomes relevant starting from Phase 1.1.

```bash
# After Phase 1.1 completion, run:
npm install

# For monorepo (Lerna example):
npm run bootstrap

# For monorepo (Turborepo example):
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Copy template (will be created in Phase 1.1)
cp .env.example .env

# Edit with your settings
nano .env
```

**Expected variables** (examples, will be finalized in Phase 1):

```env
# Database
DATABASE_PATH=./data/recursive-manager.db

# Logging
LOG_LEVEL=info
LOG_DIR=./logs

# Agent Configuration
AGENTS_BASE_PATH=./agents
MAX_CONCURRENT_AGENTS=10

# Framework Adapters
CLAUDE_CODE_PATH=/usr/local/bin/claude-code
OPENCODE_PATH=/usr/local/bin/opencode

# Messaging (Phase 5)
SLACK_BOT_TOKEN=xoxb-your-token
TELEGRAM_BOT_TOKEN=your-token

# Security (Phase 8)
ENABLE_SANDBOXING=true
MAX_AGENT_MEMORY_MB=2048
MAX_AGENT_CPU_PERCENT=50
```

### 4. Initialize Development Database

```bash
# After Phase 1.3 completion, run:
npm run db:migrate

# Seed with test data (optional)
npm run db:seed
```

### 5. Build the Project

```bash
# Compile TypeScript to JavaScript
npm run build

# Watch mode for development
npm run build:watch
```

### 6. Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

---

## IDE Configuration

### Visual Studio Code

**Recommended Extensions**:

1. **ESLint** (dbaeumer.vscode-eslint)
2. **Prettier** (esbenp.prettier-vscode)
3. **TypeScript Hero** (rbbit.typescript-hero)
4. **Jest** (orta.vscode-jest)
5. **SQLite Viewer** (alexcvzz.vscode-sqlite)
6. **GitLens** (eamodio.gitlens)
7. **Error Lens** (usernamehw.errorlens)
8. **TODO Highlight** (wayou.vscode-todo-highlight)

**Settings** (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "jest.autoRun": "off",
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.turbo": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/coverage": true
  }
}
```

**Launch Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Run Current Test File",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["${file}", "--runInBand"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Run CLI",
      "program": "${workspaceFolder}/packages/cli/dist/index.js",
      "args": ["--help"],
      "console": "integratedTerminal"
    }
  ]
}
```

### WebStorm / IntelliJ IDEA

**Configuration**:

1. Open project
2. Trust the project when prompted
3. Wait for IDE to index files
4. Configure TypeScript: Settings → Languages & Frameworks → TypeScript → Use TypeScript from project
5. Enable ESLint: Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint → Automatic configuration
6. Enable Prettier: Settings → Languages & Frameworks → JavaScript → Prettier → Run on save

---

## Verification Steps

After completing the environment setup, verify everything works:

### 1. Verify TypeScript Compilation

```bash
# Should compile without errors
npm run build
```

**Expected Output**: No errors, compiled files in `dist/` directories

### 2. Verify Linting

```bash
# Should pass without errors
npm run lint
```

**Expected Output**: No linting errors

### 3. Verify Tests

```bash
# Should run tests (may have 0 tests initially)
npm test
```

**Expected Output**: All tests passing (or "No tests found" in early phases)

### 4. Verify Database Connection

```bash
# After Phase 1.3
npm run db:health
```

**Expected Output**: "Database connection successful"

### 5. Verify CLI Builds

```bash
# After Phase 6
npm run build
./packages/cli/dist/index.js --version
```

**Expected Output**: Version number displayed

### 6. Verify AI Framework Access

```bash
# Verify Claude Code is accessible
claude-code --version

# Verify OpenCode (optional, Phase 9)
opencode --version
```

**Expected Output**: Version information for each framework

---

## Troubleshooting

### Common Issues

#### Issue: `npm install` fails with permission errors

**Solution**:

```bash
# Fix npm permissions (Linux/macOS)
sudo chown -R $USER:$USER ~/.npm
sudo chown -R $USER:$USER node_modules
```

#### Issue: TypeScript compilation errors

**Solution**:

```bash
# Clear build cache
rm -rf dist/ */dist/ */*/dist/
npm run build

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### Issue: SQLite version too old

**Solution**:

```bash
# Linux - upgrade from source
wget https://www.sqlite.org/2023/sqlite-autoconf-3430000.tar.gz
tar xvf sqlite-autoconf-3430000.tar.gz
cd sqlite-autoconf-3430000
./configure
make
sudo make install

# macOS - use Homebrew
brew upgrade sqlite3
```

#### Issue: Jest tests not running

**Solution**:

```bash
# Clear Jest cache
npm run test -- --clearCache

# Verify Jest config
cat jest.config.js
```

#### Issue: Claude Code not found

**Solution**:

```bash
# Verify installation path
which claude-code

# Add to PATH if needed
export PATH=$PATH:/path/to/claude-code

# Add to .bashrc or .zshrc for persistence
echo 'export PATH=$PATH:/path/to/claude-code' >> ~/.bashrc
```

#### Issue: Port already in use (for scheduler daemon)

**Solution**:

```bash
# Find process using port
lsof -i :3000  # Replace 3000 with actual port

# Kill process
kill -9 <PID>
```

### Getting Help

If you encounter issues not covered here:

1. **Check documentation**: Review planning docs for architecture context
2. **Search issues**: Check GitHub issues for similar problems
3. **Ask for help**: Create a GitHub issue with:
   - Error message (full stack trace)
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)
   - Relevant logs

---

## Next Steps

After completing environment setup:

1. **Read the planning documents** (if you haven't already)
2. **Review Phase 1.1 tasks** in `COMPREHENSIVE_PLAN_PROGRESS.md`
3. **Start with Task 1.1.1**: Initialize monorepo structure
4. **Follow TDD approach**: Write tests before implementation
5. **Run CI locally** before pushing: `npm run ci` (lint + test + build)

---

## Development Workflow

### Daily Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Create feature branch
git checkout -b phase-1.2-atomic-writes

# 3. Install any new dependencies
npm install

# 4. Run tests in watch mode (separate terminal)
npm run test:watch

# 5. Make changes and ensure tests pass

# 6. Lint and format
npm run lint:fix
npm run format

# 7. Build
npm run build

# 8. Run full CI locally
npm run ci

# 9. Commit changes
git add .
git commit -m "feat(core): implement atomic file writes"

# 10. Push and create PR
git push origin phase-1.2-atomic-writes
```

### Code Review Checklist

Before submitting a PR:

- [ ] All tests passing (`npm test`)
- [ ] Linting passing (`npm run lint`)
- [ ] TypeScript compiling without errors (`npm run build`)
- [ ] New features have unit tests (80%+ coverage)
- [ ] Edge cases tested (from EDGE_CASES_AND_CONTINGENCIES.md)
- [ ] Documentation updated (JSDoc comments, README changes)
- [ ] No `console.log` statements left in code
- [ ] No `any` types without justification comment
- [ ] Commit messages follow conventional commits format

---

## Phase-Specific Setup Notes

### Phase 1: Foundation

- **Focus**: File system, database, logging
- **Additional tools**: SQLite browser for DB inspection
- **Testing priority**: Edge cases (disk full, corruption, concurrency)

### Phase 2: Core Agent System

- **Focus**: Agent lifecycle, tasks
- **Additional tools**: Graph visualization for org chart
- **Testing priority**: Recursive hierarchies, deadlocks

### Phase 3: Execution Engine

- **Focus**: Framework adapters
- **Additional tools**: Claude Code CLI, OpenCode CLI
- **Testing priority**: Timeout handling, error scenarios

### Phase 4-10: Later Phases

- See `IMPLEMENTATION_PHASES.md` for specific requirements per phase

---

## Contributing

### Code Style

- **TypeScript**: Strict mode, no implicit any
- **Naming**:
  - Classes: PascalCase (`AgentManager`)
  - Functions: camelCase (`createAgent`)
  - Constants: UPPER_SNAKE_CASE (`MAX_DEPTH`)
  - Files: kebab-case (`agent-manager.ts`)
- **Comments**: JSDoc for public APIs, inline for complex logic
- **Formatting**: Prettier (auto-format on save)
- **Linting**: ESLint rules (no warnings allowed)

### Git Conventions

- **Branch naming**: `phase-X.Y-brief-description`
- **Commit messages**: Conventional Commits format
  - `feat(scope): description` - New feature
  - `fix(scope): description` - Bug fix
  - `test(scope): description` - Tests only
  - `docs(scope): description` - Documentation
  - `refactor(scope): description` - Code refactoring
  - `chore(scope): description` - Maintenance tasks

### Testing Standards

- **Unit tests**: 80%+ coverage required
- **Integration tests**: Major workflows covered
- **Test naming**: `describe('ClassName', () => { it('should do something', () => {}) })`
- **Assertions**: Use Jest matchers (`expect(x).toBe(y)`)
- **Mocking**: Minimal mocking, prefer real implementations when fast

---

## Resources

### Documentation

- [COMPREHENSIVE_PLAN.md](./COMPREHENSIVE_PLAN.md) - System architecture
- [IMPLEMENTATION_PHASES.md](./IMPLEMENTATION_PHASES.md) - Development roadmap
- [FILE_STRUCTURE_SPEC.md](./FILE_STRUCTURE_SPEC.md) - File schemas
- [EDGE_CASES_AND_CONTINGENCIES.md](./EDGE_CASES_AND_CONTINGENCIES.md) - Edge case catalog

### External Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Claude Code Documentation](https://github.com/anthropics/claude-code)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

## Changelog

### Version 1.0.0 (2026-01-18)

- Initial development environment setup guide
- Prerequisites and system requirements defined
- Tool installation instructions added
- IDE configuration guidance provided
- Verification steps documented
- Troubleshooting section added
- Development workflow established

---

## Appendix: Quick Reference

### Essential Commands

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Format
npm run format

# Full CI check
npm run ci

# Database migration
npm run db:migrate

# Start scheduler daemon
npm run scheduler:start

# View logs
tail -f logs/system.log
```

### Directory Structure (Post Phase 1.1)

```
RecursiveManager/
├── packages/
│   ├── common/           # Shared types, utilities
│   ├── core/             # Core orchestrator
│   ├── cli/              # CLI tool
│   ├── scheduler/        # Scheduler daemon
│   └── adapters/         # Framework adapters
├── agents/               # Agent workspaces (runtime)
├── data/                 # SQLite database
├── logs/                 # Log files
├── docs/                 # Documentation site
├── .github/              # CI/CD workflows
└── scripts/              # Build/dev scripts
```

---

**Document Status**: Complete
**Maintained By**: Development Team
**Last Review**: 2026-01-18
