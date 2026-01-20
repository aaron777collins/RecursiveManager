/**
 * Agent Pause Implementation (Task 2.2.16)
 *
 * This module implements the core pauseAgent() function that orchestrates
 * the complete agent pausing process including:
 * - Status validation
 * - Status update in database
 * - Notification to agent and manager
 * - Audit logging
 * - Future: Stop active executions (when scheduler is implemented)
 *
 * Design Notes:
 * - Pausing sets agent status to 'paused' in database
 * - When scheduler is implemented, paused agents won't be executed
 * - Schedule.pauseConditions control automatic pause behavior
 * - Subordinates may be paused based on their schedule.pauseConditions
 */

import Database from 'better-sqlite3';
import { PathOptions, createAgentLogger } from '@recursive-manager/common';
import {
  getAgent,
  updateAgent,
  AgentRecord,
  createMessage,
  MessageInput,
} from '@recursive-manager/common';
import { generateMessageId, writeMessageToInbox, MessageData } from '../messaging/messageWriter';
import { blockTasksForPausedAgent, BlockTasksResult } from './taskBlocking';

/**
 * Custom error for pause operation failures
 */
export class PauseAgentError extends Error {
  constructor(
    message: string,
    public readonly agentId: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PauseAgentError';
    Error.captureStackTrace(this, PauseAgentError);
  }
}

/**
 * Result of pause operation
 */
export interface PauseAgentResult {
  agentId: string;
  status: 'paused';
  previousStatus: string;
  notificationsSent: number;
  tasksBlocked: BlockTasksResult;
}

/**
 * Send notifications to agent and manager after pausing
 *
 * Notifies:
 * 1. The paused agent (high priority, action required)
 * 2. The manager (if exists) about subordinate pause
 *
 * @param db - Database instance
 * @param agent - The agent being paused
 * @param options - Path resolution options
 */
async function notifyAgentAndManager(
  db: Database.Database,
  agent: AgentRecord,
  options: PathOptions = {}
): Promise<number> {
  const logger = createAgentLogger('system');
  const timestamp = new Date().toISOString();

  logger.info('Sending pause notifications', {
    agentId: agent.id,
    managerId: agent.reporting_to ?? undefined,
  });

  const notifications: Array<{ agentId: string; message: MessageData; dbMessage: MessageInput }> =
    [];

  // 1. Notification to the paused agent
  const agentMessageId = generateMessageId();
  const agentFilePath = `inbox/unread/${agentMessageId}.md`;

  notifications.push({
    agentId: agent.id,
    message: {
      id: agentMessageId,
      from: 'system',
      to: agent.id,
      timestamp,
      priority: 'high',
      channel: 'internal',
      read: false,
      actionRequired: true,
      subject: `Agent Paused: Your execution has been suspended`,
      content: `# Agent Paused

Your agent has been paused and will no longer execute scheduled tasks.

## Details

- **Paused At**: ${timestamp}
- **Role**: ${agent.role}
- **Previous Status**: active

## What This Means

- Your scheduled executions will not run
- You will not process tasks or messages automatically
- All work is suspended until you are resumed
- Your configuration and workspace remain intact

## How to Resume

Your manager${agent.reporting_to ? ` (${agent.reporting_to})` : ''} or a system administrator can resume your agent when ready.

To resume, they should use:
\`\`\`
recursive-manager resume ${agent.id}
\`\`\`

## Action Required

If you have any urgent tasks in progress, ensure they are documented before the pause takes full effect.

---
*This is an automated system notification.*`,
    },
    dbMessage: {
      id: agentMessageId,
      from_agent_id: 'system',
      to_agent_id: agent.id,
      timestamp,
      priority: 'high',
      channel: 'internal',
      read: false,
      action_required: true,
      subject: `Agent Paused: Your execution has been suspended`,
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
        subject: `Subordinate Paused: ${agent.role} (${agent.id})`,
        content: `# Subordinate Paused

Your subordinate **${agent.display_name}** (${agent.role}) has been paused.

## Details

- **Agent ID**: ${agent.id}
- **Role**: ${agent.role}
- **Paused At**: ${timestamp}

## Impact

- The agent will not execute any scheduled tasks
- Reactive executions (messages, triggers) will not occur
- Any tasks assigned to this agent may be delayed
- The agent remains in the organizational structure

## Next Steps

The agent will remain paused until manually resumed. To resume:

\`\`\`
recursive-manager resume ${agent.id}
\`\`\`

If the agent has active tasks, you may want to:
- Reassign urgent tasks to other agents
- Check on the agent's progress before pausing
- Plan for task completion after resumption

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
        subject: `Subordinate Paused: ${agent.role} (${agent.id})`,
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
      logger.debug('Pause notification sent successfully', {
        messageId: message.id,
        toAgent: agentId,
      });
    } catch (err) {
      logger.error('Failed to send pause notification', {
        messageId: message.id,
        toAgent: agentId,
        error: (err as Error).message,
      });
      // Continue with other notifications even if one fails
    }
  }

  logger.info('Pause notification phase completed', {
    total: notifications.length,
    success: successCount,
  });

  return successCount;
}

/**
 * Options for pauseAgent
 */
export interface PauseAgentOptions extends PathOptions {
  /**
   * ID of the agent performing the pause action (for audit logging)
   * Defaults to the target agent's manager (reporting_to) or 'system' if no manager
   */
  performedBy?: string;
}

/**
 * Pause an agent
 *
 * This function pauses an agent by setting its status to 'paused' in the database.
 * Paused agents will not execute any scheduled or reactive tasks until resumed.
 *
 * The function performs the following steps:
 *
 * 1. **Validation**
 *    - Verify agent exists
 *    - Verify agent is not already paused or fired
 *    - Get current agent status
 *
 * 2. **Database Operations**
 *    - Update agent status to 'paused'
 *    - Audit log the PAUSE action
 *
 * 3. **Block Tasks**
 *    - Block all active tasks (pending, in-progress) by setting status to 'blocked'
 *    - Add PAUSE_BLOCKER to the blocked_by field
 *    - Record blocked_since timestamp
 *
 * 4. **Notifications**
 *    - Send notification to the paused agent
 *    - Send notification to the manager (if exists)
 *    - Write messages to database and filesystem
 *
 * 5. **Future: Stop Executions** (when scheduler is implemented)
 *    - Cancel any running executions
 *    - Clear any pending scheduled executions
 *    - Update scheduler state
 *
 * Error Handling:
 * - Validation errors: Throws PauseAgentError
 * - Database errors: Throws PauseAgentError
 * - Notification errors: Logs but doesn't throw (non-critical)
 *
 * @param db - Database instance
 * @param agentId - ID of the agent to pause
 * @param options - Pause options including path resolution and performedBy
 * @returns Result object with operation details
 * @throws {PauseAgentError} If pause operation fails
 *
 * @example
 * ```typescript
 * // Pause an agent (manager pausing subordinate)
 * const result = await pauseAgent(db, 'dev-001', { performedBy: 'manager-001' });
 * console.log(`Paused agent ${result.agentId}`);
 * ```
 */
export async function pauseAgent(
  db: Database.Database,
  agentId: string,
  options: PauseAgentOptions = {}
): Promise<PauseAgentResult> {
  const logger = createAgentLogger(agentId);

  logger.info('Starting agent pause process', { agentId });

  try {
    // STEP 1: VALIDATION
    logger.debug('Validating agent status', { agentId });

    const agent = getAgent(db, agentId);
    if (!agent) {
      throw new PauseAgentError('Agent not found in database', agentId);
    }

    if (agent.status === 'paused') {
      throw new PauseAgentError('Agent is already paused', agentId);
    }

    if (agent.status === 'fired') {
      throw new PauseAgentError('Cannot pause a fired agent', agentId);
    }

    const previousStatus = agent.status;

    // Determine who is performing the pause action
    // Use null if no performedBy specified and agent has no manager (system action)
    const performedBy = options.performedBy ?? agent.reporting_to ?? null;

    logger.debug('Agent validated for pausing', {
      agentId,
      currentStatus: agent.status,
      managerId: agent.reporting_to ?? undefined,
      performedBy,
    });

    // STEP 2: DATABASE OPERATIONS
    logger.info('Updating agent status to paused', { agentId });

    try {
      const updated = updateAgent(db, agentId, { status: 'paused' });
      if (!updated) {
        throw new PauseAgentError('Failed to update agent status', agentId);
      }

      logger.info('Agent status updated to paused', {
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

      throw new PauseAgentError(`Failed to update agent status: ${error.message}`, agentId, error);
    }

    // STEP 3: BLOCK TASKS
    logger.info('Blocking active tasks for paused agent', { agentId });

    let tasksBlocked: BlockTasksResult;
    try {
      tasksBlocked = blockTasksForPausedAgent(db, agentId);
      logger.info('Task blocking completed', {
        agentId,
        totalTasks: tasksBlocked.totalTasks,
        blockedCount: tasksBlocked.blockedCount,
        alreadyBlocked: tasksBlocked.alreadyBlocked,
        errors: tasksBlocked.errors.length,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to block tasks', {
        agentId,
        error: error.message,
      });
      // Initialize empty result if blocking fails
      tasksBlocked = {
        totalTasks: 0,
        blockedCount: 0,
        alreadyBlocked: 0,
        errors: [{ taskId: 'unknown', error: error.message }],
      };
      // Don't throw - task blocking failure is non-critical for pause operation
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

    // STEP 5: STOP EXECUTIONS (Future implementation)
    // TODO: When scheduler is implemented (Phase 3+), add logic to:
    // - Cancel any running executions for this agent
    // - Clear any pending scheduled executions
    // - Update scheduler state to skip this agent
    logger.debug('Execution stop phase skipped (scheduler not yet implemented)', { agentId });

    // SUCCESS
    const result: PauseAgentResult = {
      agentId,
      status: 'paused',
      previousStatus,
      notificationsSent,
      tasksBlocked,
    };

    logger.info('Agent pause completed successfully', {
      agentId: result.agentId,
      status: result.status,
      previousStatus: result.previousStatus,
      notificationsSent: result.notificationsSent,
    });

    return result;
  } catch (err) {
    // If it's already a PauseAgentError, re-throw as-is
    if (err instanceof PauseAgentError) {
      throw err;
    }

    // Wrap unexpected errors
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Unexpected error during agent pause', {
      agentId,
      error: error.message,
    });
    throw new PauseAgentError(
      `Unexpected error during agent pause: ${error.message}`,
      agentId,
      error
    );
  }
}
