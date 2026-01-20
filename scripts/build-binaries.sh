#!/bin/bash
set -euo pipefail

# RecursiveManager Binary Build Script
# Builds standalone binaries for multiple platforms with checksums and GPG signatures

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$ROOT_DIR/dist/binaries"
VERSION=$(node -p "require('$ROOT_DIR/package.json').version")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check for Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js 18+ first."
        exit 1
    fi

    # Check for npm
    if ! command -v npm &> /dev/null; then
        log_error "npm not found. Please install npm first."
        exit 1
    fi

    # Check for @vercel/ncc (for bundling)
    if ! [ -f "$ROOT_DIR/node_modules/.bin/ncc" ]; then
        log_warn "@vercel/ncc not found. Installing locally..."
        cd "$ROOT_DIR" && npm install --save-dev @vercel/ncc
    fi

    log_info "Prerequisites check passed ✓"
}

# Build the project
build_project() {
    if [ -f "$ROOT_DIR/packages/cli/dist/cli.js" ]; then
        log_info "RecursiveManager already built, skipping build step..."
        return 0
    fi

    log_info "Building RecursiveManager..."
    cd "$ROOT_DIR"
    npm run build
    log_info "Build complete ✓"
}

# Create bundled binary using ncc
create_bundle() {
    local platform=$1
    local output_name=$2

    log_info "Creating bundle for $platform..."

    cd "$ROOT_DIR"

    # Bundle the CLI entry point with ncc
    "$ROOT_DIR/node_modules/.bin/ncc" build packages/cli/dist/cli.js \
        --out "$BUILD_DIR/bundle-$platform" \
        --minify \
        --target node18 \
        --license licenses.txt

    # Create executable wrapper script
    if [[ "$platform" == "win"* ]]; then
        # Windows batch file
        cat > "$BUILD_DIR/$output_name.bat" <<'EOBAT'
@echo off
node "%~dp0bundle-win\index.js" %*
EOBAT
        log_info "Created Windows executable: $output_name.bat"
    else
        # Unix shell script
        cat > "$BUILD_DIR/$output_name" <<'EOSH'
#!/bin/sh
exec node "$(dirname "$0")/bundle-$(uname -s | tr '[:upper:]' '[:lower:]')/index.js" "$@"
EOSH
        chmod +x "$BUILD_DIR/$output_name"
        log_info "Created executable: $output_name"
    fi
}

# Generate checksums
generate_checksums() {
    log_info "Generating checksums..."
    cd "$BUILD_DIR"

    # Create checksums file
    > checksums.txt

    for file in recursive-manager*; do
        if [[ -f "$file" && "$file" != "checksums.txt" ]]; then
            sha256sum "$file" >> checksums.txt
        fi
    done

    log_info "Checksums generated ✓"
}

# Sign with GPG (if GPG_KEY_ID is set)
sign_binaries() {
    if [[ -z "${GPG_KEY_ID:-}" ]]; then
        log_warn "GPG_KEY_ID not set. Skipping GPG signatures."
        log_warn "Set GPG_KEY_ID environment variable to enable signing."
        return 0
    fi

    log_info "Signing binaries with GPG..."
    cd "$BUILD_DIR"

    for file in recursive-manager*; do
        if [[ -f "$file" && "$file" != *.asc && "$file" != "checksums.txt" ]]; then
            gpg --default-key "$GPG_KEY_ID" --armor --detach-sign "$file"
            log_info "Signed: $file"
        fi
    done

    # Sign checksums file
    gpg --default-key "$GPG_KEY_ID" --armor --detach-sign checksums.txt

    log_info "Signatures created ✓"
}

# Create tarball for distribution
create_tarball() {
    local platform=$1
    local tarball_name="recursive-manager-v${VERSION}-${platform}.tar.gz"

    log_info "Creating tarball: $tarball_name..."
    cd "$BUILD_DIR"

    tar czf "$tarball_name" \
        recursive-manager* \
        checksums.txt \
        checksums.txt.asc 2>/dev/null || true

    log_info "Tarball created: $tarball_name ✓"
}

# Main build process
main() {
    log_info "Starting RecursiveManager binary build (v$VERSION)..."

    # Create build directory
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"

    # Run build steps
    check_prerequisites
    build_project

    # Build for Linux
    create_bundle "linux" "recursive-manager-linux"

    # Build for macOS
    create_bundle "darwin" "recursive-manager-macos"

    # Build for Windows
    create_bundle "win" "recursive-manager-win"

    # Generate checksums
    generate_checksums

    # Sign binaries
    sign_binaries

    # Create tarballs
    create_tarball "linux"
    create_tarball "macos"
    create_tarball "windows"

    log_info ""
    log_info "=========================================="
    log_info "Build complete! ✓"
    log_info "=========================================="
    log_info "Version: $VERSION"
    log_info "Output directory: $BUILD_DIR"
    log_info ""
    log_info "Files created:"
    ls -lh "$BUILD_DIR" | grep -E '\.(tar\.gz|txt)$' || true
    log_info ""
}

# Run main
main "$@"
