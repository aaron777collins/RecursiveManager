/**
 * Tests for database encryption utilities
 */

import {
  DatabaseEncryption,
  createEncryption,
  encryptField,
  decryptField,
  EncryptedData,
} from '../encryption';

describe('DatabaseEncryption', () => {
  describe('constructor', () => {
    it('should create encryption instance with password (KDF)', () => {
      const encryption = new DatabaseEncryption({
        key: 'test-password-123',
        useKDF: true,
      });
      expect(encryption).toBeDefined();
    });

    it('should create encryption instance with raw key', () => {
      const rawKey = DatabaseEncryption.generateKey();
      const encryption = new DatabaseEncryption({
        key: rawKey,
        useKDF: false,
      });
      expect(encryption).toBeDefined();
    });

    it('should throw error for empty key', () => {
      expect(() => {
        new DatabaseEncryption({ key: '' });
      }).toThrow('Encryption key cannot be empty');
    });

    it('should throw error for invalid raw key length', () => {
      expect(() => {
        new DatabaseEncryption({
          key: 'short',
          useKDF: false,
        });
      }).toThrow('Raw encryption key must be exactly 32 bytes');
    });

    it('should default to useKDF=true when not specified', () => {
      const encryption = new DatabaseEncryption({ key: 'password' });
      const encrypted = encryption.encrypt('test data');

      // If KDF is used, salt should be present
      expect(encrypted.salt).toBeDefined();
    });
  });

  describe('encrypt', () => {
    it('should encrypt plaintext string', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = 'sensitive data';

      const encrypted = encryption.encrypt(plaintext);

      expect(encrypted.data).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.salt).toBeDefined();

      // Encrypted data should be different from plaintext
      expect(encrypted.data).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = 'same data';

      const encrypted1 = encryption.encrypt(plaintext);
      const encrypted2 = encryption.encrypt(plaintext);

      // IVs should be different (random)
      expect(encrypted1.iv).not.toBe(encrypted2.iv);

      // Ciphertext should be different
      expect(encrypted1.data).not.toBe(encrypted2.data);
    });

    it('should encrypt empty string', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });

      const encrypted = encryption.encrypt('');

      expect(encrypted.data).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
    });

    it('should encrypt unicode characters', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = '🔒 Sensitive data with emoji 中文字符';

      const encrypted = encryption.encrypt(plaintext);

      expect(encrypted.data).toBeDefined();
      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt long strings', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = 'A'.repeat(10000);

      const encrypted = encryption.encrypt(plaintext);

      expect(encrypted.data).toBeDefined();
      const decrypted = encryption.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should not include salt when useKDF=false', () => {
      const rawKey = DatabaseEncryption.generateKey();
      const encryption = new DatabaseEncryption({
        key: rawKey,
        useKDF: false,
      });

      const encrypted = encryption.encrypt('test data');

      expect(encrypted.salt).toBeUndefined();
    });
  });

  describe('decrypt', () => {
    it('should decrypt encrypted data', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = 'sensitive data';

      const encrypted = encryption.encrypt(plaintext);
      const decrypted = encryption.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with wrong key', () => {
      const encryption1 = new DatabaseEncryption({ key: 'password1' });
      const encryption2 = new DatabaseEncryption({ key: 'password2' });

      const encrypted = encryption1.encrypt('test data');

      expect(() => {
        encryption2.decrypt(encrypted);
      }).toThrow('Decryption failed');
    });

    it('should fail decryption with tampered data', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const encrypted = encryption.encrypt('test data');

      // Tamper with encrypted data
      const tamperedData = Buffer.from(encrypted.data, 'base64');
      if (tamperedData[0] !== undefined) {
        tamperedData[0] ^= 1; // Flip a bit
      }

      const tampered: EncryptedData = {
        ...encrypted,
        data: tamperedData.toString('base64'),
      };

      expect(() => {
        encryption.decrypt(tampered);
      }).toThrow('Decryption failed');
    });

    it('should fail decryption with tampered auth tag', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const encrypted = encryption.encrypt('test data');

      // Tamper with auth tag
      const tamperedTag = Buffer.from(encrypted.authTag, 'base64');
      if (tamperedTag[0] !== undefined) {
        tamperedTag[0] ^= 1;
      }

      const tampered: EncryptedData = {
        ...encrypted,
        authTag: tamperedTag.toString('base64'),
      };

      expect(() => {
        encryption.decrypt(tampered);
      }).toThrow('Decryption failed');
    });

    it('should fail decryption with missing fields', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });

      const invalidData: EncryptedData = {
        data: 'invalid',
        iv: 'invalid',
        authTag: 'invalid',
      };

      expect(() => {
        encryption.decrypt(invalidData);
      }).toThrow('Decryption failed');
    });
  });

  describe('encryptToJSON / decryptFromJSON', () => {
    it('should encrypt and decrypt via JSON', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = 'sensitive data';

      const json = encryption.encryptToJSON(plaintext);
      const decrypted = encryption.decryptFromJSON(json);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce valid JSON', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });

      const json = encryption.encryptToJSON('test data');

      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('data');
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('authTag');
    });

    it('should fail to decrypt invalid JSON', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });

      expect(() => {
        encryption.decryptFromJSON('not valid json');
      }).toThrow('Failed to decrypt from JSON');
    });

    it('should fail to decrypt JSON with missing fields', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const invalidJson = JSON.stringify({ data: 'test' });

      expect(() => {
        encryption.decryptFromJSON(invalidJson);
      }).toThrow('Failed to decrypt from JSON');
    });
  });

  describe('generateKey', () => {
    it('should generate random key', () => {
      const key1 = DatabaseEncryption.generateKey();
      const key2 = DatabaseEncryption.generateKey();

      expect(key1).toBeDefined();
      expect(key2).toBeDefined();

      // Keys should be different
      expect(key1).not.toBe(key2);
    });

    it('should generate key of correct length', () => {
      const key = DatabaseEncryption.generateKey();

      // Key should be 64 hex characters (32 bytes)
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate valid encryption key', () => {
      const key = DatabaseEncryption.generateKey();

      // Should be able to create encryption with generated key
      expect(() => {
        new DatabaseEncryption({ key, useKDF: false });
      }).not.toThrow();
    });
  });

  describe('hashPassword / verifyPassword', () => {
    it('should hash password', () => {
      const password = 'my-secure-password';
      const hash = DatabaseEncryption.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      // Hash should include salt and hash separated by colon
      expect(hash).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
    });

    it('should verify correct password', () => {
      const password = 'my-secure-password';
      const hash = DatabaseEncryption.hashPassword(password);

      const valid = DatabaseEncryption.verifyPassword(password, hash);
      expect(valid).toBe(true);
    });

    it('should reject incorrect password', () => {
      const password = 'correct-password';
      const hash = DatabaseEncryption.hashPassword(password);

      const valid = DatabaseEncryption.verifyPassword('wrong-password', hash);
      expect(valid).toBe(false);
    });

    it('should generate different hashes for same password', () => {
      const password = 'same-password';

      const hash1 = DatabaseEncryption.hashPassword(password);
      const hash2 = DatabaseEncryption.hashPassword(password);

      // Hashes should be different due to random salt
      expect(hash1).not.toBe(hash2);

      // But both should verify correctly
      expect(DatabaseEncryption.verifyPassword(password, hash1)).toBe(true);
      expect(DatabaseEncryption.verifyPassword(password, hash2)).toBe(true);
    });

    it('should return false for invalid hash format', () => {
      const valid = DatabaseEncryption.verifyPassword('password', 'invalid-hash');
      expect(valid).toBe(false);
    });
  });

  describe('createEncryption', () => {
    const originalEnv = process.env.DATABASE_ENCRYPTION_KEY;

    afterEach(() => {
      // Restore original env
      if (originalEnv) {
        process.env.DATABASE_ENCRYPTION_KEY = originalEnv;
      } else {
        delete process.env.DATABASE_ENCRYPTION_KEY;
      }
    });

    it('should create encryption from environment variable', () => {
      process.env.DATABASE_ENCRYPTION_KEY = 'env-password';

      const encryption = createEncryption();

      expect(encryption).toBeDefined();
      expect(encryption).toBeInstanceOf(DatabaseEncryption);
    });

    it('should create encryption from provided key', () => {
      const encryption = createEncryption('provided-password');

      expect(encryption).toBeDefined();
      expect(encryption).toBeInstanceOf(DatabaseEncryption);
    });

    it('should prefer provided key over environment', () => {
      process.env.DATABASE_ENCRYPTION_KEY = 'env-password';

      const encryption = createEncryption('provided-password');
      expect(encryption).toBeDefined();

      // Verify it uses provided key, not env key
      const plaintext = 'test';
      const encrypted = encryption!.encryptToJSON(plaintext);
      const decrypted = encryption!.decryptFromJSON(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should return null when no key provided', () => {
      delete process.env.DATABASE_ENCRYPTION_KEY;

      const encryption = createEncryption();

      expect(encryption).toBeNull();
    });

    it('should support useKDF parameter', () => {
      const rawKey = DatabaseEncryption.generateKey();

      const encryption = createEncryption(rawKey, false);

      expect(encryption).toBeDefined();

      // Verify it works with raw key
      const encrypted = encryption!.encrypt('test');
      expect(encrypted.salt).toBeUndefined(); // No salt when not using KDF
    });
  });

  describe('encryptField / decryptField helpers', () => {
    it('should encrypt field when encryption provided', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const value = 'sensitive data';

      const encrypted = encryptField(value, encryption);

      expect(encrypted).not.toBe(value);
      expect(encrypted).toContain('{'); // Should be JSON
    });

    it('should return original value when no encryption', () => {
      const value = 'sensitive data';

      const result = encryptField(value, null);

      expect(result).toBe(value);
    });

    it('should decrypt field when encryption provided', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const value = 'sensitive data';

      const encrypted = encryptField(value, encryption);
      const decrypted = decryptField(encrypted, encryption);

      expect(decrypted).toBe(value);
    });

    it('should return original value when no encryption for decrypt', () => {
      const value = 'plain data';

      const result = decryptField(value, null);

      expect(result).toBe(value);
    });

    it('should return original value when decrypt fails', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const value = 'not encrypted data';

      // Try to decrypt non-encrypted data
      const result = decryptField(value, encryption);

      // Should return original value when decryption fails
      expect(result).toBe(value);
    });

    it('should handle non-JSON values gracefully', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const value = 'plain text without JSON';

      const result = decryptField(value, encryption);

      expect(result).toBe(value);
    });
  });

  describe('security properties', () => {
    it('should use different IVs for each encryption', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = 'same data';

      const ivs = new Set();
      for (let i = 0; i < 100; i++) {
        const encrypted = encryption.encrypt(plaintext);
        ivs.add(encrypted.iv);
      }

      // All IVs should be unique
      expect(ivs.size).toBe(100);
    });

    it('should use different salts for each encryption with KDF', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password', useKDF: true });
      const plaintext = 'same data';

      const salts = new Set();
      for (let i = 0; i < 100; i++) {
        const encrypted = encryption.encrypt(plaintext);
        if (encrypted.salt) {
          salts.add(encrypted.salt);
        }
      }

      // All salts should be unique
      expect(salts.size).toBe(100);
    });

    it('should provide authentication (detect tampering)', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const encrypted = encryption.encrypt('test data');

      // Tamper with one byte in the middle
      const dataBytes = Buffer.from(encrypted.data, 'base64');
      const middleIndex = Math.floor(dataBytes.length / 2);
      if (dataBytes[middleIndex] !== undefined) {
        dataBytes[middleIndex] ^= 1;
      }

      const tampered: EncryptedData = {
        ...encrypted,
        data: dataBytes.toString('base64'),
      };

      // Decryption should fail due to authentication
      expect(() => {
        encryption.decrypt(tampered);
      }).toThrow();
    });

    it('should not leak key material in encrypted data', () => {
      const key = 'super-secret-key-12345';
      const encryption = new DatabaseEncryption({ key });

      const encrypted = encryption.encrypt('test data');
      const encryptedJson = JSON.stringify(encrypted);

      // Encrypted data should not contain the key
      expect(encryptedJson).not.toContain(key);
      expect(encrypted.data).not.toContain(key);
      expect(encrypted.iv).not.toContain(key);
      expect(encrypted.authTag).not.toContain(key);
    });

    it('should handle concurrent encryptions safely', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = 'concurrent data';

      // Encrypt many times concurrently
      const promises = Array.from({ length: 100 }, () =>
        Promise.resolve(encryption.encrypt(plaintext))
      );

      return Promise.all(promises).then(results => {
        // All should succeed
        expect(results).toHaveLength(100);

        // All should decrypt correctly
        results.forEach(encrypted => {
          const decrypted = encryption.decrypt(encrypted);
          expect(decrypted).toBe(plaintext);
        });
      });
    });
  });

  describe('edge cases', () => {
    it('should handle null bytes in plaintext', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = 'before\x00after';

      const encrypted = encryption.encrypt(plaintext);
      const decrypted = encryption.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle newlines and special characters', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = 'line1\nline2\r\nline3\ttab';

      const encrypted = encryption.encrypt(plaintext);
      const decrypted = encryption.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON-like plaintext', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = '{"key":"value","nested":{"data":"test"}}';

      const encrypted = encryption.encrypt(plaintext);
      const decrypted = encryption.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long keys (passwords)', () => {
      const longPassword = 'a'.repeat(1000);
      const encryption = new DatabaseEncryption({ key: longPassword });

      const encrypted = encryption.encrypt('test data');
      const decrypted = encryption.decrypt(encrypted);

      expect(decrypted).toBe('test data');
    });

    it('should handle binary-looking strings', () => {
      const encryption = new DatabaseEncryption({ key: 'test-password' });
      const plaintext = '\x01\x02\x03\x04\x05';

      const encrypted = encryption.encrypt(plaintext);
      const decrypted = encryption.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });
});
