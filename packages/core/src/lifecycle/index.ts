/**
 * Agent Lifecycle Management Module
 *
 * This module handles all agent lifecycle operations including:
 * - Hiring validation and execution
 * - Firing and orphan handling
 * - Pausing and resuming agents
 * - Org chart management
 */

export {
  validateHire,
  validateHireStrict,
  detectCycle,
  checkHiringBudget,
  checkRateLimit,
  HireValidationError,
  type ValidationError,
  type HireValidationResult,
} from './validateHire';

export { hireAgent, HireAgentError } from './hireAgent';

export {
  fireAgent,
  FireAgentError,
  type FireStrategy,
  type FireAgentResult,
} from './fireAgent';

export {
  pauseAgent,
  PauseAgentError,
  type PauseAgentResult,
} from './pauseAgent';

export {
  resumeAgent,
  ResumeAgentError,
  type ResumeAgentResult,
} from './resumeAgent';

export {
  blockTasksForPausedAgent,
  unblockTasksForResumedAgent,
  PAUSE_BLOCKER,
  type BlockTasksResult,
  type UnblockTasksResult,
} from './taskBlocking';
