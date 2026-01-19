# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-01-19

### Added
- **Core System**
  - Hierarchical AI agent orchestration system with recursive management capabilities
  - Complete TypeScript monorepo structure with 5 packages (core, common, cli, adapters, scheduler)
  - SQLite database with comprehensive migrations for agents, tasks, messages, schedules, audit logs, and org hierarchy
  - Agent lifecycle management (hire, pause, resume, fire) with validation and business logic
  - Task management with dependency tracking, deadline support, and parent-child relationships
  - Message passing system for inter-agent communication
  - Multi-perspective analysis (Security, Architecture, Simplicity, Financial, Marketing, UX, Growth, Emotional)
  - Decision synthesis framework
  - Execution orchestration with concurrency control and adapter fallback
  - Agent locking mechanisms using async-mutex
  - ExecutionPool with worker pool pattern
  - PID file management for process tracking

- **Security Features**
  - Path traversal protection in all file operations
  - Agent ID format validation (alphanumeric + hyphens, 2-64 chars)
  - Command injection prevention in Claude Code adapter
  - Audit log immutability triggers (prevents UPDATE/DELETE after creation)
  - Foreign key constraints with proper null handling for system operations
  - Comprehensive input validation across all APIs

- **Framework Adapters**
  - Claude Code adapter with timeout handling, health checks, and JSON result parsing
  - Adapter registry with primary/fallback support
  - Execution context validation and prompt building
  - Extensible adapter system for future framework integrations

- **Scheduler**
  - Cron-based scheduling with timezone support
  - Schedule enable/disable functionality
  - Next execution time calculation
  - Daily archival job registration

- **CLI & Tools**
  - Modular CLI with colored output and organization chart visualization
  - Installation script (install.sh) with one-liner support
  - Uninstallation script (uninstall.sh) with backup and cleanup
  - Self-update script (update.sh) with GitHub API integration

- **Testing & CI/CD**
  - Comprehensive test coverage (1045+ passing tests)
  - Monorepo structure with Turborepo
  - TypeScript strict mode, ESLint, Prettier
  - Husky git hooks for code quality
  - GitHub Actions workflows for docs and testing

### Fixed
- Fixed TypeScript compilation errors across all packages
- Resolved foreign key constraint failures in audit logging
- Fixed scheduler test failures (agent creation, cron expression validation)
- Fixed core package test failures (DatabasePool mocks, ExecutionResult types)
- Fixed parent task progress tracking
- Resolved circular dependency detection false positives

### Security
- **CRITICAL**: Path traversal protection (prevents `../../etc/passwd` attacks)
- **CRITICAL**: Agent ID validation (prevents injection)
- **HIGH**: Command injection protection in adapters
- **MEDIUM**: Audit log immutability enforcement

### Testing
- 1045 out of 1046 tests passing (99.9% pass rate)
- All critical functionality fully tested

### Known Issues
- CLI commands (init, status, config, debug) have placeholder implementations
- One flaky disk-space test

---

**Release Status**: Alpha v0.1.0 - Suitable for development and evaluation. Not yet production-ready.

[0.1.0]: https://github.com/aaron777collins/RecursiveManager/releases/tag/v0.1.0
