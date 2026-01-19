/**
 * Tests for Business Logic Validation (Phase 2.1)
 */

import {
  validateAgentConfigBusinessLogic,
  validateAgentConfigBusinessLogicStrict,
  BusinessValidationFailure,
} from '../business-validation';
import { mergeConfigs } from '../../config';
import type { AgentConfig } from '@recursive-manager/common';

// Type for deep partial config overrides
type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

describe('Business Validation', () => {
  // Helper to create a minimal valid config
  const createValidConfig = (overrides: DeepPartial<AgentConfig> = {}): AgentConfig => {
    const baseConfig: AgentConfig = {
      version: '1.0.0',
      identity: {
        id: 'test-agent',
        role: 'Test Role',
        displayName: 'Test Agent',
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        reportingTo: 'manager',
      },
      goal: {
        mainGoal: 'Test goal',
      },
      permissions: {
        canHire: false,
        maxSubordinates: 0,
        hiringBudget: 0,
        canFire: false,
        canEscalate: true,
        canAccessExternalAPIs: false,
        maxDelegationDepth: 5,
        workspaceQuotaMB: 1024,
        maxExecutionMinutes: 60,
      },
      framework: {
        primary: 'claude-code',
        fallback: 'opencode',
      },
    };

    return mergeConfigs(baseConfig, overrides);
  };

  describe('validateAgentConfigBusinessLogic', () => {
    it('should validate a valid configuration', () => {
      const config = createValidConfig();
      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return warnings for non-critical issues', () => {
      const config = createValidConfig({
        permissions: {
          canHire: false,
          maxSubordinates: 5, // Warning: canHire is false but maxSubordinates > 0
          hiringBudget: 0,
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true); // No errors, just warnings
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]?.code).toBe('PERM_INCONSISTENT_HIRING');
    });
  });

  describe('Permissions Validation', () => {
    describe('Hiring permissions', () => {
      it('should error if canHire is true but maxSubordinates is 0', () => {
        const config = createValidConfig({
          permissions: {
            canHire: true,
            maxSubordinates: 0,
            hiringBudget: 0,
          },
        });

        const result = validateAgentConfigBusinessLogic(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'permissions.maxSubordinates',
            code: 'PERM_INVALID_MAX_SUBORDINATES',
            severity: 'error',
          })
        );
      });

      it('should warn if canHire is false but maxSubordinates > 0', () => {
        const config = createValidConfig({
          permissions: {
            canHire: false,
            maxSubordinates: 5,
            hiringBudget: 0,
          },
        });

        const result = validateAgentConfigBusinessLogic(config);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            field: 'permissions.maxSubordinates',
            code: 'PERM_INCONSISTENT_HIRING',
            severity: 'warning',
          })
        );
      });

      it('should warn if canHire is false but hiringBudget > 0', () => {
        const config = createValidConfig({
          permissions: {
            canHire: false,
            maxSubordinates: 0,
            hiringBudget: 5,
          },
        });

        const result = validateAgentConfigBusinessLogic(config);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            field: 'permissions.hiringBudget',
            code: 'PERM_INCONSISTENT_BUDGET',
            severity: 'warning',
          })
        );
      });

      it('should error if hiringBudget exceeds maxSubordinates', () => {
        const config = createValidConfig({
          permissions: {
            canHire: true,
            maxSubordinates: 5,
            hiringBudget: 10,
          },
        });

        const result = validateAgentConfigBusinessLogic(config);

        expect(result.valid).toBe(false);
        expect(result.errors).toContainEqual(
          expect.objectContaining({
            field: 'permissions.hiringBudget',
            code: 'PERM_BUDGET_EXCEEDS_MAX',
            severity: 'error',
          })
        );
      });
    });

    describe('API access permissions', () => {
      it('should warn if canAccessExternalAPIs is false but allowedDomains is set', () => {
        const config = createValidConfig({
          permissions: {
            canHire: false,
            maxSubordinates: 0,
            hiringBudget: 0,
            canAccessExternalAPIs: false,
            allowedDomains: ['example.com'],
          },
        });

        const result = validateAgentConfigBusinessLogic(config);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            field: 'permissions.allowedDomains',
            code: 'PERM_INCONSISTENT_API_ACCESS',
            severity: 'warning',
          })
        );
      });

      it('should warn if canAccessExternalAPIs is true but allowedDomains is empty', () => {
        const config = createValidConfig({
          permissions: {
            canHire: false,
            maxSubordinates: 0,
            hiringBudget: 0,
            canAccessExternalAPIs: true,
            allowedDomains: [],
          },
        });

        const result = validateAgentConfigBusinessLogic(config);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            field: 'permissions.allowedDomains',
            code: 'PERM_NO_ALLOWED_DOMAINS',
            severity: 'warning',
          })
        );
      });
    });

    describe('Resource limits', () => {
      it('should warn if maxDelegationDepth is very high', () => {
        const config = createValidConfig({
          permissions: {
            canHire: false,
            maxSubordinates: 0,
            hiringBudget: 0,
            maxDelegationDepth: 15,
          },
        });

        const result = validateAgentConfigBusinessLogic(config);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            field: 'permissions.maxDelegationDepth',
            code: 'PERM_HIGH_DELEGATION_DEPTH',
            severity: 'warning',
          })
        );
      });

      it('should warn if workspaceQuotaMB is very high', () => {
        const config = createValidConfig({
          permissions: {
            canHire: false,
            maxSubordinates: 0,
            hiringBudget: 0,
            workspaceQuotaMB: 20480, // 20GB
          },
        });

        const result = validateAgentConfigBusinessLogic(config);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            field: 'permissions.workspaceQuotaMB',
            code: 'PERM_HIGH_QUOTA',
            severity: 'warning',
          })
        );
      });

      it('should warn if maxExecutionMinutes is very high', () => {
        const config = createValidConfig({
          permissions: {
            canHire: false,
            maxSubordinates: 0,
            hiringBudget: 0,
            maxExecutionMinutes: 300, // 5 hours
          },
        });

        const result = validateAgentConfigBusinessLogic(config);

        expect(result.valid).toBe(true);
        expect(result.warnings).toContainEqual(
          expect.objectContaining({
            field: 'permissions.maxExecutionMinutes',
            code: 'PERM_HIGH_EXECUTION_TIME',
            severity: 'warning',
          })
        );
      });
    });
  });

  describe('Behavior Validation', () => {
    it('should error if verbosity is out of range', () => {
      const config = createValidConfig({
        behavior: {
          verbosity: 10,
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'behavior.verbosity',
          code: 'BEHAVIOR_INVALID_VERBOSITY',
          severity: 'error',
        })
      );
    });

    it('should error if maxExecutionTime exceeds permissions', () => {
      const config = createValidConfig({
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          maxExecutionMinutes: 60,
        },
        behavior: {
          maxExecutionTime: 120, // Exceeds permission limit
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'behavior.maxExecutionTime',
          code: 'BEHAVIOR_EXCEEDS_PERMISSION',
          severity: 'error',
        })
      );
    });

    it('should error if escalationTimeoutMinutes is less than 1', () => {
      const config = createValidConfig({
        behavior: {
          escalationTimeoutMinutes: 0,
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'behavior.escalationTimeoutMinutes',
          code: 'BEHAVIOR_INVALID_ESCALATION_TIMEOUT',
          severity: 'error',
        })
      );
    });

    it('should warn if escalationTimeoutMinutes is very short', () => {
      const config = createValidConfig({
        behavior: {
          escalationTimeoutMinutes: 2,
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'behavior.escalationTimeoutMinutes',
          code: 'BEHAVIOR_SHORT_ESCALATION_TIMEOUT',
          severity: 'warning',
        })
      );
    });

    it('should error if autoEscalateBlockedTasks is true but canEscalate is false', () => {
      const config = createValidConfig({
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          canEscalate: false,
        },
        behavior: {
          autoEscalateBlockedTasks: true,
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'behavior.autoEscalateBlockedTasks',
          code: 'BEHAVIOR_ESCALATE_WITHOUT_PERMISSION',
          severity: 'error',
        })
      );
    });

    it('should error if multi-perspective analysis is enabled but no perspectives are specified', () => {
      const config = createValidConfig({
        behavior: {
          multiPerspectiveAnalysis: {
            enabled: true,
            perspectives: [],
          },
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'behavior.multiPerspectiveAnalysis.perspectives',
          code: 'BEHAVIOR_NO_PERSPECTIVES',
          severity: 'error',
        })
      );
    });
  });

  describe('Communication Validation', () => {
    it('should warn if Slack is preferred but not configured', () => {
      const config = createValidConfig({
        communication: {
          preferredChannels: ['slack'],
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'communication.slackChannel',
          code: 'COMM_MISSING_SLACK_CONFIG',
          severity: 'warning',
        })
      );
    });

    it('should warn if Telegram is preferred but not configured', () => {
      const config = createValidConfig({
        communication: {
          preferredChannels: ['telegram'],
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'communication.telegramChatId',
          code: 'COMM_MISSING_TELEGRAM_CONFIG',
          severity: 'warning',
        })
      );
    });

    it('should warn if email is preferred but not configured', () => {
      const config = createValidConfig({
        communication: {
          preferredChannels: ['email'],
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'communication.emailAddress',
          code: 'COMM_MISSING_EMAIL_CONFIG',
          severity: 'warning',
        })
      );
    });

    it('should warn if notifyManager is configured but agent has no manager', () => {
      const config = createValidConfig({
        identity: {
          id: 'test-agent',
          role: 'Test Role',
          displayName: 'Test Agent',
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          reportingTo: null, // No manager
        },
        communication: {
          notifyManager: {
            onTaskComplete: true,
          },
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'communication.notifyManager',
          code: 'COMM_NO_MANAGER',
          severity: 'warning',
        })
      );
    });
  });

  describe('Delegation Validation', () => {
    it('should warn if delegation is configured but agent cannot hire', () => {
      const config = createValidConfig({
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
        behavior: {
          delegation: {
            delegateThreshold: 'complex',
          },
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'behavior.delegation.delegateThreshold',
          code: 'DELEGATION_WITHOUT_HIRE_PERMISSION',
          severity: 'warning',
        })
      );
    });

    it('should warn if both keepWhenDelegating and strict supervision are enabled', () => {
      const config = createValidConfig({
        behavior: {
          delegation: {
            keepWhenDelegating: true,
            supervisionLevel: 'strict',
          },
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'behavior.delegation.supervisionLevel',
          code: 'DELEGATION_HIGH_OVERHEAD',
          severity: 'warning',
        })
      );
    });
  });

  describe('Escalation Policy Validation', () => {
    it('should error if escalation is configured but canEscalate is false', () => {
      const config = createValidConfig({
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          canEscalate: false,
        },
        behavior: {
          escalationPolicy: {
            escalateOnBlockedTask: true,
          },
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'behavior.escalationPolicy',
          code: 'ESCALATION_WITHOUT_PERMISSION',
          severity: 'error',
        })
      );
    });

    it('should warn if escalation is configured but agent has no manager', () => {
      const config = createValidConfig({
        identity: {
          id: 'test-agent',
          role: 'Test Role',
          displayName: 'Test Agent',
          createdAt: new Date().toISOString(),
          createdBy: 'system',
          reportingTo: null, // No manager
        },
        permissions: {
          canHire: false,
          maxSubordinates: 0,
          hiringBudget: 0,
          canEscalate: true,
        },
        behavior: {
          escalationPolicy: {
            escalateOnBlockedTask: true,
          },
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'behavior.escalationPolicy',
          code: 'ESCALATION_NO_MANAGER',
          severity: 'warning',
        })
      );
    });

    it('should not error if autoEscalateAfterFailures is 0 (disabled)', () => {
      const config = createValidConfig({
        behavior: {
          escalationPolicy: {
            autoEscalateAfterFailures: 0,
          },
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      // 0 means disabled, should not error
      expect(result.valid).toBe(true);
    });
  });

  describe('Resource Constraints Validation', () => {
    it('should warn if maxCostPerExecution is very high', () => {
      const config = createValidConfig({
        behavior: {
          maxCostPerExecution: 150,
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      expect(result.valid).toBe(true);
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'behavior.maxCostPerExecution',
          code: 'RESOURCE_HIGH_COST',
          severity: 'warning',
        })
      );
    });

    it('should warn if agent can hire but has no workspace quota', () => {
      const config = createValidConfig({
        permissions: {
          canHire: true,
          maxSubordinates: 5,
          hiringBudget: 3,
          workspaceQuotaMB: undefined,
        },
      });

      const result = validateAgentConfigBusinessLogic(config);

      // This should have warnings but might still be valid
      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'permissions.workspaceQuotaMB',
          code: 'RESOURCE_NO_QUOTA',
          severity: 'warning',
        })
      );
    });
  });

  describe('validateAgentConfigBusinessLogicStrict', () => {
    it('should not throw for valid configuration', () => {
      const config = createValidConfig();

      expect(() => {
        validateAgentConfigBusinessLogicStrict(config);
      }).not.toThrow();
    });

    it('should throw BusinessValidationFailure for invalid configuration', () => {
      const config = createValidConfig({
        permissions: {
          canHire: true,
          maxSubordinates: 0, // Error: canHire is true but maxSubordinates is 0
          hiringBudget: 0,
        },
      });

      expect(() => {
        validateAgentConfigBusinessLogicStrict(config);
      }).toThrow(BusinessValidationFailure);
    });

    it('should include formatted errors in exception', () => {
      const config = createValidConfig({
        permissions: {
          canHire: true,
          maxSubordinates: 0,
          hiringBudget: 0,
        },
      });

      try {
        validateAgentConfigBusinessLogicStrict(config);
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessValidationFailure);
        if (error instanceof BusinessValidationFailure) {
          const formatted = error.getFormattedErrors();
          expect(formatted).toContain('PERM_INVALID_MAX_SUBORDINATES');
        }
      }
    });
  });
});
