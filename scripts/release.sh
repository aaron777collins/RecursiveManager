#!/bin/bash
set -euo pipefail

# RecursiveManager Release Automation Script
# Automates the entire release process including:
# - Version bumping
# - Building binaries
# - Creating GitHub release
# - Uploading assets
# - Generating release notes
#
# Usage:
#   ./scripts/release.sh patch  # 1.0.0 → 1.0.1
#   ./scripts/release.sh minor  # 1.0.0 → 1.1.0
#   ./scripts/release.sh major  # 1.0.0 → 2.0.0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/dist/binaries"

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

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check for required commands
    for cmd in git gh node npm jq; do
        if ! command -v $cmd &> /dev/null; then
            log_error "$cmd not found. Please install it first."
            exit 1
        fi
    done

    # Check if on master branch
    local branch=$(git branch --show-current)
    if [ "$branch" != "master" ] && [ "$branch" != "main" ]; then
        log_error "Must be on master/main branch. Current: $branch"
        exit 1
    fi

    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        log_error "Uncommitted changes detected. Please commit or stash them."
        git status --short
        exit 1
    fi

    # Check GitHub authentication
    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI not authenticated. Run: gh auth login"
        exit 1
    fi

    log_info "Prerequisites check passed"
}

# Get current version
get_current_version() {
    node -p "require('$ROOT_DIR/package.json').version"
}

# Bump version
bump_version() {
    local bump_type=$1
    local current=$(get_current_version)

    log_step "Bumping version ($bump_type)..."
    log_info "Current version: v$current"

    cd "$ROOT_DIR"

    # Use npm version to bump
    local new_version=$(npm version $bump_type --no-git-tag-version --force | tr -d 'v')

    log_info "New version: v$new_version"
    echo "$new_version"
}

# Generate changelog
generate_changelog() {
    local version=$1
    local prev_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

    log_step "Generating changelog..."

    local changelog_file="$ROOT_DIR/RELEASE_NOTES_v${version}.md"

    cat > "$changelog_file" <<EOF
# RecursiveManager v$version

Released: $(date '+%Y-%m-%d')

## Changes

EOF

    if [ -n "$prev_tag" ]; then
        log_info "Comparing with previous tag: $prev_tag"

        # Get commits since last tag
        git log --pretty=format:"- %s" "$prev_tag"..HEAD >> "$changelog_file"
    else
        log_warn "No previous tag found. Showing recent commits."
        git log --pretty=format:"- %s" -n 10 >> "$changelog_file"
    fi

    echo "" >> "$changelog_file"
    echo "" >> "$changelog_file"
    echo "## Installation" >> "$changelog_file"
    echo "" >> "$changelog_file"
    echo '```bash' >> "$changelog_file"
    echo "curl -fsSL https://install.recursivemanager.com | bash" >> "$changelog_file"
    echo '```' >> "$changelog_file"
    echo "" >> "$changelog_file"
    echo "Or download binaries from the assets below." >> "$changelog_file"

    log_info "Changelog: $changelog_file"
    echo "$changelog_file"
}

# Build binaries
build_binaries() {
    log_step "Building binaries..."

    cd "$ROOT_DIR"

    # Run build script
    if ! ./scripts/build-binaries-simple.sh; then
        log_error "Binary build failed"
        exit 1
    fi

    log_info "Binaries built successfully"
}

# Create git tag
create_git_tag() {
    local version=$1

    log_step "Creating git tag v$version..."

    cd "$ROOT_DIR"

    # Commit version bump
    git add package.json RELEASE_NOTES_v${version}.md
    git commit -m "Release v$version

Automated release via scripts/release.sh

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

    # Create tag
    git tag -a "v$version" -m "Release v$version"

    log_info "Git tag created: v$version"
}

# Push to GitHub
push_to_github() {
    local version=$1

    log_step "Pushing to GitHub..."

    cd "$ROOT_DIR"

    # Push commits
    git push origin HEAD

    # Push tags
    git push origin "v$version"

    log_info "Pushed to GitHub"
}

# Create GitHub release
create_github_release() {
    local version=$1
    local changelog=$2

    log_step "Creating GitHub release..."

    cd "$ROOT_DIR"

    # Create release with binaries
    gh release create "v$version" \
        --title "v$version" \
        --notes-file "$changelog" \
        "$BUILD_DIR"/recursive-manager-v${version}-*.tar.gz \
        "$BUILD_DIR"/checksums.txt

    log_info "GitHub release created: v$version"
}

# Update version manifest
update_version_manifest() {
    local version=$1

    log_step "Updating version manifest..."

    local manifest_file="$ROOT_DIR/version-manifest.json"

    # Create or update manifest
    local manifest='{
  "latest": "'$version'",
  "versions": [
    {
      "version": "'$version'",
      "released": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "assets": {
        "linux": "recursive-manager-v'$version'-linux.tar.gz",
        "macos": "recursive-manager-v'$version'-macos.tar.gz",
        "windows": "recursive-manager-v'$version'-windows.tar.gz"
      }
    }
  ]
}'

    # If manifest exists, merge versions
    if [ -f "$manifest_file" ]; then
        local existing_versions=$(jq -r '.versions' "$manifest_file")
        manifest=$(echo "$manifest" | jq --argjson existing "$existing_versions" '.versions = [.versions[0]] + $existing')
    fi

    echo "$manifest" | jq . > "$manifest_file"

    log_info "Version manifest updated"

    # Commit manifest
    git add "$manifest_file"
    git commit -m "Update version manifest for v$version"
    git push origin HEAD
}

# Show release summary
show_summary() {
    local version=$1

    echo ""
    echo "══════════════════════════════════════"
    echo "  Release Complete! ✓"
    echo "══════════════════════════════════════"
    echo ""
    echo "Version: v$version"
    echo "Tag: v$version"
    echo "Release: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/v$version"
    echo ""
    echo "Binaries uploaded:"
    ls -1 "$BUILD_DIR"/*.tar.gz | xargs -n1 basename
    echo ""
    echo "Install command:"
    echo "  curl -fsSL https://install.recursivemanager.com | bash"
    echo ""
}

# Main release process
main() {
    local bump_type="${1:-}"

    if [ -z "$bump_type" ]; then
        log_error "Usage: $0 <patch|minor|major>"
        echo ""
        echo "Examples:"
        echo "  $0 patch  # 1.0.0 → 1.0.1"
        echo "  $0 minor  # 1.0.0 → 1.1.0"
        echo "  $0 major  # 1.0.0 → 2.0.0"
        echo ""
        exit 1
    fi

    if [ "$bump_type" != "patch" ] && [ "$bump_type" != "minor" ] && [ "$bump_type" != "major" ]; then
        log_error "Invalid bump type: $bump_type"
        log_info "Must be: patch, minor, or major"
        exit 1
    fi

    echo ""
    echo "══════════════════════════════════════"
    echo "  RecursiveManager Release Automation"
    echo "══════════════════════════════════════"
    echo ""

    # Check prerequisites
    check_prerequisites

    # Get current version and bump
    local current=$(get_current_version)
    local new_version=$(bump_version "$bump_type")

    echo ""
    echo "Release summary:"
    echo "  Current: v$current"
    echo "  New:     v$new_version"
    echo "  Type:    $bump_type"
    echo ""
    read -p "Proceed with release? [Y/n]: " confirm

    if [ -n "$confirm" ] && [ "$confirm" != "Y" ] && [ "$confirm" != "y" ]; then
        log_info "Release cancelled"
        # Revert version bump
        git checkout package.json
        exit 0
    fi
    echo ""

    # Execute release steps
    local changelog=$(generate_changelog "$new_version")
    build_binaries
    create_git_tag "$new_version"
    push_to_github "$new_version"
    create_github_release "$new_version" "$changelog"
    update_version_manifest "$new_version"

    show_summary "$new_version"
}

main "$@"
