#!/usr/bin/env node
/**
 * RecursiveManager Scheduler Daemon
 *
 * This daemon polls the schedules table and executes jobs when they're ready.
 * It handles cron-based scheduling for periodic tasks like archiving old tasks.
 *
 * Implements Task 2.3.18: Schedule daily archival job (tasks > 7 days old)
 * Implements Task 3.4.7: Add process tracking (PID files) - EC-7.1 prevention
 */

import {
  getDatabase,
  acquirePidLock,
  removePidFileSync,
  createLogger,
  withTraceId,
  type Logger,
} from '@recursivemanager/common';
import { archiveOldTasks, compressOldArchives, monitorDeadlocks, ExecutionPool } from '@recursivemanager/core';
import { ScheduleManager } from './ScheduleManager';
import type { ScheduleRecord } from './ScheduleManager';

/**
 * Configure logger using common logger (with trace ID support)
 */
const logger: Logger = createLogger({
  level: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  json: true,
  console: true,
  defaultMetadata: {
    component: 'scheduler-daemon',
  },
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
    return withTraceId(async () => {
      const dbConnection = getDatabase();
      logger.info('Starting task archival job', { scheduleId: schedule.id });

    try {
      // Archive tasks completed more than 7 days ago
      const archivedCount = await archiveOldTasks(dbConnection.db, 7);
      logger.info('Task archival completed', {
        scheduleId: schedule.id,
        archivedCount,
      });

      // Also compress archives older than 90 days
      const compressedCount = await compressOldArchives(dbConnection.db, 90);
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
    }); // End withTraceId
  },

  'Monitor for task deadlocks and send alerts': async (schedule) => {
    return withTraceId(async () => {
      const dbConnection = getDatabase();
      logger.info('Starting deadlock monitoring job', { scheduleId: schedule.id });

    try {
      // Check all blocked tasks for deadlocks
      const result = await monitorDeadlocks(dbConnection.db);
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
    }); // End withTraceId
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
    // Submit job to execution pool (if configured) or execute directly
    const submittedToPool = await scheduleManager.submitScheduleToPool(
      schedule.id,
      async () => {
        await executor(schedule);
      },
      'medium' // Default priority
    );

    if (submittedToPool) {
      logger.info('Scheduled job submitted to execution pool', {
        scheduleId: schedule.id,
        description,
      });

      // Note: The execution pool will handle the actual execution
      // We don't wait for completion here to avoid blocking the scheduler
    } else {
      // No execution pool configured, execute directly
      await executor(schedule);

      logger.info('Scheduled job completed successfully', {
        scheduleId: schedule.id,
        description,
      });
    }

    // Update schedule after successful submission/execution
    scheduleManager.updateScheduleAfterExecution(schedule.id);

    // Clear execution ID since we've updated next_execution_at (only if not submitted to pool)
    if (!submittedToPool) {
      scheduleManager.setExecutionId(schedule.id, null);
    }
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
    scheduleManager.setExecutionId(schedule.id, null);
  }
}

/**
 * Main scheduler loop
 *
 * Polls the schedules table every 60 seconds and executes any jobs that are ready.
 * Uses ExecutionPool for dependency-aware scheduling.
 */
async function schedulerLoop(): Promise<void> {
  const dbConnection = getDatabase();

  // Create ExecutionPool for dependency-aware scheduling
  const executionPool = new ExecutionPool({
    maxConcurrent: 10,
    enableDependencyGraph: true,
  });

  const scheduleManager = new ScheduleManager(dbConnection.db, executionPool);

  logger.info('Scheduler daemon started with dependency-aware execution', {
    pollInterval: 60,
    unit: 'seconds',
    maxConcurrent: 10,
    dependencyGraphEnabled: true,
  });

  // Main loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // Get schedules ready to execute (with dependency resolution)
      const schedules = scheduleManager.getSchedulesReadyWithDependencies();

      if (schedules.length > 0) {
        logger.info('Found schedules ready to execute', {
          count: schedules.length,
          scheduleIds: schedules.map((s) => s.id),
        });

        // Execute each schedule (submitted to execution pool with dependencies)
        for (const schedule of schedules) {
          await executeScheduledJob(schedule, scheduleManager);
        }
      }

      // Log execution pool statistics
      const stats = executionPool.getStatistics();
      if (stats.queueDepth > 0 || stats.activeCount > 0) {
        logger.info('Execution pool statistics', stats as any);
      }

      // Log dependency graph statistics if available
      const depStats = executionPool.getDependencyGraphStatistics();
      if (depStats && depStats.totalNodes > 0) {
        logger.info('Dependency graph statistics', depStats as any);
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
  let releasePidLock: (() => Promise<void>) | null = null;

  try {
    // Acquire PID lock to prevent duplicate instances (EC-7.1)
    logger.info('Acquiring PID lock for scheduler daemon...');
    releasePidLock = await acquirePidLock('scheduler-daemon');
    logger.info('PID lock acquired successfully');

    // Ensure database is initialized
    const dbConnection = getDatabase();

    // Create ExecutionPool for dependency-aware scheduling
    const executionPool = new ExecutionPool({
      maxConcurrent: 10,
      enableDependencyGraph: true,
    });

    const scheduleManager = new ScheduleManager(dbConnection.db, executionPool);

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

    // Release PID lock if acquired
    if (releasePidLock) {
      try {
        await releasePidLock();
      } catch (cleanupError) {
        logger.error('Failed to release PID lock during error cleanup', {
          error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
      }
    }

    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  // Synchronously remove PID file before exit
  removePidFileSync('scheduler-daemon');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  // Synchronously remove PID file before exit
  removePidFileSync('scheduler-daemon');
  process.exit(0);
});

// Handle unexpected exits
process.on('exit', () => {
  // Synchronously remove PID file on any exit
  removePidFileSync('scheduler-daemon');
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
