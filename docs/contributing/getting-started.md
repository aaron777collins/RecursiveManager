# Contributing to RecursiveManager

Thank you for your interest in contributing to RecursiveManager! This guide will help you get started.

## Current Status

🚧 **RecursiveManager is currently in Phase 1 of development.** We're building the foundation and core infrastructure.

- ✅ **Planning Complete**: 209 detailed tasks across 10 phases
- ✅ **Phase 1.1 Progress**: 7/10 tasks complete (Project Setup & Tooling)
- 🚧 **Phase 1.2**: File System Layer (upcoming)
- 🚧 **Phases 2-10**: Scheduled for future development

See [Implementation Phases](/contributing/implementation-phases) for the full roadmap.

## How to Contribute

### 1. Set Up Your Development Environment

Follow the [Development Setup](/contributing/development-setup) guide to:
- Install prerequisites (Node.js 18+, TypeScript, SQLite)
- Clone the repository
- Install dependencies
- Verify your setup

### 2. Choose a Task

We have 209 tasks organized into phases. Start with:

**Good First Issues**:
- Documentation improvements
- Unit test additions
- Bug fixes in existing code
- Edge case tests

**Phase 1 Tasks** (Current Focus):
- File system utilities
- Database layer
- Logging and audit system

**Phase 2+ Tasks** (Future):
- Agent lifecycle management
- Task management
- Execution engine

Browse open issues on GitHub: [Issues](https://github.com/yourusername/RecursiveManager/issues)

### 3. Development Workflow

```bash
# Create a feature branch
git checkout -b feature/task-1.2.3-implement-backup

# Make your changes
# Write tests alongside implementation
npm test

# Ensure code quality
npm run lint
npm run type-check
npm run build

# Commit with descriptive message
git commit -m "feat: Implement backup creation with timestamped backups (Task 1.2.2)"

# Push and create PR
git push origin feature/task-1.2.3-implement-backup
```

### 4. Pull Request Guidelines

Your PR should:
- ✅ Reference the task number (e.g., "Task 1.2.3")
- ✅ Include tests (unit + integration as appropriate)
- ✅ Pass all CI checks (lint, type-check, test, build)
- ✅ Update documentation if needed
- ✅ Have clear commit messages
- ✅ Handle relevant edge cases from EDGE_CASES_AND_CONTINGENCIES.md

**PR Template**:
```markdown
## Task
Task 1.2.3: Implement backup creation with timestamped backups

## Changes
- Added createBackup() function to file-io.ts
- Implemented timestamped backup naming (YYYY-MM-DD-HH-mm-ss)
- Added error handling for backup failures

## Testing
- Unit tests for createBackup() with various inputs
- Edge case tests for disk full scenarios
- Integration test for full backup/restore cycle

## Edge Cases Handled
- EC-5.1: Disk full during backup
- EC-5.2: Restore from corrupt file using backup

## Checklist
- [x] Tests added and passing
- [x] Linting passes
- [x] TypeScript compiles
- [x] Documentation updated
- [x] Edge cases tested
```

## Code Standards

### TypeScript

```typescript
// ✅ Good: Strict typing, no any
export function createBackup(filePath: string): Promise<string> {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path');
  }
  // ...
}

// ❌ Bad: Using any
export function createBackup(filePath: any): Promise<any> {
  // ...
}
```

### Testing

```typescript
// ✅ Good: Descriptive test names, edge cases
describe('createBackup', () => {
  it('should create timestamped backup of existing file', async () => {
    // ...
  });

  it('should throw error when file does not exist', async () => {
    // ...
  });

  it('should handle disk full scenario gracefully', async () => {
    // ...
  });
});
```

### Error Handling

```typescript
// ✅ Good: Specific error messages, context
if (diskSpace < fileSize) {
  throw new Error(
    `Insufficient disk space: need ${fileSize} bytes, have ${diskSpace} bytes`
  );
}

// ❌ Bad: Generic errors
throw new Error('Failed');
```

## Quality Gates

All contributions must meet these criteria:

### Code Quality
- ✅ **80%+ test coverage** (enforced by Jest)
- ✅ **ESLint passes** with no warnings
- ✅ **TypeScript strict mode** - no `any` without justification
- ✅ **Prettier formatting** applied

### Testing
- ✅ **Unit tests** for all new functions
- ✅ **Integration tests** for multi-component interactions
- ✅ **Edge case tests** from EDGE_CASES_AND_CONTINGENCIES.md
- ✅ **All tests passing** before merge

### Documentation
- ✅ **JSDoc comments** for public APIs
- ✅ **README updates** for new features
- ✅ **Architecture docs** for design changes
- ✅ **Examples** for user-facing features

### CI Pipeline
- ✅ **Lint job** passes
- ✅ **Test job** passes with coverage
- ✅ **Build job** compiles successfully
- ✅ **Type-check job** passes
- ✅ **Quality gate** approves

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm run test:coverage

# Run specific package tests
npm test -w packages/core

# Run specific test file
npm test -- path/to/test.test.ts
```

## Running Linters

```bash
# Lint all code
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Check TypeScript types
npm run type-check

# Check Prettier formatting
npx prettier --check "packages/*/src/**/*.ts"

# Fix Prettier formatting
npx prettier --write "packages/*/src/**/*.ts"
```

## Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
# Format: <type>(<scope>): <description>

feat(core): Add agent lifecycle management (Task 2.2.5)
fix(cli): Handle missing config file gracefully
docs(guide): Update installation instructions
test(db): Add concurrency tests for optimistic locking
refactor(common): Extract validation to separate module
chore(deps): Update TypeScript to 5.3.0
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `test`: Adding or updating tests
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `chore`: Maintenance tasks (deps, config, etc.)
- `perf`: Performance improvement
- `ci`: CI/CD changes

## Getting Help

- **Discord**: Join our [Discord community](#) for real-time help
- **GitHub Discussions**: Ask questions in [Discussions](#)
- **GitHub Issues**: Report bugs or request features in [Issues](#)
- **Documentation**: Check the [full documentation](/guide/introduction)

## Recognition

All contributors will be:
- ✅ Listed in CONTRIBUTORS.md
- ✅ Acknowledged in release notes
- ✅ Credited in documentation where applicable

## Next Steps

1. [Set up your development environment](/contributing/development-setup)
2. Review [Implementation Phases](/contributing/implementation-phases)
3. Browse [open issues](https://github.com/yourusername/RecursiveManager/issues)
4. Join the community and introduce yourself!

Thank you for contributing to RecursiveManager! 🚀
