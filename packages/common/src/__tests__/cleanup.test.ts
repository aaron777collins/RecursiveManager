/**
 * Tests for backup cleanup and retention functionality
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { cleanupBackups, cleanupBackupsSync, createBackup } from '../file-io';

describe('cleanupBackups', () => {
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    // Create a unique test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanup-test-'));
    testFile = path.join(testDir, 'test.json');

    // Create the original test file
    await fs.writeFile(testFile, JSON.stringify({ test: 'data' }, null, 2));
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('basic functionality', () => {
    it('should return empty result when no backups exist', async () => {
      const result = await cleanupBackups(testFile);

      expect(result.totalFound).toBe(0);
      expect(result.deleted).toBe(0);
      expect(result.deletedPaths).toEqual([]);
      expect(result.errors).toBe(0);
      expect(result.errorDetails).toEqual([]);
    });

    it('should return empty result when backup directory does not exist', async () => {
      const result = await cleanupBackups(testFile, {
        backupDir: path.join(testDir, 'nonexistent'),
      });

      expect(result.totalFound).toBe(0);
      expect(result.deleted).toBe(0);
    });

    it('should find backups but not delete recent ones', async () => {
      // Create a recent backup
      await createBackup(testFile);

      const result = await cleanupBackups(testFile);

      expect(result.totalFound).toBe(1);
      expect(result.deleted).toBe(0);
      expect(result.deletedPaths).toEqual([]);
    });

    it('should delete backups older than retention period', async () => {
      // Create a backup file
      const backupPath = await createBackup(testFile);
      expect(backupPath).toBeTruthy();

      // Modify the backup file's timestamp to make it old (8 days ago)
      const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(backupPath!, new Date(eightDaysAgo), new Date(eightDaysAgo));

      const result = await cleanupBackups(testFile);

      expect(result.totalFound).toBe(1);
      expect(result.deleted).toBe(1);
      expect(result.deletedPaths).toHaveLength(1);
      expect(result.deletedPaths[0]).toBe(backupPath);

      // Verify file was actually deleted
      const exists = await fs
        .access(backupPath!)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });

  describe('custom retention period', () => {
    it('should use custom maxAge when provided', async () => {
      // Create a backup
      const backupPath = await createBackup(testFile);
      expect(backupPath).toBeTruthy();

      // Make it 2 days old
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      await fs.utimes(backupPath!, new Date(twoDaysAgo), new Date(twoDaysAgo));

      // With default 7-day retention, should not delete
      const result1 = await cleanupBackups(testFile);
      expect(result1.deleted).toBe(0);

      // With 1-day retention, should delete
      const oneDayMs = 24 * 60 * 60 * 1000;
      const result2 = await cleanupBackups(testFile, { maxAge: oneDayMs });
      expect(result2.deleted).toBe(1);
    });

    it('should handle maxAge of 0 (delete all backups)', async () => {
      // Create a very recent backup
      await createBackup(testFile);

      const result = await cleanupBackups(testFile, { maxAge: 0 });

      expect(result.totalFound).toBe(1);
      expect(result.deleted).toBe(1);
    });
  });

  describe('custom backup directory', () => {
    it('should clean backups from custom directory', async () => {
      const backupDir = path.join(testDir, 'backups');

      // Create backup in custom directory
      const backupPath = await createBackup(testFile, { backupDir });
      expect(backupPath).toBeTruthy();

      // Make it old
      const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(backupPath!, new Date(oldDate), new Date(oldDate));

      // Clean with custom directory
      const result = await cleanupBackups(testFile, { backupDir });

      expect(result.deleted).toBe(1);
      expect(result.deletedPaths[0]).toBe(backupPath);
    });
  });

  describe('dry run mode', () => {
    it('should report what would be deleted without actually deleting', async () => {
      // Create an old backup
      const backupPath = await createBackup(testFile);
      expect(backupPath).toBeTruthy();

      const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(backupPath!, new Date(oldDate), new Date(oldDate));

      // Run cleanup in dry-run mode
      const result = await cleanupBackups(testFile, { dryRun: true });

      expect(result.deleted).toBe(1);
      expect(result.deletedPaths).toHaveLength(1);

      // Verify file was NOT actually deleted
      const exists = await fs
        .access(backupPath!)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('multiple backups', () => {
    it('should handle multiple backups with mixed ages', async () => {
      // Create 3 backups
      const backup1 = await createBackup(testFile);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      const backup2 = await createBackup(testFile);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const backup3 = await createBackup(testFile);

      // Make first two old, keep third recent
      const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(backup1!, new Date(oldDate), new Date(oldDate));
      await fs.utimes(backup2!, new Date(oldDate), new Date(oldDate));

      const result = await cleanupBackups(testFile);

      expect(result.totalFound).toBe(3);
      expect(result.deleted).toBe(2);
      expect(result.deletedPaths).toContain(backup1);
      expect(result.deletedPaths).toContain(backup2);
      expect(result.deletedPaths).not.toContain(backup3);
    });

    it('should only clean backups matching the original filename', async () => {
      // Create backup for test.json
      const backup1 = await createBackup(testFile);

      // Create another file and its backup
      const otherFile = path.join(testDir, 'other.json');
      await fs.writeFile(otherFile, '{}');
      const backup2 = await createBackup(otherFile);

      // Make both old
      const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(backup1!, new Date(oldDate), new Date(oldDate));
      await fs.utimes(backup2!, new Date(oldDate), new Date(oldDate));

      // Clean test.json backups
      const result = await cleanupBackups(testFile);

      expect(result.totalFound).toBe(1);
      expect(result.deleted).toBe(1);
      expect(result.deletedPaths).toContain(backup1);
      expect(result.deletedPaths).not.toContain(backup2);

      // Verify other.json backup still exists
      const exists = await fs
        .access(backup2!)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should continue processing if one file fails to delete', async () => {
      // Create two old backups
      const backup1 = await createBackup(testFile);
      await new Promise((resolve) => setTimeout(resolve, 10));
      const backup2 = await createBackup(testFile);

      const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(backup1!, new Date(oldDate), new Date(oldDate));
      await fs.utimes(backup2!, new Date(oldDate), new Date(oldDate));

      // Make backup1 read-only to cause deletion failure
      await fs.chmod(backup1!, 0o444);
      await fs.chmod(testDir, 0o555); // Make directory read-only

      const result = await cleanupBackups(testFile);

      expect(result.totalFound).toBe(2);
      // Both should have failed due to read-only directory
      expect(result.errors).toBe(2);
      expect(result.errorDetails).toHaveLength(2);

      // Restore permissions for cleanup
      await fs.chmod(testDir, 0o755);
    });
  });

  describe('edge cases', () => {
    it('should handle files with no extension', async () => {
      const noExtFile = path.join(testDir, 'noext');
      await fs.writeFile(noExtFile, 'test');

      const backupPath = await createBackup(noExtFile);
      expect(backupPath).toBeTruthy();

      const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(backupPath!, new Date(oldDate), new Date(oldDate));

      const result = await cleanupBackups(noExtFile);

      expect(result.deleted).toBe(1);
    });

    it('should handle files with multiple dots in name', async () => {
      const multiDotFile = path.join(testDir, 'my.config.file.json');
      await fs.writeFile(multiDotFile, '{}');

      const backupPath = await createBackup(multiDotFile);
      expect(backupPath).toBeTruthy();

      const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(backupPath!, new Date(oldDate), new Date(oldDate));

      const result = await cleanupBackups(multiDotFile);

      expect(result.deleted).toBe(1);
    });

    it('should handle special characters in filename', async () => {
      const specialFile = path.join(testDir, 'test-file_2024 (1).json');
      await fs.writeFile(specialFile, '{}');

      const backupPath = await createBackup(specialFile);
      expect(backupPath).toBeTruthy();

      const oldDate = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await fs.utimes(backupPath!, new Date(oldDate), new Date(oldDate));

      const result = await cleanupBackups(specialFile);

      expect(result.deleted).toBe(1);
    });
  });
});

describe('cleanupBackupsSync', () => {
  let testDir: string;
  let testFile: string;

  beforeEach(() => {
    // Create a unique test directory
    testDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'cleanup-sync-test-'));
    testFile = path.join(testDir, 'test.json');

    // Create the original test file
    fsSync.writeFileSync(testFile, JSON.stringify({ test: 'data' }, null, 2));
  });

  afterEach(() => {
    // Clean up test directory
    fsSync.rmSync(testDir, { recursive: true, force: true });
  });

  it('should work synchronously like async version', () => {
    // Create a backup
    const backupPath = path.join(testDir, `test.2024-01-01T00-00-00-000.json`);
    fsSync.copyFileSync(testFile, backupPath);

    // Make it old
    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    fsSync.utimesSync(backupPath, oldDate, oldDate);

    const result = cleanupBackupsSync(testFile);

    expect(result.totalFound).toBe(1);
    expect(result.deleted).toBe(1);
    expect(fsSync.existsSync(backupPath)).toBe(false);
  });

  it('should support dry run mode', () => {
    // Create an old backup
    const backupPath = path.join(testDir, `test.2024-01-01T00-00-00-000.json`);
    fsSync.copyFileSync(testFile, backupPath);

    const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    fsSync.utimesSync(backupPath, oldDate, oldDate);

    const result = cleanupBackupsSync(testFile, { dryRun: true });

    expect(result.deleted).toBe(1);
    expect(fsSync.existsSync(backupPath)).toBe(true);
  });

  it('should handle custom maxAge', () => {
    // Create a 2-day old backup
    const backupPath = path.join(testDir, `test.2024-01-15T00-00-00-000.json`);
    fsSync.copyFileSync(testFile, backupPath);

    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    fsSync.utimesSync(backupPath, twoDaysAgo, twoDaysAgo);

    // Should not delete with default 7-day retention
    const result1 = cleanupBackupsSync(testFile);
    expect(result1.deleted).toBe(0);

    // Should delete with 1-day retention
    const result2 = cleanupBackupsSync(testFile, {
      maxAge: 24 * 60 * 60 * 1000,
    });
    expect(result2.deleted).toBe(1);
  });
});

describe('DEFAULT_RETENTION constants', () => {
  it('should have correct default retention values', async () => {
    const { DEFAULT_RETENTION_DAYS, DEFAULT_RETENTION_MS } = await import('../file-io');

    expect(DEFAULT_RETENTION_DAYS).toBe(7);
    expect(DEFAULT_RETENTION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
