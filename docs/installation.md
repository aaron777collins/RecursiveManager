# Installation

## One-Liner Installation

The easiest way to install RecursiveManager is using our one-liner script:

```bash
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/main/scripts/install.sh | bash
```

## Manual Installation

If you prefer to install manually:

1. Clone the repository:
```bash
git clone https://github.com/aaron777collins/RecursiveManager.git
cd RecursiveManager
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Set up the CLI (optional):
```bash
npm link
```

## Headless Installation (CI/CD)

For automated installations in CI/CD pipelines:

```bash
curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/main/scripts/install.sh | bash -s -- --headless --install-dir /opt/recursivemanager
```

### Headless Options

- `--headless` - Non-interactive mode
- `--install-dir DIR` - Custom install location (default: ~/.recursivemanager)
- `--skip-shell-config` - Don't modify shell configuration
- `--skip-build` - Don't build after install (use pre-built)
- `--package-manager [npm|yarn|pnpm]` - Force specific package manager

## Requirements

- Node.js v18 or higher
- npm, yarn, or pnpm
- Git

## Verifying Installation

After installation, verify that RecursiveManager is installed correctly:

```bash
recursivemanager --version
recursivemanager --help
```

## Uninstallation

To uninstall RecursiveManager:

```bash
~/.recursivemanager/scripts/uninstall.sh
```

Or with options:

```bash
~/.recursivemanager/scripts/uninstall.sh --remove-data --headless
```
