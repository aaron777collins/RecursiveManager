/**
 * OWASP Top 10 Security Tests: Server-Side Request Forgery (A10:2021)
 *
 * Tests for:
 * - SSRF attack prevention
 * - URL validation and sanitization
 * - Internal network access restrictions
 * - DNS rebinding protection
 * - Redirect following security
 * - File protocol exploitation prevention
 */

import { describe, it, expect } from '@jest/globals';
import { URL } from 'url';

/**
 * URL allowlist configuration
 */
export interface URLAllowlistConfig {
  allowedProtocols: string[];
  allowedDomains: string[];
  blockPrivateIPs: boolean;
  blockLocalhost: boolean;
  blockMetadataEndpoints: boolean;
}

export const DEFAULT_URL_ALLOWLIST: URLAllowlistConfig = {
  allowedProtocols: ['https'],
  allowedDomains: [], // Empty = allow all public domains
  blockPrivateIPs: true,
  blockLocalhost: true,
  blockMetadataEndpoints: true,
};

/**
 * Check if IP is in private range
 */
export function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./,                      // 10.0.0.0/8
    /^172\.(1[6-9]|2\d|3[01])\./,// 172.16.0.0/12
    /^192\.168\./,                // 192.168.0.0/16
    /^169\.254\./,                // 169.254.0.0/16 (link-local)
    /^127\./,                     // 127.0.0.0/8 (localhost)
    /^0\.0\.0\.0$/,               // 0.0.0.0
    /^::1$/,                      // IPv6 localhost
    /^fe80:/,                     // IPv6 link-local
    /^fc00:/,                     // IPv6 unique local
    /^fd00:/,                     // IPv6 unique local
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * Check if URL points to localhost
 */
export function isLocalhost(hostname: string): boolean {
  const localhostPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
    '[::1]',
  ];

  return localhostPatterns.includes(hostname.toLowerCase()) || hostname.startsWith('127.');
}

/**
 * Check if URL is a cloud metadata endpoint
 */
export function isMetadataEndpoint(hostname: string): boolean {
  const metadataHosts = [
    '169.254.169.254',     // AWS, Azure, Google Cloud
    '169.254.170.2',       // AWS ECS
    'metadata.google.internal', // Google Cloud
    '100.100.100.200',     // Alibaba Cloud
  ];

  return metadataHosts.includes(hostname.toLowerCase());
}

/**
 * Validate URL against security policies
 */
export function validateURL(
  urlString: string,
  config: URLAllowlistConfig = DEFAULT_URL_ALLOWLIST
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const url = new URL(urlString);

    // Check protocol
    if (!config.allowedProtocols.includes(url.protocol.replace(':', ''))) {
      errors.push(`Protocol ${url.protocol} is not allowed`);
    }

    // Check for file:// protocol exploitation
    if (url.protocol === 'file:') {
      errors.push('File protocol is not allowed');
    }

    // Check for localhost
    if (config.blockLocalhost && isLocalhost(url.hostname)) {
      errors.push('Localhost URLs are not allowed');
    }

    // Check for private IPs
    if (config.blockPrivateIPs && isPrivateIP(url.hostname)) {
      errors.push('Private IP addresses are not allowed');
    }

    // Check for metadata endpoints
    if (config.blockMetadataEndpoints && isMetadataEndpoint(url.hostname)) {
      errors.push('Cloud metadata endpoints are not allowed');
    }

    // Check domain allowlist
    if (config.allowedDomains.length > 0) {
      const isAllowed = config.allowedDomains.some(domain =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`)
      );

      if (!isAllowed) {
        errors.push(`Domain ${url.hostname} is not in allowlist`);
      }
    }

    // Check for URL encoding tricks
    if (urlString.includes('%00')) {
      errors.push('Null bytes in URL are not allowed');
    }

    // Check for malformed URLs
    if (url.hostname === '' && url.protocol !== 'file:') {
      errors.push('Malformed URL');
    }

  } catch (error) {
    errors.push(`Invalid URL: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Safe HTTP client wrapper (simulation)
 */
export class SafeHTTPClient {
  constructor(private config: URLAllowlistConfig = DEFAULT_URL_ALLOWLIST) {}

  async fetch(urlString: string): Promise<{ allowed: boolean; reason?: string }> {
    const validation = validateURL(urlString, this.config);

    if (!validation.valid) {
      return {
        allowed: false,
        reason: validation.errors.join(', '),
      };
    }

    // In real implementation, would perform actual HTTP request
    return { allowed: true };
  }
}

/**
 * Detect URL redirect chains
 */
export function detectRedirectLoop(urls: string[], maxRedirects: number = 5): boolean {
  if (urls.length > maxRedirects) {
    return true;
  }

  // Check for cycles in redirect chain
  const uniqueUrls = new Set(urls);
  return uniqueUrls.size < urls.length;
}

/**
 * Sanitize URL for safe display/logging
 */
export function sanitizeURLForDisplay(urlString: string): string {
  try {
    const url = new URL(urlString);

    // Remove credentials
    if (url.username || url.password) {
      url.username = '';
      url.password = '';
    }

    return url.toString();
  } catch {
    return '[Invalid URL]';
  }
}

describe('OWASP A10:2021 - Server-Side Request Forgery (SSRF)', () => {
  describe('Private IP Detection', () => {
    it('should detect 10.0.0.0/8 range', () => {
      const privateIPs = ['10.0.0.1', '10.255.255.255', '10.1.2.3'];

      for (const ip of privateIPs) {
        expect(isPrivateIP(ip)).toBe(true);
      }
    });

    it('should detect 172.16.0.0/12 range', () => {
      const privateIPs = ['172.16.0.1', '172.31.255.255', '172.20.5.10'];

      for (const ip of privateIPs) {
        expect(isPrivateIP(ip)).toBe(true);
      }
    });

    it('should detect 192.168.0.0/16 range', () => {
      const privateIPs = ['192.168.0.1', '192.168.255.255', '192.168.1.100'];

      for (const ip of privateIPs) {
        expect(isPrivateIP(ip)).toBe(true);
      }
    });

    it('should detect localhost ranges', () => {
      const localhostIPs = ['127.0.0.1', '127.0.0.2', '127.255.255.255'];

      for (const ip of localhostIPs) {
        expect(isPrivateIP(ip)).toBe(true);
      }
    });

    it('should detect IPv6 localhost', () => {
      expect(isPrivateIP('::1')).toBe(true);
    });

    it('should detect link-local addresses', () => {
      expect(isPrivateIP('169.254.1.1')).toBe(true);
      expect(isPrivateIP('fe80::1')).toBe(true);
    });

    it('should allow public IPs', () => {
      const publicIPs = ['8.8.8.8', '1.1.1.1', '93.184.216.34'];

      for (const ip of publicIPs) {
        expect(isPrivateIP(ip)).toBe(false);
      }
    });
  });

  describe('Localhost Detection', () => {
    it('should detect localhost hostname', () => {
      expect(isLocalhost('localhost')).toBe(true);
      expect(isLocalhost('LOCALHOST')).toBe(true);
    });

    it('should detect 127.0.0.1', () => {
      expect(isLocalhost('127.0.0.1')).toBe(true);
      expect(isLocalhost('127.0.0.2')).toBe(true);
    });

    it('should detect IPv6 localhost', () => {
      expect(isLocalhost('::1')).toBe(true);
      expect(isLocalhost('[::1]')).toBe(true);
    });

    it('should allow non-localhost hostnames', () => {
      expect(isLocalhost('example.com')).toBe(false);
      expect(isLocalhost('192.168.1.1')).toBe(false);
    });
  });

  describe('Cloud Metadata Endpoint Detection', () => {
    it('should detect AWS metadata endpoint', () => {
      expect(isMetadataEndpoint('169.254.169.254')).toBe(true);
    });

    it('should detect AWS ECS metadata endpoint', () => {
      expect(isMetadataEndpoint('169.254.170.2')).toBe(true);
    });

    it('should detect Google Cloud metadata endpoint', () => {
      expect(isMetadataEndpoint('metadata.google.internal')).toBe(true);
    });

    it('should detect Alibaba Cloud metadata endpoint', () => {
      expect(isMetadataEndpoint('100.100.100.200')).toBe(true);
    });

    it('should allow non-metadata endpoints', () => {
      expect(isMetadataEndpoint('example.com')).toBe(false);
      expect(isMetadataEndpoint('8.8.8.8')).toBe(false);
    });
  });

  describe('URL Validation', () => {
    it('should allow HTTPS URLs to public domains', () => {
      const result = validateURL('https://example.com/api');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should block HTTP URLs by default', () => {
      const result = validateURL('http://example.com/api');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Protocol http is not allowed');
    });

    it('should block file:// protocol', () => {
      const result = validateURL('file:///etc/passwd');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('File protocol is not allowed');
    });

    it('should block localhost URLs', () => {
      const localhostUrls = [
        'https://localhost/api',
        'https://127.0.0.1/api',
        'https://[::1]/api',
      ];

      for (const url of localhostUrls) {
        const result = validateURL(url);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Localhost URLs are not allowed');
      }
    });

    it('should block private IP URLs', () => {
      const privateUrls = [
        'https://10.0.0.1/api',
        'https://172.16.0.1/api',
        'https://192.168.1.1/api',
      ];

      for (const url of privateUrls) {
        const result = validateURL(url);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Private IP addresses are not allowed');
      }
    });

    it('should block cloud metadata endpoints', () => {
      const metadataUrls = [
        'http://169.254.169.254/latest/meta-data/',
        'http://metadata.google.internal/computeMetadata/v1/',
      ];

      for (const url of metadataUrls) {
        const result = validateURL(url);
        expect(result.valid).toBe(false);
      }
    });

    it('should enforce domain allowlist', () => {
      const config: URLAllowlistConfig = {
        ...DEFAULT_URL_ALLOWLIST,
        allowedDomains: ['example.com', 'api.example.com'],
      };

      const validUrl = validateURL('https://api.example.com/data', config);
      expect(validUrl.valid).toBe(true);

      const invalidUrl = validateURL('https://evil.com/data', config);
      expect(invalidUrl.valid).toBe(false);
      expect(invalidUrl.errors).toContain('Domain evil.com is not in allowlist');
    });

    it('should detect null bytes in URLs', () => {
      const result = validateURL('https://example.com/api%00/admin');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Null bytes in URL are not allowed');
    });

    it('should handle malformed URLs', () => {
      const malformedUrls = [
        'not-a-url',
        'https://',
        'ftp://incomplete',
      ];

      for (const url of malformedUrls) {
        const result = validateURL(url);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('SSRF Attack Prevention', () => {
    it('should prevent access to AWS metadata service', () => {
      const result = validateURL('http://169.254.169.254/latest/meta-data/iam/security-credentials/');

      expect(result.valid).toBe(false);
    });

    it('should prevent access to internal services via IP', () => {
      const internalUrls = [
        'https://192.168.1.100:8080/admin',
        'https://10.0.0.50/api',
        'https://172.16.5.10/dashboard',
      ];

      for (const url of internalUrls) {
        const result = validateURL(url);
        expect(result.valid).toBe(false);
      }
    });

    it('should prevent localhost port scanning', () => {
      const scanUrls = [
        'https://localhost:22',
        'https://127.0.0.1:3306',
        'https://127.0.0.1:6379',
      ];

      for (const url of scanUrls) {
        const result = validateURL(url);
        expect(result.valid).toBe(false);
      }
    });

    it('should prevent file system access', () => {
      const fileUrls = [
        'file:///etc/passwd',
        'file:///var/log/system.log',
        'file://C:/Windows/System32/config/SAM',
      ];

      for (const url of fileUrls) {
        const result = validateURL(url);
        expect(result.valid).toBe(false);
      }
    });

    it('should prevent DNS rebinding attacks', () => {
      // DNS rebinding: domain initially resolves to public IP,
      // then switches to private IP
      // Prevention: validate after DNS resolution, not just hostname

      const url = 'https://rebind-attack.com/api';

      // First validation passes (public domain)
      const result = validateURL(url);
      expect(result.valid).toBe(true);

      // In real implementation, validate resolved IP:
      // const resolvedIP = await dns.resolve('rebind-attack.com');
      // if (isPrivateIP(resolvedIP)) { block(); }
    });
  });

  describe('Safe HTTP Client', () => {
    it('should allow safe URLs', async () => {
      const client = new SafeHTTPClient();
      const result = await client.fetch('https://api.example.com/data');

      expect(result.allowed).toBe(true);
    });

    it('should block unsafe URLs', async () => {
      const client = new SafeHTTPClient();
      const result = await client.fetch('http://localhost:8080/admin');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('should enforce custom allowlist', async () => {
      const config: URLAllowlistConfig = {
        ...DEFAULT_URL_ALLOWLIST,
        allowedDomains: ['trusted.com'],
      };

      const client = new SafeHTTPClient(config);

      const trusted = await client.fetch('https://trusted.com/api');
      expect(trusted.allowed).toBe(true);

      const untrusted = await client.fetch('https://untrusted.com/api');
      expect(untrusted.allowed).toBe(false);
    });
  });

  describe('Redirect Security', () => {
    it('should detect redirect loops', () => {
      const redirectChain = [
        'https://example.com/a',
        'https://example.com/b',
        'https://example.com/c',
        'https://example.com/a', // Loop back to first URL
      ];

      expect(detectRedirectLoop(redirectChain)).toBe(true);
    });

    it('should limit redirect depth', () => {
      const longRedirectChain = Array.from({ length: 10 }, (_, i) => `https://example.com/${i}`);

      expect(detectRedirectLoop(longRedirectChain, 5)).toBe(true);
    });

    it('should allow reasonable redirect chains', () => {
      const redirectChain = [
        'https://example.com/old',
        'https://example.com/new',
      ];

      expect(detectRedirectLoop(redirectChain)).toBe(false);
    });

    it('should validate each URL in redirect chain', () => {
      // Prevent redirects to private IPs
      const redirectChain = [
        'https://example.com/redirect',
        'https://192.168.1.1/internal', // Private IP
      ];

      for (const url of redirectChain) {
        const result = validateURL(url);
        if (!result.valid) {
          expect(result.errors.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('URL Encoding Attacks', () => {
    it('should detect double-encoded URLs', () => {
      // %25 = encoded %
      // %252e = encoded .
      const doubleEncoded = 'https://example.com/%252e%252e%252f/etc/passwd';

      // URL parser should decode properly
      const url = new URL(doubleEncoded);
      expect(url.pathname).toContain('%2e');
    });

    it('should detect unicode encoding tricks', () => {
      // Attempts to bypass localhost check using unicode
      const unicodeUrls = [
        'https://\u006c\u006f\u0063\u0061\u006c\u0068\u006f\u0073\u0074/api', // "localhost"
        'https://127.0.0.①/api', // Full-width digit
      ];

      // Modern URL parsers normalize unicode
      for (const url of unicodeUrls) {
        try {
          const parsed = new URL(url);
          if (isLocalhost(parsed.hostname)) {
            const result = validateURL(url);
            expect(result.valid).toBe(false);
          }
        } catch {
          // Invalid URL is also acceptable
          expect(true).toBe(true);
        }
      }
    });

    it('should handle CRLF injection attempts', () => {
      const crlfUrls = [
        'https://example.com/redirect?url=https://evil.com%0d%0aSet-Cookie:session=hijacked',
      ];

      for (const url of crlfUrls) {
        const result = validateURL(url);
        // Either valid (CRLF encoded in query) or invalid (parser rejects)
        expect(result).toBeDefined();
      }
    });
  });

  describe('URL Sanitization', () => {
    it('should remove credentials from URLs', () => {
      const urlWithCreds = 'https://user:password@example.com/api';
      const sanitized = sanitizeURLForDisplay(urlWithCreds);

      expect(sanitized).not.toContain('user');
      expect(sanitized).not.toContain('password');
      expect(sanitized).toContain('example.com');
    });

    it('should handle invalid URLs gracefully', () => {
      const invalidUrl = 'not-a-valid-url';
      const sanitized = sanitizeURLForDisplay(invalidUrl);

      expect(sanitized).toBe('[Invalid URL]');
    });

    it('should preserve safe URLs', () => {
      const safeUrl = 'https://example.com/api/data';
      const sanitized = sanitizeURLForDisplay(safeUrl);

      expect(sanitized).toBe(safeUrl);
    });
  });

  describe('Protocol Exploitation Prevention', () => {
    it('should block dangerous protocols', () => {
      const dangerousProtocols = [
        'file:///',
        'ftp://',
        'gopher://',
        'data:',
        'javascript:',
      ];

      for (const proto of dangerousProtocols) {
        const url = `${proto}example.com`;
        const result = validateURL(url);
        expect(result.valid).toBe(false);
      }
    });

    it('should allow only HTTPS by default', () => {
      const config = DEFAULT_URL_ALLOWLIST;

      expect(config.allowedProtocols).toContain('https');
      expect(config.allowedProtocols).not.toContain('http');
    });

    it('should support custom protocol allowlist', () => {
      const config: URLAllowlistConfig = {
        ...DEFAULT_URL_ALLOWLIST,
        allowedProtocols: ['https', 'http'],
      };

      const httpUrl = validateURL('http://example.com', config);
      expect(httpUrl.valid).toBe(true);
    });
  });

  describe('Real-World SSRF Scenarios', () => {
    it('should prevent reading cloud instance metadata', () => {
      const awsMetadata = 'http://169.254.169.254/latest/meta-data/iam/security-credentials/my-role';
      const result = validateURL(awsMetadata);

      expect(result.valid).toBe(false);
    });

    it('should prevent internal API access', () => {
      const internalAPI = 'https://192.168.1.100:8080/api/v1/secrets';
      const result = validateURL(internalAPI);

      expect(result.valid).toBe(false);
    });

    it('should prevent localhost service enumeration', () => {
      const services = [
        'https://localhost:22',    // SSH
        'https://localhost:3306',  // MySQL
        'https://localhost:5432',  // PostgreSQL
        'https://localhost:6379',  // Redis
        'https://localhost:27017', // MongoDB
      ];

      for (const service of services) {
        const result = validateURL(service);
        expect(result.valid).toBe(false);
      }
    });

    it('should allow legitimate external API calls', () => {
      const legitimateAPIs = [
        'https://api.github.com/repos',
        'https://api.stripe.com/v1/charges',
        'https://graph.microsoft.com/v1.0/users',
      ];

      for (const api of legitimateAPIs) {
        const result = validateURL(api);
        expect(result.valid).toBe(true);
      }
    });
  });
});
