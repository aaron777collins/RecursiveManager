# Creating Agents

::: warning Development Status
RecursiveManager is in active development. APIs and behaviors may change between releases.
:::

Learn how to create and hire agents in RecursiveManager, configure their roles and permissions, and build effective organizational hierarchies.

## Overview

Agents are the fundamental building blocks of RecursiveManager. Each agent has:
- A unique identity and role
- Specific goals and responsibilities
- Permissions and resource limits
- A position in the organizational hierarchy
- Their own workspace and configuration

## The hireAgent Function

The primary way to create agents is through the `hireAgent()` function, which orchestrates the complete agent hiring process.

### Function Signature

```typescript
import { hireAgent } from '@recursive-manager/core';

const agent = await hireAgent(
  db,           // Database connection
  managerId,    // Manager's ID (null for root agents)
  config,       // Complete agent configuration
  options       // Optional path configuration
);
```

### Parameters

- **db**: SQLite database connection from `better-sqlite3`
- **managerId**: The ID of the hiring manager
  - `null` for root agents (CEO)
  - Any valid agent ID for subordinates
- **config**: Complete `AgentConfig` object (see below)
- **options**: Optional `PathOptions` with `baseDir` for custom data directory

### Return Value

Returns an `AgentRecord` with database information:

```typescript
interface AgentRecord {
  id: string;              // Agent's unique ID
  role: string;            // Role/job title
  display_name: string;    // Human-readable name
  reporting_to: string | null;  // Manager ID
  status: 'active' | 'paused' | 'fired';
  main_goal: string;       // Primary objective
  created_at: Date;        // Creation timestamp
  created_by: string;      // Creator agent ID
  config_path: string;     // Path to config.json
}
```

## Agent Configuration Structure

The `AgentConfig` object defines the complete agent configuration. It consists of several sections:

### Identity Section (Required)

Defines who the agent is and where they fit in the hierarchy:

```typescript
interface AgentIdentity {
  id: string;              // Unique ID (pattern: ^[a-zA-Z0-9-_]+$)
  role: string;            // Job title (e.g., "Senior Developer")
  displayName: string;     // Human-readable name
  createdAt: string;       // ISO 8601 timestamp
  createdBy: string;       // ID of creating agent
  reportingTo: string | null;  // Manager's ID (null for root)
}
```

**Example:**

```typescript
identity: {
  id: 'cto-001',
  role: 'Chief Technology Officer',
  displayName: 'CTO',
  createdAt: new Date().toISOString(),
  createdBy: 'ceo-001',
  reportingTo: 'ceo-001'
}
```

### Goal Section (Required)

Defines what the agent is trying to achieve:

```typescript
interface AgentGoal {
  mainGoal: string;           // Primary objective
  subGoals: string[];         // Breakdown into smaller goals
  successCriteria: string[];  // Measurable success indicators
}
```

**Example:**

```typescript
goal: {
  mainGoal: 'Build and maintain the technology infrastructure',
  subGoals: [
    'Lead the development team',
    'Ensure system reliability',
    'Drive technical innovation'
  ],
  successCriteria: [
    '99.9% system uptime',
    'All features delivered on schedule',
    'Zero critical security vulnerabilities'
  ]
}
```

### Permissions Section (Required)

Controls what the agent is allowed to do:

```typescript
interface AgentPermissions {
  canHire: boolean;              // Can hire subordinates
  maxSubordinates: number;       // Maximum direct reports
  hiringBudget: number;          // Auto-approve subordinate hires
  canFire: boolean;              // Can fire subordinates
  canEscalate: boolean;          // Can escalate to manager
  canAccessExternalAPIs: boolean;
  allowedDomains: string[];      // API whitelist
  maxDelegationDepth: number;    // Max delegation nesting
  canSelfModify: boolean;        // Can modify own config
  workspaceQuotaMB: number;      // Storage quota
  maxExecutionMinutes: number;   // Runtime limit per execution
}
```

**Example for a Senior Manager:**

```typescript
permissions: {
  canHire: true,
  maxSubordinates: 10,
  hiringBudget: 3,           // Can hire 3 without approval
  canFire: true,
  canEscalate: true,
  canAccessExternalAPIs: false,
  allowedDomains: [],
  maxDelegationDepth: 3,
  canSelfModify: false,
  workspaceQuotaMB: 2048,    // 2 GB
  maxExecutionMinutes: 120   // 2 hours
}
```

**Example for a Junior Developer:**

```typescript
permissions: {
  canHire: false,
  maxSubordinates: 0,
  hiringBudget: 0,
  canFire: false,
  canEscalate: true,
  canAccessExternalAPIs: false,
  allowedDomains: [],
  maxDelegationDepth: 0,
  canSelfModify: false,
  workspaceQuotaMB: 512,     // 512 MB
  maxExecutionMinutes: 30    // 30 minutes
}
```

### Framework Section (Required)

Specifies the AI framework the agent uses:

```typescript
interface AgentFramework {
  primary: 'claude-code' | 'opencode';
  fallback?: 'claude-code' | 'opencode';
  capabilities: string[];
}
```

**Common capabilities:**
- `code-generation`
- `file-operations`
- `bash-execution`
- `web-search`
- `database-operations`

**Example:**

```typescript
framework: {
  primary: 'claude-code',
  fallback: 'opencode',
  capabilities: [
    'code-generation',
    'file-operations',
    'bash-execution'
  ]
}
```

### Communication Section (Optional)

Controls how the agent communicates:

```typescript
interface CommunicationChannels {
  preferredChannels: ('internal' | 'slack' | 'telegram' | 'email')[];
  notifyManager: {
    onTaskComplete: boolean;
    onError: boolean;
    onHire: boolean;
    onFire: boolean;
    onDeadlock: boolean;
    onEscalation: boolean;
  };
  updateFrequency: 'daily' | 'weekly' | 'on-completion' | 'never';
}
```

### Behavior Section (Optional)

Fine-tunes agent behavior:

```typescript
interface AgentBehavior {
  multiPerspectiveAnalysis: boolean;
  escalationPolicy: {
    autoEscalate: boolean;
    afterFailures: number;
    onBlockedTask: boolean;
    onBudgetExceeded: boolean;
  };
  delegation: {
    threshold: 'always' | 'complex-only' | 'never';
    keepWhenDelegating: boolean;
    supervisionLevel: 'none' | 'light' | 'detailed';
  };
}
```

### Metadata Section (Optional)

Additional categorization and custom data:

```typescript
interface AgentMetadata {
  tags: string[];              // Categorization
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;         // Purpose notes
  customData: Record<string, any>;  // Custom fields
}
```

## Creating Agents: Complete Examples

### Example 1: Creating a Root CEO Agent

```typescript
import { initializeDatabase } from '@recursive-manager/common';
import { hireAgent, generateDefaultConfig } from '@recursive-manager/core';

// Initialize database
const db = initializeDatabase('/path/to/.recursive-manager');

// Generate CEO configuration
const ceoConfig = generateDefaultConfig(
  'CEO',                          // role
  'Lead the organization',        // goal
  'system',                       // createdBy
  {
    id: 'ceo-001',
    displayName: 'Chief Executive Officer',
    reportingTo: null,            // No manager (root)
    canHire: true,
    maxSubordinates: 10,
    hiringBudget: 5,
    workspaceQuotaMB: 4096,
    maxExecutionMinutes: 180
  }
);

// Hire the CEO
const ceo = await hireAgent(db, null, ceoConfig);

console.log(`Created CEO: ${ceo.id}`);
// Output: Created CEO: ceo-001
```

### Example 2: Creating a Subordinate Agent

```typescript
// CTO reports to CEO
const ctoConfig = generateDefaultConfig(
  'Chief Technology Officer',
  'Build and maintain technology infrastructure',
  'ceo-001',                      // Created by CEO
  {
    id: 'cto-001',
    reportingTo: 'ceo-001',       // Reports to CEO
    canHire: true,
    maxSubordinates: 8,
    hiringBudget: 3,
    workspaceQuotaMB: 2048,
    maxExecutionMinutes: 120
  }
);

// Hire CTO (manager is CEO)
const cto = await hireAgent(db, 'ceo-001', ctoConfig);

console.log(`Created CTO: ${cto.id}, reporting to: ${cto.reporting_to}`);
// Output: Created CTO: cto-001, reporting to: ceo-001
```

### Example 3: Creating Multiple Team Members

```typescript
// Create a development team under the CTO
const teamMembers = [
  {
    role: 'Senior Backend Developer',
    goal: 'Build and maintain backend services',
    permissions: { canHire: false, maxExecutionMinutes: 60 }
  },
  {
    role: 'Senior Frontend Developer',
    goal: 'Build and maintain user interfaces',
    permissions: { canHire: false, maxExecutionMinutes: 60 }
  },
  {
    role: 'DevOps Engineer',
    goal: 'Maintain infrastructure and CI/CD',
    permissions: { canHire: false, maxExecutionMinutes: 90 }
  }
];

for (const member of teamMembers) {
  const config = generateDefaultConfig(
    member.role,
    member.goal,
    'cto-001',
    {
      reportingTo: 'cto-001',
      canHire: member.permissions.canHire,
      maxSubordinates: 0,
      hiringBudget: 0,
      maxExecutionMinutes: member.permissions.maxExecutionMinutes
    }
  );

  const agent = await hireAgent(db, 'cto-001', config);
  console.log(`Hired: ${agent.role} (${agent.id})`);
}
```

### Example 4: Custom Configuration (No Defaults)

For more control, build the configuration manually:

```typescript
const customConfig: AgentConfig = {
  $schema: 'https://recursivemanager.dev/schemas/agent-config.schema.json',
  version: '1.0.0',
  identity: {
    id: 'security-analyst-001',
    role: 'Security Analyst',
    displayName: 'Security Analyst',
    createdAt: new Date().toISOString(),
    createdBy: 'cto-001',
    reportingTo: 'cto-001'
  },
  goal: {
    mainGoal: 'Ensure system security and compliance',
    subGoals: [
      'Monitor security vulnerabilities',
      'Conduct security audits',
      'Respond to security incidents'
    ],
    successCriteria: [
      'Zero critical vulnerabilities in production',
      'All audits pass compliance checks',
      'Incident response time < 15 minutes'
    ]
  },
  permissions: {
    canHire: false,
    maxSubordinates: 0,
    hiringBudget: 0,
    canFire: false,
    canEscalate: true,
    canAccessExternalAPIs: true,
    allowedDomains: [
      'nvd.nist.gov',           // Vulnerability database
      'cve.mitre.org',          // CVE information
      'security.company.com'    // Internal security API
    ],
    maxDelegationDepth: 0,
    canSelfModify: false,
    workspaceQuotaMB: 1024,
    maxExecutionMinutes: 60
  },
  framework: {
    primary: 'claude-code',
    capabilities: [
      'code-generation',
      'file-operations',
      'bash-execution',
      'web-search'
    ]
  },
  communication: {
    preferredChannels: ['internal', 'slack'],
    notifyManager: {
      onTaskComplete: true,
      onError: true,
      onHire: false,
      onFire: false,
      onDeadlock: true,
      onEscalation: true
    },
    updateFrequency: 'on-completion'
  },
  behavior: {
    multiPerspectiveAnalysis: true,
    escalationPolicy: {
      autoEscalate: true,
      afterFailures: 2,
      onBlockedTask: true,
      onBudgetExceeded: false
    },
    delegation: {
      threshold: 'never',           // Never delegates
      keepWhenDelegating: false,
      supervisionLevel: 'none'
    }
  },
  metadata: {
    tags: ['security', 'compliance', 'monitoring'],
    priority: 'critical',
    description: 'Monitors and responds to security threats',
    customData: {
      alertChannel: '#security-alerts',
      oncallSchedule: 'https://oncall.company.com/security'
    }
  }
};

const securityAgent = await hireAgent(db, 'cto-001', customConfig);
```

## What Happens When You Hire an Agent

The `hireAgent()` function performs these operations automatically:

### 1. Validation (if manager exists)

- Checks hiring permissions
- Validates subordinate limits
- Checks hiring budget
- Detects circular reporting (cycle detection)
- Throws `HireValidationError` if validation fails

### 2. Filesystem Operations

Creates a complete directory structure:

```
~/.recursive-manager/agents/{agentId}/
├── tasks/
│   ├── active/
│   ├── completed/
│   └── archive/
├── inbox/
│   ├── unread/
│   └── read/
├── outbox/
│   ├── pending/
│   └── sent/
├── subordinates/
│   ├── reports/
│   └── registry.json
├── workspace/
│   ├── notes/
│   ├── research/
│   ├── drafts/
│   └── cache/
├── config.json
├── schedule.json
├── metadata.json
└── README.md
```

### 3. Database Operations

- Inserts agent record into `agents` table
- Updates `org_hierarchy` materialized view
- Creates audit log entry for HIRE action

### 4. Parent Updates (if manager exists)

- Updates manager's `subordinates/registry.json`
- Adds subordinate entry with hiring metadata
- Updates summary statistics (total subordinates, active count)

### 5. Snapshot Creation

- Creates database snapshot for rollback capability
- Snapshot reason: "Agent hired: {agentId} ({role})"
- Non-critical (failure doesn't prevent hiring)

## Configuration Files Created

### config.json

Stores the complete agent configuration (identity, goals, permissions, etc.).

### schedule.json

Default execution schedule:

```json
{
  "$schema": "https://recursivemanager.dev/schemas/schedule.schema.json",
  "version": "1.0.0",
  "mode": "hybrid",
  "continuous": {
    "enabled": true,
    "conditions": {
      "onlyWhenTasksPending": true,
      "minimumInterval": "5m",
      "pauseBetweenRuns": "1m"
    }
  },
  "timeBased": {
    "enabled": true,
    "triggers": []
  },
  "reactive": {
    "enabled": true,
    "triggers": []
  }
}
```

### metadata.json

Runtime metadata and statistics:

```json
{
  "runtime": {
    "status": "active",
    "lastExecutionAt": null,
    "lastExecutionDuration": 0,
    "lastExecutionType": null,
    "lastExecutionResult": null
  },
  "statistics": {
    "totalExecutions": 0,
    "successfulExecutions": 0,
    "failedExecutions": 0,
    "totalRuntimeMinutes": 0,
    "averageExecutionMinutes": 0,
    "tasksCompleted": 0,
    "tasksActive": 0,
    "messagesSent": 0,
    "messagesReceived": 0,
    "subordinatesHired": 0,
    "subordinatesFired": 0
  },
  "health": {
    "overallHealth": "unknown",
    "lastHealthCheck": null,
    "issues": [],
    "warnings": []
  },
  "budget": {
    "hiringBudget": {
      "initial": 3,
      "remaining": 3,
      "used": 0
    },
    "executionBudget": {
      "maxExecutionsPerDay": null,
      "usedToday": 0,
      "remainingToday": null
    },
    "resourceUsage": {
      "workspaceMB": 0,
      "quotaMB": 2048,
      "percentUsed": 0
    }
  }
}
```

### subordinates/registry.json

Tracks direct reports:

```json
{
  "subordinates": [],
  "summary": {
    "totalSubordinates": 0,
    "activeSubordinates": 0,
    "pausedSubordinates": 0,
    "firedSubordinates": 0,
    "hiringBudgetRemaining": 3
  }
}
```

## Using generateDefaultConfig()

The `generateDefaultConfig()` utility simplifies agent creation by generating sensible defaults:

```typescript
function generateDefaultConfig(
  role: string,              // Job title
  goal: string,              // Main objective
  createdBy: string,         // Creator agent ID
  options?: {
    id?: string;             // Custom ID (auto-generated if omitted)
    displayName?: string;    // Display name (defaults to role)
    reportingTo?: string | null;  // Manager ID (null for root)
    canHire?: boolean;       // Default: false
    maxSubordinates?: number;     // Default: 0
    hiringBudget?: number;        // Default: 0
    primaryFramework?: 'claude-code' | 'opencode';  // Default: claude-code
    workspaceQuotaMB?: number;    // Default: 1024
    maxExecutionMinutes?: number; // Default: 60
  }
): AgentConfig
```

**Default Values:**
- **id**: `{role-slug}-{timestamp}-{random}` (e.g., `senior-developer-1705123456789-a7b2`)
- **displayName**: Same as role
- **reportingTo**: `null` (root agent)
- **canHire**: `false`
- **maxSubordinates**: `0`
- **hiringBudget**: `0`
- **primaryFramework**: `claude-code`
- **workspaceQuotaMB**: `1024` (1 GB)
- **maxExecutionMinutes**: `60` (1 hour)

## Manager-Subordinate Relationships

### Direct Reporting

Every agent (except root) reports to exactly one manager:

```typescript
// Agent A reports to Agent B
agentA.identity.reportingTo === agentB.identity.id
```

### Hierarchical Depth

The `org_hierarchy` table tracks all ancestor relationships:

```typescript
interface OrgHierarchy {
  agent_id: string;        // Current agent
  ancestor_id: string;     // Any ancestor
  depth: number;           // 0=self, 1=manager, 2=grandparent
  path: string;            // "CEO/CTO/backend-dev-001"
}
```

### Subordinate Tracking

Managers maintain a registry of their direct reports in `subordinates/registry.json`:

```json
{
  "subordinates": [
    {
      "agentId": "backend-dev-001",
      "role": "Senior Backend Developer",
      "hiredAt": "2026-01-19T14:30:00Z",
      "hiredFor": "Build backend services",
      "status": "active",
      "lastReportAt": "2026-01-19T15:00:00Z",
      "healthStatus": "healthy",
      "tasksAssigned": 5,
      "tasksCompleted": 3,
      "firedAt": null,
      "firedReason": null
    }
  ],
  "summary": {
    "totalSubordinates": 1,
    "activeSubordinates": 1,
    "pausedSubordinates": 0,
    "firedSubordinates": 0,
    "hiringBudgetRemaining": 2
  }
}
```

## Error Handling

### Validation Errors

If hiring fails validation, a `HireValidationError` is thrown:

```typescript
try {
  await hireAgent(db, managerId, config);
} catch (error) {
  if (error.name === 'HireValidationError') {
    console.error('Hiring failed:', error.message);
    // Example messages:
    // - "Manager ceo-001 does not have permission to hire"
    // - "Manager has reached maximum subordinates limit (10)"
    // - "Circular reporting detected: cto-001 -> ceo-001 -> cto-001"
  }
}
```

### Common Validation Failures

1. **No hiring permission**: Manager's `canHire` is `false`
2. **Subordinate limit**: Manager has reached `maxSubordinates`
3. **Circular reporting**: Agent would report to itself (directly or indirectly)
4. **Manager not found**: Manager ID doesn't exist in database
5. **Manager not active**: Manager's status is not `active`

### Filesystem Errors

If directory creation fails, the operation is rolled back:

```typescript
try {
  await hireAgent(db, managerId, config);
} catch (error) {
  console.error('Filesystem error:', error.message);
  // Examples:
  // - "Permission denied: Cannot create directory"
  // - "Disk space insufficient"
  // - "Path already exists and is not a directory"
}
```

## Best Practices

### 1. Design Your Hierarchy First

Plan your organizational structure before creating agents:

```
CEO (Root)
├── CTO
│   ├── Backend Team Lead
│   │   ├── Senior Backend Dev 1
│   │   └── Senior Backend Dev 2
│   └── Frontend Team Lead
│       ├── Senior Frontend Dev 1
│       └── Senior Frontend Dev 2
└── CFO
    └── Accounting Manager
        ├── Accounts Payable Agent
        └── Accounts Receivable Agent
```

### 2. Use Meaningful Role Names

Good role names are:
- **Specific**: "Senior Backend Developer" not "Developer"
- **Descriptive**: "Security Compliance Analyst" not "Analyst"
- **Hierarchical**: Indicate level (Junior, Senior, Lead, Principal)

### 3. Set Appropriate Permissions

Match permissions to responsibility level:

**Executives (CEO, CTO, CFO):**
- `canHire: true`, `maxSubordinates: 10+`, `hiringBudget: 5+`
- High resource quotas
- Long execution times

**Managers:**
- `canHire: true`, `maxSubordinates: 5-8`, `hiringBudget: 2-3`
- Medium resource quotas
- Moderate execution times

**Individual Contributors:**
- `canHire: false`, `maxSubordinates: 0`, `hiringBudget: 0`
- Lower resource quotas
- Shorter execution times

### 4. Define Clear Goals

Good goals are SMART (Specific, Measurable, Achievable, Relevant, Time-bound):

```typescript
goal: {
  mainGoal: 'Implement user authentication system',
  subGoals: [
    'Design authentication architecture',
    'Implement OAuth 2.0 flow',
    'Add multi-factor authentication',
    'Write security tests'
  ],
  successCriteria: [
    'All authentication endpoints secured',
    'OAuth flow passes security audit',
    'MFA enrollment > 90%',
    'Test coverage > 95%'
  ]
}
```

### 5. Start Small, Scale Up

Begin with a simple hierarchy:

**Phase 1:** CEO only (root agent)
**Phase 2:** Add direct reports (CTO, CFO)
**Phase 3:** Add team leads under executives
**Phase 4:** Add individual contributors

### 6. Monitor Subordinate Limits

Check manager capacity before hiring:

```typescript
import { getSubordinates } from '@recursive-manager/common';

const subordinates = await getSubordinates(db, managerId);
const manager = await getAgent(db, managerId);

console.log(`Manager has ${subordinates.length} subordinates`);
console.log(`Maximum allowed: ${manager.maxSubordinates}`);
console.log(`Can hire: ${subordinates.length < manager.maxSubordinates}`);
```

### 7. Use Hiring Budget Wisely

The hiring budget allows autonomous hiring without approval:

```typescript
permissions: {
  hiringBudget: 3  // Can hire 3 subordinates autonomously
}
```

After budget is exhausted, additional hires require manager approval.

### 8. Leverage Configuration Schemas

Always validate configurations against the JSON schema:

```typescript
import Ajv from 'ajv';
import agentConfigSchema from '@recursive-manager/common/schemas/agent-config.schema.json';

const ajv = new Ajv();
const validate = ajv.compile(agentConfigSchema);

if (!validate(config)) {
  console.error('Invalid configuration:', validate.errors);
}
```

## Common Patterns

### Pattern 1: Team Creation

Create a complete team in one go:

```typescript
async function createDevelopmentTeam(db: Database, ctoId: string) {
  const teamStructure = {
    lead: {
      role: 'Backend Team Lead',
      goal: 'Lead backend development team',
      canHire: true,
      maxSubordinates: 5
    },
    members: [
      { role: 'Senior Backend Developer', goal: 'Build API services' },
      { role: 'Database Specialist', goal: 'Optimize database queries' },
      { role: 'DevOps Engineer', goal: 'Maintain CI/CD pipeline' }
    ]
  };

  // Create team lead
  const leadConfig = generateDefaultConfig(
    teamStructure.lead.role,
    teamStructure.lead.goal,
    ctoId,
    {
      reportingTo: ctoId,
      canHire: teamStructure.lead.canHire,
      maxSubordinates: teamStructure.lead.maxSubordinates
    }
  );
  const lead = await hireAgent(db, ctoId, leadConfig);

  // Create team members
  const members = [];
  for (const member of teamStructure.members) {
    const memberConfig = generateDefaultConfig(
      member.role,
      member.goal,
      lead.id,
      { reportingTo: lead.id }
    );
    const agent = await hireAgent(db, lead.id, memberConfig);
    members.push(agent);
  }

  return { lead, members };
}
```

### Pattern 2: Role-Based Configuration

Use templates for common roles:

```typescript
const roleTemplates = {
  'Senior Developer': {
    canHire: false,
    maxSubordinates: 0,
    workspaceQuotaMB: 1024,
    maxExecutionMinutes: 60,
    capabilities: ['code-generation', 'file-operations', 'bash-execution']
  },
  'Team Lead': {
    canHire: true,
    maxSubordinates: 5,
    workspaceQuotaMB: 2048,
    maxExecutionMinutes: 90,
    capabilities: ['code-generation', 'file-operations', 'bash-execution']
  },
  'Executive': {
    canHire: true,
    maxSubordinates: 10,
    workspaceQuotaMB: 4096,
    maxExecutionMinutes: 180,
    capabilities: ['code-generation', 'file-operations', 'bash-execution', 'web-search']
  }
};

function createAgentFromRole(
  roleType: keyof typeof roleTemplates,
  specificRole: string,
  goal: string,
  createdBy: string,
  reportingTo: string | null
) {
  const template = roleTemplates[roleType];
  return generateDefaultConfig(specificRole, goal, createdBy, {
    ...template,
    reportingTo
  });
}
```

### Pattern 3: Conditional Hiring

Check prerequisites before hiring:

```typescript
async function hireIfPossible(
  db: Database,
  managerId: string,
  config: AgentConfig
) {
  // Check if manager exists and is active
  const manager = await getAgent(db, managerId);
  if (!manager || manager.status !== 'active') {
    throw new Error('Manager not available for hiring');
  }

  // Check subordinate limit
  const subordinates = await getSubordinates(db, managerId);
  if (subordinates.length >= manager.maxSubordinates) {
    throw new Error('Manager has reached subordinate limit');
  }

  // Check hiring permission
  const managerConfig = await readAgentConfig(manager.config_path);
  if (!managerConfig.permissions.canHire) {
    throw new Error('Manager does not have hiring permission');
  }

  // All checks passed, proceed with hiring
  return await hireAgent(db, managerId, config);
}
```

## Related Resources

- [Core Concepts Guide](/guide/core-concepts) - Understanding the agent hierarchy
- [Task Management Guide](/guide/task-management) - How agents work with tasks
- [Agent Lifecycle Guide](/guide/agent-lifecycle) - Managing agent states
- [CLI Commands Reference](/api/cli-commands) - Using `recursive-manager init`
- [Core API Reference](/api/core) - Complete API documentation

## Next Steps

Now that you understand agent creation:

1. **Learn about task management**: How agents create and delegate tasks
2. **Explore the execution model**: How agents run and process work
3. **Study multi-perspective analysis**: How agents make better decisions
4. **Set up monitoring**: Track agent health and performance
