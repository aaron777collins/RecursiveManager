/**
 * Task Completion Notification (Task 2.3.16)
 *
 * This module provides functionality to notify managers when their subordinates complete tasks.
 * Notifications are sent via the internal messaging system.
 */

import Database from 'better-sqlite3';
import {
  TaskRecord,
  getAgent,
  createMessage,
  auditLog,
  AuditAction,
} from '@recursive-manager/common';
import { loadAgentConfig } from '../config';
import { generateMessageId, writeMessageToInbox, MessageData } from '../messaging/messageWriter';

/**
 * Options for task completion notification
 */
export interface NotifyCompletionOptions {
  /** Custom data directory (defaults to ~/.recursive-manager) */
  dataDir?: string;
  /** Force notification even if manager has disabled completion notifications */
  force?: boolean;
}

/**
 * Sends a notification to a manager when their subordinate completes a task.
 *
 * This function:
 * 1. Finds the manager (reporting_to) of the task owner
 * 2. Checks if the manager has completion notifications enabled
 * 3. Creates a notification message with task completion details
 * 4. Writes the message to the manager's inbox
 * 5. Creates a database record for the message
 * 6. Logs the notification attempt
 *
 * @param db - Database instance
 * @param task - The task that was completed
 * @param options - Optional configuration
 * @returns The message ID if notification was sent, null if skipped
 *
 * @example
 * ```typescript
 * const messageId = await notifyTaskCompletion(db, completedTask);
 * if (messageId) {
 *   console.log(`Manager notified: ${messageId}`);
 * }
 * ```
 *
 * @throws {Error} If task owner doesn't exist
 */
export async function notifyTaskCompletion(
  db: Database.Database,
  task: TaskRecord,
  options: NotifyCompletionOptions = {}
): Promise<string | null> {
  const { dataDir, force = false } = options;

  // Get the task owner agent
  const ownerAgent = getAgent(db, task.agent_id);
  if (!ownerAgent) {
    throw new Error(`Cannot notify completion: task owner ${task.agent_id} does not exist`);
  }

  // Check if owner has a manager
  if (!ownerAgent.reporting_to) {
    // No manager to notify (root agent like CEO)
    return null;
  }

  // Get the manager agent
  const managerAgent = getAgent(db, ownerAgent.reporting_to);
  if (!managerAgent) {
    throw new Error(
      `Cannot notify completion: manager agent ${ownerAgent.reporting_to} does not exist`
    );
  }

  // Check if manager has completion notifications enabled (unless forced)
  if (!force) {
    try {
      const managerConfig = await loadAgentConfig(managerAgent.id, { baseDir: dataDir });

      // Check if notifications are configured and completion notifications are disabled
      if (managerConfig.communication?.notifyOnCompletion === false) {
        // Manager has explicitly disabled completion notifications
        return null;
      }
    } catch (error) {
      // If we can't load config, we'll proceed with notification (fail-safe)
      console.warn(
        `Warning: Could not load manager config for ${managerAgent.id}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Generate message ID
  const messageId = generateMessageId();

  // Calculate time to completion if we have created_at timestamp
  let timeToComplete = '';
  if (task.created_at && task.completed_at) {
    const created = new Date(task.created_at);
    const completed = new Date(task.completed_at);
    const durationMs = completed.getTime() - created.getTime();
    const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
    const durationMinutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));

    if (durationHours > 0) {
      timeToComplete = `${durationHours}h ${durationMinutes}m`;
    } else {
      timeToComplete = `${durationMinutes}m`;
    }
  }

  // Create notification message content
  const messageContent = `# Task Completed by ${ownerAgent.display_name}

**Task:** ${task.title}
**Completed By:** ${ownerAgent.display_name} (${task.agent_id})
**Priority:** ${task.priority}
**Completed At:** ${task.completed_at}
${timeToComplete ? `**Time to Complete:** ${timeToComplete}\n` : ''}

## Task Summary

- **Task ID:** ${task.id}
- **Parent Task:** ${task.parent_task_id || 'None (root task)'}
- **Depth:** ${task.depth}
- **Final Progress:** ${task.percent_complete}%

${task.subtasks_total > 0 ? `**Subtasks:** ${task.subtasks_completed}/${task.subtasks_total} completed\n` : ''}
${task.delegated_to ? `**Was Delegated To:** ${task.delegated_to}\n` : ''}

## Task Path

\`${task.task_path}\`

## Next Steps

Review the completed task at: \`agents/${task.agent_id}/tasks/completed/${task.id}/\`

${task.parent_task_id ? `This was a subtask. The parent task progress has been automatically updated.` : ''}

---

*This is an automated notification. Reply to this message to contact ${ownerAgent.display_name}.*`;

  // Map task priority to message priority (completions are slightly lower priority than delegations)
  let messagePriority: 'low' | 'normal' | 'high' | 'urgent' = 'normal';
  if (task.priority === 'urgent' || task.priority === 'high') {
    messagePriority = 'high';
  } else if (task.priority === 'low') {
    messagePriority = 'low';
  }

  // Create message data
  const messageData: MessageData = {
    id: messageId,
    from: task.agent_id,
    to: managerAgent.id,
    timestamp: new Date().toISOString(),
    priority: messagePriority,
    channel: 'internal',
    read: false,
    actionRequired: false, // Completions are informational, not action-required
    subject: `Task Completed: ${task.title}`,
    threadId: `task-${task.id}`,
    content: messageContent,
  };

  try {
    // Write message to inbox
    const messagePath = await writeMessageToInbox(managerAgent.id, messageData, { dataDir });

    // Create database record
    createMessage(db, {
      id: messageId,
      from_agent_id: task.agent_id,
      to_agent_id: managerAgent.id,
      timestamp: messageData.timestamp,
      priority: messageData.priority,
      channel: 'internal',
      read: false,
      action_required: false,
      subject: messageData.subject,
      thread_id: messageData.threadId,
      message_path: messagePath,
    });

    // Audit log successful notification
    auditLog(db, {
      agentId: managerAgent.id,
      action: AuditAction.TASK_COMPLETE,
      targetAgentId: task.agent_id,
      success: true,
      details: {
        type: 'completion_notification',
        messageId,
        taskId: task.id,
        taskTitle: task.title,
        fromAgent: task.agent_id,
        toAgent: managerAgent.id,
        completedAt: task.completed_at,
      },
    });

    return messageId;
  } catch (error) {
    // Audit log failed notification
    auditLog(db, {
      agentId: managerAgent.id,
      action: AuditAction.TASK_COMPLETE,
      targetAgentId: task.agent_id,
      success: false,
      details: {
        type: 'completion_notification',
        taskId: task.id,
        taskTitle: task.title,
        fromAgent: task.agent_id,
        toAgent: managerAgent.id,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}
