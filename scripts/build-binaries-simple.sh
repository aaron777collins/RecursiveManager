#!/bin/bash
set -euo pipefail

# RecursiveManager Simple Binary Build Script
# Creates executable wrapper scripts for the built packages

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/dist/binaries"
VERSION=$(node -p "require('$ROOT_DIR/package.json').version")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

log_info "Starting RecursiveManager binary build (v$VERSION)..."

# Create build directory
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

# Copy built packages
log_info "Copying built packages..."
cp -r "$ROOT_DIR/packages" "$BUILD_DIR/"
cp -r "$ROOT_DIR/node_modules" "$BUILD_DIR/"
cp "$ROOT_DIR/package.json" "$BUILD_DIR/"

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
sha256sum recursive-manager recursive-manager.cmd > checksums.txt

# Sign with GPG (if GPG_KEY_ID is set)
if [[ -n "${GPG_KEY_ID:-}" ]]; then
    log_info "Signing binaries with GPG..."
    gpg --default-key "$GPG_KEY_ID" --armor --detach-sign recursive-manager
    gpg --default-key "$GPG_KEY_ID" --armor --detach-sign recursive-manager.cmd
    gpg --default-key "$GPG_KEY_ID" --armor --detach-sign checksums.txt
    log_info "Signatures created ✓"
else
    log_warn "GPG_KEY_ID not set. Skipping GPG signatures."
fi

# Create tarballs for each platform
log_info "Creating tarballs..."
tar czf "recursive-manager-v${VERSION}-linux.tar.gz" \
    packages node_modules package.json recursive-manager checksums.txt *.asc 2>/dev/null || \
    tar czf "recursive-manager-v${VERSION}-linux.tar.gz" \
    packages node_modules package.json recursive-manager checksums.txt

tar czf "recursive-manager-v${VERSION}-macos.tar.gz" \
    packages node_modules package.json recursive-manager checksums.txt *.asc 2>/dev/null || \
    tar czf "recursive-manager-v${VERSION}-macos.tar.gz" \
    packages node_modules package.json recursive-manager checksums.txt

tar czf "recursive-manager-v${VERSION}-windows.tar.gz" \
    packages node_modules package.json recursive-manager.cmd checksums.txt *.asc 2>/dev/null || \
    tar czf "recursive-manager-v${VERSION}-windows.tar.gz" \
    packages node_modules package.json recursive-manager.cmd checksums.txt

log_info ""
log_info "=========================================="
log_info "Build complete! ✓"
log_info "=========================================="
log_info "Version: $VERSION"
log_info "Output directory: $BUILD_DIR"
log_info ""
log_info "Files created:"
ls -lh "$BUILD_DIR"/*.tar.gz
log_info ""
