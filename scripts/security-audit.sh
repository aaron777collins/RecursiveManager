#!/bin/bash
set -e

# Security Audit Script for RecursiveManager
# Runs comprehensive security checks including dependency vulnerabilities,
# code scanning, and security best practices validation

echo "=========================================="
echo "RecursiveManager Security Audit"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track audit results
AUDIT_PASSED=true

# Function to print section headers
print_section() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

# Function to print results
print_result() {
    if [ "$1" == "PASS" ]; then
        echo -e "${GREEN}✓ $2${NC}"
    elif [ "$1" == "FAIL" ]; then
        echo -e "${RED}✗ $2${NC}"
        AUDIT_PASSED=false
    else
        echo -e "${YELLOW}⚠ $2${NC}"
    fi
}

# 1. NPM Audit - Check for known vulnerabilities in dependencies
print_section "1. NPM Dependency Vulnerability Scan"
echo "Checking for known vulnerabilities in npm packages..."
if npm audit --audit-level=moderate > /tmp/npm-audit.txt 2>&1; then
    print_result "PASS" "No known vulnerabilities found in dependencies"
    echo "   Total dependencies: $(npm list --depth=0 2>/dev/null | grep -c '├─\|└─' || echo '0')"
else
    print_result "FAIL" "Vulnerabilities found in dependencies"
    echo ""
    cat /tmp/npm-audit.txt
    echo ""
    echo "Run 'npm audit fix' to automatically fix vulnerabilities"
fi

# 2. Outdated Dependencies - Check for outdated packages
print_section "2. Outdated Dependencies Check"
echo "Checking for outdated dependencies..."
OUTDATED_COUNT=$(npm outdated --json 2>/dev/null | grep -c '"current"' || echo "0")
if [ "$OUTDATED_COUNT" -eq 0 ]; then
    print_result "PASS" "All dependencies are up to date"
else
    print_result "WARN" "$OUTDATED_COUNT outdated dependencies found"
    echo "   Run 'npm outdated' for details"
    echo "   Run 'npm update' to update dependencies"
fi

# 3. Check for sensitive files
print_section "3. Sensitive Files Check"
echo "Checking for accidentally committed sensitive files..."
SENSITIVE_FILES=0

# Check for common sensitive files/patterns
if [ -f ".env" ] && grep -q "^[A-Z_]*KEY=" .env 2>/dev/null; then
    if git ls-files --error-unmatch .env >/dev/null 2>&1; then
        print_result "FAIL" ".env file with keys is tracked by git"
        SENSITIVE_FILES=$((SENSITIVE_FILES + 1))
    else
        print_result "PASS" ".env file exists but is not tracked by git"
    fi
fi

# Check for other sensitive patterns
SENSITIVE_PATTERNS=(
    "*.pem"
    "*.key"
    "*.p12"
    "*.pfx"
    "*_rsa"
    "*_dsa"
    "*_ecdsa"
    "*id_ed25519"
    "credentials.json"
    "secrets.json"
)

for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git ls-files | grep -q "$pattern" 2>/dev/null; then
        print_result "WARN" "Found potentially sensitive files matching: $pattern"
        SENSITIVE_FILES=$((SENSITIVE_FILES + 1))
    fi
done

if [ $SENSITIVE_FILES -eq 0 ]; then
    print_result "PASS" "No sensitive files found in git repository"
fi

# 4. Check .gitignore coverage
print_section "4. .gitignore Coverage Check"
echo "Checking .gitignore configuration..."
REQUIRED_IGNORES=(
    ".env"
    "node_modules"
    "dist"
    "*.log"
    ".DS_Store"
)

MISSING_IGNORES=0
for ignore_pattern in "${REQUIRED_IGNORES[@]}"; do
    if ! grep -q "^$ignore_pattern\$" .gitignore 2>/dev/null; then
        print_result "WARN" "Missing .gitignore entry: $ignore_pattern"
        MISSING_IGNORES=$((MISSING_IGNORES + 1))
    fi
done

if [ $MISSING_IGNORES -eq 0 ]; then
    print_result "PASS" "All required patterns in .gitignore"
fi

# 5. Check for hardcoded secrets in code
print_section "5. Hardcoded Secrets Scan"
echo "Scanning for hardcoded secrets in source code..."
SECRETS_FOUND=0

# Patterns that might indicate hardcoded secrets
SECRET_PATTERNS=(
    "password\s*=\s*['\"][^'\"]*['\"]"
    "api[_-]?key\s*=\s*['\"][^'\"]*['\"]"
    "secret\s*=\s*['\"][^'\"]*['\"]"
    "token\s*=\s*['\"][^'\"]*['\"]"
    "Bearer [A-Za-z0-9-_=]+"
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    MATCHES=$(grep -rni --include="*.ts" --include="*.js" -E "$pattern" packages/ cli/ 2>/dev/null | grep -v "test" | grep -v ".example" | wc -l || echo "0")
    if [ "$MATCHES" -gt 0 ]; then
        print_result "WARN" "Found $MATCHES potential hardcoded secrets matching pattern: $pattern"
        SECRETS_FOUND=$((SECRETS_FOUND + MATCHES))
    fi
done

if [ $SECRETS_FOUND -eq 0 ]; then
    print_result "PASS" "No obvious hardcoded secrets found in code"
else
    echo "   Review these matches to ensure they are test fixtures or examples"
fi

# 6. Check file permissions
print_section "6. File Permissions Check"
echo "Checking for overly permissive file permissions..."
PERMISSION_ISSUES=0

# Check for world-writable files
WORLD_WRITABLE=$(find . -type f -perm -002 2>/dev/null | grep -v node_modules | wc -l || echo "0")
if [ "$WORLD_WRITABLE" -gt 0 ]; then
    print_result "WARN" "Found $WORLD_WRITABLE world-writable files"
    PERMISSION_ISSUES=$((PERMISSION_ISSUES + 1))
fi

# Check script permissions
SCRIPTS_DIR="scripts"
if [ -d "$SCRIPTS_DIR" ]; then
    NON_EXECUTABLE=$(find "$SCRIPTS_DIR" -name "*.sh" ! -perm -u+x 2>/dev/null | wc -l || echo "0")
    if [ "$NON_EXECUTABLE" -gt 0 ]; then
        print_result "WARN" "Found $NON_EXECUTABLE shell scripts without execute permission"
        PERMISSION_ISSUES=$((PERMISSION_ISSUES + 1))
    fi
fi

if [ $PERMISSION_ISSUES -eq 0 ]; then
    print_result "PASS" "File permissions are appropriate"
fi

# 7. Check for TODO/FIXME security notes
print_section "7. Security TODO/FIXME Check"
echo "Checking for unresolved security TODOs..."
SECURITY_TODOS=$(grep -rni --include="*.ts" --include="*.js" -E "(TODO|FIXME).*security|security.*(TODO|FIXME)" packages/ cli/ 2>/dev/null | wc -l || echo "0")
if [ "$SECURITY_TODOS" -gt 0 ]; then
    print_result "WARN" "Found $SECURITY_TODOS unresolved security TODOs/FIXMEs"
    echo "   Review and resolve these before production deployment"
else
    print_result "PASS" "No unresolved security TODOs found"
fi

# 8. Check package.json for private flag (if applicable)
print_section "8. Package Configuration Check"
echo "Checking package.json security configuration..."
if grep -q '"private": *true' package.json 2>/dev/null; then
    print_result "PASS" "Package is marked as private (prevents accidental publishing)"
else
    print_result "WARN" "Package is not marked as private - consider adding '\"private\": true'"
fi

# 9. Check for eval/Function usage (code injection risks)
print_section "9. Dangerous Function Usage Check"
echo "Checking for potentially dangerous functions..."
EVAL_USAGE=$(grep -rni --include="*.ts" --include="*.js" -E "\beval\(|new Function\(" packages/ cli/ 2>/dev/null | grep -v "test" | wc -l || echo "0")
if [ "$EVAL_USAGE" -gt 0 ]; then
    print_result "WARN" "Found $EVAL_USAGE uses of eval() or new Function()"
    echo "   These can be security risks if used with untrusted input"
else
    print_result "PASS" "No dangerous eval/Function usage found"
fi

# 10. Summary
print_section "Security Audit Summary"
echo ""
if [ "$AUDIT_PASSED" = true ]; then
    echo -e "${GREEN}✓ Security audit PASSED${NC}"
    echo "No critical security issues detected"
    exit 0
else
    echo -e "${RED}✗ Security audit FAILED${NC}"
    echo "Critical security issues detected - review output above"
    exit 1
fi
