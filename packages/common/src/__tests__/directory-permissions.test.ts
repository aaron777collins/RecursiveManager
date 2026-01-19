/**
 * Tests for directory permission handling utilities
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  checkDirectoryPermissions,
  checkDirectoryPermissionsSync,
  ensureDirectoryPermissions,
  ensureDirectoryPermissionsSync,
  setDirectoryPermissions,
  setDirectoryPermissionsSync,
  getDirectoryPermissions,
  getDirectoryPermissionsSync,
  validateDirectoryPermissions,
  validateDirectoryPermissionsSync,
  PermissionError,
  DEFAULT_DIRECTORY_MODE,
} from '../directory-permissions';

describe('Directory Permissions', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique test directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dir-perms-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('checkDirectoryPermissions', () => {
    it('should pass for directory with read/write permissions', async () => {
      const dir = path.join(testDir, 'readable-writable');
      await fs.mkdir(dir, { mode: 0o755 });

      await expect(checkDirectoryPermissions(dir)).resolves.toBeUndefined();
    });

    it('should throw PermissionError for non-existent directory', async () => {
      const dir = path.join(testDir, 'does-not-exist');

      await expect(checkDirectoryPermissions(dir)).rejects.toThrow(PermissionError);
      await expect(checkDirectoryPermissions(dir)).rejects.toThrow('does not exist');
    });

    it('should work with relative paths', async () => {
      const dir = path.join(testDir, 'relative-test');
      await fs.mkdir(dir, { mode: 0o755 });

      // Should resolve relative path
      const relativePath = path.relative(process.cwd(), dir);
      await expect(checkDirectoryPermissions(relativePath)).resolves.toBeUndefined();
    });

    describe('sync variant', () => {
      it('should pass for directory with read/write permissions', () => {
        const dir = path.join(testDir, 'sync-readable-writable');
        fsSync.mkdirSync(dir, { mode: 0o755 });

        expect(() => checkDirectoryPermissionsSync(dir)).not.toThrow();
      });

      it('should throw PermissionError for non-existent directory', () => {
        const dir = path.join(testDir, 'sync-does-not-exist');

        expect(() => checkDirectoryPermissionsSync(dir)).toThrow(PermissionError);
        expect(() => checkDirectoryPermissionsSync(dir)).toThrow('does not exist');
      });
    });
  });

  describe('ensureDirectoryPermissions', () => {
    it('should create directory with default permissions (0o755)', async () => {
      const dir = path.join(testDir, 'new-dir');

      await ensureDirectoryPermissions(dir);

      const stats = await fs.stat(dir);
      expect(stats.isDirectory()).toBe(true);
      expect(stats.mode & 0o777).toBe(0o755);
    });

    it('should create directory with custom permissions', async () => {
      const dir = path.join(testDir, 'custom-perms');

      await ensureDirectoryPermissions(dir, { mode: 0o700 });

      const stats = await fs.stat(dir);
      expect(stats.mode & 0o777).toBe(0o700);
    });

    it('should create parent directories recursively by default', async () => {
      const dir = path.join(testDir, 'parent', 'child', 'grandchild');

      await ensureDirectoryPermissions(dir);

      const stats = await fs.stat(dir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should not fail if directory already exists', async () => {
      const dir = path.join(testDir, 'existing');
      await fs.mkdir(dir, { mode: 0o755 });

      await expect(ensureDirectoryPermissions(dir)).resolves.toBeUndefined();
    });

    it('should update permissions on existing directory', async () => {
      const dir = path.join(testDir, 'update-perms');
      await fs.mkdir(dir, { mode: 0o700 });

      // Ensure with different mode
      await ensureDirectoryPermissions(dir, { mode: 0o755 });

      const stats = await fs.stat(dir);
      expect(stats.mode & 0o777).toBe(0o755);
    });

    it('should handle setOwnership option gracefully', async () => {
      const dir = path.join(testDir, 'ownership-test');

      // Should not throw even if we can't set ownership
      await expect(
        ensureDirectoryPermissions(dir, { setOwnership: true })
      ).resolves.toBeUndefined();

      const stats = await fs.stat(dir);
      expect(stats.isDirectory()).toBe(true);
    });

    describe('sync variant', () => {
      it('should create directory with default permissions', () => {
        const dir = path.join(testDir, 'sync-new-dir');

        ensureDirectoryPermissionsSync(dir);

        const stats = fsSync.statSync(dir);
        expect(stats.isDirectory()).toBe(true);
        expect(stats.mode & 0o777).toBe(0o755);
      });

      it('should create directory with custom permissions', () => {
        const dir = path.join(testDir, 'sync-custom-perms');

        ensureDirectoryPermissionsSync(dir, { mode: 0o700 });

        const stats = fsSync.statSync(dir);
        expect(stats.mode & 0o777).toBe(0o700);
      });
    });
  });

  describe('setDirectoryPermissions', () => {
    it('should set permissions on existing directory', async () => {
      const dir = path.join(testDir, 'set-perms');
      await fs.mkdir(dir, { mode: 0o700 });

      await setDirectoryPermissions(dir, 0o755);

      const stats = await fs.stat(dir);
      expect(stats.mode & 0o777).toBe(0o755);
    });

    it('should throw PermissionError for non-existent directory', async () => {
      const dir = path.join(testDir, 'does-not-exist');

      await expect(setDirectoryPermissions(dir, 0o755)).rejects.toThrow(PermissionError);
    });

    it('should throw PermissionError if path is a file', async () => {
      const file = path.join(testDir, 'file.txt');
      await fs.writeFile(file, 'content');

      await expect(setDirectoryPermissions(file, 0o755)).rejects.toThrow(PermissionError);
      await expect(setDirectoryPermissions(file, 0o755)).rejects.toThrow('not a directory');
    });

    describe('sync variant', () => {
      it('should set permissions on existing directory', () => {
        const dir = path.join(testDir, 'sync-set-perms');
        fsSync.mkdirSync(dir, { mode: 0o700 });

        setDirectoryPermissionsSync(dir, 0o755);

        const stats = fsSync.statSync(dir);
        expect(stats.mode & 0o777).toBe(0o755);
      });

      it('should throw PermissionError for non-existent directory', () => {
        const dir = path.join(testDir, 'sync-does-not-exist');

        expect(() => setDirectoryPermissionsSync(dir, 0o755)).toThrow(PermissionError);
      });
    });
  });

  describe('getDirectoryPermissions', () => {
    it('should return permission information for directory', async () => {
      const dir = path.join(testDir, 'get-perms');
      await fs.mkdir(dir, { mode: 0o755 });

      const result = await getDirectoryPermissions(dir);

      expect(result.mode).toBe(0o755);
      expect(result.readable).toBe(true);
      expect(result.writable).toBe(true);
      expect(result.executable).toBe(true);
      expect(typeof result.owner).toBe('number');
      expect(typeof result.group).toBe('number');
    });

    it('should correctly identify restricted permissions', async () => {
      const dir = path.join(testDir, 'restricted');
      await fs.mkdir(dir, { mode: 0o700 });

      const result = await getDirectoryPermissions(dir);

      expect(result.mode).toBe(0o700);
      expect(result.readable).toBe(true);
      expect(result.writable).toBe(true);
      expect(result.executable).toBe(true);
    });

    it('should throw PermissionError for non-existent directory', async () => {
      const dir = path.join(testDir, 'does-not-exist');

      await expect(getDirectoryPermissions(dir)).rejects.toThrow(PermissionError);
    });

    it('should throw PermissionError if path is a file', async () => {
      const file = path.join(testDir, 'file.txt');
      await fs.writeFile(file, 'content');

      await expect(getDirectoryPermissions(file)).rejects.toThrow(PermissionError);
      await expect(getDirectoryPermissions(file)).rejects.toThrow('not a directory');
    });

    describe('sync variant', () => {
      it('should return permission information for directory', () => {
        const dir = path.join(testDir, 'sync-get-perms');
        fsSync.mkdirSync(dir, { mode: 0o755 });

        const result = getDirectoryPermissionsSync(dir);

        expect(result.mode).toBe(0o755);
        expect(result.readable).toBe(true);
        expect(result.writable).toBe(true);
        expect(result.executable).toBe(true);
      });

      it('should throw PermissionError for non-existent directory', () => {
        const dir = path.join(testDir, 'sync-does-not-exist');

        expect(() => getDirectoryPermissionsSync(dir)).toThrow(PermissionError);
      });
    });
  });

  describe('validateDirectoryPermissions', () => {
    it('should return true for directory with read/write access', async () => {
      const dir = path.join(testDir, 'valid');
      await fs.mkdir(dir, { mode: 0o755 });

      const isValid = await validateDirectoryPermissions(dir);

      expect(isValid).toBe(true);
    });

    it('should return true when mode matches exactly', async () => {
      const dir = path.join(testDir, 'exact-mode');
      await fs.mkdir(dir, { mode: 0o755 });

      const isValid = await validateDirectoryPermissions(dir, 0o755);

      expect(isValid).toBe(true);
    });

    it('should return false when mode does not match', async () => {
      const dir = path.join(testDir, 'wrong-mode');
      await fs.mkdir(dir, { mode: 0o755 });

      const isValid = await validateDirectoryPermissions(dir, 0o700);

      expect(isValid).toBe(false);
    });

    it('should return false for non-existent directory', async () => {
      const dir = path.join(testDir, 'does-not-exist');

      const isValid = await validateDirectoryPermissions(dir);

      expect(isValid).toBe(false);
    });

    describe('sync variant', () => {
      it('should return true for directory with read/write access', () => {
        const dir = path.join(testDir, 'sync-valid');
        fsSync.mkdirSync(dir, { mode: 0o755 });

        const isValid = validateDirectoryPermissionsSync(dir);

        expect(isValid).toBe(true);
      });

      it('should return true when mode matches exactly', () => {
        const dir = path.join(testDir, 'sync-exact-mode');
        fsSync.mkdirSync(dir, { mode: 0o755 });

        const isValid = validateDirectoryPermissionsSync(dir, 0o755);

        expect(isValid).toBe(true);
      });

      it('should return false for non-existent directory', () => {
        const dir = path.join(testDir, 'sync-does-not-exist');

        const isValid = validateDirectoryPermissionsSync(dir);

        expect(isValid).toBe(false);
      });
    });
  });

  describe('PermissionError', () => {
    it('should include all error context', () => {
      const originalError = new Error('Original error');
      const error = new PermissionError('Test error', '/path/to/dir', 0o755, 0o700, originalError);

      expect(error.name).toBe('PermissionError');
      expect(error.message).toBe('Test error');
      expect(error.dirPath).toBe('/path/to/dir');
      expect(error.requiredMode).toBe(0o755);
      expect(error.actualMode).toBe(0o700);
      expect(error.originalError).toBe(originalError);
    });

    it('should have proper error chain', () => {
      const error = new PermissionError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PermissionError);
    });
  });

  describe('DEFAULT_DIRECTORY_MODE constant', () => {
    it('should be 0o755', () => {
      expect(DEFAULT_DIRECTORY_MODE).toBe(0o755);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete directory creation and validation workflow', async () => {
      const dir = path.join(testDir, 'workflow', 'nested', 'path');

      // 1. Ensure directory exists with permissions
      await ensureDirectoryPermissions(dir, { mode: 0o755 });

      // 2. Validate permissions
      const isValid = await validateDirectoryPermissions(dir, 0o755);
      expect(isValid).toBe(true);

      // 3. Check permissions
      await expect(checkDirectoryPermissions(dir)).resolves.toBeUndefined();

      // 4. Get detailed permission info
      const perms = await getDirectoryPermissions(dir);
      expect(perms.mode).toBe(0o755);
      expect(perms.readable).toBe(true);
      expect(perms.writable).toBe(true);

      // 5. Update permissions
      await setDirectoryPermissions(dir, 0o700);
      const newPerms = await getDirectoryPermissions(dir);
      expect(newPerms.mode).toBe(0o700);
    });

    it('should handle agent directory initialization scenario', async () => {
      // Simulate creating agent directory structure
      const agentId = 'test-agent';
      const agentDir = path.join(testDir, 'agents', agentId);
      const subdirs = ['tasks', 'inbox', 'outbox', 'subordinates', 'workspace'];

      // Create main agent directory
      await ensureDirectoryPermissions(agentDir);

      // Create all subdirectories
      for (const subdir of subdirs) {
        const subdirPath = path.join(agentDir, subdir);
        await ensureDirectoryPermissions(subdirPath);
      }

      // Validate all directories exist and have correct permissions
      for (const subdir of subdirs) {
        const subdirPath = path.join(agentDir, subdir);
        const isValid = await validateDirectoryPermissions(subdirPath);
        expect(isValid).toBe(true);
      }
    });

    it('should handle permission recovery scenario', async () => {
      const dir = path.join(testDir, 'recovery');

      // Create directory with wrong permissions
      await fs.mkdir(dir, { mode: 0o700, recursive: true });

      // Detect and fix permissions
      const isValid = await validateDirectoryPermissions(dir, 0o755);
      expect(isValid).toBe(false);

      // Fix permissions
      await ensureDirectoryPermissions(dir, { mode: 0o755 });

      // Verify fix
      const fixedValid = await validateDirectoryPermissions(dir, 0o755);
      expect(fixedValid).toBe(true);
    });
  });
});
