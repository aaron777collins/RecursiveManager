#!/bin/bash
################################################################################
# RecursiveManager Installation Script
#
# Features:
# - One-liner installation support
# - Headless mode for CI/CD
# - Dependency checking (Node.js, npm/yarn/pnpm, git)
# - Shell alias setup
# - Post-install verification
#
# Usage:
#   Interactive: curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/main/scripts/install.sh | bash
#   Headless: curl -fsSL ... | bash -s -- --headless --install-dir /opt/recursivemanager
#
################################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default configuration
GITHUB_REPO="aaron777collins/RecursiveManager"
INSTALL_DIR="${HOME}/.recursivemanager"
HEADLESS=false
SKIP_SHELL_CONFIG=false
SKIP_BUILD=false
PACKAGE_MANAGER=""
BRANCH="main"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --headless)
      HEADLESS=true
      shift
      ;;
    --install-dir)
      INSTALL_DIR="$2"
      shift 2
      ;;
    --skip-shell-config)
      SKIP_SHELL_CONFIG=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --package-manager)
      PACKAGE_MANAGER="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --help)
      echo "RecursiveManager Installation Script"
      echo ""
      echo "Usage: install.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --headless                       Non-interactive installation mode"
      echo "  --install-dir DIR                Custom installation directory (default: ~/.recursivemanager)"
      echo "  --skip-shell-config              Don't modify shell configuration files"
      echo "  --skip-build                     Don't build after installation (use for pre-built packages)"
      echo "  --package-manager [npm|yarn|pnpm] Force specific package manager"
      echo "  --branch BRANCH                  Install from specific branch (default: main)"
      echo "  --help                           Show this help message"
      echo ""
      echo "Example:"
      echo "  curl -fsSL https://raw.githubusercontent.com/aaron777collins/RecursiveManager/main/scripts/install.sh | bash"
      echo "  curl -fsSL ... | bash -s -- --headless --install-dir /opt/recursivemanager"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

# Logging functions
log_info() {
  if [ "$HEADLESS" = false ]; then
    echo -e "${BLUE}ℹ${NC} $1"
  else
    echo "[INFO] $1"
  fi
}

log_success() {
  if [ "$HEADLESS" = false ]; then
    echo -e "${GREEN}✓${NC} $1"
  else
    echo "[SUCCESS] $1"
  fi
}

log_warning() {
  if [ "$HEADLESS" = false ]; then
    echo -e "${YELLOW}⚠${NC} $1"
  else
    echo "[WARNING] $1"
  fi
}

log_error() {
  if [ "$HEADLESS" = false ]; then
    echo -e "${RED}✗${NC} $1" >&2
  else
    echo "[ERROR] $1" >&2
  fi
}

log_header() {
  if [ "$HEADLESS" = false ]; then
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
  else
    echo ""
    echo "===================================================="
    echo "  $1"
    echo "===================================================="
    echo ""
  fi
}

# Check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Detect operating system
detect_os() {
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "linux"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "macos"
  elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    echo "windows"
  else
    echo "unknown"
  fi
}

# Check dependencies
check_dependencies() {
  log_header "Checking Dependencies"

  local missing_deps=()

  # Check Node.js
  if command_exists node; then
    local node_version=$(node --version)
    log_success "Node.js installed: $node_version"

    # Check if version is >= 18
    local node_major=$(echo "$node_version" | sed 's/v//' | cut -d. -f1)
    if [ "$node_major" -lt 18 ]; then
      log_warning "Node.js version 18 or higher is recommended. Current: $node_version"
    fi
  else
    log_error "Node.js is not installed"
    missing_deps+=("nodejs")
  fi

  # Check git
  if command_exists git; then
    local git_version=$(git --version)
    log_success "Git installed: $git_version"
  else
    log_error "Git is not installed"
    missing_deps+=("git")
  fi

  # Check package manager
  if [ -z "$PACKAGE_MANAGER" ]; then
    if command_exists pnpm; then
      PACKAGE_MANAGER="pnpm"
      log_success "Package manager detected: pnpm"
    elif command_exists yarn; then
      PACKAGE_MANAGER="yarn"
      log_success "Package manager detected: yarn"
    elif command_exists npm; then
      PACKAGE_MANAGER="npm"
      log_success "Package manager detected: npm"
    else
      log_error "No package manager found (npm, yarn, or pnpm)"
      missing_deps+=("npm")
    fi
  else
    if command_exists "$PACKAGE_MANAGER"; then
      log_success "Using specified package manager: $PACKAGE_MANAGER"
    else
      log_error "Specified package manager not found: $PACKAGE_MANAGER"
      missing_deps+=("$PACKAGE_MANAGER")
    fi
  fi

  # If dependencies are missing, show installation instructions
  if [ ${#missing_deps[@]} -gt 0 ]; then
    log_error "Missing dependencies: ${missing_deps[*]}"
    echo ""
    echo "Please install the missing dependencies:"
    echo ""

    local os=$(detect_os)
    case $os in
      linux)
        echo "  Ubuntu/Debian:"
        echo "    sudo apt update && sudo apt install -y nodejs npm git"
        echo ""
        echo "  Fedora/RHEL:"
        echo "    sudo dnf install -y nodejs npm git"
        echo ""
        echo "  Arch:"
        echo "    sudo pacman -S nodejs npm git"
        ;;
      macos)
        echo "  Using Homebrew:"
        echo "    brew install node git"
        ;;
      *)
        echo "  Please install Node.js (v18+), npm/yarn/pnpm, and git manually."
        ;;
    esac

    exit 1
  fi

  log_success "All dependencies satisfied"
}

# Clone repository
clone_repository() {
  log_header "Cloning RecursiveManager"

  # Check if directory already exists
  if [ -d "$INSTALL_DIR" ]; then
    if [ "$HEADLESS" = false ]; then
      echo -e "${YELLOW}Directory $INSTALL_DIR already exists.${NC}"
      read -p "Do you want to remove it and reinstall? (y/N): " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Installation cancelled"
        exit 0
      fi
    fi

    log_info "Removing existing installation..."
    rm -rf "$INSTALL_DIR"
  fi

  # Create parent directory if it doesn't exist
  mkdir -p "$(dirname "$INSTALL_DIR")"

  # Clone repository
  log_info "Cloning from https://github.com/$GITHUB_REPO (branch: $BRANCH)..."
  if git clone --branch "$BRANCH" --depth 1 "https://github.com/$GITHUB_REPO.git" "$INSTALL_DIR" 2>&1 | grep -v "Cloning into"; then
    log_success "Repository cloned successfully"
  else
    log_error "Failed to clone repository"
    exit 1
  fi
}

# Install dependencies
install_dependencies() {
  log_header "Installing Dependencies"

  cd "$INSTALL_DIR"

  log_info "Installing packages with $PACKAGE_MANAGER..."

  case $PACKAGE_MANAGER in
    npm)
      npm install --silent
      ;;
    yarn)
      yarn install --silent
      ;;
    pnpm)
      pnpm install --silent
      ;;
  esac

  if [ $? -eq 0 ]; then
    log_success "Dependencies installed successfully"
  else
    log_error "Failed to install dependencies"
    exit 1
  fi
}

# Build project
build_project() {
  if [ "$SKIP_BUILD" = true ]; then
    log_info "Skipping build (--skip-build specified)"
    return
  fi

  log_header "Building RecursiveManager"

  cd "$INSTALL_DIR"

  log_info "Building project with $PACKAGE_MANAGER..."

  case $PACKAGE_MANAGER in
    npm)
      npm run build --silent
      ;;
    yarn)
      yarn build --silent
      ;;
    pnpm)
      pnpm build --silent
      ;;
  esac

  if [ $? -eq 0 ]; then
    log_success "Build completed successfully"
  else
    log_error "Build failed"
    exit 1
  fi
}

# Setup shell alias
setup_shell_alias() {
  if [ "$SKIP_SHELL_CONFIG" = true ]; then
    log_info "Skipping shell configuration (--skip-shell-config specified)"
    return
  fi

  log_header "Setting Up Shell Alias"

  local shell_config=""
  local current_shell=$(basename "$SHELL")

  case $current_shell in
    bash)
      if [ -f "$HOME/.bashrc" ]; then
        shell_config="$HOME/.bashrc"
      elif [ -f "$HOME/.bash_profile" ]; then
        shell_config="$HOME/.bash_profile"
      fi
      ;;
    zsh)
      shell_config="$HOME/.zshrc"
      ;;
    fish)
      shell_config="$HOME/.config/fish/config.fish"
      ;;
    *)
      log_warning "Unknown shell: $current_shell. Skipping alias setup."
      return
      ;;
  esac

  if [ -z "$shell_config" ]; then
    log_warning "Could not find shell configuration file. Skipping alias setup."
    return
  fi

  # Check if alias already exists
  if grep -q "recursivemanager" "$shell_config" 2>/dev/null; then
    log_info "Shell alias already configured in $shell_config"
    return
  fi

  # Add alias to shell config
  log_info "Adding alias to $shell_config..."

  cat >> "$shell_config" << EOF

# RecursiveManager
export RECURSIVEMANAGER_HOME="$INSTALL_DIR"
alias recursivemanager="node $INSTALL_DIR/packages/cli/dist/index.js"
EOF

  log_success "Shell alias configured"
  log_info "Run 'source $shell_config' or restart your terminal to use the alias"
}

# Create data directories
create_data_directories() {
  log_header "Creating Data Directories"

  local data_dir="$INSTALL_DIR/data"
  local logs_dir="$INSTALL_DIR/logs"

  mkdir -p "$data_dir"
  mkdir -p "$logs_dir"

  log_success "Data directories created"
}

# Post-install verification
verify_installation() {
  log_header "Verifying Installation"

  cd "$INSTALL_DIR"

  # Check if CLI exists
  if [ -f "$INSTALL_DIR/packages/cli/dist/index.js" ]; then
    log_success "CLI found at packages/cli/dist/index.js"
  else
    log_warning "CLI not found. Build may have failed."
  fi

  # Check if core packages exist
  if [ -d "$INSTALL_DIR/packages/core" ]; then
    log_success "Core package found"
  else
    log_warning "Core package not found"
  fi

  # Test CLI command
  log_info "Testing CLI command..."
  if node "$INSTALL_DIR/packages/cli/dist/index.js" version 2>/dev/null; then
    log_success "CLI command working"
  else
    log_warning "CLI command test failed (this may be normal if CLI is not fully implemented)"
  fi

  log_success "Installation verification complete"
}

# Display post-install instructions
show_post_install_message() {
  log_header "Installation Complete!"

  echo ""
  echo -e "${GREEN}RecursiveManager has been installed successfully!${NC}"
  echo ""
  echo "Installation directory: $INSTALL_DIR"
  echo ""

  if [ "$SKIP_SHELL_CONFIG" = false ]; then
    echo "To start using RecursiveManager:"
    echo ""
    local current_shell=$(basename "$SHELL")
    case $current_shell in
      bash)
        echo "  source ~/.bashrc"
        ;;
      zsh)
        echo "  source ~/.zshrc"
        ;;
      fish)
        echo "  source ~/.config/fish/config.fish"
        ;;
    esac
    echo ""
    echo "Or simply restart your terminal."
    echo ""
    echo "Then run:"
    echo ""
    echo -e "  ${CYAN}recursivemanager version${NC}"
    echo -e "  ${CYAN}recursivemanager help${NC}"
  else
    echo "To use RecursiveManager, run:"
    echo ""
    echo -e "  ${CYAN}node $INSTALL_DIR/packages/cli/dist/index.js version${NC}"
  fi

  echo ""
  echo "Documentation: https://aaron777collins.github.io/RecursiveManager/"
  echo "Repository: https://github.com/$GITHUB_REPO"
  echo ""
}

# Main installation flow
main() {
  if [ "$HEADLESS" = false ]; then
    echo -e "${PURPLE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║          RecursiveManager Installation Script            ║"
    echo "║                                                           ║"
    echo "║  Hierarchical AI agent system for autonomous task mgmt   ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
  else
    echo "RecursiveManager Installation Script (Headless Mode)"
    echo ""
  fi

  log_info "Installation directory: $INSTALL_DIR"
  log_info "Branch: $BRANCH"
  log_info "Package manager: ${PACKAGE_MANAGER:-auto-detect}"
  echo ""

  # Run installation steps
  check_dependencies
  clone_repository
  install_dependencies
  build_project
  create_data_directories
  setup_shell_alias
  verify_installation
  show_post_install_message

  exit 0
}

# Run main function
main
