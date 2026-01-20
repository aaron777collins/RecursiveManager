import { MultiPerspectiveAnalysis } from '../multi-perspective.js';
import { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from '../providers/base.js';
import { AnalysisCache } from '../cache.js';

/**
 * Mock AI Provider for testing
 */
class MockAIProvider implements AIProvider {
  name = 'mock';
  private callCount = 0;
  private responses: Map<string, AIAnalysisResponse> = new Map();

  async submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    this.callCount++;

    // Check if we have a pre-configured response for this agent
    const customResponse = this.responses.get(request.agentType);
    if (customResponse) {
      return customResponse;
    }

    // Default response
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

  // Helper methods for testing
  setResponse(agentType: string, response: AIAnalysisResponse): void {
    this.responses.set(agentType, response);
  }

  getCallCount(): number {
    return this.callCount;
  }

  resetCallCount(): void {
    this.callCount = 0;
  }

  clearResponses(): void {
    this.responses.clear();
  }
}

describe('MultiPerspectiveAnalysis', () => {
  let provider: MockAIProvider;
  let cache: AnalysisCache;

  beforeEach(() => {
    provider = new MockAIProvider();
    cache = new AnalysisCache(60000); // 1 minute TTL
  });

  afterEach(() => {
    cache.clear();
    provider.clearResponses();
  });

  describe('Constructor', () => {
    it('should initialize with 8 agents', () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache);

      const agentNames = analysis.getAgentNames();
      expect(agentNames).toHaveLength(8);
      expect(agentNames).toContain('security');
      expect(agentNames).toContain('architecture');
      expect(agentNames).toContain('simplicity');
      expect(agentNames).toContain('financial');
      expect(agentNames).toContain('marketing');
      expect(agentNames).toContain('ux');
      expect(agentNames).toContain('growth');
      expect(agentNames).toContain('emotional');
    });

    it('should initialize with correct perspective names', () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache);

      const perspectives = analysis.getPerspectiveNames();
      expect(perspectives).toHaveLength(8);
      expect(perspectives).toContain('Security');
      expect(perspectives).toContain('Architecture');
      expect(perspectives).toContain('Simplicity');
      expect(perspectives).toContain('Financial');
      expect(perspectives).toContain('Marketing');
      expect(perspectives).toContain('User Experience');
      expect(perspectives).toContain('Growth');
      expect(perspectives).toContain('Emotional Intelligence');
    });

    it('should accept optional cache instance', () => {
      const customCache = new AnalysisCache(30000);
      const analysis = new MultiPerspectiveAnalysis(provider, customCache);

      // Should use custom cache
      const stats = analysis.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should accept agentId parameter', () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent-123');

      // Agent ID is used internally for history - no direct getter, but constructor should accept it
      expect(analysis).toBeDefined();
    });

    it('should accept persistHistory flag', () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      // Persistence flag is used internally - no direct getter, but constructor should accept it
      expect(analysis).toBeDefined();
    });
  });

  describe('analyze() - Core Functionality', () => {
    it('should return MultiPerspectiveResult with correct structure', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we add Redis caching?';

      const result = await analysis.analyze(context);

      // Check result structure
      expect(result).toBeDefined();
      expect(result.perspectives).toHaveLength(8);
      expect(result.summary).toBeDefined();
      expect(typeof result.summary).toBe('string');
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp format
    });

    it('should execute all 8 agents in parallel', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we migrate to microservices?';

      provider.resetCallCount();

      await analysis.analyze(context);

      // Should call provider exactly 8 times (once per agent)
      expect(provider.getCallCount()).toBe(8);
    });

    it('should include all 8 perspectives in result', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we add dark mode?';

      const result = await analysis.analyze(context);

      const perspectiveNames = result.perspectives.map(p => p.perspective);
      expect(perspectiveNames).toContain('Security');
      expect(perspectiveNames).toContain('Architecture');
      expect(perspectiveNames).toContain('Simplicity');
      expect(perspectiveNames).toContain('Financial');
      expect(perspectiveNames).toContain('Marketing');
      expect(perspectiveNames).toContain('User Experience');
      expect(perspectiveNames).toContain('Growth');
      expect(perspectiveNames).toContain('Emotional Intelligence');
    });

    it('should measure execution time accurately', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we refactor the codebase?';

      const startTime = Date.now();
      const result = await analysis.analyze(context);
      const endTime = Date.now();

      const actualTime = endTime - startTime;

      // Execution time should be reasonable (within 50ms of actual time)
      // May be 0 in fast test environments with mock providers
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.executionTime).toBeLessThanOrEqual(actualTime + 50);
    });

    it('should set timestamp to current time', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we add GraphQL?';

      const beforeTime = new Date().toISOString();
      const result = await analysis.analyze(context);
      const afterTime = new Date().toISOString();

      // Timestamp should be between before and after
      expect(result.timestamp >= beforeTime).toBe(true);
      expect(result.timestamp <= afterTime).toBe(true);
    });
  });

  describe('synthesize() - Summary Generation', () => {
    it('should generate summary with all 8 perspectives', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we implement A/B testing?';

      const result = await analysis.analyze(context);

      // Summary should contain all perspective names
      expect(result.summary).toContain('Security');
      expect(result.summary).toContain('Architecture');
      expect(result.summary).toContain('Simplicity');
      expect(result.summary).toContain('Financial');
      expect(result.summary).toContain('Marketing');
      expect(result.summary).toContain('User Experience');
      expect(result.summary).toContain('Growth');
      expect(result.summary).toContain('Emotional Intelligence');
    });

    it('should format perspectives with confidence scores', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we add analytics?';

      const result = await analysis.analyze(context);

      // Summary should contain confidence scores
      expect(result.summary).toMatch(/Confidence:\s*0\.\d{2}/);

      // Should have markdown bold formatting for perspective names
      expect(result.summary).toContain('**Security**');
      expect(result.summary).toContain('**Architecture**');
    });

    it('should separate perspectives with horizontal rules', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we add monitoring?';

      const result = await analysis.analyze(context);

      // Summary should contain markdown horizontal rules
      const separatorCount = (result.summary.match(/---/g) || []).length;
      expect(separatorCount).toBe(7); // 8 sections = 7 separators
    });
  });

  describe('calculateOverallConfidence() - Variance-Based Scoring', () => {
    it('should calculate average confidence when all agents agree', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      // Set all agents to return same confidence
      const agentTypes = ['security', 'architecture', 'simplicity', 'financial',
                          'marketing', 'ux', 'growth', 'emotional'];
      agentTypes.forEach(type => {
        provider.setResponse(type, {
          content: `Analysis\n\nConfidence: 0.90`,
          confidence: 0.90,
          reasoning: 'Reasoning',
          metadata: { model: 'mock', provider: 'mock' }
        });
      });

      const result = await analysis.analyze('Test context');

      // With no variance, overall confidence should be close to 0.90
      // (exactly 0.90 since stdDev = 0)
      expect(result.overallConfidence).toBeCloseTo(0.90, 2);
    });

    it('should reduce confidence when agents disagree (high variance)', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      // Set agents to have widely varying confidence scores
      const confidences = [0.9, 0.9, 0.3, 0.3, 0.9, 0.3, 0.9, 0.3];
      const agentTypes = ['security', 'architecture', 'simplicity', 'financial',
                          'marketing', 'ux', 'growth', 'emotional'];

      agentTypes.forEach((type, idx) => {
        provider.setResponse(type, {
          content: `Analysis\n\nConfidence: ${confidences[idx]}`,
          confidence: confidences[idx]!,
          reasoning: 'Reasoning',
          metadata: { model: 'mock', provider: 'mock' }
        });
      });

      const result = await analysis.analyze('Test context');

      // Average confidence = 0.6, but high variance should reduce it significantly
      // stdDev ≈ 0.3, so adjustment = 0.3 * 0.5 = 0.15
      // Expected: 0.6 - 0.15 = 0.45
      expect(result.overallConfidence).toBeLessThan(0.6);
      expect(result.overallConfidence).toBeGreaterThan(0.3);
    });

    it('should handle low confidence scenarios', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      // Set all agents to low confidence
      const agentTypes = ['security', 'architecture', 'simplicity', 'financial',
                          'marketing', 'ux', 'growth', 'emotional'];
      agentTypes.forEach(type => {
        provider.setResponse(type, {
          content: `Analysis\n\nConfidence: 0.30`,
          confidence: 0.30,
          reasoning: 'Reasoning',
          metadata: { model: 'mock', provider: 'mock' }
        });
      });

      const result = await analysis.analyze('Test context');

      // Should return low confidence
      expect(result.overallConfidence).toBeCloseTo(0.30, 2);
    });

    it('should ensure confidence stays within [0, 1] range', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      // Set agents to extreme values that might cause overflow
      const confidences = [1.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0];
      const agentTypes = ['security', 'architecture', 'simplicity', 'financial',
                          'marketing', 'ux', 'growth', 'emotional'];

      agentTypes.forEach((type, idx) => {
        provider.setResponse(type, {
          content: `Analysis\n\nConfidence: ${confidences[idx]}`,
          confidence: confidences[idx]!,
          reasoning: 'Reasoning',
          metadata: { model: 'mock', provider: 'mock' }
        });
      });

      const result = await analysis.analyze('Test context');

      // Confidence should never go below 0 or above 1
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it('should handle moderate disagreement appropriately', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      // Set agents to moderately varying confidence (realistic scenario)
      const confidences = [0.85, 0.80, 0.75, 0.82, 0.88, 0.78, 0.84, 0.81];
      const agentTypes = ['security', 'architecture', 'simplicity', 'financial',
                          'marketing', 'ux', 'growth', 'emotional'];

      agentTypes.forEach((type, idx) => {
        provider.setResponse(type, {
          content: `Analysis\n\nConfidence: ${confidences[idx]}`,
          confidence: confidences[idx]!,
          reasoning: 'Reasoning',
          metadata: { model: 'mock', provider: 'mock' }
        });
      });

      const result = await analysis.analyze('Test context');

      // Average ≈ 0.816, small variance should reduce it slightly
      expect(result.overallConfidence).toBeLessThan(0.82);
      expect(result.overallConfidence).toBeGreaterThan(0.75);
    });
  });

  describe('Cache Integration', () => {
    it('should cache results after first analysis', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we add caching?';

      const result1 = await analysis.analyze(context);
      const result2 = await analysis.analyze(context);

      // Second call should return exact same object (cached)
      expect(result2).toBe(result1);
    });

    it('should reduce API calls with cache', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we add logging?';

      provider.resetCallCount();

      // First call - 8 API calls
      await analysis.analyze(context);
      expect(provider.getCallCount()).toBe(8);

      // Second call - 0 API calls (cached)
      await analysis.analyze(context);
      expect(provider.getCallCount()).toBe(8); // Still 8, no new calls
    });

    it('should return cache statistics', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we add metrics?';

      // Initial stats
      let stats = analysis.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);

      // First call - cache miss
      await analysis.analyze(context);
      stats = analysis.getCacheStats();
      expect(stats.misses).toBe(1);
      expect(stats.hits).toBe(0);

      // Second call - cache hit
      await analysis.analyze(context);
      stats = analysis.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should allow manual cache clearing', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we add observability?';

      // First call
      await analysis.analyze(context);

      // Clear cache
      analysis.clearCache();

      provider.resetCallCount();

      // Second call should perform full analysis
      await analysis.analyze(context);
      expect(provider.getCallCount()).toBe(8);
    });

    it('should support cache cleanup (garbage collection)', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      // Perform some analyses
      await analysis.analyze('Context 1');
      await analysis.analyze('Context 2');
      await analysis.analyze('Context 3');

      // Cleanup (won't remove anything since TTL hasn't expired)
      const removed = analysis.cleanupCache();
      expect(removed).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty context string', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      const result = await analysis.analyze('');

      expect(result).toBeDefined();
      expect(result.perspectives).toHaveLength(8);
    });

    it('should handle very long context string', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const longContext = 'A'.repeat(10000);

      const result = await analysis.analyze(longContext);

      expect(result).toBeDefined();
      expect(result.perspectives).toHaveLength(8);
    });

    it('should handle special characters in context', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const context = 'Should we add <script>alert("XSS")</script> & "quotes" \\backslash?';

      const result = await analysis.analyze(context);

      expect(result).toBeDefined();
      expect(result.perspectives).toHaveLength(8);
    });

    it('should handle multiple rapid analyses', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      const promises = [
        analysis.analyze('Context 1'),
        analysis.analyze('Context 2'),
        analysis.analyze('Context 3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.perspectives).toHaveLength(8);
      });
    });

    it('should handle persistence flag = false (no history saving)', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      const result = await analysis.analyze('Test context');

      // Should complete successfully without persistence
      expect(result).toBeDefined();
      expect(result.perspectives).toHaveLength(8);
    });

    it('should gracefully handle persistence errors (when enabled)', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', true);

      // Even if persistence fails (invalid agentId or filesystem issues),
      // the analysis should still complete
      const result = await analysis.analyze('Test context');

      expect(result).toBeDefined();
      expect(result.perspectives).toHaveLength(8);
    });
  });

  describe('History Methods Delegation', () => {
    it('should expose listHistory method', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      // Method should exist and be callable
      expect(analysis.listHistory).toBeDefined();
      expect(typeof analysis.listHistory).toBe('function');
    });

    it('should expose getHistoryItem method', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      expect(analysis.getHistoryItem).toBeDefined();
      expect(typeof analysis.getHistoryItem).toBe('function');
    });

    it('should expose getHistoryStats method', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      expect(analysis.getHistoryStats).toBeDefined();
      expect(typeof analysis.getHistoryStats).toBe('function');
    });

    it('should expose deleteHistoryItem method', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      expect(analysis.deleteHistoryItem).toBeDefined();
      expect(typeof analysis.deleteHistoryItem).toBe('function');
    });

    it('should expose clearHistory method', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      expect(analysis.clearHistory).toBeDefined();
      expect(typeof analysis.clearHistory).toBe('function');
    });

    it('should expose deleteHistoryBefore method', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      expect(analysis.deleteHistoryBefore).toBeDefined();
      expect(typeof analysis.deleteHistoryBefore).toBe('function');
    });

    it('should expose exportHistory method', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);

      expect(analysis.exportHistory).toBeDefined();
      expect(typeof analysis.exportHistory).toBe('function');
    });
  });

  describe('Result Structure Validation', () => {
    it('should include all required perspective fields', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const result = await analysis.analyze('Test context');

      result.perspectives.forEach(perspective => {
        expect(perspective.perspective).toBeDefined();
        expect(typeof perspective.perspective).toBe('string');
        expect(perspective.analysis).toBeDefined();
        expect(typeof perspective.analysis).toBe('string');
        expect(perspective.confidence).toBeDefined();
        expect(typeof perspective.confidence).toBe('number');
        expect(perspective.confidence).toBeGreaterThanOrEqual(0);
        expect(perspective.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should include optional perspective fields when provided', async () => {
      const analysis = new MultiPerspectiveAnalysis(provider, cache, 'test-agent', false);
      const result = await analysis.analyze('Test context');

      result.perspectives.forEach(perspective => {
        // Reasoning is optional but our mock provides it
        if (perspective.reasoning) {
          expect(typeof perspective.reasoning).toBe('string');
        }

        // Metadata is optional but our mock provides it
        if (perspective.metadata) {
          expect(typeof perspective.metadata).toBe('object');
        }
      });
    });
  });
});
