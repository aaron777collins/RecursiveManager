#!/usr/bin/env node

/**
 * Generate GitHub Issues from COMPREHENSIVE_PLAN_PROGRESS.md
 *
 * This script parses the progress file and creates GitHub issues for all
 * uncompleted tasks. It respects dependencies and sets appropriate labels.
 *
 * Usage:
 *   node scripts/generate-issues.js [--dry-run]
 *
 * Prerequisites:
 *   - GitHub CLI (gh) installed and authenticated
 *   - Run from repository root
 */

const fs = require('fs');
const { execSync } = require('child_process');

const PROGRESS_FILE = './COMPREHENSIVE_PLAN_PROGRESS.md';
const DRY_RUN = process.argv.includes('--dry-run');

// Parse the progress file to extract tasks
function parseTasks() {
  const content = fs.readFileSync(PROGRESS_FILE, 'utf-8');
  const lines = content.split('\n');

  const tasks = [];
  let currentPhase = null;
  let currentSubphase = null;

  for (const line of lines) {
    // Match phase headers like "### PHASE 1: FOUNDATION & CORE INFRASTRUCTURE"
    const phaseMatch = line.match(/^### (PHASE \d+):\s*(.+)/);
    if (phaseMatch) {
      currentPhase = phaseMatch[1];
      continue;
    }

    // Match subphase headers like "#### Phase 1.1: Project Setup & Tooling (2-3 days)"
    const subphaseMatch = line.match(/^#### (Phase [\d.]+):\s*(.+?)(?:\s*\([\d-]+\s+days?\))?$/);
    if (subphaseMatch) {
      currentSubphase = {
        id: subphaseMatch[1],
        name: subphaseMatch[2]
      };
      continue;
    }

    // Match tasks like "- [ ] Task 1.1.1: Initialize monorepo structure"
    const taskMatch = line.match(/^- \[([ x])\] (Task [\d.]+):\s*(.+)/);
    if (taskMatch) {
      const completed = taskMatch[1] === 'x';
      const taskId = taskMatch[2];
      const description = taskMatch[3];

      tasks.push({
        id: taskId,
        description,
        completed,
        phase: currentPhase,
        subphase: currentSubphase?.id,
        subphaseName: currentSubphase?.name
      });
    }
  }

  return tasks;
}

// Generate GitHub issue body from task
function generateIssueBody(task) {
  const phaseLabel = task.subphase || task.phase;

  return `## Task Information

**Task ID**: ${task.id}
**Phase**: ${task.subphase ? `${task.subphase} - ${task.subphaseName}` : task.phase}
**Status**: ${task.completed ? 'Completed ✅' : 'Pending'}

## Description

${task.description}

## Planning References

- [COMPREHENSIVE_PLAN_PROGRESS.md](../COMPREHENSIVE_PLAN_PROGRESS.md) - Full task list
- [IMPLEMENTATION_PHASES.md](../IMPLEMENTATION_PHASES.md) - Phase details
- [COMPREHENSIVE_PLAN.md](../COMPREHENSIVE_PLAN.md) - Architecture overview

## Acceptance Criteria

- [ ] Implementation complete
- [ ] Tests written and passing (80%+ coverage)
- [ ] Linting passes
- [ ] TypeScript compiles without errors
- [ ] Documentation updated
- [ ] Task marked [x] in COMPREHENSIVE_PLAN_PROGRESS.md

## Completion Checklist

- [ ] Code implemented
- [ ] Unit tests written
- [ ] Integration tests written (if applicable)
- [ ] Edge cases handled
- [ ] Code review completed
- [ ] PR merged
- [ ] Progress file updated

---

*Auto-generated from COMPREHENSIVE_PLAN_PROGRESS.md*
`;
}

// Get phase label for GitHub
function getPhaseLabel(task) {
  if (task.subphase) {
    // Extract major phase number (e.g., "1" from "Phase 1.2")
    const match = task.subphase.match(/Phase (\d+)/);
    return match ? `phase-${match[1]}` : 'phase-unknown';
  }
  const match = task.phase?.match(/PHASE (\d+)/);
  return match ? `phase-${match[1]}` : 'phase-unknown';
}

// Create GitHub issue using gh CLI
function createIssue(task) {
  const title = `[${task.id}] ${task.description}`;
  const body = generateIssueBody(task);
  const labels = ['implementation', getPhaseLabel(task)];

  if (DRY_RUN) {
    console.log(`\n[DRY RUN] Would create issue:`);
    console.log(`Title: ${title}`);
    console.log(`Labels: ${labels.join(', ')}`);
    console.log(`---`);
    return;
  }

  try {
    // Create the issue using gh CLI
    const cmd = `gh issue create --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}" --label "${labels.join(',')}"`;
    const result = execSync(cmd, { encoding: 'utf-8' });
    console.log(`✅ Created: ${title}`);
    console.log(`   ${result.trim()}`);
  } catch (error) {
    console.error(`❌ Failed to create issue for ${task.id}:`, error.message);
  }
}

// Main execution
function main() {
  console.log('🔍 Parsing tasks from COMPREHENSIVE_PLAN_PROGRESS.md...\n');

  const tasks = parseTasks();
  const incompleteTasks = tasks.filter(t => !t.completed);

  console.log(`📊 Summary:`);
  console.log(`   Total tasks: ${tasks.length}`);
  console.log(`   Completed: ${tasks.filter(t => t.completed).length}`);
  console.log(`   Incomplete: ${incompleteTasks.length}\n`);

  if (DRY_RUN) {
    console.log('🏃 Running in DRY RUN mode (use without --dry-run to create issues)\n');
  }

  if (incompleteTasks.length === 0) {
    console.log('🎉 All tasks are complete! No issues to create.');
    return;
  }

  console.log(`📝 Creating ${incompleteTasks.length} GitHub issues...\n`);

  for (const task of incompleteTasks) {
    createIssue(task);
  }

  if (!DRY_RUN) {
    console.log('\n✅ Issue creation complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Visit your repository on GitHub');
    console.log('   2. Go to Issues tab');
    console.log('   3. Create a new Project board');
    console.log('   4. Add these issues to the project board');
    console.log('   5. Organize by phase labels');
  }
}

// Run the script
main();
