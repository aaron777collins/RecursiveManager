# RecursiveManager Upgrade Guide

Comprehensive guide for upgrading, downgrading, and rolling back RecursiveManager versions.

## Table of Contents

- [Quick Upgrade](#quick-upgrade)
- [Upgrade Commands](#upgrade-commands)
- [Version Management](#version-management)
- [Migration Guides](#migration-guides)
- [Rollback Instructions](#rollback-instructions)
- [Troubleshooting](#troubleshooting)

---

## Quick Upgrade

**Upgrade to the latest version:**

```bash
recursivemanager-upgrade
```

The upgrade script automatically:
- ✅ Creates a backup of your current version
- ✅ Downloads and verifies the new version
- ✅ Installs the new version
- ✅ Preserves your configuration
- ✅ Logs the upgrade in version history

---

## Upgrade Commands

### Basic Upgrades

```bash
# Upgrade to latest version
recursivemanager-upgrade

# Upgrade to specific version
recursivemanager-upgrade 2.0.0

# Downgrade to older version
recursivemanager-upgrade 1.0.0
```

### Advanced Commands

```bash
# List version history and available backups
recursivemanager-upgrade --list

# Rollback to previous version
recursivemanager-upgrade --rollback

# Show help
recursivemanager-upgrade --help
```

---

## Version Management

### Check Current Version

```bash
# Show installed version
recursivemanager --version

# Show detailed version info
cat ~/.recursivemanager/.version
```

### List Available Versions

```bash
# See all available versions and backups
recursivemanager-upgrade --list
```

**Example output:**
```
══════════════════════════════════════
  Version History
══════════════════════════════════════

Current version: v2.0.0

Previous versions:
  • v1.0.0 (installed: 2026-01-15 10:30:00)
  • v1.1.0 (installed: 2026-01-18 14:45:00)

Available backups:
  • v1.0.0
  • v1.1.0
```

### Version History

RecursiveManager automatically tracks all installed versions in:
- `~/.recursivemanager/.version` - Current version
- `~/.recursivemanager/.version_history` - Full history
- `~/.recursivemanager/.backups/` - Backup tarballs

---

## Migration Guides

### 1.x → 2.x

**Breaking Changes:**
- Configuration format changed (automatically migrated)
- CLI commands renamed (aliases preserved for backward compatibility)

**Steps:**
```bash
# 1. Backup your agents
recursivemanager export --all --output agents-backup.json

# 2. Upgrade
recursivemanager-upgrade 2.0.0

# 3. Verify agents
recursivemanager list
```

### 2.x → 3.x

**Breaking Changes:**
- Task scheduler API changed
- New agent permissions system

**Steps:**
```bash
# Coming soon - check CHANGELOG.md for v3.0.0
```

---

## Rollback Instructions

### Automatic Rollback

If an upgrade fails or causes issues:

```bash
# Rollback to the most recent backup
recursivemanager-upgrade --rollback
```

This will:
1. Restore the previous version from backup
2. Revert configuration changes
3. Update version history

### Manual Rollback

If the automatic rollback fails:

```bash
# 1. Find available backups
ls -lh ~/.recursivemanager/.backups/

# 2. Extract the backup manually
cd ~/.recursivemanager
rm -rf !(\.backups|\.version_history)  # Remove current installation
tar xzf .backups/v1.0.0_TIMESTAMP.tar.gz

# 3. Verify
recursivemanager --version
```

---

## Upgrade Scenarios

### Scenario 1: Upgrade to Latest

```bash
$ recursivemanager-upgrade

══════════════════════════════════════
  Version Change
══════════════════════════════════════

Current: v1.0.0
Target:  v2.0.0

Continue? [Y/n]: Y

➜ Creating backup of v1.0.0...
✓ Backup created: v1.0.0_20260120_100000.tar.gz
➜ Downloading v2.0.0...
✓ Downloaded recursivemanager-v2.0.0-linux.tar.gz
✓ Checksum verified ✓
➜ Installing v2.0.0...
✓ Installation complete!

══════════════════════════════════════
  Complete! ✓
══════════════════════════════════════

Version changed: v1.0.0 → v2.0.0
```

### Scenario 2: Downgrade

```bash
$ recursivemanager-upgrade 1.0.0

══════════════════════════════════════
  Version Change
══════════════════════════════════════

Current: v2.0.0
Target:  v1.0.0

⚠ Downgrading to older version
Continue? [Y/n]: Y

➜ Creating backup of v2.0.0...
✓ Backup created
➜ Downloading v1.0.0...
✓ Downloaded and verified
➜ Installing v1.0.0...
✓ Complete!

Version changed: v2.0.0 → v1.0.0
```

### Scenario 3: Rollback After Issues

```bash
$ recursivemanager-upgrade --rollback

➜ Rolling back to previous version...
✓ Rolling back to v1.0.0...
➜ Creating backup of v2.0.0...
✓ Backup created
✓ Rollback complete!
✓ Current version: v1.0.0
```

---

## Troubleshooting

### Upgrade fails with download error

**Problem:** Cannot download the new version

**Solution:**
```bash
# Check internet connection
curl -I https://github.com

# Try with explicit version
recursivemanager-upgrade 2.0.0

# Check GitHub releases manually
open https://github.com/aaron777collins/RecursiveManager/releases
```

### Checksum verification fails

**Problem:** Downloaded file doesn't match checksum

**Solution:**
```bash
# Retry the download (may have been corrupted)
recursivemanager-upgrade 2.0.0

# If it fails again, report it:
# https://github.com/aaron777collins/RecursiveManager/issues
```

### Configuration not preserved

**Problem:** Settings lost after upgrade

**Solution:**
```bash
# Rollback to previous version
recursivemanager-upgrade --rollback

# Check if config backup exists
ls -la ~/.recursivemanager-config-backup-*

# Restore config manually
cp ~/.recursivemanager-config-backup-TIMESTAMP/* ~/.recursivemanager-config/
```

### "No backups available" error

**Problem:** Cannot rollback because no backups exist

**Solution:**
```bash
# This happens if backups were manually deleted
# You must reinstall a specific version:

# 1. Choose a version
recursivemanager-upgrade --list

# 2. Install that version
recursivemanager-upgrade 1.0.0
```

---

## Best Practices

### Before Upgrading

1. **Backup your agents:**
   ```bash
   recursivemanager export --all --output backup-$(date +%Y%m%d).json
   ```

2. **Check release notes:**
   - Visit: https://github.com/aaron777collins/RecursiveManager/releases
   - Look for breaking changes

3. **Test in a safe environment first** (if possible)

### During Upgrade

- **Don't interrupt the upgrade** (wait for completion)
- **Check for errors** in the output
- **Verify the new version** after completion

### After Upgrading

1. **Verify version:**
   ```bash
   recursivemanager --version
   ```

2. **Test basic functionality:**
   ```bash
   recursivemanager list
   recursivemanager --help
   ```

3. **Check agents:**
   ```bash
   recursivemanager list
   ```

4. **Run tests (if applicable):**
   ```bash
   recursivemanager test
   ```

---

## Backup and Restore

### Manual Backup

```bash
# Create a full backup
tar czf "rm-backup-$(date +%Y%m%d).tar.gz" ~/.recursivemanager

# Backup only configuration
tar czf "rm-config-backup-$(date +%Y%m%d).tar.gz" ~/.recursivemanager-config
```

### Manual Restore

```bash
# Restore full installation
tar xzf rm-backup-20260120.tar.gz -C ~/

# Restore only configuration
tar xzf rm-config-backup-20260120.tar.gz -C ~/
```

---

## Automated Upgrades

### Cron Job (Linux/macOS)

```bash
# Add to crontab (runs daily at 2 AM)
crontab -e

# Add this line:
0 2 * * * /path/to/recursivemanager-upgrade > /dev/null 2>&1
```

### Systemd Timer (Linux)

```bash
# Create timer unit
sudo nano /etc/systemd/system/rm-upgrade.timer

[Unit]
Description=RecursiveManager Auto-Upgrade Timer

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target

# Enable timer
sudo systemctl enable --now rm-upgrade.timer
```

---

## Support

- **Upgrade Issues**: [GitHub Issues](https://github.com/aaron777collins/RecursiveManager/issues)
- **Release Notes**: [CHANGELOG.md](./CHANGELOG.md)
- **Installation**: [INSTALL.md](./INSTALL.md)

---

**Last Updated**: 2026-01-20
**Version**: 1.0.0
