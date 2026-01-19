/**
 * Business Logic Validation Module (Phase 2.1)
 *
 * Provides business logic validation for agent configurations beyond JSON schema validation.
 * This includes cross-field validation, organizational constraints, and business rules.
 */

import type { AgentConfig } from '@recursive-manager/common';

/**
 * Business validation error
 */
export interface BusinessValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
  suggestion?: string;
}

/**
 * Business validation result
 */
export interface BusinessValidationResult {
  valid: boolean;
  errors: BusinessValidationError[];
  warnings: BusinessValidationError[];
}

/**
 * Custom error class for business validation failures
 */
export class BusinessValidationFailure extends Error {
  public readonly errors: BusinessValidationError[];
  public readonly warnings: BusinessValidationError[];

  constructor(
    message: string,
    errors: BusinessValidationError[],
    warnings: BusinessValidationError[] = []
  ) {
    super(message);
    this.name = 'BusinessValidationFailure';
    this.errors = errors;
    this.warnings = warnings;
    Error.captureStackTrace(this, BusinessValidationFailure);
  }

  /**
   * Get a formatted error message with all validation errors and warnings
   */
  public getFormattedErrors(): string {
    const lines: string[] = [];

    if (this.errors.length > 0) {
      lines.push('ERRORS:');
      this.errors.forEach((err, idx) => {
        lines.push(`${idx + 1}. [${err.code}] ${err.field}: ${err.message}`);
        if (err.suggestion) {
          lines.push(`   Suggestion: ${err.suggestion}`);
        }
      });
    }

    if (this.warnings.length > 0) {
      if (lines.length > 0) {
        lines.push('');
      }
      lines.push('WARNINGS:');
      this.warnings.forEach((warn, idx) => {
        lines.push(`${idx + 1}. [${warn.code}] ${warn.field}: ${warn.message}`);
        if (warn.suggestion) {
          lines.push(`   Suggestion: ${warn.suggestion}`);
        }
      });
    }

    return lines.join('\n');
  }
}

/**
 * Validate agent configuration business logic
 *
 * This performs validation beyond schema validation, checking business rules
 * and cross-field constraints.
 *
 * @param config - Agent configuration to validate
 * @returns BusinessValidationResult with detailed error messages
 *
 * @example
 * ```typescript
 * const result = validateAgentConfigBusinessLogic(config);
 * if (!result.valid) {
 *   console.error('Validation failed:', result.errors);
 * }
 * if (result.warnings.length > 0) {
 *   console.warn('Warnings:', result.warnings);
 * }
 * ```
 */
export function validateAgentConfigBusinessLogic(config: AgentConfig): BusinessValidationResult {
  const errors: BusinessValidationError[] = [];
  const warnings: BusinessValidationError[] = [];

  // Validate permissions consistency
  validatePermissionsConsistency(config, errors, warnings);

  // Validate behavior settings
  validateBehaviorSettings(config, errors, warnings);

  // Validate communication settings
  validateCommunicationSettings(config, errors, warnings);

  // Validate delegation settings
  validateDelegationSettings(config, errors, warnings);

  // Validate escalation policy
  validateEscalationPolicy(config, errors, warnings);

  // Validate resource constraints
  validateResourceConstraints(config, errors, warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate that permissions are internally consistent
 */
function validatePermissionsConsistency(
  config: AgentConfig,
  errors: BusinessValidationError[],
  warnings: BusinessValidationError[]
): void {
  const { permissions } = config;

  // If canHire is false, maxSubordinates and hiringBudget should be 0
  if (!permissions.canHire) {
    if (permissions.maxSubordinates > 0) {
      warnings.push({
        field: 'permissions.maxSubordinates',
        message: 'maxSubordinates is set but canHire is false. This field will have no effect.',
        severity: 'warning',
        code: 'PERM_INCONSISTENT_HIRING',
        suggestion: 'Set maxSubordinates to 0 when canHire is false',
      });
    }
    if (permissions.hiringBudget > 0) {
      warnings.push({
        field: 'permissions.hiringBudget',
        message: 'hiringBudget is set but canHire is false. This field will have no effect.',
        severity: 'warning',
        code: 'PERM_INCONSISTENT_BUDGET',
        suggestion: 'Set hiringBudget to 0 when canHire is false',
      });
    }
  }

  // If canHire is true, maxSubordinates should be > 0
  if (permissions.canHire && permissions.maxSubordinates === 0) {
    errors.push({
      field: 'permissions.maxSubordinates',
      message: 'maxSubordinates must be greater than 0 when canHire is true',
      severity: 'error',
      code: 'PERM_INVALID_MAX_SUBORDINATES',
      suggestion: 'Set maxSubordinates to at least 1, or set canHire to false',
    });
  }

  // hiringBudget should not exceed maxSubordinates (only check when canHire is true)
  if (permissions.canHire && permissions.hiringBudget > permissions.maxSubordinates) {
    errors.push({
      field: 'permissions.hiringBudget',
      message: `hiringBudget (${permissions.hiringBudget}) cannot exceed maxSubordinates (${permissions.maxSubordinates})`,
      severity: 'error',
      code: 'PERM_BUDGET_EXCEEDS_MAX',
      suggestion: `Set hiringBudget to at most ${permissions.maxSubordinates}`,
    });
  }

  // If canAccessExternalAPIs is false, allowedDomains should be empty
  if (
    permissions.canAccessExternalAPIs === false &&
    permissions.allowedDomains &&
    permissions.allowedDomains.length > 0
  ) {
    warnings.push({
      field: 'permissions.allowedDomains',
      message:
        'allowedDomains is set but canAccessExternalAPIs is false. This field will have no effect.',
      severity: 'warning',
      code: 'PERM_INCONSISTENT_API_ACCESS',
      suggestion: 'Remove allowedDomains when canAccessExternalAPIs is false',
    });
  }

  // If canAccessExternalAPIs is true but allowedDomains is empty, warn
  if (
    permissions.canAccessExternalAPIs === true &&
    (!permissions.allowedDomains || permissions.allowedDomains.length === 0)
  ) {
    warnings.push({
      field: 'permissions.allowedDomains',
      message:
        'canAccessExternalAPIs is true but no allowedDomains are specified. Agent will not be able to access any external APIs.',
      severity: 'warning',
      code: 'PERM_NO_ALLOWED_DOMAINS',
      suggestion: 'Add domains to allowedDomains array, or set canAccessExternalAPIs to false',
    });
  }

  // maxDelegationDepth should be reasonable (warn if > 10)
  if (permissions.maxDelegationDepth && permissions.maxDelegationDepth > 10) {
    warnings.push({
      field: 'permissions.maxDelegationDepth',
      message: `maxDelegationDepth (${permissions.maxDelegationDepth}) is very high. This may lead to complex task hierarchies.`,
      severity: 'warning',
      code: 'PERM_HIGH_DELEGATION_DEPTH',
      suggestion: 'Consider limiting delegation depth to 10 or less for better task management',
    });
  }

  // Warn if workspaceQuotaMB is very high (> 10GB)
  if (permissions.workspaceQuotaMB && permissions.workspaceQuotaMB > 10240) {
    warnings.push({
      field: 'permissions.workspaceQuotaMB',
      message: `workspaceQuotaMB (${permissions.workspaceQuotaMB}MB) is very high. This may consume significant disk space.`,
      severity: 'warning',
      code: 'PERM_HIGH_QUOTA',
      suggestion: 'Consider a lower quota unless this agent requires significant storage',
    });
  }

  // Warn if maxExecutionMinutes is very high (> 240 minutes = 4 hours)
  if (permissions.maxExecutionMinutes && permissions.maxExecutionMinutes > 240) {
    warnings.push({
      field: 'permissions.maxExecutionMinutes',
      message: `maxExecutionMinutes (${permissions.maxExecutionMinutes}) is very high. Long-running executions may be hard to debug.`,
      severity: 'warning',
      code: 'PERM_HIGH_EXECUTION_TIME',
      suggestion: 'Consider limiting execution time to 240 minutes (4 hours) or less',
    });
  }
}

/**
 * Validate behavior settings
 */
function validateBehaviorSettings(
  config: AgentConfig,
  errors: BusinessValidationError[],
  warnings: BusinessValidationError[]
): void {
  if (!config.behavior) {
    return;
  }

  const { behavior } = config;

  // Validate verbosity level
  if (behavior.verbosity !== undefined && (behavior.verbosity < 1 || behavior.verbosity > 5)) {
    errors.push({
      field: 'behavior.verbosity',
      message: `verbosity must be between 1 and 5, got ${behavior.verbosity}`,
      severity: 'error',
      code: 'BEHAVIOR_INVALID_VERBOSITY',
      suggestion: 'Set verbosity to a value between 1 (minimal) and 5 (very verbose)',
    });
  }

  // Validate maxExecutionTime consistency with permissions
  if (behavior.maxExecutionTime && config.permissions.maxExecutionMinutes) {
    if (behavior.maxExecutionTime > config.permissions.maxExecutionMinutes) {
      errors.push({
        field: 'behavior.maxExecutionTime',
        message: `behavior.maxExecutionTime (${behavior.maxExecutionTime}) exceeds permissions.maxExecutionMinutes (${config.permissions.maxExecutionMinutes})`,
        severity: 'error',
        code: 'BEHAVIOR_EXCEEDS_PERMISSION',
        suggestion: `Set behavior.maxExecutionTime to at most ${config.permissions.maxExecutionMinutes} minutes`,
      });
    }
  }

  // Validate escalationTimeoutMinutes
  if (behavior.escalationTimeoutMinutes !== undefined && behavior.escalationTimeoutMinutes < 1) {
    errors.push({
      field: 'behavior.escalationTimeoutMinutes',
      message: 'escalationTimeoutMinutes must be at least 1 minute',
      severity: 'error',
      code: 'BEHAVIOR_INVALID_ESCALATION_TIMEOUT',
      suggestion: 'Set escalationTimeoutMinutes to at least 1',
    });
  }

  // Warn if escalationTimeoutMinutes is very short (< 5 minutes)
  if (behavior.escalationTimeoutMinutes && behavior.escalationTimeoutMinutes < 5) {
    warnings.push({
      field: 'behavior.escalationTimeoutMinutes',
      message: `escalationTimeoutMinutes (${behavior.escalationTimeoutMinutes}) is very short. Tasks may escalate too quickly.`,
      severity: 'warning',
      code: 'BEHAVIOR_SHORT_ESCALATION_TIMEOUT',
      suggestion: 'Consider setting escalationTimeoutMinutes to at least 5 minutes',
    });
  }

  // Validate autoEscalateBlockedTasks requires canEscalate permission
  if (behavior.autoEscalateBlockedTasks === true && config.permissions.canEscalate === false) {
    errors.push({
      field: 'behavior.autoEscalateBlockedTasks',
      message: 'autoEscalateBlockedTasks is true but canEscalate permission is false',
      severity: 'error',
      code: 'BEHAVIOR_ESCALATE_WITHOUT_PERMISSION',
      suggestion: 'Either set autoEscalateBlockedTasks to false or grant canEscalate permission',
    });
  }

  // Validate multi-perspective analysis settings
  if (
    behavior.multiPerspectiveAnalysis?.enabled &&
    behavior.multiPerspectiveAnalysis.perspectives
  ) {
    if (behavior.multiPerspectiveAnalysis.perspectives.length === 0) {
      errors.push({
        field: 'behavior.multiPerspectiveAnalysis.perspectives',
        message: 'Multi-perspective analysis is enabled but no perspectives are specified',
        severity: 'error',
        code: 'BEHAVIOR_NO_PERSPECTIVES',
        suggestion: 'Add at least one perspective or disable multi-perspective analysis',
      });
    }
  }
}

/**
 * Validate communication settings
 */
function validateCommunicationSettings(
  config: AgentConfig,
  _errors: BusinessValidationError[],
  warnings: BusinessValidationError[]
): void {
  if (!config.communication) {
    return;
  }

  const { communication } = config;

  // Validate that if a channel is preferred, the corresponding config is present
  if (communication.preferredChannels) {
    communication.preferredChannels.forEach((channel: string) => {
      if (channel === 'slack' && !communication.slackChannel) {
        warnings.push({
          field: 'communication.slackChannel',
          message: 'Slack is listed as a preferred channel but slackChannel is not configured',
          severity: 'warning',
          code: 'COMM_MISSING_SLACK_CONFIG',
          suggestion: 'Set slackChannel or remove "slack" from preferredChannels',
        });
      }
      if (channel === 'telegram' && !communication.telegramChatId) {
        warnings.push({
          field: 'communication.telegramChatId',
          message: 'Telegram is listed as a preferred channel but telegramChatId is not configured',
          severity: 'warning',
          code: 'COMM_MISSING_TELEGRAM_CONFIG',
          suggestion: 'Set telegramChatId or remove "telegram" from preferredChannels',
        });
      }
      if (channel === 'email' && !communication.emailAddress) {
        warnings.push({
          field: 'communication.emailAddress',
          message: 'Email is listed as a preferred channel but emailAddress is not configured',
          severity: 'warning',
          code: 'COMM_MISSING_EMAIL_CONFIG',
          suggestion: 'Set emailAddress or remove "email" from preferredChannels',
        });
      }
    });
  }

  // Validate that if notification settings reference manager, agent has a manager
  if (communication.notifyManager && !config.identity.reportingTo) {
    warnings.push({
      field: 'communication.notifyManager',
      message: 'Manager notifications are configured but agent has no reportingTo manager',
      severity: 'warning',
      code: 'COMM_NO_MANAGER',
      suggestion: 'Either set identity.reportingTo or remove notifyManager configuration',
    });
  }
}

/**
 * Validate delegation settings
 */
function validateDelegationSettings(
  config: AgentConfig,
  _errors: BusinessValidationError[],
  warnings: BusinessValidationError[]
): void {
  if (!config.behavior?.delegation) {
    return;
  }

  const { delegation } = config.behavior;

  // If delegateThreshold is not 'never', agent should have canHire permission
  if (
    delegation.delegateThreshold &&
    delegation.delegateThreshold !== 'never' &&
    !config.permissions.canHire
  ) {
    warnings.push({
      field: 'behavior.delegation.delegateThreshold',
      message: `Delegation threshold is set to "${delegation.delegateThreshold}" but agent cannot hire subordinates`,
      severity: 'warning',
      code: 'DELEGATION_WITHOUT_HIRE_PERMISSION',
      suggestion: 'Either set delegateThreshold to "never" or grant canHire permission',
    });
  }

  // If keepWhenDelegating is true, warn about supervision overhead
  if (delegation.keepWhenDelegating && delegation.supervisionLevel === 'strict') {
    warnings.push({
      field: 'behavior.delegation.supervisionLevel',
      message:
        'Both keepWhenDelegating and strict supervision are enabled. This may create high overhead.',
      severity: 'warning',
      code: 'DELEGATION_HIGH_OVERHEAD',
      suggestion: 'Consider using "moderate" supervision level to reduce overhead',
    });
  }
}

/**
 * Validate escalation policy
 */
function validateEscalationPolicy(
  config: AgentConfig,
  errors: BusinessValidationError[],
  warnings: BusinessValidationError[]
): void {
  if (!config.behavior?.escalationPolicy) {
    return;
  }

  const { escalationPolicy } = config.behavior;

  // If any escalation setting is enabled, agent should have canEscalate permission
  const hasEscalationEnabled =
    escalationPolicy.escalateOnBlockedTask ||
    escalationPolicy.escalateOnBudgetExceeded ||
    (escalationPolicy.autoEscalateAfterFailures && escalationPolicy.autoEscalateAfterFailures > 0);

  if (hasEscalationEnabled && config.permissions.canEscalate === false) {
    errors.push({
      field: 'behavior.escalationPolicy',
      message: 'Escalation policy is configured but canEscalate permission is false',
      severity: 'error',
      code: 'ESCALATION_WITHOUT_PERMISSION',
      suggestion: 'Either disable escalation settings or grant canEscalate permission',
    });
  }

  // If escalation is enabled, agent should have a manager
  if (hasEscalationEnabled && !config.identity.reportingTo) {
    warnings.push({
      field: 'behavior.escalationPolicy',
      message: 'Escalation policy is configured but agent has no reportingTo manager',
      severity: 'warning',
      code: 'ESCALATION_NO_MANAGER',
      suggestion: 'Set identity.reportingTo to enable escalation',
    });
  }

  // Validate autoEscalateAfterFailures is reasonable
  if (
    escalationPolicy.autoEscalateAfterFailures !== undefined &&
    escalationPolicy.autoEscalateAfterFailures > 0 &&
    escalationPolicy.autoEscalateAfterFailures < 1
  ) {
    errors.push({
      field: 'behavior.escalationPolicy.autoEscalateAfterFailures',
      message: 'autoEscalateAfterFailures must be at least 1',
      severity: 'error',
      code: 'ESCALATION_INVALID_FAILURE_COUNT',
      suggestion: 'Set autoEscalateAfterFailures to at least 1, or remove it to disable',
    });
  }
}

/**
 * Validate resource constraints
 */
function validateResourceConstraints(
  config: AgentConfig,
  _errors: BusinessValidationError[],
  warnings: BusinessValidationError[]
): void {
  const { behavior, permissions } = config;

  // If maxCostPerExecution is set, warn if it's very high
  if (behavior?.maxCostPerExecution && behavior.maxCostPerExecution > 100) {
    warnings.push({
      field: 'behavior.maxCostPerExecution',
      message: `maxCostPerExecution ($${behavior.maxCostPerExecution}) is very high. This may incur significant costs.`,
      severity: 'warning',
      code: 'RESOURCE_HIGH_COST',
      suggestion:
        'Consider setting a lower cost limit unless this agent requires expensive operations',
    });
  }

  // Validate that resource limits are set for agents that can hire
  if (permissions.canHire && !permissions.workspaceQuotaMB) {
    warnings.push({
      field: 'permissions.workspaceQuotaMB',
      message: 'Agent can hire subordinates but has no workspace quota limit',
      severity: 'warning',
      code: 'RESOURCE_NO_QUOTA',
      suggestion: 'Set workspaceQuotaMB to prevent unbounded disk usage by subordinate tree',
    });
  }
}

/**
 * Validate agent configuration business logic and throw on error
 *
 * @param config - Agent configuration to validate
 * @throws {BusinessValidationFailure} If validation fails
 *
 * @example
 * ```typescript
 * try {
 *   validateAgentConfigBusinessLogicStrict(config);
 *   // Config is valid
 * } catch (error) {
 *   if (error instanceof BusinessValidationFailure) {
 *     console.error(error.getFormattedErrors());
 *   }
 * }
 * ```
 */
export function validateAgentConfigBusinessLogicStrict(config: AgentConfig): void {
  const result = validateAgentConfigBusinessLogic(config);
  if (!result.valid) {
    throw new BusinessValidationFailure(
      `Agent configuration business validation failed with ${result.errors.length} error(s)`,
      result.errors,
      result.warnings
    );
  }
}
