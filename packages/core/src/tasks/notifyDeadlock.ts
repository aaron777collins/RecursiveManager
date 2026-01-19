/**
 * Deadlock Alert Notification (Task 2.3.22)
 *
 * This module provides functionality to notify agents when they are involved in a task deadlock.
 * Deadlocks occur when tasks have circular dependencies (A blocks B, B blocks C, C blocks A).
 * Notifications are sent via the internal messaging system to all agents involved in the cycle.
 */

import Database from 'better-sqlite3';
import { getAgent, getTask, createMessage, auditLog, AuditAction } from '@recursive-manager/common';
import { loadAgentConfig } from '../config';
import { generateMessageId, writeMessageToInbox, MessageData } from '../messaging/messageWriter';

/**
 * Options for deadlock notification
 */
export interface NotifyDeadlockOptions {
  /** Custom data directory (defaults to ~/.recursive-manager) */
  dataDir?: string;
  /** Force notification even if agents have disabled deadlock notifications */
  force?: boolean;
}

/**
 * Sends deadlock alert notifications to all agents involved in a deadlock cycle.
 *
 * This function:
 * 1. Validates the deadlock cycle (taskIds array)
 * 2. For each task in the cycle, identifies the owner agent
 * 3. Checks if each agent has deadlock notifications enabled
 * 4. Creates a notification message with deadlock visualization
 * 5. Writes the message to each agent's inbox
 * 6. Creates database records for all messages
 * 7. Logs all notification attempts
 *
 * @param db - Database instance
 * @param taskIds - Array of task IDs forming the deadlock cycle (from detectTaskDeadlock)
 * @param options - Optional configuration
 * @returns Array of message IDs for notifications that were sent
 *
 * @example
 * ```typescript
 * const cycle = detectTaskDeadlock(db, 'task-001');
 * if (cycle) {
 *   const messageIds = await notifyDeadlock(db, cycle);
 *   console.log(`Sent ${messageIds.length} deadlock notifications`);
 * }
 * ```
 *
 * @throws {Error} If any task in the cycle doesn't exist
 */
export async function notifyDeadlock(
  db: Database.Database,
  taskIds: string[],
  options: NotifyDeadlockOptions = {}
): Promise<string[]> {
  const { dataDir, force = false } = options;

  // Validate input
  if (!taskIds || taskIds.length < 2) {
    throw new Error('Cannot notify deadlock: cycle must contain at least 2 tasks');
  }

  // Get all tasks and validate they exist
  const tasks = taskIds.map((taskId) => {
    const task = getTask(db, taskId);
    if (!task) {
      throw new Error(`Cannot notify deadlock: task ${taskId} does not exist`);
    }
    return task;
  });

  // Get all unique agents involved (some agents might own multiple tasks in the cycle)
  const agentIds = new Set<string>();
  tasks.forEach((task) => agentIds.add(task.agent_id));

  // Build deadlock visualization for message
  const cycleVisualization = tasks
    .map((task, index) => {
      const nextIndex = (index + 1) % tasks.length;
      const nextTask = tasks[nextIndex];
      return `   ${index + 1}. **${task.title}** (${task.id})
      - Owned by: ${task.agent_id}
      - Status: ${task.status}
      - Blocks → **${nextTask.title}** (${nextTask.id})`;
    })
    .join('\n\n');

  // Track successful notifications
  const sentMessageIds: string[] = [];

  // Send notification to each agent involved
  for (const agentId of agentIds) {
    // Get agent details
    const agent = getAgent(db, agentId);
    if (!agent) {
      // Skip agents that don't exist (shouldn't happen given validation above)
      console.warn(`Warning: Agent ${agentId} not found, skipping notification`);
      continue;
    }

    // Check if agent has deadlock notifications enabled (unless forced)
    if (!force) {
      try {
        const agentConfig = await loadAgentConfig(agentId, { baseDir: dataDir });

        // Check if notifications are configured and deadlock notifications are disabled
        if (agentConfig.communication?.notifyOnDeadlock === false) {
          // Agent has explicitly disabled deadlock notifications
          continue;
        }
      } catch (error) {
        // If we can't load config, we'll proceed with notification (fail-safe)
        console.warn(
          `Warning: Could not load agent config for ${agentId}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    // Get the tasks owned by this agent in the cycle
    const agentTasksInCycle = tasks.filter((t) => t.agent_id === agentId);
    const taskTitles = agentTasksInCycle.map((t) => t.title).join(', ');

    // Generate message ID
    const messageId = generateMessageId();

    // Create notification message content
    const messageContent = `# ⚠️ Task Deadlock Detected

**URGENT: Your task${agentTasksInCycle.length > 1 ? 's are' : ' is'} involved in a circular dependency deadlock.**

## Your Task${agentTasksInCycle.length > 1 ? 's' : ''} Affected

${agentTasksInCycle.map((task) => `- **${task.title}** (${task.id})`).join('\n')}

## What is a Deadlock?

A deadlock occurs when tasks have circular dependencies where each task is waiting for another to complete, creating an infinite wait cycle. None of these tasks can proceed until the deadlock is resolved.

## The Deadlock Cycle

${cycleVisualization}

## How to Resolve This

You need to break the circular dependency. Here are your options:

1. **Remove a blocking dependency**: Review your tasks and remove one of the "blocked_by" dependencies that's creating the cycle
2. **Reorder task execution**: Consider if the dependency is truly necessary or if tasks can be reordered
3. **Escalate to manager**: If you need help resolving this, escalate to your manager
4. **Complete a blocking task**: If possible, complete one of the tasks to break the cycle

## Action Required

**Priority: URGENT**
**Deadline: Immediate action needed**

Please review your task dependencies at:
${agentTasksInCycle.map((task) => `- \`agents/${agentId}/tasks/active/${task.id}/\``).join('\n')}

## Additional Context

- **Detected At:** ${new Date().toISOString()}
- **Total Tasks in Cycle:** ${tasks.length}
- **Total Agents Affected:** ${agentIds.size}
- **Your Tasks in Cycle:** ${agentTasksInCycle.length}

---

*This is an automated alert from the RecursiveManager system. Deadlocks must be resolved manually by removing circular dependencies.*`;

    // Create message data
    const messageData: MessageData = {
      id: messageId,
      from: 'system', // System-generated notification
      to: agentId,
      timestamp: new Date().toISOString(),
      priority: 'urgent', // Deadlocks are always urgent
      channel: 'internal',
      read: false,
      actionRequired: true, // Deadlocks require immediate action
      subject: `🚨 DEADLOCK: ${taskTitles}`,
      threadId: `deadlock-${taskIds.join('-')}`, // All notifications share a thread
      content: messageContent,
    };

    try {
      // Write message to inbox
      const messagePath = await writeMessageToInbox(agentId, messageData, { dataDir });

      // Create database record
      createMessage(db, {
        id: messageId,
        from_agent_id: 'system',
        to_agent_id: agentId,
        timestamp: messageData.timestamp,
        priority: messageData.priority,
        channel: 'internal',
        read: false,
        action_required: true,
        subject: messageData.subject,
        thread_id: messageData.threadId,
        message_path: messagePath,
      });

      // Audit log successful notification
      auditLog(db, {
        agentId,
        action: AuditAction.TASK_UPDATE,
        targetAgentId: null,
        success: true,
        details: {
          type: 'deadlock_notification',
          messageId,
          taskIds: agentTasksInCycle.map((t) => t.id),
          cycleTaskIds: taskIds,
          cycleSize: tasks.length,
          agentsAffected: agentIds.size,
        },
      });

      sentMessageIds.push(messageId);
    } catch (error) {
      // Audit log failed notification
      auditLog(db, {
        agentId,
        action: AuditAction.TASK_UPDATE,
        targetAgentId: null,
        success: false,
        details: {
          type: 'deadlock_notification',
          taskIds: agentTasksInCycle.map((t) => t.id),
          cycleTaskIds: taskIds,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      // Don't throw - continue notifying other agents
      console.error(`Error sending deadlock notification to ${agentId}:`, error);
    }
  }

  return sentMessageIds;
}
