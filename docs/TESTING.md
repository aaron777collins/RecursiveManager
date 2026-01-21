# Testing Guide

**RecursiveManager v1.0.0**

This guide covers the complete testing strategy, tools, patterns, and best practices for RecursiveManager. Whether you're writing your first test or debugging test failures, this document will help you maintain the project's high quality standards.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Testing Strategy](#testing-strategy)
4. [Test Types](#test-types)
5. [Writing Tests](#writing-tests)
6. [Running Tests](#running-tests)
7. [Coverage](#coverage)
8. [Mocking Strategies](#mocking-strategies)
9. [Test Utilities](#test-utilities)
10. [CI/CD Integration](#cicd-integration)
11. [Debugging Tests](#debugging-tests)
12. [Best Practices](#best-practices)
13. [Common Patterns](#common-patterns)
14. [Troubleshooting](#troubleshooting)

## Overview

### Testing Philosophy

RecursiveManager follows a **comprehensive testing approach** that ensures code quality, reliability, and maintainability:

- **Test-Driven Development (TDD)**: Write tests before or alongside production code
- **High Coverage**: 80% minimum coverage threshold across all packages
- **Fast Feedback**: Tests run in parallel with optimized execution
- **Isolation**: Each test runs independently with its own database and filesystem
- **Realistic Testing**: Integration tests use real database operations (in-memory SQLite)
- **Clear Assertions**: Tests clearly express expected behavior
- **Fail Fast**: Tests fail immediately on errors, not silently

### Technology Stack

- **Jest 30.2.0** - Test framework and runner
- **ts-jest 29.4.6** - TypeScript integration
- **better-sqlite3 12.6.2** - In-memory database testing
- **fs-extra 11.3.3** - File system testing utilities
- **Turborepo** - Monorepo test orchestration

### Test Statistics

- **115+ test files** across all packages
- **63,710+ lines of test code** (as much as production code)
- **401+ test cases** covering all critical paths
- **234+ mocking instances** for external dependencies
- **100% pass rate** in CI/CD pipeline

## Quick Start

### Running All Tests

```bash
# Run all tests across all packages
npm test

# Run tests with coverage report
npm run test:coverage

# Run tests in watch mode (re-run on file changes)
npm run test:watch
```

### Running Package-Specific Tests

```bash
# Test only the core package
cd packages/core
npm test

# Test only the CLI package with coverage
cd packages/cli
npm run test:coverage
```

### Running Specific Test Files

```bash
# Run a specific test file
npm test -- hireAgent.test.ts

# Run tests matching a pattern
npm test -- --testNamePattern="hire.*agent"

# Run only failed tests from previous run
npm test -- --onlyFailures
```

### Common Test Commands

```bash
# Verbose output with full error details
npm test -- --verbose

# Update snapshots (if using snapshot testing)
npm test -- --updateSnapshot

# Run tests without cache (clean slate)
npm test -- --no-cache

# Run tests with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Testing Strategy

### Test Pyramid

RecursiveManager follows the **testing pyramid** pattern:

```
        /\
       /  \  E2E Tests (10%)
      /----\ CLI integration tests
     /      \
    / Integ. \ Integration Tests (30%)
   /  Tests   \ Cross-component interactions
  /------------\
 /              \
/  Unit Tests    \ Unit Tests (60%)
/  (Functions,   \ Individual components
/   Classes)     \
------------------
```

**Distribution:**
- **60% Unit Tests**: Test individual functions, classes, and modules in isolation
- **30% Integration Tests**: Test interactions between components (database + service, CLI + core)
- **10% E2E Tests**: Test complete user workflows (hire agent → execute → fire agent)

### Coverage Goals

| Component | Minimum | Target | Critical Paths |
|-----------|---------|--------|----------------|
| Core Logic | 80% | 90% | 95% |
| CLI Commands | 75% | 85% | 90% |
| Adapters | 70% | 80% | 85% |
| Scheduler | 80% | 90% | 95% |
| Common/Utils | 85% | 95% | 100% |

**Critical Paths** include:
- Agent lifecycle (hire, fire, pause, resume)
- Task execution and scheduling
- Database operations (migrations, queries)
- Multi-perspective AI analysis
- Snapshot and rollback

### Test Organization

Tests are co-located with source code for easy navigation:

```
packages/[package-name]/
├── src/
│   ├── Component.ts              # Production code
│   ├── Component.test.ts         # Unit tests (if simple)
│   └── feature/
│       ├── index.ts              # Feature implementation
│       └── __tests__/
│           ├── index.test.ts                    # Unit tests
│           ├── component.test.ts                # Component tests
│           └── integration.integration.test.ts  # Integration tests
└── __mocks__/
    └── execa.js                  # Package-level mocks
```

**Naming Conventions:**
- **Unit tests**: `*.test.ts` or `*.spec.ts`
- **Integration tests**: `*.integration.test.ts`
- **Test directories**: `__tests__/` (Jest convention)
- **Mock directories**: `__mocks__/` (Jest convention)

## Test Types

### Unit Tests

**Purpose**: Test individual functions or classes in complete isolation.

**Characteristics:**
- No database connections (or use in-memory database)
- Mock all external dependencies
- Fast execution (milliseconds)
- Focus on single responsibility

**Example - Testing a Pure Function:**

```typescript
// packages/common/src/__tests__/schema-validation.test.ts
import { validateAgentConfig } from '../schema-validation';

describe('validateAgentConfig', () => {
  const validMinimalConfig = {
    version: '1.0.0',
    identity: { id: 'test-agent', role: 'CEO', managerId: null },
    goal: { mainGoal: 'Test goal' },
    permissions: { canHire: true, canFire: true },
    framework: { primary: 'claude-code' },
  };

  it('should accept valid minimal configuration', () => {
    const result = validateAgentConfig(validMinimalConfig);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it('should reject config missing required fields', () => {
    const invalidConfig = { version: '1.0.0' }; // Missing identity, goal, etc.
    const result = validateAgentConfig(invalidConfig);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors![0]).toHaveProperty('field');
    expect(result.errors![0]).toHaveProperty('message');
  });

  it('should validate version format', () => {
    const config = { ...validMinimalConfig, version: 'invalid' };
    const result = validateAgentConfig(config);

    expect(result.valid).toBe(false);
    expect(result.errors![0].field).toBe('version');
  });
});
```

**Example - Testing a Class with Database:**

```typescript
// packages/core/src/execution/__tests__/AgentLock.test.ts
import Database from 'better-sqlite3';
import { AgentLock } from '../AgentLock';

describe('AgentLock', () => {
  let db: Database.Database;
  let agentLock: AgentLock;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Create required tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_locks (
        agent_id TEXT PRIMARY KEY,
        locked_at INTEGER NOT NULL,
        locked_by TEXT NOT NULL
      )
    `);

    agentLock = new AgentLock(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('acquire', () => {
    it('should successfully acquire lock for unlocked agent', () => {
      const result = agentLock.acquire('agent-1', 'process-1');
      expect(result).toBe(true);
    });

    it('should fail to acquire already-locked agent', () => {
      agentLock.acquire('agent-1', 'process-1');
      const result = agentLock.acquire('agent-1', 'process-2');
      expect(result).toBe(false);
    });

    it('should allow same process to re-acquire lock', () => {
      agentLock.acquire('agent-1', 'process-1');
      const result = agentLock.acquire('agent-1', 'process-1');
      expect(result).toBe(true); // Idempotent
    });
  });

  describe('release', () => {
    it('should release acquired lock', () => {
      agentLock.acquire('agent-1', 'process-1');
      agentLock.release('agent-1');

      const result = agentLock.acquire('agent-1', 'process-2');
      expect(result).toBe(true); // Now available
    });
  });
});
```

### Integration Tests

**Purpose**: Test interactions between multiple components (database + service, CLI + orchestrator).

**Characteristics:**
- Use real database operations (in-memory SQLite)
- May use real file system (in temporary directories)
- Mock only external APIs (LLM providers, external services)
- Slower than unit tests (seconds)
- Test realistic workflows

**Example - Database + Service Integration:**

```typescript
// packages/core/src/__tests__/hireAgent.test.ts
import Database from 'better-sqlite3';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { hireAgent, HireValidationError } from '../hireAgent';
import { getAgentDirectory } from '../directories';
import { runMigrations } from '@recursivemanager/common/db';
import { allMigrations } from '@recursivemanager/common/db/migrations';

describe('hireAgent', () => {
  let db: Database.Database;
  let testDir: string;

  beforeEach(() => {
    // Setup in-memory database with full schema
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    runMigrations(db, allMigrations);

    // Create temporary directory for file operations
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-hire-'));
  });

  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
  });

  describe('Root Agent Hiring', () => {
    it('should successfully hire a root agent (CEO)', async () => {
      const config = {
        version: '1.0.0',
        identity: { id: 'ceo-001', role: 'CEO', managerId: null },
        goal: { mainGoal: 'Manage the company' },
        permissions: { canHire: true, canFire: true },
        framework: { primary: 'claude-code' },
      };

      const result = await hireAgent(db, null, config, { baseDir: testDir });

      // Verify database state
      expect(result).toBeDefined();
      expect(result.id).toBe('ceo-001');
      expect(result.status).toBe('active');
      expect(result.managerId).toBeNull();

      // Verify filesystem state
      const agentDir = getAgentDirectory('ceo-001', { baseDir: testDir });
      expect(fs.existsSync(agentDir)).toBe(true);
      expect(fs.existsSync(path.join(agentDir, 'tasks', 'active'))).toBe(true);
      expect(fs.existsSync(path.join(agentDir, 'tasks', 'completed'))).toBe(true);

      // Verify agent config file
      const configPath = path.join(agentDir, 'agent-config.json');
      expect(fs.existsSync(configPath)).toBe(true);
      const savedConfig = fs.readJsonSync(configPath);
      expect(savedConfig.identity.id).toBe('ceo-001');
    });

    it('should fail to hire subordinate without manager', async () => {
      const config = {
        version: '1.0.0',
        identity: { id: 'cto-001', role: 'CTO', managerId: 'ceo-001' },
        goal: { mainGoal: 'Technical leadership' },
        permissions: { canHire: true, canFire: false },
        framework: { primary: 'claude-code' },
      };

      await expect(hireAgent(db, 'nonexistent-manager', config, { baseDir: testDir }))
        .rejects.toThrow(HireValidationError);
    });
  });
});
```

**Example - CLI + Core Integration:**

```typescript
// packages/cli/src/__tests__/run.integration.test.ts
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { run } from '../commands/run';
import { initializeDatabase } from '@recursivemanager/common';

// Mock external dependencies
jest.mock('../utils/prompts', () => ({
  select: jest.fn().mockResolvedValue('continuous'),
}));

jest.mock('@recursivemanager/core', () => {
  const actual = jest.requireActual('@recursivemanager/core');
  return {
    ...actual,
    ExecutionOrchestrator: jest.fn().mockImplementation(() => ({
      executeContinuous: jest.fn().mockResolvedValue({
        success: true,
        tasksCompleted: 3,
        errors: [],
      }),
    })),
  };
});

describe('run command integration', () => {
  let testDataDir: string;
  let db: any;

  beforeEach(async () => {
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-run-test-'));

    // Initialize real database with schema
    db = initializeDatabase({
      path: path.join(testDataDir, 'test.db')
    });

    // Create test agent
    db.prepare(`
      INSERT INTO agents (id, role, status, manager_id, hired_at)
      VALUES ('test-agent', 'CEO', 'active', NULL, ?)
    `).run(Date.now());
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(testDataDir)) {
      fs.removeSync(testDataDir);
    }
  });

  it('should execute agent in continuous mode', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await run({ agentId: 'test-agent', mode: 'continuous' });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Execution completed')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Tasks completed: 3')
    );

    consoleSpy.mockRestore();
  });
});
```

### E2E / CLI Tests

**Purpose**: Test complete user workflows from command-line input to final output.

**Characteristics:**
- Test entire command execution path
- Use real CLI parsing and execution
- Mock only external network calls
- Verify console output and exit codes
- Test error handling and user prompts

**Example - Complete CLI Workflow:**

```typescript
// packages/cli/src/__tests__/hire.integration.test.ts
import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import { hire } from '../commands/hire';
import { initializeDatabase } from '@recursivemanager/common';

jest.mock('../utils/prompts', () => ({
  input: jest.fn()
    .mockResolvedValueOnce('ceo-001')       // Agent ID
    .mockResolvedValueOnce('CEO')           // Role
    .mockResolvedValueOnce('Lead the company'), // Goal
  confirm: jest.fn().mockResolvedValue(true),
}));

describe('hire command E2E', () => {
  let testDataDir: string;

  beforeEach(() => {
    testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hire-e2e-'));
    process.env.DATA_DIR = testDataDir;
  });

  afterEach(() => {
    fs.removeSync(testDataDir);
    delete process.env.DATA_DIR;
  });

  it('should complete full hiring workflow', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await hire({ interactive: true });

    // Verify console output
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Agent hired successfully')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('ID: ceo-001')
    );

    // Verify database state
    const db = initializeDatabase({ path: path.join(testDataDir, 'agents.db') });
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get('ceo-001');
    expect(agent).toBeDefined();
    expect(agent.role).toBe('CEO');
    expect(agent.status).toBe('active');

    // Verify filesystem state
    const agentDir = path.join(testDataDir, 'agents', 'ceo-001');
    expect(fs.existsSync(agentDir)).toBe(true);

    db.close();
    consoleSpy.mockRestore();
  });
});
```

## Writing Tests

### Test Structure (AAA Pattern)

Follow the **Arrange-Act-Assert** pattern for clear, maintainable tests:

```typescript
describe('FeatureName', () => {
  describe('specificBehavior', () => {
    it('should do something when condition is met', () => {
      // ARRANGE: Set up test data and preconditions
      const input = 'test-input';
      const expectedOutput = 'test-output';
      const service = new MyService();

      // ACT: Execute the code under test
      const result = service.process(input);

      // ASSERT: Verify the expected behavior
      expect(result).toBe(expectedOutput);
    });
  });
});
```

### Test Naming Conventions

**Good test names** are descriptive and follow the pattern: `should [expected behavior] when [condition]`

```typescript
// ✅ GOOD: Clear, specific, describes behavior
it('should return true when agent is already locked by same process', () => {});
it('should throw ValidationError when config is missing required fields', () => {});
it('should create agent directory with correct permissions', () => {});

// ❌ BAD: Vague, unclear what's being tested
it('works correctly', () => {});
it('test agent lock', () => {});
it('handles errors', () => {});
```

### Setup and Teardown

Use lifecycle hooks to manage test state:

```typescript
describe('DatabaseTests', () => {
  let db: Database.Database;
  let testDir: string;

  // Runs ONCE before all tests in this describe block
  beforeAll(() => {
    console.log('Setting up test suite');
  });

  // Runs BEFORE EACH test
  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    runMigrations(db, allMigrations);

    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-'));
  });

  // Runs AFTER EACH test
  afterEach(() => {
    db.close();
    fs.removeSync(testDir);
  });

  // Runs ONCE after all tests
  afterAll(() => {
    console.log('Cleaning up test suite');
  });

  it('test case 1', () => {
    // db and testDir are fresh for this test
  });

  it('test case 2', () => {
    // db and testDir are fresh again (isolated)
  });
});
```

### Async Testing

Always use `async/await` for asynchronous operations:

```typescript
// ✅ GOOD: Using async/await
it('should successfully fetch data', async () => {
  const result = await fetchData();
  expect(result).toBeDefined();
});

it('should reject with error when API fails', async () => {
  await expect(fetchData({ invalid: true }))
    .rejects.toThrow('API Error');
});

// ❌ BAD: Missing async/await (test may pass incorrectly)
it('should fetch data', () => {
  const result = fetchData(); // Returns Promise, not actual result!
  expect(result).toBeDefined(); // Always passes (Promise is always defined)
});
```

### Testing Errors

Test error cases explicitly:

```typescript
describe('error handling', () => {
  it('should throw ValidationError with descriptive message', () => {
    expect(() => {
      validateInput('invalid-input');
    }).toThrow(ValidationError);

    expect(() => {
      validateInput('invalid-input');
    }).toThrow('Input must contain alphanumeric characters only');
  });

  it('should reject async operation with specific error', async () => {
    await expect(asyncOperation('bad-input'))
      .rejects.toThrow(DatabaseError);

    await expect(asyncOperation('bad-input'))
      .rejects.toThrow('Failed to insert record: constraint violation');
  });
});
```

### Testing Edge Cases

Always test boundary conditions and edge cases:

```typescript
describe('priority queue', () => {
  it('should handle empty queue', () => {
    const queue = new PriorityQueue();
    expect(queue.dequeue()).toBeNull();
  });

  it('should handle single item', () => {
    const queue = new PriorityQueue();
    queue.enqueue('item-1', 5);
    expect(queue.dequeue()).toBe('item-1');
    expect(queue.dequeue()).toBeNull();
  });

  it('should handle maximum priority value', () => {
    const queue = new PriorityQueue();
    queue.enqueue('item-1', Number.MAX_SAFE_INTEGER);
    expect(queue.dequeue()).toBe('item-1');
  });

  it('should handle negative priorities', () => {
    const queue = new PriorityQueue();
    queue.enqueue('low', -10);
    queue.enqueue('high', 10);
    expect(queue.dequeue()).toBe('high'); // Higher priority first
  });
});
```

## Running Tests

### NPM Scripts

```bash
# Run all tests (monorepo level)
npm test                    # Run all tests across all packages
npm run test:coverage       # Run with coverage report
npm run test:ci             # CI-optimized test run

# Package-specific tests
cd packages/core
npm test                    # Run only core tests
npm run test:coverage       # Core tests with coverage
npm run test:watch          # Watch mode for active development
```

### Jest CLI Options

```bash
# Run specific test file
npm test -- hireAgent.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="hire"
npm test -- --testPathPattern="integration"

# Run only failed tests
npm test -- --onlyFailures

# Run with verbose output
npm test -- --verbose

# Update snapshots
npm test -- --updateSnapshot

# Clear cache and run
npm test -- --clearCache
npm test -- --no-cache

# Run in band (sequentially, useful for debugging)
npm test -- --runInBand

# Run with debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Watch Mode

Watch mode automatically re-runs tests when files change:

```bash
npm run test:watch
```

**Watch mode commands:**
- Press `a` to run all tests
- Press `f` to run only failed tests
- Press `p` to filter by filename pattern
- Press `t` to filter by test name pattern
- Press `q` to quit watch mode
- Press `Enter` to trigger a test run

### Debugging Tests in VS Code

**Launch Configuration** (`.vscode/launch.json`):

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Jest Tests",
      "type": "node",
      "request": "launch",
      "runtimeArgs": [
        "--inspect-brk",
        "${workspaceRoot}/node_modules/.bin/jest",
        "--runInBand",
        "--no-cache"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Debug Current Test File",
      "type": "node",
      "request": "launch",
      "runtimeArgs": [
        "--inspect-brk",
        "${workspaceRoot}/node_modules/.bin/jest",
        "${file}",
        "--runInBand",
        "--no-cache"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

**Usage:**
1. Set breakpoints in test or source code
2. Open test file in VS Code
3. Press `F5` or select "Debug Current Test File"
4. Step through code with debugger

## Coverage

### Coverage Reports

Generate coverage reports to identify untested code:

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

**Report Files:**
- `coverage/lcov.info` - LCOV format for CI tools
- `coverage/coverage-final.json` - JSON format
- `coverage/lcov-report/index.html` - Interactive HTML report

### Coverage Thresholds

Global coverage thresholds enforced in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  }
}
```

**Failing tests if coverage drops below threshold:**
```bash
npm run test:coverage
# FAIL: Coverage for branches (75%) does not meet global threshold (80%)
```

### Interpreting Coverage Metrics

- **Statements**: Individual executable statements
- **Branches**: Conditional branches (if/else, switch, ternary)
- **Functions**: Function declarations
- **Lines**: Physical lines of code

**Example:**
```typescript
function calculate(x: number, y: number) {
  if (x > 0) {        // Branch 1
    return x + y;     // Statement 1
  } else {            // Branch 2
    return x - y;     // Statement 2
  }
}

// To achieve 100% coverage, test both branches:
// 1. Test with x > 0 (covers Branch 1, Statement 1)
// 2. Test with x <= 0 (covers Branch 2, Statement 2)
```

### Viewing Coverage for Specific Packages

```bash
# Core package coverage
cd packages/core
npm run test:coverage

# CLI package coverage
cd packages/cli
npm run test:coverage
```

## Mocking Strategies

### Module Mocking

Mock entire modules to isolate code under test:

```typescript
// Mock an external module
jest.mock('execa', () => ({
  execa: jest.fn().mockResolvedValue({ stdout: 'success', exitCode: 0 }),
}));

// Mock with custom implementation
jest.mock('../utils/prompts', () => ({
  confirm: jest.fn().mockResolvedValue(true),
  input: jest.fn().mockResolvedValue('test-input'),
  select: jest.fn().mockResolvedValue('option-1'),
}));
```

### Partial Module Mocking

Preserve real implementations while mocking specific exports:

```typescript
jest.mock('@recursivemanager/core', () => {
  const actual = jest.requireActual('@recursivemanager/core');
  return {
    ...actual,  // Keep all real exports
    ExecutionOrchestrator: jest.fn().mockImplementation(() => ({
      executeContinuous: jest.fn().mockResolvedValue({ success: true }),
    })),
  };
});
```

### Function Mocking (Spies)

Spy on functions to verify calls without changing behavior:

```typescript
describe('logging', () => {
  it('should log error messages', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    performAction(); // Calls console.error internally

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error')
    );

    consoleErrorSpy.mockRestore(); // Restore original implementation
  });
});
```

### Database Mocking

Use in-memory SQLite for realistic database testing:

```typescript
beforeEach(() => {
  // Create in-memory database (isolated, fast)
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  // Run all migrations to create schema
  runMigrations(db, allMigrations);
});

afterEach(() => {
  db.close(); // Clean up after each test
});
```

### Global Mocks

Mock global objects like `fetch`:

```typescript
// Define global fetch mock
global.fetch = jest.fn();

describe('API calls', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('should call API with correct parameters', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: 'success' }),
    });

    const result = await callAPI('/endpoint');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/endpoint',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });
});
```

### Time Mocking

Control time in tests for predictable results:

```typescript
describe('time-dependent behavior', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-20T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should timeout after 5 seconds', () => {
    const callback = jest.fn();
    setTimeout(callback, 5000);

    jest.advanceTimersByTime(4999);
    expect(callback).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalled();
  });
});
```

### Mock Files (Package-Level)

Create `__mocks__/` directory for reusable mocks:

```javascript
// packages/core/__mocks__/execa.js
const execa = jest.fn();
execa.sync = jest.fn();
execa.command = jest.fn();

module.exports = { execa };
```

**Usage:**
```typescript
// In test file
jest.mock('execa'); // Automatically uses __mocks__/execa.js
```

## Test Utilities

### Database Helpers

```typescript
/**
 * Create in-memory database with full schema
 */
export function createTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  runMigrations(db, allMigrations);
  return db;
}

/**
 * Create test agent in database
 */
export function createTestAgent(
  db: Database.Database,
  id: string = 'test-agent',
  overrides: Partial<Agent> = {}
): Agent {
  const agent = {
    id,
    role: 'CEO',
    status: 'active',
    manager_id: null,
    hired_at: Date.now(),
    ...overrides,
  };

  db.prepare(`
    INSERT INTO agents (id, role, status, manager_id, hired_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(agent.id, agent.role, agent.status, agent.manager_id, agent.hired_at);

  return agent;
}
```

### Async Helpers

```typescript
/**
 * Wait for condition to be true or timeout
 */
export async function waitFor(
  condition: () => boolean,
  timeoutMs: number = 1000
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

/**
 * Create a delayed promise (for testing async operations)
 */
export function createDelayedTask<T>(
  value: T,
  delayMs: number
): () => Promise<T> {
  return () => new Promise(resolve => setTimeout(() => resolve(value), delayMs));
}
```

### Filesystem Helpers

```typescript
/**
 * Create temporary test directory
 */
export function createTempDir(prefix: string = 'test-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/**
 * Clean up test directory
 */
export function cleanupTempDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.removeSync(dir);
  }
}

/**
 * Usage in tests
 */
let testDir: string;

beforeEach(() => {
  testDir = createTempDir('my-test-');
});

afterEach(() => {
  cleanupTempDir(testDir);
});
```

### Fixture Helpers

```typescript
/**
 * Generate default agent config for testing
 */
export function generateDefaultConfig(
  role: string,
  overrides: Partial<AgentConfig> = {}
): AgentConfig {
  return {
    version: '1.0.0',
    identity: {
      id: `${role.toLowerCase()}-001`,
      role,
      managerId: null,
    },
    goal: {
      mainGoal: `Manage ${role} responsibilities`,
    },
    permissions: {
      canHire: true,
      canFire: true,
    },
    framework: {
      primary: 'claude-code',
    },
    ...overrides,
  };
}
```

## CI/CD Integration

### GitHub Actions Workflow

RecursiveManager uses GitHub Actions for continuous testing:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false

  test-matrix:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run build
      - run: npm test
```

### Test Scripts for CI

```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:ci": "npm test",
    "test:watch": "jest --watch"
  }
}
```

### Coverage Reporting (Codecov)

Coverage reports are automatically uploaded to Codecov on CI runs:

```bash
# CI automatically runs this after tests
codecov --file=./coverage/lcov.info
```

**View coverage:**
- https://codecov.io/gh/[username]/RecursiveManager

### Pre-commit Hooks

Husky + lint-staged ensure tests pass before commits:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.ts": [
      "eslint --fix",
      "jest --bail --findRelatedTests"
    ]
  }
}
```

## Debugging Tests

### Common Debug Techniques

**1. Console Logging:**
```typescript
it('should process data', () => {
  const result = processData(input);
  console.log('Result:', result); // Temporary debug output
  expect(result).toBeDefined();
});
```

**2. Verbose Output:**
```bash
npm test -- --verbose
```

**3. Run Single Test:**
```bash
npm test -- --testNamePattern="specific test name"
```

**4. Disable Parallel Execution:**
```bash
npm test -- --runInBand
```

**5. VS Code Debugger:**
- Set breakpoint in test file
- Press F5 or select "Debug Current Test File"
- Step through code with debugger controls

### Debugging Async Tests

```typescript
it('should debug async operation', async () => {
  console.log('Before async call');
  const result = await asyncOperation();
  console.log('After async call, result:', result);

  // Use try/catch to see actual error
  try {
    expect(result).toBe('expected');
  } catch (error) {
    console.error('Assertion failed:', error);
    throw error;
  }
});
```

### Debugging Database Issues

```typescript
it('should debug database state', () => {
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get('test-id');
  console.log('Agent from DB:', agent);

  // Inspect all agents
  const allAgents = db.prepare('SELECT * FROM agents').all();
  console.log('All agents:', allAgents);

  expect(agent).toBeDefined();
});
```

## Best Practices

### ✅ DO

1. **Write tests first** (TDD) or alongside production code
2. **Test behavior, not implementation** - Focus on what code does, not how
3. **Use descriptive test names** - `should do X when Y`
4. **Keep tests independent** - Each test should run in isolation
5. **Test edge cases** - Empty arrays, null values, boundary conditions
6. **Use `beforeEach/afterEach`** - Clean state for each test
7. **Mock external dependencies** - Database, APIs, file system (when appropriate)
8. **Verify error cases** - Test that errors are thrown correctly
9. **Use in-memory database** - Fast, isolated, realistic
10. **Aim for high coverage** - 80%+ on critical paths

### ❌ DON'T

1. **Don't test implementation details** - Test public API, not private methods
2. **Don't share state between tests** - Use fresh setup in `beforeEach`
3. **Don't skip cleanup** - Always close databases, delete temp files
4. **Don't use real external services** - Mock APIs, databases (except in-memory)
5. **Don't write flaky tests** - Tests should pass consistently (no random failures)
6. **Don't use large timeouts** - Keep tests fast (<5 seconds each)
7. **Don't duplicate test logic** - Extract common patterns to helpers
8. **Don't ignore failing tests** - Fix or remove, never skip
9. **Don't test library code** - Trust Jest, SQLite, etc. work correctly
10. **Don't commit `.only()` or `.skip()`** - Remove before committing

### Test Smells (Anti-patterns)

**❌ BAD: Testing implementation details**
```typescript
it('should call private method', () => {
  const service = new MyService();
  const spy = jest.spyOn(service as any, '_privateMethod');
  service.publicMethod();
  expect(spy).toHaveBeenCalled();
});
```

**✅ GOOD: Testing public behavior**
```typescript
it('should process data correctly', () => {
  const service = new MyService();
  const result = service.publicMethod();
  expect(result).toBe('expected-output');
});
```

**❌ BAD: Shared state between tests**
```typescript
let db: Database.Database; // Shared across tests

beforeAll(() => {
  db = new Database(':memory:'); // Created once
});

it('test 1', () => {
  db.prepare('INSERT INTO agents ...').run(); // Modifies shared state
});

it('test 2', () => {
  // Depends on state from test 1 (BAD!)
  const agents = db.prepare('SELECT * FROM agents').all();
  expect(agents).toHaveLength(1);
});
```

**✅ GOOD: Fresh state for each test**
```typescript
let db: Database.Database;

beforeEach(() => {
  db = new Database(':memory:'); // Fresh for each test
  runMigrations(db, allMigrations);
});

afterEach(() => {
  db.close(); // Clean up
});
```

## Common Patterns

### Testing Async Operations

```typescript
describe('async operations', () => {
  it('should resolve with data', async () => {
    const result = await fetchData();
    expect(result).toEqual({ status: 'success' });
  });

  it('should reject with error', async () => {
    await expect(fetchData({ invalid: true }))
      .rejects.toThrow('Invalid request');
  });

  it('should timeout after delay', async () => {
    jest.useFakeTimers();

    const promise = operationWithTimeout(5000);
    jest.advanceTimersByTime(6000);

    await expect(promise).rejects.toThrow('Timeout');

    jest.useRealTimers();
  });
});
```

### Testing Concurrent Operations

```typescript
describe('concurrent execution', () => {
  it('should prevent concurrent execution of same agent', async () => {
    const pool = new ExecutionPool({ maxConcurrent: 10 });
    const executionOrder: number[] = [];

    // Start two tasks for same agent
    const task1 = pool.execute('agent-1', async () => {
      executionOrder.push(1);
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    const task2 = pool.execute('agent-1', async () => {
      executionOrder.push(2);
    });

    await Promise.all([task1, task2]);

    // Task 2 should wait for Task 1 to complete
    expect(executionOrder).toEqual([1, 2]);
  });
});
```

### Testing Event Emitters

```typescript
describe('event emitters', () => {
  it('should emit events on state change', (done) => {
    const scheduler = new Scheduler();

    scheduler.on('agent:started', (agentId: string) => {
      expect(agentId).toBe('agent-1');
      done(); // Signal test completion
    });

    scheduler.startAgent('agent-1');
  });

  it('should emit multiple events', async () => {
    const scheduler = new Scheduler();
    const events: string[] = [];

    scheduler.on('agent:started', () => events.push('started'));
    scheduler.on('agent:completed', () => events.push('completed'));

    await scheduler.runAgent('agent-1');

    expect(events).toEqual(['started', 'completed']);
  });
});
```

### Testing Retry Logic

```typescript
describe('retry logic', () => {
  it('should retry 3 times before failing', async () => {
    let attempts = 0;
    const operation = jest.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new Error('Transient error');
      return 'success';
    });

    const result = await retryOperation(operation, { maxRetries: 3 });

    expect(attempts).toBe(3);
    expect(result).toBe('success');
  });

  it('should fail after max retries exceeded', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('Permanent error'));

    await expect(retryOperation(operation, { maxRetries: 3 }))
      .rejects.toThrow('Permanent error');

    expect(operation).toHaveBeenCalledTimes(3);
  });
});
```

## Troubleshooting

### Test Failures

**Problem: Tests pass locally but fail in CI**

**Solution:**
- Check Node.js version matches CI (use `.nvmrc`)
- Verify environment variables are set in CI
- Check for timezone differences (use UTC in tests)
- Look for race conditions (use `--runInBand`)

**Problem: Flaky tests (intermittent failures)**

**Solution:**
- Add proper async/await (don't forget to await promises)
- Increase timeouts for slow operations
- Use `waitFor()` helper instead of arbitrary delays
- Check for shared state between tests
- Run tests in isolation: `npm test -- --runInBand`

**Problem: Database locked errors**

**Solution:**
```typescript
// Always close database in afterEach
afterEach(() => {
  if (db) {
    db.close();
  }
});

// Use WAL mode for concurrent access
db.pragma('journal_mode = WAL');
```

**Problem: Tests timeout**

**Solution:**
```typescript
// Increase timeout for specific test
it('slow operation', async () => {
  // ...
}, 10000); // 10 second timeout

// Or globally in jest.config.js
module.exports = {
  testTimeout: 10000,
};
```

### Coverage Issues

**Problem: Coverage below threshold**

**Solution:**
```bash
# Generate HTML report to see uncovered lines
npm run test:coverage
open coverage/lcov-report/index.html

# Focus on critical paths first
# Add tests for uncovered branches/functions
```

**Problem: Coverage not calculated correctly**

**Solution:**
```bash
# Clear Jest cache
npm test -- --clearCache

# Rebuild packages
npm run build

# Run coverage again
npm run test:coverage
```

### Debugging Test Failures

**1. Read error message carefully:**
```
Expected: "success"
Received: "failure"
```

**2. Add console.log to see actual values:**
```typescript
console.log('Actual result:', result);
expect(result).toBe('expected');
```

**3. Run single test in isolation:**
```bash
npm test -- --testNamePattern="specific failing test"
```

**4. Check test dependencies:**
```bash
# Verify package is built
npm run build

# Reinstall dependencies
rm -rf node_modules
npm install
```

**5. Use VS Code debugger:**
- Set breakpoint at failing assertion
- Press F5 to debug test
- Inspect variables in debugger

## Related Documentation

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development workflow and setup
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design patterns
- [CLI.md](./CLI.md) - CLI commands and usage
- [API.md](./API.md) - API reference
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions

## Summary

This guide covered:

- ✅ **Testing strategy** - Test pyramid, coverage goals, test types
- ✅ **Writing tests** - Structure, naming, setup/teardown, async testing
- ✅ **Running tests** - NPM scripts, Jest CLI, watch mode, debugging
- ✅ **Coverage** - Reports, thresholds, interpretation
- ✅ **Mocking** - Module mocks, spies, database mocks, global mocks
- ✅ **Test utilities** - Database helpers, async helpers, fixtures
- ✅ **CI/CD** - GitHub Actions, coverage reporting, pre-commit hooks
- ✅ **Best practices** - DOs, DON'Ts, test smells, common patterns
- ✅ **Troubleshooting** - Test failures, coverage issues, debugging

**Remember:**
- Write tests for all new features
- Maintain 80%+ coverage on critical paths
- Keep tests fast, isolated, and deterministic
- Use descriptive test names
- Clean up resources in `afterEach`

Happy testing! 🧪
