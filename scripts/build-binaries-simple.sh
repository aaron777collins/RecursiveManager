#!/bin/bash
set -euo pipefail

# RecursiveManager Simple Binary Build Script
# Creates self-contained executables with only built code and runtime deps

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RELEASE_DIR="$ROOT_DIR/dist/release"
VERSION=$(node -p "require('$ROOT_DIR/package.json').version")

# Use temp directory to avoid conflicts
BUILD_DIR=$(mktemp -d)
trap "rm -rf $BUILD_DIR" EXIT

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "Starting RecursiveManager binary build (v$VERSION)..."
log_info "Using temp build directory: $BUILD_DIR"

# Create release directory
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Copy ONLY the built JavaScript files (dist directories)
log_info "Copying built packages..."
mkdir -p "$BUILD_DIR/packages"
for pkg in cli common core adapters scheduler; do
    if [ -d "$ROOT_DIR/packages/$pkg/dist" ]; then
        mkdir -p "$BUILD_DIR/packages/$pkg"
        cp -r "$ROOT_DIR/packages/$pkg/dist" "$BUILD_DIR/packages/$pkg/"
        cp "$ROOT_DIR/packages/$pkg/package.json" "$BUILD_DIR/packages/$pkg/"
    fi
done

# Copy root package.json
cp "$ROOT_DIR/package.json" "$BUILD_DIR/"

# Install ONLY production dependencies (no devDependencies)
log_info "Installing production dependencies..."
cd "$BUILD_DIR"
npm install --omit=dev --ignore-scripts --loglevel=error

# Verify node_modules was created
if [ ! -d "node_modules" ]; then
    log_error "npm install failed - node_modules not found"
    exit 1
fi

log_info "Installed $(ls -d node_modules/* | wc -l) packages"

# Create executable wrapper for Unix (Linux/macOS)
log_info "Creating Unix executable..."
cat > "$BUILD_DIR/recursive-manager" <<'EOF'
#!/usr/bin/env node
require('./packages/cli/dist/cli.js');
EOF
chmod +x "$BUILD_DIR/recursive-manager"

# Create executable wrapper for Windows
log_info "Creating Windows executable..."
cat > "$BUILD_DIR/recursive-manager.cmd" <<'EOF'
@echo off
node "%~dp0packages\cli\dist\cli.js" %*
EOF

# Generate checksums
log_info "Generating checksums..."
cd "$BUILD_DIR"
sha256sum recursive-manager recursive-manager.cmd > SHA256SUMS
cd "$ROOT_DIR"

# Create tarballs for each platform
log_info "Creating platform-specific tarballs..."

# Linux tarball
tar czf "$RELEASE_DIR/recursive-manager-v${VERSION}-linux.tar.gz" \
    -C "$BUILD_DIR" \
    packages node_modules package.json recursive-manager SHA256SUMS

# macOS tarball (same as Linux)
tar czf "$RELEASE_DIR/recursive-manager-v${VERSION}-macos.tar.gz" \
    -C "$BUILD_DIR" \
    packages node_modules package.json recursive-manager SHA256SUMS

# Windows tarball
tar czf "$RELEASE_DIR/recursive-manager-v${VERSION}-windows.tar.gz" \
    -C "$BUILD_DIR" \
    packages node_modules package.json recursive-manager.cmd SHA256SUMS

# Create checksums for release tarballs
log_info "Generating release checksums..."
cd "$RELEASE_DIR"
sha256sum *.tar.gz > checksums.txt

log_info ""
log_info "=========================================="
log_info "Build complete! ✓"
log_info "=========================================="
log_info "Version: $VERSION"
log_info "Output directory: $RELEASE_DIR"
log_info ""
log_info "Files created:"
ls -lh "$RELEASE_DIR"
log_info ""
log_info "Build directory will be cleaned up automatically."
