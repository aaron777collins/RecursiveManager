/**
 * Integration Tests for Config Generation, Merging, Saving, and Loading (Task 2.1.9)
 *
 * This test suite validates the complete end-to-end workflow:
 * 1. Generate default config
 * 2. Merge with custom overrides
 * 3. Save to file system
 * 4. Load back from file system
 * 5. Verify integrity and correctness
 *
 * Test coverage:
 * - Full generate → merge → save → load roundtrip
 * - Complex nested object merging
 * - Optional field handling
 * - Schema validation at each step
 * - Multiple agent configurations
 * - Real-world use case scenarios
 */

import { generateDefaultConfig, mergeConfigs, saveAgentConfig, loadAgentConfig } from '../config';
import { validateAgentConfigStrict } from '@recursive-manager/common';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Config Integration Tests (Task 2.1.9)', () => {
  let testBaseDir: string;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    testBaseDir = mkdtempSync(join(tmpdir(), 'config-integration-test-'));
  });

  afterEach(() => {
    // Clean up test directory
    if (testBaseDir) {
      rmSync(testBaseDir, { recursive: true, force: true });
    }
  });

  describe('Generate → Merge → Save → Load Roundtrip', () => {
    it('should complete full workflow with minimal overrides', async () => {
      // Step 1: Generate default config
      const defaultConfig = generateDefaultConfig(
        'Backend Developer',
        'Build REST API',
        'CTO',
        { id: 'test-backend-dev' }
      );

      // Step 2: Merge with custom overrides
      const overrides = {
        permissions: {
          canHire: true,
          maxSubordinates: 5,
        },
      };
      const mergedConfig = mergeConfigs(defaultConfig, overrides);

      // Step 3: Save to filesystem
      await saveAgentConfig('test-backend-dev', mergedConfig, { baseDir: testBaseDir });

      // Step 4: Load back from filesystem
      const loadedConfig = await loadAgentConfig('test-backend-dev', { baseDir: testBaseDir });

      // Step 5: Verify integrity
      expect(loadedConfig).toEqual(mergedConfig);
      expect(loadedConfig.permissions.canHire).toBe(true);
      expect(loadedConfig.permissions.maxSubordinates).toBe(5);
      expect(loadedConfig.identity.role).toBe('Backend Developer');
      expect(loadedConfig.goal.mainGoal).toBe('Build REST API');
      expect(() => validateAgentConfigStrict(loadedConfig)).not.toThrow();
    });

    it('should handle nested object merging in full workflow', async () => {
      // Step 1: Generate default config
      const defaultConfig = generateDefaultConfig(
        'DevOps Engineer',
        'Manage infrastructure',
        'CTO',
        { id: 'test-devops' }
      );

      // Step 2: Merge with nested overrides
      const nestedOverrides = {
        goal: {
          mainGoal: 'Manage infrastructure',
          subGoals: ['Deploy services', 'Monitor systems', 'Maintain uptime'],
          successCriteria: ['99.9% uptime', 'Zero downtime deployments'],
        },
        permissions: {
          canHire: true,
          maxSubordinates: 3,
          hiringBudget: 3,
          canFire: true,
        },
      };
      const mergedConfig = mergeConfigs(defaultConfig, nestedOverrides);

      // Step 3: Save
      await saveAgentConfig('test-devops', mergedConfig, { baseDir: testBaseDir });

      // Step 4: Load
      const loadedConfig = await loadAgentConfig('test-devops', { baseDir: testBaseDir });

      // Step 5: Verify all nested fields preserved
      expect(loadedConfig).toEqual(mergedConfig);
      expect(loadedConfig.goal.subGoals).toEqual(['Deploy services', 'Monitor systems', 'Maintain uptime']);
      expect(loadedConfig.goal.successCriteria).toEqual(['99.9% uptime', 'Zero downtime deployments']);
      expect(loadedConfig.permissions.canHire).toBe(true);
      expect(loadedConfig.permissions.canFire).toBe(true);
      expect(() => validateAgentConfigStrict(loadedConfig)).not.toThrow();
    });

    it('should handle multiple sequential merges before save', async () => {
      // Step 1: Generate default
      const defaultConfig = generateDefaultConfig(
        'Frontend Developer',
        'Build UI components',
        'CTO',
        { id: 'test-frontend' }
      );

      // Step 2: Apply first merge (base permissions)
      const firstMerge = mergeConfigs(defaultConfig, {
        permissions: {
          canHire: false,
          maxSubordinates: 0,
        },
      });

      // Step 3: Apply second merge (add goal details)
      const secondMerge = mergeConfigs(firstMerge, {
        goal: {
          mainGoal: 'Build UI components',
          subGoals: ['Create React components', 'Write tests'],
        },
      });

      // Step 4: Apply third merge (add framework config)
      const finalMerge = mergeConfigs(secondMerge, {
        framework: {
          primary: 'claude-code',
          fallback: 'opencode',
        },
      });

      // Step 5: Save final config
      await saveAgentConfig('test-frontend', finalMerge, { baseDir: testBaseDir });

      // Step 6: Load and verify all merges applied correctly
      const loadedConfig = await loadAgentConfig('test-frontend', { baseDir: testBaseDir });

      expect(loadedConfig.permissions.canHire).toBe(false);
      expect(loadedConfig.goal.subGoals).toContain('Create React components');
      expect(loadedConfig.framework.fallback).toBe('opencode');
      expect(() => validateAgentConfigStrict(loadedConfig)).not.toThrow();
    });
  });

  describe('Real-World Use Case Scenarios', () => {
    it('should support template-based agent creation workflow', async () => {
      // Scenario: Create multiple agents from a template with customizations

      // Create base template
      const template = generateDefaultConfig(
        'Developer',
        'Write code and tests',
        'Engineering Manager',
        {
          id: 'template-base',
        }
      );

      // Create backend developer from template
      const backendDev = mergeConfigs(template, {
        identity: {
          ...template.identity,
          id: 'backend-dev-001',
          role: 'Backend Developer',
          displayName: 'Alice - Backend Developer',
        },
        goal: {
          mainGoal: 'Implement REST API endpoints',
          subGoals: ['Write API tests', 'Document endpoints'],
        },
      });

      // Create frontend developer from template
      const frontendDev = mergeConfigs(template, {
        identity: {
          ...template.identity,
          id: 'frontend-dev-001',
          role: 'Frontend Developer',
          displayName: 'Bob - Frontend Developer',
        },
        goal: {
          mainGoal: 'Build React components',
          subGoals: ['Write component tests', 'Create stories'],
        },
      });

      // Save both configs
      await saveAgentConfig('backend-dev-001', backendDev, { baseDir: testBaseDir });
      await saveAgentConfig('frontend-dev-001', frontendDev, { baseDir: testBaseDir });

      // Load and verify both
      const loadedBackend = await loadAgentConfig('backend-dev-001', { baseDir: testBaseDir });
      const loadedFrontend = await loadAgentConfig('frontend-dev-001', { baseDir: testBaseDir });

      // Verify backend dev
      expect(loadedBackend.identity.role).toBe('Backend Developer');
      expect(loadedBackend.goal.mainGoal).toBe('Implement REST API endpoints');

      // Verify frontend dev
      expect(loadedFrontend.identity.role).toBe('Frontend Developer');
      expect(loadedFrontend.goal.mainGoal).toBe('Build React components');

      // Both should pass validation
      expect(() => validateAgentConfigStrict(loadedBackend)).not.toThrow();
      expect(() => validateAgentConfigStrict(loadedFrontend)).not.toThrow();
    });

    it('should support dynamic config updates workflow', async () => {
      // Scenario: Agent config needs to be updated after creation

      // Initial creation
      const initialConfig = generateDefaultConfig(
        'Support Agent',
        'Handle customer inquiries',
        'Support Manager',
        { id: 'support-001' }
      );
      await saveAgentConfig('support-001', initialConfig, { baseDir: testBaseDir });

      // Update 1: Add hiring permission
      const loadedV1 = await loadAgentConfig('support-001', { baseDir: testBaseDir });
      const updatedV1 = mergeConfigs(loadedV1, {
        permissions: {
          canHire: true,
          maxSubordinates: 2,
        },
      });
      await saveAgentConfig('support-001', updatedV1, { baseDir: testBaseDir });

      // Update 2: Add sub-goals
      const loadedV2 = await loadAgentConfig('support-001', { baseDir: testBaseDir });
      const updatedV2 = mergeConfigs(loadedV2, {
        goal: {
          mainGoal: 'Handle customer inquiries',
          subGoals: ['Respond to tickets', 'Escalate complex issues'],
        },
      });
      await saveAgentConfig('support-001', updatedV2, { baseDir: testBaseDir });

      // Final verification: Load and check all updates applied
      const finalConfig = await loadAgentConfig('support-001', { baseDir: testBaseDir });

      expect(finalConfig.permissions.canHire).toBe(true);
      expect(finalConfig.permissions.maxSubordinates).toBe(2);
      expect(finalConfig.goal.subGoals).toContain('Respond to tickets');
      expect(finalConfig.identity.role).toBe('Support Agent'); // Original fields preserved
      expect(() => validateAgentConfigStrict(finalConfig)).not.toThrow();
    });

    it('should support promotion workflow (agent gets new responsibilities)', async () => {
      // Scenario: Junior developer gets promoted to senior

      // Initial junior developer config
      const juniorConfig = generateDefaultConfig(
        'Junior Developer',
        'Learn and contribute to codebase',
        'Senior Developer',
        { id: 'dev-junior-001' }
      );
      await saveAgentConfig('dev-junior-001', juniorConfig, { baseDir: testBaseDir });

      // Promotion: Update to senior developer
      const promotedConfig = await loadAgentConfig('dev-junior-001', { baseDir: testBaseDir });
      const seniorConfig = mergeConfigs(promotedConfig, {
        identity: {
          ...promotedConfig.identity,
          role: 'Senior Developer',
          displayName: 'Alice - Senior Developer (Promoted)',
        },
        goal: {
          mainGoal: 'Lead feature development and mentor juniors',
          subGoals: ['Code review', 'Architecture decisions', 'Mentor junior developers'],
        },
        permissions: {
          canHire: true,
          maxSubordinates: 3,
          hiringBudget: 3,
        },
      });
      await saveAgentConfig('dev-junior-001', seniorConfig, { baseDir: testBaseDir });

      // Verify promotion applied correctly
      const verifyPromoted = await loadAgentConfig('dev-junior-001', { baseDir: testBaseDir });

      expect(verifyPromoted.identity.role).toBe('Senior Developer');
      expect(verifyPromoted.permissions.canHire).toBe(true);
      expect(verifyPromoted.permissions.maxSubordinates).toBe(3);
      expect(verifyPromoted.goal.subGoals).toContain('Mentor junior developers');
      expect(() => validateAgentConfigStrict(verifyPromoted)).not.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty overrides in merge workflow', async () => {
      const defaultConfig = generateDefaultConfig('Test Agent', 'Test goal', 'Manager', {
        id: 'test-empty-overrides',
      });
      const mergedConfig = mergeConfigs(defaultConfig, {});

      await saveAgentConfig('test-empty-overrides', mergedConfig, { baseDir: testBaseDir });
      const loadedConfig = await loadAgentConfig('test-empty-overrides', { baseDir: testBaseDir });

      expect(loadedConfig).toEqual(defaultConfig);
    });

    it('should handle null values in merge workflow', async () => {
      const defaultConfig = generateDefaultConfig('Test Agent', 'Test goal', 'Manager', {
        id: 'test-null-values',
        reportingTo: 'manager-001',
      });

      // Merge with null reportingTo (e.g., agent becomes independent)
      const mergedConfig = mergeConfigs(defaultConfig, {
        identity: {
          reportingTo: null,
        },
      });

      await saveAgentConfig('test-null-values', mergedConfig, { baseDir: testBaseDir });
      const loadedConfig = await loadAgentConfig('test-null-values', { baseDir: testBaseDir });

      expect(loadedConfig.identity.reportingTo).toBeNull();
    });

    it('should validate config at each step of workflow', async () => {
      // Generate should produce valid config
      const generated = generateDefaultConfig('Test', 'Goal', 'Creator', { id: 'test-validate' });
      expect(() => validateAgentConfigStrict(generated)).not.toThrow();

      // Merge should preserve validity
      const merged = mergeConfigs(generated, {
        permissions: { canHire: true, maxSubordinates: 3, hiringBudget: 2 },
      });
      expect(() => validateAgentConfigStrict(merged)).not.toThrow();

      // Save should validate before writing
      await expect(saveAgentConfig('test-validate', merged, { baseDir: testBaseDir })).resolves.not.toThrow();

      // Load should return valid config
      const loaded = await loadAgentConfig('test-validate', { baseDir: testBaseDir });
      expect(() => validateAgentConfigStrict(loaded)).not.toThrow();
    });

    it('should handle framework configuration in workflow', async () => {
      const config = generateDefaultConfig('Test Agent', 'Test goal', 'Manager', {
        id: 'test-framework',
        primaryFramework: 'opencode',
      });

      // Verify framework was set
      expect(config.framework.primary).toBe('opencode');

      await saveAgentConfig('test-framework', config, { baseDir: testBaseDir });
      const loaded = await loadAgentConfig('test-framework', { baseDir: testBaseDir });

      expect(loaded.framework.primary).toBe('opencode');
      expect(() => validateAgentConfigStrict(loaded)).not.toThrow();
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle rapid generate-merge-save-load cycles', async () => {
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5'];

      // Simulate rapid agent creation
      for (const agentId of agents) {
        const config = generateDefaultConfig(`Role ${agentId}`, `Goal for ${agentId}`, 'Manager', {
          id: agentId,
        });
        const canHire = Math.random() > 0.5;
        const merged = mergeConfigs(config, {
          permissions: {
            canHire,
            maxSubordinates: canHire ? 3 : 0,
            hiringBudget: canHire ? 2 : 0,
          },
        });
        await saveAgentConfig(agentId, merged, { baseDir: testBaseDir });
      }

      // Verify all agents created correctly
      for (const agentId of agents) {
        const loaded = await loadAgentConfig(agentId, { baseDir: testBaseDir });
        expect(loaded.identity.id).toBe(agentId);
        expect(() => validateAgentConfigStrict(loaded)).not.toThrow();
      }
    });

    it('should maintain data integrity through multiple updates', async () => {
      const agentId = 'test-integrity';
      const initial = generateDefaultConfig('Test', 'Goal', 'Manager', { id: agentId });
      await saveAgentConfig(agentId, initial, { baseDir: testBaseDir });

      // Perform 10 sequential updates
      for (let i = 1; i <= 10; i++) {
        const current = await loadAgentConfig(agentId, { baseDir: testBaseDir });
        const updated = mergeConfigs(current, {
          goal: {
            mainGoal: `Goal - Update ${i}`,
          },
        });
        await saveAgentConfig(agentId, updated, { baseDir: testBaseDir });
      }

      // Verify final state
      const final = await loadAgentConfig(agentId, { baseDir: testBaseDir });
      expect(final.goal.mainGoal).toBe('Goal - Update 10');
      expect(final.identity.role).toBe('Test'); // Original data preserved
      expect(() => validateAgentConfigStrict(final)).not.toThrow();
    });
  });
});
