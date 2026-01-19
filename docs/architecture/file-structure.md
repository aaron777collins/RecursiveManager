# File Structure

RecursiveManager uses a monorepo structure with Turborepo for efficient builds and dependency management.

## Repository Structure

```
RecursiveManager/
├── packages/
│   ├── common/              # Shared utilities and types
│   ├── core/                # Core agent logic
│   ├── adapters/            # Framework adapters
│   └── cli/                 # Command-line interface
├── scripts/                 # Installation and update scripts
├── docs/                    # Documentation
├── .github/                 # GitHub Actions workflows
├── turbo.json              # Turborepo configuration
├── package.json            # Root package configuration
└── tsconfig.json           # TypeScript configuration
```

## Package Structure

### packages/common

Shared utilities and types used across packages.

```
packages/common/
├── src/
│   ├── types/              # TypeScript type definitions
│   │   ├── agent.ts
│   │   ├── task.ts
│   │   └── config.ts
│   ├── utils/              # Utility functions
│   │   ├── logger.ts
│   │   └── file.ts
│   ├── database/           # Database interfaces
│   │   ├── connection.ts
│   │   └── schema.ts
│   ├── version.ts          # Version information
│   ├── config.ts           # Configuration loader
│   └── index.ts            # Package exports
├── package.json
└── tsconfig.json
```

### packages/core

Core agent system logic.

```
packages/core/
├── src/
│   ├── agents/             # Agent implementations
│   │   ├── BaseAgent.ts
│   │   ├── ManagerAgent.ts
│   │   └── WorkerAgent.ts
│   ├── execution/          # Execution logic
│   │   ├── ExecutionPool.ts
│   │   ├── Scheduler.ts
│   │   └── TaskQueue.ts
│   ├── locking/            # Concurrency control
│   │   └── AgentLock.ts
│   ├── perspectives/       # Multi-perspective analysis
│   │   ├── PerspectiveAnalysis.ts
│   │   └── perspectives/
│   │       ├── SecurityPerspective.ts
│   │       ├── ArchitecturePerspective.ts
│   │       └── ...
│   ├── synthesis/          # Decision synthesis
│   │   └── DecisionSynthesis.ts
│   ├── RecursiveManager.ts # Main manager class
│   └── index.ts            # Package exports
├── package.json
└── tsconfig.json
```

### packages/adapters

Framework-specific adapters.

```
packages/adapters/
├── src/
│   ├── claude-code/        # Claude Code adapter
│   │   ├── ClaudeCodeAdapter.ts
│   │   └── prompts/
│   ├── openai/             # OpenAI adapter (future)
│   │   └── OpenAIAdapter.ts
│   └── index.ts            # Package exports
├── package.json
└── tsconfig.json
```

### packages/cli

Command-line interface.

```
packages/cli/
├── src/
│   ├── commands/           # CLI commands
│   │   ├── init.ts
│   │   ├── status.ts
│   │   ├── update.ts
│   │   ├── config.ts
│   │   └── debug.ts
│   ├── utils/              # CLI utilities
│   │   ├── colors.ts
│   │   ├── spinner.ts
│   │   └── prompts.ts
│   ├── cli.ts              # CLI entry point
│   └── index.ts            # Package exports
├── package.json
└── tsconfig.json
```

## Scripts Directory

```
scripts/
├── install.sh              # Installation script
├── uninstall.sh            # Uninstall script
├── update.sh               # Self-update script
├── test-install.sh         # Installation tests
└── test-docs.sh            # Documentation tests
```

## Documentation Directory

```
docs/
├── index.md                # Landing page
├── installation.md         # Installation guide
├── quick-start.md          # Quick start guide
├── configuration.md        # Configuration reference
├── cli-reference.md        # CLI reference
├── api-reference.md        # API reference
├── concepts/               # Core concepts
│   ├── agent-hierarchy.md
│   ├── execution-modes.md
│   ├── task-management.md
│   └── multi-perspective-analysis.md
├── architecture/           # Architecture docs
│   ├── overview.md
│   ├── file-structure.md
│   └── database.md
├── development/            # Development guides
│   ├── contributing.md
│   ├── testing.md
│   └── debugging.md
├── assets/                 # Images and icons
│   └── icon-white.svg
└── stylesheets/            # Custom styles
    └── extra.css
```

## Configuration Files

### Root Configuration

- `package.json` - Root package, scripts, workspaces
- `turbo.json` - Turborepo build configuration
- `tsconfig.json` - Base TypeScript config
- `mkdocs.yml` - Documentation site config
- `.gitignore` - Git ignore rules
- `.env.example` - Example environment variables

### GitHub Actions

```
.github/
└── workflows/
    ├── docs.yml            # Documentation deployment
    ├── release.yml         # Release automation
    └── test.yml            # Test automation
```

## Data Directories

At runtime, RecursiveManager creates:

```
~/.recursive-manager/
├── data/                   # Agent data
│   ├── agents/            # Agent state files
│   └── tasks/             # Task state files
├── logs/                   # Application logs
│   └── recursive-manager.log
├── backups/                # Update backups
└── .env                    # User configuration
```

## Build Artifacts

```
packages/*/dist/            # Compiled JavaScript
packages/*/node_modules/    # Package dependencies
node_modules/               # Root dependencies
site/                       # Built documentation (MkDocs)
.turbo/                     # Turborepo cache
```

## Import Paths

RecursiveManager uses TypeScript path aliases:

```typescript
// Instead of: import { Agent } from '../../common/src/types/agent'
import { Agent } from '@recursive-manager/common';

// Instead of: import { BaseAgent } from '../agents/BaseAgent'
import { BaseAgent } from '@recursive-manager/core';
```

## Package Dependencies

```
common (no dependencies)
  ↑
  ├── core (depends on common)
  ├── adapters (depends on common)
  └── cli (depends on common, core, adapters)
```

## File Naming Conventions

- **TypeScript files**: PascalCase for classes (`BaseAgent.ts`)
- **Utility files**: camelCase for utilities (`logger.ts`)
- **Config files**: kebab-case (`tsconfig.json`)
- **Scripts**: kebab-case (`install.sh`)
- **Documentation**: kebab-case (`quick-start.md`)

## Best Practices

### Imports
- Use package aliases (`@recursive-manager/*`)
- Import from package index, not internal files
- Group imports: external, internal, relative

### Exports
- Export from package `index.ts`
- Keep internal files private
- Use named exports, not default

### File Organization
- One class per file
- Colocate related utilities
- Keep files focused and small

### Testing
- Test files next to source (`Agent.test.ts`)
- Integration tests in `__tests__/`
- E2E tests in separate directory
