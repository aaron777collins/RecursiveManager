#!/bin/bash
################################################################################
# RecursiveManager Uninstallation Script
#
# Features:
# - Remove installation directory
# - Clean up shell aliases
# - Backup configuration before removal (optional)
# - Remove data directories (optional)
#
# Usage:
#   Interactive: bash uninstall.sh
#   Headless: bash uninstall.sh --headless --remove-data
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
INSTALL_DIR="${HOME}/.recursivemanager"
HEADLESS=false
REMOVE_DATA=false
SKIP_BACKUP=false
BACKUP_DIR="${HOME}/.recursivemanager-backup-$(date +%Y%m%d-%H%M%S)"

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
    --remove-data)
      REMOVE_DATA=true
      shift
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
      ;;
    --help)
      echo "RecursiveManager Uninstallation Script"
      echo ""
      echo "Usage: uninstall.sh [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --headless                       Non-interactive uninstallation mode"
      echo "  --install-dir DIR                Custom installation directory (default: ~/.recursivemanager)"
      echo "  --remove-data                    Remove all data and configuration"
      echo "  --skip-backup                    Don't create backup before removal"
      echo "  --help                           Show this help message"
      echo ""
      echo "Example:"
      echo "  bash uninstall.sh"
      echo "  bash uninstall.sh --headless --remove-data"
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

# Confirm uninstallation
confirm_uninstall() {
  if [ "$HEADLESS" = true ]; then
    return 0
  fi

  log_header "RecursiveManager Uninstallation"

  echo -e "${YELLOW}This will remove RecursiveManager from your system.${NC}"
  echo ""
  echo "Installation directory: $INSTALL_DIR"

  if [ "$REMOVE_DATA" = true ]; then
    echo -e "${RED}Data and configuration will also be removed!${NC}"
  else
    echo -e "${GREEN}Data and configuration will be preserved${NC}"
  fi

  echo ""
  read -p "Are you sure you want to continue? (y/N): " -n 1 -r
  echo

  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Uninstallation cancelled"
    exit 0
  fi
}

# Create backup
create_backup() {
  if [ "$SKIP_BACKUP" = true ]; then
    log_info "Skipping backup (--skip-backup specified)"
    return
  fi

  log_header "Creating Backup"

  if [ ! -d "$INSTALL_DIR" ]; then
    log_info "No installation found, skipping backup"
    return
  fi

  # Create backup directory
  mkdir -p "$BACKUP_DIR"

  # Backup configuration files
  if [ -f "$INSTALL_DIR/.env" ]; then
    log_info "Backing up .env file..."
    cp "$INSTALL_DIR/.env" "$BACKUP_DIR/.env"
  fi

  # Backup data directory if it exists
  if [ -d "$INSTALL_DIR/data" ] && [ "$REMOVE_DATA" = false ]; then
    log_info "Backing up data directory..."
    cp -r "$INSTALL_DIR/data" "$BACKUP_DIR/data"
  fi

  # Backup logs directory if it exists
  if [ -d "$INSTALL_DIR/logs" ] && [ "$REMOVE_DATA" = false ]; then
    log_info "Backing up logs directory..."
    cp -r "$INSTALL_DIR/logs" "$BACKUP_DIR/logs"
  fi

  # Backup version history
  local version_history="${HOME}/.recursivemanager_version_history"
  if [ -f "$version_history" ]; then
    log_info "Backing up version history..."
    cp "$version_history" "$BACKUP_DIR/.recursivemanager_version_history"
  fi

  log_success "Backup created at: $BACKUP_DIR"
}

# Remove shell aliases
remove_shell_aliases() {
  log_header "Removing Shell Aliases"

  local removed_count=0

  # List of shell config files to check
  local shell_configs=(
    "$HOME/.bashrc"
    "$HOME/.bash_profile"
    "$HOME/.zshrc"
    "$HOME/.config/fish/config.fish"
  )

  for config_file in "${shell_configs[@]}"; do
    if [ -f "$config_file" ]; then
      # Check if RecursiveManager config exists
      if grep -q "RecursiveManager" "$config_file" 2>/dev/null || grep -q "recursivemanager" "$config_file" 2>/dev/null; then
        log_info "Removing RecursiveManager configuration from $config_file..."

        # Create a temporary file
        local temp_file=$(mktemp)

        # Remove lines between "# RecursiveManager" and the alias line
        awk '
          /# RecursiveManager/ { skip=1; next }
          /export RECURSIVEMANAGER_HOME=/ { if (skip) { skip=0; next } }
          /alias recursivemanager=/ { if (skip) { skip=0; next } }
          !skip { print }
          /alias recursivemanager=/ { next }
        ' "$config_file" > "$temp_file"

        # Replace original file
        mv "$temp_file" "$config_file"

        removed_count=$((removed_count + 1))
        log_success "Removed configuration from $config_file"
      fi
    fi
  done

  if [ $removed_count -eq 0 ]; then
    log_info "No shell aliases found"
  else
    log_success "Removed shell aliases from $removed_count file(s)"
    log_info "Restart your terminal or source your shell config to apply changes"
  fi
}

# Remove installation directory
remove_installation() {
  log_header "Removing Installation"

  if [ ! -d "$INSTALL_DIR" ]; then
    log_warning "Installation directory not found: $INSTALL_DIR"
    return
  fi

  log_info "Removing installation directory: $INSTALL_DIR..."

  if rm -rf "$INSTALL_DIR"; then
    log_success "Installation directory removed"
  else
    log_error "Failed to remove installation directory"
    exit 1
  fi
}

# Remove data and configuration
remove_data() {
  if [ "$REMOVE_DATA" = false ]; then
    log_info "Data and configuration preserved (use --remove-data to remove)"
    return
  fi

  log_header "Removing Data and Configuration"

  # Remove version history
  local version_history="${HOME}/.recursivemanager_version_history"
  if [ -f "$version_history" ]; then
    log_info "Removing version history..."
    rm -f "$version_history"
    log_success "Version history removed"
  fi

  # Remove old backups (from update.sh)
  local backup_pattern="${HOME}/.recursivemanager-backup-*"
  if ls $backup_pattern 1> /dev/null 2>&1; then
    log_info "Removing old backups..."
    rm -rf $backup_pattern
    log_success "Old backups removed"
  fi

  log_success "Data and configuration removed"
}

# Display post-uninstall message
show_post_uninstall_message() {
  log_header "Uninstallation Complete"

  echo ""
  echo -e "${GREEN}RecursiveManager has been uninstalled successfully!${NC}"
  echo ""

  if [ "$SKIP_BACKUP" = false ] && [ -d "$BACKUP_DIR" ]; then
    echo "A backup has been created at:"
    echo "  $BACKUP_DIR"
    echo ""
  fi

  if [ "$REMOVE_DATA" = false ]; then
    echo "Note: Data and configuration files were preserved."
    echo "If you want to remove them completely, run:"
    echo ""
    echo -e "  ${CYAN}bash uninstall.sh --remove-data${NC}"
    echo ""
  fi

  echo "To reinstall RecursiveManager, visit:"
  echo "  https://github.com/aaron777collins/RecursiveManager"
  echo ""

  log_info "Please restart your terminal or source your shell config"
}

# Main uninstallation flow
main() {
  if [ "$HEADLESS" = false ]; then
    echo -e "${PURPLE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║        RecursiveManager Uninstallation Script            ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
  else
    echo "RecursiveManager Uninstallation Script (Headless Mode)"
    echo ""
  fi

  # Check if RecursiveManager is installed
  if [ ! -d "$INSTALL_DIR" ]; then
    log_warning "RecursiveManager is not installed at: $INSTALL_DIR"

    if [ "$HEADLESS" = false ]; then
      read -p "Do you want to clean up shell aliases anyway? (y/N): " -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        remove_shell_aliases
      fi
    fi

    exit 0
  fi

  # Confirm uninstallation
  confirm_uninstall

  # Run uninstallation steps
  create_backup
  remove_shell_aliases
  remove_installation
  remove_data
  show_post_uninstall_message

  exit 0
}

# Run main function
main
