#!/bin/bash
set -e

VERSION=$(node -p "require('./package.json').version")
RELEASE_DIR="./dist/release"
ROOT_DIR="$(pwd)"

echo "Building RecursiveManager v$VERSION release..."

# Clean and create release directory
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Create a temporary build directory
BUILD_DIR=$(mktemp -d)
trap "rm -rf $BUILD_DIR" EXIT

# Copy source files
echo "Copying source files..."
cp -r packages "$BUILD_DIR/"
cp -r node_modules "$BUILD_DIR/" 
cp package.json "$BUILD_DIR/"

# Create executables
echo "Creating executables..."
cat > "$BUILD_DIR/recursive-manager" << 'EOF'
#!/usr/bin/env node
require('./packages/cli/dist/cli.js');
EOF
chmod +x "$BUILD_DIR/recursive-manager"

cat > "$BUILD_DIR/recursive-manager.cmd" << 'EOF'
@echo off
node "%~dp0packages\cli\dist\cli.js" %*
EOF

# Create checksums
echo "Generating checksums..."
cd "$BUILD_DIR"
sha256sum recursive-manager recursive-manager.cmd > checksums.txt

# Create tarballs
echo "Creating tarballs..."
for platform in linux macos windows; do
  tar czf "$ROOT_DIR/$RELEASE_DIR/recursive-manager-v${VERSION}-$platform.tar.gz" \
    -C "$BUILD_DIR" . 2>/dev/null || true
done

cp checksums.txt "$ROOT_DIR/$RELEASE_DIR/"

cd "$ROOT_DIR"
echo "✓ Build complete!"
ls -lh "$RELEASE_DIR"
