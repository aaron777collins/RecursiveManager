import { SecretAuditLogger } from '../audit-logger';

describe('SecretAuditLogger', () => {
  let logger: SecretAuditLogger;

  beforeEach(() => {
    logger = new SecretAuditLogger();
  });

  describe('logging actions', () => {
    it('should log secret stored', () => {
      logger.logSecretStored('test-key');
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('SECRET_STORED');
      expect(entries[0]!.secretName).toBe('test-key');
      expect(entries[0]!.success).toBe(true);
    });

    it('should log secret accessed (success)', () => {
      logger.logSecretAccessed('test-key', true);
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('SECRET_ACCESSED');
      expect(entries[0]!.secretName).toBe('test-key');
      expect(entries[0]!.success).toBe(true);
    });

    it('should log secret accessed (failure)', () => {
      logger.logSecretAccessed('non-existent', false);
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.success).toBe(false);
    });

    it('should log secret deleted', () => {
      logger.logSecretDeleted('test-key');
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('SECRET_DELETED');
      expect(entries[0]!.secretName).toBe('test-key');
    });

    it('should log secret rotated', () => {
      logger.logSecretRotated('test-key');
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('SECRET_ROTATED');
      expect(entries[0]!.secretName).toBe('test-key');
    });

    it('should log secret expired', () => {
      logger.logSecretExpired('test-key');
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('SECRET_EXPIRED');
      expect(entries[0]!.success).toBe(false);
      expect(entries[0]!.metadata?.reason).toBe('expired');
    });

    it('should log cache cleared', () => {
      logger.logCacheCleared();
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('CACHE_CLEARED');
      expect(entries[0]!.success).toBe(true);
    });

    it('should log secrets exported', () => {
      logger.logSecretsExported(5);
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('SECRETS_EXPORTED');
      expect(entries[0]!.metadata?.count).toBe(5);
    });

    it('should log secrets imported', () => {
      logger.logSecretsImported(3);
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('SECRETS_IMPORTED');
      expect(entries[0]!.metadata?.count).toBe(3);
    });

    it('should log unauthorized access', () => {
      logger.logUnauthorizedAccess('secret-key', 'insufficient permissions');
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('UNAUTHORIZED_ACCESS');
      expect(entries[0]!.success).toBe(false);
      expect(entries[0]!.metadata?.reason).toBe('insufficient permissions');
    });

    it('should log encryption failure', () => {
      logger.logEncryptionFailure('test-key', 'encryption error');
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('ENCRYPTION_FAILURE');
      expect(entries[0]!.success).toBe(false);
      expect(entries[0]!.metadata?.error).toBe('encryption error');
    });

    it('should log decryption failure', () => {
      logger.logDecryptionFailure('test-key', 'invalid key');
      const entries = logger.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('DECRYPTION_FAILURE');
      expect(entries[0]!.success).toBe(false);
      expect(entries[0]!.metadata?.error).toBe('invalid key');
    });
  });

  describe('getEntries', () => {
    beforeEach(() => {
      logger.logSecretStored('key1');
      logger.logSecretStored('key2');
      logger.logSecretAccessed('key1', true);
      logger.logSecretDeleted('key2');
    });

    it('should return all entries without filter', () => {
      const entries = logger.getEntries();
      expect(entries).toHaveLength(4);
    });

    it('should filter by action', () => {
      const entries = logger.getEntries({ action: 'SECRET_STORED' });
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.action === 'SECRET_STORED')).toBe(true);
    });

    it('should filter by secret name', () => {
      const entries = logger.getEntries({ secretName: 'key1' });
      expect(entries).toHaveLength(2);
      expect(entries.every(e => e.secretName === 'key1')).toBe(true);
    });

    it('should filter by timestamp', () => {
      const now = new Date();
      const entries = logger.getEntries({ since: now });
      expect(entries.length).toBeLessThanOrEqual(4);
    });

    it('should combine multiple filters', () => {
      const entries = logger.getEntries({
        action: 'SECRET_STORED',
        secretName: 'key1',
      });
      expect(entries).toHaveLength(1);
      expect(entries[0]!.action).toBe('SECRET_STORED');
      expect(entries[0]!.secretName).toBe('key1');
    });

    it('should return a copy of entries', () => {
      const entries1 = logger.getEntries();
      const entries2 = logger.getEntries();

      expect(entries1).not.toBe(entries2);
      expect(entries1).toEqual(entries2);
    });
  });

  describe('getFailedAttempts', () => {
    beforeEach(() => {
      logger.logSecretAccessed('key1', true);
      logger.logSecretAccessed('key2', false);
      logger.logSecretAccessed('key3', false);
      logger.logSecretExpired('key4');
    });

    it('should return all failed attempts', () => {
      const failed = logger.getFailedAttempts();
      expect(failed).toHaveLength(3);
      expect(failed.every(e => !e.success)).toBe(true);
    });

    it('should filter failed attempts by secret name', () => {
      const failed = logger.getFailedAttempts('key2');
      expect(failed).toHaveLength(1);
      expect(failed[0]!.secretName).toBe('key2');
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      logger.logSecretStored('key1');
      logger.logSecretStored('key2');

      expect(logger.getEntries()).toHaveLength(2);

      logger.clear();

      expect(logger.getEntries()).toHaveLength(0);
    });
  });

  describe('exportLog', () => {
    it('should export log as JSON string', () => {
      logger.logSecretStored('test-key');
      logger.logSecretAccessed('test-key', true);

      const exported = logger.exportLog();
      expect(typeof exported).toBe('string');

      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it('should format timestamps as ISO strings', () => {
      logger.logSecretStored('test-key');

      const exported = logger.exportLog();
      const parsed = JSON.parse(exported);

      expect(typeof parsed[0].timestamp).toBe('string');
      expect(() => new Date(parsed[0].timestamp)).not.toThrow();
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      logger.logSecretStored('key1');
      logger.logSecretAccessed('key1', true);
      logger.logSecretAccessed('key2', false);
      logger.logSecretRotated('key1');
      logger.logSecretDeleted('key2');
    });

    it('should return correct statistics', () => {
      const stats = logger.getStatistics();

      expect(stats.totalEntries).toBe(5);
      expect(stats.successfulAccesses).toBe(1);
      expect(stats.failedAccesses).toBe(1);
      expect(stats.rotations).toBe(1);
      expect(stats.deletions).toBe(1);
    });

    it('should return zeros for empty log', () => {
      const emptyLogger = new SecretAuditLogger();
      const stats = emptyLogger.getStatistics();

      expect(stats.totalEntries).toBe(0);
      expect(stats.successfulAccesses).toBe(0);
      expect(stats.failedAccesses).toBe(0);
      expect(stats.rotations).toBe(0);
      expect(stats.deletions).toBe(0);
    });
  });

  describe('maxEntries limit', () => {
    it('should respect maxEntries limit', () => {
      const limitedLogger = new SecretAuditLogger({ maxEntries: 100 });

      for (let i = 0; i < 150; i++) {
        limitedLogger.logSecretStored(`key${i}`);
      }

      const entries = limitedLogger.getEntries();
      expect(entries).toHaveLength(100);
    });

    it('should keep most recent entries when limit exceeded', () => {
      const limitedLogger = new SecretAuditLogger({ maxEntries: 10 });

      for (let i = 0; i < 20; i++) {
        limitedLogger.logSecretStored(`key${i}`);
      }

      const entries = limitedLogger.getEntries();
      expect(entries).toHaveLength(10);
      expect(entries[0]!.secretName).toBe('key10'); // First of last 10
      expect(entries[9]!.secretName).toBe('key19'); // Last of last 10
    });

    it('should use default maxEntries of 10000', () => {
      const defaultLogger = new SecretAuditLogger();

      for (let i = 0; i < 100; i++) {
        defaultLogger.logSecretStored(`key${i}`);
      }

      const entries = defaultLogger.getEntries();
      expect(entries).toHaveLength(100);
    });
  });

  describe('timestamp tracking', () => {
    it('should set timestamp for each entry', () => {
      logger.logSecretStored('test-key');
      const entries = logger.getEntries();

      expect(entries[0]!.timestamp).toBeInstanceOf(Date);
    });

    it('should have chronological timestamps', async () => {
      logger.logSecretStored('key1');
      await new Promise(resolve => setTimeout(resolve, 10));
      logger.logSecretStored('key2');

      const entries = logger.getEntries();
      expect(entries[1]!.timestamp.getTime()).toBeGreaterThanOrEqual(entries[0]!.timestamp.getTime());
    });
  });
});
