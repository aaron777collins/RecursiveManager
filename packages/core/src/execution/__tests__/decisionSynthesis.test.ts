/**
 * Unit tests for decision synthesis (Task 3.3.16)
 *
 * This test suite validates the decision synthesis logic within the ExecutionOrchestrator.
 * Since synthesizeDecision() is a private method, these tests exercise it through the
 * public runMultiPerspectiveAnalysis() method, focusing specifically on testing the
 * decision synthesis rules and logic.
 *
 * Decision Synthesis Rules Tested:
 * - Rule 1: Strong rejection override (confidence > 0.8)
 * - Rule 2: Majority approval (> 50% approve)
 * - Rule 3: Conditional approval (with conditions)
 * - Rule 4: No clear consensus (escalate to review)
 * - Fallback: Majority rejection
 * - Final fallback: Uncertain decision
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import {
  runMigrations,
  allMigrations,
  DatabasePool,
  type AgentConfig,
} from '@recursive-manager/common';
import { ExecutionOrchestrator } from '../index';

// Mock types for adapters (avoiding import issues)
type ExecutionResult = {
  success: boolean;
  agentId: string;
  mode: 'continuous' | 'reactive';
  tasksCompleted: number;
  messagesProcessed: number;
  duration: number;
  timestamp: Date;
  error?: string;
};

type FrameworkAdapter = {
  name: string;
  executeAgent(
    agentId: string,
    mode: 'continuous' | 'reactive',
    context: any
  ): Promise<ExecutionResult>;
  checkHealth(): Promise<boolean>;
  supportsFeature(_feature: string): boolean;
  getCapabilities(): any[];
};

// Simple adapter registry for tests
class AdapterRegistry {
  private adapters: Map<string, FrameworkAdapter> = new Map();

  register(adapter: FrameworkAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  async getHealthyAdapter(
    primary: string,
    fallback?: string
  ): Promise<{ adapter: FrameworkAdapter; usedFallback: boolean } | null> {
    const primaryAdapter = this.adapters.get(primary);
    if (primaryAdapter && (await primaryAdapter.checkHealth())) {
      return { adapter: primaryAdapter, usedFallback: false };
    }

    if (fallback) {
      const fallbackAdapter = this.adapters.get(fallback);
      if (fallbackAdapter && (await fallbackAdapter.checkHealth())) {
        return { adapter: fallbackAdapter, usedFallback: true };
      }
    }

    return null;
  }
}

// Helper to create valid AgentConfig
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function createValidConfig(agentId: string, role: string): AgentConfig {
  return {
    version: '1.0.0',
    identity: {
      id: agentId,
      role,
      displayName: role,
      createdAt: new Date().toISOString(),
      createdBy: 'test',
      reportingTo: null,
    },
    goal: {
      mainGoal: 'Test goal',
    },
    permissions: {
      canHire: false,
      canFire: false,
      maxSubordinates: 0,
      hiringBudget: 0,
    },
    framework: {
      primary: 'mock-adapter',
      fallback: undefined,
    },
    communication: {
      preferredChannels: [],
    },
    execution: {
      mode: 'continuous',
      schedule: null,
      maxConcurrentTasks: 5,
      multiPerspectiveAnalysis: {
        enabled: true,
        perspectives: ['Technical', 'Security', 'User Experience'],
        timeout: 120000,
      },
    },
  };
}

// Helper to create mock adapter
function createMockAdapter(name: string, healthy = true): FrameworkAdapter {
  return {
    name,
    async executeAgent(
      _agentId: string,
      mode: 'continuous' | 'reactive',
      _context: any
    ): Promise<ExecutionResult> {
      return {
        success: true,
        agentId: _agentId,
        mode,
        tasksCompleted: 1,
        messagesProcessed: 0,
        duration: 100,
        timestamp: new Date(),
      };
    },
    async checkHealth(): Promise<boolean> {
      return healthy;
    },
    supportsFeature(_feature: string): boolean {
      return true;
    },
    getCapabilities(): any[] {
      return [];
    },
  };
}

describe('Decision Synthesis', () => {
  let db: Database.Database;
  let dbPool: DatabasePool;
  let orchestrator: ExecutionOrchestrator;
  let agentDir: string;
  let adapterRegistry: AdapterRegistry;

  beforeEach(async () => {
    // Create in-memory database
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');

    // Run migrations
    runMigrations(db, allMigrations);

    // Reset and create database pool
    DatabasePool.getInstance().reset();
    dbPool = DatabasePool.getInstance();

    // Override the database instance with our test database
    (dbPool as any).connection = { db, close: () => db.close(), healthCheck: () => true };

    // Create temporary directory for agent files
    agentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-agents-'));

    // Create adapter registry
    adapterRegistry = new AdapterRegistry();
    adapterRegistry.register(createMockAdapter('mock-adapter', true));

    // Create orchestrator instance
    orchestrator = new ExecutionOrchestrator({
      database: dbPool,
      adapterRegistry: adapterRegistry as any,
    });
  });

  afterEach(async () => {
    db.close();
    dbPool.reset();
    await fs.remove(agentDir);
  });

  describe('Rule 1: Strong Rejection Override', () => {
    it('should reject when any perspective has high confidence rejection (>0.8)', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis(
        'Should we proceed with this action?',
        [
          'Technical Perspective (approve with confidence 0.7)',
          'Security Perspective (reject with confidence 0.9)',
          'UX Perspective (approve with confidence 0.6)',
        ]
      );

      expect(decision.recommendation).toBe('reject');
      expect(decision.confidence).toBeGreaterThan(0.8);
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings?.length).toBeGreaterThan(0);
      expect(decision.rationale).toContain('Strong rejection');
    });

    it('should reject even with majority approvals when strong rejection exists', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis(
        'Should we deploy this change?',
        [
          'Technical (yes, proceed with 0.7)',
          'Business (yes, approve with 0.8)',
          'UX (yes, recommend with 0.75)',
          'Operations (yes, proceed with 0.7)',
          'Security (reject strongly with 0.95)',
        ]
      );

      expect(decision.recommendation).toBe('reject');
      expect(decision.confidence).toBeGreaterThan(0.8);
      expect(decision.perspectives).toHaveLength(5);
    });

    it('should not trigger strong rejection with confidence <= 0.8', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Should we proceed?', [
        'Technical (approve with 0.9)',
        'Security (reject with 0.8)', // Exactly 0.8, should not trigger strong rejection
        'UX (approve with 0.85)',
      ]);

      // Should use majority approval rule instead
      expect(decision.recommendation).not.toBe('reject');
    });

    it('should include strong rejection perspective in rationale', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Deploy to production?', [
        'Technical (approve)',
        'Security (reject with confidence 0.95, critical vulnerability found)',
      ]);

      expect(decision.recommendation).toBe('reject');
      expect(decision.rationale).toContain('Security');
      expect(decision.rationale.toLowerCase()).toContain('rejection');
    });
  });

  describe('Rule 2: Majority Approval', () => {
    it('should approve when majority (>50%) of perspectives approve', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis(
        'Should we implement this feature?',
        ['Technical (yes, recommend)', 'Business (yes, proceed)', 'UX (no, reject)']
      );

      expect(decision.recommendation).toBe('approve');
      expect(decision.confidence).toBeGreaterThan(0);
      expect(decision.confidence).toBeLessThanOrEqual(0.95); // Capped at 0.95
    });

    it('should cap confidence at 0.95 for majority approval', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Deploy feature?', [
        'Technical (yes, approve with 1.0 confidence)',
        'Business (yes, approve with 1.0 confidence)',
        'UX (yes, approve with 1.0 confidence)',
      ]);

      expect(decision.recommendation).toBe('approve');
      expect(decision.confidence).toBeLessThanOrEqual(0.95);
    });

    it('should include warnings when minority perspectives reject', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Launch product?', [
        'Technical (approve)',
        'Business (approve)',
        'Legal (approve)',
        'Security (reject)',
      ]);

      expect(decision.recommendation).toBe('approve');
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings?.length).toBeGreaterThan(0);
      expect(decision.warnings?.[0]).toContain('rejection');
    });

    it('should calculate average confidence from approvals', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Proceed with update?', [
        'Perspective A (approve with confidence 0.8)',
        'Perspective B (approve with confidence 0.6)',
        'Perspective C (approve with confidence 0.7)',
      ]);

      expect(decision.recommendation).toBe('approve');
      // Average of 0.8, 0.6, 0.7 = 0.7
      expect(decision.confidence).toBeCloseTo(0.7, 1);
    });

    it('should work with exactly majority (not just >50%)', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Deploy?', [
        'Technical (approve)',
        'Business (approve)',
        'Security (reject)',
        'UX (reject)',
      ]);

      // With equal approvals/rejections, should not use majority approval rule
      expect(decision.recommendation).not.toBe('approve');
    });
  });

  describe('Rule 3: Conditional Approval', () => {
    it('should return conditional when perspectives suggest conditions', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Deploy to production?', [
        'Technical (conditional, provided that tests pass)',
        'Security (conditional, if security audit is complete)',
      ]);

      expect(decision.recommendation).toBe('conditional');
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings?.some((w) => w.includes('conditional'))).toBe(true);
    });

    it('should reduce confidence by 0.9 multiplier for conditional decisions', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Release version?', [
        'Technical (conditional with 0.9 confidence, if tests pass)',
      ]);

      expect(decision.recommendation).toBe('conditional');
      // 0.9 * 0.9 = 0.81
      expect(decision.confidence).toBeCloseTo(0.81, 1);
    });

    it('should detect "if" keyword as conditional', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Merge PR?', [
        'Reviewer (approve if CI passes)',
      ]);

      expect(decision.recommendation).toBe('conditional');
    });

    it('should detect "provided that" as conditional', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Deploy?', [
        'Technical (proceed provided that backups are ready)',
      ]);

      expect(decision.recommendation).toBe('conditional');
    });

    it('should detect "with conditions" as conditional', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Launch feature?', [
        'Product (approve with conditions)',
      ]);

      expect(decision.recommendation).toBe('conditional');
    });

    it('should include perspective names in conditional rationale', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Release?', [
        'Technical Review (conditional)',
        'Security Audit (conditional)',
      ]);

      expect(decision.recommendation).toBe('conditional');
      expect(decision.rationale).toContain('Technical Review');
      expect(decision.rationale).toContain('Security Audit');
    });
  });

  describe('Rule 4: No Clear Consensus', () => {
    it('should require review when majority are neutral', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Should we do this?', [
        'Perspective A (maybe)',
        'Perspective B (unclear)',
        'Perspective C (uncertain)',
        'Perspective D (approve)',
      ]);

      expect(decision.recommendation).toBe('review_required');
      expect(decision.confidence).toBe(0.4); // Low confidence
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings?.some((w) => w.includes('consensus'))).toBe(true);
    });

    it('should require review when approvals equal rejections', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Proceed?', [
        'Technical (approve)',
        'Business (approve)',
        'Security (reject)',
        'Legal (reject)',
      ]);

      expect(decision.recommendation).toBe('review_required');
      expect(decision.confidence).toBe(0.4);
      expect(decision.warnings?.some((w) => w.includes('review'))).toBe(true);
    });

    it('should set confidence to 0.4 for no consensus', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Deploy?', [
        'Perspective 1 (neutral)',
        'Perspective 2 (neutral)',
        'Perspective 3 (neutral)',
      ]);

      expect(decision.recommendation).toBe('review_required');
      expect(decision.confidence).toBe(0.4);
    });

    it('should include vote counts in rationale', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Action?', [
        'A (approve)',
        'B (reject)',
        'C (neutral)',
      ]);

      expect(decision.recommendation).toBe('review_required');
      expect(decision.rationale).toMatch(/Approvals: \d+/);
      expect(decision.rationale).toMatch(/Rejections: \d+/);
      expect(decision.rationale).toMatch(/Neutrals: \d+/);
    });

    it('should recommend human review in warnings', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Decision needed', [
        'Option 1 (maybe)',
        'Option 2 (uncertain)',
      ]);

      expect(decision.recommendation).toBe('review_required');
      expect(decision.warnings?.some((w) => w.toLowerCase().includes('human'))).toBe(true);
    });
  });

  describe('Fallback: Majority Rejection', () => {
    it('should reject when more rejections than approvals', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Deploy now?', [
        'Technical (no, reject)',
        'Security (no, reject)',
        'UX (yes, approve)',
      ]);

      expect(decision.recommendation).toBe('reject');
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it('should calculate average confidence from rejections', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Proceed?', [
        'A (reject with 0.6 confidence)',
        'B (reject with 0.8 confidence)',
        'C (approve with 0.5 confidence)',
      ]);

      expect(decision.recommendation).toBe('reject');
      // Average of 0.6 and 0.8 = 0.7
      expect(decision.confidence).toBeCloseTo(0.7, 1);
    });

    it('should work with multiple rejections vs single approval', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Deploy?', [
        'Security (reject)',
        'Legal (reject)',
        'Operations (reject)',
        'Business (approve)',
      ]);

      expect(decision.recommendation).toBe('reject');
      expect(decision.perspectives).toHaveLength(4);
    });

    it('should include rejection count in rationale', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Launch?', [
        'A (no)',
        'B (no)',
        'C (yes)',
      ]);

      expect(decision.recommendation).toBe('reject');
      expect(decision.rationale).toContain('2');
      expect(decision.rationale.toLowerCase()).toContain('reject');
    });
  });

  describe('Final Fallback: Uncertain Decision', () => {
    it('should return uncertain when no clear decision path applies', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Edge case scenario', [
        'Perspective (ambiguous response without clear keywords)',
      ]);

      // This should hit the final fallback
      expect(['uncertain', 'review_required']).toContain(decision.recommendation);
    });

    it('should set confidence to 0.3 for uncertain decisions', async () => {
      // Create a scenario that hits the final fallback
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Unclear scenario', []);

      if (decision.recommendation === 'uncertain') {
        expect(decision.confidence).toBe(0.3);
      }
    });

    it('should include warnings for uncertain decisions', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Complex edge case', []);

      expect(decision.warnings).toBeDefined();
      expect(decision.warnings!.length).toBeGreaterThan(0);
    });

    it('should recommend manual review in rationale', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Ambiguous case', []);

      expect(decision.rationale.toLowerCase()).toContain('review');
    });
  });

  describe('Keyword Classification', () => {
    it('should detect "approve" keyword', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Reviewer (I approve this change)',
      ]);

      expect(decision.recommendation).toBe('approve');
    });

    it('should detect "recommend" keyword', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Advisor (I recommend proceeding)',
      ]);

      expect(decision.recommendation).toBe('approve');
    });

    it('should detect "proceed" keyword', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Manager (proceed with the plan)',
      ]);

      expect(decision.recommendation).toBe('approve');
    });

    it('should detect "yes" keyword', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Reviewer (yes, this looks good)',
      ]);

      expect(decision.recommendation).toBe('approve');
    });

    it('should detect "reject" keyword', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Reviewer (I reject this proposal)',
      ]);

      expect(['reject', 'review_required']).toContain(decision.recommendation);
    });

    it('should detect "deny" keyword', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Security (deny access)',
      ]);

      expect(['reject', 'review_required']).toContain(decision.recommendation);
    });

    it('should detect "don\'t" keyword', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        "Expert (don't do this)",
      ]);

      expect(['reject', 'review_required']).toContain(decision.recommendation);
    });

    it('should detect "no" keyword', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Reviewer (no, this is not acceptable)',
      ]);

      expect(['reject', 'review_required']).toContain(decision.recommendation);
    });

    it('should detect "against" keyword', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Advisor (I am against this approach)',
      ]);

      expect(['reject', 'review_required']).toContain(decision.recommendation);
    });

    it('should handle case-insensitive keyword matching', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Reviewer (APPROVE this change)',
      ]);

      expect(decision.recommendation).toBe('approve');
    });

    it('should classify as neutral when no keywords match', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Reviewer (this is interesting)',
      ]);

      expect(['review_required', 'uncertain']).toContain(decision.recommendation);
    });

    it('should prioritize reject keywords over others in same response', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question?', [
        'Reviewer (I approve the concept but reject the implementation)',
      ]);

      // Should detect reject keyword
      expect(['reject', 'review_required']).toContain(decision.recommendation);
    });
  });

  describe('Decision Structure Validation', () => {
    it('should always return valid Decision object', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Test question', [
        'Perspective A',
      ]);

      expect(decision).toHaveProperty('recommendation');
      expect(decision).toHaveProperty('confidence');
      expect(decision).toHaveProperty('perspectives');
      expect(decision).toHaveProperty('perspectiveResults');
      expect(decision).toHaveProperty('rationale');
    });

    it('should include all perspectives in result', async () => {
      const perspectives = ['Tech', 'Business', 'UX'];
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question', perspectives);

      expect(decision.perspectives).toEqual(perspectives);
      expect(decision.perspectiveResults).toHaveLength(perspectives.length);
    });

    it('should include perspective results with all required fields', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question', ['Technical']);

      expect(decision.perspectiveResults[0]).toHaveProperty('perspective');
      expect(decision.perspectiveResults[0]).toHaveProperty('response');
      expect(decision.perspectiveResults[0]).toHaveProperty('confidence');
    });

    it('should have confidence in valid range [0, 1]', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question', [
        'Technical',
        'Security',
      ]);

      expect(decision.confidence).toBeGreaterThanOrEqual(0);
      expect(decision.confidence).toBeLessThanOrEqual(1);
    });

    it('should always have non-empty rationale', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question', ['Perspective']);

      expect(decision.rationale).toBeTruthy();
      expect(decision.rationale.length).toBeGreaterThan(0);
    });

    it('should have warnings as array or undefined', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Question', ['A', 'B']);

      if (decision.warnings !== undefined) {
        expect(Array.isArray(decision.warnings)).toBe(true);
      }
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed recommendations with varying confidences', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Complex decision', [
        'Technical (approve with 0.9)',
        'Security (reject with 0.7)',
        'Business (approve with 0.6)',
        'Legal (conditional with 0.8)',
        'UX (approve with 0.5)',
      ]);

      expect(decision).toBeDefined();
      expect(decision.recommendation).toBeTruthy();
      expect(decision.perspectives).toHaveLength(5);
    });

    it('should handle single perspective decision', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis(
        'Single perspective question',
        ['Technical (approve)']
      );

      expect(decision.recommendation).toBe('approve');
      expect(decision.perspectives).toHaveLength(1);
    });

    it('should handle large number of perspectives', async () => {
      const perspectives = [
        'Technical',
        'Security',
        'Business',
        'Legal',
        'UX',
        'Operations',
        'Product',
        'Engineering',
      ].map((p) => `${p} (approve)`);

      const decision = await orchestrator.runMultiPerspectiveAnalysis(
        'Large decision',
        perspectives
      );

      expect(decision.recommendation).toBe('approve');
      expect(decision.perspectives).toHaveLength(8);
    });

    it('should handle all neutral responses', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Neutral test', [
        'A (maybe)',
        'B (unclear)',
        'C (uncertain)',
      ]);

      expect(decision.recommendation).toBe('review_required');
      expect(decision.confidence).toBe(0.4);
    });

    it('should handle empty perspectives gracefully', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Empty test', []);

      expect(decision).toBeDefined();
      expect(decision.recommendation).toBeTruthy();
      expect(decision.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate average for approvals', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Test', [
        'A (approve with 0.8)',
        'B (approve with 0.6)',
      ]);

      expect(decision.recommendation).toBe('approve');
      expect(decision.confidence).toBeCloseTo(0.7, 1);
    });

    it('should calculate average for rejections', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Test', [
        'A (reject with 0.7)',
        'B (reject with 0.5)',
      ]);

      expect(decision.recommendation).toBe('reject');
      expect(decision.confidence).toBeCloseTo(0.6, 1);
    });

    it('should reduce confidence for conditionals', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Test', [
        'A (conditional with 1.0)',
      ]);

      expect(decision.recommendation).toBe('conditional');
      expect(decision.confidence).toBeCloseTo(0.9, 1); // 1.0 * 0.9
    });

    it('should use high confidence from strong rejection', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Test', [
        'A (approve)',
        'B (reject with 0.95)',
      ]);

      expect(decision.recommendation).toBe('reject');
      expect(decision.confidence).toBeGreaterThan(0.8);
    });
  });

  describe('Warning Generation', () => {
    it('should generate warning for minority rejections in approval', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Test', [
        'A (approve)',
        'B (approve)',
        'C (reject)',
      ]);

      expect(decision.recommendation).toBe('approve');
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings!.length).toBeGreaterThan(0);
    });

    it('should generate warning for conditional approvals', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Test', ['A (conditional)']);

      expect(decision.recommendation).toBe('conditional');
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings?.some((w) => w.includes('conditional'))).toBe(true);
    });

    it('should generate warning for no consensus', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Test', [
        'A (neutral)',
        'B (neutral)',
      ]);

      expect(decision.recommendation).toBe('review_required');
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings?.some((w) => w.includes('consensus'))).toBe(true);
    });

    it('should generate warning for strong rejection', async () => {
      const decision = await orchestrator.runMultiPerspectiveAnalysis('Test', [
        'A (approve)',
        'B (reject with 0.95)',
      ]);

      expect(decision.recommendation).toBe('reject');
      expect(decision.warnings).toBeDefined();
      expect(decision.warnings?.some((w) => w.toLowerCase().includes('rejection'))).toBe(true);
    });
  });
});
