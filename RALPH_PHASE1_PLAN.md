# RALPH PLAN: RecursiveManager Phase 1 - Fix All Blockers

## Goal
Fix ALL blocking issues to make RecursiveManager professionally production-ready with 100% tests passing, all workflows green, and full functionality.

## Context
RecursiveManager is a TypeScript-based autonomous agent management system with 5 packages (core, common, cli, adapters, scheduler). Currently has:
- 30 failing tests in core package (TypeScript compilation errors)
- GitHub Actions documentation workflow failing
- CLI debug command is a placeholder
- Documentation deployment broken

## Constraints
- Must maintain backward compatibility
- All changes must have tests
- Must follow existing code patterns
- Security hardening must be maintained

## Success Criteria
1. ✅ 100% test pass rate across all packages
2. ✅ All GitHub Actions workflows passing
3. ✅ CLI debug command fully functional
4. ✅ Documentation deployed to GitHub Pages
5. ✅ Zero TypeScript compilation errors
6. ✅ All CLI commands tested

## Tasks

### TASK 1: Fix Core Package Test Failures
**Priority:** CRITICAL
**Estimated effort:** 2-3 hours

**Subtasks:**
1.1. Run tests and identify all TypeScript compilation errors
1.2. Fix missing imports (initDatabase, TASK_MAX_DEPTH, allMigrations)
1.3. Fix type mismatches (Promise handling, string | undefined)
1.4. Remove unused variable declarations
1.5. Add missing type declarations (tar module)
1.6. Verify all 295 tests pass
1.7. Run full test suite to ensure no regressions

**Files to modify:**
- packages/core/src/__tests__/*.test.ts (multiple test files)
- May need to update packages/core/src/*.ts (implementation files)

**Acceptance criteria:**
- Zero TypeScript compilation errors in core package
- All 295 core tests passing
- No regressions in other packages

### TASK 2: Fix GitHub Actions Documentation Workflow
**Priority:** CRITICAL
**Estimated effort:** 30 minutes

**Subtasks:**
2.1. Update .github/workflows/docs.yml to properly build VitePress
2.2. Ensure docs package builds successfully
2.3. Configure GitHub Pages deployment correctly
2.4. Test workflow runs successfully
2.5. Verify docs are accessible at GitHub Pages URL

**Files to modify:**
- .github/workflows/docs.yml
- May need to update packages/docs/package.json

**Acceptance criteria:**
- Documentation workflow passes in GitHub Actions
- Docs deployed to https://aaron777collins.github.io/RecursiveManager
- No build errors

### TASK 3: Implement CLI Debug Command
**Priority:** CRITICAL
**Estimated effort:** 4-5 hours

**Subtasks:**
3.1. Remove placeholder/mock implementation
3.2. Implement agent state loading from database
3.3. Implement task history display
3.4. Implement log file viewing
3.5. Add performance metrics display
3.6. Add dependency graph visualization (optional, can be Phase 2)
3.7. Write comprehensive tests
3.8. Update documentation

**Files to modify:**
- packages/cli/src/commands/debug.ts
- Create packages/cli/src/commands/__tests__/debug.integration.test.ts

**Acceptance criteria:**
- Debug command loads real agent data from database
- Shows agent state, tasks, logs correctly
- All tests passing
- Documentation updated with examples

### TASK 4: Fix CLI Config Reset Functionality
**Priority:** HIGH
**Estimated effort:** 1 hour

**Subtasks:**
4.1. Implement --reset flag functionality
4.2. Add user confirmation prompt
4.3. Reset configuration to defaults
4.4. Write tests for reset functionality

**Files to modify:**
- packages/cli/src/commands/config.ts
- packages/cli/src/commands/__tests__/config.integration.test.ts

**Acceptance criteria:**
- --reset flag works correctly
- Tests passing
- User confirmation required

### TASK 5: Add Missing CLI Tests
**Priority:** HIGH
**Estimated effort:** 2-3 hours

**Subtasks:**
5.1. Write tests for status command
5.2. Write tests for update command
5.3. Write tests for colors utility
5.4. Write tests for spinner utility
5.5. Write tests for prompts utility
5.6. Achieve >95% code coverage for CLI package

**Files to create:**
- packages/cli/src/commands/__tests__/status.integration.test.ts
- packages/cli/src/commands/__tests__/update.integration.test.ts
- packages/cli/src/utils/__tests__/colors.test.ts
- packages/cli/src/utils/__tests__/spinner.test.ts
- packages/cli/src/utils/__tests__/prompts.test.ts

**Acceptance criteria:**
- All new tests passing
- >95% code coverage in CLI package
- No test flakiness

### TASK 6: Fix Remaining CLI Commands Placeholders
**Priority:** MEDIUM (can move to Phase 2 if time constrained)
**Estimated effort:** 8-10 hours

**Subtasks:**
6.1. Implement `hire` command (create subordinate agents)
6.2. Implement `fire` command (remove agents)
6.3. Implement `assign` command (assign tasks)
6.4. Implement `pause` / `resume` commands
6.5. Implement `logs` command
6.6. Implement `tasks` command
6.7. Implement `export` / `import` commands
6.8. Write comprehensive tests for all commands
6.9. Update documentation

**Files to create:**
- packages/cli/src/commands/hire.ts
- packages/cli/src/commands/fire.ts
- packages/cli/src/commands/assign.ts
- packages/cli/src/commands/pause.ts
- packages/cli/src/commands/resume.ts
- packages/cli/src/commands/logs.ts
- packages/cli/src/commands/tasks.ts
- packages/cli/src/commands/export.ts
- packages/cli/src/commands/import.ts
- Corresponding test files

**Acceptance criteria:**
- All commands fully functional
- All tests passing
- Documentation complete with examples

### TASK 7: Verify and Fix CI Workflow
**Priority:** CRITICAL
**Estimated effort:** 30 minutes

**Subtasks:**
7.1. Run CI workflow locally
7.2. Fix any test failures
7.3. Ensure linting passes
7.4. Ensure TypeScript compilation passes
7.5. Push and verify GitHub Actions passes

**Files to check:**
- .github/workflows/ci.yml
- All package.json files

**Acceptance criteria:**
- CI workflow passes on GitHub Actions
- All checks green
- No failures

### TASK 8: Enable GitHub Pages
**Priority:** CRITICAL
**Estimated effort:** 10 minutes

**Subtasks:**
8.1. Go to repository Settings → Pages
8.2. Set Source to "GitHub Actions"
8.3. Verify docs deploy successfully
8.4. Update README with docs URL

**Files to modify:**
- README.md (add docs badge and link)

**Acceptance criteria:**
- GitHub Pages enabled
- Docs accessible at correct URL
- README updated

## Implementation Order
1. TASK 1 (Core tests) - Blocks everything else
2. TASK 7 (CI workflow) - Verify infrastructure works
3. TASK 2 (Docs workflow) - Critical for visibility
4. TASK 8 (Enable GitHub Pages) - Quick win
5. TASK 3 (Debug command) - Critical functionality
6. TASK 4 (Config reset) - Quick win
7. TASK 5 (CLI tests) - Quality improvement
8. TASK 6 (CLI commands) - Optional for Phase 1, can defer to Phase 2

## Verification Steps
After completing all tasks:
1. Run `npm test` - Verify 100% pass rate
2. Run `npm run build` - Verify clean build
3. Run `npm run lint` - Verify no linting errors
4. Check GitHub Actions - Verify all workflows green
5. Visit docs URL - Verify documentation accessible
6. Manual CLI testing - Verify all commands work
7. Security scan - Verify no new vulnerabilities

## Rollback Plan
If any task causes regressions:
1. Revert the commit
2. Create an issue documenting the problem
3. Implement fix in a separate branch
4. Test thoroughly before merging

## Notes
- Focus on CRITICAL priority tasks first
- TASK 6 can be moved to Phase 2 if time-constrained
- All changes must maintain backward compatibility
- Security fixes must not be compromised

## Estimated Total Time
- Critical tasks: 7-9 hours
- High priority tasks: 3-4 hours
- Medium priority tasks: 8-10 hours
- **Total for Phase 1 (critical + high only): 10-13 hours**
- **Total if including medium: 18-23 hours**
