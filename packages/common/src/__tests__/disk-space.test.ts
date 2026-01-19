/**
 * Tests for disk-space.ts
 *
 * Tests disk space checking utilities for EC-5.1: Disk Full
 */

import * as os from 'os';
import * as path from 'path';
import {
  getDiskSpace,
  getDiskSpaceSync,
  checkDiskSpace,
  checkDiskSpaceSync,
  ensureSufficientDiskSpace,
  ensureSufficientDiskSpaceSync,
  formatBytes,
  DiskSpaceError,
  DEFAULT_MIN_FREE_SPACE_BYTES,
  DEFAULT_MIN_FREE_PERCENT,
} from '../disk-space';

describe('disk-space', () => {
  const testDir = os.tmpdir();

  describe('getDiskSpace', () => {
    it('should get disk space info for a valid path', async () => {
      const info = await getDiskSpace(testDir);

      // Verify all required fields are present and have correct types
      expect(typeof info.path).toBe('string');
      expect(typeof info.totalBytes).toBe('number');
      expect(typeof info.freeBytes).toBe('number');
      expect(typeof info.availableBytes).toBe('number');
      expect(typeof info.usedBytes).toBe('number');
      expect(typeof info.usedPercent).toBe('number');
      expect(typeof info.availablePercent).toBe('number');

      // Sanity checks
      expect(info.totalBytes).toBeGreaterThan(0);
      expect(info.availableBytes).toBeGreaterThanOrEqual(0);
      expect(info.availableBytes).toBeLessThanOrEqual(info.totalBytes);
      expect(info.usedBytes).toBeGreaterThanOrEqual(0);
      expect(info.usedBytes).toBeLessThanOrEqual(info.totalBytes);
      expect(info.usedPercent).toBeGreaterThanOrEqual(0);
      expect(info.usedPercent).toBeLessThanOrEqual(100);
      expect(info.availablePercent).toBeGreaterThanOrEqual(0);
      expect(info.availablePercent).toBeLessThanOrEqual(100);
    });

    it('should resolve relative paths to absolute', async () => {
      const info = await getDiskSpace('.');
      expect(path.isAbsolute(info.path)).toBe(true);
    });

    it('should work with existing directory paths', async () => {
      // statfs requires the path to exist - use a known directory
      const info = await getDiskSpace(testDir);

      expect(info.totalBytes).toBeGreaterThan(0);
      expect(info.availableBytes).toBeGreaterThanOrEqual(0);
    });

    it('should throw DiskSpaceError for invalid path', async () => {
      await expect(getDiskSpace('/path/that/absolutely/does/not/exist/anywhere')).rejects.toThrow(
        DiskSpaceError
      );
    });

    it('should include error details in DiskSpaceError', async () => {
      try {
        await getDiskSpace('/path/that/absolutely/does/not/exist/anywhere');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DiskSpaceError);
        const diskError = error as DiskSpaceError;
        expect(diskError.path).toBe('/path/that/absolutely/does/not/exist/anywhere');
        expect(diskError.message).toContain('Failed to get disk space');
        // originalError might be undefined depending on the error type
      }
    });
  });

  describe('getDiskSpaceSync', () => {
    it('should get disk space info synchronously', () => {
      const info = getDiskSpaceSync(testDir);

      // Verify all required fields are present and have correct types
      expect(typeof info.path).toBe('string');
      expect(typeof info.totalBytes).toBe('number');
      expect(typeof info.freeBytes).toBe('number');
      expect(typeof info.availableBytes).toBe('number');
      expect(typeof info.usedBytes).toBe('number');
      expect(typeof info.usedPercent).toBe('number');
      expect(typeof info.availablePercent).toBe('number');

      expect(info.totalBytes).toBeGreaterThan(0);
      expect(info.availableBytes).toBeGreaterThanOrEqual(0);
    });

    it('should match async version results', async () => {
      const syncInfo = getDiskSpaceSync(testDir);
      const asyncInfo = await getDiskSpace(testDir);

      expect(syncInfo.path).toBe(asyncInfo.path);
      expect(syncInfo.totalBytes).toBe(asyncInfo.totalBytes);
      // Available bytes can change slightly between calls on active systems
      // Allow for small differences (within 1MB)
      const diff = Math.abs(syncInfo.availableBytes - asyncInfo.availableBytes);
      expect(diff).toBeLessThan(1024 * 1024);
    });

    it('should throw DiskSpaceError for invalid path', () => {
      expect(() => getDiskSpaceSync('/path/that/absolutely/does/not/exist/anywhere')).toThrow(
        DiskSpaceError
      );
    });
  });

  describe('checkDiskSpace', () => {
    it('should return sufficient=true when enough space exists', async () => {
      const result = await checkDiskSpace(testDir, 1024); // 1KB

      expect(result.sufficient).toBe(true);
      expect(result.info).toBeDefined();
      expect(result.reason).toBeUndefined();
      expect(result.missingBytes).toBeUndefined();
    });

    it('should check with default minimum free space (100MB)', async () => {
      const info = await getDiskSpace(testDir);

      // Request space that would leave less than 100MB (DEFAULT_MIN_FREE_SPACE_BYTES)
      // We need to leave some space so we don't hit the "Insufficient disk space" error first
      const defaultMinFree = 100 * 1024 * 1024; // 100MB
      const hugeRequest = Math.max(0, info.availableBytes - defaultMinFree + 1024);
      const result = await checkDiskSpace(testDir, hugeRequest);

      // Should fail because we won't have 100MB left after
      expect(result.sufficient).toBe(false);
      if (result.reason) {
        expect(result.reason.toLowerCase()).toMatch(/would leave only|insufficient/);
      }
      expect(result.missingBytes).toBeGreaterThan(0);
    });

    it('should respect custom minFreeBytes option', async () => {
      const info = await getDiskSpace(testDir);
      const customMin = 500 * 1024 * 1024; // 500MB

      // Request space that would leave less than customMin
      const request = info.availableBytes - customMin + 1024;
      const result = await checkDiskSpace(testDir, request, {
        minFreeBytes: customMin,
      });

      if (info.availableBytes > customMin) {
        expect(result.sufficient).toBe(false);
        expect(result.reason).toContain('would leave only');
      }
    });

    it('should respect minFreePercent option', async () => {
      const info = await getDiskSpace(testDir);
      const customPercent = 10; // 10%

      // Request space that would leave less than 10%
      const targetRemaining = (info.totalBytes * customPercent) / 100;
      const request = Math.max(0, info.availableBytes - targetRemaining + 1024);

      const result = await checkDiskSpace(testDir, request, {
        minFreePercent: customPercent,
        minFreeBytes: 0, // Disable bytes check to isolate percent check
      });

      // Only check if we have enough space to make this test meaningful
      if (info.availableBytes > targetRemaining && request <= info.availableBytes) {
        expect(result.sufficient).toBe(false);
        if (result.reason) {
          expect(result.reason).toContain('%');
        }
      }
    });

    it('should return insufficient when requiredBytes exceeds available', async () => {
      const info = await getDiskSpace(testDir);
      const impossibleRequest = info.availableBytes + 1024 * 1024 * 1024; // 1GB more than available

      const result = await checkDiskSpace(testDir, impossibleRequest);

      expect(result.sufficient).toBe(false);
      expect(result.reason).toContain('Insufficient disk space');
      expect(result.missingBytes).toBeGreaterThan(0);
      // Allow for small variations in disk space between the two getDiskSpace calls
      const expectedMissing = impossibleRequest - info.availableBytes;
      expect(result.missingBytes).toBeGreaterThanOrEqual(expectedMissing - 1024 * 1024); // Allow 1MB variance
      expect(result.missingBytes).toBeLessThanOrEqual(expectedMissing + 1024 * 1024); // Allow 1MB variance
    });

    it('should work with requiredBytes=0 (just checking minimums)', async () => {
      const result = await checkDiskSpace(testDir, 0, {
        minFreeBytes: 1024,
        minFreePercent: 0.1,
      });

      // Should succeed unless disk is extremely full
      expect(result.info).toBeDefined();
      expect(typeof result.sufficient).toBe('boolean');
    });
  });

  describe('checkDiskSpaceSync', () => {
    it('should work synchronously', () => {
      const result = checkDiskSpaceSync(testDir, 1024);

      expect(result.sufficient).toBe(true);
      expect(result.info).toBeDefined();
    });

    it('should match async version behavior', async () => {
      const syncResult = checkDiskSpaceSync(testDir, 1024);
      const asyncResult = await checkDiskSpace(testDir, 1024);

      expect(syncResult.sufficient).toBe(asyncResult.sufficient);
      expect(syncResult.info.totalBytes).toBe(asyncResult.info.totalBytes);
    });

    it('should detect insufficient space', () => {
      const info = getDiskSpaceSync(testDir);
      const impossibleRequest = info.availableBytes + 1024 * 1024 * 1024;

      const result = checkDiskSpaceSync(testDir, impossibleRequest);

      expect(result.sufficient).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.missingBytes).toBeGreaterThan(0);
    });
  });

  describe('ensureSufficientDiskSpace', () => {
    it('should not throw when space is sufficient', async () => {
      await expect(ensureSufficientDiskSpace(testDir, 1024)).resolves.toBeUndefined();
    });

    it('should throw DiskSpaceError when space is insufficient', async () => {
      const info = await getDiskSpace(testDir);
      const impossibleRequest = info.availableBytes + 1024 * 1024 * 1024;

      await expect(ensureSufficientDiskSpace(testDir, impossibleRequest)).rejects.toThrow(
        DiskSpaceError
      );
    });

    it('should include details in thrown error', async () => {
      const info = await getDiskSpace(testDir);
      const impossibleRequest = info.availableBytes + 1024 * 1024 * 1024;

      try {
        await ensureSufficientDiskSpace(testDir, impossibleRequest);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DiskSpaceError);
        const diskError = error as DiskSpaceError;
        expect(diskError.path).toBeDefined();
        // Available bytes can change slightly between calls on active systems
        // Allow for small differences (within 1MB)
        const diff = Math.abs(diskError.availableBytes - info.availableBytes);
        expect(diff).toBeLessThan(1024 * 1024);
        expect(diskError.totalBytes).toBe(info.totalBytes);
        expect(diskError.requiredBytes).toBe(impossibleRequest);
      }
    });

    it('should respect custom options', async () => {
      const info = await getDiskSpace(testDir);
      const hugeMinimum = 100 * 1024 * 1024 * 1024; // 100GB minimum

      if (info.availableBytes < hugeMinimum) {
        await expect(
          ensureSufficientDiskSpace(testDir, 0, { minFreeBytes: hugeMinimum })
        ).rejects.toThrow(DiskSpaceError);
      }
    });
  });

  describe('ensureSufficientDiskSpaceSync', () => {
    it('should not throw when space is sufficient', () => {
      expect(() => ensureSufficientDiskSpaceSync(testDir, 1024)).not.toThrow();
    });

    it('should throw DiskSpaceError when space is insufficient', () => {
      const info = getDiskSpaceSync(testDir);
      const impossibleRequest = info.availableBytes + 1024 * 1024 * 1024;

      expect(() => ensureSufficientDiskSpaceSync(testDir, impossibleRequest)).toThrow(
        DiskSpaceError
      );
    });

    it('should match async version behavior', async () => {
      const smallRequest = 1024;

      // Both should succeed
      expect(() => ensureSufficientDiskSpaceSync(testDir, smallRequest)).not.toThrow();
      await expect(ensureSufficientDiskSpace(testDir, smallRequest)).resolves.toBeUndefined();

      // Both should fail for impossible requests
      const info = getDiskSpaceSync(testDir);
      const impossibleRequest = info.availableBytes + 1024 * 1024 * 1024;

      expect(() => ensureSufficientDiskSpaceSync(testDir, impossibleRequest)).toThrow(
        DiskSpaceError
      );
      await expect(ensureSufficientDiskSpace(testDir, impossibleRequest)).rejects.toThrow(
        DiskSpaceError
      );
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500.00 B');
      expect(formatBytes(1023)).toBe('1023.00 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1536)).toBe('1.50 KB');
      expect(formatBytes(10240)).toBe('10.00 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.50 MB');
      expect(formatBytes(100 * 1024 * 1024)).toBe('100.00 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
      expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
    });

    it('should format terabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
      expect(formatBytes(5.25 * 1024 * 1024 * 1024 * 1024)).toBe('5.25 TB');
    });

    it('should format petabytes', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024 * 1024)).toBe('1.00 PB');
    });

    it('should always show 2 decimal places', () => {
      expect(formatBytes(1536)).toBe('1.50 KB');
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1229)).toBe('1.20 KB');
    });
  });

  describe('DiskSpaceError', () => {
    it('should create error with required fields', () => {
      const error = new DiskSpaceError('Test error', '/test/path', 1000, 2000);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DiskSpaceError);
      expect(error.name).toBe('DiskSpaceError');
      expect(error.message).toBe('Test error');
      expect(error.path).toBe('/test/path');
      expect(error.availableBytes).toBe(1000);
      expect(error.totalBytes).toBe(2000);
    });

    it('should include optional fields', () => {
      const originalError = new Error('Original');
      const error = new DiskSpaceError('Test error', '/test/path', 1000, 2000, 5000, originalError);

      expect(error.requiredBytes).toBe(5000);
      expect(error.originalError).toBe(originalError);
    });

    it('should be catchable as Error', () => {
      try {
        throw new DiskSpaceError('Test', '/path', 0, 0);
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect(error instanceof DiskSpaceError).toBe(true);
      }
    });
  });

  describe('constants', () => {
    it('should export DEFAULT_MIN_FREE_SPACE_BYTES', () => {
      expect(DEFAULT_MIN_FREE_SPACE_BYTES).toBe(100 * 1024 * 1024); // 100MB
    });

    it('should export DEFAULT_MIN_FREE_PERCENT', () => {
      expect(DEFAULT_MIN_FREE_PERCENT).toBe(5); // 5%
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete disk space check workflow', async () => {
      // Get disk info
      const info = await getDiskSpace(testDir);
      expect(info.totalBytes).toBeGreaterThan(0);

      // Check if we can write a 10MB file
      const fileSize = 10 * 1024 * 1024;
      const result = await checkDiskSpace(testDir, fileSize, {
        minFreeBytes: 50 * 1024 * 1024, // Keep 50MB free
        minFreePercent: 1, // Keep 1% free
      });

      if (result.sufficient) {
        // We have enough space, ensure doesn't throw
        await expect(
          ensureSufficientDiskSpace(testDir, fileSize, {
            minFreeBytes: 50 * 1024 * 1024,
            minFreePercent: 1,
          })
        ).resolves.toBeUndefined();
      } else {
        // Not enough space, ensure throws
        await expect(
          ensureSufficientDiskSpace(testDir, fileSize, {
            minFreeBytes: 50 * 1024 * 1024,
            minFreePercent: 1,
          })
        ).rejects.toThrow(DiskSpaceError);
      }
    });

    it('should provide useful error messages for debugging', async () => {
      const info = await getDiskSpace(testDir);
      const impossibleRequest = info.totalBytes * 2; // Request more than entire disk

      try {
        await ensureSufficientDiskSpace(testDir, impossibleRequest);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(DiskSpaceError);
        const diskError = error as DiskSpaceError;

        // Error should contain useful information
        expect(diskError.message).toBeTruthy();
        expect(diskError.path).toBeTruthy();
        expect(diskError.availableBytes).toBeGreaterThanOrEqual(0);
        expect(diskError.totalBytes).toBeGreaterThan(0);
        expect(diskError.requiredBytes).toBe(impossibleRequest);
      }
    });

    it('should handle edge case of exactly matching available space', async () => {
      const info = await getDiskSpace(testDir);

      // Request slightly less than what we have to account for race conditions
      const requestedBytes = Math.floor(info.availableBytes * 0.99);
      const result = await checkDiskSpace(testDir, requestedBytes, {
        minFreeBytes: 0,
        minFreePercent: 0,
      });

      // Should pass if we have enough space and disable all minimum requirements
      expect(result.sufficient).toBe(true);
    });
  });
});
