/**
 * Agent Hiring Validation (Task 2.2.1)
 *
 * This module validates all preconditions for hiring a new agent:
 * - Permission checks (canHire permission)
 * - Budget validation (maxSubordinates, hiringBudget)
 * - Rate limiting (5 hires per hour max)
 * - Cycle detection (prevent circular reporting)
 * - Self-hire prevention
 *
 * Edge Cases Handled:
 * - EC-1.1: Agent hiring itself
 * - EC-1.3: Circular reporting structures
 * - EC-1.4: Hiring sprees
 */

import Database from 'better-sqlite3';
import { AgentConfig } from '@recursive-manager/common';
import { loadAgentConfig } from '../config';
import { getAgent, getSubordinates } from '@recursive-manager/common';
import { queryAuditLog, AuditAction } from '@recursive-manager/common';

/**
 * Validation error details
 */
export interface ValidationError {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

/**
 * Result of hire validation
 */
export interface HireValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings?: ValidationError[];
}

/**
 * Custom error for hire validation failures
 */
export class HireValidationError extends Error {
  public readonly errors: ValidationError[];
  public readonly warnings: ValidationError[];

  constructor(errors: ValidationError[], warnings: ValidationError[] = []) {
    const errorMessages = errors.map((e) => `${e.code}: ${e.message}`).join('; ');
    super(`Hire validation failed: ${errorMessages}`);
    this.name = 'HireValidationError';
    this.errors = errors;
    this.warnings = warnings;
    Error.captureStackTrace(this, HireValidationError);
  }

  /**
   * Get formatted error messages for display
   */
  getFormattedErrors(): string {
    let result = 'Hire validation failed:\n\nErrors:\n';
    for (const error of this.errors) {
      result += `  - [${error.code}] ${error.message}\n`;
      if (error.context) {
        result += `    Context: ${JSON.stringify(error.context, null, 2)}\n`;
      }
    }

    if (this.warnings.length > 0) {
      result += '\nWarnings:\n';
      for (const warning of this.warnings) {
        result += `  - [${warning.code}] ${warning.message}\n`;
        if (warning.context) {
          result += `    Context: ${JSON.stringify(warning.context, null, 2)}\n`;
        }
      }
    }

    return result;
  }
}

/**
 * Detect if hiring newAgentId to report to managerId would create a cycle
 *
 * Uses graph traversal to check if managerId is already a descendant of newAgentId
 * in the organizational hierarchy. This prevents circular reporting structures.
 *
 * @param db - Database instance
 * @param newAgentId - ID of the agent being hired
 * @param managerId - ID of the manager (agent doing the hiring)
 * @returns true if a cycle would be created, false otherwise
 *
 * Algorithm:
 * - Start from managerId
 * - Follow reporting_to chain upward
 * - If we encounter newAgentId, there's a cycle
 * - If we reach null (root) or max depth, no cycle
 */
export function detectCycle(
  db: Database.Database,
  newAgentId: string,
  managerId: string
): boolean {
  // Self-hire check (EC-1.1)
  if (newAgentId === managerId) {
    return true;
  }

  // Traverse up the hierarchy from managerId
  const visited = new Set<string>();
  let currentId: string | null = managerId;
  const maxDepth = 100; // Safety limit
  let depth = 0;

  while (currentId !== null && depth < maxDepth) {
    // Check if we've found the new agent in the ancestor chain
    if (currentId === newAgentId) {
      return true; // Cycle detected
    }

    // Prevent infinite loops
    if (visited.has(currentId)) {
      return true; // Already visited = cycle exists
    }

    visited.add(currentId);

    // Get the current agent's manager
    const agent = getAgent(db, currentId);
    if (!agent) {
      break; // Agent doesn't exist
    }

    currentId = agent.reporting_to;
    depth++;
  }

  return false; // No cycle detected
}

/**
 * Check if manager has remaining hiring budget
 *
 * Compares the current number of subordinates against:
 * - maxSubordinates (hard limit)
 * - hiringBudget (soft limit, can be exceeded with approval)
 *
 * @param db - Database instance
 * @param managerId - ID of the agent doing the hiring
 * @param managerConfig - Manager's configuration
 * @returns Validation errors if budget exceeded
 */
export function checkHiringBudget(
  db: Database.Database,
  managerId: string,
  managerConfig: AgentConfig
): ValidationError[] {
  const errors: ValidationError[] = [];
  const subordinates = getSubordinates(db, managerId);
  const currentCount = subordinates.length;

  const { maxSubordinates, hiringBudget } = managerConfig.permissions;

  // Check hard limit
  if (currentCount >= maxSubordinates) {
    errors.push({
      code: 'MAX_SUBORDINATES_EXCEEDED',
      message: `Manager ${managerId} has reached maximum subordinate limit`,
      context: {
        currentCount,
        maxSubordinates,
      },
    });
  }

  // Check soft limit (hiring budget)
  if (currentCount >= hiringBudget) {
    errors.push({
      code: 'HIRING_BUDGET_EXCEEDED',
      message: `Manager ${managerId} has exceeded hiring budget`,
      context: {
        currentCount,
        hiringBudget,
        note: 'Additional hires may require approval from manager',
      },
    });
  }

  return errors;
}

/**
 * Check if manager has exceeded hiring rate limit
 *
 * Prevents hiring sprees by limiting to 5 hires per hour (EC-1.4)
 *
 * @param db - Database instance
 * @param managerId - ID of the agent doing the hiring
 * @returns Validation errors if rate limit exceeded
 */
export function checkRateLimit(
  db: Database.Database,
  managerId: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  const RATE_LIMIT = 5; // Max hires per hour
  const WINDOW_HOURS = 1;

  // Calculate time window (1 hour ago)
  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - WINDOW_HOURS);

  // Query audit log for recent hires
  const recentHires = queryAuditLog(db, {
    agentId: managerId,
    action: AuditAction.HIRE,
    success: true,
    startTime: oneHourAgo.toISOString(),
  });

  if (recentHires.length >= RATE_LIMIT) {
    errors.push({
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Manager ${managerId} has exceeded hiring rate limit`,
      context: {
        limit: RATE_LIMIT,
        windowHours: WINDOW_HOURS,
        recentHires: recentHires.length,
        oldestHireTime: recentHires[recentHires.length - 1]?.timestamp,
      },
    });
  }

  return errors;
}

/**
 * Validate all preconditions for hiring a new agent
 *
 * This is the main validation function that orchestrates all hiring checks.
 *
 * Validation Checks:
 * 1. Manager exists and is active
 * 2. Manager has canHire permission
 * 3. New agent ID doesn't already exist
 * 4. No cycle would be created (EC-1.3)
 * 5. Manager hasn't exceeded maxSubordinates
 * 6. Manager has hiring budget remaining
 * 7. Manager hasn't exceeded rate limit (EC-1.4)
 * 8. Self-hire prevention (EC-1.1)
 *
 * @param db - Database instance
 * @param managerId - ID of the agent doing the hiring
 * @param newAgentId - ID of the agent being hired
 * @param newAgentConfig - Optional: Configuration of agent being hired (for validation)
 * @returns HireValidationResult with errors and warnings
 *
 * @example
 * ```typescript
 * const result = validateHire(db, 'ceo-001', 'cto-001');
 * if (!result.valid) {
 *   throw new HireValidationError(result.errors, result.warnings);
 * }
 * ```
 */
export function validateHire(
  db: Database.Database,
  managerId: string,
  newAgentId: string,
  newAgentConfig?: AgentConfig
): HireValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1. Check if manager exists and is active
  const manager = getAgent(db, managerId);
  if (!manager) {
    errors.push({
      code: 'MANAGER_NOT_FOUND',
      message: `Manager agent ${managerId} does not exist`,
      context: { managerId },
    });
    return { valid: false, errors, warnings };
  }

  if (manager.status !== 'active') {
    errors.push({
      code: 'MANAGER_NOT_ACTIVE',
      message: `Manager agent ${managerId} is not active (status: ${manager.status})`,
      context: {
        managerId,
        status: manager.status,
      },
    });
    return { valid: false, errors, warnings };
  }

  // Load manager configuration
  let managerConfig: AgentConfig;
  try {
    managerConfig = loadAgentConfig(managerId);
  } catch (error) {
    errors.push({
      code: 'MANAGER_CONFIG_LOAD_ERROR',
      message: `Failed to load manager configuration: ${error instanceof Error ? error.message : String(error)}`,
      context: { managerId },
    });
    return { valid: false, errors, warnings };
  }

  // 2. Check if manager has canHire permission
  if (!managerConfig.permissions.canHire) {
    errors.push({
      code: 'NO_HIRE_PERMISSION',
      message: `Manager ${managerId} does not have permission to hire subordinates`,
      context: {
        managerId,
        canHire: false,
      },
    });
    return { valid: false, errors, warnings };
  }

  // 3. Check if new agent ID already exists
  const existingAgent = getAgent(db, newAgentId);
  if (existingAgent) {
    errors.push({
      code: 'AGENT_ALREADY_EXISTS',
      message: `Agent with ID ${newAgentId} already exists`,
      context: {
        newAgentId,
        existingStatus: existingAgent.status,
      },
    });
  }

  // 4. Check for cycles (EC-1.1 self-hire, EC-1.3 circular reporting)
  if (detectCycle(db, newAgentId, managerId)) {
    if (newAgentId === managerId) {
      errors.push({
        code: 'SELF_HIRE_FORBIDDEN',
        message: `Agent ${managerId} cannot hire itself`,
        context: { managerId, newAgentId },
      });
    } else {
      errors.push({
        code: 'CIRCULAR_REPORTING_DETECTED',
        message: `Hiring ${newAgentId} to report to ${managerId} would create a circular reporting structure`,
        context: {
          managerId,
          newAgentId,
        },
      });
    }
  }

  // 5 & 6. Check hiring budget and subordinate limits
  const budgetErrors = checkHiringBudget(db, managerId, managerConfig);
  errors.push(...budgetErrors);

  // 7. Check rate limit (EC-1.4)
  const rateLimitErrors = checkRateLimit(db, managerId);
  errors.push(...rateLimitErrors);

  // Additional warnings for configuration issues
  if (managerConfig.permissions.maxSubordinates === 0 && managerConfig.permissions.canHire) {
    warnings.push({
      code: 'INCONSISTENT_PERMISSIONS',
      message: `Manager ${managerId} has canHire=true but maxSubordinates=0`,
      context: {
        managerId,
        canHire: true,
        maxSubordinates: 0,
      },
    });
  }

  if (newAgentConfig) {
    // Validate new agent's reportingTo matches managerId
    if (
      newAgentConfig.identity.reportingTo &&
      newAgentConfig.identity.reportingTo !== managerId
    ) {
      warnings.push({
        code: 'REPORTING_MISMATCH',
        message: `New agent's reportingTo (${newAgentConfig.identity.reportingTo}) doesn't match managerId (${managerId})`,
        context: {
          managerId,
          reportingTo: newAgentConfig.identity.reportingTo,
        },
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and throw if invalid
 *
 * Convenience function that calls validateHire and throws HireValidationError
 * if validation fails.
 *
 * @param db - Database instance
 * @param managerId - ID of the agent doing the hiring
 * @param newAgentId - ID of the agent being hired
 * @param newAgentConfig - Optional: Configuration of agent being hired
 * @throws HireValidationError if validation fails
 */
export function validateHireStrict(
  db: Database.Database,
  managerId: string,
  newAgentId: string,
  newAgentConfig?: AgentConfig
): void {
  const result = validateHire(db, managerId, newAgentId, newAgentConfig);
  if (!result.valid) {
    throw new HireValidationError(result.errors, result.warnings);
  }
}
