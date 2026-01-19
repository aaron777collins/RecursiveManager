# Contributing

Thank you for your interest in contributing to RecursiveManager!

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm, yarn, or pnpm
- Git
- Basic knowledge of TypeScript

### Setting Up Development Environment

1. Fork the repository on GitHub

2. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/RecursiveManager.git
cd RecursiveManager
```

3. Add upstream remote:
```bash
git remote add upstream https://github.com/aaron777collins/RecursiveManager.git
```

4. Install dependencies:
```bash
npm install
```

5. Build packages:
```bash
npm run build
```

6. Run tests:
```bash
npm test
```

## Development Workflow

### Creating a Branch

Create a feature branch for your changes:

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes

### Making Changes

1. Make your changes in the appropriate package
2. Write or update tests
3. Ensure tests pass: `npm test`
4. Ensure code lints: `npm run lint`
5. Format code: `npm run format`

### Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting)
- `refactor` - Code refactoring
- `test` - Test changes
- `chore` - Build/tooling changes

**Examples:**

```bash
git commit -m "feat(core): add parallel execution mode"
git commit -m "fix(cli): resolve config loading issue"
git commit -m "docs: update installation instructions"
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests for specific package
npm test -- --filter=@recursive-manager/core

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Building

```bash
# Build all packages
npm run build

# Build specific package
npm run build -- --filter=@recursive-manager/core

# Clean build artifacts
npm run clean
```

### Linting and Formatting

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Pull Request Process

### Before Submitting

1. Ensure all tests pass
2. Update documentation if needed
3. Add tests for new features
4. Update CHANGELOG.md
5. Rebase on latest main:
```bash
git fetch upstream
git rebase upstream/main
```

### Submitting PR

1. Push your branch:
```bash
git push origin feature/your-feature-name
```

2. Create Pull Request on GitHub

3. Fill out the PR template:
   - Description of changes
   - Related issues
   - Type of change
   - Testing done
   - Checklist completion

4. Wait for review

### PR Review Process

- Maintainers will review your PR
- Address any feedback
- Push updates to your branch
- Once approved, PR will be merged

## Code Style

### TypeScript Guidelines

- Use TypeScript strict mode
- Provide type annotations for parameters
- Avoid `any` type unless necessary
- Use interfaces over type aliases
- Export types from package index

**Example:**

```typescript
// Good
interface Agent {
  id: string;
  role: string;
}

export function createAgent(config: AgentConfig): Agent {
  // ...
}

// Avoid
export function createAgent(config: any): any {
  // ...
}
```

### File Organization

- One class per file
- Group related functions in modules
- Use barrel exports (index.ts)
- Keep files under 300 lines

### Naming Conventions

- **Classes**: PascalCase (`BaseAgent`)
- **Functions**: camelCase (`createAgent`)
- **Variables**: camelCase (`agentId`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_DEPTH`)
- **Files**: PascalCase for classes, camelCase for utilities

### Comments

- Use JSDoc for public APIs
- Explain "why", not "what"
- Keep comments updated

**Example:**

```typescript
/**
 * Creates a new agent in the hierarchy.
 *
 * @param managerId - Parent manager ID
 * @param role - Agent role
 * @returns Created agent instance
 * @throws {MaxDepthError} If max depth exceeded
 */
export async function createAgent(
  managerId: string,
  role: string
): Promise<Agent> {
  // Implementation
}
```

## Testing Guidelines

### Unit Tests

- Test individual functions/methods
- Mock dependencies
- Use descriptive test names

```typescript
describe('AgentLock', () => {
  it('should acquire lock successfully', async () => {
    const lock = new AgentLock();
    await expect(lock.acquire('agent-1')).resolves.toBeUndefined();
  });

  it('should throw when lock already held', async () => {
    const lock = new AgentLock();
    await lock.acquire('agent-1');
    await expect(lock.acquire('agent-1')).rejects.toThrow();
  });
});
```

### Integration Tests

- Test component interactions
- Use real dependencies where possible
- Clean up after tests

### Test Coverage

Aim for:
- 80%+ overall coverage
- 100% for critical paths
- Focus on behavior, not lines

## Documentation

### Code Documentation

- Document all public APIs
- Include examples
- Keep docs up to date

### User Documentation

Update relevant docs in `docs/`:
- Installation guide
- API reference
- Configuration
- Examples

### CHANGELOG

Add entry to CHANGELOG.md under `[Unreleased]`:

```markdown
## [Unreleased]

### Added
- New feature description

### Changed
- Changed feature description

### Fixed
- Bug fix description
```

## Community

### Getting Help

- GitHub Issues - Bug reports and feature requests
- GitHub Discussions - Questions and ideas
- Discord - Real-time chat (coming soon)

### Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

## Release Process

(For maintainers)

1. Update version in package.json
2. Update CHANGELOG.md
3. Create release commit
4. Tag release: `git tag v0.x.0`
5. Push with tags: `git push --tags`
6. GitHub Actions will create release

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to:
- Open an issue
- Start a discussion
- Reach out to maintainers

Thank you for contributing!
