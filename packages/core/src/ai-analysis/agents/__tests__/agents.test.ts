/**
 * Unit tests for AI Analysis Agents
 *
 * Tests all 8 perspective agents (Security, Architecture, Simplicity, Financial, Marketing, UX, Growth, Emotional)
 * and the base PerspectiveAgent class.
 */

import { SecurityAgent } from '../security';
import { ArchitectureAgent } from '../architecture';
import { SimplicityAgent } from '../simplicity';
import { FinancialAgent } from '../financial';
import { MarketingAgent } from '../marketing';
import { UXAgent } from '../ux';
import { GrowthAgent } from '../growth';
import { EmotionalAgent } from '../emotional';
import { AIProvider, AIAnalysisRequest, AIAnalysisResponse } from '../../providers/base';

// Mock AI Provider for testing
class MockAIProvider implements AIProvider {
  name = 'mock-provider';

  // Store last request for assertions
  lastRequest: AIAnalysisRequest | null = null;

  // Configurable mock response
  mockResponse: AIAnalysisResponse = {
    content: 'Mock analysis content\n\nConfidence: 0.75',
    confidence: 0.75,
    metadata: {
      model: 'mock-model',
      provider: 'mock-provider'
    }
  };

  async submit(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    this.lastRequest = request;
    return this.mockResponse;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('PerspectiveAgent System', () => {
  let mockProvider: MockAIProvider;

  beforeEach(() => {
    mockProvider = new MockAIProvider();
  });

  describe('Base PerspectiveAgent', () => {
    it('should have correct structure and methods', () => {
      const agent = new SecurityAgent(mockProvider);

      expect(agent.name).toBe('security');
      expect(agent.perspective).toBe('Security');
      expect(typeof agent.analyze).toBe('function');
      expect(typeof agent.getSystemPrompt).toBe('function');
      expect(typeof agent.buildPrompt).toBe('function');
    });

    it('should call provider with correct request structure', async () => {
      const agent = new SecurityAgent(mockProvider);
      const context = 'Should we add Redis caching?';

      await agent.analyze(context);

      expect(mockProvider.lastRequest).toBeTruthy();
      expect(mockProvider.lastRequest?.agentType).toBe('security');
      expect(mockProvider.lastRequest?.prompt).toContain(context);
      expect(mockProvider.lastRequest?.systemPrompt).toBeTruthy();
      expect(mockProvider.lastRequest?.temperature).toBe(0.7);
      expect(mockProvider.lastRequest?.maxTokens).toBe(4000);
    });

    it('should return properly structured PerspectiveAnalysis', async () => {
      const agent = new SecurityAgent(mockProvider);
      const result = await agent.analyze('Test context');

      expect(result).toMatchObject({
        perspective: 'Security',
        analysis: expect.any(String),
        confidence: expect.any(Number),
        metadata: expect.any(Object)
      });

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle provider errors gracefully', async () => {
      const errorProvider = new MockAIProvider();
      errorProvider.submit = jest.fn().mockRejectedValue(new Error('Provider error'));

      const agent = new SecurityAgent(errorProvider);

      await expect(agent.analyze('Test context')).rejects.toThrow('Provider error');
    });
  });

  describe('SecurityAgent', () => {
    it('should return security-focused analysis', async () => {
      const agent = new SecurityAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Security Analysis: Redis caching introduces authentication concerns.\n\nConfidence: 0.82',
        confidence: 0.82,
        metadata: { model: 'test', provider: 'test' }
      };

      const result = await agent.analyze('Should we add Redis caching?');

      expect(result.perspective).toBe('Security');
      expect(result.confidence).toBe(0.82);
      expect(result.analysis).toContain('Security Analysis');
    });

    it('should have security-specific system prompt', () => {
      const agent = new SecurityAgent(mockProvider);
      const systemPrompt = agent.getSystemPrompt();

      expect(systemPrompt).toContain('Security Expert');
      expect(systemPrompt).toContain('vulnerabilities');
      expect(systemPrompt).toContain('OWASP');
    });

    it('should extract confidence score correctly', async () => {
      const agent = new SecurityAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Analysis content\n\nConfidence: 0.91',
        confidence: 0.91,
        metadata: { model: 'test', provider: 'test' }
      };

      const result = await agent.analyze('Test');

      expect(result.confidence).toBe(0.91);
    });

    it('should use default confidence when not specified', async () => {
      const agent = new SecurityAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Analysis without explicit confidence',
        confidence: 0.7,
        metadata: { model: 'test', provider: 'test' }
      };

      const result = await agent.analyze('Test');

      expect(result.confidence).toBe(0.7);
    });
  });

  describe('ArchitectureAgent', () => {
    it('should return architecture-focused analysis', async () => {
      const agent = new ArchitectureAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Architecture Analysis: Redis improves scalability.\n\nConfidence: 0.88',
        confidence: 0.88,
        metadata: { model: 'test', provider: 'test' }
      };

      const result = await agent.analyze('Should we add Redis caching?');

      expect(result.perspective).toBe('Architecture');
      expect(result.confidence).toBe(0.88);
    });

    it('should have architecture-specific system prompt', () => {
      const agent = new ArchitectureAgent(mockProvider);
      const systemPrompt = agent.getSystemPrompt();

      expect(systemPrompt).toContain('Architecture Expert');
      expect(systemPrompt).toContain('scalability');
      expect(systemPrompt.toLowerCase()).toContain('design patterns');
    });
  });

  describe('SimplicityAgent', () => {
    it('should return simplicity-focused analysis', async () => {
      const agent = new SimplicityAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Simplicity Analysis: Redis adds complexity.\n\nConfidence: 0.65',
        confidence: 0.65,
        metadata: { model: 'test', provider: 'test' }
      };

      const result = await agent.analyze('Should we add Redis caching?');

      expect(result.perspective).toBe('Simplicity');
      expect(result.confidence).toBe(0.65);
    });

    it('should have simplicity-specific system prompt', () => {
      const agent = new SimplicityAgent(mockProvider);
      const systemPrompt = agent.getSystemPrompt();

      expect(systemPrompt).toContain('Simplicity');
      expect(systemPrompt).toContain('YAGNI');
      expect(systemPrompt).toContain('complexity');
    });
  });

  describe('FinancialAgent', () => {
    it('should return financial-focused analysis', async () => {
      const agent = new FinancialAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Financial Analysis: Redis has moderate ROI.\n\nConfidence: 0.76',
        confidence: 0.76,
        metadata: { model: 'test', provider: 'test' }
      };

      const result = await agent.analyze('Should we add Redis caching?');

      expect(result.perspective).toBe('Financial');
      expect(result.confidence).toBe(0.76);
    });

    it('should have financial-specific system prompt', () => {
      const agent = new FinancialAgent(mockProvider);
      const systemPrompt = agent.getSystemPrompt();

      expect(systemPrompt).toContain('Financial');
      expect(systemPrompt).toContain('ROI');
      expect(systemPrompt).toContain('cost');
    });
  });

  describe('MarketingAgent', () => {
    it('should return marketing-focused analysis', async () => {
      const agent = new MarketingAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Marketing Analysis: Redis enables performance messaging.\n\nConfidence: 0.79',
        confidence: 0.79,
        metadata: { model: 'test', provider: 'test' }
      };

      const result = await agent.analyze('Should we add Redis caching?');

      expect(result.perspective).toBe('Marketing');
      expect(result.confidence).toBe(0.79);
    });

    it('should have marketing-specific system prompt', () => {
      const agent = new MarketingAgent(mockProvider);
      const systemPrompt = agent.getSystemPrompt();

      expect(systemPrompt).toContain('Marketing');
      expect(systemPrompt).toContain('positioning');
      expect(systemPrompt).toContain('competitive');
    });
  });

  describe('UXAgent', () => {
    it('should return UX-focused analysis', async () => {
      const agent = new UXAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'UX Analysis: Redis improves perceived performance.\n\nConfidence: 0.84',
        confidence: 0.84,
        metadata: { model: 'test', provider: 'test' }
      };

      const result = await agent.analyze('Should we add Redis caching?');

      expect(result.perspective).toBe('User Experience');
      expect(result.confidence).toBe(0.84);
    });

    it('should have UX-specific system prompt', () => {
      const agent = new UXAgent(mockProvider);
      const systemPrompt = agent.getSystemPrompt();

      expect(systemPrompt).toContain('UX');
      expect(systemPrompt).toContain('usability');
      expect(systemPrompt).toContain('accessibility');
    });
  });

  describe('GrowthAgent', () => {
    it('should return growth-focused analysis', async () => {
      const agent = new GrowthAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Growth Analysis: Redis supports scaling user base.\n\nConfidence: 0.87',
        confidence: 0.87,
        metadata: { model: 'test', provider: 'test' }
      };

      const result = await agent.analyze('Should we add Redis caching?');

      expect(result.perspective).toBe('Growth');
      expect(result.confidence).toBe(0.87);
    });

    it('should have growth-specific system prompt', () => {
      const agent = new GrowthAgent(mockProvider);
      const systemPrompt = agent.getSystemPrompt();

      expect(systemPrompt).toContain('Growth');
      expect(systemPrompt).toContain('acquisition');
      expect(systemPrompt).toContain('retention');
    });
  });

  describe('EmotionalAgent', () => {
    it('should return emotional intelligence-focused analysis', async () => {
      const agent = new EmotionalAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Emotional Analysis: Redis reduces developer stress.\n\nConfidence: 0.72',
        confidence: 0.72,
        metadata: { model: 'test', provider: 'test' }
      };

      const result = await agent.analyze('Should we add Redis caching?');

      expect(result.perspective).toBe('Emotional Intelligence');
      expect(result.confidence).toBe(0.72);
    });

    it('should have emotional-specific system prompt', () => {
      const agent = new EmotionalAgent(mockProvider);
      const systemPrompt = agent.getSystemPrompt();

      expect(systemPrompt).toContain('Emotional');
      expect(systemPrompt).toContain('team morale');
      expect(systemPrompt).toContain('psychological');
    });
  });

  describe('All 8 Agents Integration', () => {
    it('should instantiate all 8 agents successfully', () => {
      const agents = [
        new SecurityAgent(mockProvider),
        new ArchitectureAgent(mockProvider),
        new SimplicityAgent(mockProvider),
        new FinancialAgent(mockProvider),
        new MarketingAgent(mockProvider),
        new UXAgent(mockProvider),
        new GrowthAgent(mockProvider),
        new EmotionalAgent(mockProvider)
      ];

      expect(agents).toHaveLength(8);

      const perspectives = agents.map(a => a.perspective);
      expect(perspectives).toEqual([
        'Security',
        'Architecture',
        'Simplicity',
        'Financial',
        'Marketing',
        'User Experience',
        'Growth',
        'Emotional Intelligence'
      ]);
    });

    it('should run all 8 agents in parallel', async () => {
      const agents = [
        new SecurityAgent(mockProvider),
        new ArchitectureAgent(mockProvider),
        new SimplicityAgent(mockProvider),
        new FinancialAgent(mockProvider),
        new MarketingAgent(mockProvider),
        new UXAgent(mockProvider),
        new GrowthAgent(mockProvider),
        new EmotionalAgent(mockProvider)
      ];

      const context = 'Should we migrate to microservices?';
      const startTime = Date.now();

      const results = await Promise.all(
        agents.map(agent => agent.analyze(context))
      );

      const endTime = Date.now();

      expect(results).toHaveLength(8);

      // Verify all results have correct structure
      results.forEach(result => {
        expect(result).toMatchObject({
          perspective: expect.any(String),
          analysis: expect.any(String),
          confidence: expect.any(Number),
          metadata: expect.any(Object)
        });
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
      });

      // Verify parallel execution (should be fast since mocked)
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in < 1 second with mocks
    });

    it('should handle one agent failure without affecting others', async () => {
      const errorProvider = new MockAIProvider();
      const normalProvider = new MockAIProvider();

      errorProvider.submit = jest.fn().mockRejectedValue(new Error('Provider error'));

      const agents = [
        new SecurityAgent(errorProvider),  // This will fail
        new ArchitectureAgent(normalProvider),
        new SimplicityAgent(normalProvider),
        new FinancialAgent(normalProvider),
        new MarketingAgent(normalProvider),
        new UXAgent(normalProvider),
        new GrowthAgent(normalProvider),
        new EmotionalAgent(normalProvider)
      ];

      const context = 'Test context';

      // Use Promise.allSettled to handle partial failures
      const results = await Promise.allSettled(
        agents.map(agent => agent.analyze(context))
      );

      expect(results).toHaveLength(8);

      // First one should fail
      expect(results[0]?.status).toBe('rejected');

      // Rest should succeed
      for (let i = 1; i < 8; i++) {
        expect(results[i]?.status).toBe('fulfilled');
      }
    });

    it('should pass different contexts to each agent', async () => {
      const agent = new SecurityAgent(mockProvider);

      const context1 = 'Should we add Redis?';
      await agent.analyze(context1);
      expect(mockProvider.lastRequest?.prompt).toContain(context1);

      const context2 = 'Should we use GraphQL?';
      await agent.analyze(context2);
      expect(mockProvider.lastRequest?.prompt).toContain(context2);
    });

    it('should maintain agent independence (no shared state)', async () => {
      const provider1 = new MockAIProvider();
      const provider2 = new MockAIProvider();

      const agent1 = new SecurityAgent(provider1);
      const agent2 = new SecurityAgent(provider2);

      await agent1.analyze('Context 1');
      await agent2.analyze('Context 2');

      expect(provider1.lastRequest?.prompt).toContain('Context 1');
      expect(provider2.lastRequest?.prompt).toContain('Context 2');

      // Verify they didn't interfere with each other
      expect(provider1.lastRequest?.prompt).not.toContain('Context 2');
      expect(provider2.lastRequest?.prompt).not.toContain('Context 1');
    });
  });

  describe('Metadata Handling', () => {
    it('should pass through provider metadata', async () => {
      const agent = new SecurityAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Analysis\n\nConfidence: 0.8',
        confidence: 0.8,
        metadata: {
          model: 'glm-4.7',
          provider: 'aiceo-gateway',
          usage: {
            inputTokens: 100,
            outputTokens: 200
          },
          waitTime: 500
        }
      };

      const result = await agent.analyze('Test');

      expect(result.metadata).toMatchObject({
        model: 'glm-4.7',
        provider: 'aiceo-gateway',
        usage: {
          inputTokens: 100,
          outputTokens: 200
        },
        waitTime: 500
      });
    });

    it('should handle missing metadata gracefully', async () => {
      const agent = new SecurityAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Analysis\n\nConfidence: 0.8',
        confidence: 0.8
        // No metadata field
      };

      const result = await agent.analyze('Test');

      expect(result.metadata).toBeUndefined();
    });
  });

  describe('Reasoning Extraction', () => {
    it('should extract reasoning when provided', async () => {
      const agent = new SecurityAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Analysis\n\nConfidence: 0.8',
        confidence: 0.8,
        reasoning: 'This decision is based on industry best practices'
      };

      const result = await agent.analyze('Test');

      expect(result.reasoning).toBe('This decision is based on industry best practices');
    });

    it('should handle missing reasoning gracefully', async () => {
      const agent = new SecurityAgent(mockProvider);
      mockProvider.mockResponse = {
        content: 'Analysis\n\nConfidence: 0.8',
        confidence: 0.8
        // No reasoning field
      };

      const result = await agent.analyze('Test');

      expect(result.reasoning).toBeUndefined();
    });
  });
});
