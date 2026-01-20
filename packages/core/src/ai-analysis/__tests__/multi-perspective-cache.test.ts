import { MultiPerspectiveAnalysis } from '../multi-perspective.js';
import { AnalysisCache } from '../cache.js';
import { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from '../providers/base.js';

/**
 * Mock AI Provider for testing
 */
class MockAIProvider implements AIProvider {
  name = 'mock';
  private callCount = 0;

  async submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    this.callCount++;

    return {
      content: `Mock analysis for ${request.agentType}\n\nConfidence: 0.85`,
      confidence: 0.85,
      reasoning: 'Mock reasoning',
      metadata: {
        model: 'mock-model',
        usage: { inputTokens: 100, outputTokens: 200 },
        provider: 'mock'
      }
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }
}

describe('MultiPerspectiveAnalysis - Cache Integration', () => {
  let provider: MockAIProvider;
  let cache: AnalysisCache;
  let analysis: MultiPerspectiveAnalysis;

  beforeEach(() => {
    provider = new MockAIProvider();
    cache = new AnalysisCache(60000); // 1 minute TTL
    analysis = new MultiPerspectiveAnalysis(provider, cache);
  });

  afterEach(() => {
    cache.clear();
  });

  describe('Cache Behavior', () => {
    it('should cache analysis results', async () => {
      const context = 'Should we add Redis caching?';

      const result1 = await analysis.analyze(context);
      const result2 = await analysis.analyze(context);

      // Second call should return cached result
      expect(result2).toBe(result1);
      expect(result2.perspectives).toEqual(result1.perspectives);
      expect(result2.summary).toEqual(result1.summary);
    });

    it('should reduce API calls on cache hit', async () => {
      const context = 'Should we migrate to microservices?';

      provider.resetCallCount();

      // First call - cache miss (8 agents × 1 call each = 8 calls)
      await analysis.analyze(context);
      const firstCallCount = provider.getCallCount();
      expect(firstCallCount).toBe(8);

      // Second call - cache hit (0 calls)
      await analysis.analyze(context);
      const secondCallCount = provider.getCallCount();
      expect(secondCallCount).toBe(8); // No new calls
    });

    it('should handle different contexts independently', async () => {
      const context1 = 'Should we add Redis caching?';
      const context2 = 'Should we migrate to microservices?';

      const result1 = await analysis.analyze(context1);
      const result2 = await analysis.analyze(context2);

      // Results should be different
      expect(result1).not.toBe(result2);

      // But cached results should match
      const cached1 = await analysis.analyze(context1);
      const cached2 = await analysis.analyze(context2);

      expect(cached1).toBe(result1);
      expect(cached2).toBe(result2);
    });

    it('should re-analyze after cache expiration', async () => {
      const shortCache = new AnalysisCache(100); // 100ms TTL
      const shortAnalysis = new MultiPerspectiveAnalysis(provider, shortCache);
      const context = 'Should we add Redis?';

      provider.resetCallCount();

      // First call
      const result1 = await shortAnalysis.analyze(context);
      expect(provider.getCallCount()).toBe(8);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second call after expiration - should re-analyze
      provider.resetCallCount();
      const result2 = await shortAnalysis.analyze(context);
      expect(provider.getCallCount()).toBe(8); // New analysis

      // Results should have different timestamps
      expect(result1.timestamp).not.toBe(result2.timestamp);
    });
  });

  describe('Cache Statistics', () => {
    it('should track cache hits and misses', async () => {
      const context1 = 'context 1';
      const context2 = 'context 2';

      await analysis.analyze(context1); // miss
      await analysis.analyze(context1); // hit
      await analysis.analyze(context2); // miss
      await analysis.analyze(context1); // hit

      const stats = analysis.getCacheStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(0.5);
    });

    it('should report cache size', async () => {
      await analysis.analyze('context 1');
      await analysis.analyze('context 2');
      await analysis.analyze('context 3');

      const stats = analysis.getCacheStats();
      expect(stats.size).toBe(3);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      const context = 'Should we add Redis?';

      await analysis.analyze(context);
      analysis.clearCache();

      const stats = analysis.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should cleanup expired entries', async () => {
      const shortCache = new AnalysisCache(50);
      const shortAnalysis = new MultiPerspectiveAnalysis(provider, shortCache);

      await shortAnalysis.analyze('context 1');
      await shortAnalysis.analyze('context 2');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      const removed = shortAnalysis.cleanupCache();
      expect(removed).toBe(2);
    });

    it('should re-analyze after manual cache clear', async () => {
      const context = 'Should we add Redis?';

      provider.resetCallCount();

      await analysis.analyze(context);
      expect(provider.getCallCount()).toBe(8);

      analysis.clearCache();

      provider.resetCallCount();
      await analysis.analyze(context);
      expect(provider.getCallCount()).toBe(8); // New analysis
    });
  });

  describe('Result Structure with Caching', () => {
    it('should preserve all result fields in cached response', async () => {
      const context = 'Should we add Redis?';

      const result1 = await analysis.analyze(context);
      const result2 = await analysis.analyze(context);

      // Verify structure
      expect(result2).toHaveProperty('perspectives');
      expect(result2).toHaveProperty('summary');
      expect(result2).toHaveProperty('overallConfidence');
      expect(result2).toHaveProperty('executionTime');
      expect(result2).toHaveProperty('timestamp');

      // All fields should match
      expect(result2.perspectives).toEqual(result1.perspectives);
      expect(result2.summary).toBe(result1.summary);
      expect(result2.overallConfidence).toBe(result1.overallConfidence);
      expect(result2.executionTime).toBe(result1.executionTime);
      expect(result2.timestamp).toBe(result1.timestamp);
    });

    it('should preserve all 8 perspectives in cached result', async () => {
      const context = 'Should we add Redis?';

      await analysis.analyze(context);
      const cached = await analysis.analyze(context);

      expect(cached.perspectives).toHaveLength(8);
      expect(cached.perspectives[0]).toHaveProperty('perspective');
      expect(cached.perspectives[0]).toHaveProperty('analysis');
      expect(cached.perspectives[0]).toHaveProperty('confidence');
    });
  });

  describe('Performance Benefits', () => {
    it('should be faster on cache hit', async () => {
      const context = 'Should we add Redis?';

      // First call - full analysis
      const start1 = Date.now();
      await analysis.analyze(context);
      const duration1 = Date.now() - start1;

      // Second call - cache hit
      const start2 = Date.now();
      await analysis.analyze(context);
      const duration2 = Date.now() - start2;

      // Cache hit should be very fast (< 10ms)
      // Note: duration2 might be 0 in fast tests, which is fine
      expect(duration2).toBeLessThanOrEqual(duration1);
      expect(duration2).toBeLessThan(10); // Cache hit should be very fast
    });

    it('should handle multiple rapid requests efficiently', async () => {
      const context = 'Should we add Redis?';

      // First request
      await analysis.analyze(context);

      // Fire 10 rapid requests
      const start = Date.now();
      const promises = Array(10).fill(0).map(() => analysis.analyze(context));
      await Promise.all(promises);
      const duration = Date.now() - start;

      // All 10 cache hits should complete very quickly
      expect(duration).toBeLessThan(100); // Should be near-instantaneous
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context', async () => {
      const result1 = await analysis.analyze('');
      const result2 = await analysis.analyze('');

      expect(result2).toBe(result1); // Should be cached
    });

    it('should handle very long contexts', async () => {
      const longContext = 'a'.repeat(10000);

      const result1 = await analysis.analyze(longContext);
      const result2 = await analysis.analyze(longContext);

      expect(result2).toBe(result1); // Should be cached
    });

    it('should handle special characters in context', async () => {
      const specialContext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';

      const result1 = await analysis.analyze(specialContext);
      const result2 = await analysis.analyze(specialContext);

      expect(result2).toBe(result1); // Should be cached
    });

    it('should be case-sensitive', async () => {
      const result1 = await analysis.analyze('Should we add Redis?');
      const result2 = await analysis.analyze('should we add redis?');

      // Different casing should produce different results
      expect(result1).not.toBe(result2);
    });
  });
});
