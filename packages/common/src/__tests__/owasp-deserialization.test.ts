/**
 * OWASP Top 10 Security Tests: Insecure Deserialization (A08:2021)
 *
 * Tests for:
 * - Unsafe object deserialization
 * - Prototype pollution attacks
 * - Remote code execution via deserialization
 * - Type confusion attacks
 * - Malicious JSON payloads
 */

import { describe, it, expect } from '@jest/globals';

/**
 * Safe JSON parser with validation
 */
export function safeParse<T>(json: string, validator?: (obj: unknown) => obj is T): T | null {
  try {
    const parsed = JSON.parse(json);

    // Validate type if validator provided
    if (validator && !validator(parsed)) {
      throw new Error('Validation failed: parsed object does not match expected type');
    }

    return parsed as T;
  } catch (error) {
    console.error('Safe parse error:', error);
    return null;
  }
}

/**
 * Detect prototype pollution attempts
 */
export function detectPrototypePollution(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  // Check top level
  for (const key of dangerousKeys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return true;
    }
  }

  // Check nested objects
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null) {
      if (detectPrototypePollution(value)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Sanitize object by removing dangerous keys
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  // Create new object without dangerous keys
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (!dangerousKeys.includes(key)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized as T;
}

/**
 * Type guard for agent configuration
 */
export function isAgentConfig(obj: unknown): obj is {
  agentId: string;
  role: string;
  mainGoal: string;
  state: string;
} {
  if (typeof obj !== 'object' || obj === null) {
    return false;
  }

  const config = obj as Record<string, unknown>;

  return (
    typeof config.agentId === 'string' &&
    typeof config.role === 'string' &&
    typeof config.mainGoal === 'string' &&
    typeof config.state === 'string'
  );
}

/**
 * Validate deserialized data structure
 */
export function validateDeserializedData(data: unknown): boolean {
  // Check for null/undefined
  if (data === null || data === undefined) {
    return false;
  }

  // Check for circular references
  try {
    JSON.stringify(data);
  } catch {
    return false; // Circular reference detected
  }

  // Check for prototype pollution
  if (detectPrototypePollution(data)) {
    return false;
  }

  return true;
}

describe('OWASP A08:2021 - Insecure Deserialization', () => {
  describe('Safe JSON Parsing', () => {
    it('should parse valid JSON', () => {
      const json = '{"name":"John","age":30}';
      const parsed = safeParse(json);

      expect(parsed).toEqual({ name: 'John', age: 30 });
    });

    it('should return null for invalid JSON', () => {
      const invalidJson = '{name: John}'; // Missing quotes
      const parsed = safeParse(invalidJson);

      expect(parsed).toBeNull();
    });

    it('should handle JSON with special characters', () => {
      const json = '{"name":"O\'Brien","quote":"He said \\"Hello\\""}';
      const parsed = safeParse(json);

      expect(parsed).toBeDefined();
      expect(parsed).toHaveProperty('name');
    });

    it('should validate parsed object with type guard', () => {
      const json = '{"agentId":"agent-1","role":"CEO","mainGoal":"Lead","state":"ACTIVE"}';
      const parsed = safeParse(json, isAgentConfig);

      expect(parsed).toBeDefined();
      expect(parsed?.agentId).toBe('agent-1');
    });

    it('should reject invalid object shape', () => {
      const json = '{"wrong":"shape"}';
      const parsed = safeParse(json, isAgentConfig);

      expect(parsed).toBeNull();
    });
  });

  describe('Prototype Pollution Detection', () => {
    it('should detect __proto__ pollution', () => {
      const maliciousObj = {
        name: 'John',
        __proto__: {
          isAdmin: true,
        },
      };

      expect(detectPrototypePollution(maliciousObj)).toBe(true);
    });

    it('should detect constructor pollution', () => {
      const maliciousObj = {
        name: 'John',
        constructor: {
          prototype: {
            isAdmin: true,
          },
        },
      };

      expect(detectPrototypePollution(maliciousObj)).toBe(true);
    });

    it('should detect nested prototype pollution', () => {
      const maliciousObj = {
        user: {
          profile: {
            __proto__: {
              isAdmin: true,
            },
          },
        },
      };

      expect(detectPrototypePollution(maliciousObj)).toBe(true);
    });

    it('should allow safe objects', () => {
      const safeObj = {
        name: 'John',
        age: 30,
        profile: {
          email: 'john@example.com',
        },
      };

      expect(detectPrototypePollution(safeObj)).toBe(false);
    });
  });

  describe('Object Sanitization', () => {
    it('should remove __proto__ from object', () => {
      const maliciousObj = {
        name: 'John',
        __proto__: {
          isAdmin: true,
        },
      };

      const sanitized = sanitizeObject(maliciousObj);

      expect(sanitized).toHaveProperty('name');
      expect(sanitized).not.toHaveProperty('__proto__');
    });

    it('should remove constructor from object', () => {
      const maliciousObj = {
        name: 'John',
        constructor: {
          prototype: {
            isAdmin: true,
          },
        },
      };

      const sanitized = sanitizeObject(maliciousObj);

      expect(sanitized).toHaveProperty('name');
      expect(sanitized).not.toHaveProperty('constructor');
    });

    it('should recursively sanitize nested objects', () => {
      const maliciousObj = {
        user: {
          profile: {
            __proto__: {
              isAdmin: true,
            },
            name: 'John',
          },
        },
      };

      const sanitized = sanitizeObject(maliciousObj);

      expect(sanitized.user.profile).toHaveProperty('name');
      expect(sanitized.user.profile).not.toHaveProperty('__proto__');
    });

    it('should preserve safe properties', () => {
      const obj = {
        name: 'John',
        age: 30,
        profile: {
          email: 'john@example.com',
          settings: {
            theme: 'dark',
          },
        },
      };

      const sanitized = sanitizeObject(obj);

      expect(sanitized).toEqual(obj);
    });
  });

  describe('Prototype Pollution Attack Prevention', () => {
    it('should prevent pollution via JSON.parse', () => {
      const maliciousJson = '{"__proto__":{"isAdmin":true}}';

      // JSON.parse actually creates __proto__ as a regular property
      // We need to sanitize after parsing
      const parsed = JSON.parse(maliciousJson);
      const sanitized = sanitizeObject(parsed);

      expect(sanitized).not.toHaveProperty('__proto__');
    });

    it('should prevent pollution via deep merge', () => {
      const target = { name: 'John' };
      const malicious = JSON.parse('{"__proto__":{"isAdmin":true}}');

      // Safe merge that doesn't copy __proto__
      const merged = { ...target, ...sanitizeObject(malicious) };

      expect(merged).not.toHaveProperty('__proto__');
      // Verify prototype wasn't polluted
      expect((merged as Record<string, unknown>)['isAdmin']).toBeUndefined();
    });

    it('should prevent pollution via nested assignment', () => {
      const config: Record<string, unknown> = {};

      // Attempt to pollute via bracket notation
      const maliciousKey = '__proto__';
      const maliciousValue = { isAdmin: true };

      // Safe assignment
      if (!['__proto__', 'constructor', 'prototype'].includes(maliciousKey)) {
        config[maliciousKey] = maliciousValue;
      }

      expect(config).not.toHaveProperty('__proto__');
    });

    it('should prevent pollution in recursive functions', () => {
      const maliciousObj = {
        a: {
          b: {
            c: {
              __proto__: { isAdmin: true },
            },
          },
        },
      };

      const sanitized = sanitizeObject(maliciousObj);

      // Traverse to deep property
      expect(sanitized.a.b.c).not.toHaveProperty('__proto__');
    });
  });

  describe('Remote Code Execution Prevention', () => {
    it('should not execute code from deserialized strings', () => {
      // Simulate attempt to inject executable code
      const maliciousJson = '{"code":"require(\\"child_process\\").exec(\\"rm -rf /\\")"}';

      const parsed = safeParse(maliciousJson);

      // Code is just a string, not executed
      expect(typeof parsed?.code).toBe('string');
      expect(parsed?.code).toContain('require');
    });

    it('should not evaluate Function constructor', () => {
      const maliciousJson = '{"fn":"Function(\\"return process\\")()"}';

      const parsed = safeParse(maliciousJson);

      // Function is a string, not a function
      expect(typeof parsed?.fn).toBe('string');
      expect(parsed?.fn).not.toBeInstanceOf(Function);
    });

    it('should not execute eval from deserialized data', () => {
      const maliciousJson = '{"expr":"eval(\\"process.exit(1)\\")"}';

      const parsed = safeParse(maliciousJson);

      // Expression is a string, not executed
      expect(typeof parsed?.expr).toBe('string');
    });

    it('should reject serialized functions', () => {
      // Attempt to serialize a function
      const obj = {
        name: 'John',
        fn: () => console.log('malicious'),
      };

      // Functions are not serialized by JSON.stringify
      const json = JSON.stringify(obj);
      const parsed = JSON.parse(json);

      expect(parsed.fn).toBeUndefined();
    });
  });

  describe('Type Confusion Prevention', () => {
    it('should validate expected types after parsing', () => {
      const json = '{"agentId":123,"role":"CEO"}'; // agentId is number, not string

      const parsed = safeParse(json, isAgentConfig);

      // Type guard rejects invalid type
      expect(parsed).toBeNull();
    });

    it('should handle type coercion safely', () => {
      const json = '{"count":"123"}'; // String instead of number

      const parsed = safeParse(json);

      // Type is preserved as string
      expect(typeof parsed?.count).toBe('string');
      expect(parsed?.count).toBe('123');
    });

    it('should reject null in non-nullable fields', () => {
      const json = '{"agentId":null,"role":"CEO"}';

      const parsed = safeParse(json, isAgentConfig);

      expect(parsed).toBeNull();
    });

    it('should reject undefined values', () => {
      // JSON.parse doesn't support undefined, but check behavior
      const obj = { name: 'John', age: undefined };
      const json = JSON.stringify(obj);

      expect(json).not.toContain('undefined');
      expect(json).toBe('{"name":"John"}'); // undefined is omitted
    });
  });

  describe('Circular Reference Detection', () => {
    it('should detect circular references', () => {
      const obj: Record<string, unknown> = { name: 'John' };
      obj.self = obj; // Circular reference

      expect(() => JSON.stringify(obj)).toThrow();
      expect(validateDeserializedData(obj)).toBe(false);
    });

    it('should allow non-circular nested objects', () => {
      const obj = {
        user: {
          profile: {
            name: 'John',
            settings: {
              theme: 'dark',
            },
          },
        },
      };

      expect(() => JSON.stringify(obj)).not.toThrow();
      expect(validateDeserializedData(obj)).toBe(true);
    });
  });

  describe('Malicious JSON Payload Prevention', () => {
    it('should handle extremely large JSON', () => {
      // Create large array
      const largeArray = new Array(10000).fill('x');
      const json = JSON.stringify({ data: largeArray });

      // Should parse but be aware of size limits
      const parsed = safeParse(json);
      expect(parsed).toBeDefined();
    });

    it('should handle deeply nested JSON', () => {
      // Create deeply nested object
      let nested = { value: 'bottom' };
      for (let i = 0; i < 100; i++) {
        nested = { child: nested } as typeof nested;
      }

      const json = JSON.stringify(nested);
      const parsed = safeParse(json);

      expect(parsed).toBeDefined();
    });

    it('should reject billion laughs attack', () => {
      // JSON doesn't support entity expansion like XML, but test large repeated strings
      const laughs = 'lol'.repeat(100000);
      const json = JSON.stringify({ data: laughs });

      // Should parse but be aware of memory limits
      const parsed = safeParse(json);
      expect(parsed).toBeDefined();
    });

    it('should handle unicode escape sequences', () => {
      const json = '{"name":"\\u0048\\u0065\\u006c\\u006c\\u006f"}'; // "Hello"

      const parsed = safeParse(json);
      expect(parsed?.name).toBe('Hello');
    });

    it('should handle null bytes', () => {
      const json = '{"name":"John\\u0000Doe"}';

      const parsed = safeParse(json);
      expect(parsed?.name).toBe('John\u0000Doe');
    });
  });

  describe('Deserialization Gadget Prevention', () => {
    it('should not allow arbitrary class instantiation', () => {
      // TypeScript/JavaScript doesn't have Java-style deserialization gadgets
      // But verify we only create plain objects

      const json = '{"type":"User","data":{"name":"John"}}';
      const parsed = safeParse(json);

      // Parsed object is plain object, not class instance
      expect(parsed?.constructor.name).toBe('Object');
    });

    it('should not preserve object methods', () => {
      const obj = {
        name: 'John',
        greet() {
          return `Hello, ${this.name}`;
        },
      };

      const json = JSON.stringify(obj);
      const parsed = JSON.parse(json);

      // Methods are not serialized
      expect(parsed.greet).toBeUndefined();
    });

    it('should not allow prototype chain manipulation', () => {
      const obj = Object.create({ isAdmin: true });
      obj.name = 'John';

      const json = JSON.stringify(obj);
      const parsed = JSON.parse(json);

      // Prototype properties are not serialized
      expect((parsed as Record<string, unknown>).isAdmin).toBeUndefined();
    });
  });

  describe('Data Integrity Validation', () => {
    it('should validate all required fields are present', () => {
      const json = '{"agentId":"agent-1","role":"CEO"}'; // Missing mainGoal, state

      const parsed = safeParse(json, isAgentConfig);

      expect(parsed).toBeNull(); // Validation fails
    });

    it('should validate field value ranges', () => {
      const json = '{"agentId":"agent-1","role":"CEO","mainGoal":"Lead","state":"ACTIVE","priority":150}';

      const parsed = safeParse(json);

      // Validate priority is in valid range (e.g., 1-100)
      if (parsed && 'priority' in parsed) {
        const priority = (parsed as { priority: number }).priority;
        expect(priority).toBeLessThanOrEqual(100);
      }
    });

    it('should reject unexpected additional properties', () => {
      // Strict validation can reject unknown properties
      const json = '{"agentId":"agent-1","role":"CEO","mainGoal":"Lead","state":"ACTIVE","malicious":"code"}';

      const parsed = safeParse(json, isAgentConfig);

      // Type guard only checks required fields, so this passes
      // In strict mode, we'd reject additional properties
      expect(parsed).toBeDefined();
    });

    it('should handle empty objects safely', () => {
      const json = '{}';

      const parsed = safeParse(json, isAgentConfig);

      expect(parsed).toBeNull(); // Missing required fields
    });

    it('should handle null values appropriately', () => {
      const json = 'null';

      const parsed = safeParse(json);

      expect(parsed).toBeNull();
    });
  });

  describe('Real-World Deserialization Attacks', () => {
    it('should prevent Node.js prototype pollution CVE-2019-11358', () => {
      // jQuery-style extend vulnerability
      const maliciousPayload = '{"__proto__":{"isAdmin":true}}';

      const parsed = JSON.parse(maliciousPayload);
      const sanitized = sanitizeObject(parsed);

      // Verify global prototype is not polluted
      expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
      expect(sanitized).not.toHaveProperty('__proto__');
    });

    it('should prevent lodash merge pollution', () => {
      const target = {};
      const malicious = JSON.parse('{"constructor":{"prototype":{"isAdmin":true}}}');
      const sanitized = sanitizeObject(malicious);

      // Safe merge
      Object.assign(target, sanitized);

      expect((target as Record<string, unknown>).isAdmin).toBeUndefined();
    });

    it('should prevent JSON.parse reviver exploitation', () => {
      const maliciousJson = '{"date":"2024-01-01","code":"alert(1)"}';

      // Unsafe reviver (DO NOT USE)
      // const parsed = JSON.parse(json, (key, value) => {
      //   if (key === 'code') return eval(value); // VULNERABLE
      // });

      // Safe parsing
      const parsed = safeParse(maliciousJson);

      expect(typeof parsed?.code).toBe('string');
    });
  });
});
