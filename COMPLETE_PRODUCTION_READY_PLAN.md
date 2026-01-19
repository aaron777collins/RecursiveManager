# Complete Production Ready Plan - RecursiveManager

**Goal**: Fix ALL remaining issues, complete ALL features, achieve 100% test pass rate, and make RecursiveManager truly production-ready.

## Phase 1: Fix ALL Test Failures (CRITICAL)

### 1.1 Core Package Test Fixes

**Priority**: CRITICAL - 95 failing tests blocking production

#### TypeScript Compilation Errors (19 files)

1. **task-lifecycle-integration.test.ts**
   - Remove unused `completeTask` import
   - File: `packages/core/src/tasks/__tests__/task-lifecycle-integration.test.ts`

2. **notifyDeadlock.test.ts**
   - Fix type: 'string | undefined' not assignable to 'string'
   - Add non-null assertion or optional chaining
   - File: `packages/core/src/tasks/__tests__/notifyDeadlock.test.ts`

3. **monitorDeadlocks.test.ts**
   - Fix typo: 'fallbacks' should be 'fallback'
   - File: `packages/core/src/tasks/__tests__/monitorDeadlocks.test.ts`

4. **completeTask.test.ts**
   - Fix function call: Expected 1 argument, got 2
   - File: `packages/core/src/tasks/__tests__/completeTask.test.ts`

5. **edge-cases-integration.test.ts**
   - Fix import: 'archiveTasks' should be 'archiveOldTasks'
   - File: `packages/core/src/tasks/__tests__/edge-cases-integration.test.ts`

6. **taskBlocking.test.ts**
   - Fix function call: Expected 1 argument, got 2
   - File: `packages/core/src/lifecycle/__tests__/taskBlocking.test.ts`

7. **messageWriter.test.ts**
   - Fix type: 'string | undefined' not assignable to 'string'
   - File: `packages/core/src/messaging/__tests__/messageWriter.test.ts`

8. **archiveTask.integration.test.ts**
   - Remove unused 'getCompletedTasks' import
   - File: `packages/core/src/tasks/__tests__/archiveTask.integration.test.ts`

9. **multiPerspectiveAnalysis.test.ts**
   - Remove unused 'Decision' import
   - File: `packages/core/src/execution/__tests__/multiPerspectiveAnalysis.test.ts`

10. **archiveTask.test.ts**
    - Fix import: Add type declaration file for '@recursive-manager/common/dist/db/migrations'
    - Or import from proper path
    - File: `packages/core/src/tasks/__tests__/archiveTask.test.ts`

11. **executeReactive.integration.test.ts**
    - Fix type cast: Invalid conversion to 'DatabasePool'
    - File: `packages/core/src/execution/__tests__/executeReactive.integration.test.ts`

12. **executeContinuous.integration.test.ts**
    - Remove unused 'agentId' variable
    - File: `packages/core/src/execution/__tests__/executeContinuous.integration.test.ts`

13. **loadAgentConfig.test.ts**
    - Fix: 'ConfigLoadError' used as type instead of value
    - File: `packages/core/src/__tests__/loadAgentConfig.test.ts`

14. **decisionSynthesis.test.ts**
    - Remove unused 'Decision' import
    - File: `packages/core/src/execution/__tests__/decisionSynthesis.test.ts`

15. **validateHire.test.ts**
    - Fix: 'valid' property doesn't exist on Promise
    - Add await or fix return type
    - File: `packages/core/src/__tests__/validateHire.test.ts`

16. **fireAgent.test.ts**
    - Remove unused 'getSubordinates' import
    - File: `packages/core/src/__tests__/fireAgent.test.ts`

#### Runtime Test Failures (7 files)

17. **ExecutionPool.test.ts** (3 failing tests)
    - Fix: "should not affect other tasks on error" - Uncaught error "fail"
    - Fix: "should reject all queued tasks" - Queue clearing errors
    - Fix: "should handle same agent multiple times" - waitFor timeout
    - File: `packages/core/src/execution/__tests__/ExecutionPool.test.ts`

18. **AgentLock.test.ts** (2 failing tests)
    - Fix: tryAcquire() returns {} instead of null
    - Fix implementation in `packages/core/src/execution/AgentLock.ts`
    - File: `packages/core/src/execution/__tests__/AgentLock.test.ts`

19. **pauseAgent.test.ts**
    - Fix: Multiple pause functionality failures
    - File: `packages/core/src/__tests__/pauseAgent.test.ts`

### 1.2 Common Package Test Fixes

20. **logger.test.ts**
    - Fix: "should properly escape special characters in JSON"
    - Error: SyntaxError: Unexpected end of JSON input at line 629
    - File: `packages/common/src/__tests__/logger.test.ts`

21. **Worker Process Exit**
    - Fix: Worker process fails to exit gracefully
    - Add proper cleanup in test teardown
    - File: Various test files in common package

### 1.3 CLI Package Test Fixes

22. **config.integration.test.ts** (3 TypeScript errors)
    - Remove unused 'Database' import
    - Remove unused 'allMigrations' import
    - Fix: Type 'null' not assignable to 'number | undefined' for process.exit mock
    - File: `packages/cli/src/__tests__/config.integration.test.ts`

23. **debug.ts** (8 TypeScript errors)
    - Remove unused imports: AgentRecord, TaskRecord
    - Add explicit type for parameter 't' on line 93
    - Add explicit type for parameter 'task' on line 155
    - Add explicit type for parameter 't' on lines 166, 167, 168, 169
    - File: `packages/cli/src/commands/debug.ts`

## Phase 2: Implement Missing CLI Commands (HIGH PRIORITY)

### 2.1 Core Agent Management Commands

24. **Hire Command**
    - File: `packages/cli/src/commands/hire.ts`
    - Function: Create subordinate agents
    - Required args: --role, --name, optional: --manager-id, --description, --config
    - Call: `hireAgent()` from core package
    - Validations: Manager exists, role valid, name unique
    - Output: New agent ID and success message
    - Test: Write integration test in `packages/cli/src/__tests__/hire.integration.test.ts`

25. **Fire Command**
    - File: `packages/cli/src/commands/fire.ts`
    - Function: Remove agents
    - Required args: <agent-id>
    - Flags: --force (skip confirmation), --reassign-to <manager-id>
    - Call: `fireAgent()` from core package
    - Validations: Agent exists, confirm if has subordinates
    - Output: Confirmation and cleanup summary
    - Test: Write integration test in `packages/cli/src/__tests__/fire.integration.test.ts`

26. **Message Command**
    - File: `packages/cli/src/commands/message.ts`
    - Function: Send message to agent
    - Required args: <agent-id>, <message-text>
    - Flags: --priority <level>, --wait-for-reply
    - Call: `sendMessage()` from core package
    - Validations: Agent exists, message not empty
    - Output: Message ID and delivery status
    - Test: Write integration test in `packages/cli/src/__tests__/message.integration.test.ts`

27. **Run Command**
    - File: `packages/cli/src/commands/run.ts`
    - Function: Manually trigger agent execution
    - Required args: <agent-id>
    - Flags: --mode <continuous|reactive>, --timeout <seconds>
    - Call: `executeAgent()` from core package
    - Validations: Agent exists, agent not paused
    - Output: Execution summary and results
    - Test: Write integration test in `packages/cli/src/__tests__/run.integration.test.ts`

28. **Logs Command**
    - File: `packages/cli/src/commands/logs.ts`
    - Function: View agent logs
    - Required args: <agent-id>
    - Flags: --tail <N>, --follow, --level <debug|info|warn|error>, --json
    - Read from: `$DATA_DIR/logs/<agent-id>.log`
    - Output: Formatted log entries
    - Test: Write integration test in `packages/cli/src/__tests__/logs.integration.test.ts`

29. **Assign Command**
    - File: `packages/cli/src/commands/assign.ts`
    - Function: Assign tasks to agents
    - Required args: <task-id>, <agent-id>
    - Flags: --priority <level>, --deadline <date>
    - Call: `assignTask()` from core package
    - Validations: Task exists, agent exists, agent can handle task
    - Output: Assignment confirmation
    - Test: Write integration test in `packages/cli/src/__tests__/assign.integration.test.ts`

30. **Pause Command**
    - File: `packages/cli/src/commands/pause.ts`
    - Function: Pause agent execution
    - Required args: <agent-id>
    - Flags: --recursive (pause subordinates too)
    - Call: `pauseAgent()` from core package
    - Validations: Agent exists, agent not already paused
    - Output: Pause confirmation
    - Test: Write integration test in `packages/cli/src/__tests__/pause.integration.test.ts`

31. **Resume Command**
    - File: `packages/cli/src/commands/resume.ts`
    - Function: Resume agent execution
    - Required args: <agent-id>
    - Flags: --recursive (resume subordinates too)
    - Call: `resumeAgent()` from core package
    - Validations: Agent exists, agent currently paused
    - Output: Resume confirmation
    - Test: Write integration test in `packages/cli/src/__tests__/resume.integration.test.ts`

### 2.2 Task Management Commands

32. **Tasks Command**
    - File: `packages/cli/src/commands/tasks.ts`
    - Function: View and manage tasks
    - Subcommands:
      - `tasks list [--agent <id>] [--status <status>]` - List tasks
      - `tasks create <title> [--agent <id>] [--description <text>]` - Create task
      - `tasks complete <task-id>` - Complete task
      - `tasks cancel <task-id>` - Cancel task
    - Calls: `getTasks()`, `createTask()`, `completeTask()`, `cancelTask()`
    - Output: Task table or individual task details
    - Test: Write integration test in `packages/cli/src/__tests__/tasks.integration.test.ts`

### 2.3 Backup/Restore Commands

33. **Export Command**
    - File: `packages/cli/src/commands/export.ts`
    - Function: Export system state to backup file
    - Optional args: [output-file]
    - Flags: --compress, --include-logs
    - Create tar.gz with:
      - Database file
      - Config files
      - Logs (if --include-logs)
    - Output: Backup file path and size
    - Test: Write integration test in `packages/cli/src/__tests__/export.integration.test.ts`

34. **Import Command**
    - File: `packages/cli/src/commands/import.ts`
    - Function: Restore system state from backup
    - Required args: <backup-file>
    - Flags: --force (skip confirmation), --clean (clear existing data first)
    - Validations: Backup file exists, valid format, compatible version
    - Output: Restore summary
    - Test: Write integration test in `packages/cli/src/__tests__/import.integration.test.ts`

## Phase 3: Database Snapshot System (HIGH PRIORITY)

35. **Create snapshot.ts Module**
    - File: `packages/common/src/db/snapshot.ts`
    - Functions:
      - `createSnapshot(db: Database, description?: string): Promise<SnapshotInfo>`
      - `listSnapshots(db: Database): Promise<SnapshotInfo[]>`
      - `restoreSnapshot(db: Database, snapshotId: string): Promise<void>`
      - `deleteSnapshot(snapshotId: string): Promise<void>`
      - `validateSnapshot(snapshotId: string): Promise<boolean>`
    - Use SQLite backup API: `db.backup(destPath)`
    - Storage: `$DATA_DIR/snapshots/<timestamp>-<description>.db`
    - Metadata: Store in snapshots table (new migration)

36. **Create Snapshots Table Migration**
    - File: `packages/common/src/db/migrations/009_snapshots_table.ts`
    - Schema:
      ```sql
      CREATE TABLE snapshots (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        description TEXT,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        agent_count INTEGER,
        task_count INTEGER,
        created_by_agent_id TEXT,
        FOREIGN KEY (created_by_agent_id) REFERENCES agents(id)
      );
      ```
    - Add to allMigrations in `packages/common/src/db/migrations/index.ts`

37. **Integrate Snapshots into hireAgent**
    - File: `packages/core/src/lifecycle/hireAgent.ts`
    - After successful hire, call `createSnapshot(db, `Hired agent ${newAgent.id}`)`
    - Add flag to skip snapshot: `skipSnapshot?: boolean` in options
    - Update test to handle snapshot creation

38. **Integrate Snapshots into fireAgent**
    - File: `packages/core/src/lifecycle/fireAgent.ts`
    - Before firing agent, call `createSnapshot(db, `Before firing agent ${agentId}`)`
    - Add flag to skip snapshot: `skipSnapshot?: boolean` in options
    - Update test to handle snapshot creation

39. **Rollback Command**
    - File: `packages/cli/src/commands/rollback.ts`
    - Function: Rollback database to previous snapshot
    - Subcommands:
      - `rollback list` - List available snapshots
      - `rollback to <snapshot-id>` - Restore specific snapshot
      - `rollback last` - Restore most recent snapshot
    - Flags: --force (skip confirmation), --backup (create backup before rollback)
    - Validations: Snapshot exists, valid snapshot file
    - Pre-rollback: Create safety backup of current state
    - Output: Rollback confirmation and summary
    - Test: Write integration test in `packages/cli/src/__tests__/rollback.integration.test.ts`

40. **Snapshot Validation Function**
    - In: `packages/common/src/db/snapshot.ts`
    - Function: `validateSnapshot(snapshotPath: string): Promise<boolean>`
    - Checks:
      - File exists and readable
      - Valid SQLite database format
      - Has expected tables
      - Schema version compatible
    - Return: true if valid, false otherwise

41. **Snapshot Cleanup**
    - In: `packages/common/src/db/snapshot.ts`
    - Function: `cleanupOldSnapshots(db: Database, keepCount: number = 10): Promise<number>`
    - Delete oldest snapshots, keeping most recent N
    - Called periodically or on demand
    - Test in `packages/common/src/db/__tests__/snapshot.test.ts`

## Phase 4: CLI Utilities (MEDIUM PRIORITY)

42. **Create paths.ts Utility**
    - File: `packages/cli/src/utils/paths.ts`
    - Functions:
      - `getInstallRoot(): string` - Get RecursiveManager install directory
      - `getDataDir(): string` - Get data directory path
      - `getConfigPath(): string` - Get config file path
      - `getLogsDir(): string` - Get logs directory path
      - `getSnapshotsDir(): string` - Get snapshots directory path
    - Use environment variables with fallbacks
    - Test in `packages/cli/src/utils/__tests__/paths.test.ts`

43. **Fix update.ts Path Resolution**
    - File: `packages/cli/src/commands/update.ts`
    - Replace hardcoded paths with `getInstallRoot()`
    - Use `path.join(getInstallRoot(), 'scripts', 'update.sh')`
    - Test update command actually works

44. **Add Prerequisite Checks to loadConfig**
    - File: `packages/cli/src/utils/config.ts`
    - In `loadConfig()`:
      - Check data directory exists, create if needed
      - Check database file accessible
      - Check logs directory writable
      - Check config file readable
    - Return helpful error messages if checks fail

45. **Config Edit with $EDITOR**
    - File: `packages/cli/src/commands/config.ts`
    - Add subcommand: `config edit`
    - Open config file in user's $EDITOR (default: vim/nano)
    - Validate config after editing
    - Reload if valid, show errors if invalid

## Phase 5: Documentation (MEDIUM PRIORITY)

### 5.1 Missing Guide Pages

46. **Quick Start Guide**
    - File: `docs/guide/quick-start.md`
    - Sections:
      - Installation (one-liner)
      - First run (`recursive-manager init`)
      - View status (`recursive-manager status`)
      - Hire first agent (`recursive-manager hire`)
      - Assign a task (`recursive-manager assign`)
      - Next steps
    - Screenshots/examples for each step

47. **Core Concepts Guide**
    - File: `docs/guide/core-concepts.md`
    - Sections:
      - Agent hierarchy (CEO, managers, workers)
      - Task delegation and blocking
      - Multi-perspective analysis (8 perspectives)
      - Decision synthesis
      - Agent lifecycle (hire, execute, pause, fire)
      - Execution modes (continuous vs reactive)

48. **Creating Agents Guide**
    - File: `docs/guide/creating-agents.md`
    - Sections:
      - Defining agent roles
      - Setting up manager relationships
      - Configuring agent capabilities
      - Agent config file format
      - Examples: Engineer, Designer, QA, DevOps agents

49. **Task Management Guide**
    - File: `docs/guide/task-management.md`
    - Sections:
      - Task lifecycle (pending, assigned, in_progress, completed)
      - Blocking tasks (dependencies)
      - Deadlock detection and resolution
      - Task priorities and deadlines
      - Archiving completed tasks

50. **Scheduling Guide**
    - File: `docs/guide/scheduling.md`
    - Sections:
      - Cron syntax for recurring tasks
      - Time-based triggers
      - Event-based triggers
      - Schedule management
      - Examples: Daily reports, hourly checks, weekly backups

51. **Messaging Guide**
    - File: `docs/guide/messaging.md`
    - Sections:
      - Inter-agent communication
      - Message types and priorities
      - Reply threads
      - Message queues
      - Adapter integration (Slack, Telegram, Email)

52. **Multi-Perspective Analysis Guide**
    - File: `docs/guide/multi-perspective.md`
    - Sections:
      - The 8 perspectives (Security, Architecture, Simplicity, Financial, Marketing, UX, Growth, Emotional)
      - How analysis works (parallel sub-agents)
      - Decision synthesis process
      - Configuration and customization
      - Examples of perspective output

### 5.2 Documentation Deployment

53. **Enable GitHub Pages**
    - Go to: https://github.com/aaron777collins/RecursiveManager/settings/pages
    - Source: GitHub Actions
    - Verify docs workflow succeeds
    - Test site at: https://aaron777collins.github.io/RecursiveManager

54. **Verify Documentation Build**
    - Run: `cd docs && npm run build`
    - Check dist folder created
    - Test locally: `npm run docs:preview`
    - Verify all pages render correctly

## Phase 6: Known Bugs (HIGH PRIORITY)

55. **Fix Backup Format Mismatch**
    - File: `packages/common/src/__tests__/file-lifecycle-integration.test.ts:14`
    - Bug: `createBackup()` format doesn't match `findLatestBackup()` pattern
    - Fix: Align timestamp format between the two functions
    - Ensure format: `YYYY-MM-DD-HH-mm-ss` used consistently
    - Test backup creation and recovery work together

56. **Fix AgentLock tryAcquire() Bug**
    - File: `packages/core/src/execution/AgentLock.ts`
    - Bug: Returns empty object `{}` instead of `null` when lock fails
    - Fix: Change return from `{}` to `null`
    - Update return type if needed
    - Verify test passes: `packages/core/src/execution/__tests__/AgentLock.test.ts`

57. **Fix ExecutionPool Timeout Bug**
    - File: `packages/core/src/execution/ExecutionPool.ts`
    - Bug: "waitFor timeout exceeded" when handling same agent multiple times
    - Fix: Improve queue management for concurrent executions
    - Add timeout handling
    - Verify test passes: `packages/core/src/execution/__tests__/ExecutionPool.test.ts`

## Phase 7: TODO Comments Resolution (MEDIUM PRIORITY)

58. **Implement Acting Agent ID Tracking**
    - Files:
      - `packages/common/src/db/queries/agents.ts:427`
      - `packages/common/src/db/queries/agents.ts:442`
    - Currently: `agentId: null, // TODO: Pass acting agent ID when available`
    - Fix: Add parameter `actingAgentId?: string` to functions
    - Pass actual agent ID when available from context
    - Update audit log to show which agent performed action

59. **Complete Scheduler Integration in pauseAgent**
    - File: `packages/core/src/lifecycle/pauseAgent.ts:424`
    - TODO: "When scheduler is implemented (Phase 3+), add logic to:"
    - Fix: Add scheduler pause integration
    - Pause scheduled tasks for paused agent
    - Update scheduler state

60. **Complete Scheduler Integration in resumeAgent**
    - File: `packages/core/src/lifecycle/resumeAgent.ts:413`
    - TODO: "When scheduler is implemented (Phase 4+), add logic to:"
    - Fix: Add scheduler resume integration
    - Resume scheduled tasks for resumed agent
    - Update scheduler state

61. **Implement Actual Sub-Agent Spawning for Perspectives**
    - File: `packages/core/src/execution/index.ts:392`
    - TODO: "Implement actual sub-agent spawning for perspectives"
    - Currently: Returns placeholder data
    - Fix: Actually spawn 8 sub-agents for multi-perspective analysis
    - Each sub-agent analyzes from their perspective
    - Collect and synthesize results
    - Return actual analysis instead of placeholder

62. **Remove Outdated debug.ts TODO**
    - File: `packages/cli/src/commands/debug.ts:30`
    - TODO: "Implement actual debug logic"
    - This is now implemented - remove the comment
    - The debug command is functional

## Phase 8: Placeholder Implementations (LOW PRIORITY)

63. **Implement Database Rebuild in file-recovery.ts**
    - File: `packages/common/src/file-recovery.ts` (lines 397, 452)
    - Placeholders: "Database rebuild for Phase 1.3+"
    - Implement: Rebuild database from backup files
    - Add schema migration if needed
    - Test recovery scenarios

64. **Replace Perspective Analysis Placeholder**
    - File: `packages/core/src/execution/index.ts:396`
    - Currently: Placeholder data structure
    - Integrate with actual multi-perspective analysis
    - Return real analysis results from sub-agents

## Phase 9: Security Hardening (HIGH PRIORITY)

### 9.1 Completed Security Fixes
- ✅ Path traversal protection
- ✅ Agent ID validation
- ✅ Command injection prevention
- ✅ Audit log immutability

### 9.2 Additional Security Fixes

65. **Implement Rate Limiting**
    - File: `packages/common/src/security/rate-limiter.ts`
    - Create rate limiter for API calls
    - Limit per agent, per command, per time window
    - Return 429 errors when exceeded
    - Test in `packages/common/src/security/__tests__/rate-limiter.test.ts`

66. **Add Comprehensive Input Sanitization**
    - File: `packages/common/src/security/sanitize.ts`
    - Functions:
      - `sanitizeAgentName(name: string): string`
      - `sanitizeRole(role: string): string`
      - `sanitizeTaskTitle(title: string): string`
      - `sanitizeMessage(message: string): string`
    - Remove/escape: SQL special chars, shell metacharacters, XSS vectors
    - Test in `packages/common/src/security/__tests__/sanitize.test.ts`

67. **Implement Secrets Management**
    - File: `packages/common/src/security/secrets.ts`
    - Functions:
      - `encryptSecret(secret: string, key: string): string`
      - `decryptSecret(encrypted: string, key: string): string`
      - `loadSecrets(): Promise<Record<string, string>>`
      - `saveSecret(key: string, value: string): Promise<void>`
    - Use crypto library for encryption
    - Store encrypted secrets in `$DATA_DIR/secrets.enc`
    - Never log or expose plaintext secrets

68. **Implement Role-Based Access Control (RBAC)**
    - File: `packages/common/src/security/rbac.ts`
    - Define roles: admin, manager, agent, viewer
    - Define permissions: hire, fire, read, write, execute
    - Functions:
      - `checkPermission(agentId: string, action: string): boolean`
      - `grantPermission(agentId: string, permission: string): void`
      - `revokePermission(agentId: string, permission: string): void`
    - Integrate into all commands
    - Test in `packages/common/src/security/__tests__/rbac.test.ts`

69. **SQL Injection Prevention Review**
    - Review ALL SQL queries in:
      - `packages/common/src/db/queries/*.ts`
    - Ensure parameterized queries used everywhere
    - No string concatenation in SQL
    - Add SQL injection tests in `packages/common/src/__tests__/sql-injection.test.ts`

70. **XSS Prevention in Logs/Output**
    - File: `packages/common/src/security/xss.ts`
    - Function: `escapeHTML(text: string): string`
    - Apply to ALL user-facing output:
      - Log messages
      - Task descriptions
      - Agent names
      - CLI output
    - Test in `packages/common/src/security/__tests__/xss.test.ts`

71. **Write Security Tests**
    - File: `packages/common/src/__tests__/security-suite.test.ts`
    - Test scenarios:
      - Path traversal attempts
      - Command injection attempts
      - SQL injection attempts
      - XSS attempts
      - Rate limit enforcement
      - RBAC permission checks
      - Secrets encryption/decryption

## Phase 10: Integration Tests (MEDIUM PRIORITY)

72. **Status Command Integration Test**
    - File: `packages/cli/src/__tests__/status.integration.test.ts`
    - Test: Initialize DB, hire agents, run status command
    - Verify: Output shows org chart correctly
    - Test flags: --json, --depth

73. **Debug Command Integration Test**
    - File: `packages/cli/src/__tests__/debug.integration.test.ts`
    - Test: Create agent with tasks, run debug command
    - Verify: Shows agent details, tasks, logs
    - Test flags: --logs, --json

74. **Rollback Command Integration Test**
    - File: `packages/cli/src/__tests__/rollback.integration.test.ts`
    - Test: Create snapshot, modify DB, rollback
    - Verify: DB restored to snapshot state
    - Test: Rollback validation

75. **Multi-Command Workflow Tests**
    - File: `packages/cli/src/__tests__/workflows.integration.test.ts`
    - Test scenarios:
      - Init → Hire → Assign → Status
      - Hire → Fire → Rollback
      - Export → Import → Verify
      - Message → Logs → Reply
    - Verify: Commands work together correctly

## Phase 11: GitHub Actions & CI/CD (HIGH PRIORITY)

76. **Add Branch Protection Rules**
    - Go to: https://github.com/aaron777collins/RecursiveManager/settings/branches
    - Protect: master branch
    - Rules:
      - Require pull request reviews (1 approval)
      - Require status checks to pass: lint, test, build
      - Require branches up to date before merging
      - Include administrators in restrictions

77. **Configure Required Status Checks**
    - In branch protection settings
    - Required checks:
      - Lint job must pass
      - Test job must pass (all packages)
      - Build job must pass
      - Test matrix (Node 18, 20, 22) must pass
    - Block merge if any check fails

78. **Ensure CI Passes**
    - After fixing all tests (Phase 1)
    - Verify CI workflow runs successfully
    - Check all jobs pass:
      - Lint: ✅
      - Test: ✅ (requires 100% test pass rate)
      - Build: ✅
      - Test matrix: ✅
    - Fix any remaining issues

79. **Set Up Automated Releases**
    - File: `.github/workflows/release.yml`
    - Trigger: On version tag push (e.g., v0.2.0)
    - Actions:
      - Run full test suite
      - Build all packages
      - Generate changelog from commits
      - Create GitHub release
      - Upload artifacts (install scripts, binaries)
      - Publish to npm (if applicable)

## Phase 12: Performance & Scalability (LOW PRIORITY)

80. **Test with 1000+ Agents**
    - File: `packages/core/src/__tests__/scalability.test.ts`
    - Create test with 1000 agents in hierarchy
    - Measure: Query performance, memory usage, execution time
    - Identify: Bottlenecks
    - Optimize: As needed

81. **Optimize Database Queries**
    - Review all queries in `packages/common/src/db/queries/*.ts`
    - Add indexes for:
      - agents.manager_id
      - tasks.assigned_to
      - tasks.status
      - messages.agent_id
      - audit_log.agent_id, audit_log.timestamp
    - Create migration: `010_performance_indexes.ts`

82. **Add Query Result Caching**
    - File: `packages/common/src/db/cache.ts`
    - Implement LRU cache for:
      - Agent lookups by ID
      - Org chart queries
      - Task counts
    - TTL: 60 seconds
    - Invalidate on mutations

83. **Add Connection Pooling**
    - File: `packages/common/src/db/pool.ts`
    - Implement connection pool for SQLite
    - Max connections: 10
    - Idle timeout: 30 seconds
    - Reuse connections across requests

## Phase 13: Final Polish (LOW PRIORITY)

84. **Add CLI Command Aliases**
    - File: `packages/cli/src/index.ts`
    - Aliases:
      - `st` → `status`
      - `ls` → `tasks list`
      - `rm` → `fire`
      - `msg` → `message`
    - Update help text to show aliases

85. **Add Interactive Mode**
    - File: `packages/cli/src/commands/interactive.ts`
    - Start REPL-style interactive shell
    - Auto-complete for commands and agent IDs
    - Command history
    - Use `inquirer` package for prompts

86. **Add Color-Coded Output**
    - Use `chalk` package for colored terminal output
    - Colors:
      - Success: green
      - Error: red
      - Warning: yellow
      - Info: blue
      - Agent names: cyan
      - Task status: color-coded by status
    - Add `--no-color` flag to disable

87. **Add Progress Bars**
    - Use `ora` or `cli-progress` package
    - Show progress for:
      - Long-running commands (export, import, rollback)
      - Multi-agent execution
      - Database migrations
    - Add `--quiet` flag to disable

88. **Add ASCII Art Banner**
    - File: `packages/cli/src/utils/banner.ts`
    - Display on `recursive-manager` without args
    - Show: Logo, version, quick help
    - Use `figlet` package for ASCII art

## Success Criteria

### Tests
- ✅ 100% test pass rate (0 failing tests)
- ✅ All TypeScript compilation errors fixed
- ✅ Test coverage >90% in all packages

### Features
- ✅ All 12 CLI commands implemented and tested
- ✅ Database snapshot/rollback system fully functional
- ✅ All TODO comments resolved or removed
- ✅ All known bugs fixed
- ✅ All placeholders replaced with real implementations

### Documentation
- ✅ All 7 guide pages written
- ✅ Documentation site deployed and accessible
- ✅ API documentation complete
- ✅ README updated with latest features

### Security
- ✅ All 6 additional security features implemented
- ✅ Security test suite passes
- ✅ No vulnerabilities in dependencies (`npm audit`)

### CI/CD
- ✅ All CI workflows passing
- ✅ Branch protection enabled
- ✅ Automated releases configured

### Performance
- ✅ Scales to 1000+ agents
- ✅ Database queries optimized
- ✅ Query caching implemented

### Polish
- ✅ CLI has color-coded output
- ✅ Progress bars for long operations
- ✅ Interactive mode available
- ✅ Command aliases work

## Timeline

- **Phase 1 (Tests)**: 2-3 days - CRITICAL
- **Phase 2 (CLI)**: 2-3 days - HIGH PRIORITY
- **Phase 3 (Snapshots)**: 1-2 days - HIGH PRIORITY
- **Phase 4 (Utilities)**: 1 day - MEDIUM
- **Phase 5 (Docs)**: 2 days - MEDIUM
- **Phase 6 (Bugs)**: 1 day - HIGH PRIORITY
- **Phase 7 (TODOs)**: 1 day - MEDIUM
- **Phase 8 (Placeholders)**: 1 day - LOW
- **Phase 9 (Security)**: 2-3 days - HIGH PRIORITY
- **Phase 10 (Integration)**: 1 day - MEDIUM
- **Phase 11 (CI/CD)**: 1 day - HIGH PRIORITY
- **Phase 12 (Performance)**: 2 days - LOW
- **Phase 13 (Polish)**: 1-2 days - LOW

**Total Estimated Time**: 19-26 days (~3-4 weeks)

## Notes

- Focus on CRITICAL and HIGH PRIORITY phases first
- Phases can be worked on in parallel by multiple developers
- Each phase should have its own git commits
- Run full test suite after each phase
- Update CHANGELOG.md after each phase
- Create release after all CRITICAL and HIGH PRIORITY phases complete
