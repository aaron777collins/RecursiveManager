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
  hireAgent,
  HireAgentError,
  pauseAgent,
  PauseAgentError,
  type PauseAgentResult,
  resumeAgent,
  ResumeAgentError,
  type ResumeAgentResult,
} from './lifecycle';

// Task Archival (Phase 2.3)
export { archiveOldTasks, compressOldArchives, getCompletedTasks } from './tasks/archiveTask';

// Deadlock Monitoring and Alerts (Task 2.3.22)
export {
  notifyDeadlock,
  type NotifyDeadlockOptions,
  monitorDeadlocks,
  type MonitorDeadlocksOptions,
  type MonitorDeadlocksResult,
} from './tasks';

// Execution Orchestrator (Phase 3.3)
export {
  ExecutionOrchestrator,
  ExecutionError,
  AnalysisError,
  type ReactiveTrigger,
  type Decision,
  type ExecutionOrchestratorOptions,
} from './execution';

// Multi-Perspective Analysis (Phase 3.1)
export { type MultiPerspectiveResult } from './ai-analysis/multi-perspective';

// Execution State Management (Phase 3.3)
export {
  saveExecutionResult,
  SaveExecutionResultError,
  type AgentMetadata,
} from './execution/state';
