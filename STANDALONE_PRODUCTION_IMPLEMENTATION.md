# RecursiveManager - Complete Production Implementation Plan

**Goal**: Make RecursiveManager fully production-ready with zero issues, complete features, Jenkins CI/CD, and v1.0.0 release.

## Phase 1: Fix All Test Failures

**Current State**: 95 test failures across multiple test suites

### Tasks:
1. Fix all core test failures in `src/__tests__/`
2. Fix all CLI test failures in `cli/__tests__/`
3. Fix ESLint errors (currently 6 errors)
4. Fix adapter integration tests
5. Fix turbo integration tests
6. Verify 100% test pass rate (295/295 core tests, 115/115 CLI tests)

## Phase 2: Implement Real Multi-Perspective AI Analysis

**Current State**: Stub implementation returns mock data

**Architecture**: Multi-perspective AI analysis uses 8 specialized agents to analyze decisions from different viewpoints. This is a CONSULTING SERVICE (not actual RecursiveManager agents) - makes parallel LLM API calls with different system prompts.

**AI Provider Configuration**: Supports swappable providers (GLM Gateway, Anthropic, OpenAI, custom). All agents (execution + analysis) route through the configured provider for centralized cost tracking, rate limiting, and metrics.

### 2.1: AI Provider Infrastructure (Foundation Layer)
1. **Create AIProviderInterface** (`packages/core/src/ai-analysis/providers/base.ts`):
   - Define `AIAnalysisProvider` interface with `analyze(prompt, agentType)` method
   - Define `ProviderConfig` interface for endpoint, apiKey, model, timeout
   - Add error types: `ProviderError`, `RateLimitError`, `TimeoutError`

2. **Implement GLMGatewayProvider** (`packages/core/src/ai-analysis/providers/glm-gateway.ts`):
   - HTTP client to `http://localhost:4000/api/glm/proxy`
   - Retry logic (3 attempts with exponential backoff)
   - Timeout handling (configurable, default 60s)
   - Request/response logging
   - Unit tests with mocked HTTP client

3. **Implement AnthropicProvider** (`packages/core/src/ai-analysis/providers/anthropic.ts`):
   - HTTP client to `https://api.anthropic.com/v1/messages`
   - Anthropic SDK integration
   - Retry logic and error handling
   - Unit tests with mocked Anthropic SDK

4. **Implement OpenAIProvider** (`packages/core/src/ai-analysis/providers/openai.ts`):
   - HTTP client to `https://api.openai.com/v1/chat/completions`
   - OpenAI SDK integration
   - Retry logic and error handling
   - Unit tests with mocked OpenAI SDK

5. **Create ProviderFactory** (`packages/core/src/ai-analysis/providers/factory.ts`):
   - Factory pattern to instantiate providers based on config
   - Singleton pattern for provider instances
   - Provider switching logic
   - Validation of provider configurations

6. **Add Configuration Support** (`packages/common/src/config.ts`):
   - Add `aiProvider` field: `'glm-gateway' | 'anthropic' | 'openai' | 'custom'`
   - Add `aiProviderEndpoint` field (URL string)
   - Add `aiProviderApiKey` field (string)
   - Add `aiProviderModel` field (string, default: 'claude-sonnet-4-5')
   - Add `aiProviderTimeout` field (number, default: 60000ms)
   - Load from environment variables: `AI_PROVIDER`, `AI_PROVIDER_ENDPOINT`, etc.

7. **Environment Variable Schema** (`.env.example`):
   - Document all AI provider env vars
   - Add examples for each provider type
   - Add validation rules

8. **Integration Tests for Provider Switching**:
   - Test switching between GLM Gateway and Anthropic
   - Test fallback behavior on provider failure
   - Test configuration validation errors

### 2.2: Multi-Perspective Analysis Agents (8 Agents)
Each agent makes LLM API calls via the configured provider. Agents run in PARALLEL.

9. **Security Agent** (`packages/core/src/ai-analysis/agents/security.ts`):
   - System prompt: "You are a security expert analyzing for vulnerabilities, attack vectors, and risks."
   - Analyzes input for security implications
   - Returns analysis with confidence score (0-100)
   - Unit tests with mocked provider

10. **Architecture Agent** (`packages/core/src/ai-analysis/agents/architecture.ts`):
    - System prompt: "You are an architect analyzing scalability, maintainability, and technical patterns."
    - Analyzes architectural implications
    - Returns analysis with confidence score
    - Unit tests with mocked provider

11. **Simplicity Agent** (`packages/core/src/ai-analysis/agents/simplicity.ts`):
    - System prompt: "You are a simplicity advocate analyzing complexity and suggesting reductions."
    - Analyzes complexity implications
    - Returns analysis with confidence score
    - Unit tests with mocked provider

12. **Financial Agent** (`packages/core/src/ai-analysis/agents/financial.ts`):
    - System prompt: "You are a financial analyst analyzing costs, ROI, and resource optimization."
    - Analyzes financial implications
    - Returns analysis with confidence score
    - Unit tests with mocked provider

13. **Marketing Agent** (`packages/core/src/ai-analysis/agents/marketing.ts`):
    - System prompt: "You are a marketing strategist analyzing positioning, messaging, and market fit."
    - Analyzes marketing implications
    - Returns analysis with confidence score
    - Unit tests with mocked provider

14. **UX Agent** (`packages/core/src/ai-analysis/agents/ux.ts`):
    - System prompt: "You are a UX expert analyzing user experience, accessibility, and usability."
    - Analyzes UX implications
    - Returns analysis with confidence score
    - Unit tests with mocked provider

15. **Growth Agent** (`packages/core/src/ai-analysis/agents/growth.ts`):
    - System prompt: "You are a growth strategist analyzing adoption, viral potential, and scaling."
    - Analyzes growth implications
    - Returns analysis with confidence score
    - Unit tests with mocked provider

16. **Emotional Agent** (`packages/core/src/ai-analysis/agents/emotional.ts`):
    - System prompt: "You are an emotional intelligence expert analyzing user feelings and frustrations."
    - Analyzes emotional implications
    - Returns analysis with confidence score
    - Unit tests with mocked provider

### 2.3: Orchestration and Aggregation
17. **MultiPerspectiveAnalysis Orchestrator** (`packages/core/src/ai-analysis/multi-perspective.ts`):
    - Spawn all 8 agents in parallel (Promise.all)
    - Aggregate results from all agents
    - Calculate overall confidence score (weighted average)
    - Detect conflicts between agent recommendations
    - Return `PerspectiveResult` object with all 8 analyses

18. **Result Aggregation Logic**:
    - Implement conflict detection (agents disagree)
    - Implement confidence scoring algorithm
    - Implement result formatting for CLI output
    - Unit tests for aggregation edge cases

19. **Wire to ExecutionOrchestrator** (`packages/core/src/execution-orchestrator.ts`):
    - Add `analyzeDecision(context)` method
    - Call MultiPerspectiveAnalysis for major decisions
    - Log all analysis results
    - Integration test: orchestrator → analysis → provider

20. **Wire to CLI** (`packages/cli/src/commands/analyze.ts`):
    - Add `ralph analyze <text>` command
    - Display all 8 agent results with colored output
    - Show confidence scores and conflicts
    - CLI integration test

### 2.4: Adapter System Provider Configuration
Ensure RecursiveManager agents (CEO, CTO, etc.) ALSO use the configured AI provider.

21. **Update ClaudeCodeAdapter** (`packages/adapters/src/claude-code/adapter.ts`):
    - Set `ANTHROPIC_BASE_URL` environment variable before spawning agents
    - Read from config: `aiProviderEndpoint`
    - Set `ANTHROPIC_API_KEY` from config
    - Test that agents route through GLM Gateway when configured

22. **Adapter Provider Tests**:
    - Test ClaudeCodeAdapter with GLM Gateway endpoint
    - Test adapter with direct Anthropic endpoint
    - Verify environment variables are set correctly

### 2.5: Documentation and Examples
23. **AI Provider Configuration Guide** (`docs/AI_PROVIDERS.md`):
    - Document all supported providers
    - Configuration examples for each provider
    - Troubleshooting guide
    - Cost optimization tips

24. **Example Configurations** (`examples/ai-configs/`):
    - `.env.glm-gateway` - GLM Gateway config
    - `.env.anthropic` - Direct Anthropic config
    - `.env.openai` - OpenAI config
    - `.env.custom` - Custom endpoint config

25. **Integration Test Suite**:
    - End-to-end test: User input → 8 agents → aggregated result
    - Test with multiple providers
    - Test error scenarios (provider down, rate limit, timeout)
    - Performance test: measure latency for 8 parallel calls

## Phase 3: Complete All CLI Commands

**Current State**: 10 CLI commands, some incomplete

### Tasks:
1. `ralph list` - Show all features with status
2. `ralph status <id>` - Show detailed feature status
3. `ralph start <id>` - Start a specific feature
4. `ralph stop <id>` - Stop a running feature
5. `ralph logs <id>` - Show feature logs with filtering
6. `ralph queue` - Manage feature queue
7. `ralph analyze <text>` - Run multi-perspective analysis
8. `ralph snapshot` - Backup/restore system state
9. `ralph health` - System health check
10. `ralph config` - Configuration management

Ensure all commands have:
- Proper argument parsing
- Input validation
- Error handling
- Colored output
- Help text
- Unit tests

## Phase 4: Scheduler Integration

**Current State**: Basic scheduler exists but incomplete

### Tasks:
1. Implement full feature pause/resume support
2. Add scheduler state persistence
3. Add priority queue management
4. Add dependency resolution (features can depend on other features)
5. Add concurrent execution limits
6. Add timeout handling
7. Add resource management (CPU/memory limits per feature)
8. Add comprehensive scheduler tests

## Phase 5: Snapshot System

**Current State**: Not implemented

### Tasks:
1. Implement system state backup
2. Include all databases (features, learning, notes)
3. Include configuration files
4. Add compression support
5. Implement restore functionality
6. Add snapshot verification
7. Add automatic snapshots before critical operations
8. Add snapshot CLI commands
9. Add tests for snapshot/restore

## Phase 6: Security Hardening

**Current State**: Basic security, needs hardening

### Tasks:
1. Add input validation for all API endpoints
2. Add rate limiting (per-IP, per-endpoint)
3. Add authentication/authorization framework
4. Add request size limits
5. Add SQL injection prevention
6. Add XSS prevention
7. Add CSRF protection
8. Add security headers
9. Run security audit
10. Add security tests

## Phase 7: Jenkins CI/CD Setup

**Current State**: Not implemented, GitHub Actions used but hitting token limits

### Tasks:

### 7.1: Install Java and Jenkins
1. Install Java 17 (required for Jenkins)
2. Download and install Jenkins LTS
3. Start Jenkins service
4. Complete initial setup wizard
5. Install required Jenkins plugins:
   - Git plugin
   - Pipeline plugin
   - NodeJS plugin
   - Docker plugin
   - Slack notification plugin

### 7.2: Configure Caddy for Jenkins
1. Add jenkins.aaroncollins.info to Caddy config in webstack
2. Add reverse proxy to localhost:8080 (Jenkins default port)
3. Enable HTTPS with automatic Let's Encrypt certificates
4. Add proper security headers
5. Test HTTPS access to jenkins.aaroncollins.info

### 7.3: Create Jenkins Folder in Webstack
1. Create `/home/ubuntu/repos/webstack/jenkins/` directory
2. Create Jenkins configuration files:
   - Jenkinsfile for CI pipeline
   - docker-compose.yml for Jenkins service
   - backup script for Jenkins data
3. Document Jenkins setup in webstack README
4. Back up original files before modification

### 7.4: Create Jenkins Pipelines
1. **CI Pipeline** (runs on every push):
   - Checkout code
   - Install dependencies (npm install)
   - Run linter (npm run lint)
   - Run all tests (npm test)
   - Generate coverage report
   - Archive test results
   - Send Slack notification on failure

2. **Release Pipeline** (runs on tag push):
   - Run full CI pipeline first
   - Build production artifacts
   - Run security scan
   - Create GitHub release
   - Publish to NPM
   - Deploy to production
   - Send Slack notification

3. **Nightly Build Pipeline**:
   - Run full test suite
   - Run performance benchmarks
   - Check for dependency updates
   - Generate reports
   - Send summary to Slack

### 7.5: Configure GitHub Integration
1. Add webhook from GitHub to Jenkins
2. Configure branch protection rules
3. Set Jenkins as required status check
4. Disable GitHub Actions workflows (replace with Jenkins)

## Phase 8: Docker Production Deployment

**Current State**: Basic Dockerfile exists, needs production hardening

### Tasks:
1. Optimize Dockerfile for production:
   - Multi-stage build
   - Minimal base image (alpine)
   - Non-root user
   - Security scanning
2. Create docker-compose.yml for full stack
3. Add health checks
4. Add volume management for persistence
5. Add environment variable configuration
6. Add Docker deployment documentation
7. Test full deployment from scratch

## Phase 9: Monitoring and Metrics

**Current State**: Basic logging only

### Tasks:
1. Add Prometheus metrics:
   - Feature execution count/duration
   - API request rates
   - Error rates
   - Queue depth
   - Memory/CPU usage
2. Add structured logging (JSON format)
3. Add log levels (debug, info, warn, error)
4. Add correlation IDs for request tracing
5. Add performance monitoring
6. Create monitoring dashboard
7. Add alerting rules
8. Document monitoring setup

## Phase 10: Complete Documentation

**Current State**: Basic README exists, needs comprehensive docs

### Tasks:

Create the following documentation pages:

1. **README.md** - Overview, quick start, features
2. **docs/INSTALLATION.md** - Full installation guide
3. **docs/CONFIGURATION.md** - All configuration options
4. **docs/API.md** - Complete API reference
5. **docs/CLI.md** - All CLI commands with examples
6. **docs/ARCHITECTURE.md** - System architecture overview
7. **docs/DEVELOPMENT.md** - Development setup guide
8. **docs/TESTING.md** - Testing guide
9. **docs/DEPLOYMENT.md** - Production deployment guide
10. **docs/DOCKER.md** - Docker usage guide
11. **docs/JENKINS.md** - Jenkins CI/CD setup
12. **docs/MONITORING.md** - Monitoring and metrics
13. **docs/SECURITY.md** - Security best practices
14. **docs/TROUBLESHOOTING.md** - Common issues and solutions
15. **docs/FAQ.md** - Frequently asked questions
16. **docs/CHANGELOG.md** - Version history
17. **docs/CONTRIBUTING.md** - Contribution guidelines
18. **docs/LICENSE.md** - License information
19. **docs/ROADMAP.md** - Future plans

## Phase 11: Private Binary Distribution with Versioned Install Scripts

**Current State**: Not set up for distribution (private repository)

**Architecture**: RecursiveManager is PRIVATE software with private CLI binaries. Distribution uses versioned install scripts (NOT public npm). Supports interactive + headless installation, upgrade, downgrade, and rollback.

### 11.1: Package Configuration for Private Distribution
1. **Update package.json** (`package.json`):
   - Set `version` to `1.0.0`
   - Set `private: true` (NO public npm publishing)
   - Add `bin` field: `{"recursive-manager": "./packages/cli/dist/cli.js"}`
   - Complete metadata (keywords, description, author)
   - Add `files` field for binary packaging

2. **Create .npmignore**:
   - Exclude test files, dev configs, docs
   - Include only dist/ and production files

3. **Add Version Management** (`packages/cli/src/version.ts`):
   - Read version from package.json
   - CLI command: `recursive-manager --version`
   - Embed version in all builds

### 11.2: Private Binary Build System
4. **Create Binary Build Script** (`scripts/build-binaries.sh`):
   - Build all packages (`turbo run build`)
   - Create standalone binary with pkg or esbuild
   - Generate platform-specific binaries (linux-x64, macos-arm64, macos-x64, win-x64)
   - Sign binaries (GPG signature for verification)
   - Unit test: verify binary executes

5. **Create Binary Storage** (`binaries/` directory structure):
   - `/binaries/v1.0.0/linux-x64/recursive-manager`
   - `/binaries/v1.0.0/macos-arm64/recursive-manager`
   - `/binaries/v1.0.0/macos-x64/recursive-manager`
   - `/binaries/v1.0.0/win-x64/recursive-manager.exe`
   - `/binaries/v1.0.0/checksums.txt` (SHA256 checksums)
   - `/binaries/v1.0.0/signatures.txt` (GPG signatures)

6. **Binary Verification System** (`scripts/verify-binary.sh`):
   - Verify SHA256 checksum
   - Verify GPG signature
   - Test binary execution
   - Report verification status

### 11.3: Versioned Install Script (Interactive + Headless)
**ENHANCE existing** `scripts/install.sh` with version management.

7. **Add Version Selection**:
   - Detect latest version from GitHub releases or version manifest
   - Allow `--version X.Y.Z` flag for specific version
   - Default: install latest stable version

8. **Add Binary Download**:
   - Detect platform (linux, macos, windows) and architecture (x64, arm64)
   - Download correct binary from private GitHub release or artifact server
   - Verify checksum and signature before installation
   - Fallback: build from source if binary unavailable

9. **Add Installation Modes**:
   - **Binary install** (default): Download pre-built binary
   - **Source install** (`--from-source`): Build from source
   - **Local install** (`--local /path/to/tarball`): Install from local package

10. **Add Dependency Checks**:
    - Check Node.js >= 18 (for source builds)
    - Check system dependencies (git, curl, tar, gpg)
    - Auto-install missing dependencies (with user confirmation)

11. **Add Shell Integration**:
    - Auto-detect shell (bash, zsh, fish)
    - Add PATH modification to shell config
    - Add completion scripts (bash-completion, zsh-completion)
    - Test: verify `recursive-manager` command works after install

12. **Add Post-Install Verification**:
    - Run `recursive-manager --version`
    - Run `recursive-manager health`
    - Verify all core packages installed
    - Report installation summary

### 11.4: Upgrade Script (Version Management)
**ENHANCE existing** `scripts/update.sh` with atomic version switching.

13. **Add Upgrade Logic**:
    - Detect current version
    - Fetch available versions from version manifest
    - Download and install new version to temp directory
    - Verify new version works (health check)
    - Atomic swap: replace old version with new version
    - Rollback on failure

14. **Add Downgrade Support**:
    - Command: `recursive-manager downgrade X.Y.Z`
    - Download specific older version
    - Verify version compatibility
    - Atomic swap with rollback

15. **Add Backup Before Upgrade**:
    - Backup current binary to `~/.recursive-manager/backups/vX.Y.Z/`
    - Backup config files (.env, data/)
    - Keep last 5 versions (auto-cleanup old backups)

16. **Add Rollback Command**:
    - Command: `recursive-manager rollback`
    - Restore previous version from backup
    - Restore config files
    - Verify rollback success

17. **Add Version History Tracking**:
    - File: `~/.recursive-manager/.version-history`
    - Log: timestamp, version, install method (upgrade/downgrade/rollback)
    - Command: `recursive-manager version --history`

### 11.5: Release Automation
18. **Create Release Script** (`scripts/release.sh`):
    - Bump version in package.json
    - Generate CHANGELOG from git commits
    - Build binaries for all platforms
    - Run full test suite
    - Create GitHub release (private)
    - Upload binaries as release assets
    - Tag git commit with version
    - Update version manifest

19. **Create Version Manifest** (`versions.json` in repo root):
    ```json
    {
      "latest": "1.0.0",
      "versions": [
        {
          "version": "1.0.0",
          "released": "2025-01-19",
          "platforms": ["linux-x64", "macos-arm64", "macos-x64", "win-x64"],
          "checksums": {...},
          "breaking_changes": false
        }
      ]
    }
    ```

20. **Create Automated Release Pipeline** (CI/CD):
    - Trigger: git tag push (e.g., `git tag v1.0.0`)
    - Run full test suite
    - Build binaries
    - Create GitHub release
    - Update version manifest
    - Send notification (Slack, email)

### 11.6: Installation Documentation
21. **Create INSTALL.md** (`docs/INSTALL.md`):
    - **One-liner install**: `curl -fsSL https://raw.githubusercontent.com/USER/RecursiveManager/main/scripts/install.sh | bash`
    - **Interactive install**: Step-by-step guide
    - **Headless install**: CI/CD automation examples
    - **Version pinning**: Install specific version
    - **Upgrade guide**: Upgrade to latest or specific version
    - **Downgrade guide**: Downgrade to older version
    - **Rollback guide**: Rollback to previous version
    - **Troubleshooting**: Common installation issues

22. **Create Upgrade Guide** (`docs/UPGRADE.md`):
    - Pre-upgrade checklist
    - Upgrade command examples
    - Version compatibility matrix
    - Breaking changes per version
    - Rollback procedures

23. **Update README.md**:
    - Installation section with one-liner
    - Version management section
    - Link to full installation docs

### 11.7: Testing and Verification
24. **Create Install Test Suite** (`scripts/test-install.sh`):
    - Test install on clean Ubuntu VM
    - Test install on clean macOS
    - Test headless install
    - Test version pinning
    - Test upgrade path (1.0.0 → 1.1.0)
    - Test downgrade (1.1.0 → 1.0.0)
    - Test rollback after failed upgrade

25. **Create GitHub Release v1.0.0**:
    - Release notes with features and breaking changes
    - Binary artifacts for all platforms (with checksums and signatures)
    - Changelog
    - Installation instructions
    - Upgrade instructions from pre-1.0 versions

26. **Tag Release in Git**:
    - Create annotated tag: `git tag -a v1.0.0 -m "Release v1.0.0"`
    - Push tag: `git push origin v1.0.0`
    - Verify tag on GitHub

## Phase 12: Post-Launch Verification

**Current State**: Not launched

### Tasks:
1. Fresh install test on clean system
2. Verify all CLI commands work
3. Verify all API endpoints work
4. Verify Jenkins pipelines run successfully
5. Verify Docker deployment works
6. Verify monitoring dashboards show data
7. Run load testing
8. Check for memory leaks
9. Verify documentation accuracy
10. Create backup procedures documentation

---

## Success Criteria

- ✅ 100% test pass rate (410/410 tests passing)
- ✅ 0 ESLint errors
- ✅ All 10 CLI commands fully functional
- ✅ Real multi-perspective AI analysis working
- ✅ Full scheduler with pause/resume
- ✅ Complete snapshot system
- ✅ Security audit passed
- ✅ Jenkins CI/CD operational at jenkins.aaroncollins.info
- ✅ Docker production deployment tested
- ✅ Prometheus monitoring active
- ✅ All 19 documentation pages complete
- ✅ v1.0.0 published to NPM
- ✅ GitHub release created
- ✅ Zero "TODO" or "FIXME" comments in code
- ✅ Fresh install works on clean system

---

## Implementation Notes

This plan describes WHAT needs to be implemented. Each phase should be completed fully before moving to the next phase. All code should include proper error handling, logging, and tests. No shortcuts, no placeholders, no "future work" - everything must be fully implemented and working.

### Git Workflow and Automation

**IMPORTANT**: Ralph (or any automated build tool) MUST commit and push changes as it progresses through tasks:

1. **Commit Frequency**: After completing each atomic task (or logical group of related tasks)
2. **Commit Message Format**: `feat: <task description> [Phase X.Y Task Z]`
   - Example: `feat: Implement GLMGatewayProvider with retry logic [Phase 2.1 Task 2]`
3. **Auto-Push**: Push to remote after EVERY commit (don't batch commits)
4. **Branch Strategy**: Work on feature branches, NOT main
   - Branch naming: `feature/phase-X-<description>`
   - Example: `feature/phase-2-ai-provider-infrastructure`
5. **Pull Before Push**: Always `git pull --rebase` before pushing
6. **Merge to Main**: After completing a full phase, create PR and merge to main
7. **Conflict Resolution**: If push fails due to conflicts, resolve and re-push
8. **Build Status**: Include build/test status in commit messages if relevant

**Ralph Configuration for Git Automation**:
- Ralph should automatically commit after each task completion
- Ralph should push immediately after commit
- Ralph should handle merge conflicts by pausing and requesting user intervention
- Ralph should create PRs after phase completion

**Benefits**:
- Real-time backup of work
- Easy rollback to any task
- Transparent progress tracking
- Collaboration-friendly (other devs can see progress)
