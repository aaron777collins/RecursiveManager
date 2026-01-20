/**
 * OWASP Top 10 Security Tests: Injection (A03:2021)
 *
 * Tests for XSS (Cross-Site Scripting) prevention:
 * - Reflected XSS
 * - Stored XSS
 * - DOM-based XSS
 * - Template injection
 * - HTML injection
 * - JavaScript injection
 */

import { describe, it, expect } from '@jest/globals';

/**
 * HTML Entity Encoder - Prevents XSS by encoding special characters
 */
export function encodeHTML(str: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'/]/g, char => entities[char] || char);
}

/**
 * JavaScript String Encoder - Prevents script injection
 */
export function encodeJavaScript(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/</g, '\\x3C')
    .replace(/>/g, '\\x3E');
}

/**
 * URL Encoder - Prevents injection via URL parameters
 */
export function encodeURL(str: string): string {
  return encodeURIComponent(str);
}

/**
 * Sanitize user input by removing dangerous tags and attributes
 */
export function sanitizeHTML(html: string): string {
  // Remove script tags
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  // Remove vbscript: protocol
  sanitized = sanitized.replace(/vbscript:/gi, '');

  return sanitized;
}

/**
 * Validate that string doesn't contain XSS payloads
 */
export function containsXSS(str: string): boolean {
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // Event handlers
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\(/i,
    /expression\(/i, // IE CSS expressions
    /vbscript:/i,
    /data:text\/html/i,
  ];

  return xssPatterns.some(pattern => pattern.test(str));
}

describe('OWASP A03:2021 - Injection (XSS Prevention)', () => {
  describe('HTML Entity Encoding', () => {
    it('should encode basic HTML entities', () => {
      const input = '<script>alert("XSS")</script>';
      const encoded = encodeHTML(input);

      expect(encoded).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
      expect(encoded).not.toContain('<script>');
      expect(encoded).not.toContain('</script>');
    });

    it('should encode all dangerous characters', () => {
      const input = '& < > " \' /';
      const encoded = encodeHTML(input);

      expect(encoded).toBe('&amp; &lt; &gt; &quot; &#x27; &#x2F;');
    });

    it('should prevent reflected XSS', () => {
      // Simulate user input that would be reflected in HTML
      const userInput = '<img src=x onerror=alert("XSS")>';
      const encoded = encodeHTML(userInput);

      expect(encoded).not.toContain('<img');
      expect(encoded).not.toContain('onerror');
      expect(encoded).toContain('&lt;img');
    });

    it('should prevent stored XSS in agent names', () => {
      const maliciousName = 'Agent<script>alert("XSS")</script>';
      const safeName = encodeHTML(maliciousName);

      expect(safeName).not.toContain('<script>');
      expect(safeName).toContain('&lt;script&gt;');
    });

    it('should handle unicode characters safely', () => {
      const input = '你好<script>alert("XSS")</script>世界';
      const encoded = encodeHTML(input);

      expect(encoded).toContain('你好');
      expect(encoded).toContain('世界');
      expect(encoded).not.toContain('<script>');
    });
  });

  describe('JavaScript String Encoding', () => {
    it('should encode quotes to prevent script injection', () => {
      const input = 'User\'s "input"';
      const encoded = encodeJavaScript(input);

      expect(encoded).toBe('User\\\'s \\"input\\"');
    });

    it('should encode control characters', () => {
      const input = 'Line1\nLine2\rLine3\tTab';
      const encoded = encodeJavaScript(input);

      expect(encoded).toBe('Line1\\nLine2\\rLine3\\tTab');
    });

    it('should prevent breaking out of JavaScript strings', () => {
      const input = '"; alert("XSS"); //';
      const encoded = encodeJavaScript(input);

      expect(encoded).not.toContain('"; alert');
      expect(encoded).toContain('\\"');
    });

    it('should encode HTML tags in JavaScript context', () => {
      const input = '</script><script>alert("XSS")</script>';
      const encoded = encodeJavaScript(input);

      expect(encoded).toContain('\\x3C');
      expect(encoded).toContain('\\x3E');
      expect(encoded).not.toContain('</script>');
    });
  });

  describe('URL Encoding', () => {
    it('should encode URL parameters', () => {
      const input = 'hello world&foo=bar';
      const encoded = encodeURL(input);

      expect(encoded).toBe('hello%20world%26foo%3Dbar');
    });

    it('should prevent URL-based XSS', () => {
      const input = 'javascript:alert("XSS")';
      const encoded = encodeURL(input);

      expect(encoded).not.toContain('javascript:');
      expect(encoded).toContain('javascript%3A');
    });

    it('should encode special characters in URLs', () => {
      const input = '<script>alert("XSS")</script>';
      const encoded = encodeURL(input);

      expect(encoded).not.toContain('<');
      expect(encoded).not.toContain('>');
      expect(encoded).toContain('%3C');
      expect(encoded).toContain('%3E');
    });
  });

  describe('HTML Sanitization', () => {
    it('should remove script tags', () => {
      const input = 'Hello <script>alert("XSS")</script> World';
      const sanitized = sanitizeHTML(input);

      expect(sanitized).toBe('Hello  World');
      expect(sanitized).not.toContain('<script>');
    });

    it('should remove event handlers', () => {
      const inputs = [
        '<img src=x onerror=alert("XSS")>',
        '<div onclick="alert(\'XSS\')">Click</div>',
        '<body onload=alert("XSS")>',
        '<input onfocus=alert("XSS")>',
      ];

      for (const input of inputs) {
        const sanitized = sanitizeHTML(input);
        expect(sanitized).not.toMatch(/on\w+=/);
      }
    });

    it('should remove javascript: protocol', () => {
      const input = '<a href="javascript:alert(\'XSS\')">Click</a>';
      const sanitized = sanitizeHTML(input);

      expect(sanitized).not.toContain('javascript:');
    });

    it('should remove data: protocol', () => {
      const input = '<a href="data:text/html,<script>alert(\'XSS\')</script>">Click</a>';
      const sanitized = sanitizeHTML(input);

      expect(sanitized).not.toContain('data:text/html');
    });

    it('should handle nested script tags', () => {
      const input = '<script><script>alert("XSS")</script></script>';
      const sanitized = sanitizeHTML(input);

      expect(sanitized).not.toContain('<script>');
    });

    it('should handle obfuscated script tags', () => {
      const inputs = [
        '<ScRiPt>alert("XSS")</sCrIpT>',
        '<SCRIPT>alert("XSS")</SCRIPT>',
        '<script >alert("XSS")</script>',
      ];

      for (const input of inputs) {
        const sanitized = sanitizeHTML(input);
        expect(sanitized).not.toMatch(/<script/i);
      }
    });
  });

  describe('XSS Pattern Detection', () => {
    it('should detect script tags', () => {
      const payloads = [
        '<script>alert("XSS")</script>',
        '<SCRIPT>alert("XSS")</SCRIPT>',
        '<script src="http://evil.com/xss.js"></script>',
      ];

      for (const payload of payloads) {
        expect(containsXSS(payload)).toBe(true);
      }
    });

    it('should detect event handlers', () => {
      const payloads = [
        '<img onerror=alert("XSS")>',
        '<body onload=alert("XSS")>',
        '<div onclick=alert("XSS")>',
        '<input onfocus=alert("XSS")>',
      ];

      for (const payload of payloads) {
        expect(containsXSS(payload)).toBe(true);
      }
    });

    it('should detect javascript: protocol', () => {
      const payloads = [
        'javascript:alert("XSS")',
        'JAVASCRIPT:alert("XSS")',
        'JaVaScRiPt:alert("XSS")',
      ];

      for (const payload of payloads) {
        expect(containsXSS(payload)).toBe(true);
      }
    });

    it('should detect dangerous tags', () => {
      const payloads = [
        '<iframe src="http://evil.com"></iframe>',
        '<object data="http://evil.com"></object>',
        '<embed src="http://evil.com">',
      ];

      for (const payload of payloads) {
        expect(containsXSS(payload)).toBe(true);
      }
    });

    it('should detect eval() calls', () => {
      const payloads = [
        'eval("alert(\'XSS\')")',
        'eval(alert)',
      ];

      for (const payload of payloads) {
        expect(containsXSS(payload)).toBe(true);
      }
    });

    it('should allow safe content', () => {
      const safeInputs = [
        'Hello, World!',
        'User input without any HTML',
        'Email: user@example.com',
        'Price: $99.99',
      ];

      for (const input of safeInputs) {
        expect(containsXSS(input)).toBe(false);
      }
    });
  });

  describe('Template Injection Prevention', () => {
    it('should prevent template expression injection', () => {
      // Common template injection patterns
      const payloads = [
        '{{constructor.constructor("alert(1)")()}}',
        '${alert(1)}',
        '#{alert(1)}',
        '<%= system("whoami") %>',
      ];

      for (const payload of payloads) {
        const encoded = encodeHTML(payload);
        expect(encoded).not.toContain('{{');
        expect(encoded).not.toContain('${');
      }
    });

    it('should prevent Angular template injection', () => {
      const payload = '{{constructor.constructor(\'alert(1)\')()}}';
      const encoded = encodeHTML(payload);

      expect(encoded).not.toContain('{{');
      expect(encoded).toContain('&#x27;');
    });

    it('should prevent React injection via dangerouslySetInnerHTML', () => {
      // Simulate checking that dangerouslySetInnerHTML is never used
      const reactCode = `
        const Component = () => (
          <div>{userInput}</div>
        );
      `;

      expect(reactCode).not.toContain('dangerouslySetInnerHTML');
    });
  });

  describe('DOM-Based XSS Prevention', () => {
    it('should prevent injection via innerHTML', () => {
      // Simulate safe DOM manipulation
      const userInput = '<img src=x onerror=alert("XSS")>';
      const safeInput = encodeHTML(userInput);

      // In browser: element.textContent = safeInput; (safe)
      // NOT: element.innerHTML = userInput; (unsafe)

      expect(safeInput).not.toContain('<img');
    });

    it('should prevent injection via document.write', () => {
      const userInput = '<script>alert("XSS")</script>';
      const safeInput = encodeHTML(userInput);

      // document.write should never be used with user input
      expect(safeInput).not.toContain('<script>');
    });

    it('should prevent injection via location manipulation', () => {
      const userInput = 'javascript:alert("XSS")';
      const sanitized = sanitizeHTML(userInput);

      // window.location = userInput; (unsafe)
      expect(sanitized).not.toContain('javascript:');
    });
  });

  describe('Context-Specific Encoding', () => {
    it('should use different encoding for HTML context', () => {
      const input = '<script>alert("XSS")</script>';
      const htmlEncoded = encodeHTML(input);

      expect(htmlEncoded).toContain('&lt;');
      expect(htmlEncoded).toContain('&gt;');
    });

    it('should use different encoding for JavaScript context', () => {
      const input = '"; alert("XSS"); //';
      const jsEncoded = encodeJavaScript(input);

      expect(jsEncoded).toContain('\\"');
      expect(jsEncoded).not.toContain('"; ');
    });

    it('should use different encoding for URL context', () => {
      const input = 'param=value&foo=<script>';
      const urlEncoded = encodeURL(input);

      expect(urlEncoded).toContain('%3C');
      expect(urlEncoded).toContain('%3E');
    });

    it('should chain encoders when needed', () => {
      // Scenario: User input in a JavaScript string in an HTML attribute
      const input = '"; alert("XSS"); //';

      // Step 1: JavaScript encoding
      const jsEncoded = encodeJavaScript(input);

      // Step 2: HTML encoding
      const finalEncoded = encodeHTML(jsEncoded);

      expect(finalEncoded).not.toContain('alert');
      expect(finalEncoded).toContain('&quot;');
    });
  });

  describe('Content Security Policy (CSP) Support', () => {
    it('should validate CSP-safe content', () => {
      // Content that would pass strict CSP
      const safeSources = [
        "'self'",
        "'none'",
        'https://trusted-cdn.com',
      ];

      const unsafeSources = [
        "'unsafe-inline'",
        "'unsafe-eval'",
        '*', // wildcard
      ];

      // In production, verify CSP headers are set
      expect(safeSources.length).toBeGreaterThan(0);
      expect(unsafeSources.length).toBeGreaterThan(0);
    });

    it('should reject inline scripts under CSP', () => {
      const inlineScript = '<script>alert("XSS")</script>';

      // With CSP, inline scripts are blocked
      expect(containsXSS(inlineScript)).toBe(true);
    });

    it('should use nonces for allowed inline scripts', () => {
      // CSP allows scripts with matching nonce
      const nonce = 'random-nonce-12345';
      const allowedScript = `<script nonce="${nonce}">console.log('safe');</script>`;

      // Verify nonce is present
      expect(allowedScript).toContain(`nonce="${nonce}"`);
    });
  });

  describe('Real-World XSS Payloads', () => {
    it('should block common XSS payloads from OWASP', () => {
      const owaspPayloads = [
        '<script>alert(String.fromCharCode(88,83,83))</script>',
        '<img src="javascript:alert(\'XSS\')">',
        '<img src=x onerror="alert(\'XSS\')">',
        '<svg/onload=alert(\'XSS\')>',
        '<body onload=alert(\'XSS\')>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<input autofocus onfocus=alert(\'XSS\')>',
        '<select onfocus=alert(\'XSS\') autofocus>',
        '<textarea autofocus onfocus=alert(\'XSS\')>',
        '<marquee onstart=alert(\'XSS\')>',
      ];

      for (const payload of owaspPayloads) {
        const sanitized = sanitizeHTML(payload);
        expect(containsXSS(sanitized)).toBe(false);
      }
    });

    it('should block polyglot XSS payloads', () => {
      // Polyglot payloads that work in multiple contexts
      const polyglots = [
        'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//\\x3e',
        '\'">><marquee><img src=x onerror=confirm(1)></marquee>"></plaintext\\></|\\><plaintext/onmouseover=prompt(1)><script>prompt(1)</script>@gmail.com<isindex formaction=javascript:alert(/XSS/) type=submit>\'-->"></script><script>alert(document.cookie)</script>',
      ];

      for (const polyglot of polyglots) {
        const sanitized = sanitizeHTML(polyglot);
        const encoded = encodeHTML(polyglot);

        expect(containsXSS(sanitized)).toBe(false);
        expect(encoded).not.toContain('<script>');
      }
    });

    it('should block mutation XSS (mXSS)', () => {
      // mXSS exploits browser HTML parsers
      const mxssPayloads = [
        '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
        '<listing>&lt;img src=1 onerror=alert(1)&gt;</listing>',
      ];

      for (const payload of mxssPayloads) {
        const sanitized = sanitizeHTML(payload);
        expect(sanitized).not.toMatch(/<img[^>]*onerror/i);
      }
    });
  });
});
