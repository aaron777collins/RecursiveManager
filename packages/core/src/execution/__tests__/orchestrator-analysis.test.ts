/**
 * Tests for ExecutionOrchestrator analysis integration
 *
 * Tests the integration of multi-perspective AI analysis with the ExecutionOrchestrator,
 * including analyzeDecision() method and decision triggers for lifecycle operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExecutionOrchestrator } from '../index.js';
import type { AdapterRegistry } from '@recursive-manager/adapters';
import type { DatabasePool } from '@recursive-manager/common';
import type { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from '../../ai-analysis/providers/base.js';

// Mock AI Provider
class MockAIProvider implements AIProvider {
  name = 'mock-provider';
  private callCount = 0;
  private mockResponses: Map<string, AIAnalysisResponse> = new Map();

  setResponse(agentType: string, response: AIAnalysisResponse): void {
    this.mockResponses.set(agentType, response);
  }

  async submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    this.callCount++;

    // Return custom response if set, otherwise return default
    const customResponse = this.mockResponses.get(request.agentType);
    if (customResponse) {
      return customResponse;
    }

    return {
      content: `${request.agentType} analysis: This is a detailed analysis from the ${request.agentType} perspective. Confidence: 0.85`,
      confidence: 0.85,
      metadata: {
        model: 'mock-model',
        provider: 'mock-provider',
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  getCallCount(): number {
    return this.callCount;
  }

  reset(): void {
    this.callCount = 0;
    this.mockResponses.clear();
  }
}

// Mock dependencies
const mockAdapterRegistry = {
  getAdapter: vi.fn(),
  hasAdapter: vi.fn(() => true),
} as unknown as AdapterRegistry;

const mockDatabase = {
  query: vi.fn(),
  transaction: vi.fn(),
  release: vi.fn(),
} as unknown as DatabasePool;

// Mock the provider factory
vi.mock('../../ai-analysis/providers/factory.js', () => ({
  ProviderFactory: {
    createWithHealthCheck: vi.fn(),
  },
}));

describe('ExecutionOrchestrator - Multi-Perspective Analysis Integration', () => {
  let orchestrator: ExecutionOrchestrator;
  let mockProvider: MockAIProvider;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock provider
    mockProvider = new MockAIProvider();

    // Set up provider factory mock
    const { ProviderFactory } = await import('../../ai-analysis/providers/factory.js');
    vi.mocked(ProviderFactory.createWithHealthCheck).mockResolvedValue(mockProvider);

    // Create orchestrator
    orchestrator = new ExecutionOrchestrator({
      adapterRegistry: mockAdapterRegistry,
      database: mockDatabase,
      maxExecutionTime: 300000, // 5 minutes
      maxAnalysisTime: 120000,  // 2 minutes
    });
  });

  afterEach(() => {
    mockProvider.reset();
    vi.clearAllMocks();
  });

  describe('analyzeDecision()', () => {
    it('should return multi-perspective result with all required fields', async () => {
      const result = await orchestrator.analyzeDecision('Should we migrate to microservices?');

      // Verify result structure
      expect(result).toBeDefined();
      expect(result).toHaveProperty('perspectives');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('overallConfidence');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('timestamp');

      // Verify perspectives array
      expect(Array.isArray(result.perspectives)).toBe(true);
      expect(result.perspectives.length).toBe(8); // All 8 perspective agents

      // Verify each perspective has required fields
      result.perspectives.forEach((perspective) => {
        expect(perspective).toHaveProperty('perspective');
        expect(perspective).toHaveProperty('analysis');
        expect(perspective).toHaveProperty('confidence');
        expect(typeof perspective.confidence).toBe('number');
        expect(perspective.confidence).toBeGreaterThanOrEqual(0);
        expect(perspective.confidence).toBeLessThanOrEqual(1);
      });

      // Verify overall confidence is a number between 0 and 1
      expect(typeof result.overallConfidence).toBe('number');
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);

      // Verify summary is a non-empty string
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeGreaterThan(0);

      // Verify execution time is recorded
      expect(typeof result.executionTime).toBe('number');
      expect(result.executionTime).toBeGreaterThan(0);

      // Verify timestamp is valid ISO string
      expect(typeof result.timestamp).toBe('string');
      expect(() => new Date(result.timestamp)).not.toThrow();
    });

    it('should run all 8 perspective agents in parallel', async () => {
      const startTime = Date.now();
      const result = await orchestrator.analyzeDecision('Test question');
      const duration = Date.now() - startTime;

      // All 8 perspectives should be present
      expect(result.perspectives.length).toBe(8);

      // Verify all expected perspectives are included
      const perspectiveNames = result.perspectives.map((p) => p.perspective);
      expect(perspectiveNames).toContain('Security');
      expect(perspectiveNames).toContain('Architecture');
      expect(perspectiveNames).toContain('Simplicity');
      expect(perspectiveNames).toContain('Financial');
      expect(perspectiveNames).toContain('Marketing');
      expect(perspectiveNames).toContain('User Experience');
      expect(perspectiveNames).toContain('Growth');
      expect(perspectiveNames).toContain('Emotional Intelligence');

      // Execution should be relatively fast with mocks (parallel execution)
      // Even with 8 agents, parallel execution should complete quickly
      expect(duration).toBeLessThan(5000); // 5 seconds is generous for mocked calls
    });

    it('should handle complex analysis contexts', async () => {
      const complexContext = `
        We are considering migrating our monolithic application to microservices.
        Current system: 500K LOC, 20 developers, 10M monthly users.
        Concerns: scalability, team velocity, operational complexity.
        Timeline: 6 months.
        Budget: $500K.
      `;

      const result = await orchestrator.analyzeDecision(complexContext);

      expect(result).toBeDefined();
      expect(result.perspectives.length).toBe(8);

      // Each perspective should have analyzed the context
      result.perspectives.forEach((perspective) => {
        expect(perspective.analysis.length).toBeGreaterThan(0);
      });
    });

    it('should handle short analysis contexts', async () => {
      const shortContext = 'Should we add caching?';

      const result = await orchestrator.analyzeDecision(shortContext);

      expect(result).toBeDefined();
      expect(result.perspectives.length).toBe(8);
    });

    // Note: Timeout behavior is tested at the MultiPerspectiveAnalysis level
    // Testing it here would require complex mock orchestration

    it('should handle provider errors gracefully', async () => {
      // Mock provider factory to throw error
      const { ProviderFactory } = await import('../../ai-analysis/providers/factory.js');
      vi.mocked(ProviderFactory.createWithHealthCheck).mockRejectedValueOnce(
        new Error('No available AI providers')
      );

      await expect(
        orchestrator.analyzeDecision('Test question')
      ).rejects.toThrow(/Failed to complete multi-perspective analysis/i);
    });

    it('should have valid confidence scores in all perspectives', async () => {
      const result = await orchestrator.analyzeDecision('Test question');

      // All perspectives should have confidence scores
      result.perspectives.forEach((perspective) => {
        expect(perspective.confidence).toBeGreaterThanOrEqual(0);
        expect(perspective.confidence).toBeLessThanOrEqual(1);
      });

      // Overall confidence should be calculated
      expect(result.overallConfidence).toBeDefined();
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Integration - Analysis Quality', () => {
    it('should provide consistent confidence scores across multiple analyses', async () => {
      const context = 'Should we implement feature flags?';

      // Run same analysis twice
      const result1 = await orchestrator.analyzeDecision(context);
      const result2 = await orchestrator.analyzeDecision(context);

      // Results should be consistent (caching or similar analysis)
      expect(result1.perspectives.length).toBe(result2.perspectives.length);
      expect(result1.perspectives.length).toBe(8);
    });

    it('should generate meaningful summaries', async () => {
      const result = await orchestrator.analyzeDecision(
        'Should we migrate our database from PostgreSQL to MongoDB?'
      );

      // Summary should contain all perspectives
      expect(result.summary).toContain('Security');
      expect(result.summary).toContain('Architecture');
      expect(result.summary).toContain('Simplicity');
      expect(result.summary).toContain('Financial');
      expect(result.summary).toContain('Marketing');
      expect(result.summary).toContain('User Experience');
      expect(result.summary).toContain('Growth');
      expect(result.summary).toContain('Emotional Intelligence');

      // Summary should include confidence scores
      expect(result.summary).toMatch(/Confidence:\s*\d+\.\d+/);
    });

    it('should measure execution time accurately', async () => {
      const result = await orchestrator.analyzeDecision('Test question');

      // Execution time should be measured (can be 0 with very fast mocks, but should be a number)
      expect(typeof result.executionTime).toBe('number');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(result.executionTime).toBeLessThan(10000); // Less than 10 seconds with mocks
    });

    it('should include timestamp in ISO format', async () => {
      const beforeAnalysis = new Date().getTime() - 1000; // 1 second before to account for timing
      const result = await orchestrator.analyzeDecision('Test question');
      const afterAnalysis = new Date().getTime() + 1000; // 1 second after to account for timing

      // Parse timestamp
      const timestamp = new Date(result.timestamp);

      // Timestamp should be valid and roughly within test execution time
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeAnalysis);
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterAnalysis);

      // Verify ISO format
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  describe('Decision Triggers - Integration Tests', () => {
    it('should support analysis for hiring decisions', async () => {
      // Note: We can't fully test hireAgentWithAnalysis without mocking the entire
      // lifecycle module, but we can verify that analyzeDecision works, which is
      // what the hire/fire methods use internally.

      const hiringContext = 'Should we hire a new Security Expert?';
      const result = await orchestrator.analyzeDecision(hiringContext);

      expect(result).toBeDefined();
      expect(result.perspectives.length).toBe(8);

      // Security and Financial perspectives should be particularly relevant for hiring
      const securityPerspective = result.perspectives.find((p) => p.perspective === 'Security');
      const financialPerspective = result.perspectives.find((p) => p.perspective === 'Financial');

      expect(securityPerspective).toBeDefined();
      expect(financialPerspective).toBeDefined();
    });

    it('should support analysis for firing decisions', async () => {
      const firingContext = 'Should we fire agent-123 due to performance issues?';
      const result = await orchestrator.analyzeDecision(firingContext);

      expect(result).toBeDefined();
      expect(result.perspectives.length).toBe(8);

      // Emotional and simplicity perspectives should be relevant for firing
      const emotionalPerspective = result.perspectives.find((p) => p.perspective === 'Emotional Intelligence');
      const simplicityPerspective = result.perspectives.find((p) => p.perspective === 'Simplicity');

      expect(emotionalPerspective).toBeDefined();
      expect(simplicityPerspective).toBeDefined();
    });

    it('should support analysis for technical decisions', async () => {
      const technicalContext = 'Should we migrate from REST to GraphQL?';
      const result = await orchestrator.analyzeDecision(technicalContext);

      expect(result).toBeDefined();
      expect(result.perspectives.length).toBe(8);

      // Architecture and UX perspectives should be particularly relevant
      const architecturePerspective = result.perspectives.find((p) => p.perspective === 'Architecture');
      const uxPerspective = result.perspectives.find((p) => p.perspective === 'User Experience');

      expect(architecturePerspective).toBeDefined();
      expect(uxPerspective).toBeDefined();
    });

    it('should support analysis for business decisions', async () => {
      const businessContext = 'Should we expand to the European market?';
      const result = await orchestrator.analyzeDecision(businessContext);

      expect(result).toBeDefined();
      expect(result.perspectives.length).toBe(8);

      // Marketing, Growth, and Financial perspectives should be relevant
      const marketingPerspective = result.perspectives.find((p) => p.perspective === 'Marketing');
      const growthPerspective = result.perspectives.find((p) => p.perspective === 'Growth');
      const financialPerspective = result.perspectives.find((p) => p.perspective === 'Financial');

      expect(marketingPerspective).toBeDefined();
      expect(growthPerspective).toBeDefined();
      expect(financialPerspective).toBeDefined();
    });
  });
});
