/**
 * Tests for backup functionality
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createBackup, createBackupSync, BackupError } from '../file-io';

describe('createBackup', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'backup-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Basic functionality', () => {
    it('should create a timestamped backup of a file', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const content = 'Hello, backup!';

      // Create source file
      await fs.writeFile(testFile, content);

      // Create backup
      const backupPath = await createBackup(testFile);

      // Verify backup was created
      expect(backupPath).toBeTruthy();
      expect(backupPath).toContain('test.');
      expect(backupPath).toMatch(/test\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}\.txt$/);

      // Verify backup content matches original
      const backupContent = await fs.readFile(backupPath!, 'utf-8');
      expect(backupContent).toBe(content);

      // Verify original file is unchanged
      const originalContent = await fs.readFile(testFile, 'utf-8');
      expect(originalContent).toBe(content);
    });

    it('should return null if source file does not exist', async () => {
      const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');

      const backupPath = await createBackup(nonExistentFile);

      expect(backupPath).toBeNull();
    });

    it('should preserve file extension', async () => {
      const testFile = path.join(tempDir, 'config.json');
      await fs.writeFile(testFile, '{"key": "value"}');

      const backupPath = await createBackup(testFile);

      expect(backupPath).toBeTruthy();
      expect(backupPath).toMatch(/\.json$/);
    });

    it('should handle files without extensions', async () => {
      const testFile = path.join(tempDir, 'README');
      await fs.writeFile(testFile, 'Test readme');

      const backupPath = await createBackup(testFile);

      expect(backupPath).toBeTruthy();
      expect(path.basename(backupPath!)).toMatch(/^README\.\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle binary files', async () => {
      const testFile = path.join(tempDir, 'test.bin');
      const binaryContent = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);

      await fs.writeFile(testFile, binaryContent);

      const backupPath = await createBackup(testFile);

      expect(backupPath).toBeTruthy();

      const backupContent = await fs.readFile(backupPath!);
      expect(backupContent).toEqual(binaryContent);
    });
  });

  describe('Backup directory options', () => {
    it('should create backup in same directory by default', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      const backupPath = await createBackup(testFile);

      expect(backupPath).toBeTruthy();
      expect(path.dirname(backupPath!)).toBe(tempDir);
    });

    it('should create backup in custom directory', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const backupDir = path.join(tempDir, 'backups');

      await fs.writeFile(testFile, 'content');

      const backupPath = await createBackup(testFile, { backupDir });

      expect(backupPath).toBeTruthy();
      expect(path.dirname(backupPath!)).toBe(backupDir);
    });

    it('should create backup directory if it does not exist', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const backupDir = path.join(tempDir, 'nested', 'backups');

      await fs.writeFile(testFile, 'content');

      const backupPath = await createBackup(testFile, { backupDir });

      expect(backupPath).toBeTruthy();

      // Verify directory was created
      const stats = await fs.stat(backupDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should fail if backup directory does not exist and createDirs is false', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      const backupDir = path.join(tempDir, 'does-not-exist');

      await fs.writeFile(testFile, 'content');

      await expect(createBackup(testFile, { backupDir, createDirs: false })).rejects.toThrow(
        BackupError
      );
    });
  });

  describe('File permissions', () => {
    it('should preserve original file permissions by default', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'content');
      await fs.chmod(testFile, 0o600);

      const backupPath = await createBackup(testFile);

      expect(backupPath).toBeTruthy();

      const stats = await fs.stat(backupPath!);
      // eslint-disable-next-line no-bitwise
      expect(stats.mode & 0o777).toBe(0o600);
    });

    it('should use custom permissions when specified', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'content');
      await fs.chmod(testFile, 0o600);

      const backupPath = await createBackup(testFile, { mode: 0o644 });

      expect(backupPath).toBeTruthy();

      const stats = await fs.stat(backupPath!);
      // eslint-disable-next-line no-bitwise
      expect(stats.mode & 0o777).toBe(0o644);
    });
  });

  describe('Custom timestamp format', () => {
    it('should use custom timestamp format when provided', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      const customFormat = (date: Date): string => `backup-${date.getTime()}`;

      const backupPath = await createBackup(testFile, { timestampFormat: customFormat });

      expect(backupPath).toBeTruthy();
      expect(backupPath).toMatch(/test\.backup-\d+\.txt$/);
    });
  });

  describe('Multiple backups', () => {
    it('should create multiple backups with different timestamps', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'version 1');

      // Create first backup
      const backup1 = await createBackup(testFile);

      // Wait a bit to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Update file
      await fs.writeFile(testFile, 'version 2');

      // Create second backup
      const backup2 = await createBackup(testFile);

      expect(backup1).toBeTruthy();
      expect(backup2).toBeTruthy();
      expect(backup1).not.toBe(backup2);

      // Verify both backups exist
      const content1 = await fs.readFile(backup1!, 'utf-8');
      const content2 = await fs.readFile(backup2!, 'utf-8');

      expect(content1).toBe('version 1');
      expect(content2).toBe('version 2');
    });
  });

  describe('Error handling', () => {
    it('should throw BackupError with descriptive message on failure', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      // Create backup directory as a file to force error
      const backupDir = path.join(tempDir, 'backups');
      await fs.writeFile(backupDir, 'file not dir');

      await expect(createBackup(testFile, { backupDir })).rejects.toThrow(BackupError);
      await expect(createBackup(testFile, { backupDir })).rejects.toThrow(
        /Failed to create backup/
      );
    });

    it('should include original error in BackupError', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      const backupDir = path.join(tempDir, 'backups');
      await fs.writeFile(backupDir, 'file not dir');

      try {
        await createBackup(testFile, { backupDir });
        fail('Should have thrown BackupError');
      } catch (error) {
        expect(error).toBeInstanceOf(BackupError);
        const backupError = error as BackupError;
        expect(backupError.originalError).toBeDefined();
        expect(backupError.sourcePath).toBe(path.resolve(testFile));
      }
    });

    it('should handle absolute and relative paths', async () => {
      const testFile = path.join(tempDir, 'test.txt');
      await fs.writeFile(testFile, 'content');

      // Test with relative path
      const relativePath = path.relative(process.cwd(), testFile);
      const backupPath = await createBackup(relativePath);

      expect(backupPath).toBeTruthy();

      const backupContent = await fs.readFile(backupPath!, 'utf-8');
      expect(backupContent).toBe('content');
    });
  });
});

describe('createBackupSync', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'backup-sync-test-'));
  });

  afterEach(() => {
    fsSync.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should create a timestamped backup synchronously', () => {
    const testFile = path.join(tempDir, 'test.txt');
    const content = 'Sync backup test';

    fsSync.writeFileSync(testFile, content);

    const backupPath = createBackupSync(testFile);

    expect(backupPath).toBeTruthy();
    expect(backupPath).toMatch(/test\.\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}\.txt$/);

    const backupContent = fsSync.readFileSync(backupPath!, 'utf-8');
    expect(backupContent).toBe(content);
  });

  it('should return null if source file does not exist', () => {
    const nonExistentFile = path.join(tempDir, 'does-not-exist.txt');

    const backupPath = createBackupSync(nonExistentFile);

    expect(backupPath).toBeNull();
  });

  it('should create backup in custom directory', () => {
    const testFile = path.join(tempDir, 'test.txt');
    const backupDir = path.join(tempDir, 'backups');

    fsSync.writeFileSync(testFile, 'content');

    const backupPath = createBackupSync(testFile, { backupDir });

    expect(backupPath).toBeTruthy();
    expect(path.dirname(backupPath!)).toBe(backupDir);
    expect(fsSync.existsSync(backupDir)).toBe(true);
  });

  it('should preserve file permissions', () => {
    const testFile = path.join(tempDir, 'test.txt');
    fsSync.writeFileSync(testFile, 'content');
    fsSync.chmodSync(testFile, 0o600);

    const backupPath = createBackupSync(testFile);

    expect(backupPath).toBeTruthy();

    const stats = fsSync.statSync(backupPath!);
    // eslint-disable-next-line no-bitwise
    expect(stats.mode & 0o777).toBe(0o600);
  });

  it('should throw BackupError on failure', () => {
    const testFile = path.join(tempDir, 'test.txt');
    fsSync.writeFileSync(testFile, 'content');

    const backupDir = path.join(tempDir, 'backups');
    fsSync.writeFileSync(backupDir, 'file not dir');

    expect(() => createBackupSync(testFile, { backupDir })).toThrow(BackupError);
  });
});
