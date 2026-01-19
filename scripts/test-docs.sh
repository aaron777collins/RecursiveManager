#!/bin/bash
# Test documentation builds correctly
# This script validates the MkDocs documentation configuration and build process

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

print_success() {
    print_color "$GREEN" "✓ $*"
}

print_error() {
    print_color "$RED" "✗ $*"
}

print_info() {
    print_color "$BLUE" "ℹ $*"
}

print_warning() {
    print_color "$YELLOW" "⚠ $*"
}

# Track test results
TESTS_RUN=0
TESTS_FAILED=0

run_test() {
    local test_name="$1"
    shift
    TESTS_RUN=$((TESTS_RUN + 1))

    print_info "Running test: $test_name"

    set +e
    "$@"
    local exit_code=$?
    set -e

    if [ $exit_code -eq 0 ]; then
        print_success "$test_name passed"
        return 0
    else
        print_error "$test_name failed (exit code: $exit_code)"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# Main test function
main() {
    print_info "RecursiveManager Documentation Test Suite"
    echo ""

    # Get script directory and project root
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

    cd "$PROJECT_ROOT"

    print_info "Project root: $PROJECT_ROOT"
    echo ""

    # Test 1: Check Python installation
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test 1: Checking Python installation"
    print_info "═══════════════════════════════════════════════════════════"

    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed"
        print_info "Install Python 3 to run documentation tests"
        exit 1
    fi

    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    print_success "Python 3 found: $PYTHON_VERSION"
    echo ""

    # Test 2: Check pip installation
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test 2: Checking pip installation"
    print_info "═══════════════════════════════════════════════════════════"

    if ! command -v pip3 &> /dev/null; then
        print_error "pip3 is not installed"
        print_info "Install pip3 to run documentation tests"
        exit 1
    fi

    PIP_VERSION=$(pip3 --version | cut -d' ' -f2)
    print_success "pip3 found: $PIP_VERSION"
    echo ""

    # Test 3: Check required files exist
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test 3: Checking required documentation files"
    print_info "═══════════════════════════════════════════════════════════"

    local required_files=(
        "mkdocs.yml"
        "docs/requirements.txt"
        "docs/index.md"
        "docs/stylesheets/extra.css"
        "docs/assets/icon-white.svg"
    )

    local all_files_exist=true
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            print_success "Found: $file"
        else
            print_error "Missing: $file"
            all_files_exist=false
        fi
    done

    if [ "$all_files_exist" = false ]; then
        print_error "Some required documentation files are missing"
        exit 1
    fi
    echo ""

    # Test 4: Install MkDocs dependencies
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test 4: Installing MkDocs dependencies"
    print_info "═══════════════════════════════════════════════════════════"

    if ! run_test "pip install" pip3 install -q -r docs/requirements.txt; then
        print_error "Failed to install MkDocs dependencies"
        exit 1
    fi
    echo ""

    # Test 5: Validate mkdocs.yml syntax
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test 5: Validating mkdocs.yml configuration"
    print_info "═══════════════════════════════════════════════════════════"

    if ! command -v mkdocs &> /dev/null; then
        print_error "MkDocs is not installed"
        print_info "Run: pip3 install -r docs/requirements.txt"
        exit 1
    fi

    MKDOCS_VERSION=$(mkdocs --version | cut -d' ' -f3 | cut -d',' -f1)
    print_success "MkDocs found: $MKDOCS_VERSION"

    # Try to load the configuration
    if python3 -c "import yaml; yaml.safe_load(open('mkdocs.yml'))" 2>/dev/null; then
        print_success "mkdocs.yml syntax is valid"
    else
        print_error "mkdocs.yml has syntax errors"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
    echo ""

    # Test 6: Check for broken navigation links
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test 6: Checking navigation links in mkdocs.yml"
    print_info "═══════════════════════════════════════════════════════════"

    local broken_links=false

    # Extract markdown file paths from mkdocs.yml nav section
    local nav_files=$(python3 -c "
import yaml
with open('mkdocs.yml', 'r') as f:
    config = yaml.safe_load(f)

def extract_files(item):
    files = []
    if isinstance(item, dict):
        for value in item.values():
            if isinstance(value, str) and value.endswith('.md'):
                files.append(value)
            elif isinstance(value, list):
                for subitem in value:
                    files.extend(extract_files(subitem))
    elif isinstance(item, list):
        for subitem in item:
            files.extend(extract_files(subitem))
    return files

nav = config.get('nav', [])
files = extract_files(nav)
for f in files:
    print(f)
" 2>/dev/null || echo "")

    if [ -z "$nav_files" ]; then
        print_warning "Could not extract navigation files from mkdocs.yml"
    else
        while IFS= read -r nav_file; do
            if [ -f "docs/$nav_file" ]; then
                print_success "Found: docs/$nav_file"
            else
                print_error "Missing: docs/$nav_file"
                broken_links=true
            fi
        done <<< "$nav_files"
    fi

    if [ "$broken_links" = true ]; then
        print_error "Some navigation links point to missing files"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_RUN=$((TESTS_RUN + 1))
    echo ""

    # Test 7: Build documentation (normal mode)
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test 7: Building documentation (normal mode)"
    print_info "═══════════════════════════════════════════════════════════"

    # Clean previous build
    if [ -d "site" ]; then
        rm -rf site
        print_info "Cleaned previous build directory"
    fi

    if run_test "mkdocs build" mkdocs build 2>&1 | tee /tmp/mkdocs-build.log; then
        if [ -d "site" ]; then
            print_success "Documentation site built successfully"
            print_info "Output directory: site/"

            # Check for key files in build output
            local key_files=(
                "site/index.html"
                "site/installation/index.html"
                "site/quick-start/index.html"
                "site/stylesheets/extra.css"
                "site/assets/icon-white.svg"
            )

            for file in "${key_files[@]}"; do
                if [ -f "$file" ]; then
                    print_success "Generated: $file"
                else
                    print_warning "Missing: $file"
                fi
            done
        else
            print_error "Build completed but site directory not found"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        cat /tmp/mkdocs-build.log
    fi
    echo ""

    # Test 8: Build documentation (strict mode)
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test 8: Building documentation (strict mode)"
    print_info "═══════════════════════════════════════════════════════════"

    # Clean previous build
    rm -rf site

    if run_test "mkdocs build --strict" mkdocs build --strict 2>&1 | tee /tmp/mkdocs-strict.log; then
        print_success "Documentation builds without warnings in strict mode"
    else
        print_error "Documentation has warnings or errors in strict mode"
        cat /tmp/mkdocs-strict.log
    fi
    echo ""

    # Test 9: Check for common documentation issues
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test 9: Checking for common documentation issues"
    print_info "═══════════════════════════════════════════════════════════"

    local issues_found=false

    # Check for TODO markers
    if grep -r "TODO" docs/ --include="*.md" > /dev/null 2>&1; then
        print_warning "Found TODO markers in documentation:"
        grep -r "TODO" docs/ --include="*.md" | head -n 5
        issues_found=true
    else
        print_success "No TODO markers found"
    fi

    # Check for broken relative links (basic check)
    if grep -r "\](\.\./" docs/ --include="*.md" > /dev/null 2>&1; then
        print_warning "Found relative links that might be broken:"
        grep -r "\](\.\./" docs/ --include="*.md" | head -n 5
        print_info "Verify these links work correctly"
    else
        print_success "No suspicious relative links found"
    fi

    # Check for placeholder text
    if grep -ri "lorem ipsum\|placeholder\|coming soon" docs/ --include="*.md" > /dev/null 2>&1; then
        print_warning "Found placeholder text in documentation"
        issues_found=true
    else
        print_success "No placeholder text found"
    fi

    if [ "$issues_found" = true ]; then
        print_info "Some documentation quality issues found (warnings only)"
    fi
    echo ""

    # Test 10: Validate HTML output (optional)
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test 10: Validating HTML output (optional)"
    print_info "═══════════════════════════════════════════════════════════"

    if command -v linkchecker &> /dev/null; then
        print_info "Running linkchecker on generated site..."
        if run_test "linkchecker" linkchecker site/index.html --check-extern --no-warnings; then
            print_success "No broken links found"
        else
            print_warning "linkchecker found some issues (check output above)"
        fi
    else
        print_info "linkchecker not installed - skipping HTML validation"
        print_info "Install with: pip3 install linkchecker"
    fi
    echo ""

    # Summary
    print_info "═══════════════════════════════════════════════════════════"
    print_info "Test Summary"
    print_info "═══════════════════════════════════════════════════════════"

    echo ""
    print_info "Tests run: $TESTS_RUN"

    if [ $TESTS_FAILED -eq 0 ]; then
        print_success "All tests passed! ✓"
        print_info ""
        print_info "Documentation is ready for deployment."
        print_info "To serve locally: mkdocs serve"
        print_info "To deploy to GitHub Pages: mkdocs gh-deploy"
        exit 0
    else
        print_error "$TESTS_FAILED test(s) failed"
        print_info ""
        print_info "Please fix the issues above before deploying documentation."
        exit 1
    fi
}

# Run main function
main "$@"
