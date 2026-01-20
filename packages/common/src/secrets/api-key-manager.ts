import { DatabaseEncryption } from '../db/encryption';
import { SecretAuditLogger } from './audit-logger';

export interface SecretMetadata {
  name: string;
  createdAt: Date;
  lastAccessed?: Date;
  expiresAt?: Date;
  rotationPolicy?: 'manual' | 'auto' | 'none';
  rotationIntervalDays?: number;
}

export interface StoredSecret {
  encrypted: string;
  metadata: SecretMetadata;
}

/**
 * Centralized API Key Manager with encryption and audit logging
 *
 * Features:
 * - Encrypts API keys at rest using AES-256-GCM
 * - Audit logging for all secret access
 * - In-memory caching with encryption
 * - Metadata tracking (creation, access, expiration)
 * - Secret rotation support
 */
export class APIKeyManager {
  private encryption: DatabaseEncryption;
  private auditLogger: SecretAuditLogger;
  private secretStore: Map<string, StoredSecret>;
  private decryptedCache: Map<string, { value: string; cachedAt: number }>;
  private cacheExpiryMs: number;

  constructor(
    encryptionKey: string,
    options: {
      useKDF?: boolean;
      auditLogger?: SecretAuditLogger;
      cacheExpiryMs?: number;
    } = {}
  ) {
    this.encryption = new DatabaseEncryption({
      key: encryptionKey,
      useKDF: options.useKDF ?? false,
    });
    this.auditLogger = options.auditLogger ?? new SecretAuditLogger();
    this.secretStore = new Map();
    this.decryptedCache = new Map();
    this.cacheExpiryMs = options.cacheExpiryMs ?? 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Store an API key with encryption
   */
  async storeSecret(
    name: string,
    value: string,
    metadata: Partial<SecretMetadata> = {}
  ): Promise<void> {
    if (!name || !value) {
      throw new Error('Secret name and value are required');
    }

    const encrypted = this.encryption.encryptToJSON(value);
    const secretMetadata: SecretMetadata = {
      name,
      createdAt: new Date(),
      rotationPolicy: metadata.rotationPolicy ?? 'manual',
      rotationIntervalDays: metadata.rotationIntervalDays,
      expiresAt: metadata.expiresAt,
    };

    this.secretStore.set(name, {
      encrypted,
      metadata: secretMetadata,
    });

    this.auditLogger.logSecretStored(name);
    this.clearCache(name);
  }

  /**
   * Retrieve and decrypt an API key
   */
  async getSecret(name: string): Promise<string | null> {
    // Check cache first
    const cached = this.decryptedCache.get(name);
    if (cached && Date.now() - cached.cachedAt < this.cacheExpiryMs) {
      this.auditLogger.logSecretAccessed(name, true);
      return cached.value;
    }

    const stored = this.secretStore.get(name);
    if (!stored) {
      this.auditLogger.logSecretAccessed(name, false);
      return null;
    }

    // Check expiration
    if (stored.metadata.expiresAt && new Date() > stored.metadata.expiresAt) {
      this.auditLogger.logSecretExpired(name);
      return null;
    }

    // Decrypt
    const decrypted = this.encryption.decryptFromJSON(stored.encrypted);

    // Update metadata
    stored.metadata.lastAccessed = new Date();

    // Cache the decrypted value
    this.decryptedCache.set(name, {
      value: decrypted,
      cachedAt: Date.now(),
    });

    this.auditLogger.logSecretAccessed(name, true);
    return decrypted;
  }

  /**
   * Delete a secret
   */
  async deleteSecret(name: string): Promise<boolean> {
    const existed = this.secretStore.delete(name);
    this.clearCache(name);

    if (existed) {
      this.auditLogger.logSecretDeleted(name);
    }

    return existed;
  }

  /**
   * Rotate a secret (replace with new value)
   */
  async rotateSecret(name: string, newValue: string): Promise<void> {
    const stored = this.secretStore.get(name);
    if (!stored) {
      throw new Error(`Secret '${name}' not found`);
    }

    const metadata = { ...stored.metadata };
    await this.storeSecret(name, newValue, metadata);
    this.auditLogger.logSecretRotated(name);
  }

  /**
   * List all secret names (not values!)
   */
  listSecrets(): string[] {
    return Array.from(this.secretStore.keys());
  }

  /**
   * Get metadata for a secret
   */
  getMetadata(name: string): SecretMetadata | null {
    const stored = this.secretStore.get(name);
    return stored ? { ...stored.metadata } : null;
  }

  /**
   * Check if a secret is expired
   */
  isExpired(name: string): boolean {
    const metadata = this.getMetadata(name);
    if (!metadata || !metadata.expiresAt) {
      return false;
    }
    return new Date() > metadata.expiresAt;
  }

  /**
   * Check if a secret needs rotation
   */
  needsRotation(name: string): boolean {
    const metadata = this.getMetadata(name);
    if (!metadata || metadata.rotationPolicy === 'none' || metadata.rotationPolicy === 'manual' || metadata.rotationIntervalDays === undefined) {
      return false;
    }

    const daysSinceCreation =
      (Date.now() - metadata.createdAt.getTime()) / (1000 * 60 * 60 * 24);

    return daysSinceCreation >= metadata.rotationIntervalDays;
  }

  /**
   * Get all secrets that need rotation
   */
  getSecretsNeedingRotation(): string[] {
    return this.listSecrets().filter(name => this.needsRotation(name));
  }

  /**
   * Clear decrypted cache for a secret
   */
  private clearCache(name: string): void {
    this.decryptedCache.delete(name);
  }

  /**
   * Clear all decrypted cache
   */
  clearAllCache(): void {
    this.decryptedCache.clear();
    this.auditLogger.logCacheCleared();
  }

  /**
   * Export encrypted secrets for backup
   */
  exportSecrets(): string {
    const exportData = Array.from(this.secretStore.entries()).map(([name, stored]) => ({
      name,
      encrypted: stored.encrypted,
      metadata: {
        ...stored.metadata,
        createdAt: stored.metadata.createdAt.toISOString(),
        lastAccessed: stored.metadata.lastAccessed?.toISOString(),
        expiresAt: stored.metadata.expiresAt?.toISOString(),
      },
    }));

    this.auditLogger.logSecretsExported(exportData.length);
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import encrypted secrets from backup
   */
  importSecrets(data: string): void {
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed)) {
      throw new Error('Invalid import data: expected array');
    }

    let imported = 0;
    for (const item of parsed) {
      if (!item.name || !item.encrypted || !item.metadata) {
        continue;
      }

      this.secretStore.set(item.name, {
        encrypted: item.encrypted,
        metadata: {
          ...item.metadata,
          createdAt: new Date(item.metadata.createdAt),
          lastAccessed: item.metadata.lastAccessed ? new Date(item.metadata.lastAccessed) : undefined,
          expiresAt: item.metadata.expiresAt ? new Date(item.metadata.expiresAt) : undefined,
        },
      });
      imported++;
    }

    this.auditLogger.logSecretsImported(imported);
    this.clearAllCache();
  }

  /**
   * Get audit log entries
   */
  getAuditLog(): any[] {
    return this.auditLogger.getEntries();
  }
}
