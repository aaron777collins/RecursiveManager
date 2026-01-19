/**
 * Deadlock Monitoring Worker (Task 2.3.22)
 *
 * This module provides functionality to scan all blocked tasks for deadlocks
 * and send alerts when deadlocks are detected.
 */

import type { Database } from 'better-sqlite3';
import { detectTaskDeadlock, getTask } from '@recursive-manager/common';
import { notifyDeadlock } from './notifyDeadlock';

/**
 * Options for deadlock monitoring
 */
export interface MonitorDeadlocksOptions {
  /** Custom data directory (defaults to ~/.recursive-manager) */
  dataDir?: string;
  /** Force notifications even if agents have disabled deadlock notifications */
  force?: boolean;
}

/**
 * Result from deadlock monitoring
 */
export interface MonitorDeadlocksResult {
  /** Number of deadlocks detected */
  deadlocksDetected: number;
  /** Number of notifications sent */
  notificationsSent: number;
  /** Task IDs involved in deadlocks */
  deadlockedTaskIds: string[];
  /** Details of each deadlock cycle */
  cycles: string[][];
}

/**
 * Monitor all blocked tasks for deadlocks and send alerts
 *
 * This function:
 * 1. Queries all tasks with status 'blocked'
 * 2. For each blocked task, runs deadlock detection
 * 3. Deduplicates detected cycles (same cycle from different entry points)
 * 4. Sends notifications to all agents involved in deadlock cycles
 * 5. Returns statistics about detected deadlocks and sent notifications
 *
 * **Deduplication Logic:**
 * Since detectTaskDeadlock can be called on any task in a cycle and will return
 * the same cycle (possibly rotated), we deduplicate by creating a canonical form:
 * sorted array of task IDs. This ensures we only alert once per unique cycle.
 *
 * @param db - Database instance
 * @param options - Optional configuration
 * @returns Statistics about detected deadlocks and sent notifications
 *
 * @example
 * ```typescript
 * const result = await monitorDeadlocks(db);
 * console.log(`Detected ${result.deadlocksDetected} deadlocks`);
 * console.log(`Sent ${result.notificationsSent} notifications`);
 * ```
 */
export async function monitorDeadlocks(
  db: Database,
  options: MonitorDeadlocksOptions = {}
): Promise<MonitorDeadlocksResult> {
  const { dataDir, force = false } = options;

  // Get all blocked tasks
  const blockedTasks = db
    .prepare(
      `
    SELECT id
    FROM tasks
    WHERE status = 'blocked'
    ORDER BY created_at ASC
  `
    )
    .all() as { id: string }[];

  // Track detected cycles (using canonical form for deduplication)
  const detectedCycles = new Map<string, string[]>();
  const allDeadlockedTaskIds = new Set<string>();

  // Check each blocked task for deadlocks
  for (const blockedTask of blockedTasks) {
    try {
      const cycle = detectTaskDeadlock(db, blockedTask.id);

      if (cycle && cycle.length >= 2) {
        // Create canonical form: sorted array of task IDs
        const canonicalForm = [...cycle].sort().join('|');

        // Only process if we haven't seen this cycle before
        if (!detectedCycles.has(canonicalForm)) {
          detectedCycles.set(canonicalForm, cycle);

          // Track all task IDs involved in deadlocks
          cycle.forEach((taskId) => allDeadlockedTaskIds.add(taskId));
        }
      }
    } catch (error) {
      // Log error but continue checking other tasks
      console.error(
        `Error detecting deadlock for task ${blockedTask.id}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Send notifications for each unique cycle
  let totalNotificationsSent = 0;
  const cycles: string[][] = [];

  for (const [canonicalForm, cycle] of detectedCycles.entries()) {
    try {
      const messageIds = await notifyDeadlock(db, cycle, { dataDir, force });
      totalNotificationsSent += messageIds.length;
      cycles.push(cycle);
    } catch (error) {
      // Log error but continue processing other cycles
      console.error(
        `Error sending notifications for deadlock cycle ${canonicalForm}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  return {
    deadlocksDetected: detectedCycles.size,
    notificationsSent: totalNotificationsSent,
    deadlockedTaskIds: Array.from(allDeadlockedTaskIds),
    cycles,
  };
}
