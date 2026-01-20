export interface AuditLogEntry {
  timestamp: Date;
  action: string;
  secretName?: string;
  success: boolean;
  metadata?: Record<string, any>;
}

/**
 * Audit logger for secret management operations
 *
 * Logs all secret access, modifications, and security events
 * for compliance and security monitoring
 */
export class SecretAuditLogger {
  private entries: AuditLogEntry[];
  private maxEntries: number;

  constructor(options: { maxEntries?: number } = {}) {
    this.entries = [];
    this.maxEntries = options.maxEntries ?? 10000;
  }

  private log(action: string, secretName?: string, success: boolean = true, metadata?: Record<string, any>): void {
    const entry: AuditLogEntry = {
      timestamp: new Date(),
      action,
      secretName,
      success,
      metadata,
    };

    this.entries.push(entry);

    // Trim old entries if exceeding max
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
  }

  logSecretStored(name: string): void {
    this.log('SECRET_STORED', name, true);
  }

  logSecretAccessed(name: string, success: boolean): void {
    this.log('SECRET_ACCESSED', name, success);
  }

  logSecretDeleted(name: string): void {
    this.log('SECRET_DELETED', name, true);
  }

  logSecretRotated(name: string): void {
    this.log('SECRET_ROTATED', name, true);
  }

  logSecretExpired(name: string): void {
    this.log('SECRET_EXPIRED', name, false, { reason: 'expired' });
  }

  logCacheCleared(): void {
    this.log('CACHE_CLEARED', undefined, true);
  }

  logSecretsExported(count: number): void {
    this.log('SECRETS_EXPORTED', undefined, true, { count });
  }

  logSecretsImported(count: number): void {
    this.log('SECRETS_IMPORTED', undefined, true, { count });
  }

  logUnauthorizedAccess(name: string, reason: string): void {
    this.log('UNAUTHORIZED_ACCESS', name, false, { reason });
  }

  logEncryptionFailure(name: string, error: string): void {
    this.log('ENCRYPTION_FAILURE', name, false, { error });
  }

  logDecryptionFailure(name: string, error: string): void {
    this.log('DECRYPTION_FAILURE', name, false, { error });
  }

  /**
   * Get all audit log entries
   */
  getEntries(filter?: { action?: string; secretName?: string; since?: Date }): AuditLogEntry[] {
    let filtered = this.entries;

    if (filter) {
      if (filter.action) {
        filtered = filtered.filter(e => e.action === filter.action);
      }
      if (filter.secretName) {
        filtered = filtered.filter(e => e.secretName === filter.secretName);
      }
      if (filter.since) {
        const sinceDate = filter.since;
        filtered = filtered.filter(e => e.timestamp >= sinceDate);
      }
    }

    return [...filtered];
  }

  /**
   * Get failed access attempts
   */
  getFailedAttempts(secretName?: string): AuditLogEntry[] {
    return this.getEntries({
      secretName,
    }).filter(e => !e.success);
  }

  /**
   * Clear all audit entries
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * Export audit log as JSON
   */
  exportLog(): string {
    return JSON.stringify(
      this.entries.map(e => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),
      null,
      2
    );
  }

  /**
   * Get summary statistics
   */
  getStatistics(): {
    totalEntries: number;
    successfulAccesses: number;
    failedAccesses: number;
    rotations: number;
    deletions: number;
  } {
    return {
      totalEntries: this.entries.length,
      successfulAccesses: this.entries.filter(e => e.action === 'SECRET_ACCESSED' && e.success).length,
      failedAccesses: this.entries.filter(e => e.action === 'SECRET_ACCESSED' && !e.success).length,
      rotations: this.entries.filter(e => e.action === 'SECRET_ROTATED').length,
      deletions: this.entries.filter(e => e.action === 'SECRET_DELETED').length,
    };
  }
}
