# Jenkins CI/CD Setup Guide

This guide covers the Jenkins continuous integration and deployment setup for RecursiveManager.

## Overview

RecursiveManager uses Jenkins for automated CI/CD pipelines including:

- **CI Pipeline** (`Jenkinsfile.ci`): Runs on every push, executes linting, type checking, building, and testing
- **Release Pipeline** (`Jenkinsfile.release`): Creates production releases with security scanning and artifact generation
- **Nightly Pipeline** (`Jenkinsfile.nightly`): Runs comprehensive tests and dependency audits daily at 2 AM

## Prerequisites

### System Requirements

- Ubuntu 20.04 or later
- Java 17 or Java 21 (OpenJDK recommended)
- Node.js 20.x
- 2GB+ RAM for Jenkins server
- Git

### Installation

#### 1. Install Java

```bash
sudo apt update
sudo apt install -y openjdk-17-jdk
java -version  # Verify installation
```

#### 2. Install Jenkins LTS

```bash
# Add Jenkins repository and GPG key
curl -fsSL https://pkg.jenkins.io/debian-stable/jenkins.io-2023.key | sudo tee \
  /usr/share/keyrings/jenkins-keyring.asc > /dev/null

echo deb [signed-by=/usr/share/keyrings/jenkins-keyring.asc] \
  https://pkg.jenkins.io/debian-stable binary/ | sudo tee \
  /etc/apt/sources.list.d/jenkins.list > /dev/null

# Install Jenkins
sudo apt update
sudo apt install -y jenkins

# Start and enable Jenkins
sudo systemctl start jenkins
sudo systemctl enable jenkins
sudo systemctl status jenkins
```

#### 3. Get Initial Admin Password

```bash
sudo cat /var/lib/jenkins/secrets/initialAdminPassword
```

Save this password for the setup wizard.

## Configuration

### 1. Access Jenkins UI

Navigate to `http://localhost:8080` (or your server IP) and complete the setup wizard using the initial admin password.

### 2. Install Required Plugins

Install these plugins through **Manage Jenkins → Plugins**:

- Git plugin (for repository integration)
- Pipeline plugin (for Jenkinsfile support)
- NodeJS plugin (for Node.js builds)
- HTML Publisher plugin (for coverage reports)
- Slack Notification plugin (optional, for notifications)

### 3. Configure Node.js

1. Go to **Manage Jenkins → Tools**
2. Scroll to **NodeJS**
3. Click **Add NodeJS**
4. Name: `NodeJS-20`
5. Version: Select Node.js 20.x
6. Save

### 4. Configure Slack (Optional)

If you want Slack notifications:

1. Create a Slack webhook URL for your workspace
2. Go to **Manage Jenkins → Configure System**
3. Find **Slack** section
4. Add your workspace and credentials
5. Uncomment Slack notification blocks in Jenkinsfiles

## Pipeline Setup

### CI Pipeline Job

1. Click **New Item**
2. Name: `RecursiveManager-CI`
3. Type: **Pipeline**
4. Under **Pipeline** section:
   - Definition: **Pipeline script from SCM**
   - SCM: **Git**
   - Repository URL: `https://github.com/aaron777collins/RecursiveManager.git`
   - Script Path: `Jenkinsfile.ci`
5. Under **Build Triggers**:
   - Check **GitHub hook trigger for GITScm polling**
6. Save

### Release Pipeline Job

1. Click **New Item**
2. Name: `RecursiveManager-Release`
3. Type: **Pipeline**
4. Under **Pipeline** section:
   - Definition: **Pipeline script from SCM**
   - SCM: **Git**
   - Repository URL: `https://github.com/aaron777collins/RecursiveManager.git`
   - Script Path: `Jenkinsfile.release`
5. Save

### Nightly Pipeline Job

1. Click **New Item**
2. Name: `RecursiveManager-Nightly`
3. Type: **Pipeline**
4. Under **Pipeline** section:
   - Definition: **Pipeline script from SCM**
   - SCM: **Git**
   - Repository URL: `https://github.com/aaron777collins/RecursiveManager.git`
   - Script Path: `Jenkinsfile.nightly`
5. The cron trigger is defined in the Jenkinsfile itself
6. Save

## GitHub Integration

### Webhook Setup

1. Go to your GitHub repository: `https://github.com/aaron777collins/RecursiveManager`
2. Navigate to **Settings → Webhooks → Add webhook**
3. Payload URL: `https://jenkins.aaroncollins.info/github-webhook/`
4. Content type: `application/json`
5. Select events:
   - **Push events**
   - **Pull request events**
6. Click **Add webhook**

### GitHub Credentials

1. Create a GitHub Personal Access Token:
   - Go to GitHub **Settings → Developer settings → Personal access tokens**
   - Generate new token with `repo` scope
2. In Jenkins, go to **Manage Jenkins → Credentials**
3. Add new credentials:
   - Kind: **Username with password**
   - Username: Your GitHub username
   - Password: Your personal access token
   - ID: `github-credentials`

## Pipeline Stages

### CI Pipeline (`Jenkinsfile.ci`)

1. **Checkout**: Clones the repository
2. **Install Dependencies**: Runs `npm install`
3. **Lint**: Runs `npm run lint`
4. **Type Check**: Runs `npm run type-check`
5. **Build**: Runs `npm run build`
6. **Test**: Runs `npm test`
7. **Test Coverage**: Runs `npm run test:coverage`
8. **Archive Results**: Publishes test results and coverage reports

### Release Pipeline (`Jenkinsfile.release`)

1. **Run CI**: Triggers the CI pipeline and waits for completion
2. **Install Dependencies**: Runs `npm install`
3. **Build Production**: Runs `npm run build`
4. **Security Scan**: Runs `npm audit --production`
5. **Create Release Artifacts**: Archives build artifacts and creates tarballs
6. **Tag Release**: Creates git tags (requires git credentials)

### Nightly Pipeline (`Jenkinsfile.nightly`)

Runs automatically at 2 AM daily:

1. **Checkout**: Clones the repository
2. **Install Dependencies**: Runs `npm install`
3. **Full Test Suite**: Runs comprehensive tests with coverage
4. **Type Check**: Verifies TypeScript types
5. **Lint Check**: Checks code style
6. **Build Check**: Verifies the build works
7. **Dependency Check**: Runs `npm outdated` and `npm audit`
8. **Generate Reports**: Publishes coverage and test reports

## HTTPS Setup with Caddy

### Caddy Configuration

Add this to your Caddyfile:

```
jenkins.aaroncollins.info {
    reverse_proxy localhost:8080

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
    }

    # Let's Encrypt automatic HTTPS
    tls {
        protocols tls1.2 tls1.3
    }
}
```

### Reload Caddy

```bash
sudo systemctl reload caddy
```

### Verify DNS

Ensure DNS points to your server:

```bash
dig jenkins.aaroncollins.info +short
```

### Test HTTPS Access

```bash
curl -I https://jenkins.aaroncollins.info
```

## Troubleshooting

### Jenkins Won't Start

Check the service status and logs:

```bash
sudo systemctl status jenkins
sudo journalctl -u jenkins -n 50
```

Common issues:
- Port 8080 already in use
- Insufficient permissions on `/var/lib/jenkins`
- Java not installed or wrong version

### Build Failures

1. Check the console output in Jenkins UI
2. Verify Node.js version matches requirements
3. Ensure all dependencies are installable
4. Check for TypeScript errors with `npm run type-check`

### GitHub Webhook Not Triggering

1. Verify webhook is configured correctly in GitHub
2. Check Jenkins is accessible from internet
3. Review webhook delivery attempts in GitHub settings
4. Ensure **GitHub hook trigger for GITScm polling** is enabled

### Coverage Reports Not Showing

1. Verify tests generate coverage output
2. Check coverage directory exists after test run
3. Ensure HTML Publisher plugin is installed
4. Review Jenkins job configuration for publishHTML step

## Backup and Maintenance

### Backup Jenkins

Use the backup script in `~/repos/webstack/jenkins/backup-jenkins.sh`:

```bash
#!/bin/bash
# Backup Jenkins data
BACKUP_DIR="/backup/jenkins/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
sudo systemctl stop jenkins
sudo tar -czf "$BACKUP_DIR/jenkins-home.tar.gz" /var/lib/jenkins/
sudo systemctl start jenkins
echo "Backup created: $BACKUP_DIR/jenkins-home.tar.gz"
```

Make it executable:

```bash
chmod +x ~/repos/webstack/jenkins/backup-jenkins.sh
```

### Regular Maintenance

- **Weekly**: Review failed builds and fix issues
- **Monthly**: Update Jenkins and plugins
- **Quarterly**: Review and update security settings
- **As needed**: Clean up old build artifacts

## Security Best Practices

1. **Keep Jenkins Updated**: Regularly update Jenkins and all plugins
2. **Use HTTPS**: Always access Jenkins over HTTPS (via Caddy)
3. **Limit Access**: Configure authentication and authorization
4. **Secure Credentials**: Use Jenkins credentials store, never hardcode secrets
5. **Enable CSRF Protection**: Enabled by default, don't disable
6. **Regular Backups**: Automate Jenkins home directory backups
7. **Audit Logs**: Review Jenkins audit logs periodically

## Additional Resources

- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [Pipeline Syntax Reference](https://www.jenkins.io/doc/book/pipeline/syntax/)
- [Jenkins Best Practices](https://www.jenkins.io/doc/book/pipeline/pipeline-best-practices/)
- [NodeJS Plugin Documentation](https://plugins.jenkins.io/nodejs/)

## Support

For issues specific to RecursiveManager's Jenkins setup:

1. Check this documentation
2. Review build logs in Jenkins UI
3. Consult the main [README.md](../README.md)
4. Open an issue on GitHub
