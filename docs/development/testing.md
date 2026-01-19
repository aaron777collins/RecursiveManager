# Testing

Comprehensive guide to testing RecursiveManager.

## Test Structure

RecursiveManager uses Jest for testing:

```
packages/*/
├── src/
│   ├── Component.ts
│   └── Component.test.ts       # Unit tests
└── __tests__/
    └── integration.test.ts     # Integration tests
```

## Running Tests

### All Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

### Package-Specific Tests

```bash
# Test specific package
npm test -- --filter=@recursive-manager/core

# Test common package
npm test -- --filter=@recursive-manager/common
```

### Individual Test Files

```bash
# Run specific test file
npm test -- packages/core/src/agents/BaseAgent.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="Agent"
```

## Test Types

### Unit Tests

Test individual functions and classes in isolation.

```typescript
import { BaseAgent } from './BaseAgent';

describe('BaseAgent', () => {
  let agent: BaseAgent;

  beforeEach(() => {
    agent = new BaseAgent({
      id: 'test-agent',
      role: 'worker'
    });
  });

  afterEach(() => {
    // Cleanup
  });

  it('should initialize with correct properties', () => {
    expect(agent.id).toBe('test-agent');
    expect(agent.role).toBe('worker');
    expect(agent.status).toBe('idle');
  });

  it('should transition to working state', async () => {
    await agent.start();
    expect(agent.status).toBe('working');
  });

  it('should handle errors gracefully', async () => {
    await expect(agent.execute(null)).rejects.toThrow();
  });
});
```

### Integration Tests

Test interactions between components.

```typescript
import { RecursiveManager } from '../RecursiveManager';
import { getDatabase } from '@recursive-manager/common';

describe('RecursiveManager Integration', () => {
  let manager: RecursiveManager;
  let db: Database;

  beforeAll(async () => {
    db = await getDatabase(':memory:');
  });

  beforeEach(async () => {
    manager = new RecursiveManager({ database: db });
    await manager.initialize('test goal');
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  afterAll(async () => {
    await db.close();
  });

  it('should create agent hierarchy', async () => {
    const agents = await manager.getAgents();
    expect(agents.length).toBeGreaterThan(0);
    expect(agents[0].role).toBe('manager');
  });

  it('should delegate tasks correctly', async () => {
    const task = await manager.createTask({
      description: 'test task',
      priority: 5
    });

    await manager.delegateTask(task.id);

    const updatedTask = await manager.getTask(task.id);
    expect(updatedTask.status).toBe('assigned');
    expect(updatedTask.agentId).toBeDefined();
  });
});
```

### E2E Tests

Test complete workflows from CLI.

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

describe('CLI E2E', () => {
  it('should initialize and show status', async () => {
    // Initialize
    await execAsync('recursive-manager init "test goal"');

    // Check status
    const { stdout } = await execAsync('recursive-manager status');
    expect(stdout).toContain('test goal');
  });

  it('should update to latest version', async () => {
    const { stdout } = await execAsync('recursive-manager update --check');
    expect(stdout).toMatch(/up to date|update available/i);
  });
});
```

## Mocking

### Mocking Dependencies

```typescript
import { ClaudeCodeAdapter } from '@recursive-manager/adapters';

jest.mock('@recursive-manager/adapters');

describe('Agent with mocked adapter', () => {
  let mockAdapter: jest.Mocked<ClaudeCodeAdapter>;

  beforeEach(() => {
    mockAdapter = {
      execute: jest.fn().mockResolvedValue('result'),
      initialize: jest.fn(),
    } as any;
  });

  it('should use adapter', async () => {
    const agent = new Agent({ adapter: mockAdapter });
    const result = await agent.execute('task');

    expect(mockAdapter.execute).toHaveBeenCalledWith('task');
    expect(result).toBe('result');
  });
});
```

### Mocking Database

```typescript
import { DatabaseConnection } from '@recursive-manager/common';

const mockDb: jest.Mocked<DatabaseConnection> = {
  getAgent: jest.fn(),
  saveAgent: jest.fn(),
  listAgents: jest.fn(),
  // ... other methods
};

describe('Manager with mocked database', () => {
  it('should fetch agents from database', async () => {
    mockDb.listAgents.mockResolvedValue([
      { id: 'agent-1', role: 'worker' }
    ]);

    const manager = new Manager({ db: mockDb });
    const agents = await manager.getAgents();

    expect(agents).toHaveLength(1);
    expect(mockDb.listAgents).toHaveBeenCalled();
  });
});
```

### Mocking Time

```typescript
describe('Time-dependent tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-19'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should expire lock after timeout', () => {
    const lock = new Lock({ timeout: 1000 });

    expect(lock.isExpired()).toBe(false);

    jest.advanceTimersByTime(1001);

    expect(lock.isExpired()).toBe(true);
  });
});
```

## Test Utilities

### Test Fixtures

```typescript
// __tests__/fixtures/agents.ts
export const mockAgent = {
  id: 'test-agent-1',
  role: 'worker',
  status: 'idle',
  createdAt: '2026-01-19T10:00:00Z',
  updatedAt: '2026-01-19T10:00:00Z',
};

export const mockManager = {
  id: 'test-manager-1',
  role: 'manager',
  status: 'working',
  createdAt: '2026-01-19T09:00:00Z',
  updatedAt: '2026-01-19T10:00:00Z',
};
```

### Test Helpers

```typescript
// __tests__/helpers/database.ts
export async function createTestDatabase() {
  const db = await getDatabase(':memory:');
  await db.migrate();
  return db;
}

export async function seedTestData(db: Database) {
  await db.saveAgent(mockAgent);
  await db.saveAgent(mockManager);
}

export async function cleanupTestDatabase(db: Database) {
  await db.clear();
  await db.close();
}
```

## Coverage

### Viewing Coverage

```bash
# Generate coverage report
npm test -- --coverage

# Open HTML report
open coverage/lcov-report/index.html
```

### Coverage Thresholds

Configured in `jest.config.js`:

```javascript
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

## Debugging Tests

### Using Node Inspector

```bash
# Debug tests
node --inspect-brk node_modules/.bin/jest --runInBand

# Then open chrome://inspect in Chrome
```

### Using VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Debug Specific Test

```bash
# Add .only to test
it.only('should do something', () => {
  // This test will run alone
});

# Or use --testNamePattern
npm test -- --testNamePattern="should do something"
```

## Best Practices

### Test Organization

- Group related tests with `describe`
- Use clear, descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

```typescript
describe('AgentLock', () => {
  describe('acquire', () => {
    it('should acquire lock when available', async () => {
      // Arrange
      const lock = new AgentLock();

      // Act
      await lock.acquire('resource-1');

      // Assert
      expect(lock.isHeld('resource-1')).toBe(true);
    });
  });
});
```

### Test Isolation

- Each test should be independent
- Use `beforeEach` and `afterEach` for setup/cleanup
- Don't rely on test execution order

### Async Testing

```typescript
// Using async/await
it('should complete async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe('expected');
});

// Using done callback
it('should handle callback', (done) => {
  callbackFunction((result) => {
    expect(result).toBe('expected');
    done();
  });
});

// Using promises
it('should resolve promise', () => {
  return expect(promiseFunction()).resolves.toBe('expected');
});
```

### Error Testing

```typescript
// Testing thrown errors
expect(() => {
  throwingFunction();
}).toThrow('Expected error message');

// Testing async errors
await expect(asyncThrowingFunction()).rejects.toThrow();

// Testing specific error types
await expect(function()).rejects.toThrow(CustomError);
```

## Performance Testing

### Timing Tests

```typescript
it('should complete within time limit', async () => {
  const start = Date.now();
  await expensiveOperation();
  const duration = Date.now() - start;

  expect(duration).toBeLessThan(1000); // 1 second
});
```

### Load Testing

```typescript
it('should handle concurrent operations', async () => {
  const operations = Array(100)
    .fill(null)
    .map(() => performOperation());

  const results = await Promise.all(operations);

  expect(results).toHaveLength(100);
  expect(results.every(r => r.success)).toBe(true);
});
```

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Commits to main
- Release tags

See `.github/workflows/test.yml` for configuration.

## Troubleshooting

### Tests Failing Locally

```bash
# Clear Jest cache
npm test -- --clearCache

# Run with verbose output
npm test -- --verbose

# Run without coverage (faster)
npm test -- --no-coverage
```

### Flaky Tests

- Check for race conditions
- Ensure proper cleanup
- Use `jest.setTimeout()` for slow tests
- Mock external dependencies

### Memory Issues

```bash
# Increase Node memory
NODE_OPTIONS=--max_old_space_size=4096 npm test

# Run tests in sequence
npm test -- --runInBand
```
