/**
 * Agent Resume Implementation (Task 2.2.17)
 *
 * This module implements the core resumeAgent() function that orchestrates
 * the complete agent resuming process including:
 * - Status validation
 * - Status update in database
 * - Notification to agent and manager
 * - Audit logging
 * - Future: Reschedule executions (when scheduler is implemented)
 *
 * Design Notes:
 * - Resuming sets agent status to 'active' in database
 * - When scheduler is implemented, resumed agents will be rescheduled
 * - Paused tasks assigned to the agent can now be processed
 * - Subordinates are NOT automatically resumed (manual per-agent control)
 */

import Database from 'better-sqlite3';
import { PathOptions, createAgentLogger } from '@recursivemanager/common';
import {
  getAgent,
  updateAgent,
  AgentRecord,
  createMessage,
  MessageInput,
} from '@recursivemanager/common';
import { generateMessageId, writeMessageToInbox, MessageData } from '../messaging/messageWriter';
import { unblockTasksForResumedAgent, UnblockTasksResult } from './taskBlocking';
import { ExecutionPool } from '../execution/ExecutionPool.js';

/**
 * Custom error for resume operation failures
 */
export class ResumeAgentError extends Error {
  constructor(
    message: string,
    public readonly agentId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ResumeAgentError';
    Error.captureStackTrace(this, ResumeAgentError);
  }
}

/**
 * Result of resume operation
 */
export interface ResumeAgentResult {
  agentId: string;
  status: 'active';
  previousStatus: string;
  notificationsSent: number;
  tasksUnblocked: UnblockTasksResult;
  /**
   * Number of queued executions found for this agent
   * Only populated if executionPool is provided
   */
  queuedExecutions?: number;
}

/**
 * Send notifications to agent and manager after resuming
 *
 * Notifies:
 * 1. The resumed agent (normal priority, informational)
 * 2. The manager (if exists) about subordinate resumption
 *
 * @param db - Database instance
 * @param agent - The agent being resumed
 * @param options - Path resolution options
 */
async function notifyAgentAndManager(
  db: Database.Database,
  agent: AgentRecord,
  options: PathOptions = {}
): Promise<number> {
  const logger = createAgentLogger('system');
  const timestamp = new Date().toISOString();

  logger.info('Sending resume notifications', {
    agentId: agent.id,
    managerId: agent.reporting_to ?? undefined,
  });

  const notifications: Array<{ agentId: string; message: MessageData; dbMessage: MessageInput }> =
    [];

  // 1. Notification to the resumed agent
  const agentMessageId = generateMessageId();
  const agentFilePath = `inbox/unread/${agentMessageId}.md`;

  notifications.push({
    agentId: agent.id,
    message: {
      id: agentMessageId,
      from: 'system',
      to: agent.id,
      timestamp,
      priority: 'normal',
      channel: 'internal',
      read: false,
      actionRequired: false,
      subject: `Agent Resumed: Your execution has been restored`,
      content: `# Agent Resumed

Your agent has been resumed and is now active again.

## Details

- **Resumed At**: ${timestamp}
- **Role**: ${agent.role}
- **Previous Status**: paused

## What This Means

- Your scheduled executions will now run as configured
- You will process tasks and messages automatically
- All work has been restored
- Your configuration and workspace remain as they were

## Next Steps

You can now continue working on your tasks. Check your task list for any pending work:
\`\`\`
recursivemanager run ${agent.id}
\`\`\`

If you have tasks that were blocked during the pause, they should now be unblocked and ready to process.

---
*This is an automated system notification.*`,
    },
    dbMessage: {
      id: agentMessageId,
      from_agent_id: 'system',
      to_agent_id: agent.id,
      timestamp,
      priority: 'normal',
      channel: 'internal',
      read: false,
      action_required: false,
      subject: `Agent Resumed: Your execution has been restored`,
      message_path: agentFilePath,
    },
  });

  // 2. Notification to the manager (if exists)
  if (agent.reporting_to) {
    const managerMessageId = generateMessageId();
    const managerFilePath = `inbox/unread/${managerMessageId}.md`;

    notifications.push({
      agentId: agent.reporting_to,
      message: {
        id: managerMessageId,
        from: 'system',
        to: agent.reporting_to,
        timestamp,
        priority: 'normal',
        channel: 'internal',
        read: false,
        actionRequired: false,
        subject: `Subordinate Resumed: ${agent.role} (${agent.id})`,
        content: `# Subordinate Resumed

Your subordinate **${agent.display_name}** (${agent.role}) has been resumed and is now active.

## Details

- **Agent ID**: ${agent.id}
- **Role**: ${agent.role}
- **Resumed At**: ${timestamp}

## Impact

- The agent will now execute scheduled tasks
- Reactive executions (messages, triggers) will resume
- Any tasks assigned to this agent can now proceed
- The agent is fully operational again

## Next Steps

The agent is now active and will process work according to its schedule. No action is required from you unless:
- You have new tasks to assign
- You need to check on progress of previously blocked tasks
- You want to adjust the agent's schedule or configuration

---
*This is an automated system notification.*`,
      },
      dbMessage: {
        id: managerMessageId,
        from_agent_id: 'system',
        to_agent_id: agent.reporting_to,
        timestamp,
        priority: 'normal',
        channel: 'internal',
        read: false,
        action_required: false,
        subject: `Subordinate Resumed: ${agent.role} (${agent.id})`,
        message_path: managerFilePath,
      },
    });
  }

  // Send all notifications
  let successCount = 0;

  for (const { agentId, message, dbMessage } of notifications) {
    try {
      // Write to database
      createMessage(db, dbMessage);

      // Write to filesystem (map baseDir to dataDir for message writer options)
      await writeMessageToInbox(agentId, message, { dataDir: options.baseDir });

      successCount++;
      logger.debug('Resume notification sent successfully', {
        messageId: message.id,
        toAgent: agentId,
      });
    } catch (err) {
      logger.error('Failed to send resume notification', {
        messageId: message.id,
        toAgent: agentId,
        error: (err as Error).message,
      });
      // Continue with other notifications even if one fails
    }
  }

  logger.info('Resume notification phase completed', {
    total: notifications.length,
    success: successCount,
  });

  return successCount;
}

/**
 * Options for resumeAgent
 */
export interface ResumeAgentOptions extends PathOptions {
  /**
   * ID of the agent performing the resume action (for audit logging)
   * Defaults to the target agent's manager (reporting_to) or 'system' if no manager
   */
  performedBy?: string;
  /**
   * Execution pool for managing queued executions
   * If provided, will trigger queue processing for any eligible tasks
   * If not provided, execution resume will be skipped
   */
  executionPool?: ExecutionPool;
}

/**
 * Resume an agent
 *
 * This function resumes a paused agent by setting its status to 'active' in the database.
 * Resumed agents will execute scheduled and reactive tasks according to their configuration.
 *
 * The function performs the following steps:
 *
 * 1. **Validation**
 *    - Verify agent exists
 *    - Verify agent is currently paused
 *    - Get current agent status
 *
 * 2. **Database Operations**
 *    - Update agent status to 'active'
 *    - Audit log the RESUME action
 *
 * 3. **Unblock Tasks**
 *    - Unblock tasks that were blocked due to agent pause
 *    - Remove PAUSE_BLOCKER from the blocked_by field
 *    - Restore tasks to 'pending' status if no other blockers remain
 *
 * 4. **Notifications**
 *    - Send notification to the resumed agent
 *    - Send notification to the manager (if exists)
 *    - Write messages to database and filesystem
 *
 * 5. **Future: Reschedule Executions** (when scheduler is implemented)
 *    - Add agent back to scheduler queue
 *    - Calculate next execution time based on schedule
 *    - Update scheduler state
 *
 * Error Handling:
 * - Validation errors: Throws ResumeAgentError
 * - Database errors: Throws ResumeAgentError
 * - Notification errors: Logs but doesn't throw (non-critical)
 *
 * @param db - Database instance
 * @param agentId - ID of the agent to resume
 * @param options - Resume options including path resolution and performedBy
 * @returns Result object with operation details
 * @throws {ResumeAgentError} If resume operation fails
 *
 * @example
 * ```typescript
 * // Resume an agent (manager resuming subordinate)
 * const result = await resumeAgent(db, 'dev-001', { performedBy: 'manager-001' });
 * console.log(`Resumed agent ${result.agentId}`);
 * ```
 */
export async function resumeAgent(
  db: Database.Database,
  agentId: string,
  options: ResumeAgentOptions = {}
): Promise<ResumeAgentResult> {
  const logger = createAgentLogger(agentId);

  logger.info('Starting agent resume process', { agentId });

  try {
    // STEP 1: VALIDATION
    logger.debug('Validating agent status', { agentId });

    const agent = getAgent(db, agentId);
    if (!agent) {
      throw new ResumeAgentError('Agent not found in database', agentId);
    }

    if (agent.status !== 'paused') {
      throw new ResumeAgentError(
        `Cannot resume agent with status '${agent.status}'. Only paused agents can be resumed.`,
        agentId
      );
    }

    const previousStatus = agent.status;

    // Determine who is performing the resume action
    // Use null if no performedBy specified and agent has no manager (system action)
    const performedBy = options.performedBy ?? agent.reporting_to ?? null;

    logger.debug('Agent validated for resuming', {
      agentId,
      currentStatus: agent.status,
      managerId: agent.reporting_to ?? undefined,
      performedBy,
    });

    // STEP 2: DATABASE OPERATIONS
    logger.info('Updating agent status to active', { agentId });

    try {
      const updated = updateAgent(db, agentId, { status: 'active' });
      if (!updated) {
        throw new ResumeAgentError('Failed to update agent status', agentId);
      }

      logger.info('Agent status updated to active', {
        agentId,
        status: updated.status,
        previousStatus,
      });

      // Note: updateAgent already creates an audit log for status changes
      // The audit log will have agentId: null until updateAgent is enhanced
      // to accept a performedBy parameter
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to update agent status', {
        agentId,
        error: error.message,
      });

      throw new ResumeAgentError(`Failed to update agent status: ${error.message}`, agentId, error);
    }

    // STEP 3: UNBLOCK TASKS
    logger.info('Unblocking tasks for resumed agent', { agentId });

    let tasksUnblocked: UnblockTasksResult;
    try {
      tasksUnblocked = unblockTasksForResumedAgent(db, agentId);
      logger.info('Task unblocking completed', {
        agentId,
        totalTasks: tasksUnblocked.totalTasks,
        unblockedCount: tasksUnblocked.unblockedCount,
        stillBlocked: tasksUnblocked.stillBlocked,
        errors: tasksUnblocked.errors.length,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to unblock tasks', {
        agentId,
        error: error.message,
      });
      // Initialize empty result if unblocking fails
      tasksUnblocked = {
        totalTasks: 0,
        unblockedCount: 0,
        stillBlocked: 0,
        errors: [{ taskId: 'unknown', error: error.message }],
      };
      // Don't throw - task unblocking failure is non-critical for resume operation
    }

    // STEP 4: NOTIFICATIONS
    logger.info('Notifying agent and manager', { agentId });

    let notificationsSent = 0;
    try {
      notificationsSent = await notifyAgentAndManager(db, agent, options);
      logger.info('Notifications sent', { agentId, count: notificationsSent });
    } catch (err) {
      logger.error('Failed to send notifications', {
        agentId,
        error: (err as Error).message,
      });
      // Don't throw - notification failure is non-critical
    }

    // STEP 5: RESUME EXECUTIONS
    logger.info('Resuming executions for agent', { agentId });

    let queuedExecutions = 0;
    if (options.executionPool) {
      try {
        // Resume executions by triggering queue processing
        const resumeResult = options.executionPool.resumeExecutionsForAgent(agentId);
        queuedExecutions = resumeResult.queuedExecutions;

        logger.info('Executions resumed', {
          agentId,
          queuedExecutions,
        });

        if (queuedExecutions > 0) {
          logger.info('Agent has queued executions that will be processed', {
            agentId,
            queuedExecutions,
          });
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Failed to resume executions', {
          agentId,
          error: error.message,
        });
        // Don't throw - execution resume failure is non-critical for resume operation
      }
    } else {
      logger.debug('Execution resume phase skipped (no executionPool provided)', { agentId });
    }

    // SUCCESS
    const result: ResumeAgentResult = {
      agentId,
      status: 'active',
      previousStatus,
      notificationsSent,
      tasksUnblocked,
      ...(options.executionPool && {
        queuedExecutions,
      }),
    };

    logger.info('Agent resume completed successfully', {
      agentId: result.agentId,
      status: result.status,
      previousStatus: result.previousStatus,
      notificationsSent: result.notificationsSent,
    });

    return result;
  } catch (err) {
    // If it's already a ResumeAgentError, re-throw as-is
    if (err instanceof ResumeAgentError) {
      throw err;
    }

    // Wrap unexpected errors
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Unexpected error during agent resume', {
      agentId,
      error: error.message,
    });
    throw new ResumeAgentError(
      `Unexpected error during agent resume: ${error.message}`,
      agentId,
      error
    );
  }
}
