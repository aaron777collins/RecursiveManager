import { AnalysisCache, globalAnalysisCache } from '../cache.js';

describe('AnalysisCache', () => {
  let cache: AnalysisCache;

  beforeEach(() => {
    cache = new AnalysisCache(1000); // 1 second TTL for testing
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Basic Operations', () => {
    it('should store and retrieve cached data', () => {
      const context = 'Should we add Redis caching?';
      const data = { result: 'yes', confidence: 0.85 };

      cache.set(context, data);
      const retrieved = cache.get(context);

      expect(retrieved).toEqual(data);
    });

    it('should return null for cache miss', () => {
      const result = cache.get('non-existent context');
      expect(result).toBeNull();
    });

    it('should handle different contexts independently', () => {
      cache.set('context1', { data: 'first' });
      cache.set('context2', { data: 'second' });

      expect(cache.get('context1')).toEqual({ data: 'first' });
      expect(cache.get('context2')).toEqual({ data: 'second' });
    });

    it('should overwrite existing cache entry with same context', () => {
      const context = 'same context';
      cache.set(context, { version: 1 });
      cache.set(context, { version: 2 });

      const retrieved = cache.get(context);
      expect(retrieved).toEqual({ version: 2 });
    });
  });

  describe('Context Hashing', () => {
    it('should produce same hash for identical contexts', () => {
      const context = 'Should we migrate to microservices?';
      cache.set(context, { data: 'original' });

      const retrieved = cache.get(context);
      expect(retrieved).toEqual({ data: 'original' });
    });

    it('should produce different hashes for different contexts', () => {
      cache.set('context A', { data: 'A' });
      cache.set('context B', { data: 'B' });

      expect(cache.get('context A')).toEqual({ data: 'A' });
      expect(cache.get('context B')).toEqual({ data: 'B' });
    });

    it('should be case-sensitive', () => {
      cache.set('Context', { data: 'uppercase' });
      cache.set('context', { data: 'lowercase' });

      expect(cache.get('Context')).toEqual({ data: 'uppercase' });
      expect(cache.get('context')).toEqual({ data: 'lowercase' });
    });

    it('should handle whitespace differences', () => {
      cache.set('context with spaces', { data: 'spaces' });
      cache.set('context  with  spaces', { data: 'double spaces' });

      // Different whitespace should produce different hashes
      expect(cache.get('context with spaces')).toEqual({ data: 'spaces' });
      expect(cache.get('context  with  spaces')).toEqual({ data: 'double spaces' });
    });
  });

  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new AnalysisCache(100); // 100ms TTL
      shortCache.set('test', { data: 'value' });

      // Should be available immediately
      expect(shortCache.get('test')).toEqual({ data: 'value' });

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be expired
      expect(shortCache.get('test')).toBeNull();
    });

    it('should not expire entries before TTL', async () => {
      const longCache = new AnalysisCache(5000); // 5 second TTL
      longCache.set('test', { data: 'value' });

      // Wait 1 second (well before TTL)
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should still be available
      expect(longCache.get('test')).toEqual({ data: 'value' });
    });

    it('should remove expired entry from cache on get', async () => {
      const shortCache = new AnalysisCache(50);
      shortCache.set('test', { data: 'value' });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Get should return null and remove from cache
      expect(shortCache.get('test')).toBeNull();
      expect(shortCache.size()).toBe(0);
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits', () => {
      cache.set('context', { data: 'value' });

      cache.get('context'); // hit
      cache.get('context'); // hit

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);
    });

    it('should track cache misses', () => {
      cache.get('non-existent-1'); // miss
      cache.get('non-existent-2'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate correctly', () => {
      cache.set('hit', { data: 'value' });

      cache.get('hit'); // hit
      cache.get('hit'); // hit
      cache.get('miss'); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3); // 2 hits out of 3 requests
    });

    it('should track cache size', () => {
      expect(cache.size()).toBe(0);

      cache.set('context1', { data: '1' });
      expect(cache.size()).toBe(1);

      cache.set('context2', { data: '2' });
      expect(cache.size()).toBe(2);

      cache.delete('context1');
      expect(cache.size()).toBe(1);
    });

    it('should return 0 hit rate for empty cache', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Cache Management', () => {
    it('should delete specific entry', () => {
      cache.set('context1', { data: '1' });
      cache.set('context2', { data: '2' });

      const deleted = cache.delete('context1');

      expect(deleted).toBe(true);
      expect(cache.get('context1')).toBeNull();
      expect(cache.get('context2')).toEqual({ data: '2' });
    });

    it('should return false when deleting non-existent entry', () => {
      const deleted = cache.delete('non-existent');
      expect(deleted).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('context1', { data: '1' });
      cache.set('context2', { data: '2' });
      cache.set('context3', { data: '3' });

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('context1')).toBeNull();
      expect(cache.get('context2')).toBeNull();
      expect(cache.get('context3')).toBeNull();
    });

    it('should reset statistics on clear', () => {
      cache.set('context', { data: 'value' });
      cache.get('context'); // hit
      cache.get('miss'); // miss

      cache.clear();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Cleanup (Garbage Collection)', () => {
    it('should remove expired entries during cleanup', async () => {
      const shortCache = new AnalysisCache(50);

      shortCache.set('context1', { data: '1' });
      shortCache.set('context2', { data: '2' });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const removed = shortCache.cleanup();

      expect(removed).toBe(2);
      expect(shortCache.size()).toBe(0);
    });

    it('should keep non-expired entries during cleanup', async () => {
      const longCache = new AnalysisCache(5000);

      longCache.set('context1', { data: '1' });
      longCache.set('context2', { data: '2' });

      const removed = longCache.cleanup();

      expect(removed).toBe(0);
      expect(longCache.size()).toBe(2);
    });

    it('should remove only expired entries', async () => {
      const mixedCache = new AnalysisCache(1000);

      mixedCache.set('expired', { data: 'old' });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      mixedCache.set('fresh', { data: 'new' });

      // Wait for first to expire
      await new Promise(resolve => setTimeout(resolve, 600));

      const removed = mixedCache.cleanup();

      expect(removed).toBe(1);
      expect(mixedCache.size()).toBe(1);
      expect(mixedCache.get('fresh')).toEqual({ data: 'new' });
      expect(mixedCache.get('expired')).toBeNull();
    });
  });

  describe('Configuration', () => {
    it('should use default TTL of 1 hour when not specified', () => {
      const defaultCache = new AnalysisCache();
      // We can't directly test the TTL, but we can verify the cache works
      defaultCache.set('test', { data: 'value' });
      expect(defaultCache.get('test')).toEqual({ data: 'value' });
    });

    it('should use custom TTL when provided', async () => {
      const customCache = new AnalysisCache(200); // 200ms

      customCache.set('test', { data: 'value' });
      await new Promise(resolve => setTimeout(resolve, 250));

      expect(customCache.get('test')).toBeNull();
    });

    it('should read TTL from ANALYSIS_CACHE_TTL_MS env var', () => {
      const originalEnv = process.env.ANALYSIS_CACHE_TTL_MS;

      process.env.ANALYSIS_CACHE_TTL_MS = '2000';
      const envCache = new AnalysisCache();

      // Verify cache works (can't directly test TTL without waiting)
      envCache.set('test', { data: 'value' });
      expect(envCache.get('test')).toEqual({ data: 'value' });

      // Restore env
      if (originalEnv !== undefined) {
        process.env.ANALYSIS_CACHE_TTL_MS = originalEnv;
      } else {
        delete process.env.ANALYSIS_CACHE_TTL_MS;
      }
    });
  });

  describe('Global Singleton Cache', () => {
    it('should provide a global cache instance', () => {
      expect(globalAnalysisCache).toBeDefined();
      expect(globalAnalysisCache).toBeInstanceOf(AnalysisCache);
    });

    it('should share state across references', () => {
      globalAnalysisCache.clear();
      globalAnalysisCache.set('shared', { data: 'global' });

      // Access through the same global instance
      expect(globalAnalysisCache.get('shared')).toEqual({ data: 'global' });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string context', () => {
      cache.set('', { data: 'empty' });
      expect(cache.get('')).toEqual({ data: 'empty' });
    });

    it('should handle very long contexts', () => {
      const longContext = 'a'.repeat(10000);
      cache.set(longContext, { data: 'long' });
      expect(cache.get(longContext)).toEqual({ data: 'long' });
    });

    it('should handle special characters in context', () => {
      const specialContext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      cache.set(specialContext, { data: 'special' });
      expect(cache.get(specialContext)).toEqual({ data: 'special' });
    });

    it('should handle unicode characters', () => {
      const unicodeContext = '你好世界 🚀 merhaba dünya';
      cache.set(unicodeContext, { data: 'unicode' });
      expect(cache.get(unicodeContext)).toEqual({ data: 'unicode' });
    });

    it('should handle null and undefined data', () => {
      cache.set('null-data', null);
      cache.set('undefined-data', undefined);

      expect(cache.get('null-data')).toBeNull();
      expect(cache.get('undefined-data')).toBeUndefined();
    });

    it('should handle complex nested objects', () => {
      const complexData = {
        perspectives: [
          { name: 'Security', confidence: 0.85, analysis: 'Good security' },
          { name: 'Architecture', confidence: 0.92, analysis: 'Solid design' }
        ],
        metadata: {
          timestamp: new Date().toISOString(),
          executionTime: 1234,
          cached: false
        }
      };

      cache.set('complex', complexData);
      const retrieved = cache.get('complex');

      expect(retrieved).toEqual(complexData);
      expect(retrieved.perspectives).toHaveLength(2);
      expect(retrieved.metadata.executionTime).toBe(1234);
    });
  });
});
