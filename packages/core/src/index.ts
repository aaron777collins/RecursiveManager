/**
 * @recursive-manager/core
 *
 * Core orchestrator and execution engine for RecursiveManager.
 * This package handles agent lifecycle, task management, and execution coordination.
 */

export const VERSION = '0.1.0';

// Agent Configuration Management (Phase 2.1)
export { loadAgentConfig, saveAgentConfig, ConfigLoadError, ConfigSaveError } from './config';

// Business Validation (Phase 2.1)
export {
  validateAgentConfigBusinessLogic,
  validateAgentConfigBusinessLogicStrict,
  BusinessValidationError,
  BusinessValidationFailure,
  BusinessValidationResult,
} from './validation/business-validation';

// Agent Lifecycle Management (Phase 2.2)
export {
  validateHire,
  validateHireStrict,
  detectCycle,
  checkHiringBudget,
  checkRateLimit,
  HireValidationError,
  type ValidationError,
  type HireValidationResult,
} from './lifecycle';
