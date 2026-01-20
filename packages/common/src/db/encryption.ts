/**
 * Database Encryption Utilities
 *
 * Provides AES-256-GCM encryption for sensitive database fields.
 * Uses application-level encryption (no native SQLCipher dependency).
 *
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - Random IV (initialization vector) for each encryption
 * - PBKDF2 key derivation from password
 * - Base64 encoding for storage
 * - Integrity protection via GCM authentication tag
 */

import crypto from 'crypto';

// Encryption algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const SALT_LENGTH = 32; // 256 bits
const KEY_LENGTH = 32; // 256 bits for AES-256
const PBKDF2_ITERATIONS = 100000; // High iteration count for security

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  /** Encryption key (either raw key or password for derivation) */
  key: string;
  /** Whether to use PBKDF2 key derivation (default: true) */
  useKDF?: boolean;
}

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  /** Base64-encoded encrypted data */
  data: string;
  /** Base64-encoded IV */
  iv: string;
  /** Base64-encoded authentication tag */
  authTag: string;
  /** Base64-encoded salt (only present if KDF used) */
  salt?: string;
}

/**
 * Database encryption manager
 */
export class DatabaseEncryption {
  private config: EncryptionConfig;

  constructor(config: EncryptionConfig) {
    this.config = {
      useKDF: true,
      ...config,
    };

    // Validate key
    if (!config.key || config.key.length === 0) {
      throw new Error('Encryption key cannot be empty');
    }

    // If not using KDF, validate key length
    if (!this.config.useKDF && Buffer.from(config.key, 'hex').length !== KEY_LENGTH) {
      throw new Error(`Raw encryption key must be exactly ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters)`);
    }
  }

  /**
   * Derive encryption key from password using PBKDF2
   */
  private deriveKey(password: string, salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(
      password,
      salt,
      PBKDF2_ITERATIONS,
      KEY_LENGTH,
      'sha256'
    );
  }

  /**
   * Get or derive encryption key
   */
  private getKey(salt?: Buffer): Buffer {
    if (!this.config.useKDF) {
      // Use raw key directly
      return Buffer.from(this.config.key, 'hex');
    }

    // Derive key from password
    if (!salt) {
      throw new Error('Salt is required for key derivation');
    }
    return this.deriveKey(this.config.key, salt);
  }

  /**
   * Encrypt data
   */
  encrypt(plaintext: string): EncryptedData {
    // Generate random IV and salt
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = this.config.useKDF ? crypto.randomBytes(SALT_LENGTH) : undefined;

    // Get encryption key
    const key = this.getKey(salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Return encrypted data structure
    const result: EncryptedData = {
      data: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };

    if (salt) {
      result.salt = salt.toString('base64');
    }

    return result;
  }

  /**
   * Decrypt data
   */
  decrypt(encrypted: EncryptedData): string {
    try {
      // Parse encrypted data
      const data = Buffer.from(encrypted.data, 'base64');
      const iv = Buffer.from(encrypted.iv, 'base64');
      const authTag = Buffer.from(encrypted.authTag, 'base64');
      const salt = encrypted.salt ? Buffer.from(encrypted.salt, 'base64') : undefined;

      // Get decryption key
      const key = this.getKey(salt);

      // Create decipher
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(authTag);

      // Decrypt data
      const decrypted = Buffer.concat([
        decipher.update(data),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt data to JSON string for storage
   */
  encryptToJSON(plaintext: string): string {
    const encrypted = this.encrypt(plaintext);
    return JSON.stringify(encrypted);
  }

  /**
   * Decrypt data from JSON string
   */
  decryptFromJSON(json: string): string {
    try {
      const encrypted = JSON.parse(json) as EncryptedData;
      return this.decrypt(encrypted);
    } catch (error) {
      throw new Error(`Failed to decrypt from JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a random encryption key (for raw key mode)
   */
  static generateKey(): string {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
  }

  /**
   * Hash a password for storage (for password verification, not encryption)
   */
  static hashPassword(password: string): string {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
  }

  /**
   * Verify a password against a hash
   */
  static verifyPassword(password: string, hashedPassword: string): boolean {
    try {
      const parts = hashedPassword.split(':');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return false;
      }
      const saltHex = parts[0];
      const hashHex = parts[1];
      const salt = Buffer.from(saltHex, 'hex');
      const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
      return hash.toString('hex') === hashHex;
    } catch {
      return false;
    }
  }
}

/**
 * Create encryption instance from environment or config
 */
export function createEncryption(key?: string, useKDF: boolean = true): DatabaseEncryption | null {
  // Try environment variable first
  const encryptionKey = key || process.env.DATABASE_ENCRYPTION_KEY;

  if (!encryptionKey) {
    return null;
  }

  return new DatabaseEncryption({
    key: encryptionKey,
    useKDF,
  });
}

/**
 * Helper function to safely encrypt a field (returns null if no encryption configured)
 */
export function encryptField(
  value: string,
  encryption: DatabaseEncryption | null
): string {
  if (!encryption) {
    return value;
  }
  return encryption.encryptToJSON(value);
}

/**
 * Helper function to safely decrypt a field (returns original if no encryption configured)
 */
export function decryptField(
  value: string,
  encryption: DatabaseEncryption | null
): string {
  if (!encryption) {
    return value;
  }

  // Check if value looks like encrypted JSON
  if (!value.startsWith('{')) {
    return value; // Not encrypted, return as-is
  }

  try {
    return encryption.decryptFromJSON(value);
  } catch {
    // If decryption fails, assume it's not encrypted and return as-is
    return value;
  }
}
