#!/bin/bash
set -euo pipefail

# RecursiveManager Binary Installation Script
# Installs pre-built binaries with version selection and checksum verification
#
# Usage:
#   Interactive: curl -fsSL https://install.recursivemanager.com | bash
#   Headless:    VERSION=1.0.0 INSTALL_DIR=/opt/rm bash <(curl -fsSL https://install.recursivemanager.com)
#   One-liner:   curl -fsSL https://install.recursivemanager.com | bash

# Configuration (can be overridden via environment variables)
REPO_OWNER="${REPO_OWNER:-aaron777collins}"
REPO_NAME="${REPO_NAME:-RecursiveManager}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.recursivemanager}"
VERSION="${VERSION:-latest}"
GITHUB_API="https://api.github.com/repos/$REPO_OWNER/$REPO_NAME"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }
log_step() { echo -e "${BLUE}➜${NC} $1"; }

# Detect platform
detect_platform() {
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    case "$os" in
        linux*) echo "linux" ;;
        darwin*) echo "macos" ;;
        msys*|mingw*|cygwin*) echo "windows" ;;
        *) log_error "Unsupported OS: $os"; exit 1 ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js 18+ first."
        echo "  Visit: https://nodejs.org/"
        exit 1
    fi

    local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        log_error "Node.js 18+ required. Current: $(node -v)"
        exit 1
    fi

    log_info "Node.js $(node -v)"

    # Check required commands
    for cmd in curl tar; do
        if ! command -v $cmd &> /dev/null; then
            log_error "$cmd not found. Please install it first."
            exit 1
        fi
    done

    # Check for sha256sum or shasum
    if command -v sha256sum &> /dev/null; then
        SHA_CMD="sha256sum"
    elif command -v shasum &> /dev/null; then
        SHA_CMD="shasum -a 256"
    else
        log_warn "No checksum tool found (sha256sum/shasum). Skipping verification."
        SHA_CMD=""
    fi
}

# Get available versions from GitHub
get_versions() {
    log_step "Fetching available versions..."

    local releases=$(curl -fsSL "$GITHUB_API/releases" 2>/dev/null || echo "[]")

    if [ "$releases" = "[]" ]; then
        log_warn "Could not fetch releases from GitHub"
        return 1
    fi

    # Extract version tags (remove 'v' prefix)
    echo "$releases" | grep -oP '"tag_name":\s*"\Kv?[0-9]+\.[0-9]+\.[0-9]+"' | tr -d '"v' | head -10
}

# Interactive version selection
select_version() {
    local versions=$(get_versions)

    if [ $? -ne 0 ] || [ -z "$versions" ]; then
        log_warn "Using default version: latest"
        VERSION="latest"
        return
    fi

    echo ""
    echo "Available versions:"
    local i=1
    while IFS= read -r ver; do
        echo "  $i. v$ver"
        ((i++))
    done <<< "$versions"
    echo "  $i. latest"
    echo ""

    read -p "Select version (1-$i) [default: latest]: " selection

    if [ -z "$selection" ] || [ "$selection" = "$i" ]; then
        VERSION="latest"
    else
        VERSION=$(echo "$versions" | sed -n "${selection}p")
        if [ -z "$VERSION" ]; then
            log_warn "Invalid selection. Using latest."
            VERSION="latest"
        fi
    fi
}

# Interactive directory selection
select_directory() {
    echo ""
    echo "Installation directory: $INSTALL_DIR"
    read -p "Change directory? [y/N]: " change

    if [ "$change" = "y" ] || [ "$change" = "Y" ]; then
        read -p "Enter directory path: " custom_dir
        if [ -n "$custom_dir" ]; then
            INSTALL_DIR="$custom_dir"
        fi
    fi
}

# Download binary tarball
download_binary() {
    local platform=$(detect_platform)
    local version=$1
    local actual_version=$version

    # Resolve 'latest' to actual version number
    if [ "$version" = "latest" ]; then
        log_step "Resolving latest version..." >&2
        actual_version=$(curl -fsSL "$GITHUB_API/releases/latest" | grep -oP '"tag_name":\s*"\Kv?[0-9]+\.[0-9]+\.[0-9]+"' | tr -d '"v')
        if [ -z "$actual_version" ]; then
            log_error "Could not determine latest version" >&2
            exit 1
        fi
        log_info "Latest version: v$actual_version" >&2
    fi

    local tarball="recursivemanager-v${actual_version}-${platform}.tar.gz"
    local download_url="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v${actual_version}/$tarball"

    log_step "Downloading v$actual_version for $platform..." >&2

    local temp_dir=$(mktemp -d)
    cd "$temp_dir"

    if ! curl -fsSL -o "$tarball" "$download_url"; then
        log_error "Download failed: $download_url" >&2
        rm -rf "$temp_dir"
        exit 1
    fi

    log_info "Downloaded $tarball" >&2

    # Download and verify checksums
    if [ -n "$SHA_CMD" ]; then
        log_step "Verifying checksum..." >&2
        local checksum_url="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v${actual_version}/checksums.txt"

        if curl -fsSL -o "checksums.txt" "$checksum_url" 2>/dev/null; then
            if grep -q "$tarball" checksums.txt; then
                if grep "$tarball" checksums.txt | $SHA_CMD --check --status 2>/dev/null; then
                    log_info "Checksum verified ✓" >&2
                else
                    log_error "Checksum verification FAILED!" >&2
                    log_warn "File may be corrupted or tampered with." >&2
                    read -p "Continue anyway? [y/N]: " continue
                    if [ "$continue" != "y" ] && [ "$continue" != "Y" ]; then
                        rm -rf "$temp_dir"
                        exit 1
                    fi
                fi
            else
                log_warn "Checksum not found for $tarball. Skipping verification." >&2
            fi
        else
            log_warn "Checksums file not available. Skipping verification." >&2
        fi
    fi

    echo "$temp_dir/$tarball|$actual_version"
}

# Install binary
install_binary() {
    local tarball=$1
    local version=$2

    log_step "Installing to $INSTALL_DIR..."

    # Backup existing installation
    if [ -d "$INSTALL_DIR" ]; then
        local backup_dir="${INSTALL_DIR}.backup.$(date +%Y%m%d_%H%M%S)"
        log_warn "Backing up existing installation to $backup_dir"
        mv "$INSTALL_DIR" "$backup_dir"
    fi

    # Create installation directory
    mkdir -p "$INSTALL_DIR"

    # Extract tarball
    tar xzf "$tarball" -C "$INSTALL_DIR"
    log_info "Extracted files"

    # Make executable
    chmod +x "$INSTALL_DIR/recursivemanager" 2>/dev/null || true

    # Save version info
    echo "$version" > "$INSTALL_DIR/.version"

    # Try to create symlink in PATH
    local symlink_created=false
    for bin_dir in "/usr/local/bin" "$HOME/bin" "$HOME/.local/bin"; do
        if [ -d "$bin_dir" ] && [ -w "$bin_dir" ]; then
            ln -sf "$INSTALL_DIR/recursivemanager" "$bin_dir/recursivemanager"
            log_info "Created symlink in $bin_dir"
            symlink_created=true
            break
        fi
    done

    if [ "$symlink_created" = false ]; then
        log_warn "Could not create symlink automatically."
        log_info "Add to your PATH manually:"
        echo ""
        echo "  export PATH=\"$INSTALL_DIR:\$PATH\""
        echo ""
        echo "Add this line to your ~/.bashrc or ~/.zshrc"
    fi
}

# Main installation flow
main() {
    echo ""
    echo "══════════════════════════════════════"
    echo "  RecursiveManager Binary Installer"
    echo "══════════════════════════════════════"
    echo ""

    # Check if running interactively
    if [ -t 0 ] && [ -z "${CI:-}" ] && [ -z "${VERSION}" ]; then
        # Interactive mode
        log_info "Running in interactive mode"
        echo ""

        select_version
        select_directory

        echo ""
        echo "Installation summary:"
        echo "  Version:   $VERSION"
        echo "  Directory: $INSTALL_DIR"
        echo ""
        read -p "Proceed with installation? [Y/n]: " confirm

        if [ -n "$confirm" ] && [ "$confirm" != "Y" ] && [ "$confirm" != "y" ]; then
            log_info "Installation cancelled"
            exit 0
        fi
        echo ""
    else
        # Headless mode
        log_info "Running in headless mode"
        log_info "Version: $VERSION"
        log_info "Directory: $INSTALL_DIR"
        echo ""
    fi

    # Run installation steps
    check_prerequisites
    local result=$(download_binary "$VERSION")
    local tarball=$(echo "$result" | cut -d'|' -f1)
    local actual_version=$(echo "$result" | cut -d'|' -f2)
    install_binary "$tarball" "$actual_version"

    # Cleanup
    rm -rf "$(dirname "$tarball")"

    echo ""
    echo "══════════════════════════════════════"
    echo "  Installation Complete! ✓"
    echo "══════════════════════════════════════"
    echo ""
    echo "Installed: RecursiveManager v$actual_version"
    echo "Location:  $INSTALL_DIR"
    echo ""
    echo "Run 'recursivemanager --help' to get started"
    echo ""

    # Quick verification
    if command -v recursivemanager &> /dev/null; then
        log_info "Command 'recursivemanager' is in your PATH"
    else
        log_warn "Command 'recursivemanager' not found in PATH"
        echo "  Add $INSTALL_DIR to your PATH or use the full path:"
        echo "  $INSTALL_DIR/recursivemanager"
    fi
    echo ""
}

# Run main
main "$@"
