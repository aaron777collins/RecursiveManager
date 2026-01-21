#!/bin/bash
set -e

VERSION="1.1.17"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Go to root dir (scripts is subdirectory)
cd "$ROOT_DIR"
BUILD_DIR="$ROOT_DIR/dist/build"
RELEASE_DIR="$ROOT_DIR/dist/release"

echo "Building RecursiveManager v$VERSION..."

# Clean
rm -rf "$BUILD_DIR" "$RELEASE_DIR"
mkdir -p "$BUILD_DIR" "$RELEASE_DIR"

# Copy packages
cp -r packages/* "$BUILD_DIR/"

# Install dependencies and rebuild native modules
cd "$BUILD_DIR"
for pkg in */; do
  if [ -f "$pkg/package.json" ]; then
    cd "$pkg"
    npm install --omit=dev > /dev/null 2>&1 || true
    cd "$BUILD_DIR"
  fi
done

npm rebuild better-sqlite3 > /dev/null 2>&1 || true

# Create tarballs
for platform in linux macos windows; do
  tar -czf "$RELEASE_DIR/recursivemanager-v${VERSION}-${platform}.tar.gz" \
    packages/ \
    scripts/update.sh \
    scripts/recursivemanager-claude
done

# Checksums
cd "$RELEASE_DIR"
sha256sum *.tar.gz > checksums.txt

# Cleanup
rm -rf "$BUILD_DIR"

echo "✓ Build complete!"
ls -lh
