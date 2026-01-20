# Database Schema

RecursiveManager uses a file-based persistence system with optional SQLite support.

## Storage Backends

### File-Based (Default)

The default storage uses JSON files for simplicity and portability:

```
~/.recursive-manager/data/
├── agents/
│   ├── agent-001.json
│   ├── agent-002.json
│   └── ...
├── tasks/
│   ├── task-001.json
│   ├── task-002.json
│   └── ...
└── metadata.json
```

**Advantages:**
- No database setup required
- Human-readable
- Easy to debug
- Version control friendly
- Portable across systems

**Disadvantages:**
- Limited query capabilities
- Not suitable for high-concurrency
- Manual indexing required

### SQLite (Optional)

For better performance and query capabilities:

```bash
DATABASE_TYPE=sqlite
DATABASE_PATH=~/.recursive-manager/data/recursive-manager.db
```

## Data Models

### Agent

```typescript
interface Agent {
  id: string;                    // Unique identifier (UUID)
  role: string;                  // Agent's role (e.g., "Manager", "Worker")
  managerId?: string;            // Parent manager ID (null for root)
  depth: number;                 // Hierarchy depth (0 = root)
  status: AgentStatus;           // Current status
  goal?: string;                 // Agent's goal/objective
  framework: string;             // AI framework (e.g., "claude-code")
  createdAt: string;             // ISO 8601 timestamp
  updatedAt: string;             // ISO 8601 timestamp
  lastActive?: string;           // Last activity timestamp
  metadata: Record<string, any>; // Additional data
}

enum AgentStatus {
  IDLE = 'idle',
  WORKING = 'working',
  WAITING = 'waiting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PAUSED = 'paused'
}
```

### Task

```typescript
interface Task {
  id: string;                    // Unique identifier (UUID)
  agentId: string;              // Assigned agent ID
  parentTaskId?: string;        // Parent task (for subtasks)
  description: string;          // Task description
  status: TaskStatus;           // Current status
  priority: number;             // Priority (1-10)
  dependencies: string[];       // Task IDs that must complete first
  createdAt: string;            // ISO 8601 timestamp
  startedAt?: string;           // When work began
  completedAt?: string;         // When finished
  dueDate?: string;             // Optional deadline
  result?: any;                 // Task output/result
  error?: string;               // Error message if failed
  retries: number;              // Number of retry attempts
  maxRetries: number;           // Maximum retry attempts
  metadata: Record<string, any>; // Additional data
}

enum TaskStatus {
  CREATED = 'created',
  QUEUED = 'queued',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}
```

### Lock

```typescript
interface Lock {
  resourceId: string;           // Resource being locked (e.g., agent ID)
  lockId: string;               // Lock identifier
  ownerId: string;              // Who owns the lock
  acquiredAt: string;           // When acquired
  expiresAt: string;            // When expires
  metadata: Record<string, any>;
}
```

### Perspective Analysis

```typescript
interface PerspectiveAnalysisRecord {
  id: string;                   // Unique identifier
  decisionId: string;           // Decision being analyzed
  agentId: string;              // Agent performing analysis
  timestamp: string;            // Analysis timestamp
  perspectives: {
    security: PerspectiveResult;
    architecture: PerspectiveResult;
    simplicity: PerspectiveResult;
    financial: PerspectiveResult;
    marketing: PerspectiveResult;
    ux: PerspectiveResult;
    growth: PerspectiveResult;
    emotional: PerspectiveResult;
  };
  recommendation: string;       // Final recommendation
  confidence: number;           // Confidence score (0-1)
  metadata: Record<string, any>;
}

interface PerspectiveResult {
  score: number;                // Score (1-5)
  reasoning: string;            // Explanation
  concerns: string[];           // Identified concerns
  benefits: string[];           // Identified benefits
}
```

## Indexes

For file-based storage, in-memory indexes are maintained:

```typescript
interface Indexes {
  agentsByManager: Map<string, string[]>;     // managerId -> agentIds
  agentsByStatus: Map<AgentStatus, string[]>; // status -> agentIds
  tasksByAgent: Map<string, string[]>;        // agentId -> taskIds
  tasksByStatus: Map<TaskStatus, string[]>;   // status -> taskIds
  tasksByPriority: Map<number, string[]>;     // priority -> taskIds
}
```

## Queries

### Common Agent Queries

```typescript
// Get all agents
const agents = await db.listAgents();

// Get agent by ID
const agent = await db.getAgent('agent-123');

// Get agents by manager
const subordinates = await db.getAgentsByManager('manager-456');

// Get agents by status
const workingAgents = await db.getAgentsByStatus(AgentStatus.WORKING);

// Get root agents
const roots = await db.getRootAgents();
```

### Common Task Queries

```typescript
// Get all tasks
const tasks = await db.listTasks();

// Get task by ID
const task = await db.getTask('task-789');

// Get tasks by agent
const agentTasks = await db.getTasksByAgent('agent-123');

// Get tasks by status
const inProgressTasks = await db.getTasksByStatus(TaskStatus.IN_PROGRESS);

// Get high-priority tasks
const urgentTasks = await db.getTasksByPriority(1, 3);

// Get tasks with dependencies
const dependentTasks = await db.getTasksWithDependencies();
```

## Transactions

For SQLite backend, transactions are supported:

```typescript
await db.transaction(async (tx) => {
  await tx.saveAgent(agent);
  await tx.saveTasks(tasks);
  await tx.updateMetadata(metadata);
});
```

File-based storage uses atomic writes with temp files.

## Backup and Recovery

### Automatic Backups

RecursiveManager creates backups before updates:

```
~/.recursive-manager/backups/
├── 2026-01-19_10-30-00/
│   └── data/
│       ├── agents/
│       └── tasks/
└── 2026-01-18_14-20-00/
    └── data/
        ├── agents/
        └── tasks/
```

### Manual Backup

```bash
# Create backup
recursive-manager backup

# Restore from backup
recursive-manager restore --backup 2026-01-19_10-30-00
```

## Data Migration

### Version Migrations

When data schema changes between versions:

```typescript
interface Migration {
  version: string;              // Target version
  up: (data: any) => any;      // Upgrade function
  down: (data: any) => any;    // Downgrade function
}

const migrations: Migration[] = [
  {
    version: '0.2.0',
    up: (data) => {
      // Add new fields
      data.metadata = data.metadata || {};
      return data;
    },
    down: (data) => {
      // Remove new fields
      delete data.metadata;
      return data;
    }
  }
];
```

### Migration Process

```typescript
// Run migrations
await db.migrate('0.2.0');

// Rollback migrations
await db.rollback('0.1.0');
```

## Data Validation

All data is validated before persistence:

```typescript
import { z } from 'zod';

const AgentSchema = z.object({
  id: z.string().uuid(),
  role: z.string().min(1),
  managerId: z.string().uuid().optional(),
  depth: z.number().min(0).max(10),
  status: z.enum(['idle', 'working', 'waiting', 'completed', 'failed', 'paused']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

## Performance Considerations

### File-Based Storage

- **Pros**: Simple, portable, no setup
- **Cons**: Slower for large datasets
- **Best for**: < 1000 agents, < 10000 tasks

### SQLite Storage

- **Pros**: Fast queries, better concurrency
- **Cons**: Requires setup, less portable
- **Best for**: > 1000 agents, > 10000 tasks

### Optimization Tips

1. Use indexes for frequent queries
2. Batch writes when possible
3. Cache frequently accessed data
4. Clean up completed tasks periodically
5. Archive old agent data

## Data Retention

Configure data retention policies:

```bash
# Keep completed tasks for 30 days
TASK_RETENTION_DAYS=30

# Keep failed tasks for 90 days
FAILED_TASK_RETENTION_DAYS=90

# Keep agent history forever
AGENT_RETENTION_DAYS=0
```

## Security

### Data Encryption at Rest

RecursiveManager supports application-level encryption for sensitive data fields using AES-256-GCM with PBKDF2 key derivation.

#### Enabling Encryption

Add these environment variables to your `.env` file:

```bash
# Enable encryption for sensitive fields
DATABASE_ENCRYPTION_KEY=your-secure-password-or-32-byte-hex-key

# Optional: Use raw hex key instead of password (advanced)
DATABASE_ENCRYPTION_USE_KDF=true  # true = password mode (default), false = raw key mode
```

#### How It Works

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: PBKDF2 with 100,000 iterations (when using password mode)
- **Initialization Vector**: Random 16-byte IV for each encryption (ensures unique ciphertext)
- **Authentication**: GCM authentication tag prevents tampering
- **Storage**: Encrypted data is JSON-encoded and stored in database fields

#### Security Properties

1. **Authenticated Encryption**: Detects tampering with encrypted data
2. **Random IVs**: Same plaintext produces different ciphertext each time
3. **Key Derivation**: Strong password-based key derivation (or raw key support)
4. **No Native Dependencies**: Pure Node.js crypto, works on all platforms

#### Usage Modes

**Password Mode (Recommended)**:
```bash
DATABASE_ENCRYPTION_KEY=my-secure-password-123
DATABASE_ENCRYPTION_USE_KDF=true  # Default
```

**Raw Key Mode (Advanced)**:
```bash
# Generate a 32-byte hex key
DATABASE_ENCRYPTION_KEY=a1b2c3d4e5f6...  # 64 hex characters
DATABASE_ENCRYPTION_USE_KDF=false
```

#### Encrypted Fields

When encryption is enabled, the following sensitive fields are encrypted:
- Agent configuration data
- API keys and secrets
- Authentication tokens
- Custom sensitive metadata

#### Generating Secure Keys

```typescript
import { DatabaseEncryption } from '@recursive-manager/common';

// Generate a secure random key (for raw key mode)
const key = DatabaseEncryption.generateKey();
console.log(key);  // 64-character hex string
```

#### Performance Impact

- Encryption adds minimal overhead (<1ms per field)
- Suitable for production use
- No impact on database file size (encrypted data is Base64-encoded)

#### Migration

Encryption is transparent:
- Existing unencrypted data remains readable
- New data is encrypted when key is configured
- No migration needed to enable/disable encryption

### Access Control

File permissions are set restrictively:

```bash
chmod 700 ~/.recursive-manager/data/
chmod 600 ~/.recursive-manager/data/*
```

## Monitoring

Track database metrics:

- File size growth
- Query latency
- Write throughput
- Cache hit rate
- Lock contention

```bash
recursive-manager db-stats
```
