# Secret Management System

RecursiveManager includes a comprehensive secret management system for securing API keys and sensitive credentials.

## Overview

The secret management system provides:

- **AES-256-GCM encryption** for secrets at rest
- **Audit logging** for all secret access and modifications
- **In-memory caching** with configurable expiry
- **Secret rotation** with policies and scheduling
- **Import/export** for backup and migration
- **Expiration tracking** for temporary credentials

## Architecture

The secret management system consists of two main components:

### 1. APIKeyManager

Centralized manager for storing, retrieving, and rotating encrypted secrets.

### 2. SecretAuditLogger

Audit logger that tracks all secret operations for compliance and security monitoring.

## Quick Start

### Basic Usage

```typescript
import { APIKeyManager, DatabaseEncryption } from '@recursivemanager/common';

// Generate a secure encryption key
const encryptionKey = DatabaseEncryption.generateKey();

// Create manager
const manager = new APIKeyManager(encryptionKey);

// Store a secret
await manager.storeSecret('ANTHROPIC_API_KEY', 'sk-ant-123456');

// Retrieve a secret
const apiKey = await manager.getSecret('ANTHROPIC_API_KEY');

// Use the secret
console.log(apiKey); // 'sk-ant-123456'
```

### Using Password-Based Encryption (KDF)

```typescript
import { APIKeyManager } from '@recursivemanager/common';

// Use password with PBKDF2 key derivation
const manager = new APIKeyManager('my-secure-password', {
  useKDF: true
});

await manager.storeSecret('API_KEY', 'secret-value');
```

## Configuration

### Environment Variables

Set the encryption key via environment variable:

```bash
# Using raw hex key (recommended for production)
export SECRET_ENCRYPTION_KEY="64-character-hex-key"

# Or using password with KDF (easier for development)
export SECRET_ENCRYPTION_PASSWORD="my-secure-password"
export SECRET_ENCRYPTION_USE_KDF="true"
```

### Manager Options

```typescript
const manager = new APIKeyManager(encryptionKey, {
  // Use PBKDF2 key derivation (for password-based keys)
  useKDF: false,

  // Custom audit logger
  auditLogger: new SecretAuditLogger({ maxEntries: 5000 }),

  // Cache expiry in milliseconds (default: 5 minutes)
  cacheExpiryMs: 5 * 60 * 1000,
});
```

## Features

### Storing Secrets with Metadata

```typescript
await manager.storeSecret('GITHUB_TOKEN', 'ghp_123456', {
  // Rotation policy: 'manual' | 'auto' | 'none'
  rotationPolicy: 'auto',

  // Rotate every 30 days
  rotationIntervalDays: 30,

  // Expiration date
  expiresAt: new Date('2026-12-31'),
});
```

### Secret Rotation

```typescript
// Manual rotation
await manager.rotateSecret('GITHUB_TOKEN', 'ghp_new-token');

// Check if rotation needed
if (manager.needsRotation('GITHUB_TOKEN')) {
  await manager.rotateSecret('GITHUB_TOKEN', newToken);
}

// Get all secrets needing rotation
const needsRotation = manager.getSecretsNeedingRotation();
for (const secretName of needsRotation) {
  console.log(`${secretName} needs rotation`);
}
```

### Listing and Metadata

```typescript
// List all secret names (not values!)
const secretNames = manager.listSecrets();
console.log(secretNames); // ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN', ...]

// Get metadata
const metadata = manager.getMetadata('ANTHROPIC_API_KEY');
console.log(metadata);
// {
//   name: 'ANTHROPIC_API_KEY',
//   createdAt: Date,
//   lastAccessed: Date,
//   expiresAt: Date,
//   rotationPolicy: 'auto',
//   rotationIntervalDays: 30
// }
```

### Expiration Handling

```typescript
// Check if expired
if (manager.isExpired('TEMP_TOKEN')) {
  console.log('Token has expired');
}

// Expired secrets return null
const expiredSecret = await manager.getSecret('EXPIRED_KEY');
console.log(expiredSecret); // null
```

### Deleting Secrets

```typescript
const deleted = await manager.deleteSecret('OLD_KEY');
if (deleted) {
  console.log('Secret deleted successfully');
}
```

### Cache Management

```typescript
// Clear cache for specific secret
await manager.storeSecret('key', 'value'); // Clears cache automatically

// Clear all cached secrets
manager.clearAllCache();
```

### Export and Import

```typescript
// Export encrypted secrets (safe for backups)
const backup = manager.exportSecrets();
await fs.writeFile('secrets-backup.json', backup);

// Import from backup
const backupData = await fs.readFile('secrets-backup.json', 'utf-8');
manager.importSecrets(backupData);
```

## Audit Logging

### Accessing Audit Logs

```typescript
// Get all audit entries
const auditLog = manager.getAuditLog();

// Filter by action
const logger = new SecretAuditLogger();
const accessLogs = logger.getEntries({ action: 'SECRET_ACCESSED' });

// Filter by secret name
const keyLogs = logger.getEntries({ secretName: 'ANTHROPIC_API_KEY' });

// Filter by time
const recent = logger.getEntries({
  since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
});
```

### Audit Events

The following events are logged:

- `SECRET_STORED` - Secret was stored/updated
- `SECRET_ACCESSED` - Secret was retrieved (success/failure)
- `SECRET_DELETED` - Secret was deleted
- `SECRET_ROTATED` - Secret was rotated
- `SECRET_EXPIRED` - Access attempt to expired secret
- `CACHE_CLEARED` - Cache was cleared
- `SECRETS_EXPORTED` - Secrets were exported
- `SECRETS_IMPORTED` - Secrets were imported
- `UNAUTHORIZED_ACCESS` - Unauthorized access attempt
- `ENCRYPTION_FAILURE` - Encryption failed
- `DECRYPTION_FAILURE` - Decryption failed

### Audit Statistics

```typescript
const stats = logger.getStatistics();
console.log(stats);
// {
//   totalEntries: 150,
//   successfulAccesses: 120,
//   failedAccesses: 10,
//   rotations: 5,
//   deletions: 2
// }
```

### Failed Attempts

```typescript
// Get all failed access attempts
const failed = logger.getFailedAttempts();

// Get failed attempts for specific secret
const keyFailed = logger.getFailedAttempts('SENSITIVE_KEY');
```

### Exporting Audit Logs

```typescript
// Export as JSON
const auditExport = logger.exportLog();
await fs.writeFile('audit-log.json', auditExport);
```

## Security Best Practices

### 1. Key Generation

Always use cryptographically secure key generation:

```typescript
import { DatabaseEncryption } from '@recursivemanager/common';

// Generate secure random key
const key = DatabaseEncryption.generateKey();
console.log(key); // 64-character hex string
```

### 2. Key Storage

**Never commit encryption keys to version control**. Use environment variables:

```bash
# .env (add to .gitignore)
SECRET_ENCRYPTION_KEY=your-generated-key-here
```

### 3. Key Rotation

Rotate encryption keys periodically:

```typescript
// 1. Export with old key
const oldManager = new APIKeyManager(oldKey);
const backup = oldManager.exportSecrets();

// 2. Import with new key
const newManager = new APIKeyManager(newKey);
newManager.importSecrets(backup);
```

### 4. Secret Rotation Policies

Set appropriate rotation policies:

```typescript
// Critical secrets: rotate every 30 days
await manager.storeSecret('PROD_API_KEY', value, {
  rotationPolicy: 'auto',
  rotationIntervalDays: 30,
});

// Development secrets: manual rotation
await manager.storeSecret('DEV_API_KEY', value, {
  rotationPolicy: 'manual',
});

// Temporary tokens: set expiration
await manager.storeSecret('TEMP_TOKEN', value, {
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
});
```

### 5. Audit Log Monitoring

Regularly review audit logs for suspicious activity:

```typescript
// Check for failed access attempts
const failedAttempts = logger.getFailedAttempts();
if (failedAttempts.length > 10) {
  console.warn('High number of failed access attempts detected');
}

// Monitor specific secrets
const sensitiveAccess = logger.getEntries({
  secretName: 'PRODUCTION_KEY',
  since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
});
```

### 6. Cache Security

Configure appropriate cache expiry:

```typescript
// Short cache for highly sensitive secrets
const manager = new APIKeyManager(key, {
  cacheExpiryMs: 60 * 1000, // 1 minute
});

// Clear cache before sensitive operations
manager.clearAllCache();
```

## Integration Examples

### Using with AI Providers

```typescript
import { APIKeyManager } from '@recursivemanager/common';

// Initialize manager
const secretManager = new APIKeyManager(process.env.SECRET_ENCRYPTION_KEY!);

// Store provider API keys
await secretManager.storeSecret('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY!, {
  rotationPolicy: 'auto',
  rotationIntervalDays: 90,
});

// Retrieve in provider
class AnthropicProvider {
  async initialize() {
    this.apiKey = await secretManager.getSecret('ANTHROPIC_API_KEY');
  }
}
```

### Automated Rotation

```typescript
// Check and rotate secrets daily
setInterval(async () => {
  const needsRotation = manager.getSecretsNeedingRotation();

  for (const secretName of needsRotation) {
    console.log(`Rotating ${secretName}...`);
    const newValue = await fetchNewSecretValue(secretName);
    await manager.rotateSecret(secretName, newValue);
  }
}, 24 * 60 * 60 * 1000); // Daily
```

## API Reference

### APIKeyManager

#### Constructor

```typescript
new APIKeyManager(encryptionKey: string, options?: {
  useKDF?: boolean;
  auditLogger?: SecretAuditLogger;
  cacheExpiryMs?: number;
})
```

#### Methods

- `storeSecret(name, value, metadata?)` - Store encrypted secret
- `getSecret(name)` - Retrieve and decrypt secret
- `deleteSecret(name)` - Delete secret
- `rotateSecret(name, newValue)` - Rotate secret
- `listSecrets()` - List all secret names
- `getMetadata(name)` - Get secret metadata
- `isExpired(name)` - Check if secret is expired
- `needsRotation(name)` - Check if rotation needed
- `getSecretsNeedingRotation()` - Get all secrets needing rotation
- `clearAllCache()` - Clear decrypted cache
- `exportSecrets()` - Export encrypted secrets
- `importSecrets(data)` - Import encrypted secrets
- `getAuditLog()` - Get audit log entries

### SecretAuditLogger

#### Constructor

```typescript
new SecretAuditLogger(options?: {
  maxEntries?: number; // Default: 10000
})
```

#### Methods

- `getEntries(filter?)` - Get audit entries
- `getFailedAttempts(secretName?)` - Get failed attempts
- `getStatistics()` - Get audit statistics
- `clear()` - Clear all entries
- `exportLog()` - Export as JSON

## Troubleshooting

### Common Issues

**Issue**: `Unsupported state or unable to authenticate data`

**Solution**: Encryption key mismatch. Ensure you're using the same key that encrypted the data.

```typescript
// Use consistent key
const key = process.env.SECRET_ENCRYPTION_KEY;
const manager = new APIKeyManager(key);
```

**Issue**: `Secret returns null but exists`

**Solution**: Secret may be expired. Check expiration:

```typescript
if (manager.isExpired('SECRET_NAME')) {
  console.log('Secret has expired');
}
```

**Issue**: High memory usage

**Solution**: Clear cache periodically:

```typescript
// Clear cache every hour
setInterval(() => {
  manager.clearAllCache();
}, 60 * 60 * 1000);
```

## See Also

- [Database Encryption](../architecture/database.md#encryption-at-rest)
- [Security Best Practices](./security-best-practices.md)
- [Configuration Guide](../configuration.md)
