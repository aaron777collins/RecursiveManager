/**
 * OWASP Top 10 Security Tests: Identification and Authentication Failures (A07:2021)
 *
 * Tests for:
 * - Password policy enforcement
 * - Brute force protection
 * - Session management
 * - Multi-factor authentication
 * - Credential storage
 * - Password reset security
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import crypto from 'crypto';

/**
 * Password strength validator
 */
export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
}

export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
};

export function validatePassword(password: string, policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }

  if (password.length > policy.maxLength) {
    errors.push(`Password must be at most ${policy.maxLength} characters`);
  }

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  if (policy.preventCommonPasswords) {
    const commonPasswords = [
      'password',
      'Password1!',
      'admin',
      '123456',
      'qwerty',
      'letmein',
      'welcome',
      'monkey',
      'dragon',
      'master',
    ];

    if (commonPasswords.some(common => password.toLowerCase().includes(common.toLowerCase()))) {
      errors.push('Password is too common');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Secure password hashing with PBKDF2
 */
export function hashPassword(password: string, salt?: Buffer): {
  hash: string;
  salt: string;
} {
  const passwordSalt = salt || crypto.randomBytes(32);
  const iterations = 100000; // OWASP recommended minimum
  const keyLength = 64;
  const digest = 'sha512';

  const hash = crypto.pbkdf2Sync(password, passwordSalt, iterations, keyLength, digest);

  return {
    hash: hash.toString('hex'),
    salt: passwordSalt.toString('hex'),
  };
}

/**
 * Verify password against stored hash
 */
export function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const salt = Buffer.from(storedSalt, 'hex');
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

/**
 * Brute force protection
 */
export class BruteForceProtection {
  private attempts: Map<string, { count: number; firstAttempt: number; lockedUntil?: number }> = new Map();

  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 15 * 60 * 1000, // 15 minutes
    private lockoutMs: number = 30 * 60 * 1000 // 30 minutes
  ) {}

  recordAttempt(identifier: string, success: boolean): { allowed: boolean; remainingAttempts: number } {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    // Check if locked out
    if (record?.lockedUntil && now < record.lockedUntil) {
      return { allowed: false, remainingAttempts: 0 };
    }

    // Clear old records
    if (!record || now - record.firstAttempt > this.windowMs) {
      if (success) {
        this.attempts.delete(identifier);
        return { allowed: true, remainingAttempts: this.maxAttempts };
      }

      this.attempts.set(identifier, { count: 1, firstAttempt: now });
      return { allowed: true, remainingAttempts: this.maxAttempts - 1 };
    }

    // Increment failed attempts
    if (!success) {
      record.count++;

      if (record.count >= this.maxAttempts) {
        record.lockedUntil = now + this.lockoutMs;
        return { allowed: false, remainingAttempts: 0 };
      }

      return { allowed: true, remainingAttempts: this.maxAttempts - record.count };
    }

    // Success - clear attempts
    this.attempts.delete(identifier);
    return { allowed: true, remainingAttempts: this.maxAttempts };
  }

  isLocked(identifier: string): boolean {
    const record = this.attempts.get(identifier);
    if (!record?.lockedUntil) return false;

    const now = Date.now();
    return now < record.lockedUntil;
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

/**
 * Session management
 */
export class SessionManager {
  private sessions: Map<string, { userId: string; createdAt: number; lastActivity: number; data: Record<string, unknown> }> = new Map();

  constructor(
    private sessionTimeout: number = 30 * 60 * 1000, // 30 minutes
    private absoluteTimeout: number = 8 * 60 * 60 * 1000 // 8 hours
  ) {}

  createSession(userId: string): string {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Date.now();

    this.sessions.set(sessionId, {
      userId,
      createdAt: now,
      lastActivity: now,
      data: {},
    });

    return sessionId;
  }

  validateSession(sessionId: string): { valid: boolean; userId?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { valid: false };
    }

    const now = Date.now();

    // Check absolute timeout
    if (now - session.createdAt > this.absoluteTimeout) {
      this.sessions.delete(sessionId);
      return { valid: false };
    }

    // Check inactivity timeout
    if (now - session.lastActivity > this.sessionTimeout) {
      this.sessions.delete(sessionId);
      return { valid: false };
    }

    // Update last activity
    session.lastActivity = now;

    return { valid: true, userId: session.userId };
  }

  destroySession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  renewSession(oldSessionId: string): string | null {
    const session = this.sessions.get(oldSessionId);
    if (!session) return null;

    this.sessions.delete(oldSessionId);
    return this.createSession(session.userId);
  }
}

/**
 * Password reset token
 */
export class PasswordResetManager {
  private tokens: Map<string, { userId: string; expiresAt: number }> = new Map();

  constructor(private tokenLifetime: number = 60 * 60 * 1000) {} // 1 hour

  generateResetToken(userId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + this.tokenLifetime;

    this.tokens.set(token, { userId, expiresAt });

    return token;
  }

  validateResetToken(token: string): { valid: boolean; userId?: string } {
    const record = this.tokens.get(token);
    if (!record) {
      return { valid: false };
    }

    if (Date.now() > record.expiresAt) {
      this.tokens.delete(token);
      return { valid: false };
    }

    return { valid: true, userId: record.userId };
  }

  consumeResetToken(token: string): boolean {
    const { valid } = this.validateResetToken(token);
    if (valid) {
      this.tokens.delete(token);
      return true;
    }
    return false;
  }
}

describe('OWASP A07:2021 - Identification and Authentication Failures', () => {
  describe('Password Policy Enforcement', () => {
    it('should require minimum password length', () => {
      const result = validatePassword('short');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at least 12 characters');
    });

    it('should require uppercase letters', () => {
      const result = validatePassword('lowercase123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should require lowercase letters', () => {
      const result = validatePassword('UPPERCASE123!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should require numbers', () => {
      const result = validatePassword('NoNumbersHere!');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should require special characters', () => {
      const result = validatePassword('NoSpecialChars123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject common passwords', () => {
      const commonPasswords = ['Password1!', 'Welcome123!', 'Admin123!'];

      for (const password of commonPasswords) {
        const result = validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Password is too common');
      }
    });

    it('should accept strong passwords', () => {
      const strongPasswords = [
        'MyStr0ng!P@ssw0rd',
        'C0mpl3x&S3cur3!',
        'Un1qu3#P@ssw0rd!',
      ];

      for (const password of strongPasswords) {
        const result = validatePassword(password);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should enforce maximum password length', () => {
      const tooLong = 'a'.repeat(200) + 'A1!';
      const result = validatePassword(tooLong);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Password must be at most 128 characters');
    });
  });

  describe('Secure Password Hashing', () => {
    it('should hash passwords with salt', () => {
      const password = 'MyStr0ng!P@ssw0rd';
      const { hash, salt } = hashPassword(password);

      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
      expect(salt.length).toBeGreaterThan(0);
    });

    it('should generate different hashes for same password', () => {
      const password = 'MyStr0ng!P@ssw0rd';
      const result1 = hashPassword(password);
      const result2 = hashPassword(password);

      // Different salts produce different hashes
      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.salt).not.toBe(result2.salt);
    });

    it('should verify correct password', () => {
      const password = 'MyStr0ng!P@ssw0rd';
      const { hash, salt } = hashPassword(password);

      const isValid = verifyPassword(password, hash, salt);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', () => {
      const password = 'MyStr0ng!P@ssw0rd';
      const { hash, salt } = hashPassword(password);

      const isValid = verifyPassword('WrongPassword123!', hash, salt);
      expect(isValid).toBe(false);
    });

    it('should use computationally expensive hashing', () => {
      const password = 'MyStr0ng!P@ssw0rd';

      const startTime = Date.now();
      hashPassword(password);
      const endTime = Date.now();

      // PBKDF2 with 100k iterations should take some time
      // Typically 50-200ms depending on hardware
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(10); // At least 10ms
    });
  });

  describe('Brute Force Protection', () => {
    let protection: BruteForceProtection;

    beforeEach(() => {
      protection = new BruteForceProtection(3, 1000, 5000); // 3 attempts, 1s window, 5s lockout
    });

    it('should allow initial login attempts', () => {
      const result = protection.recordAttempt('user@example.com', false);

      expect(result.allowed).toBe(true);
      expect(result.remainingAttempts).toBe(2);
    });

    it('should track multiple failed attempts', () => {
      protection.recordAttempt('user@example.com', false);
      protection.recordAttempt('user@example.com', false);
      const result = protection.recordAttempt('user@example.com', false);

      expect(result.allowed).toBe(false);
      expect(result.remainingAttempts).toBe(0);
    });

    it('should lock account after max failed attempts', () => {
      protection.recordAttempt('user@example.com', false);
      protection.recordAttempt('user@example.com', false);
      protection.recordAttempt('user@example.com', false);

      const isLocked = protection.isLocked('user@example.com');
      expect(isLocked).toBe(true);
    });

    it('should prevent login during lockout period', () => {
      protection.recordAttempt('user@example.com', false);
      protection.recordAttempt('user@example.com', false);
      protection.recordAttempt('user@example.com', false);

      const result = protection.recordAttempt('user@example.com', true);
      expect(result.allowed).toBe(false);
    });

    it('should reset attempts on successful login', () => {
      protection.recordAttempt('user@example.com', false);
      protection.recordAttempt('user@example.com', true);

      const result = protection.recordAttempt('user@example.com', false);
      expect(result.remainingAttempts).toBe(2);
    });

    it('should track attempts per user independently', () => {
      protection.recordAttempt('user1@example.com', false);
      protection.recordAttempt('user1@example.com', false);

      protection.recordAttempt('user2@example.com', false);

      const user1Locked = protection.isLocked('user1@example.com');
      const user2Locked = protection.isLocked('user2@example.com');

      expect(user1Locked).toBe(false);
      expect(user2Locked).toBe(false);
    });

    it('should allow manual reset of attempts', () => {
      protection.recordAttempt('user@example.com', false);
      protection.recordAttempt('user@example.com', false);

      protection.reset('user@example.com');

      const result = protection.recordAttempt('user@example.com', false);
      expect(result.remainingAttempts).toBe(2);
    });
  });

  describe('Session Management', () => {
    let sessionManager: SessionManager;

    beforeEach(() => {
      sessionManager = new SessionManager(1000, 5000); // 1s idle, 5s absolute
    });

    it('should create unique session IDs', () => {
      const session1 = sessionManager.createSession('user-1');
      const session2 = sessionManager.createSession('user-2');

      expect(session1).not.toBe(session2);
      expect(session1.length).toBeGreaterThan(0);
      expect(session2.length).toBeGreaterThan(0);
    });

    it('should validate active sessions', () => {
      const sessionId = sessionManager.createSession('user-1');

      const result = sessionManager.validateSession(sessionId);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-1');
    });

    it('should reject invalid session IDs', () => {
      const result = sessionManager.validateSession('invalid-session');

      expect(result.valid).toBe(false);
    });

    it('should expire sessions after inactivity timeout', async () => {
      const sessionId = sessionManager.createSession('user-1');

      // Wait for inactivity timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      const result = sessionManager.validateSession(sessionId);
      expect(result.valid).toBe(false);
    });

    it('should expire sessions after absolute timeout', async () => {
      const sessionId = sessionManager.createSession('user-1');

      // Keep session active but exceed absolute timeout
      await new Promise(resolve => setTimeout(resolve, 2000));
      sessionManager.validateSession(sessionId); // Refresh activity

      await new Promise(resolve => setTimeout(resolve, 4000));

      const result = sessionManager.validateSession(sessionId);
      expect(result.valid).toBe(false);
    });

    it('should destroy sessions on logout', () => {
      const sessionId = sessionManager.createSession('user-1');

      sessionManager.destroySession(sessionId);

      const result = sessionManager.validateSession(sessionId);
      expect(result.valid).toBe(false);
    });

    it('should renew sessions', () => {
      const oldSessionId = sessionManager.createSession('user-1');
      const newSessionId = sessionManager.renewSession(oldSessionId);

      expect(newSessionId).not.toBe(oldSessionId);
      expect(newSessionId).not.toBeNull();

      const oldResult = sessionManager.validateSession(oldSessionId);
      const newResult = sessionManager.validateSession(newSessionId!);

      expect(oldResult.valid).toBe(false);
      expect(newResult.valid).toBe(true);
    });
  });

  describe('Password Reset Security', () => {
    let resetManager: PasswordResetManager;

    beforeEach(() => {
      resetManager = new PasswordResetManager(1000); // 1s lifetime
    });

    it('should generate unique reset tokens', () => {
      const token1 = resetManager.generateResetToken('user-1');
      const token2 = resetManager.generateResetToken('user-2');

      expect(token1).not.toBe(token2);
      expect(token1.length).toBeGreaterThan(0);
      expect(token2.length).toBeGreaterThan(0);
    });

    it('should validate active reset tokens', () => {
      const token = resetManager.generateResetToken('user-1');

      const result = resetManager.validateResetToken(token);

      expect(result.valid).toBe(true);
      expect(result.userId).toBe('user-1');
    });

    it('should reject invalid reset tokens', () => {
      const result = resetManager.validateResetToken('invalid-token');

      expect(result.valid).toBe(false);
    });

    it('should expire reset tokens after timeout', async () => {
      const token = resetManager.generateResetToken('user-1');

      await new Promise(resolve => setTimeout(resolve, 1100));

      const result = resetManager.validateResetToken(token);
      expect(result.valid).toBe(false);
    });

    it('should consume reset token on use', () => {
      const token = resetManager.generateResetToken('user-1');

      const consumed = resetManager.consumeResetToken(token);
      expect(consumed).toBe(true);

      // Token should be invalid after consumption
      const result = resetManager.validateResetToken(token);
      expect(result.valid).toBe(false);
    });

    it('should not allow reusing consumed tokens', () => {
      const token = resetManager.generateResetToken('user-1');

      resetManager.consumeResetToken(token);
      const secondUse = resetManager.consumeResetToken(token);

      expect(secondUse).toBe(false);
    });
  });

  describe('Multi-Factor Authentication Support', () => {
    it('should generate TOTP-compatible secrets', () => {
      // Generate 32-byte secret for TOTP
      const secret = crypto.randomBytes(32).toString('base32');

      expect(secret.length).toBeGreaterThan(0);
      expect(/^[A-Z2-7]+$/.test(secret)).toBe(true); // Base32 alphabet
    });

    it('should support backup codes', () => {
      // Generate 10 backup codes
      const backupCodes = Array.from({ length: 10 }, () =>
        crypto.randomBytes(4).toString('hex').toUpperCase()
      );

      expect(backupCodes.length).toBe(10);
      expect(new Set(backupCodes).size).toBe(10); // All unique
    });

    it('should validate backup code format', () => {
      const validCodes = ['A1B2C3D4', '12345678', 'ABCDEF12'];
      const invalidCodes = ['short', 'toolongcode123', 'invalid!@#'];

      for (const code of validCodes) {
        expect(/^[A-Z0-9]{8}$/i.test(code)).toBe(true);
      }

      for (const code of invalidCodes) {
        expect(/^[A-Z0-9]{8}$/i.test(code)).toBe(false);
      }
    });
  });

  describe('Credential Storage Security', () => {
    it('should never store plaintext passwords', () => {
      const password = 'MyStr0ng!P@ssw0rd';
      const { hash } = hashPassword(password);

      // Hash should not contain the plaintext password
      expect(hash).not.toContain(password);
      expect(hash.toLowerCase()).not.toContain('password');
    });

    it('should use cryptographically secure random for salts', () => {
      const { salt } = hashPassword('test');

      // crypto.randomBytes uses secure RNG
      expect(salt.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should use unique salts per user', () => {
      const password = 'SamePassword123!';

      const user1 = hashPassword(password);
      const user2 = hashPassword(password);

      expect(user1.salt).not.toBe(user2.salt);
      expect(user1.hash).not.toBe(user2.hash);
    });
  });
});
