#!/bin/bash
set -euo pipefail

# RecursiveManager Upgrade/Downgrade/Rollback Script
# Manages version updates with automatic backups
#
# Usage:
#   Upgrade to latest:     recursive-manager-upgrade
#   Upgrade to specific:   recursive-manager-upgrade 2.0.0
#   Downgrade:             recursive-manager-upgrade 1.0.0
#   Rollback:              recursive-manager-upgrade --rollback
#   List versions:         recursive-manager-upgrade --list

# Configuration
REPO_OWNER="${REPO_OWNER:-aaron777collins}"
REPO_NAME="${REPO_NAME:-RecursiveManager}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/.recursive-manager}"
BACKUP_DIR="$INSTALL_DIR/.backups"
VERSION_HISTORY="$INSTALL_DIR/.version_history"
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

# Get current version
get_current_version() {
    if [ -f "$INSTALL_DIR/.version" ]; then
        cat "$INSTALL_DIR/.version"
    else
        echo "unknown"
    fi
}

# Check if RecursiveManager is installed
check_installed() {
    if [ ! -d "$INSTALL_DIR" ]; then
        log_error "RecursiveManager not found in $INSTALL_DIR"
        log_info "Install it first using: curl -fsSL https://install.recursivemanager.com | bash"
        exit 1
    fi
}

# Get available versions
get_available_versions() {
    log_step "Fetching available versions..."
    local releases=$(curl -fsSL "$GITHUB_API/releases" 2>/dev/null || echo "[]")

    if [ "$releases" = "[]" ]; then
        log_error "Could not fetch releases from GitHub"
        return 1
    fi

    echo "$releases" | grep -oP '"tag_name":\s*"\Kv?[0-9]+\.[0-9]+\.[0-9]+"' | tr -d '"v'
}

# List installed version history
list_version_history() {
    echo ""
    echo "══════════════════════════════════════"
    echo "  Version History"
    echo "══════════════════════════════════════"
    echo ""

    local current=$(get_current_version)
    echo "Current version: v$current"
    echo ""

    if [ -f "$VERSION_HISTORY" ]; then
        echo "Previous versions:"
        cat "$VERSION_HISTORY" | while read -r line; do
            local ver=$(echo "$line" | cut -d'|' -f1)
            local date=$(echo "$line" | cut -d'|' -f2)
            echo "  • v$ver (installed: $date)"
        done
    else
        echo "No version history available"
    fi

    echo ""

    # List available backups
    if [ -d "$BACKUP_DIR" ] && [ -n "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
        echo "Available backups:"
        ls -1 "$BACKUP_DIR" | while read -r backup; do
            local ver=$(echo "$backup" | grep -oP 'v\K[0-9]+\.[0-9]+\.[0-9]+')
            if [ -n "$ver" ]; then
                echo "  • v$ver"
            fi
        done
    else
        echo "No backups available"
    fi
    echo ""
}

# Create backup of current installation
create_backup() {
    local current_version=$(get_current_version)

    log_step "Creating backup of v$current_version..."

    mkdir -p "$BACKUP_DIR"

    local backup_name="v${current_version}_$(date +%Y%m%d_%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"

    # Create tarball of current installation
    tar czf "$backup_path.tar.gz" -C "$INSTALL_DIR" \
        --exclude=".backups" \
        --exclude=".version_history" \
        . 2>/dev/null || true

    log_info "Backup created: $backup_name.tar.gz"
}

# Rollback to previous version
rollback() {
    log_step "Rolling back to previous version..."

    # Find most recent backup
    local latest_backup=$(ls -1t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -1)

    if [ -z "$latest_backup" ]; then
        log_error "No backups available to rollback to"
        exit 1
    fi

    local backup_version=$(echo "$latest_backup" | grep -oP 'v\K[0-9]+\.[0-9]+\.[0-9]+')
    log_info "Rolling back to v$backup_version..."

    # Create backup of current version before rollback
    create_backup

    # Remove current installation
    find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 \
        ! -name ".backups" \
        ! -name ".version_history" \
        -exec rm -rf {} +

    # Restore from backup
    tar xzf "$latest_backup" -C "$INSTALL_DIR"

    log_info "Rollback complete!"
    log_info "Current version: v$backup_version"
}

# Download specific version
download_version() {
    local version=$1
    local platform=$(detect_platform)
    local tarball="recursive-manager-v${version}-${platform}.tar.gz"
    local download_url="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v${version}/$tarball"

    log_step "Downloading v$version..."

    local temp_dir=$(mktemp -d)
    cd "$temp_dir"

    if ! curl -fsSL -o "$tarball" "$download_url"; then
        log_error "Download failed: $download_url"
        rm -rf "$temp_dir"
        exit 1
    fi

    log_info "Downloaded $tarball"

    # Verify checksums if available
    if command -v sha256sum &> /dev/null || command -v shasum &> /dev/null; then
        local checksum_url="https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/v${version}/checksums.txt"
        if curl -fsSL -o "checksums.txt" "$checksum_url" 2>/dev/null; then
            if command -v sha256sum &> /dev/null; then
                if grep "$tarball" checksums.txt | sha256sum --check --status 2>/dev/null; then
                    log_info "Checksum verified ✓"
                fi
            fi
        fi
    fi

    echo "$temp_dir/$tarball"
}

# Install downloaded version
install_version() {
    local tarball=$1
    local version=$2

    log_step "Installing v$version..."

    # Remove current installation (except backups and history)
    find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 \
        ! -name ".backups" \
        ! -name ".version_history" \
        -exec rm -rf {} +

    # Extract new version
    tar xzf "$tarball" -C "$INSTALL_DIR"

    # Update version file
    echo "$version" > "$INSTALL_DIR/.version"

    # Log to version history
    echo "$version|$(date '+%Y-%m-%d %H:%M:%S')" >> "$VERSION_HISTORY"

    log_info "Installation complete!"
}

# Upgrade/downgrade to specific version
upgrade_to_version() {
    local target_version=$1
    local current_version=$(get_current_version)

    # Resolve "latest"
    if [ "$target_version" = "latest" ]; then
        log_step "Resolving latest version..."
        target_version=$(curl -fsSL "$GITHUB_API/releases/latest" | grep -oP '"tag_name":\s*"\Kv?[0-9]+\.[0-9]+\.[0-9]+"' | tr -d '"v')
        if [ -z "$target_version" ]; then
            log_error "Could not determine latest version"
            exit 1
        fi
        log_info "Latest version: v$target_version"
    fi

    # Check if already on target version
    if [ "$current_version" = "$target_version" ]; then
        log_info "Already on v$target_version"
        exit 0
    fi

    echo ""
    echo "══════════════════════════════════════"
    echo "  Version Change"
    echo "══════════════════════════════════════"
    echo ""
    echo "Current: v$current_version"
    echo "Target:  v$target_version"
    echo ""

    # Determine if upgrade or downgrade
    if [ "$(printf '%s\n' "$target_version" "$current_version" | sort -V | head -1)" = "$current_version" ]; then
        log_info "Upgrading to newer version"
    else
        log_warn "Downgrading to older version"
    fi

    read -p "Continue? [Y/n]: " confirm
    if [ -n "$confirm" ] && [ "$confirm" != "Y" ] && [ "$confirm" != "y" ]; then
        log_info "Cancelled"
        exit 0
    fi
    echo ""

    # Create backup before upgrade/downgrade
    create_backup

    # Download and install target version
    local tarball=$(download_version "$target_version")
    install_version "$tarball" "$target_version"

    # Cleanup
    rm -rf "$(dirname "$tarball")"

    echo ""
    echo "══════════════════════════════════════"
    echo "  Complete! ✓"
    echo "══════════════════════════════════════"
    echo ""
    echo "Version changed: v$current_version → v$target_version"
    echo ""
}

# Show usage
show_usage() {
    echo ""
    echo "RecursiveManager Version Manager"
    echo ""
    echo "Usage:"
    echo "  recursive-manager-upgrade           Upgrade to latest version"
    echo "  recursive-manager-upgrade VERSION   Upgrade/downgrade to specific version"
    echo "  recursive-manager-upgrade --list    List version history and backups"
    echo "  recursive-manager-upgrade --rollback Rollback to previous version"
    echo ""
    echo "Examples:"
    echo "  recursive-manager-upgrade           # Upgrade to latest"
    echo "  recursive-manager-upgrade 2.0.0     # Upgrade to v2.0.0"
    echo "  recursive-manager-upgrade 1.0.0     # Downgrade to v1.0.0"
    echo "  recursive-manager-upgrade --rollback # Undo last change"
    echo ""
}

# Main
main() {
    # Parse arguments
    local target_version="latest"

    if [ $# -eq 0 ]; then
        target_version="latest"
    elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_usage
        exit 0
    elif [ "$1" = "--list" ] || [ "$1" = "-l" ]; then
        check_installed
        list_version_history
        exit 0
    elif [ "$1" = "--rollback" ] || [ "$1" = "-r" ]; then
        check_installed
        rollback
        exit 0
    else
        target_version=$1
    fi

    check_installed
    upgrade_to_version "$target_version"
}

main "$@"
