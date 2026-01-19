/**
 * Task Management Module
 *
 * This module provides utilities for managing task files and directories.
 */

export {
  createTaskDirectory,
  moveTaskDirectory,
  CreateTaskDirectoryInput,
  TaskContext,
} from './createTaskDirectory';

export {
  notifyTaskDelegation,
  NotifyDelegationOptions,
} from './notifyDelegation';

export {
  notifyTaskCompletion,
  NotifyCompletionOptions,
} from './notifyCompletion';

export { completeTaskWithFiles } from './completeTask';

export { archiveOldTasks, getCompletedTasks } from './archiveTask';
