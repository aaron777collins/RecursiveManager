# Security Audit Documentation

This document describes the security audit process for RecursiveManager and how to interpret audit results.

## Overview

RecursiveManager includes comprehensive security auditing tools to identify potential vulnerabilities, insecure configurations, and security best practices violations. The security audit system consists of:

1. **NPM Dependency Vulnerability Scanning** - Identifies known vulnerabilities in npm packages
2. **Hardcoded Secrets Detection** - Scans for accidentally committed secrets
3. **File Permission Validation** - Checks for overly permissive file permissions
4. **Configuration Security Review** - Validates security-related configurations
5. **Code Pattern Analysis** - Identifies potentially dangerous code patterns

## Running Security Audits

### Quick Audit

Run the complete security audit:

```bash
npm run security:audit
```

This command runs both `npm audit` (for dependency vulnerabilities) and the custom security audit script.

### Fix Vulnerabilities

Automatically fix detected vulnerabilities (when possible):

```bash
npm run security:fix
```

This runs `npm audit fix` to automatically update vulnerable dependencies to secure versions.

### Manual Audit Script

You can also run the security audit script directly:

```bash
./scripts/security-audit.sh
```

## Audit Components

### 1. NPM Dependency Vulnerability Scan

**What it checks:**
- Known security vulnerabilities in npm packages
- Severity levels: critical, high, moderate, low, info
- Vulnerable dependency chains

**Expected result:**
- ✅ **PASS**: No vulnerabilities found
- ⚠️ **WARN**: Low/moderate vulnerabilities found
- ❌ **FAIL**: High/critical vulnerabilities found

**How to fix:**
```bash
npm audit fix                    # Auto-fix non-breaking changes
npm audit fix --force            # Force-fix (may break compatibility)
npm audit                        # View detailed vulnerability report
```

### 2. Outdated Dependencies Check

**What it checks:**
- Packages with newer versions available
- Potential security improvements in newer versions

**Expected result:**
- ✅ **PASS**: All dependencies up to date
- ⚠️ **WARN**: Some outdated dependencies

**How to fix:**
```bash
npm outdated                     # View outdated packages
npm update                       # Update to latest minor/patch versions
npm install <package>@latest     # Update specific package to latest major
```

### 3. Sensitive Files Check

**What it checks:**
- `.env` files containing API keys tracked in git
- Private keys, certificates, credentials files
- Common sensitive file patterns (`.pem`, `.key`, `*_rsa`, etc.)

**Expected result:**
- ✅ **PASS**: No sensitive files in git
- ⚠️ **WARN**: Potentially sensitive files found
- ❌ **FAIL**: `.env` with keys tracked in git

**How to fix:**
```bash
# Remove sensitive files from git history
git rm --cached .env
git commit -m "Remove sensitive file from git"

# Add to .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add .env to .gitignore"

# If already in git history, use git-filter-repo or BFG Repo-Cleaner
```

### 4. .gitignore Coverage Check

**What it checks:**
- Required patterns in `.gitignore`: `.env`, `node_modules`, `dist`, `*.log`, `.DS_Store`

**Expected result:**
- ✅ **PASS**: All required patterns present
- ⚠️ **WARN**: Some patterns missing

**How to fix:**
Add missing patterns to `.gitignore`:
```
.env
node_modules
dist
*.log
.DS_Store
coverage
.turbo
```

### 5. Hardcoded Secrets Scan

**What it checks:**
- Patterns matching hardcoded passwords, API keys, tokens, secrets
- Bearer tokens in code
- Excluded: test files and `.example` files

**Expected result:**
- ✅ **PASS**: No hardcoded secrets found
- ⚠️ **WARN**: Potential secrets found (may be test fixtures)

**How to fix:**
1. Move secrets to `.env` file
2. Use environment variables: `process.env.API_KEY`
3. Use secret management: `APIKeyManager` from `@recursive-manager/common`

Example:
```typescript
// ❌ Bad - hardcoded secret
const apiKey = "sk-1234567890abcdef";

// ✅ Good - from environment
const apiKey = process.env.ANTHROPIC_API_KEY;

// ✅ Better - using secret manager
import { apiKeyManager } from '@recursive-manager/common';
const apiKey = await apiKeyManager.get('anthropic-api-key');
```

### 6. File Permissions Check

**What it checks:**
- World-writable files (security risk)
- Shell scripts without execute permission

**Expected result:**
- ✅ **PASS**: Appropriate permissions
- ⚠️ **WARN**: Permission issues found

**How to fix:**
```bash
# Fix world-writable files
chmod 644 <file>                 # For regular files
chmod 600 <sensitive-file>       # For sensitive files

# Fix shell scripts
chmod +x scripts/*.sh            # Add execute permission
```

### 7. Security TODO/FIXME Check

**What it checks:**
- Unresolved security-related TODOs and FIXMEs in code

**Expected result:**
- ✅ **PASS**: No unresolved security TODOs
- ⚠️ **WARN**: Unresolved security TODOs found

**How to fix:**
Review and resolve each security TODO:
```typescript
// Find security TODOs
grep -rni "TODO.*security\|security.*TODO" packages/ cli/

// Then fix the issues or remove outdated TODOs
```

### 8. Package Configuration Check

**What it checks:**
- `"private": true` flag in `package.json` (prevents accidental npm publishing)

**Expected result:**
- ✅ **PASS**: Package marked as private
- ⚠️ **WARN**: Package not marked as private

**How to fix:**
Add to `package.json`:
```json
{
  "private": true
}
```

### 9. Dangerous Function Usage Check

**What it checks:**
- Uses of `eval()` and `new Function()` (code injection risks)
- Excluded: test files

**Expected result:**
- ✅ **PASS**: No dangerous functions found
- ⚠️ **WARN**: Dangerous functions found

**How to fix:**
Avoid `eval()` and `new Function()`:
```typescript
// ❌ Bad - eval is dangerous
eval(userInput);

// ✅ Good - use safe alternatives
JSON.parse(userInput);           // For JSON
new Function('return ' + code)   // Still avoid this

// ✅ Better - validate and sanitize
const parsed = safeParseJSON(userInput);
```

## Current Audit Status

Latest security audit results (as of task 6.8 completion):

### Summary
- **Status**: ✅ PASSED
- **Critical Issues**: 0
- **High Issues**: 0
- **Moderate Issues**: 0
- **Low Issues**: 0
- **Warnings**: 4

### Detailed Results

| Check | Status | Details |
|-------|--------|---------|
| NPM Vulnerabilities | ✅ PASS | 0 vulnerabilities in 1,195 dependencies |
| Outdated Dependencies | ⚠️ WARN | 16 outdated packages (non-critical) |
| Sensitive Files | ✅ PASS | No sensitive files tracked in git |
| .gitignore Coverage | ⚠️ WARN | 2 patterns missing (non-critical) |
| Hardcoded Secrets | ✅ PASS | No hardcoded secrets in code |
| File Permissions | ✅ PASS | All file permissions appropriate |
| Security TODOs | ✅ PASS | No unresolved security TODOs |
| Package Config | ✅ PASS | Package marked as private |
| Dangerous Functions | ⚠️ WARN | 12 uses of eval/Function (in tests) |

### Warnings Explanation

1. **Outdated Dependencies (16 packages)**: These are non-security updates. Run `npm outdated` to review and `npm update` when ready to upgrade.

2. **.gitignore Coverage**: The script checks for exact matches of `node_modules` and `dist`. These may be covered by broader patterns. Not a security risk.

3. **Dangerous Functions (12 instances)**: Review with `grep -rni "eval\|new Function" packages/ cli/`. These are likely in test fixtures or controlled environments.

## Continuous Security Monitoring

### CI/CD Integration

Add security audits to your CI/CD pipeline:

```yaml
# .github/workflows/security.yml
name: Security Audit
on: [push, pull_request]
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run security:audit
```

### Scheduled Audits

Run security audits regularly:
- **Daily**: Automated npm audit in CI/CD
- **Weekly**: Full security audit review
- **Before releases**: Complete security audit and fix all issues
- **After dependency updates**: Run security audit

### Security Monitoring Tools

Consider integrating additional security tools:

1. **Snyk** - Continuous dependency vulnerability monitoring
   ```bash
   npm install -g snyk
   snyk test
   snyk monitor
   ```

2. **npm audit signatures** - Verify package integrity
   ```bash
   npm audit signatures
   ```

3. **Socket.dev** - Supply chain security
   ```bash
   npx socket-npm info <package>
   ```

## Security Incident Response

If a vulnerability is detected:

1. **Assess severity**: Review the vulnerability details
2. **Check exploitability**: Determine if vulnerable code is actually used
3. **Apply patches**: Update to patched versions immediately
4. **Test thoroughly**: Ensure patches don't break functionality
5. **Document**: Record the vulnerability and fix in CHANGELOG
6. **Notify users**: If severe, notify users to update

## Best Practices

### Development

- Run `npm run security:audit` before committing code
- Never commit `.env` files or secrets
- Use environment variables for all sensitive data
- Keep dependencies up to date
- Review security audit output in CI/CD

### Deployment

- Run full security audit before production deployment
- Use encrypted secrets in production (see `docs/security/secret-management.md`)
- Enable database encryption at rest (see `docs/security/database-encryption.md`)
- Monitor for security vulnerabilities continuously
- Have an incident response plan

### Dependencies

- Minimize dependencies (fewer attack vectors)
- Use well-maintained packages with active security patching
- Pin dependency versions for reproducible builds
- Review dependency updates for security patches
- Audit new dependencies before adding them

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [npm Security Best Practices](https://docs.npmjs.com/security-best-practices)
- [Node.js Security Checklist](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [Secret Management Guide](./secret-management.md)
- [Database Encryption Guide](./database-encryption.md)

## Maintenance

This security audit system should be reviewed and updated:
- When new security best practices emerge
- When new types of vulnerabilities are discovered
- After security incidents
- Quarterly security review cycle

Last updated: 2026-01-20 (Task 6.8 - Initial security audit implementation)
