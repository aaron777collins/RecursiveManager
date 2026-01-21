# RecursiveManager - Complete Production Deployment Plan

**Created:** 2026-01-19
**Objective:** Transform RecursiveManager to 100% production-ready with ZERO issues, complete CI/CD via Jenkins, full deployment automation
**NO FUTURE WORK - EVERYTHING IMPLEMENTED**

---

## ⚠️ CRITICAL RULES

1. **NO AICEO Feature System** - All implementation done directly via code changes and git commits
2. **NO Placeholders** - Every feature fully implemented, no "TODO" or "Future work"
3. **100% Test Pass Rate** - All tests must pass before completion
4. **Full Jenkins CI/CD** - Replace GitHub Actions with self-hosted Jenkins
5. **Production Deployment** - Complete with monitoring, backups, documentation

---

## SUMMARY

This plan combines the best elements from both RALPH_PRODUCTION_READY_PLAN.md and PRODUCTION_READINESS_PLAN.md into a single comprehensive plan to make RecursiveManager 100% production-ready with NO shortcuts or "future work" items.

**Total Phases:** 12
**Estimated Effort:** 102-139 hours
**Target Version:** v1.0.0
**Target State:** Fully production-ready with complete CI/CD, monitoring, security, documentation

---

## EXECUTION INSTRUCTIONS FOR RALPH

Ralph, this plan is designed for you to implement step-by-step. Here are your instructions:

1. **Read EACH task carefully** before implementing
2. **Implement FULLY** - no placeholders, no "TODO" comments
3. **Test THOROUGHLY** after each change
4. **Commit frequently** with clear messages
5. **Update progress file** after completing each task
6. **Mark RALPH_DONE** when ALL phases complete

**IMPORTANT:** Do NOT use the AICEO feature system. Make direct code changes, commit to git, and track progress in the markdown file only.

---

## PHASE 1: FIX ALL TEST FAILURES (CRITICAL - P0)

### Current Status
- Total Tests: ~1734
- Passing: ~1695 (97.8%)
- Failing: ~39 tests
- Blocking: Core functionality, CLI commands

### Task 1.1: Fix Core Package Test Failures (31 tests)

**Files with failures:**
- packages/core/src/execution/__tests__/AgentLock.test.ts
- packages/core/src/tasks/__tests__/notifyCompletion.test.ts
- packages/core/src/__tests__/pauseAgent.test.ts
- packages/core/src/tasks/__tests__/notifyDeadlock.test.ts
- packages/core/src/tasks/__tests__/task-lifecycle-integration.test.ts
- packages/core/src/execution/__tests__/ExecutionPool.test.ts
- packages/core/src/execution/__tests__/concurrentExecutionPrevention.integration.test.ts
- packages/core/src/tasks/__tests__/createTaskDirectory.test.ts

**Root Causes:**
- Foreign key constraint violations in test setup
- Missing imports: initDatabase, allMigrations, runMigrations
- Type mismatches in ExecutionResult, DatabasePool, AdapterRegistry
- Missing await on Promise-returning functions
- Unused variable declarations

**Implementation Steps:**
1. Run full core test suite: `cd packages/core && npm test`
2. Fix missing imports from database module
3. Fix type mismatches in test mocks
4. Add missing await keywords
5. Fix foreign key issues (create parent records first)
6. Remove unused variables or prefix with underscore
7. Test each file individually
8. Run full core suite again

**Acceptance Criteria:**
- All 295 core tests passing
- No TypeScript compilation errors
- Test suite completes in <3 minutes

---

### Task 1.2: Fix CLI Package Test Failures (8 tests)

**Files:**
- packages/cli/src/__tests__/debug.integration.test.ts
- packages/cli/src/__tests__/config.integration.test.ts

**Root Cause:** CLI commands are stubs, not implemented

**Implementation:**

**1. Implement recursivemanager init**
- Create project directory structure
- Initialize database with migrations
- Create default agent configuration
- Set up logging directory
- Generate starter config file

**2. Implement recursivemanager config**
- config get <key> - Read value
- config set <key> <value> - Write value
- config list - Show all configuration
- config validate - Validate config

**3. Implement recursivemanager debug**
- Show system information
- Display database statistics
- Show recent error logs
- Export diagnostic bundle (JSON)

**4. Implement recursivemanager status**
- Check database connection
- List agents and states
- Show recent activity
- Display health metrics

**Acceptance Criteria:**
- All 115 CLI tests passing
- All 4 commands fully functional
- Help text accurate
- Error handling complete

---

### Task 1.3: Fix ESLint Errors (4 errors)

**Errors:**
1. packages/scheduler/src/__tests__/ScheduleManager.test.ts:26:5 - Unexpected await of non-Promise
2. packages/scheduler/src/daemon.ts:34:21 - Invalid type "unknown" in template literal
3. packages/scheduler/src/daemon.ts:34:44 - Invalid type "unknown" in template literal
4. packages/scheduler/src/daemon.ts:186:10 - Unexpected constant condition

**Fixes:**
1. Remove unnecessary await
2. Add type guard: ${(error as Error).message || String(error)}
3. Same as #2
4. Replace while (true) with signal-based loop

**Acceptance Criteria:**
- 0 ESLint errors
- npm run lint exits with code 0

---

### Task 1.4: Fix Adapter Integration Test (1 test)

**File:** packages/adapters/src/adapters/claude-code/__tests__/ClaudeCodeAdapter.integration.test.ts

**Issue:** Working directory validation too strict

**Implementation:**
1. Review security requirements
2. Adjust validation for parent directories OR subdirectories
3. Use path.relative() for safety
4. Document security rationale
5. Verify test passes

**Acceptance Criteria:**
- All 253 adapter tests passing
- Security validation still prevents path traversal

---

### Task 1.5: Fix Missing Jest Dependencies

**Error:** Cannot find module 'slash', missing jest-util, jest-haste-map

**Implementation:**
1. Clean all node_modules
2. Clear all lock files
3. Reinstall: npm install
4. Verify: npm list slash jest-util jest-haste-map
5. Add explicitly to devDependencies if needed

**Acceptance Criteria:**
- All Jest dependencies installed
- Tests run without module errors

---

## PHASE 2: IMPLEMENT ALL CLI COMMANDS (P0)

### Task 2.1: Implement recursivemanager hire

**Implementation:**
- Accept agent config via CLI flags or interactive prompt
- Validate config against schema
- Create agent record in database
- Initialize agent workspace
- Set initial status to "available"
- Return agent ID and confirmation
- Error handling for duplicates, invalid adapters

**File:** packages/cli/src/commands/hire.ts

---

### Task 2.2: Implement recursivemanager fire

**Implementation:**
- Accept agent ID or name
- Validate agent exists
- Check for active tasks (warn user)
- Delete agent record
- Clean up workspace (optional flag)
- Log termination
- Return confirmation

**File:** packages/cli/src/commands/fire.ts

---

### Task 2.3: Implement recursivemanager pause

**Implementation:**
- Accept agent ID or name
- Validate agent exists and is active
- Update status to "paused"
- Send pause signal to scheduler
- Log pause event with reason
- Return confirmation

**File:** packages/cli/src/commands/pause.ts

---

### Task 2.4: Implement recursivemanager resume

**Implementation:**
- Accept agent ID or name
- Validate agent exists and is paused
- Update status to "active"
- Send resume signal to scheduler
- Log resume event
- Return confirmation

**File:** packages/cli/src/commands/resume.ts

---

### Task 2.5: Implement recursivemanager list

**Implementation:**
- Fetch all agents from database
- Display in formatted table
- Support filtering: --status, --adapter
- Support sorting: --sort-by
- Support JSON output: --json

**File:** packages/cli/src/commands/list.ts

---

### Task 2.6: Implement recursivemanager logs

**Implementation:**
- Accept agent ID or name
- Read log files from workspace
- Support tail mode: --follow
- Support line limit: --lines
- Support filtering: --level
- Pretty-print with colors

**File:** packages/cli/src/commands/logs.ts

---

### Task 2.7: Implement recursivemanager schedule

**Implementation:**
- schedule add <agent-id> --cron "..." --task "..."
- schedule list
- schedule remove <schedule-id>
- schedule pause <schedule-id>
- schedule resume <schedule-id>
- Integrate with scheduler daemon
- Validate cron expressions

**File:** packages/cli/src/commands/schedule.ts

---

## PHASE 3: SCHEDULER INTEGRATION (P0)

### Task 3.1: Connect Pause/Resume to Scheduler Daemon

**Implementation:**
1. Create IPC mechanism (Unix socket or HTTP)
2. Add API endpoints in scheduler:
   - POST /agents/:id/pause
   - POST /agents/:id/resume
   - GET /agents/:id/status
3. Update CLI commands to call scheduler API
4. Add health check to CLI status
5. Handle scheduler not running gracefully

---

### Task 3.2: Add Schedule Persistence

**Implementation:**
1. Create schedules table:
   - id, agent_id, cron_expression, task_payload, enabled, created_at, updated_at
2. Load schedules on daemon startup
3. Save new schedules to database
4. Update database on pause/resume
5. Add database migration

---

### Task 3.3: Implement Scheduler Query Methods

**Implementation:**
- getActiveSchedules() - All enabled
- getSchedulesForAgent(agentId) - For specific agent
- getScheduleById(scheduleId) - Single schedule
- updateSchedule(scheduleId, updates) - Update
- deleteSchedule(scheduleId) - Delete

**File:** packages/scheduler/src/repository.ts

---

## PHASE 4: MULTI-PERSPECTIVE ANALYSIS (P0)

### Task 4.1: Design Sub-Agent Spawning System

**Implementation:**
1. Create SubAgentManager class
2. Design lifecycle: spawn, execute, collect, terminate
3. Define IPC protocol
4. Add resource limits (CPU, memory)
5. Add timeout handling (30s default)

**File:** packages/core/src/analysis/SubAgentManager.ts

---

### Task 4.2: Create 8 Perspective-Specific Prompts

**Perspectives:**
1. Security - Vulnerabilities, attacks, access control
2. Architecture - Patterns, scalability, maintainability
3. Simplicity - Clarity, complexity, readability
4. Financial - Cost, resources, efficiency
5. Marketing - User value, messaging, competitive advantage
6. UX - User experience, ergonomics, accessibility
7. Growth - Scalability, bottlenecks, expansion
8. Emotional - Team morale, user frustration, workflow joy

**File:** packages/core/src/analysis/perspectives.ts

---

### Task 4.3: Implement Synthesis Algorithm

**Implementation:**
1. Parse sub-agent responses
2. Identify common themes
3. Detect conflicts
4. Weight by task type
5. Generate summary:
   - Consensus items
   - Trade-offs
   - Recommendations
   - Action items (prioritized)

**File:** packages/core/src/analysis/synthesizer.ts

---

### Task 4.4: Integration & Testing

**Implementation:**
1. Integrate SubAgentManager into analysis command
2. Update CLI analyze command
3. Add progress indicator
4. Add retry logic
5. Write integration tests
6. Test various scenarios

---

## PHASE 5: DOCUMENTATION (P1)

### Task 5.1: Remove Unimplemented Features

**Remove from docs:**
- Slack integration (keep internal only)
- Telegram integration
- Email notifications
- OpenCode adapter

**Mark as "Roadmap"** in documentation

---

### Task 5.2: Align Documentation with Reality

**Implementation:**
1. Review all docs pages
2. Test every code example
3. Update feature list
4. Add missing documentation
5. Fix inaccuracies

---

### Task 5.3: Add Comprehensive API Documentation

**Implementation:**
1. Document all public APIs with TypeScript types
2. Add JSDoc comments to exports
3. Generate API reference (typedoc)
4. Add usage examples
5. Document error codes

---

### Task 5.4: Enable GitHub Pages

**Implementation:**
1. Go to Settings → Pages
2. Set Source to "GitHub Actions"
3. Verify docs workflow
4. Test site URL
5. Add docs badge to README

---

## PHASE 6: BUILD & CI/CD FIXES (P1)

### Task 6.1: Update Turbo to 2.x Config

**Fix:** turbo.json uses deprecated format

**Implementation:**
1. Update to 2.x format
2. Test build pipeline
3. Verify caching works

---

### Task 6.2: Fix TypeScript Path Resolution

**Implementation:**
1. Review tsconfig.json paths
2. Update build scripts
3. Test all package builds
4. Verify import paths work

---

### Task 6.3: Add CI Requirement to Release

**Implementation:**
1. Update .github/workflows/release.yml
2. Add dependency on CI workflow
3. Block releases if tests fail

---

### Task 6.4: Add NPM Publishing

**Implementation:**
1. Add npm publish step
2. Configure NPM authentication
3. Test publish (dry-run)
4. Add npm badge

---

## PHASE 7: JENKINS CI/CD SETUP (P0 - CRITICAL)

### Task 7.1: Install Java for Jenkins

**Implementation:**
1. Install OpenJDK 17: sudo apt install openjdk-17-jdk
2. Verify: java -version
3. Set JAVA_HOME
4. Add to /etc/environment

---

### Task 7.2: Install Jenkins

**Implementation:**
1. Add Jenkins repository key
2. Add Jenkins repository
3. Install: sudo apt install jenkins
4. Start: sudo systemctl start jenkins
5. Enable on boot
6. Get initial admin password
7. Complete setup wizard

---

### Task 7.3: Configure Caddy Reverse Proxy

**Implementation:**
1. Backup Caddyfile: cp /home/ubuntu/repos/webstack/Caddyfile /home/ubuntu/repos/webstack/Caddyfile.backup.$(date +%s)
2. Add jenkins subdomain:
   ```
   jenkins.aaroncollins.info {
       reverse_proxy localhost:8080
       encode gzip
   }
   ```
3. Reload Caddy
4. Verify HTTPS access
5. Test SSL certificate

---

### Task 7.4: Create Jenkins Folder in Webstack

**Implementation:**
1. Create directory structure:
   ```bash
   mkdir -p /home/ubuntu/repos/webstack/jenkins/{jobs,data}
   ```
2. Create docker-compose.yml
3. Integrate into main webstack
4. Document setup

---

### Task 7.5: Configure Jenkins for RecursiveManager

**Implementation:**
1. Install plugins: Git, NodeJS, Pipeline, GitHub
2. Add GitHub credentials
3. Configure NodeJS (18, 20, 22)
4. Set up environment variables

---

### Task 7.6: Create Jenkins Pipeline: CI

**Implementation:**
1. Create Jenkinsfile with stages:
   - Checkout
   - Install
   - Lint
   - Test
   - Build
2. Create pipeline job
3. Configure webhook
4. Test manually
5. Verify all stages pass

---

### Task 7.7: Create Jenkins Pipeline: Release

**Implementation:**
1. Create Jenkinsfile.release with stages:
   - Checkout
   - Version Bump
   - Install & Test
   - Build
   - Publish to NPM
   - Create Git Tag
   - GitHub Release
2. Configure NPM authentication
3. Test dry-run

---

### Task 7.8: Create Jenkins Pipeline: Deployment

**Implementation:**
1. Create Jenkinsfile.deploy with stages:
   - Build Docker Image
   - Push to Registry
   - Deploy
2. Configure deployment target
3. Test deployment
4. Add rollback capability

---

## PHASE 8: DOCKER & DEPLOYMENT (P1)

### Task 8.1: Create Production Dockerfile

**Implementation:**
1. Multi-stage Dockerfile
2. Alpine base for size
3. Health check endpoint
4. Environment variables
5. Test build

---

### Task 8.2: Create Docker Compose

**Implementation:**
1. docker-compose.yml (dev)
2. docker-compose.prod.yml (prod)
3. Database service config
4. Volume mounts
5. Environment config
6. Test full stack

---

### Task 8.3: Create Deployment Guide

**Implementation:**
1. Document prerequisites
2. Configuration steps
3. Troubleshooting
4. Common scenarios
5. Monitoring setup

---

## PHASE 9: MONITORING & OBSERVABILITY (P1)

### Task 9.1: Add Structured Logging

**Implementation:**
1. Replace console.log with winston/pino
2. Add log levels
3. Add request IDs
4. Configure log rotation
5. Add log aggregation setup

---

### Task 9.2: Add Metrics Collection

**Implementation:**
1. Add Prometheus endpoint
2. Track metrics:
   - Task execution time
   - Agent lifecycle events
   - DB query performance
   - API response times
   - Error rates
3. Create Grafana dashboard
4. Document metrics

---

### Task 9.3: Add Health Check Endpoint

**Implementation:**
1. Create /health endpoint
2. Check DB connectivity
3. Check scheduler status
4. Return service status
5. Integrate with monitoring

---

## PHASE 10: SECURITY HARDENING (P1)

### Task 10.1: Security Audit

**Implementation:**
1. Run npm audit, fix vulnerabilities
2. Review file operations for path traversal
3. Review DB queries for SQL injection
4. Add input validation
5. Review auth/authz
6. Document security considerations

---

### Task 10.2: Add Rate Limiting

**Implementation:**
1. Add rate limiting middleware
2. Configure per endpoint
3. Add rate limit headers
4. Log violations
5. Test functionality

---

### Task 10.3: Add Input Validation

**Implementation:**
1. Add schema validation (Zod/Joi)
2. Validate CLI arguments
3. Sanitize user inputs
4. Add validation errors
5. Test with malicious inputs

---

## PHASE 11: PRODUCTION RELEASE (P0)

### Task 11.1: Version Bump to v1.0.0

**Implementation:**
1. Update all package.json files
2. Update CHANGELOG
3. Review all documentation
4. Create git tag: git tag -a v1.0.0 -m "Production Release"

---

### Task 11.2: Create GitHub Release

**Implementation:**
1. Push tag: git push origin v1.0.0
2. Create release via gh CLI
3. Write comprehensive notes:
   - New features
   - Bug fixes
   - Breaking changes
   - Upgrade guide
4. Attach artifacts

---

### Task 11.3: Publish to NPM

**Implementation:**
1. Verify NPM account
2. Run npm publish (or via Jenkins)
3. Verify published
4. Test install: npm install -g recursivemanager
5. Update npm badge

---

### Task 11.4: Update Documentation Site

**Implementation:**
1. Deploy final docs to GitHub Pages
2. Add v1.0.0 version
3. Update homepage with announcement
4. Verify all links

---

### Task 11.5: Create Announcement

**Implementation:**
1. Write blog post/announcement
2. Share on platforms
3. Update project status badges
4. Notify stakeholders

---

## PHASE 12: POST-LAUNCH MONITORING (P2)

### Task 12.1: Monitor Error Rates

**Implementation:**
1. Set up error tracking (Sentry)
2. Monitor dashboards daily
3. Triage critical errors
4. Document known issues

---

### Task 12.2: Gather User Feedback

**Implementation:**
1. Create feedback channels
2. Monitor issue tracker
3. Respond to questions
4. Document FAQs

---

### Task 12.3: Plan v1.1.0

**Implementation:**
1. Review user feedback
2. Identify requested features
3. Create roadmap
4. Prioritize bug fixes vs features

---

## DEFINITION OF DONE

**Production-Ready means ALL of the following:**

- ✅ 100% test pass rate (all tests passing)
- ✅ 0 ESLint errors or warnings
- ✅ 0 TypeScript compilation errors
- ✅ All 10 CLI commands fully implemented
- ✅ Multi-perspective analysis fully functional
- ✅ Scheduler integration complete
- ✅ Documentation 100% accurate and deployed
- ✅ Jenkins CI/CD fully operational
- ✅ All 3 Jenkins pipelines working
- ✅ Docker deployment automated
- ✅ Security audit complete (0 critical/high)
- ✅ Monitoring implemented
- ✅ NPM package published
- ✅ GitHub release v1.0.0 created
- ✅ NO placeholder code
- ✅ NO "TODO" comments
- ✅ NO "future work" in docs

---

## EXECUTION CHECKLIST FOR RALPH

When you complete ALL tasks:

1. Mark final task as [x]
2. Run full test suite one last time
3. Verify all acceptance criteria met
4. Add "RALPH_DONE" marker to progress file
5. Create final commit: "Production release v1.0.0 - All phases complete"

---

**Ralph, you are authorized to proceed. Implement EVERYTHING. No shortcuts. No placeholders. Production-ready means production-ready.**
