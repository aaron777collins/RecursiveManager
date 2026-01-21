#!/bin/bash
# Test installation in clean environment
# This script tests the RecursiveManager installation process using Docker

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored message
print_message() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

print_header() {
    echo ""
    print_message "$BLUE" "========================================"
    print_message "$BLUE" "$*"
    print_message "$BLUE" "========================================"
}

print_success() {
    print_message "$GREEN" "✓ $*"
}

print_error() {
    print_message "$RED" "✗ $*"
}

print_warning() {
    print_message "$YELLOW" "⚠ $*"
}

print_info() {
    print_message "$BLUE" "ℹ $*"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker to run these tests."
        print_info "Visit: https://docs.docker.com/get-docker/"
        exit 1
    fi
    print_success "Docker is installed"
}

# Test installation on Ubuntu
test_ubuntu_install() {
    print_header "Testing Installation on Ubuntu Latest"

    local exit_code=0

    docker run --rm ubuntu:latest bash -c "
        set -e

        # Install dependencies
        echo 'Installing dependencies...'
        apt-get update -qq && apt-get install -y -qq curl git > /dev/null 2>&1

        # Install Node.js
        echo 'Installing Node.js...'
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
        apt-get install -y -qq nodejs > /dev/null 2>&1

        # Verify Node.js installation
        node --version
        npm --version

        # Clone and install RecursiveManager
        echo 'Installing RecursiveManager...'
        cd /tmp
        git clone https://github.com/aaron777collins/RecursiveManager.git > /dev/null 2>&1
        cd RecursiveManager

        # Run headless install
        bash scripts/install.sh --headless --install-dir /opt/recursivemanager --skip-shell-config

        # Verify installation
        echo 'Verifying installation...'
        test -d /opt/recursivemanager || (echo 'Installation directory not found' && exit 1)

        # Check if CLI works (if built)
        if [ -f /opt/recursivemanager/packages/cli/dist/cli.js ]; then
            node /opt/recursivemanager/packages/cli/dist/cli.js --version || true
            node /opt/recursivemanager/packages/cli/dist/cli.js --help || true
        fi

        echo 'Installation test passed!'
    " || exit_code=$?

    if [ $exit_code -eq 0 ]; then
        print_success "Ubuntu installation test passed"
        return 0
    else
        print_error "Ubuntu installation test failed with exit code $exit_code"
        return 1
    fi
}

# Test installation on Debian
test_debian_install() {
    print_header "Testing Installation on Debian Latest"

    local exit_code=0

    docker run --rm debian:latest bash -c "
        set -e

        # Install dependencies
        echo 'Installing dependencies...'
        apt-get update -qq && apt-get install -y -qq curl git > /dev/null 2>&1

        # Install Node.js
        echo 'Installing Node.js...'
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
        apt-get install -y -qq nodejs > /dev/null 2>&1

        # Verify Node.js installation
        node --version
        npm --version

        # Clone and install RecursiveManager
        echo 'Installing RecursiveManager...'
        cd /tmp
        git clone https://github.com/aaron777collins/RecursiveManager.git > /dev/null 2>&1
        cd RecursiveManager

        # Run headless install
        bash scripts/install.sh --headless --install-dir /opt/recursivemanager --skip-shell-config

        # Verify installation
        echo 'Verifying installation...'
        test -d /opt/recursivemanager || (echo 'Installation directory not found' && exit 1)

        echo 'Installation test passed!'
    " || exit_code=$?

    if [ $exit_code -eq 0 ]; then
        print_success "Debian installation test passed"
        return 0
    else
        print_error "Debian installation test failed with exit code $exit_code"
        return 1
    fi
}

# Test local installation (without Docker)
test_local_install() {
    print_header "Testing Local Installation (Syntax Validation)"

    local exit_code=0

    # Test that install script has valid bash syntax
    print_info "Validating install.sh syntax..."
    if bash -n scripts/install.sh; then
        print_success "install.sh has valid syntax"
    else
        print_error "install.sh has syntax errors"
        exit_code=1
    fi

    # Test that uninstall script has valid bash syntax
    print_info "Validating uninstall.sh syntax..."
    if bash -n scripts/uninstall.sh; then
        print_success "uninstall.sh has valid syntax"
    else
        print_error "uninstall.sh has syntax errors"
        exit_code=1
    fi

    # Test that update script has valid bash syntax
    print_info "Validating update.sh syntax..."
    if bash -n scripts/update.sh; then
        print_success "update.sh has valid syntax"
    else
        print_error "update.sh has syntax errors"
        exit_code=1
    fi

    # Test that scripts are executable
    print_info "Checking file permissions..."
    if [ -x scripts/install.sh ] && [ -x scripts/uninstall.sh ] && [ -x scripts/update.sh ]; then
        print_success "All scripts are executable"
    else
        print_warning "Some scripts may not be executable"
    fi

    return $exit_code
}

# Test headless mode options
test_headless_options() {
    print_header "Testing Headless Mode Options"

    local exit_code=0

    print_info "Testing install.sh --help flag..."
    if bash scripts/install.sh --help > /dev/null 2>&1; then
        print_success "install.sh help flag works"
    else
        print_error "install.sh help flag failed"
        exit_code=1
    fi

    print_info "Testing uninstall.sh --help flag..."
    if bash scripts/uninstall.sh --help > /dev/null 2>&1; then
        print_success "uninstall.sh help flag works"
    else
        print_error "uninstall.sh help flag failed"
        exit_code=1
    fi

    print_info "Testing update.sh --help flag..."
    if bash scripts/update.sh --help > /dev/null 2>&1; then
        print_success "update.sh help flag works"
    else
        print_error "update.sh help flag failed"
        exit_code=1
    fi

    if [ $exit_code -eq 0 ]; then
        print_success "Headless options test passed"
    fi

    return $exit_code
}

# Main execution
main() {
    print_header "RecursiveManager Installation Test Suite"

    local failed_tests=0
    local total_tests=0

    # Check prerequisites
    check_docker

    # Test help and options
    total_tests=$((total_tests + 1))
    set +e  # Temporarily disable exit on error for tests
    test_headless_options
    local test1_result=$?
    set -e  # Re-enable exit on error
    if [ $test1_result -eq 0 ]; then
        print_success "Test 1/4: Headless options test passed"
    else
        print_error "Test 1/4: Headless options test failed"
        failed_tests=$((failed_tests + 1))
    fi

    # Test local installation
    total_tests=$((total_tests + 1))
    set +e  # Temporarily disable exit on error for tests
    test_local_install
    local test2_result=$?
    set -e  # Re-enable exit on error
    if [ $test2_result -eq 0 ]; then
        print_success "Test 2/4: Local installation test passed"
    else
        print_error "Test 2/4: Local installation test failed"
        failed_tests=$((failed_tests + 1))
    fi

    # Ask if user wants to run Docker tests (they take longer)
    print_info "Docker tests take several minutes due to image downloads and package installs."
    print_info "Note: Docker tests require the repository to be pushed to GitHub."

    if [ -t 0 ]; then
        read -p "Run Docker tests? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_warning "Skipping Docker tests"
            print_header "Test Results"
            print_info "Tests run: $total_tests"
            print_info "Tests failed: $failed_tests"

            if [ $failed_tests -eq 0 ]; then
                print_success "All local tests passed!"
                exit 0
            else
                print_error "Some tests failed"
                exit 1
            fi
        fi
    else
        # Non-interactive mode - skip Docker tests
        print_warning "Non-interactive mode detected, skipping Docker tests"
        print_header "Test Results"
        print_info "Tests run: $total_tests"
        print_info "Tests failed: $failed_tests"

        if [ $failed_tests -eq 0 ]; then
            print_success "All local tests passed!"
            exit 0
        else
            print_error "Some tests failed"
            exit 1
        fi
    fi

    # Test Ubuntu installation
    total_tests=$((total_tests + 1))
    set +e  # Temporarily disable exit on error for tests
    test_ubuntu_install
    local test3_result=$?
    set -e  # Re-enable exit on error
    if [ $test3_result -eq 0 ]; then
        print_success "Test 3/4: Ubuntu installation test passed"
    else
        print_error "Test 3/4: Ubuntu installation test failed"
        failed_tests=$((failed_tests + 1))
    fi

    # Test Debian installation
    total_tests=$((total_tests + 1))
    set +e  # Temporarily disable exit on error for tests
    test_debian_install
    local test4_result=$?
    set -e  # Re-enable exit on error
    if [ $test4_result -eq 0 ]; then
        print_success "Test 4/4: Debian installation test passed"
    else
        print_error "Test 4/4: Debian installation test failed"
        failed_tests=$((failed_tests + 1))
    fi

    # Print summary
    print_header "Test Results"
    print_info "Tests run: $total_tests"
    print_info "Tests failed: $failed_tests"

    if [ $failed_tests -eq 0 ]; then
        print_success "All tests passed!"
        exit 0
    else
        print_error "Some tests failed"
        exit 1
    fi
}

# Run main function
main "$@"
