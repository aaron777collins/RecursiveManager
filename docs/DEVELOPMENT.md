# RecursiveManager Development Guide

**Version**: 1.0.0
**Last Updated**: 2026-01-20

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Building the Project](#building-the-project)
- [Running Tests](#running-tests)
- [Code Style and Conventions](#code-style-and-conventions)
- [Development Workflow](#development-workflow)
- [Debugging](#debugging)
- [Working with Packages](#working-with-packages)
- [Adding New Features](#adding-new-features)
- [Database Migrations](#database-migrations)
- [Testing Strategy](#testing-strategy)
- [Performance Optimization](#performance-optimization)
- [Troubleshooting](#troubleshooting)
- [Contributing Guidelines](#contributing-guidelines)

---

## Overview

RecursiveManager is built as a **Turbo monorepo** with 5 main packages. This guide covers everything developers need to know to contribute to the project effectively.

### Key Technologies

- **Language**: TypeScript 5.9+
- **Runtime**: Node.js 18+
- **Monorepo**: Turborepo
- **Testing**: Jest
- **Database**: SQLite (better-sqlite3)
- **CLI**: Commander.js
- **Logging**: Winston
- **Metrics**: Prometheus (prom-client)

---

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Git** >= 2.30
- **Code Editor** (VS Code recommended)

### Initial Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/aaron777collins/RecursiveManager.git
   cd RecursiveManager
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```
   This installs dependencies for all packages in the monorepo.

3. **Build all packages**:
   ```bash
   npm run build
   ```

4. **Run tests**:
   ```bash
   npm test
   ```

5. **Link for local development**:
   ```bash
   npm link
   ```
   Now you can use `recursivemanager` command globally during development.

---

## Development Environment Setup

### VS Code Configuration

**Recommended Extensions**:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Jest Runner
- GitLens

**Workspace Settings** (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.turbo": true
  }
}
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Development configuration
NODE_ENV=development
LOG_LEVEL=debug

# RecursiveManager paths
RECURSIVEMANAGER_HOME=./dev-data
RECURSIVEMANAGER_DATA_DIR=./dev-data/data

# AI Provider (for multi-perspective analysis)
AI_PROVIDER=anthropic-direct
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional: Use AICEO Gateway
# AI_PROVIDER=aiceo-gateway
# AICEO_GATEWAY_URL=http://localhost:4000/api/glm/submit
# AICEO_GATEWAY_API_KEY=your-shared-secret

# Database
DB_PATH=./dev-data/recursivemanager.db
DB_ENABLE_WAL=true

# Metrics
PROMETHEUS_PORT=9090
```

---

## Project Structure

RecursiveManager follows a Turbo monorepo architecture with 5 packages:

```
RecursiveManager/
├── packages/
│   ├── core/              # Core orchestration logic
│   │   ├── src/
│   │   │   ├── agents/    # Agent lifecycle management
│   │   │   ├── ai-analysis/ # Multi-perspective AI analysis
│   │   │   ├── execution/ # Execution orchestrator
│   │   │   ├── metrics/   # Prometheus metrics
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── cli/               # Command-line interface
│   │   ├── src/
│   │   │   ├── commands/  # CLI commands (hire, fire, status, etc.)
│   │   │   ├── cli.ts     # Main CLI entry point
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── adapters/          # Framework adapters (Claude Code, etc.)
│   │   ├── src/
│   │   │   ├── base/      # Adapter interfaces
│   │   │   ├── claude-code/ # Claude Code adapter
│   │   │   ├── registry/  # Adapter registry
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── scheduler/         # Task scheduling and daemon
│   │   ├── src/
│   │   │   ├── daemon/    # Scheduler daemon
│   │   │   ├── pool/      # Execution pool
│   │   │   ├── manager/   # Schedule management
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   └── common/            # Shared utilities
│       ├── src/
│       │   ├── config/    # Configuration management
│       │   ├── database/  # Database operations
│       │   ├── logger/    # Logging utilities
│       │   ├── paths/     # Path utilities
│       │   ├── security/  # Security utilities
│       │   ├── types/     # Shared TypeScript types
│       │   └── index.ts
│       ├── __tests__/
│       └── package.json
│
├── docs/                  # Documentation
├── scripts/               # Build and utility scripts
├── .github/               # GitHub Actions workflows
├── turbo.json             # Turborepo configuration
└── package.json           # Root package.json
```

### Package Dependencies

```
common (no dependencies)
   ↑
   ├── core (depends on common)
   ├── cli (depends on common)
   ├── adapters (depends on common)
   └── scheduler (depends on common)
       ↑
       └── cli (also depends on core, adapters, scheduler)
```

**Dependency Rules**:
- `common` has NO internal dependencies (foundational package)
- `core`, `adapters`, `scheduler` depend only on `common`
- `cli` depends on all other packages (orchestration layer)

---

## Building the Project

### Full Build

Build all packages in dependency order:

```bash
npm run build
```

This uses Turborepo to build packages in parallel where possible.

### Package-Specific Build

Build a single package:

```bash
cd packages/core
npm run build
```

### Clean Build

Remove all build artifacts and rebuild:

```bash
npm run clean
npm install
npm run build
```

### Build Outputs

Each package generates:
- **`dist/`**: Compiled JavaScript (CommonJS)
- **`dist/*.d.ts`**: TypeScript declaration files
- **`dist/*.js.map`**: Source maps

### Watch Mode

For active development, use watch mode:

```bash
cd packages/core
npm run dev
```

This rebuilds automatically when source files change.

---

## Running Tests

### Full Test Suite

Run all tests across all packages:

```bash
npm test
```

### Test with Coverage

Generate coverage reports:

```bash
npm run test:coverage
```

Coverage reports are generated in `coverage/` directories for each package.

### Package-Specific Tests

Run tests for a single package:

```bash
cd packages/core
npm test
```

### Watch Mode

Run tests in watch mode (auto-rerun on file changes):

```bash
cd packages/core
npm test -- --watch
```

### Run Specific Tests

Run a single test file:

```bash
npm test -- execution-orchestrator.test.ts
```

Run tests matching a pattern:

```bash
npm test -- --testNamePattern="should hire agent"
```

### Integration Tests

Run integration tests only:

```bash
npm test -- --testPathPattern=integration
```

### CI Test Script

The CI environment uses a special script:

```bash
npm run test:ci
```

This runs tests with CI-specific configuration (no interactive mode, fail fast).

---

## Code Style and Conventions

### TypeScript Style Guide

**General Rules**:
- Use **strict mode** (`strict: true` in tsconfig.json)
- Prefer `const` over `let`, never use `var`
- Use **interfaces** for object shapes, **types** for unions/intersections
- Export interfaces and types from their respective modules
- Use **async/await** instead of raw Promises

**Naming Conventions**:
- **Classes**: PascalCase (`ExecutionOrchestrator`)
- **Interfaces**: PascalCase with descriptive names (`AgentConfig`, `ExecutionContext`)
- **Types**: PascalCase (`AgentStatus`, `ExecutionMode`)
- **Functions**: camelCase (`hireAgent`, `loadAgentConfig`)
- **Variables**: camelCase (`agentId`, `executionResult`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_AGENT_DEPTH`, `DEFAULT_TIMEOUT`)
- **Private members**: prefix with `_` (`_database`, `_logger`)

**Example**:
```typescript
// Good
export interface AgentConfig {
  id: string;
  role: string;
  managerId: string | null;
}

export type AgentStatus = 'active' | 'paused' | 'terminated';

export class ExecutionOrchestrator {
  private _logger: Logger;
  private _database: Database;

  constructor(logger: Logger) {
    this._logger = logger;
    this._database = getDatabase();
  }

  async executeAgent(agentId: string): Promise<ExecutionResult> {
    // Implementation
  }
}
```

### File Organization

**File Naming**:
- Source files: `kebab-case.ts` (`execution-orchestrator.ts`)
- Test files: `kebab-case.test.ts` (`execution-orchestrator.test.ts`)
- Type definitions: `kebab-case.types.ts` (`agent-config.types.ts`)

**Module Structure**:
```typescript
// 1. Imports (grouped by external, internal)
import { Database } from 'better-sqlite3';
import { Logger } from 'winston';

import { AgentConfig } from '@recursivemanager/common';
import { loadAgentConfig } from './config';

// 2. Type definitions
export interface ExecutionContext {
  agentId: string;
  mode: ExecutionMode;
}

// 3. Constants
const MAX_RETRIES = 3;
const TIMEOUT_MS = 60000;

// 4. Main implementation
export class ExecutionOrchestrator {
  // Implementation
}

// 5. Helper functions (not exported)
function validateContext(ctx: ExecutionContext): void {
  // Validation logic
}
```

### Linting and Formatting

**Lint Code**:
```bash
npm run lint
```

**Auto-Fix Lint Issues**:
```bash
npm run lint -- --fix
```

**Format Code**:
```bash
npm run format
```

**Check Formatting**:
```bash
npm run format:check
```

### Pre-Commit Hooks

The project uses **Husky** and **lint-staged** to enforce code quality:

- **On commit**: Prettier formats staged files
- **On commit**: ESLint checks TypeScript files
- **On push**: Full test suite runs (optional)

Configure in `.husky/` directory.

---

## Development Workflow

### Branching Strategy

**Branch Types**:
- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/<name>` - New features
- `fix/<name>` - Bug fixes
- `docs/<name>` - Documentation updates
- `refactor/<name>` - Code refactoring

**Workflow**:
1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/multi-agent-execution
   ```

2. Make changes and commit frequently:
   ```bash
   git add .
   git commit -m "feat: Add multi-agent execution support"
   ```

3. Push to remote:
   ```bash
   git push origin feature/multi-agent-execution
   ```

4. Create a Pull Request on GitHub

5. After review and approval, merge to `main`

### Commit Message Format

Follow **Conventional Commits** specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring (no functional changes)
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, tooling

**Examples**:
```bash
git commit -m "feat(core): Add priority queue to execution pool"
git commit -m "fix(cli): Handle missing agent ID in status command"
git commit -m "docs(api): Update ExecutionOrchestrator API reference"
git commit -m "test(adapters): Add integration tests for Claude Code adapter"
```

### Pull Request Process

1. **Ensure all tests pass**: `npm test`
2. **Ensure build succeeds**: `npm run build`
3. **Ensure linting passes**: `npm run lint`
4. **Update documentation** if applicable
5. **Add tests** for new features
6. **Write a clear PR description** explaining:
   - What changed
   - Why the change was needed
   - How to test the change

---

## Debugging

### VS Code Debugger

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/packages/cli/src/cli.ts",
      "args": ["status"],
      "runtimeArgs": ["-r", "ts-node/register"],
      "sourceMaps": true,
      "cwd": "${workspaceFolder}",
      "protocol": "inspector",
      "outputCapture": "std"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "--no-cache", "${fileBasename}"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Logging

Enable debug logging:

```bash
export LOG_LEVEL=debug
recursivemanager status
```

Log to file:

```bash
export LOG_FILE=./debug.log
recursivemanager hire cto "Lead technical development"
```

### Database Inspection

Inspect SQLite database:

```bash
# Open database
sqlite3 ~/.recursivemanager/data/recursivemanager.db

# List tables
.tables

# Query agents
SELECT * FROM agents;

# Query execution history
SELECT * FROM execution_history ORDER BY timestamp DESC LIMIT 10;

# Exit
.quit
```

### Metrics Dashboard

Start Prometheus metrics server:

```bash
export PROMETHEUS_PORT=9090
recursivemanager daemon start
```

Access metrics at: `http://localhost:9090/metrics`

---

## Working with Packages

### Adding a New Package

1. Create package directory:
   ```bash
   mkdir -p packages/new-package/src
   cd packages/new-package
   ```

2. Initialize package.json:
   ```json
   {
     "name": "@recursivemanager/new-package",
     "version": "1.0.0",
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "dev": "tsc --watch",
       "test": "jest",
       "lint": "eslint src/",
       "type-check": "tsc --noEmit"
     }
   }
   ```

3. Create tsconfig.json:
   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": {
       "outDir": "dist",
       "rootDir": "src"
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "dist", "__tests__"]
   }
   ```

4. Add to root workspaces in `package.json`:
   ```json
   "workspaces": [
     "packages/*"
   ]
   ```

5. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

### Adding Dependencies

**Add to a specific package**:
```bash
cd packages/core
npm install lodash
npm install --save-dev @types/lodash
```

**Add to all packages**:
```bash
npm install lodash --workspaces
```

**Add to root (devDependencies)**:
```bash
npm install --save-dev prettier
```

### Inter-Package Dependencies

Reference other packages in package.json:

```json
{
  "dependencies": {
    "@recursivemanager/common": "workspace:*",
    "@recursivemanager/core": "workspace:*"
  }
}
```

---

## Adding New Features

### Feature Development Checklist

- [ ] Create feature branch (`feature/<name>`)
- [ ] Write tests FIRST (TDD approach)
- [ ] Implement feature with proper error handling
- [ ] Add TypeScript types/interfaces
- [ ] Update API documentation (`docs/API.md`)
- [ ] Add usage examples to CLI docs (`docs/CLI.md`)
- [ ] Run full test suite (`npm test`)
- [ ] Run linting (`npm run lint`)
- [ ] Build successfully (`npm run build`)
- [ ] Update CHANGELOG.md
- [ ] Create Pull Request

### Example: Adding a New CLI Command

1. **Create command file** (`packages/cli/src/commands/new-command.ts`):
   ```typescript
   import { Command } from 'commander';
   import { getDatabase } from '@recursivemanager/common';

   export function createNewCommand(): Command {
     return new Command('new-command')
       .description('Description of new command')
       .argument('<arg>', 'Argument description')
       .option('-f, --flag', 'Optional flag')
       .action(async (arg: string, options: any) => {
         try {
           // Command implementation
           console.log(`Executing with arg: ${arg}`);
         } catch (error) {
           console.error('Error:', error.message);
           process.exit(1);
         }
       });
   }
   ```

2. **Register command** (`packages/cli/src/cli.ts`):
   ```typescript
   import { createNewCommand } from './commands/new-command';

   program.addCommand(createNewCommand());
   ```

3. **Add tests** (`packages/cli/__tests__/commands/new-command.test.ts`):
   ```typescript
   import { execSync } from 'child_process';

   describe('new-command', () => {
     it('should execute successfully', () => {
       const result = execSync('recursivemanager new-command test-arg');
       expect(result.toString()).toContain('Executing with arg: test-arg');
     });
   });
   ```

4. **Update documentation** (`docs/CLI.md`):
   ```markdown
   ### `recursivemanager new-command`

   Description of the command.

   **Usage:**
   \`\`\`bash
   recursivemanager new-command <arg> [options]
   \`\`\`

   **Examples:**
   \`\`\`bash
   recursivemanager new-command test-arg
   recursivemanager new-command test-arg --flag
   \`\`\`
   ```

---

## Database Migrations

### Creating a Migration

1. **Create migration file** (`packages/common/src/database/migrations/003_add_new_column.ts`):
   ```typescript
   import { Database } from 'better-sqlite3';

   export function up(db: Database): void {
     db.exec(`
       ALTER TABLE agents ADD COLUMN new_column TEXT DEFAULT NULL;
     `);
   }

   export function down(db: Database): void {
     db.exec(`
       ALTER TABLE agents DROP COLUMN new_column;
     `);
   }
   ```

2. **Register migration** (`packages/common/src/database/migrations/index.ts`):
   ```typescript
   import * as migration003 from './003_add_new_column';

   export const migrations = [
     // ... existing migrations
     { version: 3, ...migration003 },
   ];
   ```

3. **Test migration**:
   ```bash
   npm test -- database/migrations
   ```

4. **Run migration** (automatic on startup):
   ```bash
   recursivemanager status  # Triggers migration check
   ```

### Migration Best Practices

- **Always test migrations** with real data
- **Provide rollback** (`down` function)
- **Make migrations idempotent** (safe to run multiple times)
- **Backup database** before running migrations
- **Increment version** sequentially (no gaps)

---

## Testing Strategy

### Test Types

1. **Unit Tests**: Test individual functions/classes in isolation
2. **Integration Tests**: Test interactions between modules
3. **End-to-End Tests**: Test full workflows via CLI

### Test Structure

```typescript
import { hireAgent } from '../agents';
import { getDatabase } from '@recursivemanager/common';

describe('hireAgent', () => {
  let db: Database;

  beforeEach(() => {
    // Setup test database
    db = getDatabase(':memory:');
    initializeDatabase(db);
  });

  afterEach(() => {
    // Cleanup
    db.close();
  });

  describe('successful hiring', () => {
    it('should create agent record', async () => {
      const result = await hireAgent('ceo', 'cto', 'Lead technical development');

      expect(result.success).toBe(true);
      expect(result.agentId).toBeDefined();

      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(result.agentId);
      expect(agent).toBeDefined();
      expect(agent.role).toBe('cto');
    });

    it('should create subordinate relationship', async () => {
      const result = await hireAgent('ceo', 'cto', 'Lead technical development');

      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(result.agentId);
      expect(agent.manager_id).toBe('ceo');
    });
  });

  describe('error handling', () => {
    it('should reject invalid manager ID', async () => {
      await expect(
        hireAgent('invalid-manager', 'cto', 'Lead technical development')
      ).rejects.toThrow('Manager not found');
    });
  });
});
```

### Mocking

**Mock database**:
```typescript
jest.mock('@recursivemanager/common', () => ({
  getDatabase: jest.fn(() => mockDatabase),
}));
```

**Mock AI provider**:
```typescript
jest.mock('../ai-analysis/providers/factory', () => ({
  getProvider: jest.fn(() => mockProvider),
}));
```

### Test Coverage Goals

- **Overall**: >= 80%
- **Critical paths** (agents, execution): >= 90%
- **CLI commands**: >= 70%
- **Utilities**: >= 85%

Check coverage:
```bash
npm run test:coverage
open coverage/lcov-report/index.html
```

---

## Performance Optimization

### Profiling

**Profile execution**:
```bash
node --prof packages/cli/dist/cli.js status
node --prof-process isolate-*.log > profile.txt
```

**Memory profiling**:
```bash
node --inspect packages/cli/dist/cli.js status
# Open chrome://inspect in Chrome
```

### Database Optimization

**Enable WAL mode** (better concurrency):
```typescript
db.pragma('journal_mode = WAL');
```

**Use prepared statements**:
```typescript
// Good
const stmt = db.prepare('SELECT * FROM agents WHERE id = ?');
const agent = stmt.get(agentId);

// Bad (SQL injection risk, slower)
const agent = db.prepare(`SELECT * FROM agents WHERE id = '${agentId}'`).get();
```

**Add indexes**:
```sql
CREATE INDEX idx_agents_manager_id ON agents(manager_id);
CREATE INDEX idx_execution_history_agent_id ON execution_history(agent_id);
```

### Caching

**Use in-memory cache for frequently accessed data**:
```typescript
import { LRUCache } from 'lru-cache';

const configCache = new LRUCache<string, AgentConfig>({
  max: 100,
  ttl: 1000 * 60 * 5, // 5 minutes
});

export function loadAgentConfig(agentId: string): AgentConfig {
  const cached = configCache.get(agentId);
  if (cached) return cached;

  const config = loadFromDisk(agentId);
  configCache.set(agentId, config);
  return config;
}
```

---

## Troubleshooting

### Common Issues

#### Build Fails with TypeScript Errors

**Solution**:
```bash
# Clean build artifacts
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

#### Tests Fail with "Cannot find module"

**Solution**:
- Ensure all packages are built: `npm run build`
- Check package.json dependencies are correct
- Verify TypeScript paths in tsconfig.json

#### Database Locked

**Solution**:
```bash
# Kill any running processes
pkill -f recursivemanager

# Remove PID lock files
rm -rf ~/.recursivemanager/pids/*

# Restart
recursivemanager status
```

#### "Command not found: recursivemanager"

**Solution**:
```bash
# Relink package
npm unlink
npm link

# Or add to PATH manually
export PATH="$PWD/packages/cli/dist:$PATH"
```

---

## Contributing Guidelines

### Code Review Checklist

- [ ] Code follows TypeScript style guide
- [ ] All tests pass
- [ ] Test coverage >= 80%
- [ ] No ESLint errors
- [ ] Documentation updated
- [ ] Commit messages follow Conventional Commits
- [ ] No breaking changes (or clearly documented)
- [ ] Performance impact considered

### Reporting Bugs

**Include**:
- RecursiveManager version (`recursivemanager --version`)
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Error messages/stack traces

**Example**:
```
**Bug**: Agent hiring fails with "Database locked" error

**Version**: RecursiveManager 1.0.0, Node.js 18.20.0, Ubuntu 22.04

**Steps**:
1. Run `recursivemanager hire cto "Lead development"`
2. Immediately run `recursivemanager status`

**Expected**: Both commands succeed

**Actual**: Second command fails with "Database locked"

**Error**:
```
Error: Database locked
  at hireAgent (/packages/core/src/agents/hire.ts:45)
```
```

### Proposing Features

**Include**:
- Use case (why is this needed?)
- Proposed API/interface
- Implementation considerations
- Backward compatibility impact

---

## Related Documentation

- **[Installation Guide](./INSTALLATION.md)** - Installation instructions
- **[Configuration Guide](./CONFIGURATION.md)** - Configuration options
- **[CLI Reference](./CLI.md)** - Command-line interface
- **[API Reference](./API.md)** - API documentation
- **[Testing Guide](./TESTING.md)** - Testing strategies
- **[Architecture](./ARCHITECTURE.md)** - System design

---

**Happy Coding!** 🚀

For questions or support, open an issue on [GitHub](https://github.com/aaron777collins/RecursiveManager/issues).
