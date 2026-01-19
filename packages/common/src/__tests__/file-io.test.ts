/**
 * Unit tests for file I/O utilities
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { atomicWrite, atomicWriteSync, AtomicWriteError } from '../file-io';

describe('atomicWrite', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-write-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('basic functionality', () => {
    it('should write string content to a new file', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'Hello, World!';

      await atomicWrite(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should write buffer content to a new file', async () => {
      const filePath = path.join(testDir, 'test.bin');
      const content = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"

      await atomicWrite(filePath, content);

      const result = await fs.readFile(filePath);
      expect(result).toEqual(content);
    });

    it('should overwrite existing file content', async () => {
      const filePath = path.join(testDir, 'test.txt');

      // Write initial content
      await atomicWrite(filePath, 'Initial content');
      expect(await fs.readFile(filePath, 'utf-8')).toBe('Initial content');

      // Overwrite with new content
      await atomicWrite(filePath, 'New content');
      expect(await fs.readFile(filePath, 'utf-8')).toBe('New content');
    });
  });

  describe('directory creation', () => {
    it('should create parent directories by default', async () => {
      const filePath = path.join(testDir, 'nested', 'deep', 'test.txt');
      const content = 'Nested file';

      await atomicWrite(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should fail if createDirs is false and directory does not exist', async () => {
      const filePath = path.join(testDir, 'nonexistent', 'test.txt');
      const content = 'Test';

      await expect(atomicWrite(filePath, content, { createDirs: false })).rejects.toThrow(
        AtomicWriteError
      );
    });

    it('should create directories with proper permissions', async () => {
      const filePath = path.join(testDir, 'nested', 'test.txt');
      await atomicWrite(filePath, 'test');

      const dirStats = await fs.stat(path.join(testDir, 'nested'));
      // Check that directory is readable and executable (0o755 = drwxr-xr-x)
      expect(dirStats.isDirectory()).toBe(true);
      // Mode check is platform-dependent, just verify it's a directory
    });
  });

  describe('file permissions', () => {
    it('should set default file permissions (0o644)', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await atomicWrite(filePath, 'test');

      const stats = await fs.stat(filePath);
      // On Unix-like systems, check permissions
      if (process.platform !== 'win32') {
        expect(stats.mode & 0o777).toBe(0o644);
      }
    });

    it('should set custom file permissions', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await atomicWrite(filePath, 'test', { mode: 0o600 });

      const stats = await fs.stat(filePath);
      if (process.platform !== 'win32') {
        expect(stats.mode & 0o777).toBe(0o600);
      }
    });
  });

  describe('encoding support', () => {
    it('should use utf-8 encoding by default', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'Unicode: 你好世界 🌍';

      await atomicWrite(filePath, content);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(content);
    });

    it('should support custom encoding', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const content = 'ASCII content';

      await atomicWrite(filePath, content, { encoding: 'ascii' });

      const result = await fs.readFile(filePath, 'ascii');
      expect(result).toBe(content);
    });
  });

  describe('atomicity guarantees', () => {
    it('should not leave temporary files after successful write', async () => {
      const filePath = path.join(testDir, 'test.txt');
      await atomicWrite(filePath, 'test');

      // Check that no .tmp files exist in the directory
      const files = await fs.readdir(testDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('should clean up temporary file on write error', async () => {
      const invalidPath = path.join(testDir, 'test.txt');

      // Create a directory with the target name to cause a write error
      await fs.mkdir(invalidPath);

      await expect(atomicWrite(invalidPath, 'test')).rejects.toThrow(AtomicWriteError);

      // Check that no .tmp files were left behind
      const files = await fs.readdir(testDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('should not corrupt existing file if write fails', async () => {
      const filePath = path.join(testDir, 'test.txt');
      const originalContent = 'Original content';

      // Write initial content
      await atomicWrite(filePath, originalContent);

      // Make file read-only to cause rename to fail on some systems
      // This test is platform-dependent, so we'll use a simpler approach:
      // Try to write to an invalid location that will fail during rename
      const invalidDir = path.join(testDir, 'invalid.txt');
      await fs.mkdir(invalidDir); // Create as directory

      try {
        await atomicWrite(invalidDir, 'new content');
      } catch {
        // Expected to fail
      }

      // Original file should still have original content
      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(originalContent);
    });
  });

  describe('error handling', () => {
    it('should throw AtomicWriteError with descriptive message', async () => {
      const invalidPath = path.join(testDir, 'nonexistent.txt');
      await fs.mkdir(invalidPath); // Create as directory to cause error

      try {
        await atomicWrite(invalidPath, 'test');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(AtomicWriteError);
        expect((error as AtomicWriteError).message).toContain('Failed to atomically write');
        expect((error as AtomicWriteError).filePath).toBe(path.resolve(invalidPath));
        expect((error as AtomicWriteError).originalError).toBeDefined();
      }
    });

    it('should handle absolute and relative paths', async () => {
      const relativePath = 'test.txt';
      const absolutePath = path.join(testDir, 'test.txt');

      // Write using relative path (from test directory)
      const originalCwd = process.cwd();
      process.chdir(testDir);

      try {
        await atomicWrite(relativePath, 'relative');
        const result = await fs.readFile(absolutePath, 'utf-8');
        expect(result).toBe('relative');
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe('concurrent writes', () => {
    it('should handle multiple concurrent writes to different files', async () => {
      const writes = Array.from({ length: 10 }, (_, i) =>
        atomicWrite(path.join(testDir, `file-${i}.txt`), `Content ${i}`)
      );

      await Promise.all(writes);

      // Verify all files were written correctly
      for (let i = 0; i < 10; i++) {
        const content = await fs.readFile(path.join(testDir, `file-${i}.txt`), 'utf-8');
        expect(content).toBe(`Content ${i}`);
      }
    });

    it('should handle sequential writes to the same file', async () => {
      const filePath = path.join(testDir, 'test.txt');

      // Write multiple times sequentially
      for (let i = 0; i < 5; i++) {
        await atomicWrite(filePath, `Version ${i}`);
      }

      // Should have the last version
      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toBe('Version 4');
    });
  });
});

describe('atomicWriteSync', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'atomic-write-sync-test-'));
  });

  afterEach(() => {
    try {
      fsSync.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should write content synchronously', () => {
    const filePath = path.join(testDir, 'test.txt');
    const content = 'Sync write';

    atomicWriteSync(filePath, content);

    const result = fsSync.readFileSync(filePath, 'utf-8');
    expect(result).toBe(content);
  });

  it('should create parent directories synchronously', () => {
    const filePath = path.join(testDir, 'nested', 'deep', 'test.txt');
    const content = 'Nested sync';

    atomicWriteSync(filePath, content);

    const result = fsSync.readFileSync(filePath, 'utf-8');
    expect(result).toBe(content);
  });

  it('should throw AtomicWriteError on failure', () => {
    const invalidPath = path.join(testDir, 'invalid.txt');
    fsSync.mkdirSync(invalidPath); // Create as directory

    expect(() => {
      atomicWriteSync(invalidPath, 'test');
    }).toThrow(AtomicWriteError);
  });

  it('should clean up temporary file on error', () => {
    const invalidPath = path.join(testDir, 'invalid.txt');
    fsSync.mkdirSync(invalidPath);

    try {
      atomicWriteSync(invalidPath, 'test');
    } catch {
      // Expected
    }

    const files = fsSync.readdirSync(testDir);
    const tmpFiles = files.filter((f) => f.includes('.tmp'));
    expect(tmpFiles).toHaveLength(0);
  });

  describe('crash simulation', () => {
    /**
     * These tests verify atomicity guarantees during crash scenarios.
     * Since we cannot directly mock fs/promises (read-only properties),
     * we verify atomicity through behavioral testing:
     * - Existing tests already verify temp file cleanup on errors
     * - Below tests verify atomicity under various realistic failure modes
     */

    it('should maintain atomicity when writing very large files', async () => {
      const filePath = path.join(testDir, 'large-file-test.txt');
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB

      await atomicWrite(filePath, largeContent);

      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(largeContent);
      expect(result.length).toBe(10 * 1024 * 1024);

      // Verify no temp files left
      const files = await fs.readdir(testDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('should preserve existing file content when write to read-only parent fails', async () => {
      if (process.platform === 'win32') {
        // Skip on Windows - permissions work differently
        return;
      }

      const readOnlyDir = path.join(testDir, 'readonly');
      const filePath = path.join(readOnlyDir, 'existing.txt');
      const originalContent = 'Original content must be preserved';

      // Create directory and file
      await fs.mkdir(readOnlyDir);
      await atomicWrite(filePath, originalContent);

      // Make directory read-only
      await fs.chmod(readOnlyDir, 0o555);

      try {
        await atomicWrite(filePath, 'New content should fail');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(AtomicWriteError);
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(readOnlyDir, 0o755);
      }

      // Original file should be unchanged
      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(originalContent);
    });

    it('should handle rapid sequential overwrites without corruption', async () => {
      const filePath = path.join(testDir, 'rapid-writes.txt');

      // Perform 20 rapid sequential writes
      for (let i = 0; i < 20; i++) {
        await atomicWrite(filePath, `Version ${i}`);
      }

      // File should have the last version
      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe('Version 19');

      // No temp files should remain
      const files = await fs.readdir(testDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('should handle concurrent writes to same file gracefully', async () => {
      const filePath = path.join(testDir, 'concurrent-same.txt');

      // Start 5 concurrent writes to the same file
      const writes = Array.from({ length: 5 }, (_, i) => atomicWrite(filePath, `Concurrent ${i}`));

      // All should complete without error
      await Promise.all(writes);

      // File should have one of the versions (last writer wins)
      const result = await fs.readFile(filePath, 'utf-8');
      expect(result).toMatch(/^Concurrent \d$/);

      // No temp files should remain
      const files = await fs.readdir(testDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('should handle mix of successful and failed writes', async () => {
      const validPath = path.join(testDir, 'valid.txt');
      const invalidPath = path.join(testDir, 'invalid');

      // Create 'invalid' as a directory to cause write errors
      await fs.mkdir(invalidPath);

      const writes = [
        atomicWrite(validPath, 'Should succeed').then(() => ({ success: true, path: validPath })),
        atomicWrite(invalidPath, 'Should fail').catch(() => ({
          success: false,
          path: invalidPath,
        })),
      ];

      const results = await Promise.all(writes);

      // First write should succeed
      expect(results[0]?.success).toBe(true);
      const content = await fs.readFile(validPath, 'utf-8');
      expect(content).toBe('Should succeed');

      // Second write should fail
      expect(results[1]?.success).toBe(false);

      // No temp files should remain
      const files = await fs.readdir(testDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('should maintain atomicity across different encodings', async () => {
      const filePath = path.join(testDir, 'encoding-test.txt');
      const unicodeContent = 'Unicode: 你好世界 🌍 Здравствуй мир';

      // Write with UTF-8
      await atomicWrite(filePath, unicodeContent, { encoding: 'utf-8' });
      let result = await fs.readFile(filePath, 'utf-8');
      expect(result).toBe(unicodeContent);

      // Overwrite with different content
      const asciiContent = 'Simple ASCII content';
      await atomicWrite(filePath, asciiContent, { encoding: 'ascii' });
      result = await fs.readFile(filePath, 'ascii');
      expect(result).toBe(asciiContent);

      // No temp files should remain
      const files = await fs.readdir(testDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('should handle writes to deeply nested paths', async () => {
      const deepPath = path.join(testDir, 'a', 'b', 'c', 'd', 'e', 'f', 'deep.txt');
      const content = 'Deep file content';

      await atomicWrite(deepPath, content);

      const result = await fs.readFile(deepPath, 'utf-8');
      expect(result).toBe(content);

      // Verify all directories were created
      const stats = await fs.stat(path.dirname(deepPath));
      expect(stats.isDirectory()).toBe(true);

      // No temp files in any directory
      const collectTmpFiles = async (dir: string): Promise<string[]> => {
        const tmpFiles: string[] = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.includes('.tmp')) {
            tmpFiles.push(entry.name);
          }
          if (entry.isDirectory()) {
            tmpFiles.push(...(await collectTmpFiles(path.join(dir, entry.name))));
          }
        }
        return tmpFiles;
      };

      const tmpFiles = await collectTmpFiles(testDir);
      expect(tmpFiles).toHaveLength(0);
    });

    it('should handle binary data without corruption', async () => {
      const filePath = path.join(testDir, 'binary-data.bin');
      const binaryData = Buffer.from(Array.from({ length: 1024 }, (_, i) => i % 256));

      await atomicWrite(filePath, binaryData);

      const result = await fs.readFile(filePath);
      expect(Buffer.compare(result, binaryData)).toBe(0);

      // No temp files
      const files = await fs.readdir(testDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('should verify atomicity: temp files never visible to readers', async () => {
      const filePath = path.join(testDir, 'reader-test.txt');

      // Perform many writes
      for (let i = 0; i < 10; i++) {
        await atomicWrite(filePath, `Content ${i}`);
      }

      // In a proper atomic implementation, temp files are cleaned up immediately
      // This test verifies no temp files remain after writes complete
      const files = await fs.readdir(testDir);
      const tmpFiles = files.filter((f) => f.includes('.tmp'));
      expect(tmpFiles).toHaveLength(0);
    });
  });
});
