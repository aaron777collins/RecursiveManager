/**
 * @recursive-manager/scheduler
 *
 * Scheduling daemon for RecursiveManager agents.
 * This package handles time-based and event-based agent execution.
 *
 * Implements Task 2.3.18: Schedule daily archival job (tasks > 7 days old)
 */

export const VERSION = '0.1.0';

// Export ScheduleManager and types
export { ScheduleManager } from './ScheduleManager';
export type {
  ScheduleRecord,
  ScheduleTriggerType,
  CreateCronScheduleInput,
} from './ScheduleManager';
