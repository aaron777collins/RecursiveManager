# Scripts Directory

This directory contains automation scripts for managing the RecursiveManager project.

## Available Scripts

### `generate-issues.js`

Auto-generates GitHub issues from the task list in COMPREHENSIVE_PLAN_PROGRESS.md.

**Usage:**
```bash
# Preview what will be created (dry run)
node scripts/generate-issues.js --dry-run

# Create all issues
node scripts/generate-issues.js
```

**Prerequisites:**
- Node.js 18+
- GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
- Run from repository root

**What it does:**
- Parses COMPREHENSIVE_PLAN_PROGRESS.md
- Extracts all uncompleted tasks (marked with `[ ]`)
- Creates GitHub issues with:
  - Proper title: `[Task X.Y.Z] Description`
  - Full description with planning references
  - Labels: `implementation`, `phase-X`
  - Acceptance criteria checklist

**Output:**
- Summary of tasks found
- List of issues created with URLs
- Next steps for setting up project board

### `create-labels.sh`

Creates all GitHub labels needed for project tracking.

**Usage:**
```bash
./scripts/create-labels.sh
```

**Prerequisites:**
- GitHub CLI (`gh`) installed and authenticated
- Run from repository root

**What it does:**
- Creates phase labels (phase-0 through phase-10)
- Creates type labels (implementation, bug, enhancement, documentation, testing)
- Creates priority labels (critical, high, medium, low)
- Creates status labels (blocked, needs-review, needs-testing)
- Creates special labels (edge-case, multi-perspective, breaking-change, etc.)

**Note:** Script is idempotent - safe to run multiple times.

## Quick Start

To set up project tracking from scratch:

```bash
# 1. Create labels
./scripts/create-labels.sh

# 2. Preview issues that will be created
node scripts/generate-issues.js --dry-run

# 3. Create issues
node scripts/generate-issues.js

# 4. Set up GitHub Project board (see PROJECT_BOARD_SETUP.md)
```

## Future Scripts

These scripts are planned for future implementation:

### `update-progress.js` (Planned)
Sync GitHub project board status back to COMPREHENSIVE_PLAN_PROGRESS.md

### `check-dependencies.js` (Planned)
Verify all task dependencies are completed before allowing task to start

### `generate-phase-report.js` (Planned)
Generate completion report for a phase with metrics and stats

### `sync-milestones.js` (Planned)
Auto-create GitHub milestones from phase definitions

## Troubleshooting

### GitHub CLI Authentication

If you get authentication errors:
```bash
gh auth login
# Follow the prompts to authenticate
```

### Permission Errors

If you get permission errors:
```bash
# Check you have write access to the repository
gh repo view

# Verify you're authenticated
gh auth status
```

### Script Errors

If scripts fail:
```bash
# Make sure you're in the repository root
cd /path/to/RecursiveManager

# Make sure scripts are executable
chmod +x scripts/*.sh

# Check Node.js version (should be 18+)
node --version
```

## Contributing

When adding new scripts:
1. Add them to this directory
2. Make them executable (`chmod +x`)
3. Add usage documentation to this README
4. Include error handling and dry-run options where applicable
5. Follow existing naming conventions

## Resources

- [GitHub CLI Documentation](https://cli.github.com/manual/)
- [PROJECT_BOARD_SETUP.md](../PROJECT_BOARD_SETUP.md) - Project board guide
- [COMPREHENSIVE_PLAN_PROGRESS.md](../COMPREHENSIVE_PLAN_PROGRESS.md) - Task list

---

**Last Updated**: 2026-01-18
