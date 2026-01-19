#!/usr/bin/env node
/**
 * RecursiveManager Scheduler Daemon
 *
 * This daemon polls the schedules table and executes jobs when they're ready.
 * It handles cron-based scheduling for periodic tasks like archiving old tasks.
 *
 * Implements Task 2.3.18: Schedule daily archival job (tasks > 7 days old)
 */

import { getDatabase } from '@recursive-manager/common';
import { archiveOldTasks, compressOldArchives, monitorDeadlocks } from '@recursive-manager/core';
import { ScheduleManager } from './ScheduleManager';
import type { ScheduleRecord } from './ScheduleManager';
import * as winston from 'winston';

/**
 * Configure Winston logger
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
          return `${timestamp} ${level}: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

/**
 * Job executor type
 */
type JobExecutor = (schedule: ScheduleRecord) => Promise<void>;

/**
 * Map of job executors by description
 *
 * This maps schedule descriptions to the actual functions that execute them.
 * New job types can be added here as needed.
 */
const JOB_EXECUTORS: Record<string, JobExecutor> = {
  'Archive tasks older than 7 days': async (schedule) => {
    const db = getDatabase();
    logger.info('Starting task archival job', { scheduleId: schedule.id });

    try {
      // Archive tasks completed more than 7 days ago
      const archivedCount = await archiveOldTasks(db, 7);
      logger.info('Task archival completed', {
        scheduleId: schedule.id,
        archivedCount,
      });

      // Also compress archives older than 90 days
      const compressedCount = await compressOldArchives(db, 90);
      logger.info('Archive compression completed', {
        scheduleId: schedule.id,
        compressedCount,
      });
    } catch (error) {
      logger.error('Task archival job failed', {
        scheduleId: schedule.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  },

  'Monitor for task deadlocks and send alerts': async (schedule) => {
    const db = getDatabase();
    logger.info('Starting deadlock monitoring job', { scheduleId: schedule.id });

    try {
      // Check all blocked tasks for deadlocks
      const result = await monitorDeadlocks(db);
      logger.info('Deadlock monitoring completed', {
        scheduleId: schedule.id,
        deadlocksDetected: result.deadlocksDetected,
        notificationsSent: result.notificationsSent,
        deadlockedTaskIds: result.deadlockedTaskIds,
      });

      // Log details if deadlocks were found
      if (result.deadlocksDetected > 0) {
        logger.warn('Task deadlocks detected', {
          scheduleId: schedule.id,
          deadlocksDetected: result.deadlocksDetected,
          cycles: result.cycles,
        });
      }
    } catch (error) {
      logger.error('Deadlock monitoring job failed', {
        scheduleId: schedule.id,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  },
};

/**
 * Execute a scheduled job
 *
 * @param schedule - The schedule to execute
 * @param scheduleManager - The schedule manager
 */
async function executeScheduledJob(
  schedule: ScheduleRecord,
  scheduleManager: ScheduleManager
): Promise<void> {
  logger.info('Executing scheduled job', {
    scheduleId: schedule.id,
    description: schedule.description,
    agentId: schedule.agent_id,
  });

  const description = schedule.description;
  if (!description) {
    logger.warn('Schedule has no description, skipping', {
      scheduleId: schedule.id,
    });
    return;
  }

  const executor = JOB_EXECUTORS[description];
  if (!executor) {
    logger.warn('No executor found for schedule description', {
      scheduleId: schedule.id,
      description,
    });
    return;
  }

  try {
    // Execute the job
    await executor(schedule);

    // Update schedule after successful execution
    scheduleManager.updateScheduleAfterExecution(schedule.id);
    logger.info('Scheduled job completed successfully', {
      scheduleId: schedule.id,
      description,
    });
  } catch (error) {
    logger.error('Scheduled job execution failed', {
      scheduleId: schedule.id,
      description,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Still update the schedule to avoid getting stuck
    // In production, you might want to implement retry logic here
    scheduleManager.updateScheduleAfterExecution(schedule.id);
  }
}

/**
 * Main scheduler loop
 *
 * Polls the schedules table every 60 seconds and executes any jobs that are ready.
 */
async function schedulerLoop(): Promise<void> {
  const db = getDatabase();
  const scheduleManager = new ScheduleManager(db);

  logger.info('Scheduler daemon started', {
    pollInterval: 60,
    unit: 'seconds',
  });

  // Main loop
  while (true) {
    try {
      // Get schedules ready to execute
      const schedules = scheduleManager.getSchedulesReadyToExecute();

      if (schedules.length > 0) {
        logger.info('Found schedules ready to execute', {
          count: schedules.length,
        });

        // Execute each schedule
        for (const schedule of schedules) {
          await executeScheduledJob(schedule, scheduleManager);
        }
      }
    } catch (error) {
      logger.error('Error in scheduler loop', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    // Wait 60 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 60000));
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    // Ensure database is initialized
    const db = getDatabase();
    const scheduleManager = new ScheduleManager(db);

    // Register the daily archival job if not already registered
    logger.info('Registering daily archival job...');
    const archivalScheduleId = scheduleManager.registerDailyArchivalJob('system');
    logger.info('Daily archival job registered', { scheduleId: archivalScheduleId });

    // Register the deadlock monitoring job if not already registered
    logger.info('Registering deadlock monitoring job...');
    const deadlockScheduleId = scheduleManager.registerDeadlockMonitoringJob('system');
    logger.info('Deadlock monitoring job registered', { scheduleId: deadlockScheduleId });

    // Start the scheduler loop
    await schedulerLoop();
  } catch (error) {
    logger.error('Fatal error in scheduler daemon', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

// Start the daemon
if (require.main === module) {
  main().catch((error) => {
    logger.error('Unhandled error in main', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  });
}
