/**
 * Unit tests for PID Manager
 *
 * Tests the PID file management system for preventing duplicate
 * daemon/process instances from running concurrently.
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  acquirePidLock,
  getPidDirectory,
  getPidFilePath,
  isProcessRunning,
  isProcessRunningByPid,
  listActivePids,
  PidError,
  readPidFile,
  removePidFile,
  removePidFileSync,
  writePidFile,
} from '../pid-manager';

describe('PID Manager', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a unique temporary directory for each test
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pid-manager-test-'));
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getPidDirectory()', () => {
    it('should return default PID directory', () => {
      const dir = getPidDirectory();
      expect(dir).toContain('pids');
    });

    it('should use custom base directory', () => {
      const dir = getPidDirectory({ baseDir: '/custom/path' });
      expect(dir).toBe('/custom/path/pids');
    });

    it('should resolve to absolute path', () => {
      const dir = getPidDirectory({ baseDir: './relative' });
      expect(path.isAbsolute(dir)).toBe(true);
    });
  });

  describe('getPidFilePath()', () => {
    it('should return PID file path for process name', () => {
      const filePath = getPidFilePath('test-daemon', { baseDir: testDir });
      expect(filePath).toContain('test-daemon.pid');
      expect(path.dirname(filePath)).toContain('pids');
    });

    it('should sanitize process name with special characters', () => {
      const filePath = getPidFilePath('test@daemon#123', { baseDir: testDir });
      expect(filePath).toContain('test-daemon-123.pid');
    });

    it('should throw PidError for empty process name', () => {
      expect(() => getPidFilePath('', { baseDir: testDir })).toThrow(PidError);
      expect(() => getPidFilePath('', { baseDir: testDir })).toThrow(
        'Process name cannot be empty'
      );
    });

    it('should throw PidError for whitespace-only process name', () => {
      expect(() => getPidFilePath('   ', { baseDir: testDir })).toThrow(PidError);
    });

    it('should create predictable filenames', () => {
      const filePath1 = getPidFilePath('scheduler-daemon', { baseDir: testDir });
      const filePath2 = getPidFilePath('scheduler-daemon', { baseDir: testDir });
      expect(filePath1).toBe(filePath2);
    });

    it('should handle process names with hyphens and underscores', () => {
      const filePath = getPidFilePath('my_daemon-service', { baseDir: testDir });
      expect(filePath).toContain('my_daemon-service.pid');
    });
  });

  describe('isProcessRunning()', () => {
    it('should return true for current process', () => {
      expect(isProcessRunning(process.pid)).toBe(true);
    });

    it('should return false for invalid PID (0)', () => {
      expect(isProcessRunning(0)).toBe(false);
    });

    it('should return false for negative PID', () => {
      expect(isProcessRunning(-1)).toBe(false);
      expect(isProcessRunning(-999)).toBe(false);
    });

    it('should return false for non-existent PID', () => {
      // Use a very high PID that likely doesn't exist
      const nonExistentPid = 9999999;
      expect(isProcessRunning(nonExistentPid)).toBe(false);
    });

    it('should handle permission errors (EPERM)', () => {
      // We can't reliably test EPERM without specific system setup,
      // but we can verify the function handles it correctly by checking the code path
      // The function should return true if EPERM is received
      const result = isProcessRunning(1); // PID 1 is usually init/systemd
      // Result depends on permissions, but should not throw
      expect(typeof result).toBe('boolean');
    });
  });

  describe('writePidFile()', () => {
    it('should create valid PID file', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, process.pid, { baseDir: testDir });

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      const content = await fs.readFile(filePath, 'utf-8');
      const pidInfo = JSON.parse(content);

      expect(pidInfo.pid).toBe(process.pid);
      expect(pidInfo.processName).toBe(processName);
      expect(pidInfo.createdAt).toBeDefined();
      expect(pidInfo.hostname).toBeDefined();
    });

    it('should use current process PID by default', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, undefined, { baseDir: testDir });

      const pidInfo = await readPidFile(processName, { baseDir: testDir });
      expect(pidInfo?.pid).toBe(process.pid);
    });

    it('should create PID directory if it does not exist', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, process.pid, { baseDir: testDir });

      const pidDir = getPidDirectory({ baseDir: testDir });
      const stats = await fs.stat(pidDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should write file with correct format', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, 12345, { baseDir: testDir });

      const pidInfo = await readPidFile(processName, { baseDir: testDir });
      expect(pidInfo).toMatchObject({
        pid: 12345,
        processName: 'test-daemon',
      });
      expect(pidInfo?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should overwrite existing PID file', async () => {
      const processName = 'test-daemon';

      await writePidFile(processName, 11111, { baseDir: testDir });
      let pidInfo = await readPidFile(processName, { baseDir: testDir });
      expect(pidInfo?.pid).toBe(11111);

      await writePidFile(processName, 22222, { baseDir: testDir });
      pidInfo = await readPidFile(processName, { baseDir: testDir });
      expect(pidInfo?.pid).toBe(22222);
    });

    it('should include hostname in PID file', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, process.pid, { baseDir: testDir });

      const pidInfo = await readPidFile(processName, { baseDir: testDir });
      expect(pidInfo?.hostname).toBeDefined();
      expect(typeof pidInfo?.hostname).toBe('string');
    });
  });

  describe('readPidFile()', () => {
    it('should read valid PID file', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, 12345, { baseDir: testDir });

      const pidInfo = await readPidFile(processName, { baseDir: testDir });
      expect(pidInfo).toMatchObject({
        pid: 12345,
        processName: 'test-daemon',
      });
    });

    it('should return null for non-existent file', async () => {
      const pidInfo = await readPidFile('non-existent', { baseDir: testDir });
      expect(pidInfo).toBeNull();
    });

    it('should throw PidError for malformed JSON', async () => {
      const processName = 'test-daemon';
      const filePath = getPidFilePath(processName, { baseDir: testDir });

      // Create directory
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write invalid JSON
      await fs.writeFile(filePath, 'not valid json');

      await expect(readPidFile(processName, { baseDir: testDir })).rejects.toThrow(PidError);
    });

    it('should throw PidError for PID file missing required fields', async () => {
      const processName = 'test-daemon';
      const filePath = getPidFilePath(processName, { baseDir: testDir });

      // Create directory
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Write incomplete PID info
      await fs.writeFile(filePath, JSON.stringify({ pid: 12345 }));

      await expect(readPidFile(processName, { baseDir: testDir })).rejects.toThrow(PidError);
      await expect(readPidFile(processName, { baseDir: testDir })).rejects.toThrow('malformed');
    });

    it('should validate all required fields', async () => {
      const processName = 'test-daemon';
      const filePath = getPidFilePath(processName, { baseDir: testDir });

      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Missing processName
      await fs.writeFile(
        filePath,
        JSON.stringify({ pid: 12345, createdAt: new Date().toISOString() })
      );
      await expect(readPidFile(processName, { baseDir: testDir })).rejects.toThrow(PidError);

      // Missing createdAt
      await fs.writeFile(filePath, JSON.stringify({ pid: 12345, processName: 'test-daemon' }));
      await expect(readPidFile(processName, { baseDir: testDir })).rejects.toThrow(PidError);
    });
  });

  describe('removePidFile()', () => {
    it('should remove existing PID file', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, process.pid, { baseDir: testDir });

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(true);

      await removePidFile(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(false);
    });

    it('should not throw for non-existent file', async () => {
      await expect(removePidFile('non-existent', { baseDir: testDir })).resolves.not.toThrow();
    });

    it('should handle multiple removals gracefully', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, process.pid, { baseDir: testDir });

      await removePidFile(processName, { baseDir: testDir });
      await removePidFile(processName, { baseDir: testDir });
      await removePidFile(processName, { baseDir: testDir });

      // Should not throw
    });
  });

  describe('removePidFileSync()', () => {
    it('should remove existing PID file synchronously', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, process.pid, { baseDir: testDir });

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(true);

      removePidFileSync(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(false);
    });

    it('should not throw for non-existent file', () => {
      expect(() => removePidFileSync('non-existent', { baseDir: testDir })).not.toThrow();
    });

    it('should be usable in synchronous context (exit handlers)', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, process.pid, { baseDir: testDir });

      // Simulate exit handler
      const cleanup = () => {
        removePidFileSync(processName, { baseDir: testDir });
      };

      expect(() => cleanup()).not.toThrow();

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(false);
    });
  });

  describe('isProcessRunningByPid()', () => {
    it('should return PidInfo for running process', async () => {
      const processName = 'test-daemon';
      await writePidFile(processName, process.pid, { baseDir: testDir });

      const pidInfo = await isProcessRunningByPid(processName, { baseDir: testDir });
      expect(pidInfo).toBeDefined();
      expect(pidInfo?.pid).toBe(process.pid);
    });

    it('should return null for non-existent PID file', async () => {
      const pidInfo = await isProcessRunningByPid('non-existent', { baseDir: testDir });
      expect(pidInfo).toBeNull();
    });

    it('should return null and remove stale PID file', async () => {
      const processName = 'test-daemon';
      const nonExistentPid = 9999999;

      await writePidFile(processName, nonExistentPid, { baseDir: testDir });

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(true);

      const pidInfo = await isProcessRunningByPid(processName, {
        baseDir: testDir,
        removeStale: true,
      });

      expect(pidInfo).toBeNull();
      expect(fsSync.existsSync(filePath)).toBe(false);
    });

    it('should not remove stale file when removeStale is false', async () => {
      const processName = 'test-daemon';
      const nonExistentPid = 9999999;

      await writePidFile(processName, nonExistentPid, { baseDir: testDir });

      const pidInfo = await isProcessRunningByPid(processName, {
        baseDir: testDir,
        removeStale: false,
      });

      expect(pidInfo).toBeNull();

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(true);
    });

    it('should return PidInfo without checking when checkProcess is false', async () => {
      const processName = 'test-daemon';
      const nonExistentPid = 9999999;

      await writePidFile(processName, nonExistentPid, { baseDir: testDir });

      const pidInfo = await isProcessRunningByPid(processName, {
        baseDir: testDir,
        checkProcess: false,
      });

      expect(pidInfo).toBeDefined();
      expect(pidInfo?.pid).toBe(nonExistentPid);
    });

    it('should handle malformed PID file gracefully', async () => {
      const processName = 'test-daemon';
      const filePath = getPidFilePath(processName, { baseDir: testDir });

      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, 'invalid json');

      const pidInfo = await isProcessRunningByPid(processName, { baseDir: testDir });
      expect(pidInfo).toBeNull();
    });
  });

  describe('acquirePidLock()', () => {
    it('should acquire lock successfully when no process running', async () => {
      const processName = 'test-daemon';
      const cleanup = await acquirePidLock(processName, { baseDir: testDir });

      expect(cleanup).toBeInstanceOf(Function);

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(true);

      await cleanup();
      expect(fsSync.existsSync(filePath)).toBe(false);
    });

    it('should throw PidError when process already running', async () => {
      const processName = 'test-daemon';

      // Acquire first lock
      await acquirePidLock(processName, { baseDir: testDir });

      // Try to acquire second lock
      await expect(acquirePidLock(processName, { baseDir: testDir })).rejects.toThrow(PidError);
      await expect(acquirePidLock(processName, { baseDir: testDir })).rejects.toThrow(
        'already running'
      );
    });

    it('should include PID in error message', async () => {
      const processName = 'test-daemon';

      await acquirePidLock(processName, { baseDir: testDir });

      try {
        await acquirePidLock(processName, { baseDir: testDir });
        fail('Should have thrown PidError');
      } catch (error) {
        expect(error).toBeInstanceOf(PidError);
        expect((error as Error).message).toContain(String(process.pid));
      }
    });

    it('should clean up stale PID files and acquire lock', async () => {
      const processName = 'test-daemon';
      const nonExistentPid = 9999999;

      await writePidFile(processName, nonExistentPid, { baseDir: testDir });

      // Should clean up stale file and acquire lock
      const cleanup = await acquirePidLock(processName, { baseDir: testDir });
      expect(cleanup).toBeInstanceOf(Function);

      const pidInfo = await readPidFile(processName, { baseDir: testDir });
      expect(pidInfo?.pid).toBe(process.pid);

      await cleanup();
    });

    it('should return cleanup function that removes PID file', async () => {
      const processName = 'test-daemon';
      const cleanup = await acquirePidLock(processName, { baseDir: testDir });

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(true);

      await cleanup();
      expect(fsSync.existsSync(filePath)).toBe(false);
    });

    it('should allow re-acquiring lock after cleanup', async () => {
      const processName = 'test-daemon';

      const cleanup1 = await acquirePidLock(processName, { baseDir: testDir });
      await cleanup1();

      const cleanup2 = await acquirePidLock(processName, { baseDir: testDir });
      expect(cleanup2).toBeInstanceOf(Function);
      await cleanup2();
    });
  });

  describe('listActivePids()', () => {
    it('should return empty array for empty directory', async () => {
      const pids = await listActivePids({ baseDir: testDir });
      expect(pids).toEqual([]);
    });

    it('should list all active PIDs', async () => {
      await writePidFile('daemon-1', process.pid, { baseDir: testDir });
      await writePidFile('daemon-2', process.pid, { baseDir: testDir });
      await writePidFile('daemon-3', process.pid, { baseDir: testDir });

      const pids = await listActivePids({ baseDir: testDir });
      expect(pids.length).toBe(3);

      const processNames = pids.map((p) => p.processName).sort();
      expect(processNames).toEqual(['daemon-1', 'daemon-2', 'daemon-3']);
    });

    it('should filter out stale PID files', async () => {
      await writePidFile('daemon-1', process.pid, { baseDir: testDir });
      await writePidFile('daemon-2', 9999999, { baseDir: testDir }); // Stale
      await writePidFile('daemon-3', process.pid, { baseDir: testDir });

      const pids = await listActivePids({ baseDir: testDir });
      expect(pids.length).toBe(2);

      const processNames = pids.map((p) => p.processName).sort();
      expect(processNames).toEqual(['daemon-1', 'daemon-3']);
    });

    it('should handle malformed PID files gracefully', async () => {
      await writePidFile('daemon-1', process.pid, { baseDir: testDir });

      const filePath = getPidFilePath('daemon-2', { baseDir: testDir });
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, 'invalid json');

      const pids = await listActivePids({ baseDir: testDir });
      expect(pids.length).toBe(1);
      expect(pids[0]?.processName).toBe('daemon-1');
    });

    it('should create PID directory if it does not exist', async () => {
      const pids = await listActivePids({ baseDir: testDir });
      expect(pids).toEqual([]);

      const pidDir = getPidDirectory({ baseDir: testDir });
      const stats = await fs.stat(pidDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should ignore non-.pid files', async () => {
      await writePidFile('daemon-1', process.pid, { baseDir: testDir });

      const pidDir = getPidDirectory({ baseDir: testDir });
      await fs.writeFile(path.join(pidDir, 'other.txt'), 'not a pid file');

      const pids = await listActivePids({ baseDir: testDir });
      expect(pids.length).toBe(1);
      expect(pids[0]?.processName).toBe('daemon-1');
    });
  });

  describe('PidError', () => {
    it('should create error with message', () => {
      const error = new PidError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('PidError');
    });

    it('should include processName', () => {
      const error = new PidError('Test error', 'test-daemon');
      expect(error.processName).toBe('test-daemon');
    });

    it('should include pidPath', () => {
      const error = new PidError('Test error', 'test-daemon', '/path/to/file.pid');
      expect(error.pidPath).toBe('/path/to/file.pid');
    });

    it('should include cause', () => {
      const cause = new Error('Original error');
      const error = new PidError('Test error', 'test-daemon', '/path', cause);
      expect(error.cause).toBe(cause);
    });

    it('should have stack trace', () => {
      const error = new PidError('Test error');
      expect(error.stack).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle multiple PID files for different processes', async () => {
      const processes = ['daemon-1', 'daemon-2', 'daemon-3', 'daemon-4', 'daemon-5'];

      for (const proc of processes) {
        await writePidFile(proc, process.pid, { baseDir: testDir });
      }

      const pids = await listActivePids({ baseDir: testDir });
      expect(pids.length).toBe(5);
    });

    it('should handle rapid acquire/release cycles', async () => {
      const processName = 'test-daemon';

      for (let i = 0; i < 10; i++) {
        const cleanup = await acquirePidLock(processName, { baseDir: testDir });
        await cleanup();
      }

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(false);
    });

    it('should handle concurrent cleanup calls', async () => {
      const processName = 'test-daemon';
      const cleanup = await acquirePidLock(processName, { baseDir: testDir });

      await Promise.all([cleanup(), cleanup(), cleanup()]);

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(false);
    });

    it('should handle very long process names', async () => {
      const longName = 'a'.repeat(200);
      const cleanup = await acquirePidLock(longName, { baseDir: testDir });
      expect(cleanup).toBeInstanceOf(Function);
      await cleanup();
    });

    it('should handle process names with all special characters', async () => {
      const weirdName = '!@#$%^&*()+=[]{}|;:,.<>?/~`';
      const cleanup = await acquirePidLock(weirdName, { baseDir: testDir });
      expect(cleanup).toBeInstanceOf(Function);
      await cleanup();
    });
  });

  describe('integration scenarios', () => {
    it('should prevent duplicate daemon instances (EC-7.1)', async () => {
      const processName = 'scheduler-daemon';

      // Start first instance
      const cleanup1 = await acquirePidLock(processName, { baseDir: testDir });

      // Try to start second instance
      await expect(acquirePidLock(processName, { baseDir: testDir })).rejects.toThrow(PidError);

      // Cleanup first instance
      await cleanup1();

      // Now second instance can start
      const cleanup2 = await acquirePidLock(processName, { baseDir: testDir });
      expect(cleanup2).toBeInstanceOf(Function);
      await cleanup2();
    });

    it('should handle crash recovery (stale PID cleanup)', async () => {
      const processName = 'scheduler-daemon';

      // Simulate crashed process (write PID file with dead PID)
      await writePidFile(processName, 9999999, { baseDir: testDir });

      // New instance should clean up stale file and start
      const cleanup = await acquirePidLock(processName, { baseDir: testDir });
      expect(cleanup).toBeInstanceOf(Function);

      const pidInfo = await readPidFile(processName, { baseDir: testDir });
      expect(pidInfo?.pid).toBe(process.pid);

      await cleanup();
    });

    it('should work with signal handlers (sync cleanup)', async () => {
      const processName = 'test-daemon';
      await acquirePidLock(processName, { baseDir: testDir });

      // Simulate exit handler
      removePidFileSync(processName, { baseDir: testDir });

      const filePath = getPidFilePath(processName, { baseDir: testDir });
      expect(fsSync.existsSync(filePath)).toBe(false);
    });
  });
});
