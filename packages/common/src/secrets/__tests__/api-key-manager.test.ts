import { APIKeyManager } from '../api-key-manager';
import { SecretAuditLogger } from '../audit-logger';
import { DatabaseEncryption } from '../../db/encryption';

describe('APIKeyManager', () => {
  let manager: APIKeyManager;
  const testKey = DatabaseEncryption.generateKey();

  beforeEach(() => {
    manager = new APIKeyManager(testKey);
  });

  describe('storeSecret', () => {
    it('should store a secret with encryption', async () => {
      await manager.storeSecret('test-key', 'secret-value');
      const value = await manager.getSecret('test-key');
      expect(value).toBe('secret-value');
    });

    it('should reject empty secret name', async () => {
      await expect(manager.storeSecret('', 'value')).rejects.toThrow('Secret name and value are required');
    });

    it('should reject empty secret value', async () => {
      await expect(manager.storeSecret('name', '')).rejects.toThrow('Secret name and value are required');
    });

    it('should store metadata with secret', async () => {
      await manager.storeSecret('test-key', 'value', {
        rotationPolicy: 'auto',
        rotationIntervalDays: 30,
      });

      const metadata = manager.getMetadata('test-key');
      expect(metadata).toBeTruthy();
      expect(metadata?.rotationPolicy).toBe('auto');
      expect(metadata?.rotationIntervalDays).toBe(30);
    });

    it('should overwrite existing secret', async () => {
      await manager.storeSecret('test-key', 'value1');
      await manager.storeSecret('test-key', 'value2');

      const value = await manager.getSecret('test-key');
      expect(value).toBe('value2');
    });
  });

  describe('getSecret', () => {
    it('should retrieve stored secret', async () => {
      await manager.storeSecret('api-key', 'sk-123456');
      const value = await manager.getSecret('api-key');
      expect(value).toBe('sk-123456');
    });

    it('should return null for non-existent secret', async () => {
      const value = await manager.getSecret('non-existent');
      expect(value).toBeNull();
    });

    it('should use cache for repeated access', async () => {
      await manager.storeSecret('cached-key', 'cached-value');

      const value1 = await manager.getSecret('cached-key');
      const value2 = await manager.getSecret('cached-key');

      expect(value1).toBe('cached-value');
      expect(value2).toBe('cached-value');
    });

    it('should return null for expired secret', async () => {
      const pastDate = new Date(Date.now() - 1000);
      await manager.storeSecret('expired-key', 'value', {
        expiresAt: pastDate,
      });

      const value = await manager.getSecret('expired-key');
      expect(value).toBeNull();
    });

    it('should update lastAccessed timestamp', async () => {
      await manager.storeSecret('test-key', 'value');

      const metadataBefore = manager.getMetadata('test-key');
      expect(metadataBefore?.lastAccessed).toBeUndefined();

      await manager.getSecret('test-key');

      const metadataAfter = manager.getMetadata('test-key');
      expect(metadataAfter?.lastAccessed).toBeTruthy();
    });
  });

  describe('deleteSecret', () => {
    it('should delete existing secret', async () => {
      await manager.storeSecret('to-delete', 'value');
      const deleted = await manager.deleteSecret('to-delete');

      expect(deleted).toBe(true);
      const value = await manager.getSecret('to-delete');
      expect(value).toBeNull();
    });

    it('should return false for non-existent secret', async () => {
      const deleted = await manager.deleteSecret('non-existent');
      expect(deleted).toBe(false);
    });

    it('should clear cache when deleting', async () => {
      await manager.storeSecret('cached', 'value');
      await manager.getSecret('cached'); // Cache it
      await manager.deleteSecret('cached');

      const value = await manager.getSecret('cached');
      expect(value).toBeNull();
    });
  });

  describe('rotateSecret', () => {
    it('should rotate existing secret', async () => {
      await manager.storeSecret('rotate-key', 'old-value');
      await manager.rotateSecret('rotate-key', 'new-value');

      const value = await manager.getSecret('rotate-key');
      expect(value).toBe('new-value');
    });

    it('should throw error for non-existent secret', async () => {
      await expect(manager.rotateSecret('non-existent', 'value')).rejects.toThrow("Secret 'non-existent' not found");
    });

    it('should preserve metadata during rotation', async () => {
      await manager.storeSecret('rotate-key', 'value', {
        rotationPolicy: 'auto',
        rotationIntervalDays: 30,
      });

      await manager.rotateSecret('rotate-key', 'new-value');

      const metadata = manager.getMetadata('rotate-key');
      expect(metadata?.rotationPolicy).toBe('auto');
      expect(metadata?.rotationIntervalDays).toBe(30);
    });
  });

  describe('listSecrets', () => {
    it('should list all secret names', async () => {
      await manager.storeSecret('key1', 'value1');
      await manager.storeSecret('key2', 'value2');
      await manager.storeSecret('key3', 'value3');

      const names = manager.listSecrets();
      expect(names).toHaveLength(3);
      expect(names).toContain('key1');
      expect(names).toContain('key2');
      expect(names).toContain('key3');
    });

    it('should return empty array when no secrets', () => {
      const names = manager.listSecrets();
      expect(names).toEqual([]);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for existing secret', async () => {
      await manager.storeSecret('meta-key', 'value', {
        rotationPolicy: 'manual',
      });

      const metadata = manager.getMetadata('meta-key');
      expect(metadata).toBeTruthy();
      expect(metadata?.name).toBe('meta-key');
      expect(metadata?.rotationPolicy).toBe('manual');
      expect(metadata?.createdAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent secret', () => {
      const metadata = manager.getMetadata('non-existent');
      expect(metadata).toBeNull();
    });
  });

  describe('isExpired', () => {
    it('should return true for expired secret', async () => {
      const pastDate = new Date(Date.now() - 1000);
      await manager.storeSecret('expired', 'value', { expiresAt: pastDate });

      expect(manager.isExpired('expired')).toBe(true);
    });

    it('should return false for non-expired secret', async () => {
      const futureDate = new Date(Date.now() + 10000);
      await manager.storeSecret('valid', 'value', { expiresAt: futureDate });

      expect(manager.isExpired('valid')).toBe(false);
    });

    it('should return false for secret without expiration', async () => {
      await manager.storeSecret('no-expiry', 'value');
      expect(manager.isExpired('no-expiry')).toBe(false);
    });
  });

  describe('needsRotation', () => {
    it('should return true when rotation interval exceeded', async () => {
      await manager.storeSecret('old-key', 'value', {
        rotationPolicy: 'auto',
        rotationIntervalDays: 0, // Immediate rotation needed
      });

      expect(manager.needsRotation('old-key')).toBe(true);
    });

    it('should return false when rotation not needed', async () => {
      await manager.storeSecret('new-key', 'value', {
        rotationPolicy: 'auto',
        rotationIntervalDays: 365,
      });

      expect(manager.needsRotation('new-key')).toBe(false);
    });

    it('should return false for manual rotation policy', async () => {
      await manager.storeSecret('manual-key', 'value', {
        rotationPolicy: 'manual',
        rotationIntervalDays: 0,
      });

      expect(manager.needsRotation('manual-key')).toBe(false);
    });

    it('should return false for none rotation policy', async () => {
      await manager.storeSecret('none-key', 'value', {
        rotationPolicy: 'none',
      });

      expect(manager.needsRotation('none-key')).toBe(false);
    });
  });

  describe('getSecretsNeedingRotation', () => {
    it('should return secrets needing rotation', async () => {
      await manager.storeSecret('rotate1', 'value', {
        rotationPolicy: 'auto',
        rotationIntervalDays: 0,
      });
      await manager.storeSecret('rotate2', 'value', {
        rotationPolicy: 'auto',
        rotationIntervalDays: 0,
      });
      await manager.storeSecret('no-rotate', 'value', {
        rotationPolicy: 'manual',
      });

      const needsRotation = manager.getSecretsNeedingRotation();
      expect(needsRotation).toHaveLength(2);
      expect(needsRotation).toContain('rotate1');
      expect(needsRotation).toContain('rotate2');
    });
  });

  describe('cache management', () => {
    it('should clear cache for specific secret', async () => {
      const managerWithShortCache = new APIKeyManager(testKey, { cacheExpiryMs: 100 });

      await managerWithShortCache.storeSecret('test', 'value');
      await managerWithShortCache.getSecret('test'); // Cache it

      await new Promise(resolve => setTimeout(resolve, 150)); // Wait for cache to expire

      const value = await managerWithShortCache.getSecret('test');
      expect(value).toBe('value'); // Should re-decrypt
    });

    it('should clear all cache', async () => {
      await manager.storeSecret('key1', 'value1');
      await manager.storeSecret('key2', 'value2');

      await manager.getSecret('key1'); // Cache both
      await manager.getSecret('key2');

      manager.clearAllCache();

      // Both should still be accessible (just re-decrypted)
      expect(await manager.getSecret('key1')).toBe('value1');
      expect(await manager.getSecret('key2')).toBe('value2');
    });
  });

  describe('export and import', () => {
    it('should export encrypted secrets', async () => {
      await manager.storeSecret('key1', 'value1');
      await manager.storeSecret('key2', 'value2');

      const exported = manager.exportSecrets();
      expect(exported).toBeTruthy();

      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
    });

    it('should import encrypted secrets', async () => {
      await manager.storeSecret('key1', 'value1');
      const exported = manager.exportSecrets();

      const newManager = new APIKeyManager(testKey);
      newManager.importSecrets(exported);

      const value = await newManager.getSecret('key1');
      expect(value).toBe('value1');
    });

    it('should reject invalid import data', () => {
      expect(() => manager.importSecrets('invalid json')).toThrow();
      expect(() => manager.importSecrets('{}')).toThrow('Invalid import data: expected array');
    });

    it('should skip invalid entries during import', () => {
      const invalidData = JSON.stringify([
        { name: 'valid', encrypted: 'data', metadata: { createdAt: new Date().toISOString(), name: 'valid' } },
        { invalid: 'entry' },
      ]);

      expect(() => manager.importSecrets(invalidData)).not.toThrow();
      expect(manager.listSecrets()).toHaveLength(1);
    });
  });

  describe('audit logging', () => {
    it('should log secret storage', async () => {
      const auditLogger = new SecretAuditLogger();
      const managerWithAudit = new APIKeyManager(testKey, { auditLogger });

      await managerWithAudit.storeSecret('test', 'value');

      const entries = auditLogger.getEntries();
      expect(entries.some(e => e.action === 'SECRET_STORED' && e.secretName === 'test')).toBe(true);
    });

    it('should log secret access', async () => {
      const auditLogger = new SecretAuditLogger();
      const managerWithAudit = new APIKeyManager(testKey, { auditLogger });

      await managerWithAudit.storeSecret('test', 'value');
      await managerWithAudit.getSecret('test');

      const entries = auditLogger.getEntries();
      expect(entries.some(e => e.action === 'SECRET_ACCESSED' && e.secretName === 'test' && e.success)).toBe(true);
    });

    it('should log failed access attempts', async () => {
      const auditLogger = new SecretAuditLogger();
      const managerWithAudit = new APIKeyManager(testKey, { auditLogger });

      await managerWithAudit.getSecret('non-existent');

      const entries = auditLogger.getEntries();
      expect(entries.some(e => e.action === 'SECRET_ACCESSED' && e.secretName === 'non-existent' && !e.success)).toBe(true);
    });

    it('should log secret rotation', async () => {
      const auditLogger = new SecretAuditLogger();
      const managerWithAudit = new APIKeyManager(testKey, { auditLogger });

      await managerWithAudit.storeSecret('test', 'value');
      await managerWithAudit.rotateSecret('test', 'new-value');

      const entries = auditLogger.getEntries();
      expect(entries.some(e => e.action === 'SECRET_ROTATED' && e.secretName === 'test')).toBe(true);
    });

    it('should log secret deletion', async () => {
      const auditLogger = new SecretAuditLogger();
      const managerWithAudit = new APIKeyManager(testKey, { auditLogger });

      await managerWithAudit.storeSecret('test', 'value');
      await managerWithAudit.deleteSecret('test');

      const entries = auditLogger.getEntries();
      expect(entries.some(e => e.action === 'SECRET_DELETED' && e.secretName === 'test')).toBe(true);
    });
  });

  describe('encryption integration', () => {
    it('should use different encryption instances with same key', async () => {
      const manager1 = new APIKeyManager(testKey);
      const manager2 = new APIKeyManager(testKey);

      await manager1.storeSecret('shared', 'value');
      const exported = manager1.exportSecrets();

      manager2.importSecrets(exported);
      const value = await manager2.getSecret('shared');

      expect(value).toBe('value');
    });

    it('should fail to decrypt with different key', async () => {
      const key1 = DatabaseEncryption.generateKey();
      const key2 = DatabaseEncryption.generateKey();

      const manager1 = new APIKeyManager(key1);
      await manager1.storeSecret('test', 'value');
      const exported = manager1.exportSecrets();

      const manager2 = new APIKeyManager(key2);
      manager2.importSecrets(exported);

      await expect(manager2.getSecret('test')).rejects.toThrow();
    });

    it('should support KDF mode', async () => {
      const password = 'my-secure-password';
      const managerKDF = new APIKeyManager(password, { useKDF: true });

      await managerKDF.storeSecret('test', 'value');
      const value = await managerKDF.getSecret('test');

      expect(value).toBe('value');
    });
  });

  describe('getAuditLog', () => {
    it('should return audit log entries', async () => {
      await manager.storeSecret('test', 'value');
      await manager.getSecret('test');

      const auditLog = manager.getAuditLog();
      expect(Array.isArray(auditLog)).toBe(true);
      expect(auditLog.length).toBeGreaterThan(0);
    });
  });
});
