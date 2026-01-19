#!/bin/bash
# RecursiveManager Update Script
# Self-update mechanism via GitHub API with version management

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="aaron777collins/RecursiveManager"
GITHUB_API="https://api.github.com/repos/${GITHUB_REPO}"
VERSION_HISTORY_FILE="${HOME}/.recursive_manager_version_history"
BACKUP_DIR="${HOME}/.recursive_manager_backup"
INSTALL_DIR="${RECURSIVE_MANAGER_HOME:-${HOME}/.recursive-manager}"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo -e "${PURPLE}$1${NC}"
}

# Function to get current installed version
get_current_version() {
    if [[ -f "${INSTALL_DIR}/package.json" ]]; then
        grep -oP '"version":\s*"\K[^"]+' "${INSTALL_DIR}/package.json" | head -1
    else
        echo "unknown"
    fi
}

# Function to compare semantic versions
# Returns: 0 if v1 == v2, 1 if v1 > v2, 2 if v1 < v2
version_compare() {
    local v1=$1
    local v2=$2

    # Remove 'v' prefix if present
    v1=${v1#v}
    v2=${v2#v}

    # Split versions into arrays
    IFS='.' read -ra V1 <<< "$v1"
    IFS='.' read -ra V2 <<< "$v2"

    # Compare major, minor, patch
    for i in 0 1 2; do
        local num1=${V1[$i]:-0}
        local num2=${V2[$i]:-0}

        if ((num1 > num2)); then
            return 1
        elif ((num1 < num2)); then
            return 2
        fi
    done

    return 0
}

# Function to fetch latest release from GitHub
fetch_latest_release() {
    local response
    response=$(curl -s -f "${GITHUB_API}/releases/latest" 2>/dev/null) || {
        print_error "Failed to fetch release information from GitHub"
        return 1
    }

    echo "$response"
}

# Function to fetch all releases from GitHub
fetch_all_releases() {
    local response
    response=$(curl -s -f "${GITHUB_API}/releases" 2>/dev/null) || {
        print_error "Failed to fetch releases from GitHub"
        return 1
    }

    echo "$response"
}

# Function to extract version from release JSON
extract_version() {
    local json=$1
    echo "$json" | grep -oP '"tag_name":\s*"\K[^"]+' | head -1
}

# Function to extract tarball URL from release JSON
extract_tarball_url() {
    local json=$1
    echo "$json" | grep -oP '"tarball_url":\s*"\K[^"]+' | head -1
}

# Function to save version to history
save_version_history() {
    local version=$1
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Create history file if it doesn't exist
    if [[ ! -f "$VERSION_HISTORY_FILE" ]]; then
        echo "# RecursiveManager Version History" > "$VERSION_HISTORY_FILE"
    fi

    # Append version entry
    echo "${timestamp}|${version}" >> "$VERSION_HISTORY_FILE"

    # Keep only last 10 versions
    tail -n 11 "$VERSION_HISTORY_FILE" > "${VERSION_HISTORY_FILE}.tmp"
    mv "${VERSION_HISTORY_FILE}.tmp" "$VERSION_HISTORY_FILE"
}

# Function to get version history
get_version_history() {
    if [[ ! -f "$VERSION_HISTORY_FILE" ]]; then
        print_warning "No version history found"
        return
    fi

    print_header "Version History:"
    echo ""

    grep -v "^#" "$VERSION_HISTORY_FILE" | while IFS='|' read -r timestamp version; do
        echo "  ${version} - ${timestamp}"
    done
}

# Function to create backup
create_backup() {
    local version=$1
    local backup_path="${BACKUP_DIR}/${version}_$(date +%Y%m%d_%H%M%S)"

    print_info "Creating backup at ${backup_path}..."

    # Create backup directory
    mkdir -p "$backup_path"

    # Copy installation directory
    if [[ -d "$INSTALL_DIR" ]]; then
        cp -r "$INSTALL_DIR" "${backup_path}/installation"
    fi

    # Copy version history
    if [[ -f "$VERSION_HISTORY_FILE" ]]; then
        cp "$VERSION_HISTORY_FILE" "${backup_path}/version_history"
    fi

    print_success "Backup created successfully"
    echo "$backup_path"
}

# Function to restore from backup
restore_from_backup() {
    local backup_path=$1

    if [[ ! -d "$backup_path" ]]; then
        print_error "Backup directory not found: ${backup_path}"
        return 1
    fi

    print_info "Restoring from backup: ${backup_path}..."

    # Remove current installation
    if [[ -d "$INSTALL_DIR" ]]; then
        rm -rf "$INSTALL_DIR"
    fi

    # Restore installation
    if [[ -d "${backup_path}/installation" ]]; then
        cp -r "${backup_path}/installation" "$INSTALL_DIR"
    fi

    # Restore version history
    if [[ -f "${backup_path}/version_history" ]]; then
        cp "${backup_path}/version_history" "$VERSION_HISTORY_FILE"
    fi

    print_success "Restore completed successfully"
}

# Function to get latest backup
get_latest_backup() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        return 1
    fi

    local latest=$(ls -t "$BACKUP_DIR" 2>/dev/null | head -1)

    if [[ -n "$latest" ]]; then
        echo "${BACKUP_DIR}/${latest}"
        return 0
    fi

    return 1
}

# Function to clean old backups (keep last 5)
clean_old_backups() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        return
    fi

    local count=$(ls -1 "$BACKUP_DIR" 2>/dev/null | wc -l)

    if ((count > 5)); then
        print_info "Cleaning old backups (keeping last 5)..."
        ls -t "$BACKUP_DIR" | tail -n +6 | while read -r backup; do
            rm -rf "${BACKUP_DIR}/${backup}"
        done
        print_success "Old backups cleaned"
    fi
}

# Function to detect package manager
detect_package_manager() {
    if command -v pnpm &> /dev/null; then
        echo "pnpm"
    elif command -v yarn &> /dev/null; then
        echo "yarn"
    elif command -v npm &> /dev/null; then
        echo "npm"
    else
        print_error "No package manager found (npm, yarn, or pnpm required)"
        exit 1
    fi
}

# Function to install dependencies
install_dependencies() {
    local pkg_manager=$(detect_package_manager)

    print_info "Installing dependencies with ${pkg_manager}..."

    cd "$INSTALL_DIR"

    case "$pkg_manager" in
        pnpm)
            pnpm install --frozen-lockfile
            ;;
        yarn)
            yarn install --frozen-lockfile
            ;;
        npm)
            npm ci
            ;;
    esac
}

# Function to build project
build_project() {
    local pkg_manager=$(detect_package_manager)

    print_info "Building project with ${pkg_manager}..."

    cd "$INSTALL_DIR"

    case "$pkg_manager" in
        pnpm)
            pnpm build
            ;;
        yarn)
            yarn build
            ;;
        npm)
            npm run build
            ;;
    esac
}

# Function to download and extract release
download_release() {
    local version=$1
    local tarball_url=$2
    local temp_dir=$(mktemp -d)

    print_info "Downloading version ${version}..."

    # Download tarball
    if ! curl -L -s -f -o "${temp_dir}/release.tar.gz" "$tarball_url"; then
        print_error "Failed to download release"
        rm -rf "$temp_dir"
        return 1
    fi

    print_info "Extracting files..."

    # Extract tarball
    mkdir -p "${temp_dir}/extracted"
    tar -xzf "${temp_dir}/release.tar.gz" -C "${temp_dir}/extracted" --strip-components=1

    # Remove old installation (except data and config)
    if [[ -d "$INSTALL_DIR" ]]; then
        # Preserve data directories
        if [[ -d "${INSTALL_DIR}/data" ]]; then
            mv "${INSTALL_DIR}/data" "${temp_dir}/data_backup"
        fi

        # Preserve .env file
        if [[ -f "${INSTALL_DIR}/.env" ]]; then
            cp "${INSTALL_DIR}/.env" "${temp_dir}/.env_backup"
        fi

        # Remove old installation
        rm -rf "$INSTALL_DIR"
    fi

    # Move new installation
    mkdir -p "$(dirname "$INSTALL_DIR")"
    mv "${temp_dir}/extracted" "$INSTALL_DIR"

    # Restore data directories
    if [[ -d "${temp_dir}/data_backup" ]]; then
        mv "${temp_dir}/data_backup" "${INSTALL_DIR}/data"
    fi

    # Restore .env file
    if [[ -f "${temp_dir}/.env_backup" ]]; then
        cp "${temp_dir}/.env_backup" "${INSTALL_DIR}/.env"
    fi

    # Clean up
    rm -rf "$temp_dir"

    print_success "Download and extraction completed"
}

# Function to perform update
perform_update() {
    local target_version=$1
    local release_json=$2

    local current_version=$(get_current_version)

    print_header "RecursiveManager Update"
    echo ""
    print_info "Current version: ${current_version}"
    print_info "Target version:  ${target_version}"
    echo ""

    # Create backup
    local backup_path=$(create_backup "$current_version")

    # Get tarball URL
    local tarball_url=$(extract_tarball_url "$release_json")

    if [[ -z "$tarball_url" ]]; then
        print_error "Failed to get download URL"
        return 1
    fi

    # Download and extract
    if ! download_release "$target_version" "$tarball_url"; then
        print_error "Update failed, restoring from backup..."
        restore_from_backup "$backup_path"
        return 1
    fi

    # Install dependencies
    if ! install_dependencies; then
        print_error "Dependency installation failed, restoring from backup..."
        restore_from_backup "$backup_path"
        return 1
    fi

    # Build project
    if ! build_project; then
        print_error "Build failed, restoring from backup..."
        restore_from_backup "$backup_path"
        return 1
    fi

    # Save to history
    save_version_history "$target_version"

    # Clean old backups
    clean_old_backups

    echo ""
    print_success "Update completed successfully!"
    print_info "Updated from ${current_version} to ${target_version}"
    echo ""
    print_info "Backup saved at: ${backup_path}"
}

# Function to check for updates
check_for_updates() {
    print_header "Checking for updates..."
    echo ""

    local current_version=$(get_current_version)
    print_info "Current version: ${current_version}"

    local release_json=$(fetch_latest_release)
    if [[ -z "$release_json" ]]; then
        return 1
    fi

    local latest_version=$(extract_version "$release_json")
    print_info "Latest version:  ${latest_version}"
    echo ""

    version_compare "$current_version" "$latest_version"
    local comparison=$?

    if [[ $comparison -eq 2 ]]; then
        print_success "A new version is available!"
        echo ""
        print_info "Run 'recursive-manager update' to update"
        return 0
    elif [[ $comparison -eq 0 ]]; then
        print_success "You are running the latest version"
        return 0
    else
        print_warning "Your version is newer than the latest release"
        return 0
    fi
}

# Function to list available versions
list_versions() {
    print_header "Available Versions:"
    echo ""

    local releases_json=$(fetch_all_releases)
    if [[ -z "$releases_json" ]]; then
        return 1
    fi

    echo "$releases_json" | grep -oP '"tag_name":\s*"\K[^"]+' | while read -r version; do
        echo "  ${version}"
    done
}

# Function to rollback to previous version
rollback() {
    print_header "Rolling back to previous version..."
    echo ""

    local backup_path=$(get_latest_backup)

    if [[ -z "$backup_path" ]]; then
        print_error "No backup found to rollback to"
        print_info "You can install a specific version with: recursive-manager update <version>"
        return 1
    fi

    print_info "Found backup: ${backup_path}"

    # Extract version from backup path
    local backup_version=$(basename "$backup_path" | cut -d'_' -f1)

    print_warning "This will restore RecursiveManager to version ${backup_version}"
    read -p "Continue? (y/N) " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Rollback cancelled"
        return 0
    fi

    restore_from_backup "$backup_path"

    echo ""
    print_success "Rollback completed!"
    print_info "Restored to version ${backup_version}"
}

# Function to update to specific version
update_to_version() {
    local target_version=$1

    # Add 'v' prefix if not present
    if [[ ! "$target_version" =~ ^v ]]; then
        target_version="v${target_version}"
    fi

    print_info "Fetching release ${target_version}..."

    # Fetch specific release
    local release_json=$(curl -s -f "${GITHUB_API}/releases/tags/${target_version}" 2>/dev/null)

    if [[ -z "$release_json" ]]; then
        print_error "Version ${target_version} not found"
        print_info "Run 'recursive-manager update --list' to see available versions"
        return 1
    fi

    perform_update "$target_version" "$release_json"
}

# Function to update to latest version
update_to_latest() {
    local release_json=$(fetch_latest_release)
    if [[ -z "$release_json" ]]; then
        return 1
    fi

    local latest_version=$(extract_version "$release_json")
    local current_version=$(get_current_version)

    version_compare "$current_version" "$latest_version"
    local comparison=$?

    if [[ $comparison -eq 0 ]]; then
        print_success "Already running the latest version (${current_version})"
        return 0
    elif [[ $comparison -eq 1 ]]; then
        print_warning "Your version (${current_version}) is newer than the latest release (${latest_version})"
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 0
        fi
    fi

    perform_update "$latest_version" "$release_json"
}

# Main function
main() {
    local command=${1:-}

    case "$command" in
        --check)
            check_for_updates
            ;;
        --list)
            list_versions
            ;;
        --history)
            get_version_history
            ;;
        --help|-h)
            print_header "RecursiveManager Update Script"
            echo ""
            echo "Usage:"
            echo "  recursive-manager update              Update to latest version"
            echo "  recursive-manager update <version>    Update to specific version"
            echo "  recursive-manager update --check      Check for updates"
            echo "  recursive-manager update --list       List available versions"
            echo "  recursive-manager update --history    Show version history"
            echo "  recursive-manager rollback            Rollback to previous version"
            echo ""
            ;;
        "")
            update_to_latest
            ;;
        *)
            update_to_version "$command"
            ;;
    esac
}

# Handle rollback command
if [[ "${1:-}" == "rollback" ]]; then
    rollback
    exit $?
fi

main "$@"
