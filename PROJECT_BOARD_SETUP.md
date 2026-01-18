# Project Board Setup Guide

This document describes how to set up and use GitHub Projects to track the implementation of RecursiveManager.

## Overview

RecursiveManager has **209+ implementation tasks** spread across 10 phases. We use GitHub Projects (the new project boards) to track progress, dependencies, and completion.

## Quick Start

### Option 1: Auto-Generate Issues (Recommended)

Use the provided script to automatically create GitHub issues for all uncompleted tasks:

```bash
# Dry run to preview what will be created
node scripts/generate-issues.js --dry-run

# Create all issues
node scripts/generate-issues.js
```

**Prerequisites**:
- GitHub CLI (`gh`) installed and authenticated
- Run from repository root

### Option 2: Manual Issue Creation

Use the issue templates in `.github/ISSUE_TEMPLATE/` to manually create issues as you work.

## Setting Up GitHub Projects

### Step 1: Create a New Project

1. Go to your repository on GitHub
2. Click the **Projects** tab
3. Click **New Project**
4. Choose **Board** or **Table** layout (Board recommended for phase-based workflow)
5. Name it: **RecursiveManager Implementation**

### Step 2: Configure Project Views

#### View 1: By Phase (Board Layout)

**Columns**:
- 📋 **Backlog** - Not started
- 🏗️ **Phase 0** - Pre-implementation
- 🏗️ **Phase 1** - Foundation
- 🏗️ **Phase 2** - Core Agent System
- 🏗️ **Phase 3** - Execution Engine
- 🏗️ **Phase 4-10** - Remaining phases
- ✅ **Done** - Completed tasks

**Filters**:
- Group by: `label:phase-*`
- Sort by: Task ID (use custom field)

#### View 2: Current Sprint (Table Layout)

**Columns**:
- Task ID
- Title
- Status (Todo, In Progress, In Review, Done)
- Phase
- Assignee
- Priority
- Estimated Effort
- Dependencies

**Filters**:
- Status: In Progress OR Todo
- Sort by: Priority, then Task ID

#### View 3: Dependency Graph

**Purpose**: Visualize task dependencies to avoid blockers

**Setup**:
- Use GitHub's built-in task lists in issue descriptions
- Link related issues using "Depends on #123" syntax
- Enable dependency tracking in project settings

### Step 3: Add Custom Fields

Add these custom fields to track additional metadata:

1. **Task ID** (Text)
   - Example: "Task 1.1.1"
   - Use for sorting and reference

2. **Phase** (Single Select)
   - Options: Phase 0, Phase 1.1, Phase 1.2, Phase 1.3, Phase 1.4, Phase 2.1, etc.

3. **Priority** (Single Select)
   - Options: Critical, High, Medium, Low

4. **Estimated Effort** (Number)
   - Unit: Days
   - Helps with sprint planning

5. **Dependencies** (Text)
   - List task IDs this depends on
   - Example: "Task 1.1.1, Task 1.1.2"

6. **Test Coverage** (Number)
   - Percentage: 0-100
   - Track test coverage per task

### Step 4: Add Labels

Create these labels in your repository:

**Phase Labels**:
- `phase-0` - Pre-implementation
- `phase-1` - Foundation & Core Infrastructure
- `phase-2` - Core Agent System
- `phase-3` - Execution Engine
- `phase-4` - Scheduling & Triggers
- `phase-5` - Messaging Integration
- `phase-6` - CLI & User Experience
- `phase-7` - Observability & Debugging
- `phase-8` - Security & Resilience
- `phase-9` - OpenCode Adapter
- `phase-10` - Documentation & Examples

**Type Labels**:
- `implementation` - Implementation task
- `bug` - Bug fix
- `enhancement` - Feature enhancement
- `documentation` - Documentation work
- `testing` - Testing task

**Priority Labels**:
- `priority-critical` - Blocking or critical
- `priority-high` - High priority
- `priority-medium` - Medium priority
- `priority-low` - Low priority

**Status Labels** (optional, can use project status instead):
- `status-todo` - Not started
- `status-in-progress` - Work in progress
- `status-in-review` - In code review
- `status-blocked` - Blocked by dependencies

### Step 5: Create Milestones

Create milestones for each major phase:

1. **Phase 0: Pre-Implementation** (Due: Before starting Phase 1)
2. **Phase 1: Foundation** (Due: TBD)
   - Milestone 1.1: Project Setup
   - Milestone 1.2: File System Layer
   - Milestone 1.3: Database Layer
   - Milestone 1.4: Logging & Audit
3. **Phase 2: Core Agent System** (Due: TBD)
4. **Phase 3: Execution Engine** (Due: TBD)
5. **Phases 4-10: Remaining Features** (Due: TBD)

## Workflow

### Daily Workflow

1. **Morning**: Check project board for your assigned tasks
2. **Select Task**: Pick highest-priority task from "Todo" column
3. **Verify Dependencies**: Ensure all dependency tasks are completed
4. **Move to In Progress**: Update status on project board
5. **Implement**: Follow task acceptance criteria
6. **Update Progress**: Add comments with progress notes
7. **Create PR**: When complete, link PR to issue
8. **Code Review**: Request review, address feedback
9. **Mark Complete**: Move to "Done" when PR is merged
10. **Update Progress File**: Mark task as [x] in COMPREHENSIVE_PLAN_PROGRESS.md

### Working with Dependencies

**Before starting a task**:
1. Check the task description for "Dependencies" section
2. Verify all dependency tasks are marked as complete
3. If blocked, add `status-blocked` label and comment

**Creating new dependencies**:
1. Use "Depends on #123" in issue description
2. GitHub will automatically track dependency
3. Update custom "Dependencies" field with Task IDs

### Creating New Issues

**For planned tasks** (from COMPREHENSIVE_PLAN_PROGRESS.md):
- Use `generate-issues.js` script
- Or use "Implementation Task" template manually

**For bugs**:
- Use "Bug Report" template
- Link to related implementation task if applicable
- Add `bug` label and appropriate phase label

**For features/enhancements**:
- Use "Feature Request" template
- Discuss in issue before implementing
- May require multi-perspective analysis for major features

## Best Practices

### 1. Keep Issues Focused

- One task = One issue
- Break down large tasks into subtasks
- Use task lists within issues for multi-step tasks

### 2. Link Everything

- Link issues to related issues using keywords:
  - "Depends on #123"
  - "Blocks #456"
  - "Related to #789"
- Link PRs to issues using "Closes #123" or "Fixes #123"
- Reference planning documents in issue descriptions

### 3. Update Regularly

- Add comments with progress updates
- Update custom fields (especially Estimated Effort and Test Coverage)
- Move cards on project board as status changes
- Keep COMPREHENSIVE_PLAN_PROGRESS.md in sync

### 4. Use Automation

GitHub Projects supports automation. Configure these rules:

**Auto-move cards**:
- Issue opened → Move to "Todo"
- Issue assigned → Move to "In Progress"
- PR opened + linked → Move to "In Review"
- PR merged → Move to "Done"
- Issue closed → Move to "Done"

**Auto-assign**:
- When issue moved to "In Progress" → Assign to mover
- When PR created → Assign to PR author

### 5. Track Quality

For each task, ensure:
- [ ] Tests written (80%+ coverage)
- [ ] Linting passes
- [ ] TypeScript compiles
- [ ] Documentation updated
- [ ] Code review completed
- [ ] Edge cases handled

Use the completion checklist in each issue.

## Monitoring Progress

### Weekly Review

Every week, review:
1. **Velocity**: How many tasks completed this week?
2. **Blockers**: Any tasks stuck or blocked?
3. **Dependencies**: Are we creating bottlenecks?
4. **Quality**: Test coverage and code quality metrics
5. **Burndown**: Are we on track for phase completion?

### Phase Completion

Before marking a phase complete:
1. ✅ All tasks in phase marked [x]
2. ✅ All tests passing (80%+ coverage)
3. ✅ All PRs merged
4. ✅ Documentation complete
5. ✅ Phase completion criteria met (see IMPLEMENTATION_PHASES.md)
6. ✅ COMPREHENSIVE_PLAN_PROGRESS.md updated

### Metrics to Track

- **Task Completion Rate**: Tasks completed per week
- **Test Coverage**: Overall and per-phase coverage
- **Bug Rate**: Bugs found per phase
- **Cycle Time**: Time from task start to completion
- **Blocked Time**: Time tasks spend blocked

## Tools Integration

### GitHub CLI

Use `gh` CLI for quick operations:

```bash
# List issues by phase
gh issue list --label "phase-1"

# Create issue from template
gh issue create --template implementation-task.md

# View project board
gh project list
gh project view <number>

# Add issue to project
gh project item-add <project-number> --owner <owner> --url <issue-url>
```

### VS Code Integration

Use GitHub Pull Requests extension:
- View and manage issues from VS Code
- Link issues to PRs automatically
- Update project board status

### Automation Scripts

Additional scripts in `scripts/`:
- `generate-issues.js` - Auto-create issues from progress file
- Future: `update-progress.js` - Sync project board to progress file
- Future: `check-dependencies.js` - Verify dependency completion

## Troubleshooting

### Issue: Too Many Issues

**Solution**: Use filters and views
- Create view filtered by current phase
- Hide completed issues
- Focus on "In Progress" and "Todo"

### Issue: Dependencies Unclear

**Solution**: Update issue descriptions
- Add explicit "Depends on" sections
- Use GitHub's dependency tracking
- Create dependency graph view

### Issue: Progress File Out of Sync

**Solution**: Regular synchronization
- Update progress file when closing issues
- Run automated sync script (when available)
- Weekly manual review

## Resources

- [GitHub Projects Documentation](https://docs.github.com/en/issues/planning-and-tracking-with-projects)
- [COMPREHENSIVE_PLAN.md](./COMPREHENSIVE_PLAN.md) - Full system architecture
- [IMPLEMENTATION_PHASES.md](./IMPLEMENTATION_PHASES.md) - Detailed phase breakdown
- [COMPREHENSIVE_PLAN_PROGRESS.md](./COMPREHENSIVE_PLAN_PROGRESS.md) - Current progress

## Next Steps

1. ✅ Read this guide
2. ⬜ Install GitHub CLI (`gh`)
3. ⬜ Authenticate with `gh auth login`
4. ⬜ Run `node scripts/generate-issues.js --dry-run` to preview
5. ⬜ Run `node scripts/generate-issues.js` to create issues
6. ⬜ Create new GitHub Project board
7. ⬜ Configure views, fields, and labels
8. ⬜ Add all issues to project
9. ⬜ Set up automation rules
10. ⬜ Start working through Phase 1.1 tasks!

---

**Last Updated**: 2026-01-18
**Status**: Ready for use
