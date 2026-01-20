# RecursiveManager Installation Guide

Complete installation instructions for RecursiveManager across all platforms.

## Table of Contents

- [Quick Install](#quick-install)
- [System Requirements](#system-requirements)
- [Installation Methods](#installation-methods)
  - [One-Liner Install (Recommended)](#one-liner-install-recommended)
  - [Manual Binary Install](#manual-binary-install)
  - [From Source](#from-source)
- [Platform-Specific Instructions](#platform-specific-instructions)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

---

## Quick Install

**One command to install RecursiveManager:**

```bash
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install-binary.sh | bash
```

This will:
- ✅ Detect your platform automatically
- ✅ Download the latest version
- ✅ Verify checksums (SHA256)
- ✅ Install to `~/.recursive-manager`
- ✅ Add to your PATH

---

## System Requirements

### Minimum Requirements

- **Operating System**: Linux, macOS, or Windows (with WSL)
- **Node.js**: Version 18.0.0 or higher
- **Memory**: 512 MB RAM
- **Disk Space**: 100 MB free space

### Required Tools

- `curl` - For downloading
- `tar` - For extracting archives
- `sha256sum` or `shasum` - For checksum verification (optional but recommended)

### Check Requirements

```bash
# Check Node.js version
node --version  # Should be v18.0.0 or higher

# Check required tools
command -v curl && echo "✓ curl installed"
command -v tar && echo "✓ tar installed"
command -v sha256sum && echo "✓ sha256sum installed"
```

---

## Installation Methods

### One-Liner Install (Recommended)

#### Interactive Mode

Prompts you for version and installation directory:

```bash
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install-binary.sh | bash
```

#### Headless Mode

For CI/CD or automated installations:

```bash
VERSION=1.0.0 INSTALL_DIR=/opt/recursive-manager curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install-binary.sh | bash
```

**Environment Variables:**
- `VERSION` - Version to install (default: `latest`)
- `INSTALL_DIR` - Installation directory (default: `~/.recursive-manager`)
- `REPO_OWNER` - GitHub repo owner (default: `aaron777collins`)
- `REPO_NAME` - GitHub repo name (default: `RecursiveManager`)

---

### Manual Binary Install

#### Step 1: Download Binary

Visit the [Releases Page](https://github.com/aaron777collins/RecursiveManager/releases) and download the binary for your platform:

- **Linux**: `recursive-manager-v1.0.0-linux.tar.gz`
- **macOS**: `recursive-manager-v1.0.0-macos.tar.gz`
- **Windows**: `recursive-manager-v1.0.0-windows.tar.gz`

#### Step 2: Verify Checksum (Recommended)

```bash
# Download checksums file
curl -fsSLO https://github.com/aaron777collins/RecursiveManager/releases/download/v1.0.0/checksums.txt

# Verify (Linux/macOS)
sha256sum --check --ignore-missing checksums.txt

# Verify (macOS alternative)
shasum -a 256 --check --ignore-missing checksums.txt
```

#### Step 3: Extract and Install

```bash
# Create installation directory
mkdir -p ~/.recursive-manager

# Extract tarball
tar xzf recursive-manager-v1.0.0-*.tar.gz -C ~/.recursive-manager

# Make executable
chmod +x ~/.recursive-manager/recursive-manager
```

#### Step 4: Add to PATH

**Linux/macOS (bash/zsh):**

```bash
echo 'export PATH="$HOME/.recursive-manager:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**macOS (zsh):**

```bash
echo 'export PATH="$HOME/.recursive-manager:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Windows (PowerShell):**

```powershell
$env:Path += ";$HOME\.recursive-manager"
[System.Environment]::SetEnvironmentVariable("Path", $env:Path, [System.EnvironmentVariableScope]::User)
```

---

### From Source

#### Prerequisites

- Node.js 18+
- npm 9+
- Git

#### Steps

```bash
# Clone repository
git clone https://github.com/aaron777collins/RecursiveManager.git
cd RecursiveManager

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests (optional)
npm test

# Link globally
npm link

# Or create symlink manually
ln -s "$(pwd)/packages/cli/dist/cli.js" /usr/local/bin/recursive-manager
```

---

## Platform-Specific Instructions

### Linux (Ubuntu/Debian)

```bash
# Install Node.js if needed
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install RecursiveManager
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install-binary.sh | bash
```

### Linux (RHEL/CentOS/Fedora)

```bash
# Install Node.js if needed
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Install RecursiveManager
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install-binary.sh | bash
```

### macOS

```bash
# Install Node.js if needed (using Homebrew)
brew install node

# Install RecursiveManager
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install-binary.sh | bash
```

### Windows (WSL)

```bash
# Inside WSL terminal
# Install Node.js if needed
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install RecursiveManager
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install-binary.sh | bash
```

---

## Verification

After installation, verify RecursiveManager is working:

```bash
# Check version
recursive-manager --version

# Show help
recursive-manager --help

# Run a simple test
recursive-manager hire --name "TestAgent" --role "developer"
```

**Expected output:**
```
RecursiveManager v1.0.0
```

---

## Troubleshooting

### Command not found

**Problem:** `recursive-manager: command not found`

**Solution:**
```bash
# Check if installation directory is in PATH
echo $PATH | grep recursive-manager

# Add to PATH if missing
export PATH="$HOME/.recursive-manager:$PATH"

# Or use full path
~/.recursive-manager/recursive-manager --version
```

### Permission denied

**Problem:** `Permission denied` when running `recursive-manager`

**Solution:**
```bash
# Make executable
chmod +x ~/.recursive-manager/recursive-manager

# Or reinstall with correct permissions
VERSION=latest bash <(curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/master/scripts/install-binary.sh)
```

### Checksum verification failed

**Problem:** Checksum doesn't match

**Solution:**
```bash
# Re-download the binary (may have been corrupted)
rm recursive-manager-v1.0.0-*.tar.gz
curl -fsSLO https://github.com/aaron777collins/RecursiveManager/releases/download/v1.0.0/recursive-manager-v1.0.0-linux.tar.gz

# Verify again
sha256sum --check --ignore-missing checksums.txt
```

### Node.js version too old

**Problem:** `Error: Node.js 18+ required`

**Solution:**
```bash
# Check current version
node --version

# Install Node.js 20 LTS (recommended)
# Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS:
brew install node@20
brew link node@20

# Verify
node --version
```

---

## Uninstallation

### Complete Removal

```bash
# Remove installation directory
rm -rf ~/.recursive-manager

# Remove from PATH
# Edit your ~/.bashrc or ~/.zshrc and remove the line:
# export PATH="$HOME/.recursive-manager:$PATH"

# Remove symlinks (if created)
sudo rm /usr/local/bin/recursive-manager 2>/dev/null || true

# Remove configuration (optional)
rm -rf ~/.recursive-manager-config
```

### Keep Configuration

```bash
# Remove only binaries
rm -rf ~/.recursive-manager

# Keep configuration at ~/.recursive-manager-config
```

---

## Next Steps

After installation:

1. **Read the [Quick Start Guide](./README.md#quick-start)** to learn basic usage
2. **Configure RecursiveManager**: `recursive-manager config --interactive`
3. **Hire your first agent**: `recursive-manager hire --name "CEO" --role "ceo"`
4. **Check out [UPGRADE.md](./UPGRADE.md)** for version management

---

## Support

- **Issues**: [GitHub Issues](https://github.com/aaron777collins/RecursiveManager/issues)
- **Documentation**: [Full Documentation](./README.md)
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md)

---

**Last Updated**: 2026-01-20
**Version**: 1.0.0
