/**
 * Task Delegation Notification (Task 2.3.12)
 *
 * This module provides functionality to notify agents when tasks are delegated to them.
 * Notifications are sent via the internal messaging system.
 */

import Database from 'better-sqlite3';
import {
  TaskRecord,
  getAgent,
  createMessage,
  auditLog,
  AuditAction,
} from '@recursivemanager/common';
import { loadAgentConfig } from '../config';
import { generateMessageId, writeMessageToInbox, MessageData } from '../messaging/messageWriter';

/**
 * Options for task delegation notification
 */
export interface NotifyDelegationOptions {
  /** Custom data directory (defaults to ~/.recursivemanager) */
  dataDir?: string;
  /** Force notification even if agent has disabled delegation notifications */
  force?: boolean;
}

/**
 * Sends a notification to an agent when a task is delegated to them.
 *
 * This function:
 * 1. Checks if the delegated agent has delegation notifications enabled
 * 2. Creates a notification message with task details
 * 3. Writes the message to the agent's inbox
 * 4. Creates a database record for the message
 * 5. Logs the notification attempt
 *
 * @param db - Database instance
 * @param task - The task that was delegated
 * @param options - Optional configuration
 * @returns The message ID if notification was sent, null if skipped
 *
 * @example
 * ```typescript
 * const messageId = await notifyTaskDelegation(db, delegatedTask);
 * if (messageId) {
 *   console.log(`Notification sent: ${messageId}`);
 * }
 * ```
 *
 * @throws {Error} If task is not delegated or agent doesn't exist
 */
export async function notifyTaskDelegation(
  db: Database.Database,
  task: TaskRecord,
  options: NotifyDelegationOptions = {}
): Promise<string | null> {
  const { dataDir, force = false } = options;

  // Validate that task is delegated
  if (!task.delegated_to) {
    throw new Error(`Cannot notify delegation: task ${task.id} is not delegated to any agent`);
  }

  // Get the delegated agent
  const delegatedAgent = getAgent(db, task.delegated_to);
  if (!delegatedAgent) {
    throw new Error(
      `Cannot notify delegation: delegated agent ${task.delegated_to} does not exist`
    );
  }

  // Check if agent has delegation notifications enabled (unless forced)
  if (!force) {
    try {
      const agentConfig = await loadAgentConfig(task.delegated_to, { baseDir: dataDir });

      // Check if notifications are configured and delegation notifications are disabled
      if (agentConfig.communication?.notifyOnDelegation === false) {
        // Agent has explicitly disabled delegation notifications
        return null;
      }
    } catch (error) {
      // If we can't load config, we'll proceed with notification (fail-safe)
      console.warn(
        `Warning: Could not load agent config for ${task.delegated_to}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  // Get the task owner agent for the "from" field
  const ownerAgent = getAgent(db, task.agent_id);
  const fromAgentName = ownerAgent?.display_name || task.agent_id;

  // Generate message ID
  const messageId = generateMessageId();

  // Create notification message content
  const messageContent = `# Task Delegated to You

**Task:** ${task.title}
**From:** ${fromAgentName} (${task.agent_id})
**Priority:** ${task.priority}
**Status:** ${task.status}
**Delegated At:** ${task.delegated_at}

## Task Details

- **Task ID:** ${task.id}
- **Parent Task:** ${task.parent_task_id || 'None (root task)'}
- **Depth:** ${task.depth}
- **Progress:** ${task.percent_complete}%

${task.subtasks_total > 0 ? `**Subtasks:** ${task.subtasks_completed}/${task.subtasks_total} completed\n` : ''}
${task.blocked_by && task.blocked_by !== '[]' ? `⚠️ **Blocked by:** ${task.blocked_by}\n` : ''}

## What You Need to Do

This task has been delegated to you. Please review the task details and:

1. Check the task workspace at: \`agents/${task.delegated_to}/tasks/active/${task.id}/\`
2. Review any context files or requirements
3. Update the task status as you work on it
4. Complete or escalate the task as appropriate

## Task Path

\`${task.task_path}\`

---

*This is an automated notification. Reply to this message to contact ${fromAgentName}.*`;

  // Create message data
  const messageData: MessageData = {
    id: messageId,
    from: task.agent_id,
    to: task.delegated_to,
    timestamp: new Date().toISOString(),
    priority: task.priority === 'urgent' ? 'urgent' : task.priority === 'high' ? 'high' : 'normal',
    channel: 'internal',
    read: false,
    actionRequired: true,
    subject: `Task Delegated: ${task.title}`,
    threadId: `task-${task.id}`,
    content: messageContent,
  };

  try {
    // Write message to inbox
    const messagePath = await writeMessageToInbox(task.delegated_to, messageData, { dataDir });

    // Create database record
    createMessage(db, {
      id: messageId,
      from_agent_id: task.agent_id,
      to_agent_id: task.delegated_to,
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
      agentId: task.delegated_to,
      action: AuditAction.TASK_UPDATE,
      targetAgentId: task.agent_id,
      success: true,
      details: {
        type: 'delegation_notification',
        messageId,
        taskId: task.id,
        taskTitle: task.title,
        fromAgent: task.agent_id,
        toAgent: task.delegated_to,
      },
    });

    return messageId;
  } catch (error) {
    // Audit log failed notification
    auditLog(db, {
      agentId: task.delegated_to,
      action: AuditAction.TASK_UPDATE,
      targetAgentId: task.agent_id,
      success: false,
      details: {
        type: 'delegation_notification',
        taskId: task.id,
        taskTitle: task.title,
        fromAgent: task.agent_id,
        toAgent: task.delegated_to,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    throw error;
  }
}
