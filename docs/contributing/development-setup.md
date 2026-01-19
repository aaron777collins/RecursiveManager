# Development Setup

This guide will help you set up your development environment to contribute to RecursiveManager.

## Prerequisites

### Required Knowledge

Before contributing, you should be familiar with:
- **TypeScript**: The entire codebase is in TypeScript
- **Node.js**: Backend runtime
- **Git**: Version control
- **Testing**: Jest testing framework
- **Monorepos**: Turborepo workspace management

### Recommended Reading

1. [COMPREHENSIVE_PLAN.md](https://github.com/aaron777collins/RecursiveManager/blob/main/COMPREHENSIVE_PLAN.md) - System architecture
2. [IMPLEMENTATION_PHASES.md](https://github.com/aaron777collins/RecursiveManager/blob/main/IMPLEMENTATION_PHASES.md) - Development roadmap
3. [EDGE_CASES_AND_CONTINGENCIES.md](https://github.com/aaron777collins/RecursiveManager/blob/main/EDGE_CASES_AND_CONTINGENCIES.md) - Edge cases to handle

## System Requirements

### Hardware
- **CPU**: 2+ cores recommended
- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk**: 2 GB free space (includes dependencies)

### Software
- **OS**: Linux, macOS, or Windows (WSL recommended for Windows)
- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher
- **Git**: 2.30.0 or higher
- **SQLite**: 3.35.0 or higher
- **Claude Code**: Latest version (for testing adapters)

## Installation

### 1. Install Node.js

**macOS (using Homebrew)**:
```bash
brew install node@18
node --version  # Should be 18+
npm --version   # Should be 8+
```

**Linux (using nvm)**:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
node --version
```

**Windows**:
Download from [nodejs.org](https://nodejs.org/) or use WSL with the Linux instructions above.

### 2. Install SQLite

**macOS**:
```bash
brew install sqlite
sqlite3 --version  # Should be 3.35+
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt-get update
sudo apt-get install sqlite3 libsqlite3-dev
sqlite3 --version
```

**Windows**:
Download from [sqlite.org](https://www.sqlite.org/download.html) or use WSL.

### 3. Install Claude Code (Optional, for testing)

Follow the installation guide at [Claude Code documentation](https://docs.anthropic.com/claude/docs/claude-code).

```bash
# Verify installation
claude-code --version
```

### 4. Clone the Repository

```bash
git clone https://github.com/aaron777collins/RecursiveManager.git
cd RecursiveManager
```

### 5. Install Dependencies

```bash
# Install all workspace dependencies
npm install

# This will install dependencies for:
# - Root workspace
# - packages/common
# - packages/core
# - packages/cli
# - packages/scheduler
# - packages/adapters
# - docs

# Expected: ~500 packages installed
```

### 6. Build All Packages

```bash
npm run build

# Expected output:
# Tasks:    5 successful, 5 total
# All packages should compile to dist/
```

## Verify Your Setup

### 1. Run Tests

```bash
npm test

# Expected: All tests passing
# Currently: 15 tests (3 per package × 5 packages)
```

### 2. Run Linter

```bash
npm run lint

# Expected: 0 errors, 0 warnings
```

### 3. Run Type Checker

```bash
npm run type-check

# Expected: No type errors
```

### 4. Check Build

```bash
npm run build

# Expected: All packages compile successfully
```

## IDE Setup

### Visual Studio Code (Recommended)

#### Required Extensions
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "orta.vscode-jest",
    "ms-vscode.vscode-typescript-next"
  ]
}
```

Install all recommended extensions:
```bash
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension orta.vscode-jest
code --install-extension ms-vscode.vscode-typescript-next
```

#### Settings
Create `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "jest.autoRun": "off"
}
```

### WebStorm / IntelliJ IDEA

1. **Enable TypeScript**:
   - Settings → Languages & Frameworks → TypeScript
   - Enable TypeScript Language Service
   - Use tsconfig.json from project

2. **Enable ESLint**:
   - Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
   - Automatic ESLint configuration
   - Run eslint --fix on save

3. **Enable Prettier**:
   - Settings → Languages & Frameworks → JavaScript → Prettier
   - Run on save for files: `{**/*,*}.{js,ts,json,md}`

4. **Enable Jest**:
   - Run → Edit Configurations → + → Jest
   - Configuration file: `jest.config.js`

## Development Workflow

### Daily Workflow

```bash
# 1. Update your branch
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/task-X.Y.Z-description

# 3. Make changes
# Edit files...

# 4. Run tests in watch mode (optional)
npm test -- --watch

# 5. Verify everything passes
npm run lint
npm run type-check
npm test
npm run build

# 6. Commit changes
git add .
git commit -m "feat(scope): description (Task X.Y.Z)"

# 7. Push and create PR
git push origin feature/task-X.Y.Z-description
```

### Package-Specific Development

```bash
# Work on a specific package
cd packages/core

# Install package-specific dependencies
npm install

# Run package-specific tests
npm test

# Build just this package
npm run build

# Run from root with workspace flag
npm test -w packages/core
npm run build -w packages/core
```

### Running in Development Mode

```bash
# Build in watch mode
npm run dev

# Run specific package in dev mode
npm run dev -w packages/cli
```

## Troubleshooting

### Problem: TypeScript errors in IDE but CLI is fine

**Solution**: Reload TypeScript server
- VS Code: `Cmd/Ctrl+Shift+P` → "TypeScript: Restart TS Server"
- WebStorm: File → Invalidate Caches / Restart

### Problem: Tests failing with module resolution errors

**Solution**: Rebuild packages
```bash
npm run build
npm test
```

### Problem: ESLint not finding tsconfig

**Solution**: Ensure you have `tsconfig.eslint.json` in package
```bash
# Check if it exists
ls packages/*/tsconfig.eslint.json
```

### Problem: Out of memory during build

**Solution**: Increase Node.js heap size
```bash
export NODE_OPTIONS=--max-old-space-size=4096
npm run build
```

### Problem: SQLite installation issues

**Solution**: Install build tools
```bash
# macOS
xcode-select --install

# Linux (Ubuntu/Debian)
sudo apt-get install build-essential python3

# Windows
# Install Visual Studio Build Tools or use WSL
```

## Next Steps

1. ✅ Your environment is ready!
2. Read [Implementation Phases](/contributing/implementation-phases) to understand the roadmap
3. Browse [open issues](https://github.com/aaron777collins/RecursiveManager/issues) for tasks
4. Check [Testing Guide](/contributing/testing) for testing best practices
5. Review [Code Style](/contributing/code-style) for conventions
6. Start contributing! 🚀

## Getting Help

If you encounter issues not covered here:
- Check [GitHub Issues](https://github.com/aaron777collins/RecursiveManager/issues)
- Ask in [GitHub Discussions](https://github.com/aaron777collins/RecursiveManager/discussions)
- Join our [Discord community](#)
