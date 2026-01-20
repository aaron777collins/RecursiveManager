#!/usr/bin/env node
/**
 * Build RecursiveManager private binaries for multiple platforms
 * This creates standalone executables that don't require npm install
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PLATFORMS = [
  { os: 'linux', arch: 'x64', output: 'recursive-manager-linux-x64' },
  { os: 'linux', arch: 'arm64', output: 'recursive-manager-linux-arm64' },
  { os: 'darwin', arch: 'x64', output: 'recursive-manager-darwin-x64' },
  { os: 'darwin', arch: 'arm64', output: 'recursive-manager-darwin-arm64' },
  { os: 'win32', arch: 'x64', output: 'recursive-manager-win-x64.exe' },
];

const RELEASE_DIR = path.join(__dirname, '../release');
const VERSION = require('../package.json').version;

console.log(`Building RecursiveManager v${VERSION} binaries...`);

// Create release directory
if (!fs.existsSync(RELEASE_DIR)) {
  fs.mkdirSync(RELEASE_DIR, { recursive: true });
}

// Check if pkg is installed
try {
  execSync('npm list -g pkg', { stdio: 'ignore' });
} catch {
  console.log('Installing pkg globally...');
  execSync('npm install -g pkg', { stdio: 'inherit' });
}

// Build for each platform
PLATFORMS.forEach(({ os, arch, output }) => {
  console.log(`\nBuilding for ${os}-${arch}...`);

  const outputPath = path.join(RELEASE_DIR, output);
  const target = `node18-${os}-${arch}`;

  try {
    execSync(
      `pkg packages/cli/dist/cli.js --target ${target} --output ${outputPath}`,
      { stdio: 'inherit', cwd: path.join(__dirname, '..') }
    );

    // Generate checksum
    const fileBuffer = fs.readFileSync(outputPath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const checksumFile = `${outputPath}.sha256`;
    fs.writeFileSync(checksumFile, `${hash}  ${output}\n`);

    console.log(`✓ Built ${output}`);
    console.log(`  SHA256: ${hash}`);
  } catch (error) {
    console.error(`✗ Failed to build ${output}:`, error.message);
  }
});

// Create install script
const installScript = `#!/bin/bash
# RecursiveManager Installer v${VERSION}

set -e

INSTALL_DIR="\${HOME}/.local/bin"
VERSION="${VERSION}"
REPO_URL="https://github.com/aaron777collins/RecursiveManager/releases"

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

case "$OS" in
  linux) BINARY="recursive-manager-linux-$ARCH" ;;
  darwin) BINARY="recursive-manager-darwin-$ARCH" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

echo "Installing RecursiveManager v$VERSION for $OS-$ARCH..."

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download binary (requires GitHub token for private repos)
if [ -z "$GITHUB_TOKEN" ]; then
  echo "Error: GITHUB_TOKEN environment variable not set"
  echo "Please set GITHUB_TOKEN to your GitHub personal access token"
  exit 1
fi

# Download binary
curl -L -H "Authorization: token $GITHUB_TOKEN" \\
  -o "$INSTALL_DIR/recursive-manager" \\
  "$REPO_URL/download/v$VERSION/$BINARY"

# Make executable
chmod +x "$INSTALL_DIR/recursive-manager"

# Verify installation
if command -v recursive-manager &> /dev/null; then
  echo "✓ RecursiveManager v$VERSION installed successfully!"
  echo "Run 'recursive-manager --version' to verify"
else
  echo "Installation complete, but $INSTALL_DIR is not in your PATH"
  echo "Add this line to your ~/.bashrc or ~/.zshrc:"
  echo '  export PATH="$HOME/.local/bin:$PATH"'
fi
`;

fs.writeFileSync(path.join(RELEASE_DIR, 'install.sh'), installScript, { mode: 0o755 });
console.log(`\n✓ Created install.sh`);

// Create version manifest
const manifest = {
  version: VERSION,
  buildDate: new Date().toISOString(),
  platforms: PLATFORMS.map(p => ({
    os: p.os,
    arch: p.arch,
    filename: p.output,
  })),
};

fs.writeFileSync(
  path.join(RELEASE_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log(`✓ Created manifest.json`);
console.log(`\nBuild complete! Binaries are in ${RELEASE_DIR}/`);
