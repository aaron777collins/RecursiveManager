/**
 * Tests for file recovery utilities
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  detectCorruption,
  detectCorruptionSync,
  findLatestBackup,
  findLatestBackupSync,
  attemptRecovery,
  attemptRecoverySync,
  safeLoad,
  safeLoadSync,
  CorruptionError,
  type CorruptionInfo,
  type RecoveryResult,
} from '../file-recovery';

describe('file-recovery', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'recovery-test-'));
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('detectCorruption', () => {
    it('should return null for valid JSON file', async () => {
      const filePath = path.join(testDir, 'valid.json');
      await fs.writeFile(filePath, JSON.stringify({ key: 'value' }));

      const result = await detectCorruption(filePath);

      expect(result).toBeNull();
    });

    it('should detect missing file', async () => {
      const filePath = path.join(testDir, 'missing.json');

      const result = await detectCorruption(filePath);

      expect(result).not.toBeNull();
      expect(result?.corruptionType).toBe('missing_file');
      expect(result?.filePath).toBe(filePath);
    });

    it('should detect parse errors', async () => {
      const filePath = path.join(testDir, 'invalid.json');
      await fs.writeFile(filePath, '{ invalid json }');

      const result = await detectCorruption(filePath);

      expect(result).not.toBeNull();
      expect(result?.corruptionType).toBe('parse_error');
      expect(result?.originalError).toBeInstanceOf(Error);
    });

    it('should detect validation errors with custom validator', async () => {
      const filePath = path.join(testDir, 'invalid-schema.json');
      await fs.writeFile(filePath, JSON.stringify({ wrong: 'schema' }));

      const validator = async (content: string) => {
        const data = JSON.parse(content);
        return data.key !== undefined;
      };

      const result = await detectCorruption(filePath, validator);

      expect(result).not.toBeNull();
      expect(result?.corruptionType).toBe('validation_error');
    });

    it('should handle read errors gracefully', async () => {
      const filePath = path.join(testDir, 'no-permission.json');
      await fs.writeFile(filePath, '{}');
      await fs.chmod(filePath, 0o000);

      const result = await detectCorruption(filePath);

      expect(result).not.toBeNull();
      expect(result?.corruptionType).toBe('read_error');

      // Cleanup
      await fs.chmod(filePath, 0o644);
    });

    it('should include timestamp in corruption info', async () => {
      const filePath = path.join(testDir, 'corrupt.json');
      await fs.writeFile(filePath, 'not json');

      const before = new Date();
      const result = await detectCorruption(filePath);
      const after = new Date();

      expect(result).not.toBeNull();
      expect(result?.detectedAt).toBeInstanceOf(Date);
      expect(result!.detectedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result!.detectedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('detectCorruptionSync', () => {
    it('should return null for valid JSON file', () => {
      const filePath = path.join(testDir, 'valid.json');
      fsSync.writeFileSync(filePath, JSON.stringify({ key: 'value' }));

      const result = detectCorruptionSync(filePath);

      expect(result).toBeNull();
    });

    it('should detect missing file', () => {
      const filePath = path.join(testDir, 'missing.json');

      const result = detectCorruptionSync(filePath);

      expect(result).not.toBeNull();
      expect(result?.corruptionType).toBe('missing_file');
    });

    it('should detect parse errors', () => {
      const filePath = path.join(testDir, 'invalid.json');
      fsSync.writeFileSync(filePath, '{ bad json');

      const result = detectCorruptionSync(filePath);

      expect(result).not.toBeNull();
      expect(result?.corruptionType).toBe('parse_error');
    });

    it('should detect validation errors with custom validator', () => {
      const filePath = path.join(testDir, 'invalid-schema.json');
      fsSync.writeFileSync(filePath, JSON.stringify({ wrong: 'schema' }));

      const validator = (content: string) => {
        const data = JSON.parse(content);
        return data.required !== undefined;
      };

      const result = detectCorruptionSync(filePath, validator);

      expect(result).not.toBeNull();
      expect(result?.corruptionType).toBe('validation_error');
    });
  });

  describe('findLatestBackup', () => {
    it('should find the most recent valid backup', async () => {
      const filePath = path.join(testDir, 'config.json');

      // Create multiple backups
      const backup1 = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');
      const backup2 = path.join(testDir, 'config.2024-01-02T10-00-00-000.json');
      const backup3 = path.join(testDir, 'config.2024-01-03T10-00-00-000.json');

      await fs.writeFile(backup1, JSON.stringify({ version: 1 }));
      await fs.writeFile(backup2, JSON.stringify({ version: 2 }));
      await fs.writeFile(backup3, JSON.stringify({ version: 3 }));

      const result = await findLatestBackup(filePath);

      expect(result).toBe(backup3);
    });

    it('should skip corrupt backups', async () => {
      const filePath = path.join(testDir, 'config.json');

      const backup1 = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');
      const backup2 = path.join(testDir, 'config.2024-01-02T10-00-00-000.json');

      await fs.writeFile(backup1, JSON.stringify({ valid: true }));
      await fs.writeFile(backup2, 'corrupt json');

      const result = await findLatestBackup(filePath);

      // Should skip backup2 (most recent but corrupt) and return backup1
      expect(result).toBe(backup1);
    });

    it('should return null if no backups exist', async () => {
      const filePath = path.join(testDir, 'config.json');

      const result = await findLatestBackup(filePath);

      expect(result).toBeNull();
    });

    it('should return null if all backups are corrupt', async () => {
      const filePath = path.join(testDir, 'config.json');

      const backup1 = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');
      await fs.writeFile(backup1, 'not json');

      const result = await findLatestBackup(filePath);

      expect(result).toBeNull();
    });

    it('should use custom validator when provided', async () => {
      const filePath = path.join(testDir, 'config.json');

      const backup1 = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');
      const backup2 = path.join(testDir, 'config.2024-01-02T10-00-00-000.json');

      await fs.writeFile(backup1, JSON.stringify({ valid: true }));
      await fs.writeFile(backup2, JSON.stringify({ valid: false }));

      const validator = async (content: string) => {
        const data = JSON.parse(content);
        return data.valid === true;
      };

      const result = await findLatestBackup(filePath, { validator });

      // Should skip backup2 and return backup1
      expect(result).toBe(backup1);
    });

    it('should work with custom backup directory', async () => {
      const filePath = path.join(testDir, 'config.json');
      const backupDir = path.join(testDir, 'backups');
      await fs.mkdir(backupDir);

      const backup = path.join(backupDir, 'config.2024-01-01T10-00-00-000.json');
      await fs.writeFile(backup, JSON.stringify({ data: 'test' }));

      const result = await findLatestBackup(filePath, { backupDir });

      expect(result).toBe(backup);
    });
  });

  describe('findLatestBackupSync', () => {
    it('should find the most recent valid backup', () => {
      const filePath = path.join(testDir, 'config.json');

      const backup1 = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');
      const backup2 = path.join(testDir, 'config.2024-01-02T10-00-00-000.json');

      fsSync.writeFileSync(backup1, JSON.stringify({ version: 1 }));
      fsSync.writeFileSync(backup2, JSON.stringify({ version: 2 }));

      const result = findLatestBackupSync(filePath);

      expect(result).toBe(backup2);
    });

    it('should skip corrupt backups', () => {
      const filePath = path.join(testDir, 'config.json');

      const backup1 = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');
      const backup2 = path.join(testDir, 'config.2024-01-02T10-00-00-000.json');

      fsSync.writeFileSync(backup1, JSON.stringify({ valid: true }));
      fsSync.writeFileSync(backup2, 'not json');

      const result = findLatestBackupSync(filePath);

      expect(result).toBe(backup1);
    });
  });

  describe('attemptRecovery', () => {
    it('should recover from backup successfully', async () => {
      const filePath = path.join(testDir, 'config.json');
      const backupPath = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');

      await fs.writeFile(filePath, 'corrupt data');
      await fs.writeFile(backupPath, JSON.stringify({ recovered: true }));

      const result = await attemptRecovery(filePath);

      expect(result.success).toBe(true);
      expect(result.method).toBe('backup');
      expect(result.backupPath).toBe(backupPath);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual({ recovered: true });
    });

    it('should backup corrupt file before recovery', async () => {
      const filePath = path.join(testDir, 'config.json');
      const backupPath = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');

      const corruptData = 'corrupt data';
      await fs.writeFile(filePath, corruptData);
      await fs.writeFile(backupPath, JSON.stringify({ recovered: true }));

      await attemptRecovery(filePath, { backupCorruptFile: true });

      // Check that corrupt file was backed up
      const files = await fs.readdir(testDir);
      const corruptBackup = files.find((f) => f.startsWith('config.json.corrupt.'));
      expect(corruptBackup).toBeDefined();
    });

    it('should skip corrupt file backup if disabled', async () => {
      const filePath = path.join(testDir, 'config.json');
      const backupPath = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');

      await fs.writeFile(filePath, 'corrupt data');
      await fs.writeFile(backupPath, JSON.stringify({ recovered: true }));

      await attemptRecovery(filePath, { backupCorruptFile: false });

      const files = await fs.readdir(testDir);
      const corruptBackup = files.find((f) => f.startsWith('config.json.corrupt.'));
      expect(corruptBackup).toBeUndefined();
    });

    it('should fail if no valid backups exist', async () => {
      const filePath = path.join(testDir, 'config.json');
      await fs.writeFile(filePath, 'corrupt data');

      const result = await attemptRecovery(filePath);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No valid recovery method found');
    });

    it('should use validator to verify recovered file', async () => {
      const filePath = path.join(testDir, 'config.json');
      const backup1 = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');
      const backup2 = path.join(testDir, 'config.2024-01-02T10-00-00-000.json');

      await fs.writeFile(filePath, 'corrupt');
      await fs.writeFile(backup1, JSON.stringify({ valid: true }));
      await fs.writeFile(backup2, JSON.stringify({ valid: false }));

      const validator = async (content: string) => {
        const data = JSON.parse(content);
        return data.valid === true;
      };

      const result = await attemptRecovery(filePath, { validator });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBe(backup1);
    });

    it('should include timestamp in result', async () => {
      const filePath = path.join(testDir, 'config.json');
      await fs.writeFile(filePath, 'corrupt');

      const before = new Date();
      const result = await attemptRecovery(filePath);
      const after = new Date();

      expect(result.attemptedAt).toBeInstanceOf(Date);
      expect(result.attemptedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.attemptedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('attemptRecoverySync', () => {
    it('should recover from backup successfully', () => {
      const filePath = path.join(testDir, 'config.json');
      const backupPath = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');

      fsSync.writeFileSync(filePath, 'corrupt');
      fsSync.writeFileSync(backupPath, JSON.stringify({ recovered: true }));

      const result = attemptRecoverySync(filePath);

      expect(result.success).toBe(true);
      expect(result.method).toBe('backup');

      const content = fsSync.readFileSync(filePath, 'utf-8');
      expect(JSON.parse(content)).toEqual({ recovered: true });
    });

    it('should fail if no valid backups exist', () => {
      const filePath = path.join(testDir, 'config.json');
      fsSync.writeFileSync(filePath, 'corrupt');

      const result = attemptRecoverySync(filePath);

      expect(result.success).toBe(false);
    });
  });

  describe('safeLoad', () => {
    it('should load valid file normally', async () => {
      const filePath = path.join(testDir, 'config.json');
      const data = { key: 'value' };
      await fs.writeFile(filePath, JSON.stringify(data));

      const content = await safeLoad(filePath);

      expect(JSON.parse(content)).toEqual(data);
    });

    it('should recover and load corrupt file', async () => {
      const filePath = path.join(testDir, 'config.json');
      const backupPath = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');

      await fs.writeFile(filePath, 'corrupt');
      await fs.writeFile(backupPath, JSON.stringify({ recovered: true }));

      const content = await safeLoad(filePath);

      expect(JSON.parse(content)).toEqual({ recovered: true });
    });

    it('should throw CorruptionError if recovery fails', async () => {
      const filePath = path.join(testDir, 'config.json');
      await fs.writeFile(filePath, 'corrupt');

      await expect(safeLoad(filePath)).rejects.toThrow(CorruptionError);
    });

    it('should throw CorruptionError with corruption and recovery info', async () => {
      const filePath = path.join(testDir, 'config.json');
      await fs.writeFile(filePath, 'corrupt');

      try {
        await safeLoad(filePath);
        fail('Should have thrown CorruptionError');
      } catch (err) {
        expect(err).toBeInstanceOf(CorruptionError);
        const corruptionErr = err as CorruptionError;
        expect(corruptionErr.corruptionInfo).toBeDefined();
        expect(corruptionErr.corruptionInfo.corruptionType).toBe('parse_error');
        expect(corruptionErr.recoveryResult).toBeDefined();
        expect(corruptionErr.recoveryResult?.success).toBe(false);
      }
    });

    it('should use validator when provided', async () => {
      const filePath = path.join(testDir, 'config.json');
      const data = { invalid: 'schema' };
      await fs.writeFile(filePath, JSON.stringify(data));

      const validator = async (content: string) => {
        const parsed = JSON.parse(content);
        return parsed.required !== undefined;
      };

      await expect(safeLoad(filePath, { validator })).rejects.toThrow(CorruptionError);
    });
  });

  describe('safeLoadSync', () => {
    it('should load valid file normally', () => {
      const filePath = path.join(testDir, 'config.json');
      const data = { key: 'value' };
      fsSync.writeFileSync(filePath, JSON.stringify(data));

      const content = safeLoadSync(filePath);

      expect(JSON.parse(content)).toEqual(data);
    });

    it('should recover and load corrupt file', () => {
      const filePath = path.join(testDir, 'config.json');
      const backupPath = path.join(testDir, 'config.2024-01-01T10-00-00-000.json');

      fsSync.writeFileSync(filePath, 'corrupt');
      fsSync.writeFileSync(backupPath, JSON.stringify({ recovered: true }));

      const content = safeLoadSync(filePath);

      expect(JSON.parse(content)).toEqual({ recovered: true });
    });

    it('should throw CorruptionError if recovery fails', () => {
      const filePath = path.join(testDir, 'config.json');
      fsSync.writeFileSync(filePath, 'corrupt');

      expect(() => safeLoadSync(filePath)).toThrow(CorruptionError);
    });
  });

  describe('CorruptionError', () => {
    it('should include corruption info', () => {
      const corruptionInfo: CorruptionInfo = {
        filePath: '/test/path',
        corruptionType: 'parse_error',
        originalError: new Error('Test error'),
        detectedAt: new Date(),
      };

      const error = new CorruptionError('Test message', corruptionInfo);

      expect(error.corruptionInfo).toBe(corruptionInfo);
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('CorruptionError');
    });

    it('should include recovery result when provided', () => {
      const corruptionInfo: CorruptionInfo = {
        filePath: '/test/path',
        corruptionType: 'parse_error',
        originalError: new Error('Test error'),
        detectedAt: new Date(),
      };

      const recoveryResult: RecoveryResult = {
        success: false,
        error: 'No backups found',
        attemptedAt: new Date(),
      };

      const error = new CorruptionError('Test message', corruptionInfo, recoveryResult);

      expect(error.recoveryResult).toBe(recoveryResult);
    });
  });

  describe('edge cases', () => {
    it('should handle files with special characters in name', async () => {
      const filePath = path.join(testDir, 'config-test_v1.0.json');
      // Use the correct backup format: basename.timestamp.ext
      const backupPath = path.join(testDir, 'config-test_v1.0.2024-01-01T10-00-00-000.json');

      await fs.writeFile(filePath, 'corrupt');
      await fs.writeFile(backupPath, JSON.stringify({ data: 'test' }));

      const result = await attemptRecovery(filePath);

      expect(result.success).toBe(true);
    });

    it('should handle very long file names', async () => {
      const longName = 'a'.repeat(100);
      const filePath = path.join(testDir, longName + '.json');
      // Use the correct backup format: basename.timestamp.ext
      const backupPath = path.join(testDir, `${longName}.2024-01-01T10-00-00-000.json`);

      await fs.writeFile(filePath, 'corrupt');
      await fs.writeFile(backupPath, JSON.stringify({ data: 'test' }));

      const result = await attemptRecovery(filePath);

      expect(result.success).toBe(true);
    });

    it('should handle empty files', async () => {
      const filePath = path.join(testDir, 'empty.json');
      await fs.writeFile(filePath, '');

      const result = await detectCorruption(filePath);

      expect(result).not.toBeNull();
      expect(result?.corruptionType).toBe('parse_error');
    });

    it('should handle files with only whitespace', async () => {
      const filePath = path.join(testDir, 'whitespace.json');
      await fs.writeFile(filePath, '   \n\t  ');

      const result = await detectCorruption(filePath);

      expect(result).not.toBeNull();
      expect(result?.corruptionType).toBe('parse_error');
    });
  });
});
