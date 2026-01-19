# RecursiveManager: Full Production Deployment Plan

**Objective**: Transform RecursiveManager from alpha to fully production-ready with zero issues, complete CI/CD via Jenkins, and ALL features implemented.

**No "later" or "future work"** - EVERYTHING gets done in this plan.

---

## Phase 1: Fix ALL Test Failures & Build Issues (Critical)

### 1.1 Fix Turbo Config
- **File**: `turbo.json`
- **Issue**: Using deprecated `pipeline` field, causing turbo 2.x to fail
- **Action**: Rename `pipeline` to `tasks`
- **Verification**: `npx turbo run test` executes without config errors

### 1.2 Fix ESLint Errors in Scheduler (4 errors)
- **File 1**: `packages/scheduler/src/__tests__/ScheduleManager.test.ts:26`
  - Remove unnecessary `await` from non-Promise
- **File 2**: `packages/scheduler/src/daemon.ts:34`
  - Add type guards for error handling: `if (error instanceof Error)`
  - Fix template literal with unknown types
- **File 3**: `packages/scheduler/src/daemon.ts:186`
  - Replace infinite loop `while(true)` with proper exit condition
- **Verification**: `npm run lint` passes with 0 errors

### 1.3 Fix Core Package Integration Tests (8 failures)
**Files to fix**:
1. `packages/core/src/execution/__tests__/AgentLock.test.ts`
2. `packages/core/src/tasks/__tests__/notifyCompletion.test.ts`
3. `packages/core/src/__tests__/pauseAgent.test.ts`
4. `packages/core/src/tasks/__tests__/notifyDeadlock.test.ts`
5. `packages/core/src/tasks/__tests__/task-lifecycle-integration.test.ts`
6. `packages/core/src/execution/__tests__/ExecutionPool.test.ts`
7. `packages/core/src/execution/__tests__/concurrentExecutionPrevention.integration.test.ts`
8. `packages/core/src/tasks/__tests__/createTaskDirectory.test.ts`

**Methodology**:
- Run each test individually: `npx turbo run test -- <test-file>`
- Read full error output
- Fix root cause (foreign key constraints, type mismatches, async issues)
- Verify fix doesn't break other tests
- Move to next test

**Verification**: All core tests pass (target: 100%)

### 1.4 Fix CLI Integration Tests (8 failures)
**Files**:
- `packages/cli/src/__tests__/debug.integration.test.ts`
- `packages/cli/src/__tests__/config.integration.test.ts`

**Root cause**: Commands are stubs
**Action**: Implement full command functionality (see Phase 3)

### 1.5 Fix Adapter Integration Test Timeout
**File**: `packages/adapters/src/adapters/claude-code/__tests__/ClaudeCodeAdapter.integration.test.ts:152`
**Actions**:
- Increase `beforeAll` timeout from 5000ms to 30000ms
- Add proper cleanup in `afterAll`
- Mock Claude Code CLI for unit tests where actual binary not needed
- Test timeout increased to 60000ms for integration tests

**Verification**: All 18 Claude Code adapter tests pass

### 1.6 Success Criteria
- **Target**: 100% test pass rate (currently 97.5%)
- All 1396 tests passing
- 0 ESLint errors
- 0 TypeScript errors
- Build completes in <60s

---

## Phase 2: Implement Multi-Perspective Analysis System

### 2.1 Architecture
```
ExecutionOrchestrator.analyzeMultiPerspective(question)
    ↓
Spawn 8 Sub-Agents in Parallel
    ↓
┌─────────┬─────────┬──────────┬──────────┐
│Security │Architecture│Simplicity│Financial│
└─────────┴─────────┴──────────┴──────────┘
┌─────────┬─────────┬──────────┬──────────┐
│Marketing│   UX    │  Growth  │Emotional │
└─────────┴─────────┴──────────┴──────────┘
    ↓
Aggregate & Synthesize → Final Decision
```

### 2.2 Implementation Files
**New files**:
1. `packages/core/src/execution/perspectives/types.ts` - Type definitions
2. `packages/core/src/execution/perspectives/SecurityPerspective.ts`
3. `packages/core/src/execution/perspectives/ArchitecturePerspective.ts`
4. `packages/core/src/execution/perspectives/SimplicityPerspective.ts`
5. `packages/core/src/execution/perspectives/FinancialPerspective.ts`
6. `packages/core/src/execution/perspectives/MarketingPerspective.ts`
7. `packages/core/src/execution/perspectives/UXPerspective.ts`
8. `packages/core/src/execution/perspectives/GrowthPerspective.ts`
9. `packages/core/src/execution/perspectives/EmotionalPerspective.ts`
10. `packages/core/src/execution/perspectives/PerspectiveAggregator.ts`

**Modified files**:
1. `packages/core/src/execution/ExecutionOrchestrator.ts`
   - Remove placeholder at line 228
   - Add full implementation

### 2.3 Each Perspective Agent
**Prompt template**:
```
You are the {PERSPECTIVE} perspective agent analyzing this question:
{QUESTION}

Context:
{CONTEXT}

Provide:
1. Recommendation (approve/reject/conditional)
2. Confidence (0-100)
3. Reasoning (2-3 paragraphs)
4. Risks (list)
5. Opportunities (list)

Focus exclusively on {PERSPECTIVE} concerns.
```

### 2.4 Aggregation Logic
- Weighted scoring: Security (20%), Architecture (15%), Simplicity (15%), Financial (10%), Marketing (10%), UX (10%), Growth (10%), Emotional (10%)
- Confidence threshold: 70% minimum to approve
- Conflict resolution: If perspectives split >50/50, mark as "needs human review"

### 2.5 Tests
**New test files**:
1. `packages/core/src/execution/perspectives/__tests__/SecurityPerspective.test.ts`
2. ... (one for each perspective)
3. `packages/core/src/execution/perspectives/__tests__/PerspectiveAggregator.test.ts`
4. `packages/core/src/execution/__tests__/multiPerspectiveAnalysis.integration.test.ts`

**Test scenarios**:
- All perspectives agree → high confidence approval
- Split decision → conditional approval
- Conflicting perspectives → needs human review
- Low confidence → rejection
- Performance: Complete in <10 seconds

### 2.6 Success Criteria
- Multi-perspective analysis produces meaningful output
- All 8 perspectives implemented
- Tests achieve 90%+ coverage
- Performance <10s for 8 perspectives
- Integration with ExecutionOrchestrator complete

---

## Phase 3: Implement ALL CLI Commands

### 3.1 Commands to Implement (currently stubs)
1. `recursive-manager init`
2. `recursive-manager hire`
3. `recursive-manager fire`
4. `recursive-manager run`
5. `recursive-manager pause`
6. `recursive-manager resume`
7. `recursive-manager status`
8. `recursive-manager config`
9. `recursive-manager debug`
10. `recursive-manager version`

### 3.2 Command Implementations

#### init
**File**: `packages/cli/src/commands/init.ts`
```typescript
- Initialize .recursive-manager directory
- Create config.json
- Initialize SQLite database
- Create workspace directories
- Set up default agent configuration
- Interactive wizard for configuration
```

#### hire
**File**: `packages/cli/src/commands/hire.ts`
```typescript
- Create new agent with full configuration
- Support interactive mode
- Validate all inputs
- Create agent snapshot
- Start agent if --start flag provided
```

#### fire
**File**: `packages/cli/src/commands/fire.ts`
```typescript
- Terminate agent
- Support --cascade to remove sub-agents
- Support --dry-run for preview
- Confirmation prompts
- Cleanup agent workspace
```

#### run
**File**: `packages/cli/src/commands/run.ts`
```typescript
- Manual trigger of agent execution
- Support --continuous, --reactive, --once modes
- Stream execution output
- Handle errors gracefully
```

#### pause/resume
**Files**: `packages/cli/src/commands/pause.ts`, `packages/cli/src/commands/resume.ts`
```typescript
- Wrapper around core pauseAgent/resumeAgent
- Update scheduler daemon
- Provide status feedback
```

#### status
**File**: `packages/cli/src/commands/status.ts`
```typescript
- Show system status
- List all agents with states
- Show active tasks
- Display resource usage
- Health check
```

#### config
**File**: `packages/cli/src/commands/config.ts`
```typescript
- Get/set configuration values
- List all config
- Validate configuration
- Support JSON export
```

#### debug
**File**: `packages/cli/src/commands/debug.ts`
```typescript
- Dump system state
- Show logs
- Database integrity check
- Export diagnostic bundle
```

#### version
**File**: `packages/cli/src/commands/version.ts`
```typescript
- Show package version
- Show Git commit
- Link to release notes
```

### 3.3 Tests
- Each command gets comprehensive integration tests
- Test success cases
- Test error cases
- Test edge cases
- Test interactive mode

### 3.4 Success Criteria
- All 10 commands fully functional
- All CLI tests pass
- Commands match documentation
- Interactive modes work smoothly

---

## Phase 4: Integrate Scheduler Daemon with Agent Lifecycle

### 4.1 Integration Points
1. **pauseAgent** → pause all schedules
2. **resumeAgent** → resume all schedules
3. **terminateAgent** → cancel all schedules
4. **createAgent** → initialize schedule tracking

### 4.2 New Scheduler Methods
**File**: `packages/scheduler/src/daemon.ts`
```typescript
- pauseAgentSchedules(agentId: string)
- resumeAgentSchedules(agentId: string)
- cancelAgentSchedules(agentId: string)
- getPausedSchedules(agentId: string)
- updateScheduleStatus(scheduleId: string, status: ScheduleStatus)
```

### 4.3 Modified Core Files
1. `packages/core/src/lifecycle/pauseAgent.ts:56`
   - Import scheduler daemon
   - Call pauseAgentSchedules
2. `packages/core/src/lifecycle/resumeAgent.ts:68`
   - Import scheduler daemon
   - Call resumeAgentSchedules
3. `packages/core/src/lifecycle/terminateAgent.ts`
   - Call cancelAgentSchedules

### 4.4 Tests
- Unit tests for new scheduler methods
- Integration tests: pause agent → verify schedules paused
- Integration tests: resume agent → verify schedules resumed
- E2E test: schedule task → pause → wait → resume → verify execution

### 4.5 Success Criteria
- Pausing agent pauses all schedules
- Resuming agent resumes all schedules
- No scheduler tests fail
- Schedules execute correctly after resume

---

## Phase 5: Implement Security Features

### 5.1 Rate Limiting
**File**: `packages/common/src/rateLimit.ts` (new)
```typescript
- Implement RateLimiter class
- Sliding window algorithm
- Configurable limits per operation
```

**Apply to**:
- `createAgent`: 10 agents per minute
- `executeAgent`: 30 executions per minute
- `createTask`: 100 tasks per minute
- API endpoints (if web server added)

**Tests**: Test rate limit enforcement, window reset, multiple users

### 5.2 Input Size Limits
**File**: `packages/common/src/validation.ts`
```typescript
- MAX_FILE_SIZE: 10 MB
- MAX_MESSAGE_LENGTH: 10,000 chars
- MAX_TASK_DESCRIPTION: 5,000 chars
- MAX_AGENT_CONFIG: 100 KB
- MAX_WORKSPACE_SIZE: 100 MB
```

**Apply to**:
- All file operations
- Message creation
- Task creation
- Agent configuration

**Tests**: Test each limit with oversized inputs

### 5.3 SECURITY.md
**File**: `/home/ubuntu/repos/RecursiveManager/SECURITY.md` (new)
- Security policy
- Vulnerability reporting process
- Response timeline
- Security measures implemented
- Known limitations
- Best practices

### 5.4 Security Audit
- Review all user input points
- Check SQL injection vulnerabilities
- Verify path traversal protection
- Test command injection prevention
- Validate error handling doesn't leak sensitive info

### 5.5 Success Criteria
- Rate limiting prevents DOS attacks
- All inputs have size limits
- SECURITY.md published
- No security vulnerabilities found

---

## Phase 6: Implement Messaging Integration

### 6.1 Supported Platforms
1. Slack
2. Telegram
3. Email (SMTP)
4. Discord
5. Webhooks (generic)

### 6.2 Architecture
```
External Event → Webhook Listener → Message Router → Agent Executor → Response
```

### 6.3 New Files
1. `packages/adapters/src/messaging/WebhookListener.ts`
2. `packages/adapters/src/messaging/MessageRouter.ts`
3. `packages/adapters/src/messaging/SlackMessenger.ts`
4. `packages/adapters/src/messaging/TelegramMessenger.ts`
5. `packages/adapters/src/messaging/EmailMessenger.ts`
6. `packages/adapters/src/messaging/DiscordMessenger.ts`
7. `packages/adapters/src/messaging/WebhookMessenger.ts`

### 6.4 Webhook Listener
```typescript
- Express server listening on configurable port
- POST /webhook/slack
- POST /webhook/telegram
- POST /webhook/discord
- POST /webhook/email
- POST /webhook/generic
- Security: Verify webhook signatures
- Rate limiting per platform
```

### 6.5 Message Router
```typescript
- Parse incoming message
- Identify target agent (by routing rules)
- Queue message for agent
- Trigger agent execution
- Send response back to platform
```

### 6.6 Platform Integrations

**Slack**:
- Use @slack/web-api
- Support slash commands
- Support interactive components
- OAuth authentication

**Telegram**:
- Use node-telegram-bot-api
- Support bot commands
- Support inline keyboards
- Webhook mode (not polling)

**Email**:
- Use nodemailer
- SMTP configuration
- Support attachments
- HTML/text formatting

**Discord**:
- Use discord.js
- Support bot commands
- Support embeds
- Webhook support

**Generic Webhooks**:
- Accept JSON payloads
- Configurable response format
- Custom headers support

### 6.7 Configuration
**File**: `config.json`
```json
{
  "messaging": {
    "enabled": true,
    "port": 3001,
    "slack": {
      "enabled": true,
      "token": "xoxb-...",
      "signingSecret": "..."
    },
    "telegram": {
      "enabled": true,
      "token": "...",
      "webhookUrl": "https://..."
    },
    "email": {
      "enabled": true,
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "...",
          "pass": "..."
        }
      }
    },
    "discord": {
      "enabled": true,
      "token": "..."
    }
  }
}
```

### 6.8 Tests
- Mock webhook requests
- Test message parsing
- Test routing logic
- Integration tests with test bots
- E2E tests with real platforms (dev environment)

### 6.9 Success Criteria
- All 5 platforms integrated
- Agents can receive messages
- Agents can send responses
- Tests pass
- Documentation complete

---

## Phase 7: Setup Jenkins CI/CD (Replace GitHub Actions)

### 7.1 Install Jenkins
**Actions**:
```bash
# Install Java
sudo apt update
sudo apt install -y openjdk-17-jdk

# Install Jenkins
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null
echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null
sudo apt update
sudo apt install -y jenkins

# Start Jenkins
sudo systemctl enable jenkins
sudo systemctl start jenkins

# Get initial admin password
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

### 7.2 Setup Jenkins Data Directory
**Directory structure**:
```
/home/ubuntu/jenkins/
├── jenkins_home/        # Jenkins home directory
├── backups/             # Jenkins backups
├── scripts/             # Build scripts
└── logs/                # Build logs
```

**Actions**:
```bash
sudo mkdir -p /home/ubuntu/jenkins/{jenkins_home,backups,scripts,logs}
sudo chown -R jenkins:jenkins /home/ubuntu/jenkins
sudo systemctl stop jenkins
sudo sed -i 's|JENKINS_HOME=.*|JENKINS_HOME=/home/ubuntu/jenkins/jenkins_home|' /etc/default/jenkins
sudo systemctl start jenkins
```

### 7.3 Configure Caddy for Jenkins
**File**: Update Caddy docker config

**Actions**:
```bash
# Backup existing Caddyfile
docker exec caddy cat /etc/caddy/Caddyfile > /tmp/Caddyfile.backup.$(date +%s)
```

**New Caddyfile content** (append):
```
jenkins.aaroncollins.info {
    reverse_proxy localhost:8080

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Logging
    log {
        output file /var/log/caddy/jenkins.log
        format json
    }
}
```

**Apply**:
```bash
# Update Caddyfile in container
docker exec caddy sh -c "cat >> /etc/caddy/Caddyfile" < updated_caddyfile
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```

**Verification**:
```bash
curl -I https://jenkins.aaroncollins.info
```

### 7.4 Create Webstack Jenkins Integration
**Directory**: `/home/ubuntu/webstack/jenkins/` (create if doesn't exist)

If webstack doesn't exist, create minimal structure:
```bash
mkdir -p /home/ubuntu/webstack/jenkins
cd /home/ubuntu/webstack/jenkins
```

**Files to create**:

1. `/home/ubuntu/webstack/jenkins/docker-compose.yml`:
```yaml
version: '3.8'

services:
  jenkins:
    image: jenkins/jenkins:lts
    container_name: jenkins
    restart: unless-stopped
    user: root
    ports:
      - "8080:8080"
      - "50000:50000"
    volumes:
      - /home/ubuntu/jenkins/jenkins_home:/var/jenkins_home
      - /var/run/docker.sock:/var/run/docker.sock
      - /home/ubuntu/repos:/repos
    environment:
      - JENKINS_OPTS=--prefix=/
      - JAVA_OPTS=-Xmx2g -Djava.awt.headless=true
```

2. `/home/ubuntu/webstack/jenkins/README.md`:
```markdown
# Jenkins Setup for RecursiveManager CI/CD

## Access
- URL: https://jenkins.aaroncollins.info
- Initial admin password: `sudo cat /var/lib/jenkins/secrets/initialAdminPassword`

## Management
- Start: `docker-compose up -d`
- Stop: `docker-compose down`
- Logs: `docker-compose logs -f`
- Backup: `./backup.sh`

## Jobs
1. RecursiveManager-CI - Run on every commit
2. RecursiveManager-Release - Run on tag creation
3. RecursiveManager-Nightly - Run daily builds
```

3. `/home/ubuntu/webstack/jenkins/backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/home/ubuntu/jenkins/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/jenkins_backup_$DATE.tar.gz"

echo "Creating Jenkins backup: $BACKUP_FILE"
sudo tar -czf "$BACKUP_FILE" -C /home/ubuntu/jenkins jenkins_home
echo "Backup complete"

# Keep only last 10 backups
ls -t $BACKUP_DIR/jenkins_backup_*.tar.gz | tail -n +11 | xargs -r rm
echo "Old backups cleaned"
```

### 7.5 Jenkins Pipeline Configuration

**Job 1: RecursiveManager-CI**
**Jenkinsfile** (create in repo root):
```groovy
pipeline {
    agent any

    environment {
        NODE_VERSION = '20'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Setup') {
            steps {
                sh '''
                    node --version
                    npm --version
                    npm ci
                '''
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test -- --coverage'
            }
        }

        stage('Type Check') {
            steps {
                sh 'npm run type-check'
            }
        }
    }

    post {
        always {
            junit '**/test-results/**/*.xml'
            publishHTML([
                reportDir: 'coverage',
                reportFiles: 'index.html',
                reportName: 'Coverage Report'
            ])
        }
        success {
            echo 'Build successful!'
        }
        failure {
            echo 'Build failed!'
        }
    }
}
```

**Job 2: RecursiveManager-Release**
**Jenkinsfile.release**:
```groovy
pipeline {
    agent any

    environment {
        NODE_VERSION = '20'
        NPM_TOKEN = credentials('npm-token')
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Setup') {
            steps {
                sh '''
                    node --version
                    npm --version
                    npm ci
                '''
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Test') {
            steps {
                sh 'npm test'
            }
        }

        stage('Version') {
            steps {
                script {
                    def version = sh(script: 'node -p "require(\'./package.json\').version"', returnStdout: true).trim()
                    echo "Building version: ${version}"
                    env.VERSION = version
                }
            }
        }

        stage('Publish to NPM') {
            steps {
                sh '''
                    echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
                    npm publish --access public --workspaces
                '''
            }
        }

        stage('Create GitHub Release') {
            steps {
                sh '''
                    gh release create v${VERSION} \
                        --title "Release v${VERSION}" \
                        --notes-file CHANGELOG.md
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    docker build -t recursivemanager:${VERSION} .
                    docker tag recursivemanager:${VERSION} recursivemanager:latest
                '''
            }
        }
    }

    post {
        success {
            echo "Release ${VERSION} successful!"
        }
        failure {
            echo 'Release failed!'
        }
    }
}
```

**Job 3: RecursiveManager-Nightly**
- Schedule: `H 2 * * *` (nightly at 2 AM)
- Actions: Full test suite, performance benchmarks, security scans

### 7.6 Jenkins Plugins to Install
```
- Git Plugin
- Pipeline Plugin
- NodeJS Plugin
- Docker Pipeline Plugin
- JUnit Plugin
- HTML Publisher Plugin
- Slack Notification Plugin (if Slack configured)
- GitHub Plugin
```

### 7.7 Success Criteria
- Jenkins accessible at https://jenkins.aaroncollins.info
- CI pipeline runs on every commit
- Release pipeline triggers on tags
- All tests run in Jenkins
- No GitHub Actions dependencies
- Backups automated

---

## Phase 8: Docker & Deployment

### 8.1 Dockerfile
**File**: `/home/ubuntu/repos/RecursiveManager/Dockerfile`
```dockerfile
FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev \
    git \
    bash

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/*/package.json ./packages/

# Install dependencies
RUN npm ci --include=dev

# Copy source
COPY . .

# Build all packages
RUN npm run build

# Create data directories
RUN mkdir -p /app/data /app/workspaces /app/logs

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start CLI
CMD ["npm", "start"]
```

### 8.2 Docker Compose
**File**: `/home/ubuntu/repos/RecursiveManager/docker-compose.yml`
```yaml
version: '3.8'

services:
  recursive-manager:
    build: .
    container_name: recursive-manager
    restart: unless-stopped
    ports:
      - "3000:3000"
      - "3001:3001"
    volumes:
      - ./data:/app/data
      - ./workspaces:/app/workspaces
      - ./config:/app/config
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - DATA_DIR=/app/data
      - LOG_LEVEL=info
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  backup:
    image: alpine:latest
    container_name: recursive-manager-backup
    restart: unless-stopped
    volumes:
      - ./data:/data:ro
      - ./backups:/backups
    command: |
      sh -c '
        while true; do
          date=$(date +%Y%m%d_%H%M%S)
          tar -czf /backups/backup_$date.tar.gz -C /data .
          find /backups -name "backup_*.tar.gz" -mtime +30 -delete
          sleep 86400
        done
      '
```

### 8.3 .dockerignore
**File**: `/home/ubuntu/repos/RecursiveManager/.dockerignore`
```
node_modules
dist
coverage
.git
.github
*.log
*.md
!README.md
!CHANGELOG.md
.env*
.DS_Store
```

### 8.4 Docker Build & Test
```bash
cd /home/ubuntu/repos/RecursiveManager
docker build -t recursivemanager:test .
docker run -it --rm recursivemanager:test npm test
docker-compose up -d
docker-compose logs -f
```

### 8.5 Success Criteria
- Docker image builds successfully
- Container starts without errors
- Health check passes
- Tests run inside container
- Data persists across restarts
- Backups automated

---

## Phase 9: Monitoring, Metrics & Observability

### 9.1 Prometheus Metrics
**File**: `packages/common/src/metrics.ts` (new)
```typescript
- agentsCreated: Counter
- agentsTerminated: Counter
- tasksCreated: Counter
- tasksCompleted: Counter
- executionDuration: Histogram
- activeAgents: Gauge
- failedExecutions: Counter
- messagingEventsReceived: Counter
```

### 9.2 Health Check Endpoint
**File**: `packages/cli/src/server/health.ts` (new)
```typescript
- GET /health - Basic health check
- GET /health/detailed - Detailed system status
- GET /metrics - Prometheus metrics
- GET /ready - Readiness probe
- GET /live - Liveness probe
```

### 9.3 Logging
**File**: `packages/common/src/logging.ts`
```typescript
- Structured logging with Winston
- Log levels: error, warn, info, debug
- Log rotation
- JSON format for machine parsing
- Console output for development
```

### 9.4 Alerting (Optional)
- Configure Prometheus alerting rules
- Alert on high error rates
- Alert on service down
- Alert on disk space low
- Alert on memory usage high

### 9.5 Success Criteria
- Metrics endpoint functional
- Health checks respond correctly
- Logs structured and readable
- Prometheus can scrape metrics
- Dashboards show real-time data

---

## Phase 10: Documentation & Website

### 10.1 Fix VitePress Build
**Actions**:
1. Fix base path in `docs/.vitepress/config.js`: `/RecursiveManager/`
2. Create ALL 19 missing documentation pages
3. Add logo to `docs/public/logo.svg`
4. Fix MkDocs syntax in index.md
5. Test build completes in <60 seconds

### 10.2 Missing Documentation Pages (ALL must be written)

**Priority 1 (Full content)**:
1. `docs/api/cli-commands.md` - Complete CLI reference
2. `docs/guide/troubleshooting.md` - Common issues & solutions
3. `docs/guide/best-practices.md` - Best practices guide
4. `docs/api/core.md` - Core API reference
5. `docs/api/adapters.md` - Adapters API reference
6. `docs/guide/multi-perspective.md` - Multi-perspective analysis guide
7. `docs/guide/scheduling.md` - Scheduling system guide
8. `docs/guide/messaging.md` - Messaging integration guide

**Priority 2 (Good content)**:
9. `docs/architecture/execution-model.md` - Execution architecture
10. `docs/architecture/system-design.md` - System design overview
11. `docs/guide/docker.md` - Docker deployment guide
12. `docs/guide/jenkins.md` - Jenkins CI/CD setup

**Priority 3 (Basic content)**:
13. `docs/architecture/security-perspective.md`
14. `docs/architecture/architecture-perspective.md`
15. `docs/architecture/simplicity-perspective.md`
16. `docs/architecture/financial-perspective.md`
17. `docs/architecture/marketing-perspective.md`
18. `docs/architecture/ux-perspective.md`
19. `docs/architecture/growth-perspective.md`

### 10.3 Deploy Documentation
**Actions**:
1. Build docs: `cd docs && npm run build`
2. Test locally: `npm run serve`
3. Configure Jenkins job to deploy to GitHub Pages
4. Verify: https://aaron777collins.github.io/RecursiveManager/

**Alternative: Self-hosted**:
- Deploy to Caddy on this server
- https://docs.aaroncollins.info/recursivemanager/

### 10.4 Success Criteria
- All 19 pages written
- Build completes successfully
- No broken links
- Documentation deployed and accessible
- Search works

---

## Phase 11: Final Polish & Release

### 11.1 README Updates
- Add badges (build status, coverage, version)
- Update installation instructions
- Add Docker instructions
- Update examples
- Link to documentation
- Add contributor guide

### 11.2 CHANGELOG
- Document all changes since v0.1.0
- Group by type: Features, Fixes, Breaking Changes
- Credit contributors
- Link to issues/PRs

### 11.3 Version Bump
- Update version to 1.0.0 in all package.json files
- Update dependency versions
- Tag release: `git tag v1.0.0`

### 11.4 NPM Publishing
**Files**:
- Add .npmignore to exclude tests
- Add publishConfig to package.json
- Set up NPM authentication in Jenkins

**Packages to publish**:
1. `@recursive-manager/common`
2. `@recursive-manager/core`
3. `@recursive-manager/adapters`
4. `@recursive-manager/scheduler`
5. `@recursive-manager/cli`

### 11.5 GitHub Release
- Create release v1.0.0
- Upload binaries (if applicable)
- Include changelog
- Tag as "latest"

### 11.6 Announcements
- Post on GitHub Discussions
- Update personal website
- Share on relevant communities

### 11.7 Success Criteria
- Version 1.0.0 released
- All packages published to NPM
- GitHub release created
- Documentation live
- Zero known issues

---

## Phase 12: Post-Launch Monitoring

### 12.1 Monitoring Period (Week 1)
- Monitor error logs daily
- Check metrics for anomalies
- Respond to issues within 24 hours
- Track user feedback

### 12.2 Performance Baseline
- Establish baseline metrics
- Document typical resource usage
- Set alert thresholds

### 12.3 Backup Verification
- Verify automated backups running
- Test backup restoration
- Document recovery procedures

### 12.4 Success Criteria
- System stable for 7 days
- No critical issues
- Backups functional
- Monitoring operational

---

## Success Criteria Summary

### Must Have (Blocking v1.0.0 release):
- ✅ 100% test pass rate (1396/1396 tests)
- ✅ 0 ESLint errors
- ✅ 0 TypeScript errors
- ✅ Multi-perspective analysis fully implemented
- ✅ Scheduler integrated with agent lifecycle
- ✅ All 10 CLI commands functional
- ✅ Rate limiting implemented
- ✅ Input size limits enforced
- ✅ Messaging integration complete (all 5 platforms)
- ✅ Jenkins CI/CD operational
- ✅ Docker deployment working
- ✅ All 19 documentation pages written
- ✅ Documentation deployed
- ✅ Monitoring & metrics operational
- ✅ SECURITY.md published
- ✅ Automated backups functional
- ✅ Published to NPM
- ✅ GitHub release v1.0.0 created

### Nice to Have (Can be v1.1.0):
- External security audit
- Professional performance optimization
- Load testing results
- Video tutorials

---

## Execution Plan

1. Run `ralph.sh` in plan mode to break down this plan
2. Run `ralph.sh` in build mode via nohup
3. Monitor progress via Slack updates
4. Verify each phase completion criteria
5. Ship v1.0.0 when ALL criteria met

**NO SHORTCUTS. NO "LATER". EVERYTHING GETS DONE.**
